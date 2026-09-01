import { forwardRef, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeBridge, type WaterfallDatum } from "../core/waterfall";
import { formatValue, formatSigned, type FormatOptions } from "../core/format";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel } from "./internal/text";

export type { WaterfallDatum } from "../core/waterfall";

export interface WaterfallChartProps {
  /** The labelled contributions, in order. */
  data: WaterfallDatum[];
  /** Scenario the bridge represents (drives fill style). Default "AC". */
  scenario?: ScenarioKey;
  /**
   * A parallel bridge (same columns, another scenario) to compare each running
   * level against - draws a variance panel beneath, colored by favorability.
   * A DATASET, not a scenario key: the sibling charts' `comparison` names a
   * scenario, a bridge needs the other scenario's contributions spelled out.
   */
  comparisonData?: WaterfallDatum[];
  /** Chart-level higher-is-better default (per-datum value wins). Default true. */
  higherIsBetter?: boolean;
  /** Print the contribution value on each column. Default true. */
  showValueLabels?: boolean;
  /** How the comparison variance is drawn: "bar" (default) or "pin" (line + dot). */
  mark?: "bar" | "pin";
  width?: number;
  height?: number;
  /**
   * Horizontal band layout - the gap between columns and the lead-in/out gutter.
   * Omit for the centred default; pass `{ outer: 0 }` to trim the side whitespace
   * so the first/last columns sit flush to the plot edges (fill edge-to-edge).
   */
  bandPadding?: BandPadding;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Extra class name for the chart `<svg>` (the rendered root). */
  className?: string;
  /** Inline style merged OVER the chart `<svg>`'s own layout style. */
  style?: CSSProperties;
  /**
   * Fired as the pointer moves over / leaves a bar (`null` on leave) - for a
   * custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<WaterfallDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on bar hover or keyboard focus
   * (contribution, running total, and Δ vs the comparison bridge when present).
   * Default true; set false to opt out. Renders on the client only, near a
   * hovered mark (or the focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
  /**
   * Style the connector lines that tie each column to the next.
   * - `style`: "solid" (default) or "dashed".
   * - `width`: stroke width in px (default 1.25).
   * - `align`: where the connector sits vertically. "step" (default) ties the
   *   columns at the running-total level (the IBCS-correct meeting point);
   *   "top" runs it along each leaving column's top edge, "bottom" the bottom.
   */
  connector?: {
    style?: "solid" | "dashed";
    width?: number;
    align?: "step" | "top" | "bottom";
  };
}

const SCENARIO_LABEL: Record<ScenarioKey, string> = {
  AC: "actual",
  PY: "previous year",
  PL: "plan",
  FC: "forecast",
};

/**
 * IBCS bridge (waterfall) chart: a standalone column bridge that walks a
 * running total across labelled add / subtract contributions, with checkpoint
 * "result" columns drawn as full bars from the zero baseline. Connector lines
 * tie each step to the next; contribution columns are neutral, result columns
 * emphasised. An optional `comparisonData` bridge drives a variance panel beneath,
 * colored by favorability with explicit +/- signs.
 *
 * Distinct from the in-table waterfall in `StatementTable` (which walks a
 * `StatementLine` tree); this consumes a flat, serializable `WaterfallDatum[]`.
 *
 * A forwarded `ref` lands on the chart `<svg>` - the useful handle for export /
 * serialization - even though the component also renders a screen-reader table
 * beside it.
 */
export const WaterfallChart = forwardRef<SVGSVGElement, WaterfallChartProps>(
  function WaterfallChart(
    {
      data: dataProp,
      scenario = "AC",
      comparisonData: comparisonDataProp,
      higherIsBetter = true,
      showValueLabels = true,
      mark = "bar",
      width = 640,
      height = 360,
      bandPadding,
      format = {},
      tokens: tokenOverride,
      title,
      className,
      style,
      onHover,
      tooltip = true,
      connector,
    },
    ref,
  ) {
    const conn = { style: "solid" as const, width: 1.25, align: "step" as const, ...connector };
    const tokens = useIbcsTokens(tokenOverride);
    const data = useDataTween(dataProp);
    const comparisonData = useDataTween(comparisonDataProp);
    const grow = useMountGrow(700, 0, data);
    const hover = useChartHover<WaterfallDatum>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;

    const layout = useMemo(
      () => computeBridge(data, scenario, { comparison: comparisonData, higherIsBetter }),
      [data, scenario, comparisonData, higherIsBetter],
    );
    const { bars, domainMin, domainMax, varMax } = layout;
    const hasVariance = comparisonData != null && comparisonData.length > 0;

    const padL = 14;
    const padR = 14;
    const padT = title ? 32 : 16;
    const gap = 16;
    const innerW = width - padL - padR;

    const n = bars.length || 1;
    // Column-band layout. Default reproduces the historical centred look exactly
    // (column = 0.56·step, half-band gutter); `bandPadding` lets a caller trim the
    // gutter (`{ outer: 0 }`) so the first/last columns sit flush to the edges.
    const scale = bandScale(innerW, n, resolveBandPadding(0.56, bandPadding), padL);
    const band = scale.step;
    // If the longest category label can't fit horizontally in its band, angle all
    // labels (preserves the full text instead of overlapping or over-truncating).
    const longestLabel = bars.reduce((m, b) => Math.max(m, [...b.category].length), 0);
    const rotateLabels = longestLabel * 10.5 * 0.55 > band - 4;
    const labelH = rotateLabels ? 48 : 22;
    // Angled-label geometry. Labels are anchored near the TOP of the bottom label
    // band and tilt up-to-the-right ending at the column, so the text descends
    // into the band (never below the SVG) and the per-column budget keeps the
    // lower-left tail inside the left edge.
    const LABEL_ANGLE = 32;
    const labelSin = Math.sin((LABEL_ANGLE * Math.PI) / 180);
    const labelCos = Math.cos((LABEL_ANGLE * Math.PI) / 180);

    // Headroom for the value labels that sit just outside each bar's leading edge:
    // above the tallest column and below the lowest one.
    const labelTopH = 12;
    const labelBotH = 12;
    const varLabelH = hasVariance ? 12 : 0;

    const varH = hasVariance ? Math.round((height - padT - labelH) * 0.28) : 0;
    // Band that holds the value chart (including the top/bottom label reserves).
    const chartH = height - padT - labelH - (hasVariance ? varH + gap + varLabelH : 0);
    const chartBottom = padT + chartH;
    const plotTop = padT + labelTopH;
    const plotBottom = chartBottom - labelBotH;
    const scaleH = Math.max(plotBottom - plotTop, 1);

    const vRange = domainMax - domainMin || 1;
    const yOf = (v: number) => plotBottom - ((v - domainMin) / vRange) * scaleH;
    const zeroY = yOf(0);
    // Grow bars up/down from the zero baseline on mount / data change.
    const yA = (v: number) => zeroY + (yOf(v) - zeroY) * grow;

    const cxOf = (i: number) => scale.center(i);
    const colW = Math.min(scale.bandwidth, 44);

    const varMid = chartBottom + gap + varH / 2;

    const sub = title ? `${title}. ` : "";

    // Built-in tooltip rows for the hovered bar: its contribution (or total), the
    // running level, and the Δ vs the comparison bridge (impact-coloured) if any.
    // Values render at FULL precision (compact: false): the printed labels are
    // compact ("30.1M"), so the tooltip adds the exact figure instead of echoing.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const b = bars.find((bar) => bar.category === h.category);
      if (!b) return null;
      const exact = { ...format, compact: false };
      const rows: ChartTooltipRow[] = [];
      if (b.isTotal) {
        rows.push({ label: "Total", value: formatValue(b.to, exact), strong: true });
      } else {
        rows.push({ label: "Contribution", value: formatSigned(b.delta, exact), strong: true });
        rows.push({ label: "Running total", value: formatValue(b.to, exact) });
      }
      const v = b.variance;
      if (v) {
        const color =
          v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
        rows.push({ label: "Δ vs comparison", value: formatSigned(v.abs, exact), color });
      }
      return (
        <ChartTooltip
          ref={hover.tooltipRef}
          x={h.x}
          y={h.y}
          title={h.category}
          rows={rows}
          tokens={tokens}
        />
      );
    };

    // Screen-reader data table: each step's contribution (or total), the running
    // level, and the comparison variance where present - values, not the svg.
    const a11yColumns = [
      "Contribution",
      "Running total",
      ...(hasVariance ? ["Δ vs comparison"] : []),
    ];
    const a11yRows: ChartDataRow[] = bars.map((b) => {
      const cells: Array<string | number> = [
        b.isTotal ? formatValue(b.to, format) : formatSigned(b.delta, format),
        formatValue(b.to, format),
      ];
      if (hasVariance) cells.push(b.variance ? formatSigned(b.variance.abs, format) : "n/a");
      return { label: b.category, cells };
    });

    return (
      <>
        <svg
          ref={ref}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={className}
          // A single labelled image - no `aria-hidden`, which would cancel the
          // label out and leave assistive tech with nothing but the sr-only table.
          role="img"
          aria-label={`${sub}Bridge of ${n} ${SCENARIO_LABEL[scenario]} contributions to a running total${hasVariance ? ", with a variance panel" : ""}.`}
          style={{
            display: "block",
            maxWidth: "100%",
            marginInline: "auto",
            fontFamily: tokens.font.family,
            ...style,
          }}
        >
          {title && (
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, width - padL - padR, 13)}
            </text>
          )}

          {/* Zero baseline - always present (ISO 24896). */}
          <line
            x1={padL}
            y1={zeroY}
            x2={width - padR}
            y2={zeroY}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {/* Connectors: a thin line tying the leaving level of step i to the start
          of step i+1. Drawn for EVERY adjacent pair - including into and out of
          result checkpoints, since the running total (b.cumAfter) is exactly the
          level a result column draws to - so the bridge reads as one connected
          path. Axis-weight grey (a 1px rowBorder line was near-invisible). */}
          {bars.map((b, i) => {
            if (i === bars.length - 1) return null;
            const y =
              conn.align === "top"
                ? yA(Math.max(b.from, b.to))
                : conn.align === "bottom"
                  ? yA(Math.min(b.from, b.to))
                  : yA(b.cumAfter);
            return (
              <line
                key={`conn-${i}`}
                x1={cxOf(i) + colW / 2}
                y1={y}
                x2={cxOf(i + 1) - colW / 2}
                y2={y}
                stroke={tokens.color.axis}
                strokeWidth={conn.width}
                strokeDasharray={conn.style === "dashed" ? "4 3" : undefined}
              />
            );
          })}

          {/* Floating / full columns */}
          {bars.map((b, i) => {
            // One bar per datum, in data order.
            const datum = data[i];
            if (!datum) return null;
            const cx = cxOf(i);
            const topV = Math.max(b.from, b.to);
            const botV = Math.min(b.from, b.to);
            const yTop = yA(topV);
            const yBot = yA(botV);
            const h = Math.max(Math.abs(yBot - yTop), 0.5);
            const fill = b.isTotal ? tokens.color.total : tokens.color.neutral;
            // Label sits just outside the leading edge of the bar.
            const leadV = b.isTotal ? b.to : b.direction === "up" ? topV : botV;
            const leadY = yA(leadV);
            const above = b.isTotal ? b.to >= 0 : b.direction === "up";
            const labelVal = b.isTotal ? b.to : b.delta;
            const info = {
              category: b.category,
              scenario,
              value: b.isTotal ? b.to : b.delta,
              datum,
            };
            // The one visible mark of this step, in FINAL (un-animated)
            // geometry: the column between its start and end level (a total
            // column runs from the zero baseline). The tooltip fires only near
            // it - the full-height band rect below stays the generous hit area.
            const yTopFinal = yOf(topV);
            const yBotFinal = yOf(botV);
            const markRects: MarkRect[] = [
              {
                x: cx - colW / 2,
                y: yTopFinal,
                width: colW,
                height: Math.max(Math.abs(yBotFinal - yTopFinal), 0.5),
              },
            ];
            return (
              <g key={`bar-${b.category}`} {...marks.forMark(info, markRects)}>
                {/* Transparent full-band hit target so the whole column is hover-able */}
                {hoverEnabled && (
                  <rect
                    x={cxOf(i) - band / 2}
                    y={padT}
                    width={band}
                    height={chartBottom - padT}
                    fill="transparent"
                  />
                )}
                <rect x={cx - colW / 2} y={yTop} width={colW} height={h} fill={fill} />
                {showValueLabels &&
                  (() => {
                    const s = b.isTotal
                      ? formatValue(labelVal, format)
                      : formatSigned(labelVal, format);
                    const w = estTextW(s, 9.5);
                    // Skip when it can't fit its band (would overlap a neighbour) and
                    // nudge inward at the edges so it never spills past the SVG.
                    if (w > band - 1) return null;
                    const lx = clampTo(cx, padL + w / 2, width - padR - w / 2);
                    return (
                      <text
                        x={lx}
                        y={above ? leadY - 5 : leadY + 12}
                        fontSize={9.5}
                        fontWeight={b.isTotal ? 600 : 400}
                        fill={tokens.color.text}
                        textAnchor="middle"
                      >
                        {s}
                      </text>
                    );
                  })()}
              </g>
            );
          })}

          {/* Category labels - angled when they can't fit horizontally, so long
          P&L labels keep their full text instead of overlapping. */}
          {bars.map((b, i) => {
            const x = cxOf(i);
            const fw = b.isTotal ? 600 : 400;
            const fill = b.isTotal ? tokens.color.text : tokens.color.textMuted;
            if (rotateLabels) {
              // Anchor near the top of the label band; text descends to the lower-left.
              const ly = height - labelH + 12;
              // Length budget: the rotated text box (width w, height ~fontPx) must
              // keep its lower-left corner above the bottom edge and right of the
              // left edge. Account for the font height's contribution to each extent.
              const fs = 10;
              const vertBudget = (height - 1 - ly - fs * 0.25 * labelCos) / labelSin;
              const leftBudget = (x - 1 - fs * labelSin) / labelCos;
              const budget = Math.max(0, Math.min(vertBudget, leftBudget));
              return (
                <text
                  key={`lab-${b.category}`}
                  x={x}
                  y={ly}
                  fontSize={10}
                  fontWeight={fw}
                  fill={fill}
                  textAnchor="end"
                  transform={`rotate(-${LABEL_ANGLE} ${x} ${ly})`}
                >
                  {fitLabel(b.category, budget, 10)}
                </text>
              );
            }
            return (
              <text
                key={`lab-${b.category}`}
                x={x}
                y={height - 6}
                fontSize={10.5}
                fontWeight={fw}
                fill={fill}
                textAnchor="middle"
              >
                {fitLabel(b.category, band - 2, 10.5)}
              </text>
            );
          })}

          {/* Variance panel: each column's level vs the comparison, by favorability */}
          {hasVariance && (
            <>
              <line
                x1={padL}
                y1={varMid}
                x2={width - padR}
                y2={varMid}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              {bars.map((b, i) => {
                const v = b.variance;
                if (!v) return null;
                const cx = cxOf(i);
                const val = v.abs;
                const frac = Math.min(Math.abs(val) / varMax, 1);
                const offScale = Math.abs(val) > varMax;
                const h = frac * (varH / 2) * grow;
                const color =
                  val === 0
                    ? tokens.color.zero
                    : v.favorable
                      ? tokens.color.good
                      : tokens.color.bad;
                const up = val >= 0;
                const label = formatSigned(val, format);
                if (mark === "pin") {
                  const tipY = up ? varMid - h : varMid + h;
                  return (
                    <g key={`var-${b.category}`}>
                      {val !== 0 && !offScale && (
                        <line
                          x1={cx}
                          y1={varMid}
                          x2={cx}
                          y2={tipY}
                          stroke={color}
                          strokeWidth={2}
                        />
                      )}
                      {offScale ? (
                        <polygon
                          points={`${cx},${tipY} ${cx - 4.5},${up ? tipY + 8 : tipY - 8} ${cx + 4.5},${up ? tipY + 8 : tipY - 8}`}
                          fill={color}
                        />
                      ) : (
                        <circle cx={cx} cy={tipY} r={3} fill={color} />
                      )}
                      {estTextW(label, 9) <= band - 1 && (
                        <text
                          x={clampTo(
                            cx,
                            padL + estTextW(label, 9) / 2,
                            width - padR - estTextW(label, 9) / 2,
                          )}
                          y={up ? tipY - 6 : tipY + 12}
                          fontSize={9}
                          fill={color}
                          textAnchor="middle"
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                }
                return (
                  <g key={`var-${b.category}`}>
                    <rect
                      x={cx - colW / 2}
                      y={up ? varMid - h : varMid}
                      width={colW}
                      height={Math.max(h, 1)}
                      fill={color}
                    />
                    {estTextW(label, 9) <= band - 1 && (
                      <text
                        x={clampTo(
                          cx,
                          padL + estTextW(label, 9) / 2,
                          width - padR - estTextW(label, 9) / 2,
                        )}
                        y={up ? varMid - h - 4 : varMid + h + 11}
                        fontSize={9}
                        fill={color}
                        textAnchor="middle"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
            </>
          )}
        </svg>
        <ChartDataTable
          caption={
            title
              ? `${title} - data table`
              : `Bridge of ${SCENARIO_LABEL[scenario]} contributions - data table`
          }
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
