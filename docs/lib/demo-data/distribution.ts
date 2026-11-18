import type { HistogramBins, RowIcon } from "ibcs-react";

/* ============================================================================
 * Sample data for the HistogramChart page and the icon sections of the
 * DataTable and RankingVarianceChart pages. Deterministic, so the pages render
 * the same on every build.
 * ========================================================================= */

/**
 * A roughly normal sample - a simulation's DPS per fight: the mean of four
 * uniforms from a linear congruential generator (Irwin-Hall), scaled.
 */
export function fightSample(n: number, mean: number, sd: number, seed: number): number[] {
  let s = seed;
  const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: n }, () => mean + sd * (u() + u() + u() + u() - 2) * Math.sqrt(3));
}

/** 6,000 fights. */
export const fights = fightSample(6000, 910.8, 30, 7);

/** Their mean, and its 95% half-width: 1.96 standard errors, as an engine would report it. */
export const fightsMean = fights.reduce((a, b) => a + b, 0) / fights.length;
const sd = Math.sqrt(fights.reduce((a, b) => a + (b - fightsMean) ** 2, 0) / (fights.length - 1));
export const fightsHalfWidth = (1.959964 * sd) / Math.sqrt(fights.length);

/** Twelve classes as an engine would return them (made-up figures, n = 1,894). */
export const engineBins: HistogramBins = {
  start: 850,
  width: 10,
  counts: [4, 19, 61, 152, 288, 401, 395, 301, 170, 72, 25, 6],
};

/** A plain svg glyph as a 56 px `data:` URI - a stand-in for a game icon, not game art. */
function glyph(background: string, shape: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect width="56" height="56" fill="${background}"/>${shape}</svg>`,
  )}`;
}

export const glyphs = {
  arrow: glyph(
    "#24382c",
    '<path d="M13 43 L41 15 M27 15 H41 V29" stroke="#d3e6b5" stroke-width="5" fill="none"/>',
  ),
  blade: glyph(
    "#2f3d4a",
    '<path d="M15 41 L40 16" stroke="#e9dcb0" stroke-width="6" stroke-linecap="round"/><path d="M13 33 L23 43" stroke="#c7a35a" stroke-width="5"/>',
  ),
  flame: glyph(
    "#4a2a1f",
    '<path d="M28 10 C40 24 40 34 28 46 C16 34 18 24 28 10Z" fill="#f0a23a"/>',
  ),
  ring: glyph(
    "#3d2f4a",
    '<circle cx="28" cy="30" r="12" fill="none" stroke="#e2c46a" stroke-width="6"/><circle cx="28" cy="16" r="4" fill="#9fd3ff"/>',
  ),
  greatsword: glyph(
    "#2b3442",
    '<path d="M28 8 V40" stroke="#dfe6ee" stroke-width="7"/><path d="M18 40 H38 M28 40 V49" stroke="#c7a35a" stroke-width="5"/>',
  ),
};

/** Item quality colours that keep 4.5:1 contrast as text on white. */
export const EPIC = "#a335ee";
export const RARE = "#0070dd";

export const ringChip: RowIcon = {
  src: glyphs.ring,
  naturalSize: 56,
  border: EPIC,
  alt: "Signet of Embers",
};
export const swordChip: RowIcon = {
  src: glyphs.greatsword,
  naturalSize: 56,
  border: RARE,
  alt: "Runed Greatsword",
};
