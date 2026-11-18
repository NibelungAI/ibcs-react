/**
 * Range bars - for each category, a range of values and a mark inside it,
 * the data behind `RangeBarChart`: the 10th to the 90th percentile of a
 * variant's fights with their mean (J.P. Morgan's Guide to the Markets draws
 * its manager dispersion this way, p. 67), or a simulation's estimate ± its
 * half-width after each wave, narrowing as the waves come in (the floating
 * ranges of GTM p. 60).
 *
 * The chart draws the ends and the mark it is given: which percentiles, which
 * interval and which mean they are is the caller's to compute and to name.
 *
 * Pure data, like the rest of `core/`: no React, no DOM, no clock, no
 * randomness. SSR-safe.
 */

import type { RowIcon } from "./rowIcon";

/** One category's range: two ends and, optionally, a value marked across it. */
export interface RangeDatum {
  /** The category's name: a variant, a wave. */
  label: string;
  /** One end of the range - e.g. the 10th percentile, or estimate − half-width. */
  from: number;
  /** The other end - e.g. the 90th percentile (order does not matter). */
  to: number;
  /** A value marked across the bar - the mean, a median, the estimate. */
  mark?: number;
  /**
   * A small picture before the label (bar orientation) - an item icon - or
   * several, as chips. Drawn at the chart's `iconSize`, never above
   * `naturalSize / pixelRatio` CSS px; an icon's `alt` joins the label in the
   * screen-reader table. See {@link RowIcon}.
   */
  icon?: RowIcon | readonly RowIcon[];
  /**
   * The label's colour - e.g. an item's quality colour. Default the theme's
   * text colour. It is data, not themed: pick one that keeps its contrast on
   * every surface you use.
   */
  labelColor?: string;
}

/** A category as the chart draws it. */
export interface RangeRow {
  /** Its position, from 0, in the order given. */
  index: number;
  label: string;
  /** The lower end, or NaN when the two ends are not both finite (no bar is drawn). */
  low: number;
  /** The upper end (NaN as `low`). */
  high: number;
  /** The marked value, or null when none is given or it is not finite. */
  mark: number | null;
  /** The datum as given. */
  source: RangeDatum;
}

/** The categories in order, and the value extent of everything drawn. */
export interface RangeBarLayout {
  rows: RangeRow[];
  /** The smallest end or mark of a drawable row (0 when there is none). */
  min: number;
  /** The largest (1 when there is none; equal to `min` when every value is the same). */
  max: number;
}

/**
 * Resolve range bars: each datum's ends put in order (`low` ≤ `high`), its
 * mark when finite, and the extent of all the drawable rows' ends and marks.
 * A datum whose ends are not both finite keeps its place and its label, with
 * NaN ends: the chart draws no bar for it and writes it as not available.
 * The rows keep the order given.
 */
export function computeRangeBars(data: readonly RangeDatum[]): RangeBarLayout {
  let min = Infinity;
  let max = -Infinity;
  const rows: RangeRow[] = (data ?? []).map((d, index) => {
    const ok = d != null && Number.isFinite(d.from) && Number.isFinite(d.to);
    const low = ok ? Math.min(d.from, d.to) : NaN;
    const high = ok ? Math.max(d.from, d.to) : NaN;
    const mark = ok && d.mark != null && Number.isFinite(d.mark) ? d.mark : null;
    if (ok) {
      for (const v of mark == null ? [low, high] : [low, high, mark]) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return { index, label: d?.label ?? "", low, high, mark, source: d };
  });
  return min <= max ? { rows, min, max } : { rows, min: 0, max: 1 };
}
