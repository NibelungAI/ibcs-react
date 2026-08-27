import { describe, it, expect } from "vitest";
import { validateChartConfig } from "../config";

/**
 * The config-path side of the `category` / `label` alias contract (consumer
 * report D1). `computeStructure` resolved the alias from the start, but
 * `validateChartConfig` kept demanding `label` — so the same rows a mounted
 * `<StructureChart>` rendered fine were rejected by every config-driven
 * surface (`ConfiguredChart`, `Report`, `checkIbcs`) with
 * "data[0].label must be a string." These tests pin the validator to the
 * datum contract: `category` preferred, `label` accepted forever, `category`
 * winning when both are present.
 */
describe("validateChartConfig — structure category/label alias", () => {
  const base = { type: "structure", width: 520, height: 280 } as const;

  it("accepts category-keyed rows (the documented preferred shape)", () => {
    const result = validateChartConfig({
      ...base,
      data: [{ category: "North America", AC: 120, PY: 100 }],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts label-keyed rows (the pre-1.1 shape, kept forever)", () => {
    const result = validateChartConfig({
      ...base,
      data: [{ label: "North America", AC: 120, PY: 100 }],
    });
    expect(result.ok).toBe(true);
  });

  it("accepts rows carrying both keys — category wins, label rides along", () => {
    const result = validateChartConfig({
      ...base,
      data: [{ category: "North America", label: "NA (legacy)", AC: 120 }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a non-string category even when a string label is present", () => {
    // `category` wins when both exist — the chart would render the malformed
    // key, so validation must not silently fall back to `label`.
    const result = validateChartConfig({
      ...base,
      data: [{ category: 42, label: "North America", AC: 120 }],
    });
    expect(result).toEqual({ ok: false, error: "data[0].category must be a string." });
  });

  it("rejects rows naming neither key, steering to the preferred vocabulary", () => {
    const result = validateChartConfig({ ...base, data: [{ AC: 120 }] });
    expect(result).toEqual({ ok: false, error: "data[0].category must be a string." });
  });
});
