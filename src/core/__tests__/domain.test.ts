import { describe, it, expect } from "vitest";
import { finiteOr, isFiniteNumber, normalizeDomain, valueDomain } from "../domain";

describe("finiteOr", () => {
  it("passes finite numbers through, including 0 and negatives", () => {
    expect(finiteOr(42)).toBe(42);
    expect(finiteOr(-0.5)).toBe(-0.5);
    expect(finiteOr(0)).toBe(0);
  });

  it("treats NaN and infinities as missing", () => {
    expect(finiteOr(NaN)).toBe(0);
    expect(finiteOr(Infinity)).toBe(0);
    expect(finiteOr(-Infinity)).toBe(0);
  });

  it("treats null/undefined as missing", () => {
    expect(finiteOr(null)).toBe(0);
    expect(finiteOr(undefined)).toBe(0);
  });

  it("honours an explicit fallback for missing values only", () => {
    expect(finiteOr(NaN, 7)).toBe(7);
    expect(finiteOr(undefined, 7)).toBe(7);
    expect(finiteOr(3, 7)).toBe(3);
    // A legitimate 0 is NOT missing - it must not fall back.
    expect(finiteOr(0, 7)).toBe(0);
  });
});

describe("isFiniteNumber", () => {
  it("accepts finite numbers", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-1e9)).toBe(true);
  });

  it("rejects non-finite numbers and non-numbers", () => {
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber("5")).toBe(false);
    expect(isFiniteNumber({})).toBe(false);
  });
});

describe("normalizeDomain", () => {
  it("leaves a normal mixed-sign domain untouched", () => {
    expect(normalizeDomain(-20, 80)).toEqual({ domainMin: -20, domainMax: 80 });
  });

  it("leaves an all-positive domain untouched", () => {
    expect(normalizeDomain(0, 250)).toEqual({ domainMin: 0, domainMax: 250 });
  });

  it("PRESERVES an all-negative domain as [min, 0] (the `|| 1` regression)", () => {
    // The old `domainMax || 1` idiom turned this into [-500, 1].
    expect(normalizeDomain(-500, 0)).toEqual({ domainMin: -500, domainMax: 0 });
    // The pathological case: a small all-negative extent used to lose ~2/3 of
    // the plot to an empty positive half.
    expect(normalizeDomain(-0.5, 0)).toEqual({ domainMin: -0.5, domainMax: 0 });
  });

  it("widens an EMPTY (all-zero) domain to [0, 1] so nothing divides by zero", () => {
    expect(normalizeDomain(0, 0)).toEqual({ domainMin: 0, domainMax: 1 });
  });

  it("collapses non-finite ends to 0 instead of poisoning the axis", () => {
    expect(normalizeDomain(NaN, 5)).toEqual({ domainMin: 0, domainMax: 5 });
    expect(normalizeDomain(-5, NaN)).toEqual({ domainMin: -5, domainMax: 0 });
    expect(normalizeDomain(NaN, NaN)).toEqual({ domainMin: 0, domainMax: 1 });
    expect(normalizeDomain(-Infinity, Infinity)).toEqual({ domainMin: 0, domainMax: 1 });
    expect(normalizeDomain(Infinity, 4)).toEqual({ domainMin: 0, domainMax: 4 });
  });

  it("swaps an inverted pair rather than emitting a negative extent", () => {
    expect(normalizeDomain(80, -20)).toEqual({ domainMin: -20, domainMax: 80 });
    expect(normalizeDomain(3, 0)).toEqual({ domainMin: 0, domainMax: 3 });
    expect(normalizeDomain(0, -3)).toEqual({ domainMin: -3, domainMax: 0 });
  });

  it("always returns a renderable extent (min <= max, never both zero)", () => {
    const pairs: [number, number][] = [
      [0, 0],
      [-1, 0],
      [0, 1],
      [NaN, NaN],
      [5, -5],
      [-Infinity, 0],
    ];
    for (const [a, b] of pairs) {
      const d = normalizeDomain(a, b);
      expect(Number.isFinite(d.domainMin)).toBe(true);
      expect(Number.isFinite(d.domainMax)).toBe(true);
      expect(d.domainMin).toBeLessThan(d.domainMax);
    }
  });
});

describe("valueDomain", () => {
  it("returns [0, 1] for an empty stream", () => {
    expect(valueDomain([])).toEqual({ domainMin: 0, domainMax: 1 });
  });

  it("returns [0, 1] for an all-zero stream", () => {
    expect(valueDomain([0, 0, 0])).toEqual({ domainMin: 0, domainMax: 1 });
  });

  it("keeps an all-negative stream at [min, 0] - zero stays the baseline", () => {
    expect(valueDomain([-5, -1, -3])).toEqual({ domainMin: -5, domainMax: 0 });
  });

  it("brackets zero for an all-positive stream", () => {
    expect(valueDomain([10, 30, 20])).toEqual({ domainMin: 0, domainMax: 30 });
  });

  it("spans both signs for mixed data", () => {
    expect(valueDomain([3, -2, 1])).toEqual({ domainMin: -2, domainMax: 3 });
  });

  it("skips missing entries: NaN, infinities, null and undefined", () => {
    expect(valueDomain([NaN, 4, Infinity, null, undefined, -Infinity])).toEqual({
      domainMin: 0,
      domainMax: 4,
    });
  });

  it("falls back to [0, 1] when every entry is missing", () => {
    expect(valueDomain([NaN, Infinity, null, undefined])).toEqual({ domainMin: 0, domainMax: 1 });
  });

  it("accepts any iterable, not just arrays", () => {
    function* gen() {
      yield -2;
      yield NaN;
      yield 6;
    }
    expect(valueDomain(gen())).toEqual({ domainMin: -2, domainMax: 6 });
    expect(valueDomain(new Set([1, -1]))).toEqual({ domainMin: -1, domainMax: 1 });
  });
});
