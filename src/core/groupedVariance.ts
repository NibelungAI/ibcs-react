import { finiteOr, isFiniteNumber, normalizeDomain } from "./domain";
import type { Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * One category in a grouped variance chart: a single actual (`AC`) drawn next
 * to ONE comparison value (`comparisonValue`) as two ADJACENT bars - the
 * classic IBCS grouped column/bar (templates C03 / C04). The comparison's IBCS
 * notation (PY solid grey, PL hollow frame, FC hatched) is chosen by the chart,
 * not stored here. `isForecast` renders the actual as an expected (hatched) bar.
 */
export interface GroupedDatum {
  /** Category label: "North", "Q1", "Revenue", … */
  category: string;
  /** Actual value (or the expected value on a forecast row). May be negative. */
  AC: number;
  /** The single comparison value AC is grouped against (PY, PL or FC). */
  comparisonValue: number;
  /** Render this category's actual as forecast (hatched bar / outlined pin). */
  isForecast?: boolean;
}

/** Which scenario the comparison bar represents - drives its IBCS notation + headers. */
export type GroupedComparison = "PY" | "PL" | "FC";

/** One category enriched with its AC-vs-comparison variance. */
export interface GroupedCell {
  category: string;
  /** The actual, sanitized: a missing / non-finite input reads as 0 (no bar). */
  AC: number;
  /** The comparison value, if finite. */
  comparisonValue: number | undefined;
  isForecast: boolean;
  /** `AC` vs `comparisonValue` (respects `higherIsBetter`). */
  variance: Variance | null;
}

export interface ComputeGroupedOptions {
  /** Scenario the comparison bar represents. Default "PL". */
  comparison?: GroupedComparison;
  /** Whether a higher value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /** Off-scale threshold for the percent tier, as a fraction. Default 1 (=100%). */
  pctClamp?: number;
}

export interface GroupedLayout {
  cells: GroupedCell[];
  /** Scenario the comparison bar represents. */
  comparison: GroupedComparison;
  higherIsBetter: boolean;
  /** Most negative value across AC + comparison (≤ 0) - the value-axis floor. */
  domainMin: number;
  /** Most positive value across AC + comparison (≥ 0) - the value-axis ceiling. */
  domainMax: number;
  /** Largest |Δ| - the half-scale of the absolute variance tier. */
  absMax: number;
  /** Largest in-scale |Δ%| as a fraction - the half-scale of the percent tier. */
  pctMax: number;
  /** A |Δ%| at or beyond this fraction is drawn off-scale (arrow tip). */
  pctClamp: number;
}

/**
 * Pure layout for the grouped variance chart: the per-category AC-vs-comparison
 * variance, the shared value domain for the grouped-bar tier (always including
 * 0 so negatives map inside the plot, never off-canvas), and the half-scales
 * for the absolute and percent variance tiers.
 *
 * Off-scale percents (|Δ%| ≥ `pctClamp`, e.g. when the comparison is near 0)
 * are excluded from `pctMax` so one runaway category can't flatten the tier;
 * the renderer pins them to the tier edge with an arrow. `absMax` and `pctMax`
 * are floored at a positive value, and the value domain is repaired to a
 * non-empty extent, so a renderer never divides by zero on empty / all-zero
 * data (all-negative data keeps `domainMax === 0`). Framework agnostic - the
 * React `GroupedVarianceChart` (orientation "column" = C03 / "bar" = C04) is
 * just a renderer over this.
 */
export function computeGroupedVariance(
  data: GroupedDatum[],
  opts: ComputeGroupedOptions = {},
): GroupedLayout {
  const comparison = opts.comparison ?? "PL";
  const higherIsBetter = opts.higherIsBetter ?? true;
  const pctClamp = opts.pctClamp != null && opts.pctClamp > 0 ? opts.pctClamp : 1;

  let domainMin = 0;
  let domainMax = 0;
  let absMax = 0;
  let pctMax = 0;

  const cells: GroupedCell[] = data.map((d) => {
    // Missing (absent OR non-finite) values never widen the domain, never
    // accumulate and never produce a variance - see ./domain.
    const ac = isFiniteNumber(d.AC) ? d.AC : undefined;
    const cmp = isFiniteNumber(d.comparisonValue) ? d.comparisonValue : undefined;
    for (const v of [ac, cmp]) {
      if (v != null) {
        domainMin = Math.min(domainMin, v);
        domainMax = Math.max(domainMax, v);
      }
    }
    const variance = computeVariance(ac, cmp, higherIsBetter);
    if (variance) {
      absMax = Math.max(absMax, Math.abs(variance.abs));
      if (isFiniteNumber(variance.pct) && Math.abs(variance.pct) < pctClamp) {
        pctMax = Math.max(pctMax, Math.abs(variance.pct));
      }
    }
    return {
      category: d.category,
      AC: finiteOr(ac),
      comparisonValue: cmp,
      isForecast: !!d.isForecast,
      variance,
    };
  });

  return {
    cells,
    comparison,
    higherIsBetter,
    ...normalizeDomain(domainMin, domainMax),
    absMax: absMax || 1,
    pctMax: pctMax || pctClamp,
    pctClamp,
  };
}
