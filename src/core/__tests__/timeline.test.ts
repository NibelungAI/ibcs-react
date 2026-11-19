import { describe, expect, it } from "vitest";

import { computeTimeline, formatClock, niceTimeStep, timeStepDigits, timeTicks } from "../timeline";
import { ulpOf } from "../histogram";

describe("computeTimeline", () => {
  it("keeps the finite ticks of each row, earliest first", () => {
    const { rows } = computeTimeline([
      { label: "Cast", ticks: [7, NaN, 1, Infinity, 4, -Infinity] },
    ]);
    expect(rows[0]!.ticks).toEqual([1, 4, 7]);
  });

  it("puts each span's ends in order, sorts the spans and defaults their kind to active", () => {
    const { rows } = computeTimeline([
      {
        label: "Buff",
        spans: [
          { from: 9, to: 6, kind: "waiting" },
          { from: 2, to: 4 },
          { from: NaN, to: 5 },
          { from: 1, to: Infinity },
        ],
      },
    ]);
    expect(rows[0]!.spans).toEqual([
      { from: 2, to: 4, kind: "active" },
      { from: 6, to: 9, kind: "waiting" },
    ]);
  });

  it("numbers the annotations with a finite moment in the order given, and checks their row", () => {
    const { annotations } = computeTimeline(
      [{ label: "A" }, { label: "B" }],
      [
        { at: 50, text: "late", row: 1 },
        { at: NaN, text: "dropped" },
        { at: 10, text: "early", row: 7 },
        { at: 20, text: "half", row: 0.5 },
        { at: 30, text: "first row", row: 0 },
      ],
    );
    expect(annotations).toEqual([
      { number: 1, at: 50, text: "late", row: 1 },
      { number: 2, at: 10, text: "early", row: null },
      { number: 3, at: 20, text: "half", row: null },
      { number: 4, at: 30, text: "first row", row: 0 },
    ]);
  });

  it("spans the earliest to the latest moment of ticks, span ends and annotations", () => {
    const layout = computeTimeline(
      [
        { label: "A", ticks: [5, 12] },
        { label: "B", spans: [{ from: 3, to: 40 }] },
      ],
      [{ at: -2, text: "pull" }],
    );
    expect([layout.start, layout.end]).toEqual([-2, 40]);
  });

  it("takes a given domain, in either order, and ignores one that is not finite", () => {
    const rows = [{ label: "A", ticks: [5, 12] }];
    const given = computeTimeline(rows, [], { domain: [180, 0] });
    expect([given.start, given.end]).toEqual([0, 180]);
    const bad = computeTimeline(rows, [], { domain: [0, NaN] });
    expect([bad.start, bad.end]).toEqual([5, 12]);
  });

  it("covers 0 to 1 with no moment, and a single moment with a range of zero width", () => {
    expect(computeTimeline([]).start).toBe(0);
    expect(computeTimeline([]).end).toBe(1);
    const one = computeTimeline([{ label: "A", ticks: [7, 7] }]);
    expect([one.start, one.end]).toEqual([7, 7]);
  });

  it("moves no moment: the ticks and span ends come back exactly as given", () => {
    const ticks = [0.1 + 0.2, 1e-300, 1.7e12 + 0.5, -0];
    const { rows } = computeTimeline([{ label: "A", ticks, spans: [{ from: 0.3, to: 0.7 }] }]);
    expect(rows[0]!.ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(rows[0]!.spans[0]).toEqual({ from: 0.3, to: 0.7, kind: "active" });
  });
});

describe("niceTimeStep", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect([0.03, 0.3, 1, 1.01, 3, 7, 25, 250, 1000].map((r) => niceTimeStep(r))).toEqual([
      0.05, 0.5, 1, 2, 5, 10, 50, 500, 1000,
    ]);
  });

  it("on a clock, rounds up to whole seconds, minutes and hours, then days", () => {
    expect(
      [1, 7, 12, 20, 40, 100, 250, 1000, 2000, 5000, 20000, 50000].map((r) =>
        niceTimeStep(r, true),
      ),
    ).toEqual([1, 10, 15, 30, 60, 120, 300, 1800, 3600, 7200, 21600, 86400]);
    expect(niceTimeStep(90000, true)).toBe(172800);
    expect(niceTimeStep(0.3, true)).toBe(0.5);
  });

  it("is NaN for a step that is not a finite number above zero", () => {
    for (const r of [0, -1, NaN, Infinity]) expect(niceTimeStep(r)).toBeNaN();
  });
});

describe("timeStepDigits", () => {
  it("writes a step exactly", () => {
    expect([5, 30, 0.5, 0.2, 0.05, 2e-7].map(timeStepDigits)).toEqual([0, 0, 1, 1, 2, 7]);
  });
});

describe("timeTicks", () => {
  it("labels a fight at nice steps on a clock", () => {
    expect(timeTicks(0, 180, 6, true)).toEqual([0, 30, 60, 90, 120, 150, 180]);
    expect(timeTicks(0, 187.3, 6, true)).toEqual([0, 60, 120, 180]);
  });

  it("writes fractional steps without the residue of their multiplication", () => {
    expect(timeTicks(0, 1, 10)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it("keeps every tick within the range, ascending, at most count + 1 of them", () => {
    let s = 5;
    const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let k = 0; k < 400; k++) {
      const start = (u() - 0.5) * 10 ** Math.floor(u() * 12 - 4);
      const end = start + u() * 10 ** Math.floor(u() * 10 - 3);
      const count = 1 + Math.floor(u() * 12);
      const ticks = timeTicks(start, end, count, u() < 0.5);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThanOrEqual(count + 2);
      for (const [i, t] of ticks.entries()) {
        if (i > 0) expect(t).toBeGreaterThan(ticks[i - 1]!);
        if (ticks.length > 1) {
          expect(t).toBeGreaterThanOrEqual(start - (end - start) * 1e-6);
          expect(t).toBeLessThanOrEqual(end + (end - start) * 1e-6);
        }
      }
    }
  });

  it("is bounded on narrow ranges far from zero", () => {
    // The kind of input that stalled the 1.6 histogram before its fix: a range
    // a few ulps wide, or one past 2^53 where `i++` cannot move an integer.
    const cases: Array<[number, number]> = [
      [1e17, 1e17 + 16],
      [2 ** 53, 2 ** 53 + 8],
      [1e300, 1e300 + ulpOf(1e300) * 4],
      [1.7e18, 1.7e18 + 1e3],
      [1e6, 1e6 + ulpOf(1e6)],
      [-Number.MAX_VALUE, Number.MAX_VALUE],
      [5e-324, 1e-323],
    ];
    for (const [a, b] of cases) {
      const t0 = performance.now();
      const ticks = timeTicks(a, b, 8);
      expect(performance.now() - t0).toBeLessThan(50);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThanOrEqual(10);
      // Never the same moment twice: past 2^53 the walk stops where a tick
      // would not move.
      for (const [i, t] of ticks.entries()) if (i > 0) expect(t).toBeGreaterThan(ticks[i - 1]!);
    }
    expect(timeTicks(1e17, 1e17 + 16, 8)).toEqual([1e17]);
  });

  it("gives the start alone for a range of zero width, and nothing for one that is not finite", () => {
    expect(timeTicks(7, 7, 5)).toEqual([7]);
    expect(timeTicks(0, NaN, 5)).toEqual([]);
  });
});

describe("formatClock", () => {
  it("writes minutes and seconds, and hours from the first full hour", () => {
    expect([0, 5, 59, 90, 600, 3599, 3600, 3723].map((t) => formatClock(t))).toEqual([
      "0:00",
      "0:05",
      "0:59",
      "1:30",
      "10:00",
      "59:59",
      "1:00:00",
      "1:02:03",
    ]);
  });

  it("writes fraction digits of the seconds, carrying a rounding into the minutes", () => {
    expect(formatClock(65.5, { fractionDigits: 1 })).toBe("1:05.5");
    expect(formatClock(59.96, { fractionDigits: 1 })).toBe("1:00.0");
    expect(formatClock(3599.995, { fractionDigits: 2 })).toBe("1:00:00.00");
    expect(formatClock(12.3456, { fractionDigits: 3 })).toBe("0:12.346");
  });

  it("signs a time before zero, but not one that rounds to zero", () => {
    expect(formatClock(-5)).toBe("-0:05");
    expect(formatClock(-0.04, { fractionDigits: 1 })).toBe("0:00.0");
  });

  it("follows the locale's digits and decimal separator", () => {
    expect(formatClock(65.5, { fractionDigits: 1, locale: "sr-Latn" })).toBe("1:05,5");
    expect(formatClock(65.5, { fractionDigits: 1, locale: "de-DE" })).toBe("1:05,5");
  });

  it("writes notAvailable for a time that is not finite", () => {
    expect(formatClock(NaN)).toBe("n/a");
    expect(formatClock(Infinity, { notAvailable: "–" })).toBe("–");
  });
});
