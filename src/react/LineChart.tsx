import { forwardRef, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import {
  computeLines,
  splitForecast,
  type LineDatum,
  type LinePoint,
  type LineSeries,
} from "../core/lineArea";
import { resolveReferences, type ReferenceLine, type ReferenceBand } from "../core/reference";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween } from "./hooks";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";

export type { LineDatum } from "../core/lineArea";
export type { Reference, ReferenceLine, ReferenceBand } from "../core/reference";

/**
 * At or below this many points per series, point markers are drawn (IBCS asks
 * for markers so a line reads as a connector, not a continuous measurement).
 * Above it, markers are omitted so hundreds of points stay one cheap `<path>`.
 */
export const MARKER_DENSITY_THRESHOLD = 40;

export interface LineChartProps {
  /** The periods, in order. Handles a handful up to hundreds of points. */
  data: LineDatum[];
  /** Scenarios to draw, in order. Default: those present in the data. */
  series?: ScenarioKey[];
  /** Reference scenario for the optional variance panel. Default "PY". */
  comparison?: ScenarioKey;
  /** Higher is better (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /**
   * The lower current-vs-comparison variance panel: "abs" shows Δ values,
   * "pct" shows Δ%, "none" omits the panel entirely. Default "none" - a dense
   * line chart is read as a shape first, so the panel is opt-in here.
   */
  variance?: "abs" | "pct" | "none";
  /** Force markers on/off. Default: auto by point density (see threshold). */
  showMarkers?: boolean;
  /**
   * IBCS template C07 forecast tail: the input period index from which the
   * current (AC) line turns into a forecast - drawn DASHED with hollow markers,
   * matching the forecast visual language used across the library. The
   * connecting segment into the first forecast period is itself dashed. Omit
   * (default) for a fully-measured line. Out-of-range / non-finite values
   * degrade gracefully (no tail, or an all-forecast line). Only the AC series
   * is split; PY/PL/FC keep their own scenario styling.
   */
  forecastFrom?: number;
  /**
   * Reference lines / target markers and shaded tolerance bands drawn beneath
   * the data: horizontal (`axis:"y"`, at a value) or vertical (`axis:"x"`, at a
   * period index) lines, plus `from`/`to` bands. Lines are thin and dashed by
   * default in the impact-neutral axis colour unless a `color` is given; each
   * carries an optional in-box label. See {@link Reference}.
   */
  references?: (ReferenceLine | ReferenceBand)[];
  width?: number;
  height?: number;
  /**
   * Horizontal point spacing - the lead-in/out gutter at the plot edges. Omit
   * for the centred default; pass `{ outer: 0 }` to anchor the first/last points
   * to the edges so the series fills the plot width (no side whitespace).
   */
  bandPadding?: BandPadding;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Extra class name for the chart `<svg>` (the rendered root). */
  className?: string;
  /** Inline style merged OVER the chart `<svg>`'s own layout style. */
  style?: CSSProperties;
}

/** Per-scenario stroke style for line rendering (no legend box - end labels carry it). */
function lineStyle(
  scenario: ScenarioKey,
  tokens: IbcsTokens,
): { stroke: string; width: number; dash?: string } {
  switch (scenario) {
    // Actual: solid, dark, heaviest - "this is real".
    case "AC":
      return { stroke: tokens.scenario.AC.stroke, width: 2 };
    // Previous year: solid, faded grey - "the past".
    case "PY":
      return { stroke: tokens.color.neutral, width: 1.75 };
    // Plan / budget: dashed - "not real yet".
    case "PL":
      return { stroke: tokens.scenario.PL.stroke, width: 1.5, dash: "5 3" };
    // Forecast: dotted - "expected".
    case "FC":
      return { stroke: tokens.scenario.FC.stroke, width: 1.5, dash: "1.5 2.5" };
  }
}

/**
 * Style for the forecast tail of an otherwise-solid (AC) line: same hue and
 * weight as its measured run, but dashed - the IBCS "this part is forecast"
 * treatment (paired with hollow markers). Mirrors TrendChart's hatched FC.
 * Only AC is ever split (PY/PL/FC already carry their own dash).
 */
function forecastTailDash(): string {
  return "5 3";
}

/**
 * One `<path>` string per series. Subpaths break (an `M` instead of `L`)
 * wherever a period is missing, so genuine gaps are not bridged - yet the whole
 * line is still a single element, which keeps dense series cheap to render.
 */
function buildPath(
  points: LinePoint[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  let d = "";
  let prev = -2;
  for (const p of points) {
    const cmd = p.index === prev + 1 ? "L" : "M";
    d += `${cmd}${x(p.index).toFixed(1)},${y(p.value).toFixed(1)} `;
    prev = p.index;
  }
  return d.trim();
}

/**
 * Approximate rendered width of `s` in px at `fontSize` - wide glyphs (CJK,
 * fullwidth, emoji) ~1.05·em, normal ~0.62·em. SSR-safe (no DOM measuring).
 *
 * Deliberately local: the shared `internal/text` heuristic is width-agnostic,
 * and the integrated end labels here are clamped against the right edge, where
 * a CJK label measured at 0.6·em would spill out of the svg.
 */
function textWidthPx(s: string, fontSize: number): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      cp >= 0x1f000;
    w += fontSize * (wide ? 1.05 : 0.62);
  }
  return w;
}

/** Ellipsis-truncate `s` so its estimated width fits `maxPx`. Unicode-aware. */
function fitText(s: string, maxPx: number, fontSize: number): string {
  if (maxPx <= 0 || !s) return "";
  if (textWidthPx(s, fontSize) <= maxPx) return s;
  const ellW = textWidthPx("…", fontSize);
  let w = 0;
  let out = "";
  for (const ch of s) {
    const cw = textWidthPx(ch, fontSize);
    if (w + cw + ellW > maxPx) break;
    out += ch;
    w += cw;
  }
  out = out.trimEnd();
  return out ? out + "…" : maxPx >= ellW ? "…" : "";
}

/**
 * IBCS line chart (template C07) for dense, multi-series time data. Each
 * scenario is drawn as a single connector path with scenario-specific styling
 * (AC solid, PY grey, PL dashed, FC dotted); markers appear only when the
 * series is sparse. Values are labelled inline beside each line's last point
 * (no external legend), supports positive and negative values against a zero
 * baseline, and an optional lower panel shows the current series' variance.
 *
 * A forwarded `ref` lands on the chart `<svg>` - the useful handle for export /
 * serialization - even though the component also renders a screen-reader table
 * beside it.
 */
export const LineChart = forwardRef<SVGSVGElement, LineChartProps>(function LineChart(
  {
    data: dataProp,
    series,
    comparison = "PY",
    higherIsBetter = true,
    variance = "none",
    showMarkers,
    forecastFrom,
    references,
    width = 720,
    height = 360,
    bandPadding,
    format = {},
    tokens: tokenOverride,
    title,
    className,
    style,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const data = useDataTween(dataProp);
  const grow = useMountGrow(700, 0, data);

  // `variance` doubles as the panel's on/off switch - resolve it to the plain
  // flag + mode the geometry below already speaks.
  const showVariancePanel = variance !== "none";
  const varianceMode = variance === "pct" ? "pct" : "abs";

  const layout = useMemo(
    () => computeLines(data, { series, comparison, varianceMode, higherIsBetter }),
    [data, series, comparison, varianceMode, higherIsBetter],
  );
  const {
    categories,
    series: lines,
    domainMin,
    domainMax,
    variance: variancePoints,
    varMax,
  } = layout;

  const n = categories.length || 1;
  const maxPts = lines.reduce((m, s) => Math.max(m, s.points.length), 0);
  const markers = showMarkers ?? maxPts <= MARKER_DENSITY_THRESHOLD;

  const padL = 14;
  const padR = 52; // room for the integrated end labels
  const padT = title ? 32 : 16;
  const labelH = 22;
  const gap = 16;
  const innerW = width - padL - padR;

  const varH =
    showVariancePanel && variancePoints.length ? Math.round((height - padT - labelH) * 0.28) : 0;
  const topH = height - padT - labelH - (varH ? varH + gap : 0);
  const plotBottom = padT + topH;

  const vRange = domainMax - domainMin || 1;
  const y = (v: number) => plotBottom - ((v - domainMin) / vRange) * topH;
  const zeroY = y(0);
  // Grow lines up from the zero baseline on mount / data change.
  const yA = (v: number) => zeroY + (y(v) - zeroY) * grow;

  // Centered category positions so markers/labels align with their period. A
  // pure line has no bar width (RATIO 0 ⇒ inner 1, outer 0.5), which reproduces
  // the historical centred placement exactly; `bandPadding` lets a caller trim
  // the gutter (`{ outer: 0 }`) so the series fills the plot edge-to-edge.
  const scale = bandScale(innerW, n, resolveBandPadding(0, bandPadding), padL);
  const band = scale.step;
  const x = (i: number) => scale.center(i);

  // Thin the x labels so a dense series shows at most ~12 ticks.
  const labelStep = Math.max(1, Math.ceil(n / 12));

  const varMid = plotBottom + gap + varH / 2;

  // Map any reference lines / bands to pixel geometry against the plot box.
  // The static (non-animated) `y` is used so a target line stays fixed while
  // the data grows up from the baseline on mount.
  const resolvedRefs = resolveReferences(
    references,
    { left: padL, right: width - padR, top: padT, bottom: plotBottom },
    { x, y },
  );

  // Resolve a vertical offset for each end label so colliding lines don't overlap.
  const endLabels = lines
    .filter((s): s is LineSeries & { endPoint: LinePoint } => s.endPoint != null)
    .map((s) => ({ scenario: s.scenario, point: s.endPoint, y: yA(s.endPoint.value) }))
    .sort((a, b) => a.y - b.y);
  // Push each label at least 11px below its predecessor (the list is sorted by y).
  const destackEndLabels = () => {
    let prev: { y: number } | undefined;
    for (const e of endLabels) {
      if (prev && e.y - prev.y < 11) e.y = prev.y + 11;
      prev = e;
    }
  };
  destackEndLabels();
  // Keep the stacked labels inside the plot: shift up if they overran the
  // bottom, then pin the top one below the title.
  const firstEndLabel = endLabels[0];
  const lastEndLabel = endLabels[endLabels.length - 1];
  if (firstEndLabel && lastEndLabel) {
    const topLimit = padT + 4;
    const botLimit = plotBottom - 2;
    const overflow = lastEndLabel.y - botLimit;
    if (overflow > 0) for (const e of endLabels) e.y -= overflow;
    if (firstEndLabel.y < topLimit) firstEndLabel.y = topLimit;
    destackEndLabels();
  }

  // Screen-reader data table: each period's value per scenario, plus the shown
  // variance - so SR users read the actual numbers, not the decorative svg.
  const hasVarTable = showVariancePanel && variancePoints.length > 0;
  const a11yColumns = [
    ...lines.map((s) => s.scenario),
    ...(hasVarTable ? [`Δ${comparison}`, `Δ${comparison}%`] : []),
  ];
  const lineByIndex = lines.map((s) => new Map(s.points.map((p) => [p.index, p.value])));
  const varByIndex = new Map(variancePoints.map((vp) => [vp.index, vp.variance]));
  const a11yRows: ChartDataRow[] = categories.map((c, i) => {
    const cells: Array<string | number> = lineByIndex.map((byIndex) => {
      const val = byIndex.get(i);
      return val != null ? formatValue(val, format) : "n/a";
    });
    if (hasVarTable) {
      const v = varByIndex.get(i);
      cells.push(v ? formatSigned(v.abs, format) : "n/a");
      cells.push(v ? formatPercent(v.pct) : "n/a");
    }
    return { label: c, cells };
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
        aria-label={
          title
            ? `${title}. Line chart of ${n} periods across ${lines.length} series.`
            : `Line chart of ${n} periods across ${lines.length} series`
        }
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
            {fitText(title, width - padL - 4, 13)}
          </text>
        )}

        {/* Zero baseline */}
        <line
          x1={padL}
          y1={zeroY}
          x2={width - padR}
          y2={zeroY}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />

        {/* Reference bands & lines - drawn UNDER the data so they read as a
          backdrop the series sits on. Bands shade first, then lines, then
          their clamped in-box labels. */}
        {resolvedRefs.length > 0 && (
          <g>
            {resolvedRefs.map((r, i) =>
              r.kind === "band" ? (
                <rect
                  key={`refb-${i}`}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={r.color ?? tokens.color.axis}
                  opacity={0.16}
                />
              ) : null,
            )}
            {resolvedRefs.map((r, i) =>
              r.kind === "line" ? (
                <line
                  key={`refl-${i}`}
                  x1={r.x1}
                  y1={r.y1}
                  x2={r.x2}
                  y2={r.y2}
                  stroke={r.color ?? tokens.color.axis}
                  strokeWidth={1}
                  strokeDasharray={r.dash ? "4 3" : undefined}
                />
              ) : null,
            )}
            {resolvedRefs.map((r, i) => {
              if (!r.label) return null;
              const col = r.color ?? tokens.color.textMuted;
              const left = padL;
              const right = width - padR;
              // Horizontal annotation (axis "y"): caption pinned to the left edge,
              // just above the line / inside the band top, clamped vertically.
              if (r.axis === "y") {
                const anchorY = r.kind === "line" ? r.y1 - 3 : r.y + 10;
                const ty = Math.min(Math.max(anchorY, padT + 9), plotBottom - 2);
                return (
                  <text
                    key={`reft-${i}`}
                    x={left + 2}
                    y={ty}
                    fontSize={9.5}
                    fill={col}
                    textAnchor="start"
                  >
                    {fitText(r.label, innerW - 4, 9.5)}
                  </text>
                );
              }
              // Vertical annotation (axis "x"): caption centered on the line /
              // band, near the top, clamped horizontally inside the plot.
              const fitted = fitText(r.label, innerW - 4, 9.5);
              const estW = textWidthPx(fitted, 9.5);
              const center = r.kind === "line" ? r.x1 : r.x + r.width / 2;
              const tx = Math.min(Math.max(center, left + estW / 2 + 1), right - estW / 2 - 1);
              return (
                <text
                  key={`reft-${i}`}
                  x={tx}
                  y={padT + 9}
                  fontSize={9.5}
                  fill={col}
                  textAnchor="middle"
                >
                  {fitted}
                </text>
              );
            })}
          </g>
        )}

        {/* Scenario lines - one path each, drawn back-to-front so AC sits on top.
          The measured (AC) line splits at `forecastFrom` into a solid run plus a
          dashed forecast tail (template C07); other scenarios draw whole. */}
        {lines
          .map((s, si) => ({ s, si }))
          .reverse()
          .map(({ s, si }) => {
            const st = lineStyle(s.scenario, tokens);
            if (!s.points.length) return null;
            const split =
              s.scenario === "AC" && forecastFrom != null
                ? splitForecast(s.points, forecastFrom)
                : null;
            if (split && split.forecast.length) {
              return (
                <g key={`line-${si}`}>
                  {split.solid.length > 0 && (
                    <path
                      d={buildPath(split.solid, x, yA)}
                      fill="none"
                      stroke={st.stroke}
                      strokeWidth={st.width}
                      strokeDasharray={st.dash}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  <path
                    d={buildPath(split.forecast, x, yA)}
                    fill="none"
                    stroke={st.stroke}
                    strokeWidth={st.width}
                    strokeDasharray={forecastTailDash()}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              );
            }
            return (
              <path
                key={`line-${si}`}
                d={buildPath(s.points, x, yA)}
                fill="none"
                stroke={st.stroke}
                strokeWidth={st.width}
                strokeDasharray={st.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

        {/* Point markers - only when sparse enough to read as connectors, not
          noise. AC points at/after `forecastFrom` are drawn HOLLOW to denote
          forecast, mirroring the dashed tail. */}
        {markers &&
          lines.map((s, si) => {
            const st = lineStyle(s.scenario, tokens);
            return s.points.map((p) => {
              const forecast =
                s.scenario === "AC" && forecastFrom != null && p.index >= forecastFrom;
              return forecast ? (
                <circle
                  key={`m-${si}-${p.index}`}
                  cx={x(p.index)}
                  cy={yA(p.value)}
                  r={2.2}
                  fill={tokens.color.surface}
                  stroke={st.stroke}
                  strokeWidth={1}
                />
              ) : (
                <circle
                  key={`m-${si}-${p.index}`}
                  cx={x(p.index)}
                  cy={yA(p.value)}
                  r={2.2}
                  fill={st.stroke}
                />
              );
            });
          })}

        {/* Integrated end labels beside each line's last point (no legend box) */}
        {endLabels.map((e) => {
          const st = lineStyle(e.scenario, tokens);
          const label = `${e.scenario} ${formatValue(e.point.value, format)}`;
          // Clamp x so a wide value label never spills past the right edge.
          const estW = textWidthPx(label, 10);
          const tx = Math.max(padL, Math.min(x(e.point.index) + 6, width - 2 - estW));
          return (
            <text
              key={`end-${e.scenario}`}
              x={tx}
              y={e.y + 3.5}
              fontSize={10}
              fontWeight={e.scenario === "AC" ? 600 : 400}
              fill={st.stroke}
              textAnchor="start"
            >
              {label}
            </text>
          );
        })}

        {/* Period labels (thinned for dense series) */}
        {categories.map((c, i) =>
          i % labelStep === 0 ? (
            <text
              key={`lab-${i}`}
              x={x(i)}
              y={plotBottom + (varH ? varH + gap : 0) + labelH - 6}
              fontSize={10.5}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {fitText(c, band, 10.5)}
            </text>
          ) : null,
        )}

        {/* Variance panel: current series vs comparison, colored by favorability */}
        {varH > 0 && (
          <>
            <line
              x1={padL}
              y1={varMid}
              x2={width - padR}
              y2={varMid}
              stroke={tokens.color.axis}
              strokeWidth={1}
            />
            {variancePoints.map((vp) => {
              const v = vp.variance;
              const val = varianceMode === "pct" ? (v.pct ?? 0) : v.abs;
              // Leave headroom inside the panel for the value label so it never
              // overlaps the period labels in the strip below.
              const varHalf = Math.max(4, varH / 2 - 10);
              const h = (Math.abs(val) / varMax) * varHalf * grow;
              const color =
                val === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
              const up = val >= 0;
              const w = Math.min(band * 0.5, 14);
              // Only label variance bars when the band is wide enough that adjacent
              // centered labels can't collide (in addition to the point-density gate).
              const showLbl = maxPts <= MARKER_DENSITY_THRESHOLD && band >= 34;
              const label =
                varianceMode === "pct" ? formatPercent(v.pct) : formatSigned(v.abs, format);
              return (
                <g key={`var-${vp.index}`}>
                  <rect
                    x={x(vp.index) - w / 2}
                    y={up ? varMid - h : varMid}
                    width={w}
                    height={Math.max(h, 1)}
                    fill={color}
                  />
                  {showLbl && (
                    <text
                      x={x(vp.index)}
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
          title ? `${title} - data table` : `Line chart of ${lines.length} series - data table`
        }
        columns={a11yColumns}
        rows={a11yRows}
      />
    </>
  );
});
