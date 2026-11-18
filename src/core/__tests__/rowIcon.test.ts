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

describe("rowIconSize - never above naturalSize / pixelRatio CSS px, nor 56", () => {
  it("draws at the requested size, the image's own size or 56, whichever is least, in whole pixels", () => {
    expect(rowIconSize(icon(56), 20)).toBe(20);
    expect(rowIconSize(icon(18), 20)).toBe(18);
    expect(rowIconSize(icon(36), 40)).toBe(36);
    expect(rowIconSize(icon(128), 80)).toBe(ROW_ICON_MAX_PX);
    expect(rowIconSize(icon(56), 19.7)).toBe(19);
    expect(rowIconSize(icon(17.5), 20)).toBe(17);
  });

  it("holds for every pair of image and requested sizes, at every pixel ratio", () => {
    for (const ratio of [1, 1.5, 2, 3]) {
      for (const natural of [2, 7.5, 16, 18, 24, 32, 36, 55.9, 56, 64, 256]) {
        for (const size of [1, 8, 13.3, 20, 28, 40, 56, 57, 100]) {
          const i = { ...icon(natural), pixelRatio: ratio };
          if (rowIconsOf(i).length === 0) continue; // under one CSS pixel: not drawn
          const d = rowIconSize(i, size);
          expect(Number.isInteger(d)).toBe(true);
          // At least one pixel: every icon rowIconsOf keeps is drawn.
          expect(d).toBeGreaterThanOrEqual(1);
          // In device pixels, never above the file's own pixels.
          expect(d * ratio).toBeLessThanOrEqual(natural);
          expect(d).toBeLessThanOrEqual(size);
          expect(d).toBeLessThanOrEqual(56);
        }
      }
    }
  });

  it("keeps a 56 px file sharp on 2× screens with pixelRatio 2: 28 CSS px at most", () => {
    const retina = { ...icon(56), pixelRatio: 2 };
    expect(rowIconSize(retina, 20)).toBe(20);
    expect(rowIconSize(retina, 40)).toBe(28);
    expect(rowIconSize({ ...icon(18), pixelRatio: 2 }, 20)).toBe(9);
    // A ratio under 1, or not finite, counts as 1: never a licence to upscale.
    expect(rowIconSize({ ...icon(18), pixelRatio: 0.5 }, 40)).toBe(18);
    expect(rowIconSize({ ...icon(18), pixelRatio: Number.NaN }, 40)).toBe(18);
    // Under one CSS pixel at that ratio: not drawn.
    expect(rowIconsOf({ ...icon(1.5), pixelRatio: 2 })).toEqual([]);
  });
});

describe("rowIconsWidth and fitRowIcons", () => {
  it("lays icons side by side with a gap between them", () => {
    expect(ROW_ICON_GAP).toBe(2);
    expect(rowIconsWidth([], 20)).toBe(0);
    expect(rowIconsWidth([icon(56)], 20)).toBe(20);
    expect(rowIconsWidth([icon(56), icon(18), icon(56)], 20)).toBe(20 + 18 + 20 + 2 * 2);
  });

  it("keeps the leading icons that fit, and a +N for the rest in the same room", () => {
    const three = [icon(56, "a"), icon(56, "b"), icon(56, "c")];
    const more = () => 12; // the "+N" text's width
    // All fit: no "+N".
    expect(fitRowIcons(three, 20, 64, more)).toEqual({
      kept: three,
      dropped: [],
      more: false,
      width: 64,
    });
    // Two chips (42) + 3 + 12 = 57 fit in 63; the third is counted.
    expect(fitRowIcons(three, 20, 63, more)).toEqual({
      kept: three.slice(0, 2),
      dropped: three.slice(2),
      more: true,
      width: 57,
    });
    // 56: one chip (20) + 3 + 12 = 35.
    expect(fitRowIcons(three, 20, 56, more)).toMatchObject({ kept: three.slice(0, 1), width: 35 });
    // 20: the "+N" alone (12).
    expect(fitRowIcons(three, 20, 20, more)).toMatchObject({ kept: [], more: true, width: 12 });
    // No room even for the "+N": nothing.
    expect(fitRowIcons(three, 20, 11, more)).toEqual({
      kept: [],
      dropped: three,
      more: false,
      width: 0,
    });
    // The "+N" is measured for the count it writes.
    const counted: number[] = [];
    const fit = fitRowIcons(three, 20, 30, (n) => (counted.push(n), 10 * n));
    // Two chips + "+1" (55), then one chip + "+2" (43), then "+3" alone (30).
    expect(counted).toEqual([1, 2, 3]);
    expect(fit).toMatchObject({ kept: [], more: true, width: 30 });
  });
});
