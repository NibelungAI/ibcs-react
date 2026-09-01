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

/** One input entity: an actual value and the plan / prior value to compare it against. */
export interface RankingDatum {
  /** Entity label (state, product, region …). */
  label: string;
  /** Actual value (AC). */
  AC: number;
  /** Plan / reference value the actual is compared against (PL or PY). */
  base: number;
  /**
   * Whether a higher value is favorable. Default true. Set false for
   * cost / expense entities so an increase reads as unfavorable (red).
   */
  higherIsBetter?: boolean;
}

/** One ranked, variance-resolved row. */
export interface RankingRow {
  label: string;
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
  /** Max |AC| (and |base|) across the rows - the left AC-bar scale. */
  acMax: number;
  /** Shared absolute-variance scale: max |abs| across the rows (never the total). */
  absMax: number;
  /** Shared relative-variance scale, in PERCENT units, excluding outliers. */
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
    return {
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
  });

  const rows = [...built];
  if (sortBy === "variance") rows.sort((a, b) => b.abs - a.abs);
  else if (sortBy === "value") rows.sort((a, b) => b.ac - a.ac);

  // Shared scales across the rows (the total is intentionally excluded).
  let acMax = 0;
  let absMax = 0;
  let pctMax = 0;
  for (const r of rows) {
    acMax = Math.max(acMax, Math.abs(r.ac), Math.abs(r.base));
    absMax = Math.max(absMax, Math.abs(r.abs));
    if (r.pct != null && Number.isFinite(r.pct)) {
      const p = Math.abs(r.pct) * 100;
      if (p < clamp) pctMax = Math.max(pctMax, p);
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
