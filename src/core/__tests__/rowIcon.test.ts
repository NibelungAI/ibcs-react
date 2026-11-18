import { describe, expect, it } from "vitest";

import {
  ROW_ICON_GAP,
  ROW_ICON_MAX_PX,
  fitRowIcons,
  rowIconSize,
  rowIconsOf,
  rowIconsWidth,
  type RowIcon,
} from "../rowIcon";

const icon = (naturalSize: number, src = "i.png"): RowIcon => ({ src, naturalSize });

describe("rowIconsOf", () => {
  it("takes one icon or several, and leaves out those that cannot be drawn", () => {
    expect(rowIconsOf(undefined)).toEqual([]);
    expect(rowIconsOf(null)).toEqual([]);
    expect(rowIconsOf(icon(56))).toEqual([icon(56)]);
    expect(rowIconsOf([icon(56, "a"), icon(36, "b")])).toEqual([icon(56, "a"), icon(36, "b")]);
    expect(
      rowIconsOf([
        icon(56, ""),
        icon(0),
        icon(0.5),
        icon(-4),
        icon(Number.NaN),
        icon(Number.POSITIVE_INFINITY),
        icon(18, "ok"),
      ]),
    ).toEqual([icon(18, "ok")]);
  });
});

describe("rowIconSize - never upscaled, never above 56 CSS px", () => {
  it("draws at the requested size, the image's own size or 56, whichever is least, in whole pixels", () => {
    expect(rowIconSize(icon(56), 20)).toBe(20);
    expect(rowIconSize(icon(18), 20)).toBe(18);
    expect(rowIconSize(icon(36), 40)).toBe(36);
    expect(rowIconSize(icon(128), 80)).toBe(ROW_ICON_MAX_PX);
    expect(rowIconSize(icon(56), 19.7)).toBe(19);
    expect(rowIconSize(icon(17.5), 20)).toBe(17);
  });

  it("holds for every pair of image and requested sizes", () => {
    for (const natural of [1, 7.5, 16, 18, 24, 32, 36, 55.9, 56, 64, 256]) {
      for (const size of [1, 8, 13.3, 20, 28, 40, 56, 57, 100]) {
        const d = rowIconSize(icon(natural), size);
        expect(Number.isInteger(d)).toBe(true);
        // At least one pixel: every icon rowIconsOf keeps is drawn.
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(natural);
        expect(d).toBeLessThanOrEqual(size);
        expect(d).toBeLessThanOrEqual(56);
      }
    }
  });
});

describe("rowIconsWidth and fitRowIcons", () => {
  it("lays icons side by side with a gap between them", () => {
    expect(ROW_ICON_GAP).toBe(2);
    expect(rowIconsWidth([], 20)).toBe(0);
    expect(rowIconsWidth([icon(56)], 20)).toBe(20);
    expect(rowIconsWidth([icon(56), icon(18), icon(56)], 20)).toBe(20 + 18 + 20 + 2 * 2);
  });

  it("keeps the leading icons that fit and leaves the rest out, from the end", () => {
    const three = [icon(56, "a"), icon(56, "b"), icon(56, "c")];
    expect(fitRowIcons(three, 20, 64)).toEqual(three);
    expect(fitRowIcons(three, 20, 63)).toEqual(three.slice(0, 2));
    expect(fitRowIcons(three, 20, 42)).toEqual(three.slice(0, 2));
    expect(fitRowIcons(three, 20, 41)).toEqual(three.slice(0, 1));
    expect(fitRowIcons(three, 20, 19)).toEqual([]);
  });
});
