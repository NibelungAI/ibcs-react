import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import { SCENARIO_KEYS, type ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import {
  computeRankingVariance,
  type RankingDatum,
  type RankingRow,
  type RankingTotalRow,
} from "../core/rankingVariance";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";
import { useIbcsTokens } from "./theme";

export type { RankingDatum } from "../core/rankingVariance";

export interface RankingVarianceChartProps {
  /**
   * The ranked entities. Each carries an actual (`AC`) and the plan / prior
   * `base` it is compared against; `higherIsBetter` flips favorability for cost
   * rows. Largest variance first by default.
   */
  data: RankingDatum[];
  /**
   * Name of the comparison base, used in the headers (`Δ{baseLabel}`,
   * `Δ{baseLabel}%`) and to pick the reference frame's IBCS notation. When it
   * matches a scenario key ("PL", "PY", "FC") the plan overlay adopts that
   * scenario's style (PL → hollow frame, PY → faded solid, FC → hatched).
   * Default "PL".
   */
  baseLabel?: string;
  /** Row order. "variance" (default, signed ΔPL desc), "value" (AC desc), or "none". */
  sortBy?: "variance" | "value" | "none";
  /** Off-scale threshold for ΔPL%, in percent. Default 100. */
  clampPct?: number;
  /** Total pixel width of the three-panel chart. Default 640. */
  width?: number;
  /** Height of each entity row, in px. Default 26. */
  rowHeight?: number;
  /**
   * Vertical band layout — the row spacing and the top/bottom gutter of the row
   * body. Omit for the default (rows packed flush, top to bottom); pass e.g.
   * `{ inner: 0.2 }` to open a gap between rows, or `{ outer: 0.5 }` to inset the
   * first/last rows. The chart's overall height (rowHeight·rows) is unchanged.
   */
  bandPadding?: BandPadding;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class name for the chart's `<svg>`. */
  className?: string;
  /** Inline style merged over the `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
  /** Render the bold TOTAL row beneath a separating rule. Default true. */
  showTotals?: boolean;
  /**
   * Show the built-in floating tooltip on row hover or keyboard focus (AC,
   * base, Δ, Δ%). Default true; set false to opt out (e.g. when wiring your own
   * via onHover). Renders on the client only, near a hovered mark (or the
   * focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
  /**
   * Fired as the pointer moves over / leaves a row (`null` on leave) — for a
   * custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<RankingRow> | null) => void;
}

/**
 * RankingVarianceChart — an IBCS horizontal *integrated variance* chart
 * (reference #66). A ranked list of entities renders across three aligned
 * panels sharing every row:
 *
 *  1. LEFT   — solid AC bars growing from a left axis, with the plan / prior
 *              `base` overlaid as a scenario-variant reference (PL → a hollow
 *              white frame, PY → a faded solid behind, FC → hatched). The AC
 *              value is labelled at each bar's end, clamped inside the panel.
 *  2. MIDDLE — the absolute variance ΔPL as bars from a CENTER zero axis,
 *              favorable to the right (green) / unfavorable to the left (red),
 *              with off-scale edge arrows beyond the shared scale and signed
 *              impact-coloured labels.
 *  3. RIGHT  — the relative variance ΔPL% as a pin (line + dot) from a center
 *              axis, the same off-scale arrow treatment, and signed % labels.
 *
 * A bold TOTAL row (sum of AC, with its own ΔPL / ΔPL%) sits beneath a rule.
 *
 * Robust to empty / single / negative / zero / huge / tiny data and very long
 * entity labels (truncated with … plus a native `<title>` carrying the full
 * text). Zero-dependency pure SVG, themable through `tokens` (or an enclosing
 * `IbcsThemeProvider`), and SSR-safe (the mount-grow animation and
 * hover/focus tooltip are client-only).
 *
 * The component renders the chart `<svg>`, a screen-reader data table, and
 * (on hover or keyboard focus) a floating tooltip, so `className` / `style` /
 * the forwarded ref all land on the `<svg>`.
 */
export const RankingVarianceChart = forwardRef<SVGSVGElement, RankingVarianceChartProps>(
  function RankingVarianceChart(
    {
      data: dataProp,
      baseLabel = "PL",
      sortBy = "variance",
      clampPct = 100,
      width = 640,
      rowHeight = 26,
      bandPadding,
      format = {},
      tokens: tokenOverride,
      title,
      className,
      style,
      showTotals = true,
      tooltip = true,
      onHover,
    },
    ref,
  ) {
    const tokens = useIbcsTokens(tokenOverride);
    // Sanitised so the id stays a valid selector after an SVG export/serialization.
    const hatchId = svgSafeId(useId());
    const hover = useChartHover<RankingRow>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;

    const data = useDataTween(dataProp);
    const layout = useMemo(
      () => computeRankingVariance(data, { sortBy, clampPct }),
      [data, sortBy, clampPct],
    );
    const { rows, total, acMax, absMax, pctMax } = layout;
    const grow = useMountGrow(700, 0, data);

    // The plan / reference overlay's IBCS notation, derived from baseLabel.
    const baseKey: ScenarioKey = SCENARIO_KEYS.find((k) => k === baseLabel) ?? "PL";
    const baseStyle = tokens.scenario[baseKey];

    // --- vertical layout ------------------------------------------------------
    const rowH = Math.max(14, rowHeight);
    const padL = 12;
    const padR = 12;
    const padT = title ? 30 : 12;
    const headerH = 18;
    const padB = 8;
    const n = rows.length;
    const bodyTop = padT + headerH;
    const bodyH = n * rowH;
    const totalGap = 4;
    const totalH = showTotals ? rowH : 0;
    const totalTop = bodyTop + bodyH + (showTotals ? totalGap : 0);
    const height = totalTop + totalH + padB;

    // Row-band layout (the vertical categorical axis). Each row fills its whole
    // step — the hit target spans the full row — so the historical default is rows
    // packed flush from the top, reproduced exactly by `resolveBandPadding(1)`
    // (step = rowH, no gutter). `bandPadding` lets a caller open up row spacing or
    // a top/bottom gutter (e.g. `{ inner: 0.2 }`) without changing the default.
    const rowScale = bandScale(bodyH, n, resolveBandPadding(1, bandPadding), bodyTop);

    // --- horizontal layout: label | AC panel | gap | ΔPL panel | gap | ΔPL% ----
    const innerW = width - padL - padR;
    const labelW = Math.max(56, Math.min(168, innerW * 0.26));
    const gap = 10;
    const avail = Math.max(innerW - labelW - gap * 2, 60);
    const acPanelW = avail * 0.44;
    const absPanelW = avail * 0.3;
    const pctPanelW = avail * 0.26;

    const labelX0 = padL;
    const acX0 = padL + labelW;
    const acX1 = acX0 + acPanelW;
    const absX0 = acX1 + gap;
    const absX1 = absX0 + absPanelW;
    const pctX0 = absX1 + gap;
    const pctX1 = pctX0 + pctPanelW;

    const absCx = absX0 + absPanelW / 2;
    const pctCx = pctX0 + pctPanelW / 2;

    // AC bars grow from the left axis; reference frame is a touch taller so its
    // outline stays visible around the solid AC bar.
    const acBarH = Math.min(rowH * 0.5, 14);
    const planH = Math.min(rowH * 0.64, 18);
    const acBarAreaW = Math.max(acPanelW - 4, 8);
    const wOfAc = (v: number) => (Math.abs(v) / acMax) * acBarAreaW;

    // Variance panels: reserve an outer label gutter so the signed value never
    // collides with the bar/pin, then scale the marks into what's left.
    const absValW = Math.min(42, absPanelW * 0.42);
    const absBarMax = Math.max(absPanelW / 2 - absValW - 4, 8);
    const absBarH = Math.min(rowH * 0.46, 12);

    const pctValW = Math.min(46, pctPanelW * 0.46);
    const pctBarMax = Math.max(pctPanelW / 2 - pctValW - 4, 8);
    const PIN_R = 3.5;

    const valFont = Math.max(9, Math.min(11, rowH * 0.46));
    const labelFont = Math.max(9, Math.min(12, rowH * 0.5));
    // Below this row height even the floor font would overlap vertically; drop
    // per-row text and keep just the (non-overlapping) bars/pins.
    const showRowText = rowH >= 13;

    const impactColor = (val: number, favorable: boolean) =>
      val === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;

    // --- one row's three marks (shared by data rows and the total) ------------
    const renderMarks = (
      r: RankingRow | RankingTotalRow,
      cy: number,
      emphasis: boolean,
      animate: boolean,
      showAcBar: boolean,
    ) => {
      const g = animate ? grow : 1;
      const acColor = emphasis ? tokens.color.total : tokens.scenario.AC.fill;
      const bH = emphasis ? acBarH + 2 : acBarH;
      const pH = emphasis ? planH + 1 : planH;

      // 1) AC bar + reference overlay.
      const acW = wOfAc(r.ac) * g;
      const planW = wOfAc(r.base) * g;
      const planRect = { x: acX0, y: cy - pH / 2, width: Math.max(planW, 0), height: pH };
      const planBehind = baseStyle.variant === "solid";

      // 2) ΔPL absolute bar from the center axis.
      const aDir = r.abs === 0 ? 0 : r.favorable ? 1 : -1;
      const aColor = impactColor(r.abs, r.favorable);
      const aLen =
        (r.absOutlier ? absBarMax : Math.min(Math.abs(r.abs) / absMax, 1) * absBarMax) * g;
      const aTip = absCx + aDir * aLen;

      // 3) ΔPL% pin from the center axis.
      const pPct = r.pct == null || !Number.isFinite(r.pct) ? null : r.pct * 100;
      const pDir = pPct == null || pPct === 0 ? 0 : r.favorable ? 1 : -1;
      const pColor = impactColor(pPct ?? 0, r.favorable);
      const pFrac = pPct == null ? 0 : Math.min(Math.abs(pPct) / pctMax, 1);
      const pLen = (r.pctOutlier ? pctBarMax : pFrac * pctBarMax) * g;
      const pTip = pctCx + pDir * pLen;

      const aLabel = formatSigned(r.abs, format);
      const pLabel = pPct == null ? "n/a" : formatPercent(r.pct);
      const fontW = emphasis ? 700 : 400;

      // Edge-aligned variance labels: right edge for favorable (right) marks,
      // left edge for unfavorable, centered for zero — always inside the panel.
      const absLabel = (() => {
        if (!showRowText || estTextW(aLabel, valFont) > absValW + 6) return null;
        const x = aDir > 0 ? absX1 - 2 : aDir < 0 ? absX0 + 2 : absCx;
        const anchor: "start" | "middle" | "end" = aDir > 0 ? "end" : aDir < 0 ? "start" : "middle";
        return { x, anchor };
      })();
      const pctLabel = (() => {
        if (!showRowText || estTextW(pLabel, valFont) > pctValW + 8) return null;
        const x = pDir > 0 ? pctX1 - 2 : pDir < 0 ? pctX0 + 2 : pctCx;
        const anchor: "start" | "middle" | "end" = pDir > 0 ? "end" : pDir < 0 ? "start" : "middle";
        return { x, anchor };
      })();

      return (
        <>
          {/* AC bar + plan reference overlay (skipped for the off-scale total) */}
          {showAcBar && planBehind && r.base !== 0 && (
            <rect {...planRect} fill={tokens.scenario[baseKey].fill} />
          )}
          {showAcBar && r.ac !== 0 && (
            <rect x={acX0} y={cy - bH / 2} width={Math.max(acW, 0)} height={bH} fill={acColor} />
          )}
          {showAcBar &&
            !planBehind &&
            r.base !== 0 &&
            (baseStyle.variant === "hatch" ? (
              <rect
                {...planRect}
                fill={`url(#${hatchId})`}
                stroke={baseStyle.stroke}
                strokeWidth={1}
              />
            ) : (
              <rect
                {...planRect}
                fill={tokens.color.surface}
                fillOpacity={0}
                stroke={baseStyle.stroke}
                strokeWidth={1.25}
              />
            ))}

          {/* ΔPL absolute variance bar */}
          {aDir !== 0 && (
            <rect
              x={Math.min(absCx, aTip)}
              y={cy - absBarH / 2}
              width={Math.max(Math.abs(aTip - absCx), 1)}
              height={absBarH}
              fill={aColor}
            />
          )}
          {r.absOutlier && aDir !== 0 && (
            <polygon
              points={`${aTip + aDir * 6},${cy} ${aTip},${cy - 5} ${aTip},${cy + 5}`}
              fill={aColor}
            />
          )}
          {absLabel && (
            <text
              x={absLabel.x}
              y={cy + valFont * 0.34}
              textAnchor={absLabel.anchor}
              fontSize={valFont}
              fontWeight={fontW}
              fill={tokens.color.text}
            >
              {aLabel}
            </text>
          )}

          {/* ΔPL% pin */}
          {pDir !== 0 && (
            <line
              x1={pctCx}
              y1={cy}
              x2={pTip}
              y2={cy}
              stroke={pColor}
              strokeWidth={emphasis ? 2.5 : 2}
            />
          )}
          {pDir !== 0 && !r.pctOutlier && (
            <circle cx={pTip} cy={cy} r={emphasis ? PIN_R + 0.5 : PIN_R} fill={pColor} />
          )}
          {r.pctOutlier && pDir !== 0 && (
            <polygon
              points={`${pTip + pDir * 6},${cy} ${pTip},${cy - 5} ${pTip},${cy + 5}`}
              fill={pColor}
            />
          )}
          {pctLabel && (
            <text
              x={pctLabel.x}
              y={cy + valFont * 0.34}
              textAnchor={pctLabel.anchor}
              fontSize={valFont}
              fontStyle="italic"
              fontWeight={fontW}
              fill={pColor}
            >
              {pLabel}
            </text>
          )}
        </>
      );
    };

    // Built-in tooltip rows for the hovered entity.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const r = h.datum;
      const exact = { ...format, compact: false };
      const rowsT: ChartTooltipRow[] = [
        { label: "AC", value: formatValue(r.ac, exact), strong: true },
        { label: baseLabel, value: formatValue(r.base, exact) },
      ];
      const color = impactColor(r.abs, r.favorable);
      rowsT.push({
        label: `Δ${baseLabel}`,
        value: `${formatSigned(r.abs, exact)} (${formatPercent(r.pct)})`,
        color,
      });
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

    const headerY = padT + headerH - 6;

    // Screen-reader data table: AC, the base, and absolute / relative variance per
    // entity (plus the total) — values, not the decorative svg.
    const a11yColumns = ["AC", baseLabel, `Δ${baseLabel}`, `Δ${baseLabel}%`];
    const a11yRows: ChartDataRow[] = rows.map((r) => ({
      label: r.label,
      cells: [
        formatValue(r.ac, format),
        formatValue(r.base, format),
        formatSigned(r.abs, format),
        formatPercent(r.pct),
      ],
    }));
    if (showTotals) {
      a11yRows.push({
        label: "Total",
        cells: [
          formatValue(total.ac, format),
          formatValue(total.base, format),
          formatSigned(total.abs, format),
          formatPercent(total.pct),
        ],
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
              ? `${title}. ${n} entities ranked by variance versus ${baseLabel}, with AC, absolute and relative variance panels.`
              : `${n} entities ranked by variance versus ${baseLabel}`
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
              id={hatchId}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="5" stroke={baseStyle.stroke} strokeWidth="1" />
            </pattern>
          </defs>

          {title && (
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, innerW, 13)}
            </text>
          )}

          {/* Panel headers */}
          <text x={acX0} y={headerY} fontSize={10.5} fill={tokens.color.textMuted}>
            AC
          </text>
          <text
            x={absCx}
            y={headerY}
            fontSize={10.5}
            fill={tokens.color.textMuted}
            textAnchor="middle"
          >{`Δ${baseLabel}`}</text>
          <text
            x={pctCx}
            y={headerY}
            fontSize={10.5}
            fontStyle="italic"
            fill={tokens.color.textMuted}
            textAnchor="middle"
          >{`Δ${baseLabel}%`}</text>

          {/* Axes: AC left baseline, and the two center zero axes (span body + total). */}
          <line
            x1={acX0}
            y1={bodyTop}
            x2={acX0}
            y2={totalTop + totalH}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />
          <line
            x1={absCx}
            y1={bodyTop}
            x2={absCx}
            y2={totalTop + totalH}
            stroke={tokens.color.axis}
            strokeWidth={0.75}
          />
          <line
            x1={pctCx}
            y1={bodyTop}
            x2={pctCx}
            y2={totalTop + totalH}
            stroke={tokens.color.axis}
            strokeWidth={0.75}
          />

          {rows.map((r, i) => {
            const cy = rowScale.center(i);
            const info = {
              category: r.label,
              scenario: "AC" as ScenarioKey,
              value: r.ac,
              datum: r,
            };
            // AC value label at the bar's end, clamped inside the AC panel.
            const acLabel = (() => {
              if (!showRowText) return null;
              const s = formatValue(r.ac, format);
              const tw = estTextW(s, valFont);
              const tip = acX0 + wOfAc(r.ac);
              let x = tip + 4;
              let anchor: "start" | "end" = "start";
              if (x + tw > acX1) {
                x = acX1 - 2;
                anchor = "end";
              }
              x = clampTo(x, acX0 + 2, acX1 - 2);
              return { x, anchor, s };
            })();

            // This row's visible marks across the three panels, in FINAL
            // (un-animated) geometry: the AC bar (the focus/tap anchor), its
            // reference overlay, then the two variance panels as lane strips at
            // the mark's thickness — the full-row rect stays the hit band.
            const markRects: MarkRect[] = [];
            if (r.ac !== 0)
              markRects.push({
                x: acX0,
                y: cy - acBarH / 2,
                width: Math.max(wOfAc(r.ac), 0),
                height: acBarH,
              });
            if (r.base !== 0)
              markRects.push({
                x: acX0,
                y: cy - planH / 2,
                width: Math.max(wOfAc(r.base), 0),
                height: planH,
              });
            if (r.abs !== 0)
              markRects.push({
                x: absX0,
                y: cy - absBarH / 2,
                width: absPanelW,
                height: absBarH,
              });
            const rowPct = r.pct == null || !Number.isFinite(r.pct) ? null : r.pct * 100;
            if (rowPct != null && rowPct !== 0)
              // Pin (line + dot): its lane strip widened to ±5px around the line.
              markRects.push({ x: pctX0, y: cy - 5, width: pctPanelW, height: 10 });

            return (
              <g key={`${r.label}-${i}`} {...marks.forMark(info, markRects)}>
                {hoverEnabled && (
                  <rect
                    x={padL}
                    y={rowScale.start(i)}
                    width={innerW}
                    height={rowScale.bandwidth}
                    fill="transparent"
                  />
                )}
                {showRowText && (
                  <text
                    x={labelX0}
                    y={cy + labelFont * 0.34}
                    fontSize={labelFont}
                    fill={tokens.color.text}
                  >
                    {fitLabel(r.label, labelW - 6, labelFont)}
                    <title>{r.label}</title>
                  </text>
                )}
                {renderMarks(r, cy, false, true, true)}
                {acLabel && (
                  <text
                    x={acLabel.x}
                    y={cy + valFont * 0.34}
                    textAnchor={acLabel.anchor}
                    fontSize={valFont}
                    fill={tokens.color.text}
                  >
                    {acLabel.s}
                  </text>
                )}
              </g>
            );
          })}

          {/* TOTAL row */}
          {showTotals && (
            <g>
              <line
                x1={padL}
                y1={bodyTop + bodyH + totalGap / 2}
                x2={width - padR}
                y2={bodyTop + bodyH + totalGap / 2}
                stroke={tokens.color.rowBorder}
                strokeWidth={1}
              />
              {(() => {
                const cy = totalTop + totalH / 2;
                const s = formatValue(total.ac, format);
                return (
                  <>
                    <text
                      x={labelX0}
                      y={cy + labelFont * 0.34}
                      fontSize={labelFont}
                      fontWeight={700}
                      fill={tokens.color.text}
                    >
                      Total
                    </text>
                    {/* Total AC is the sum (off the per-row bar scale) — shown as a bold value. */}
                    <text
                      x={acX0 + 2}
                      y={cy + valFont * 0.34}
                      fontSize={valFont}
                      fontWeight={700}
                      fill={tokens.color.text}
                    >
                      {fitLabel(s, acPanelW - 4, valFont)}
                    </text>
                    {renderMarks(total, cy, true, false, false)}
                  </>
                );
              })()}
            </g>
          )}
        </svg>
        <ChartDataTable
          caption={
            title ? `${title} — data table` : `Ranked variance versus ${baseLabel} — data table`
          }
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
