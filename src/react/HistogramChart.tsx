import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { fillLabel, type IbcsLabelsOverride } from "../core/labels";
import {
  computeHistogram,
  histogramBinList,
  histogramEdge,
  resolveHistogramBins,
  type HistogramBin,
  type HistogramBins,
  type HistogramMean,
  type HistogramOptions,
  type HistogramSpread,
} from "../core/histogram";
import {
  formatInterval,
  formatPercent,
  formatValue,
  type FormatOptions,
  type PercentFormatOptions,
} from "../core/format";
import { halfWidthOf } from "../core/errorBar";
import { resolveValueBand } from "../core/reference";
import { ErrorBar } from "./ErrorBar";
import { useChartHover, useDataTween, useMountGrow } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsLabels, useIbcsTokens } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";
import { VALUE_BAND_OPACITY } from "./internal/valueBand";

export type {
  HistogramBin,
  HistogramBins,
  HistogramMean,
  HistogramOptions,
  HistogramSpread,
} from "../core/histogram";

export interface HistogramChartProps {
  /**
   * The values to count - e.g. a simulation's DPS per iteration. Binned by
   * `computeHistogram` (`binning`); non-finite values are left out. Ignored
   * when `bins` is given.
   */
  values?: readonly number[];
  /**
   * Classes counted elsewhere - an engine's own: a start, one width and the
   * counts, so every class has the same width. Wins over `values`.
   */
  bins?: HistogramBins;
  /** How `values` are binned: `bins`, or the rule's `minBins` / `maxBins` (default 20 to 60). */
  binning?: HistogramOptions;
  /**
   * The mean, alone or with the half-width of its interval and that
   * interval's level, as you computed them (the chart never derives an
   * interval). Drawn as a line from its label above the columns down to the
   * top of the class it falls in, with a tick under the axis; its interval as
   * an error bar on that line, labelled "Mean 910.8 ± 0.9 (95%)"
   * (`labels.mean`). A half-width without a level between 0 and 1 is not
   * drawn: the mean is then written alone.
   */
  mean?: HistogramMean;
  /**
   * A range of the values, drawn as a band behind the columns with a bracket
   * and a caption under the axis ("Middle half 890.0–931.0", `labels.spread`).
   * Default: the middle half of `values`, from the first to the third quartile;
   * with `bins`, none unless given. `false` draws none. A spread of your own
   * (say the 10th to the 90th percentile) takes its own caption: its `label`,
   * or `labels.spread`.
   */
  spread?: HistogramSpread | false;
  /**
   * The IBCS notation of the columns: AC solid (default), PY grey, PL
   * outlined, FC hatched - e.g. FC for a forecast distribution.
   */
  scenario?: ScenarioKey;
  /** Width in px. Default 560. */
  width?: number;
  /**
   * Height in px. Default 300. Never less than the chart's rows need (about
   * 154 px with a title, a mean and a spread); the svg grows to that.
   */
  height?: number;
  /**
   * Number formatting of the values - the class edges, the mean and its
   * interval, the spread - and their `locale`. With `fractionDigits`, values
   * are written at those digits. Without it they are written in full (never
   * compact), at the digits that keep two adjacent class edges apart, and the
   * mean's interval at two significant figures of its half-width. Counts are
   * whole numbers and shares percentages (`percentFractionDigits`, default 1),
   * both in the same `locale`.
   */
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  /**
   * The chart's own words - `mean`, `spread`, `sampleSize` ("n = {n}"),
   * `count` and `share` - merged onto `IbcsThemeProvider`'s. See `IbcsLabels`.
   */
  labels?: IbcsLabelsOverride;
  title?: string;
  /**
   * The chart's accessible name, in place of the generated English
   * description; also the caption of its screen-reader table, before the
   * mean, the spread and n.
   */
  ariaLabel?: string;
  /** Class name for the chart's `<svg>`. */
  className?: string;
  /** Inline style merged over the `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
  /**
   * Show the built-in tooltip on a class (its range, count and share).
   * Default true; set false to opt out (e.g. when wiring your own via
   * `onHover`).
   */
  tooltip?: boolean;
  /** Fired as the pointer moves over / leaves a class (`null` on leave) - for a custom tooltip. */
  onHover?: (hover: ChartHover<HistogramBin> | null) => void;
}

/* Rows of the chart, top to bottom (px). */
/** The title line: the title on the left, n on the right. */
const HEADER_H = 26;
/** The top margin when there is no title line. */
const TOP_PAD = 8;
/** The mean's row: its label, then its error bar. */
const MEAN_H = 30;
/** The row for the tallest column's count label. */
const COUNT_H = 14;
/** The plot's least height. */
const MIN_PLOT_H = 40;
/** The edge labels under the axis. */
const EDGE_H = 16;
/** The spread's bracket and caption under the edge labels. */
const SPREAD_H = 24;
const PAD_B = 4;
const PAD_X = 12;
/** The drawn width of the single class of a histogram whose values are all equal. */
const SPIKE_W = 24;

const FONT_TITLE = 13;
const FONT_LABEL = 11;
const FONT_EDGE = 10.5;
const FONT_COUNT = 9.5;

/** The clear space (px) the mean's line keeps around a count label it would cross. */
const LABEL_CLEARANCE = 2;

/** The parts of the vertical span [y0, y1] outside the `gaps` (each [top, bottom]), top to bottom. */
function lineSegments(
  y0: number,
  y1: number,
  gaps: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let from = y0;
  for (const [top, bottom] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (bottom <= from || top >= y1) continue;
    if (top > from) out.push([from, top]);
    from = Math.max(from, bottom);
  }
  if (from < y1) out.push([from, y1]);
  return out;
}

/**
 * The fraction digits that keep two adjacent class edges apart when written:
 * one decimal place past the width's first significant digit (4.75 → 1,
 * 10 → 0, 0.12 → 2), from 0 to 20. None for a width of 0 (one class).
 */
function edgeDigits(width: number): number | undefined {
  if (!(width > 0) || !Number.isFinite(width)) return undefined;
  return Math.min(20, Math.max(0, Math.ceil(-Math.log10(width)) + 1));
}

/** The length of the tick that marks the mean under the axis (px), from 2 px below it. */
const MEAN_TICK = 4;

/** The fewest fraction digits that write an interval's level exactly (0.95 → 0, 0.995 → 1), at most 2. */
function levelDigits(level: number): number {
  for (let d = 0; d < 2; d++) {
    const scaled = level * 100 * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return d;
  }
  return 2;
}

/**
 * HistogramChart - a distribution as columns of classes of identical width
 * (IBCS CH 1.3) on a horizontal value axis, the exception IBCS makes for
 * statistical distributions (UN 3.4).
 *
 * Two ranges are drawn apart so they cannot be confused: the **mean's
 * interval** - how well the average is known - as an error bar above the
 * columns, labelled "Mean 910.8 ± 0.9 (95%)", with a line down to the top of
 * the class the mean falls in and a tick under the axis; and the **spread of
 * the values** - how much single values vary - as a band behind the columns,
 * bracketed and captioned under the axis, "Middle half 890.0–931.0". n is
 * written on the title line. The mean's line never crosses a column, so every
 * class keeps one whole width (CH 1.3).
 *
 * Labels replace grid lines and a count axis: every column's count where all
 * fit above their columns, else the tallest column's alone; the class edges at
 * the two ends of the axis (the last one left out when both do not fit, and an
 * edge label beside the mean's tick left out too). Every kind of label has a
 * row of its own, and the mean's line pauses at a count label it would cross.
 *
 * Feed it raw `values` (binned by `computeHistogram`: the Freedman-Diaconis
 * rule bounded to 20-60 classes, counts summing to n, edges covering the
 * smallest to the largest value) or an engine's own `bins`. Words come from
 * `labels`, numbers from `format`. Pure SVG, SSR-safe; a screen-reader table
 * lists every class with its count and share, and its caption carries the
 * mean, the spread and n.
 */
export const HistogramChart = forwardRef<SVGSVGElement, HistogramChartProps>(
  function HistogramChart(
    {
      values,
      bins: binsProp,
      binning,
      mean,
      spread: spreadProp,
      scenario = "AC",
      width = 560,
      height = 300,
      format = {},
      tokens: tokenOverride,
      labels,
      title,
      ariaLabel,
      className,
      style,
      tooltip = true,
      onHover,
    },
    ref,
  ) {
    const tokens = useIbcsTokens(tokenOverride);
    const words = useIbcsLabels(labels);
    const hatchId = svgSafeId(useId());
    const hover = useChartHover<HistogramBin>();
    const marks = markInteraction(hover, tooltip, onHover);

    // Binning sorts the values, so it runs once per change of the values or
    // the options, not per render; caller bins skip it.
    const fixedBins = binning?.bins;
    const minBins = binning?.minBins;
    const maxBins = binning?.maxBins;
    const computed = useMemo(
      () =>
        binsProp ? null : computeHistogram(values ?? [], { bins: fixedBins, minBins, maxBins }),
      [binsProp, values, fixedBins, minBins, maxBins],
    );
    const target = useMemo(() => resolveHistogramBins(binsProp ?? computed), [binsProp, computed]);
    // Geometry follows the tweened classes (a live update glides); every
    // number written comes from the target.
    const live = useDataTween(target);
    const grow = useMountGrow(650, 0, live);
    const shown = live ?? target;
    const classes = target ? histogramBinList(target) : [];
    const k = classes.length;
    const n = target?.n ?? 0;

    // --- numbers and words ---------------------------------------------------
    const countFmt: FormatOptions = {
      compact: false,
      fractionDigits: 0,
      locale: format.locale,
      notAvailable: format.notAvailable,
    };
    const shareFmt: PercentFormatOptions = {
      fractionDigits: format.percentFractionDigits ?? 1,
      locale: format.locale,
      signDisplay: "auto",
      notAvailable: format.notAvailable,
    };
    const single = target != null && target.width === 0;
    // Values - edges, class ranges, the spread, a mean without an interval -
    // at the caller's exact digits, else in full at the digits that keep two
    // adjacent edges apart: compact "1.3K–1.3K" would name different classes
    // alike.
    const exact = Number.isFinite(format.fractionDigits);
    const valueFmt: FormatOptions = exact
      ? format
      : { ...format, compact: false, fractionDigits: edgeDigits(target?.width ?? 0) };
    const value = (v: number) => formatValue(v, valueFmt);
    const rangeText = (b: HistogramBin) =>
      single ? value(b.from) : `${value(b.from)}–${value(b.to)}`;
    const countText = (c: number) => formatValue(c, countFmt);
    const shareText = (c: number) => formatPercent(n > 0 ? c / n : null, shareFmt);

    // An interval is drawn only with its level, so it always says what it is
    // ("± 0.9" alone reads like a standard deviation).
    const meanOk = mean != null && Number.isFinite(mean.value);
    const level = mean?.level;
    const levelOk = level != null && level > 0 && level < 1;
    const meanHalf = meanOk && levelOk ? halfWidthOf(mean!.halfWidth) : undefined;
    const levelText =
      meanHalf != null
        ? formatPercent(level!, {
            fractionDigits: levelDigits(level!),
            locale: format.locale,
            signDisplay: "auto",
          })
        : "";
    const meanInterval = meanOk
      ? meanHalf != null
        ? formatInterval(mean!.value, meanHalf, format)
        : formatValue(mean!.value, valueFmt)
      : "";
    const meanText = meanOk
      ? fillLabel(words.mean, {
          value: levelText ? `${meanInterval} (${levelText})` : meanInterval,
        })
      : "";

    const spread: HistogramSpread | null =
      spreadProp === false
        ? null
        : spreadProp
          ? Number.isFinite(spreadProp.from) && Number.isFinite(spreadProp.to)
            ? spreadProp
            : null
          : computed && computed.n > 0
            ? { from: computed.q1, to: computed.q3 }
            : null;
    const spreadLo = spread ? Math.min(spread.from, spread.to) : 0;
    const spreadHi = spread ? Math.max(spread.from, spread.to) : 0;
    const spreadText = spread
      ? fillLabel(spread.label ?? words.spread, {
          range: spreadLo === spreadHi ? value(spreadLo) : `${value(spreadLo)}–${value(spreadHi)}`,
        })
      : "";
    const nText = fillLabel(words.sampleSize, { n: countText(n) });

    // --- vertical layout: one row per kind of label -----------------------------
    const hasHeader = !!title || nText !== "";
    const meanTop = hasHeader ? HEADER_H : TOP_PAD;
    const meanH = meanOk ? MEAN_H : 0;
    const plotTop = meanTop + meanH + COUNT_H;
    const belowH = EDGE_H + (spread ? SPREAD_H : 0) + PAD_B;
    const svgH = Math.max(height, plotTop + MIN_PLOT_H + belowH);
    const baseline = svgH - belowH;
    const plotH = baseline - plotTop;

    // --- horizontal layout -----------------------------------------------------
    const x0 = PAD_X;
    const x1 = Math.max(width - PAD_X, x0 + 1);
    const plotW = x1 - x0;
    // Half the axis's span in value units (halves: a range wider than the
    // largest double stays finite; halving is exact, so nothing else moves).
    const halfSpan = shown && !single ? (shown.width / 2) * shown.counts.length : 0;
    const center = (x0 + x1) / 2;
    // Value → pixel along the axis; a single class (all values equal) sits at the centre.
    const xOf = (v: number) =>
      halfSpan > 0 ? x0 + ((v / 2 - shown!.start / 2) / halfSpan) * plotW : center;
    const colW = single ? Math.min(SPIKE_W, plotW) : k > 0 ? plotW / k : 0;
    const colLeft = (i: number) => (single ? center - colW / 2 : x0 + i * colW);
    const gapPx = colW >= 4 ? 1 : 0;

    const liveCounts = shown?.counts ?? [];
    const maxCount = liveCounts.reduce((m, c) => Math.max(m, c), 0);
    const topOf = (c: number) => baseline - (maxCount > 0 ? c / maxCount : 0) * plotH;
    const grownTop = (c: number) => baseline - (baseline - topOf(c)) * grow;

    // Counts: on every column when every one fits its column, else on the
    // tallest alone (the first, on a tie) - labels instead of a count axis.
    const targetCounts = target?.counts ?? [];
    const allCountsFit = targetCounts.every(
      (c) => c === 0 || estTextW(countText(c), FONT_COUNT) <= colW - 2,
    );
    const tallest = targetCounts.indexOf(targetCounts.reduce((m, c) => Math.max(m, c), 0));
    const labelledCounts = new Set<number>(
      allCountsFit
        ? targetCounts.flatMap((c, i) => (c > 0 ? [i] : []))
        : tallest >= 0 && (targetCounts[tallest] ?? 0) > 0
          ? [tallest]
          : [],
    );

    // Where each count label sits (text box, estimated): the mean's line pauses
    // at a label it would cross, so the label reads whole.
    const countLabels = classes.flatMap((b, i) => {
      if (!labelledCounts.has(i)) return [];
      const text = countText(b.count);
      const w = estTextW(text, FONT_COUNT);
      const x = clampTo(colLeft(i) + colW / 2, x0 + w / 2, x1 - w / 2);
      const y = grownTop(liveCounts[i] ?? 0) - 3;
      return [{ i, text, x, y, w }];
    });

    // The mean: a line from its error bar down to the axis, when it lies on the axis.
    const end = shown ? histogramEdge(shown.start, shown.width, shown.counts.length) : 0;
    const meanOnAxis =
      meanOk &&
      shown != null &&
      (single ? mean!.value === shown.start : mean!.value >= shown.start && mean!.value <= end);
    const meanX = meanOnAxis ? xOf(mean!.value) : center;
    const meanLabelY = meanTop + FONT_LABEL;
    const meanBarY = meanTop + 23;
    // The line stops 2 px above the column the mean falls in - the taller one
    // when it sits on the edge between two - so it never crosses a column and
    // the class keeps its one width; a tick under the axis marks the mean.
    let meanStopY = baseline;
    if (meanOnAxis) {
      for (const [i] of classes.entries()) {
        const left = colLeft(i);
        const c = liveCounts[i] ?? 0;
        if (c > 0 && meanX >= left - 1 && meanX <= left + colW + 1) {
          meanStopY = Math.min(meanStopY, grownTop(c) - 2);
        }
      }
    }
    const meanSegments = lineSegments(
      meanBarY,
      meanStopY,
      countLabels
        .filter((l) => Math.abs(l.x - meanX) <= l.w / 2 + LABEL_CLEARANCE)
        .map((l) => [l.y - FONT_COUNT - LABEL_CLEARANCE, l.y + LABEL_CLEARANCE] as const),
    );
    const meanTick = meanOnAxis && !single;

    // The spread: a band behind the columns, a bracket and a caption under the axis.
    const spreadBand = spread
      ? resolveValueBand({ from: spreadLo, to: spreadHi }, xOf, [x0, x1])
      : null;
    const bracketY = baseline + EDGE_H + 4;

    // --- the screen-reader table and the generated description ----------------
    const description =
      ariaLabel ??
      (title
        ? `${title}. Histogram of ${n.toLocaleString("en-US")} values in ${k} classes.`
        : `Histogram of ${n.toLocaleString("en-US")} values in ${k} classes`);
    const a11yRows: ChartDataRow[] = classes.map((b) => ({
      label: rangeText(b),
      cells: [countText(b.count), shareText(b.count)],
    }));

    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const b = h.datum;
      const rows: ChartTooltipRow[] = [
        { label: words.count, value: countText(b.count), strong: true },
        { label: words.share, value: shareText(b.count) },
      ];
      return (
        <ChartTooltip
          ref={hover.tooltipRef}
          x={h.x}
          y={h.y}
          title={rangeText(b)}
          rows={rows}
          tokens={tokens}
        />
      );
    };

    const st = tokens.scenario[scenario];
    const columnFill =
      st.variant === "solid"
        ? st.fill
        : st.variant === "hatch"
          ? `url(#${hatchId})`
          : tokens.color.surface;
    const columnStroke = st.variant === "solid" ? undefined : st.stroke;

    // Edge labels: the first and last edge at the two ends of the axis; both
    // when they fit side by side, else the first alone. Written from the
    // target, so a live update never shows a value between two datasets.
    const edgeLo = target ? value(target.start) : "";
    const edgeHi =
      target && !single
        ? value(histogramEdge(target.start, target.width, target.counts.length))
        : "";
    const edgeLoW = estTextW(edgeLo, FONT_EDGE);
    const edgeHiW = estTextW(edgeHi, FONT_EDGE);
    const edgesFit = edgeLoW + edgeHiW + 8 <= plotW;
    const showEdgeLo = !(meanTick && meanX <= x0 + edgeLoW + 2);
    const showEdgeHi = edgesFit && !(meanTick && meanX >= x1 - edgeHiW - 2);

    return (
      <>
        <svg
          ref={ref}
          width={width}
          height={svgH}
          viewBox={`0 0 ${width} ${svgH}`}
          role="img"
          aria-label={description}
          className={className}
          style={{
            display: "block",
            maxWidth: "100%",
            marginInline: "auto",
            fontFamily: tokens.font.family,
            ...style,
          }}
        >
          {st.variant === "hatch" && (
            <defs>
              <pattern
                id={hatchId}
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="5" stroke={st.stroke} strokeWidth="1" />
              </pattern>
            </defs>
          )}

          {/* The title line: the title, and n on the right. */}
          {title && (
            <text x={PAD_X} y={18} fontSize={FONT_TITLE} fontWeight={500} fill={tokens.color.text}>
              {fitLabel(title, plotW - (nText ? estTextW(nText, FONT_EDGE) + 12 : 0), FONT_TITLE)}
            </text>
          )}
          {nText && (
            <text x={x1} y={18} fontSize={FONT_EDGE} fill={tokens.color.textMuted} textAnchor="end">
              {nText}
            </text>
          )}

          {/* The spread: a band behind the columns. */}
          {spreadBand && spreadBand.end - spreadBand.start > 0 && (
            <rect
              x={spreadBand.start}
              y={plotTop}
              width={spreadBand.end - spreadBand.start}
              height={plotH}
              fill={tokens.color.axis}
              opacity={VALUE_BAND_OPACITY}
            />
          )}

          {/* The columns, from the axis, in the scenario's notation. */}
          {classes.map((b, i) => {
            const c = liveCounts[i] ?? 0;
            if (!(c > 0)) return null;
            const top = grownTop(c);
            return (
              <rect
                key={`col-${b.index}`}
                x={colLeft(i) + gapPx / 2}
                y={top}
                width={Math.max(colW - gapPx, 0.5)}
                height={Math.max(baseline - top, 0)}
                fill={columnFill}
                stroke={columnStroke}
                strokeWidth={columnStroke ? 1 : undefined}
              />
            );
          })}

          {/* The axis. */}
          <line
            x1={x0}
            y1={baseline}
            x2={x1}
            y2={baseline}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {/* The mean: a line from its error bar down to just above the column
            it falls in, pausing at a count label it would cross, and a tick
            under the axis. It crosses no column, so no class reads as two. */}
          {meanOnAxis && (
            <g>
              {meanSegments.map(([a, b], s) => (
                <line
                  key={`mean-${s}`}
                  x1={meanX}
                  y1={a}
                  x2={meanX}
                  y2={b}
                  stroke={tokens.color.text}
                  strokeWidth={1}
                />
              ))}
              {meanTick && (
                <line
                  x1={meanX}
                  y1={baseline + 2}
                  x2={meanX}
                  y2={baseline + 2 + MEAN_TICK}
                  stroke={tokens.color.text}
                  strokeWidth={1.5}
                />
              )}
            </g>
          )}

          {/* Counts above their columns. */}
          {countLabels.map((l) => (
            <text
              key={`count-${l.i}`}
              x={l.x}
              y={l.y}
              fontSize={FONT_COUNT}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {l.text}
            </text>
          ))}

          {/* The mean's label and its error bar, in a row of their own. */}
          {meanOk && (
            <>
              <text
                x={clampTo(
                  meanX,
                  x0 + estTextW(fitLabel(meanText, plotW, FONT_LABEL), FONT_LABEL) / 2,
                  x1 - estTextW(fitLabel(meanText, plotW, FONT_LABEL), FONT_LABEL) / 2,
                )}
                y={meanLabelY}
                fontSize={FONT_LABEL}
                fill={tokens.color.text}
                textAnchor="middle"
              >
                {fitLabel(meanText, plotW, FONT_LABEL)}
              </text>
              {meanOnAxis && meanHalf != null && (
                <ErrorBar
                  value={mean!.value}
                  halfWidth={meanHalf}
                  scale={xOf}
                  cross={meanBarY}
                  capSize={8}
                  clip={[x0, x1]}
                  label={meanInterval}
                  tokens={tokens}
                />
              )}
            </>
          )}

          {/* Edge labels under the two ends of the axis. */}
          {target && single && (
            <text
              x={center}
              y={baseline + 13}
              fontSize={FONT_EDGE}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {edgeLo}
            </text>
          )}
          {target && !single && (
            <>
              {showEdgeLo && (
                <text
                  x={x0}
                  y={baseline + 13}
                  fontSize={FONT_EDGE}
                  fill={tokens.color.textMuted}
                  textAnchor="start"
                >
                  {edgeLo}
                </text>
              )}
              {showEdgeHi && (
                <text
                  x={x1}
                  y={baseline + 13}
                  fontSize={FONT_EDGE}
                  fill={tokens.color.textMuted}
                  textAnchor="end"
                >
                  {edgeHi}
                </text>
              )}
            </>
          )}

          {/* The spread's bracket and caption. */}
          {spread && spreadBand && (
            <>
              {spreadBand.end - spreadBand.start >= 1 && (
                <path
                  d={`M${spreadBand.start},${bracketY - 4}V${bracketY}H${spreadBand.end}V${bracketY - 4}`}
                  fill="none"
                  stroke={tokens.color.textMuted}
                  strokeWidth={0.75}
                />
              )}
              {(() => {
                const text = fitLabel(spreadText, plotW, FONT_LABEL);
                const w = estTextW(text, FONT_LABEL);
                return (
                  <text
                    x={clampTo((spreadBand.start + spreadBand.end) / 2, x0 + w / 2, x1 - w / 2)}
                    y={bracketY + 14}
                    fontSize={FONT_LABEL}
                    fill={tokens.color.text}
                    textAnchor="middle"
                  >
                    {text}
                  </text>
                );
              })()}
            </>
          )}

          {/* Hit targets: one per class, the full height of the plot and its count row. */}
          {marks.enabled &&
            classes.map((b, i) => {
              const c = liveCounts[i] ?? 0;
              const rect: MarkRect =
                c > 0
                  ? { x: colLeft(i), y: topOf(c), width: colW, height: baseline - topOf(c) }
                  : { x: colLeft(i), y: baseline, width: colW, height: 0 };
              return (
                <rect
                  key={`hit-${b.index}`}
                  x={colLeft(i)}
                  y={plotTop - COUNT_H}
                  width={colW}
                  height={baseline - plotTop + COUNT_H}
                  fill="transparent"
                  {...marks.forMark(
                    { category: rangeText(b), scenario, value: b.count, datum: b },
                    [rect],
                  )}
                />
              );
            })}
        </svg>
        <ChartDataTable
          caption={[
            ariaLabel ?? (title ? `${title} - data table` : "Histogram - data table"),
            meanText,
            spreadText,
            nText,
          ]
            .filter(Boolean)
            .join(". ")}
          columns={[words.count, words.share]}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
