/**
 * Histogram - a distribution of values counted in classes of identical width
 * (IBCS CH 1.3), the data behind `HistogramChart`.
 *
 * {@link computeHistogram} bins raw values by the Freedman-Diaconis rule,
 * bounded to a readable number of classes, and guarantees three things a
 * reader of the chart relies on:
 *  - every class has the same width;
 *  - the counts sum to n, the number of finite values;
 *  - the edges cover the values: the first edge is the smallest value and the
 *    last edge is at or above the largest.
 *
 * Bins computed elsewhere - an engine's own - come in as
 * {@link HistogramBins}: a start, one width and the counts, so a class of
 * another width cannot even be written down.
 *
 * Pure data, like the rest of `core/`: no React, no DOM, no clock, no
 * randomness. SSR-safe.
 */

/**
 * Classes of identical width: class `i` spans `[start + i * width,
 * start + (i + 1) * width)`, and the last class also holds its upper edge.
 */
export interface HistogramBins {
  /** The lower edge of the first class. */
  start: number;
  /**
   * The width of every class, ≥ 0. A width of 0 is one class at `start` that
   * holds every value (all values equal).
   */
  width: number;
  /** The number of values in each class, in order. */
  counts: readonly number[];
}

/** How {@link computeHistogram} chooses the number of classes. */
export interface HistogramOptions {
  /**
   * Use exactly this many classes instead of the rule (an integer from 1 to
   * 10,000; other numbers are rounded and clamped).
   */
  bins?: number;
  /** The fewest classes the rule may choose. Default 20. */
  minBins?: number;
  /** The most classes the rule may choose. Default 60. */
  maxBins?: number;
}

/** Values counted into classes, with the figures the counting used. */
export interface Histogram extends HistogramBins {
  counts: number[];
  /** The number of finite values counted; the counts sum to it. */
  n: number;
  /** The smallest value (NaN when there is none). */
  min: number;
  /** The largest value (NaN when there is none). */
  max: number;
  /**
   * The first quartile, by linear interpolation between the order statistics
   * (Hyndman and Fan's type 7, the default of R and NumPy); NaN when there is
   * no value. The middle half of the values lies from `q1` to `q3`.
   */
  q1: number;
  /** The third quartile (type 7, as `q1`). */
  q3: number;
}

/**
 * The mean of the values and the half-width of its interval, as the caller
 * computed them - e.g. a 95% confidence interval, 1.96 standard errors. The
 * chart draws them; it never derives an interval itself.
 */
export interface HistogramMean {
  /** The mean. */
  value: number;
  /** Half-width of the mean's interval, ≥ 0. Unset: the mean is drawn without one. */
  halfWidth?: number;
  /** The interval's level as a fraction, written after it: 0.95 → "(95%)". */
  level?: number;
}

/**
 * A range of the values - by default the middle half, from the first to the
 * third quartile. Unlike the mean's interval, it describes the values
 * themselves, not the uncertainty of an estimate.
 */
export interface HistogramSpread {
  /** One end of the range, in the values' units. */
  from: number;
  /** The other end (order does not matter). */
  to: number;
}

/** One class, resolved: its edges and its count. */
export interface HistogramBin {
  /** The class's position, from 0. */
  index: number;
  /** Its lower edge. */
  from: number;
  /** Its upper edge (the lower edge of the next class). */
  to: number;
  /** The number of values in it. */
  count: number;
}

/** The rule's default bounds (R33 of Forever Sim's spec: enough classes for a shape, few enough to label). */
const DEFAULT_MIN_BINS = 20;
const DEFAULT_MAX_BINS = 60;
/** A hard ceiling on the number of classes, so a stray option cannot allocate millions. */
const MAX_BINS = 10_000;

/** A caller-given class count as an integer from 1 to {@link MAX_BINS}, or undefined. */
function binCountOf(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const k = Math.round(value);
  return k >= 1 ? Math.min(k, MAX_BINS) : undefined;
}

/**
 * The `p`-quantile of ascending `sorted` values, by linear interpolation
 * between the order statistics (type 7). NaN for no values.
 */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = (n - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(h);
  const a = sorted[lo]!;
  const b = sorted[Math.min(lo + 1, n - 1)]!;
  return h === lo ? a : a + (h - lo) * (b - a);
}

/** The next double above a positive width. */
function nextUp(width: number): number {
  const next = width * (1 + Number.EPSILON);
  return next > width ? next : width + Number.MIN_VALUE;
}

/**
 * Edge `i` of classes of `width` from `start`: `start + i * width`. Where that
 * sum overflows - a range wider than the largest double, e.g. from -1e308 to
 * 1e308 - the same edge is taken from halves, which halving keeps exact, so
 * the result is the plain sum wherever the plain sum is finite.
 *
 * Internal plumbing shared by the counting and the renderer - not part of
 * the public surface.
 */
export function histogramEdge(start: number, width: number, i: number): number {
  const edge = start + i * width;
  return Number.isFinite(edge) ? edge : (start / 2 + i * (width / 2)) * 2;
}

/**
 * The class `value` falls in: the `i` with edge `i` <= `value` < edge
 * `i + 1`, on the same floating-point edges a renderer draws
 * ({@link histogramEdge}), and the last class for a value on the last edge.
 * `value` must lie within the edges.
 */
function classOf(value: number, start: number, width: number, k: number): number {
  let i = Math.floor((value / 2 - start / 2) / (width / 2));
  if (!(i >= 0)) i = 0;
  else if (i > k - 1) i = k - 1;
  while (i > 0 && value < histogramEdge(start, width, i)) i--;
  while (i < k - 1 && value >= histogramEdge(start, width, i + 1)) i++;
  return i;
}

/**
 * Count values into classes of identical width.
 *
 * The number of classes follows the Freedman-Diaconis rule: a width of
 * h = 2 * IQR * n^(-1/3), so k = ceil((max - min) / h) classes, bounded to
 * [`minBins`, `maxBins`] (default 20 to 60; a spread with no middle half - an
 * IQR of 0 - takes `maxBins`). `bins` fixes k instead. The width is then
 * (max - min) / k, nudged up by the last unit of rounding when needed so the
 * last edge is never below the largest value. Each class counts the values in
 * [lower, upper); the last class also counts its upper edge.
 *
 * Non-finite values (NaN, ±Infinity) are left out, and `n` counts the rest.
 * No values give no classes (`n` 0, NaN figures); values that are all equal
 * give one class of width 0 at that value, holding all of them.
 *
 * For a few dozen values, pass a smaller `minBins`: twenty classes are meant
 * for a distribution of hundreds or thousands.
 */
export function computeHistogram(
  values: readonly number[],
  options: HistogramOptions = {},
): Histogram {
  const finite: number[] = [];
  for (const v of values ?? []) if (Number.isFinite(v)) finite.push(v);
  const n = finite.length;
  if (n === 0) {
    return { start: 0, width: 0, counts: [], n: 0, min: NaN, max: NaN, q1: NaN, q3: NaN };
  }

  const sorted = [...finite].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[n - 1]!;
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  if (max === min) {
    return { start: min, width: 0, counts: [n], n, min, max, q1, q3 };
  }

  let k = binCountOf(options.bins);
  if (k == null) {
    const lo = binCountOf(options.minBins) ?? DEFAULT_MIN_BINS;
    const hi = Math.max(lo, binCountOf(options.maxBins) ?? DEFAULT_MAX_BINS);
    // (max - min) / h with h = 2 * IQR * n^(-1/3), from halves so that values
    // near ±Number.MAX_VALUE cannot overflow. No middle half: as many as allowed.
    const halfIqr = q3 / 2 - q1 / 2;
    const raw = halfIqr > 0 ? ((max / 2 - min / 2) / halfIqr) * (Math.cbrt(n) / 2) : Infinity;
    k = Math.min(hi, Math.max(lo, Number.isFinite(raw) ? Math.ceil(raw) : hi));
  }
  // A range wider than the largest double needs two classes for a finite width.
  if (!Number.isFinite(max - min)) k = Math.max(k, 2);

  let width = max / k - min / k;
  while (histogramEdge(min, width, k) < max) width = nextUp(width);

  const counts = new Array<number>(k).fill(0);
  for (const v of finite) counts[classOf(v, min, width, k)]! += 1;
  return { start: min, width, counts, n, min, max, q1, q3 };
}

/** Bins as the chart draws them: sanitized, with n. */
export interface ResolvedHistogramBins {
  start: number;
  width: number;
  counts: number[];
  /** The sum of the counts. */
  n: number;
}

/**
 * Bins as the chart draws them. A count that is negative or not finite counts
 * as 0; a width of 0 is one class holding the sum of the counts. Null when
 * there is nothing to draw: no counts, or a start or width that is not a
 * finite number (≥ 0 for the width).
 *
 * Internal plumbing shared by the renderer - not part of the public surface.
 */
export function resolveHistogramBins(
  bins: HistogramBins | null | undefined,
): ResolvedHistogramBins | null {
  if (!bins || !Array.isArray(bins.counts) || bins.counts.length === 0) return null;
  const { start, width } = bins;
  if (!Number.isFinite(start) || !Number.isFinite(width) || width < 0) return null;
  const counts = bins.counts.map((c) => (Number.isFinite(c) && c > 0 ? c : 0));
  const n = counts.reduce((sum, c) => sum + c, 0);
  return width === 0 ? { start, width: 0, counts: [n], n } : { start, width, counts, n };
}

/**
 * Every class of resolved bins with its edges: class `i` from edge `i` to
 * edge `i + 1` ({@link histogramEdge}: `start + i * width`) - the edges
 * {@link computeHistogram} counted against. A width of 0 is one class from
 * `start` to `start`.
 *
 * Internal plumbing shared by the renderer - not part of the public surface.
 */
export function histogramBinList(bins: ResolvedHistogramBins): HistogramBin[] {
  const { start, width, counts } = bins;
  return counts.map((count, index) => ({
    index,
    from: histogramEdge(start, width, index),
    to: histogramEdge(start, width, index + 1),
    count,
  }));
}
