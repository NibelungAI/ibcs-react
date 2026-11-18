import { describe, expect, it } from "vitest";

import {
  computeHistogram,
  histogramBinList,
  histogramEdge,
  quantileSorted,
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

describe("computeHistogram - the Freedman-Diaconis rule, bounded (R33)", () => {
  it("chooses k = ceil((max - min) / (2 IQR n^(-1/3))) inside [20, 60]", () => {
    const values = sample(6000, 910.8, 30);
    const h = computeHistogram(values);
    const sorted = [...values].sort((a, b) => a - b);
    const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
    const raw = Math.ceil((sorted[5999]! - sorted[0]!) / (2 * iqr * Math.cbrt(6000) ** -1));
    expect(raw).toBeGreaterThanOrEqual(20);
    expect(raw).toBeLessThanOrEqual(60);
    expect(h.counts).toHaveLength(raw);
    expect(h.q1).toBe(quantileSorted(sorted, 0.25));
    expect(h.q3).toBe(quantileSorted(sorted, 0.75));
    expectInvariants(values, h);
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
