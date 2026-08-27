import { forwardRef, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeLines, type LineDatum, type LinePoint } from "../core/lineArea";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween } from "./hooks";
import { MARKER_DENSITY_THRESHOLD } from "./LineChart";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";

export type { LineDatum } from "../core/lineArea";

export interface AreaChartProps {
  /** The periods, in order. Handles a handful up to hundreds of points. */
  data: LineDatum[];
  /** Scenario filled to the zero baseline. Default "AC". */
  scenario?: ScenarioKey;
  /**
   * Reference scenario drawn as a line on top of the area (the classic PY
   * overlay). Pass `null` to omit. Default "PY".
   */
  baseline?: ScenarioKey | null;
  /** Force markers on/off. Default: auto by point density. */
  showMarkers?: boolean;
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
  /** Extra class name for the chart `<svg>` (the rendered root). */
  className?: string;
  /** Inline style merged OVER the chart `<svg>`'s own layout style. */
  style?: CSSProperties;
}

/** One `<path>` per series, breaking subpaths across missing periods. */
function buildLine(
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
 * Closed area path: the line, then back along the zero baseline, so the fill is
 * the band between the curve and zero. Correct for positive, negative, and
 * crossing series (the baseline return closes whatever the curve traced).
 */
function buildArea(
  points: LinePoint[],
  x: (i: number) => number,
  y: (v: number) => number,
  zeroY: number,
): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return "";
  const line = points.map((p) => `L${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    `M${x(first.index).toFixed(1)},${zeroY.toFixed(1)} ` +
    line +
    ` L${x(last.index).toFixed(1)},${zeroY.toFixed(1)} Z`
  );
}

/**
 * Approximate rendered width of `s` in px at `fontSize` — wide glyphs (CJK,
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
 * IBCS area chart (template C08): a single scenario filled to the zero baseline,
 * with an optional reference line (PY by default) drawn on top. Supports
 * positive and negative values against a zero value axis; markers appear on the
 * area's top line only when the series is sparse enough to read as connectors.
 *
 * A forwarded `ref` lands on the chart `<svg>` — the useful handle for export /
 * serialization — even though the component also renders a screen-reader table
 * beside it.
 */
export const AreaChart = forwardRef<SVGSVGElement, AreaChartProps>(function AreaChart(
  {
    data: dataProp,
    scenario = "AC",
    baseline = "PY",
    showMarkers,
    width = 720,
    height = 320,
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

  // Draw just the area scenario and (optionally) the baseline reference.
  const wanted = baseline && baseline !== scenario ? [scenario, baseline] : [scenario];
  const layout = useMemo(
    () => computeLines(data, { series: wanted }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, scenario, baseline],
  );
  const { categories, series: lines, domainMin, domainMax } = layout;

  const areaSeries = lines.find((s) => s.scenario === scenario);
  const baseSeries = baseline ? lines.find((s) => s.scenario === baseline) : undefined;
  const points = areaSeries?.points ?? [];

  const n = categories.length || 1;
  const markers = showMarkers ?? points.length <= MARKER_DENSITY_THRESHOLD;

  const padL = 14;
  const padR = 52;
  const padT = title ? 32 : 16;
  const labelH = 22;
  const innerW = width - padL - padR;
  const topH = height - padT - labelH;
  const plotBottom = padT + topH;

  const vRange = domainMax - domainMin || 1;
  const y = (v: number) => plotBottom - ((v - domainMin) / vRange) * topH;
  const zeroY = y(0);
  const yA = (v: number) => zeroY + (y(v) - zeroY) * grow;

  // A pure area has no bar width (RATIO 0 ⇒ inner 1, outer 0.5), which reproduces
  // the historical centred placement exactly; `bandPadding` lets a caller trim
  // the gutter (`{ outer: 0 }`) so the area fills the plot edge-to-edge.
  const scale = bandScale(innerW, n, resolveBandPadding(0, bandPadding), padL);
  const band = scale.step;
  const x = (i: number) => scale.center(i);
  const labelStep = Math.max(1, Math.ceil(n / 12));

  const fill = tokens.scenario[scenario].stroke;
  const baseColor = tokens.color.neutral;

  const endPoint = areaSeries?.endPoint ?? null;

  // Integrated end labels (area scenario + optional baseline). De-collide them
  // vertically and clamp inside the plot so neither clips nor overlaps.
  const endLabels: Array<{
    key: string;
    x: number;
    y: number;
    text: string;
    fill: string;
    weight: number;
  }> = [];
  if (endPoint) {
    endLabels.push({
      key: scenario,
      x: x(endPoint.index) + 6,
      y: yA(endPoint.value) + 3.5,
      text: `${scenario} ${formatValue(endPoint.value, format)}`,
      fill,
      weight: 600,
    });
  }
  if (baseSeries?.endPoint) {
    endLabels.push({
      key: baseSeries.scenario,
      x: x(baseSeries.endPoint.index) + 6,
      y: yA(baseSeries.endPoint.value) + 3.5,
      text: `${baseSeries.scenario} ${formatValue(baseSeries.endPoint.value, format)}`,
      fill: baseColor,
      weight: 400,
    });
  }
  endLabels.sort((a, b) => a.y - b.y);
  const resolve = () => {
    let prev: { y: number } | undefined;
    for (const e of endLabels) {
      if (prev && e.y - prev.y < 11) e.y = prev.y + 11;
      prev = e;
    }
  };
  resolve();
  const firstLabel = endLabels[0];
  const lastLabel = endLabels[endLabels.length - 1];
  if (firstLabel && lastLabel) {
    const topLimit = padT + 4;
    const botLimit = plotBottom - 2;
    const overflow = lastLabel.y - botLimit;
    if (overflow > 0) for (const e of endLabels) e.y -= overflow;
    if (firstLabel.y < topLimit) firstLabel.y = topLimit;
    resolve();
  }

  // Screen-reader data table: each period's area value and the reference value —
  // so SR users read the actual numbers, not the decorative svg.
  const a11yColumns = [scenario, ...(baseSeries ? [baseSeries.scenario] : [])];
  const areaByIndex = new Map(points.map((p) => [p.index, p.value]));
  const baseByIndex = new Map((baseSeries?.points ?? []).map((p) => [p.index, p.value]));
  const a11yRows: ChartDataRow[] = categories.map((c, i) => {
    const av = areaByIndex.get(i);
    const cells: Array<string | number> = [av != null ? formatValue(av, format) : "n/a"];
    if (baseSeries) {
      const bv = baseByIndex.get(i);
      cells.push(bv != null ? formatValue(bv, format) : "n/a");
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
        // A single labelled image — no `aria-hidden`, which would cancel the
        // label out and leave assistive tech with nothing but the sr-only table.
        role="img"
        aria-label={
          title
            ? `${title}. Area chart of ${scenario} over ${n} periods.`
            : `Area chart of ${scenario} over ${n} periods`
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

        {/* Filled area to the zero baseline */}
        {points.length > 0 && (
          <path d={buildArea(points, x, yA, zeroY)} fill={fill} fillOpacity={0.18} stroke="none" />
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

        {/* PY (or chosen) reference line on top */}
        {baseSeries && baseSeries.points.length > 0 && (
          <path
            d={buildLine(baseSeries.points, x, yA)}
            fill="none"
            stroke={baseColor}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* The area's top line */}
        {points.length > 0 && (
          <path
            d={buildLine(points, x, yA)}
            fill="none"
            stroke={fill}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Markers on the top line when sparse */}
        {markers &&
          points.map((p) => (
            <circle key={`m-${p.index}`} cx={x(p.index)} cy={yA(p.value)} r={2.2} fill={fill} />
          ))}

        {/* Integrated end labels beside the last points (de-collided + clamped) */}
        {endLabels.map((e) => (
          <text
            key={e.key}
            x={Math.max(padL, Math.min(e.x, width - 2 - textWidthPx(e.text, 10)))}
            y={e.y}
            fontSize={10}
            fontWeight={e.weight}
            fill={e.fill}
            textAnchor="start"
          >
            {e.text}
          </text>
        ))}

        {/* Period labels (thinned for dense series) */}
        {categories.map((c, i) =>
          i % labelStep === 0 ? (
            <text
              key={`lab-${i}`}
              x={x(i)}
              y={height - 6}
              fontSize={10.5}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {fitText(c, band, 10.5)}
            </text>
          ) : null,
        )}
      </svg>
      <ChartDataTable
        caption={title ? `${title} — data table` : `Area chart of ${scenario} — data table`}
        columns={a11yColumns}
        rows={a11yRows}
      />
    </>
  );
});
