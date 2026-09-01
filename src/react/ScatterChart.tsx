import { forwardRef, useMemo, type CSSProperties } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import { formatValue, type FormatOptions } from "../core/format";
import {
  computeXyScale,
  computeTicks,
  isoLinePoints,
  niceIsoValues,
  samplePoints,
  distinctGroups,
  assignGroupColors,
  circlesPath,
  type ScatterDatum,
} from "../core/xy";
import { useMountGrow, useDataTween } from "./hooks";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { clampTo } from "./internal/text";
import { useIbcsTokens } from "./theme";

// Local, CJK-aware text metrics: wide glyphs count ~1em where the shared
// `./internal/text` heuristic assumes a uniform 0.6em - kept for label fitting.
/** Approx. glyph width in px (CJK/full-width/emoji count as ~1em). SSR-safe. */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    cp >= 0x1f000
  );
}

/** Truncate a label with an ellipsis so it fits within `maxPx` at `fontSize`. */
function fitText(s: string, maxPx: number, fontSize: number): string {
  if (maxPx <= 0 || !s) return "";
  const wOf = (ch: string) => fontSize * (isWide(ch.codePointAt(0) ?? 0) ? 1.05 : 0.62);
  const chars = [...s];
  let total = 0;
  for (const ch of chars) total += wOf(ch);
  if (total <= maxPx) return s;
  let budget = maxPx - fontSize * 0.62; // reserve room for the ellipsis
  let out = "";
  for (const ch of chars) {
    const w = wOf(ch);
    if (budget - w < 0) break;
    budget -= w;
    out += ch;
  }
  out = out.trimEnd();
  return out ? out + "…" : "…";
}

export type { ScatterDatum } from "../core/xy";

/**
 * Configuration for the C09 iso-lines - the thin "equal gross profit"
 * reference curves drawn behind the points.
 */
export interface IsoLineConfig {
  /**
   * Explicit constant-product levels to draw. Omit (or leave empty) to
   * auto-pick ~4-6 "nice" round levels spanning the data's product range.
   */
  values?: number[];
  /** Format the level label. Default reuses the chart's number {@link FormatOptions}. */
  label?: (v: number) => string;
  /**
   * The quantity held constant along each curve. Default `(x, y) => x * y`
   * (constant gross profit). Pass e.g. `(x, y) => x * (y / 100)` for a
   * constant-margin curve where the Y axis is a percentage.
   */
  product?: (x: number, y: number) => number;
}

export interface ScatterChartProps {
  /** The points to plot. May range from a few up to thousands. */
  data: ScatterDatum[];
  /** X value-axis caption. */
  xLabel?: string;
  /** Y value-axis caption. */
  yLabel?: string;
  /**
   * Constant-product reference curves (x·y = k by default) drawn as thin
   * hyperbolas behind the points - the C09 "equal gross profit" iso-lines.
   *
   * Pass a bare `number[]` of levels for the simple case, or an
   * {@link IsoLineConfig} to auto-pick nice levels (`{}` / `{ values: [] }`),
   * customise the label, or use a non-multiplicative `product` (e.g. a
   * percentage axis). Omit entirely for no iso-lines.
   */
  isoLines?: number[] | IsoLineConfig;
  /**
   * Per-group color. Return undefined to fall back to the default palette.
   * When omitted, groups are assigned palette colors in first-seen order.
   */
  colorBy?: (group: string) => string | undefined;
  /**
   * Radius of plotted points in px. Default 3.5. (Bubble sizing lives in
   * {@link BubbleChart}.)
   */
  pointRadius?: number;
  /**
   * Above this many points the renderer switches from per-point `<circle>`
   * (which can carry labels) to one `<path>` per color for speed. Default 60.
   */
  markLimit?: number;
  /**
   * Hard cap on plotted points; larger sets are evenly down-sampled and a note
   * is shown. Default 4000.
   */
  maxPoints?: number;
  width?: number;
  height?: number;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class name for the chart's root `<svg>`. */
  className?: string;
  /** Inline style merged over the root `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
}

/**
 * IBCS scattergram (template C09): two value axes, points colored by semantic
 * group, with optional constant-profit hyperbolas as subtle gridlines and a few
 * directly-integrated point labels (no external legend box). Built as inline
 * SVG with no charting dependency; large sets are rendered as a single `<path>`
 * per color and down-sampled past `maxPoints` to stay fast.
 *
 * The forwarded ref lands on the chart's `<svg>` element.
 */
export const ScatterChart = forwardRef<SVGSVGElement, ScatterChartProps>(function ScatterChart(
  {
    data: dataProp,
    xLabel,
    yLabel,
    isoLines,
    colorBy,
    pointRadius = 3.5,
    markLimit = 60,
    maxPoints = 4000,
    width = 520,
    height = 360,
    format = {},
    tokens: tokenOverride,
    title,
    className,
    style,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const data = useDataTween(dataProp);
  const grow = useMountGrow(600, 0, data);

  // Plot only points with finite coordinates so no pixel can become NaN/±Inf.
  const clean = useMemo(
    () => data.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [data],
  );

  const padding = useMemo(
    () => ({ top: title ? 30 : 16, right: 16, bottom: 40, left: 52 }),
    [title],
  );

  const scale = useMemo(
    () => computeXyScale(clean, { width, height, padding }),
    [clean, width, height, padding],
  );

  // Cap very large sets; keep a ref-equality flag so we only note real sampling.
  const drawn = useMemo(() => samplePoints(clean, maxPoints), [clean, maxPoints]);
  const wasSampled = drawn !== clean;

  const groups = useMemo(() => distinctGroups(clean), [clean]);
  const colorMap = useMemo(() => assignGroupColors(groups, undefined, colorBy), [groups, colorBy]);
  const hasGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== "");

  const xTicks = useMemo(() => computeTicks(scale.xMin, scale.xMax, 5), [scale.xMin, scale.xMax]);
  const yTicks = useMemo(() => computeTicks(scale.yMin, scale.yMax, 5), [scale.yMin, scale.yMax]);

  const isoPaths = useMemo(() => {
    if (!isoLines) return [];
    // Normalise the legacy `number[]` form into the richer config shape.
    const cfg: IsoLineConfig = Array.isArray(isoLines) ? { values: isoLines } : isoLines;
    const product = cfg.product ?? ((x: number, y: number) => x * y);
    const labelOf = cfg.label ?? ((v: number) => formatValue(v, format));

    // Resolve levels: explicit values, else auto-pick across the data's product
    // range so iso-lines appear without the caller choosing numbers by hand.
    let levels = cfg.values;
    if (!levels || levels.length === 0) {
      let pMin = Infinity;
      let pMax = -Infinity;
      for (const p of clean) {
        const pr = product(p.x, p.y);
        if (Number.isFinite(pr)) {
          if (pr < pMin) pMin = pr;
          if (pr > pMax) pMax = pr;
        }
      }
      levels = Number.isFinite(pMin) && Number.isFinite(pMax) ? niceIsoValues(pMin, pMax, 5) : [];
    }
    if (!levels.length) return [];

    const xDomain: [number, number] = [scale.xMin, scale.xMax];
    const yDomain: [number, number] = [scale.yMin, scale.yMax];

    return levels
      .map((level) => {
        const pts = isoLinePoints(level, xDomain, yDomain, { product });
        const head = pts[0];
        if (pts.length < 2 || !head) return null;
        const d = pts
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"}${scale.xOf(p.x).toFixed(1)},${scale.yOf(p.y).toFixed(1)}`,
          )
          .join("");
        // Label near the curve's upper-left end (where it heads off the top),
        // clamped inside the plot so it can never spill past an edge.
        const text = labelOf(level);
        const w = Math.min(text.length * 9.5 * 0.6, scale.right - scale.left);
        return {
          level,
          d,
          lx: clampTo(scale.xOf(head.x) + 3, scale.left + 2, scale.right - 2 - w),
          ly: clampTo(scale.yOf(head.y) + 10, scale.top + 9, scale.bottom - 2),
          text,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v != null);
  }, [isoLines, clean, scale, format]);

  // Per-color path strings for the fast path (many points).
  const colorPaths = useMemo(() => {
    if (drawn.length <= markLimit) return [];
    const byColor = new Map<string, Array<{ cx: number; cy: number }>>();
    for (const p of drawn) {
      const color = colorMap[p.group ?? ""] ?? tokens.color.neutral;
      const arr = byColor.get(color) ?? [];
      arr.push({ cx: scale.xOf(p.x), cy: scale.yOf(p.y) });
      byColor.set(color, arr);
    }
    return Array.from(byColor, ([color, pts]) => ({ color, d: circlesPath(pts, pointRadius) }));
  }, [drawn, markLimit, colorMap, scale, pointRadius, tokens.color.neutral]);

  const smallSet = drawn.length <= markLimit;
  const fmt = (v: number) => formatValue(v, format);

  // Cap legend rows to those that fit inside the plot height; overflow collapses
  // into a "+N more" row so the swatches never spill past the bottom edge.
  const legendCapacity = Math.max(1, Math.floor((scale.bottom - scale.top - 4) / 14));
  const legendGroups =
    groups.length > legendCapacity ? groups.slice(0, Math.max(0, legendCapacity - 1)) : groups;
  const legendMore = groups.length - legendGroups.length;

  // Screen-reader data table: the plotted points' coordinates (and their group
  // when the chart colors by one) as real numbers, not the decorative svg. Rows
  // follow the points actually drawn, so a down-sampled set stays truthful.
  const a11yColumns = [xLabel ?? "X", yLabel ?? "Y", ...(hasGroups ? ["Group"] : [])];
  const a11yRows: ChartDataRow[] = drawn.map((p, i) => ({
    label: p.label ?? `Point ${i + 1}`,
    cells: [fmt(p.x), fmt(p.y), ...(hasGroups ? [p.group ?? "n/a"] : [])],
  }));

  return (
    <>
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          title
            ? `${title}. Scatter plot of ${data.length} points${xLabel && yLabel ? ` of ${yLabel} versus ${xLabel}` : ""}.`
            : `Scatter plot of ${data.length} points`
        }
        className={className}
        style={{
          display: "block",
          maxWidth: "100%",
          marginInline: "auto",
          fontFamily: tokens.font.family,
          ...style,
        }}
      >
        {title && (
          <text x={padding.left} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
            {title}
          </text>
        )}

        {/* Gridlines at the ticks */}
        {xTicks.map((t) => (
          <line
            key={`gx${t}`}
            x1={scale.xOf(t)}
            y1={scale.top}
            x2={scale.xOf(t)}
            y2={scale.bottom}
            stroke={tokens.color.gridline}
            strokeWidth={1}
          />
        ))}
        {yTicks.map((t) => (
          <line
            key={`gy${t}`}
            x1={scale.left}
            y1={scale.yOf(t)}
            x2={scale.right}
            y2={scale.yOf(t)}
            stroke={tokens.color.gridline}
            strokeWidth={1}
          />
        ))}

        {/* Constant-product hyperbolas (iso-lines) - subtle reference scaffolding
          drawn UNDER the points: thin, faint, dashed, clearly secondary. */}
        {isoPaths.map((iso) => (
          <g key={`iso${iso.level}`}>
            <path
              d={iso.d}
              fill="none"
              stroke={tokens.color.axis}
              strokeWidth={1}
              strokeOpacity={0.65}
              strokeDasharray="2 3"
            />
            <text x={iso.lx} y={iso.ly} fontSize={9.5} fill={tokens.color.textMuted}>
              {iso.text}
            </text>
          </g>
        ))}

        {/* Zero axes (emphasised over the gridlines) */}
        {scale.zeroY >= scale.top && scale.zeroY <= scale.bottom && (
          <line
            x1={scale.left}
            y1={scale.zeroY}
            x2={scale.right}
            y2={scale.zeroY}
            stroke={tokens.color.axis}
            strokeWidth={1.5}
          />
        )}
        {scale.zeroX >= scale.left && scale.zeroX <= scale.right && (
          <line
            x1={scale.zeroX}
            y1={scale.top}
            x2={scale.zeroX}
            y2={scale.bottom}
            stroke={tokens.color.axis}
            strokeWidth={1.5}
          />
        )}

        {/* Axis frame (left + bottom) */}
        <line
          x1={scale.left}
          y1={scale.top}
          x2={scale.left}
          y2={scale.bottom}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />
        <line
          x1={scale.left}
          y1={scale.bottom}
          x2={scale.right}
          y2={scale.bottom}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />

        {/* Tick labels */}
        {xTicks.map((t) => (
          <text
            key={`tx${t}`}
            x={scale.xOf(t)}
            y={scale.bottom + 14}
            fontSize={10}
            fill={tokens.color.textMuted}
            textAnchor="middle"
          >
            {fmt(t)}
          </text>
        ))}
        {yTicks.map((t) => (
          <text
            key={`ty${t}`}
            x={scale.left - 6}
            y={scale.yOf(t) + 3.5}
            fontSize={10}
            fill={tokens.color.textMuted}
            textAnchor="end"
          >
            {fmt(t)}
          </text>
        ))}

        {/* Axis captions (truncated to the plot extent so they never overflow) */}
        {xLabel && (
          <text
            x={(scale.left + scale.right) / 2}
            y={height - 6}
            fontSize={11}
            fontWeight={500}
            fill={tokens.color.text}
            textAnchor="middle"
          >
            {fitText(xLabel, scale.right - scale.left, 11)}
          </text>
        )}
        {yLabel && (
          <text
            x={12}
            y={(scale.top + scale.bottom) / 2}
            fontSize={11}
            fontWeight={500}
            fill={tokens.color.text}
            textAnchor="middle"
            transform={`rotate(-90 12 ${(scale.top + scale.bottom) / 2})`}
          >
            {fitText(yLabel, scale.bottom - scale.top, 11)}
          </text>
        )}

        {/* Points - grow via a subtle group fade/scale */}
        <g
          opacity={grow}
          style={{
            transform: `scale(${0.96 + 0.04 * grow})`,
            transformOrigin: `${scale.zeroX}px ${scale.zeroY}px`,
          }}
        >
          {smallSet
            ? drawn.map((p, i) => {
                const color = colorMap[p.group ?? ""] ?? tokens.color.neutral;
                const cx = scale.xOf(p.x);
                const cy = scale.yOf(p.y);
                // Label the point on whichever side has more room, then truncate
                // it to that room so it can never spill past the left/right edge.
                const rightRoom = width - 2 - (cx + pointRadius + 3);
                const leftRoom = cx - pointRadius - 3 - 2;
                const flip = leftRoom > rightRoom;
                const label = p.label ? fitText(p.label, Math.max(rightRoom, leftRoom), 10) : "";
                return (
                  <g key={i}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={pointRadius}
                      fill={color}
                      fillOpacity={0.85}
                      stroke={color}
                      strokeWidth={0.75}
                    />
                    {label && (
                      <text
                        x={flip ? cx - pointRadius - 3 : cx + pointRadius + 3}
                        y={cy + 3}
                        fontSize={10}
                        fill={tokens.color.text}
                        textAnchor={flip ? "end" : "start"}
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })
            : colorPaths.map((cp) => (
                <path key={cp.color} d={cp.d} fill={cp.color} fillOpacity={0.7} />
              ))}
        </g>

        {/* Integrated legend: small color swatches + group names (no boxed legend) */}
        {hasGroups && (
          <g>
            {legendGroups.map((g, i) => (
              <g
                key={`lg${g}`}
                transform={`translate(${scale.right - 110}, ${scale.top + 4 + i * 14})`}
              >
                <rect x={0} y={-7} width={9} height={9} rx={1.5} fill={colorMap[g]} />
                <text x={13} y={1} fontSize={10} fill={tokens.color.textMuted}>
                  {fitText(g || "-", 95, 10)}
                </text>
              </g>
            ))}
            {legendMore > 0 && (
              <text
                x={scale.right - 110 + 13}
                y={scale.top + 4 + legendGroups.length * 14 + 1}
                fontSize={10}
                fill={tokens.color.textMuted}
              >
                {`+${legendMore} more`}
              </text>
            )}
          </g>
        )}

        {/* Sampling note */}
        {wasSampled && (
          <text
            x={scale.right}
            y={scale.top - 4}
            fontSize={9.5}
            fill={tokens.color.textMuted}
            textAnchor="end"
          >
            {`showing ${drawn.length.toLocaleString()} of ${clean.length.toLocaleString()} (sampled)`}
          </text>
        )}
      </svg>
      <ChartDataTable
        caption={title ? `${title} - data table` : "Scatter plot data table"}
        columns={a11yColumns}
        rows={a11yRows}
      />
    </>
  );
});
