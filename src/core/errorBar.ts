/**
 * Error bars - a value ± the half-width of its interval, drawn as a whisker
 * with a cap at each end.
 *
 * Pure geometry, like the rest of `core/`: a renderer hands in the value→pixel
 * scale its own bar or point already uses and gets back line segments, so the
 * whisker always lands on the same axis as the mark it belongs to. Any
 * monotonic scale works - a linear one, a magnitude scale that starts at a
 * left axis, or a two-sided pin axis whose sides have different lengths.
 *
 * Orientation follows the value axis: "horizontal" for a value axis running
 * left to right (horizontal bars, ranking rows, table cells), "vertical" for
 * one running bottom to top (columns, points of a line).
 *
 * SSR-safe: no DOM, no clock, no randomness.
 */

/** Which way the value axis runs. */
export type ErrorBarOrientation = "horizontal" | "vertical";

/** An interval in value units: `low` = value − half-width, `high` = value + half-width. */
export interface ErrorBarExtent {
  low: number;
  high: number;
}

/**
 * The interval `value ± halfWidth`, or null when either number is not finite
 * or the half-width is negative. A zero half-width is a valid, zero-width
 * interval (the value is exact).
 */
export function errorBarExtent(value: number, halfWidth: number): ErrorBarExtent | null {
  if (!Number.isFinite(value) || !Number.isFinite(halfWidth) || halfWidth < 0) return null;
  return { low: value - halfWidth, high: value + halfWidth };
}

/** One straight segment, in pixels. */
export interface ErrorBarSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A laid-out error bar, in pixels. */
export interface ErrorBarGeometry {
  orientation: ErrorBarOrientation;
  /** The whisker, from the low end to the high end of the interval. */
  whisker: ErrorBarSegment;
  /**
   * A cap across each end that lies inside the clip range. An end cut by the
   * range has none: an open end says the interval goes on past the edge.
   */
  caps: ErrorBarSegment[];
  /** The low end (value − half-width) lay outside the clip range and was cut at its edge. */
  lowClipped: boolean;
  /** The high end (value + half-width) lay outside the clip range and was cut at its edge. */
  highClipped: boolean;
}

/** How to place an error bar against a mark. */
export interface ErrorBarLayoutOptions {
  /** Which way the value axis runs. Default "horizontal". */
  orientation?: ErrorBarOrientation;
  /** Value → pixel along the value axis: the scale of the bar or point the error bar belongs to. */
  scale: (value: number) => number;
  /** Pixel position across the value axis: the centre line of that bar or point. */
  cross: number;
  /** Length of each cap in pixels, centred on the whisker. Default 6; 0 draws no caps. */
  capSize?: number;
  /** Pixel range `[a, b]` (any order) along the value axis the whisker must stay inside. */
  clip?: readonly [number, number];
}

/**
 * Lay out one error bar. Returns null when there is nothing to draw: invalid
 * input (see {@link errorBarExtent}), a zero half-width (an exact value has no
 * whisker), a scale or cross position that is not finite, an interval that
 * lies wholly outside `clip`, or a whisker of zero pixel length (a scale that
 * collapses the interval - e.g. a chart's grow-in animation at its first
 * frame - so no lone cap is left standing on the baseline).
 */
export function computeErrorBar(
  value: number,
  halfWidth: number,
  options: ErrorBarLayoutOptions,
): ErrorBarGeometry | null {
  const extent = errorBarExtent(value, halfWidth);
  if (!extent || halfWidth === 0) return null;
  const { orientation = "horizontal", scale, cross, capSize = 6, clip } = options;
  if (!Number.isFinite(cross)) return null;

  let low = scale(extent.low);
  let high = scale(extent.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low === high) return null;

  let lowClipped = false;
  let highClipped = false;
  if (clip) {
    const min = Math.min(clip[0], clip[1]);
    const max = Math.max(clip[0], clip[1]);
    if ((low < min && high < min) || (low > max && high > max)) return null;
    if (low < min || low > max) {
      low = Math.min(max, Math.max(min, low));
      lowClipped = true;
    }
    if (high < min || high > max) {
      high = Math.min(max, Math.max(min, high));
      highClipped = true;
    }
  }

  const half = Math.max(0, capSize) / 2;
  const along = (a: number, b: number): ErrorBarSegment =>
    orientation === "horizontal"
      ? { x1: a, y1: cross, x2: b, y2: cross }
      : { x1: cross, y1: a, x2: cross, y2: b };
  const capAt = (p: number): ErrorBarSegment =>
    orientation === "horizontal"
      ? { x1: p, y1: cross - half, x2: p, y2: cross + half }
      : { x1: cross - half, y1: p, x2: cross + half, y2: p };

  const caps: ErrorBarSegment[] = [];
  if (half > 0) {
    if (!lowClipped) caps.push(capAt(low));
    if (!highClipped) caps.push(capAt(high));
  }
  return { orientation, whisker: along(low, high), caps, lowClipped, highClipped };
}

/**
 * A half-width as the library accepts it: a finite number ≥ 0, else
 * undefined (no interval). Internal plumbing shared by the renderers.
 */
export function halfWidthOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
