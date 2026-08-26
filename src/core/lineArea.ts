import { isFiniteNumber, normalizeDomain } from "./domain";
import { SCENARIO_KEYS, type ScenarioDatum, type ScenarioKey, type Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * One period in a line/area series. Same family as {@link TrendDatum}: a period
 * carries up to four scenario values. Unlike the trend column chart, the line
 * and area charts draw every present scenario as a continuous connector, so a
 * datum needs no `current`/`summary` notion — it is just a labelled point that
 * may exist in one or more scenarios. Structurally the canonical
 * {@link ScenarioDatum}, whose `category` is the period label here ("Jan",
 * "Q1", "2024", …).
 */
export type LineDatum = ScenarioDatum;

/** A single drawn point: its period index, label, and value. */
export interface LinePoint {
  /** Index of the period in the input array (drives the x position). */
  index: number;
  category: string;
  value: number;
}

/** One scenario rendered as a connected line: its present points + end anchor. */
export interface LineSeries {
  scenario: ScenarioKey;
  /** Present points in period order; missing periods are simply omitted. */
  points: LinePoint[];
  /** Last present point — the anchor for the integrated end label. */
  endPoint: LinePoint | null;
}

/**
 * A series' points partitioned at a forecast boundary (IBCS template C07): the
 * measured run drawn solid, and the forecast tail drawn dashed/hollow.
 */
export interface ForecastSplit {
  /** Points strictly before `forecastFrom` — the measured / actual run. */
  solid: LinePoint[];
  /**
   * Points at/after `forecastFrom`, the forecast tail. When both parts are
   * non-empty the last solid point is prepended so the dashed tail visually
   * connects to the actuals (it must be skipped when drawing hollow markers).
   */
  forecast: LinePoint[];
  /** True when `forecast`'s first element is the bridging last-solid point. */
  bridged: boolean;
}

/**
 * Split a series' present points at the forecast boundary `forecastFrom` (an
 * input period index): everything before it is actual (drawn solid), everything
 * at/after it is forecast (drawn dashed with hollow markers). Pure & SSR-safe;
 * tolerant of an absent/non-finite boundary (then everything is `solid`).
 *
 * Gaps are respected by index, so a boundary that lands in a missing period
 * still partitions correctly. When both sides have points the last actual point
 * is duplicated into `forecast` (`bridged: true`) so the connecting segment is
 * itself dashed — the transition into the future reads as forecast.
 */
export function splitForecast(points: LinePoint[], forecastFrom?: number): ForecastSplit {
  if (!isFiniteNumber(forecastFrom)) {
    return { solid: points, forecast: [], bridged: false };
  }
  const solid: LinePoint[] = [];
  const forecast: LinePoint[] = [];
  for (const p of points) {
    if (p.index < forecastFrom) solid.push(p);
    else forecast.push(p);
  }
  let bridged = false;
  const lastSolid = solid[solid.length - 1];
  if (lastSolid && forecast.length) {
    forecast.unshift(lastSolid);
    bridged = true;
  }
  return { solid, forecast, bridged };
}

/** A computed variance at one period (current series vs the comparison). */
export interface VariancePoint {
  index: number;
  category: string;
  variance: Variance;
}

export interface LinesLayout {
  /** Period labels in order (length = input length). */
  categories: string[];
  /** Per-scenario lines, in the requested/draw order. */
  series: LineSeries[];
  /** Most negative point across all drawn scenarios (≤ 0). */
  domainMin: number;
  /** Most positive point across all drawn scenarios (≥ 0). */
  domainMax: number;
  /** Current-series (AC, else FC) variance vs comparison, when computable. */
  variance: VariancePoint[];
  /** Largest |variance| in the active mode — the variance-panel half-scale. */
  varMax: number;
  comparison: ScenarioKey;
  varianceMode: "abs" | "pct";
}

export interface ComputeLinesOptions {
  /** Scenarios to draw, in order. Default: those present anywhere in the data. */
  series?: ScenarioKey[];
  /** Reference scenario the current series is compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Absolute delta or percent change for the variance series. Default "abs". */
  varianceMode?: "abs" | "pct";
  /** Whether a higher value is good (set false for cost series). Default true. */
  higherIsBetter?: boolean;
}

/**
 * Pure line/area layout: resolve each requested scenario into its present
 * points, the shared value domain (always including 0 so the zero baseline sits
 * inside the plot), and an optional current-vs-comparison variance series.
 * Framework agnostic — the React `LineChart` / `AreaChart` are renderers over
 * this. Sibling of {@link computeTrend} for dense, multi-series line data.
 *
 * A non-finite value is MISSING, exactly like an absent one: the period is
 * simply omitted from its series (the line breaks there), it never widens the
 * domain and it never yields a variance. An all-negative series therefore keeps
 * `domainMax === 0` instead of reserving half the plot for nothing.
 */
export function computeLines(data: LineDatum[], opts: ComputeLinesOptions = {}): LinesLayout {
  const comparison = opts.comparison ?? "PY";
  const varianceMode = opts.varianceMode ?? "abs";
  const higherIsBetter = opts.higherIsBetter ?? true;

  // Default to whichever scenarios actually appear, preserving canonical order.
  const present = SCENARIO_KEYS.filter((s) => data.some((d) => isFiniteNumber(d[s])));
  const scenarios = opts.series && opts.series.length ? opts.series : present;

  const categories = data.map((d) => d.category);

  // Domain always brackets 0 so positive-only and negative-only series both
  // keep the zero baseline visible (mirrors computeTrend / computeWaterfall).
  let domainMin = 0;
  let domainMax = 0;

  const series: LineSeries[] = scenarios.map((scenario) => {
    const points: LinePoint[] = [];
    for (const [i, d] of data.entries()) {
      const v = d[scenario];
      if (isFiniteNumber(v)) {
        domainMin = Math.min(domainMin, v);
        domainMax = Math.max(domainMax, v);
        points.push({ index: i, category: d.category, value: v });
      }
    }
    return { scenario, points, endPoint: points[points.length - 1] ?? null };
  });

  // Variance of the current series (AC, else FC) against the comparison.
  let varMax = 0;
  const variance: VariancePoint[] = [];
  for (const [i, d] of data.entries()) {
    const current = isFiniteNumber(d.AC) ? d.AC : isFiniteNumber(d.FC) ? d.FC : undefined;
    const cmp = d[comparison];
    const base = isFiniteNumber(cmp) ? cmp : undefined;
    const v =
      current != null && base != null ? computeVariance(current, base, higherIsBetter) : null;
    if (v) {
      const mag = Math.abs(varianceMode === "pct" ? (v.pct ?? 0) : v.abs);
      if (isFiniteNumber(mag)) varMax = Math.max(varMax, mag);
      variance.push({ index: i, category: d.category, variance: v });
    }
  }

  return {
    categories,
    series,
    ...normalizeDomain(domainMin, domainMax),
    variance,
    varMax: varMax || 1,
    comparison,
    varianceMode,
  };
}
