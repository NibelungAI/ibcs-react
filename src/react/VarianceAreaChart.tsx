import { forwardRef, useId, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeVariance } from "../core/variance";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { computeVarianceArea, type VarianceAreaDatum, type XY } from "../core/varianceArea";
import { useMountGrow, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";
import { useIbcsTokens } from "./theme";

export type { VarianceAreaDatum } from "../core/varianceArea";

/** A connected `<path>` `d` over pixel points. */
function linePath(pts: XY[]): string {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/** A `points` attribute for a `<polygon>`. */
function polyPoints(pts: XY[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export interface VarianceAreaChartProps {
  /** The periods, in order. Each carries an actual, a reference, and maybe FC. */
  data: VarianceAreaDatum[];
  /**
   * First index of the forecast tail — points from here on are drawn hatched
   * (and use `FC` when present). Omit for an all-actual series.
   */
  forecastFrom?: number;
  /** Tag shown beside the reference (Ø average) line. Default "Ø". */
  referenceLabel?: string;
  /** Whether a higher value is good — set false for cost series. Default true. */
  higherIsBetter?: boolean;
  /** Total-variance mark: a filled "bar" (default) or a "pin" (line + dot). */
  mark?: "bar" | "pin";
  width?: number;
  height?: number;
  /**
   * Horizontal point spacing — the lead-in/out gutter at the plot edges. Omit
   * for the centred default; pass `{ outer: 0 }` to anchor the first/last points
   * to the edges so the series fills the plot width (no side whitespace).
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
   * Fired as the pointer moves over / leaves a period (`null` on leave) — for a
   * custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<VarianceAreaDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on hover or keyboard focus (AC,
   * reference, Δ). Default true; set false to opt out (e.g. when wiring your
   * own via `onHover`). Renders on the client only, near a hovered mark (or the
   * focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
}

/**
 * IBCS "actual vs average" variance AREA chart (the Zebra-style small multiple).
 *
 * A dark ACTUAL line sits over a light-grey REFERENCE area (Ø average / PY / PL,
 * filled from the zero baseline up to the reference level). The GAP between them
 * is filled by favorability — green where actual is favorable vs the reference,
 * red where unfavorable (impact, via `higherIsBetter`) — split cleanly at every
 * crossing. An optional FORECAST tail (`forecastFrom` onward) is hatched, and a
 * small total-variance bar/pin with a signed % label sits on the right.
 *
 * Zero-dependency, pure SVG, SSR-safe; theme through `tokens` (or an enclosing
 * `IbcsThemeProvider`). Designed to tile in small multiples and stay legible
 * down to ~220px wide.
 *
 * The component renders the chart `<svg>` plus (on hover or keyboard focus) a
 * floating tooltip, so `className` / `style` / the forwarded ref all land on
 * the `<svg>`.
 */
export const VarianceAreaChart = forwardRef<SVGSVGElement, VarianceAreaChartProps>(
  function VarianceAreaChart(
    {
      data,
      forecastFrom,
      referenceLabel = "Ø",
      higherIsBetter = true,
      mark = "bar",
      width = 320,
      height = 200,
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
    // Sanitised so the id stays a valid selector after an SVG export/serialization.
    const hatchId = svgSafeId(useId());
    const hover = useChartHover<VarianceAreaDatum>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;
    // Grow on mount, replaying when the data identity changes.
    const grow = useMountGrow(650, 0, data);

    const padL = 10;
    const padR = 52; // room for the right-side total mark + % label
    const padT = title ? 28 : 12;
    const labelH = 20;
    const x0 = padL;
    const x1 = width - padR;
    const y0 = padT;
    const y1 = height - labelH;

    // Band layout (point placement). A pure area has no bar width (RATIO 0 ⇒
    // inner 1, outer 0.5), which reproduces the historical centred placement
    // exactly; `bandPadding` lets a caller trim the gutter (`{ outer: 0 }`) so the
    // series fills the plot edge-to-edge. The core lays points out as
    // `x0 + band·i + band/2`, so we feed it SYNTHETIC x-bounds whose own centred
    // placement coincides with `scale`'s centres: for step `s` and first centre
    // `c0`, a span with `(sx1 − sx0)/n = s` and `sx0 + s/2 = c0`, i.e.
    // `sx0 = c0 − s/2`, `sx1 = sx0 + n·s`. Default → sx0=x0, sx1=x1 (identical).
    const nData = data.length;
    const scale = bandScale(x1 - x0, nData, resolveBandPadding(0, bandPadding), x0);
    const sx0 = scale.center(0) - scale.step / 2;
    const sx1 = sx0 + nData * scale.step;

    const layout = computeVarianceArea(
      data,
      { x0: sx0, x1: sx1, y0, y1, grow },
      { forecastFrom, higherIsBetter },
    );
    const {
      points,
      segments,
      referenceActual,
      referenceForecast,
      domainMin,
      domainMax,
      zeroY,
      forecastFrom: ff,
      total,
    } = layout;
    const n = points.length;

    // FINAL (un-animated) value → y, mirroring the core's own `yRest`: the
    // layout's `y`/`refY` already carry the grow factor, but hover geometry
    // must be the resting geometry (the marks the pointer will actually meet).
    const vRange = domainMax - domainMin || 1;
    const yRest = (v: number) => y1 - ((v - domainMin) / vRange) * (y1 - y0);

    const acStroke = tokens.scenario.AC.stroke;
    const greyFill = tokens.color.neutral;
    const refLineColor = tokens.color.zero;

    // Split the AC line into a solid actual run and a dashed forecast tail, sharing
    // the boundary point so they join seamlessly.
    const solidLine = ff == null ? points : points.slice(0, ff + 1);
    const dashLine = ff == null ? [] : points.slice(ff);
    const refLine = points.map((p) => ({ x: p.x, y: p.refY }));

    const labelStep = Math.max(1, Math.ceil(n / 8));
    const showMarkers = n > 0 && n <= 18;

    // Right-side total-variance mark, anchored to the zero line.
    const markX = width - padR / 2;
    const up = total.abs >= 0;
    const availV = Math.max(up ? zeroY - y0 : y1 - zeroY, 1);
    const tFrac = total.pct != null ? Math.min(Math.abs(total.pct), 1) : 0.4;
    const tMag = tFrac * availV * 0.9 * grow;
    const tTip = up ? zeroY - tMag : zeroY + tMag;
    // Un-animated tip of the same mark, for the hover rect below.
    const tMagRest = tFrac * availV * 0.9;
    const tTipRest = up ? zeroY - tMagRest : zeroY + tMagRest;
    const tColor =
      total.abs === 0 ? tokens.color.zero : total.favorable ? tokens.color.good : tokens.color.bad;
    const tLabel = total.pct != null ? formatPercent(total.pct) : formatSigned(total.abs, format);
    // Hover geometry for that end mark (a pin's line is widened to ±5px).
    const totalMarkRect: MarkRect =
      mark === "pin"
        ? {
            x: markX - 5,
            y: Math.min(zeroY, tTipRest) - 5,
            width: 10,
            height: Math.abs(tTipRest - zeroY) + 10,
          }
        : {
            x: markX - 5,
            y: Math.min(zeroY, tTipRest),
            width: 10,
            height: Math.max(Math.abs(tTipRest - zeroY), 1),
          };

    // Values render at FULL precision (compact: false): the printed labels are
    // compact, so the tooltip adds the exact figure instead of echoing it.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const reference = h.datum.reference;
      const v = computeVariance(h.value, reference, higherIsBetter);
      const exact = { ...format, compact: false };
      const rows: ChartTooltipRow[] = [
        { label: h.scenario ?? "AC", value: formatValue(h.value, exact), strong: true },
        { label: referenceLabel, value: formatValue(reference, exact) },
      ];
      if (v) {
        const color =
          v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
        const pct = v.pct != null ? ` (${formatPercent(v.pct)})` : "";
        rows.push({ label: "Δ", value: `${formatSigned(v.abs, exact)}${pct}`, color });
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

    const band = scale.step;

    // Screen-reader data table: per period the actual the dark line traces, the
    // reference level the grey area fills to, and the gap the green/red band
    // between them shows. Forecast periods are tagged, mirroring the hatched
    // tail, and the closing row carries the right-hand total-variance mark.
    const a11yColumns = ["AC", referenceLabel, "Δ"];
    const a11yRows: ChartDataRow[] = points.map((p) => ({
      label: p.forecast ? `${p.category} (FC)` : p.category,
      cells: [
        formatValue(p.value, format),
        formatValue(p.reference, format),
        formatSigned(p.gap, format),
      ],
    }));
    if (n > 0) {
      a11yRows.push({
        label: "Total variance",
        cells: [
          "n/a",
          "n/a",
          total.pct != null
            ? `${formatSigned(total.abs, format)} (${formatPercent(total.pct)})`
            : formatSigned(total.abs, format),
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
              ? `${title}. Actual versus reference area over ${n} periods.`
              : `Actual versus reference area over ${n} periods`
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

          {title && (
            <text x={padL} y={18} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, width - padL - 4, 13)}
            </text>
          )}

          {/* Grey reference area (zero → reference); forecast span repeated hatched */}
          {referenceActual.length > 0 && (
            <polygon
              points={polyPoints(referenceActual)}
              fill={greyFill}
              fillOpacity={0.16}
              stroke="none"
            />
          )}
          {referenceForecast.length > 0 && (
            <>
              <polygon
                points={polyPoints(referenceForecast)}
                fill={greyFill}
                fillOpacity={0.16}
                stroke="none"
              />
              <polygon
                points={polyPoints(referenceForecast)}
                fill={`url(#${hatchId})`}
                stroke="none"
              />
            </>
          )}

          {/* Green/red variance gap polygons (clipped to the value↔reference band) */}
          {segments.map((s, i) => (
            <polygon
              key={`seg-${i}`}
              points={polyPoints(s.points)}
              fill={s.favorable ? tokens.color.good : tokens.color.bad}
              stroke="none"
            />
          ))}
          {/* Hatch overlay marking the forecast portion of the gap fills */}
          {segments.map((s, i) =>
            s.forecast ? (
              <polygon
                key={`seg-h-${i}`}
                points={polyPoints(s.points)}
                fill={`url(#${hatchId})`}
                stroke="none"
              />
            ) : null,
          )}

          {/* Zero baseline */}
          <line
            x1={padL}
            y1={zeroY}
            x2={x1}
            y2={zeroY}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {/* Reference (Ø) line — the top edge of the grey area */}
          {n >= 2 && (
            <path
              d={linePath(refLine)}
              fill="none"
              stroke={refLineColor}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          )}

          {/* Actual line: solid run + dashed forecast tail */}
          {solidLine.length >= 2 && (
            <path
              d={linePath(solidLine)}
              fill="none"
              stroke={acStroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {dashLine.length >= 2 && (
            <path
              d={linePath(dashLine)}
              fill="none"
              stroke={acStroke}
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Point markers (only when sparse enough to read) */}
          {showMarkers &&
            points.map((p) =>
              p.forecast ? (
                <circle
                  key={`m-${p.index}`}
                  cx={p.x}
                  cy={p.y}
                  r={2.2}
                  fill={tokens.color.surface}
                  stroke={acStroke}
                  strokeWidth={1}
                />
              ) : (
                <circle key={`m-${p.index}`} cx={p.x} cy={p.y} r={2.2} fill={acStroke} />
              ),
            )}

          {/* Reference label tag at the start of the Ø line */}
          {points[0] && referenceLabel && (
            <text
              x={x0 + 2}
              y={clampTo(points[0].refY - 4, padT + 8, y1 - 2)}
              fontSize={10}
              fill={tokens.color.textMuted}
            >
              {fitLabel(referenceLabel, padR, 10)}
            </text>
          )}

          {/* Right-side total variance mark + signed % label */}
          {n > 0 && (
            <>
              <line
                x1={markX - 7}
                y1={zeroY}
                x2={markX + 7}
                y2={zeroY}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              {mark === "pin" ? (
                <>
                  <line
                    x1={markX}
                    y1={zeroY}
                    x2={markX}
                    y2={tTip}
                    stroke={tColor}
                    strokeWidth={2.5}
                  />
                  {total.abs !== 0 && <circle cx={markX} cy={tTip} r={3.5} fill={tColor} />}
                </>
              ) : (
                <rect
                  x={markX - 5}
                  y={up ? tTip : zeroY}
                  width={10}
                  height={Math.max(Math.abs(tTip - zeroY), 1)}
                  fill={tColor}
                />
              )}
              <text
                x={clampTo(
                  markX,
                  padL + estTextW(tLabel, 10.5) / 2,
                  width - 1 - estTextW(tLabel, 10.5) / 2,
                )}
                y={up ? tTip - 4 : tTip + 12}
                fontSize={10.5}
                fontWeight={600}
                fill={tColor}
                textAnchor="middle"
              >
                {tLabel}
              </text>
            </>
          )}

          {/* Period labels (thinned for dense series) */}
          {points.map((p, i) =>
            i % labelStep === 0 ? (
              <text
                key={`lab-${p.index}`}
                x={clampTo(p.x, x0, x1)}
                y={height - 6}
                fontSize={10}
                fill={tokens.color.textMuted}
                textAnchor="middle"
              >
                {fitLabel(p.category, band, 10)}
              </text>
            ) : null,
          )}

          {/* Transparent per-period hit targets for hover / tooltip */}
          {hoverEnabled &&
            points.map((p, i) => {
              // One point per datum, in data order.
              const datum = data[i];
              if (!datum) return null;
              const scenario: ScenarioKey = p.forecast ? "FC" : "AC";
              const info = { category: p.category, scenario, value: p.value, datum };
              // The visible marks under this hit rect, in FINAL geometry: the
              // vertical slice of the AC↔reference band at this period (the
              // area, its two lines and the point marker all live in it), plus
              // the right-side total mark on the closing period's band.
              const yValue = yRest(p.value);
              const yRef = yRest(p.reference);
              const markRects: MarkRect[] = [
                {
                  x: p.x - band / 2,
                  y: Math.min(yValue, yRef),
                  width: band,
                  height: Math.abs(yValue - yRef),
                },
              ];
              if (i === n - 1) markRects.push(totalMarkRect);
              return (
                <rect
                  key={`hit-${p.index}`}
                  x={p.x - band / 2}
                  y={padT}
                  width={band}
                  height={y1 - padT}
                  fill="transparent"
                  {...marks.forMark(info, markRects)}
                />
              );
            })}
        </svg>
        <ChartDataTable
          caption={title ? `${title} — data table` : `Actual versus ${referenceLabel} — data table`}
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
