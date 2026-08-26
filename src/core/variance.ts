import { isFiniteNumber } from "./domain";
import type { ScenarioKey, StatementLine, Variance } from "./types";

/**
 * Compute one variance: AC vs a base scenario.
 * `higherIsBetter` flips the favorable test for cost/expense/tax lines.
 */
export function computeVariance(
  ac: number | undefined,
  base: number | undefined,
  higherIsBetter = true,
): Variance | null {
  if (ac == null || base == null) return null;
  const abs = ac - base;
  const pct = base !== 0 ? abs / Math.abs(base) : null;
  const favorable = higherIsBetter ? abs >= 0 : abs <= 0;
  return { abs, pct, favorable };
}

/**
 * Resolve a line's value for a scenario. If the line has no own value but has
 * children, sum the children (so collapsed groups still report a total).
 *
 * A non-finite own value (`NaN`, `±Infinity`) counts as MISSING, exactly like an
 * absent one: the line falls through to summing its children, and a group whose
 * children are all missing resolves to `undefined` rather than propagating a
 * `NaN` into every running total and domain above it.
 */
export function resolveValue(line: StatementLine, scenario: ScenarioKey): number | undefined {
  const own = line.values[scenario];
  if (isFiniteNumber(own)) return own;
  if (line.children?.length) {
    let sum = 0;
    let any = false;
    for (const child of line.children) {
      const v = resolveValue(child, scenario);
      if (isFiniteNumber(v)) {
        sum += v;
        any = true;
      }
    }
    return any && Number.isFinite(sum) ? sum : undefined;
  }
  return undefined;
}

/** Variance for a line, comparing AC against the given base scenario. */
export function lineVariance(
  line: StatementLine,
  base: ScenarioKey,
  scenario: ScenarioKey = "AC",
): Variance | null {
  return computeVariance(
    resolveValue(line, scenario),
    resolveValue(line, base),
    line.higherIsBetter ?? true,
  );
}
