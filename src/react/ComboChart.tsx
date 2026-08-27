import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeCombo, type ComboDatum, type ComboSecondaryDatum } from "../core/combo";
import { computeTicks } from "../core/xy";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, formatSigned, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween } from "./hooks";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { svgSafeId } from "./internal/text";
import { useIbcsTokens } from "./theme";

// Local, CJK-aware text metrics: wide glyphs count ~1.05em where the shared
// `./internal/text` heuristic assumes a uniform 0.6em — kept for label fitting.
/**
 * Approximate rendered width of `s` in px at `fontSize` — wide glyphs (CJK,
 * fullwidth, emoji) ~1.05·em, normal ~0.62·em. SSR-safe (no DOM measuring).
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

/** Clip a label to a pixel budget, adding an ellipsis. Unicode-aware, SSR-safe. */
function fitLabel(s: string, maxPx: number, fontPx: number): string {
  if (maxPx <= 0 || !s) return "";
  if (textWidthPx(s, fontPx) <= maxPx) return s;
  const ellW = textWidthPx("…", fontPx);
  let w = 0;
  let out = "";
  for (const ch of s) {
    const cw = textWidthPx(ch, fontPx);
    if (w + cw + ellW > maxPx) break;
    out += ch;
    w += cw;
  }
  out = out.trimEnd();
  return out ? out + "…" : maxPx >= ellW ? "…" : "";
}

export type { ComboDatum, ComboSecondaryDatum } from "../core/combo";

export interface ComboChartProps {
  /** Primary measure rows, one value per scenario. */
  data: ComboDatum[];
  /** Secondary measure as a separate series, matched to `data` by category. */
  secondary?: ComboSecondaryDatum[];
  /**
   * Alternative to `secondary`: a numeric property name carried on each `data`
   * row to read the secondary value from (e.g. `secondaryKey="marginPct"`).
   */
  secondaryKey?: string;
  /** Axis title for the primary (left) measure — include its unit, e.g. "Revenue (€m)". */
  primaryLabel?: string;
  /** Axis title for the secondary (right) measure — include its unit, e.g. "Margin (%)". */
  secondaryLabel?: string;
  /** Number formatting for the secondary axis + line labels (defaults to `format`). */
  secondaryFormat?: FormatOptions;
  /** Scenario the AC columns are compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Whether a higher primary value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /** Draw the comparison column faded behind AC. Default true. */
  showComparison?: boolean;
  /** Print a Δ-vs-comparison label under each column, impact-colored. Default false. */
  showVariance?: boolean;
  /** Print the secondary value at each marker. Default true. */
  showSecondaryLabels?: boolean;
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
  /** Class name for the chart's root `<svg>`. */
  className?: string;
  /** Inline style merged over the root `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
}

/** Break a point set into runs, splitting wherever a category lacks the value. */
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
 * IBCS combo chart (template C05 family): a primary measure as scenario columns
 * (AC solid in front, the comparison faded behind) plus a secondary measure on
 * an independent right-hand axis, drawn as a line with markers. The two axes
 * are scaled independently and both zero-based, and each is labelled with its
 * unit (ISO 24896 two-axis combos must identify both axes).
 *
 * The forwarded ref lands on the chart's `<svg>` element.
 */
export const ComboChart = forwardRef<SVGSVGElement, ComboChartProps>(function ComboChart(
  {
    data: dataProp,
    secondary: secondaryProp,
    secondaryKey,
    primaryLabel,
    secondaryLabel,
    secondaryFormat,
    comparison = "PY",
    higherIsBetter = true,
    showComparison = true,
    showVariance = false,
    showSecondaryLabels = true,
    width = 640,
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
  // Sanitised so the ids stay valid selectors after an SVG export/serialization.
  const lineClipId = svgSafeId(useId());
  const hatchId = svgSafeId(useId());
  // Comparison column drawn in its own IBCS notation: PY solid, PL hollow white
  // frame, FC hatched — not always solid grey.
  const cmpStyle = tokens.scenario[comparison];
  const data = useDataTween(dataProp);
  const secondary = useDataTween(secondaryProp);
  const grow = useMountGrow(650, 0, data);

  // Resolve the secondary series into an array aligned by index with `data`.
  const secValues = useMemo<Array<number | null>>(() => {
    if (secondary) {
      const map = new Map(secondary.map((s) => [s.category, s.value]));
      return data.map((d) => map.get(d.category) ?? null);
    }
    if (secondaryKey) {
      return data.map((d) => {
        const v = (d as unknown as Record<string, unknown>)[secondaryKey];
        return typeof v === "number" ? v : null;
      });
    }
    return data.map(() => null);
  }, [data, secondary, secondaryKey]);

  const layout = useMemo(
    () => computeCombo(data, secValues, { comparison, higherIsBetter }),
    [data, secValues, comparison, higherIsBetter],
  );
  const { cells, primaryMin, primaryMax, secondaryMin, secondaryMax } = layout;

  const secFmt = secondaryFormat ?? format;

  const padL = 48;
  const padR = 52;
  const padT = title ? 44 : 28;
  const labelH = 22;
  const innerW = width - padL - padR;
  const plotBottom = height - labelH;
  const plotTop = padT;
  // Reserve headroom below the axis titles for column / marker value labels
  // (and, when present, the Δ label that sits above the value), plus room below
  // for negative-column labels — which sit below the column end, and need extra
  // space when a Δ label stacks under the value so they clear the category axis.
  const labelTopH = showVariance ? 24 : 14;
  const labelBotH = showVariance ? 26 : 14;
  const scaleTop = plotTop + labelTopH;
  const scaleBottom = plotBottom - labelBotH;
  const plotH = Math.max(scaleBottom - scaleTop, 1);

  // Two independent zero-based axes.
  const pRange = primaryMax - primaryMin || 1;
  const sRange = secondaryMax - secondaryMin || 1;
  const pY = (v: number) => scaleBottom - ((v - primaryMin) / pRange) * plotH;
  const sY = (v: number) => scaleBottom - ((v - secondaryMin) / sRange) * plotH;
  const pZero = pY(0);
  // Columns grow up from the primary baseline; the line grows in from its zero.
  const pYa = (v: number) => pZero + (pY(v) - pZero) * grow;
  const sZero = sY(0);
  const sYa = (v: number) => sZero + (sY(v) - sZero) * grow;

  // Pixel y of a column's far end, and of the value label that sits just beyond
  // it (above for positive columns, below for negative). Shared by the value
  // label, the Δ label, and the secondary-label de-collision below.
  const colEndY = (ac: number) => (ac >= 0 ? pYa(ac) : pZero + Math.abs(pYa(ac) - pZero));
  const acLabelY = (ac: number) => colEndY(ac) - (ac >= 0 ? 5 : -11);

  const n = cells.length || 1;
  // Band layout (column placement). Default reproduces the historical centred
  // look exactly (back column = 0.62·step, half-band gutter); `bandPadding` lets
  // a caller trim the gutter (`{ outer: 0 }`) so columns fill the plot edge-to-
  // edge. The secondary line/markers ride the SAME centres (`cxOf`) as the
  // columns, so they stay aligned under any padding.
  const scale = bandScale(innerW, n, resolveBandPadding(0.62, bandPadding), padL);
  const band = scale.step;
  const cxOf = (i: number) => scale.center(i);
  const acW = Math.min(band * 0.42, 44);
  const cmpW = Math.min(scale.bandwidth, 64);

  // When columns get narrow OR the plot gets short, the per-column value / Δ /
  // secondary labels collide (with neighbours horizontally, or with each other
  // vertically when value+Δ+marker stack on one column). Drop those labels —
  // keeping columns, line, axes and category ticks — so nothing overlaps.
  const denseLabels = band < 38 || plotH < 60;
  const catLabelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 30))));

  // Fewer ticks when the plot is short, so axis labels never crowd/collide on a
  // small chart (each tick label needs ~18px of vertical room to read cleanly).
  const tickCount = Math.max(2, Math.min(4, Math.floor(plotH / 18)));
  const pTicks = useMemo(
    () => computeTicks(primaryMin, primaryMax, tickCount),
    [primaryMin, primaryMax, tickCount],
  );
  const sTicks = useMemo(
    () => computeTicks(secondaryMin, secondaryMax, tickCount),
    [secondaryMin, secondaryMax, tickCount],
  );

  // Which ticks get a *label*: keep gridlines for all, but suppress a tick's
  // number if it would sit within 13px of one already labelled (e.g. when a
  // degenerate domain rounds adjacent ticks to the same string on a short plot).
  const labelKeep = (ticks: number[], yfn: (v: number) => number) => {
    const keep = new Set<number>();
    let last = -Infinity;
    for (const { t, y } of ticks.map((t) => ({ t, y: yfn(t) })).sort((a, b) => a.y - b.y)) {
      if (y - last >= 13) {
        keep.add(t);
        last = y;
      }
    }
    return keep;
  };
  const pLabelKeep = labelKeep(pTicks, pY);
  const sLabelKeep = labelKeep(sTicks, sY);

  const linePts = cells.map((c, i) =>
    c.secondary != null ? { x: cxOf(i), y: sYa(c.secondary) } : null,
  );
  const toPath = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const lineColor = tokens.color.neutral;

  // Screen-reader data table: the primary scenario columns the chart actually
  // draws, the Δ label when it is shown, and the secondary series (named by its
  // own axis caption, formatted with its own options) — the second axis is the
  // part a single aria-label can never convey.
  const a11yColumns = [
    "AC",
    ...(showComparison ? [comparison] : []),
    ...(showVariance ? [`Δ${comparison}`] : []),
    secondaryLabel ?? "Secondary",
  ];
  const a11yRows: ChartDataRow[] = cells.map((c) => {
    const row: Array<string | number> = [c.AC != null ? formatValue(c.AC, format) : "n/a"];
    if (showComparison) row.push(c.comparison != null ? formatValue(c.comparison, format) : "n/a");
    if (showVariance) row.push(c.variance ? formatSigned(c.variance.abs, format) : "n/a");
    row.push(c.secondary != null ? formatValue(c.secondary, secFmt) : "n/a");
    return { label: c.category, cells: row };
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
          title
            ? `${title}. ${primaryLabel ?? "Primary"} columns versus ${comparison} with a ${secondaryLabel ?? "secondary"} line on a second axis.`
            : `${primaryLabel ?? "Primary"} columns with a ${secondaryLabel ?? "secondary"} line`
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
          <clipPath id={lineClipId}>
            <rect x={padL} y={plotTop - 14} width={innerW} height={plotBottom - plotTop + 28} />
          </clipPath>
          <pattern
            id={hatchId}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke={cmpStyle.stroke} strokeWidth="1" />
          </pattern>
        </defs>

        {title && (
          <text x={padL} y={18} fontSize={13} fontWeight={500} fill={tokens.color.text}>
            {fitLabel(title, width - padL - 4, 13)}
          </text>
        )}

        {/* Axis titles with units — both axes must be labelled (ISO 24896).
          Each gets half the inner width so a long unit caption can't overflow
          the SVG or collide with the opposite axis title. */}
        {primaryLabel && (
          <text
            x={padL}
            y={padT - 10}
            fontSize={10.5}
            fontWeight={500}
            fill={tokens.color.text}
            textAnchor="start"
          >
            {fitLabel(primaryLabel, innerW / 2 - 4, 10.5)}
          </text>
        )}
        {secondaryLabel && (
          <text
            x={width - padR}
            y={padT - 10}
            fontSize={10.5}
            fontWeight={500}
            fill={lineColor}
            textAnchor="end"
          >
            {fitLabel(secondaryLabel, innerW / 2 - 4, 10.5)}
          </text>
        )}

        {/* Primary (left) axis: gridlines + tick labels */}
        {pTicks.map((t) => {
          const y = pY(t);
          return (
            <g key={`pt-${t}`}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke={tokens.color.gridline}
                strokeWidth={1}
              />
              {pLabelKeep.has(t) && (
                <text
                  x={padL - 6}
                  y={y + 3.5}
                  fontSize={9.5}
                  fill={tokens.color.textMuted}
                  textAnchor="end"
                >
                  {formatValue(t, format)}
                </text>
              )}
            </g>
          );
        })}

        {/* Secondary (right) axis tick labels (thinned to avoid vertical collisions) */}
        {sTicks.map((t) =>
          sLabelKeep.has(t) ? (
            <text
              key={`st-${t}`}
              x={width - padR + 6}
              y={sY(t) + 3.5}
              fontSize={9.5}
              fill={lineColor}
              textAnchor="start"
            >
              {formatValue(t, secFmt)}
            </text>
          ) : null,
        )}

        {/* Zero baseline (primary) */}
        <line
          x1={padL}
          y1={pZero}
          x2={width - padR}
          y2={pZero}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />

        {/* Primary columns: comparison faded behind, AC solid in front */}
        {cells.map((c, i) => {
          const cx = cxOf(i);
          return (
            <g key={`col-${c.category}`}>
              {showComparison &&
                c.comparison != null &&
                (() => {
                  const r = {
                    x: cx - cmpW / 2,
                    y: Math.min(pYa(c.comparison), pZero),
                    width: cmpW,
                    height: Math.max(Math.abs(pYa(c.comparison) - pZero), 0.5),
                  };
                  if (cmpStyle.variant === "frame")
                    return (
                      <rect
                        {...r}
                        fill={tokens.color.surface}
                        stroke={cmpStyle.stroke}
                        strokeWidth={1.25}
                      />
                    );
                  if (cmpStyle.variant === "hatch")
                    return (
                      <rect
                        {...r}
                        fill={`url(#${hatchId})`}
                        stroke={cmpStyle.stroke}
                        strokeWidth={1}
                      />
                    );
                  return <rect {...r} fill={cmpStyle.fill} />;
                })()}
              {c.AC != null && (
                <rect
                  x={cx - acW / 2}
                  y={Math.min(pYa(c.AC), pZero)}
                  width={acW}
                  height={Math.max(Math.abs(pYa(c.AC) - pZero), 0.5)}
                  fill={tokens.scenario.AC.fill}
                />
              )}
              {c.AC != null && !denseLabels && (
                <text
                  x={cx}
                  y={acLabelY(c.AC)}
                  fontSize={10}
                  fill={tokens.color.text}
                  textAnchor="middle"
                >
                  {formatValue(c.AC, format)}
                </text>
              )}
              {/* Optional Δ-vs-comparison label, impact-colored, above the column */}
              {showVariance && !denseLabels && c.variance && c.AC != null && (
                <text
                  x={cx}
                  y={colEndY(c.AC) - (c.AC >= 0 ? 18 : -24)}
                  fontSize={9}
                  fontWeight={500}
                  fill={
                    c.variance.abs === 0
                      ? tokens.color.zero
                      : c.variance.favorable
                        ? tokens.color.good
                        : tokens.color.bad
                  }
                  textAnchor="middle"
                >
                  {formatSigned(c.variance.abs, format)}
                </text>
              )}
              {/* Category label (thinned when columns get narrow) */}
              {i % catLabelStep === 0 && (
                <text
                  x={cx}
                  y={height - 6}
                  fontSize={10.5}
                  fill={tokens.color.textMuted}
                  textAnchor="middle"
                >
                  {fitLabel(c.category, band - 2, 10.5)}
                </text>
              )}
            </g>
          );
        })}

        {/* Secondary measure as a line with markers, on the right axis */}
        <g clipPath={`url(#${lineClipId})`}>
          {segments(linePts).map((seg, si) => (
            <path
              key={`line-${si}`}
              d={toPath(seg)}
              fill="none"
              stroke={lineColor}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
        </g>
        {linePts.map((p, i) => {
          // `linePts` is `cells.map(…)`, so the cell at this index always exists.
          const cell = cells[i];
          if (!p || !cell) return null;
          // The value + Δ labels of this column share the marker's x. Place the
          // secondary label above its marker; if that collides, try below; if both
          // collide (column label sits where the marker is), drop it — never
          // overlap. Clamp the below position inside the plot.
          const ac = cell.AC;
          const occupied: number[] = [];
          if (ac != null && !denseLabels) {
            occupied.push(acLabelY(ac));
            if (showVariance && cell.variance) occupied.push(colEndY(ac) - (ac >= 0 ? 18 : -24));
          }
          const clearOf = (yy: number) => occupied.every((o) => Math.abs(yy - o) >= 11);
          const up = p.y - 7;
          const down = Math.min(p.y + 14, plotBottom - 2);
          let labelY: number | null = up;
          if (!clearOf(up)) labelY = clearOf(down) ? down : null;
          return (
            <g key={`mk-${i}`}>
              <circle cx={p.x} cy={p.y} r={3} fill={lineColor} />
              {showSecondaryLabels && !denseLabels && labelY != null && cell.secondary != null && (
                <text x={p.x} y={labelY} fontSize={9} fill={lineColor} textAnchor="middle">
                  {formatValue(cell.secondary, secFmt)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartDataTable
        caption={title ? `${title} — data table` : "Combination chart data table"}
        columns={a11yColumns}
        rows={a11yRows}
      />
    </>
  );
});
