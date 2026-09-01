/**
 * Pure layout for IBCS stacked charts (templates C01 / C02).
 *
 * C01 - stacked COLUMNS over time: each period is a column whose series stack
 * vertically from a zero baseline; the period TOTAL is printed above.
 * C02 - stacked BARS over a structure: each category is a horizontal bar whose
 * series stack left-to-right from a zero baseline; the total sits to the right.
 *
 * This module is framework-agnostic and JSON-serializable - no React, no DOM,
 * no colors. The React `StackedChart` is just a renderer over this layout.
 * Series identity/order is defined by the caller-supplied `series` list; each
 * datum carries its values keyed by series key.
 */

import { finiteOr, normalizeDomain } from "./domain";

/** One category (a period in C01, a structure item in C02). */
export interface StackedDatum {
  /** Axis label: "Jan", "Q1", "EMEA", … */
  category: string;
  /** Series value by series key. Missing keys are treated as 0. */
  values: Record<string, number>;
}

/** A series declaration: its data key, its display label, and an optional color. */
export interface StackedSeries {
  /** Key into {@link StackedDatum.values}. */
  key: string;
  /** Human label used for the integrated series annotation. */
  label: string;
  /** Optional explicit color; otherwise the renderer assigns one from a ramp. */
  color?: string;
}

/** One stacked piece within a column/bar, positioned in value units from zero. */
export interface StackedSegment {
  seriesKey: string;
  value: number;
  /**
   * Offset where the segment begins, in value units relative to the zero
   * baseline. For positive values this is the lower edge; for negative values
   * it is the upper (closer-to-zero) edge.
   */
  start: number;
  /** Offset where the segment ends (`start + value`). */
  end: number;
}

/** A fully resolved column (C01) / bar (C02). */
export interface StackedColumn {
  category: string;
  /** Segments in series order; zero-valued series are omitted. */
  segments: StackedSegment[];
  /** Sum of all series values (signed). */
  total: number;
  /** Sum of the positive series values (top of the upward stack). */
  positiveTotal: number;
  /** Sum of the negative series values (bottom of the downward stack, ≤ 0). */
  negativeTotal: number;
}

export interface StackedLayout {
  columns: StackedColumn[];
  /** The series, in stack order, echoed back for the renderer. */
  series: StackedSeries[];
  /** Most negative stack extent across all columns (≤ 0) - the lower domain. */
  domainMin: number;
  /** Most positive stack extent across all columns (≥ 0) - the upper domain. */
  domainMax: number;
}

export interface ComputeStackedOptions {
  /** Series declarations defining stack order and identity. Required. */
  series: StackedSeries[];
}

/**
 * Compute the stacked layout: for each category, resolve per-series segments by
 * stacking values up from a zero baseline (positives upward, negatives below),
 * the running cumulative offsets, the category total, and the shared value
 * domain. The same layout drives both the vertical (C01) and horizontal (C02)
 * renderers - orientation is purely a rendering concern.
 *
 * Per ISO 24896 the baseline is always zero. Negative contributions stack
 * downward from zero (kept distinct from the positive stack) so a column with
 * mixed signs still reads against a single zero line. A missing / non-finite
 * series value contributes nothing (it is skipped BEFORE the sign test, so it
 * can never NaN the downward stack), and an all-negative chart keeps
 * `domainMax === 0` instead of padding the plot with an unused positive half.
 */
export function computeStacked(data: StackedDatum[], opts: ComputeStackedOptions): StackedLayout {
  const series = opts.series;

  let domainMin = 0;
  let domainMax = 0;

  const columns: StackedColumn[] = data.map((d) => {
    let posCum = 0;
    let negCum = 0;
    const segments: StackedSegment[] = [];

    for (const s of series) {
      // Sanitize first: NaN is neither > 0 nor === 0, so an unguarded value
      // would slip into the negative branch and poison `negCum` for good.
      const v = finiteOr(d.values[s.key]);
      if (v === 0) continue;
      if (v > 0) {
        const start = posCum;
        posCum += v;
        segments.push({ seriesKey: s.key, value: v, start, end: posCum });
      } else {
        const end = negCum;
        negCum += v; // v < 0, so negCum moves down
        segments.push({ seriesKey: s.key, value: v, start: negCum, end });
      }
    }

    domainMax = Math.max(domainMax, posCum);
    domainMin = Math.min(domainMin, negCum);

    return {
      category: d.category,
      segments,
      total: posCum + negCum,
      positiveTotal: posCum,
      negativeTotal: negCum,
    };
  });

  return {
    columns,
    series,
    ...normalizeDomain(domainMin, domainMax),
  };
}
