/**
 * Core data model for IBCS financial statements.
 *
 * The whole library is built on ONE model: a tree of `StatementLine`s carrying
 * one value per scenario. Tables and charts are just different views over the
 * same model - the data source (Navision report engine, static JSON, an API)
 * is the caller's concern. Components never fetch.
 */

/** The IBCS scenarios, in canonical order. AC = actual, PY = previous year, PL = plan/budget, FC = forecast. */
export const SCENARIO_KEYS = ["AC", "PY", "PL", "FC"] as const;

/** IBCS scenarios. AC = actual, PY = previous year, PL = plan/budget, FC = forecast. */
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

/**
 * THE standard category-row shape: one label plus one optional value per
 * scenario. Every category/period chart in the library speaks this - trend
 * periods, line points, combo columns, variance columns - so a single array of
 * rows feeds them all, and `CategoryDatum`, `ColumnDatum`, `TrendDatum`,
 * `LineDatum` and `ComboDatum` are all this type (or a narrow extension of it).
 *
 * A scenario is OPTIONAL because real data is ragged: a forecast period has no
 * AC, a new product has no PY. Missing means "not drawn", never zero.
 */
export interface ScenarioDatum {
  /** Row label: a category ("EMEA") or a period ("Jan", "Q1", "2024"). */
  category: string;
  AC?: number;
  PY?: number;
  PL?: number;
  FC?: number;
}

/**
 * How a line participates in the waterfall of the actual column.
 *  - "add":      moves the running total up (revenue, other income)
 *  - "subtract": moves the running total down (costs, expenses, tax)
 *  - "result":   a checkpoint subtotal; draws a full bar 0..runningTotal and
 *                does NOT move the total itself (Revenue, Gross margin, …)
 */
export type LineFlow = "add" | "subtract" | "result";

export interface StatementLine {
  id: string;
  label: string;
  /** Default "add". */
  flow?: LineFlow;
  /** Value per scenario, in real currency units. May be negative. */
  values: Partial<Record<ScenarioKey, number>>;
  /**
   * Whether a higher value is good. Default true.
   * Set false on cost/expense/tax lines so an increase reads as unfavorable (red).
   */
  higherIsBetter?: boolean;
  /**
   * Breakdown children. A line with children is collapsible.
   *  - collapsed: the parent contributes a single aggregated bar
   *  - expanded:  the children carry the flow, the parent is a label
   * Children must sum to the parent for a consistent waterfall.
   */
  children?: StatementLine[];
  /** Start collapsed. Default false. */
  defaultCollapsed?: boolean;
  /** Force bold/emphasis. Auto-true for flow="result". */
  emphasis?: boolean;
}

/**
 * One variance column in a statement: compare the scenario against `base`,
 * show it as an absolute delta or a percent, drawn as a bar or a pin (dot).
 * A list of these drives the right-hand panels - the reference layout is
 * `[{base:"PY",mode:"abs",mark:"bar"}, {base:"PY",mode:"pct",mark:"pin"}]`.
 */
export interface VarianceColumnSpec {
  /** Comparison scenario (AC is compared against this). */
  base: ScenarioKey;
  /** Show the absolute delta or the percent change. Default "abs". */
  mode?: "abs" | "pct";
  /** Filled "bar" or "pin" (line + dot, IBCS lollipop). Default "bar". */
  mark?: "bar" | "pin";
  /** Header override. Default "ΔPY" / "ΔPY%". */
  label?: string;
  /**
   * Percent mode only: a |%| at or beyond this is drawn as an off-scale arrow
   * instead of a dot, and is excluded from the axis scale. Default 100.
   */
  clampPct?: number;
}

/** A single computed variance (AC vs a comparison scenario). */
export interface Variance {
  /** AC − base, in currency units. */
  abs: number;
  /** (AC − base) / |base|, or null when base is 0. */
  pct: number | null;
  /** True when the delta is good for the business (respects higherIsBetter). */
  favorable: boolean;
}

/** A row produced by flattening the model for rendering. */
export interface FlatRow {
  line: StatementLine;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/** Bar geometry in VALUE units (the renderer maps these to pixels). */
export type WaterfallBar =
  | { kind: "none" }
  /** Subtotal/result bar spanning the axis origin to `to`. */
  | { kind: "full"; from: number; to: number }
  /**
   * A step that moves the running total from `from` to `to`.
   * `outline: true` marks an expanded group's bracket - it spans the whole
   * group (which the children fill in) and is drawn hollow, not filled.
   */
  | { kind: "delta"; from: number; to: number; direction: "add" | "subtract"; outline?: boolean };

export interface WaterfallRow extends FlatRow {
  bar: WaterfallBar;
  /** Running total entering this row (where its connector comes in). */
  cumBefore: number;
  /** Running total leaving this row (where its connector goes out). */
  cumAfter: number;
}

export interface WaterfallLayout {
  rows: WaterfallRow[];
  /** Most negative point on the value axis (≤ 0). Maps to the left edge. */
  domainMin: number;
  /** Most positive point on the value axis (≥ 0). Maps to the right edge. */
  domainMax: number;
}
