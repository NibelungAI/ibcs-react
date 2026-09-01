/**
 * Pure layout for IBCS chart-template **C12** - a P&L calculation scheme drawn
 * as TWO side-by-side vertical waterfalls (a comparison lane and an Actual lane)
 * plus an absolute- and a relative-variance tier, all row-aligned to the P&L
 * lines.
 *
 * This module is the framework-agnostic seam under the React
 * `WaterfallStatementChart`: it accepts a flat list of P&L lines, each carrying
 * an Actual (`ac`) and a comparison (`base`, e.g. previous-year) value plus a
 * waterfall `flow`, and returns positioned bridge bars for BOTH lanes on ONE
 * shared value→domain (so the lanes are visually comparable), together with the
 * per-line absolute / percentage variance (coloured by impact, honouring
 * `higherIsBetter`) and the half-scales the variance tiers map against.
 *
 * The bridge accumulation itself is delegated to the orientation-agnostic
 * {@link computeBridge} (run once per lane); everything here is the C12-specific
 * pairing, shared-scale merge and per-line variance.
 *
 * Pure and SSR-safe - no DOM / time / randomness, and never returns `NaN`: a
 * non-finite value is MISSING (it contributes 0 to its lane's run), and a
 * degenerate all-zero domain widens to a safe `[0, 1]` while an all-negative
 * statement keeps `domainMax === 0`.
 */

import { finiteOr, normalizeDomain } from "./domain";
import type { ScenarioKey, Variance } from "./types";
import { computeBridge, type WaterfallDatum } from "./waterfall";
import { computeVariance } from "./variance";

/**
 * One P&L line in a {@link WaterfallStatementChart}. `ac` / `base` are given as
 * MAGNITUDES (the running-total direction is implied by `flow`); a negative
 * value is still honoured. For `flow: "result"` the value is ignored and the
 * line draws to the current running total of its lane.
 */
export interface WaterfallStatementLine {
  /** Row label shown in the left gutter. */
  label: string;
  /** Actual value (the dark lane). */
  ac: number;
  /** Comparison value - previous year / plan (the grey lane). */
  base: number;
  /**
   * How the line moves the running total:
   *  - "add"      (default): up by the value (revenue, income)
   *  - "subtract": down by the value (cost, expense, tax)
   *  - "result":  a checkpoint subtotal - a full bar from zero to the running
   *               total, which it does NOT advance (Sales revenue, EBIT, …)
   */
  flow?: "add" | "subtract" | "result";
  /**
   * Whether a higher value is good here. Default true; set false on cost /
   * expense / tax lines so an increase reads as unfavorable (red). Drives the
   * variance colour only - never the geometry.
   */
  higherIsBetter?: boolean;
}

/** One lane's bridge geometry for a row, in VALUE units (renderer maps to px). */
export interface WsLaneBar {
  /** Running total entering the bar (0 for a result). */
  from: number;
  /** Running total leaving the bar (the level for a result). */
  to: number;
  /** Signed amount applied to the running total (0 for a result). */
  delta: number;
  /** True for a "result" row - a full, emphasised bar from zero. */
  isTotal: boolean;
  /** Visual travel: "up" when `to >= from`, else "down". */
  direction: "up" | "down";
  /** Running total entering this row (for the step connector coming in). */
  cumBefore: number;
  /** Running total leaving this row (for the step connector going out). */
  cumAfter: number;
}

/** A fully positioned P&L row: both lane bars + the variance tiers' inputs. */
export interface WaterfallStatementRow {
  label: string;
  /** Resolved flow ("add" when unset). */
  flow: "add" | "subtract" | "result";
  /** True for result/subtotal rows (emphasised, ruled above). */
  isResult: boolean;
  /** Gutter flow marker: "+" (add), "−" (subtract), "=" (result). */
  marker: string;
  /** Effective higher-is-better for this row (chart default unless overridden). */
  higherIsBetter: boolean;
  /** Comparison-lane bar geometry. */
  base: WsLaneBar;
  /** Actual-lane bar geometry. */
  ac: WsLaneBar;
  /** Representative comparison value: the level for results, else `base`. */
  baseValue: number;
  /** Representative actual value: the level for results, else `ac`. */
  acValue: number;
  /** AC − comparison of the representative value, coloured by impact. */
  variance: Variance;
  /** |%| ≥ `clampPct` → drawn as an off-scale pin (and excluded from the pct scale). */
  pctOutlier: boolean;
  /** |abs| > `absDomain` → drawn as an off-scale bar with an arrow tip. */
  absOutlier: boolean;
}

/** The full C12 layout: paired lanes on one scale + the two variance tiers. */
export interface WaterfallStatementLayout {
  rows: WaterfallStatementRow[];
  /** Most-negative point on the SHARED lane value axis (≤ 0). */
  domainMin: number;
  /** Most-positive point on the SHARED lane value axis (≥ 0). */
  domainMax: number;
  /** Half-scale (currency units) the ΔPY absolute-variance bars map against. */
  absDomain: number;
  /** Half-scale (percent points) the ΔPY% pins map against. */
  pctDomain: number;
  /** Final running total of the comparison lane. */
  baseTotal: number;
  /** Final running total of the Actual lane. */
  acTotal: number;
  /** The comparison scenario the grey lane represents. */
  comparison: ScenarioKey;
}

/** Options for {@link computeWaterfallStatement}. */
export interface ComputeWaterfallStatementOptions {
  /** Comparison scenario the grey lane / variance tiers use. Default "PY". */
  comparison?: ScenarioKey;
  /** Chart-level higher-is-better default (per-line value wins). Default true. */
  higherIsBetter?: boolean;
  /**
   * A |%| at or beyond this is drawn as an off-scale pin and excluded from the
   * ΔPY% scale. Default 100.
   */
  clampPct?: number;
  /**
   * A |Δ| beyond this is drawn as an off-scale bar (arrow tip). Default
   * `Infinity` - the absolute tier auto-scales to its own max so nothing is
   * off-scale unless the caller opts into a fixed clamp.
   */
  clampAbs?: number;
}

const MARKER: Record<"add" | "subtract" | "result", string> = {
  add: "+",
  subtract: "−",
  result: "=",
};

/** Map a statement line to the flat {@link WaterfallDatum} a bridge consumes. */
function toDatum(value: number, flow: "add" | "subtract" | "result"): WaterfallDatum {
  return { category: "", value, flow };
}

/**
 * Build the paired-waterfall + variance-tier layout for one P&L. Runs the
 * bridge accumulation once for the comparison values and once for the actuals,
 * merges their domains so BOTH lanes share a single value→pixel scale, and
 * computes each row's variance on its representative value (the running-total
 * LEVEL for result rows, the line's own value otherwise - matching how the
 * IBCS C12 reference labels ΔPY).
 *
 * @param lines the P&L lines, top-to-bottom
 * @param opts  comparison scenario, favorability default and tier clamps
 */
export function computeWaterfallStatement(
  lines: WaterfallStatementLine[],
  opts: ComputeWaterfallStatementOptions = {},
): WaterfallStatementLayout {
  const comparison = opts.comparison ?? "PY";
  const defaultHib = opts.higherIsBetter ?? true;
  const clampPct = opts.clampPct ?? 100;
  const clampAbs = opts.clampAbs ?? Infinity;

  const baseBridge = computeBridge(
    lines.map((l) => toDatum(l.base, l.flow ?? "add")),
    comparison,
  );
  const acBridge = computeBridge(
    lines.map((l) => toDatum(l.ac, l.flow ?? "add")),
    "AC",
  );

  // Shared lane scale: union of both bridges' domains (zero always included).
  const { domainMin, domainMax } = normalizeDomain(
    Math.min(baseBridge.domainMin, acBridge.domainMin),
    Math.max(baseBridge.domainMax, acBridge.domainMax),
  );

  const pick = (bar: (typeof acBridge.bars)[number]): WsLaneBar => ({
    from: bar.from,
    to: bar.to,
    delta: bar.delta,
    isTotal: bar.isTotal,
    direction: bar.direction,
    cumBefore: bar.cumBefore,
    cumAfter: bar.cumAfter,
  });

  const rows: WaterfallStatementRow[] = [];
  for (const [i, line] of lines.entries()) {
    const flow = line.flow ?? "add";
    const isResult = flow === "result";
    const hib = line.higherIsBetter ?? defaultHib;
    const baseBar = baseBridge.bars[i];
    const acBar = acBridge.bars[i];
    // Both bridges are built from `lines`, so every line always has both bars.
    if (!baseBar || !acBar) continue;

    // Representative value: the LEVEL for a checkpoint, the line's own value
    // otherwise (so a sub-line's ΔPY is its own movement, a subtotal's is the
    // level delta).
    const baseValue = isResult ? baseBar.to : finiteOr(line.base);
    const acValue = isResult ? acBar.to : finiteOr(line.ac);
    const variance = computeVariance(acValue, baseValue, hib) ?? {
      abs: 0,
      pct: null,
      favorable: true,
    };

    rows.push({
      label: line.label,
      flow,
      isResult,
      marker: MARKER[flow],
      higherIsBetter: hib,
      base: pick(baseBar),
      ac: pick(acBar),
      baseValue,
      acValue,
      variance,
      pctOutlier: false,
      absOutlier: false,
    });
  }

  // Absolute tier half-scale: the caller's clamp if finite, else auto-scale to
  // the largest |Δ| so nothing arrows off unless they opted in.
  let maxAbs = 0;
  for (const r of rows) {
    const a = Math.abs(r.variance.abs);
    if (Number.isFinite(a)) maxAbs = Math.max(maxAbs, a);
  }
  const absDomain = Number.isFinite(clampAbs) ? Math.max(clampAbs, 1e-9) : maxAbs || 1;

  // Percent tier half-scale: largest |%| among the inliers (those under the
  // clamp), falling back to the clamp itself when every row is off-scale.
  // Flag each row's off-scale state for both tiers in the same pass.
  let pctInlierMax = 0;
  for (const r of rows) {
    const a = Math.abs(r.variance.abs);
    r.absOutlier = Number.isFinite(a) && a > absDomain + 1e-9;

    const p = r.variance.pct;
    if (p == null || !Number.isFinite(p)) continue;
    const pp = Math.abs(p * 100);
    r.pctOutlier = pp >= clampPct;
    if (!r.pctOutlier) pctInlierMax = Math.max(pctInlierMax, pp);
  }
  const pctDomain = pctInlierMax || clampPct;

  return {
    rows,
    domainMin,
    domainMax,
    absDomain,
    pctDomain,
    baseTotal: baseBridge.total,
    acTotal: acBridge.total,
    comparison,
  };
}
