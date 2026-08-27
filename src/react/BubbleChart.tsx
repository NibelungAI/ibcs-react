import { forwardRef, useMemo, type CSSProperties } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import { formatValue, type FormatOptions } from "../core/format";
import {
  computeXyScale,
  computeTicks,
  bubbleRadius,
  distinctGroups,
  assignGroupColors,
  type BubbleDatum,
} from "../core/xy";
import { useMountGrow, useDataTween } from "./hooks";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";

// Local, CJK-aware text metrics: wide glyphs count ~1em where the shared
// `./internal/text` heuristic assumes a uniform 0.6em — kept for label fitting.
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

export type { BubbleDatum } from "../core/xy";

export interface BubbleChartProps {
  /** The bubbles to plot: x, y, and a size driving the bubble's area. */
  data: BubbleDatum[];
  /** X value-axis caption. */
  xLabel?: string;
  /** Y value-axis caption. */
  yLabel?: string;
  /** Caption for the size encoding (shown in the size-legend). */
  sizeLabel?: string;
  /** Radius (px) of the largest bubble; others scale by √(size/maxSize). Default 28. */
  maxRadius?: number;
  /**
   * Per-group color. Return undefined to fall back to the default palette.
   * When omitted, groups are colored by first-seen order.
   */
  colorBy?: (group: string) => string | undefined;
  /**
   * Show each bubble's label when there are at most this many bubbles (keeps
   * dense charts legible). Default 24.
   */
  labelLimit?: number;
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
 * IBCS bubble chart (template C10): two value axes plus a third magnitude
 * encoded as bubble AREA (radius ∝ √size). Bubbles are semi-transparent so
 * overlaps stay readable, colored by semantic group, and labelled directly when
 * few are shown — no external legend box for the points themselves. Inline SVG,
 * no charting dependency.
 *
 * The forwarded ref lands on the chart's `<svg>` element.
 */
export const BubbleChart = forwardRef<SVGSVGElement, BubbleChartProps>(function BubbleChart(
  {
    data: dataProp,
    xLabel,
    yLabel,
    sizeLabel,
    maxRadius = 28,
    colorBy,
    labelLimit = 24,
    width = 520,
    height = 380,
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
  const grow = useMountGrow(650, 0, data);

  // Plot only bubbles with finite coordinates; sanitize each size to a finite,
  // non-negative magnitude so no radius/coordinate can become NaN/±Inf.
  const clean = useMemo(
    () =>
      data
        .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
        .map((d) => ({ ...d, size: Number.isFinite(d.size) ? Math.max(0, d.size) : 0 })),
    [data],
  );

  // Reserve at least one bubble-radius of gutter on every side so a max-size
  // bubble sitting at a domain extreme can never spill outside the plot.
  const padding = useMemo(
    () => ({
      top: Math.max(title ? 30 : 16, maxRadius + 4),
      right: maxRadius + 8,
      bottom: Math.max(40, maxRadius + 4),
      left: Math.max(52, maxRadius + 4),
    }),
    [title, maxRadius],
  );

  const scale = useMemo(
    () => computeXyScale(clean, { width, height, padding }),
    [clean, width, height, padding],
  );

  const maxSize = useMemo(() => clean.reduce((m, d) => Math.max(m, d.size), 0), [clean]);

  const groups = useMemo(() => distinctGroups(clean), [clean]);
  const colorMap = useMemo(() => assignGroupColors(groups, undefined, colorBy), [groups, colorBy]);
  const hasGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== "");

  const xTicks = useMemo(() => computeTicks(scale.xMin, scale.xMax, 5), [scale.xMin, scale.xMax]);
  const yTicks = useMemo(() => computeTicks(scale.yMin, scale.yMax, 5), [scale.yMin, scale.yMax]);

  const fmt = (v: number) => formatValue(v, format);
  const showLabels = clean.length <= labelLimit;

  // Cap legend rows to those that fit inside the plot height; the rest collapse
  // into a "+N more" row so swatches never spill past the bottom edge.
  const legendCapacity = Math.max(1, Math.floor((scale.bottom - scale.top - 4) / 14));
  const legendGroups =
    groups.length > legendCapacity ? groups.slice(0, Math.max(0, legendCapacity - 1)) : groups;
  const legendMore = groups.length - legendGroups.length;

  // Draw biggest bubbles first so smaller ones land on top and stay clickable/visible.
  const ordered = useMemo(
    () => clean.map((d, i) => ({ d, i })).sort((a, b) => b.d.size - a.d.size),
    [clean],
  );

  // Screen-reader data table: each bubble's two coordinates plus the magnitude
  // its area encodes (and its group when colored by one) as real numbers — the
  // size encoding is invisible to a screen reader without it. Rows keep input
  // order (not the biggest-first paint order) so they read as the data does.
  const a11yColumns = [
    xLabel ?? "X",
    yLabel ?? "Y",
    sizeLabel ?? "Size",
    ...(hasGroups ? ["Group"] : []),
  ];
  const a11yRows: ChartDataRow[] = clean.map((d, i) => ({
    label: d.label ?? `Item ${i + 1}`,
    cells: [fmt(d.x), fmt(d.y), fmt(d.size), ...(hasGroups ? [d.group ?? "n/a"] : [])],
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
            ? `${title}. Bubble chart of ${data.length} items${sizeLabel ? `, sized by ${sizeLabel}` : ""}.`
            : `Bubble chart of ${data.length} items`
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

        {/* Gridlines */}
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

        {/* Zero axes */}
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

        {/* Axis frame */}
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

        {/* Bubbles */}
        <g opacity={grow}>
          {ordered.map(({ d, i }) => {
            const color = colorMap[d.group ?? ""] ?? tokens.color.neutral;
            const cx = scale.xOf(d.x);
            const cy = scale.yOf(d.y);
            const r = bubbleRadius(d.size, maxSize, maxRadius) * grow;
            // Keep the centered label inside both the bubble and the canvas.
            const room = Math.max(0, Math.min(2 * r + 6, 2 * Math.min(cx, width - cx) - 4));
            const label = showLabels && d.label ? fitText(d.label, room, 10) : "";
            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  fillOpacity={0.32}
                  stroke={color}
                  strokeWidth={1}
                />
                {label && (
                  <text
                    x={cx}
                    y={cy + 3.5}
                    fontSize={10}
                    fill={tokens.color.text}
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Size legend: two reference bubbles (max + half-max) */}
        {maxSize > 0 && (
          <g transform={`translate(${scale.left + 6}, ${scale.top + 6})`}>
            {[1, 0.25].map((frac, k) => {
              const r = bubbleRadius(maxSize * frac, maxSize, maxRadius);
              return (
                <g key={k} transform={`translate(${maxRadius}, ${maxRadius - r})`}>
                  <circle
                    cx={0}
                    cy={r}
                    r={r}
                    fill="none"
                    stroke={tokens.color.textMuted}
                    strokeWidth={1}
                  />
                  <text
                    x={maxRadius + 6}
                    y={r * 2 + 3}
                    fontSize={9.5}
                    fill={tokens.color.textMuted}
                  >
                    {fmt(maxSize * frac)}
                  </text>
                </g>
              );
            })}
            {sizeLabel && (
              <text x={0} y={-2} fontSize={9.5} fontWeight={500} fill={tokens.color.textMuted}>
                {fitText(sizeLabel, width - scale.left - 12, 9.5)}
              </text>
            )}
          </g>
        )}

        {/* Group legend (color) */}
        {hasGroups && (
          <g>
            {legendGroups.map((g, i) => (
              <g
                key={`lg${g}`}
                transform={`translate(${scale.right - 110}, ${scale.top + 4 + i * 14})`}
              >
                <rect x={0} y={-7} width={9} height={9} rx={1.5} fill={colorMap[g]} />
                <text x={13} y={1} fontSize={10} fill={tokens.color.textMuted}>
                  {fitText(g || "—", 95, 10)}
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
      </svg>
      <ChartDataTable
        caption={title ? `${title} — data table` : "Bubble chart data table"}
        columns={a11yColumns}
        rows={a11yRows}
      />
    </>
  );
});
