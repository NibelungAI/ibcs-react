import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioDatum, ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeVariance } from "../core/variance";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
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

/**
 * One category column: the canonical {@link ScenarioDatum} with `AC` required -
 * this chart draws the actual in front of the comparison, so there is always an
 * actual to draw.
 */
export type ColumnDatum = ScenarioDatum & { AC: number };

export interface VarianceColumnChartProps {
  data: ColumnDatum[];
  /** Base scenario for the variance panel. Default "PY". */
  comparison?: ScenarioKey;
  /** Higher is better (false for cost charts). Default true. */
  higherIsBetter?: boolean;
  /**
   * The lower variance panel: "abs" shows ΔPY values, "pct" shows ΔPY%, "none"
   * omits the panel entirely. Default "abs". Also picks the default `mark`:
   * absolute deviations are bars, relative ones pins.
   */
  variance?: "abs" | "pct" | "none";
  /** Filled "bar" columns (default) or "pin" (line + dot / lollipop). */
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
   * Fired when a category column is clicked - for click-to-filter / drill-down.
   * Pairs naturally with `useChartSelection`. Omit for a non-interactive chart
   * (no behavior or visual change). The clickable area spans the whole column.
   */
  onSelect?: (selection: ChartSelection<ColumnDatum>) => void;
  /**
   * Fired as the pointer moves over / leaves a column (`null` on leave) - for a
   * custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<ColumnDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on column hover or keyboard focus
   * (category, AC, and Δ vs the comparison). Default true; set false to opt out
   * (e.g. when wiring your own via `onHover`). Renders on the client only,
   * near a hovered mark (or the focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
}

/**
 * IBCS scenario columns: AC solid in front, PY faded behind (overlapped, not
 * side-by-side), PL/FC as an outline frame. A variance panel beneath shows
 * AC vs the comparison, colored by favorability.
 *
 * A forwarded `ref` lands on the chart `<svg>` - the useful handle for export /
 * serialization - even though the component also renders a screen-reader table
 * beside it.
 */
export const VarianceColumnChart = forwardRef<SVGSVGElement, VarianceColumnChartProps>(
  function VarianceColumnChart(
    {
      data: dataProp,
      comparison = "PY",
      higherIsBetter = true,
      variance = "abs",
      mark: markProp,
      width = 560,
      height = 320,
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
    // IBCS rule: ABSOLUTE deviations are bars (they share the value scale);
    // RELATIVE (%) deviations are pins (line + dot) on their own scale. So when
    // `mark` is not set, follow the variance mode rather than always defaulting to
    // a bar - a percent bar would wrongly imply value-scale comparability.
    const mark = markProp ?? (variance === "pct" ? "pin" : "bar");
    // The panel is drawn unless it is switched off; `variance` doubles as its
    // on/off switch, so every geometry branch below reads this one flag.
    const showVariancePanel = variance !== "none";
    const tokens = useIbcsTokens(tokenOverride);
    const hatchId = svgSafeId(useId());
    const hover = useChartHover<ColumnDatum>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;
    // Columns grow up from the baseline on mount and replay on a data change.
    const data = useDataTween(dataProp);
    const grow = useMountGrow(650, 0, data);

    const padL = 12;
    const padR = 12;
    const padT = title ? 30 : 14;
    const labelH = 22;
    const gap = 14;
    // Headroom above the tallest column for its value label, and below the
    // variance panel for a downward variance label - so neither is clipped.
    const labelTopH = 14;
    const varLabelH = showVariancePanel ? 13 : 0;
    const innerW = width - padL - padR;

    const varH = showVariancePanel ? Math.round((height - padT - labelH) * 0.3) : 0;
    const topH = height - padT - labelH - (showVariancePanel ? varH + gap + varLabelH : 0);
    const topBase = padT + topH;
    // Columns are scaled into the band below the top label reserve.
    const colScaleH = Math.max(topH - labelTopH, 1);

    // Value domain across every scenario, always including zero so the baseline
    // sits inside the plot and negative columns map below it (never off-canvas).
    const { domainMin, domainMax } = useMemo(() => {
      let mn = 0;
      let mx = 0;
      for (const d of data) {
        for (const v of [d.AC, d.PY, d.PL, d.FC]) {
          if (v != null && isFinite(v)) {
            mn = Math.min(mn, v);
            mx = Math.max(mx, v);
          }
        }
      }
      return { domainMin: mn, domainMax: mx };
    }, [data]);

    const variances = useMemo(
      () => data.map((d) => computeVariance(d.AC, d[comparison], higherIsBetter)),
      [data, comparison, higherIsBetter],
    );

    const varMax = useMemo(() => {
      let m = 0;
      for (const v of variances) {
        if (!v) continue;
        m = Math.max(m, Math.abs(variance === "pct" ? (v.pct ?? 0) : v.abs));
      }
      return m || 1;
    }, [variances, variance]);

    // Band layout (column placement). Default reproduces the historical centred
    // look exactly (back column = 0.62·step, half-band gutter); `bandPadding` lets
    // a caller trim the gutter (`{ outer: 0 }`) so columns fill edge-to-edge.
    const scale = bandScale(innerW, data.length, resolveBandPadding(0.62, bandPadding), padL);
    const band = scale.step;
    const cxOf = (i: number) => scale.center(i);
    // AC fills most of the comparison column/frame (a thin, even border of plan
    // showing around it) rather than sitting as a small bar inside a big box.
    const acW = Math.min(band * 0.5, 52);
    const pyW = Math.min(scale.bandwidth, 68);
    const range = domainMax - domainMin || 1;
    const yOf = (v: number) => topBase - ((v - domainMin) / range) * colScaleH;
    const zeroY = yOf(0);
    // Animated value-y: grows from the zero line up (positive) or down (negative).
    const gY = (v: number) => zeroY + (yOf(v) - zeroY) * grow;
    // Rect top/height for a column drawn between the zero line and the value.
    const colTop = (v: number) => Math.min(zeroY, gY(v));
    const colH = (v: number) => Math.abs(gY(v) - zeroY);

    const varMid = topBase + gap + varH / 2;

    // Built-in tooltip rows for the hovered column: AC, the comparison value, and
    // the signed Δ (impact-coloured), reusing the chart's variance computation.
    // Values render at FULL precision (compact: false): the printed labels are
    // compact ("30.1M"), so the tooltip adds the exact figure instead of echoing.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const d = h.datum;
      const cmp = d[comparison];
      const v = computeVariance(d.AC, cmp, higherIsBetter);
      const exact = { ...format, compact: false };
      const rows: ChartTooltipRow[] = [
        { label: "AC", value: formatValue(d.AC, exact), strong: true },
      ];
      if (cmp != null && isFinite(cmp))
        rows.push({ label: comparison, value: formatValue(cmp, exact) });
      if (v) {
        const color =
          v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
        const pct = v.pct != null ? ` (${formatPercent(v.pct)})` : "";
        rows.push({
          label: `Δ${comparison}`,
          value: `${formatSigned(v.abs, exact)}${pct}`,
          color,
        });
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

    // Screen-reader data table: the chart's numbers (AC, the comparison, and the
    // shown variance) as a real <table>, so SR users read values, not the svg.
    const a11yColumns = [
      "AC",
      comparison,
      ...(showVariancePanel ? [`Δ${comparison}`, `Δ${comparison}%`] : []),
    ];
    const a11yRows: ChartDataRow[] = data.map((d, i) => {
      const cmp = d[comparison];
      const v = variances[i];
      const cells: Array<string | number> = [
        formatValue(d.AC, format),
        cmp != null && isFinite(cmp) ? formatValue(cmp, format) : "n/a",
      ];
      if (showVariancePanel) {
        cells.push(v ? formatSigned(v.abs, format) : "n/a");
        cells.push(v ? formatPercent(v.pct) : "n/a");
      }
      return { label: d.category, cells };
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
                ? `${title}. AC versus ${comparison} columns with a variance panel.`
                : `AC versus ${comparison} columns`
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
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="5"
                stroke={tokens.scenario.FC.stroke}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          {onSelect && <style>{SELECTABLE_MARK_CSS}</style>}

          {title && (
            <text x={padL} y={18} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, width - padL - padR, 13)}
            </text>
          )}

          {/* Zero baseline (sits inside the plot; columns grow up/down from it) */}
          <line
            x1={padL}
            y1={zeroY}
            x2={width - padR}
            y2={zeroY}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {data.map((d, i) => {
            const cx = cxOf(i);
            const py = d[comparison];
            const pl = d.PL;
            const info = { category: d.category, scenario: "AC" as const, value: d.AC, datum: d };
            // The visible marks of this category, in final (un-animated)
            // geometry: the tooltip fires only near these - the full-height
            // band rect below stays as the generous click/focus target.
            const yAC = yOf(d.AC);
            const markRects: MarkRect[] = [
              mark === "pin"
                ? {
                    x: cx - 5,
                    y: Math.min(zeroY, yAC) - 5,
                    width: 10,
                    height: Math.abs(yAC - zeroY) + 10,
                  }
                : {
                    x: cx - acW / 2,
                    y: Math.min(zeroY, yAC),
                    width: acW,
                    height: Math.abs(yAC - zeroY),
                  },
            ];
            if (py != null && isFinite(py))
              markRects.push({
                x: cx - pyW / 2,
                y: Math.min(zeroY, yOf(py)),
                width: pyW,
                height: Math.abs(yOf(py) - zeroY),
              });
            if (comparison !== "PL" && pl != null && isFinite(pl))
              markRects.push({
                x: cx - pyW / 2,
                y: Math.min(zeroY, yOf(pl)),
                width: pyW,
                height: Math.abs(yOf(pl) - zeroY),
              });
            if (showVariancePanel && variances[i])
              markRects.push({ x: cx - acW / 2, y: varMid - varH / 2, width: acW, height: varH });
            return (
              <g
                key={d.category}
                {...selectableMarkProps(
                  onSelect ? () => onSelect(info) : undefined,
                  `Select ${d.category}, AC ${formatValue(d.AC, format)}`,
                )}
                {...marks.forMark(info, markRects)}
                style={onSelect ? { cursor: "pointer" } : undefined}
              >
                {/* Transparent full-band hit target so the whole column is click/hover-able */}
                {(onSelect || hoverEnabled) && (
                  <rect
                    x={cxOf(i) - band / 2}
                    y={padT}
                    width={band}
                    height={height - padT}
                    fill="transparent"
                  />
                )}
                {/* Comparison column behind (wider) - drawn in the COMPARISON
                scenario's own IBCS notation, not always solid grey: PY solid,
                PL a hollow white frame ("the plan hasn't happened"), FC hatched.
                This is what makes an AC-vs-Plan chart show plan as a white/empty
                rectangle rather than a filled bar. */}
                {py != null &&
                  isFinite(py) &&
                  (() => {
                    const st = tokens.scenario[comparison];
                    const r = { x: cx - pyW / 2, y: colTop(py), width: pyW, height: colH(py) };
                    if (st.variant === "frame")
                      return (
                        <rect
                          {...r}
                          fill={tokens.color.surface}
                          stroke={st.stroke}
                          strokeWidth={1.25}
                        />
                      );
                    if (st.variant === "hatch")
                      return (
                        <rect {...r} fill={`url(#${hatchId})`} stroke={st.stroke} strokeWidth={1} />
                      );
                    return <rect {...r} fill={st.fill} />;
                  })()}
                {/* Actual in front: solid column, or a pin (line + dot) */}
                {mark === "pin" ? (
                  <>
                    <line
                      x1={cx}
                      y1={zeroY}
                      x2={cx}
                      y2={gY(d.AC)}
                      stroke={tokens.scenario.AC.fill}
                      strokeWidth={2.5}
                    />
                    <circle cx={cx} cy={gY(d.AC)} r={4} fill={tokens.scenario.AC.fill} />
                  </>
                ) : (
                  <rect
                    x={cx - acW / 2}
                    y={colTop(d.AC)}
                    width={acW}
                    height={colH(d.AC)}
                    fill={tokens.scenario.AC.fill}
                  />
                )}
                {/* Plan/budget reference frame - shown when AC is compared to some
                OTHER scenario (e.g. PY) but plan data exists, so the plan is
                still on the chart as a hollow outline. When comparison==="PL"
                the comparison column above already renders it as a frame, so we
                skip here to avoid double-stroking. */}
                {comparison !== "PL" && pl != null && isFinite(pl) && (
                  <rect
                    x={cx - pyW / 2}
                    y={colTop(pl)}
                    width={pyW}
                    height={colH(pl)}
                    fill="none"
                    stroke={tokens.scenario.PL.stroke}
                    strokeWidth={1}
                  />
                )}
                {/* AC value label - drawn only when it fits its band (no overlap),
                and nudged inward at the edges so it never spills past the SVG. */}
                {(() => {
                  const s = formatValue(d.AC, format);
                  const w = estTextW(s, 11);
                  if (w > band - 1) return null;
                  const lx = clampTo(cx, padL + w / 2, width - padR - w / 2);
                  // Always just above the bar's top edge (above the zero line for
                  // negatives) so it never drops into the variance band below.
                  const ly = Math.min(zeroY, gY(d.AC)) - 5;
                  return (
                    <text x={lx} y={ly} fontSize={11} fill={tokens.color.text} textAnchor="middle">
                      {s}
                    </text>
                  );
                })()}
                {/* Category label under the chart */}
                <text
                  x={cx}
                  y={height - 6}
                  fontSize={11}
                  fill={tokens.color.textMuted}
                  textAnchor="middle"
                >
                  {fitLabel(d.category, band - 2, 11)}
                </text>
              </g>
            );
          })}

          {/* Variance panel */}
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
              {data.map((d, i) => {
                const v = variances[i];
                if (!v) return null;
                const cx = cxOf(i);
                const val = variance === "pct" ? (v.pct ?? 0) : v.abs;
                const h = (Math.abs(val) / varMax) * (varH / 2) * grow;
                const color =
                  val === 0
                    ? tokens.color.zero
                    : v.favorable
                      ? tokens.color.good
                      : tokens.color.bad;
                const up = val >= 0;
                const label =
                  variance === "pct" ? formatPercent(v.pct) : formatSigned(v.abs, format);
                const tip = up ? varMid - h : varMid + h;
                return (
                  <g key={`v-${d.category}`}>
                    {mark === "pin" ? (
                      <>
                        <line
                          x1={cx}
                          y1={varMid}
                          x2={cx}
                          y2={tip}
                          stroke={color}
                          strokeWidth={2.5}
                        />
                        {val !== 0 && <circle cx={cx} cy={tip} r={3.5} fill={color} />}
                      </>
                    ) : (
                      <rect
                        x={cx - acW / 2}
                        y={up ? varMid - h : varMid}
                        width={acW}
                        height={Math.max(h, 1)}
                        fill={color}
                      />
                    )}
                    {estTextW(label, 10.5) <= band - 1 && (
                      <text
                        x={clampTo(
                          cx,
                          padL + estTextW(label, 10.5) / 2,
                          width - padR - estTextW(label, 10.5) / 2,
                        )}
                        y={up ? varMid - h - 4 : varMid + h + 12}
                        fontSize={10.5}
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
          caption={title ? `${title} - data table` : `AC versus ${comparison} - data table`}
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
