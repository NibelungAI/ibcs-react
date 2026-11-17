import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioDatum, ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { fillLabel, type IbcsLabelsOverride } from "../core/labels";
import { computeVariance } from "../core/variance";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import {
  formatInterval,
  formatPercent,
  formatSigned,
  formatValue,
  notAvailableOf,
  percentFormatOf,
  type FormatOptions,
} from "../core/format";
import { halfWidthOf } from "../core/errorBar";
import { ErrorBar } from "./ErrorBar";
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
import { useIbcsLabels, useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";

/**
 * One category column: the canonical {@link ScenarioDatum} with `AC` required -
 * this chart draws the actual in front of the comparison, so there is always an
 * actual to draw.
 *
 * The optional half-widths add vertical error bars: `acError` on the AC column
 * (AC ± acError, in AC's units), `absError` on an "abs" variance bar and
 * `pctError` on a "pct" one (in PERCENT units: 0.4 means ±0.4 %). Give the
 * variance's own error (for paired runs, the paired one); it is never derived.
 */
export type ColumnDatum = ScenarioDatum & {
  AC: number;
  acError?: number;
  absError?: number;
  pctError?: number;
};

/** A datum's variance half-width in the panel's units (pct: a fraction, like `Variance.pct`). */
function varianceErrorOf(d: ColumnDatum, variance: "abs" | "pct" | "none"): number | undefined {
  if (variance === "pct") {
    const e = halfWidthOf(d.pctError);
    return e == null ? undefined : e / 100;
  }
  return halfWidthOf(d.absError);
}

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
  /**
   * The component's own words (the scenario codes of its tooltip and table, and the columns' "Select …" names) merged onto `IbcsThemeProvider`'s.
   * See `IbcsLabels`.
   */
  labels?: IbcsLabelsOverride;
  title?: string;
  /**
   * The chart's accessible name, in place of the generated English
   * description; also the caption of its screen-reader table.
   */
  ariaLabel?: string;
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
      labels,
      title,
      ariaLabel,
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
    const words = useIbcsLabels(labels);
    const S = words.scenario;
    const cmpName = S[comparison];
    const pctFmt = percentFormatOf(format);
    const na = notAvailableOf(format);
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
        // The AC column's error bar must fit on the scale too.
        const e = halfWidthOf(d.acError);
        if (e != null && isFinite(d.AC)) {
          mn = Math.min(mn, d.AC - e);
          mx = Math.max(mx, d.AC + e);
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
      variances.forEach((v, i) => {
        if (!v) return;
        const reach = Math.abs(variance === "pct" ? (v.pct ?? 0) : v.abs);
        m = Math.max(m, reach + (varianceErrorOf(data[i]!, variance) ?? 0));
      });
      return m || 1;
    }, [variances, variance, data]);

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
    // Value → pixel in the variance panel (animated), for error bars on its marks.
    const varY = (val: number) => varMid - (val / varMax) * (varH / 2) * grow;
    // A Δ% as text, with "± half-width" when the datum has a pct error.
    const pctText = (pct: number | null, d: ColumnDatum): string => {
      const text = formatPercent(pct, pctFmt);
      const e = halfWidthOf(d.pctError);
      if (pct == null || e == null) return text;
      const half = {
        ...(typeof pctFmt === "number" ? { fractionDigits: pctFmt } : pctFmt),
        signDisplay: "auto" as const,
      };
      return `${text}\u00a0±\u00a0${formatPercent(e / 100, half)}`;
    };

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
        { label: S.AC, value: formatInterval(d.AC, halfWidthOf(d.acError), exact), strong: true },
      ];
      if (cmp != null && isFinite(cmp))
        rows.push({ label: cmpName, value: formatValue(cmp, exact) });
      if (v) {
        const color =
          v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
        const pct = v.pct != null ? ` (${pctText(v.pct, d)})` : "";
        rows.push({
          label: `Δ${cmpName}`,
          value: `${formatInterval(v.abs, halfWidthOf(d.absError), exact, true)}${pct}`,
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
      S.AC,
      cmpName,
      ...(showVariancePanel ? [`Δ${cmpName}`, `Δ${cmpName}%`] : []),
    ];
    const a11yRows: ChartDataRow[] = data.map((d, i) => {
      const cmp = d[comparison];
      const v = variances[i];
      const cells: Array<string | number> = [
        formatInterval(d.AC, halfWidthOf(d.acError), format),
        cmp != null && isFinite(cmp) ? formatValue(cmp, format) : na,
      ];
      if (showVariancePanel) {
        cells.push(v ? formatInterval(v.abs, halfWidthOf(d.absError), format, true) : na);
        cells.push(v ? pctText(v.pct, d) : na);
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
              : (ariaLabel ??
                (title
                  ? `${title}. ${S.AC} versus ${cmpName} columns with a variance panel.`
                  : `${S.AC} versus ${cmpName} columns`))
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
            // The AC column's vertical error bar, on the column's own (animated) scale.
            const acError = halfWidthOf(d.acError);
            const acErrorBar = acError != null && (
              <ErrorBar
                value={d.AC}
                halfWidth={acError}
                orientation="vertical"
                scale={gY}
                cross={cx}
                clip={[topBase, padT]}
                capSize={Math.round(Math.min(acW * 0.5, 12))}
                label={formatInterval(d.AC, acError, format)}
                tokens={tokens}
              />
            );
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
                  fillLabel(words.selectMark, {
                    label: d.category,
                    value: `${S.AC} ${formatValue(d.AC, format)}`,
                  }),
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
                    {acError != null && acErrorBar}
                    <circle cx={cx} cy={gY(d.AC)} r={4} fill={tokens.scenario.AC.fill} />
                  </>
                ) : (
                  <>
                    <rect
                      x={cx - acW / 2}
                      y={colTop(d.AC)}
                      width={acW}
                      height={colH(d.AC)}
                      fill={tokens.scenario.AC.fill}
                    />
                    {acError != null && acErrorBar}
                  </>
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
                  // negatives) so it never drops into the variance band below -
                  // and above its error bar's whisker.
                  const ly = Math.min(zeroY, gY(d.AC + (acError ?? 0))) - 5;
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
                  variance === "pct" ? formatPercent(v.pct, pctFmt) : formatSigned(v.abs, format);
                const tip = up ? varMid - h : varMid + h;
                // The variance mark's vertical error bar, and its reach past the tip.
                const varError = varianceErrorOf(d, variance);
                const reach = varError == null ? 0 : (varError / varMax) * (varH / 2) * grow;
                const varErrorBar = varError != null && (
                  <ErrorBar
                    value={val}
                    halfWidth={varError}
                    orientation="vertical"
                    scale={varY}
                    cross={cx}
                    clip={[varMid - varH / 2, varMid + varH / 2]}
                    capSize={Math.round(Math.min(acW * 0.5, 12))}
                    label={
                      variance === "pct"
                        ? pctText(v.pct, d)
                        : formatInterval(v.abs, varError, format, true)
                    }
                    tokens={tokens}
                  />
                );
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
                        {varErrorBar}
                        {val !== 0 && <circle cx={cx} cy={tip} r={3.5} fill={color} />}
                      </>
                    ) : (
                      <>
                        <rect
                          x={cx - acW / 2}
                          y={up ? varMid - h : varMid}
                          width={acW}
                          height={Math.max(h, 1)}
                          fill={color}
                        />
                        {varErrorBar}
                      </>
                    )}
                    {estTextW(label, 10.5) <= band - 1 && (
                      <text
                        x={clampTo(
                          cx,
                          padL + estTextW(label, 10.5) / 2,
                          width - padR - estTextW(label, 10.5) / 2,
                        )}
                        y={up ? varMid - h - reach - 4 : varMid + h + reach + 12}
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
          caption={
            ariaLabel ??
            (title ? `${title} - data table` : `${S.AC} versus ${cmpName} - data table`)
          }
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
