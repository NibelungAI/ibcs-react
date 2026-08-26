import { useCallback, useMemo, useState } from "react";
import type { ScenarioKey, StatementLine, WaterfallRow } from "../../core/types";
import { flattenVisible, computeWaterfall, computeLevels } from "../../core/layout";
import { toIdSet } from "../internal/ids";

/**
 * Options for {@link useStatement}.
 */
export interface UseStatementOptions {
  /**
   * Statement kind. "flow" (default) is the integrated waterfall — each line
   * moves a running total (a P&L). "stock" is the balance-sheet view: each line
   * is an absolute level (ending balance), no running total.
   */
  mode?: "flow" | "stock";
  /** Scenario laid out as the waterfall / levels. Default "AC". */
  scenario?: ScenarioKey;
  /**
   * Group ids collapsed on mount — the uncontrolled seed. When provided this is
   * used verbatim; otherwise each line's `defaultCollapsed` flag seeds the set.
   * Ignored once `collapsed` is provided.
   */
  defaultCollapsed?: readonly string[];
  /**
   * Collapsed group ids as a CONTROLLED value: when provided the hook stops
   * owning the state and simply reflects this set — `toggle` / `expandAll` /
   * `collapseAll` report the next set through `onCollapsedChange` for the
   * caller to apply (URL sync, persistence, two views kept in step).
   */
  collapsed?: ReadonlySet<string> | readonly string[];
  /**
   * Fired with the NEXT collapsed ids (sorted) on every toggle / expandAll /
   * collapseAll. Required for controlled mode; in uncontrolled mode it is a
   * plain observer of the internal state.
   */
  onCollapsedChange?: (collapsedIds: string[]) => void;
}

/**
 * The collapse/expand + layout state returned by {@link useStatement}.
 */
export interface UseStatementResult {
  /** Computed waterfall (or levels) rows for the currently-visible model. */
  rows: WaterfallRow[];
  /**
   * Ids of collapsed groups (the controlled `collapsed` option when given).
   * Treat as read-only; mutate via the helpers.
   */
  collapsed: Set<string>;
  /** Toggle a single group's collapsed state. */
  toggle: (id: string) => void;
  /** True when `id` is currently collapsed. */
  isCollapsed: (id: string) => boolean;
  /** Expand every group. */
  expandAll: () => void;
  /** Collapse every group that has children. */
  collapseAll: () => void;
  /**
   * Ids of every collapsible group (a line with children, at any depth), in
   * document order — what `collapseAll` collapses. Empty when the statement is
   * flat, which is the cue to hide an expand/collapse toolbar entirely.
   */
  groupIds: string[];
  /** True when every group is collapsed (and there is at least one). */
  allCollapsed: boolean;
  /** True when nothing is collapsed. */
  allExpanded: boolean;
  /** Most negative point on the value axis (≤ 0). */
  domainMin: number;
  /** Most positive point on the value axis (≥ 0). */
  domainMax: number;
}

/** Collect the ids of every line that has children (i.e. every collapsible group). */
function collectGroupIds(lines: StatementLine[], out: string[] = []): string[] {
  for (const line of lines) {
    if (line.children?.length) {
      out.push(line.id);
      collectGroupIds(line.children, out);
    }
  }
  return out;
}

/** Seed the collapsed set from `defaultCollapsed`, else from the lines' flags. */
function seedCollapsed(lines: StatementLine[], defaultCollapsed?: readonly string[]): Set<string> {
  const set = new Set<string>(defaultCollapsed ?? []);
  if (defaultCollapsed) return set;
  const walk = (ls: StatementLine[]) => {
    for (const l of ls) {
      if (l.defaultCollapsed) set.add(l.id);
      if (l.children) walk(l.children);
    }
  };
  walk(lines);
  return set;
}

/**
 * Owns a statement's collapse/expand state and derives its waterfall (or stock
 * levels) layout — literally the engine {@link StatementTable} runs on, so a
 * custom statement view behaves exactly like the built-in one. Flatten +
 * waterfall/levels are memoized against the model, the collapsed set, the
 * scenario and the mode, so re-renders are cheap.
 *
 * Uncontrolled by default (seed it with `defaultCollapsed`); pass `collapsed` +
 * `onCollapsedChange` to own the state yourself, exactly like the tables.
 *
 * ```tsx
 * const { rows, toggle, isCollapsed, domainMax } = useStatement(lines, { mode: "flow", scenario: "AC" });
 * ```
 */
export function useStatement(
  lines: StatementLine[],
  opts: UseStatementOptions = {},
): UseStatementResult {
  const {
    mode = "flow",
    scenario = "AC",
    defaultCollapsed,
    collapsed: collapsedProp,
    onCollapsedChange,
  } = opts;

  // Seed once; `defaultCollapsed` is an initial value, not a controlled prop.
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState<Set<string>>(() =>
    seedCollapsed(lines, defaultCollapsed),
  );
  const controlled = collapsedProp !== undefined;
  const controlledCollapsed = useMemo(
    () => (collapsedProp === undefined ? null : toIdSet(collapsedProp)),
    [collapsedProp],
  );
  const collapsed = controlledCollapsed ?? uncontrolledCollapsed;

  /**
   * The single write path: controlled mode only reports the next value,
   * uncontrolled mode applies it and reports it too (observer, like onChange on
   * an uncontrolled input).
   */
  const commit = useCallback(
    (next: Set<string>) => {
      if (!controlled) setUncontrolledCollapsed(next);
      onCollapsedChange?.([...next].sort());
    },
    [controlled, onCollapsedChange],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      commit(next);
    },
    [collapsed, commit],
  );

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed]);

  const groupIds = useMemo(() => collectGroupIds(lines), [lines]);

  const expandAll = useCallback(() => commit(new Set()), [commit]);

  const collapseAll = useCallback(() => {
    commit(new Set(groupIds));
  }, [commit, groupIds]);

  const { rows, domainMin, domainMax } = useMemo(() => {
    const flat = flattenVisible(lines, collapsed);
    return mode === "stock" ? computeLevels(flat, scenario) : computeWaterfall(flat, scenario);
  }, [lines, collapsed, scenario, mode]);

  return {
    rows,
    collapsed,
    toggle,
    isCollapsed,
    expandAll,
    collapseAll,
    groupIds,
    allCollapsed: groupIds.length > 0 && groupIds.every((id) => collapsed.has(id)),
    allExpanded: collapsed.size === 0,
    domainMin,
    domainMax,
  };
}
