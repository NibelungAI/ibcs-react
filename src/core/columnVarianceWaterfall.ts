import { finiteOr, isFiniteNumber, normalizeDomain } from "./domain";
import type { ScenarioKey, Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * One period of an IBCS chart-template **C05** ("columns + horizontal
 * waterfall"). `ac` is the actual (or expected value on a forecast period);
 * `pl` is the plan/budget it is measured against. The per-period absolute
 * variance `ac − pl` is what the middle horizontal-waterfall tier bridges.
 */
export interface ColumnVarianceDatum {
  /** Period label: "Jan", "Feb", … */
  category: string;
  /** Actual value (or the expected value on a forecast period). */
  ac: number;
  /** Plan / budget for this period. */
  pl: number;
  /** Render as forecast (hatched columns/bars, hollow pin tips). */
  isForecast?: boolean;
}

/**
 * A scenario TOTAL column set apart on the LEFT (e.g. "2024 AC" or "2025 PL"):
 * a single full-height column drawn in its scenario's IBCS notation. The
 * bridge anchors on the sum of the period plans, not on these columns, so they
 * are pure reference.
 */
export interface PriorTotalInput {
  /** Two-line-friendly caption, e.g. "2024 AC". */
  label: string;
  /** The total value (column height). */
  value: number;
  /** IBCS scenario whose notation the column uses (AC solid, PL frame, …). */
  scenario: ScenarioKey;
}

/** One stacked segment of the end (AC+FC) total column. */
export interface EndSegmentInput {
  label: string;
  value: number;
  /** Draw hatched ("expected") instead of solid. */
  forecast?: boolean;
}

/**
 * The TOTAL column set apart on the RIGHT (e.g. "2025 AC+FC"): one or more
 * segments stacked into a single column (83 AC solid + 95 FC hatched = 178).
 */
export interface EndTotalInput {
  label: string;
  segments: EndSegmentInput[];
}

/** A stacked end segment enriched with its cumulative value-unit span. */
export interface EndSegment extends EndSegmentInput {
  /** Cumulative value at the segment's base. */
  y0: number;
  /** Cumulative value at the segment's top (`y0 + value`). */
  y1: number;
}

/** The resolved end total: its stacked segments plus the grand total. */
export interface ResolvedEndTotal {
  label: string;
  total: number;
  segments: EndSegment[];
}

/** One period enriched with its AC-vs-PL variance and its bridge interval. */
export interface ColumnVarianceCell {
  category: string;
  ac: number;
  pl: number;
  isForecast: boolean;
  /** `ac` vs `pl` (respects `higherIsBetter`). */
  variance: Variance | null;
  /** Running cumulative level entering this period (value units). */
  from: number;
  /** Running cumulative level leaving this period (`from + (ac − pl)`). */
  to: number;
}

export interface ColumnVarianceLayout {
  cells: ColumnVarianceCell[];
  higherIsBetter: boolean;
  /** Most negative point across every column/segment/bridge level (≤ 0). */
  domainMin: number;
  /** Most positive point across every column/segment/bridge level (≥ 0). */
  domainMax: number;
  /** Largest in-scale |Δ%| as a fraction - half-scale of the percent tier. */
  pctMax: number;
  /** A |Δ%| at or beyond this fraction is drawn off-scale (arrow tip). */
  pctClamp: number;
  /** Bridge anchor on the left: the sum of the period plans (ΣPL). */
  bridgeStart: number;
  /** Bridge anchor on the right: the sum of the period actuals (ΣAC). */
  bridgeEnd: number;
  /** The grand variance ΣAC − ΣPL (impact-coloured, the circled total). */
  total: Variance;
  /** Set-apart reference columns on the left, passed through (sanitised). */
  priors: PriorTotalInput[];
  /** The resolved set-apart end total on the right, when supplied. */
  end?: ResolvedEndTotal;
}

export interface ComputeColumnVarianceOptions {
  /** Whether a higher value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /** Off-scale threshold for the percent tier, as a fraction. Default 1 (=100%). */
  pctClamp?: number;
  /** Set-apart reference columns on the left (e.g. PY & PL year totals). */
  priorTotals?: PriorTotalInput[];
  /** Set-apart stacked total column on the right (AC+FC). */
  endTotal?: EndTotalInput;
}

/**
 * Pure layout for the **ColumnVarianceWaterfallChart** (IBCS C05).
 *
 * The middle tier is a value-unit BRIDGE: it starts at ΣPL (the left anchor),
 * adds each period's absolute variance `ac − pl`, and lands exactly on ΣAC
 * (the right anchor) - so the running path is self-closing regardless of the
 * caller-supplied set-apart columns. Because the bridge, the grouped columns,
 * and the start/end total columns are all expressed in the SAME value units,
 * the renderer can map every one of them through a single value→pixel scale
 * (`domainMin`…`domainMax`, always including 0) and they stay comparable.
 *
 * Off-scale percents (|Δ%| ≥ `pctClamp`, e.g. when a plan is near 0) are
 * excluded from `pctMax` so one runaway period can't flatten the pin tier; the
 * renderer pins them to the edge with an arrow. Framework agnostic - the React
 * component is just a renderer over this. SSR-safe and NaN-hardened: non-finite
 * inputs are MISSING (they contribute 0 and never widen the domain), and an
 * all-negative bridge keeps `domainMax === 0` instead of reserving an unused
 * positive half.
 */
export function computeColumnVarianceWaterfall(
  data: ColumnVarianceDatum[],
  opts: ComputeColumnVarianceOptions = {},
): ColumnVarianceLayout {
  const higherIsBetter = opts.higherIsBetter ?? true;
  const pctClamp = opts.pctClamp != null && opts.pctClamp > 0 ? opts.pctClamp : 1;

  let domainMin = 0;
  let domainMax = 0;
  let pctMax = 0;
  const track = (...vals: number[]) => {
    for (const v of vals) {
      if (!isFiniteNumber(v)) continue;
      domainMin = Math.min(domainMin, v);
      domainMax = Math.max(domainMax, v);
    }
  };

  // Left anchor: the sum of the period plans. Adding every Δ(ac−pl) walks the
  // bridge to ΣAC exactly, so the path always closes.
  let bridgeStart = 0;
  for (const d of data) bridgeStart += finiteOr(d.pl);
  track(bridgeStart);

  let cum = bridgeStart;
  const cells: ColumnVarianceCell[] = data.map((d) => {
    const ac = finiteOr(d.ac);
    const pl = finiteOr(d.pl);
    const variance = computeVariance(ac, pl, higherIsBetter);
    const from = cum;
    cum = from + (variance ? variance.abs : ac - pl);
    const to = cum;
    track(ac, pl, from, to);
    if (variance && isFiniteNumber(variance.pct) && Math.abs(variance.pct) < pctClamp) {
      pctMax = Math.max(pctMax, Math.abs(variance.pct));
    }
    return { category: d.category, ac, pl, isForecast: !!d.isForecast, variance, from, to };
  });
  const bridgeEnd = cum;

  const priors: PriorTotalInput[] = (opts.priorTotals ?? []).map((p) => {
    const value = finiteOr(p.value);
    track(value);
    return { label: p.label, value, scenario: p.scenario };
  });

  let end: ResolvedEndTotal | undefined;
  if (opts.endTotal && opts.endTotal.segments.length) {
    let c = 0;
    const segments: EndSegment[] = opts.endTotal.segments.map((s) => {
      const value = finiteOr(s.value);
      const y0 = c;
      c += value;
      const y1 = c;
      track(y0, y1);
      return { label: s.label, value, forecast: s.forecast, y0, y1 };
    });
    end = { label: opts.endTotal.label, total: c, segments };
  }

  const total: Variance = computeVariance(bridgeEnd, bridgeStart, higherIsBetter) ?? {
    abs: bridgeEnd - bridgeStart,
    pct: null,
    favorable: higherIsBetter ? bridgeEnd >= bridgeStart : bridgeEnd <= bridgeStart,
  };

  return {
    cells,
    higherIsBetter,
    ...normalizeDomain(domainMin, domainMax),
    pctMax: pctMax || pctClamp,
    pctClamp,
    bridgeStart,
    bridgeEnd,
    total,
    priors,
    end,
  };
}
