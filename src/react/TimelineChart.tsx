import { forwardRef, useMemo, type CSSProperties, type ReactNode } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import { fillLabel, type IbcsLabelsOverride } from "../core/labels";
import { formatValue, type FormatOptions } from "../core/format";
import { rowIconsOf } from "../core/rowIcon";
import {
  computeTimeline,
  formatClock,
  timeStepDigits,
  timeTicks,
  type TimelineAnnotation,
  type TimelineLayoutRow,
  type TimelineMark,
  type TimelineRow,
} from "../core/timeline";
import { useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens, useResolvedLabels } from "./theme";
import { clampTo, estTextW, fitLabel } from "./internal/text";
import { layoutRowLabelIcons, rowIconPx } from "./internal/rowLabelIcons";
import { NoteBadge, NoteList, badgeRadius, layoutNotes, notesHeight } from "./internal/notes";

export type {
  TimelineAnnotation,
  TimelineLayoutRow,
  TimelineMark,
  TimelineOptions,
  TimelineRow,
  TimelineSpan,
  TimelineSpanKind,
} from "../core/timeline";

export interface TimelineChartProps {
  /**
   * One row per ability, buff or task, top to bottom: its `ticks` (moments,
   * drawn as ticks - the casts) and its `spans` (intervals, drawn as spans: an
   * `"active"` bar for a buff's uptime, a thin `"waiting"` line for a
   * cooldown), with an optional `icon` before its label.
   */
  rows: TimelineRow[];
  /**
   * Numbered notes at moments: each number sits above the rows with an
   * assisting line down to its moment (to its `row`'s marks, or across every
   * row), and its text is written beside the same number under the chart.
   * Numbered in the order given. Numbers too close to sit at their moments are
   * set side by side - as many as fit across the chart, about one per 16 px -
   * each line still at its exact moment.
   */
  annotations?: TimelineAnnotation[];
  /**
   * The time range drawn, `[start, end]` - e.g. `[0, fightLength]`. Default
   * the earliest to the latest moment of the rows and annotations. A tick
   * outside it is not drawn and a span is clipped to it; the screen-reader
   * table still lists both. An annotation outside it keeps its number, at the
   * nearest end, without an assisting line.
   */
  domain?: readonly [number, number];
  /**
   * How times are written: `"number"` (default) by `format`, with its
   * `suffix` for a unit (`{ suffix: " s" }`); `"clock"` as minutes and seconds
   * from seconds - "1:30", "1:02:03" past an hour - with `format.locale` (its
   * `suffix` and `currency` are not used).
   */
  timeFormat?: "number" | "clock";
  /** Width in px. Default 640. The height follows the rows. */
  width?: number;
  /** Height of each row, in px. Default 22, at least 14. */
  rowHeight?: number;
  /**
   * The size of the row icons (a row's `icon`, and of the box `renderIcon`
   * fills), in CSS px: default 16 (less on rows under 22 px), at least 8, at
   * most the row height minus 4 and never above 56. An icon is never drawn
   * above `naturalSize / pixelRatio`. Chips that would leave a label less
   * than 24 px are left out, from the end, and a "+N" (`labels.moreIcons`)
   * counts them, their `alt`s in the label's tooltip.
   */
  iconSize?: number;
  /**
   * An svg element for a row's icon slot, in place of its `icon`: drawn in a
   * box `size` px tall whose top-left corner is the origin. `icon` is the
   * row's own icons as the chart would draw them in that box (or null), to
   * wrap - in a tooltip trigger, say. Return null to fall back to the row's
   * `icon`.
   */
  renderIcon?: (row: TimelineLayoutRow, size: number, icon: ReactNode) => ReactNode;
  /**
   * Number formatting of the times and their `locale`. Times are written in
   * full unless `compact` is `true`. The axis labels take the digits of the
   * axis step; the tooltip and the screen-reader table take `fractionDigits`
   * (on a clock, default 1: "1:05.5").
   */
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  /**
   * The chart's own words - `events`, `event`, `active`, `waiting` and
   * `moreIcons` - merged onto `IbcsThemeProvider`'s. See `IbcsLabels`.
   */
  labels?: IbcsLabelsOverride;
  /** A title, written on the chart's first line - e.g. "One of 6,000 fights: an example, not a guide". */
  title?: string;
  /**
   * The chart's accessible name, in place of the generated English
   * description; also the caption of its screen-reader table, before the
   * notes.
   */
  ariaLabel?: string;
  /** Class name for the chart's `<svg>`. */
  className?: string;
  /** Inline style merged over the `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
  /**
   * Show the built-in tooltip on a mark (its row, and its moment or its
   * interval). Default true; set false to opt out (e.g. when wiring your own
   * via `onHover`).
   */
  tooltip?: boolean;
  /** Fired as the pointer moves over / leaves a mark (`null` on leave) - for a custom tooltip. */
  onHover?: (hover: ChartHover<TimelineMark> | null) => void;
}

/* Rows of the chart, top to bottom (px). */
/** The title line. */
const HEADER_H = 26;
/** The top margin without a title. */
const TOP_PAD = 8;
/** The row of the annotations' numbers. */
const STRIP_H = 22;
/** The time axis under the rows: its tick marks and labels. */
const AXIS_H = 22;
const PAD_B = 4;
const PAD_X = 12;
/** The gap between the label column and the lane. */
const LANE_GAP = 8;
/** The least room a label keeps beside its icons. */
const MIN_LABEL_TEXT = 24;
/** The space between two axis labels, px. */
const AXIS_LABEL_GAP = 10;

const FONT_TITLE = 13;
const FONT_AXIS = 10;

/** The width of a mark's hover target, at least, px. */
const HIT_W = 6;

/**
 * TimelineChart - a Gantt chart of one run: time runs horizontally (IBCS UN
 * 3.3) and each ability or buff has a row of its own (UN 3.4). Casts are
 * ticks; a buff's uptime is a bar; a cooldown is a thin line. Numbered
 * annotations sit on the moments they explain, with an assisting line down to
 * the mark, and their text is listed under the chart by number (UN 2.4).
 *
 * It draws the rows it is given and derives nothing: the caller turns a
 * combat log - or a plan - into rows. The time axis is labelled at nice steps
 * (seconds, or minutes and seconds with `timeFormat="clock"`), with no grid
 * line. Rows carry icons before their labels, as `DataTable`'s do.
 *
 * Pure SVG, SSR-safe. A screen-reader table lists every row's moments and
 * intervals; its caption carries the notes.
 */
export const TimelineChart = forwardRef<SVGSVGElement, TimelineChartProps>(function TimelineChart(
  {
    rows: rowsProp,
    annotations,
    domain,
    timeFormat = "number",
    width = 640,
    rowHeight = 22,
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
  const hover = useChartHover<TimelineMark>();
  const marks = markInteraction(hover, tooltip, onHover);

  const domainStart = domain?.[0];
  const domainEnd = domain?.[1];
  const layout = useMemo(
    () =>
      computeTimeline(
        rowsProp ?? [],
        annotations ?? [],
        domainStart != null && domainEnd != null ? { domain: [domainStart, domainEnd] } : {},
      ),
    [rowsProp, annotations, domainStart, domainEnd],
  );
  const { start, end, rows } = layout;
  const notes = layout.annotations;

  // --- times as text ---------------------------------------------------------
  const clock = timeFormat === "clock";
  const compact = format.compact === true;
  const timeText = (t: number) =>
    clock
      ? formatClock(t, {
          fractionDigits: format.fractionDigits ?? 1,
          locale: format.locale,
          notAvailable: format.notAvailable,
        })
      : formatValue(t, { ...format, compact });
  const axisText = (t: number, digits: number) =>
    clock
      ? formatClock(t, { fractionDigits: digits, locale: format.locale })
      : formatValue(t, { ...format, compact, fractionDigits: digits });
  const rangeText = (from: number, to: number) => `${timeText(from)}–${timeText(to)}`;

  // --- vertical layout ---------------------------------------------------------
  const rowH = Math.max(14, Number.isFinite(rowHeight) ? rowHeight : 22);
  const n = rows.length;
  const padT = title ? HEADER_H : TOP_PAD;
  const stripTop = padT;
  const stripH = notes.length > 0 ? STRIP_H : 0;
  const rowsTop = stripTop + stripH;
  const axisY = rowsTop + n * rowH;
  const rowCy = (i: number) => rowsTop + i * rowH + rowH / 2;
  const tickH = Math.max(6, Math.min(12, rowH - 8));
  const activeH = Math.max(4, Math.min(8, rowH - 12));
  const waitingH = 2;
  const labelFont = Math.max(9, Math.min(11, rowH * 0.5));

  // --- horizontal layout: labels | lane ---------------------------------------
  const innerW = Math.max(width - PAD_X * 2, 1);
  const capW = Math.max(40, innerW * 0.35);
  const iconPx = rowIconPx(iconSize, rowH, Math.min(16, rowH - 6));
  const icons = layoutRowLabelIcons({
    rows,
    iconOf: (r) => r.source.icon,
    iconPx,
    maxSlot: capW - 6 - MIN_LABEL_TEXT,
    moreText: (count) => fillLabel(words.moreIcons, { count }),
    fontPx: labelFont,
    renderIcon,
    tokens,
  });
  const widestLabel = rows.reduce((w, r) => Math.max(w, estTextW(r.label, labelFont)), 0);
  const labelColW = Math.min(capW, Math.max(40, icons.labelInset + widestLabel + 2));
  const laneX0 = PAD_X + labelColW + LANE_GAP;
  const laneX1 = Math.max(width - PAD_X, laneX0 + 1);
  const laneW = laneX1 - laneX0;
  // Time → pixel; halves keep a range wider than the largest double finite.
  const halfSpan = end / 2 - start / 2;
  const xOf = (t: number) =>
    halfSpan > 0 ? laneX0 + ((t / 2 - start / 2) / halfSpan) * laneW : (laneX0 + laneX1) / 2;
  const inRange = (t: number) => t >= start && t <= end;

  // --- the time axis: as many nice ticks as their labels leave room for -------
  // Each label is centred on its tick and kept inside the chart; the ticks
  // thin out until no two labels, where they are written, come closer than
  // the gap. One label always fits.
  const axisTicks = (() => {
    const place = (ticks: number[]) => {
      const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 0;
      const digits = timeStepDigits(step);
      return ticks.map((t) => {
        const text = axisText(t, digits);
        const w = estTextW(text, FONT_AXIS);
        return { t, text, w, x: clampTo(xOf(t), w / 2 + 2, width - 2 - w / 2) };
      });
    };
    const fits = (labels: ReturnType<typeof place>) =>
      labels.every(
        (l, i) =>
          i === 0 || l.x - l.w / 2 >= labels[i - 1]!.x + labels[i - 1]!.w / 2 + AXIS_LABEL_GAP,
      );
    let count = Math.max(1, Math.floor(laneW / 60));
    for (let attempt = 0; attempt < 24; attempt++) {
      const labels = place(timeTicks(start, end, count, clock));
      if (fits(labels)) return labels;
      if (count === 1) return labels.slice(0, 1);
      const widest = labels.reduce((w, l) => Math.max(w, l.w), 0);
      count = Math.max(1, Math.min(count - 1, Math.floor(laneW / (widest + AXIS_LABEL_GAP))));
    }
    return place(timeTicks(start, end, 1, clock)).slice(0, 1);
  })();

  // --- annotations: numbers above the rows, side by side ----------------------
  const badges = (() => {
    const placed = notes
      .map((a) => {
        const r = badgeRadius(a.number);
        const onAxis = inRange(a.at);
        const at = onAxis ? xOf(a.at) : a.at < start ? laneX0 : laneX1;
        return { a, r, at, onAxis, cx: clampTo(at, laneX0 + r, laneX1 - r) };
      })
      .sort((p, q) => p.cx - q.cx || p.a.number - q.a.number);
    // Left to right, each at least its neighbour's radius and its own (+2 px)
    // past the one before; then back from the right edge.
    for (let i = 1; i < placed.length; i++) {
      const prev = placed[i - 1]!;
      const cur = placed[i]!;
      cur.cx = Math.max(cur.cx, prev.cx + prev.r + cur.r + 2);
    }
    for (let i = placed.length - 1; i >= 0; i--) {
      const cur = placed[i]!;
      const limit =
        i === placed.length - 1 ? laneX1 - cur.r : placed[i + 1]!.cx - placed[i + 1]!.r - cur.r - 2;
      cur.cx = Math.max(PAD_X + cur.r, Math.min(cur.cx, limit));
    }
    return placed;
  })();
  const badgeCy = stripTop + STRIP_H / 2;

  // --- notes under the axis ------------------------------------------------------
  const noteLines = layoutNotes(
    notes.map((a) => ({ number: a.number, text: a.text })),
    innerW,
  );
  const svgH = axisY + AXIS_H + notesHeight(noteLines) + PAD_B;

  // --- the screen-reader table and the description ---------------------------
  const description =
    ariaLabel ??
    (title
      ? `${title}. Timeline of ${n} rows, ${timeText(start)} to ${timeText(end)}.`
      : `Timeline of ${n} rows, ${timeText(start)} to ${timeText(end)}`);
  const a11yRows: ChartDataRow[] = rows.map((r) => ({
    label: [...rowIconsOf(r.source.icon).map((icon) => icon.alt ?? ""), r.label]
      .filter(Boolean)
      .join(", "),
    cells: [
      r.ticks.map(timeText).join(", "),
      r.spans
        .filter((s) => s.kind === "active")
        .map((s) => rangeText(s.from, s.to))
        .join(", "),
      r.spans
        .filter((s) => s.kind === "waiting")
        .map((s) => rangeText(s.from, s.to))
        .join(", "),
    ],
  }));

  const renderTooltip = () => {
    const h = hover.hovered;
    if (!tooltip || !h) return null;
    const m = h.datum;
    const row = rows[m.row];
    if (!row) return null;
    const tip: ChartTooltipRow[] =
      m.kind === "event"
        ? [{ label: words.event, value: timeText(m.from), strong: true }]
        : [
            {
              label: m.kind === "active" ? words.active : words.waiting,
              value: rangeText(m.from, m.to),
              strong: true,
            },
          ];
    return (
      <ChartTooltip
        ref={hover.tooltipRef}
        x={h.x}
        y={h.y}
        title={row.label}
        rows={tip}
        tokens={tokens}
      />
    );
  };

  const clipX = (x: number) => Math.min(laneX1, Math.max(laneX0, x));

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
        {title && (
          <text x={PAD_X} y={18} fontSize={FONT_TITLE} fontWeight={500} fill={tokens.color.text}>
            {fitLabel(title, innerW, FONT_TITLE)}
          </text>
        )}

        {/* Row rules, as a table's: between the rows, under the labels and lanes. */}
        {rows.slice(1).map((_, i) => (
          <line
            key={`rule-${i}`}
            x1={PAD_X}
            y1={rowsTop + (i + 1) * rowH}
            x2={laneX1}
            y2={rowsTop + (i + 1) * rowH}
            stroke={tokens.color.rowBorder}
            strokeWidth={1}
          />
        ))}

        {/* The annotations' assisting lines, under the marks so every mark stays whole. */}
        {badges.map(({ a, r, at, onAxis, cx }) => {
          if (!onAxis) return null;
          const endY = a.row != null ? rowCy(a.row) - tickH / 2 - 2 : axisY;
          const d =
            Math.abs(cx - at) > 0.5
              ? `M${cx},${badgeCy + r}L${at},${rowsTop}V${endY}`
              : `M${at},${badgeCy + r}V${endY}`;
          return (
            <path
              key={`assist-${a.number}`}
              d={d}
              fill="none"
              stroke={tokens.color.textMuted}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          );
        })}

        {/* The rows: label (icons, then text), then the lane's marks. */}
        {rows.map((row, i) => {
          const cy = rowCy(i);
          const waiting = row.spans.filter((s) => s.kind === "waiting");
          const active = row.spans.filter((s) => s.kind === "active");
          const ticks = row.ticks.filter(inRange);
          const visible = (s: { from: number; to: number }) => s.to >= start && s.from <= end;
          return (
            <g key={`row-${i}`}>
              {icons.draw(i, PAD_X, cy)}
              <text
                x={PAD_X + icons.labelInset}
                y={cy + labelFont * 0.34}
                fontSize={labelFont}
                fill={row.source.labelColor ?? tokens.color.text}
              >
                {fitLabel(row.label, labelColW - icons.labelInset, labelFont)}
                <title>
                  {[row.label, ...icons.dropped(i).map((icon) => icon.alt ?? "")]
                    .filter(Boolean)
                    .join(", ")}
                </title>
              </text>
              {waiting.filter(visible).map((s, j) => (
                <rect
                  key={`w-${j}`}
                  x={clipX(xOf(s.from))}
                  y={cy - waitingH / 2}
                  width={Math.max(clipX(xOf(s.to)) - clipX(xOf(s.from)), 1)}
                  height={waitingH}
                  fill={tokens.color.neutral}
                />
              ))}
              {active.filter(visible).map((s, j) => (
                <rect
                  key={`a-${j}`}
                  x={clipX(xOf(s.from))}
                  y={cy - activeH / 2}
                  width={Math.max(clipX(xOf(s.to)) - clipX(xOf(s.from)), 1)}
                  height={activeH}
                  fill={tokens.scenario.AC.fill}
                />
              ))}
              {/* Ticks over a thin surface halo, so a cast reads on a bar too:
                one path for the halos and one for the ink, however many casts. */}
              {ticks.length > 0 &&
                (() => {
                  const d = ticks
                    .map((t) => `M${xOf(t).toFixed(2)},${(cy - tickH / 2).toFixed(2)}v${tickH}`)
                    .join("");
                  return (
                    <>
                      <path d={d} fill="none" stroke={tokens.color.surface} strokeWidth={3.5} />
                      <path d={d} fill="none" stroke={tokens.color.text} strokeWidth={1.5} />
                    </>
                  );
                })()}
            </g>
          );
        })}

        {/* The time axis: a rule, a tick mark and a label at each step. */}
        <line
          x1={laneX0}
          y1={axisY}
          x2={laneX1}
          y2={axisY}
          stroke={tokens.color.axis}
          strokeWidth={1}
        />
        {axisTicks.map(({ t, text, x: labelX }, i) => {
          const x = xOf(t);
          return (
            <g key={`axis-${i}`}>
              <line
                x1={x}
                y1={axisY}
                x2={x}
                y2={axisY + 4}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              <text
                x={labelX}
                y={axisY + 15}
                fontSize={FONT_AXIS}
                fill={tokens.color.textMuted}
                textAnchor="middle"
              >
                {text}
              </text>
            </g>
          );
        })}

        {/* The annotations' numbers, over everything above the rows. */}
        {badges.map(({ a, cx }) => (
          <NoteBadge key={`badge-${a.number}`} cx={cx} cy={badgeCy} n={a.number} tokens={tokens} />
        ))}

        <NoteList lines={noteLines} x={PAD_X} y={axisY + AXIS_H} tokens={tokens} />

        {/* Hover targets: one per drawn mark. */}
        {marks.enabled &&
          rows.flatMap((row, i) => {
            const top = rowsTop + i * rowH;
            const target = (key: string, m: TimelineMark, x0: number, x1: number) => {
              const w = Math.max(x1 - x0, HIT_W);
              const x = (x0 + x1) / 2 - w / 2;
              const markRect = { x, y: rowCy(i) - tickH / 2, width: w, height: tickH };
              return (
                <rect
                  key={key}
                  x={x}
                  y={top}
                  width={w}
                  height={rowH}
                  fill="transparent"
                  {...marks.forMark({ category: row.label, value: m.from, datum: m }, [markRect])}
                />
              );
            };
            return [
              ...row.spans
                .filter((s) => s.to >= start && s.from <= end)
                .map((s, j) =>
                  target(
                    `hit-s-${i}-${j}`,
                    { row: i, kind: s.kind, from: s.from, to: s.to },
                    clipX(xOf(s.from)),
                    clipX(xOf(s.to)),
                  ),
                ),
              ...row.ticks
                .filter(inRange)
                .map((t, j) =>
                  target(
                    `hit-t-${i}-${j}`,
                    { row: i, kind: "event", from: t, to: t },
                    xOf(t),
                    xOf(t),
                  ),
                ),
            ];
          })}
      </svg>
      <ChartDataTable
        caption={[
          ariaLabel ?? (title ? `${title} - data table` : "Timeline - data table"),
          ...notes.map((a) => `${a.number} ${a.text}`),
        ].join(". ")}
        columns={[words.events, words.active, words.waiting]}
        rows={a11yRows}
      />
      {renderTooltip()}
    </>
  );
});
