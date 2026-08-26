/**
 * KPI model: one headline figure (the actual) compared against one or more
 * scenarios, with a favorability-aware status. Pure logic — `<KpiCard>` renders
 * it, and a KPI is just one of the block types a report can lay out.
 */

import type { ScenarioKey, Variance } from "./types";
import type { FormatOptions } from "./format";
import { computeVariance } from "./variance";

/** Scenario values behind a single KPI. AC is the headline; the rest compare. */
export interface KpiValues {
  AC?: number;
  PY?: number;
  PL?: number;
  FC?: number;
}

/** Serializable KPI definition — a report block, or a standalone card. */
export interface KpiConfig {
  /** Caption above the number, e.g. "Revenue". */
  label: string;
  values: KpiValues;
  /** Scenarios to show a delta against, in order. Default ["PY"]. */
  comparisons?: ScenarioKey[];
  /** Whether a higher value is good (false for cost/expense KPIs). Default true. */
  higherIsBetter?: boolean;
  /**
   * What the measure IS, declared explicitly for the conformance linter:
   * `"cost"` makes `checkIbcs` insist on `higherIsBetter:false` even when the
   * label doesn't sound like a cost; `"revenue"` silences the heuristic for
   * labels that merely sound like one ("Revenue after tax"). Rendering is
   * unaffected — favorability still follows `higherIsBetter`.
   */
  measureKind?: "cost" | "revenue";
  /**
   * Number formatting — and the KPI's unit symbol: `currency` for a leading
   * one ("€30.1M"), `suffix` for a trailing one ("18.4%").
   */
  format?: FormatOptions;
  /**
   * What KIND of number this is. `"ratio"` declares a percentage measure — a
   * margin, a rate, a share — whose deltas are PERCENTAGE POINTS: the card
   * renders the absolute delta as `+0.6pp` and drops the relative delta,
   * because "the margin grew +0.9%" next to "18.4%" invites misreading a
   * relative change as points. Default `"absolute"` — ordinary quantities,
   * deltas shown as value and percent.
   */
  unit?: "absolute" | "ratio";
  /** Optional micro-series drawn under the number. */
  sparkline?: number[];
  /** How the sparkline is drawn. Default "area" (what `<KpiCard>` renders). */
  sparklineType?: "line" | "area" | "bar";
}

export interface KpiDelta {
  base: ScenarioKey;
  variance: Variance | null;
}

export interface KpiResult {
  /** The headline value (AC). */
  current: number | undefined;
  deltas: KpiDelta[];
  /** Overall read, from the first comparison: favorable / unfavorable / flat. */
  status: "good" | "bad" | "neutral";
}

/** Resolve a KPI's headline, its deltas vs each comparison, and a status. */
export function computeKpi(config: KpiConfig): KpiResult {
  const { values, comparisons = ["PY"], higherIsBetter = true } = config;
  const current = values.AC;
  const deltas: KpiDelta[] = comparisons.map((base) => ({
    base,
    variance: computeVariance(current, values[base], higherIsBetter),
  }));

  const lead = deltas[0]?.variance;
  const status: KpiResult["status"] =
    !lead || lead.abs === 0 ? "neutral" : lead.favorable ? "good" : "bad";

  return { current, deltas, status };
}

/** Validate an unknown value as a KpiConfig (for JSON-authored reports). */
export function validateKpiConfig(value: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null)
    return { ok: false, error: "KPI block must be an object." };
  const c = value as Record<string, unknown>;
  if (typeof c.label !== "string") return { ok: false, error: "kpi.label must be a string." };
  if (typeof c.values !== "object" || c.values === null)
    return { ok: false, error: "kpi.values must be an object." };
  if (typeof (c.values as KpiValues).AC !== "number")
    return { ok: false, error: "kpi.values.AC must be a number." };
  return { ok: true };
}
