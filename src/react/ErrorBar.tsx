import { computeErrorBar, type ErrorBarOrientation } from "../core/errorBar";
import { formatInterval, type FormatOptions } from "../core/format";
import type { IbcsTokensOverride } from "../core/tokens";
import { useIbcsTokens } from "./theme";

export interface ErrorBarProps {
  /** The point estimate: where the bar ends or the point sits. */
  value: number;
  /** Half-width of the interval: the whisker spans `value − halfWidth` … `value + halfWidth`. */
  halfWidth: number;
  /** Value → pixel along the value axis: the scale of the bar or point this error bar belongs to. */
  scale: (value: number) => number;
  /** Pixel position across the value axis: that bar's or point's centre line. */
  cross: number;
  /** "horizontal" (value axis left → right: bars, ranking rows) or "vertical" (columns, points). Default "horizontal". */
  orientation?: ErrorBarOrientation;
  /** Length of each cap in pixels. Default 6; 0 draws the whisker alone. */
  capSize?: number;
  /**
   * Pixel range `[a, b]` along the value axis to keep the whisker inside (the
   * plot or panel). An end cut by it loses its cap - the interval goes on.
   */
  clip?: readonly [number, number];
  /** Stroke colour. Default the theme's text ink (`color.text`). */
  color?: string;
  /** Stroke width in pixels. Default 1.25. */
  strokeWidth?: number;
  /**
   * The mark's accessible name and tooltip. Default "value ± half-width",
   * written with `format` (`signed` for a difference: "+3.46 ± 0.46").
   */
  label?: string;
  /** Number format for the default label. */
  format?: FormatOptions;
  /** Write the default label's value with a sign (for a difference). Default false. */
  signed?: boolean;
  /** Theme overrides; the halo uses `color.surface`. */
  tokens?: IbcsTokensOverride;
  /** Class name for the mark's `<g>`. */
  className?: string;
}

/**
 * ErrorBar - the interval of a value as a whisker with a cap at each end: a
 * MARK to place inside an `<svg>` beside the bar or point it qualifies, on the
 * same scale. `RankingVarianceChart` and `DataTable` draw it for you from
 * their data; use it directly in a chart of your own.
 *
 * The whisker is drawn over a thin halo in the theme's surface colour, so the
 * half that crosses a solid bar stays visible on any fill, light or dark. The
 * `<g>` carries the interval as text: `role="img"`, `aria-label` and a
 * `<title>` tooltip. Inside an `<svg role="img">` that has a name of its own
 * - a chart that is one labelled image - assistive technology treats the
 * children as presentational and reads only the svg's name; the library's
 * charts therefore also write every interval into their screen-reader table.
 * Renders nothing for a zero or invalid half-width, or an interval wholly
 * outside `clip`. Pure SVG, SSR-safe.
 */
export function ErrorBar({
  value,
  halfWidth,
  scale,
  cross,
  orientation = "horizontal",
  capSize,
  clip,
  color,
  strokeWidth = 1.25,
  label,
  format,
  signed = false,
  tokens: tokenOverride,
  className,
}: ErrorBarProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const geometry = computeErrorBar(value, halfWidth, { orientation, scale, cross, capSize, clip });
  if (!geometry) return null;
  const text = label ?? formatInterval(value, halfWidth, format, signed);
  const segments = [geometry.whisker, ...geometry.caps];
  const ink = color ?? tokens.color.text;
  return (
    <g className={className} role="img" aria-label={text}>
      <title>{text}</title>
      {segments.map((s, i) => (
        <line
          key={`halo-${i}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={tokens.color.surface}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
        />
      ))}
      {segments.map((s, i) => (
        <line
          key={`ink-${i}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={ink}
          strokeWidth={strokeWidth}
        />
      ))}
    </g>
  );
}
