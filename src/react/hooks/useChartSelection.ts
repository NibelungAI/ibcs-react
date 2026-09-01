import { useCallback, useMemo, useState } from "react";
import type { ScenarioKey } from "../../core/types";

/**
 * The payload handed to a chart's `onSelect` when a user clicks an interactive
 * mark (a column, bar or stacked segment). `datum` is the original data row the
 * mark was rendered from, so a consumer can read any field it likes.
 *
 * `D` is the chart's datum type (e.g. `ColumnDatum`, `StructureDatum`).
 */
export interface ChartSelection<D = unknown> {
  /** The clicked category / component label (the chart's x-key). */
  category: string;
  /** The scenario the clicked mark represents, when meaningful (AC, PY, …). */
  scenario?: ScenarioKey;
  /** The numeric value of the clicked mark. */
  value: number;
  /** The original datum the mark was rendered from. */
  datum: D;
}

/**
 * The selection state + helpers returned by {@link useChartSelection}.
 *
 * `K` is your key type - usually the `category` string, but anything works.
 */
export interface UseChartSelectionResult<K> {
  /** The current selection as a read-only set. */
  selected: ReadonlySet<K>;
  /** Whether `key` is currently selected. */
  isSelected: (key: K) => boolean;
  /** Add `key` if absent, remove it if present. */
  toggle: (key: K) => void;
  /** Clear the whole selection. */
  clear: () => void;
  /** Replace the selection with exactly `keys`. */
  set: (keys: Iterable<K>) => void;
}

/**
 * A tiny, framework-free selection model for click-to-filter interactions:
 * pair it with a chart's `onSelect` to drive cross-filtering, highlighting or a
 * drill-down panel. Holds a `Set` of selected keys with ergonomic helpers.
 * SSR-safe - pure `useState`, no DOM access.
 *
 * ```tsx
 * const sel = useChartSelection<string>();
 * <VarianceColumnChart
 *   data={data}
 *   onSelect={(info) => sel.toggle(info.category)}
 *   tokens={{ ... }}
 * />
 * // elsewhere: filter a table by sel.isSelected(row.category)
 * ```
 */
export function useChartSelection<K = string>(initial?: Iterable<K>): UseChartSelectionResult<K> {
  const [selected, setSelected] = useState<Set<K>>(() => new Set(initial));

  const isSelected = useCallback((key: K) => selected.has(key), [selected]);

  const toggle = useCallback((key: K) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const set = useCallback((keys: Iterable<K>) => setSelected(new Set(keys)), []);

  return useMemo(
    () => ({ selected, isSelected, toggle, clear, set }),
    [selected, isSelected, toggle, clear, set],
  );
}
