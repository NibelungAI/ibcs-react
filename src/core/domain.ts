/**
 * Shared value-domain helpers for the layout modules.
 *
 * POLICY — non-finite values (NaN, ±Infinity) are treated as MISSING data:
 * they never widen a domain, never accumulate into a running total, and format
 * as "n/a" at the presentation layer. Every layout module routes its domain
 * tracking through these helpers so degenerate input (empty, all-zero,
 * all-negative, NaN-laced) always yields a finite, renderable axis.
 *
 * Internal module: intentionally NOT re-exported from the public barrel.
 */

/** A value-axis extent in VALUE units. `min <= 0 <= max` when zero-seeded. */
export interface ValueDomain {
  domainMin: number;
  domainMax: number;
}

/** `v` when it is a finite number, else `fallback` (default 0). */
export function finiteOr(v: number | null | undefined, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** True for a usable, finite number. Narrowing guard for domain tracking. */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Repair a tracked `[min, max]` pair so it is always finite and renderable:
 *  - non-finite ends collapse to 0 (missing data never poisons the axis)
 *  - an EMPTY domain (`0/0` after zero-seeded tracking) widens to `[0, 1]`
 *
 * This replaces the old `domainMax || 1` idiom, which mangled all-negative
 * data: a legitimate `[-500, 0]` was "rescued" to `[-500, 1]` — harmless — but
 * `[-0.5, 0]` (losses, ratios) became `[-0.5, 1]`, wasting most of the plot.
 */
export function normalizeDomain(domainMin: number, domainMax: number): ValueDomain {
  let mn = Number.isFinite(domainMin) ? domainMin : 0;
  let mx = Number.isFinite(domainMax) ? domainMax : 0;
  if (mn > mx) [mn, mx] = [mx, mn];
  if (mn === 0 && mx === 0) mx = 1;
  return { domainMin: mn, domainMax: mx };
}

/**
 * Zero-inclusive value domain over a stream of possibly-missing values.
 * Non-finite entries are skipped; an empty/all-zero stream yields `[0, 1]`.
 */
export function valueDomain(values: Iterable<number | null | undefined>): ValueDomain {
  let mn = 0;
  let mx = 0;
  for (const v of values) {
    if (!isFiniteNumber(v)) continue;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return normalizeDomain(mn, mx);
}
