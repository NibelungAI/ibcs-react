import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeStructure, type StructureDatum } from "../core/structure";
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
import { fitLabel, svgSafeId } from "./internal/text";

export type { StructureDatum } from "../core/structure";

export interface StructureChartProps {
  /** The components of the whole. */
  data: StructureDatum[];
  /** Reference scenario each component is compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Order rows by magnitude. Default "desc". */
  sort?: "desc" | "asc" | "none";
  /** Chart-level higher-is-better default (per-datum value wins). Default true. */
  higherIsBetter?: boolean;
  /** Draw the comparison scenario as a faded bar behind the current one. Default true. */
  showComparison?: boolean;
  /** Show each component's % of the total. Default true. */
  showShare?: boolean;
  /**
   * The Δ column vs the comparison, colored by favorability: "abs" shows Δ
   * values, "pct" shows Δ%, "none" drops the column entirely. Default "abs".
   */
  variance?: "abs" | "pct" | "none";
  width?: number;
  height?: number;
  /**
   * Vertical band layout - the gap between component rows and the lead-in/out
   * gutter (this chart's categories run top-to-bottom). Omit for the centred
   * default; pass `{ outer: 0 }` to trim the whitespace above the first row and
   * below the last so the rows sit flush to the plot edges (fill edge-to-edge).
   */
  bandPadding?: BandPadding;
  /** Width of the left label gutter, in px. Default 132. */
  labelWidth?: number;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Extra class name for the chart `<svg>` (the rendered root). */
  className?: string;
  /** Inline style merged OVER the chart `<svg>`'s own layout style. */
  style?: CSSProperties;
  /**
   * Fired when a component row is clicked - for click-to-filter / drill-down.
   * Pairs naturally with `useChartSelection`. Omit for a non-interactive chart.
   * The clickable area spans the whole row.
   */
  onSelect?: (selection: ChartSelection<StructureDatum>) => void;
  /**
   * Fired as the pointer moves over / leaves a component row (`null` on leave) -
   * for a custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<StructureDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on row hover or keyboard focus (value, Δ
   * vs the comparison, share). Default true; set false to opt out. Renders on
   * the client only, near a hovered mark (or the focused / tapped one); Escape
   * dismisses it.
   */
  tooltip?: boolean;
}

/**
 * IBCS structure / composition chart: a ranked horizontal breakdown of a whole
 * into its parts. Each component is a bar (current series solid, comparison
 * faded behind - the IBCS overlap), labelled with its value, its share of the
 * total, and its Δ vs the comparison colored by favorability. A total row sits
 * beneath. Largest contributor first by default.
 *
 * A forwarded `ref` lands on the chart `<svg>` - the useful handle for export /
 * serialization - even though the component also renders a screen-reader table
 * beside it.
 */
export const StructureChart = forwardRef<SVGSVGElement, StructureChartProps>(
  function StructureChart(
    {
      data: dataProp,
      comparison = "PY",
      sort = "desc",
      higherIsBetter = true,
      showComparison = true,
      showShare = true,
      variance = "abs",
      width = 600,
      height = 320,
      bandPadding,
      labelWidth = 132,
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
    // `variance` doubles as the Δ column's on/off switch - resolve it once so
    // the gutter maths and the markup below stay exactly as they were.
    const showVariance = variance !== "none";
    const tokens = useIbcsTokens(tokenOverride);
    const data = useDataTween(dataProp);
    const grow = useMountGrow(700, 0, data);
    const hover = useChartHover<StructureDatum>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;
    const hatchId = svgSafeId(useId());
    // The comparison scenario is drawn in its own IBCS notation, not always solid
    // grey: PY solid, PL a hollow white frame, FC hatched (same as the column
    // chart) - so flipping AC-vs-PY/PL/FC restyles the reference bar correctly.
    const cmpStyle = tokens.scenario[comparison];

    const layout = useMemo(
      () => computeStructure(data, { comparison, sort, higherIsBetter }),
      [data, comparison, sort, higherIsBetter],
    );
    const { segments, total, baseTotal, maxAbs } = layout;

    const padL = 12;
    const padR = 12;
    const padT = title ? 30 : 14;
    const padB = 8;

    // Right gutter holds the value, the Δ chip, and the share %. Tighten it on
    // narrow charts so the bars never get squeezed out.
    const compact = width < 420;
    const shareW = showShare ? (compact ? 32 : 42) : 0;
    const deltaW = showVariance ? (compact ? 48 : 64) : 0;
    const valueW = compact ? 44 : 54;
    const rightW = valueW + deltaW + shareW;

    // Clamp the left label gutter so a minimum bar area always survives.
    const minBarW = 36;
    const lw = Math.max(48, Math.min(labelWidth, width - padL - padR - rightW - minBarW));
    const barX0 = padL + lw;
    const barAreaW = Math.max(minBarW, width - padR - rightW - barX0);

    const n = segments.length || 1;
    const totalRowH = 26;
    const availH = height - padT - padB - totalRowH;
    // Vertical band layout (component-row placement). Default reproduces the
    // historical centred look exactly (comparison bar = 0.66·step, half-row
    // gutter top and bottom); `bandPadding` lets a caller trim that gutter
    // (`{ outer: 0 }`) so the first/last rows sit flush to the plot edges. The
    // fixed-height total row below is unaffected.
    const scale = bandScale(availH, n, resolveBandPadding(0.66, bandPadding), padT);
    const rowH = scale.step;
    const cyOf = (i: number) => scale.center(i);
    const acH = Math.min(rowH * 0.46, 16);
    const pyH = Math.min(scale.bandwidth, 24);
    // Shrink the row fonts when rows get tight so they don't overlap vertically.
    const labelFont = Math.max(8, Math.min(12, rowH * 0.5));
    const valFont = Math.max(8, Math.min(11, rowH * 0.46));
    // Below this row height even the 8px floor font would overlap its neighbour,
    // so drop the per-row text and keep just the (non-overlapping) bars.
    const showRowText = rowH >= 11;

    const wOf = (v: number) => (Math.abs(v) / maxAbs) * barAreaW;

    const fmt = (v: number) => formatValue(v, format);
    const baselineY = padT + availH;

    // Built-in tooltip rows for the hovered component: value, signed Δ vs the
    // comparison (impact-coloured), and its share - reusing the layout's variance.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const s = segments.find((seg) => seg.label === h.category);
      if (!s) return null;
      const exact = { ...format, compact: false };
      const rows: ChartTooltipRow[] = [
        { label: "Value", value: formatValue(s.current, exact), strong: true },
      ];
      if (s.base != null) rows.push({ label: comparison, value: formatValue(s.base, exact) });
      const v = s.variance;
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
      rows.push({ label: "Share", value: `${Math.round(s.share * 100)}%` });
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

    // Screen-reader data table: each component's value, the comparison, optional
    // variance and share, plus the total row - values, not the decorative svg.
    const a11yColumns = [
      "Value",
      comparison,
      ...(showVariance ? [`Δ${comparison}`] : []),
      ...(showShare ? ["Share"] : []),
    ];
    const a11yRows: ChartDataRow[] = segments.map((s) => {
      const cells: Array<string | number> = [fmt(s.current), s.base != null ? fmt(s.base) : "n/a"];
      if (showVariance) {
        cells.push(
          s.variance
            ? variance === "pct"
              ? formatPercent(s.variance.pct)
              : formatSigned(s.variance.abs, format)
            : "n/a",
        );
      }
      if (showShare) cells.push(`${Math.round(s.share * 100)}%`);
      return { label: s.label, cells };
    });
    a11yRows.push({
      label: "Total",
      cells: [
        fmt(total),
        baseTotal !== 0 ? fmt(baseTotal) : "n/a",
        ...(showVariance
          ? [baseTotal !== 0 ? formatSigned(total - baseTotal, format) : "n/a"]
          : []),
        ...(showShare ? ["100%"] : []),
      ],
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
                ? `${title}. Composition of ${n} components versus ${comparison}, with shares and variance.`
                : `Composition of ${n} components versus ${comparison}`
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
              <line x1="0" y1="0" x2="0" y2="5" stroke={cmpStyle.stroke} strokeWidth="1" />
            </pattern>
          </defs>
          {onSelect && <style>{SELECTABLE_MARK_CSS}</style>}
          {title && (
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, width - padL - padR, 13)}
            </text>
          )}

          {/* Baseline the bars start from */}
          <line
            x1={barX0}
            y1={padT}
            x2={barX0}
            y2={baselineY}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {segments.map((s, i) => {
            const cy = cyOf(i);
            const acW = wOf(s.current) * grow;
            const pyW = s.base != null ? wOf(s.base) * grow : 0;
            // Value label sits just past the longer of the two (full, un-animated) bars.
            const tipX = barX0 + Math.max(wOf(s.current), s.base != null ? wOf(s.base) : 0) + 6;

            const v = s.variance;
            const varVal = v ? (variance === "pct" ? (v.pct ?? 0) : v.abs) : 0;
            const varColor = !v
              ? tokens.color.textMuted
              : varVal === 0
                ? tokens.color.zero
                : v.favorable
                  ? tokens.color.good
                  : tokens.color.bad;
            const varLabel = !v
              ? ""
              : variance === "pct"
                ? formatPercent(v.pct)
                : formatSigned(v.abs, format);

            const info = {
              category: s.label,
              scenario: (s.AC != null ? "AC" : "FC") as ScenarioKey,
              value: s.current,
              datum: s,
            };
            // The row's visible marks in FINAL (un-animated) geometry - the
            // current bar first (the anchor for focus/tap), then the comparison
            // bar when it is drawn. The full-row rect below stays as the
            // generous click target; the tooltip only fires near these.
            const markRects: MarkRect[] = [
              { x: barX0, y: cy - acH / 2, width: wOf(s.current), height: acH },
            ];
            if (showComparison && s.base != null)
              markRects.push({ x: barX0, y: cy - pyH / 2, width: wOf(s.base), height: pyH });
            return (
              <g
                key={s.label}
                {...selectableMarkProps(
                  onSelect ? () => onSelect(info) : undefined,
                  `Select ${s.label}, ${info.scenario} ${formatValue(info.value, format)}`,
                )}
                {...marks.forMark(info, markRects)}
                style={onSelect ? { cursor: "pointer" } : undefined}
              >
                {/* Transparent full-row hit target so the whole row is click/hover-able */}
                {(onSelect || hoverEnabled) && (
                  <rect
                    x={padL}
                    y={cyOf(i) - rowH / 2}
                    width={width - padL - padR}
                    height={rowH}
                    fill="transparent"
                  />
                )}
                {/* Comparison bar behind (taller), in the comparison scenario's IBCS
                notation: PY solid, PL hollow white frame, FC hatched. */}
                {showComparison &&
                  s.base != null &&
                  (cmpStyle.variant === "frame" ? (
                    <rect
                      x={barX0}
                      y={cy - pyH / 2}
                      width={pyW}
                      height={pyH}
                      fill={tokens.color.surface}
                      stroke={cmpStyle.stroke}
                      strokeWidth={1.25}
                    />
                  ) : cmpStyle.variant === "hatch" ? (
                    <rect
                      x={barX0}
                      y={cy - pyH / 2}
                      width={pyW}
                      height={pyH}
                      fill={`url(#${hatchId})`}
                      stroke={cmpStyle.stroke}
                      strokeWidth={1}
                    />
                  ) : (
                    <rect
                      x={barX0}
                      y={cy - pyH / 2}
                      width={pyW}
                      height={pyH}
                      fill={cmpStyle.fill}
                    />
                  ))}
                {/* Current bar in front (solid, thinner) */}
                <rect
                  x={barX0}
                  y={cy - acH / 2}
                  width={acW}
                  height={acH}
                  fill={tokens.color.neutral}
                />

                {showRowText && (
                  <>
                    {/* Component label */}
                    <text x={padL} y={cy + 4} fontSize={labelFont} fill={tokens.color.text}>
                      {fitLabel(s.label, lw - 6, labelFont)}
                    </text>

                    {/* Value at the bar tip - clamped so it can't run under the Δ column. */}
                    <text
                      x={Math.min(tipX, width - padR - shareW - deltaW - valueW)}
                      y={cy + 4}
                      fontSize={valFont}
                      fill={tokens.color.text}
                    >
                      {fitLabel(fmt(s.current), valueW, valFont)}
                    </text>

                    {/* Δ vs comparison, right-aligned in its column (clipped to it). */}
                    {showVariance && (
                      <text
                        x={width - padR - shareW - 6}
                        y={cy + 4}
                        fontSize={valFont}
                        fill={varColor}
                        textAnchor="end"
                      >
                        {fitLabel(varLabel, deltaW - 8, valFont)}
                      </text>
                    )}

                    {/* Share of total, far right */}
                    {showShare && (
                      <text
                        x={width - padR}
                        y={cy + 4}
                        fontSize={valFont}
                        fontWeight={600}
                        fill={tokens.color.textMuted}
                        textAnchor="end"
                      >
                        {Math.round(s.share * 100)}%
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* Total row */}
          <line
            x1={padL}
            y1={baselineY}
            x2={width - padR}
            y2={baselineY}
            stroke={tokens.color.rowBorder}
            strokeWidth={1}
          />
          <text x={padL} y={baselineY + 17} fontSize={12} fontWeight={600} fill={tokens.color.text}>
            Total
          </text>
          <text
            x={barX0 + 6}
            y={baselineY + 17}
            fontSize={11.5}
            fontWeight={600}
            fill={tokens.color.text}
          >
            {fitLabel(fmt(total), width - padR - shareW - deltaW - (barX0 + 6) - 2, 11.5)}
          </text>
          {showVariance && baseTotal !== 0 && (
            <text
              x={width - padR - shareW - 6}
              y={baselineY + 17}
              fontSize={11}
              fontWeight={600}
              textAnchor="end"
              fill={(() => {
                const d = total - baseTotal;
                return d === 0
                  ? tokens.color.zero
                  : (higherIsBetter ? d >= 0 : d <= 0)
                    ? tokens.color.good
                    : tokens.color.bad;
              })()}
            >
              {fitLabel(formatSigned(total - baseTotal, format), deltaW - 8, 11)}
            </text>
          )}
          {showShare && (
            <text
              x={width - padR}
              y={baselineY + 17}
              fontSize={11}
              fontWeight={600}
              fill={tokens.color.textMuted}
              textAnchor="end"
            >
              100%
            </text>
          )}
        </svg>
        <ChartDataTable
          caption={
            title ? `${title} - data table` : `Composition versus ${comparison} - data table`
          }
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
