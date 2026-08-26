import { describe, it, expect } from "vitest";
import { computeKpi, validateKpiConfig } from "../kpi";

describe("computeKpi", () => {
  it("returns the AC headline as current", () => {
    expect(computeKpi({ label: "Rev", values: { AC: 120, PY: 100 } }).current).toBe(120);
  });

  it("defaults to a single PY comparison", () => {
    const r = computeKpi({ label: "Rev", values: { AC: 120, PY: 100 } });
    expect(r.deltas).toHaveLength(1);
    expect(r.deltas[0]!.base).toBe("PY");
    expect(r.deltas[0]!.variance!.abs).toBe(20);
  });

  it("reports a favorable lead variance as status 'good'", () => {
    expect(computeKpi({ label: "Rev", values: { AC: 120, PY: 100 } }).status).toBe("good");
  });

  it("reports an unfavorable lead variance as status 'bad'", () => {
    expect(computeKpi({ label: "Rev", values: { AC: 80, PY: 100 } }).status).toBe("bad");
  });

  it("reports a flat lead variance as status 'neutral'", () => {
    expect(computeKpi({ label: "Rev", values: { AC: 100, PY: 100 } }).status).toBe("neutral");
  });

  it("flips status for a cost KPI (higherIsBetter:false)", () => {
    // Cost rose vs PY -> unfavorable
    expect(
      computeKpi({ label: "Cost", values: { AC: 120, PY: 100 }, higherIsBetter: false }).status,
    ).toBe("bad");
    // Cost fell vs PY -> favorable
    expect(
      computeKpi({ label: "Cost", values: { AC: 90, PY: 100 }, higherIsBetter: false }).status,
    ).toBe("good");
  });

  it("computes a delta per requested comparison, in order", () => {
    const r = computeKpi({
      label: "Rev",
      values: { AC: 120, PY: 100, PL: 130 },
      comparisons: ["PL", "PY"],
    });
    expect(r.deltas.map((d) => d.base)).toEqual(["PL", "PY"]);
    expect(r.deltas[0]!.variance!.abs).toBe(-10); // vs plan
    expect(r.deltas[1]!.variance!.abs).toBe(20); // vs py
    // status follows the FIRST comparison (vs plan, below plan = bad)
    expect(r.status).toBe("bad");
  });

  it("yields a null delta and neutral status when a comparison value is missing", () => {
    const r = computeKpi({ label: "Rev", values: { AC: 120 }, comparisons: ["PY"] });
    expect(r.deltas[0]!.variance).toBeNull();
    expect(r.status).toBe("neutral");
  });

  it("returns undefined current when AC is absent", () => {
    expect(computeKpi({ label: "Rev", values: { PY: 100 } }).current).toBeUndefined();
  });
});

describe("validateKpiConfig", () => {
  it("accepts a well-formed config", () => {
    expect(validateKpiConfig({ label: "Rev", values: { AC: 1 } })).toEqual({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateKpiConfig(null).ok).toBe(false);
    expect(validateKpiConfig(7).ok).toBe(false);
  });

  it("rejects a missing/invalid label", () => {
    expect(validateKpiConfig({ values: { AC: 1 } }).ok).toBe(false);
  });

  it("rejects missing values or a non-numeric AC", () => {
    expect(validateKpiConfig({ label: "x" }).ok).toBe(false);
    expect(validateKpiConfig({ label: "x", values: { PY: 1 } }).ok).toBe(false);
  });
});
