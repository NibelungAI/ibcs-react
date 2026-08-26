/**
 * Statement → view adapters: "one data model, many views" made literal.
 *
 * The library's model is a tree of {@link StatementLine}s (one value per
 * scenario, `add`/`subtract`/`result` flow, optional breakdown children). Every
 * chart view has its OWN flat input shape — {@link WaterfallDatum} for the
 * bridge, {@link StructureDatum} for a composition, {@link DataTableRow} for
 * the general table — because those views are also usable without a statement.
 *
 * These adapters are the missing bridge between the two: pure, allocation-only
 * projections from the statement model onto each view's shape, so a caller
 * keeps ONE authored data set and derives the rest instead of hand-reshaping
 * the same lines in every screen.
 *
 *   const lines = fetchPnl();                       // the one model
 *   <StatementTable lines={lines} />                // the table view
 *   <WaterfallChart data={statementToWaterfall(lines)} />
 *   <StructureChart data={statementToStructure(lines)} />
 *   <DataTable columns={cols} rows={statementToDataTableRows(lines)} />
 *
 * POLICY — shared with the layout modules (see `./domain`): a non-finite value
 * (`NaN`, `±Infinity`) is MISSING data, never zero. Values are resolved through
 * {@link resolveValue}, so a group without an own value reports the sum of its
 * children and a group whose children are all missing stays missing. Every
 * function here is pure: the input array and every line in it are read-only and
 * are never referenced from the returned objects (children are rebuilt, not
 * aliased).
 */

import { isFiniteNumber } from "./domain";
import type { DataTableRow } from "./datatable";
import type { StructureDatum } from "./structure";
import { SCENARIO_KEYS, type ScenarioKey, type StatementLine } from "./types";
import { resolveValue } from "./variance";
import type { WaterfallDatum } from "./waterfall";

/** Options for {@link statementToWaterfall}. */
export interface StatementToWaterfallOptions {
  /**
   * Walk into breakdown children instead of emitting the group as one bar.
   * Default false. See {@link statementToWaterfall} for the exact rule.
   */
  expandGroups?: boolean;
}

/** Options for {@link statementToStructure}. */
export interface StatementToStructureOptions {
  /**
   * Drop `flow: "result"` lines (subtotals). Default TRUE — a composition shows
   * the PARTS of a whole, and a subtotal is not a part: including "Gross margin"
   * next to the costs it already contains double-counts the total and shrinks
   * every real component's share. Set false to keep them (e.g. to chart a
   * ladder of subtotals, where each result IS the item of interest).
   */
  skipResults?: boolean;
}

/** Options for {@link statementToDataTableRows}. */
export interface StatementToDataTableRowsOptions {
  /**
   * Measure name the scenario values are filed under in `row.values`.
   * Default `"value"` — a column addresses it via `key: "value"` (a column's
   * `measure` defaults to its `key`) or an explicit `measure: "value"`.
   */
  measure?: string;
}

/** The scenario values a line carries itself, sanitized (missing keys dropped). */
function ownScenarioValues(line: StatementLine): Partial<Record<ScenarioKey, number>> {
  const out: Partial<Record<ScenarioKey, number>> = {};
  for (const key of SCENARIO_KEYS) {
    const v = line.values?.[key];
    if (isFiniteNumber(v)) out[key] = v;
  }
  return out;
}

/**
 * Project a statement onto a standalone bridge (waterfall) chart series.
 *
 * Each emitted column keeps the line's `label`, its `flow` (defaulting to
 * `"add"`, matching the statement model) and its `higherIsBetter`, so the
 * bridge tells the same story as the statement's own waterfall column.
 *
 * WHICH LINES ARE EMITTED (exact rule):
 *  - `expandGroups: false` (default) — the TOP-LEVEL lines only. A group's
 *    value is resolved through {@link resolveValue}, so a parent without an own
 *    value reports the sum of its children: collapsed groups still carry their
 *    full weight.
 *  - `expandGroups: true` — a line is replaced by its children (recursively)
 *    when it has children, is NOT `defaultCollapsed`, and is not a `"result"`.
 *    That mirrors what the statement table shows on first paint: a
 *    `defaultCollapsed` group stays one aggregated bar, an expanded-by-default
 *    group hands the flow to its children (which must sum to the parent for the
 *    running total to agree). `"result"` lines are never expanded — a result is
 *    a checkpoint drawn to the running total, not a container of contributions.
 *
 * MISSING VALUES: an `add`/`subtract` line whose value for `scenario` resolves
 * to nothing is SKIPPED, not emitted as 0. Zero is a statement ("this cost was
 * nil"); no data is not, and a 0-valued column would still occupy a slot and a
 * label on the axis while drawing an invisible bar. `"result"` lines are always
 * emitted — {@link computeBridge} ignores a result's `value` and draws it to the
 * current running total — with the resolved value echoed (0 when missing) so
 * the datum stays comparable to the statement.
 *
 * @example
 * const bars = statementToWaterfall(lines);           // AC, groups collapsed
 * const py = statementToWaterfall(lines, "PY");       // the same bridge, PY
 * <WaterfallChart data={bars} comparison={py} />
 */
export function statementToWaterfall(
  lines: StatementLine[],
  scenario: ScenarioKey = "AC",
  opts: StatementToWaterfallOptions = {},
): WaterfallDatum[] {
  const expandGroups = opts.expandGroups ?? false;
  const out: WaterfallDatum[] = [];

  const emit = (line: StatementLine) => {
    const flow = line.flow ?? "add";
    const value = resolveValue(line, scenario);
    // A checkpoint always draws (its level comes from the run, not the value);
    // a contribution without data is not a contribution of zero.
    if (flow !== "result" && !isFiniteNumber(value)) return;
    const datum: WaterfallDatum = {
      category: line.label,
      value: isFiniteNumber(value) ? value : 0,
      flow,
    };
    if (line.higherIsBetter != null) datum.higherIsBetter = line.higherIsBetter;
    out.push(datum);
  };

  const walk = (list: StatementLine[]) => {
    for (const line of list) {
      const expandable =
        expandGroups &&
        (line.flow ?? "add") !== "result" &&
        !!line.children?.length &&
        !line.defaultCollapsed;
      if (expandable) walk(line.children!);
      else emit(line);
    }
  };

  walk(lines);
  return out;
}

/**
 * Project a statement onto a composition (part-of-a-whole) series.
 *
 * One datum per TOP-LEVEL line, carrying the line's name (as `category`, plus
 * the legacy `label` alias, so the same array can also feed the category
 * charts), every scenario the line has data for (resolved through
 * {@link resolveValue}, so a group reports the sum of its children) and the
 * line's `higherIsBetter` — {@link StructureDatum}'s polarity field, so cost
 * parts keep reading unfavorable when they grow.
 *
 * `"result"` lines are EXCLUDED by default (`skipResults: true`): they are
 * subtotals over the other lines, so charting them as components double-counts
 * the whole. Pass `{ skipResults: false }` when the subtotals themselves are the
 * composition you want.
 *
 * Scenario keys with no finite value are omitted entirely rather than set to 0 —
 * `computeStructure` reads an absent key as missing and leaves it out of the
 * totals and the variance.
 *
 * @example
 * <StructureChart data={statementToStructure(costLines)} comparison="PY" />
 */
export function statementToStructure(
  lines: StatementLine[],
  opts: StatementToStructureOptions = {},
): StructureDatum[] {
  const skipResults = opts.skipResults ?? true;
  const out: StructureDatum[] = [];

  for (const line of lines) {
    if (skipResults && (line.flow ?? "add") === "result") continue;
    const datum: StructureDatum = { category: line.label, label: line.label };
    for (const key of SCENARIO_KEYS) {
      const v = resolveValue(line, key);
      if (isFiniteNumber(v)) datum[key] = v;
    }
    if (line.higherIsBetter != null) datum.higherIsBetter = line.higherIsBetter;
    out.push(datum);
  }

  return out;
}

/**
 * Project a statement onto general-table rows, preserving the hierarchy.
 *
 * Every line becomes a {@link DataTableRow} filing its OWN scenario values under
 * one measure (default `"value"`), with `children` recursed in place. Own values
 * are used deliberately — `measureValue` already sums the children of a row that
 * has no own value, so the table aggregates exactly like the statement does and
 * a collapsed group still totals. Non-finite values are dropped, so a `NaN` cell
 * renders blank instead of poisoning the column's variance scale.
 *
 * `flow`, `emphasis` and `defaultCollapsed` are carried across (they mean the
 * same thing on both models): the table draws the IBCS `+ / − / =` statement
 * markers and the result rules without any extra wiring.
 *
 * @example
 * const rows = statementToDataTableRows(lines);           // measure "value"
 * const columns: DataTableColumn[] = [
 *   { key: "value", label: "AC" },                        // measure defaults to key
 *   { key: "value_py", label: "PY", measure: "value", scenario: "PY" },
 *   { key: "d_py", label: "ΔPY", kind: "variance", measure: "value", base: "PY" },
 *   { key: "d_py_pct", label: "ΔPY %", kind: "variance", measure: "value", base: "PY", mode: "pct" },
 * ];
 * <DataTable columns={columns} rows={rows} />
 */
export function statementToDataTableRows(
  lines: StatementLine[],
  opts: StatementToDataTableRowsOptions = {},
): DataTableRow[] {
  const measure = opts.measure ?? "value";

  const toRow = (line: StatementLine): DataTableRow => {
    const row: DataTableRow = {
      id: line.id,
      label: line.label,
      values: { [measure]: ownScenarioValues(line) },
    };
    if (line.flow != null) row.flow = line.flow;
    if (line.emphasis != null) row.emphasis = line.emphasis;
    if (line.defaultCollapsed != null) row.defaultCollapsed = line.defaultCollapsed;
    if (line.children?.length) row.children = line.children.map(toRow);
    return row;
  };

  return lines.map(toRow);
}
