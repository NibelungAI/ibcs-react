import { forwardRef, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import {
  deltaHeading,
  endLabelText,
  scenarioHeadings,
  type IbcsLabelsOverride,
} from "../core/labels";
import {
  computeLines,
  splitForecast,
  type LineDatum,
  type LinePoint,
  type LineSeries,
} from "../core/lineArea";
import {
  resolveReferences,
  type ReferenceLine,
  type ReferenceBand,
  type ResolvedReference,
} from "../core/reference";
import { bandScale, resolveBandPadding, type BandPadding } from "../core/bandScale";
import {
  formatPercent,
  formatSigned,
  formatValue,
  notAvailableOf,
  percentFormatOf,
  type FormatOptions,
} from "../core/format";
import { calloutSides, type PointCallout } from "../core/callout";
import { fanRuns, type FanBand } from "../core/fan";
import { fillLabel } from "../core/labels";
import type { PlacementBox, PlacementSegment } from "../core/labelPlacement";
import { useMountGrow, useDataTween } from "./hooks";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens, useResolvedLabels } from "./theme";
import {
  CALLOUT_FONT,
  CALLOUT_LINE_H,
  CalloutLeaders,
  CalloutMarks,
  calloutNotes,
  dotBox,
  resolveCallouts,
  type CalloutSpec,
} from "./internal/callouts";
import { NoteList, layoutNotes, notesHeight } from "./internal/notes";
import { wrapText } from "./internal/text";
import { rangeFormat } from "./internal/rangeFormat";

export type { LineDatum } from "../core/lineArea";
export type { Reference, ReferenceLine, ReferenceBand } from "../core/reference";
export type { PointCallout } from "../core/callout";
export type { FanBand } from "../core/fan";

/**
 * At or below this many points per series, point markers are drawn (IBCS asks
 * for markers so a line reads as a connector, not a continuous measurement).
 * Above it, markers are omitted so hundreds of points stay one cheap `<path>`.
 */
export const MARKER_DENSITY_THRESHOLD = 40;

/** Opacity of a fan band's fill: faint, so the lines and a nested band read over it. */
const FAN_OPACITY = 0.2;

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
  /**
   * Labelled points (GTM p. 4): each names a period and a series, and its
   * text - "\n" for a new line - is written beside the point, marked with a
   * dot. Labels are placed clear of every line, marker and other label: right
   * beside the point (above a peak, below a trough), else moved away with a
   * leader; the plot keeps room above its highest point for them. A callout
   * with no room anywhere is numbered at its point and written under the
   * chart (the svg grows by that list). A callout on a period where its
   * series draws no point - no value there, or the series is not drawn - is
   * written under the chart too, after the name of its period ("b: On the
   * gap"). So none on a period is left out, and the screen-reader table
   * carries each one's text in its period's row (`labels.note`). An `index`
   * that names no period (-1, 1.5, past the end) is ignored.
   */
  callouts?: PointCallout[];
  /**
   * Bands whose edges vary along x - a fan: e.g. the 10th to the 90th
   * percentile at every moment - drawn faint beneath the lines, in the order
   * given (a later band over an earlier one). Each edge is a value per
   * period, aligned with `data`; a gap breaks the band. The value axis grows
   * to hold them. A band's `label` is placed beside its right end like a
   * callout and names its column of the screen-reader table (`labels.band`,
   * "Band {n}", without one).
   */
  fans?: FanBand[];
  width?: number;
  /**
   * Height in px. Default 360. A chart whose callouts could not all be placed
   * beside their points grows by the list of their notes.
   */
  height?: number;
  /**
   * Horizontal point spacing - the lead-in/out gutter at the plot edges. Omit
   * for the centred default; pass `{ outer: 0 }` to anchor the first/last points
   * to the edges so the series fills the plot width (no side whitespace).
   */
  bandPadding?: BandPadding;
  /**
   * Number formatting (`fractionDigits` for exact decimals); the variance
   * panel's Δ% labels follow its `locale` and `percentFractionDigits`.
   */
  format?: FormatOptions;
  /**
   * Per-series number formatting, keyed by scenario, for a series' own values
   * (its end label and its column of the screen-reader table) - e.g.
   * `{ AC: { fractionDigits: 2 } }`. An entry is merged over `format`, so it
   * keeps the chart's `locale`, `suffix` and the rest unless it sets them. A
   * series without an entry uses `format`; the variance panel always uses
   * `format`.
   */
  seriesFormat?: Partial<Record<ScenarioKey, FormatOptions>>;
  tokens?: IbcsTokensOverride;
  /**
   * The chart's own words - the scenario codes of the end labels ("AC 150")
   * and table headers - merged onto `IbcsThemeProvider`'s. `{ endLabel:
   * "{value}" }` labels the line "150" and keeps the code in the table's
   * header; an empty scenario word drops it from the end label too, and the
   * header then falls back to the scenario's `scenarioTitle`. See `IbcsLabels`.
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
    callouts,
    fans,
    width = 720,
    height = 360,
    bandPadding,
    format = {},
    seriesFormat,
    tokens: tokenOverride,
    labels,
    title,
    ariaLabel,
    className,
    style,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const words = useResolvedLabels(labels);
  /** A series' own number format: its `seriesFormat` entry merged over the chart's. */
  const formatOf = (scenario: ScenarioKey): FormatOptions => {
    const own = seriesFormat?.[scenario];
    return own ? { ...format, ...own } : format;
  };
  const pctFmt = percentFormatOf(format);
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

  // Fans widen the value axis to hold their edges; without fans the axis is
  // the lines' alone, as before.
  const fanList = fans ?? [];
  const fanPoints = fanList.map((f) => fanRuns(f, categories.length));
  let scaleMin = domainMin;
  let scaleMax = domainMax;
  for (const runs of fanPoints) {
    for (const run of runs) {
      for (const p of run) {
        if (p.low < scaleMin) scaleMin = p.low;
        if (p.high > scaleMax) scaleMax = p.high;
      }
    }
  }

  // Each callout's point: its series' value at its period - undefined for a
  // callout that names no period, null where its series draws no point.
  const seriesValues = new Map(
    lines.map((s) => [s.scenario, new Map(s.points.map((p) => [p.index, p.value]))]),
  );
  const calloutPoints = (callouts ?? []).map((c) => {
    if (!c || !Number.isInteger(c.index) || c.index < 0 || c.index >= categories.length) {
      return undefined;
    }
    const s =
      c.series != null
        ? lines.find((l) => l.scenario === c.series)
        : (lines.find((l) => l.scenario === "AC") ?? lines[0]);
    const values = s ? seriesValues.get(s.scenario) : undefined;
    const v = values?.get(c.index);
    return s && values && v != null ? { s, values, v } : null;
  });

  // Callouts and fan captions, as lines of text: the plot keeps room above its
  // highest point for the tallest of those beside a point (without any, it
  // keeps none).
  const calloutMaxW = Math.max(60, Math.min(180, innerW * 0.6));
  const calloutLines = (callouts ?? []).map((c) =>
    c && typeof c.label === "string" && c.label.trim() !== ""
      ? wrapText(c.label, calloutMaxW, CALLOUT_FONT, textWidthPx)
      : null,
  );
  const captionLines = fanList.map((f) =>
    f?.label ? wrapText(f.label, calloutMaxW, CALLOUT_FONT, textWidthPx) : null,
  );
  const tallest = [
    ...calloutLines.filter((_, ci) => calloutPoints[ci] != null),
    ...captionLines,
  ].reduce((h, ls) => (ls ? Math.max(h, ls.length * CALLOUT_LINE_H) : h), 0);
  const headroom = tallest > 0 ? Math.min(tallest + 12, topH * 0.4) : 0;
  const scaleH = topH - headroom;

  const vRange = scaleMax - scaleMin || 1;
  const y = (v: number) => plotBottom - ((v - scaleMin) / vRange) * scaleH;
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

  // Where each end label and reference caption is written - shared by their
  // drawing and by the callouts, which keep clear of them.
  const endLabelOf = (e: (typeof endLabels)[number]) => {
    const text = endLabelText(
      words,
      words.scenario[e.scenario],
      formatValue(e.point.value, formatOf(e.scenario)),
    );
    // Clamp x so a wide value label never spills past the right edge.
    const estW = textWidthPx(text, 10);
    const tx = Math.max(padL, Math.min(x(e.point.index) + 6, width - 2 - estW));
    return { text, tx, estW };
  };
  const refCaptionOf = (r: ResolvedReference) => {
    if (!r.label) return null;
    const left = padL;
    const right = width - padR;
    // Horizontal annotation (axis "y"): caption pinned to the left edge,
    // just above the line / inside the band top, clamped vertically.
    if (r.axis === "y") {
      const anchorY = r.kind === "line" ? r.y1 - 3 : r.y + 10;
      const ty = Math.min(Math.max(anchorY, padT + 9), plotBottom - 2);
      return {
        x: left + 2,
        y: ty,
        anchor: "start" as const,
        text: fitText(r.label, innerW - 4, 9.5),
      };
    }
    // Vertical annotation (axis "x"): caption centered on the line /
    // band, near the top, clamped horizontally inside the plot.
    const fitted = fitText(r.label, innerW - 4, 9.5);
    const estW = textWidthPx(fitted, 9.5);
    const center = r.kind === "line" ? r.x1 : r.x + r.width / 2;
    const tx = Math.min(Math.max(center, left + estW / 2 + 1), right - estW / 2 - 1);
    return { x: tx, y: padT + 9, anchor: "middle" as const, text: fitted };
  };

  // --- callouts and fan captions: placed clear of everything else ------------
  const calloutSpecs: CalloutSpec[] = [];
  const calloutTexts = new Map<number, string[]>();
  (callouts ?? []).forEach((c, ci) => {
    const textLines = calloutLines[ci];
    const point = calloutPoints[ci];
    if (!c || !textLines || point === undefined) return;
    const note = c.label
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .join(", ");
    const where = categories[c.index]!;
    // The table carries every callout on a period, its point drawn or not.
    calloutTexts.set(c.index, [...(calloutTexts.get(c.index) ?? []), note]);
    if (point === null) {
      calloutSpecs.push({
        x: x(c.index),
        y: plotBottom,
        lines: textLines,
        sides: [],
        dot: null,
        note,
        where,
        drawn: false,
      });
      return;
    }
    const { s, values, v } = point;
    calloutSpecs.push({
      x: x(c.index),
      y: y(v),
      lines: textLines,
      sides: calloutSides(v, values.get(c.index - 1), values.get(c.index + 1), c.placement),
      dot: lineStyle(s.scenario, tokens).stroke,
      note,
      where,
    });
  });
  fanList.forEach((f, fi) => {
    const textLines = captionLines[fi];
    const runs = fanPoints[fi] ?? [];
    const lastRun = runs[runs.length - 1];
    const p = lastRun?.[lastRun.length - 1];
    if (!textLines || !p) return;
    // The band's right end: its caption goes above or below it, never inside.
    const yHi = y(p.high);
    const yLo = y(p.low);
    calloutSpecs.push({
      x: x(p.index),
      y: (yHi + yLo) / 2,
      lines: textLines,
      sides: ["above", "below"],
      dot: null,
      edge: (yLo - yHi) / 2,
      note: f.label!.trim(),
      where: categories[p.index] ?? String(p.index + 1),
    });
  });
  const resolvedCallouts = (() => {
    if (calloutSpecs.length === 0) return [];
    const segments: PlacementSegment[] = [];
    for (const s of lines) {
      const pad = lineStyle(s.scenario, tokens).width / 2;
      for (let k = 1; k < s.points.length; k++) {
        const a = s.points[k - 1]!;
        const b = s.points[k]!;
        if (b.index !== a.index + 1) continue;
        segments.push({ x1: x(a.index), y1: y(a.value), x2: x(b.index), y2: y(b.value), pad });
      }
    }
    segments.push({ x1: padL, y1: zeroY, x2: width - padR, y2: zeroY, pad: 0.5 });
    for (const r of resolvedRefs) {
      if (r.kind === "line") segments.push({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, pad: 0.5 });
    }
    const boxes: PlacementBox[] = [];
    if (markers) {
      for (const s of lines) {
        for (const p of s.points) {
          const px = x(p.index);
          const py = y(p.value);
          boxes.push({ left: px - 3.2, top: py - 3.2, right: px + 3.2, bottom: py + 3.2 });
        }
      }
    }
    for (const e of endLabels) {
      const { tx, estW } = endLabelOf(e);
      boxes.push({ left: tx, top: e.y + 3.5 - 8, right: tx + estW, bottom: e.y + 3.5 + 2.5 });
    }
    for (const r of resolvedRefs) {
      const c = refCaptionOf(r);
      if (!c) continue;
      const w = textWidthPx(c.text, 9.5);
      const left = c.anchor === "start" ? c.x : c.x - w / 2;
      boxes.push({ left, top: c.y - 7.6, right: left + w, bottom: c.y + 2.4 });
    }
    for (const s of calloutSpecs) if (s.dot) boxes.push(dotBox(s.x, s.y));
    return resolveCallouts(
      calloutSpecs,
      { boxes, segments },
      { left: padL, top: padT, right: width - 2, bottom: plotBottom },
      textWidthPx,
    );
  })();
  const noteLines = layoutNotes(calloutNotes(resolvedCallouts), width - padL * 2);
  const svgH = height + notesHeight(noteLines);

  // Screen-reader data table: each period's value per scenario, plus the shown
  // variance - so SR users read the actual numbers, not the decorative svg.
  const hasVarTable = showVariancePanel && variancePoints.length > 0;
  // Headers never go blank: an empty word falls back to the scenario's title.
  const S = scenarioHeadings(words);
  const comparisonName = S[comparison];
  // A fan's column is its label, else "Band {n}"; the callouts' column follows.
  const fanColumns = fanList.map((f, i) => f?.label || fillLabel(words.band, { n: i + 1 }));
  const hasNotes = calloutTexts.size > 0;
  const a11yColumns = [
    ...lines.map((s) => S[s.scenario]),
    ...(hasVarTable
      ? [deltaHeading(words, comparisonName), deltaHeading(words, comparisonName, true)]
      : []),
    ...fanColumns,
    ...(hasNotes ? [words.note] : []),
  ];
  const lineByIndex = lines.map((s) => new Map(s.points.map((p) => [p.index, p.value])));
  const varByIndex = new Map(variancePoints.map((vp) => [vp.index, vp.variance]));
  const fanByIndex = fanPoints.map((runs) => new Map(runs.flat().map((p) => [p.index, p])));
  // A band's two ends never read alike ("1.4K–1.4K"): in full unless the
  // caller asks for compact, at the digits of the narrowest band.
  const fanFmt = rangeFormat(format, fanPoints.flat(2));
  const na = notAvailableOf(format);
  const a11yRows: ChartDataRow[] = categories.map((c, i) => {
    const cells: Array<string | number> = lineByIndex.map((byIndex, si) => {
      const val = byIndex.get(i);
      const fmt = formatOf(lines[si]!.scenario);
      return val != null ? formatValue(val, fmt) : notAvailableOf(fmt);
    });
    if (hasVarTable) {
      const v = varByIndex.get(i);
      cells.push(v ? formatSigned(v.abs, format) : na);
      cells.push(v ? formatPercent(v.pct, pctFmt) : na);
    }
    for (const byIndex of fanByIndex) {
      const p = byIndex.get(i);
      cells.push(p ? `${formatValue(p.low, fanFmt)}–${formatValue(p.high, fanFmt)}` : na);
    }
    if (hasNotes) cells.push((calloutTexts.get(i) ?? []).join("; "));
    return { label: c, cells };
  });

  return (
    <>
      <svg
        ref={ref}
        width={width}
        height={svgH}
        viewBox={`0 0 ${width} ${svgH}`}
        className={className}
        // A single labelled image - no `aria-hidden`, which would cancel the
        // label out and leave assistive tech with nothing but the sr-only table.
        role="img"
        aria-label={
          ariaLabel ??
          (title
            ? `${title}. Line chart of ${n} periods across ${lines.length} series.`
            : `Line chart of ${n} periods across ${lines.length} series`)
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

        {/* Fans - bands whose edges vary along x - faint, beneath everything,
          so the baseline, the references and the lines read over them. */}
        {fanPoints.some((runs) => runs.length > 0) && (
          <g>
            {fanPoints.flatMap((runs, fi) =>
              runs.map((run, ri) => {
                const color = fanList[fi]?.color ?? tokens.color.axis;
                if (run.length === 1) {
                  // One period between gaps: a narrow strip, so it still shows.
                  const p = run[0]!;
                  const w = Math.min(4, band / 2);
                  return (
                    <rect
                      key={`fan-${fi}-${ri}`}
                      x={x(p.index) - w / 2}
                      y={yA(p.high)}
                      width={w}
                      height={Math.max(yA(p.low) - yA(p.high), 0.5)}
                      fill={color}
                      opacity={FAN_OPACITY}
                    />
                  );
                }
                const upper = run
                  .map(
                    (p, k) =>
                      `${k === 0 ? "M" : "L"}${x(p.index).toFixed(1)},${yA(p.high).toFixed(1)}`,
                  )
                  .join(" ");
                const lower = [...run]
                  .reverse()
                  .map((p) => `L${x(p.index).toFixed(1)},${yA(p.low).toFixed(1)}`)
                  .join(" ");
                return (
                  <path
                    key={`fan-${fi}-${ri}`}
                    d={`${upper} ${lower} Z`}
                    fill={color}
                    opacity={FAN_OPACITY}
                  />
                );
              }),
            )}
          </g>
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
              const caption = refCaptionOf(r);
              if (!caption) return null;
              return (
                <text
                  key={`reft-${i}`}
                  x={caption.x}
                  y={caption.y}
                  fontSize={9.5}
                  fill={r.color ?? tokens.color.textMuted}
                  textAnchor={caption.anchor}
                >
                  {caption.text}
                </text>
              );
            })}
          </g>
        )}

        {/* Callout leaders, beneath the lines so every line stays whole. */}
        <CalloutLeaders callouts={resolvedCallouts} tokens={tokens} />

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
          const { text, tx } = endLabelOf(e);
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
              {text}
            </text>
          );
        })}

        {/* Callouts: their dots, their labels, and the numbers of those written as notes. */}
        {resolvedCallouts.length > 0 && (
          <CalloutMarks callouts={resolvedCallouts} tokens={tokens} />
        )}

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
              {fitText(
                c,
                // A thinned label takes the room of the periods it stands for,
                // and never reaches past the chart's left or right edge.
                labelStep > 1
                  ? Math.min(band * labelStep - 2, 2 * x(i) - 2, 2 * (width - x(i)) - 2)
                  : band,
                10.5,
              )}
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
                varianceMode === "pct" ? formatPercent(v.pct, pctFmt) : formatSigned(v.abs, format);
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

        {/* The callouts that found no place beside their points, by number. */}
        <NoteList lines={noteLines} x={padL} y={height} tokens={tokens} />
      </svg>
      <ChartDataTable
        caption={
          ariaLabel ??
          (title ? `${title} - data table` : `Line chart of ${lines.length} series - data table`)
        }
        columns={a11yColumns}
        rows={a11yRows}
      />
    </>
  );
});
