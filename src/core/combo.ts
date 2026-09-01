import { isFiniteNumber, normalizeDomain } from "./domain";
import type { ScenarioDatum, ScenarioKey, Variance } from "./types";
import { computeVariance } from "./variance";

/**
 * Pure layout for an IBCS combo chart (template C05 family): a PRIMARY measure
 * drawn as scenario columns (AC vs a comparison) plus a SECONDARY measure on an
 * independent right-hand axis, drawn as a line. Classic use: revenue columns +
 * a margin-% line.
 *
 * Framework-agnostic and JSON-serializable in and out - the React `ComboChart`
 * is just a renderer over this. Both axes are zero-based (ISO 24896) and scaled
 * independently so the two measures, in different units, can share one plot.
 */

/**
 * One category's primary measure, one value per scenario - the canonical
 * {@link ScenarioDatum}. (A `secondaryKey` row simply carries the secondary
 * measure as an extra property; excess-property checks only bite on object
 * literals typed directly as `ComboDatum`.)
 */
export type ComboDatum = ScenarioDatum;

/** A secondary-measure value keyed by category (the separate-array form). */
export interface ComboSecondaryDatum {
  category: string;
  value: number;
}

/**
 * A category enriched with its resolved comparison value, secondary value, and
 * variance. Values are echoed back SANITIZED: a non-finite input is missing
 * data, so it reads as `undefined` / `null` here and is simply not drawn.
 */
export interface ComboCell {
  category: string;
  /** Primary actual (drawn as the front column). */
  AC: number | undefined;
  /** Resolved comparison-scenario value (drawn faded behind AC). */
  comparison: number | undefined;
  PL: number | undefined;
  FC: number | undefined;
  /** Secondary-axis value for this category (null when absent - the line breaks). */
  secondary: number | null;
  /** AC vs the comparison scenario, colored by favorability. */
  variance: Variance | null;
}

export interface ComboLayout {
  cells: ComboCell[];
  /** Primary (left) axis domain - always includes 0. */
  primaryMin: number;
  primaryMax: number;
  /** Secondary (right) axis domain - always includes 0. */
  secondaryMin: number;
  secondaryMax: number;
  comparison: ScenarioKey;
}

export interface ComputeComboOptions {
  /** Scenario the AC columns are compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Whether a higher primary value is good (false for cost series). Default true. */
  higherIsBetter?: boolean;
}

/**
 * Resolve each category's comparison value, its secondary value (aligned by
 * index with `data`), the AC-vs-comparison variance, and the two independent
 * zero-based axis domains.
 *
 * `secondary[i]` is the secondary measure for `data[i]` (null/undefined where a
 * category has no secondary point - the renderer breaks the line there).
 *
 * Both domains are zero-seeded and repaired the same way the other layouts are:
 * non-finite values are MISSING (they never widen an axis), and an all-negative
 * measure keeps its max at 0 instead of reserving an unused positive half.
 */
export function computeCombo(
  data: ComboDatum[],
  secondary: ReadonlyArray<number | null | undefined>,
  opts: ComputeComboOptions = {},
): ComboLayout {
  const comparison = opts.comparison ?? "PY";
  const higherIsBetter = opts.higherIsBetter ?? true;

  let primaryMin = 0;
  let primaryMax = 0;
  let secondaryMin = 0;
  let secondaryMax = 0;

  const cells: ComboCell[] = data.map((d, i) => {
    // Drop missing (absent OR non-finite) values up front so neither axis nor
    // the variance can ever see a NaN.
    const ac = isFiniteNumber(d.AC) ? d.AC : undefined;
    const raw = d[comparison];
    const cmp = isFiniteNumber(raw) ? raw : undefined;
    for (const v of [ac, cmp]) {
      if (v != null) {
        primaryMin = Math.min(primaryMin, v);
        primaryMax = Math.max(primaryMax, v);
      }
    }

    const rawSec = secondary[i];
    const sec = isFiniteNumber(rawSec) ? rawSec : null;
    if (sec != null) {
      secondaryMin = Math.min(secondaryMin, sec);
      secondaryMax = Math.max(secondaryMax, sec);
    }

    const variance = ac != null && cmp != null ? computeVariance(ac, cmp, higherIsBetter) : null;

    return {
      category: d.category,
      AC: ac,
      comparison: cmp,
      PL: isFiniteNumber(d.PL) ? d.PL : undefined,
      FC: isFiniteNumber(d.FC) ? d.FC : undefined,
      secondary: sec,
      variance,
    };
  });

  const primaryDomain = normalizeDomain(primaryMin, primaryMax);
  const secondaryDomain = normalizeDomain(secondaryMin, secondaryMax);

  return {
    cells,
    primaryMin: primaryDomain.domainMin,
    primaryMax: primaryDomain.domainMax,
    secondaryMin: secondaryDomain.domainMin,
    secondaryMax: secondaryDomain.domainMax,
    comparison,
  };
}
