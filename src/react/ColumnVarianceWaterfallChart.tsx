import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import {
  computeColumnVarianceWaterfall,
  type ColumnVarianceDatum,
  type PriorTotalInput,
  type EndTotalInput,
} from "../core/columnVarianceWaterfall";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";

export type {
  ColumnVarianceDatum,
  PriorTotalInput,
  EndTotalInput,
  EndSegmentInput,
} from "../core/columnVarianceWaterfall";

export interface ColumnVarianceWaterfallChartProps {
  /** The periods, in order. Designed for ~12 (a year), an actual head + forecast tail. */
  data: ColumnVarianceDatum[];
  /** Whether a higher value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /** Show the TOP ΔPL% pin panel. Default true. */
  showPctPanel?: boolean;
  /**
   * A |Δ%| at or beyond this (in PERCENT units) is drawn off-scale with an
   * arrow and excluded from the pin-tier scale. Default 100.
   */
  clampPct?: number;
  /**
   * Reference TOTAL columns set apart on the LEFT, each in its scenario's IBCS
   * notation (e.g. `[{label:"2024\nAC",value:174,scenario:"PY"}, {label:"2025\nPL",value:154,scenario:"PL"}]`).
   */
  priorTotals?: PriorTotalInput[];
  /** Stacked AC+FC TOTAL column set apart on the RIGHT. */
  endTotal?: EndTotalInput;
  width?: number;
  height?: number;
  format?: FormatOptions;
  /** Token override merged over the nearest {@link IbcsThemeProvider} theme. */
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class applied to the chart `<svg>` (the root element). */
  className?: string;
  /** Styles merged *over* the chart's own layout styles. */
  style?: CSSProperties;
  /**
   * Fired as the pointer moves over / leaves a period band (`null` on leave) —
   * pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<ColumnVarianceDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on period hover or keyboard focus (AC,
   * PL, Δ, Δ%). Default true; set false to opt out. Renders on the client only,
   * near a hovered mark (or the focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
}

/**
 * ColumnVarianceWaterfallChart — IBCS chart-template **C05**: grouped AC/PL
 * columns combined with a HORIZONTAL waterfall of the absolute period
 * variances, over one shared period x-band, in three stacked tiers:
 *
 *  1. TOP — ΔPL% pins (lollipops): up & favorable / down & unfavorable from a
 *     zero axis, forecast periods get a hollow tip, off-scale percents pin to
 *     the edge with an arrow. A circled pin over the end column carries the
 *     grand Δ%.
 *  2. MIDDLE — the variance BRIDGE: each period's `ac − pl` as a small floating
 *     bar, walking the running total from ΣPL (tied to the left columns) to ΣAC
 *     (tied to the right column). Forecast bars are hatched; the grand variance
 *     is circled. Step connectors run at the leaving level between periods.
 *  3. BOTTOM — grouped columns: AC solid (hatched when forecast) in front of a
 *     hollow PL frame, value-labelled.
 *
 * Set apart on the LEFT are reference total columns (`priorTotals`, each in its
 * scenario's notation); set apart on the RIGHT is a stacked `endTotal` (AC+FC).
 * Crucially the bridge, the grouped columns, and ALL the set-apart totals share
 * ONE value→pixel scale, so a small monthly column and a 178-unit year total
 * read at comparable heights — exactly the IBCS C05 exhibit.
 *
 * Variance is coloured by IMPACT (good/bad/zero, respecting `higherIsBetter`),
 * never raw sign; every tier carries a zero baseline. Pure SVG, zero-dep,
 * SSR-safe; robust to empty / single / negative / long-label inputs.
 *
 * The svg is the chart's root element — it takes `className` / `style` and the
 * forwarded ref, and carries the accessible name (`role="img"` + `aria-label`);
 * the built-in tooltip portals to `document.body` and flips at the viewport
 * edges.
 */
export const ColumnVarianceWaterfallChart = forwardRef<
  SVGSVGElement,
  ColumnVarianceWaterfallChartProps
>(function ColumnVarianceWaterfallChart(
  {
    data: dataProp,
    higherIsBetter = true,
    showPctPanel = true,
    clampPct = 100,
    priorTotals,
    endTotal,
    width = 900,
    height = 460,
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
  const hatchFc = svgSafeId(useId());
  const hatchGood = svgSafeId(useId());
  const hatchBad = svgSafeId(useId());
  const data = useDataTween(dataProp);
  const grow = useMountGrow(700, 0, data);
  const hover = useChartHover<ColumnVarianceDatum>();
  const marks = markInteraction(hover, tooltip, onHover);
  const hoverEnabled = marks.enabled;

  const layout = useMemo(
    () =>
      computeColumnVarianceWaterfall(data, {
        higherIsBetter,
        pctClamp: clampPct > 0 ? clampPct / 100 : 1,
        priorTotals,
        endTotal,
      }),
    [data, higherIsBetter, clampPct, priorTotals, endTotal],
  );
  const {
    cells,
    domainMin,
    domainMax,
    pctMax,
    pctClamp,
    bridgeStart,
    bridgeEnd,
    total,
    priors,
    end,
  } = layout;

  const padL = 14;
  const padR = 14;
  const padT = title ? 34 : 18;
  const bottomH = 30;
  const tierGap = 14;
  const showPct = showPctPanel;

  // Vertical: optional pin tier on top, the shared value plot below.
  const plotBottom = height - bottomH;
  const availH = Math.max(plotBottom - padT, 1);
  const pctH = showPct ? Math.round(availH * 0.24) : 0;
  const valTop = padT + (showPct ? pctH + tierGap : 0);
  const valBottom = plotBottom;
  const valH = Math.max(valBottom - valTop, 1);

  // X: [priors] gap [periods] gap [end]. Total columns are set apart with a
  // gap + a faint divider; periods take the remaining width.
  const innerW = width - padL - padR;
  const nP = cells.length;
  const nPriors = priors.length;
  const hasEnd = !!end;
  const slotW = Math.min(Math.max(innerW * 0.085, 44), 76);
  const setGap = 20;
  const priorsW = nPriors * slotW;
  const endW = hasEnd ? slotW : 0;
  const nSetGaps = (nPriors ? 1 : 0) + (hasEnd ? 1 : 0);
  const periodsW = Math.max(innerW - priorsW - endW - nSetGaps * setGap, 1);

  let xCursor = padL;
  const priorsX0 = xCursor;
  xCursor += priorsW;
  if (nPriors) xCursor += setGap;
  const periodsX0 = xCursor;
  xCursor += periodsW;
  if (hasEnd) xCursor += setGap;
  const endX0 = xCursor;

  const band = nP ? periodsW / nP : periodsW;
  const cxOf = (i: number) => periodsX0 + band * i + band / 2;
  const priorCx = (k: number) => priorsX0 + slotW * k + slotW / 2;
  const endCx = endX0 + endW / 2;
  const leftDividerX = priorsX0 + priorsW + setGap / 2;
  const rightDividerX = periodsX0 + periodsW + setGap / 2;

  // Shared value→pixel scale (label headroom reserved at the top).
  const range = domainMax - domainMin || 1;
  const labelTopH = 16;
  const scaleH = Math.max(valH - labelTopH, 1);
  const yOf = (v: number) => valBottom - ((v - domainMin) / range) * scaleH;
  const zeroY = yOf(0);
  const gY = (v: number) => zeroY + (yOf(v) - zeroY) * grow;

  // Pin tier zero axis + half-scale.
  const pctMid = padT + pctH / 2;
  const pctHalf = Math.max(pctH / 2 - 12, 1);

  // Mark widths.
  const acW = Math.min(band * 0.4, 34);
  const plW = Math.min(band * 0.62, 52);
  const wfW = Math.min(band * 0.46, 26);
  const priorColW = Math.min(slotW * 0.58, 46);
  const endColW = Math.min(slotW * 0.6, 48);

  const impactColor = (v: { abs: number; favorable: boolean } | null) =>
    !v || v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;

  // One pin (a lollipop) on the percent tier. Reused for periods and the total.
  const renderPin = (
    key: string,
    cx: number,
    pct: number | null,
    favorable: boolean,
    isForecast: boolean,
    circled: boolean,
  ) => {
    if (pct == null || !isFinite(pct)) return null;
    const mag = Math.abs(pct);
    const offScale = mag >= pctClamp;
    const frac = offScale ? 1 : mag / pctMax;
    const len = Math.min(frac, 1) * pctHalf * grow;
    const color = mag === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;
    const up = favorable;
    const tipY = up ? pctMid - len : pctMid + len;
    const label = formatPercent(pct);
    const labelW = estTextW(label, 9);
    return (
      <g key={key}>
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
        ) : isForecast ? (
          <rect
            x={cx - 3.2}
            y={tipY - 3.2}
            width={6.4}
            height={6.4}
            fill={tokens.color.surface}
            stroke={color}
            strokeWidth={1.3}
          />
        ) : mag === 0 ? (
          <circle cx={cx} cy={tipY} r={2.4} fill={color} />
        ) : (
          <rect x={cx - 3.2} y={tipY - 3.2} width={6.4} height={6.4} fill={color} />
        )}
        {circled && (
          <ellipse
            cx={cx}
            cy={tipY}
            rx={Math.max(labelW / 2 + 5, 12)}
            ry={9}
            fill="none"
            stroke={tokens.color.axis}
            strokeWidth={1}
          />
        )}
        {labelW <= Math.max(band, slotW) - 1 && (
          <text
            x={clampTo(cx, padL + labelW / 2, width - padR - labelW / 2)}
            y={up ? tipY - (circled ? 12 : 6) : tipY + (circled ? 18 : 12)}
            fontSize={9}
            fontWeight={circled ? 600 : 400}
            fill={color}
            textAnchor="middle"
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  // A scenario column (prior totals): solid fill, hollow frame, or hatched.
  const renderScenarioColumn = (
    cx: number,
    colW: number,
    value: number,
    scenario: PriorTotalInput["scenario"],
  ) => {
    const st = tokens.scenario[scenario];
    const r = {
      x: cx - colW / 2,
      y: Math.min(gY(0), gY(value)),
      width: colW,
      height: Math.max(Math.abs(gY(value) - gY(0)), 0.5),
    };
    if (st.variant === "frame")
      return <rect {...r} fill={tokens.color.surface} stroke={st.stroke} strokeWidth={1.25} />;
    if (st.variant === "hatch")
      return <rect {...r} fill={`url(#${hatchFc})`} stroke={st.stroke} strokeWidth={0.75} />;
    return <rect {...r} fill={st.fill} />;
  };

  // Built-in tooltip for the hovered period: AC, PL, ΔPL, ΔPL%.
  const renderTooltip = () => {
    const h = hover.hovered;
    if (!tooltip || !h) return null;
    const c = cells.find((cell) => cell.category === h.category);
    if (!c) return null;
    const exact = { ...format, compact: false };
    const rows: ChartTooltipRow[] = [
      { label: c.isForecast ? "AC (FC)" : "AC", value: formatValue(c.ac, exact), strong: true },
      { label: "PL", value: formatValue(c.pl, exact) },
    ];
    const v = c.variance;
    if (v) {
      const color = impactColor(v);
      rows.push({ label: "ΔPL", value: formatSigned(v.abs, exact), color });
      rows.push({ label: "ΔPL%", value: formatPercent(v.pct), color });
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

  // Two-line bottom label ("2025 AC+FC" splits on whitespace/newline).
  const renderFootLabel = (cx: number, label: string, budget: number) => {
    const parts = label.split(/\n|\s+/).filter(Boolean);
    const line1 = parts[0] ?? "";
    const line2 = parts.slice(1).join(" ");
    return (
      <>
        <text
          x={cx}
          y={height - (line2 ? 16 : 8)}
          fontSize={10.5}
          fontWeight={600}
          fill={tokens.color.text}
          textAnchor="middle"
        >
          {fitLabel(line1, budget, 10.5)}
        </text>
        {line2 && (
          <text
            x={cx}
            y={height - 5}
            fontSize={9.5}
            fill={tokens.color.textMuted}
            textAnchor="middle"
          >
            {fitLabel(line2, budget, 9.5)}
          </text>
        )}
      </>
    );
  };

  // Screen-reader data table: per period the two columns the chart draws (AC in
  // front of PL), the bridge step between them and — while the pin tier is on —
  // the relative variance those pins encode. A closing Total row carries the
  // bridge's anchors (ΣPL → ΣAC) and the circled grand variance.
  const a11yColumns = ["AC", "PL", "ΔPL", ...(showPct ? ["ΔPL%"] : [])];
  const a11yRows: ChartDataRow[] = cells.map((c) => ({
    label: c.isForecast ? `${c.category} (FC)` : c.category,
    cells: [
      formatValue(c.ac, format),
      formatValue(c.pl, format),
      c.variance ? formatSigned(c.variance.abs, format) : "n/a",
      ...(showPct ? [c.variance ? formatPercent(c.variance.pct) : "n/a"] : []),
    ],
  }));
  a11yRows.push({
    label: end ? end.label.replace(/\s+/g, " ") : "Total",
    cells: [
      formatValue(end ? end.total : bridgeEnd, format),
      formatValue(bridgeStart, format),
      formatSigned(total.abs, format),
      ...(showPct ? [formatPercent(total.pct)] : []),
    ],
  });

  return (
    <>
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          (title ? `${title}. ` : "") +
          `IBCS C05: grouped AC versus PL columns with a horizontal variance waterfall over ${nP} periods.`
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
            id={hatchFc}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.scenario.FC.stroke} strokeWidth="1" />
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

        {/* ── TOP tier: ΔPL% pins ──────────────────────────────────────── */}
        {showPct && (
          <>
            <line
              x1={periodsX0}
              y1={pctMid}
              x2={periodsX0 + periodsW}
              y2={pctMid}
              stroke={tokens.color.axis}
              strokeWidth={1}
            />
            {cells.map((c, i) =>
              c.variance
                ? renderPin(
                    `pct-${c.category}-${i}`,
                    cxOf(i),
                    c.variance.pct,
                    c.variance.favorable,
                    c.isForecast,
                    false,
                  )
                : null,
            )}
            {/* Circled grand Δ% over the end column. */}
            {hasEnd && renderPin("pct-total", endCx, total.pct, total.favorable, false, true)}
          </>
        )}

        {/* ── Shared zero baseline of the value plot ───────────────────── */}
        <line
          x1={padL}
          y1={zeroY}
          x2={width - padR}
          y2={zeroY}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />

        {/* Set-apart dividers */}
        {nPriors > 0 && (
          <line
            x1={leftDividerX}
            y1={valTop}
            x2={leftDividerX}
            y2={valBottom}
            stroke={tokens.color.gridline}
            strokeWidth={1}
          />
        )}
        {hasEnd && (
          <line
            x1={rightDividerX}
            y1={valTop}
            x2={rightDividerX}
            y2={valBottom}
            stroke={tokens.color.gridline}
            strokeWidth={1}
          />
        )}

        {/* ── LEFT: reference total columns ────────────────────────────── */}
        {priors.map((p, k) => {
          const cx = priorCx(k);
          const s = formatValue(p.value, format);
          return (
            <g key={`prior-${k}`}>
              {renderScenarioColumn(cx, priorColW, p.value, p.scenario)}
              <text
                x={cx}
                y={Math.min(gY(0), gY(p.value)) - 5}
                fontSize={10.5}
                fontWeight={600}
                fill={tokens.color.text}
                textAnchor="middle"
              >
                {fitLabel(s, slotW, 10.5)}
              </text>
              {renderFootLabel(cx, p.label, slotW)}
            </g>
          );
        })}

        {/* ── MIDDLE tier: the variance bridge ─────────────────────────── */}
        {/* Anchor gridlines tying the bridge to the left/right totals. */}
        {nP > 0 && (
          <>
            <line
              x1={nPriors ? leftDividerX : periodsX0}
              y1={gY(bridgeStart)}
              x2={cxOf(0) - wfW / 2}
              y2={gY(bridgeStart)}
              stroke={tokens.color.gridline}
              strokeWidth={1}
            />
            <line
              x1={cxOf(nP - 1) + wfW / 2}
              y1={gY(bridgeEnd)}
              x2={hasEnd ? rightDividerX : periodsX0 + periodsW}
              y2={gY(bridgeEnd)}
              stroke={tokens.color.gridline}
              strokeWidth={1}
            />
          </>
        )}
        {/* Step connectors at each leaving level. */}
        {cells.map((c, i) => {
          if (i === nP - 1) return null;
          const x1 = cxOf(i) + wfW / 2;
          const x2 = cxOf(i + 1) - wfW / 2;
          return (
            <line
              key={`conn-${i}`}
              x1={x1}
              y1={gY(c.to)}
              x2={x2}
              y2={gY(c.to)}
              stroke={tokens.color.axis}
              strokeWidth={1}
            />
          );
        })}
        {/* Floating variance bars. */}
        {cells.map((c, i) => {
          const v = c.variance;
          if (!v) return null;
          const cx = cxOf(i);
          const yTop = Math.min(gY(c.from), gY(c.to));
          const h = Math.max(Math.abs(gY(c.to) - gY(c.from)), 1);
          const color = impactColor(v);
          const hatch = v.favorable ? hatchGood : hatchBad;
          const up = v.favorable;
          const label = formatSigned(v.abs, format);
          return (
            <g key={`wf-${c.category}-${i}`}>
              <rect
                x={cx - wfW / 2}
                y={yTop}
                width={wfW}
                height={h}
                fill={c.isForecast ? `url(#${hatch})` : color}
                stroke={c.isForecast ? color : "none"}
                strokeWidth={c.isForecast ? 0.9 : 0}
              />
              {estTextW(label, 8.5) <= band - 1 && (
                <text
                  x={cx}
                  y={up ? yTop - 3 : yTop + h + 10}
                  fontSize={8.5}
                  fill={color}
                  textAnchor="middle"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
        {/* Circled grand variance, between the bridge end and the right column. */}
        {(() => {
          const label = formatSigned(total.abs, format);
          const lw = estTextW(label, 10);
          const cx = clampTo(
            hasEnd ? rightDividerX : nP ? cxOf(nP - 1) + wfW / 2 + lw : padL + lw,
            padL + lw / 2 + 6,
            width - padR - lw / 2 - 6,
          );
          const cy = gY(bridgeEnd);
          const color = impactColor(total);
          return (
            <g>
              <ellipse
                cx={cx}
                cy={cy}
                rx={Math.max(lw / 2 + 6, 14)}
                ry={10}
                fill={tokens.color.surface}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              <text
                x={cx}
                y={cy + 3.5}
                fontSize={10}
                fontWeight={600}
                fill={color}
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })()}

        {/* ── BOTTOM tier: grouped AC/PL columns ───────────────────────── */}
        {cells.map((c, i) => {
          // `cells` is `data.map(…)`, so the datum at this index always exists.
          const datum = data[i];
          if (!datum) return null;
          const cx = cxOf(i);
          const info = {
            category: c.category,
            scenario: (c.isForecast ? "FC" : "AC") as ScenarioKey,
            value: c.ac,
            datum,
          };
          const acTop = Math.min(zeroY, gY(c.ac));
          const acH = Math.abs(gY(c.ac) - zeroY);
          const sLabel = formatValue(c.ac, format);
          // This period's visible marks across the three tiers, in FINAL
          // (un-animated) geometry: the AC column first (focus/tap anchor), the
          // PL frame behind it, the bridge step bar, and the Δ% pin lane. The
          // hit band above stays the generous target.
          const acY = yOf(c.ac);
          const plY = yOf(c.pl);
          const markRects: MarkRect[] = [
            {
              x: cx - acW / 2,
              y: Math.min(zeroY, acY),
              width: acW,
              height: Math.abs(acY - zeroY),
            },
            {
              x: cx - plW / 2,
              y: Math.min(zeroY, plY),
              width: plW,
              height: Math.abs(plY - zeroY),
            },
          ];
          if (c.variance) {
            const fromY = yOf(c.from);
            const toY = yOf(c.to);
            markRects.push({
              x: cx - wfW / 2,
              y: Math.min(fromY, toY),
              width: wfW,
              height: Math.abs(toY - fromY),
            });
            if (showPct && c.variance.pct != null && isFinite(c.variance.pct))
              markRects.push({ x: cx - 5, y: pctMid - pctH / 2, width: 10, height: pctH });
          }
          return (
            <g key={`col-${c.category}-${i}`} {...marks.forMark(info, markRects)}>
              {hoverEnabled && (
                <rect
                  x={periodsX0 + band * i}
                  y={padT}
                  width={band}
                  height={valBottom - padT}
                  fill="transparent"
                />
              )}
              {/* PL hollow frame behind. */}
              {(() => {
                const top = Math.min(zeroY, gY(c.pl));
                const hh = Math.max(Math.abs(gY(c.pl) - zeroY), 0.5);
                return (
                  <rect
                    x={cx - plW / 2}
                    y={top}
                    width={plW}
                    height={hh}
                    fill={tokens.color.surface}
                    stroke={tokens.scenario.PL.stroke}
                    strokeWidth={1.1}
                  />
                );
              })()}
              {/* AC solid (hatched when forecast) in front. */}
              <rect
                x={cx - acW / 2}
                y={acTop}
                width={acW}
                height={Math.max(acH, 0.5)}
                fill={c.isForecast ? `url(#${hatchFc})` : tokens.scenario.AC.fill}
                stroke={c.isForecast ? tokens.scenario.AC.stroke : "none"}
                strokeWidth={c.isForecast ? 0.75 : 0}
              />
              {estTextW(sLabel, 9.5) <= band - 1 && (
                <text
                  x={clampTo(
                    cx,
                    periodsX0 + estTextW(sLabel, 9.5) / 2,
                    periodsX0 + periodsW - estTextW(sLabel, 9.5) / 2,
                  )}
                  y={acTop - 4}
                  fontSize={9.5}
                  fill={tokens.color.text}
                  textAnchor="middle"
                >
                  {sLabel}
                </text>
              )}
            </g>
          );
        })}

        {/* ── RIGHT: stacked AC+FC total column ────────────────────────── */}
        {end && (
          <g>
            {end.segments.map((seg, si) => {
              const segTop = Math.min(gY(seg.y0), gY(seg.y1));
              const segH = Math.max(Math.abs(gY(seg.y1) - gY(seg.y0)), 0.5);
              const sLabel = formatValue(seg.value, format);
              return (
                <g key={`end-${si}`}>
                  <rect
                    x={endCx - endColW / 2}
                    y={segTop}
                    width={endColW}
                    height={segH}
                    fill={seg.forecast ? `url(#${hatchFc})` : tokens.scenario.AC.fill}
                    stroke={seg.forecast ? tokens.scenario.AC.stroke : "none"}
                    strokeWidth={seg.forecast ? 0.75 : 0}
                  />
                  {segH >= 13 && estTextW(sLabel, 9) <= endColW + 6 && (
                    <text
                      x={endCx}
                      y={segTop + segH / 2 + 3.2}
                      fontSize={9}
                      fill={seg.forecast ? tokens.color.text : tokens.color.onFill}
                      textAnchor="middle"
                    >
                      {sLabel}
                    </text>
                  )}
                </g>
              );
            })}
            <text
              x={endCx}
              y={Math.min(gY(0), gY(end.total)) - 5}
              fontSize={10.5}
              fontWeight={600}
              fill={tokens.color.text}
              textAnchor="middle"
            >
              {fitLabel(formatValue(end.total, format), slotW, 10.5)}
            </text>
            {renderFootLabel(endCx, end.label, slotW)}
          </g>
        )}

        {/* ── Shared period labels (bottom) ────────────────────────────── */}
        {cells.map((c, i) => (
          <text
            key={`lab-${c.category}-${i}`}
            x={cxOf(i)}
            y={height - 10}
            fontSize={11}
            fill={tokens.color.textMuted}
            textAnchor="middle"
          >
            {fitLabel(c.category, band - 2, 11)}
          </text>
        ))}
      </svg>
      <ChartDataTable
        caption={title ? `${title} — data table` : "AC versus PL with variance bridge — data table"}
        columns={a11yColumns}
        rows={a11yRows}
      />
      {renderTooltip()}
    </>
  );
});
