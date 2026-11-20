/**
 * Timeline - rows of moments and intervals on one horizontal time axis (a
 * Gantt chart), the data behind `TimelineChart`: one row per ability or buff,
 * its casts as ticks, its buffs and cooldowns as spans, and numbered
 * annotations at the moments a reader should look at (IBCS UN 3.3: time runs
 * horizontally; UN 2.4: annotations linked to the marks by numbers).
 *
 * The chart draws the rows it is given. Deriving them - from a combat log, a
 * project plan - is the caller's work: this module only cleans and orders
 * them, and finds the time range they cover.
 *
 * Pure data, like the rest of `core/`: no React, no DOM, no clock, no
 * randomness. SSR-safe.
 */

import type { RowIcon } from "./rowIcon";

/**
 * How a span reads: `"active"` while the row's thing is on - a buff up, a
 * cast or a channel - drawn as a bar; `"waiting"` while it cannot be used -
 * a cooldown - drawn as a thin, light line.
 */
export type TimelineSpanKind = "active" | "waiting";

/** An interval of one row, in the chart's time units. */
export interface TimelineSpan {
  /** One end. */
  from: number;
  /** The other end (order does not matter). */
  to: number;
  /** `"active"` (default) or `"waiting"`. See {@link TimelineSpanKind}. */
  kind?: TimelineSpanKind;
}

/** One row of the timeline: an ability, a buff, a task. */
export interface TimelineRow {
  /** The row's name, written before its lane. */
  label: string;
  /** Moments, drawn as ticks - e.g. the casts of an ability. */
  ticks?: readonly number[];
  /** Intervals, drawn as spans - e.g. a buff's uptime, an ability's cooldown. */
  spans?: readonly TimelineSpan[];
  /**
   * A small picture before the label - a spell icon - or several, as chips.
   * Drawn at the chart's `iconSize`, never above `naturalSize / pixelRatio`
   * CSS px; an icon's `alt` joins the label in the screen-reader table. See
   * {@link RowIcon}.
   */
  icon?: RowIcon | readonly RowIcon[];
  /**
   * The label's colour. Default the theme's text colour. It is data, not
   * themed: pick one that keeps its contrast on every surface you use.
   */
  labelColor?: string;
}

/**
 * A numbered note at one moment. Its number is drawn above the rows, with an
 * assisting line down to the moment; its text is written beside the same
 * number under the chart.
 */
export interface TimelineAnnotation {
  /** The moment, in the chart's time units. */
  at: number;
  /** The note. */
  text: string;
  /**
   * The row whose mark it explains, by its index in `rows`: the assisting
   * line ends just above that row's marks. Unset (or not a row): the line
   * crosses every row down to the time axis.
   */
  row?: number;
}

/** How {@link computeTimeline} chooses the time range. */
export interface TimelineOptions {
  /**
   * The time range drawn, `[start, end]` - e.g. `[0, fightLength]`. Default
   * the earliest to the latest moment among the ticks, the span ends and the
   * annotations. Marks outside a given range are clipped to it (a span) or not
   * drawn (a tick); the screen-reader table still lists them.
   */
  domain?: readonly [number, number];
}

/** A span as the chart draws it: finite ends in order, and its kind. */
export interface TimelineLayoutSpan {
  from: number;
  to: number;
  kind: TimelineSpanKind;
}

/** A row as the chart draws it. */
export interface TimelineLayoutRow {
  /** The row's position, from 0. */
  index: number;
  label: string;
  /** The finite ticks, earliest first. */
  ticks: number[];
  /** The spans with finite ends, `from` ≤ `to`, earliest first. */
  spans: TimelineLayoutSpan[];
  /** The row as given. */
  source: TimelineRow;
}

/** An annotation as the chart draws it. */
export interface TimelineLayoutAnnotation {
  /** Its number, from 1, in the order given. */
  number: number;
  at: number;
  text: string;
  /** The row it points to, or null for one that crosses every row. */
  row: number | null;
}

/** One mark of a timeline, as the chart's hover reports it. */
export interface TimelineMark {
  /** The row's position in `rows`. */
  row: number;
  /** `"event"` for a tick, else the span's kind. */
  kind: "event" | TimelineSpanKind;
  /** The tick's moment, or the span's start. */
  from: number;
  /** The tick's moment again, or the span's end. */
  to: number;
}

/** The cleaned rows and annotations, and the time range they are drawn on. */
export interface TimelineLayout {
  /** The time range's start. */
  start: number;
  /** Its end (≥ start; equal when every moment is the same). */
  end: number;
  rows: TimelineLayoutRow[];
  /** The annotations with a finite moment, numbered in the order given. */
  annotations: TimelineLayoutAnnotation[];
}

/**
 * Clean and measure a timeline: each row's finite ticks, earliest first; its
 * spans with finite ends, put in order and sorted; the annotations with a
 * finite moment, numbered from 1 in the order given; and the time range -
 * `options.domain` when it holds two finite numbers, else the earliest to the
 * latest moment of all of them. With no moment at all the range is 0 to 1.
 *
 * Non-finite moments (NaN, ±Infinity) are left out, as everywhere in the
 * library. The function computes no statistic and moves no moment.
 */
export function computeTimeline(
  rows: readonly TimelineRow[],
  annotations: readonly TimelineAnnotation[] = [],
  options: TimelineOptions = {},
): TimelineLayout {
  let lo = Infinity;
  let hi = -Infinity;
  const see = (t: number) => {
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  };

  const layoutRows: TimelineLayoutRow[] = (rows ?? []).map((row, index) => {
    const ticks = (row.ticks ?? []).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
    const spans: TimelineLayoutSpan[] = (row.spans ?? [])
      .filter((s) => s != null && Number.isFinite(s.from) && Number.isFinite(s.to))
      .map((s) => ({
        from: Math.min(s.from, s.to),
        to: Math.max(s.from, s.to),
        kind: s.kind === "waiting" ? ("waiting" as const) : ("active" as const),
      }))
      .sort((a, b) => a.from - b.from || a.to - b.to);
    for (const t of ticks) see(t);
    for (const s of spans) {
      see(s.from);
      see(s.to);
    }
    return { index, label: row.label, ticks, spans, source: row };
  });

  const layoutAnnotations: TimelineLayoutAnnotation[] = [];
  for (const a of annotations ?? []) {
    if (a == null || !Number.isFinite(a.at)) continue;
    see(a.at);
    const row =
      a.row != null && Number.isInteger(a.row) && a.row >= 0 && a.row < layoutRows.length
        ? a.row
        : null;
    layoutAnnotations.push({ number: layoutAnnotations.length + 1, at: a.at, text: a.text, row });
  }

  const given = options.domain;
  let start: number;
  let end: number;
  if (given && Number.isFinite(given[0]) && Number.isFinite(given[1])) {
    start = Math.min(given[0], given[1]);
    end = Math.max(given[0], given[1]);
  } else if (lo <= hi) {
    start = lo;
    end = hi;
  } else {
    start = 0;
    end = 1;
  }
  return { start, end, rows: layoutRows, annotations: layoutAnnotations };
}

/** Options of {@link formatClock}. */
export interface ClockFormatOptions {
  /** Fraction digits of the seconds, an integer from 0 to 9. Default 0. */
  fractionDigits?: number;
  /** Locale of the digits and the decimal separator. Default "en-US". */
  locale?: string;
  /** The text for a time that is not a finite number. Default "n/a". */
  notAvailable?: string;
}

/** One cached formatter per locale, digit count and integer width. */
const clockFormatters = new Map<string, Intl.NumberFormat>();

function clockPart(locale: string, digits: number, minInt: number): Intl.NumberFormat {
  const key = `${locale}|${digits}|${minInt}`;
  let f = clockFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumIntegerDigits: minInt,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
    });
    clockFormatters.set(key, f);
  }
  return f;
}

/**
 * A time in seconds as a clock - "0:05", "1:30", "12:00", "1:02:03" (hours
 * from the first full hour) - with `fractionDigits` digits of the seconds
 * ("1:05.5"), and "-0:05" for a time before zero. Rounding is half away from
 * zero on the whole time, so 59.96 s at one digit is "1:00.0". The digits and
 * the decimal separator follow `locale` ("1:05,5" in sr-Latn).
 */
export function formatClock(seconds: number, options: ClockFormatOptions = {}): string {
  if (!Number.isFinite(seconds)) return options.notAvailable ?? "n/a";
  const fd = options.fractionDigits;
  const digits = fd != null && Number.isFinite(fd) ? Math.min(9, Math.max(0, Math.round(fd))) : 0;
  const locale = options.locale ?? "en-US";
  const scale = 10 ** digits;
  // Whole units of the last digit, so a carry (59.96 → 60.0) reaches the minutes.
  const units = Math.round(Math.abs(seconds) * scale);
  const whole = Math.floor(units / scale);
  const fraction = (units - whole * scale) / scale;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole - h * 3600) / 60);
  const s = whole - h * 3600 - m * 60 + fraction;
  const sec = clockPart(locale, digits, 2).format(s);
  const body =
    h > 0
      ? `${clockPart(locale, 0, 1).format(h)}:${clockPart(locale, 0, 2).format(m)}:${sec}`
      : `${clockPart(locale, 0, 1).format(m)}:${sec}`;
  return seconds < 0 && units > 0 ? `-${body}` : body;
}

/** Time steps for a clock axis, in seconds: 1, 2, 5, 10, 15 and 30 s; 1, 2, 5, 10, 15 and 30 min; 1, 2, 3, 6 and 12 h; a day. */
const CLOCK_STEPS = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400,
];

/**
 * The smallest "nice" step of at least `raw`: 1, 2 or 5 times a power of ten;
 * on a clock axis (`clock`), a step of {@link CLOCK_STEPS} from one second to
 * a day. NaN when `raw` is not a finite number > 0.
 */
export function niceTimeStep(raw: number, clock = false): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return NaN;
  if (clock && raw >= 1 && raw <= 86400) {
    for (const step of CLOCK_STEPS) if (step >= raw) return step;
  }
  if (clock && raw > 86400) return 86400 * niceTimeStep(raw / 86400);
  let pow = 10 ** Math.floor(Math.log10(raw));
  // log10 may round across a power of ten; one correction either way.
  if (pow > raw) pow /= 10;
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/**
 * The fraction digits a step needs to be written exactly: 0 for a whole
 * step, 1 for 0.5 or 0.2, 2 for 0.05 (at most 20).
 */
export function timeStepDigits(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  for (let d = 0; d < 20; d++) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) <= 1e-9 * Math.max(1, scaled)) return d;
  }
  return 20;
}

/**
 * Axis ticks from `start` to `end`: the multiples of {@link niceTimeStep}
 * `((end - start) / count)` that lie within the range, at most `count + 1`
 * of them. A range of zero width gives `[start]` alone. On a range so narrow
 * at its distance from zero that two steps land on one double, a tick that
 * repeats is skipped and the walk goes on to the range's end. The loop is
 * bounded by `count`, never by the range.
 */
export function timeTicks(start: number, end: number, count: number, clock = false): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const n = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  const span = end / 2 - start / 2;
  if (!(span > 0)) return [start];
  const step = niceTimeStep((span * 2) / n, clock);
  if (!(step > 0) || !Number.isFinite(step)) return [start];
  const first = Math.ceil(start / step) * step;
  const digits = timeStepDigits(step);
  const out: number[] = [];
  for (let j = 0; j <= n + 1; j++) {
    const raw = first + j * step;
    if (raw > end + step * 1e-9) break;
    // Written at the step's own precision: snaps away the residue of the
    // multiplication (0.1 * 3), and makes a zero tick exactly 0.
    const v = digits <= 20 && Math.abs(raw) < 1e21 ? Number(raw.toFixed(digits)) : raw;
    if (out.length > 0 && v <= out[out.length - 1]!) continue;
    if (v >= start - step * 1e-9) out.push(v);
  }
  return out.length > 0 ? out : [start];
}
