import { describe, expect, it } from "vitest";

import {
  computeHistogram,
  histogramBinList,
  histogramEdge,
  quantileSorted,
  ulpOf,
  resolveHistogramBins,
  type Histogram,
} from "../histogram";

/** A deterministic, roughly normal sample: the mean of four LCG uniforms (Irwin-Hall), exact IEEE arithmetic only. */
function sample(n: number, mean: number, sd: number, seed = 7): number[] {
  let s = seed;
  const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: n }, () => mean + sd * (u() + u() + u() + u() - 2) * Math.sqrt(3));
}

/** The edges the counting used: start + i * width (from halves where that overflows), i = 0..k. */
const edgesOf = (h: Histogram) =>
  Array.from({ length: h.counts.length + 1 }, (_, i) => histogramEdge(h.start, h.width, i));

/** Count `values` against `h`'s edges independently: [lower, upper), the last class closed. */
function recount(values: readonly number[], h: Histogram): number[] {
  const edges = edgesOf(h);
  const k = h.counts.length;
  const counts = new Array<number>(k).fill(0);
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const i = edges.findIndex(
      (e, j) => j < k && v >= e && (j === k - 1 ? v <= edges[k]! : v < edges[j + 1]!),
    );
    expect(i, `value ${v} lies in no class`).toBeGreaterThanOrEqual(0);
    counts[i]! += 1;
  }
  return counts;
}

/** The three guarantees: equal widths (by construction), counts summing to n, edges covering min to max. */
function expectInvariants(values: readonly number[], h: Histogram) {
  const finite = values.filter(Number.isFinite);
  expect(h.n).toBe(finite.length);
  expect(h.counts.reduce((a, b) => a + b, 0)).toBe(h.n);
  expect(recount(values, h)).toEqual(h.counts);
  if (h.n === 0) return;
  expect(h.start).toBe(Math.min(...finite));
  expect(h.start + h.counts.length * h.width).toBeGreaterThanOrEqual(Math.max(...finite));
  // The smallest and the largest value lie in the first and the last class.
  expect(h.counts[0]).toBeGreaterThan(0);
  expect(h.counts[h.counts.length - 1]).toBeGreaterThan(0);
}

describe("quantileSorted (type 7)", () => {
  it("interpolates between order statistics as R and NumPy do by default", () => {
    // R: quantile(c(1, 2, 3, 4), c(0.25, 0.5, 0.75)) → 1.75 2.5 3.25
    expect(quantileSorted([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4], 0.75)).toBe(3.25);
    expect(quantileSorted([5], 0.25)).toBe(5);
    expect(quantileSorted([], 0.5)).toBeNaN();
    expect(quantileSorted([1, 2, 3], 0)).toBe(1);
    expect(quantileSorted([1, 2, 3], 1)).toBe(3);
  });
});

/** A deterministic integer sample of one of three shapes, from an LCG and exact IEEE operations only. */
function intSample(n: number, shape: "normal" | "skewed" | "outliers", seed: number): number[] {
  let s = seed;
  const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const z = () => (u() + u() + u() + u() - 2) * Math.sqrt(3); // about normal, sd 1
  return Array.from({ length: n }, () => {
    if (shape === "normal") return Math.round(900 + 30 * z());
    if (shape === "skewed") return 100 + Math.round(1000 * u() ** 6);
    return Math.round(u() < 0.95 ? 900 + 30 * z() : 1100 + 200 * u());
  });
}

/**
 * R33's k for integer values, exactly, with none of the module's code:
 * type-7 quartiles as fractions over 4 (h = (n - 1) p falls on quarters),
 * then the least m with m * 2 * IQR >= range * n^(1/3) - cubed, so in
 * integers: m^3 * (4 IQR)^3 >= 8 * range^3 * n - bounded to [20, 60]. Also
 * the quartiles, and whether the quotient's fractional part is under one half
 * (q < m - 1/2, so (2m - 1)^3 * (4 IQR)^3 > 64 * range^3 * n): there,
 * rounding instead of the ceiling would choose m - 1.
 */
function exactRule(values: readonly number[]) {
  const xs = values.map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const n = BigInt(xs.length);
  const quarters = (j: bigint) => {
    const h4 = (n - 1n) * j; // 4h for p = j / 4
    const lo = Number(h4 / 4n);
    const a = xs[lo]!;
    const b = xs[Math.min(lo + 1, xs.length - 1)]!;
    return 4n * a + (h4 % 4n) * (b - a); // 4 * (a + (h - lo) * (b - a))
  };
  const [q1x4, q3x4] = [quarters(1n), quarters(3n)];
  const iqr4 = q3x4 - q1x4;
  const range = xs[xs.length - 1]! - xs[0]!;
  const quartiles = { q1: Number(q1x4) / 4, q3: Number(q3x4) / 4 };
  if (iqr4 === 0n) return { k: 60, m: Infinity, underHalf: false, ...quartiles };
  const rhs = 8n * range ** 3n * n;
  let m = 1n;
  while (m ** 3n * iqr4 ** 3n < rhs) m++;
  const underHalf = (2n * m - 1n) ** 3n * iqr4 ** 3n > 64n * range ** 3n * n;
  return { k: Math.min(60, Math.max(20, Number(m))), m: Number(m), underHalf, ...quartiles };
}

describe("computeHistogram - the Freedman-Diaconis rule, bounded (R33)", () => {
  it("chooses k as an exact reference does: ceil((max - min) / (2 IQR n^(-1/3))) inside [20, 60]", () => {
    const table: Array<{ m: number; underHalf: boolean }> = [];
    for (const shape of ["normal", "skewed", "outliers"] as const) {
      for (const n of [40, 300, 700, 1500, 3000]) {
        for (let seed = 1; seed <= 10; seed++) {
          const values = intSample(n, shape, seed);
          const want = exactRule(values);
          const h = computeHistogram(values);
          const at = `${shape}, n ${n}, seed ${seed}`;
          expect(h.counts.length, at).toBe(want.k);
          expect([h.q1, h.q3], at).toEqual([want.q1, want.q3]);
          expect(
            h.counts.reduce((a, b) => a + b, 0),
            at,
          ).toBe(n);
          table.push(want);
        }
      }
    }
    // Not vacuous: the bounds bite at both ends, and many quotients inside them
    // have a fractional part under one half, where rounding would choose m - 1
    // (from 21 up: below that the floor of 20 would hide it).
    expect(table.some((r) => r.m < 20)).toBe(true);
    expect(table.some((r) => r.m > 60)).toBe(true);
    // Of the 150 samples: 51 under the floor, 20 over the ceiling, 53 inside
    // with a fractional part under one half and 23 with one over it.
    const inside = table.filter((r) => r.m >= 21 && r.m <= 60);
    expect(inside.filter((r) => r.underHalf).length).toBeGreaterThanOrEqual(40);
    expect(inside.filter((r) => !r.underHalf).length).toBeGreaterThanOrEqual(15);
  });

  it("bounds the rule: a flat sample takes the 20-class floor, a heavy tail the 60-class ceiling", () => {
    // 0..999: IQR 499.5, h = 2 * 499.5 / 10 = 99.9 → 10 classes by the rule → 20.
    const flat = Array.from({ length: 1000 }, (_, i) => i);
    const f = computeHistogram(flat);
    expect(f.counts).toHaveLength(20);
    expect(f.width).toBeCloseTo(999 / 20, 12);
    // Every class holds exactly 50 integers (no integer sits on an edge 49.95 i).
    expect(f.counts).toEqual(new Array(20).fill(50));
    expectInvariants(flat, f);

    // A tight core with far outliers: the rule asks for hundreds of classes → 60.
    const tail = [...sample(2000, 100, 1), 10_000];
    const t = computeHistogram(tail);
    expect(t.counts).toHaveLength(60);
    expectInvariants(tail, t);
  });

  it("takes a fixed class count, or other bounds, and falls back on invalid ones", () => {
    const values = sample(500, 50, 5);
    expect(computeHistogram(values, { bins: 7 }).counts).toHaveLength(7);
    expect(computeHistogram(values, { bins: 7.4 }).counts).toHaveLength(7);
    expect(computeHistogram(values, { minBins: 5, maxBins: 5 }).counts).toHaveLength(5);
    // maxBins below minBins: the floor wins.
    expect(computeHistogram(values, { minBins: 30, maxBins: 10 }).counts).toHaveLength(30);
    // Invalid: the rule and its default bounds.
    const rule = computeHistogram(values).counts.length;
    expect(computeHistogram(values, { bins: 0 }).counts).toHaveLength(rule);
    expect(computeHistogram(values, { bins: Number.NaN, minBins: -3 }).counts).toHaveLength(rule);
    // A hard ceiling of 10,000 classes.
    expect(computeHistogram([0, 1], { bins: 1e9 }).counts).toHaveLength(10_000);
    for (const bins of [1, 2, 7, 33, 500])
      expectInvariants(values, computeHistogram(values, { bins }));
  });

  it("counts a value on an edge into the class above it, and the largest into the last", () => {
    // 1..100 in 10 classes of 9.9: edges 1, 10.9, ..., 100.
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const h = computeHistogram(values, { bins: 10 });
    expect(h.counts).toEqual(new Array(10).fill(10));
    // Values placed exactly on every floating-point edge the counting uses.
    const onEdges = edgesOf(h);
    const e = computeHistogram([...onEdges], { bins: 10 });
    expect(e.width).toBe(h.width);
    // Edge i opens class i; the last edge (the maximum) closes the last class.
    expect(e.counts).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
    expectInvariants(onEdges, e);
  });

  it("is invariant to the order of the values", () => {
    const values = sample(3000, 0, 1, 99);
    const reversed = [...values].reverse();
    const interleaved = values.filter((_, i) => i % 2 === 0).concat(values.filter((_, i) => i % 2));
    const h = computeHistogram(values);
    expect(computeHistogram(reversed)).toEqual(h);
    expect(computeHistogram(interleaved)).toEqual(h);
  });

  it("covers the largest value even when (max - min) / k rounds short", () => {
    // Ranges whose plain width leaves the last edge below the largest value.
    for (const [lo, hi, k] of [
      [0.1, 0.3, 3],
      [0.1, 0.5, 7],
      [0.1, 0.7, 11],
      [0.1, 0.3, 20],
    ] as const) {
      const plain = hi / k - lo / k;
      expect(lo + k * plain, "the case falls short without the nudge").toBeLessThan(hi);
      const values = [lo, (lo + hi) / 2, hi];
      const h = computeHistogram(values, { bins: k });
      // Nudged up by the last unit(s) of rounding, no more.
      expect(h.width).toBeGreaterThan(plain);
      expect(h.width).toBeLessThanOrEqual(plain * (1 + 4 * Number.EPSILON));
      expect(h.start + k * h.width).toBeGreaterThanOrEqual(hi);
      expectInvariants(values, h);
    }
  });

  it("stays finite near the largest doubles", () => {
    const values = [-1e308, -5e307, 0, 5e307, 1e308];
    const h = computeHistogram(values);
    expect(Number.isFinite(h.width)).toBe(true);
    expect(edgesOf(h).every(Number.isFinite)).toBe(true);
    expectInvariants(values, h);
    // Even one class asked for: two, since one would be wider than a double.
    const one = computeHistogram([-1.7e308, 1.7e308], { bins: 1 });
    expect(one.counts).toEqual([1, 1]);
    expect(Number.isFinite(one.width)).toBe(true);
  });

  it("takes each edge as the plain sum start + i * width wherever that is finite", () => {
    for (const [start, width] of [
      [0.1, 0.2],
      [910.8441, 4.2879],
      [-3.3, 1e-9],
    ] as const) {
      for (let i = 0; i <= 60; i++) expect(histogramEdge(start, width, i)).toBe(start + i * width);
    }
    // Where the plain sum overflows, the halves give the true, finite edge.
    expect(-1e308 + 19 * 1e307).toBe(Number.POSITIVE_INFINITY);
    expect(histogramEdge(-1e308, 1e307, 19)).toBeCloseTo(9e307, -296);
  });

  it("leaves non-finite values out and counts the rest", () => {
    const values = [1, Number.NaN, 2, Number.POSITIVE_INFINITY, 3, Number.NEGATIVE_INFINITY, 4];
    const h = computeHistogram(values, { bins: 3 });
    expect(h.n).toBe(4);
    expect(h.min).toBe(1);
    expect(h.max).toBe(4);
    expectInvariants(values, h);
  });

  it("gives no class for no values, and one class of width 0 for equal values", () => {
    const empty = computeHistogram([]);
    expect(empty).toEqual({
      start: 0,
      width: 0,
      counts: [],
      n: 0,
      min: Number.NaN,
      max: Number.NaN,
      q1: Number.NaN,
      q3: Number.NaN,
    });
    expect(computeHistogram([Number.NaN]).n).toBe(0);

    const equal = computeHistogram([5, 5, 5, 5], { bins: 10 });
    expect(equal).toEqual({ start: 5, width: 0, counts: [4], n: 4, min: 5, max: 5, q1: 5, q3: 5 });
    expect(computeHistogram([42])).toMatchObject({ start: 42, width: 0, counts: [1], n: 1 });
  });

  it("takes the most classes allowed when the middle half has no width", () => {
    // 90 equal values and 10 spread ones: IQR 0, so the rule gives way to maxBins.
    const values = [...new Array(90).fill(10), ...Array.from({ length: 10 }, (_, i) => 11 + i)];
    const h = computeHistogram(values, { maxBins: 40 });
    expect(h.q1).toBe(10);
    expect(h.q3).toBe(10);
    expect(h.counts).toHaveLength(40);
    expectInvariants(values, h);
  });

  it("matches a golden for a fixed sample", () => {
    const h = computeHistogram([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9], { bins: 4 });
    // min 1, max 9, width 2: [1,3) [3,5) [5,7) [7,9].
    expect(h.start).toBe(1);
    expect(h.width).toBe(2);
    expect(h.counts).toEqual([3, 3, 4, 5]);
    expect(h.n).toBe(15);
  });
});

describe("computeHistogram - bounded on narrow ranges far from zero", () => {
  /**
   * The counting's own guarantees, without "the first and last classes hold a
   * value": when a class is narrower than a double's resolution at that
   * magnitude, its float edges coincide and the class is empty by the rule.
   */
  function expectCoverage(values: readonly number[], h: Histogram) {
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(h.n);
    expect(recount(values, h)).toEqual(h.counts);
    expect(h.start).toBe(Math.min(...values));
    expect(histogramEdge(h.start, h.width, h.counts.length)).toBeGreaterThanOrEqual(
      Math.max(...values),
    );
  }

  /** computeHistogram, timed. Before the bounded correction these cases did not return. */
  function timed(values: readonly number[], options?: Parameters<typeof computeHistogram>[1]) {
    const t0 = performance.now();
    const h = computeHistogram(values, options);
    return { h, ms: performance.now() - t0 };
  }

  it("two values one ulp apart near 1e6", () => {
    const a = 1e6;
    const b = a + ulpOf(a);
    expect(b - a).toBe(1.1641532182693481e-10);
    for (const options of [{ bins: 60 }, { bins: 7 }, {}]) {
      const { h, ms } = timed([a, b], options);
      expect(ms).toBeLessThan(100);
      expectCoverage([a, b], h);
    }
  });

  /** The plain width (max/k - min/k) leaves the last edge short: the case needs the correction. */
  function expectShortfall(values: readonly number[], k: number) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(histogramEdge(min, max / k - min / k, k)).toBeLessThan(max);
  }

  it("epoch-millisecond timestamps over one second", () => {
    // Seed 2 needs the correction; the one-ulp loop ran past 2·10⁷ turns on it.
    const t0 = 1_763_424_000_000; // 2025-11-18 00:00 UTC, in ms
    let s = 2;
    const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const values = Array.from({ length: 500 }, () => t0 + Math.floor(u() * 1_000));
    const { h, ms } = timed(values);
    expectShortfall(values, h.counts.length);
    expect(ms).toBeLessThan(100);
    expectCoverage(values, h);
  });

  it("911.2 + i·10⁻⁹", () => {
    // Eleven values in seven classes need the correction (the one-ulp loop ran
    // past 2·10⁷ turns); two hundred by the rule do not, and must not move.
    const eleven = Array.from({ length: 11 }, (_, i) => 911.2 + i * 1e-9);
    const seven = timed(eleven, { bins: 7 });
    expectShortfall(eleven, 7);
    expect(seven.ms).toBeLessThan(100);
    expectCoverage(eleven, seven.h);
    const twoHundred = Array.from({ length: 200 }, (_, i) => 911.2 + i * 1e-9);
    const rule = timed(twoHundred);
    expect(rule.ms).toBeLessThan(100);
    expectCoverage(twoHundred, rule.h);
  });

  it("every row of the review's survey: centres far from zero, spreads down to 10⁻⁶", () => {
    const rows: Array<[number, number]> = [
      [910, 30],
      [910, 0.01],
      [910, 1e-6],
      [1e6, 1],
      [1e6, 1e-3],
      [1_763_424_000_000, 60_000],
      [1_763_424_000_000, 1_000],
    ];
    const t0 = performance.now();
    for (const [centre, spread] of rows) {
      for (let seed = 1; seed <= 20; seed++) {
        const values = sample(200, centre, spread, seed);
        expectCoverage(values, computeHistogram(values));
      }
    }
    expect(performance.now() - t0).toBeLessThan(5_000);
  });

  it("ulpOf: the gap to the next double, exact at every exponent", () => {
    expect(ulpOf(1)).toBe(2 ** -52);
    // The old one-step "next double" took two ulps from a mantissa of 1.5 on.
    expect(ulpOf(1.5)).toBe(2 ** -52);
    expect(ulpOf(1.75)).toBe(2 ** -52);
    expect(ulpOf(2)).toBe(2 ** -51);
    expect(ulpOf(1e6)).toBe(1.1641532182693481e-10);
    expect(ulpOf(0)).toBe(Number.MIN_VALUE);
    expect(ulpOf(2 ** -1022)).toBe(2 ** -1074);
    expect(ulpOf(Number.MAX_VALUE)).toBe(2 ** 971);
    for (const x of [0.1, 0.3, 910.8, 1e15, 3.3e-200, 7.5e300, 2 ** 52 - 1, 2 ** 53]) {
      const u = ulpOf(x);
      expect(x + u > x).toBe(true);
      expect(x + u / 4).toBe(x);
      expect(x + u - x).toBe(u);
    }
  });
});

describe("resolveHistogramBins and histogramBinList (the chart's view of bins)", () => {
  it("lists every class with its edges and count", () => {
    const r = resolveHistogramBins({ start: 10, width: 2.5, counts: [1, 0, 4] })!;
    expect(r).toEqual({ start: 10, width: 2.5, counts: [1, 0, 4], n: 5 });
    expect(histogramBinList(r)).toEqual([
      { index: 0, from: 10, to: 12.5, count: 1 },
      { index: 1, from: 12.5, to: 15, count: 0 },
      { index: 2, from: 15, to: 17.5, count: 4 },
    ]);
  });

  it("counts a negative or non-finite count as 0", () => {
    const r = resolveHistogramBins({
      start: 0,
      width: 1,
      counts: [2, -1, Number.NaN, Number.POSITIVE_INFINITY, 3],
    })!;
    expect(r.counts).toEqual([2, 0, 0, 0, 3]);
    expect(r.n).toBe(5);
  });

  it("folds a width of 0 into one class, and rejects what cannot be drawn", () => {
    expect(resolveHistogramBins({ start: 7, width: 0, counts: [2, 3] })).toEqual({
      start: 7,
      width: 0,
      counts: [5],
      n: 5,
    });
    expect(resolveHistogramBins(null)).toBeNull();
    expect(resolveHistogramBins({ start: 0, width: 1, counts: [] })).toBeNull();
    expect(resolveHistogramBins({ start: Number.NaN, width: 1, counts: [1] })).toBeNull();
    expect(resolveHistogramBins({ start: 0, width: -1, counts: [1] })).toBeNull();
    expect(
      resolveHistogramBins({ start: 0, width: Number.POSITIVE_INFINITY, counts: [1] }),
    ).toBeNull();
  });

  it("reads computeHistogram's output with the edges it counted against", () => {
    const values = sample(1000, 20, 3);
    const h = computeHistogram(values);
    const list = histogramBinList(resolveHistogramBins(h)!);
    expect(list.map((b) => b.count)).toEqual(h.counts);
    expect(list[0]!.from).toBe(h.min);
    expect(list[list.length - 1]!.to).toBeGreaterThanOrEqual(h.max);
    for (const [i, b] of list.entries()) {
      expect(b.from).toBe(h.start + i * h.width);
      expect(b.to).toBe(h.start + (i + 1) * h.width);
    }
  });
});
