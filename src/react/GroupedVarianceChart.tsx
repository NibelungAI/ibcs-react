import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import {
  computeGroupedVariance,
  type GroupedDatum,
  type GroupedComparison,
} from "../core/groupedVariance";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";

export type { GroupedDatum, GroupedComparison } from "../core/groupedVariance";

export interface GroupedVarianceChartProps {
  /** Categories, each an AC drawn next to one comparison value. */
  data: GroupedDatum[];
  /**
   * "column" = vertical grouped columns with the variance tiers STACKED above
   * (IBCS C03). "bar" = horizontal grouped bars with the variance tiers as
   * SIDE-BY-SIDE panels left→right (IBCS C04 / income-statement). Default
   * "column".
   */
  orientation?: "column" | "bar";
  /**
   * Scenario the comparison bar represents — drives its IBCS notation (PY solid
   * grey, PL a hollow white frame, FC hatched) and the Δ headers. Default "PL".
   */
  comparison?: GroupedComparison;
  /** Whether a higher value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /** Show the absolute (Δ) variance panel. Default true. */
  showAbsPanel?: boolean;
  /** Show the relative (Δ%) variance panel. Default true. */
  showPctPanel?: boolean;
  /**
   * A |Δ%| at or beyond this PERCENT is drawn as an off-scale arrow and excluded
   * from the Δ% tier's scale (so one near-zero comparison can't flatten it).
   * Default 100.
   */
  clampPct?: number;
  width?: number;
  height?: number;
  /**
   * Categorical band layout — the gap between category groups and the
   * lead-in/out gutter (vertical for the "bar" orientation). Omit for the
   * centred default; pass `{ outer: 0 }` to trim the side whitespace so the
   * first/last groups sit flush to the plot edges (fill edge-to-edge).
   */
  bandPadding?: BandPadding;
  format?: FormatOptions;
  /** Token override merged over the nearest {@link IbcsThemeProvider} theme. */
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class applied to the chart `<svg>` (the root element). */
  className?: string;
  /** Styles merged *over* the chart's own layout styles. */
  style?: CSSProperties;
  /**
   * Fired as the pointer moves over / leaves a category (`null` on leave) — for
   * a custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<GroupedDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on category hover or keyboard focus (AC,
   * the comparison value, Δ and Δ%). Default true; set false to opt out.
   * Renders on the client only, near a hovered mark (or the focused / tapped
   * one); Escape dismisses it.
   */
  tooltip?: boolean;
}

/**
 * GroupedVarianceChart — the classic IBCS grouped multi-tier chart (templates
 * C03 column / C04 bar). For each category an ACTUAL bar is drawn ADJACENT to a
 * single comparison bar (PY solid grey, PL a hollow white frame, FC hatched),
 * NOT overlapped like {@link VarianceColumnChart}/IntegratedVarianceChart. On
 * top sit two optional variance tiers sharing the same category axis:
 *
 *  • Δ absolute — bars from a zero line, green when favorable / red when not,
 *    hatched for forecast categories.
 *  • Δ% relative — pins (lollipops) from a zero line, off-scale percents pinned
 *    to the edge with an arrow.
 *
 * orientation "column" stacks the tiers vertically (Δ% top, Δabs middle,
 * grouped columns bottom); orientation "bar" lays them side-by-side
 * (grouped bars | Δabs | Δ%) with rows aligned. Variance is coloured by IMPACT
 * (good/bad/zero, respecting `higherIsBetter`), never raw sign, and is always
 * signed. Every tier carries a zero baseline. Robust to empty / single /
 * negative / huge / tiny data and long labels (truncated, clamped on-canvas).
 * Grows on mount. Zero-dependency, pure SVG, SSR-safe.
 *
 * The svg is the chart's root element in BOTH orientations — it takes
 * `className` / `style` and the forwarded ref, and carries the accessible name
 * (`role="img"` + `aria-label`; never `aria-hidden`, which would cancel it).
 * The sr-only {@link ChartDataTable} beneath it gives assistive tech the actual
 * numbers; the built-in tooltip portals to `document.body` and flips at the
 * viewport edges.
 */
export const GroupedVarianceChart = forwardRef<SVGSVGElement, GroupedVarianceChartProps>(
  function GroupedVarianceChart(
    {
      data: dataProp,
      orientation = "column",
      comparison = "PL",
      higherIsBetter = true,
      showAbsPanel = true,
      showPctPanel = true,
      clampPct = 100,
      width = 640,
      height = 440,
      bandPadding,
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
    // `useId()` values contain ":" in React 18 — sanitized so the `url(#…)` refs
    // survive serialization / querySelector after an SVG export.
    const hatchAC = svgSafeId(useId());
    const hatchCmp = svgSafeId(useId());
    const hatchGood = svgSafeId(useId());
    const hatchBad = svgSafeId(useId());
    const data = useDataTween(dataProp);
    const grow = useMountGrow(700, 0, data);
    const hover = useChartHover<GroupedDatum>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;

    const layout = useMemo(
      () => computeGroupedVariance(data, { comparison, higherIsBetter, pctClamp: clampPct / 100 }),
      [data, comparison, higherIsBetter, clampPct],
    );
    const { cells, domainMin, domainMax, absMax, pctMax, pctClamp } = layout;

    const showAbs = showAbsPanel;
    const showPct = showPctPanel;
    const n = cells.length;

    // ── Shared: scenario styling for the comparison bar (its own IBCS notation) ──
    const cmpStyle = tokens.scenario[comparison];
    const cmpRectProps = (geom: { x: number; y: number; width: number; height: number }) => {
      if (cmpStyle.variant === "frame")
        return { ...geom, fill: tokens.color.surface, stroke: cmpStyle.stroke, strokeWidth: 1.25 };
      if (cmpStyle.variant === "hatch")
        return { ...geom, fill: `url(#${hatchCmp})`, stroke: cmpStyle.stroke, strokeWidth: 1 };
      return { ...geom, fill: cmpStyle.fill };
    };
    const acFill = (forecast: boolean) =>
      forecast
        ? { fill: `url(#${hatchAC})`, stroke: tokens.scenario.AC.stroke, strokeWidth: 0.75 }
        : { fill: tokens.scenario.AC.fill };

    // ── Built-in tooltip rows for the hovered category (shared by both layouts) ──
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

    const defs = (
      <defs>
        <pattern
          id={hatchAC}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.scenario.AC.stroke} strokeWidth="1" />
        </pattern>
        <pattern
          id={hatchCmp}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke={cmpStyle.stroke} strokeWidth="1" />
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
    );

    // Shared by both orientations; the caller's `style` wins over the base rules.
    const svgStyle: CSSProperties = {
      display: "block",
      maxWidth: "100%",
      marginInline: "auto",
      fontFamily: tokens.font.family,
      ...style,
    };

    // Screen-reader data table: each category's AC, the comparison, and Δ / Δ% —
    // shared by both orientations, so SR users read values, not the svg.
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
    const a11yTable = (
      <ChartDataTable
        caption={title ? `${title} — data table` : `Grouped AC versus ${comparison} — data table`}
        columns={a11yColumns}
        rows={a11yRows}
      />
    );

    // ════════════════════════════════════════════════════════════════════════
    //  COLUMN orientation (C03): tiers STACKED vertically over a category axis.
    // ════════════════════════════════════════════════════════════════════════
    if (orientation === "column") {
      const padL = 14;
      const padR = 14;
      const padT = title ? 32 : 16;
      const labelH = 22;
      const gap = 16;

      const nGaps = (showPct ? 1 : 0) + (showAbs ? 1 : 0);
      const availH = Math.max(height - padT - labelH - nGaps * gap, 1);
      const pctH = showPct ? Math.round(availH * 0.2) : 0;
      const absH = showAbs ? Math.round(availH * 0.2) : 0;
      const colPanelH = Math.max(availH - pctH - absH, 1);

      let cursor = padT;
      const pctTop = cursor;
      if (showPct) cursor += pctH + gap;
      const absTop = cursor;
      if (showAbs) cursor += absH + gap;
      const colTopY = cursor;
      const colBase = colTopY + colPanelH;

      const innerW = width - padL - padR;
      // Category-group band layout. Each group holds two adjacent sub-bars whose
      // content spans 2·barW + innerGap = 0.66·step, so the default reproduces the
      // historical centred look exactly; `bandPadding` (e.g. `{ outer: 0 }`) trims
      // the gutter so the groups fill the plot edge-to-edge.
      const scale = bandScale(innerW, n, resolveBandPadding(0.66, bandPadding), padL);
      const band = scale.step;
      const cxOf = (i: number) => scale.center(i);

      // Two adjacent bars per band, centred on the band middle.
      const barW = Math.min(band * 0.3, 34);
      const innerGap = Math.min(band * 0.06, 4);
      const acCx = (cx: number) => cx - (barW / 2 + innerGap / 2);
      const cmpCx = (cx: number) => cx + (barW / 2 + innerGap / 2);
      const varW = Math.min(band * 0.42, 46);

      const labelTopH = 14;
      const range = domainMax - domainMin || 1;
      const colScaleH = Math.max(colPanelH - labelTopH, 1);
      const yOfCol = (v: number) => colBase - ((v - domainMin) / range) * colScaleH;
      const colZeroY = yOfCol(0);
      const gYcol = (v: number) => colZeroY + (yOfCol(v) - colZeroY) * grow;

      const pctMid = pctTop + pctH / 2;
      const pctHalf = Math.max(pctH / 2 - 11, 1);
      const absMid = absTop + absH / 2;
      const absHalf = Math.max(absH / 2 - 11, 1);

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
                ? `${title}. Grouped columns: AC versus ${comparison}, with Δ${comparison} and Δ${comparison}% tiers.`
                : `Grouped columns of AC versus ${comparison}`
            }
            className={className}
            style={svgStyle}
          >
            {defs}

            {title && (
              <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
                {fitLabel(title, width - padL - padR, 13)}
              </text>
            )}

            {/* ── TOP tier: Δ% pins ─────────────────────────────────────────── */}
            {showPct && (
              <>
                <line
                  x1={padL}
                  y1={pctMid}
                  x2={width - padR}
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
                        <path
                          d={
                            up
                              ? `M${cx - 4},${tipY + 4} L${cx + 4},${tipY + 4} L${cx},${tipY - 3} Z`
                              : `M${cx - 4},${tipY - 4} L${cx + 4},${tipY - 4} L${cx},${tipY + 3} Z`
                          }
                          fill={color}
                        />
                      ) : c.isForecast ? (
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
                })}
              </>
            )}

            {/* ── MIDDLE tier: Δ absolute bars ──────────────────────────────── */}
            {showAbs && (
              <>
                <line
                  x1={padL}
                  y1={absMid}
                  x2={width - padR}
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
                        x={cx - varW / 2}
                        y={y}
                        width={varW}
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
                            width - padR - estTextW(label, 9) / 2,
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

            {/* ── BOTTOM tier: grouped AC + comparison columns ──────────────── */}
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
              const aCx = acCx(cx);
              const mCx = cmpCx(cx);
              const acTop = Math.min(colZeroY, gYcol(c.AC));
              const acH = Math.abs(gYcol(c.AC) - colZeroY);
              // This category's visible marks across the three tiers, in FINAL
              // (un-animated) geometry: the AC column first (focus/tap anchor),
              // the adjacent comparison column, then each Δ tier's lane at the
              // mark's width. The hit band above stays the generous target.
              const acYcol = yOfCol(c.AC);
              const markRects: MarkRect[] = [
                {
                  x: aCx - barW / 2,
                  y: Math.min(colZeroY, acYcol),
                  width: barW,
                  height: Math.abs(acYcol - colZeroY),
                },
              ];
              if (cmp != null && isFinite(cmp))
                markRects.push({
                  x: mCx - barW / 2,
                  y: Math.min(colZeroY, yOfCol(cmp)),
                  width: barW,
                  height: Math.abs(yOfCol(cmp) - colZeroY),
                });
              if (showAbs && c.variance)
                markRects.push({
                  x: cx - varW / 2,
                  y: absMid - absH / 2,
                  width: varW,
                  height: absH,
                });
              if (showPct && c.variance?.pct != null && isFinite(c.variance.pct))
                markRects.push({ x: cx - 5, y: pctMid - pctH / 2, width: 10, height: pctH });
              return (
                <g key={`col-${c.category}`} {...marks.forMark(info, markRects)}>
                  {hoverEnabled && (
                    <rect
                      x={cxOf(i) - band / 2}
                      y={padT}
                      width={band}
                      height={colBase - padT}
                      fill="transparent"
                    />
                  )}
                  {/* Comparison column (its own IBCS notation), beside the actual. */}
                  {cmp != null && isFinite(cmp) && (
                    <rect
                      {...cmpRectProps({
                        x: mCx - barW / 2,
                        y: Math.min(colZeroY, gYcol(cmp)),
                        width: barW,
                        height: Math.abs(gYcol(cmp) - colZeroY),
                      })}
                    />
                  )}
                  {/* Actual column: solid, or hatched when this category is forecast. */}
                  <rect
                    x={aCx - barW / 2}
                    y={acTop}
                    width={barW}
                    height={Math.max(acH, 0.5)}
                    {...acFill(c.isForecast)}
                  />
                  {/* AC value label above its bar (above zero for negatives). */}
                  {(() => {
                    const s = formatValue(c.AC, format);
                    if (estTextW(s, 9.5) > band / 2) return null;
                    const lx = clampTo(
                      aCx,
                      padL + estTextW(s, 9.5) / 2,
                      width - padR - estTextW(s, 9.5) / 2,
                    );
                    return (
                      <text
                        x={lx}
                        y={Math.min(colZeroY, gYcol(c.AC)) - 4}
                        fontSize={9.5}
                        fill={tokens.color.text}
                        textAnchor="middle"
                      >
                        {s}
                      </text>
                    );
                  })()}
                  {/* Comparison value label above its bar. */}
                  {cmp != null &&
                    isFinite(cmp) &&
                    (() => {
                      const s = formatValue(cmp, format);
                      if (estTextW(s, 9.5) > band / 2) return null;
                      const lx = clampTo(
                        mCx,
                        padL + estTextW(s, 9.5) / 2,
                        width - padR - estTextW(s, 9.5) / 2,
                      );
                      return (
                        <text
                          x={lx}
                          y={Math.min(colZeroY, gYcol(cmp)) - 4}
                          fontSize={9.5}
                          fill={tokens.color.textMuted}
                          textAnchor="middle"
                        >
                          {s}
                        </text>
                      );
                    })()}
                  {/* Category label under the tier. */}
                  <text
                    x={cx}
                    y={height - 6}
                    fontSize={11}
                    fill={tokens.color.textMuted}
                    textAnchor="middle"
                  >
                    {fitLabel(c.category, band - 2, 11)}
                  </text>
                </g>
              );
            })}
          </svg>
          {a11yTable}
          {renderTooltip()}
        </>
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    //  BAR orientation (C04): tiers SIDE-BY-SIDE panels, rows aligned.
    // ════════════════════════════════════════════════════════════════════════
    const padL = 14;
    const padR = 14;
    const padT = title ? 32 : 16;
    const headerH = 18;
    const labelW = Math.min(Math.max(width * 0.2, 70), 150);

    const rowsTop = padT + headerH;
    const availH = Math.max(height - rowsTop - 8, 1);
    // Vertical category-group band layout (rows). Each row holds two stacked
    // sub-bars whose content spans 2·barH + innerGapV = 0.66·step, so the default
    // reproduces the historical even rows exactly; `bandPadding` (e.g.
    // `{ outer: 0 }`) trims the gutter so the rows fill top-to-bottom.
    const scale = bandScale(availH, n, resolveBandPadding(0.66, bandPadding), rowsTop);
    const rowH = scale.step;
    const rowCy = (i: number) => scale.center(i);
    const rowsBottom = rowsTop + rowH * n;

    // Horizontal panels left→right: grouped (wide) | Δabs | Δ%.
    const panelGap = 14;
    const x0 = padL + labelW;
    const numPanels = 1 + (showAbs ? 1 : 0) + (showPct ? 1 : 0);
    const wGrouped = 1.7;
    const wAbs = showAbs ? 1 : 0;
    const wPct = showPct ? 1 : 0;
    const totalW = wGrouped + wAbs + wPct;
    const panelsAvail = Math.max(width - padR - x0 - panelGap * (numPanels - 1), 1);
    const unit = panelsAvail / totalW;

    let pcur = x0;
    const groupedX0 = pcur;
    const groupedW = unit * wGrouped;
    pcur += groupedW + panelGap;
    const absX0 = pcur;
    const absPanelW = showAbs ? unit * wAbs : 0;
    if (showAbs) pcur += absPanelW + panelGap;
    const pctX0 = pcur;
    const pctPanelW = showPct ? unit * wPct : 0;

    // Grouped value→x mapping (zero baseline inside the panel).
    const gRange = domainMax - domainMin || 1;
    const xOfVal = (v: number) => groupedX0 + ((v - domainMin) / gRange) * groupedW;
    const gZeroX = xOfVal(0);
    const gX = (v: number) => gZeroX + (xOfVal(v) - gZeroX) * grow;

    // Two stacked bars per row (AC top, comparison bottom).
    const barH = Math.min(rowH * 0.3, 16);
    const innerGapV = Math.min(rowH * 0.06, 4);
    const acCy = (cy: number) => cy - (barH / 2 + innerGapV / 2);
    const cmpCy = (cy: number) => cy + (barH / 2 + innerGapV / 2);
    const varBarH = Math.min(rowH * 0.42, 22);

    // Variance panels: centred zero (favorable extends right), half-scale reserved.
    const absMidX = absX0 + absPanelW / 2;
    const absHalfX = Math.max(absPanelW / 2 - 6, 1);
    const pctMidX = pctX0 + pctPanelW / 2;
    const pctHalfX = Math.max(pctPanelW / 2 - 6, 1);

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
              ? `${title}. Grouped bars: AC versus ${comparison}, with Δ${comparison} and Δ${comparison}% panels.`
              : `Grouped bars of AC versus ${comparison}`
          }
          className={className}
          style={svgStyle}
        >
          {defs}

          {title && (
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, width - padL - padR, 13)}
            </text>
          )}

          {/* Panel headers */}
          <text
            x={groupedX0}
            y={padT + 12}
            fontSize={10.5}
            fontWeight={600}
            fill={tokens.color.textMuted}
          >
            {fitLabel(`AC / ${comparison}`, groupedW, 10.5)}
          </text>
          {showAbs && (
            <text
              x={absMidX}
              y={padT + 12}
              fontSize={10.5}
              fontWeight={600}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {fitLabel(`Δ${comparison}`, absPanelW, 10.5)}
            </text>
          )}
          {showPct && (
            <text
              x={pctMidX}
              y={padT + 12}
              fontSize={10.5}
              fontWeight={600}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {fitLabel(`Δ${comparison}%`, pctPanelW, 10.5)}
            </text>
          )}

          {/* Zero baselines (vertical) per panel */}
          <line
            x1={gZeroX}
            y1={rowsTop}
            x2={gZeroX}
            y2={rowsBottom}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />
          {showAbs && (
            <line
              x1={absMidX}
              y1={rowsTop}
              x2={absMidX}
              y2={rowsBottom}
              stroke={tokens.color.axis}
              strokeWidth={1}
            />
          )}
          {showPct && (
            <line
              x1={pctMidX}
              y1={rowsTop}
              x2={pctMidX}
              y2={rowsBottom}
              stroke={tokens.color.axis}
              strokeWidth={1}
            />
          )}

          {cells.map((c, i) => {
            // `cells` is `data.map(…)`, so the datum at this index always exists.
            const datum = data[i];
            if (!datum) return null;
            const cy = rowCy(i);
            const cmp = c.comparisonValue;
            const v = c.variance;
            const info = {
              category: c.category,
              scenario: (c.isForecast ? "FC" : "AC") as ScenarioKey,
              value: c.AC,
              datum,
            };
            const aCy = acCy(cy);
            const mCy = cmpCy(cy);
            const acX = Math.min(gZeroX, gX(c.AC));
            const acW = Math.abs(gX(c.AC) - gZeroX);
            // This row's visible marks across the side-by-side panels, in FINAL
            // (un-animated) geometry: the AC bar first (focus/tap anchor), the
            // comparison bar, then each Δ panel's lane at the mark's height.
            // The hit row above stays the generous target.
            const acXf = xOfVal(c.AC);
            const markRects: MarkRect[] = [
              {
                x: Math.min(gZeroX, acXf),
                y: aCy - barH / 2,
                width: Math.abs(acXf - gZeroX),
                height: barH,
              },
            ];
            if (cmp != null && isFinite(cmp))
              markRects.push({
                x: Math.min(gZeroX, xOfVal(cmp)),
                y: mCy - barH / 2,
                width: Math.abs(xOfVal(cmp) - gZeroX),
                height: barH,
              });
            if (showAbs && v)
              markRects.push({
                x: absMidX - absPanelW / 2,
                y: cy - varBarH / 2,
                width: absPanelW,
                height: varBarH,
              });
            if (showPct && v && v.pct != null && isFinite(v.pct))
              markRects.push({
                x: pctMidX - pctPanelW / 2,
                y: cy - 5,
                width: pctPanelW,
                height: 10,
              });
            return (
              <g key={`row-${c.category}`} {...marks.forMark(info, markRects)}>
                {hoverEnabled && (
                  <rect
                    x={padL}
                    y={rowCy(i) - rowH / 2}
                    width={width - padL - padR}
                    height={rowH}
                    fill="transparent"
                  />
                )}

                {/* Category label (left column, right-aligned) */}
                <text
                  x={x0 - 8}
                  y={cy + 3.5}
                  fontSize={11}
                  fill={tokens.color.text}
                  textAnchor="end"
                >
                  {fitLabel(c.category, labelW - 10, 11)}
                </text>

                {/* Grouped bars: comparison behind/below, actual above. */}
                {cmp != null && isFinite(cmp) && (
                  <rect
                    {...cmpRectProps({
                      x: Math.min(gZeroX, gX(cmp)),
                      y: mCy - barH / 2,
                      width: Math.abs(gX(cmp) - gZeroX),
                      height: barH,
                    })}
                  />
                )}
                <rect
                  x={acX}
                  y={aCy - barH / 2}
                  width={Math.max(acW, 0.5)}
                  height={barH}
                  {...acFill(c.isForecast)}
                />

                {/* AC value label at the bar tip */}
                {(() => {
                  const s = formatValue(c.AC, format);
                  const tip = gX(c.AC);
                  const right = c.AC >= 0;
                  const lx = clampTo(
                    right ? tip + 3 : tip - 3,
                    groupedX0 + 1,
                    groupedX0 + groupedW - 1,
                  );
                  if (
                    estTextW(s, 9) >
                    Math.abs(right ? groupedX0 + groupedW - tip : tip - groupedX0) + barH
                  )
                    return null;
                  return (
                    <text
                      x={lx}
                      y={aCy + 3.2}
                      fontSize={9}
                      fill={tokens.color.text}
                      textAnchor={right ? "start" : "end"}
                    >
                      {s}
                    </text>
                  );
                })()}

                {/* Δ absolute bar (horizontal, favorable → right) */}
                {showAbs &&
                  v &&
                  (() => {
                    const len = (Math.abs(v.abs) / absMax) * absHalfX * grow;
                    const color =
                      v.abs === 0
                        ? tokens.color.zero
                        : v.favorable
                          ? tokens.color.good
                          : tokens.color.bad;
                    const right = v.favorable;
                    const bx = right ? absMidX : absMidX - len;
                    const hatch = v.favorable ? hatchGood : hatchBad;
                    const label = formatSigned(v.abs, format);
                    return (
                      <g>
                        <rect
                          x={bx}
                          y={cy - varBarH / 2}
                          width={Math.max(len, 1)}
                          height={varBarH}
                          fill={c.isForecast ? `url(#${hatch})` : color}
                          stroke={c.isForecast ? color : "none"}
                          strokeWidth={c.isForecast ? 0.9 : 0}
                        />
                        {estTextW(label, 9) <= absHalfX && (
                          <text
                            x={clampTo(
                              right ? absMidX + len + 3 : absMidX - len - 3,
                              absX0 + estTextW(label, 9) / 2,
                              absX0 + absPanelW - estTextW(label, 9) / 2,
                            )}
                            y={cy + 3.2}
                            fontSize={9}
                            fill={color}
                            textAnchor="middle"
                          >
                            {label}
                          </text>
                        )}
                      </g>
                    );
                  })()}

                {/* Δ% pin (horizontal lollipop, off-scale → arrow) */}
                {showPct &&
                  v &&
                  v.pct != null &&
                  isFinite(v.pct) &&
                  (() => {
                    const mag = Math.abs(v.pct);
                    const offScale = mag >= pctClamp;
                    const frac = offScale ? 1 : mag / pctMax;
                    const len = Math.min(frac, 1) * pctHalfX * grow;
                    const color =
                      v.abs === 0
                        ? tokens.color.zero
                        : v.favorable
                          ? tokens.color.good
                          : tokens.color.bad;
                    const right = v.favorable;
                    const tipX = right ? pctMidX + len : pctMidX - len;
                    const label = formatPercent(v.pct);
                    return (
                      <g>
                        <line
                          x1={pctMidX}
                          y1={cy}
                          x2={tipX}
                          y2={cy}
                          stroke={color}
                          strokeWidth={2}
                        />
                        {offScale ? (
                          <path
                            d={
                              right
                                ? `M${tipX - 4},${cy - 4} L${tipX - 4},${cy + 4} L${tipX + 3},${cy} Z`
                                : `M${tipX + 4},${cy - 4} L${tipX + 4},${cy + 4} L${tipX - 3},${cy} Z`
                            }
                            fill={color}
                          />
                        ) : c.isForecast ? (
                          <rect
                            x={tipX - 3.2}
                            y={cy - 3.2}
                            width={6.4}
                            height={6.4}
                            fill={tokens.color.surface}
                            stroke={color}
                            strokeWidth={1.3}
                          />
                        ) : v.abs === 0 ? (
                          <circle cx={tipX} cy={cy} r={2.4} fill={color} />
                        ) : (
                          <rect x={tipX - 3.2} y={cy - 3.2} width={6.4} height={6.4} fill={color} />
                        )}
                        {estTextW(label, 9) <= pctHalfX && (
                          <text
                            x={clampTo(
                              right ? tipX + 3 : tipX - 3,
                              pctX0 + estTextW(label, 9) / 2,
                              pctX0 + pctPanelW - estTextW(label, 9) / 2,
                            )}
                            y={cy - 6}
                            fontSize={9}
                            fill={color}
                            textAnchor="middle"
                          >
                            {label}
                          </text>
                        )}
                      </g>
                    );
                  })()}
              </g>
            );
          })}
        </svg>
        {a11yTable}
        {renderTooltip()}
      </>
    );
  },
);
