import { useMemo } from "react";
import type { Variance } from "../../core/types";
import { computeVariance } from "../../core/variance";

/**
 * Memoized {@link computeVariance}: the AC-vs-base delta for one pair of values.
 * Returns `null` when either side is missing (same contract as the core helper).
 *
 * ```tsx
 * const v = useVariance(actual, plan, line.higherIsBetter);
 * // v: { abs, pct, favorable } | null
 * ```
 */
export function useVariance(
  current: number | undefined,
  base: number | undefined,
  higherIsBetter = true,
): Variance | null {
  return useMemo(
    () => computeVariance(current, base, higherIsBetter),
    [current, base, higherIsBetter],
  );
}

/**
 * The same comparison applied across two parallel arrays - one {@link Variance}
 * (or `null`) per index, computed `data[i]` vs `comparison[i]`. Lengths may
 * differ; the result has the length of `data` and pairs missing entries as
 * `null`. Memoized against the arrays and `higherIsBetter`.
 *
 * ```tsx
 * const variances = useVariances(acValues, pyValues, true);
 * ```
 */
export function useVariances(
  data: ReadonlyArray<number | undefined>,
  comparison: ReadonlyArray<number | undefined>,
  higherIsBetter = true,
): Array<Variance | null> {
  return useMemo(
    () => data.map((value, i) => computeVariance(value, comparison[i], higherIsBetter)),
    [data, comparison, higherIsBetter],
  );
}
