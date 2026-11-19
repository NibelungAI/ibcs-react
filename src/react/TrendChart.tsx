import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { deltaHeading, fillLabel, scenarioHeadings, type IbcsLabelsOverride } from "../core/labels";
import { computeTrend, type TrendDatum } from "../core/trend";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import {
  formatPercent,
  formatSigned,
  formatValue,
  notAvailableOf,
  percentFormatOf,
  type FormatOptions,
} from "../core/format";
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
import { useIbcsTokens, useResolvedLabels } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId, wrapText } from "./internal/text";
import { calloutSides, type PointCallout } from "../core/callout";
import type { PlacementBox, PlacementSegment, PlacementSide } from "../core/labelPlacement";
import {
  CALLOUT_FONT,
  CALLOUT_LINE_H,
  CalloutLeaders,
  CalloutMarks,
  allPlaced,
  calloutNotes,
  dotBox,
  resolveCallouts,
  type CalloutSpec,
} from "./internal/callouts";
import { NoteList, layoutNotes, notesHeight } from "./internal/notes";

export type { TrendDatum } from "../core/trend";
export type { PointCallout } from "../core/callout";

export interface TrendChartProps {
  /** The periods, in order. Designed for ~13 (a year + total), but any length. */
  data: TrendDatum[];
  /** Reference scenario for the variance panel. Default "PY". */
  comparison?: ScenarioKey;
  /** Higher is better (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /**
   * The lower AC-vs-comparison variance panel: "abs" shows Δ values, "pct"
   * shows Δ%, "none" omits the panel entirely. Default "abs".
   */
  variance?: "abs" | "pct" | "none";
  /**
   * Scenarios drawn as reference lines riding along the columns - PY solid grey
   * with dots ("the past"), PL dashed ("not real yet"). Default `["PY","PL"]`;
   * pass `["PY"]` for prior year only, `[]` for bare columns. Only "PY" and
   * "PL" are honored today (FC support may come later) - any other scenario is
   * ignored, since the forecast already rides in the column series.
   */
  referenceLines?: ScenarioKey[];
  /** Print the current value above each column. Default true. */
  showValueLabels?: boolean;
  /**
   * Labelled periods (GTM p. 4) - a gear change in a run of results: each
   * names a period and, optionally, a drawn reference line ("PY", "PL";
   * default the column), and its text - "\n" for a new line - is written above
   * the column's value label (below a negative column), or beside the line's
   * point, marked with a dot. Labels are placed clear of every column, label,
   * line and other callout, moved away with a leader where they must be; the
   * plot keeps room above its tallest column for them. A callout with no room
   * anywhere is numbered at its point and written under the chart (the svg
   * grows by that list). A callout on a period without its point - a column
   * without a value, a line that is not drawn, a summary column's line - is
   * written under the chart too, after the name of its period ("R2:
   * Missing"). So none on a period is left out, and the screen-reader table
   * carries each one's text in its period's row (`labels.note`). An `index`
   * that names no period (-1, 1.5, past the end) is ignored.
   */
  callouts?: PointCallout[];
  width?: number;
  /**
   * Height in px. Default 360. A chart whose callouts could not all be placed
   * beside their periods grows by the list of their notes.
   */
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
   * The component's own words (the legend's scenario codes, "Current" and the scenario codes of its tooltip and table, the "(FC)" mark, the columns' "Select …" names) merged onto `IbcsThemeProvider`'s.
   * See `IbcsLabels`.
   */
  labels?: IbcsLabelsOverride;
  title?: string;
  /**
   * The chart's accessible name, in place of the generated English
   * description; also the caption of its screen-reader table. With
   * `onSelect`, the svg is a container of selectable marks, each with its own
   * name, and takes no name itself: the text then names the table alone.
   */
  ariaLabel?: string;
  /** Extra class name for the chart `<svg>` (the rendered root). */
  className?: string;
  /** Inline style merged OVER the chart `<svg>`'s own layout style. */
  style?: CSSProperties;
  /**
   * Fired when a period column is clicked - for click-to-filter / drill-down.
   * Pairs naturally with `useChartSelection`. Omit for a non-interactive chart.
   * `scenario` is "FC" on forecast periods, otherwise "AC".
   */
  onSelect?: (selection: ChartSelection<TrendDatum>) => void;
  /**
   * Fired as the pointer moves over / leaves a period column (`null` on leave) -
   * for a custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<TrendDatum> | null) => void;
  /**
   * Show the built-in floating tooltip on column hover or keyboard focus
   * (value, Δ vs the comparison). Default true; set false to opt out. Renders
   * on the client only, near a hovered mark (or the focused / tapped one);
   * Escape dismisses it.
   */
  tooltip?: boolean;
}

/** The space between a column's end (or its value label) and the tie of its callout, px. */
const TIE_CLEAR = 2;

/** Build polyline segments, breaking the line wherever a period lacks the value. */
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
 * IBCS trend chart over a run of periods (typically 13 - a year plus its
 * total). The current series (AC, or FC where actuals run out) is drawn as
 * columns; previous year and plan ride along as reference lines ("bands"),
 * and a variance panel beneath shows AC/FC vs the comparison scenario.
 *
 * Forecast periods are hatched and a `summary` period (e.g. the full-year
 * total) is set off with a divider and the emphasis color - the canonical
 * "actual ▸ forecast ▸ total" trend layout. Summaries do not participate in
 * the period scale: a total that dwarfs the months is drawn capped with a
 * MARKED scale break (and its value label) instead of crushing every other
 * column, and the PY/PL reference lines stop before it - a total is not a
 * point in the time series.
 *
 * A forwarded `ref` lands on the chart `<svg>` - the useful handle for export /
 * serialization - even though the component also renders a screen-reader table
 * beside it.
 */
export const TrendChart = forwardRef<SVGSVGElement, TrendChartProps>(function TrendChart(
  {
    data: dataProp,
    comparison = "PY",
    higherIsBetter = true,
    variance = "abs",
    referenceLines = ["PY", "PL"],
    showValueLabels = true,
    callouts,
    width = 720,
    height = 360,
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
  const tokens = useIbcsTokens(tokenOverride);
  const words = useResolvedLabels(labels);
  const S = scenarioHeadings(words);
  const cmpName = S[comparison];
  const pctFmt = percentFormatOf(format);
  const na = notAvailableOf(format);
  const hatchId = svgSafeId(useId());
  const data = useDataTween(dataProp);
  const grow = useMountGrow(700, 0, data);
  const hover = useChartHover<TrendDatum>();
  const marks = markInteraction(hover, tooltip, onHover);
  const hoverEnabled = marks.enabled;

  // `variance` doubles as the panel's on/off switch, and only PY/PL are drawn
  // as reference lines - resolve both to plain flags once, so the geometry and
  // markup below stay exactly as they were.
  const showVariancePanel = variance !== "none";
  const showPyLine = referenceLines.includes("PY");
  const showPlLine = referenceLines.includes("PL");

  const layout = useMemo(
    () =>
      computeTrend(data, {
        comparison,
        varianceMode: variance === "pct" ? "pct" : "abs",
        higherIsBetter,
      }),
    [data, comparison, variance, higherIsBetter],
  );
  const { cells, domainMin, domainMax, varMax } = layout;

  const padL = 14;
  const padR = 14;
  // Reserve a top band for the legend (+ title) so value labels never collide.
  const padT = title ? 34 : 24;
  const labelH = 22;
  const gap = 16;
  const innerW = width - padL - padR;

  // Headroom inside the plot so the tallest value label (above its column) and,
  // when there is no variance panel, a negative column's label below it, fit.
  const labelTopH = 12;
  const varLabelH = showVariancePanel ? 12 : 0;
  const negLabelH = showVariancePanel ? 0 : 14;

  const varH = showVariancePanel ? Math.round((height - padT - labelH) * 0.3) : 0;
  const topH =
    height - padT - labelH - negLabelH - (showVariancePanel ? varH + gap + varLabelH : 0);
  const plotBottom = padT + topH;
  // Callouts, as lines of text: the plot keeps room above its tallest column
  // for the tallest of them (without any, it keeps none).
  const calloutMaxW = Math.max(60, Math.min(180, innerW * 0.6));
  const calloutLines = (callouts ?? []).map((c) =>
    c && typeof c.label === "string" && c.label.trim() !== ""
      ? wrapText(c.label, calloutMaxW, CALLOUT_FONT)
      : null,
  );
  // Whether a callout's point is drawn: its column's value, or its reference
  // line's point - a drawn line, never on a summary column.
  const pointDrawn = (co: PointCallout): boolean => {
    const c = Number.isInteger(co.index) ? cells[co.index] : undefined;
    if (!c) return false;
    if (co.series === "PY") return showPyLine && c.PY != null && !c.summary;
    if (co.series === "PL") return showPlLine && c.PL != null && !c.summary;
    return c.current != null;
  };
  const tallestCallout = calloutLines.reduce(
    (h, ls, ci) => (ls && pointDrawn(callouts![ci]!) ? Math.max(h, ls.length * CALLOUT_LINE_H) : h),
    0,
  );
  const n = cells.length || 1;
  // Band layout (column placement). Default reproduces the historical centred
  // look exactly (bar width = 0.5·step, half-band gutter); `bandPadding` lets a
  // caller trim the gutter (`{ outer: 0 }`) so columns fill the plot edge-to-edge.
  const scale = bandScale(innerW, n, resolveBandPadding(0.5, bandPadding), padL);
  const band = scale.step;
  const cxOf = (i: number) => scale.center(i);
  const colW = Math.min(scale.bandwidth, 30);
  const sumColW = Math.min(band * 0.62, 38);
  const pyLineColor = tokens.color.neutral;
  const plLineColor = tokens.scenario.PL.stroke;
  const vRange = domainMax - domainMin || 1;

  // The value scale for a given room above the tallest column (`headroom`)
  // and below the lowest one (`footroom`); with neither, the plot's own.
  const scaleFor = (headroom: number, footroom: number) => {
    const plotTop = padT + labelTopH + headroom;
    const scaleBottom = plotBottom - footroom;
    const scaleH = Math.max(scaleBottom - plotTop, 1);
    const y = (v: number) => scaleBottom - ((v - domainMin) / vRange) * scaleH;
    return { plotTop, scaleBottom, y, zeroY: y(0) };
  };

  // --- callouts: placed clear of the columns, labels and lines ------------------
  // The plot keeps room above its tallest column for the tallest callout: its
  // tie, its 2 px clearance and its label - and as much below its lowest one
  // when a callout names a negative column. When some label still finds no
  // place, the room grows by as much again, at most twice, before the label is
  // written as a numbered note. Without callouts the plot keeps no room at all.
  const placeCallouts = (headroom: number, footroom: number) => {
    const { plotTop, scaleBottom, y, zeroY } = scaleFor(headroom, footroom);
    // A column's finished top (a capped summary's at the plot edge), and its
    // value label's text box when one is written - the callouts keep clear of
    // both, and a column's callout starts above its label.
    const columnTop = (c: (typeof cells)[number]) =>
      c.current == null
        ? zeroY
        : c.offScale
          ? c.current >= 0
            ? plotTop
            : scaleBottom
          : y(c.current);
    const valueLabelBox = (c: (typeof cells)[number], i: number): PlacementBox | null => {
      if (!showValueLabels || c.current == null) return null;
      const lw = estTextW(formatValue(c.current, format), 9);
      if (lw > band - 1) return null;
      const lx = clampTo(cxOf(i), padL + lw / 2, width - padR - lw / 2);
      const base = Math.min(zeroY, columnTop(c)) - 4;
      return { left: lx - lw / 2, top: base - 7.2, right: lx + lw / 2, bottom: base + 2 };
    };
    const calloutSpecs: CalloutSpec[] = [];
    const calloutTexts = new Map<number, string[]>();
    (callouts ?? []).forEach((co, ci) => {
      const textLines = calloutLines[ci];
      if (!co || !textLines || !Number.isInteger(co.index)) return;
      const c = cells[co.index];
      if (!c) return;
      const i = co.index;
      const note = co.label
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
        .join(", ");
      // The table carries every callout on a period, its point drawn or not.
      calloutTexts.set(i, [...(calloutTexts.get(i) ?? []), note]);
      if (!pointDrawn(co)) {
        // No point there: a note that names its period.
        calloutSpecs.push({
          x: cxOf(i),
          y: zeroY,
          lines: textLines,
          sides: [],
          dot: null,
          note,
          where: c.category,
          drawn: false,
        });
        return;
      }
      if (co.series === "PY" || co.series === "PL") {
        // A point of a drawn reference line, marked with a dot of its colour.
        const line = co.series;
        const v = c[line]!;
        const neighbour = (k: number) => {
          const d = cells[k];
          return d && !d.summary ? d[line] : undefined;
        };
        calloutSpecs.push({
          x: cxOf(i),
          y: y(v),
          lines: textLines,
          sides: calloutSides(v, neighbour(i - 1), neighbour(i + 1), co.placement),
          dot: line === "PY" ? pyLineColor : plLineColor,
          note,
          where: c.category,
        });
      } else {
        // The column: past its end, above its value label - 2 px clear of it, so
        // the tie that links them never touches the label's digits.
        const label = valueLabelBox(c, i);
        const up = c.current! >= 0;
        const anchorY = up
          ? Math.min(label?.top ?? Infinity, columnTop(c)) - TIE_CLEAR
          : columnTop(c) + TIE_CLEAR;
        const sides: PlacementSide[] = up
          ? [co.placement === "below" ? "below" : "above"]
          : [co.placement === "above" ? "above" : "below"];
        calloutSpecs.push({
          x: cxOf(i),
          y: anchorY,
          lines: textLines,
          sides,
          dot: null,
          note,
          where: c.category,
        });
      }
    });
    const resolvedCallouts = (() => {
      if (calloutSpecs.length === 0) return [];
      const boxes: PlacementBox[] = [];
      const lineSegs: PlacementSegment[] = [];
      for (const [i, c] of cells.entries()) {
        if (c.current == null) continue;
        const w = c.summary ? sumColW : colW;
        const top = columnTop(c);
        boxes.push({
          left: cxOf(i) - w / 2,
          top: Math.min(zeroY, top),
          right: cxOf(i) + w / 2,
          bottom: Math.max(zeroY, top),
        });
        const label = valueLabelBox(c, i);
        if (label) boxes.push(label);
        if (c.summary) {
          const x0 = cxOf(i) - band / 2;
          lineSegs.push({ x1: x0, y1: padT, x2: x0, y2: plotBottom, pad: 0.5 });
        }
      }
      const pts = (key: "PY" | "PL") =>
        cells.map((c, i) => (c[key] != null && !c.summary ? { x: cxOf(i), y: y(c[key]!) } : null));
      const linePts: Array<[Array<{ x: number; y: number } | null>, number]> = [];
      if (showPlLine) linePts.push([pts("PL"), 1.25 / 2]);
      if (showPyLine) linePts.push([pts("PY"), 1.75 / 2]);
      for (const [points, pad] of linePts) {
        for (const run of segments(points)) {
          for (let k = 1; k < run.length; k++) {
            const a = run[k - 1]!;
            const b = run[k]!;
            lineSegs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, pad });
          }
        }
      }
      if (showPyLine) {
        for (const p of pts("PY")) {
          if (p)
            boxes.push({ left: p.x - 3.2, top: p.y - 3.2, right: p.x + 3.2, bottom: p.y + 3.2 });
        }
      }
      lineSegs.push({ x1: padL, y1: zeroY, x2: width - padR, y2: zeroY, pad: 0.5 });
      for (const s of calloutSpecs) if (s.dot) boxes.push(dotBox(s.x, s.y));
      return resolveCallouts(
        calloutSpecs,
        { boxes, segments: lineSegs },
        { left: padL, top: padT, right: width - padR, bottom: plotBottom },
        estTextW,
      );
    })();
    return { calloutTexts, resolvedCallouts };
  };
  const roomStep = tallestCallout > 0 ? tallestCallout + 10 : 0;
  // Head- and footroom together never take more than 60% of the plot.
  const roomMax = (plotBottom - padT - labelTopH) * 0.6;
  const belowNeeded = (callouts ?? []).some(
    (co, ci) =>
      co != null &&
      calloutLines[ci] != null &&
      co.series !== "PY" &&
      co.series !== "PL" &&
      Number.isInteger(co.index) &&
      (cells[co.index]?.current ?? 0) < 0,
  );
  const share = belowNeeded ? 0.5 : 1;
  let calloutHeadroom = Math.min(roomStep, roomMax * share);
  let calloutFootroom = belowNeeded ? Math.min(roomStep, roomMax * share) : 0;
  let placed = placeCallouts(calloutHeadroom, calloutFootroom);
  for (let retry = 0; retry < 2 && !allPlaced(placed.resolvedCallouts); retry++) {
    const head = Math.min(calloutHeadroom + roomStep, roomMax * share);
    const foot = belowNeeded ? Math.min(calloutFootroom + roomStep, roomMax * share) : 0;
    if (!(head > calloutHeadroom || foot > calloutFootroom)) break;
    calloutHeadroom = head;
    calloutFootroom = foot;
    placed = placeCallouts(calloutHeadroom, calloutFootroom);
  }
  const { calloutTexts, resolvedCallouts } = placed;
  const { plotTop, scaleBottom, y, zeroY } = scaleFor(calloutHeadroom, calloutFootroom);
  // Grow columns and lines up from the zero baseline on mount / data change.
  const yA = (v: number) => zeroY + (y(v) - zeroY) * grow;

  // Reference-line point sets (null where the period lacks the scenario).
  // Summary periods are excluded: the lines trace the run of periods, and a
  // total is not one - connecting December to "FY" would draw a spike into a
  // column that may not even share the scale.
  const pyPts = cells.map((c, i) =>
    c.PY != null && !c.summary ? { x: cxOf(i), y: yA(c.PY) } : null,
  );
  const plPts = cells.map((c, i) =>
    c.PL != null && !c.summary ? { x: cxOf(i), y: yA(c.PL) } : null,
  );

  /**
   * The classic axis-break glyph: a slanted blank band cut across a mark,
   * edged by two thin diagonals - the IBCS-legible way to say "drawn shorter
   * than its value; read the label". Rendered near the capped end of a column
   * (or variance bar) whose summary value exceeds the period scale.
   */
  const scaleBreak = (cx: number, w: number, yMid: number, tight = false) => {
    const x1 = cx - w / 2 - 3;
    const x2 = cx + w / 2 + 3;
    const slope = tight ? 2.5 : 3.5;
    const off = tight ? 2 : 2.5;
    return (
      <g data-scale-break="" opacity={grow}>
        <line
          x1={x1}
          y1={yMid + slope}
          x2={x2}
          y2={yMid - slope}
          stroke={tokens.color.surface}
          strokeWidth={tight ? 4 : 5}
        />
        <line
          x1={x1}
          y1={yMid + slope + off}
          x2={x2}
          y2={yMid - slope + off}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />
        <line
          x1={x1}
          y1={yMid + slope - off}
          x2={x2}
          y2={yMid - slope - off}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />
      </g>
    );
  };
  const toPath = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const varMid = plotBottom + gap + varH / 2;

  const noteLines = layoutNotes(calloutNotes(resolvedCallouts), width - padL * 2);
  const svgH = height + notesHeight(noteLines);

  // Built-in tooltip rows for the hovered period: current value, the comparison
  // value, and the signed Δ (impact-coloured), reusing the cell's variance.
  const renderTooltip = () => {
    const h = hover.hovered;
    if (!tooltip || !h) return null;
    const c = cells.find((cell) => cell.category === h.category);
    if (!c || c.current == null) return null;
    const exact = { ...format, compact: false };
    const rows: ChartTooltipRow[] = [
      { label: c.isForecast ? S.FC : S.AC, value: formatValue(c.current, exact), strong: true },
    ];
    const cmpVal = c[comparison];
    if (cmpVal != null && isFinite(cmpVal))
      rows.push({ label: cmpName, value: formatValue(cmpVal, exact) });
    const v = c.variance;
    if (v) {
      const color =
        v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
      const pct = v.pct != null ? ` (${formatPercent(v.pct, pctFmt)})` : "";
      rows.push({
        label: deltaHeading(words, cmpName),
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

  // Screen-reader data table: each period's current value, the references, and
  // the shown variance as a real <table>, so SR users read values, not the svg.
  const a11yColumns = [
    words.current,
    ...(showPyLine ? [S.PY] : []),
    ...(showPlLine ? [S.PL] : []),
    ...(showVariancePanel
      ? [deltaHeading(words, cmpName), deltaHeading(words, cmpName, true)]
      : []),
    ...(calloutTexts.size > 0 ? [words.note] : []),
  ];
  const a11yRows: ChartDataRow[] = cells.map((c, i) => {
    const cells_: Array<string | number> = [
      c.current != null ? formatValue(c.current, format) : na,
    ];
    if (showPyLine) cells_.push(c.PY != null ? formatValue(c.PY, format) : na);
    if (showPlLine) cells_.push(c.PL != null ? formatValue(c.PL, format) : na);
    if (showVariancePanel) {
      cells_.push(c.variance ? formatSigned(c.variance.abs, format) : na);
      cells_.push(c.variance ? formatPercent(c.variance.pct, pctFmt) : na);
    }
    if (calloutTexts.size > 0) cells_.push((calloutTexts.get(i) ?? []).join("; "));
    return { label: c.isForecast ? `${c.category} (${S.FC})` : c.category, cells: cells_ };
  });

  // Legend positions, right to left, from each word's estimated width (at least
  // the 14px a two-letter code takes, which reproduces the long-standing layout
  // exactly). Every slot is placed as if all three were shown, as before.
  const legendW = (s: string) => Math.max(14, estTextW(s, 10.5));
  const acSwatchX = -(legendW(S.AC) + 16);
  const pyTextX = acSwatchX - 14;
  const pyLineX2 = pyTextX - legendW(S.PY);
  const pyLineX1 = pyLineX2 - 16;
  const plTextX = pyLineX1 - 14;
  const plLineX2 = plTextX - legendW(S.PL);
  const plLineX1 = plLineX2 - 16;
  const legendReserve = -(showPlLine ? plLineX1 : showPyLine ? pyLineX1 : acSwatchX) + 6;

  return (
    <>
      <svg
        ref={ref}
        width={width}
        height={svgH}
        viewBox={`0 0 ${width} ${svgH}`}
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
                ? `${title}. Trend of ${n} periods, current series versus ${cmpName}, with a variance panel.`
                : `Trend of ${n} periods, current series versus ${cmpName}`))
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
            <line x1="0" y1="0" x2="0" y2="5" stroke={tokens.scenario.AC.fill} strokeWidth="1" />
          </pattern>
        </defs>
        {onSelect && <style>{SELECTABLE_MARK_CSS}</style>}

        {title && (
          <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
            {/* Clip so the title can't run under the top-right legend or off-canvas. */}
            {fitLabel(title, width - padL - padR - legendReserve, 13)}
          </text>
        )}

        {/* Legend, top-right */}
        <g
          transform={`translate(${width - padR}, ${title ? 16 : 14})`}
          fontSize={10.5}
          fill={tokens.color.textMuted}
        >
          <text x={0} y={0} textAnchor="end">
            {S.AC}
          </text>
          <rect x={acSwatchX} y={-8} width={10} height={9} fill={tokens.scenario.AC.fill} />
          {showPyLine && (
            <>
              <text x={pyTextX} y={0} textAnchor="end">
                {S.PY}
              </text>
              <line
                x1={pyLineX1}
                y1={-4}
                x2={pyLineX2}
                y2={-4}
                stroke={pyLineColor}
                strokeWidth={1.75}
              />
            </>
          )}
          {showPlLine && (
            <>
              <text x={plTextX} y={0} textAnchor="end">
                {S.PL}
              </text>
              <line
                x1={plLineX1}
                y1={-4}
                x2={plLineX2}
                y2={-4}
                stroke={plLineColor}
                strokeWidth={1.25}
                strokeDasharray="4 3"
              />
            </>
          )}
        </g>

        {/* Zero baseline */}
        <line
          x1={padL}
          y1={zeroY}
          x2={width - padR}
          y2={zeroY}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />

        {/* Callout leaders, beneath the columns and lines so every mark stays whole. */}
        <CalloutLeaders callouts={resolvedCallouts} tokens={tokens} />

        {/* Current-series columns */}
        {cells.map((c, i) => {
          // `cells` is `data.map(…)`, so the datum at this index always exists.
          const datum = data[i];
          if (c.current == null || !datum) return null;
          const cx = cxOf(i);
          const w = c.summary ? sumColW : colW;
          // Off-scale summaries cap at the plot edge - the break glyph and the
          // value label carry the magnitude; everything else follows the
          // shared period scale.
          const targetTop = c.offScale ? (c.current >= 0 ? plotTop : scaleBottom) : y(c.current);
          const top = zeroY + (targetTop - zeroY) * grow;
          const h = Math.abs(top - zeroY);
          const colY = c.current >= 0 ? top : zeroY;
          const fill = c.summary
            ? tokens.color.total
            : c.isForecast
              ? `url(#${hatchId})`
              : tokens.scenario.AC.fill;
          const info = {
            category: c.category,
            scenario: (c.isForecast ? "FC" : "AC") as ScenarioKey,
            value: c.current as number,
            datum,
          };
          // The visible marks of this period, in FINAL (un-animated) geometry:
          // the current-series column plus, when the panel is on, its variance
          // lane strip. The reference LINES (PY/PL) are not this period's marks.
          const yCur = targetTop;
          const markRects: MarkRect[] = [
            {
              x: cx - w / 2,
              y: Math.min(zeroY, yCur),
              width: w,
              height: Math.abs(yCur - zeroY),
            },
          ];
          if (showVariancePanel && c.variance)
            markRects.push({ x: cx - w / 2, y: varMid - varH / 2, width: w, height: varH });
          return (
            <g
              key={`col-${c.category}`}
              {...selectableMarkProps(
                onSelect ? () => onSelect(info) : undefined,
                fillLabel(words.selectMark, {
                  label: c.category,
                  value: `${S[info.scenario]} ${formatValue(info.value, format)}`,
                }),
              )}
              {...marks.forMark(info, markRects)}
              style={onSelect ? { cursor: "pointer" } : undefined}
            >
              {/* Transparent full-band hit target so the whole period is click/hover-able */}
              {(onSelect || hoverEnabled) && (
                <rect
                  x={cxOf(i) - band / 2}
                  y={padT}
                  width={band}
                  height={height - padT}
                  fill="transparent"
                />
              )}
              {/* Summary period divider, set off from the running months */}
              {c.summary && (
                <line
                  x1={cxOf(i) - band / 2}
                  y1={padT}
                  x2={cxOf(i) - band / 2}
                  y2={plotBottom}
                  stroke={tokens.color.gridline}
                  strokeWidth={1}
                />
              )}
              <rect x={cx - w / 2} y={colY} width={w} height={Math.max(h, 0.5)} fill={fill} />
              {/* Off-scale summary: the marked break, near the capped end */}
              {c.offScale &&
                h > 26 &&
                scaleBreak(cx, w, c.current >= 0 ? colY + 12 : colY + h - 12)}
              {/* Forecast columns get a thin outline so the hatch reads as a bar */}
              {c.isForecast && !c.summary && (
                <rect
                  x={cx - w / 2}
                  y={colY}
                  width={w}
                  height={Math.max(h, 0.5)}
                  fill="none"
                  stroke={tokens.scenario.AC.stroke}
                  strokeWidth={0.75}
                />
              )}
              {showValueLabels &&
                (() => {
                  const s = formatValue(c.current, format);
                  const lw = estTextW(s, 9);
                  // Skip when wider than the band (would overlap a neighbour); nudge
                  // inward at the edges so it never spills past the SVG.
                  if (lw > band - 1) return null;
                  const lx = clampTo(cx, padL + lw / 2, width - padR - lw / 2);
                  // Always just above the bar's top edge (above the zero line for
                  // negatives) so it never drops into the variance band below.
                  return (
                    <text
                      x={lx}
                      y={Math.min(zeroY, top) - 4}
                      fontSize={9}
                      fill={tokens.color.text}
                      textAnchor="middle"
                    >
                      {s}
                    </text>
                  );
                })()}
            </g>
          );
        })}

        {/* PL (plan) reference line - dashed, "not real yet" */}
        {showPlLine &&
          segments(plPts).map((seg, si) => (
            <path
              key={`pl-${si}`}
              d={toPath(seg)}
              fill="none"
              stroke={plLineColor}
              strokeWidth={1.25}
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />
          ))}

        {/* PY reference line + dots - "the past" */}
        {showPyLine && (
          <>
            {segments(pyPts).map((seg, si) => (
              <path
                key={`py-${si}`}
                d={toPath(seg)}
                fill="none"
                stroke={pyLineColor}
                strokeWidth={1.75}
                strokeLinejoin="round"
              />
            ))}
            {pyPts.map((p, i) =>
              p ? <circle key={`pyd-${i}`} cx={p.x} cy={p.y} r={2.2} fill={pyLineColor} /> : null,
            )}
          </>
        )}

        {/* Callouts: their dots, their labels, and the numbers of those written as notes. */}
        {resolvedCallouts.length > 0 && (
          <CalloutMarks callouts={resolvedCallouts} tokens={tokens} />
        )}

        {/* Period labels */}
        {cells.map((c, i) => (
          <text
            key={`lab-${c.category}`}
            x={cxOf(i)}
            y={height - 6}
            fontSize={10.5}
            fontWeight={c.summary ? 600 : 400}
            fill={c.summary ? tokens.color.text : tokens.color.textMuted}
            textAnchor="middle"
          >
            {fitLabel(c.category, band - 1, 10.5)}
          </text>
        ))}

        {/* Variance panel: current vs comparison, colored by favorability */}
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
            {cells.map((c, i) => {
              const v = c.variance;
              if (!v) return null;
              const cx = cxOf(i);
              const val = variance === "pct" ? (v.pct ?? 0) : v.abs;
              // A summary's Δ is excluded from the panel scale for the same
              // reason its value is excluded from the period scale - cap it
              // and mark the break; the label still states the real figure.
              const overVar = c.summary && Math.abs(val) > varMax;
              const h = (overVar ? 1 : Math.abs(val) / varMax) * (varH / 2) * grow;
              const color =
                val === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
              const up = val >= 0;
              const label =
                variance === "pct" ? formatPercent(v.pct, pctFmt) : formatSigned(v.abs, format);
              const w = c.summary ? sumColW : colW;
              return (
                <g key={`var-${c.category}`} opacity={c.isForecast ? 0.6 : 1}>
                  <rect
                    x={cx - w / 2}
                    y={up ? varMid - h : varMid}
                    width={w}
                    height={Math.max(h, 1)}
                    fill={color}
                  />
                  {overVar &&
                    h > 14 &&
                    scaleBreak(cx, w, up ? varMid - h + 8 : varMid + h - 8, true)}
                  {estTextW(label, 9) <= band - 1 && (
                    <text
                      x={clampTo(
                        cx,
                        padL + estTextW(label, 9) / 2,
                        width - padR - estTextW(label, 9) / 2,
                      )}
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

        {/* The callouts that found no place beside their periods, by number. */}
        <NoteList lines={noteLines} x={padL} y={height} tokens={tokens} />
      </svg>
      <ChartDataTable
        caption={
          ariaLabel ?? (title ? `${title} - data table` : `Trend versus ${cmpName} - data table`)
        }
        columns={a11yColumns}
        rows={a11yRows}
      />
      {renderTooltip()}
    </>
  );
});
