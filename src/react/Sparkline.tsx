import { forwardRef, useMemo, type CSSProperties } from "react";
import { useIbcsTokens } from "./theme";

/** Radius of the emphasised last-point dot; drives the padding so it never clips. */
const DOT_R = 2.2;

export interface SparklineProps {
  /** The series. Drawn left→right; the last point is the "current". */
  data: number[];
  type?: "line" | "area" | "bar";
  width?: number;
  height?: number;
  /** Ink of the line / bars. Defaults to the theme's `color.total`. */
  color?: string;
  /** Fill opacity for the area variant. Default 0.15. */
  fillOpacity?: number;
  /** Emphasise the last point with a dot. Default true for line/area. */
  showLast?: boolean;
  /**
   * Stretch to fill the parent's width. The `width` prop becomes the logical
   * coordinate width while the SVG renders at `width="100%"` (via a viewBox), so
   * the chart fills any container without measuring it — handy inside a card.
   * SSR-safe (no layout jump). Default false.
   */
  fluid?: boolean;
  /** Class applied to the root `<svg>`. */
  className?: string;
  /** Styles merged *over* the sparkline's own layout styles. */
  style?: CSSProperties;
}

/**
 * A tiny zero-dependency micro-chart. The value axis always includes the data's
 * own min/max (a sparkline shows shape, not absolute level), and a flat series
 * renders along the middle rather than collapsing.
 *
 * **Accessibility:** a sparkline is a decorative-by-design embedded mark — it
 * lives beside the number it trends (a KPI headline, a table cell), so it
 * carries `aria-hidden="true"` and NO `role`. Screen readers get the visible
 * value instead of a shape they cannot inspect; announcing both would just be
 * noise. (Standalone charts do the opposite: `role="img"` + a label.)
 */
export const Sparkline = forwardRef<SVGSVGElement, SparklineProps>(function Sparkline(
  {
    data,
    type = "line",
    width = 96,
    height = 28,
    color: colorProp,
    fillOpacity = 0.15,
    showLast,
    fluid = false,
    className,
    style,
  },
  ref,
) {
  const tokens = useIbcsTokens();
  const color = colorProp ?? tokens.color.total;
  const { points, baseY, barW } = useMemo(() => {
    // Drop non-finite samples (NaN/±Infinity) so no coordinate can become NaN.
    const clean = data.filter((v) => Number.isFinite(v));
    const n = clean.length;
    if (n === 0) return { points: [] as Array<{ x: number; y: number }>, baseY: height, barW: 0 };
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    // A flat series (all values equal) draws along the middle rather than
    // collapsing to an edge; a real span maps min→bottom, max→top.
    const flat = max === min;
    const span = flat ? 1 : max - min;
    // Reserve room so the last-point dot (radius DOT_R) and bar edges never
    // spill outside the tiny viewBox. Bars inset by half a bar width.
    const bw = (width / n) * 0.7;
    const padX = type === "bar" ? bw / 2 + 0.5 : DOT_R + 0.75;
    const padY = DOT_R + 0.75;
    const innerW = Math.max(0, width - padX * 2);
    const innerH = Math.max(0, height - padY * 2);
    const x = (i: number) => (n === 1 ? width / 2 : padX + (i / (n - 1)) * innerW);
    const y = (v: number) =>
      flat ? padY + innerH / 2 : padY + innerH - ((v - min) / span) * innerH;
    return {
      points: clean.map((v, i) => ({ x: x(i), y: y(v) })),
      // Bars grow from the zero baseline (or the floor for all-positive data);
      // for a flat series, anchor them at the floor so they stay visible.
      baseY: flat ? padY + innerH : y(Math.max(min, 0)),
      barW: bw,
    };
  }, [data, width, height, type]);

  // Fluid mode keeps the logical coordinate space (`width`×`height`) but lets the
  // SVG scale to its container's width; `preserveAspectRatio="none"` stretches
  // horizontally, which is exactly right for a time series (shape over level).
  // The non-fluid svg still carries a viewBox + `maxWidth:100%` so it shrinks to
  // fit a narrow container (keeping its aspect) instead of overflowing it.
  const svgProps = fluid
    ? ({
        width: "100%",
        height,
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: "none",
      } as const)
    : ({ width, height, viewBox: `0 0 ${width} ${height}` } as const);

  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last)
    return <svg ref={ref} {...svgProps} className={className} style={style} aria-hidden="true" />;

  const path = points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  // The emphasised dot would shear into an ellipse under non-uniform scaling, so
  // it's dropped in fluid mode.
  const dot = (showLast ?? type !== "bar") && !fluid;

  return (
    <svg
      ref={ref}
      {...svgProps}
      className={className}
      style={{ display: "block", maxWidth: "100%", ...style }}
      aria-hidden="true"
    >
      {type === "bar" ? (
        points.map((p, i) => {
          const bw = Math.max(barW, 1);
          const bx = Math.max(0, Math.min(width - bw, p.x - bw / 2));
          return (
            <rect
              key={i}
              x={bx}
              y={Math.min(p.y, baseY)}
              width={bw}
              height={Math.max(Math.abs(baseY - p.y), 1)}
              fill={color}
            />
          );
        })
      ) : (
        <>
          {type === "area" && (
            <path
              d={`${path} L${last.x.toFixed(1)} ${height} L${first.x.toFixed(1)} ${height} Z`}
              fill={color}
              fillOpacity={fillOpacity}
              stroke="none"
            />
          )}
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {dot && <circle cx={last.x} cy={last.y} r={DOT_R} fill={color} />}
        </>
      )}
    </svg>
  );
});
