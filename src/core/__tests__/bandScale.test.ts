import { describe, it, expect } from "vitest";
import { bandScale, legacyBandPadding, resolveBandPadding } from "../bandScale";

describe("bandScale", () => {
  it("reproduces the legacy centred layout (band = width/n, centre = i·band + band/2)", () => {
    const width = 600;
    const n = 5;
    const ratio = 0.5; // legacy colW = band * 0.5
    const { inner, outer } = legacyBandPadding(ratio);
    const s = bandScale(width, n, { inner, outer });
    const band = width / n;
    for (let i = 0; i < n; i++) {
      expect(s.center(i)).toBeCloseTo(i * band + band / 2, 6);
    }
    expect(s.bandwidth).toBeCloseTo(band * ratio, 6);
    expect(s.step).toBeCloseTo(band, 6);
  });

  it("applies an absolute offset (the plot's left inset)", () => {
    const s = bandScale(300, 3, { inner: 0.5, outer: 0.25 }, 14);
    expect(s.start(0)).toBeGreaterThanOrEqual(14);
    expect(s.center(0)).toBeCloseTo(14 + 300 / 3 / 2, 6);
  });

  it("outer:0 trims the side gutter so the first/last bands sit flush", () => {
    const width = 400;
    const n = 4;
    const flush = bandScale(width, n, { inner: 0.2, outer: 0 });
    // First band starts at the very left edge; last band ends at the right edge.
    expect(flush.start(0)).toBeCloseTo(0, 6);
    expect(flush.start(n - 1) + flush.bandwidth).toBeCloseTo(width, 6);
  });

  it("a bigger outer gutter insets the content symmetrically", () => {
    const centered = bandScale(400, 4, { inner: 0.2, outer: 0.2 });
    const leftGap = centered.start(0);
    const rightGap = 400 - (centered.start(3) + centered.bandwidth);
    expect(leftGap).toBeCloseTo(rightGap, 6);
    expect(leftGap).toBeGreaterThan(0);
  });

  it("a single band and an empty series stay finite", () => {
    for (const n of [0, 1]) {
      const s = bandScale(200, n, { inner: 0.3 });
      expect(Number.isFinite(s.step)).toBe(true);
      expect(Number.isFinite(s.center(0))).toBe(true);
      expect(s.bandwidth).toBeGreaterThan(0);
    }
  });

  it("a numeric padding sets both inner and outer", () => {
    const s = bandScale(300, 3, 0.4);
    // step = width / (n - inner + 2·outer) = 300 / (3 - 0.4 + 0.8) = 300/3.4
    expect(s.step).toBeCloseTo(300 / 3.4, 6);
    expect(s.bandwidth).toBeCloseTo(s.step * 0.6, 6);
  });

  it("resolveBandPadding overrides only the keys provided", () => {
    const base = legacyBandPadding(0.5); // { inner: 0.5, outer: 0.25 }
    // outer-only override keeps the native bar width (inner) but trims the gutter
    expect(resolveBandPadding(0.5, { outer: 0 })).toEqual({ inner: base.inner, outer: 0 });
    // a bare number overrides both
    expect(resolveBandPadding(0.5, 0.3)).toEqual({ inner: 0.3, outer: 0.3 });
    // the default keeps the native bar spacing but trims the edge gutter, so the
    // chart fills its box rather than leaving a half-band of whitespace.
    const def = resolveBandPadding(0.5);
    expect(def.inner).toBe(base.inner);
    expect(def.outer).toBeLessThan(base.outer);
    expect(def.outer).toBeGreaterThan(0);
  });
});
