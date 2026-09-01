/**
 * Serializable, JSON-friendly chart configuration.
 *
 * A `ChartConfig` fully describes a chart - its type, visual options, and data -
 * with nothing but plain JSON values (no functions, no React). This is what lets
 * a report be authored, stored, and round-tripped as JSON, and is the bridge to
 * an interactive BI-grade "configure the visual" experience: edit the JSON, get a chart.
 *
 * `<ConfiguredChart config={...} />` (in the react entry) renders any config.
 */

import { SCENARIO_KEYS, type ScenarioDatum, type ScenarioKey } from "./types";
import type { FormatOptions } from "./format";
import type { IbcsTokens } from "./tokens";
import type { TrendDatum } from "./trend";
import type { StructureDatum } from "./structure";
import type { WaterfallDatum } from "./waterfall";
import type { StackedDatum, StackedSeries } from "./stacked";
import type { LineDatum } from "./lineArea";
import type { ScatterDatum, BubbleDatum } from "./xy";
import type { ComboDatum, ComboSecondaryDatum } from "./combo";
import type { TreeNode } from "./tree";

/**
 * One category's value per scenario - the row shape charts consume. The
 * canonical {@link ScenarioDatum} with `AC` required: a config-authored
 * category chart always has an actual to draw.
 */
export type CategoryDatum = ScenarioDatum & { AC: number };

/**
 * Every supported config discriminator, in one place. `ChartType` is derived
 * from this list so the runtime catalogue and the type union cannot drift.
 */
export const CHART_TYPES = [
  "varianceColumn",
  "trend",
  "structure",
  "waterfall",
  "stacked",
  "line",
  "area",
  "scatter",
  "bubble",
  "combo",
  "tree",
] as const;

/** Discriminator shared by every chart config. Grows as components are added. */
export type ChartType = (typeof CHART_TYPES)[number];

interface ChartConfigBase {
  type: ChartType;
  /** Optional heading rendered above the chart. */
  title?: string;
  width?: number;
  height?: number;
  /** Number formatting for value labels. */
  format?: FormatOptions;
  /**
   * What the measure IS, declared explicitly for the conformance linter:
   * `"cost"` makes `checkIbcs` insist on `higherIsBetter:false` even when the
   * title doesn't sound like a cost; `"revenue"` silences the heuristic for
   * titles that merely sound like one ("Revenue after tax"). Rendering is
   * unaffected - favorability still follows `higherIsBetter`.
   */
  measureKind?: "cost" | "revenue";
}

/** Config for {@link VarianceColumnChart}: AC vs a comparison, variance beneath. */
export interface VarianceColumnChartConfig extends ChartConfigBase {
  type: "varianceColumn";
  /** Base scenario for the variance panel. Default "PY". */
  comparison?: ScenarioKey;
  /** Higher is better (set false for cost charts). Default true. */
  higherIsBetter?: boolean;
  /**
   * The lower variance panel: "abs" shows ΔPY values, "pct" shows ΔPY%,
   * "none" omits the panel entirely. Default "abs".
   */
  variance?: "abs" | "pct" | "none";
  /** Filled "bar" columns (default) or "pin" (line + dot). */
  mark?: "bar" | "pin";
  /** Color overrides (bar/variance colors), merged onto the active theme. */
  colors?: Partial<IbcsTokens["color"]>;
  data: CategoryDatum[];
}

/** Config for {@link TrendChart}: a run of periods (typically 13) with PY/PL bands. */
export interface TrendChartConfig extends ChartConfigBase {
  type: "trend";
  /** Base scenario for the variance panel. Default "PY". */
  comparison?: ScenarioKey;
  /** Higher is better (set false for cost series). Default true. */
  higherIsBetter?: boolean;
  /**
   * The lower variance panel: "abs" shows Δ values, "pct" shows Δ%, "none"
   * omits the panel entirely. Default "abs".
   */
  variance?: "abs" | "pct" | "none";
  /**
   * Scenarios drawn as reference lines riding along the columns. Default
   * `["PY","PL"]`; pass `["PY"]` for prior year only, `[]` for none. Only
   * "PY" and "PL" are honored today (FC support may come later) - any other
   * scenario is ignored.
   */
  referenceLines?: ScenarioKey[];
  /** Print the current value above each column. Default true. */
  showValueLabels?: boolean;
  /** Color overrides, merged onto the active theme. */
  colors?: Partial<IbcsTokens["color"]>;
  data: TrendDatum[];
}

/** Config for {@link StructureChart}: a ranked composition of a whole into parts. */
export interface StructureChartConfig extends ChartConfigBase {
  type: "structure";
  /** Base scenario each component is compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Order rows by magnitude. Default "desc". */
  sort?: "desc" | "asc" | "none";
  /** Chart-level higher-is-better default (per-datum value wins). Default true. */
  higherIsBetter?: boolean;
  /** Draw the comparison as a faded bar behind the current one. Default true. */
  showComparison?: boolean;
  /** Show each component's % of the total. Default true. */
  showShare?: boolean;
  /**
   * The Δ column vs the comparison: "abs" shows Δ values, "pct" shows Δ%,
   * "none" drops the column entirely. Default "abs".
   */
  variance?: "abs" | "pct" | "none";
  /** Color overrides, merged onto the active theme. */
  colors?: Partial<IbcsTokens["color"]>;
  data: StructureDatum[];
}

/** Config for {@link WaterfallChart}: a standalone add/subtract/result bridge. */
export interface WaterfallChartConfig extends ChartConfigBase {
  type: "waterfall";
  /** Scenario the bridge represents (drives fill style). Default "AC". */
  scenario?: ScenarioKey;
  /** Chart-level higher-is-better default (per-datum value wins). Default true. */
  higherIsBetter?: boolean;
  /** Print the contribution value on each column. Default true. */
  showValueLabels?: boolean;
  /** How the comparison variance is drawn. Default "bar". */
  mark?: "bar" | "pin";
  /** A parallel bridge (the same columns in another scenario) for the variance panel. */
  comparisonData?: WaterfallDatum[];
  /** Color overrides, merged onto the active theme. */
  colors?: Partial<IbcsTokens["color"]>;
  data: WaterfallDatum[];
}

/** Config for {@link StackedChart}: stacked columns (C01, time) or bars (C02, structure). */
export interface StackedChartConfig extends ChartConfigBase {
  type: "stacked";
  /** "column" (C01) or "bar" (C02). Default "column". */
  orientation?: "column" | "bar";
  /** Series in stack order. */
  series: StackedSeries[];
  /** Print the category total at the end of each stack. Default true. */
  showTotals?: boolean;
  /** Emphasize one series by key. */
  highlight?: string;
  /** Color overrides, merged onto the active theme. */
  colors?: Partial<IbcsTokens["color"]>;
  data: StackedDatum[];
}

/** Config for {@link LineChart}: dense multi-series time data (C07). */
export interface LineChartConfig extends ChartConfigBase {
  type: "line";
  /** Scenarios to draw, in order. Default: those present in the data. */
  series?: ScenarioKey[];
  /** Base scenario for the optional variance panel. Default "PY". */
  comparison?: ScenarioKey;
  /** Higher is better (false for cost series). Default true. */
  higherIsBetter?: boolean;
  /**
   * The lower variance panel: "abs" shows Δ values, "pct" shows Δ%, "none"
   * omits the panel entirely. Default "none" - a dense line chart is read as
   * a shape first, so the panel is opt-in here.
   */
  variance?: "abs" | "pct" | "none";
  /** Force markers on/off. Default: auto by point density. */
  showMarkers?: boolean;
  /** Color overrides, merged onto the active theme. */
  colors?: Partial<IbcsTokens["color"]>;
  data: LineDatum[];
}

/** Config for {@link AreaChart}: one scenario filled to zero (C08). */
export interface AreaChartConfig extends ChartConfigBase {
  type: "area";
  /** Scenario filled to the zero baseline. Default "AC". */
  scenario?: ScenarioKey;
  /** Reference line scenario on top (null to omit). Default "PY". */
  baseline?: ScenarioKey | null;
  /** Force markers on/off. Default: auto by point density. */
  showMarkers?: boolean;
  /** Color overrides, merged onto the active theme. */
  colors?: Partial<IbcsTokens["color"]>;
  data: LineDatum[];
}

/** Config for {@link ScatterChart}: a value/value scattergram (C09). */
export interface ScatterChartConfig extends ChartConfigBase {
  type: "scatter";
  xLabel?: string;
  yLabel?: string;
  /** Constant-product (x·y=k) iso-line levels. */
  isoLines?: number[];
  pointRadius?: number;
  colors?: Partial<IbcsTokens["color"]>;
  data: ScatterDatum[];
}

/** Config for {@link BubbleChart}: value/value plus a size dimension (C10). */
export interface BubbleChartConfig extends ChartConfigBase {
  type: "bubble";
  xLabel?: string;
  yLabel?: string;
  sizeLabel?: string;
  maxRadius?: number;
  colors?: Partial<IbcsTokens["color"]>;
  data: BubbleDatum[];
}

/** Config for {@link ComboChart}: primary scenario columns + a secondary-axis line (C05 family). */
export interface ComboChartConfig extends ChartConfigBase {
  type: "combo";
  /** Secondary series matched to `data` by category. Use this OR `secondaryKey`. */
  secondary?: ComboSecondaryDatum[];
  /** Numeric property name on each `data` row holding the secondary value. */
  secondaryKey?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryFormat?: FormatOptions;
  comparison?: ScenarioKey;
  higherIsBetter?: boolean;
  showComparison?: boolean;
  showVariance?: boolean;
  showSecondaryLabels?: boolean;
  colors?: Partial<IbcsTokens["color"]>;
  data: ComboDatum[];
}

/** Config for {@link TreeChart}: a calculation tree of related measures (C11). */
export interface TreeChartConfig extends ChartConfigBase {
  type: "tree";
  higherIsBetter?: boolean;
  orientation?: "horizontal" | "vertical";
  showVariance?: boolean;
  colors?: Partial<IbcsTokens["color"]>;
  root: TreeNode;
}

/** Any supported chart config. A discriminated union keyed on `type`. */
export type ChartConfig =
  | VarianceColumnChartConfig
  | TrendChartConfig
  | StructureChartConfig
  | WaterfallChartConfig
  | StackedChartConfig
  | LineChartConfig
  | AreaChartConfig
  | ScatterChartConfig
  | BubbleChartConfig
  | ComboChartConfig
  | TreeChartConfig;

/** A blank-slate variance column config, handy as a starting point in editors. */
export const defaultVarianceColumnConfig: VarianceColumnChartConfig = {
  type: "varianceColumn",
  title: "Untitled chart",
  comparison: "PY",
  variance: "abs",
  width: 560,
  height: 300,
  format: { compact: true, decimals: 1 },
  data: [],
};

/** A blank-slate trend config, handy as a starting point in editors. */
export const defaultTrendConfig: TrendChartConfig = {
  type: "trend",
  title: "Untitled trend",
  comparison: "PY",
  variance: "abs",
  width: 720,
  height: 360,
  format: { compact: true, decimals: 1 },
  data: [],
};

/** A blank-slate structure config, handy as a starting point in editors. */
export const defaultStructureConfig: StructureChartConfig = {
  type: "structure",
  title: "Untitled composition",
  comparison: "PY",
  sort: "desc",
  variance: "abs",
  showComparison: true,
  showShare: true,
  width: 600,
  height: 320,
  format: { compact: true, decimals: 1 },
  data: [],
};

/** A blank-slate waterfall/bridge config, handy as a starting point in editors. */
export const defaultWaterfallConfig: WaterfallChartConfig = {
  type: "waterfall",
  title: "Untitled bridge",
  scenario: "AC",
  mark: "bar",
  width: 640,
  height: 360,
  format: { compact: true, decimals: 1 },
  data: [],
};

/** Outcome of validating an unknown value against the config schema. */
export type ConfigValidation = { ok: true; config: ChartConfig } | { ok: false; error: string };

const SCENARIOS: readonly ScenarioKey[] = SCENARIO_KEYS;

/** Shared checks for the comparison / variance / color options both charts carry. */
function validateCommonOptions(c: Record<string, unknown>): string | null {
  if (c.comparison != null && !SCENARIOS.includes(c.comparison as ScenarioKey)) {
    return `comparison must be one of ${SCENARIOS.join(", ")}.`;
  }
  if (c.variance != null && c.variance !== "abs" && c.variance !== "pct" && c.variance !== "none") {
    return 'variance must be "abs", "pct", or "none".';
  }
  if (c.colors != null && (typeof c.colors !== "object" || Array.isArray(c.colors))) {
    return "colors must be an object of color overrides.";
  }
  return null;
}

/**
 * Validate an arbitrary parsed value (e.g. from a JSON editor) as a ChartConfig.
 * Returns a typed config or a human-readable error - never throws.
 */
export function validateChartConfig(value: unknown): ConfigValidation {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "Config must be a JSON object." };
  }
  const c = value as Record<string, unknown>;

  if (!(CHART_TYPES as readonly string[]).includes(c.type as string)) {
    return {
      ok: false,
      error: `Unknown chart type: ${JSON.stringify(c.type)} (expected one of ${CHART_TYPES.map((t) => `"${t}"`).join(", ")}).`,
    };
  }

  // Waterfall is validated first: it carries no ScenarioKey `comparison` and no
  // variance mode at all - its reference is `comparisonData`, a parallel bridge
  // of contributions - so the common check has nothing to say about it, and its
  // own {category, value, flow} row shape needs checks no other config wants.
  if (c.type === "waterfall") {
    if (c.mark != null && c.mark !== "bar" && c.mark !== "pin") {
      return { ok: false, error: 'mark must be "bar" or "pin".' };
    }
    if (c.scenario != null && !SCENARIOS.includes(c.scenario as ScenarioKey)) {
      return { ok: false, error: `scenario must be one of ${SCENARIOS.join(", ")}.` };
    }
    if (c.colors != null && (typeof c.colors !== "object" || Array.isArray(c.colors))) {
      return { ok: false, error: "colors must be an object of color overrides." };
    }
    if (!Array.isArray(c.data))
      return { ok: false, error: "data must be an array of contributions." };
    if (c.comparisonData != null && !Array.isArray(c.comparisonData)) {
      return { ok: false, error: "comparisonData must be an array of contributions." };
    }
    const flows = ["add", "subtract", "result"];
    for (let i = 0; i < c.data.length; i++) {
      const d = c.data[i] as Record<string, unknown>;
      if (typeof d?.category !== "string")
        return { ok: false, error: `data[${i}].category must be a string.` };
      if (typeof d?.value !== "number")
        return { ok: false, error: `data[${i}].value must be a number.` };
      if (d?.flow != null && !flows.includes(d.flow as string)) {
        return { ok: false, error: `data[${i}].flow must be "add", "subtract", or "result".` };
      }
    }
    return { ok: true, config: value as WaterfallChartConfig };
  }

  // Stacked carries a `series` list and a {category, values} data shape - no
  // ScenarioKey comparison - so it's validated before the common check too.
  if (c.type === "stacked") {
    if (c.orientation != null && c.orientation !== "column" && c.orientation !== "bar") {
      return { ok: false, error: 'orientation must be "column" or "bar".' };
    }
    if (!Array.isArray(c.series) || c.series.length === 0) {
      return { ok: false, error: "series must be a non-empty array of {key,label}." };
    }
    for (let i = 0; i < c.series.length; i++) {
      const s = c.series[i] as Record<string, unknown>;
      if (typeof s?.key !== "string")
        return { ok: false, error: `series[${i}].key must be a string.` };
      if (typeof s?.label !== "string")
        return { ok: false, error: `series[${i}].label must be a string.` };
    }
    if (c.colors != null && (typeof c.colors !== "object" || Array.isArray(c.colors))) {
      return { ok: false, error: "colors must be an object of color overrides." };
    }
    if (!Array.isArray(c.data))
      return { ok: false, error: "data must be an array of category rows." };
    for (let i = 0; i < c.data.length; i++) {
      const d = c.data[i] as Record<string, unknown>;
      if (typeof d?.category !== "string")
        return { ok: false, error: `data[${i}].category must be a string.` };
      if (typeof d?.values !== "object" || d.values === null || Array.isArray(d.values)) {
        return { ok: false, error: `data[${i}].values must be an object of series values.` };
      }
    }
    return { ok: true, config: value as StackedChartConfig };
  }

  // Scatter/bubble use an {x, y, size?} data shape, not CategoryDatum.
  if (c.type === "scatter" || c.type === "bubble") {
    if (c.colors != null && (typeof c.colors !== "object" || Array.isArray(c.colors))) {
      return { ok: false, error: "colors must be an object of color overrides." };
    }
    if (c.type === "scatter" && c.isoLines != null) {
      if (
        !Array.isArray(c.isoLines) ||
        (c.isoLines as unknown[]).some((v) => typeof v !== "number")
      ) {
        return { ok: false, error: "isoLines must be an array of numbers." };
      }
    }
    if (!Array.isArray(c.data)) return { ok: false, error: "data must be an array of points." };
    for (let i = 0; i < c.data.length; i++) {
      const d = c.data[i] as Record<string, unknown>;
      if (typeof d?.x !== "number") return { ok: false, error: `data[${i}].x must be a number.` };
      if (typeof d?.y !== "number") return { ok: false, error: `data[${i}].y must be a number.` };
      if (d?.group != null && typeof d.group !== "string")
        return { ok: false, error: `data[${i}].group must be a string.` };
      if (c.type === "bubble" && typeof d?.size !== "number")
        return { ok: false, error: `data[${i}].size must be a number.` };
    }
    return { ok: true, config: value as ScatterChartConfig | BubbleChartConfig };
  }

  // Tree has no `data` array (it carries `root`), so it's validated up front.
  if (c.type === "tree") {
    if (c.colors != null && (typeof c.colors !== "object" || Array.isArray(c.colors))) {
      return { ok: false, error: "colors must be an object of color overrides." };
    }
    if (c.orientation != null && c.orientation !== "horizontal" && c.orientation !== "vertical") {
      return { ok: false, error: 'orientation must be "horizontal" or "vertical".' };
    }
    const OPS = ["+", "-", "*", "/"];
    const checkNode = (node: unknown, path: string): string | null => {
      if (typeof node !== "object" || node === null) return `${path} must be an object.`;
      const nd = node as Record<string, unknown>;
      if (typeof nd.id !== "string") return `${path}.id must be a string.`;
      if (typeof nd.label !== "string") return `${path}.label must be a string.`;
      if (typeof nd.value !== "number") return `${path}.value must be a number.`;
      if (nd.py != null && typeof nd.py !== "number") return `${path}.py must be a number.`;
      if (nd.op != null && !OPS.includes(nd.op as string))
        return `${path}.op must be "+", "-", "*", or "/".`;
      if (nd.children != null) {
        if (!Array.isArray(nd.children)) return `${path}.children must be an array.`;
        for (let i = 0; i < nd.children.length; i++) {
          const e = checkNode(nd.children[i], `${path}.children[${i}]`);
          if (e) return e;
        }
      }
      return null;
    };
    const err = checkNode(c.root, "root");
    if (err) return { ok: false, error: err };
    return { ok: true, config: value as TreeChartConfig };
  }

  // Combo: scenario columns + a secondary series; comparison is a ScenarioKey.
  if (c.type === "combo") {
    const ce = validateCommonOptions(c);
    if (ce) return { ok: false, error: ce };
    if (c.secondary != null && !Array.isArray(c.secondary)) {
      return { ok: false, error: "secondary must be an array of {category,value}." };
    }
    if (c.secondaryKey != null && typeof c.secondaryKey !== "string") {
      return { ok: false, error: "secondaryKey must be a string." };
    }
    if (!Array.isArray(c.data))
      return { ok: false, error: "data must be an array of category rows." };
    for (let i = 0; i < c.data.length; i++) {
      const d = c.data[i] as Record<string, unknown>;
      if (typeof d?.category !== "string")
        return { ok: false, error: `data[${i}].category must be a string.` };
      const present = SCENARIOS.filter((s) => d?.[s] != null);
      for (const s of present)
        if (typeof d[s] !== "number")
          return { ok: false, error: `data[${i}].${s} must be a number.` };
      if (present.length === 0)
        return {
          ok: false,
          error: `data[${i}] must have at least one of ${SCENARIOS.join(", ")}.`,
        };
    }
    return { ok: true, config: value as ComboChartConfig };
  }

  const commonError = validateCommonOptions(c);
  if (commonError) return { ok: false, error: commonError };

  if (!Array.isArray(c.data)) {
    return { ok: false, error: "data must be an array of period rows." };
  }

  if (c.type === "varianceColumn") {
    if (c.mark != null && c.mark !== "bar" && c.mark !== "pin") {
      return { ok: false, error: 'mark must be "bar" or "pin".' };
    }
    for (let i = 0; i < c.data.length; i++) {
      const d = c.data[i] as Record<string, unknown>;
      if (typeof d?.category !== "string") {
        return { ok: false, error: `data[${i}].category must be a string.` };
      }
      if (typeof d?.AC !== "number") {
        return { ok: false, error: `data[${i}].AC must be a number.` };
      }
    }
    return { ok: true, config: value as VarianceColumnChartConfig };
  }

  if (c.type === "structure") {
    if (c.sort != null && c.sort !== "desc" && c.sort !== "asc" && c.sort !== "none") {
      return { ok: false, error: 'sort must be "desc", "asc", or "none".' };
    }
    // Rows are named components carrying optional scenarios; at least one
    // scenario value must be present. The name key is `category`, with the
    // pre-1.1 `label` kept as a permanent alias - `category` wins when both
    // are present, the same resolution the chart itself applies.
    for (let i = 0; i < c.data.length; i++) {
      const d = c.data[i] as Record<string, unknown>;
      if (typeof (d?.category ?? d?.label) !== "string") {
        return { ok: false, error: `data[${i}].category must be a string.` };
      }
      const present = SCENARIOS.filter((s) => d?.[s] != null);
      for (const s of present) {
        if (typeof d[s] !== "number") {
          return { ok: false, error: `data[${i}].${s} must be a number.` };
        }
      }
      if (present.length === 0) {
        return {
          ok: false,
          error: `data[${i}] must have at least one of ${SCENARIOS.join(", ")}.`,
        };
      }
    }
    return { ok: true, config: value as StructureChartConfig };
  }

  if (c.type === "line" || c.type === "area") {
    if (c.type === "line" && c.series != null) {
      if (!Array.isArray(c.series) || c.series.some((s) => !SCENARIOS.includes(s as ScenarioKey))) {
        return { ok: false, error: `series must be an array of ${SCENARIOS.join(", ")}.` };
      }
    }
    if (c.type === "area") {
      if (c.scenario != null && !SCENARIOS.includes(c.scenario as ScenarioKey)) {
        return { ok: false, error: `scenario must be one of ${SCENARIOS.join(", ")}.` };
      }
      if (c.baseline != null && !SCENARIOS.includes(c.baseline as ScenarioKey)) {
        return { ok: false, error: `baseline must be null or one of ${SCENARIOS.join(", ")}.` };
      }
    }
    for (let i = 0; i < c.data.length; i++) {
      const d = c.data[i] as Record<string, unknown>;
      if (typeof d?.category !== "string")
        return { ok: false, error: `data[${i}].category must be a string.` };
      const present = SCENARIOS.filter((s) => d?.[s] != null);
      for (const s of present)
        if (typeof d[s] !== "number")
          return { ok: false, error: `data[${i}].${s} must be a number.` };
      if (present.length === 0)
        return {
          ok: false,
          error: `data[${i}] must have at least one of ${SCENARIOS.join(", ")}.`,
        };
    }
    return { ok: true, config: value as LineChartConfig | AreaChartConfig };
  }

  // type === "trend": rows carry optional scenarios (AC may be absent on
  // forecast-only periods), but at least one scenario value must be present.
  if (c.referenceLines != null) {
    if (
      !Array.isArray(c.referenceLines) ||
      c.referenceLines.some((s) => !SCENARIOS.includes(s as ScenarioKey))
    ) {
      return { ok: false, error: `referenceLines must be an array of ${SCENARIOS.join(", ")}.` };
    }
  }
  for (let i = 0; i < c.data.length; i++) {
    const d = c.data[i] as Record<string, unknown>;
    if (typeof d?.category !== "string") {
      return { ok: false, error: `data[${i}].category must be a string.` };
    }
    const present = SCENARIOS.filter((s) => d?.[s] != null);
    for (const s of present) {
      if (typeof d[s] !== "number") {
        return { ok: false, error: `data[${i}].${s} must be a number.` };
      }
    }
    if (present.length === 0) {
      return { ok: false, error: `data[${i}] must have at least one of ${SCENARIOS.join(", ")}.` };
    }
  }
  return { ok: true, config: value as TrendChartConfig };
}
