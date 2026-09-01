/**
 * Categorical band scale - the horizontal placement of bars/columns/markers
 * across N categories, with explicit control over the gap between bands and the
 * lead-in/out gutter at the chart edges.
 *
 * This is the mechanism behind a chart's "fill" behaviour: by default a column
 * chart centres each bar in its band and leaves a half-band gutter on the left
 * and right (the classic look). Setting the *outer* padding to `0` trims those
 * gutters so the first and last bars sit flush against the plot edges - the
 * chart fills its box edge-to-edge with no dead whitespace.
 *
 * Follows the same maths as D3's `scaleBand`, so it is predictable and matches
 * what people expect from "padding inner / padding outer".
 */

/**
 * Band padding. A single number sets both the inner gap and the outer gutter; an
 * object controls them independently. All values are fractions of one *step*
 * (the centre-to-centre distance between adjacent bands), in `[0, 1)` for
 * `inner` and `[0, ∞)` for `outer`.
 *
 * - `inner` - gap between adjacent bands (higher → thinner bars / more air).
 * - `outer` - gutter before the first and after the last band. `0` makes the
 *   bars flush to the edges (fill); a larger value insets them.
 */
export type BandPadding = number | { inner?: number; outer?: number };

export interface BandScale {
  /** Centre-to-centre distance between adjacent bands. */
  step: number;
  /** Width available to a single band's content (the natural bar width). */
  bandwidth: number;
  /** Left edge of band `i` (absolute, includes `offset`). */
  start: (i: number) => number;
  /** Centre of band `i` (absolute, includes `offset`). */
  center: (i: number) => number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Build a {@link BandScale} across `count` bands spanning `width` pixels.
 *
 * @param width  the inner plot width the bands share.
 * @param count  number of categories (clamped to ≥1 so a single/empty series
 *               still produces finite coordinates).
 * @param padding {@link BandPadding}. Defaults to `{ inner: 0.2 }`, and when
 *               `outer` is omitted it mirrors `inner` (D3's convention), giving a
 *               balanced gutter. Pass `{ outer: 0 }` to trim the side whitespace.
 * @param offset added to every coordinate - pass the plot's left inset (`padL`)
 *               so `start`/`center` come back in absolute SVG units.
 */
export function bandScale(
  width: number,
  count: number,
  padding: BandPadding = {},
  offset = 0,
): BandScale {
  const p = typeof padding === "number" ? { inner: padding, outer: padding } : padding;
  const inner = clamp(p.inner ?? 0.2, 0, 1);
  const outer = Math.max(0, p.outer ?? inner);
  const n = Math.max(1, count);
  // D3 scaleBand: step solves n·step − inner·step + 2·outer·step = width.
  const step = width / Math.max(1e-6, n - inner + outer * 2);
  const bandwidth = step * (1 - inner);
  const start = (i: number) => offset + outer * step + i * step;
  const center = (i: number) => start(i) + bandwidth / 2;
  return { step, bandwidth, start, center };
}

/**
 * Resolve the `(inner, outer)` fractions that REPRODUCE a chart's historical
 * "centred bars with a half-band gutter" layout, given the bar-width ratio that
 * chart used (`bandwidth / step`). Charts call this to keep their default look
 * pixel-identical while still honouring a caller's `bandPadding` override.
 *
 * The legacy formula was `band = width / n`, `center(i) = i·band + band/2`,
 * `barWidth = band · ratio`. That is exactly `bandScale` with
 * `inner = 1 − ratio` and `outer = inner / 2`.
 */
export function legacyBandPadding(barWidthRatio: number): { inner: number; outer: number } {
  const inner = clamp(1 - barWidthRatio, 0, 1);
  return { inner, outer: inner / 2 };
}

/**
 * Fraction of the historical edge gutter kept by default. The old layout left a
 * half-band of dead space on each side; that reads as wasted whitespace, so the
 * default now keeps only a slice of it (a touch of breathing room, not a full
 * half-band) while the bar spacing is untouched. Callers can still set any
 * `outer` explicitly - `0` for flush-to-edge, the legacy value for the old look.
 */
const DEFAULT_GUTTER_SCALE = 0.4;

/**
 * Resolve a chart's effective `(inner, outer)` from a caller's {@link
 * BandPadding} over the chart's native bar-width ratio.
 *
 * - With **no override** the inter-bar spacing is the chart's historical value,
 *   but the edge gutter is trimmed to {@link DEFAULT_GUTTER_SCALE} of its old
 *   width - so every chart fills its box better out of the box, with no dead
 *   whitespace on the sides.
 * - A **bare number** sets both inner and outer.
 * - An **object** overrides only the keys it sets, so `{ outer: 0 }` makes the
 *   bars flush to the edges while keeping the chart's native bar width, and
 *   `{ outer: <legacy> }` restores the old centred look.
 */
export function resolveBandPadding(
  barWidthRatio: number,
  override?: BandPadding,
): { inner: number; outer: number } {
  const base = legacyBandPadding(barWidthRatio);
  if (override == null) return { inner: base.inner, outer: base.outer * DEFAULT_GUTTER_SCALE };
  if (typeof override === "number") return { inner: override, outer: override };
  return {
    inner: override.inner ?? base.inner,
    outer: override.outer ?? base.outer * DEFAULT_GUTTER_SCALE,
  };
}
