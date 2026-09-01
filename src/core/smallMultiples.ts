import type { ScenarioKey, Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * A value domain shared across a set of small multiples. Holding only numbers
 * keeps it JSON-serializable; the renderer maps values to pixels itself.
 *
 * The whole point of small multiples (the IBCS "CHECK" principle) is that every
 * panel uses the SAME scale, so panels are visually comparable at a glance.
 */
export interface SharedScale {
  /** Most negative point across all panels (≤ 0 - the zero baseline is always in). */
  domainMin: number;
  /** Most positive point across all panels (≥ 0). */
  domainMax: number;
}

/**
 * Compute one value domain spanning EVERY item, so all panels share a scale.
 * `valuesOf` returns the numbers a given item contributes (e.g. all its
 * scenario values). The domain always includes 0 so a zero baseline sits inside
 * every panel even for all-positive data.
 */
export function computeSharedScale<T>(
  items: readonly T[],
  valuesOf: (item: T) => number[],
): SharedScale {
  let domainMin = 0;
  let domainMax = 0;
  for (const item of items) {
    for (const v of valuesOf(item)) {
      if (v == null || !isFinite(v)) continue;
      if (v < domainMin) domainMin = v;
      if (v > domainMax) domainMax = v;
    }
  }
  return { domainMin, domainMax: domainMax === 0 && domainMin === 0 ? 1 : domainMax };
}

/* ---------------- Shared-scale solver (IBCS "same scale = same meaning") ---------------- */

/**
 * One panel's contribution to a shared scale. The renderer never needs the
 * panel's identity here - only the numbers it would plot and (optionally) what
 * unit they are in, so the axis hint can be formatted correctly.
 */
export interface SharedDomainPanel {
  /** The numbers this panel would map to pixels (e.g. every scenario value). */
  values: readonly number[];
  /**
   * Unit hint, used only to label the shared axis and to pick the dominant
   * unit of the result. Mixing units across panels is meaningless under IBCS,
   * so this is informational. Default "number".
   */
  kind?: "currency" | "percent" | "number";
}

export interface SharedDomainOptions {
  /**
   * Round the bounds to "nice" numbers via {@link niceBounds}. Default true.
   * Turn off to map to the exact data extent.
   */
  nice?: boolean;
  /** Force the domain symmetric about 0 (ideal for variance). Default false. */
  symmetric?: boolean;
  /**
   * Outlier clamp. When set to a fraction in (0, 1) - e.g. `0.95` - the positive
   * bound is pulled down to the 95th percentile of the positive values and the
   * negative bound up to the 5th percentile of the negative values, computed
   * across EVERY panel. This stops one giant panel from flattening all the
   * others into invisible slivers.
   *
   * IMPORTANT: clamping changes the SCALE, not the data. A value beyond the
   * clamped bound still maps to the very top/bottom of its panel (the renderer
   * should treat it as "off the top", e.g. by capping the bar at full height
   * and still printing the true label). `clamped` in the result is true when
   * the clamp actually reduced the extent, so callers can draw an overflow cue.
   */
  clampPercentile?: number;
}

/** The shared domain plus solver metadata. Pure numbers - JSON-serializable. */
export interface SharedDomainResult extends SharedScale {
  /** True when {@link SharedDomainOptions.clampPercentile} reduced the extent. */
  clamped: boolean;
  /** A "nice" tick step that divides the domain (0 when `nice` is off). */
  step: number;
  /** Dominant unit across the panels, for labelling the shared axis. */
  kind: "currency" | "percent" | "number";
}

/** Linear-interpolated quantile of an ASCENDING-sorted array. SSR-safe, pure. */
function quantile(sortedAsc: readonly number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const idx = Math.min(1, Math.max(0, p)) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  // `idx` is clamped to [0, n - 1], so both ends are in range.
  const vlo = sortedAsc[lo] ?? 0;
  const vhi = sortedAsc[hi] ?? vlo;
  if (lo === hi) return vlo;
  return vlo + (vhi - vlo) * (idx - lo);
}

/** A "nice" 1/2/5×10ⁿ number at or around `range`. Returns 0 for non-finite input. */
function niceNum(range: number, round: boolean): number {
  if (!(range > 0) || !isFinite(range)) return 0;
  const exp = Math.floor(Math.log10(range));
  const f = range / Math.pow(10, exp); // 1..10
  let nf: number;
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}

/** -0 reads badly in labels and JSON; normalize it to 0. */
function unNegZero(n: number): number {
  return Object.is(n, -0) ? 0 : n;
}

/**
 * Round a raw `[min, max]` to friendly axis bounds, ALWAYS keeping 0 inside
 * (small multiples share a zero baseline). Returns the rounded bounds plus a
 * nice tick `step` that divides them - handy for an axis hint. Pure & SSR-safe.
 *
 * Passing a symmetric input (e.g. `niceBounds(-M, M)`) yields symmetric output,
 * which is what variance panels want.
 */
export function niceBounds(
  min: number,
  max: number,
  ticks = 4,
): { domainMin: number; domainMax: number; step: number } {
  let lo = isFinite(min) ? Math.min(0, min) : 0;
  let hi = isFinite(max) ? Math.max(0, max) : 0;
  if (lo === hi) hi = lo + 1; // degenerate (all zero) -> give it a unit extent
  const range = niceNum(hi - lo, false);
  const step = niceNum(range / Math.max(1, ticks), true) || (hi - lo) / Math.max(1, ticks);
  const domainMin = step ? Math.floor(lo / step) * step : lo;
  const domainMax = step ? Math.ceil(hi / step) * step : hi;
  return { domainMin: unNegZero(domainMin), domainMax: unNegZero(domainMax), step };
}

/**
 * THE shared-scale solver. Given many panels' value arrays, compute ONE value
 * domain so every panel maps values to pixels identically - the core of the
 * IBCS rule "same scale = same meaning". The domain always spans 0.
 *
 * Handles mixed positive/negative data, optional symmetry (for variance),
 * "nice" rounding, and a percentile clamp for outliers (see
 * {@link SharedDomainOptions.clampPercentile}).
 *
 * @example
 * const d = sharedDomain(
 *   [{ values: [10, 4, -2] }, { values: [120, 3] }],
 *   { clampPercentile: 0.9 }
 * );
 * // d.domainMin <= 0 <= d.domainMax, nicely rounded; d.clamped === true
 */
export function sharedDomain(
  panels: readonly SharedDomainPanel[],
  opts: SharedDomainOptions = {},
): SharedDomainResult {
  const { nice = true, symmetric = false, clampPercentile } = opts;

  const pos: number[] = [];
  const neg: number[] = [];
  const kindCount = { currency: 0, percent: 0, number: 0 };
  for (const p of panels) {
    kindCount[p.kind ?? "number"]++;
    for (const v of p.values) {
      if (v == null || !isFinite(v)) continue;
      if (v > 0) pos.push(v);
      else if (v < 0) neg.push(v);
    }
  }
  // Dominant unit, for the axis hint. With no panels at all, default "number";
  // otherwise ties resolve currency > percent > number.
  const kind: SharedDomainResult["kind"] =
    panels.length === 0
      ? "number"
      : kindCount.currency >= kindCount.percent && kindCount.currency >= kindCount.number
        ? "currency"
        : kindCount.percent >= kindCount.number
          ? "percent"
          : "number";

  let hi = 0;
  for (const v of pos) if (v > hi) hi = v;
  let lo = 0;
  for (const v of neg) if (v < lo) lo = v;

  let clamped = false;
  if (clampPercentile != null && clampPercentile > 0 && clampPercentile < 1) {
    if (pos.length) {
      pos.sort((a, b) => a - b);
      const c = quantile(pos, clampPercentile);
      if (c > 0 && c < hi) {
        hi = c;
        clamped = true;
      }
    }
    if (neg.length) {
      neg.sort((a, b) => a - b); // ascending: most-negative first
      const c = quantile(neg, 1 - clampPercentile);
      if (c < 0 && c > lo) {
        lo = c;
        clamped = true;
      }
    }
  }

  if (symmetric) {
    const m = Math.max(hi, -lo);
    hi = m;
    lo = -m;
  }

  if (nice) {
    const nb = niceBounds(lo, hi);
    return { domainMin: nb.domainMin, domainMax: nb.domainMax, step: nb.step, clamped, kind };
  }

  // Raw extent. Keep zero inside and avoid a degenerate empty domain.
  const domainMin = unNegZero(Math.min(0, lo));
  let domainMax = Math.max(0, hi);
  if (domainMax === 0 && domainMin === 0) domainMax = 1;
  return { domainMin, domainMax: unNegZero(domainMax), step: 0, clamped, kind };
}

/* ---------------- Built-in mode: a mini variance column per group ---------------- */

/** A CategoryDatum-like row: a category carrying up to four scenario values. */
export interface MiniDatum {
  category: string;
  AC?: number;
  PY?: number;
  PL?: number;
  FC?: number;
  /** Per-row higher-is-better override (e.g. a cost category). */
  higherIsBetter?: boolean;
}

/** A named group of rows - one small multiple panel. */
export interface MiniGroupInput {
  label: string;
  data: MiniDatum[];
}

/** One category's variance within a group. */
export interface MiniVarianceBar {
  category: string;
  /** AC (or FC) vs the comparison scenario. */
  variance: Variance | null;
}

/** A group enriched with its per-category variances. */
export interface MiniVarianceGroup {
  label: string;
  bars: MiniVarianceBar[];
}

export interface MiniVarianceLayout {
  groups: MiniVarianceGroup[];
  /**
   * Half-scale shared by every panel: the largest |variance| across ALL groups.
   * Pass this to each mini column so they share one axis.
   */
  varMax: number;
  comparison: ScenarioKey;
}

export interface ComputeMiniVariancesOptions {
  /** Scenario each category is compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Group-level higher-is-better default (per-row value wins). Default true. */
  higherIsBetter?: boolean;
}

/**
 * Built-in small-multiples layout: for each group, the AC-vs-comparison
 * variance of every category, plus a single `varMax` shared across ALL groups
 * so every mini column chart uses the same scale. The current series is AC when
 * present, else FC.
 */
export function computeMiniVariances(
  groups: readonly MiniGroupInput[],
  opts: ComputeMiniVariancesOptions = {},
): MiniVarianceLayout {
  const comparison = opts.comparison ?? "PY";
  const defaultHib = opts.higherIsBetter ?? true;
  let varMax = 0;

  const out: MiniVarianceGroup[] = groups.map((g) => ({
    label: g.label,
    bars: g.data.map((d) => {
      const current = d.AC ?? d.FC;
      const base = d[comparison];
      const variance =
        current != null && base != null
          ? computeVariance(current, base, d.higherIsBetter ?? defaultHib)
          : null;
      if (variance) varMax = Math.max(varMax, Math.abs(variance.abs));
      return { category: d.category, variance };
    }),
  }));

  return { groups: out, varMax: varMax || 1, comparison };
}
