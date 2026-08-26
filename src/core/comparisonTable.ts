/**
 * Center-label "flanking" comparison table — the IBCS table templates T01/T02.
 *
 * Where `DataTable` puts the row labels on the LEFT and stacks every measure to
 * their right, the IBCS reference (ibcs.com T01/T02) places the row labels in
 * the CENTRE and flanks them with two symmetric column groups: a current period
 * on the left (e.g. "November") and a year-to-date on the right (e.g.
 * "January–November"). Each group repeats the same measures (PY / PL / AC and
 * the AC-vs-base variances).
 *
 * Rows are a BUILD-UP: a group's detail rows come first, then the group itself
 * renders as a BOLD subtotal (summed from its children), and an optional grand
 * total closes the table with a heavier rule. This module is pure data — it
 * reuses the `DataTableRow` / `DataTableColumn` model and the variance maths
 * from {@link ./datatable}, and hands the React layer a fully-resolved model.
 */

import { SCENARIO_KEYS, type ScenarioKey } from "./types";
import {
  computeVarianceCell,
  measureValue,
  type DataTableCell,
  type DataTableColumn,
  type DataTableRow,
  type ResolvedCell,
} from "./datatable";

/**
 * Own-property test that survives measure names colliding with
 * `Object.prototype` members (`"constructor"`, `"toString"`, …), which a plain
 * truthiness lookup reports as present on any object.
 */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** A column with its resolved render metadata (variance scale + gap flag). */
export interface ComparisonColumnModel {
  column: DataTableColumn;
  kind: "value" | "variance";
  /** variance: shared axis domain (max |Δ| over detail rows, outliers excluded). */
  domain: number;
  /** Draw an IBCS "group gap" (extra whitespace) before this column. */
  gapBefore: boolean;
}

/** One header cell in the per-side sub-header row, with its column span. */
export interface ComparisonHeaderCell {
  label: string;
  /** Number of columns this header spans (>1 for an `AC-PY` abs+% pair). */
  span: number;
  /** Gap before the first column of this cell (mirrors the column's gap). */
  gapBefore: boolean;
}

export type ComparisonRowKind = "detail" | "subtotal" | "total";

/** A flattened, fully-resolved comparison row (left cells | label | right cells). */
export interface ComparisonViewRow {
  row: DataTableRow;
  kind: ComparisonRowKind;
  /** Bold (subtotal/total rows). */
  emphasis: boolean;
  depth: number;
  leftCells: ResolvedCell[];
  rightCells: ResolvedCell[];
}

/** Everything the renderer needs for a flanking comparison table. */
export interface ComparisonModel {
  leftColumns: ComparisonColumnModel[];
  rightColumns: ComparisonColumnModel[];
  /** Sub-header cells (PY / PL / AC / AC-PY span…) for each side. */
  leftHeader: ComparisonHeaderCell[];
  rightHeader: ComparisonHeaderCell[];
  rows: ComparisonViewRow[];
}

/** Options for {@link buildComparisonModel}. */
export interface ComparisonOptions {
  /** Append a bold grand-total row (summed over the top-level groups). */
  showTotals?: boolean;
  /** Grand-total row label. Default "Total". */
  totalsLabel?: string;
}

function columnKind(col: DataTableColumn): "value" | "variance" {
  return col.kind === "variance" ? "variance" : "value";
}

function resolveCell(row: DataTableRow, col: DataTableColumn): ResolvedCell {
  if (columnKind(col) === "variance") {
    return { kind: "variance", variance: computeVarianceCell(row, col) };
  }
  return {
    kind: "value",
    value: measureValue(row, col.measure ?? col.key, col.scenario ?? "AC"),
  };
}

/** Per-column variance domains (max |Δ| over detail rows, outliers excluded). */
function buildColumnModels(
  columns: DataTableColumn[],
  detailRows: DataTableRow[],
): ComparisonColumnModel[] {
  return columns.map((column) => {
    const kind = columnKind(column);
    let domain = 0;
    if (kind === "variance") {
      for (const r of detailRows) {
        const vc = computeVarianceCell(r, column);
        if (vc && !vc.outlier) domain = Math.max(domain, Math.abs(vc.value));
      }
      domain = domain || ((column.mode ?? "abs") === "pct" ? (column.clampPct ?? 100) : 1);
    }
    return { column, kind, domain, gapBefore: column.gapBefore ?? false };
  });
}

/**
 * Collapse columns into sub-header cells: a run of consecutive columns sharing a
 * `subgroup` becomes one spanning cell (e.g. `AC-PY` over its abs + % pair);
 * every other column is its own span-1 cell carrying its `label`.
 */
function buildHeaderCells(columns: DataTableColumn[]): ComparisonHeaderCell[] {
  const cells: ComparisonHeaderCell[] = [];
  let runSub = ""; // the subgroup the trailing cell belongs to ("" = none)
  for (const col of columns) {
    const sub = col.subgroup ?? "";
    const prev = cells[cells.length - 1];
    if (sub !== "" && sub === runSub && prev) {
      prev.span += 1;
      continue;
    }
    runSub = sub;
    cells.push({
      label: sub !== "" ? sub : col.label,
      span: 1,
      gapBefore: col.gapBefore ?? false,
    });
  }
  return cells;
}

/** Sum every measure used by the columns across the top-level groups. */
function buildTotalRow(
  groups: DataTableRow[],
  columns: DataTableColumn[],
  label: string,
): DataTableRow {
  const values: Record<string, Partial<Record<ScenarioKey, number>>> = {};
  for (const col of columns) {
    const measure = col.measure ?? col.key;
    if (hasOwn(values, measure)) continue;
    const sums: Partial<Record<ScenarioKey, number>> = {};
    for (const scenario of SCENARIO_KEYS) {
      let sum = 0;
      let any = false;
      for (const g of groups) {
        const v = measureValue(g, measure, scenario);
        if (v != null) {
          sum += v;
          any = true;
        }
      }
      if (any) sums[scenario] = sum;
    }
    values[measure] = sums;
  }
  return {
    id: "__total__",
    label,
    values: values as Record<string, DataTableCell>,
    emphasis: true,
  };
}

/**
 * Resolve the build-up render model: detail rows first, then each group's bold
 * subtotal, then an optional grand total — flanked by two resolved column sets.
 */
export function buildComparisonModel(
  rows: DataTableRow[],
  leftColumns: DataTableColumn[],
  rightColumns: DataTableColumn[],
  options: ComparisonOptions = {},
): ComparisonModel {
  const view: ComparisonViewRow[] = [];
  const detailRows: DataTableRow[] = [];

  for (const group of rows) {
    if (group.children?.length) {
      for (const child of group.children) {
        detailRows.push(child);
        view.push({
          row: child,
          kind: "detail",
          emphasis: false,
          depth: 1,
          leftCells: [],
          rightCells: [],
        });
      }
      view.push({
        row: group,
        kind: "subtotal",
        emphasis: true,
        depth: 0,
        leftCells: [],
        rightCells: [],
      });
    } else {
      detailRows.push(group);
      view.push({
        row: group,
        kind: "detail",
        emphasis: false,
        depth: 0,
        leftCells: [],
        rightCells: [],
      });
    }
  }

  if (options.showTotals) {
    const total = buildTotalRow(
      rows,
      [...leftColumns, ...rightColumns],
      options.totalsLabel ?? "Total",
    );
    view.push({
      row: total,
      kind: "total",
      emphasis: true,
      depth: 0,
      leftCells: [],
      rightCells: [],
    });
  }

  for (const vr of view) {
    vr.leftCells = leftColumns.map((c) => resolveCell(vr.row, c));
    vr.rightCells = rightColumns.map((c) => resolveCell(vr.row, c));
  }

  return {
    leftColumns: buildColumnModels(leftColumns, detailRows),
    rightColumns: buildColumnModels(rightColumns, detailRows),
    leftHeader: buildHeaderCells(leftColumns),
    rightHeader: buildHeaderCells(rightColumns),
    rows: view,
  };
}
