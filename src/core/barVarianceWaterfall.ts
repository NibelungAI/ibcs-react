/**
 * Layout model for IBCS **chart-template C06** — a *grouped structure + variance
 * waterfall* exhibit ("In Q3 2025, the total decrease in net sales compared to
 * PY was 343 kUSD").
 *
 * One coherent value axis carries three things at once, reading top-to-bottom:
 *
 *   1. HEADER totals — a hollow-frame **PL** bar and a faded-grey **PY** bar,
 *      each a full bar from the zero axis to its total.
 *   2. ENTITY rows — for every location/product a solid dark **AC** bar from the
 *      zero axis, with the **PY** reference drawn behind it (grey solid, visible
 *      only where PY exceeds AC), AND, floating far to the right around the PY
 *      total, that entity's absolute variance Δ = AC − PY as one step of a
 *      VERTICALLY-running waterfall. Sorted (default) by that variance so the
 *      favorable steps sit on top and the run bridges PY's total down to AC's.
 *   3. AC total — a solid dark bar, then the bridge's RESULT bars: the headline
 *      AC − PY (the −343) and, when PY data is present, the secondary AC − PL.
 *
 * A parallel relative-variance tier (Δ%, default vs PY) is laid out separately
 * by the renderer from `rows[i].pct`.
 *
 * The key trick: the entity AC/PY structure bars and the variance waterfall
 * share ONE zero-based scale (`domainMax`), so the waterfall's PL reference line
 * lands exactly at the end of the PL header bar — there is no second scale to
 * keep in sync. This module is the pure, framework-agnostic transform; the React
 * `BarVarianceWaterfallChart` only maps these value-space numbers to pixels.
 *
 * When NO `py` (and no `pyTotal`) is supplied the chart degrades cleanly to a
 * plan bridge: the reference becomes PL, the overlay a hollow frame, the
 * waterfall Δ = AC − PL, and the secondary result is dropped.
 *
 * SSR-safe: no DOM, clock, or randomness — a deterministic transform. Robust to
 * empty / single / negative / zero / huge inputs (never divides by zero, never
 * emits NaN).
 */

import { finiteOr, isFiniteNumber, normalizeDomain } from "./domain";
import { computeVariance } from "./variance";

/**
 * One input entity: an actual value, the plan (`base` = PL) it sits against, and
 * optionally the prior year (`py` = PY) the variance waterfall bridges from.
 */
export interface BarVarianceDatum {
  /** Entity label (state, region, product …). */
  label: string;
  /** Actual value (AC). */
  ac: number;
  /** Plan / budget value (PL) — the top hollow-frame reference. */
  base: number;
  /**
   * Prior-year value (PY). When present (on any row) the waterfall and the
   * structure overlay use PY as their reference; absent rows fall back to `base`.
   */
  py?: number;
  /**
   * Whether a higher value is favorable. Default true. Set false for
   * cost / expense entities so an increase reads as unfavorable (red).
   */
  higherIsBetter?: boolean;
}

/** One sorted, variance-resolved entity row, positioned in the waterfall. */
export interface BarVarianceRow {
  label: string;
  /** Actual value (sanitized). */
  ac: number;
  /** Plan value PL (sanitized). */
  base: number;
  /** The waterfall/overlay reference — PY when in use, else PL. */
  ref: number;
  higherIsBetter: boolean;
  /** Absolute variance the waterfall steps by: AC − ref. */
  abs: number;
  /** True when `abs` is good for the business (respects higherIsBetter). */
  favorable: boolean;
  /** Relative variance (fraction) vs `pctBase`, or null when that base is 0. */
  pct: number | null;
  /** True when the relative variance is favorable. */
  pctFavorable: boolean;
  /** |pct%| ≥ `clampPct` → draw the Δ% mark as an off-scale arrow. */
  pctOutlier: boolean;
  /** Running level entering this step (value units). */
  from: number;
  /** Running level leaving this step (value units); the next row's `from`. */
  to: number;
}

/** Rolled-up totals and the bridge's result variances. */
export interface BarVarianceTotals {
  /** Σ PL — the plan total (top hollow-frame bar). */
  pl: number;
  /** Σ PY — the prior-year total; also where the waterfall starts. */
  py: number;
  /** PY total shown in the header bar: `pyTotal` override, else `py`. */
  pyDisplay: number;
  /** Σ AC — the actual total; where the waterfall lands. */
  ac: number;
  /** Headline result AC − PY (the "−343"). */
  refAbs: number;
  refFavorable: boolean;
  /** Headline result as a fraction, or null when PY total is 0. */
  refPct: number | null;
  /** Secondary result AC − PL (the "+82"); meaningful only when PY is in use. */
  plAbs: number;
  plFavorable: boolean;
  /** Total relative variance vs `pctBase` (fraction), or null. */
  pct: number | null;
  pctFavorable: boolean;
  pctOutlier: boolean;
}

/** Everything the renderer needs: rows, totals, the shared scale, and Δ% scale. */
export interface BarVarianceWaterfallLayout {
  rows: BarVarianceRow[];
  totals: BarVarianceTotals;
  /** True when PY drives the overlay + waterfall (any `py` or `pyTotal` given). */
  usesPy: boolean;
  /** The reference the waterfall bridges from: "PY" (default) or "PL". */
  reference: "PY" | "PL";
  /** Which base the relative-variance tier compares against. */
  pctBase: "PY" | "PL";
  /** Top of the shared zero-based value scale (0 → domainMax). Never below 0. */
  domainMax: number;
  /** Bottom of the scale (≤ 0); 0 unless a running level / value goes negative. */
  domainMin: number;
  /** Half-scale for the Δ% tier, in PERCENT units, excluding outliers. */
  pctMax: number;
}

export interface BarVarianceWaterfallOptions {
  /**
   * Row order:
   *  - "variance" (default): by the waterfall variance (AC − ref) descending, so
   *    favorable steps stack on top — the IBCS sorted-bridge look,
   *  - "value": by AC descending,
   *  - "none": preserve input order.
   */
  sortBy?: "variance" | "value" | "none";
  /** Which base the relative-variance tier uses: "PY" (default) or "PL". */
  pctBase?: "PY" | "PL";
  /** Off-scale threshold for the Δ% tier, in percent. Default 100. */
  clampPct?: number;
  /** Override the PY total shown in the header (else the sum of the rows' PY). */
  pyTotal?: number;
}

/**
 * Build the C06 layout from raw entities.
 *
 * The waterfall starts at the SUM of the rows' references (PY) so that adding
 * every step's AC − PY lands exactly on the AC total — the bridge is always
 * arithmetically closed, regardless of the `pyTotal` display override (which
 * only changes the header bar's length, never the geometry). The Δ% scale is
 * derived from the rows only (outliers excluded) so the total's percentage never
 * dwarfs the per-row marks. Empty input yields empty rows, zero totals, and unit
 * scales so the renderer never divides by zero.
 */
export function computeBarVarianceWaterfall(
  data: BarVarianceDatum[],
  options: BarVarianceWaterfallOptions = {},
): BarVarianceWaterfallLayout {
  const { sortBy = "variance", pctBase = "PY", clampPct = 100, pyTotal } = options;
  const clamp = Math.abs(clampPct) || 100;
  const list = data ?? [];

  const usesPy = pyTotal != null || list.some((d) => d?.py != null);
  const reference: "PY" | "PL" = usesPy ? "PY" : "PL";
  // With no PY anywhere, a "PY" pctBase request has nothing to compare against,
  // so it collapses to PL (which equals the reference here).
  const effectivePctBase: "PY" | "PL" = usesPy ? pctBase : "PL";

  const built: BarVarianceRow[] = list.map((d) => {
    const hib = d?.higherIsBetter ?? true;
    const ac = finiteOr(d?.ac);
    const base = finiteOr(d?.base);
    const ref = usesPy ? (d?.py != null ? finiteOr(d.py) : base) : base;
    const pctRef = effectivePctBase === "PY" ? ref : base;
    // ac/ref/base are finite, so computeVariance never returns null here.
    const v = computeVariance(ac, ref, hib)!;
    const pv = computeVariance(ac, pctRef, hib)!;
    return {
      label: d?.label ?? "",
      ac,
      base,
      ref,
      higherIsBetter: hib,
      abs: v.abs,
      favorable: v.favorable,
      pct: pv.pct,
      pctFavorable: pv.favorable,
      pctOutlier: false,
      from: 0,
      to: 0,
    };
  });

  const rows = [...built];
  if (sortBy === "variance") rows.sort((a, b) => b.abs - a.abs);
  else if (sortBy === "value") rows.sort((a, b) => b.ac - a.ac);

  // Totals (order-independent, so summed from the unsorted set).
  let plSum = 0;
  let pySum = 0;
  let acSum = 0;
  for (const r of built) {
    plSum += r.base;
    pySum += r.ref;
    acSum += r.ac;
  }
  const pyDisplay = pyTotal != null ? finiteOr(pyTotal) : pySum;

  // Walk the bridge from the PY total; track the shared zero-based domain so the
  // structure bars (0→value) and the floating waterfall live on one scale.
  let cum = pySum;
  let domainMin = Math.min(0, pySum, acSum, plSum);
  let domainMax = Math.max(0, pyDisplay, acSum, plSum);
  for (const r of rows) {
    r.from = cum;
    cum += r.abs;
    r.to = cum;
    domainMin = Math.min(domainMin, r.from, r.to, r.ac, r.ref, r.base);
    domainMax = Math.max(domainMax, r.from, r.to, r.ac, r.ref, r.base);
  }

  // Δ% scale from the rows only, excluding off-scale outliers.
  let pctMax = 0;
  for (const r of rows) {
    r.pctOutlier = isFiniteNumber(r.pct) && Math.abs(r.pct) * 100 >= clamp;
    if (isFiniteNumber(r.pct)) {
      const p = Math.abs(r.pct) * 100;
      if (p < clamp) pctMax = Math.max(pctMax, p);
    }
  }

  // Total favorability follows the prevailing direction: unfavorable-higher only
  // when every row is a cost line, else higher-is-better.
  const totalHib = !(built.length > 0 && built.every((r) => !r.higherIsBetter));
  const refV = computeVariance(acSum, pySum, totalHib)!;
  const plV = computeVariance(acSum, plSum, totalHib)!;
  const pctRefTotal = effectivePctBase === "PY" ? pySum : plSum;
  const pctV = computeVariance(acSum, pctRefTotal, totalHib)!;

  const totals: BarVarianceTotals = {
    pl: plSum,
    py: pySum,
    pyDisplay,
    ac: acSum,
    refAbs: refV.abs,
    refFavorable: refV.favorable,
    refPct: refV.pct,
    plAbs: plV.abs,
    plFavorable: plV.favorable,
    pct: pctV.pct,
    pctFavorable: pctV.favorable,
    pctOutlier: isFiniteNumber(pctV.pct) && Math.abs(pctV.pct) * 100 >= clamp,
  };

  return {
    rows,
    totals,
    usesPy,
    reference,
    pctBase: effectivePctBase,
    // Both ends are zero-seeded above, so this only repairs an EMPTY domain
    // (all-zero data) — an all-negative exhibit keeps its max at 0.
    ...normalizeDomain(domainMin, domainMax),
    pctMax: pctMax || clamp,
  };
}
