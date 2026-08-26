import { isFiniteNumber, normalizeDomain } from "./domain";
import type { ScenarioDatum, ScenarioKey, Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * One period in a trend series. A period carries up to four scenario values.
 * The "current" series is the actual (`AC`) when present, otherwise the
 * forecast (`FC`) — so a 13-period year naturally splits into actual months
 * followed by forecast months. `PY`/`PL` ride along as reference overlays.
 */
export interface TrendDatum extends ScenarioDatum {
  /** Period label: "Jan", "Feb", … or a total like "FY". */
  category: string;
  /**
   * Render this period as a visually separated summary (e.g. a full-year
   * total): a small gap + a divider + the emphasis color, set off from the
   * running months to its left.
   */
  summary?: boolean;
}

/**
 * A period enriched with its resolved current value and AC-vs-comparison
 * variance. Scenario values are echoed back SANITIZED: a non-finite input is
 * missing data, so it reads as `undefined` here (and is simply not drawn).
 */
export interface TrendCell extends TrendDatum {
  /** The drawn column value: `AC` when present, else `FC`. */
  current: number | undefined;
  /** True when this period has no actual and is carried by forecast. */
  isForecast: boolean;
  /** `current` vs the comparison scenario (respects `higherIsBetter`). */
  variance: Variance | null;
}

export interface TrendLayout {
  cells: TrendCell[];
  /** Most negative point across all scenarios (≤ 0). Maps to the bottom region. */
  domainMin: number;
  /** Most positive point across all scenarios (≥ 0). Maps to the top. */
  domainMax: number;
  /** Largest |variance| in the active mode — the variance-panel half-scale. */
  varMax: number;
  comparison: ScenarioKey;
  varianceMode: "abs" | "pct";
}

export interface ComputeTrendOptions {
  /** Reference scenario the current series is compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Absolute delta or percent change for the variance panel. Default "abs". */
  varianceMode?: "abs" | "pct";
  /** Whether a higher value is good (set false for cost series). Default true. */
  higherIsBetter?: boolean;
}

/**
 * Pure trend layout: resolve each period's current value, its variance against
 * the comparison scenario, and the shared value/variance domains. Framework
 * agnostic — the React `TrendChart` is just a renderer over this.
 *
 * The value domain always includes 0 so the zero baseline sits inside the
 * plot even for an all-positive series, mirroring {@link computeWaterfall}; an
 * all-negative series keeps `domainMax === 0` rather than padding the plot with
 * an unused positive half. Non-finite scenario values are treated as MISSING:
 * they never widen the domain and never produce a variance.
 */
export function computeTrend(data: TrendDatum[], opts: ComputeTrendOptions = {}): TrendLayout {
  const comparison = opts.comparison ?? "PY";
  const varianceMode = opts.varianceMode ?? "abs";
  const higherIsBetter = opts.higherIsBetter ?? true;

  let domainMin = 0;
  let domainMax = 0;
  let varMax = 0;

  const cells: TrendCell[] = data.map((d) => {
    // Missing (absent OR non-finite) scenario values are dropped up front, so
    // neither the domain, the current series nor the variance can see a NaN.
    const AC = isFiniteNumber(d.AC) ? d.AC : undefined;
    const PY = isFiniteNumber(d.PY) ? d.PY : undefined;
    const PL = isFiniteNumber(d.PL) ? d.PL : undefined;
    const FC = isFiniteNumber(d.FC) ? d.FC : undefined;
    const current = AC ?? FC;
    const base = { AC, PY, PL, FC }[comparison];

    for (const v of [AC, PY, PL, FC]) {
      if (v != null) {
        domainMin = Math.min(domainMin, v);
        domainMax = Math.max(domainMax, v);
      }
    }

    const variance =
      current != null && base != null ? computeVariance(current, base, higherIsBetter) : null;
    if (variance) {
      const mag = Math.abs(varianceMode === "pct" ? (variance.pct ?? 0) : variance.abs);
      if (isFiniteNumber(mag)) varMax = Math.max(varMax, mag);
    }

    return { ...d, AC, PY, PL, FC, current, isForecast: AC == null && FC != null, variance };
  });

  return {
    cells,
    ...normalizeDomain(domainMin, domainMax),
    varMax: varMax || 1,
    comparison,
    varianceMode,
  };
}
