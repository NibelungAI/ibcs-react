import { useMemo } from "react";
import type { ScenarioKey, StatementLine } from "../../core/types";
import { statementToWaterfall, type StatementToWaterfallOptions } from "../../core/adapters";
import type { WaterfallDatum } from "../../core/waterfall";

/** What {@link useStatementBridge} returns - spread it onto a `WaterfallChart`. */
export interface StatementBridge {
  /** The bridge contributions for the current scenario. */
  data: WaterfallDatum[];
  /** The same bridge for the comparison scenario, when one was asked for. */
  comparisonData?: WaterfallDatum[];
}

export interface UseStatementBridgeOptions extends StatementToWaterfallOptions {
  /** Scenario the bridge itself shows. Default `"AC"`. */
  scenario?: ScenarioKey;
}

/**
 * Derive a `WaterfallChart`'s `data` + `comparisonData` from one statement, so
 * the bridge takes part in the same `comparison` toggle as every other chart.
 *
 * The sibling charts accept `comparison="PY"` - a scenario KEY - while a
 * bridge needs the other scenario's contributions spelled out as a dataset
 * (`comparisonData`). That asymmetry is real, but it should cost the caller
 * one hook, not a special-case branch per dashboard:
 *
 * ```tsx
 * // A global "vs PY / vs PL" toggle, uniform across chart kinds:
 * <VarianceColumnChart data={regions} comparison={comparison} />
 * <WaterfallChart {...useStatementBridge(pnl, comparison)} />
 * ```
 *
 * Pass `undefined` as the comparison for a bare bridge (no variance panel).
 * Both datasets come from {@link statementToWaterfall} with the same options,
 * so they stay structurally parallel - the same lines, skipped the same way.
 * Memoized on the inputs; pass a stable `options` object (or none).
 */
export function useStatementBridge(
  lines: StatementLine[],
  comparison?: ScenarioKey,
  options?: UseStatementBridgeOptions,
): StatementBridge {
  const { scenario = "AC", ...opts } = options ?? {};
  // The options object is reduced to its meaningful bits so an inline literal
  // (`{ expandGroups: true }`) does not defeat the memo.
  const expandGroups = opts.expandGroups ?? false;
  return useMemo(
    () => ({
      data: statementToWaterfall(lines, scenario, { expandGroups }),
      comparisonData: comparison
        ? statementToWaterfall(lines, comparison, { expandGroups })
        : undefined,
    }),
    [lines, scenario, comparison, expandGroups],
  );
}
