/**
 * Horizontal-bridge layout helpers.
 *
 * The bridge MATH is orientation-agnostic, so this module re-exports
 * {@link computeBridge} (and its types) unchanged — a horizontal waterfall is
 * the very same accumulation as the vertical one, only the renderer maps the
 * value axis to X and the categories to stacked rows instead of side-by-side
 * columns. The one horizontal-specific concern is splitting the plot height
 * into one band per category, which {@link rowBands} does as a pure helper.
 *
 * Keep this file thin: all the add/subtract/result/variance logic lives in
 * `./waterfall`; this is just the rotation-aware seam the React
 * `HorizontalWaterfallChart` builds on.
 */

export {
  computeBridge,
  type WaterfallDatum,
  type BridgeBar,
  type BridgeLayout,
  type ComputeBridgeOptions,
} from "./waterfall";

/** Geometry of one category row in a horizontal bridge (pixel space). */
export interface RowBand {
  /** Row index (0 = topmost). */
  index: number;
  /** Top edge of the row's band. */
  top: number;
  /** Vertical centre of the band (the bar's mid-line). */
  center: number;
  /** Bottom edge of the row's band. */
  bottom: number;
}

/** A horizontal bridge's row layout: the band size and each row's band. */
export interface RowBandLayout {
  /** Height of a single category band (`innerH / count`). */
  band: number;
  /** One {@link RowBand} per category, top-to-bottom. */
  bands: RowBand[];
}

/**
 * Split a plot height into `count` equal category bands stacked top-to-bottom —
 * the horizontal analogue of the vertical bridge's per-column `band` width.
 * Pure and SSR-safe; degenerate inputs (`count <= 0`) yield a single full-height
 * band so callers never divide by zero or read an empty array.
 *
 * @param count  number of categories (rows)
 * @param top    Y of the first band's top edge (the plot's top inset)
 * @param innerH total height available for all rows
 */
export function rowBands(count: number, top: number, innerH: number): RowBandLayout {
  const n = Math.max(count, 1);
  const band = innerH / n;
  const bands: RowBand[] = [];
  for (let i = 0; i < n; i++) {
    const t = top + band * i;
    bands.push({ index: i, top: t, center: t + band / 2, bottom: t + band });
  }
  return { band, bands };
}
