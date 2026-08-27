import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import {
  computeIntegratedVariance,
  type IntegratedDatum,
  type FyTotalInput,
} from "../core/integratedVariance";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";
import { useIbcsTokens } from "./theme";

export type { IntegratedDatum, FyTotalInput } from "../core/integratedVariance";

export interface IntegratedVarianceChartProps {
  /** The periods, in order. Designed for ~12 (a year), an actual head + forecast tail. */
  data: IntegratedDatum[];
  /** Comparison scenario the Δ panels measure AC against. Default "PY". */
  comparison?: "PY" | "PL";
  /** Whether a higher value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /** Show the TOP Δ% pin panel. Default true. */
  showPctPanel?: boolean;
  /** Show the MIDDLE Δ absolute-variance bar panel. Default true. */
  showAbsPanel?: boolean;
  /**
   * A full-year TOTAL column set apart to the right (gap + divider). One
   * segment renders solid; two or more stack into a single column.
   */
  fyTotal?: FyTotalInput;
  width?: number;
  height?: number;
  /**
   * Horizontal band layout — the gap between month columns and the lead-in/out
   * gutter. Omit for the centred default; pass `{ outer: 0 }` to trim the side
   * whitespace so the first/last months sit flush to the month area's edges.
   */
  bandPadding?: BandPadding;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class name for the chart's `<svg>`. */
  className?: string;
  /** Inline style merged over the `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
  /**
   * Fired as the pointer moves over / leaves a bottom column (`null` on leave) —
   * for a custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<IntegratedDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on bottom-column hover or keyboard focus
   * (AC, the comparison value, Δ and Δ%). Default true; set false to opt out.
   * Renders on the client only, near a hovered mark (or the focused / tapped
   * one); Escape dismisses it.
   */
  tooltip?: boolean;
}

/**
 * IntegratedVarianceChart — the signature Zebra-BI "integrated" column chart
 * (IBCS #64/#65): three vertically stacked, perfectly x-aligned panels over
 * one set of categories.
 *
 *  1. TOP — Δ% pins (lollipops): a thin pin from a zero axis, up & green when
 *     favorable, down & red when not, with a % label. Off-scale percents are
 *     pinned to the edge with an arrow; forecast periods get a hollow tip.
 *  2. MIDDLE — Δ absolute bars from a zero line, up favorable / down
 *     unfavorable, forecast months hatched, signed labels.
 *  3. BOTTOM — the AC column chart: solid actual columns with the comparison
 *     drawn in its own IBCS notation (PY solid grey behind, or PL a hollow
 *     white frame), forecast months hatched, value labels above. An optional
 *     full-year TOTAL column (optionally stacked) sits apart to the right.
 *
 * Variance is coloured by IMPACT (good/bad/zero, respecting `higherIsBetter`),
 * never by raw sign, and every panel carries a zero baseline. SSR-safe.
 *
 * The component renders the chart `<svg>`, a screen-reader data table, and
 * (on hover or keyboard focus) a floating tooltip, so `className` / `style` /
 * the forwarded ref all land on the `<svg>`.
 */
export const IntegratedVarianceChart = forwardRef<SVGSVGElement, IntegratedVarianceChartProps>(
  function IntegratedVarianceChart(
    {
      data: dataProp,
      comparison = "PY",
      higherIsBetter = true,
      showPctPanel = true,
      showAbsPanel = true,
      fyTotal,
      width = 720,
      height = 420,
      bandPadding,
      format = {},
      tokens: tokenOverride,
      title,
      className,
      style,
      onHover,
      tooltip = true,
    },
    ref,
  ) {
    const tokens = useIbcsTokens(tokenOverride);
    // Sanitised so the ids stay valid selectors after an SVG export/serialization.
    const hatchAC = svgSafeId(useId());
    const hatchGood = svgSafeId(useId());
    const hatchBad = svgSafeId(useId());
    const data = useDataTween(dataProp);
    const grow = useMountGrow(700, 0, data);
    const hover = useChartHover<IntegratedDatum>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;

    const layout = useMemo(
      () => computeIntegratedVariance(data, { comparison, higherIsBetter, fyTotal }),
      [data, comparison, higherIsBetter, fyTotal],
    );
    const { cells, domainMin, domainMax, absMax, pctMax, pctClamp, fy } = layout;

    const padL = 14;
    const padR = 14;
    const padT = title ? 32 : 16;
    const labelH = 22;
    const gap = 16;

    // Vertical proportions: ~22% Δ%, ~22% Δabs, ~56% columns. A hidden Δ panel
    // gives its share (and its gap) to the bottom column panel.
    const showPct = showPctPanel;
    const showAbs = showAbsPanel;
    const nGaps = (showPct ? 1 : 0) + (showAbs ? 1 : 0);
    const availH = Math.max(height - padT - labelH - nGaps * gap, 1);
    const wPct = showPct ? 0.22 : 0;
    const wAbs = showAbs ? 0.22 : 0;
    const pctH = Math.round(availH * wPct);
    const absH = Math.round(availH * wAbs);
    const colPanelH = availH - pctH - absH;

    let cursor = padT;
    const pctTop = cursor;
    if (showPct) cursor += pctH + gap;
    const absTop = cursor;
    if (showAbs) cursor += absH + gap;
    const colTopY = cursor;
    const colBase = colTopY + colPanelH;

    // X layout — identical month bands across ALL panels. The FY area is reserved
    // on the right everywhere (drawn only in the bottom panel) so the months stay
    // pixel-aligned across the three panels.
    const innerW = width - padL - padR;
    const n = cells.length;
    const fyGap = fy ? 20 : 0;
    const fyArea = fy ? Math.min(innerW * 0.16, 92) : 0;
    const monthsW = Math.max(innerW - fyGap - fyArea, 1);
    // Month-band layout. Default reproduces the historical centred look exactly
    // (back column = 0.62·step, half-band gutter); `bandPadding` lets a caller
    // trim the gutter (`{ outer: 0 }`) so months fill the month area edge-to-edge.
    const scale = bandScale(monthsW, n, resolveBandPadding(0.62, bandPadding), padL);
    const band = scale.step;
    const cxOf = (i: number) => scale.center(i);

    const acW = Math.min(band * 0.42, 46);
    const pyW = Math.min(scale.bandwidth, 68);

    // Bottom column panel value→pixel mapping (label headroom reserved at top).
    const labelTopH = 14;
    const range = domainMax - domainMin || 1;
    const colScaleH = Math.max(colPanelH - labelTopH, 1);
    const yOfCol = (v: number) => colBase - ((v - domainMin) / range) * colScaleH;
    const colZeroY = yOfCol(0);
    const gYcol = (v: number) => colZeroY + (yOfCol(v) - colZeroY) * grow;

    // Δ panel zero axes (centre lines) and half-scales (label headroom reserved).
    const pctMid = pctTop + pctH / 2;
    const pctHalf = Math.max(pctH / 2 - 11, 1);
    const absMid = absTop + absH / 2;
    const absHalf = Math.max(absH / 2 - 11, 1);

    // FY column geometry.
    const fyCx = padL + monthsW + fyGap + fyArea / 2;
    const fyColW = fy ? Math.min(fyArea * 0.62, 54) : 0;
    const fyDividerX = padL + monthsW + fyGap / 2;

    // Built-in tooltip rows for the hovered period: AC, the comparison value, and
    // the signed Δ + Δ% (impact-coloured), reusing the cell's variance.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const c = cells.find((cell) => cell.category === h.category);
      if (!c) return null;
      const exact = { ...format, compact: false };
      const rows: ChartTooltipRow[] = [
        { label: c.isForecast ? "AC (FC)" : "AC", value: formatValue(c.AC, exact), strong: true },
      ];
      if (c.comparisonValue != null && isFinite(c.comparisonValue)) {
        rows.push({ label: comparison, value: formatValue(c.comparisonValue, exact) });
      }
      const v = c.variance;
      if (v) {
        const color =
          v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
        rows.push({ label: `Δ${comparison}`, value: formatSigned(v.abs, exact), color });
        rows.push({ label: `Δ${comparison}%`, value: formatPercent(v.pct), color });
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

    // Screen-reader data table: each period's AC, the comparison, and the Δ / Δ%
    // (plus the full-year total) — values, not the decorative svg.
    const a11yColumns = ["AC", comparison, `Δ${comparison}`, `Δ${comparison}%`];
    const a11yRows: ChartDataRow[] = cells.map((c) => ({
      label: c.isForecast ? `${c.category} (FC)` : c.category,
      cells: [
        formatValue(c.AC, format),
        c.comparisonValue != null && isFinite(c.comparisonValue)
          ? formatValue(c.comparisonValue, format)
          : "n/a",
        c.variance ? formatSigned(c.variance.abs, format) : "n/a",
        c.variance ? formatPercent(c.variance.pct) : "n/a",
      ],
    }));
    if (fy) {
      a11yRows.push({
        label: fy.label,
        cells: [formatValue(fy.total, format), "n/a", "n/a", "n/a"],
      });
    }

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
              ? `${title}. Integrated variance: Δ${comparison}% pins, Δ${comparison} bars, and AC versus ${comparison} columns.`
              : `Integrated variance of AC versus ${comparison}`
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
          <defs>
            <pattern
              id={hatchAC}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.scenario.AC.fill} strokeWidth="1" />
            </pattern>
            <pattern
              id={hatchGood}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.color.good} strokeWidth="1.4" />
            </pattern>
            <pattern
              id={hatchBad}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.color.bad} strokeWidth="1.4" />
            </pattern>
          </defs>

          {title && (
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, width - padL - padR, 13)}
            </text>
          )}

          {/* ── TOP panel: Δ% pins ─────────────────────────────────────────── */}
          {showPct && (
            <>
              <line
                x1={padL}
                y1={pctMid}
                x2={padL + monthsW}
                y2={pctMid}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              {cells.map((c, i) => {
                const v = c.variance;
                if (!v || v.pct == null || !isFinite(v.pct)) return null;
                const cx = cxOf(i);
                const mag = Math.abs(v.pct);
                const offScale = mag >= pctClamp;
                const frac = offScale ? 1 : mag / pctMax;
                const len = Math.min(frac, 1) * pctHalf * grow;
                const color =
                  v.abs === 0
                    ? tokens.color.zero
                    : v.favorable
                      ? tokens.color.good
                      : tokens.color.bad;
                const up = v.favorable;
                const tipY = up ? pctMid - len : pctMid + len;
                const label = formatPercent(v.pct);
                return (
                  <g key={`pct-${c.category}`}>
                    <line x1={cx} y1={pctMid} x2={cx} y2={tipY} stroke={color} strokeWidth={2} />
                    {offScale ? (
                      // Off-scale: an arrow tip in the favorability direction.
                      <path
                        d={
                          up
                            ? `M${cx - 4},${tipY + 4} L${cx + 4},${tipY + 4} L${cx},${tipY - 3} Z`
                            : `M${cx - 4},${tipY - 4} L${cx + 4},${tipY - 4} L${cx},${tipY + 3} Z`
                        }
                        fill={color}
                      />
                    ) : c.isForecast ? (
                      // Forecast: a hollow (outlined) square tip — "expected".
                      <rect
                        x={cx - 3.2}
                        y={tipY - 3.2}
                        width={6.4}
                        height={6.4}
                        fill={tokens.color.surface}
                        stroke={color}
                        strokeWidth={1.3}
                      />
                    ) : v.abs === 0 ? (
                      <circle cx={cx} cy={tipY} r={2.4} fill={color} />
                    ) : (
                      <rect x={cx - 3.2} y={tipY - 3.2} width={6.4} height={6.4} fill={color} />
                    )}
                    {estTextW(label, 9) <= band - 1 && (
                      <text
                        x={clampTo(
                          cx,
                          padL + estTextW(label, 9) / 2,
                          padL + monthsW - estTextW(label, 9) / 2,
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
              })}
            </>
          )}

          {/* ── MIDDLE panel: Δ absolute bars ──────────────────────────────── */}
          {showAbs && (
            <>
              <line
                x1={padL}
                y1={absMid}
                x2={padL + monthsW}
                y2={absMid}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              {cells.map((c, i) => {
                const v = c.variance;
                if (!v) return null;
                const cx = cxOf(i);
                const len = (Math.abs(v.abs) / absMax) * absHalf * grow;
                const color =
                  v.abs === 0
                    ? tokens.color.zero
                    : v.favorable
                      ? tokens.color.good
                      : tokens.color.bad;
                const up = v.favorable;
                const y = up ? absMid - len : absMid;
                const hatch = v.favorable ? hatchGood : hatchBad;
                const label = formatSigned(v.abs, format);
                return (
                  <g key={`abs-${c.category}`}>
                    <rect
                      x={cx - acW / 2}
                      y={y}
                      width={acW}
                      height={Math.max(len, 1)}
                      fill={c.isForecast ? `url(#${hatch})` : color}
                      stroke={c.isForecast ? color : "none"}
                      strokeWidth={c.isForecast ? 0.9 : 0}
                    />
                    {estTextW(label, 9) <= band - 1 && (
                      <text
                        x={clampTo(
                          cx,
                          padL + estTextW(label, 9) / 2,
                          padL + monthsW - estTextW(label, 9) / 2,
                        )}
                        y={up ? absMid - len - 4 : absMid + len + 11}
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

          {/* ── BOTTOM panel: AC columns vs comparison ─────────────────────── */}
          <line
            x1={padL}
            y1={colZeroY}
            x2={width - padR}
            y2={colZeroY}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {cells.map((c, i) => {
            // `cells` is `data.map(…)`, so the datum at this index always exists.
            const datum = data[i];
            if (!datum) return null;
            const cx = cxOf(i);
            const cmp = c.comparisonValue;
            const info = {
              category: c.category,
              scenario: (c.isForecast ? "FC" : "AC") as ScenarioKey,
              value: c.AC,
              datum,
            };
            const acTop = Math.min(colZeroY, gYcol(c.AC));
            const acH = Math.abs(gYcol(c.AC) - colZeroY);
            // This period's visible marks across the three panels, in FINAL
            // (un-animated) geometry: the AC column first (focus/tap anchor),
            // the comparison column, then each Δ panel's lane at the mark's
            // width. The hit band above stays the generous target.
            const acY = yOfCol(c.AC);
            const markRects: MarkRect[] = [
              {
                x: cx - acW / 2,
                y: Math.min(colZeroY, acY),
                width: acW,
                height: Math.abs(acY - colZeroY),
              },
            ];
            if (cmp != null && isFinite(cmp))
              markRects.push({
                x: cx - pyW / 2,
                y: Math.min(colZeroY, yOfCol(cmp)),
                width: pyW,
                height: Math.abs(yOfCol(cmp) - colZeroY),
              });
            if (showAbs && c.variance)
              markRects.push({ x: cx - acW / 2, y: absMid - absH / 2, width: acW, height: absH });
            if (showPct && c.variance?.pct != null && isFinite(c.variance.pct))
              markRects.push({ x: cx - 5, y: pctMid - pctH / 2, width: 10, height: pctH });
            return (
              <g key={`col-${c.category}`} {...marks.forMark(info, markRects)}>
                {/* Full-band hit target across the panels for this period */}
                {hoverEnabled && (
                  <rect
                    x={cxOf(i) - band / 2}
                    y={padT}
                    width={band}
                    height={colBase - padT}
                    fill="transparent"
                  />
                )}
                {/* Comparison reference behind, in its own IBCS notation: PY solid
                grey, PL a hollow white frame ("the plan hasn't happened"). */}
                {cmp != null &&
                  isFinite(cmp) &&
                  (() => {
                    const st = tokens.scenario[comparison];
                    const r = {
                      x: cx - pyW / 2,
                      y: Math.min(colZeroY, gYcol(cmp)),
                      width: pyW,
                      height: Math.abs(gYcol(cmp) - colZeroY),
                    };
                    if (st.variant === "frame")
                      return (
                        <rect
                          {...r}
                          fill={tokens.color.surface}
                          stroke={st.stroke}
                          strokeWidth={1.25}
                        />
                      );
                    return <rect {...r} fill={st.fill} />;
                  })()}
                {/* Actual in front: solid, or hatched when this period is forecast. */}
                <rect
                  x={cx - acW / 2}
                  y={acTop}
                  width={acW}
                  height={Math.max(acH, 0.5)}
                  fill={c.isForecast ? `url(#${hatchAC})` : tokens.scenario.AC.fill}
                  stroke={c.isForecast ? tokens.scenario.AC.stroke : "none"}
                  strokeWidth={c.isForecast ? 0.75 : 0}
                />
                {/* AC value label above the column (above zero for negatives). */}
                {(() => {
                  const s = formatValue(c.AC, format);
                  if (estTextW(s, 10) > band - 1) return null;
                  const lx = clampTo(
                    cx,
                    padL + estTextW(s, 10) / 2,
                    padL + monthsW - estTextW(s, 10) / 2,
                  );
                  return (
                    <text
                      x={lx}
                      y={Math.min(colZeroY, gYcol(c.AC)) - 5}
                      fontSize={10}
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

          {/* FY TOTAL column, set apart to the right (bottom panel only) */}
          {fy && (
            <g>
              <line
                x1={fyDividerX}
                y1={colTopY}
                x2={fyDividerX}
                y2={colBase}
                stroke={tokens.color.gridline}
                strokeWidth={1}
              />
              {fy.segments.map((seg, si) => {
                const y0 = gYcol(seg.y0);
                const y1 = gYcol(seg.y1);
                const segTop = Math.min(y0, y1);
                const segH = Math.abs(y1 - y0);
                const fill = si % 2 === 0 ? tokens.color.total : tokens.color.neutral;
                const sLabel = formatValue(seg.value, format);
                return (
                  <g key={`fy-${si}`}>
                    <rect
                      x={fyCx - fyColW / 2}
                      y={segTop}
                      width={fyColW}
                      height={Math.max(segH, 0.5)}
                      fill={fill}
                    />
                    {/* Segment label, centred in its band when it fits */}
                    {segH >= 13 &&
                      estTextW(sLabel, 9.5) <= fyColW + 6 &&
                      fy.segments.length > 1 && (
                        <text
                          x={fyCx}
                          y={segTop + segH / 2 + 3.5}
                          fontSize={9.5}
                          fill={tokens.color.onFill}
                          textAnchor="middle"
                        >
                          {sLabel}
                        </text>
                      )}
                  </g>
                );
              })}
              {/* Grand-total label above the stack */}
              {(() => {
                const s = formatValue(fy.total, format);
                const topY = Math.min(gYcol(0), gYcol(fy.total));
                return (
                  <text
                    x={fyCx}
                    y={topY - 5}
                    fontSize={10.5}
                    fontWeight={600}
                    fill={tokens.color.text}
                    textAnchor="middle"
                  >
                    {fitLabel(s, fyArea, 10.5)}
                  </text>
                );
              })()}
              <text
                x={fyCx}
                y={height - 6}
                fontSize={11}
                fontWeight={600}
                fill={tokens.color.text}
                textAnchor="middle"
              >
                {fitLabel(fy.label, fyArea, 11)}
              </text>
            </g>
          )}

          {/* Shared category labels (bottom) */}
          {cells.map((c, i) => (
            <text
              key={`lab-${c.category}`}
              x={cxOf(i)}
              y={height - 6}
              fontSize={11}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {fitLabel(c.category, band - 2, 11)}
            </text>
          ))}
        </svg>
        <ChartDataTable
          caption={
            title
              ? `${title} — data table`
              : `Integrated variance of AC versus ${comparison} — data table`
          }
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
