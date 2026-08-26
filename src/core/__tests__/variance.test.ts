import { describe, it, expect } from "vitest";
import { computeVariance, resolveValue, lineVariance } from "../variance";
import type { StatementLine } from "../types";

describe("computeVariance", () => {
  it("computes absolute and percent deltas for a revenue-like (higherIsBetter) line", () => {
    const v = computeVariance(120, 100, true);
    expect(v).not.toBeNull();
    expect(v!.abs).toBe(20);
    expect(v!.pct).toBeCloseTo(0.2);
    expect(v!.favorable).toBe(true);
  });

  it("marks a decrease as unfavorable when higher is better", () => {
    const v = computeVariance(80, 100, true)!;
    expect(v.abs).toBe(-20);
    expect(v.pct).toBeCloseTo(-0.2);
    expect(v.favorable).toBe(false);
  });

  it("flips favorability for cost measures: a cost increase is unfavorable", () => {
    const v = computeVariance(120, 100, false)!;
    expect(v.abs).toBe(20);
    expect(v.favorable).toBe(false); // overrun = bad
  });

  it("treats a cost decrease as favorable", () => {
    const v = computeVariance(90, 100, false)!;
    expect(v.abs).toBe(-10);
    expect(v.favorable).toBe(true); // came in under budget = good
  });

  it("treats an exactly-flat delta as favorable (abs >= 0) when higher is better", () => {
    const v = computeVariance(100, 100, true)!;
    expect(v.abs).toBe(0);
    expect(v.favorable).toBe(true);
  });

  it("treats an exactly-flat delta as favorable (abs <= 0) for cost measures too", () => {
    const v = computeVariance(100, 100, false)!;
    expect(v.abs).toBe(0);
    expect(v.favorable).toBe(true);
  });

  it("defaults higherIsBetter to true", () => {
    expect(computeVariance(10, 5)!.favorable).toBe(true);
    expect(computeVariance(5, 10)!.favorable).toBe(false);
  });

  it("returns null percent when the base is zero (no division)", () => {
    const v = computeVariance(50, 0, true)!;
    expect(v.abs).toBe(50);
    expect(v.pct).toBeNull();
    expect(v.favorable).toBe(true);
  });

  it("uses |base| in the percent denominator so a negative base keeps the sign of abs", () => {
    // ac=-50, base=-100: abs = +50 (improved), pct = 50/100 = +0.5
    const v = computeVariance(-50, -100, true)!;
    expect(v.abs).toBe(50);
    expect(v.pct).toBeCloseTo(0.5);
    expect(v.favorable).toBe(true);
  });

  it("returns null when either operand is missing", () => {
    expect(computeVariance(undefined, 100)).toBeNull();
    expect(computeVariance(100, undefined)).toBeNull();
    expect(computeVariance(undefined, undefined)).toBeNull();
  });
});

describe("resolveValue", () => {
  const tree: StatementLine = {
    id: "g",
    label: "Group",
    values: {}, // no own value
    children: [
      { id: "a", label: "A", values: { AC: 30, PY: 20 } },
      { id: "b", label: "B", values: { AC: 12, PY: 10 } },
    ],
  };

  it("returns a line's own value when present", () => {
    const line: StatementLine = { id: "x", label: "X", values: { AC: 7 } };
    expect(resolveValue(line, "AC")).toBe(7);
  });

  it("sums children when the parent has no own value (collapsed group total)", () => {
    expect(resolveValue(tree, "AC")).toBe(42);
    expect(resolveValue(tree, "PY")).toBe(30);
  });

  it("returns undefined when neither the line nor any child has the scenario", () => {
    expect(resolveValue(tree, "FC")).toBeUndefined();
  });

  it("prefers an own value over summing children", () => {
    const line: StatementLine = {
      id: "p",
      label: "P",
      values: { AC: 999 },
      children: [{ id: "c", label: "C", values: { AC: 1 } }],
    };
    expect(resolveValue(line, "AC")).toBe(999);
  });

  it("treats a non-finite own value as MISSING and falls through to the children", () => {
    const line: StatementLine = {
      id: "p",
      label: "P",
      values: { AC: NaN },
      children: [
        { id: "c1", label: "C1", values: { AC: 30 } },
        { id: "c2", label: "C2", values: { AC: 12 } },
      ],
    };
    expect(resolveValue(line, "AC")).toBe(42);
  });

  it("returns undefined for a non-finite own value with no children", () => {
    const line: StatementLine = { id: "x", label: "X", values: { AC: NaN, PY: Infinity } };
    expect(resolveValue(line, "AC")).toBeUndefined();
    expect(resolveValue(line, "PY")).toBeUndefined();
  });

  it("skips non-finite children instead of poisoning the group total", () => {
    const line: StatementLine = {
      id: "g",
      label: "G",
      values: {},
      children: [
        { id: "a", label: "A", values: { AC: 30 } },
        { id: "b", label: "B", values: { AC: NaN } },
        { id: "c", label: "C", values: { AC: -Infinity } },
      ],
    };
    expect(resolveValue(line, "AC")).toBe(30);
  });

  it("sums nested grandchildren", () => {
    const nested: StatementLine = {
      id: "root",
      label: "Root",
      values: {},
      children: [
        {
          id: "mid",
          label: "Mid",
          values: {},
          children: [
            { id: "l1", label: "L1", values: { AC: 5 } },
            { id: "l2", label: "L2", values: { AC: 6 } },
          ],
        },
        { id: "l3", label: "L3", values: { AC: 4 } },
      ],
    };
    expect(resolveValue(nested, "AC")).toBe(15);
  });
});

describe("lineVariance", () => {
  it("compares AC against the requested base using resolved (summed) values", () => {
    const line: StatementLine = {
      id: "g",
      label: "G",
      values: {},
      children: [
        { id: "a", label: "A", values: { AC: 60, PY: 50 } },
        { id: "b", label: "B", values: { AC: 40, PY: 50 } },
      ],
    };
    const v = lineVariance(line, "PY")!;
    expect(v.abs).toBe(0); // 100 vs 100
    expect(v.favorable).toBe(true);
  });

  it("honours a line's higherIsBetter flag (cost line)", () => {
    const cost: StatementLine = {
      id: "c",
      label: "Cost",
      higherIsBetter: false,
      values: { AC: 120, PY: 100 },
    };
    expect(lineVariance(cost, "PY")!.favorable).toBe(false);
  });

  it("returns null when the base value cannot be resolved", () => {
    const line: StatementLine = { id: "x", label: "X", values: { AC: 10 } };
    expect(lineVariance(line, "PL")).toBeNull();
  });
});
