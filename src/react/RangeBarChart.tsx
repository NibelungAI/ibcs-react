import { forwardRef, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokensOverride } from "../core/tokens";
import { fillLabel, type IbcsLabelsOverride } from "../core/labels";
import { formatValue, type FormatOptions } from "../core/format";
import { rowIconsOf } from "../core/rowIcon";
import { computeRangeBars, type RangeDatum, type RangeRow } from "../core/rangeBar";
import { boxesTouch, placeLabels, type PlacementBox } from "../core/labelPlacement";
import { bandScale, resolveBandPadding } from "../core/bandScale";
import { useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction, type MarkRect } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens, useResolvedLabels } from "./theme";
import { clampTo, estTextW, fitLabel, svgSafeId } from "./internal/text";
import { layoutRowLabelIcons, rowIconPx } from "./internal/rowLabelIcons";
import { rangeFormat } from "./internal/rangeFormat";

export type { RangeDatum, RangeRow } from "../core/rangeBar";

export interface RangeBarChartProps {
  /**
   * The categories, in order: each with the two ends of its range (`from`,
   * `to`) and an optional `mark` on it - e.g. a variant's 10th and 90th
   * percentiles and its mean, or an estimate ± its half-width per wave.
   */
  data: RangeDatum[];
  /**
   * `"bars"` (default): one row per category, the values running left to
   * right - for categories such as variants (IBCS UN 3.4), with icons in the
   * row labels. `"columns"`: one column per category, left to right - for a
   * sequence in time, such as the waves of a simulation narrowing (UN 3.3).
   * There an end label that would touch another label, a column or a dot moves
   * away from its end, with a leader, and the rows above and below the plot
   * grow - up to three each - to make room. When the columns are too crowded
   * for every end label, only the first and the last column's ends are
   * labelled; an end label that finds no place even then is left out, never
   * drawn over a column or past the chart's edge. Every value stays in the
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
 * RangeBarChart - floating bars from one end of a range to the other, with a
 * value marked on each and both ends labelled, after J.P. Morgan's Guide to
 * the Markets: the 10th to the 90th percentile of each variant's fights with
 * their mean (its manager dispersion, p. 67), or an estimate ± its half-width
 * per wave of a simulation, narrowing as the waves come in (the floating
 * ranges of p. 60).
 *
 * The bars float: their length is the range, not a value from zero, so the
 * value axis spans the data, and the end labels stand in for it (IBCS SI
 * 3.1: labels instead of axes and grid lines). The mark is a hollow dot on
 * its bar, so it reads on any fill and never splits the bar in two. In
 * `"bars"` orientation each row has its label - with icons, as `DataTable`'s
 * - and its two end labels in a band of its own; in `"columns"` orientation
 * an end label that would touch another label or a column moves away from
 * its end, with a leader.
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
    // rows above and below the plot grow, up to three each, until every label
    // has a place. When the columns are too crowded for that, only the first
    // and the last column's ends are labelled, the start and the end of the
    // sequence, as the histogram labels its tallest count alone; every value
    // stays in the tooltip and the screen-reader table.
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
      return { top, plotH, yOf, highY, lowY, placed, colBoxes };
    };
    const unplaced = (l: ReturnType<typeof tryLayout>) => l.placed.filter((p) => p == null).length;
    // The rows grow until every label has a place; of the four layouts, the
    // one that places the most labels is kept, with the fewest rows.
    const layoutFor = (labelled: (r: RangeRow) => boolean) => {
      let best = tryLayout(0, labelled);
      for (let extra = 1; extra <= 3 && unplaced(best) > 0; extra++) {
        const next = tryLayout(extra, labelled);
        if (unplaced(next) < unplaced(best)) best = next;
      }
      return best;
    };
    const every = () => true;
    const endsOnly = (r: RangeRow) => ends.has(r);
    // Labels never overlap, so when their boxes together outgrow the whole
    // chart not all of them can be placed: the ends alone are tried at once,
    // and a thousand columns cost four labels' placing, not two thousand's.
    const labelArea = drawableRows.reduce(
      (a, r) => a + (labelW(value(r.high)) + labelW(value(r.low))) * VALUE_H,
      0,
    );
    let labelled: (r: RangeRow) => boolean = labelArea > width * height ? endsOnly : every;
    let lay = layoutFor(labelled);
    if (labelled === every && unplaced(lay) > 0) {
      labelled = endsOnly;
      lay = layoutFor(labelled);
    }
    const { top, plotH, yOf, highY, lowY, placed, colBoxes } = lay;
    // Where each end label is written: in its place; else right beside its
    // end, if that lies inside the chart and touches no column, dot or other
    // label; else nowhere - the tooltip and the table still carry its value.
    const taken: PlacementBox[] = placed.flatMap((p) => (p ? [p.box] : []));
    const beside = (x: number, w: number, baseline: number): PlacementBox | null => {
      const box = {
        left: x - w / 2,
        right: x + w / 2,
        top: baseline + 3 - VALUE_H,
        bottom: baseline + 3,
      };
      const inside = box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height;
      if (
        !inside ||
        colBoxes.some((b) => boxesTouch(box, b)) ||
        taken.some((b) => boxesTouch(box, b))
      ) {
        return null;
      }
      taken.push(box);
      return box;
    };
    let k = 0;
    const labelOf = rows.map((r, i) => {
      if (!drawable(r) || !labelled(r)) return null;
      const hi = placed[k++] ?? null;
      const lo = placed[k++] ?? null;
      return {
        hi: hi?.box ?? beside(cx(i), labelW(value(r.high)), highY(r) - END_GAP),
        lo: lo?.box ?? beside(cx(i), labelW(value(r.low)), lowY(r) + END_GAP + FONT_VALUE),
        leaders: [hi?.leader, lo?.leader],
      };
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
            (l?.leaders ?? []).flatMap((leader, j) =>
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
                {l?.hi && (
                  <text
                    x={(l.hi.left + l.hi.right) / 2}
                    y={l.hi.bottom - 3}
                    fontSize={FONT_VALUE}
                    fill={tokens.color.text}
                    textAnchor="middle"
                  >
                    {value(r.high)}
                  </text>
                )}
                {l?.lo && (
                  <text
                    x={(l.lo.left + l.lo.right) / 2}
                    y={l.lo.bottom - 3}
                    fontSize={FONT_VALUE}
                    fill={tokens.color.text}
                    textAnchor="middle"
                  >
                    {value(r.low)}
                  </text>
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
