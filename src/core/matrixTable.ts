/**
 * Budget / control matrix model.
 *
 * A two-dimensional, fully expandable financial statement:
 *   - ROWS are a tree of statement lines (a P&L: revenue → … → net income),
 *     with add / subtract / result flow markers, subtotals and drill-down.
 *   - COLUMNS are a tree of PERIODS (Year → Quarter → Month) that expands IN
 *     PLACE, and every visible leaf period fans out into one sub-column per
 *     scenario (Plan / Actual / Forecast), optionally followed by a ΔBudget
 *     variance column.
 *
 * The whole thing is a pure, serializable model: a row tree, a period tree and
 * a `values[rowId][periodId][scenario]` lookup. The renderer
 * (`MatrixTable.tsx`) computes layout from these with the helpers below - no
 * data fetching, no side effects, SSR-safe.
 */

import { SCENARIO_KEYS, type ScenarioKey, type Variance } from "./types";
import { computeVariance } from "./variance";

/* ------------------------------------------------------------------ *
 * Row model - a tree of statement lines.
 * ------------------------------------------------------------------ */

/** How a row participates in the statement: a step up, a step down, or a subtotal. */
export type MatrixFlow = "add" | "subtract" | "result";

export interface MatrixRow {
  id: string;
  label: string;
  /** Marker + emphasis. "add" → `+`, "subtract" → `−`, "result" → `=` (bold, ruled). */
  flow?: MatrixFlow;
  /** Force bold/emphasis even for a non-result row. Auto-true for flow="result". */
  emphasis?: boolean;
  /** Draw a double underline beneath the row (the IBCS "final result" rule, e.g. Net income). */
  doubleRule?: boolean;
  /**
   * Whether a higher value is good. Default true. Set false on cost/expense/tax
   * lines so an increase reads as unfavorable in the ΔBudget column.
   */
  higherIsBetter?: boolean;
  /** Breakdown children. A row with children is expand/collapsible. */
  children?: MatrixRow[];
  /** Start collapsed. Default false. */
  defaultCollapsed?: boolean;
}

/* ------------------------------------------------------------------ *
 * Column model - a tree of periods.
 * ------------------------------------------------------------------ */

export interface MatrixPeriod {
  id: string;
  label: string;
  /**
   * Scenario sub-columns rendered under this period when it is a (visible)
   * leaf. Defaults to the table's `scenarios` order. Use this to vary the mix
   * per period - e.g. historic years show `["PL","AC"]` while the current year
   * shows `["PL","FC"]`.
   */
  scenarios?: ScenarioKey[];
  /** Child periods (Year → Quarter → Month). A period with children expands. */
  children?: MatrixPeriod[];
  /** Start expanded. Default false (collapsed → shown as a leaf). */
  defaultExpanded?: boolean;
}

/* ------------------------------------------------------------------ *
 * Values - a serializable lookup.
 * ------------------------------------------------------------------ */

/** `values[rowId][periodId]` → a partial map of scenario → number. */
export type MatrixValues = Record<string, Record<string, Partial<Record<ScenarioKey, number>>>>;

/* ------------------------------------------------------------------ *
 * Per-cell addressing - for click handlers, decorations and scroll-to.
 * ------------------------------------------------------------------ */

/** A value sub-cell's scenario: a real scenario, or "DELTA" for the Δ column. */
export type MatrixCellScenario = ScenarioKey | "DELTA";

/** Every legal {@link MatrixCellScenario}, for validating a parsed cell ref. */
const CELL_SCENARIOS: ReadonlySet<string> = new Set<string>([...SCENARIO_KEYS, "DELTA"]);

/**
 * A stable id for one value sub-cell: `"rowId::periodId::scenario"`. It is
 * written to each cell's `data-cell-ref` so a consumer (e.g. a comment sidebar)
 * can `document.querySelector('[data-cell-ref="..."]')` to scroll to / flash it,
 * and is the key `cellDecorations` / `getCellClassName` are asked about.
 */
export function cellRefOf(rowId: string, periodId: string, scenario: MatrixCellScenario): string {
  return `${rowId}::${periodId}::${scenario}`;
}

/**
 * Inverse of {@link cellRefOf}. Returns null if the ref isn't well-formed:
 * wrong number of `::` segments, an empty row/period id, or a scenario segment
 * that is not a real {@link MatrixCellScenario}. The scenario is VALIDATED
 * rather than cast, so a hand-written or stale `data-cell-ref` can't smuggle an
 * unknown scenario into a typed handler.
 */
export function parseCellRef(
  ref: string,
): { rowId: string; periodId: string; scenario: MatrixCellScenario } | null {
  const parts = ref.split("::");
  if (parts.length !== 3) return null;
  const [rowId, periodId, scenario] = parts;
  if (!rowId || !periodId || !scenario || !CELL_SCENARIOS.has(scenario)) return null;
  return { rowId, periodId, scenario: scenario as MatrixCellScenario };
}

/** Payload handed to `onCellClick` when a value sub-cell is clicked. */
export interface MatrixCellClick {
  rowId: string;
  periodId: string;
  /** The scenario column, or "DELTA" for the variance cell. */
  scenario: MatrixCellScenario;
  /** The cell's numeric value (the Δ amount for "DELTA"), or null when empty. */
  value: number | null;
  rowLabel: string;
  periodLabel: string;
}

/* ------------------------------------------------------------------ *
 * Row flattening (respecting collapse state).
 * ------------------------------------------------------------------ */

export interface FlatMatrixRow {
  row: MatrixRow;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/** Collect ids of rows that should start collapsed (defaultCollapsed). */
export function defaultCollapsedRowIds(rows: MatrixRow[]): string[] {
  const ids: string[] = [];
  const walk = (rs: MatrixRow[]) => {
    for (const r of rs) {
      if (r.defaultCollapsed) ids.push(r.id);
      if (r.children) walk(r.children);
    }
  };
  walk(rows);
  return ids;
}

/** Flatten the row tree to the rows currently visible given a collapsed set. */
export function flattenMatrixRows(
  rows: MatrixRow[],
  collapsed: ReadonlySet<string>,
): FlatMatrixRow[] {
  const out: FlatMatrixRow[] = [];
  const walk = (rs: MatrixRow[], depth: number) => {
    for (const r of rs) {
      const hasChildren = !!r.children && r.children.length > 0;
      const isExpanded = hasChildren && !collapsed.has(r.id);
      out.push({ row: r, depth, hasChildren, isExpanded });
      if (isExpanded) walk(r.children!, depth + 1);
    }
  };
  walk(rows, 0);
  return out;
}

/* ------------------------------------------------------------------ *
 * Column layout (respecting expand state).
 * ------------------------------------------------------------------ */

/** Ids of periods that should start expanded (defaultExpanded). */
export function defaultExpandedColIds(columns: MatrixPeriod[]): string[] {
  const ids: string[] = [];
  const walk = (ps: MatrixPeriod[]) => {
    for (const p of ps) {
      if (p.defaultExpanded) ids.push(p.id);
      if (p.children) walk(p.children);
    }
  };
  walk(columns);
  return ids;
}

/** One currently-visible leaf period and the scenario sub-columns under it. */
export interface LeafColumn {
  period: MatrixPeriod;
  scenarios: ScenarioKey[];
  /** True when this leaf could be expanded further (has children but is collapsed). */
  expandable: boolean;
  /** Index of the top-level group (year) this leaf belongs to. */
  groupIndex: number;
  /**
   * This leaf is the first column of a new top-level group (and not the very
   * first column overall) - i.e. a group boundary. Drives the single inter-group
   * gap, applied identically in the header bands, scenario row and body so they
   * stay column-aligned. NOT set between sibling leaves of the same group (e.g.
   * months within a quarter get no gap).
   */
  startsGap: boolean;
}

/** A header cell in the multi-row period header. */
export interface ColumnHeaderCell {
  /** Period id (for expand/collapse) or a synthetic id for the scenario row. */
  key: string;
  label: string;
  /** Period this cell represents (undefined for the scenario sub-row cells). */
  periodId?: string;
  /** Number of sub-columns this cell spans. */
  colSpan: number;
  /** Header row index (0 = top). */
  level: number;
  /** Number of header rows this cell spans. */
  rowSpan: number;
  /** This cell is a period node that can be clicked to expand/collapse. */
  expandable: boolean;
  /** Current expand state (only meaningful when expandable). */
  expanded: boolean;
  /** This is the top-level (outermost) period in the tree. */
  isGroupTop: boolean;
  /**
   * The cell's left edge coincides with a top-level group boundary, so it should
   * carry the inter-group gap. True for the whole left spine of a group (e.g. the
   * Year cell, its first Quarter and that quarter's first Month all line up over
   * the body's single group gap). False for the very first group.
   */
  startsGap: boolean;
}

/** A scenario sub-header cell (bottom header row). */
export interface ScenarioHeaderCell {
  key: string;
  scenario: ScenarioKey;
  /** Leaf this scenario belongs to (for gap + variance grouping). */
  leafIndex: number;
  groupIndex: number;
  /** Is the first sub-column of its leaf (left padding / gap handling). */
  firstOfLeaf: boolean;
  /** This sub-column sits at a top-level group boundary → carries the gap. */
  startsGap: boolean;
}

export interface ColumnLayout {
  /** Visible leaf periods, left → right. */
  leaves: LeafColumn[];
  /** Period header cells grouped by header row. */
  headerRows: ColumnHeaderCell[][];
  /** The bottom scenario sub-header row. */
  scenarioRow: ScenarioHeaderCell[];
  /** Total number of header rows (period rows + 1 scenario row). */
  headerDepth: number;
  /** Total sub-column count (sum of scenarios [+ variance] over all leaves). */
  subColumnCount: number;
}

interface BuildOpts {
  expanded: ReadonlySet<string>;
  defaultScenarios: ScenarioKey[];
  showVariance: boolean;
}

function scenariosOf(period: MatrixPeriod, fallback: ScenarioKey[]): ScenarioKey[] {
  return period.scenarios && period.scenarios.length ? period.scenarios : fallback;
}

/**
 * Compute the full column layout: which periods are visible leaves, the nested
 * header rows (centered year/quarter super-headers over scenario sub-columns),
 * and the scenario sub-header row.
 */
export function buildColumnLayout(columns: MatrixPeriod[], opts: BuildOpts): ColumnLayout {
  const { expanded, defaultScenarios, showVariance } = opts;

  // First pass: gather visible leaves and the deepest visible level.
  const leaves: LeafColumn[] = [];
  let maxLevel = 0;
  const collectLeaves = (period: MatrixPeriod, level: number, groupIndex: number) => {
    const hasChildren = !!period.children && period.children.length > 0;
    const isExpanded = hasChildren && expanded.has(period.id);
    if (isExpanded) {
      for (const child of period.children!) collectLeaves(child, level + 1, groupIndex);
    } else {
      maxLevel = Math.max(maxLevel, level);
      leaves.push({
        period,
        scenarios: scenariosOf(period, defaultScenarios),
        expandable: hasChildren,
        groupIndex,
        startsGap: false, // filled in below once the full leaf order is known
      });
    }
  };
  columns.forEach((p, i) => collectLeaves(p, 0, i));

  // A single gap precedes the first leaf of every top-level group except the
  // very first - i.e. exactly at the boundaries between top-level periods. This
  // is the only place an inter-group gap is introduced; every renderer reads it
  // so the header bands, scenario row and body share the same column edges.
  leaves.forEach((leaf, li) => {
    const prev = leaves[li - 1];
    leaf.startsGap = prev != null && leaf.groupIndex !== prev.groupIndex;
  });

  const subWidth = (scns: ScenarioKey[]) => scns.length + (showVariance ? 1 : 0);

  // Second pass: emit header cells, distributed into rows by level. We walk the
  // tree left → right (same order as the leaves) and track a leaf cursor so each
  // header cell can inherit the `startsGap` flag of the leftmost leaf it spans -
  // that keeps a group's whole left spine (Year → Quarter → Month) aligned over
  // the body's single gap.
  const headerRows: ColumnHeaderCell[][] = Array.from({ length: maxLevel + 1 }, () => []);
  // `headerRows` is pre-sized to maxLevel + 1, so the row always exists; the
  // lazy create keeps a cell from being dropped should that ever change.
  const pushHeader = (level: number, cell: ColumnHeaderCell) => {
    (headerRows[level] ??= []).push(cell);
  };
  let leafCursor = 0;

  const emit = (period: MatrixPeriod, level: number, isGroupTop: boolean): number => {
    const startLeaf = leafCursor;
    const hasChildren = !!period.children && period.children.length > 0;
    const isExpanded = hasChildren && expanded.has(period.id);
    if (isExpanded) {
      let span = 0;
      // Only the outermost period is a group-top; children never are.
      for (const child of period.children!) span += emit(child, level + 1, false);
      pushHeader(level, {
        key: period.id,
        label: period.label,
        periodId: period.id,
        colSpan: span,
        level,
        rowSpan: 1,
        expandable: true,
        expanded: true,
        isGroupTop,
        startsGap: leaves[startLeaf]?.startsGap ?? false,
      });
      return span;
    }
    // Leaf: spans its scenario sub-columns, and rows down to the scenario row.
    const span = subWidth(scenariosOf(period, defaultScenarios));
    pushHeader(level, {
      key: period.id,
      label: period.label,
      periodId: period.id,
      colSpan: span,
      level,
      rowSpan: maxLevel - level + 1,
      expandable: hasChildren,
      expanded: false,
      isGroupTop,
      startsGap: leaves[startLeaf]?.startsGap ?? false,
    });
    leafCursor++;
    return span;
  };

  columns.forEach((p) => emit(p, 0, true));

  // Bottom scenario sub-header row.
  const scenarioRow: ScenarioHeaderCell[] = [];
  let subCount = 0;
  leaves.forEach((leaf, li) => {
    leaf.scenarios.forEach((scn, si) => {
      scenarioRow.push({
        key: `${leaf.period.id}::${scn}`,
        scenario: scn,
        leafIndex: li,
        groupIndex: leaf.groupIndex,
        firstOfLeaf: si === 0,
        startsGap: si === 0 && leaf.startsGap,
      });
      subCount++;
    });
    if (showVariance) subCount++; // the ΔBudget column has no scenario header cell
  });

  return {
    leaves,
    headerRows,
    scenarioRow,
    headerDepth: maxLevel + 2, // period rows (maxLevel+1) + scenario row
    subColumnCount: subCount,
  };
}

/* ------------------------------------------------------------------ *
 * Value resolution.
 * ------------------------------------------------------------------ */

/**
 * Resolve a single cell value. If the row has no own value for this
 * period/scenario but has children, the children are summed (so a collapsed
 * parent row still reports an aggregate).
 */
export function resolveCell(
  values: MatrixValues,
  row: MatrixRow,
  periodId: string,
  scenario: ScenarioKey,
): number | undefined {
  const own = values[row.id]?.[periodId]?.[scenario];
  // Non-finite upstream values (NaN / ±Infinity) are treated as missing so they
  // never surface as "NaN" text or feed variance/colour logic.
  if (own != null && Number.isFinite(own)) return own;
  if (row.children?.length) {
    let sum = 0;
    let any = false;
    for (const child of row.children) {
      const v = resolveCell(values, child, periodId, scenario);
      if (v != null) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : undefined;
  }
  return undefined;
}

/**
 * One matrix cell's variance - the library-wide {@link Variance} shape (`abs`,
 * `pct`, `favorable`). Kept as a named alias because it is part of this
 * module's public vocabulary; it is NOT a separate shape, so the matrix and
 * every other view stay in sync by construction.
 */
export type CellVariance = Variance;

/**
 * The ΔBudget variance for a cell: actual vs plan (configurable scenarios).
 * Delegates to the shared {@link computeVariance} (same favorability and
 * zero-base rules as statements, KPIs and tables). Returns null if either side
 * is missing.
 */
export function cellVariance(
  values: MatrixValues,
  row: MatrixRow,
  periodId: string,
  actualKey: ScenarioKey,
  baseKey: ScenarioKey,
): CellVariance | null {
  const ac = resolveCell(values, row, periodId, actualKey);
  const base = resolveCell(values, row, periodId, baseKey);
  return computeVariance(ac, base, row.higherIsBetter ?? true);
}
