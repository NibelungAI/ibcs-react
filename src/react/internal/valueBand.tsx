import { resolveValueBand, type ValueBand } from "../../core/reference";
import type { IbcsTokens } from "../../core/tokens";

/**
 * Opacity of a value band's fill. A band sits beneath bars and their whiskers,
 * so it must read as a backdrop (the bars stay legible on it) yet stay visible
 * between table rows; the default fill is the impact-neutral axis colour.
 *
 * Internal module: not part of the public API surface.
 */
export const VALUE_BAND_OPACITY = 0.38;

/**
 * Draw value bands as rects spanning `y`..`y + height` across the value axis,
 * each clamped to `range` (zero-width bands are skipped). A band's label is
 * its tooltip (`<title>`); where a chart has room it also prints the label.
 */
export function ValueBandRects({
  bands,
  scale,
  range,
  y,
  height,
  tokens,
}: {
  bands: readonly ValueBand[] | undefined;
  scale: (value: number) => number;
  range: readonly [number, number];
  y: number;
  height: number;
  tokens: IbcsTokens;
}) {
  if (!bands || bands.length === 0) return null;
  return (
    <>
      {bands.map((band, i) => {
        const r = resolveValueBand(band, scale, range);
        if (!r || !(r.end - r.start > 0)) return null;
        return (
          <rect
            key={`band-${i}`}
            x={r.start}
            y={y}
            width={r.end - r.start}
            height={height}
            fill={r.color ?? tokens.color.axis}
            opacity={VALUE_BAND_OPACITY}
          >
            {r.label && <title>{r.label}</title>}
          </rect>
        );
      })}
    </>
  );
}
