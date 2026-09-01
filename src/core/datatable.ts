/**
 * Generic, general-purpose IBCS DataTable model + pure logic.
 *
 * Where `StatementTable` renders a P&L/balance-sheet waterfall (one measure
 * built up to subtotals), this is the GENERAL table:
 *   - rows    = entities / categories (regions, products, cost centres…)
 *   - columns = measures (revenue AC, ΔPY, ΔPY%, a trend sparkline…)
 *
 * The model is plain data (JSON-serializable, zero React). A row carries
 * per-measure values; each value is either a single number (treated as the
 * AC scenario) or a scenario object `{ AC, PY, PL, FC }`. A `value` column
 * displays one scenario of a measure; a `variance` column references the same
 * measure plus a `base` scenario and computes AC-vs-base (ISO 24896: signed,
 * coloured by business impact, scaled consistently within the column).
 *
 * `buildDataTableModel` resolves everything the renderer needs: flattened
 * visible rows (honouring a collapsed set), per-column variance scales, a
 * summed totals row, and optional sorting - so the React layer stays thin.
 */

import { SCENARIO_KEYS, type ScenarioKey } from "./types";
import { computeVariance } from "./variance";
import type { FormatOptions } from "./format";

/**
 * One measure's value inside a row. Either:
 *  - a plain `number` - shorthand for the AC scenario, or
 *  - a scenario object, e.g. `{ AC: 120, PY: 100 }` (missing keys = undefined),
 *  - `undefined` - no data (renders blank, excluded from totals).
 */
export type DataTableCell = number | Partial<Record<ScenarioKey, number>> | undefined;

/**
 * A column. `kind` decides how the addressed measure is rendered:
 *  - "value"     - the scenario number (right-aligned, tabular).
 *  - "variance"  - an embedded AC-vs-`base` bar (abs) or pin (pct).
 *  - "sparkline" - a micro-chart from `row.spark[measure]`.
 */
export interface DataTableColumn {
  /** Unique column id (also the React key and the default `measure`). */
  key: string;
  /** Header text. */
  label: string;
  /** Default "value". */
  kind?: "value" | "variance" | "sparkline";
  /**
   * Which measure in `row.values` (or `row.spark`) this column reads.
   * Defaults to `key`, so a single value column can just set `key:"revenue"`.
   * Variance/sparkline columns set `measure` to point back at the measure
   * they visualise (e.g. `{ key:"rev_dpy", measure:"revenue", base:"PY" }`).
   */
  measure?: string;
  /** value/variance: which scenario is the "actual". Default "AC". */
  scenario?: ScenarioKey;
  /** variance: base scenario AC is compared against. Default "PY". */
  base?: ScenarioKey;
  /** variance: absolute delta or percent change. Default "abs". */
  mode?: "abs" | "pct";
  /**
   * variance: filled "bar" or "pin" (dot), or "none" for a plain signed,
   * impact-coloured number (no embedded mark - the IBCS T01 "numeric variance"
   * treatment). Default bar for abs, pin for pct.
   */
  mark?: "bar" | "pin" | "none";
  /**
   * Favorability: whether a higher actual is good for the business. Default
   * true. Set false on cost/expense columns so an increase reads red.
   */
  higherIsBetter?: boolean;
  /** sparkline: micro-chart type. Default "line". */
  sparkType?: "line" | "area" | "bar";
  /**
   * variance pct only: a |%| at/over this is drawn as an off-scale arrow and
   * excluded from the column's axis scale. Default 100.
   */
  clampPct?: number;
  /** Per-column number-format override (falls back to the table `format`). */
  format?: FormatOptions;
  /** Header + cell alignment. Default "left" for the first column, else "right". */
  align?: "left" | "right" | "center";
  /** Explicit pixel width (variance/sparkline columns get a sensible default). */
  width?: number;
  /**
   * Optional super-header label (IBCS column group, e.g. "Current month" /
   * "Year to date"). When ANY column sets this, the renderer draws a two-row
   * header: the top row shows group labels spanning their consecutive columns
   * (an ungrouped column spans 1 with an empty top cell), the bottom row keeps
   * the per-column labels. Group runs are formed by *consecutive* columns that
   * share the same `group` string. Purely presentational; sorting is unchanged.
   */
  group?: string;
  /**
   * Force a subtle left divider before this column. When omitted, a divider is
   * drawn automatically at the start of each new column group (IBCS sets groups
   * visually apart). Has no effect when no column declares a `group`.
   */
  borderLeft?: boolean;
  /**
   * Add extra whitespace (an IBCS "group gap") before this column - used to set
   * value blocks apart from variance blocks without a vertical rule. Consumed by
   * {@link ComparisonTable}; ignored by the plain `DataTable` header logic.
   */
  gapBefore?: boolean;
  /**
   * Optional second-level header label spanning a run of consecutive columns
   * that share it (e.g. an `AC-PY` header centred over its absolute + percent
   * pair). Columns without a `subgroup` keep their own `label` in the header
   * row. Consumed by {@link ComparisonTable}.
   */
  subgroup?: string;
}

/**
 * A row = an entity / category. `values` maps measure → cell; `spark` maps
 * measure → a numeric series for sparkline columns. Rows may nest via
 * `children` (a parent with no own value for a measure reports the sum of its
 * children, so collapsed groups still total correctly).
 */
export interface DataTableRow {
  id: string;
  label: string;
  /** Per-measure values (number = AC, or a scenario object). */
  values: Record<string, DataTableCell>;
  /** Per-measure numeric series for sparkline columns. */
  spark?: Record<string, number[]>;
  /** Optional group label (purely informational / for the caller). */
  group?: string;
  /** Breakdown children; a row with children is collapsible. */
  children?: DataTableRow[];
  /** Start collapsed. Default false. */
  defaultCollapsed?: boolean;
  /** Force bold/emphasis on this row. */
  emphasis?: boolean;
  /**
   * Statement-style marker for P&L / build-up tables (IBCS T03). When set, a
   * marker glyph is drawn before the label: `"add"` → `+`, `"subtract"` → `−`,
   * `"result"` → `=`. A `"result"` row is emphasised (bold) with a 1px top rule,
   * mirroring `StatementLine.flow`. Absent → a plain entity row (unchanged).
   * Purely presentational - it does not affect totals or value resolution.
   */
  flow?: "add" | "subtract" | "result";
  /**
   * Draw a double top rule above this row - the IBCS grand-total convention for
   * a final line (e.g. "Net income"). Implies result-style bold emphasis.
   */
  doubleRule?: boolean;
}

/** Sort directive: a column key + direction. */
export interface DataTableSort {
  key: string;
  dir: "asc" | "desc";
}

/** Options for {@link buildDataTableModel}. */
export interface DataTableOptions {
  /** Collapsed row ids (their children are hidden). */
  collapsed?: Iterable<string>;
  /** Sort rows by a column. Totals always stay pinned to the bottom. */
  sort?: DataTableSort | null;
  /** Append a summed totals row. Default false. */
  showTotals?: boolean;
  /** Totals row label. Default "Total". */
  totalsLabel?: string;
}

/** A resolved cell, discriminated by the column kind. */
export type ResolvedCell =
  | { kind: "value"; value: number | undefined }
  | { kind: "variance"; variance: VarianceCellData | null }
  | { kind: "sparkline"; data: number[] };

/** Per-row variance result for one variance column. */
export interface VarianceCellData {
  /** Display value: currency delta (abs) or percent number (pct, e.g. 6.9). */
  value: number;
  /** Good for the business (respects the column's `higherIsBetter`). */
  favorable: boolean;
  /** pct mode: at/over `clampPct` - draw as an off-scale arrow. */
  outlier: boolean;
}

/** A column with its resolved render metadata. */
export interface ColumnModel {
  column: DataTableColumn;
  kind: "value" | "variance" | "sparkline";
  /**
   * variance: shared axis domain - max |Δ| over the DETAIL (leaf) rows of the
   * whole tree, outliers excluded. Parent aggregates are deliberately left out
   * (they would dominate the scale) and the collapsed set is ignored, so
   * expanding or collapsing a group never moves the bars.
   */
  domain: number;
  /**
   * Draw a subtle left divider before this column - true at the start of a new
   * column group (or when the column forces `borderLeft`). Always false when no
   * column declares a `group`, so ungrouped tables look identical to before.
   */
  borderLeft: boolean;
}

/**
 * One cell of the top header row when columns are grouped. `span` is the number
 * of consecutive data columns it covers; `label` is "" for ungrouped columns.
 */
export interface DataTableHeaderGroup {
  label: string;
  span: number;
}

/** A flattened, resolved row ready to render. */
export interface DataTableViewRow {
  row: DataTableRow;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isTotal: boolean;
  /** Resolved cells, aligned 1:1 with `columns`. */
  cells: ResolvedCell[];
}

/** Everything the renderer needs. */
export interface DataTableModel {
  columns: ColumnModel[];
  rows: DataTableViewRow[];
  /** The totals row, or null when `showTotals` is off. */
  totals: DataTableViewRow | null;
  /**
   * Top header-group row (group labels + spans, aligned 1:1 with the columns it
   * covers), or null when no column declares a `group` - in which case the
   * renderer draws the usual single-row header.
   */
  headerGroups: DataTableHeaderGroup[] | null;
}

/**
 * Own-property test that survives measure names colliding with
 * `Object.prototype` members (`"constructor"`, `"toString"`, …) - a plain
 * `key in obj` / truthiness check reports those as present on any object.
 */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function columnKind(col: DataTableColumn): "value" | "variance" | "sparkline" {
  return col.kind ?? "value";
}

function measureOf(col: DataTableColumn): string {
  return col.measure ?? col.key;
}

/**
 * Resolve a row's value for one measure + scenario. A plain `number` cell is
 * the AC scenario. A row without its own value but with children reports the
 * sum of its children (so collapsed groups still total).
 */
export function measureValue(
  row: DataTableRow,
  measure: string,
  scenario: ScenarioKey,
): number | undefined {
  const cell = row.values[measure];
  let own: number | undefined;
  if (cell == null) own = undefined;
  else if (typeof cell === "number") own = scenario === "AC" ? cell : undefined;
  else own = cell[scenario];
  // Treat non-finite values (NaN / ±Infinity from upstream data) as missing so
  // they never reach width/scale maths and emit NaN SVG geometry downstream.
  if (own != null && Number.isFinite(own)) return own;

  if (row.children?.length) {
    let sum = 0;
    let any = false;
    for (const child of row.children) {
      const v = measureValue(child, measure, scenario);
      if (v != null) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : undefined;
  }
  return undefined;
}

/** Resolve a sparkline series for a row (sums children element-wise if needed). */
export function measureSeries(row: DataTableRow, measure: string): number[] {
  const own = row.spark?.[measure];
  // Sanitise: a non-finite point would poison the sparkline's min/max scale and
  // emit NaN path coordinates. Coerce stray NaN/Infinity to 0.
  if (own && own.length) return own.map((v) => (Number.isFinite(v) ? v : 0));
  if (row.children?.length) {
    const acc: number[] = [];
    for (const child of row.children) {
      const s = measureSeries(child, measure);
      for (const [i, v] of s.entries()) acc[i] = (acc[i] ?? 0) + v;
    }
    return acc;
  }
  return [];
}

/** Compute one variance cell for a column (or null when data is missing). */
export function computeVarianceCell(
  row: DataTableRow,
  col: DataTableColumn,
): VarianceCellData | null {
  const measure = measureOf(col);
  const scenario = col.scenario ?? "AC";
  const base = col.base ?? "PY";
  const ac = measureValue(row, measure, scenario);
  const baseVal = measureValue(row, measure, base);
  const v = computeVariance(ac, baseVal, col.higherIsBetter ?? true);
  if (!v) return null;

  if ((col.mode ?? "abs") === "pct") {
    if (v.pct == null) return null;
    const clamp = col.clampPct ?? 100;
    const pct = v.pct * 100;
    return { value: pct, favorable: v.favorable, outlier: Math.abs(pct) >= clamp };
  }
  return { value: v.abs, favorable: v.favorable, outlier: false };
}

/** Resolve a single cell for a column against a row. */
function resolveCell(row: DataTableRow, col: DataTableColumn): ResolvedCell {
  const kind = columnKind(col);
  if (kind === "value") {
    return { kind: "value", value: measureValue(row, measureOf(col), col.scenario ?? "AC") };
  }
  if (kind === "variance") {
    return { kind: "variance", variance: computeVarianceCell(row, col) };
  }
  return { kind: "sparkline", data: measureSeries(row, measureOf(col)) };
}

/** A numeric key for sorting a row by a column (undefined sorts last). */
function sortKey(row: DataTableRow, col: DataTableColumn): number | undefined {
  const kind = columnKind(col);
  if (kind === "value") return measureValue(row, measureOf(col), col.scenario ?? "AC");
  if (kind === "variance") return computeVarianceCell(row, col)?.value;
  const s = measureSeries(row, measureOf(col));
  return s.length ? s[s.length - 1] : undefined;
}

/** Recursively sort a row tree by a column, preserving the hierarchy. */
function sortTree(rows: DataTableRow[], col: DataTableColumn, dir: "asc" | "desc"): DataTableRow[] {
  const mul = dir === "asc" ? 1 : -1;
  const sorted = rows
    .map((r) => (r.children?.length ? { ...r, children: sortTree(r.children, col, dir) } : r))
    .sort((a, b) => {
      const ka = sortKey(a, col);
      const kb = sortKey(b, col);
      if (ka == null && kb == null) return 0;
      if (ka == null) return 1; // missing values sink to the bottom
      if (kb == null) return -1;
      return (ka - kb) * mul;
    });
  return sorted;
}

/**
 * A visible row of a DataTable, with its nesting metadata. Named apart from the
 * statement-model `FlatRow` in `./types` (which wraps a `StatementLine`) so the
 * two shapes can never be confused.
 */
interface FlatDataRow {
  row: DataTableRow;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/** Flatten a row tree to the visible rows, honouring the collapsed set. */
export function flattenRows(rows: DataTableRow[], collapsed: Set<string>): FlatDataRow[] {
  const out: FlatDataRow[] = [];
  const walk = (list: DataTableRow[], depth: number) => {
    for (const row of list) {
      const hasChildren = !!row.children?.length;
      const isExpanded = hasChildren && !collapsed.has(row.id);
      out.push({ row, depth, hasChildren, isExpanded });
      if (isExpanded) walk(row.children!, depth + 1);
    }
  };
  walk(rows, 0);
  return out;
}

/**
 * Every DETAIL (leaf) row of a tree, in order - the rows a variance scale is
 * built from. Parents are skipped: their aggregate would set a scale the detail
 * bars can never reach.
 */
function collectDetailRows(rows: DataTableRow[], out: DataTableRow[] = []): DataTableRow[] {
  for (const row of rows) {
    if (row.children?.length) collectDetailRows(row.children, out);
    else out.push(row);
  }
  return out;
}

/** Build a synthetic totals row by summing the top-level rows per measure. */
function buildTotalsRow(
  rows: DataTableRow[],
  columns: DataTableColumn[],
  label: string,
): DataTableRow {
  const values: Record<string, Partial<Record<ScenarioKey, number>>> = {};
  const spark: Record<string, number[]> = {};

  for (const col of columns) {
    const measure = measureOf(col);
    if (columnKind(col) === "sparkline") {
      if (!hasOwn(spark, measure)) {
        const acc: number[] = [];
        for (const r of rows) {
          const s = measureSeries(r, measure);
          for (const [i, v] of s.entries()) acc[i] = (acc[i] ?? 0) + v;
        }
        spark[measure] = acc;
      }
      continue;
    }
    if (hasOwn(values, measure)) continue;
    const sums: Partial<Record<ScenarioKey, number>> = {};
    for (const scenario of SCENARIO_KEYS) {
      let sum = 0;
      let any = false;
      for (const r of rows) {
        const v = measureValue(r, measure, scenario);
        if (v != null) {
          sum += v;
          any = true;
        }
      }
      if (any) sums[scenario] = sum;
    }
    values[measure] = sums;
  }

  return { id: "__total__", label, values, spark, emphasis: true };
}

/** Does any column declare a group? (Empty strings don't count.) */
function hasColumnGroups(columns: DataTableColumn[]): boolean {
  return columns.some((c) => c.group != null && c.group !== "");
}

/**
 * Collapse consecutive same-group columns into top-row header cells. Ungrouped
 * columns each become a span-1 cell with an empty label. Returns null when no
 * column declares a group (so the renderer keeps the single-row header).
 */
function buildHeaderGroups(columns: DataTableColumn[]): DataTableHeaderGroup[] | null {
  if (!hasColumnGroups(columns)) return null;
  const groups: DataTableHeaderGroup[] = [];
  for (const col of columns) {
    const label = col.group ?? "";
    const prev = groups[groups.length - 1];
    // Merge only non-empty labels that match the immediately preceding run.
    if (prev && label !== "" && prev.label === label) prev.span += 1;
    else groups.push({ label, span: 1 });
  }
  return groups;
}

/**
 * Resolve the full render model: visible rows (sorted, flattened), per-column
 * variance scales, and an optional summed totals row.
 */
export function buildDataTableModel(
  columns: DataTableColumn[],
  rows: DataTableRow[],
  options: DataTableOptions = {},
): DataTableModel {
  const collapsed = new Set<string>(options.collapsed ?? []);

  // 1. Sort the tree (totals computed from the original rows, then pinned).
  let ordered = rows;
  if (options.sort) {
    const col = columns.find((c) => c.key === options.sort!.key);
    if (col) ordered = sortTree(rows, col, options.sort.dir);
  }

  // 2. Flatten to visible rows.
  const flat = flattenRows(ordered, collapsed);

  // 3. Per-column variance domains and group dividers (auto-drawn at the start
  //    of each new column group).
  //
  //    The domain spans the DETAIL (leaf) rows of the WHOLE tree - not the
  //    currently visible rows. Including parent aggregates let a group total
  //    dominate the scale, and because the visible set changes with the
  //    collapsed set, expanding a group silently rescaled every bar in the
  //    column. Totals/parents simply clamp to the detail scale when drawn.
  const detailRows = collectDetailRows(rows);
  const grouped = hasColumnGroups(columns);
  const columnModels: ColumnModel[] = columns.map((column, i) => {
    const kind = columnKind(column);
    let domain = 0;
    if (kind === "variance") {
      for (const r of detailRows) {
        const vc = computeVarianceCell(r, column);
        if (vc && !vc.outlier) domain = Math.max(domain, Math.abs(vc.value));
      }
      domain = domain || ((column.mode ?? "abs") === "pct" ? (column.clampPct ?? 100) : 1);
    }
    const prev = columns[i - 1];
    const auto = grouped && prev != null && (column.group ?? "") !== (prev.group ?? "");
    const borderLeft = column.borderLeft ?? auto;
    return { column, kind, domain, borderLeft };
  });

  // 4. Resolve cells per visible row.
  const viewRows: DataTableViewRow[] = flat.map((f) => ({
    row: f.row,
    depth: f.depth,
    hasChildren: f.hasChildren,
    isExpanded: f.isExpanded,
    isTotal: false,
    cells: columns.map((c) => resolveCell(f.row, c)),
  }));

  // 5. Totals row.
  let totals: DataTableViewRow | null = null;
  if (options.showTotals) {
    const totalRow = buildTotalsRow(rows, columns, options.totalsLabel ?? "Total");
    totals = {
      row: totalRow,
      depth: 0,
      hasChildren: false,
      isExpanded: false,
      isTotal: true,
      cells: columns.map((c) => resolveCell(totalRow, c)),
    };
  }

  return {
    columns: columnModels,
    rows: viewRows,
    totals,
    headerGroups: buildHeaderGroups(columns),
  };
}

/**
 * Resolved mark for a variance column: the explicit `mark`, else "pin" for a
 * percent column and "bar" for an absolute one. "none" renders a plain numeric
 * (impact-coloured) variance with no embedded mark.
 */
export function resolveMark(col: DataTableColumn): "bar" | "pin" | "none" {
  return col.mark ?? ((col.mode ?? "abs") === "pct" ? "pin" : "bar");
}
