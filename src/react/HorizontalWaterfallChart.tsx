import { forwardRef, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeBridge, rowBands, type WaterfallDatum } from "../core/horizontalWaterfall";
import { formatValue, formatSigned, type FormatOptions } from "../core/format";
import { useMountGrow, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel } from "./internal/text";

export type { WaterfallDatum } from "../core/horizontalWaterfall";

export interface HorizontalWaterfallChartProps {
  /** The labelled contributions, in order (drawn top-to-bottom, one row each). */
  data: WaterfallDatum[];
  /** Scenario the bridge represents (drives the accessible label). Default "AC". */
  scenario?: ScenarioKey;
  /**
   * A parallel bridge (same categories, another scenario) to compare each
   * running level against — draws a variance panel to the RIGHT, aligned row
   * for row and coloured by favorability. A DATASET, not a scenario key: the
   * sibling charts' `comparison` names a scenario, a bridge needs the other
   * scenario's contributions spelled out.
   */
  comparisonData?: WaterfallDatum[];
  /** Chart-level higher-is-better default (per-datum value wins). Default true. */
  higherIsBetter?: boolean;
  /** Print the contribution / total value beyond each bar's leading edge. Default true. */
  showValueLabels?: boolean;
  /** How the comparison variance is drawn: "bar" (default) or "pin" (line + dot). */
  mark?: "bar" | "pin";
  width?: number;
  height?: number;
  /**
   * Bar thickness per row, in px. Defaults to ~60% of the auto row band; always
   * clamped to fit its band so dense (≈20-row) bridges never overlap.
   */
  rowHeight?: number;
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
   * custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<WaterfallDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on row hover or keyboard focus
   * (contribution, running total, and Δ vs the comparison bridge when present).
   * Default true; set false to opt out. Renders on the client only, near a
   * hovered mark (or the focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
}

const SCENARIO_LABEL: Record<ScenarioKey, string> = {
  AC: "actual",
  PY: "previous year",
  PL: "plan",
  FC: "forecast",
};

/**
 * IBCS horizontal bridge (waterfall): the 90°-rotated sibling of
 * {@link WaterfallChart}. Categories run top-to-bottom (one row each), a value
 * axis runs left-to-right, and each contribution is a floating HORIZONTAL bar
 * from its running level to the next, tied to the next row by thin VERTICAL
 * step connectors at axis weight. "result" rows draw full bars from the zero
 * baseline and are emphasised (`tokens.color.total`); contribution rows are
 * neutral. The value (delta for contributions, total for results) is labelled
 * just beyond each bar's leading edge, clamped inside the SVG. A vertical zero
 * baseline is always present; negative running levels sit left of it.
 *
 * An optional `comparisonData` bridge drives a variance panel to the RIGHT — each
 * row's level vs the comparison, impact-coloured with signed labels and
 * off-scale arrows (pin mode) when a delta exceeds the panel's half-scale.
 *
 * This is the primitive that later composes into IBCS C05 (columns + horizontal
 * waterfall) and C06. Reuses the orientation-agnostic {@link computeBridge}.
 *
 * The svg is the chart's root element — it takes `className` / `style` and the
 * forwarded ref, and carries the accessible name (`role="img"` + `aria-label`);
 * the built-in tooltip portals to `document.body` and flips at the viewport
 * edges.
 */
export const HorizontalWaterfallChart = forwardRef<SVGSVGElement, HorizontalWaterfallChartProps>(
  function HorizontalWaterfallChart(
    {
      data,
      scenario = "AC",
      comparisonData,
      higherIsBetter = true,
      showValueLabels = true,
      mark = "bar",
      width = 640,
      height = 360,
      rowHeight,
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
    const padB = 14;
    const gap = 16;

    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const n = bars.length || 1;
    const { band, bands } = rowBands(bars.length, padT, innerH);

    // Left gutter for category labels, sized to the longest label but capped so a
    // verbose P&L row can never starve the plot of width.
    const longestLabel = bars.reduce((m, b) => Math.max(m, [...b.category].length), 0);
    const labelW = Math.min(Math.max(longestLabel * 10.5 * 0.6 + 6, 36), innerW * 0.34);

    // Side reserves so a value label sitting just beyond a bar's leading edge has
    // somewhere to go before the clamp pins it to the SVG edge.
    const labelSideW = 30;

    // Variance panel (to the right): a fixed slice of the post-gutter width.
    const bridgeAreaW = innerW - labelW;
    const varW = hasVariance ? Math.round(bridgeAreaW * 0.28) : 0;
    const varGap = hasVariance ? gap : 0;
    const varX0 = width - padR - varW;
    const varMid = varX0 + varW / 2;

    const plotLeft = padL + labelW + labelSideW;
    const plotRight = (hasVariance ? varX0 - varGap : width - padR) - labelSideW;
    const scaleW = Math.max(plotRight - plotLeft, 1);

    const vRange = domainMax - domainMin || 1;
    const xOf = (v: number) => plotLeft + ((v - domainMin) / vRange) * scaleW;
    const zeroX = xOf(0);
    // Grow bars out from the zero baseline on mount / data change (horizontal).
    const xA = (v: number) => zeroX + (xOf(v) - zeroX) * grow;

    // Bar thickness: caller override or ~60% of the band, always kept inside it.
    const rowH = Math.max(2, Math.min(rowHeight ?? band * 0.6, band - 2, 34));
    const labelFits = band >= 11;

    const plotBottom = padT + innerH;

    const sub = title ? `${title}. ` : "";

    // Built-in tooltip rows for the hovered row: its contribution (or total), the
    // running level, and the Δ vs the comparison bridge (impact-coloured) if any.
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

    // Screen-reader data table: each row's contribution (or, for a result row,
    // its total), the running level it walks the bridge to, and the comparison
    // variance where the panel shows one — mirrors the vertical WaterfallChart.
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
          role="img"
          aria-label={`${sub}Horizontal bridge of ${n} ${SCENARIO_LABEL[scenario]} contributions to a running total${hasVariance ? ", with a variance panel" : ""}.`}
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
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, width - padL - padR, 13)}
            </text>
          )}

          {/* Zero baseline — always present (ISO 24896): a vertical axis line. */}
          <line
            x1={zeroX}
            y1={padT}
            x2={zeroX}
            y2={plotBottom}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {/* Step connectors: a thin vertical line at the leaving level of step i,
          from its row's bottom edge to the next row's top edge, at axis weight.
          Drawn for EVERY adjacent pair — including into and out of result
          checkpoints (the running total is exactly where a result bar ends) —
          so the bridge reads as one connected path, like the vertical chart. */}
          {bars.map((b, i) => {
            // `bands` has one entry per bar, so the last row has no follower.
            const rowBand = bands[i];
            const nextBand = bands[i + 1];
            if (!rowBand || !nextBand || i === bars.length - 1) return null;
            const x = xA(b.cumAfter);
            const cy = rowBand.center;
            const cyNext = nextBand.center;
            return (
              <line
                key={`conn-${i}`}
                x1={x}
                y1={cy + rowH / 2}
                x2={x}
                y2={cyNext - rowH / 2}
                stroke={tokens.color.axis}
                strokeWidth={1.25}
              />
            );
          })}

          {/* Floating / full bars */}
          {bars.map((b, i) => {
            // `bars` and `bands` are both derived per datum — index-aligned with `data`.
            const rowBand = bands[i];
            const datum = data[i];
            if (!rowBand || !datum) return null;
            const cy = rowBand.center;
            const y = cy - rowH / 2;
            const leftV = Math.min(b.from, b.to);
            const rightV = Math.max(b.from, b.to);
            const xL = xA(leftV);
            const xR = xA(rightV);
            const w = Math.max(xR - xL, 0.5);
            const fill = b.isTotal ? tokens.color.total : tokens.color.neutral;
            // The leading edge points away from where the bar came from: for a
            // result it's the side of `to` away from zero; for a contribution it's
            // the travel direction.
            const right = b.isTotal ? b.to >= 0 : b.direction === "up";
            const labelVal = b.isTotal ? b.to : b.delta;
            const info = { category: b.category, scenario, value: labelVal, datum };
            // The row's visible marks in FINAL (un-animated) geometry — xOf,
            // not xA: the waterfall step (the focus/tap anchor) and, when the
            // variance panel draws one for this row, that panel's lane strip at
            // the bar's thickness. The full-row rect stays the hit band.
            const markRects: MarkRect[] = [
              {
                x: xOf(leftV),
                y,
                width: Math.max(xOf(rightV) - xOf(leftV), 0.5),
                height: rowH,
              },
            ];
            if (hasVariance && b.variance && !b.isTotal)
              markRects.push({ x: varX0, y, width: varW, height: rowH });
            return (
              <g key={`bar-${b.category}`} {...marks.forMark(info, markRects)}>
                {/* Transparent full-row hit target so the whole row is hover-able */}
                {hoverEnabled && (
                  <rect x={padL} y={rowBand.top} width={innerW} height={band} fill="transparent" />
                )}
                <rect x={xL} y={y} width={w} height={rowH} fill={fill} />
                {showValueLabels &&
                  labelFits &&
                  (() => {
                    const s = b.isTotal
                      ? formatValue(labelVal, format)
                      : formatSigned(labelVal, format);
                    const tw = estTextW(s, 9.5);
                    const edgeX = right ? xR : xL;
                    const anchor: "start" | "end" = right ? "start" : "end";
                    // Place just beyond the leading edge, then clamp the anchor point so
                    // the whole string stays inside the SVG.
                    const lx = right
                      ? clampTo(edgeX + 4, padL, width - padR - tw)
                      : clampTo(edgeX - 4, padL + tw, width - padR);
                    return (
                      <text
                        x={lx}
                        y={cy + 3.4}
                        fontSize={9.5}
                        fontWeight={b.isTotal ? 600 : 400}
                        fill={tokens.color.text}
                        textAnchor={anchor}
                      >
                        {s}
                      </text>
                    );
                  })()}
              </g>
            );
          })}

          {/* Category labels — right-aligned in the left gutter, on each row. */}
          {bars.map((b, i) => {
            const rowBand = bands[i];
            if (!rowBand) return null;
            const fw = b.isTotal ? 600 : 400;
            const fill = b.isTotal ? tokens.color.text : tokens.color.textMuted;
            return (
              <text
                key={`lab-${b.category}`}
                x={padL + labelW - 4}
                y={rowBand.center + 3.6}
                fontSize={10.5}
                fontWeight={fw}
                fill={fill}
                textAnchor="end"
              >
                {fitLabel(b.category, labelW - 6, 10.5)}
              </text>
            );
          })}

          {/* Variance panel (right): each row's level vs the comparison, by impact */}
          {hasVariance && (
            <>
              <line
                x1={varMid}
                y1={padT}
                x2={varMid}
                y2={plotBottom}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              {bars.map((b, i) => {
                const v = b.variance;
                // Skip result/subtotal rows: a calculated checkpoint (e.g. gross
                // margin) carries no independent variance — its movement is just the
                // sum of the contributions above it, already shown as their bars.
                const rowBand = bands[i];
                if (!v || b.isTotal || !rowBand) return null;
                const cy = rowBand.center;
                const y = cy - rowH / 2;
                const val = v.abs;
                const frac = Math.min(Math.abs(val) / varMax, 1);
                const offScale = Math.abs(val) > varMax;
                const w = frac * (varW / 2) * grow;
                const color =
                  val === 0
                    ? tokens.color.zero
                    : v.favorable
                      ? tokens.color.good
                      : tokens.color.bad;
                const right = val >= 0;
                const label = formatSigned(val, format);
                const tw = estTextW(label, 9);
                // Signed label just beyond the tip, clamped inside the SVG.
                const tipX = right ? varMid + w : varMid - w;
                const labelX = right
                  ? clampTo(tipX + 5, padL, width - padR - tw)
                  : clampTo(tipX - 5, padL + tw, width - padR);
                const labelAnchor: "start" | "end" = right ? "start" : "end";
                // When the clamp pins the label back ONTO its own bar (favorable
                // bars hit the panel's right edge), the impact colour would be the
                // bar colour — invisible. Flip to white in that case.
                const onBar = right ? labelX < tipX - 1 : labelX > tipX + 1;
                const labelColor = onBar && mark === "bar" ? tokens.color.onFill : color;
                if (mark === "pin") {
                  return (
                    <g key={`var-${b.category}`}>
                      {val !== 0 && !offScale && (
                        <line
                          x1={varMid}
                          y1={cy}
                          x2={tipX}
                          y2={cy}
                          stroke={color}
                          strokeWidth={2}
                        />
                      )}
                      {offScale ? (
                        <polygon
                          points={`${tipX},${cy} ${right ? tipX - 8 : tipX + 8},${cy - 4.5} ${right ? tipX - 8 : tipX + 8},${cy + 4.5}`}
                          fill={color}
                        />
                      ) : (
                        <circle cx={tipX} cy={cy} r={3} fill={color} />
                      )}
                      {labelFits && (
                        <text
                          x={labelX}
                          y={cy + 3.2}
                          fontSize={9}
                          fill={color}
                          textAnchor={labelAnchor}
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
                      x={right ? varMid : varMid - w}
                      y={y}
                      width={Math.max(w, 1)}
                      height={rowH}
                      fill={color}
                    />
                    {labelFits && (
                      <text
                        x={onBar ? (right ? tipX - 4 : tipX + 4) : labelX}
                        y={cy + 3.2}
                        fontSize={9}
                        fontWeight={onBar ? 600 : 400}
                        fill={labelColor}
                        textAnchor={onBar ? (right ? "end" : "start") : labelAnchor}
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
              ? `${title} — data table`
              : `Horizontal bridge of ${SCENARIO_LABEL[scenario]} contributions — data table`
          }
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
