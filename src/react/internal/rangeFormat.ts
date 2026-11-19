import { formatValue, type FormatOptions } from "../../core/format";

/**
 * Number formats that never write two different values alike where a reader
 * compares them: the two ends of a range, or neighbouring times on an axis.
 * A compact format names thousands ("1.4K"), so 1,397 and 1,413 - a band's
 * two ends - would both read "1.4K", and the width of the band is lost.
 *
 * Internal module: not part of the public API surface.
 */

/** The two ends of a range. */
export interface RangeEnds {
  low: number;
  high: number;
}

/** The most fraction digits these rules add (Intl's portable maximum). */
const MAX_DIGITS = 20;

/** The caller's `fractionDigits`, clamped to 0-20, or undefined when unset. */
export function callerDigits(format: FormatOptions): number | undefined {
  return Number.isFinite(format.fractionDigits)
    ? Math.min(MAX_DIGITS, Math.max(0, Math.round(format.fractionDigits!)))
    : undefined;
}

/**
 * The fewest fraction digits, from `from` up to 20, at which the two values
 * of every pair are written differently by `write`; 20 when no count does.
 * Bounded by the 21 counts, never by the values.
 */
export function digitsApart(
  pairs: ReadonlyArray<readonly [number, number]>,
  write: (value: number, digits: number) => string,
  from = 0,
): number {
  for (let d = Math.max(0, from); d < MAX_DIGITS; d++) {
    if (pairs.every(([a, b]) => write(a, d) !== write(b, d))) return d;
  }
  return MAX_DIGITS;
}

/** The neighbours of the distinct finite values, in ascending order: the pairs a reader compares. */
export function neighbours(values: Iterable<number>): Array<[number, number]> {
  const sorted = [...new Set([...values].filter(Number.isFinite))].sort((a, b) => a - b);
  return sorted.slice(1).map((v, i) => [sorted[i]!, v]);
}

/**
 * The options a chart writes its ranges' ends with. In full unless the caller
 * sets `compact: true`: at the caller's `fractionDigits`, else at one decimal
 * place past the first significant digit of the narrowest range (a range 1.5
 * wide → 1 digit, 82.2 wide → 0), so its two ends are at least ten units of
 * the last digit apart and never read alike, and a narrowing range keeps its
 * width readable. When no range has any width, the smallest gap between the
 * values takes its place, so ranges at 910.84 and 911.26 do not both read
 * "911". With `compact: true`, at the caller's digits or more: the fewest (up
 * to 20) at which every range's two ends read apart - or, when no range has
 * any width, every two neighbouring values.
 */
export function rangeFormat(format: FormatOptions, ranges: readonly RangeEnds[]): FormatOptions {
  const own = callerDigits(format);
  const wide = ranges.filter((r) => Number.isFinite(r.low) && r.high > r.low);
  const pairs: Array<readonly [number, number]> =
    wide.length > 0
      ? wide.map((r) => [r.low, r.high] as const)
      : neighbours(ranges.flatMap((r) => [r.low, r.high]));
  if (format.compact !== true) {
    // Halves keep a width wider than the largest double finite.
    const narrowest = pairs.reduce((w, [a, b]) => Math.min(w, b / 2 - a / 2), Infinity) * 2;
    const widthDigits =
      Number.isFinite(narrowest) && narrowest > 0
        ? Math.min(MAX_DIGITS, Math.max(0, Math.ceil(-Math.log10(narrowest)) + 1))
        : 0;
    return { ...format, compact: false, fractionDigits: own ?? widthDigits };
  }
  const digits = digitsApart(
    pairs,
    (v, d) => formatValue(v, { ...format, compact: true, fractionDigits: d }),
    own ?? 0,
  );
  return { ...format, compact: true, fractionDigits: digits };
}
