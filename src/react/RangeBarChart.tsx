import { forwardRef, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { fillLabel, type IbcsLabelsOverride } from "../core/labels";
import { formatValue, type FormatOptions } from "../core/format";
import { rowIconsOf } from "../core/rowIcon";
import { computeRangeBars, type RangeDatum, type RangeRow } from "../core/rangeBar";
import { placeLabels, type PlacementBox } from "../core/labelPlacement";
import { bandScale, resolveBandPadding } from "../core/bandScale";
import { useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens, useResolvedLabels } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";
import { layoutRowLabelIcons, rowIconPx } from "./internal/rowLabelIcons";

export type { RangeDatum, RangeRow } from "../core/rangeBar";

export interface RangeBarChartProps {
  /**
   * The categories, in order: each with the two ends of its range (`from`,
   * `to`) and an optional `mark` across it - e.g. a variant's 10th and 90th
   * percentiles and its mean, or an estimate ± its half-width per wave.
   */
  data: RangeDatum[];
  /**
   * `"bars"` (default): one row per category, the values running left to
   * right - for categories such as variants (IBCS UN 3.4), with icons in the
   * row labels. `"columns"`: one column per category, left to right - for a
   * sequence in time, such as the waves of a simulation narrowing (UN 3.3).
   * There an end label that would touch another label, a column or a dot moves
   * away from its end, with a leader; when the columns are too narrow for
   * every end label (about two thirds of a label's width each), only the first
   * and the last column's ends are labelled, and every value stays in the
   * tooltip and the screen-reader table.
   */
  orientation?: "bars" | "columns";
  /**
   * The IBCS notation of the bars: AC solid (default), PY grey, PL outlined,
   * FC hatched.
   */
  scenario?: ScenarioKey;
  /** Width in px. Default 560. */
  width?: number;
  /** Height in px of the `"columns"` chart. Default 260. A `"bars"` chart's height follows its rows. */
  height?: number;
  /** Height of each row of the `"bars"` chart, in px. Default 26, at least 14. */
  rowHeight?: number;
  /**
   * The size of the row icons of the `"bars"` chart (a datum's `icon`, and of
   * the box `renderIcon` fills), in CSS px: default 20 (less on rows under
   * 26 px), at least 8, at most the row height minus 4 and never above 56. An
   * icon is never drawn above `naturalSize / pixelRatio`. Chips that would
   * leave a label less than 24 px are left out, from the end, and a "+N"
   * (`labels.moreIcons`) counts them, their `alt`s in the label's tooltip.
   */
  iconSize?: number;
  /**
   * An svg element for a row's icon slot (`"bars"`), in place of its datum's
   * `icon`: drawn in a box `size` px tall whose top-left corner is the
   * origin. `icon` is the row's own icons as the chart would draw them there
   * (or null), to wrap - in a tooltip trigger, say. Return null to fall back
   * to the datum's `icon`.
   */
  renderIcon?: (row: RangeRow, size: number, icon: ReactNode) => ReactNode;
  /**
   * Number formatting of the ends and the marks, and their `locale`. Values
   * are written in full unless `compact` is `true`: at `fractionDigits`, or
   * without them at the fewest digits (up to 20) at which every category's
   * two ends read apart - one count for the whole chart. With `compact: true`
   * they are compact, at `fractionDigits` or more, by the same rule.
   */
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  /**
   * The chart's own words - `rangeLow`, `rangeHigh` and `rangeMark` (the
   * screen-reader table's columns and the tooltip: "p10", "p90", "Mean"),
   * and `moreIcons` - merged onto `IbcsThemeProvider`'s. See `IbcsLabels`.
   */
  labels?: IbcsLabelsOverride;
  title?: string;
  /**
   * The chart's accessible name, in place of the generated English
   * description; also the caption of its screen-reader table.
   */
  ariaLabel?: string;
  /** Class name for the chart's `<svg>`. */
  className?: string;
  /** Inline style merged over the `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
  /**
   * Show the built-in tooltip on a category (its two ends and its mark).
   * Default true; set false to opt out (e.g. when wiring your own via
   * `onHover`).
   */
  tooltip?: boolean;
  /** Fired as the pointer moves over / leaves a category (`null` on leave) - for a custom tooltip. */
  onHover?: (hover: ChartHover<RangeRow> | null) => void;
}

const PAD_X = 12;
const HEADER_H = 30;
const TOP_PAD = 8;
const PAD_B = 6;
const FONT_TITLE = 13;
/** The end labels' font size, px. */
const FONT_VALUE = 10;
/** The height an end label takes in the `"columns"` chart, px. */
const VALUE_H = 13;
/** The category labels' row in the `"columns"` chart, px. */
const CATEGORY_H = 18;
const FONT_CATEGORY = 10.5;
/** The space between a bar's end and its label, px. */
const END_GAP = 4;
/** The radius of the mark's dot, at most, px. */
const MARK_R = 5;
/** The gap between the label column and the lane (`"bars"`). */
const LANE_GAP = 8;
const MIN_LABEL_TEXT = 24;

/**
 * The options the chart writes its values with. In full unless the caller
 * sets `compact: true`: at the caller's `fractionDigits`, else at one decimal
 * place past the first significant digit of the narrowest range (a range
 * 1.5 wide → 1 digit, 82.2 wide → 0), so its two ends are at least ten units
 * of the last digit apart and never read alike, and a narrowing range keeps
 * its width readable. With `compact: true`, at the caller's digits or more:
 * the fewest (up to 20) at which every range's two ends read apart.
 */
function rangeFormat(format: FormatOptions, rows: readonly RangeRow[]): FormatOptions {
  const callerDigits = Number.isFinite(format.fractionDigits)
    ? Math.min(20, Math.max(0, Math.round(format.fractionDigits!)))
    : undefined;
  const ranges = rows.filter((r) => Number.isFinite(r.low) && r.high > r.low);
  if (format.compact !== true) {
    const narrowest = ranges.reduce((w, r) => Math.min(w, r.high / 2 - r.low / 2), Infinity) * 2;
    const widthDigits =
      Number.isFinite(narrowest) && narrowest > 0
        ? Math.min(20, Math.max(0, Math.ceil(-Math.log10(narrowest)) + 1))
        : 0;
    return { ...format, compact: false, fractionDigits: callerDigits ?? widthDigits };
  }
  const apart = (o: FormatOptions) =>
    ranges.every((r) => formatValue(r.low, o) !== formatValue(r.high, o));
  for (let d = callerDigits ?? 0; d < 20; d++) {
    const o = { ...format, compact: true, fractionDigits: d };
    if (apart(o)) return o;
  }
  return { ...format, compact: true, fractionDigits: 20 };
}

/**
 * RangeBarChart - floating bars from one end of a range to the other, with a
 * value marked across each and both ends labelled, after J.P. Morgan's Guide
 * to the Markets: the 10th to the 90th percentile of each variant's fights
 * with their mean (its manager dispersion, p. 67), or an estimate ± its
 * half-width per wave of a simulation, narrowing as the waves come in (the
 * floating ranges of p. 60).
 *
 * The bars float: their length is the range, not a value from zero, so the
 * value axis spans the data, and the end labels stand in for it (IBCS SI
 * 3.1: labels instead of axes and grid lines). The mark is a line across its
 * bar over a thin halo, so it reads on any fill. In `"bars"` orientation each
 * row has its label - with icons, as `DataTable`'s - and its two end labels
 * in a band of its own; in `"columns"` orientation an end label that would
 * touch another label or a column moves away from its end, with a leader.
 *
 * The chart draws the ends and the marks it is given: which percentiles,
 * interval or mean they are is the caller's to compute and to name (`labels`).
 * Pure SVG, SSR-safe; a screen-reader table lists every category's ends and
 * mark.
 */
export const RangeBarChart = forwardRef<SVGSVGElement, RangeBarChartProps>(function RangeBarChart(
  {
    data,
    orientation = "bars",
    scenario = "AC",
    width = 560,
    height = 260,
    rowHeight = 26,
    iconSize,
    renderIcon,
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
  const words = useResolvedLabels(labels);
  const hatchId = svgSafeId(useId());
  const hover = useChartHover<RangeRow>();
  const marks = markInteraction(hover, tooltip, onHover);

  const layout = useMemo(() => computeRangeBars(data ?? []), [data]);
  const { rows, min, max } = layout;
  const n = rows.length;
  const hasMarks = rows.some((r) => r.mark != null);

  const valueFmt = rangeFormat(format, rows);
  const value = (v: number) => formatValue(v, valueFmt);
  const na = format.notAvailable ?? "n/a";
  const drawable = (r: RangeRow) => Number.isFinite(r.low);

  const st = tokens.scenario[scenario];
  const barFill =
    st.variant === "solid"
      ? st.fill
      : st.variant === "hatch"
        ? `url(#${hatchId})`
        : tokens.color.surface;
  const barStroke = st.variant === "solid" ? undefined : st.stroke;
  // Value → fraction of the axis; halves keep a span wider than a double finite.
  const halfSpan = max / 2 - min / 2;
  const fractionOf = (v: number) => (halfSpan > 0 ? (v / 2 - min / 2) / halfSpan : 0.5);

  const padT = title ? HEADER_H : TOP_PAD;
  const innerW = Math.max(width - PAD_X * 2, 1);

  // The mark: a hollow dot in the text ink - a point on its range, which
  // reads on a solid, hatched or outlined bar alike and never as a gap that
  // splits the bar in two.
  const markDot = (key: string, cx: number, cy: number, r: number) => (
    <circle
      key={key}
      cx={cx}
      cy={cy}
      r={r}
      fill={tokens.color.surface}
      stroke={tokens.color.text}
      strokeWidth={1.5}
    />
  );

  // --- the screen-reader table, the tooltip, the description -----------------
  const columns = hasMarks
    ? [words.rangeLow, words.rangeMark, words.rangeHigh]
    : [words.rangeLow, words.rangeHigh];
  const cellsOf = (r: RangeRow) => {
    const lo = drawable(r) ? value(r.low) : na;
    const hi = drawable(r) ? value(r.high) : na;
    const mk = r.mark != null ? value(r.mark) : na;
    return hasMarks ? [lo, mk, hi] : [lo, hi];
  };
  const a11yRows: ChartDataRow[] = rows.map((r) => ({
    label: [...rowIconsOf(r.source?.icon).map((icon) => icon.alt ?? ""), r.label]
      .filter(Boolean)
      .join(", "),
    cells: cellsOf(r),
  }));
  const description =
    ariaLabel ?? (title ? `${title}. Ranges of ${n} categories.` : `Ranges of ${n} categories`);
  const renderTooltip = () => {
    const h = hover.hovered;
    if (!tooltip || !h) return null;
    const r = h.datum;
    const cells = cellsOf(r);
    const tip: ChartTooltipRow[] = columns.map((label, i) => ({
      label,
      value: cells[i]!,
      strong: hasMarks && i === 1,
    }));
    return (
      <ChartTooltip
        ref={hover.tooltipRef}
        x={h.x}
        y={h.y}
        title={r.label}
        rows={tip}
        tokens={tokens}
      />
    );
  };
  const hatch = st.variant === "hatch" && (
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
  );
  const svgStyle: CSSProperties = {
    display: "block",
    maxWidth: "100%",
    marginInline: "auto",
    fontFamily: tokens.font.family,
    ...style,
  };
  const titleText = title && (
    <text x={PAD_X} y={18} fontSize={FONT_TITLE} fontWeight={500} fill={tokens.color.text}>
      {fitLabel(title, innerW, FONT_TITLE)}
    </text>
  );
  const table = (
    <ChartDataTable
      caption={ariaLabel ?? (title ? `${title} - data table` : "Ranges - data table")}
      columns={columns}
      rows={a11yRows}
    />
  );

  if (orientation === "columns") {
    // --- columns: one per category, left to right ------------------------------
    const scale = bandScale(innerW, Math.max(n, 1), resolveBandPadding(0.5), PAD_X);
    const colW = Math.max(2, Math.min(scale.bandwidth, 40));
    const markR = Math.min(MARK_R, colW / 2 + 1);
    const cx = (i: number) => scale.center(i);
    const labelW = (s: string) => estTextW(s, FONT_VALUE) + 2;
    // End labels are placed clear of every column, mark and other label: right
    // beside their end where there is room, else moved away with a leader. The
    // rows above and below the plot grow until every label has a place. When
    // the columns are too narrow for that - about two thirds of a label each -
    // only the first and the last column's ends are labelled, the start and the
    // end of the sequence, as the histogram labels its tallest count alone;
    // every value stays in the tooltip and the screen-reader table.
    const drawableRows = rows.filter(drawable);
    const ends = new Set([drawableRows[0], drawableRows[drawableRows.length - 1]]);
    const tryLayout = (extraRows: number, labelled: (r: RangeRow) => boolean) => {
      const top = padT + VALUE_H * (1 + extraRows);
      const bottom = height - PAD_B - CATEGORY_H - VALUE_H * (1 + extraRows);
      const plotH = Math.max(bottom - top, 20);
      const yOf = (v: number) => top + plotH - fractionOf(v) * plotH;
      // A column's two ends, past its mark's dot where the dot reaches beyond them.
      const highY = (r: RangeRow) =>
        r.mark != null ? Math.min(yOf(r.high), yOf(r.mark) - markR) : yOf(r.high);
      const lowY = (r: RangeRow) =>
        r.mark != null ? Math.max(yOf(r.low), yOf(r.mark) + markR) : yOf(r.low);
      const colBoxes: PlacementBox[] = [];
      for (const [i, r] of rows.entries()) {
        if (!drawable(r)) continue;
        colBoxes.push({
          left: cx(i) - colW / 2,
          top: yOf(r.high),
          right: cx(i) + colW / 2,
          bottom: Math.max(yOf(r.low), yOf(r.high) + 1),
        });
        if (r.mark != null) {
          const y = yOf(r.mark);
          colBoxes.push({
            left: cx(i) - markR,
            top: y - markR,
            right: cx(i) + markR,
            bottom: y + markR,
          });
        }
      }
      const requests = rows.flatMap((r, i) => {
        if (!drawable(r) || !labelled(r)) return [];
        const hi = value(r.high);
        const lo = value(r.low);
        return [
          {
            x: cx(i),
            y: highY(r),
            width: labelW(hi),
            height: VALUE_H,
            clearance: END_GAP - 2,
            sides: ["above" as const],
          },
          {
            x: cx(i),
            y: lowY(r),
            width: labelW(lo),
            height: VALUE_H,
            clearance: END_GAP - 2,
            sides: ["below" as const],
          },
        ];
      });
      const placed = placeLabels(
        requests,
        { boxes: colBoxes, segments: [] },
        {
          left: PAD_X - 4,
          top: padT,
          right: width - PAD_X + 4,
          bottom: height - PAD_B - CATEGORY_H,
        },
        { margin: 1 },
      );
      return { top, plotH, yOf, highY, lowY, placed };
    };
    const every = () => true;
    let labelled: (r: RangeRow) => boolean = every;
    let tries = 0;
    let lay = tryLayout(0, labelled);
    while (lay.placed.some((p) => p == null) && tries < 3) {
      tries += 1;
      lay = tryLayout(tries, labelled);
    }
    if (lay.placed.some((p) => p == null)) {
      labelled = (r) => ends.has(r);
      lay = tryLayout(0, labelled);
    }
    const { top, plotH, yOf, highY, lowY, placed } = lay;
    let k = 0;
    const labelOf = rows.map((r) => {
      if (!drawable(r) || !labelled(r)) return null;
      const hi = placed[k++] ?? null;
      const lo = placed[k++] ?? null;
      return { hi, lo };
    });

    return (
      <>
        <svg
          ref={ref}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={description}
          className={className}
          style={svgStyle}
        >
          {hatch}
          {titleText}
          {/* Leaders first, under the columns, so every column stays whole. */}
          {labelOf.flatMap((l, i) =>
            [l?.hi?.leader, l?.lo?.leader].flatMap((leader, j) =>
              leader
                ? [
                    <line
                      key={`leader-${i}-${j}`}
                      x1={leader.x1}
                      y1={leader.y1}
                      x2={leader.x2}
                      y2={leader.y2}
                      stroke={tokens.color.textMuted}
                      strokeWidth={0.75}
                    />,
                  ]
                : [],
            ),
          )}
          {rows.map((r, i) => {
            if (!drawable(r)) {
              return (
                <text
                  key={`na-${i}`}
                  x={cx(i)}
                  y={top + plotH / 2}
                  fontSize={FONT_VALUE}
                  fill={tokens.color.textMuted}
                  textAnchor="middle"
                >
                  {na}
                </text>
              );
            }
            const y0 = yOf(r.high);
            const y1 = Math.max(yOf(r.low), y0 + 1);
            const l = labelOf[i];
            // An end label that found no place is written beside its end anyway.
            const hiBox = l?.hi?.box;
            const loBox = l?.lo?.box;
            const withLabels = l != null;
            return (
              <g key={`col-${i}`}>
                <rect
                  x={cx(i) - colW / 2}
                  y={y0}
                  width={colW}
                  height={y1 - y0}
                  fill={barFill}
                  stroke={barStroke}
                  strokeWidth={barStroke ? 1 : undefined}
                />
                {r.mark != null && markDot(`mark-${i}`, cx(i), yOf(r.mark), markR)}
                {withLabels && (
                  <>
                    <text
                      x={hiBox ? (hiBox.left + hiBox.right) / 2 : cx(i)}
                      y={hiBox ? hiBox.bottom - 3 : highY(r) - END_GAP}
                      fontSize={FONT_VALUE}
                      fill={tokens.color.text}
                      textAnchor="middle"
                    >
                      {value(r.high)}
                    </text>
                    <text
                      x={loBox ? (loBox.left + loBox.right) / 2 : cx(i)}
                      y={loBox ? loBox.bottom - 3 : lowY(r) + END_GAP + FONT_VALUE}
                      fontSize={FONT_VALUE}
                      fill={tokens.color.text}
                      textAnchor="middle"
                    >
                      {value(r.low)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          {/* Category labels under the columns. */}
          {rows.map((r, i) => (
            <text
              key={`cat-${i}`}
              x={cx(i)}
              y={height - PAD_B - 5}
              fontSize={FONT_CATEGORY}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {fitLabel(r.label, scale.step - 2, FONT_CATEGORY)}
              <title>{r.label}</title>
            </text>
          ))}
          {marks.enabled &&
            rows.map((r, i) => {
              const rect: MarkRect = drawable(r)
                ? {
                    x: cx(i) - colW / 2,
                    y: yOf(r.high),
                    width: colW,
                    height: Math.max(yOf(r.low) - yOf(r.high), 1),
                  }
                : { x: cx(i) - colW / 2, y: top + plotH / 2, width: colW, height: 0 };
              return (
                <rect
                  key={`hit-${i}`}
                  x={cx(i) - scale.step / 2}
                  y={padT}
                  width={scale.step}
                  height={Math.max(height - PAD_B - padT, 0)}
                  fill="transparent"
                  {...marks.forMark(
                    { category: r.label, scenario, value: r.mark ?? r.low, datum: r },
                    [rect],
                  )}
                />
              );
            })}
        </svg>
        {table}
        {renderTooltip()}
      </>
    );
  }

  // --- bars: one row per category ------------------------------------------------
  const rowH = Math.max(14, Number.isFinite(rowHeight) ? rowHeight : 26);
  const svgH = padT + n * rowH + PAD_B;
  const rowCy = (i: number) => padT + i * rowH + rowH / 2;
  const valFont = Math.max(9, Math.min(11, rowH * 0.46));
  const labelFont = Math.max(9, Math.min(12, rowH * 0.5));
  const barH = Math.min(rowH * 0.5, 14);
  const markR = Math.min(MARK_R, barH / 2 + 1);
  // The labels may take up to 45% of the width: a bar and its two end labels
  // need less than the panels of a ranking chart.
  const capW = Math.max(40, innerW * 0.45);
  const iconPx = rowIconPx(iconSize, rowH, Math.min(20, rowH - 6));
  const icons = layoutRowLabelIcons({
    rows,
    iconOf: (r) => r.source?.icon,
    iconPx,
    maxSlot: capW - 6 - MIN_LABEL_TEXT,
    moreText: (count) => fillLabel(words.moreIcons, { count }),
    fontPx: valFont,
    renderIcon,
    tokens,
  });
  const widestLabel = rows.reduce((w, r) => Math.max(w, estTextW(r.label, labelFont)), 0);
  const labelColW = Math.min(capW, Math.max(40, icons.labelInset + widestLabel + 2));
  const laneX0 = PAD_X + labelColW + LANE_GAP;
  const laneX1 = Math.max(width - PAD_X, laneX0 + 1);
  // Gutters for the end labels, so every label stays inside the chart.
  const textW = (s: string) => estTextW(s, valFont);
  // A row's dot may reach past its bar's end by up to its radius.
  const dotRoom = (r: RangeRow) => (r.mark != null ? markR : 0);
  const leftGutter = rows.reduce(
    (w, r) => (drawable(r) ? Math.max(w, textW(value(r.low)) + END_GAP + dotRoom(r)) : w),
    0,
  );
  const rightGutter = rows.reduce(
    (w, r) => (drawable(r) ? Math.max(w, textW(value(r.high)) + END_GAP + dotRoom(r)) : w),
    0,
  );
  const barX0 = laneX0 + leftGutter;
  const barW = Math.max(laneX1 - rightGutter - barX0, 8);
  const xOf = (v: number) => barX0 + fractionOf(v) * barW;

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
        style={svgStyle}
      >
        {hatch}
        {titleText}
        {rows.map((r, i) => {
          const cy = rowCy(i);
          const label = (
            <>
              {icons.draw(i, PAD_X, cy)}
              <text
                x={PAD_X + icons.labelInset}
                y={cy + labelFont * 0.34}
                fontSize={labelFont}
                fill={r.source?.labelColor ?? tokens.color.text}
              >
                {fitLabel(r.label, labelColW - icons.labelInset, labelFont)}
                <title>
                  {[r.label, ...icons.dropped(i).map((icon) => icon.alt ?? "")]
                    .filter(Boolean)
                    .join(", ")}
                </title>
              </text>
            </>
          );
          if (!drawable(r)) {
            return (
              <g key={`row-${i}`}>
                {label}
                <text
                  x={barX0}
                  y={cy + valFont * 0.34}
                  fontSize={valFont}
                  fill={tokens.color.textMuted}
                >
                  {na}
                </text>
              </g>
            );
          }
          const x0 = xOf(r.low);
          const x1 = Math.max(xOf(r.high), x0 + 1);
          const rect: MarkRect = { x: x0, y: cy - barH / 2, width: x1 - x0, height: barH };
          // The row's handlers sit on its group, so the pointer over the bar,
          // its mark or its labels reaches them; the tooltip opens near the bar.
          return (
            <g
              key={`row-${i}`}
              {...marks.forMark({ category: r.label, scenario, value: r.mark ?? r.low, datum: r }, [
                rect,
              ])}
            >
              {marks.enabled && (
                <rect x={PAD_X} y={cy - rowH / 2} width={innerW} height={rowH} fill="transparent" />
              )}
              {label}
              <rect
                x={x0}
                y={cy - barH / 2}
                width={x1 - x0}
                height={barH}
                fill={barFill}
                stroke={barStroke}
                strokeWidth={barStroke ? 1 : undefined}
              />
              {r.mark != null && markDot(`mark-${i}`, xOf(r.mark), cy, markR)}
              <text
                x={clampTo(
                  Math.min(x0, r.mark != null ? xOf(r.mark) - markR : x0) - END_GAP,
                  laneX0,
                  laneX1,
                )}
                y={cy + valFont * 0.34}
                fontSize={valFont}
                fill={tokens.color.text}
                textAnchor="end"
              >
                {value(r.low)}
              </text>
              <text
                x={clampTo(
                  Math.max(x1, r.mark != null ? xOf(r.mark) + markR : x1) + END_GAP,
                  laneX0,
                  laneX1,
                )}
                y={cy + valFont * 0.34}
                fontSize={valFont}
                fill={tokens.color.text}
                textAnchor="start"
              >
                {value(r.high)}
              </text>
            </g>
          );
        })}
      </svg>
      {table}
      {renderTooltip()}
    </>
  );
});
