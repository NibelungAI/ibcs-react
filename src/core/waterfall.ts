import { finiteOr, isFiniteNumber, normalizeDomain } from "./domain";
import type { ScenarioKey, Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * One labelled contribution in a standalone bridge (waterfall) chart.
 *
 * Distinct from the in-table waterfall ({@link computeWaterfall} over a
 * `StatementLine` tree): this is a flat, fully JSON-serializable series of
 * named contributions, the input to {@link computeBridge} and the React
 * `WaterfallChart`.
 *
 *  - "add":      moves the running total up by `value` (revenue, inflow)
 *  - "subtract": moves the running total down by `value` (cost, outflow)
 *  - "result":   a checkpoint column — a full bar from zero to the running
 *                total, which it does NOT advance (Gross margin, EBIT, …)
 *
 * `value` is always given as a magnitude for add/subtract (the sign is implied
 * by `flow`), but a negative `value` is honoured too (an "add" of -10 moves the
 * total down). For "result" columns `value` is ignored — the column draws to
 * the current running total.
 */
export interface WaterfallDatum {
  category: string;
  value: number;
  /** How this column participates. Default "add". */
  flow?: "add" | "subtract" | "result";
  /**
   * Whether a higher running total is good here. Default true; set false on a
   * cost bridge so an unfavorable swing reads red. Used only for the optional
   * comparison variance.
   */
  higherIsBetter?: boolean;
}

/** A contribution positioned as a floating bar with its running totals. */
export interface BridgeBar extends WaterfallDatum {
  /** Resolved flow ("add" when unset). */
  flow: "add" | "subtract" | "result";
  /** Signed amount applied to the running total (0 for a result column). */
  delta: number;
  /** Bar start in value units (running total entering; 0 for a result). */
  from: number;
  /** Bar end in value units (running total leaving; the level for a result). */
  to: number;
  /** Running total entering this column. */
  cumBefore: number;
  /** Running total leaving this column. */
  cumAfter: number;
  /** True for "result" columns — drawn as a full, emphasised bar from zero. */
  isTotal: boolean;
  /** Visual travel of the bar: "up" when `to >= from`, else "down". */
  direction: "up" | "down";
  /** Variance of this column's level (`to`) vs the comparison bridge, if any. */
  variance: Variance | null;
}

export interface BridgeLayout {
  bars: BridgeBar[];
  /** Most negative point on the value axis (≤ 0). The zero baseline is always in. */
  domainMin: number;
  /** Most positive point on the value axis (≥ 0). */
  domainMax: number;
  /** Final running total after every step. */
  total: number;
  /** Largest |level variance| vs the comparison (the variance-panel half-scale). */
  varMax: number;
  scenario: ScenarioKey;
}

export interface ComputeBridgeOptions {
  /**
   * A parallel bridge (same columns, another scenario) to compare each running
   * level against. Aligned by index; extra/missing entries are ignored.
   */
  comparison?: WaterfallDatum[];
  /** Chart-level higher-is-better default (per-datum value wins). Default true. */
  higherIsBetter?: boolean;
}

/** One accumulation step: the source datum, resolved flow and spanned levels. */
interface BridgeStep {
  /** The datum this step was accumulated from. */
  datum: WaterfallDatum;
  flow: "add" | "subtract" | "result";
  /** The sanitized magnitude actually used (a missing value contributes 0). */
  value: number;
  delta: number;
  from: number;
  to: number;
}

/**
 * THE bridge accumulation — the single place a running total is advanced.
 *
 * Both lanes run through this helper (the drawn series in {@link computeBridge}
 * and the optional comparison series), so the comparison levels can never drift
 * from the bars they are measured against.
 *
 * Per the shared domain policy a non-finite `value` is MISSING data: it
 * contributes 0 to the run rather than poisoning every level downstream with
 * `NaN` (which would collapse the whole axis and render a blank chart).
 */
function accumulate(items: WaterfallDatum[]): BridgeStep[] {
  let cum = 0;
  return items.map((d) => {
    const flow = d.flow ?? "add";
    const value = finiteOr(d.value);
    // A result column is a checkpoint: it draws to the level but never moves it.
    if (flow === "result") return { datum: d, flow, value, delta: 0, from: 0, to: cum };
    const delta = flow === "subtract" ? -value : value;
    const from = cum;
    cum = from + delta;
    return { datum: d, flow, value, delta, from, to: cum };
  });
}

/**
 * Pure bridge layout: turn labelled contributions into positioned floating
 * bars with running totals and a zero-based value domain. Framework agnostic —
 * the React `WaterfallChart` is just a renderer over this.
 *
 * The domain always includes 0 so the zero baseline sits inside the plot even
 * for an all-positive bridge, mirroring {@link computeTrend} / {@link
 * computeWaterfall}. Negative running totals map correctly around the axis, and
 * an all-negative bridge keeps `domainMax === 0` instead of padding the plot
 * with an empty positive half. Non-finite values are treated as MISSING (they
 * contribute 0 to the run and never widen the domain), so a single `NaN` can
 * never blank out the chart.
 */
export function computeBridge(
  items: WaterfallDatum[],
  scenario: ScenarioKey = "AC",
  opts: ComputeBridgeOptions = {},
): BridgeLayout {
  const defaultHib = opts.higherIsBetter ?? true;
  const steps = accumulate(items);
  const compLevels = opts.comparison ? accumulate(opts.comparison).map((s) => s.to) : null;

  let domainMin = 0;
  let domainMax = 0;
  let varMax = 0;
  const track = (...vals: number[]) => {
    for (const v of vals) {
      if (!isFiniteNumber(v)) continue;
      domainMin = Math.min(domainMin, v);
      domainMax = Math.max(domainMax, v);
    }
  };

  const bars: BridgeBar[] = steps.map(({ datum: d, flow, value, delta, from, to }, i) => {
    const hib = d.higherIsBetter ?? defaultHib;
    track(from, to);

    const compTo = compLevels?.[i];
    const variance = compTo != null ? computeVariance(to, compTo, hib) : null;
    if (variance && isFiniteNumber(variance.abs)) varMax = Math.max(varMax, Math.abs(variance.abs));

    return {
      ...d,
      // Echo the sanitized magnitude, so `value` and `delta` always agree.
      value,
      flow,
      delta,
      from,
      to,
      cumBefore: flow === "result" ? to : from,
      cumAfter: to,
      isTotal: flow === "result",
      direction: to >= from ? "up" : "down",
      variance,
    };
  });

  return {
    bars,
    ...normalizeDomain(domainMin, domainMax),
    total: steps[steps.length - 1]?.to ?? 0,
    varMax: varMax || 1,
    scenario,
  };
}
