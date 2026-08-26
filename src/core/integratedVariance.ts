import { finiteOr, isFiniteNumber, normalizeDomain } from "./domain";
import type { Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * One category in an integrated variance chart. Designed for ~12 periods
 * (Jan…Dec), an actual head followed by a forecast tail. `AC` is the actual
 * (or expected, on forecast periods); `PY`/`PL` ride along as the comparison
 * the Δ panels are computed against.
 */
export interface IntegratedDatum {
  /** Period label: "Jan", "Feb", … */
  category: string;
  /** Actual value (or the expected value on a forecast period). */
  AC: number;
  /** Previous year. */
  PY?: number;
  /** Plan / budget. */
  PL?: number;
  /** Render this period as forecast (hatched columns/bars, outlined pins). */
  isForecast?: boolean;
}

/** One segment of a stacked full-year total column (e.g. a sub-business). */
export interface FySegmentInput {
  label: string;
  value: number;
}

/**
 * A full-year (FY) TOTAL column, set apart to the right of the running
 * periods. A single segment renders as one solid total column; two or more
 * stack into a single column (e.g. 1458 + 578), each segment labelled.
 */
export interface FyTotalInput {
  label: string;
  segments: FySegmentInput[];
}

/** A segment enriched with its cumulative value-unit span within the stack. */
export interface FySegment extends FySegmentInput {
  /** Cumulative value at the segment's base. */
  y0: number;
  /** Cumulative value at the segment's top (`y0 + value`). */
  y1: number;
}

/** The resolved FY total: the cumulative stack plus its grand total. */
export interface FyTotalLayout {
  label: string;
  total: number;
  segments: FySegment[];
}

/**
 * One category enriched with its resolved comparison value and
 * AC-vs-comparison variance. Values are echoed back SANITIZED: a non-finite
 * input is missing data (`undefined`, or 0 for the required actual).
 */
export interface IntegratedCell {
  category: string;
  AC: number;
  /** The comparison scenario's value (PY or PL) for this period, if present. */
  comparisonValue: number | undefined;
  PY?: number;
  PL?: number;
  isForecast: boolean;
  /** `AC` vs the comparison scenario (respects `higherIsBetter`). */
  variance: Variance | null;
}

export interface IntegratedLayout {
  cells: IntegratedCell[];
  /** Comparison scenario the Δ panels are computed against. */
  comparison: "PY" | "PL";
  higherIsBetter: boolean;
  /** Most negative value across AC/PY/PL and the FY stack (≤ 0) — the column floor. */
  domainMin: number;
  /** Most positive value across AC/PY/PL and the FY stack (≥ 0) — the column ceiling. */
  domainMax: number;
  /** Largest in-scale |Δ| — the half-scale of the absolute variance panel. */
  absMax: number;
  /** Largest in-scale |Δ%| as a fraction — the half-scale of the percent panel. */
  pctMax: number;
  /** A |Δ%| at or beyond this fraction is drawn off-scale (arrow tip). */
  pctClamp: number;
  /** The resolved FY total, when supplied. */
  fy?: FyTotalLayout;
}

export interface ComputeIntegratedOptions {
  /** Comparison scenario AC is measured against. Default "PY". */
  comparison?: "PY" | "PL";
  /** Whether a higher value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /** Off-scale threshold for the percent panel, as a fraction. Default 1 (=100%). */
  pctClamp?: number;
  /** Full-year total column to fold into the value domain. */
  fyTotal?: FyTotalInput;
}

/**
 * Pure layout for the integrated variance chart: per-period variance against
 * the comparison scenario, the shared value domain for the bottom column panel
 * (always including 0 and any FY stack so nothing maps off-canvas), and the
 * half-scales for the absolute and percent Δ panels.
 *
 * Off-scale percents (|Δ%| ≥ `pctClamp`, e.g. when the comparison is near 0)
 * are excluded from `pctMax` so one runaway month can't flatten the panel; the
 * renderer pins them to the panel edge with an arrow. Non-finite values are
 * MISSING: they never widen the domain, never accumulate into the FY stack and
 * never yield a variance, and an all-negative chart keeps `domainMax === 0`.
 * Framework agnostic — the React `IntegratedVarianceChart` is just a renderer
 * over this.
 */
export function computeIntegratedVariance(
  data: IntegratedDatum[],
  opts: ComputeIntegratedOptions = {},
): IntegratedLayout {
  const comparison = opts.comparison ?? "PY";
  const higherIsBetter = opts.higherIsBetter ?? true;
  const pctClamp = opts.pctClamp != null && opts.pctClamp > 0 ? opts.pctClamp : 1;

  let domainMin = 0;
  let domainMax = 0;
  let absMax = 0;
  let pctMax = 0;

  const cells: IntegratedCell[] = data.map((d) => {
    const AC = isFiniteNumber(d.AC) ? d.AC : undefined;
    const PY = isFiniteNumber(d.PY) ? d.PY : undefined;
    const PL = isFiniteNumber(d.PL) ? d.PL : undefined;
    const comparisonValue = comparison === "PY" ? PY : PL;
    for (const v of [AC, PY, PL]) {
      if (v != null) {
        domainMin = Math.min(domainMin, v);
        domainMax = Math.max(domainMax, v);
      }
    }
    const variance = computeVariance(AC, comparisonValue, higherIsBetter);
    if (variance) {
      absMax = Math.max(absMax, Math.abs(variance.abs));
      if (isFiniteNumber(variance.pct) && Math.abs(variance.pct) < pctClamp) {
        pctMax = Math.max(pctMax, Math.abs(variance.pct));
      }
    }
    return {
      category: d.category,
      AC: finiteOr(AC),
      comparisonValue,
      PY,
      PL,
      isForecast: !!d.isForecast,
      variance,
    };
  });

  let fy: FyTotalLayout | undefined;
  if (opts.fyTotal && opts.fyTotal.segments.length) {
    let cum = 0;
    const segments: FySegment[] = opts.fyTotal.segments.map((s) => {
      const value = finiteOr(s.value);
      const y0 = cum;
      cum += value;
      const y1 = cum;
      domainMin = Math.min(domainMin, y0, y1);
      domainMax = Math.max(domainMax, y0, y1);
      return { label: s.label, value, y0, y1 };
    });
    fy = { label: opts.fyTotal.label, total: cum, segments };
  }

  return {
    cells,
    comparison,
    higherIsBetter,
    ...normalizeDomain(domainMin, domainMax),
    absMax: absMax || 1,
    pctMax: pctMax || pctClamp,
    pctClamp,
    fy,
  };
}
