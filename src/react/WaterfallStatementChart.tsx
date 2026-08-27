import { forwardRef, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import {
  computeWaterfallStatement,
  type WaterfallStatementLine,
  type WaterfallStatementRow,
  type WsLaneBar,
} from "../core/waterfallStatement";
import { formatValue, formatSigned, formatPercentPlain, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel } from "./internal/text";

export type {
  WaterfallStatementLine,
  WaterfallStatementRow,
  WaterfallStatementLayout,
  WsLaneBar,
} from "../core/waterfallStatement";

export interface WaterfallStatementChartProps {
  /** The P&L lines, top-to-bottom. Each carries an `ac` and a `base` value. */
  lines: WaterfallStatementLine[];
  /**
   * Comparison scenario for the grey lane and the variance tiers ("PY" / "PL").
   * Drives lane 2's header notation and the "ΔPY"/"ΔPY%" tier headers. Default "PY".
   */
  comparison?: ScenarioKey;
  /** Chart-level higher-is-better default (per-line value wins). Default true. */
  higherIsBetter?: boolean;
  /** Render the ΔPY% pin tier (lane 4). Default true. */
  showPctPanel?: boolean;
  /** Print the value at each bar's leading edge in the two waterfall lanes. Default true. */
  showValueLabels?: boolean;
  width?: number;
  /** Row pitch in px (the band each row occupies). Default 28; clamped ≥ 16. */
  rowHeight?: number;
  /**
   * A |%| at/beyond this is an off-scale pin (excluded from the ΔPY% scale).
   * Default 100.
   */
  clampPct?: number;
  /** A |Δ| beyond this is an off-scale ΔPY bar (arrow tip). Default unbounded. */
  clampAbs?: number;
  format?: FormatOptions;
  /** Token override merged over the nearest {@link IbcsThemeProvider} theme. */
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class applied to the chart `<svg>` (the root element). */
  className?: string;
  /** Styles merged *over* the chart's own layout styles. */
  style?: CSSProperties;
  /**
   * Fired as the pointer moves over / leaves a row (`null` on leave) — for a
   * custom tooltip. Pairs with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<WaterfallStatementRow> | null) => void;
  /**
   * Show the built-in floating tooltip on row hover or keyboard focus
   * (comparison, AC, ΔPY abs + %). Default true; set false to opt out. Renders
   * on the client only, near a hovered mark (or the focused / tapped one);
   * Escape dismisses it.
   */
  tooltip?: boolean;
}

const SCENARIO_LABEL: Record<ScenarioKey, string> = { AC: "AC", PY: "PY", PL: "PL", FC: "FC" };

/**
 * IBCS chart-template **C12** — a P&L calculation scheme as TWO side-by-side
 * vertical waterfalls plus absolute and relative variance tiers, all row-aligned
 * to the P&L lines.
 *
 * Four column tiers run left→right, every row a P&L line (a left gutter holds
 * the flow marker `+`/`−`/`=` and label):
 *  1. **comparison lane** (PY/PL, grey) — a horizontal bridge walking the lines;
 *  2. **AC lane** (dark) — the same rows on the SAME value→pixel scale as (1),
 *     so the two bridges are directly comparable;
 *  3. **ΔPY** — absolute-variance bars from a per-tier zero axis, coloured by
 *     IMPACT (good/bad/zero, honouring `higherIsBetter`), signed labels, with
 *     off-scale arrow tips;
 *  4. **ΔPY%** — a pin column (line + dot), off-scale arrows past the clamp
 *     (omit via `showPctPanel={false}`).
 *
 * Result rows are emphasised (bold label, heavier bars) and ruled above. The
 * bridge math is the shared {@link computeBridge} (run once per lane) wrapped by
 * {@link computeWaterfallStatement}; the variance cells reuse the same visual
 * language as `StatementTable` (impact colour, signed labels, off-scale arrows).
 *
 * Pure SVG, zero dependencies, SSR-safe (no DOM / time / randomness at module or
 * render). Themed through the token context (`tokens` prop or an enclosing
 * {@link IbcsThemeProvider}, incl. `color.surface` for hollow scenario frames). Robust to
 * empty / single / negative / long-label inputs.
 *
 * The svg is the chart's root element — it takes `className` / `style` and the
 * forwarded ref, and carries the accessible name (`role="img"` + `aria-label`);
 * the built-in tooltip portals to `document.body` and flips at the viewport
 * edges.
 */
export const WaterfallStatementChart = forwardRef<SVGSVGElement, WaterfallStatementChartProps>(
  function WaterfallStatementChart(
    {
      lines: linesProp,
      comparison = "PY",
      higherIsBetter = true,
      showPctPanel = true,
      showValueLabels = true,
      width = 820,
      rowHeight = 28,
      clampPct = 100,
      clampAbs,
      format = {},
      tokens: tokenOverride,
      title,
      onHover,
      tooltip = true,
      className,
      style,
    },
    ref,
  ) {
    const tokens = useIbcsTokens(tokenOverride);
    const lines = useDataTween(linesProp);
    const grow = useMountGrow(700, 0, lines);
    const hover = useChartHover<WaterfallStatementRow>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;

    const layout = useMemo(
      () => computeWaterfallStatement(lines, { comparison, higherIsBetter, clampPct, clampAbs }),
      [lines, comparison, higherIsBetter, clampPct, clampAbs],
    );
    const { rows, domainMin, domainMax, absDomain, pctDomain } = layout;

    // ---- Vertical geometry ------------------------------------------------
    const padL = 14;
    const padR = 14;
    const padT = title ? 34 : 14;
    const headerH = 24;
    const padB = 12;
    const rowH = Math.max(rowHeight, 16);
    const n = rows.length;
    const plotTop = padT + headerH;
    const height = plotTop + n * rowH + padB;
    const rowTop = (i: number) => plotTop + i * rowH;
    const rowMid = (i: number) => plotTop + i * rowH + rowH / 2;
    const barH = Math.min(rowH * 0.6, 18);
    const resultBarH = Math.min(rowH * 0.72, 22);

    // ---- Horizontal geometry: gutter | lane1 | lane2 | ΔPY | ΔPY% ----------
    const inner = Math.max(width - padL - padR, 1);
    const longest = rows.reduce((m, r) => Math.max(m, [...r.label].length), 0);
    const gutterW = clampTo(longest * 6.4 + 22, 70, inner * 0.34);
    const gap = 12;

    const absW = Math.round(clampTo(inner * 0.14, 56, 140));
    const pctW = showPctPanel ? Math.round(clampTo(inner * 0.16, 72, 160)) : 0;
    const nGaps = showPctPanel ? 4 : 3; // gutter|l1, l1|l2, l2|abs, [abs|pct]
    const laneArea = inner - gutterW - absW - pctW - gap * nGaps;
    const laneW = Math.max(laneArea / 2, 44);

    const gutterX0 = padL;
    const lane1X0 = gutterX0 + gutterW + gap;
    const lane2X0 = lane1X0 + laneW + gap;
    const absX0 = lane2X0 + laneW + gap;
    const pctX0 = absX0 + absW + gap;

    // Shared lane value→pixel scale (identical for both lanes so they compare).
    const laneLPad = 6;
    const laneRPad = Math.min(40, laneW * 0.34);
    const laneInnerW = Math.max(laneW - laneLPad - laneRPad, 1);
    const span = domainMax - domainMin || 1;
    const laneXOf = (x0: number, v: number) =>
      x0 + laneLPad + ((v - domainMin) / span) * laneInnerW;

    // ---- Tier axes --------------------------------------------------------
    const absMidX = absX0 + absW / 2;
    const absHalf = Math.max(absW / 2 - 6, 4);
    const pctAxisX = pctX0 + pctW * 0.4;
    const pctPosRoom = Math.max(pctX0 + pctW - pctAxisX - 34, 6);
    const pctNegRoom = Math.max(pctAxisX - pctX0 - 8, 6);

    const plotBottom = plotTop + n * rowH;
    const compLabel = SCENARIO_LABEL[comparison];
    const compStyle = tokens.scenario[comparison];
    const hollowBase = compStyle.variant !== "solid";

    // ---- Lane bar styling -------------------------------------------------
    const baseFill = (isResult: boolean) =>
      hollowBase ? tokens.color.surface : isResult ? tokens.color.neutral : compStyle.fill;
    const baseStroke = hollowBase ? compStyle.stroke : "none";
    const baseStrokeW = hollowBase ? 1.25 : 0;
    const acFill = (isResult: boolean) => (isResult ? tokens.color.total : tokens.color.neutral);

    const impactColor = (r: WaterfallStatementRow) =>
      r.variance.abs === 0
        ? tokens.color.zero
        : r.variance.favorable
          ? tokens.color.good
          : tokens.color.bad;

    // ---- One waterfall lane (bars + connectors + leading-edge labels) ------
    const renderLane = (x0: number, which: "base" | "ac") => {
      const zeroX = laneXOf(x0, 0);
      const xA = (v: number) => zeroX + (laneXOf(x0, v) - zeroX) * grow;
      const laneRight = x0 + laneW;

      return (
        <g>
          {/* zero baseline */}
          <line
            x1={zeroX}
            y1={plotTop}
            x2={zeroX}
            y2={plotBottom}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {/* step connectors at the leaving level, between consecutive steps */}
          {rows.map((r, i) => {
            // No connector after the last row — `next` is undefined exactly there.
            const next = rows[i + 1];
            if (!next) return null;
            const bar = r[which];
            if (bar.isTotal || next[which].isTotal) return null;
            const x = xA(bar.cumAfter);
            return (
              <line
                key={`c-${which}-${i}`}
                x1={x}
                y1={rowMid(i) + (r.isResult ? resultBarH : barH) / 2}
                x2={x}
                y2={rowMid(i + 1) - (next.isResult ? resultBarH : barH) / 2}
                stroke={tokens.color.axis}
                strokeWidth={1.25}
              />
            );
          })}

          {/* floating / full bars */}
          {rows.map((r, i) => {
            const bar = r[which];
            const h = r.isResult ? resultBarH : barH;
            const y = rowMid(i) - h / 2;
            const xFrom = xA(bar.from);
            const xTo = xA(bar.to);
            const xL = Math.min(xFrom, xTo);
            const w = Math.max(Math.abs(xTo - xFrom), 0.75);
            const fill = which === "base" ? baseFill(r.isResult) : acFill(r.isResult);
            // Leading edge points away from the origin (result) / travel direction.
            const right = bar.isTotal ? bar.to >= 0 : bar.direction === "up";
            const labelVal = bar.isTotal ? bar.to : Math.abs(bar.delta);
            const s = formatValue(labelVal, format);
            const tw = estTextW(s, 9.5);
            const edgeX = right ? Math.max(xFrom, xTo) : Math.min(xFrom, xTo);
            const lx = right
              ? clampTo(edgeX + 4, x0, laneRight - tw)
              : clampTo(edgeX - 4, x0 + tw, laneRight);
            const anchor: "start" | "end" = right ? "start" : "end";
            return (
              <g key={`b-${which}-${i}`}>
                <rect
                  x={xL}
                  y={y}
                  width={w}
                  height={h}
                  fill={fill}
                  stroke={which === "base" ? baseStroke : "none"}
                  strokeWidth={which === "base" ? baseStrokeW : 0}
                />
                {showValueLabels && rowH >= 18 && (
                  <text
                    x={lx}
                    y={rowMid(i) + 3.4}
                    fontSize={9.5}
                    fontWeight={r.isResult ? 700 : 400}
                    fill={tokens.color.text}
                    textAnchor={anchor}
                  >
                    {s}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      );
    };

    // ---- ΔPY absolute-variance tier (bars from a central zero axis) --------
    const renderAbsTier = () => (
      <g>
        <line
          x1={absMidX}
          y1={plotTop}
          x2={absMidX}
          y2={plotBottom}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />
        {rows.map((r, i) => {
          const val = r.variance.abs;
          const color = impactColor(r);
          const h = r.isResult ? Math.min(resultBarH, 18) : Math.min(barH, 14);
          const y = rowMid(i) - h / 2;
          const frac = Math.min(Math.abs(val) / absDomain, 1);
          const w = frac * absHalf * grow;
          const right = val >= 0;
          const tipX = right ? absMidX + w : absMidX - w;
          const label = formatSigned(val, format);
          const tw = estTextW(label, 9.5);
          const labelX = right
            ? clampTo(tipX + 5, absX0, absX0 + absW - tw)
            : clampTo(tipX - 5, absX0 + tw, absX0 + absW);
          const anchor: "start" | "end" = right ? "start" : "end";
          return (
            <g key={`abs-${i}`}>
              {val !== 0 && (
                <rect
                  x={Math.min(absMidX, tipX)}
                  y={y}
                  width={Math.max(w, 1)}
                  height={h}
                  fill={color}
                />
              )}
              {/* off-scale arrow tip when the delta exceeds the tier half-scale */}
              {r.absOutlier && (
                <polygon
                  points={`${tipX + (right ? 5 : -5)},${rowMid(i)} ${tipX},${rowMid(i) - h / 2} ${tipX},${rowMid(i) + h / 2}`}
                  fill={color}
                />
              )}
              {rowH >= 16 && (
                <text
                  x={labelX}
                  y={rowMid(i) + 3.4}
                  fontSize={9.5}
                  fontWeight={r.isResult ? 700 : 400}
                  fill={tokens.color.text}
                  textAnchor={anchor}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );

    // ---- ΔPY% pin tier (line + dot, off-scale arrows) ---------------------
    const renderPctTier = () => (
      <g>
        <line
          x1={pctAxisX}
          y1={plotTop}
          x2={pctAxisX}
          y2={plotBottom}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />
        {rows.map((r, i) => {
          const pct = r.variance.pct;
          if (pct == null || !Number.isFinite(pct)) return null;
          const pp = pct * 100;
          const color = impactColor(r);
          const cy = rowMid(i);
          const dir = pp >= 0 ? 1 : -1;
          const outlier = r.pctOutlier;
          const frac = Math.min(Math.abs(pp) / pctDomain, 1);
          const room = dir > 0 ? pctPosRoom : pctNegRoom;
          const markX = outlier
            ? dir > 0
              ? pctX0 + pctW - 8
              : pctX0 + 8
            : pctAxisX + dir * frac * room * grow;
          const label = formatPercentPlain(pct);
          const tw = estTextW(label, 9.5);
          const labelX = outlier
            ? dir > 0
              ? clampTo(markX - 6, pctX0 + tw, pctX0 + pctW)
              : clampTo(markX + 6, pctX0, pctX0 + pctW - tw)
            : dir > 0
              ? clampTo(markX + 6, pctX0, pctX0 + pctW - tw)
              : clampTo(markX - 6, pctX0 + tw, pctX0 + pctW);
          const anchor: "start" | "end" = outlier
            ? dir > 0
              ? "end"
              : "start"
            : dir > 0
              ? "start"
              : "end";
          return (
            <g key={`pct-${i}`}>
              {!outlier && pp !== 0 && (
                <line x1={pctAxisX} y1={cy} x2={markX} y2={cy} stroke={color} strokeWidth={2} />
              )}
              {outlier ? (
                <polygon
                  points={`${markX},${cy} ${markX - dir * 8},${cy - 4.5} ${markX - dir * 8},${cy + 4.5}`}
                  fill={color}
                />
              ) : (
                <circle
                  cx={markX}
                  cy={cy}
                  r={r.isResult ? 3.6 : 3}
                  fill={pp === 0 ? tokens.color.zero : tokens.color.text}
                />
              )}
              {rowH >= 16 && (
                <text
                  x={labelX}
                  y={cy + 3.4}
                  fontSize={9.5}
                  fontStyle="italic"
                  fontWeight={r.isResult ? 700 : 400}
                  fill={color}
                  textAnchor={anchor}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );

    // ---- Header captions, centred over each tier --------------------------
    const header = (cx: number, text: string) => (
      <text
        x={cx}
        y={plotTop - 8}
        fontSize={11}
        fontWeight={500}
        fill={tokens.color.textMuted}
        textAnchor="middle"
      >
        {text}
      </text>
    );

    // ---- Built-in tooltip -------------------------------------------------
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const r = h.datum;
      const exact = { ...format, compact: false };
      const rowsT: ChartTooltipRow[] = [
        { label: "AC", value: formatValue(r.acValue, exact), strong: true },
        { label: compLabel, value: formatValue(r.baseValue, exact) },
        {
          label: `Δ${compLabel}`,
          value: formatSigned(r.variance.abs, exact),
          color: impactColor(r),
        },
      ];
      if (r.variance.pct != null && Number.isFinite(r.variance.pct)) {
        rowsT.push({
          label: `Δ${compLabel}%`,
          value: `${formatPercentPlain(r.variance.pct)}%`,
          color: impactColor(r),
        });
      }
      return (
        <ChartTooltip
          ref={hover.tooltipRef}
          x={h.x}
          y={h.y}
          title={r.label}
          rows={rowsT}
          tokens={tokens}
        />
      );
    };

    // Screen-reader data table: one row per P&L line, columns in the same order
    // as the tiers — the comparison lane, the AC lane, the absolute variance and
    // (when its pin tier is drawn) the relative one, formatted exactly as the
    // tier labels are (`formatPercentPlain`, with the % in the column header).
    const a11yColumns = [
      compLabel,
      "AC",
      `Δ${compLabel}`,
      ...(showPctPanel ? [`Δ${compLabel}%`] : []),
    ];
    const a11yRows: ChartDataRow[] = rows.map((r) => ({
      label: r.label,
      cells: [
        formatValue(r.baseValue, format),
        formatValue(r.acValue, format),
        formatSigned(r.variance.abs, format),
        ...(showPctPanel ? [formatPercentPlain(r.variance.pct)] : []),
      ],
    }));

    return (
      <>
        <svg
          ref={ref}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title ? title + ". " : ""}P&L calculation scheme: ${compLabel} and AC waterfalls with Δ${compLabel} absolute${showPctPanel ? " and relative" : ""} variance, ${n} lines.`}
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
            <text x={padL} y={20} fontSize={13} fontWeight={600} fill={tokens.color.text}>
              {fitLabel(title, inner, 13)}
            </text>
          )}

          {/* Headers + underline */}
          {header(lane1X0 + laneW / 2, compLabel)}
          {header(lane2X0 + laneW / 2, "AC")}
          {header(absMidX, `Δ${compLabel}`)}
          {showPctPanel && header(pctX0 + pctW / 2, `Δ${compLabel}%`)}
          <line
            x1={padL}
            y1={plotTop}
            x2={width - padR}
            y2={plotTop}
            stroke={tokens.color.text}
            strokeWidth={1.25}
          />

          {/* Rules above result rows (span the full plot width) */}
          {rows.map((r, i) =>
            r.isResult && i > 0 ? (
              <line
                key={`rule-${i}`}
                x1={padL}
                y1={rowTop(i)}
                x2={width - padR}
                y2={rowTop(i)}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
            ) : null,
          )}

          {/* Lanes + tiers */}
          {renderLane(lane1X0, "base")}
          {renderLane(lane2X0, "ac")}
          {renderAbsTier()}
          {showPctPanel && renderPctTier()}

          {/* Gutter labels (marker + label) */}
          {rows.map((r, i) => (
            <g key={`g-${i}`}>
              <text
                x={gutterX0}
                y={rowMid(i) + 3.6}
                fontSize={11}
                fontWeight={600}
                fill={tokens.color.textMuted}
                textAnchor="start"
              >
                {r.marker}
              </text>
              <text
                x={gutterX0 + 13}
                y={rowMid(i) + 3.6}
                fontSize={r.isResult ? 11.5 : 11}
                fontWeight={r.isResult ? 700 : 400}
                fill={r.isResult ? tokens.color.text : tokens.color.textMuted}
                textAnchor="start"
              >
                {fitLabel(r.label, gutterW - 15, 11)}
              </text>
            </g>
          ))}

          {/* Full-row hover hit targets (drawn last so they win the pointer) */}
          {hoverEnabled &&
            rows.map((r, i) => {
              const info = {
                category: r.label,
                value: r.variance.abs,
                datum: r,
                scenario: "AC" as ScenarioKey,
              };
              // This row's visible marks in FINAL (un-animated) geometry —
              // laneXOf, not the lanes' animated xA: the AC lane bar (the
              // focus/tap anchor), the comparison lane bar, then the Δ and Δ%
              // tiers as their lane strips at the mark's thickness. This
              // full-row rect stays the generous hit band.
              const laneH = r.isResult ? resultBarH : barH;
              const cy = rowMid(i);
              const laneRect = (x0: number, bar: WsLaneBar): MarkRect => {
                const xFrom = laneXOf(x0, bar.from);
                const xTo = laneXOf(x0, bar.to);
                return {
                  x: Math.min(xFrom, xTo),
                  y: cy - laneH / 2,
                  width: Math.max(Math.abs(xTo - xFrom), 0.75),
                  height: laneH,
                };
              };
              const markRects: MarkRect[] = [laneRect(lane2X0, r.ac), laneRect(lane1X0, r.base)];
              if (r.variance.abs !== 0) {
                const absH = r.isResult ? Math.min(resultBarH, 18) : Math.min(barH, 14);
                markRects.push({ x: absX0, y: cy - absH / 2, width: absW, height: absH });
              }
              if (showPctPanel && r.variance.pct != null && Number.isFinite(r.variance.pct))
                // Pin (line + dot): its lane strip widened to ±5px around the line.
                markRects.push({ x: pctX0, y: cy - 5, width: pctW, height: 10 });
              return (
                <rect
                  key={`hit-${i}`}
                  x={padL}
                  y={rowTop(i)}
                  width={inner}
                  height={rowH}
                  fill="transparent"
                  {...marks.forMark(info, markRects)}
                />
              );
            })}
        </svg>
        <ChartDataTable
          caption={
            title
              ? `${title} — data table`
              : `P&L calculation scheme, AC versus ${compLabel} — data table`
          }
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
