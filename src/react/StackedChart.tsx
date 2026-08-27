import { forwardRef, useMemo, type CSSProperties } from "react";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import { computeStacked, type StackedDatum, type StackedSeries } from "../core/stacked";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import { formatValue, type FormatOptions } from "../core/format";
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

export type { StackedDatum, StackedSeries } from "../core/stacked";

export interface StackedChartProps {
  /** Categories (periods for C01, structure items for C02). */
  data: StackedDatum[];
  /** Series, in stack order. Defines identity, label, and optional color. */
  series: StackedSeries[];
  /**
   * "column" (default) = C01: vertical stacks, time on the x-axis.
   * "bar" = C02: horizontal stacks, structure on the y-axis.
   */
  orientation?: "column" | "bar";
  width?: number;
  height?: number;
  /**
   * Categorical band layout — the gap between stacks and the lead-in/out gutter
   * (vertical for the "bar" orientation). Omit for the centred default; pass
   * `{ outer: 0 }` to trim the side whitespace so the first/last stacks sit
   * flush to the plot edges (fill edge-to-edge).
   */
  bandPadding?: BandPadding;
  /** Number formatting for the total / value labels. */
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Extra class name for the chart `<svg>` (the rendered root). */
  className?: string;
  /** Inline style merged OVER the chart `<svg>`'s own layout style. */
  style?: CSSProperties;
  /** Print the category total above each column / right of each bar. Default true. */
  showTotals?: boolean;
  /** Emphasize one series (by key): it keeps its color, the rest are muted. */
  highlight?: string;
  /**
   * Fired when a category column / bar is clicked — for click-to-filter.
   * Pairs naturally with `useChartSelection`. Omit for a non-interactive chart.
   * `value` is the category total; the whole column / bar is clickable.
   */
  onSelect?: (selection: ChartSelection<StackedDatum>) => void;
  /**
   * Fired as the pointer moves over / leaves a category column / bar (`null` on
   * leave) — for a custom tooltip. Pairs with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<StackedDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on hover or keyboard focus (category
   * total + per-series breakdown). Default true; set false to opt out. Renders
   * on the client only, near a hovered mark (or the focused / tapped one);
   * Escape dismisses it.
   */
  tooltip?: boolean;
}

/* ------------------------------------------------------------------ colors */

/** Parse "#rrggbb" / "#rgb" to an [r,g,b] triple; falls back to mid-grey. */
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [122, 121, 115];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** Linear mix between two hex colors, t in [0,1]. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/**
 * A tasteful grey ramp derived from the theme: from the emphasis tone (`total`,
 * darkest) through `neutral` toward a light step. Keeps adjacent series
 * distinguishable without an external legend or a rainbow palette.
 */
function rampColors(tokens: IbcsTokens, n: number): string[] {
  const light = mix(tokens.color.neutral, tokens.color.surface, 0.62);
  const dark = tokens.color.total;
  const mid = tokens.color.neutral;
  if (n <= 1) return [dark];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    // Two segments: dark → mid (t ≤ 1), then mid → light (t > 1).
    const t = (i / (n - 1)) * 2;
    out.push(t <= 1 ? mix(dark, mid, t) : mix(mid, light, t - 1));
  }
  return out;
}

/**
 * Approximate rendered width of `s` in px at `fontSize`. Wide glyphs (CJK,
 * fullwidth, emoji) count ~1.05·em, normal glyphs ~0.62·em. SSR-safe — no DOM
 * measuring — and iterates by code point so surrogate pairs count once.
 *
 * Deliberately local: the shared `internal/text` heuristic is width-agnostic,
 * and stacked labels sit in tight in-plot gutters where a CJK label measured at
 * 0.6·em would overflow its segment.
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

/**
 * Truncate a label with an ellipsis so its estimated width fits within `maxPx`
 * at `fontSize`. Unicode-aware (see {@link textWidthPx}) so wide-glyph labels
 * don't overflow their gutter or collide with neighbours.
 */
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

/* --------------------------------------------------------------- component */

/**
 * IBCS stacked chart — templates C01 (stacked columns over time) and C02
 * (stacked bars over a structure). Series stack from a zero baseline; the
 * period/category total is printed at the end of each stack; series are
 * labelled in place (integrated labels — no external legend box). A thin
 * inline-SVG renderer over {@link computeStacked}; no charting dependencies.
 *
 * A forwarded `ref` lands on the chart `<svg>` of whichever orientation is
 * rendered — the useful handle for export / serialization — even though the
 * component also renders a screen-reader table beside it.
 */
export const StackedChart = forwardRef<SVGSVGElement, StackedChartProps>(function StackedChart(
  {
    data: dataProp,
    series,
    orientation = "column",
    width = 640,
    height = 360,
    bandPadding,
    format = {},
    tokens: tokenOverride,
    title,
    className,
    style,
    showTotals = true,
    highlight,
    onSelect,
    onHover,
    tooltip = true,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const data = useDataTween(dataProp);
  const grow = useMountGrow(700, 0, data);
  const hover = useChartHover<StackedDatum>();
  const marks = markInteraction(hover, tooltip, onHover);
  const hoverEnabled = marks.enabled;

  const layout = useMemo(() => computeStacked(data, { series }), [data, series]);
  const { columns, domainMin, domainMax } = layout;

  // Resolve a color per series key: explicit color wins, else a ramp step.
  const ramp = useMemo(() => rampColors(tokens, series.length), [tokens, series.length]);
  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    ramp.forEach((c, i) => {
      const s = series[i];
      if (s) m[s.key] = s.color ?? c;
    });
    return m;
  }, [series, ramp]);
  const mutedColor = mix(tokens.color.neutral, tokens.color.surface, 0.72);
  // Effective fill: when a series is highlighted, mute everything else.
  const fillOf = (key: string) => (highlight && key !== highlight ? mutedColor : colorOf[key]);

  const fmt = (v: number) => formatValue(v, format);
  const range = domainMax - domainMin || 1;

  const padT = title ? 34 : 16;
  const isColumn = orientation === "column";

  // Built-in tooltip rows for the hovered category: the total, then each series'
  // signed contribution. (Stacked charts have no comparison/variance panel.)
  const renderTooltip = () => {
    const h = hover.hovered;
    if (!tooltip || !h) return null;
    const col = columns.find((c) => c.category === h.category);
    if (!col) return null;
    const exact = { ...format, compact: false };
    const rows: ChartTooltipRow[] = [
      { label: "Total", value: formatValue(col.total, exact), strong: true },
    ];
    for (const seg of col.segments) {
      const s = series.find((x) => x.key === seg.seriesKey);
      rows.push({ label: s?.label ?? seg.seriesKey, value: formatValue(seg.value, exact) });
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

  // Screen-reader data table: per-category, each series' value plus the total —
  // shared by both orientations, so SR users read values, not the svg.
  const a11yColumns = [...series.map((s) => s.label), "Total"];
  const a11yRows: ChartDataRow[] = columns.map((col) => {
    const byKey = new Map(col.segments.map((seg) => [seg.seriesKey, seg.value]));
    const cells: Array<string | number> = series.map((s) => {
      const val = byKey.get(s.key);
      return val != null ? fmt(val) : "n/a";
    });
    cells.push(fmt(col.total));
    return { label: col.category, cells };
  });
  const a11yTable = (
    <ChartDataTable
      caption={
        title
          ? `${title} — data table`
          : `Stacked ${orientation === "column" ? "columns" : "bars"} — data table`
      }
      columns={a11yColumns}
      rows={a11yRows}
    />
  );

  /* ------------------------------------------------------------- vertical */
  if (isColumn) {
    const padL = 14;
    // Right gutter holds the integrated series labels (drawn at the last column).
    const labelGutter = 96;
    const padR = 14 + labelGutter;
    const padB = 26; // category axis labels
    const totalPad = showTotals ? 16 : 4; // headroom for the total above the column

    const plotTop = padT + totalPad;
    const plotBottom = height - padB;
    const plotH = Math.max(20, plotBottom - plotTop);
    const plotLeft = padL;
    const plotRight = width - padR;
    const plotW = Math.max(20, plotRight - plotLeft);

    const yOf = (v: number) => plotTop + (domainMax - v) * (plotH / range);
    const zeroY = yOf(0);

    const n = columns.length || 1;
    // Band layout (stack placement). Default reproduces the historical centred
    // look exactly (stack width = 0.62·step, half-band gutter); `bandPadding`
    // lets a caller trim the gutter (`{ outer: 0 }`) so stacks fill edge-to-edge.
    const scale = bandScale(plotW, n, resolveBandPadding(0.62, bandPadding), plotLeft);
    const band = scale.step;
    const cxOf = (i: number) => scale.center(i);
    const colW = Math.min(scale.bandwidth, 52);

    // Density gating: when columns get too narrow, printing a total over every
    // one (and a label under every one) just collides. Drop the totals and thin
    // the category labels so what remains is legible and never overlaps.
    const showColTotals = showTotals && band >= 30;
    const colLabelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 30))));

    // Series-label anchor: the segments of the last column, mid-height each.
    const last = columns[columns.length - 1];

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
              : (title ?? `Stacked columns of ${series.length} series across ${n} periods`)
          }
          style={{
            display: "block",
            maxWidth: "100%",
            marginInline: "auto",
            fontFamily: tokens.font.family,
            ...style,
          }}
        >
          {onSelect && <style>{SELECTABLE_MARK_CSS}</style>}
          {title && (
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitText(title, width - padL - 4, 13)}
            </text>
          )}

          {/* Zero baseline */}
          <line
            x1={plotLeft}
            y1={zeroY}
            x2={plotRight}
            y2={zeroY}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {columns.map((col, ci) => {
            // `columns` is `data.map(…)`, so the datum at this index always exists.
            const datum = data[ci];
            if (!datum) return null;
            const cx = cxOf(ci);
            const x = cx - colW / 2;
            const info = { category: col.category, value: col.total, datum };
            // The stack's own extent in FINAL (un-animated) geometry: from the
            // top of the upward segments down to the bottom of the downward
            // ones — not the whole plot band the hit rect covers.
            const stackTop = yOf(col.positiveTotal);
            const stackBottom = yOf(col.negativeTotal);
            const markRects: MarkRect[] = [
              { x, y: stackTop, width: colW, height: Math.abs(stackBottom - stackTop) },
            ];
            return (
              <g
                key={col.category}
                {...selectableMarkProps(
                  onSelect ? () => onSelect(info) : undefined,
                  `Select ${col.category}, total ${fmt(col.total)}`,
                )}
                {...marks.forMark(info, markRects)}
                style={onSelect ? { cursor: "pointer" } : undefined}
              >
                {/* Transparent full-band hit target so the whole column is click/hover-able */}
                {(onSelect || hoverEnabled) && (
                  <rect
                    x={cxOf(ci) - band / 2}
                    y={plotTop}
                    width={band}
                    height={plotBottom - plotTop}
                    fill="transparent"
                  />
                )}
                {col.segments.map((seg) => {
                  const y0 = yOf(seg.end * grow);
                  const y1 = yOf(seg.start * grow);
                  const h = Math.abs(y1 - y0);
                  return (
                    <rect
                      key={seg.seriesKey}
                      x={x}
                      y={Math.min(y0, y1)}
                      width={colW}
                      height={h}
                      fill={fillOf(seg.seriesKey)}
                    />
                  );
                })}

                {/* Period TOTAL above the column (C01) */}
                {showColTotals && (
                  <text
                    x={cx}
                    y={yOf(col.positiveTotal * grow) - 5}
                    fontSize={11}
                    fontWeight={600}
                    textAnchor="middle"
                    fill={tokens.color.text}
                  >
                    {fmt(col.total)}
                  </text>
                )}

                {/* Category axis label (thinned + truncated to its band so neighbours don't collide) */}
                {ci % colLabelStep === 0 && (
                  <text
                    x={cx}
                    y={plotBottom + 16}
                    fontSize={11}
                    textAnchor="middle"
                    fill={tokens.color.textMuted}
                  >
                    {fitText(col.category, band - 2, 11)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Integrated series labels at the last column's segments.
            Resolve vertical collisions and clamp within the plot band. */}
          {(() => {
            if (!last) return null;
            const slot = 12;
            const wanted = last.segments
              .map((seg) => ({
                seg,
                desiredY: (yOf(seg.start * grow) + yOf(seg.end * grow)) / 2,
                s: series.find((x) => x.key === seg.seriesKey),
              }))
              .sort((a, b) => a.desiredY - b.desiredY);
            // Greedily place top-to-bottom keeping a minimum gap; drop labels that
            // no longer fit instead of stacking them on the same line (no overlap).
            const placed: Array<{
              seg: (typeof wanted)[number]["seg"];
              y: number;
              s: (typeof wanted)[number]["s"];
            }> = [];
            let prevY = plotTop + 4 - slot;
            for (const l of wanted) {
              const y = Math.max(l.desiredY, prevY + slot);
              if (y > plotBottom - 2) break;
              placed.push({ seg: l.seg, y, s: l.s });
              prevY = y;
            }
            return placed.map(({ seg, y, s }) => (
              <text
                key={seg.seriesKey}
                x={plotRight + 8}
                y={y + 3.5}
                fontSize={11}
                fill={
                  highlight && seg.seriesKey !== highlight
                    ? tokens.color.textMuted
                    : colorOf[seg.seriesKey]
                }
                fontWeight={highlight === seg.seriesKey ? 700 : 500}
              >
                {fitText(s?.label ?? seg.seriesKey, labelGutter - 2, 11)}
              </text>
            ));
          })()}
        </svg>
        {a11yTable}
        {renderTooltip()}
      </>
    );
  }

  /* ----------------------------------------------------------- horizontal */
  const padL = 14;
  const labelWidth = 110; // left gutter for category labels
  const padR = 64; // right gutter for the total
  const padB = 14;
  const labelRow = 18; // top strip for integrated series labels

  const plotTop = padT + labelRow;
  const plotBottom = height - padB;
  const plotLeft = padL + labelWidth;
  const plotRight = width - padR;
  const plotW = Math.max(20, plotRight - plotLeft);

  const xOf = (v: number) => plotLeft + (v - domainMin) * (plotW / range);
  const zeroX = xOf(0);

  const n = columns.length || 1;
  const plotH = Math.max(20, plotBottom - plotTop);
  // Vertical band layout (stack placement). Default reproduces the historical
  // centred look exactly (bar height = 0.6·step, half-band gutter); `bandPadding`
  // lets a caller trim the gutter (`{ outer: 0 }`) so bars fill top-to-bottom.
  const scale = bandScale(plotH, n, resolveBandPadding(0.6, bandPadding), plotTop);
  const band = scale.step;
  const cyOf = (i: number) => scale.center(i);
  const barH = Math.min(scale.bandwidth, 30);

  // Thin category labels / drop totals when rows get too short to avoid overlap.
  const rowLabelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotH / 14))));
  const showBarTotals = showTotals && band >= 14;

  const first = columns[0];

  return (
    <>
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        // See the column branch: role/label only when the marks are not the
        // interactive, individually-labelled elements.
        role={onSelect ? undefined : "img"}
        aria-label={
          onSelect
            ? undefined
            : (title ?? `Stacked bars of ${series.length} series across ${n} categories`)
        }
        style={{
          display: "block",
          maxWidth: "100%",
          marginInline: "auto",
          fontFamily: tokens.font.family,
          ...style,
        }}
      >
        {onSelect && <style>{SELECTABLE_MARK_CSS}</style>}
        {title && (
          <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
            {fitText(title, width - padL - 4, 13)}
          </text>
        )}

        {/* Zero baseline */}
        <line
          x1={zeroX}
          y1={plotTop}
          x2={zeroX}
          y2={plotBottom}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />

        {columns.map((col, ci) => {
          // `columns` is `data.map(…)`, so the datum at this index always exists.
          const datum = data[ci];
          if (!datum) return null;
          const cy = cyOf(ci);
          const info = { category: col.category, value: col.total, datum };
          // The stack's own extent in FINAL (un-animated) geometry: from the
          // left end of the downward segments to the right end of the upward
          // ones — not the whole row the hit rect covers.
          const stackLeft = xOf(col.negativeTotal);
          const stackRight = xOf(col.positiveTotal);
          const markRects: MarkRect[] = [
            {
              x: stackLeft,
              y: cy - barH / 2,
              width: Math.abs(stackRight - stackLeft),
              height: barH,
            },
          ];
          return (
            <g
              key={col.category}
              {...selectableMarkProps(
                onSelect ? () => onSelect(info) : undefined,
                `Select ${col.category}, total ${fmt(col.total)}`,
              )}
              {...marks.forMark(info, markRects)}
              style={onSelect ? { cursor: "pointer" } : undefined}
            >
              {/* Transparent full-row hit target so the whole bar is click/hover-able */}
              {(onSelect || hoverEnabled) && (
                <rect
                  x={padL}
                  y={cyOf(ci) - band / 2}
                  width={width - padL - padR}
                  height={band}
                  fill="transparent"
                />
              )}
              {/* Category label, right-aligned in the left gutter (thinned + truncated to fit) */}
              {ci % rowLabelStep === 0 && (
                <text
                  x={plotLeft - 8}
                  y={cy + 4}
                  fontSize={11.5}
                  textAnchor="end"
                  fill={tokens.color.text}
                >
                  {fitText(col.category, labelWidth - 4, 11.5)}
                </text>
              )}

              {col.segments.map((seg) => {
                const x0 = xOf(seg.start * grow);
                const x1 = xOf(seg.end * grow);
                return (
                  <rect
                    key={seg.seriesKey}
                    x={Math.min(x0, x1)}
                    y={cy - barH / 2}
                    width={Math.abs(x1 - x0)}
                    height={barH}
                    fill={fillOf(seg.seriesKey)}
                  />
                );
              })}

              {/* Total to the right of the bar (clamped so it stays inside the SVG) */}
              {showBarTotals &&
                (() => {
                  const label = fmt(col.total);
                  const estW = textWidthPx(label, 11) + 2;
                  const tx = Math.max(
                    2,
                    Math.min(xOf(col.positiveTotal * grow) + 6, width - 2 - estW),
                  );
                  return (
                    <text x={tx} y={cy + 4} fontSize={11} fontWeight={600} fill={tokens.color.text}>
                      {label}
                    </text>
                  );
                })()}
            </g>
          );
        })}

        {/* Integrated series labels above the first bar's segments. Truncate each
          to its segment (never wider than the plot), clamp it inside the plot,
          then place left-to-right dropping any that would overlap a kept one. */}
        {first &&
          (() => {
            const avail = Math.max(0, plotRight - plotLeft);
            const built = first.segments
              .map((seg) => {
                const mx = (xOf(seg.start * grow) + xOf(seg.end * grow)) / 2;
                const s = series.find((x) => x.key === seg.seriesKey);
                const segPx = Math.abs(xOf(seg.end * grow) - xOf(seg.start * grow));
                const label = fitText(
                  s?.label ?? seg.seriesKey,
                  Math.min(Math.max(segPx, band), avail),
                  10.5,
                );
                const half = textWidthPx(label, 10.5) / 2;
                const cx = Math.min(Math.max(mx, plotLeft + half), plotRight - half);
                return { seg, label, cx, half };
              })
              .filter((b) => b.label)
              .sort((a, b) => a.cx - b.cx);
            let lastRight = -Infinity;
            const kept = built.filter((b) => {
              if (b.cx - b.half < lastRight + 4) return false;
              lastRight = b.cx + b.half;
              return true;
            });
            return kept.map(({ seg, label, cx }) => (
              <text
                key={seg.seriesKey}
                x={cx}
                y={plotTop - 6}
                fontSize={10.5}
                textAnchor="middle"
                fill={
                  highlight && seg.seriesKey !== highlight
                    ? tokens.color.textMuted
                    : colorOf[seg.seriesKey]
                }
                fontWeight={highlight === seg.seriesKey ? 700 : 500}
              >
                {label}
              </text>
            ));
          })()}
      </svg>
      {a11yTable}
      {renderTooltip()}
    </>
  );
});
