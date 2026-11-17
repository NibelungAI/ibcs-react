import { describe, expect, it } from "vitest";
import { computeErrorBar, errorBarExtent, halfWidthOf } from "../errorBar";
import { resolveValueBand } from "../reference";

/** A linear value → pixel scale: 0 → 10 px, 1 unit → 2 px. */
const linear = (v: number) => 10 + v * 2;

describe("errorBarExtent", () => {
  it("spans value ± half-width", () => {
    expect(errorBarExtent(910.79, 0.76)).toEqual({ low: 910.79 - 0.76, high: 910.79 + 0.76 });
    expect(errorBarExtent(-2.88, 0.54)).toEqual({ low: -2.88 - 0.54, high: -2.88 + 0.54 });
    expect(errorBarExtent(5, 0)).toEqual({ low: 5, high: 5 });
  });

  it("rejects a negative or non-finite half-width and a non-finite value", () => {
    expect(errorBarExtent(1, -0.1)).toBeNull();
    expect(errorBarExtent(1, NaN)).toBeNull();
    expect(errorBarExtent(1, Infinity)).toBeNull();
    expect(errorBarExtent(NaN, 1)).toBeNull();
    expect(errorBarExtent(-Infinity, 1)).toBeNull();
  });
});

describe("computeErrorBar - horizontal", () => {
  it("lays the whisker along the value axis with a cap across each end", () => {
    const g = computeErrorBar(50, 5, { scale: linear, cross: 20, capSize: 8 })!;
    expect(g.orientation).toBe("horizontal");
    // 45 → 100 px, 55 → 120 px.
    expect(g.whisker).toEqual({ x1: 100, y1: 20, x2: 120, y2: 20 });
    expect(g.caps).toEqual([
      { x1: 100, y1: 16, x2: 100, y2: 24 },
      { x1: 120, y1: 16, x2: 120, y2: 24 },
    ]);
    expect(g.lowClipped).toBe(false);
    expect(g.highClipped).toBe(false);
  });

  it("defaults to a 6px cap and draws none for capSize 0", () => {
    const g = computeErrorBar(50, 5, { scale: linear, cross: 20 })!;
    expect(g.caps[0]).toEqual({ x1: 100, y1: 17, x2: 100, y2: 23 });
    expect(computeErrorBar(50, 5, { scale: linear, cross: 20, capSize: 0 })!.caps).toEqual([]);
  });

  it("cuts an end outside the clip range at its edge and drops that end's cap", () => {
    const low = computeErrorBar(2, 5, { scale: linear, cross: 20, clip: [10, 200] })!;
    // -3 → 4 px, cut at 10; 7 → 24 px.
    expect(low.whisker).toEqual({ x1: 10, y1: 20, x2: 24, y2: 20 });
    expect(low.lowClipped).toBe(true);
    expect(low.highClipped).toBe(false);
    expect(low.caps).toEqual([{ x1: 24, y1: 17, x2: 24, y2: 23 }]);

    const both = computeErrorBar(50, 100, { scale: linear, cross: 20, clip: [200, 10] })!;
    expect(both.whisker).toEqual({ x1: 10, y1: 20, x2: 200, y2: 20 });
    expect(both.lowClipped && both.highClipped).toBe(true);
    expect(both.caps).toEqual([]);
  });

  it("draws nothing for a zero half-width, invalid input, or an interval wholly off the clip range", () => {
    expect(computeErrorBar(50, 0, { scale: linear, cross: 20 })).toBeNull();
    expect(computeErrorBar(50, -1, { scale: linear, cross: 20 })).toBeNull();
    expect(computeErrorBar(NaN, 1, { scale: linear, cross: 20 })).toBeNull();
    expect(computeErrorBar(50, 1, { scale: linear, cross: NaN })).toBeNull();
    expect(computeErrorBar(50, 1, { scale: () => Infinity, cross: 20 })).toBeNull();
    // A scale that collapses the interval (a grow-in at its first frame).
    expect(computeErrorBar(50, 1, { scale: () => 144, cross: 20 })).toBeNull();
    expect(computeErrorBar(500, 1, { scale: linear, cross: 20, clip: [10, 200] })).toBeNull();
    expect(computeErrorBar(-500, 1, { scale: linear, cross: 20, clip: [10, 200] })).toBeNull();
  });

  it("works on a two-sided scale whose sides have different lengths (a pin axis)", () => {
    // Positives 4 px per unit, negatives 2 px per unit, axis at 100.
    const pin = (v: number) => 100 + v * (v >= 0 ? 4 : 2);
    const g = computeErrorBar(1, 3, { scale: pin, cross: 17 })!;
    // -2 → 96 px, 4 → 116 px: the interval straddles the axis.
    expect(g.whisker).toEqual({ x1: 96, y1: 17, x2: 116, y2: 17 });
  });
});

describe("computeErrorBar - vertical", () => {
  it("runs the whisker up the value axis, on a scale that grows downward in pixels", () => {
    // A column chart's y scale: 0 → 130 px, 1 unit → 1.5 px up.
    const y = (v: number) => 130 - v * 1.5;
    const g = computeErrorBar(70, 12, {
      orientation: "vertical",
      scale: y,
      cross: 352,
      capSize: 12,
    })!;
    expect(g.orientation).toBe("vertical");
    expect(g.whisker).toEqual({ x1: 352, y1: 130 - 58 * 1.5, x2: 352, y2: 130 - 82 * 1.5 });
    expect(g.caps).toEqual([
      { x1: 346, y1: 130 - 58 * 1.5, x2: 358, y2: 130 - 58 * 1.5 },
      { x1: 346, y1: 130 - 82 * 1.5, x2: 358, y2: 130 - 82 * 1.5 },
    ]);
  });

  it("clips in pixel space whichever way the scale runs", () => {
    const y = (v: number) => 130 - v * 1.5;
    // 48 ± 20: 28 → 88 px, 68 → 28 px; the plot's top edge is at 40 px.
    const g = computeErrorBar(48, 20, {
      orientation: "vertical",
      scale: y,
      cross: 420,
      clip: [130, 40],
    })!;
    expect(g.whisker).toEqual({ x1: 420, y1: 88, x2: 420, y2: 40 });
    expect(g.lowClipped).toBe(false);
    expect(g.highClipped).toBe(true);
    expect(g.caps).toEqual([{ x1: 417, y1: 88, x2: 423, y2: 88 }]);
  });
});

describe("halfWidthOf", () => {
  it("accepts only finite numbers ≥ 0", () => {
    expect(halfWidthOf(0.47)).toBe(0.47);
    expect(halfWidthOf(0)).toBe(0);
    expect(halfWidthOf(-0.1)).toBeUndefined();
    expect(halfWidthOf(NaN)).toBeUndefined();
    expect(halfWidthOf(Infinity)).toBeUndefined();
    expect(halfWidthOf("0.4")).toBeUndefined();
    expect(halfWidthOf(undefined)).toBeUndefined();
  });
});

describe("resolveValueBand", () => {
  it("maps a value range to pixels in either order, clamped to the axis range", () => {
    expect(resolveValueBand({ from: 20, to: 10, label: "Tied" }, linear, [10, 200])).toEqual({
      start: 30,
      end: 50,
      label: "Tied",
      color: undefined,
    });
    // Partly off-scale: clamped to the edge, not dropped.
    expect(resolveValueBand({ from: 80, to: 120 }, linear, [10, 200])).toMatchObject({
      start: 170,
      end: 200,
    });
  });

  it("collapses a band wholly off the axis to zero width at the edge", () => {
    expect(resolveValueBand({ from: 500, to: 600 }, linear, [200, 10])).toMatchObject({
      start: 200,
      end: 200,
    });
  });

  it("returns null for a non-finite edge or a scale that maps off to infinity", () => {
    expect(resolveValueBand({ from: NaN, to: 1 }, linear, [10, 200])).toBeNull();
    expect(resolveValueBand({ from: 1, to: 2 }, () => Infinity, [10, 200])).toBeNull();
  });
});
