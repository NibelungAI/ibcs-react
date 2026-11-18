/**
 * Layout model for a RANKING VARIANCE chart - IBCS reference #66
 * ("18 States make up 88% of net sales"): a ranked list of entities, each
 * compared against a plan / prior reference, with three aligned panels:
 *   1. the actual value (AC),
 *   2. the absolute variance ΔPL  = AC − base,
 *   3. the relative variance ΔPL% = (AC − base) / |base|.
 *
 * This module is pure data: it sorts the entities, computes each row's
 * variance (respecting per-row `higherIsBetter`), flags off-scale outliers,
 * derives the SHARED scales the three panels render against, and rolls up a
 * TOTAL row. The React component maps these value-space numbers to pixels.
 *
 * SSR-safe: no DOM, no clock, no randomness - a deterministic transform.
 */

import { computeVariance } from "./variance";
import { halfWidthOf } from "./errorBar";
import type { ValueBand } from "./reference";
import type { RowIcon } from "./rowIcon";

/** One input entity: an actual value and the plan / prior value to compare it against. */
export interface RankingDatum {
  /** Entity label (state, product, region …). */
  label: string;
  /**
   * A small picture before the label - an item icon, a portrait - or several,
   * left to right, as chips (the items a variant changes). Drawn at the
   * chart's `iconSize`, never above the image's own `naturalSize`; an icon's
   * `alt` joins the label in the screen-reader table. See {@link RowIcon}.
   */
  icon?: RowIcon | readonly RowIcon[];
  /**
   * The label's colour - e.g. an item's quality colour. Default the theme's
   * text colour. Pick one that keeps enough contrast on the chart's surface.
   */
  labelColor?: string;
  /** Actual value (AC). */
  AC: number;
  /** Plan / reference value the actual is compared against (PL or PY). */
  base: number;
  /**
   * Whether a higher value is favorable. Default true. Set false for
   * cost / expense entities so an increase reads as unfavorable (red).
   */
  higherIsBetter?: boolean;
  /**
   * Half-width of AC's interval (e.g. a 95% confidence interval), in AC's
   * units: the AC bar gets an error bar spanning AC ± acError.
   */
  acError?: number;
  /**
   * Half-width of the absolute variance's interval, in AC's units: the ΔPL bar
   * gets an error bar spanning Δ ± absError. Give the variance's own error (for
   * paired runs, the paired error) - it is not derived from `acError`.
   */
  absError?: number;
  /**
   * Half-width of the relative variance's interval, in PERCENT units (like
   * `clampPct`: 0.4 means ±0.4 %): the ΔPL% pin gets an error bar.
   */
  pctError?: number;
}

/**
 * A shaded value range across one panel's data rows - e.g. "tied with the
 * best". `panel` picks the axis, and with it the units of `from` / `to`:
 *  - "ac" (default): AC units. The AC bars grow from 0 by size, so give sizes.
 *  - "abs": ΔPL units, favorable to the right (a positive Δ for
 *    higher-is-better data; mirrored when every row is a cost line).
 *  - "pct": ΔPL% in percent units (5 = 5 %), on the same direction rule.
 */
export interface RankingBand extends ValueBand {
  panel?: "ac" | "abs" | "pct";
}

/** One ranked, variance-resolved row. */
export interface RankingRow {
  label: string;
  /** The datum's `icon`, as given (present only when the datum has one). */
  icon?: RowIcon | readonly RowIcon[];
  /** The datum's `labelColor` (present only when the datum has one). */
  labelColor?: string;
  /** Actual value (sanitized to a finite number). */
  ac: number;
  /** Plan / reference value (sanitized). */
  base: number;
  higherIsBetter: boolean;
  /** Absolute variance AC − base. */
  abs: number;
  /** Relative variance as a fraction ((AC−base)/|base|), or null when base is 0. */
  pct: number | null;
  /** True when the variance is good for the business (respects higherIsBetter). */
  favorable: boolean;
  /** |abs| exceeds the shared absolute scale → draw an off-scale arrow. */
  absOutlier: boolean;
  /** |pct%| ≥ `clampPct` → draw an off-scale arrow, excluded from the % scale. */
  pctOutlier: boolean;
  /** AC's half-width, when the datum gave a valid one (finite, ≥ 0). */
  acError?: number;
  /** ΔPL's half-width, when valid. */
  absError?: number;
  /** ΔPL%'s half-width in percent units, when valid. */
  pctError?: number;
}

/** The rolled-up TOTAL row (sum of AC vs sum of base). */
export interface RankingTotalRow {
  ac: number;
  base: number;
  abs: number;
  pct: number | null;
  favorable: boolean;
  absOutlier: boolean;
  pctOutlier: boolean;
}

/** Everything the renderer needs: ranked rows, shared scales, and the total. */
export interface RankingVarianceLayout {
  rows: RankingRow[];
  total: RankingTotalRow;
  /**
   * Max |AC| (and |base|) across the rows - the left AC-bar scale - widened to
   * |AC| + acError where a row has an error bar, so the whisker fits.
   */
  acMax: number;
  /**
   * Shared absolute-variance scale: max |abs| across the rows (never the
   * total), widened to |abs| + absError for error bars.
   */
  absMax: number;
  /**
   * Shared relative-variance scale, in PERCENT units, excluding outliers;
   * widened for error bars up to `clampPct`.
   */
  pctMax: number;
}

export interface RankingVarianceOptions {
  /**
   * Row order:
   *  - "variance" (default): by signed ΔPL descending (biggest favorable first),
   *  - "value": by AC descending,
   *  - "none": preserve input order.
   */
  sortBy?: "variance" | "value" | "none";
  /**
   * Off-scale threshold for ΔPL%, in percent. A |%| at or beyond this is drawn
   * as an edge arrow and excluded from the % axis scale. Default 100.
   */
  clampPct?: number;
}

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/**
 * Build the ranking-variance layout from raw entities.
 *
 * The per-row scales (`acMax`, `absMax`, `pctMax`) are derived from the data
 * rows only - never the total - so the TOTAL row's variance, which is the SUM
 * of the rows, naturally renders as an off-scale arrow rather than dwarfing
 * every individual bar. Empty input yields empty rows, a zero total, and unit
 * scales (so the renderer never divides by zero).
 */
export function computeRankingVariance(
  data: RankingDatum[],
  options: RankingVarianceOptions = {},
): RankingVarianceLayout {
  const { sortBy = "variance", clampPct = 100 } = options;
  const clamp = Math.abs(clampPct) || 100;

  const built: RankingRow[] = (data ?? []).map((d) => {
    const higherIsBetter = d.higherIsBetter ?? true;
    const ac = finite(d.AC);
    const base = finite(d.base);
    // ac/base are finite numbers, so computeVariance never returns null here.
    const v = computeVariance(ac, base, higherIsBetter)!;
    const row: RankingRow = {
      label: d.label ?? "",
      ac,
      base,
      higherIsBetter,
      abs: v.abs,
      pct: v.pct,
      favorable: v.favorable,
      absOutlier: false,
      pctOutlier: false,
    };
    // Half-widths ride along only when valid, so rows without them stay as before.
    const acError = halfWidthOf(d.acError);
    const absError = halfWidthOf(d.absError);
    const pctError = halfWidthOf(d.pctError);
    if (acError != null) row.acError = acError;
    if (absError != null) row.absError = absError;
    if (pctError != null) row.pctError = pctError;
    if (d.icon != null) row.icon = d.icon;
    if (d.labelColor != null) row.labelColor = d.labelColor;
    return row;
  });

  const rows = [...built];
  if (sortBy === "variance") rows.sort((a, b) => b.abs - a.abs);
  else if (sortBy === "value") rows.sort((a, b) => b.ac - a.ac);

  // Shared scales across the rows (the total is intentionally excluded).
  let acMax = 0;
  let absMax = 0;
  let pctMax = 0;
  for (const r of rows) {
    // An error bar's far end must fit on the scale too.
    acMax = Math.max(acMax, Math.abs(r.ac) + (r.acError ?? 0), Math.abs(r.base));
    absMax = Math.max(absMax, Math.abs(r.abs) + (r.absError ?? 0));
    if (r.pct != null && Number.isFinite(r.pct)) {
      const p = Math.abs(r.pct) * 100;
      if (p < clamp) pctMax = Math.max(pctMax, Math.min(p + (r.pctError ?? 0), clamp));
    }
  }

  for (const r of rows) {
    r.pctOutlier = r.pct != null && Number.isFinite(r.pct) && Math.abs(r.pct) * 100 >= clamp;
    // A row can't exceed the row-derived absMax, but keep the test general and
    // guarded so a degenerate scale never produces a NaN/false-positive.
    r.absOutlier = Math.abs(r.abs) > absMax + 1e-9;
  }

  let acSum = 0;
  let baseSum = 0;
  for (const r of rows) {
    acSum += r.ac;
    baseSum += r.base;
  }
  // The total is favorable per the prevailing direction: unfavorable-higher
  // only when every row is a cost line, else higher-is-better.
  const totalHib = !(rows.length > 0 && rows.every((r) => !r.higherIsBetter));
  const tv = computeVariance(acSum, baseSum, totalHib)!;
  const total: RankingTotalRow = {
    ac: acSum,
    base: baseSum,
    abs: tv.abs,
    pct: tv.pct,
    favorable: tv.favorable,
    absOutlier: Math.abs(tv.abs) > absMax + 1e-9,
    pctOutlier: tv.pct != null && Number.isFinite(tv.pct) && Math.abs(tv.pct) * 100 >= clamp,
  };

  return {
    rows,
    total,
    acMax: acMax || 1,
    absMax: absMax || 1,
    pctMax: pctMax || clamp,
  };
}
