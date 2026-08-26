/**
 * Row windowing for large statements (consolidations, transaction drill-down).
 *
 * Pure geometry: given the scroll offset and a fixed row height, work out which
 * row indices are inside the viewport (plus an overscan margin) and how much
 * blank space to reserve above and below so the scrollbar stays the right size.
 * Framework-agnostic — `StatementTable` feeds it scroll state and renders only
 * the returned slice between two spacer rows.
 */

import { finiteOr } from "./domain";

export interface WindowOptions {
  /** Current scrollTop of the viewport, in px. */
  scrollTop: number;
  /** Visible height of the viewport, in px. */
  viewportHeight: number;
  /** Fixed height of every row, in px. */
  rowHeight: number;
  /** Total number of rows. */
  count: number;
  /** Extra rows to render above and below the viewport. Default 6. */
  overscan?: number;
}

export interface WindowRange {
  /** First row index to render (inclusive). */
  start: number;
  /** One past the last row index to render (exclusive). */
  end: number;
  /** Blank space to reserve above the rendered slice, in px. */
  padTop: number;
  /** Blank space to reserve below the rendered slice, in px. */
  padBottom: number;
}

/**
 * Compute the visible row window for a fixed-row-height list. Returns the slice
 * to render and the top/bottom spacer heights. Clamps to `[0, count]`, so it is
 * safe at the ends and when the content is shorter than the viewport.
 *
 * The window is derived from the viewport's pixel BOUNDS, not from a row count:
 * `end` covers every row the bottom edge touches. Deriving it as
 * `first + ceil(viewportHeight / rowHeight)` dropped the partially-scrolled
 * trailing row whenever `overscan` was 0 (rowHeight 30, viewport 90,
 * scrollTop 15 rendered rows 0..2 and left a 15px blank strip).
 *
 * Non-finite scroll state (a NaN `scrollTop` from a detached element, an
 * unmeasured `viewportHeight`) is coerced to 0 rather than propagated into the
 * indices.
 */
export function computeWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  count,
  overscan = 6,
}: WindowOptions): WindowRange {
  const top = Math.max(0, finiteOr(scrollTop));
  const height = Math.max(0, finiteOr(viewportHeight));
  if (count <= 0 || !(rowHeight > 0) || height <= 0) {
    return { start: 0, end: count > 0 ? count : 0, padTop: 0, padBottom: 0 };
  }
  const first = Math.floor(top / rowHeight);
  // Clamp to [0, count] so an out-of-range scrollTop can't produce start > count
  // (which would over-reserve padTop). end is always >= start.
  const start = Math.min(Math.max(0, first - overscan), count);
  const end = Math.min(count, Math.max(Math.ceil((top + height) / rowHeight) + overscan, start));
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
  };
}
