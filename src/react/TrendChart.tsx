import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeTrend, type TrendDatum } from "../core/trend";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { useMountGrow, useChartHover } from "./hooks";
import type { ChartSelection, ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import {
  ChartDataTable,
  SELECTABLE_MARK_CSS,
  selectableMarkProps,
  type ChartDataRow,
} from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";

export type { TrendDatum } from "../core/trend";

export interface TrendChartProps {
  /** The periods, in order. Designed for ~13 (a year + total), but any length. */
  data: TrendDatum[];
  /** Reference scenario for the variance panel. Default "PY". */
  comparison?: ScenarioKey;
  /** Higher is better (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /**
   * The lower AC-vs-comparison variance panel: "abs" shows Δ values, "pct"
   * shows Δ%, "none" omits the panel entirely. Default "abs".
   */
  variance?: "abs" | "pct" | "none";
  /**
   * Scenarios drawn as reference lines riding along the columns — PY solid grey
   * with dots ("the past"), PL dashed ("not real yet"). Default `["PY","PL"]`;
   * pass `["PY"]` for prior year only, `[]` for bare columns. Only "PY" and
   * "PL" are honored today (FC support may come later) — any other scenario is
   * ignored, since the forecast already rides in the column series.
   */
  referenceLines?: ScenarioKey[];
  /** Print the current value above each column. Default true. */
  showValueLabels?: boolean;
  width?: number;
  height?: number;
  /**
   * Horizontal band layout — the gap between columns and the lead-in/out gutter.
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
   * Fired when a period column is clicked — for click-to-filter / drill-down.
   * Pairs naturally with `useChartSelection`. Omit for a non-interactive chart.
   * `scenario` is "FC" on forecast periods, otherwise "AC".
   */
  onSelect?: (selection: ChartSelection<TrendDatum>) => void;
  /**
   * Fired as the pointer moves over / leaves a period column (`null` on leave) —
   * for a custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<TrendDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on column hover or keyboard focus
   * (value, Δ vs the comparison). Default true; set false to opt out. Renders
   * on the client only, near a hovered mark (or the focused / tapped one);
   * Escape dismisses it.
   */
  tooltip?: boolean;
}

/** Build polyline segments, breaking the line wherever a period lacks the value. */
function segments(
  points: Array<{ x: number; y: number } | null>,
): Array<Array<{ x: number; y: number }>> {
  const out: Array<Array<{ x: number; y: number }>> = [];
  let run: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    if (p) run.push(p);
    else if (run.length) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return out;
}

/**
 * IBCS trend chart over a run of periods (typically 13 — a year plus its
 * total). The current series (AC, or FC where actuals run out) is drawn as
 * columns; previous year and plan ride along as reference lines ("bands"),
 * and a variance panel beneath shows AC/FC vs the comparison scenario.
 *
 * Forecast periods are hatched and a `summary` period (e.g. the full-year
 * total) is set off with a divider and the emphasis color — the canonical
 * "actual ▸ forecast ▸ total" trend layout.
 *
 * A forwarded `ref` lands on the chart `<svg>` — the useful handle for export /
 * serialization — even though the component also renders a screen-reader table
 * beside it.
 */
export const TrendChart = forwardRef<SVGSVGElement, TrendChartProps>(function TrendChart(
  {
    data,
    comparison = "PY",
    higherIsBetter = true,
    variance = "abs",
    referenceLines = ["PY", "PL"],
    showValueLabels = true,
    width = 720,
    height = 360,
    bandPadding,
    format = {},
    tokens: tokenOverride,
    title,
    className,
    style,
    onSelect,
    onHover,
    tooltip = true,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const hatchId = svgSafeId(useId());
  const grow = useMountGrow(700, 0, data);
  const hover = useChartHover<TrendDatum>();
  const marks = markInteraction(hover, tooltip, onHover);
  const hoverEnabled = marks.enabled;

  // `variance` doubles as the panel's on/off switch, and only PY/PL are drawn
  // as reference lines — resolve both to plain flags once, so the geometry and
  // markup below stay exactly as they were.
  const showVariancePanel = variance !== "none";
  const showPyLine = referenceLines.includes("PY");
  const showPlLine = referenceLines.includes("PL");

  const layout = useMemo(
    () =>
      computeTrend(data, {
        comparison,
        varianceMode: variance === "pct" ? "pct" : "abs",
        higherIsBetter,
      }),
    [data, comparison, variance, higherIsBetter],
  );
  const { cells, domainMin, domainMax, varMax } = layout;

  const padL = 14;
  const padR = 14;
  // Reserve a top band for the legend (+ title) so value labels never collide.
  const padT = title ? 34 : 24;
  const labelH = 22;
  const gap = 16;
  const innerW = width - padL - padR;

  // Headroom inside the plot so the tallest value label (above its column) and,
  // when there is no variance panel, a negative column's label below it, fit.
  const labelTopH = 12;
  const varLabelH = showVariancePanel ? 12 : 0;
  const negLabelH = showVariancePanel ? 0 : 14;

  const varH = showVariancePanel ? Math.round((height - padT - labelH) * 0.3) : 0;
  const topH =
    height - padT - labelH - negLabelH - (showVariancePanel ? varH + gap + varLabelH : 0);
  const plotBottom = padT + topH;
  const plotTop = padT + labelTopH;
  const scaleH = Math.max(plotBottom - plotTop, 1);

  const vRange = domainMax - domainMin || 1;
  const y = (v: number) => plotBottom - ((v - domainMin) / vRange) * scaleH;
  const zeroY = y(0);
  // Grow columns and lines up from the zero baseline on mount / data change.
  const yA = (v: number) => zeroY + (y(v) - zeroY) * grow;

  const n = cells.length || 1;
  // Band layout (column placement). Default reproduces the historical centred
  // look exactly (bar width = 0.5·step, half-band gutter); `bandPadding` lets a
  // caller trim the gutter (`{ outer: 0 }`) so columns fill the plot edge-to-edge.
  const scale = bandScale(innerW, n, resolveBandPadding(0.5, bandPadding), padL);
  const band = scale.step;
  const cxOf = (i: number) => scale.center(i);
  const colW = Math.min(scale.bandwidth, 30);
  const sumColW = Math.min(band * 0.62, 38);

  // Reference-line point sets (null where the period lacks the scenario).
  const pyPts = cells.map((c, i) => (c.PY != null ? { x: cxOf(i), y: yA(c.PY) } : null));
  const plPts = cells.map((c, i) => (c.PL != null ? { x: cxOf(i), y: yA(c.PL) } : null));
  const toPath = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const varMid = plotBottom + gap + varH / 2;

  const pyLineColor = tokens.color.neutral;
  const plLineColor = tokens.scenario.PL.stroke;

  // Built-in tooltip rows for the hovered period: current value, the comparison
  // value, and the signed Δ (impact-coloured), reusing the cell's variance.
  const renderTooltip = () => {
    const h = hover.hovered;
    if (!tooltip || !h) return null;
    const c = cells.find((cell) => cell.category === h.category);
    if (!c || c.current == null) return null;
    const exact = { ...format, compact: false };
    const rows: ChartTooltipRow[] = [
      { label: c.isForecast ? "FC" : "AC", value: formatValue(c.current, exact), strong: true },
    ];
    const cmpVal = c[comparison];
    if (cmpVal != null && isFinite(cmpVal))
      rows.push({ label: comparison, value: formatValue(cmpVal, exact) });
    const v = c.variance;
    if (v) {
      const color =
        v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
      const pct = v.pct != null ? ` (${formatPercent(v.pct)})` : "";
      rows.push({ label: `Δ${comparison}`, value: `${formatSigned(v.abs, exact)}${pct}`, color });
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

  // Screen-reader data table: each period's current value, the references, and
  // the shown variance as a real <table>, so SR users read values, not the svg.
  const a11yColumns = [
    "Current",
    ...(showPyLine ? ["PY"] : []),
    ...(showPlLine ? ["PL"] : []),
    ...(showVariancePanel ? [`Δ${comparison}`, `Δ${comparison}%`] : []),
  ];
  const a11yRows: ChartDataRow[] = cells.map((c) => {
    const cells_: Array<string | number> = [
      c.current != null ? formatValue(c.current, format) : "n/a",
    ];
    if (showPyLine) cells_.push(c.PY != null ? formatValue(c.PY, format) : "n/a");
    if (showPlLine) cells_.push(c.PL != null ? formatValue(c.PL, format) : "n/a");
    if (showVariancePanel) {
      cells_.push(c.variance ? formatSigned(c.variance.abs, format) : "n/a");
      cells_.push(c.variance ? formatPercent(c.variance.pct) : "n/a");
    }
    return { label: c.isForecast ? `${c.category} (FC)` : c.category, cells: cells_ };
  });

  return (
    <>
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        // Interactive charts carry their semantics on the marks themselves
        // (`selectableMarkProps`), so the svg stays an unlabelled container;
        // static ones are a single labelled image. Never both (and never
        // `aria-hidden`, which would cancel the label out).
        role={onSelect ? undefined : "img"}
        aria-label={
          onSelect
            ? undefined
            : title
              ? `${title}. Trend of ${n} periods, current series versus ${comparison}, with a variance panel.`
              : `Trend of ${n} periods, current series versus ${comparison}`
        }
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
            <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.scenario.AC.fill} strokeWidth="1" />
          </pattern>
        </defs>
        {onSelect && <style>{SELECTABLE_MARK_CSS}</style>}

        {title && (
          <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
            {/* Clip so the title can't run under the top-right legend or off-canvas. */}
            {fitLabel(title, width - padL - padR - (showPlLine ? 124 : showPyLine ? 80 : 36), 13)}
          </text>
        )}

        {/* Legend, top-right */}
        <g
          transform={`translate(${width - padR}, ${title ? 16 : 14})`}
          fontSize={10.5}
          fill={tokens.color.textMuted}
        >
          <text x={0} y={0} textAnchor="end">
            AC
          </text>
          <rect x={-30} y={-8} width={10} height={9} fill={tokens.scenario.AC.fill} />
          {showPyLine && (
            <>
              <text x={-44} y={0} textAnchor="end">
                PY
              </text>
              <line x1={-74} y1={-4} x2={-58} y2={-4} stroke={pyLineColor} strokeWidth={1.75} />
            </>
          )}
          {showPlLine && (
            <>
              <text x={-88} y={0} textAnchor="end">
                PL
              </text>
              <line
                x1={-118}
                y1={-4}
                x2={-102}
                y2={-4}
                stroke={plLineColor}
                strokeWidth={1.25}
                strokeDasharray="4 3"
              />
            </>
          )}
        </g>

        {/* Zero baseline */}
        <line
          x1={padL}
          y1={zeroY}
          x2={width - padR}
          y2={zeroY}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />

        {/* Current-series columns */}
        {cells.map((c, i) => {
          // `cells` is `data.map(…)`, so the datum at this index always exists.
          const datum = data[i];
          if (c.current == null || !datum) return null;
          const cx = cxOf(i);
          const w = c.summary ? sumColW : colW;
          const top = yA(c.current);
          const h = Math.abs(top - zeroY);
          const colY = c.current >= 0 ? top : zeroY;
          const fill = c.summary
            ? tokens.color.total
            : c.isForecast
              ? `url(#${hatchId})`
              : tokens.scenario.AC.fill;
          const info = {
            category: c.category,
            scenario: (c.isForecast ? "FC" : "AC") as ScenarioKey,
            value: c.current as number,
            datum,
          };
          // The visible marks of this period, in FINAL (un-animated) geometry:
          // the current-series column plus, when the panel is on, its variance
          // lane strip. The reference LINES (PY/PL) are not this period's marks.
          const yCur = y(c.current);
          const markRects: MarkRect[] = [
            {
              x: cx - w / 2,
              y: Math.min(zeroY, yCur),
              width: w,
              height: Math.abs(yCur - zeroY),
            },
          ];
          if (showVariancePanel && c.variance)
            markRects.push({ x: cx - w / 2, y: varMid - varH / 2, width: w, height: varH });
          return (
            <g
              key={`col-${c.category}`}
              {...selectableMarkProps(
                onSelect ? () => onSelect(info) : undefined,
                `Select ${c.category}, ${info.scenario} ${formatValue(info.value, format)}`,
              )}
              {...marks.forMark(info, markRects)}
              style={onSelect ? { cursor: "pointer" } : undefined}
            >
              {/* Transparent full-band hit target so the whole period is click/hover-able */}
              {(onSelect || hoverEnabled) && (
                <rect
                  x={cxOf(i) - band / 2}
                  y={padT}
                  width={band}
                  height={height - padT}
                  fill="transparent"
                />
              )}
              {/* Summary period divider, set off from the running months */}
              {c.summary && (
                <line
                  x1={cxOf(i) - band / 2}
                  y1={padT}
                  x2={cxOf(i) - band / 2}
                  y2={plotBottom}
                  stroke={tokens.color.gridline}
                  strokeWidth={1}
                />
              )}
              <rect x={cx - w / 2} y={colY} width={w} height={Math.max(h, 0.5)} fill={fill} />
              {/* Forecast columns get a thin outline so the hatch reads as a bar */}
              {c.isForecast && !c.summary && (
                <rect
                  x={cx - w / 2}
                  y={colY}
                  width={w}
                  height={Math.max(h, 0.5)}
                  fill="none"
                  stroke={tokens.scenario.AC.stroke}
                  strokeWidth={0.75}
                />
              )}
              {showValueLabels &&
                (() => {
                  const s = formatValue(c.current, format);
                  const lw = estTextW(s, 9);
                  // Skip when wider than the band (would overlap a neighbour); nudge
                  // inward at the edges so it never spills past the SVG.
                  if (lw > band - 1) return null;
                  const lx = clampTo(cx, padL + lw / 2, width - padR - lw / 2);
                  // Always just above the bar's top edge (above the zero line for
                  // negatives) so it never drops into the variance band below.
                  return (
                    <text
                      x={lx}
                      y={Math.min(zeroY, top) - 4}
                      fontSize={9}
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

        {/* PL (plan) reference line — dashed, "not real yet" */}
        {showPlLine &&
          segments(plPts).map((seg, si) => (
            <path
              key={`pl-${si}`}
              d={toPath(seg)}
              fill="none"
              stroke={plLineColor}
              strokeWidth={1.25}
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />
          ))}

        {/* PY reference line + dots — "the past" */}
        {showPyLine && (
          <>
            {segments(pyPts).map((seg, si) => (
              <path
                key={`py-${si}`}
                d={toPath(seg)}
                fill="none"
                stroke={pyLineColor}
                strokeWidth={1.75}
                strokeLinejoin="round"
              />
            ))}
            {pyPts.map((p, i) =>
              p ? <circle key={`pyd-${i}`} cx={p.x} cy={p.y} r={2.2} fill={pyLineColor} /> : null,
            )}
          </>
        )}

        {/* Period labels */}
        {cells.map((c, i) => (
          <text
            key={`lab-${c.category}`}
            x={cxOf(i)}
            y={height - 6}
            fontSize={10.5}
            fontWeight={c.summary ? 600 : 400}
            fill={c.summary ? tokens.color.text : tokens.color.textMuted}
            textAnchor="middle"
          >
            {fitLabel(c.category, band - 1, 10.5)}
          </text>
        ))}

        {/* Variance panel: current vs comparison, colored by favorability */}
        {showVariancePanel && (
          <>
            <line
              x1={padL}
              y1={varMid}
              x2={width - padR}
              y2={varMid}
              stroke={tokens.color.axis}
              strokeWidth={1}
            />
            {cells.map((c, i) => {
              const v = c.variance;
              if (!v) return null;
              const cx = cxOf(i);
              const val = variance === "pct" ? (v.pct ?? 0) : v.abs;
              const h = (Math.abs(val) / varMax) * (varH / 2) * grow;
              const color =
                val === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
              const up = val >= 0;
              const label = variance === "pct" ? formatPercent(v.pct) : formatSigned(v.abs, format);
              const w = c.summary ? sumColW : colW;
              return (
                <g key={`var-${c.category}`} opacity={c.isForecast ? 0.6 : 1}>
                  <rect
                    x={cx - w / 2}
                    y={up ? varMid - h : varMid}
                    width={w}
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
        caption={title ? `${title} — data table` : `Trend versus ${comparison} — data table`}
        columns={a11yColumns}
        rows={a11yRows}
      />
      {renderTooltip()}
    </>
  );
});
