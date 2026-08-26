import { useCallback, useMemo, useState } from "react";

/**
 * The filter state + setters returned by {@link useFilters}.
 *
 * `F` is your filter shape — e.g.
 * `{ comparison: "PY" | "PL"; period: string; mode: "flow" | "stock" }`.
 */
export interface UseFiltersResult<F> {
  /** The current filter object. */
  filters: F;
  /** Set one key (type-checked against `F`). */
  setFilter: <K extends keyof F>(key: K, value: F[K]) => void;
  /** Merge a partial patch over the current filters. */
  patch: (partial: Partial<F>) => void;
  /** Restore the initial filters. */
  reset: () => void;
}

/**
 * Generic report-filter state: scenario / comparison / period / dimension
 * selections, all in one typed object with ergonomic setters. Framework-free
 * logic, no schema — `F` is whatever you pass as `initial`.
 *
 * ```tsx
 * const { filters, setFilter, patch, reset } = useFilters({ comparison: "PY", period: "FY", mode: "flow" });
 * setFilter("comparison", "PL");
 * patch({ period: "Q4" });
 * ```
 */
export function useFilters<F extends object>(initial: F): UseFiltersResult<F> {
  // Snapshot the initial value once so `reset()` is stable across renders.
  const [initialFilters] = useState<F>(initial);
  const [filters, setFilters] = useState<F>(initial);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patch = useCallback((partial: Partial<F>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  return useMemo(() => ({ filters, setFilter, patch, reset }), [filters, setFilter, patch, reset]);
}
