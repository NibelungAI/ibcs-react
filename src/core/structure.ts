import { isFiniteNumber } from "./domain";
import type { ScenarioKey, Variance } from "./types";
import { computeVariance } from "./variance";

/** The scenario values and per-component options a composition part carries. */
export interface StructureComponentValues {
  AC?: number;
  PY?: number;
  PL?: number;
  FC?: number;
  /**
   * Whether a higher value is good for this component. Default true; set false
   * for cost/expense parts so a rise reads as unfavorable. Overrides the
   * chart-level default.
   */
  higherIsBetter?: boolean;
}

/**
 * One component of a composition (a part of a whole): a named item carrying
 * up to four scenario values. The "current" series is the actual (`AC`) when
 * present, otherwise the forecast (`FC`).
 *
 * The name key is `category` — the SAME key every other datum in the library
 * uses — so one array can feed a `VarianceColumnChart` and a `StructureChart`
 * without renaming anything. `label` (the only key before v1.1) is accepted as
 * an alias forever; when both are present, `category` wins.
 */
export type StructureDatum = StructureComponentValues &
  (
    | {
        /** Component name ("COGS", "EMEA"). Preferred — matches every other datum type. */
        category: string;
        /** @deprecated Use `category`. Kept as an alias so v1.0 data keeps working. */
        label?: string;
      }
    | {
        /** @deprecated Use `category` — the key every other datum type uses. */
        label: string;
        category?: string;
      }
  );

/**
 * A component enriched with its share of the total and variance vs the
 * comparison. Scenario values are echoed back SANITIZED: a non-finite input is
 * missing data, so it reads as `undefined` here and never reaches the geometry.
 */
export interface StructureSegment extends StructureComponentValues {
  /** Resolved display name — `category`, falling back to the legacy `label`. */
  label: string;
  /** Echo of the input `category`, when the datum carried one. */
  category?: string;
  /** The drawn value: `AC` when present, else `FC`, else 0. */
  current: number;
  /** The comparison-scenario value, if present. */
  base: number | undefined;
  /** `current` / total — the component's share of the whole (0..1). */
  share: number;
  /** `base` / baseTotal — the comparison share, or null when unavailable. */
  baseShare: number | null;
  /** `current` vs `base` (respects `higherIsBetter`). */
  variance: Variance | null;
  /** Running sum of `current` entering this segment (for a stacked layout). */
  cumBefore: number;
  /** Running sum of `current` leaving this segment. */
  cumAfter: number;
}

export interface StructureLayout {
  /** Components, in render order (sorted unless `sort: "none"`). */
  segments: StructureSegment[];
  /** Sum of `current` across all components. */
  total: number;
  /** Sum of `base` across components that have one. */
  baseTotal: number;
  /** Largest |value| across current and base — the bar-length scale. */
  maxAbs: number;
  comparison: ScenarioKey;
}

export interface ComputeStructureOptions {
  /** Reference scenario each component is compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Order rows by magnitude. Default "desc" (largest contributor first). */
  sort?: "desc" | "asc" | "none";
  /** Chart-level higher-is-better default (per-datum value wins). Default true. */
  higherIsBetter?: boolean;
}

/**
 * Pure composition layout: resolve each component's current value, its share of
 * the total, and its variance against the comparison scenario; rank the
 * components; and report the totals and the bar-length scale. Framework
 * agnostic — the React `StructureChart` is just a renderer over this.
 *
 * Non-finite scenario values are MISSING: they contribute nothing to the totals
 * (a single `NaN` can never wipe out the whole composition) and yield no
 * variance.
 */
export function computeStructure(
  data: StructureDatum[],
  opts: ComputeStructureOptions = {},
): StructureLayout {
  const comparison = opts.comparison ?? "PY";
  const sort = opts.sort ?? "desc";
  const defaultHib = opts.higherIsBetter ?? true;

  const prepared = data.map((d) => {
    const AC = isFiniteNumber(d.AC) ? d.AC : undefined;
    const PY = isFiniteNumber(d.PY) ? d.PY : undefined;
    const PL = isFiniteNumber(d.PL) ? d.PL : undefined;
    const FC = isFiniteNumber(d.FC) ? d.FC : undefined;
    return {
      d,
      // `category` is the preferred key; `label` is the pre-1.1 alias. The
      // segment always exposes the resolved name as `label`.
      name: d.category ?? d.label ?? "",
      scenarios: { AC, PY, PL, FC },
      current: AC ?? FC ?? 0,
      base: { AC, PY, PL, FC }[comparison],
    };
  });

  let total = 0;
  let baseTotal = 0;
  for (const p of prepared) {
    total += p.current;
    if (p.base != null) baseTotal += p.base;
  }

  let rows: StructureSegment[] = prepared.map((p) => {
    const hib = p.d.higherIsBetter ?? defaultHib;
    return {
      ...p.d,
      ...p.scenarios,
      label: p.name,
      current: p.current,
      base: p.base,
      share: total !== 0 ? p.current / total : 0,
      baseShare: baseTotal !== 0 && p.base != null ? p.base / baseTotal : null,
      variance: p.base != null ? computeVariance(p.current, p.base, hib) : null,
      cumBefore: 0,
      cumAfter: 0,
    };
  });

  if (sort === "desc")
    rows = rows.slice().sort((a, b) => Math.abs(b.current) - Math.abs(a.current));
  else if (sort === "asc")
    rows = rows.slice().sort((a, b) => Math.abs(a.current) - Math.abs(b.current));

  let cum = 0;
  let maxAbs = 0;
  for (const s of rows) {
    s.cumBefore = cum;
    cum += s.current;
    s.cumAfter = cum;
    maxAbs = Math.max(maxAbs, Math.abs(s.current), s.base != null ? Math.abs(s.base) : 0);
  }

  return { segments: rows, total, baseTotal, maxAbs: maxAbs || 1, comparison };
}
