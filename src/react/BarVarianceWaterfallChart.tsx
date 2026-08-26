import { forwardRef, useMemo, type CSSProperties } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import {
  computeBarVarianceWaterfall,
  type BarVarianceDatum,
  type BarVarianceRow,
} from "../core/barVarianceWaterfall";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { useMountGrow, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel } from "./internal/text";

export type { BarVarianceDatum } from "../core/barVarianceWaterfall";

export interface BarVarianceWaterfallChartProps {
  /**
   * The entities (locations / products …). Each carries an actual `ac`, the plan
   * `base` (PL), and optionally the prior year `py` (PY). When any `py` (or
   * `pyTotal`) is given the variance waterfall and the structure overlay use PY
   * as their reference; otherwise the chart degrades to a plan bridge (Δ AC−PL).
   */
  data: BarVarianceDatum[];
  /**
   * Override the PY total shown in the header bar (e.g. an "Others"-adjusted
   * group total). Presence alone also switches the chart into PY-reference mode.
   * Default: the sum of the rows' `py`.
   */
  pyTotal?: number;
  /** Row order. "variance" (default, AC−ref desc), "value" (AC desc), or "none". */
  sortBy?: "variance" | "value" | "none";
  /** Base for the relative-variance tier: "PY" (default) or "PL". */
  pctBase?: "PY" | "PL";
  /** Off-scale threshold for the Δ% tier, in percent. Default 100. */
  clampPct?: number;
  /** Total pixel width of the chart. Default 720. */
  width?: number;
  /** Height of each entity / header row, in px. Default 24. */
  rowHeight?: number;
  format?: FormatOptions;
  /** Token override merged over the nearest {@link IbcsThemeProvider} theme. */
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class applied to the chart `<svg>` (the root element). */
  className?: string;
  /** Styles merged *over* the chart's own layout styles. */
  style?: CSSProperties;
  /**
   * Show the built-in floating tooltip on row hover or keyboard focus (AC, PL,
   * PY, Δ, Δ%). Default true; set false to opt out (e.g. when wiring your own
   * via onHover). Renders on the client only, near a hovered mark (or the
   * focused / tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
  /**
   * Fired as the pointer moves over / leaves an entity row (`null` on leave) —
   * for a custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<BarVarianceRow> | null) => void;
}

/**
 * **BarVarianceWaterfallChart** — IBCS chart-template **C06**. A grouped
 * AC/PL/PY *structure* chart fused with a vertically-running *variance bridge*,
 * all on one shared value axis:
 *
 *  - TOP   — a hollow-frame **PL** total bar and a faded-grey **PY** total bar.
 *  - BODY  — one row per entity: a solid dark **AC** bar from the left axis with
 *            the **PY** reference behind it (visible where PY > AC), plus, far to
 *            the right around the PY total, that entity's Δ = AC − PY as a
 *            floating step of a waterfall that bridges the PY total down to AC
 *            (green favorable / red unfavorable, sorted so the run reads cleanly,
 *            tied together by thin step connectors). A vertical line marks the PL
 *            reference the whole bridge is measured against.
 *  - END   — a solid dark **AC** total bar, then the bridge's result bars: the
 *            headline AC − PY and (when PY is in use) the secondary AC − PL.
 *  - RIGHT — a Δ% tier (vs PY by default): impact-coloured bars with off-scale
 *            edge arrows beyond the shared half-scale and signed % labels.
 *
 * Robust to empty / single / negative / zero / huge data and very long entity
 * labels (truncated with … plus a native `<title>`). Zero-dependency pure SVG,
 * themable only through the token context (a `tokens` override or an enclosing
 * {@link IbcsThemeProvider}), and SSR-safe (the mount-grow animation and
 * hover/focus tooltip are client-only). Reuses the pure
 * {@link computeBarVarianceWaterfall} layout.
 *
 * The svg is the chart's root element — it takes `className` / `style` and the
 * forwarded ref, and carries the accessible name (`role="img"` + `aria-label`);
 * the built-in tooltip portals to `document.body` and flips at the viewport
 * edges.
 */
export const BarVarianceWaterfallChart = forwardRef<SVGSVGElement, BarVarianceWaterfallChartProps>(
  function BarVarianceWaterfallChart(
    {
      data,
      pyTotal,
      sortBy = "variance",
      pctBase = "PY",
      clampPct = 100,
      width = 720,
      rowHeight = 24,
      format = {},
      tokens: tokenOverride,
      title,
      tooltip = true,
      onHover,
      className,
      style,
    },
    ref,
  ) {
    const tokens = useIbcsTokens(tokenOverride);
    const hover = useChartHover<BarVarianceRow>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;

    const layout = useMemo(
      () => computeBarVarianceWaterfall(data, { sortBy, pctBase, clampPct, pyTotal }),
      [data, sortBy, pctBase, clampPct, pyTotal],
    );
    const {
      rows,
      totals,
      usesPy,
      reference,
      pctBase: pctRef,
      domainMin,
      domainMax,
      pctMax,
    } = layout;
    const grow = useMountGrow(700, 0, layout);

    // The reference overlay's IBCS scenario style (PY → grey solid, PL → frame).
    const refStyle = usesPy ? tokens.scenario.PY : tokens.scenario.PL;
    const refBehind = refStyle.variant === "solid";

    const n = rows.length;
    const lastRow = rows[n - 1];

    // --- vertical layout ------------------------------------------------------
    const rowH = Math.max(14, rowHeight);
    const padL = 12;
    const padR = 12;
    const padT = title ? 34 : 18;
    const padB = 10;
    const phH = 16; // panel-header band (Δ% caption)
    const headerGap = 6;
    const totGap = 6;
    const resultH = rowH * 0.85;

    let yc = padT + phH;
    const plTop = yc;
    yc += rowH;
    const pyTop = usesPy ? yc : -1;
    if (usesPy) yc += rowH;
    yc += headerGap;
    const entTop = yc;
    yc += n * rowH;
    yc += totGap;
    const acTop = yc;
    yc += rowH;
    const resMainTop = yc;
    yc += resultH;
    const resPlTop = usesPy ? yc : -1;
    if (usesPy) yc += resultH;
    const height = yc + padB;

    // --- horizontal layout: labels | shared AC/PY/waterfall panel | Δ% tier ----
    const innerW = width - padL - padR;
    const labelW = clampTo(innerW * 0.16, 46, 120);
    const gap = 12;
    const avail = Math.max(innerW - labelW, 40);
    const pctW = clampTo(avail * 0.22, 64, 150);
    const mainX0 = padL + labelW;
    const mainW = Math.max(avail - gap - pctW, 30);
    const mainX1 = mainX0 + mainW;
    const pctX0 = mainX1 + gap;
    const pctX1 = pctX0 + pctW;
    const pctCx = (pctX0 + pctX1) / 2;

    // Reserve a right gutter so a value / Δ label sitting beyond a bar's leading
    // edge has room before the clamp pins it to the panel edge.
    const rLabelW = 34;
    const plotW = Math.max(mainW - rLabelW, 12);
    const vRange = domainMax - domainMin || 1;
    const xOf = (v: number) => mainX0 + ((v - domainMin) / vRange) * plotW;
    const zeroX = xOf(0);
    const xA = (v: number) => zeroX + (xOf(v) - zeroX) * grow;

    // --- bar metrics ----------------------------------------------------------
    const barH = Math.min(rowH * 0.5, 14);
    const refBarH = Math.min(rowH * 0.64, 18);
    const waterH = Math.min(rowH * 0.46, 13);
    const pctBarH = Math.min(rowH * 0.44, 12);

    const pctValW = Math.min(40, pctW * 0.4);
    const pctBarMax = Math.max(pctW / 2 - pctValW - 4, 8);

    const valFont = Math.max(9, Math.min(11, rowH * 0.42));
    const labelFont = Math.max(9, Math.min(12, rowH * 0.5));
    const showText = rowH >= 13;

    const impactColor = (val: number, favorable: boolean) =>
      val === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;

    // --- Δ% tier mark (shared by entity rows and the AC total) ----------------
    const renderPctMark = (
      cy: number,
      pct: number | null,
      favorable: boolean,
      outlier: boolean,
      emphasis: boolean,
    ) => {
      if (pct == null || !Number.isFinite(pct)) return null;
      const pctVal = pct * 100;
      const dir = pctVal === 0 ? 0 : favorable ? 1 : -1;
      const color = impactColor(pctVal, favorable);
      const frac = outlier ? 1 : Math.min(Math.abs(pctVal) / pctMax, 1);
      const len = frac * pctBarMax * grow;
      const tip = pctCx + dir * len;
      const label = formatPercent(pct);
      const showLbl = showText && estTextW(label, valFont) <= pctValW + 10;
      const lx = dir > 0 ? pctX1 - 2 : dir < 0 ? pctX0 + 2 : pctCx;
      const anchor: "start" | "middle" | "end" = dir > 0 ? "end" : dir < 0 ? "start" : "middle";
      const h = emphasis ? pctBarH + 2 : pctBarH;
      return (
        <>
          {dir !== 0 && (
            <rect
              x={Math.min(pctCx, tip)}
              y={cy - h / 2}
              width={Math.max(Math.abs(tip - pctCx), 1)}
              height={h}
              fill={color}
            />
          )}
          {outlier && dir !== 0 && (
            <polygon
              points={`${tip + dir * 6},${cy} ${tip},${cy - 5} ${tip},${cy + 5}`}
              fill={color}
            />
          )}
          {showLbl && (
            <text
              x={lx}
              y={cy + valFont * 0.34}
              textAnchor={anchor}
              fontSize={valFont}
              fontStyle="italic"
              fontWeight={emphasis ? 700 : 400}
              fill={color}
            >
              {label}
            </text>
          )}
        </>
      );
    };

    // --- a full structure bar (PL / PY / AC header & total rows) ---------------
    const renderTotalBar = (
      cy: number,
      label: string,
      value: number,
      style: "frame" | "py" | "ac",
    ) => {
      const w = Math.max(xA(value) - zeroX, 0);
      const h = barH + 2;
      const valStr = formatValue(value, format);
      const tip = xA(value);
      const lx = clampTo(tip + 5, mainX0, mainX1 - estTextW(valStr, valFont));
      return (
        <>
          {showText && (
            <text
              x={mainX0 - 6}
              y={cy + labelFont * 0.34}
              textAnchor="end"
              fontSize={labelFont}
              fontWeight={700}
              fill={tokens.color.text}
            >
              {label}
            </text>
          )}
          {style === "frame" ? (
            <rect
              x={zeroX}
              y={cy - h / 2}
              width={w}
              height={h}
              fill={tokens.color.surface}
              fillOpacity={0}
              stroke={refStyle.variant === "frame" ? refStyle.stroke : tokens.scenario.PL.stroke}
              strokeWidth={1.25}
            />
          ) : (
            <rect
              x={zeroX}
              y={cy - h / 2}
              width={w}
              height={h}
              fill={style === "py" ? tokens.scenario.PY.fill : tokens.color.total}
            />
          )}
          {showText && (
            <text
              x={lx}
              y={cy + valFont * 0.34}
              fontSize={valFont}
              fontWeight={700}
              fill={tokens.color.text}
            >
              {valStr}
            </text>
          )}
        </>
      );
    };

    // --- a waterfall result bar (AC−PY headline, AC−PL secondary) -------------
    const renderResult = (
      cy: number,
      lo: number,
      hi: number,
      value: number,
      favorable: boolean,
    ) => {
      const xL = xA(lo);
      const xR = xA(hi);
      const w = Math.max(xR - xL, 1);
      const color = impactColor(value, favorable);
      const s = formatSigned(value, format);
      const mid = (xL + xR) / 2;
      const fits = estTextW(s, valFont) <= w - 4;
      return (
        <>
          <rect x={xL} y={cy - waterH / 2} width={w} height={waterH} fill={color} />
          {showText &&
            (fits ? (
              <text
                x={mid}
                y={cy + valFont * 0.34}
                textAnchor="middle"
                fontSize={valFont}
                fontWeight={700}
                fill={tokens.color.onFill}
              >
                {s}
              </text>
            ) : (
              <text
                x={xR + 4}
                y={cy + valFont * 0.34}
                fontSize={valFont}
                fontWeight={700}
                fill={color}
              >
                {s}
              </text>
            ))}
        </>
      );
    };

    // Built-in tooltip rows for the hovered entity.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const r = h.datum;
      const exact = { ...format, compact: false };
      const rowsT: ChartTooltipRow[] = [
        { label: "AC", value: formatValue(r.ac, exact), strong: true },
        { label: "PL", value: formatValue(r.base, exact) },
      ];
      if (usesPy) rowsT.push({ label: "PY", value: formatValue(r.ref, exact) });
      rowsT.push({
        label: `Δ${reference}`,
        value: `${formatSigned(r.abs, exact)} (${formatPercent(r.pct)})`,
        color: impactColor(r.abs, r.favorable),
      });
      return (
        <ChartTooltip
          ref={hover.tooltipRef}
          x={h.x}
          y={h.y}
          title={r.label}
          rows={rowsT}
          tokens={tokens}
        />
      );
    };

    const plLineX = xA(totals.pl);
    const bridgeBottom = resPlTop >= 0 ? resPlTop + resultH : resMainTop + resultH;

    // Screen-reader data table: every entity's AC, the waterfall reference it is
    // bridged from, the absolute step and the Δ% tier value — plus the totals row
    // the chart draws at the bottom — as real numbers, not the decorative svg.
    const a11yColumns = ["AC", reference, `Δ${reference}`, `Δ${pctRef}%`];
    const a11yRows: ChartDataRow[] = rows.map((r) => ({
      label: r.label,
      cells: [
        formatValue(r.ac, format),
        formatValue(r.ref, format),
        formatSigned(r.abs, format),
        formatPercent(r.pct),
      ],
    }));
    a11yRows.push({
      label: "Total",
      cells: [
        formatValue(totals.ac, format),
        formatValue(usesPy ? totals.pyDisplay : totals.pl, format),
        formatSigned(totals.refAbs, format),
        formatPercent(totals.pct),
      ],
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
            (title ? `${title}. ` : "") +
            `IBCS C06: ${n} entities as AC structure bars with a ${reference}→AC variance waterfall and a Δ${pctRef}% tier.`
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
          {title && (
            <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, innerW, 13)}
            </text>
          )}

          {/* Δ% tier caption */}
          <text
            x={pctCx}
            y={padT + phH - 4}
            textAnchor="middle"
            fontSize={10.5}
            fontStyle="italic"
            fill={tokens.color.textMuted}
          >
            {`Δ${pctRef}%`}
          </text>

          {/* Zero baseline (left axis) + Δ% center axis, spanning the whole body. */}
          <line
            x1={zeroX}
            y1={plTop}
            x2={zeroX}
            y2={acTop + rowH}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />
          <line
            x1={pctCx}
            y1={entTop}
            x2={pctCx}
            y2={acTop + rowH}
            stroke={tokens.color.axis}
            strokeWidth={0.75}
          />

          {/* PL reference line: the plan the whole waterfall is measured against. */}
          <line
            x1={plLineX}
            y1={plTop}
            x2={plLineX}
            y2={bridgeBottom}
            stroke={tokens.color.textMuted}
            strokeWidth={1}
          />

          {/* Header totals */}
          <g>{renderTotalBar(plTop + rowH / 2, "PL", totals.pl, "frame")}</g>
          {usesPy && <g>{renderTotalBar(pyTop + rowH / 2, "PY", totals.pyDisplay, "py")}</g>}

          {/* Step connectors tying the waterfall together (leaving level of each
            step), including PY→first and last→result. Drawn under the bars. */}
          {rows.map((r, i) => {
            const cy = entTop + rowH * i + rowH / 2;
            const prev = i === 0 ? undefined : rows[i - 1];
            const xPrev = prev ? xA(prev.to) : xA(totals.py);
            const yPrevBottom =
              i === 0
                ? usesPy
                  ? pyTop + rowH
                  : plTop + rowH
                : entTop + rowH * (i - 1) + rowH / 2 + waterH / 2;
            return (
              <line
                key={`conn-${i}`}
                x1={xPrev}
                y1={yPrevBottom}
                x2={xPrev}
                y2={cy - waterH / 2}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
            );
          })}
          {lastRow && (
            <line
              x1={xA(lastRow.to)}
              y1={entTop + n * rowH - rowH / 2 + waterH / 2}
              x2={xA(lastRow.to)}
              y2={resMainTop + resultH / 2 - waterH / 2}
              stroke={tokens.color.axis}
              strokeWidth={1}
            />
          )}

          {/* Entity rows: AC bar + PY overlay (left) and the waterfall step (right). */}
          {rows.map((r, i) => {
            const top = entTop + rowH * i;
            const cy = top + rowH / 2;
            const acW = Math.max(xA(r.ac) - zeroX, 0);
            const refW = Math.max(xA(r.ref) - zeroX, 0);

            // Waterfall floating step.
            const xL = Math.min(xA(r.from), xA(r.to));
            const xR = Math.max(xA(r.from), xA(r.to));
            const stepW = Math.max(xR - xL, 1);
            const stepColor = impactColor(r.abs, r.favorable);
            const right = r.abs >= 0;
            const dLabel = formatSigned(r.abs, format);
            const dTip = right ? xR : xL;
            const dx = right
              ? clampTo(dTip + 4, mainX0, mainX1 - estTextW(dLabel, valFont))
              : clampTo(dTip - 4, mainX0 + estTextW(dLabel, valFont), mainX1);
            const dAnchor: "start" | "end" = right ? "start" : "end";

            // AC value label, clamped inside the panel; PY label when it sticks out.
            const acStr = formatValue(r.ac, format);
            const acTip = xA(r.ac);
            const acLx = clampTo(acTip + 4, mainX0, mainX1 - estTextW(acStr, valFont));
            const refStr = formatValue(r.ref, format);
            const refTip = xA(r.ref);
            const showRefLbl = usesPy && refTip > acTip + estTextW(acStr, valFont) + 8;

            const info = { category: r.label, scenario: "AC" as const, value: r.ac, datum: r };
            // This row's visible marks in FINAL (un-animated) geometry — xOf,
            // not xA: the AC bar (focus/tap anchor), the PY/PL reference
            // overlay, the waterfall step, and the Δ% tier as its lane strip at
            // the mark's thickness. The full-row rect stays the hit band.
            const markRects: MarkRect[] = [];
            if (r.ac !== 0)
              markRects.push({
                x: zeroX,
                y: cy - barH / 2,
                width: Math.max(xOf(r.ac) - zeroX, 0),
                height: barH,
              });
            if (r.ref !== 0)
              markRects.push({
                x: zeroX,
                y: cy - refBarH / 2,
                width: Math.max(xOf(r.ref) - zeroX, 0),
                height: refBarH,
              });
            markRects.push({
              x: Math.min(xOf(r.from), xOf(r.to)),
              y: cy - waterH / 2,
              width: Math.max(Math.abs(xOf(r.to) - xOf(r.from)), 1),
              height: waterH,
            });
            if (r.pct != null && Number.isFinite(r.pct) && r.pct * 100 !== 0)
              markRects.push({ x: pctX0, y: cy - pctBarH / 2, width: pctW, height: pctBarH });

            return (
              <g key={`${r.label}-${i}`} {...marks.forMark(info, markRects)}>
                {hoverEnabled && (
                  <rect x={padL} y={top} width={innerW} height={rowH} fill="transparent" />
                )}

                {/* entity label (right-aligned in the gutter) */}
                {showText && (
                  <text
                    x={mainX0 - 6}
                    y={cy + labelFont * 0.34}
                    textAnchor="end"
                    fontSize={labelFont}
                    fill={tokens.color.text}
                  >
                    {fitLabel(r.label, labelW - 6, labelFont)}
                    <title>{r.label}</title>
                  </text>
                )}

                {/* PY reference overlay (behind, grey) or PL frame */}
                {refBehind && r.ref !== 0 && (
                  <rect
                    x={zeroX}
                    y={cy - refBarH / 2}
                    width={refW}
                    height={refBarH}
                    fill={refStyle.fill}
                  />
                )}
                {r.ac !== 0 && (
                  <rect
                    x={zeroX}
                    y={cy - barH / 2}
                    width={acW}
                    height={barH}
                    fill={tokens.scenario.AC.fill}
                  />
                )}
                {!refBehind && r.ref !== 0 && (
                  <rect
                    x={zeroX}
                    y={cy - refBarH / 2}
                    width={refW}
                    height={refBarH}
                    fill={tokens.color.surface}
                    fillOpacity={0}
                    stroke={refStyle.stroke}
                    strokeWidth={1}
                  />
                )}

                {/* AC value label + optional PY label */}
                {showText && (
                  <text
                    x={acLx}
                    y={cy + valFont * 0.34}
                    fontSize={valFont}
                    fill={tokens.color.text}
                  >
                    {acStr}
                  </text>
                )}
                {showText && showRefLbl && (
                  <text
                    x={clampTo(refTip + 4, mainX0, mainX1 - estTextW(refStr, valFont))}
                    y={cy + valFont * 0.34}
                    fontSize={valFont}
                    fill={tokens.color.textMuted}
                  >
                    {refStr}
                  </text>
                )}

                {/* Waterfall step */}
                <rect x={xL} y={cy - waterH / 2} width={stepW} height={waterH} fill={stepColor} />
                {showText && (
                  <text
                    x={dx}
                    y={cy + valFont * 0.34}
                    textAnchor={dAnchor}
                    fontSize={valFont}
                    fill={tokens.color.text}
                  >
                    {dLabel}
                  </text>
                )}

                {/* Δ% tier mark */}
                {renderPctMark(cy, r.pct, r.pctFavorable, r.pctOutlier, false)}
              </g>
            );
          })}

          {/* AC total row */}
          <line
            x1={padL}
            y1={acTop - totGap / 2}
            x2={width - padR}
            y2={acTop - totGap / 2}
            stroke={tokens.color.rowBorder}
            strokeWidth={1}
          />
          <g>{renderTotalBar(acTop + rowH / 2, "AC", totals.ac, "ac")}</g>
          {renderPctMark(
            acTop + rowH / 2,
            totals.pct,
            totals.pctFavorable,
            totals.pctOutlier,
            true,
          )}

          {/* Result bars: headline AC−PY (or AC−PL), then secondary AC−PL */}
          {renderResult(
            resMainTop + resultH / 2,
            Math.min(totals.ac, totals.py),
            Math.max(totals.ac, totals.py),
            totals.refAbs,
            totals.refFavorable,
          )}
          {usesPy &&
            renderResult(
              resPlTop + resultH / 2,
              Math.min(totals.ac, totals.pl),
              Math.max(totals.ac, totals.pl),
              totals.plAbs,
              totals.plFavorable,
            )}
        </svg>
        <ChartDataTable
          caption={title ? `${title} — data table` : `AC versus ${reference} bridge — data table`}
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
