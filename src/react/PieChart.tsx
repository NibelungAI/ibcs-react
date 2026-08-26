import { forwardRef, useMemo, type CSSProperties } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeVariance } from "../core/variance";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { computePieSlices, arcPath, pointOnCircle, type PieSlice } from "../core/pie";
import { useMountGrow, useChartHover } from "./hooks";
import type { ChartSelection, ChartHover } from "./hooks";
import { markInteraction } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import {
  ChartDataTable,
  SELECTABLE_MARK_CSS,
  selectableMarkProps,
  type ChartDataRow,
} from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel } from "./internal/text";

/** Parse a `#rgb` / `#rrggbb` string to bytes, or null if not a plain hex. */
function parseHex(h: string): { r: number; g: number; b: number } | null {
  if (!h || h[0] !== "#") return null;
  let s = h.slice(1);
  if (s.length === 3) s = s.replace(/./g, (c) => c + c);
  if (s.length !== 6) return null;
  const n = Number.parseInt(s, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const toHex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

/**
 * Linearly mix two hex colours (`t` 0→a, 1→b). Used to derive the muted IBCS
 * grey RAMP for slice fills from the theme tokens — never a rainbow palette.
 * Falls back to `a` (then `b`) if either colour isn't plain hex. SSR-safe/pure.
 */
function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return ca ? a : b;
  const k = Math.max(0, Math.min(1, t));
  return `#${toHex(ca.r + (cb.r - ca.r) * k)}${toHex(ca.g + (cb.g - ca.g) * k)}${toHex(ca.b + (cb.b - ca.b) * k)}`;
}

/** A slice of a full multi-slice pie. */
export interface PieDatum {
  label: string;
  value: number;
  /** Optional explicit fill; otherwise a muted grey from the theme ramp. */
  color?: string;
}

/**
 * Convenience input for the IBCS "pie multiples" pattern: one part-to-whole
 * share, optionally with the period-over-period change (`delta`).
 */
export interface PieShare {
  /** The highlighted part. */
  value: number;
  /** The whole it is a part of. */
  total: number;
  /** Change vs the prior period — drives the favorability-coloured growth slice. */
  delta?: number;
  /** Higher is better (false for cost shares). Default true. */
  higherIsBetter?: boolean;
}

export interface PieChartProps {
  /** Full multi-slice pie. Mutually exclusive with `share` (`share` wins). */
  data?: PieDatum[];
  /** Single part-to-whole share (the "pie multiples" convenience mode). */
  share?: PieShare;
  /** Draw a donut (inner radius ≈ 0.6·R) instead of a full pie. Default false. */
  donut?: boolean;
  /** Square edge length in px. Default 160 (tiles cleanly at 110–170). */
  size?: number;
  /** Override the square box width. Default `size`. */
  width?: number;
  /** Override the square box height. Default `size`. */
  height?: number;
  /** Index of the one slice to emphasise (drawn darker, `tokens.color.total`). */
  emphasisIndex?: number;
  /** Draw outside value labels with short leader lines (clamped in-box). Default false. */
  showValueLabels?: boolean;
  /**
   * Add a thin favorability-coloured growth slice + signed variance label
   * representing a change. In `share` mode `share.delta` does the same; this
   * prop also works in `data` mode (anchored to the emphasised slice).
   */
  growth?: { delta: number; higherIsBetter?: boolean };
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Extra class name for the chart `<svg>` (the rendered root). */
  className?: string;
  /** Inline style merged OVER the chart `<svg>`'s own layout style. */
  style?: CSSProperties;
  /**
   * Show the built-in floating tooltip on slice hover or keyboard focus.
   * Default true; set false to opt out. Renders on the client only, near a
   * hovered mark (or the focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
  /** Fired on slice click (drill-down / filter). Omit for non-interactive. */
  onSelect?: (selection: ChartSelection<PieDatum>) => void;
  /** Fired as the pointer enters / moves / leaves (`null`) a slice. */
  onHover?: (hover: ChartHover<PieDatum> | null) => void;
}

interface RenderSlice {
  key: string;
  slice: PieSlice;
  color: string;
  datum: PieDatum;
  emphasis: boolean;
}

/**
 * Part-to-whole pie / donut, designed to tile as IBCS "pie multiples" at small
 * sizes (110–170 px): a tiny pie showing a share, an optional green/red growth
 * sliver, and the absolute size number — Andrej Lapajne's reference exhibit.
 *
 * ⚠️ AGENT CONTEXT — PIE CHARTS ARE DISCOURAGED IN IBCS / ISO 24896. Angle and
 * area are hard to compare precisely, so part-to-whole is almost always better
 * shown as a stacked/structure column or a bar. The library's `checkIbcs`
 * linter still FLAGS pie usage. This component exists only for (a) the
 * occasional legitimate single part-to-whole case and (b) faithfully
 * reproducing IBCS "pie multiples" exhibits. Prefer linear charts
 * (`VarianceColumnChart`, `StackedChart`, `StructureChart`) wherever you can.
 *
 * Two input modes:
 *  1. `data` — a full multi-slice pie. Fills default to a muted grey ramp
 *     derived from the theme (NOT a rainbow); `emphasisIndex` darkens one slice.
 *  2. `share` — one emphasis slice of the whole, plus (with `delta`/`growth`) a
 *     thin growth slice coloured by favorability and a signed variance label.
 *
 * Pure SVG, zero dependencies, SSR-safe. Negative inputs are clamped to 0 (a
 * slice has no negative area) and noted. A subtle outer ring keeps empty / 0
 * slices legible at small sizes.
 *
 * A forwarded `ref` lands on the chart `<svg>` — the useful handle for export /
 * serialization.
 */
export const PieChart = forwardRef<SVGSVGElement, PieChartProps>(function PieChart(
  {
    data,
    share,
    donut = false,
    size = 160,
    width,
    height,
    emphasisIndex,
    showValueLabels = false,
    growth,
    format = {},
    tokens: tokenOverride,
    title,
    className,
    style,
    tooltip = true,
    onSelect,
    onHover,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const hover = useChartHover<PieDatum>();
  const marks = markInteraction(hover, tooltip, onHover);
  const grow = useMountGrow(650, 0, share ?? data);

  const W = width ?? size;
  const H = height ?? size;
  const padT = title ? 18 : 0;

  // Build the normalized render model (slices + colours) for whichever mode.
  const model = useMemo(() => {
    const lightGrey = tokens.scenario.PY.fill;
    const rampLight = parseHex(lightGrey) ? lightGrey : "#d8d7d2";
    const rampDark = tokens.color.neutral;

    if (share) {
      const part = Math.max(share.value, 0);
      const rest = Math.max(share.total - part, 0);
      const { slices } = computePieSlices([part, rest]);
      // Two values in ⇒ two slices out.
      const partSlice = slices[0];
      const restSlice = slices[1];
      const out: RenderSlice[] = [];
      if (partSlice) {
        out.push({
          key: "share",
          slice: partSlice,
          color: tokens.color.total,
          datum: { label: "Share", value: share.value },
          emphasis: true,
        });
      }
      if (restSlice && restSlice.fraction > 0) {
        out.push({
          key: "rest",
          slice: restSlice,
          color: rampLight,
          datum: { label: "Rest", value: rest },
          emphasis: false,
        });
      }
      const fraction = share.total > 0 ? clampTo(share.value / share.total, 0, 1) : 0;
      return {
        slices: out,
        total: share.total,
        hadNegative: share.value < 0,
        emphasisSlice: out[0]?.slice,
        shareFraction: fraction,
      };
    }

    const rows = data ?? [];
    const layout = computePieSlices(rows.map((d) => d.value));
    const n = rows.length;
    // One slice per row, in row order.
    const out: RenderSlice[] = [];
    layout.slices.forEach((s, i) => {
      const row = rows[i];
      if (!row) return;
      const isEmph = i === emphasisIndex;
      const color =
        row.color ??
        (isEmph ? tokens.color.total : mixHex(rampLight, rampDark, n > 1 ? i / (n - 1) : 0));
      out.push({ key: `${row.label}-${i}`, slice: s, color, datum: row, emphasis: isEmph });
    });
    const emph =
      (emphasisIndex != null && emphasisIndex >= 0 ? out[emphasisIndex]?.slice : undefined) ??
      out[0]?.slice;
    return {
      slices: out,
      total: layout.total,
      hadNegative: layout.hadNegative,
      emphasisSlice: emph,
      shareFraction: 0,
    };
  }, [data, share, emphasisIndex, tokens]);

  // Geometry: reserve room for outside labels so nothing spills the box.
  const needOutside = showValueLabels || (share != null && !donut);
  const labelRoom = needOutside ? 16 : 4;
  const availH = H - padT;
  const r = Math.max(8, Math.min(W, availH) / 2 - 4 - labelRoom);
  const cx = W / 2;
  const cy = padT + availH / 2;
  const innerR = donut ? r * 0.6 : 0;

  // Animated end angle for a radial-wipe grow-in.
  const drawEnd = (s: PieSlice) => s.startAngle + (s.endAngle - s.startAngle) * grow;

  // Growth slice (share.delta or the growth prop), anchored to the emphasis
  // slice. Memoized on the primitive inputs so the geometry memo below doesn't
  // recompute on every render (the object literal would be a fresh identity).
  const eff = useMemo(
    () =>
      growth ??
      (share?.delta != null
        ? { delta: share.delta, higherIsBetter: share.higherIsBetter }
        : undefined),
    [growth, share],
  );
  const growthGeom = useMemo(() => {
    if (!eff || !model.emphasisSlice || model.total <= 0) return null;
    const v = computeVariance(eff.delta, 0, eff.higherIsBetter ?? true);
    if (!v) return null;
    const deltaFrac = clampTo(Math.abs(eff.delta) / model.total, 0, 1);
    if (deltaFrac <= 0) return null;
    const span = deltaFrac * Math.PI * 2;
    const end = model.emphasisSlice.endAngle;
    const up = eff.delta >= 0;
    const a0 = up ? Math.max(model.emphasisSlice.startAngle, end - span) : end;
    const a1 = up ? end : end + span;
    const color =
      eff.delta === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
    return { a0, a1, color, label: formatSigned(eff.delta, format) };
  }, [eff, model.emphasisSlice, model.total, tokens, format]);

  // Built-in tooltip for the hovered slice. The value renders at FULL precision
  // (compact: false): any printed label is compact, so the tooltip adds the
  // exact figure instead of echoing it.
  const renderTooltip = () => {
    const h = hover.hovered;
    if (!tooltip || !h) return null;
    const d = h.datum;
    const frac = model.total > 0 ? d.value / model.total : 0;
    const exact = { ...format, compact: false };
    const rows: ChartTooltipRow[] = [
      { label: "Value", value: formatValue(d.value, exact), strong: true },
      { label: "Share", value: formatPercent(frac).replace("+", "") },
    ];
    return (
      <ChartTooltip
        ref={hover.tooltipRef}
        x={h.x}
        y={h.y}
        title={d.label}
        rows={rows}
        tokens={tokens}
      />
    );
  };

  // Share-mode center / outside text.
  const shareFrac = model.shareFraction;
  const pctText = `${(shareFrac * 100).toFixed(shareFrac > 0 && shareFrac < 0.1 ? 1 : 0)}%`;

  // Screen-reader data table: every slice's value and the share of the whole its
  // ANGLE encodes (the part a screen reader can never see), plus the growth
  // delta on the slice it is anchored to, and the whole itself as a total row.
  const a11yColumns = ["Value", "Share", ...(growthGeom ? ["Δ"] : [])];
  const a11yRows: ChartDataRow[] = model.slices.map((rs) => ({
    label: rs.datum.label,
    cells: [
      formatValue(rs.datum.value, format),
      formatPercent(rs.slice.fraction).replace("+", ""),
      ...(growthGeom ? [rs.slice === model.emphasisSlice ? growthGeom.label : "n/a"] : []),
    ],
  }));
  a11yRows.push({
    label: "Total",
    cells: [
      formatValue(model.total, format),
      formatPercent(model.total > 0 ? 1 : null).replace("+", ""),
      ...(growthGeom ? ["n/a"] : []),
    ],
  });

  return (
    <>
      <svg
        ref={ref}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className={className}
        // Interactive slices carry their own semantics (`selectableMarkProps`),
        // so the svg stays an unlabelled container; a static pie is a single
        // labelled image. Never both.
        role={onSelect ? undefined : "img"}
        aria-label={
          onSelect
            ? undefined
            : title
              ? `${title}. Part-to-whole pie chart.`
              : "Part-to-whole pie chart"
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
          <text
            x={W / 2}
            y={13}
            fontSize={12}
            fontWeight={500}
            fill={tokens.color.text}
            textAnchor="middle"
          >
            {fitLabel(title, W - 8, 12)}
          </text>
        )}

        {/* Slices */}
        {model.slices.map((rs) => {
          const d = arcPath({
            cx,
            cy,
            r,
            startAngle: rs.slice.startAngle,
            endAngle: drawEnd(rs.slice),
            innerR,
          });
          if (!d) return null;
          const info = { category: rs.datum.label, value: rs.datum.value, datum: rs.datum };
          return (
            <path
              key={rs.key}
              d={d}
              fill={rs.color}
              stroke={tokens.color.surface}
              strokeWidth={model.slices.length > 1 ? 1 : 0}
              {...selectableMarkProps<SVGPathElement>(
                onSelect ? () => onSelect(info) : undefined,
                `Select ${rs.datum.label}, ${formatValue(rs.datum.value, format)}`,
              )}
              {...marks.forMark(info)}
              style={onSelect ? { cursor: "pointer" } : undefined}
            />
          );
        })}

        {/* Growth sliver (thin outer band), favorability-coloured */}
        {growthGeom &&
          (() => {
            const a1 = growthGeom.a0 + (growthGeom.a1 - growthGeom.a0) * grow;
            const d = arcPath({
              cx,
              cy,
              r,
              startAngle: growthGeom.a0,
              endAngle: a1,
              innerR: r * 0.78,
            });
            return d ? (
              <path
                d={d}
                fill={growthGeom.color}
                stroke={tokens.color.surface}
                strokeWidth={0.75}
              />
            ) : null;
          })()}

        {/* Subtle outer ring so empty / 0 slices still read */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={tokens.color.axis} strokeWidth={1} />
        {donut && (
          <circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="none"
            stroke={tokens.color.axis}
            strokeWidth={1}
          />
        )}

        {/* Share mode: percent + absolute value */}
        {share && donut && (
          <>
            <text
              x={cx}
              y={cy}
              fontSize={Math.min(innerR * 0.7, 22)}
              fontWeight={700}
              fill={tokens.color.total}
              textAnchor="middle"
              dominantBaseline="central"
              opacity={grow}
            >
              {pctText}
            </text>
            <text
              x={cx}
              y={cy + Math.min(innerR * 0.7, 22) * 0.8}
              fontSize={10}
              fill={tokens.color.textMuted}
              textAnchor="middle"
              opacity={grow}
            >
              {fitLabel(formatValue(share.value, format), innerR * 1.9, 10)}
            </text>
          </>
        )}
        {share &&
          !donut &&
          model.emphasisSlice &&
          (() => {
            const a = model.emphasisSlice.midAngle;
            const p = pointOnCircle(cx, cy, r + 3, a);
            const onRight = p.x >= cx;
            const valTxt = formatValue(share.value, format);
            const tx = clampTo(
              p.x + (onRight ? 3 : -3),
              4 + estTextW(valTxt, 11),
              W - 4 - estTextW(valTxt, 11),
            );
            const ty = clampTo(p.y, padT + 12, H - 6);
            return (
              <g opacity={grow}>
                <text
                  x={tx}
                  y={ty - 5}
                  fontSize={12}
                  fontWeight={700}
                  fill={tokens.color.total}
                  textAnchor={onRight ? "start" : "end"}
                >
                  {pctText}
                </text>
                <text
                  x={tx}
                  y={ty + 8}
                  fontSize={10}
                  fill={tokens.color.textMuted}
                  textAnchor={onRight ? "start" : "end"}
                >
                  {valTxt}
                </text>
              </g>
            );
          })()}

        {/* Growth variance label — set out beyond the ring (not on it) and
            anchored away from the pie so it never overlaps the sliver. */}
        {growthGeom &&
          (() => {
            const a = (growthGeom.a0 + growthGeom.a1) / 2;
            const onRight = Math.sin(a) >= 0;
            const p = pointOnCircle(cx, cy, r + 13, a);
            const w = estTextW(growthGeom.label, 10.5);
            const anchor: "start" | "end" = onRight ? "start" : "end";
            const tx = clampTo(
              p.x + (onRight ? 2 : -2),
              4 + (onRight ? 0 : w),
              W - 4 - (onRight ? w : 0),
            );
            const ty = clampTo(p.y + 3.5, padT + 10, H - 4);
            return (
              <text
                x={tx}
                y={ty}
                fontSize={10.5}
                fontWeight={600}
                fill={growthGeom.color}
                textAnchor={anchor}
                opacity={grow}
              >
                {growthGeom.label}
              </text>
            );
          })()}

        {/* Data mode: outside value labels with short leader lines */}
        {showValueLabels &&
          !share &&
          model.slices.map((rs) => {
            if (rs.slice.fraction < 0.02) return null;
            const a = rs.slice.midAngle;
            const inner = pointOnCircle(cx, cy, r, a);
            const outer = pointOnCircle(cx, cy, r + 6, a);
            const onRight = outer.x >= cx;
            const valTxt = formatValue(rs.datum.value, format);
            const budget = onRight ? W - 4 - outer.x : outer.x - 4;
            const lblTxt = fitLabel(rs.datum.label, Math.max(budget, 0), 9);
            const tx = clampTo(
              outer.x + (onRight ? 2 : -2),
              4 + estTextW(valTxt, 10),
              W - 4 - estTextW(valTxt, 10),
            );
            const ty = clampTo(outer.y, padT + 12, H - 6);
            return (
              <g key={`lbl-${rs.key}`} opacity={grow}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={tokens.color.axis}
                  strokeWidth={1}
                />
                <text
                  x={tx}
                  y={ty - 3}
                  fontSize={10}
                  fontWeight={600}
                  fill={tokens.color.text}
                  textAnchor={onRight ? "start" : "end"}
                >
                  {valTxt}
                </text>
                {lblTxt && (
                  <text
                    x={tx}
                    y={ty + 8}
                    fontSize={9}
                    fill={tokens.color.textMuted}
                    textAnchor={onRight ? "start" : "end"}
                  >
                    {lblTxt}
                  </text>
                )}
              </g>
            );
          })}

        {/* Negatives clamped-to-zero note */}
        {model.hadNegative && (
          <text x={W / 2} y={H - 2} fontSize={9} fill={tokens.color.textMuted} textAnchor="middle">
            {fitLabel("negative values omitted", W - 6, 9)}
          </text>
        )}
      </svg>
      <ChartDataTable
        caption={title ? `${title} — data table` : "Part-to-whole data table"}
        columns={a11yColumns}
        rows={a11yRows}
      />
      {renderTooltip()}
    </>
  );
});
