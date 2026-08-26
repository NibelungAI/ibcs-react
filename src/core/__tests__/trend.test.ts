import { describe, it, expect } from "vitest";
import { computeTrend, type TrendDatum } from "../trend";

/**
 * Summary-scale treatment (consumer report B3).
 *
 * The docs' canonical layout — "a year + total" — used to be unusable: the
 * FY column (~12× any month) sat on the same linear scale and crushed every
 * month to a sliver ~8% of the plot. Summaries are now excluded from the
 * period domain and the variance half-scale, and a summary outside the
 * resulting domain is flagged `offScale` so the renderer caps it behind a
 * marked scale break.
 */
describe("computeTrend — summary scale treatment", () => {
  /** The report's repro: 12 months ~2.1–2.8M plus their 30.1M FY total. */
  const months: TrendDatum[] = Array.from({ length: 12 }, (_, i) => ({
    category: `M${i + 1}`,
    AC: 2_100_000 + i * 60_000,
    PY: 1_950_000 + i * 55_000,
  }));
  const fy: TrendDatum = { category: "FY", AC: 30_060_000, PY: 27_030_000, summary: true };
  const year = [...months, fy];

  it("excludes summary values from the period domain — months keep the scale", () => {
    const layout = computeTrend(year);
    // Domain top is the largest MONTH value, not the 30M total.
    expect(layout.domainMax).toBe(2_100_000 + 11 * 60_000);
    expect(layout.domainMin).toBe(0);
  });

  it("flags the out-of-domain summary offScale, and only that cell", () => {
    const layout = computeTrend(year);
    expect(layout.cells.map((c) => c.offScale)).toEqual([...months.map(() => false), true]);
  });

  it("excludes the summary's variance from the panel half-scale", () => {
    const layout = computeTrend(year);
    // Largest monthly Δ, not the ~3M full-year Δ.
    const monthlyMax = Math.max(...layout.cells.slice(0, 12).map((c) => c.variance!.abs));
    expect(layout.varMax).toBe(monthlyMax);
    expect(layout.cells[12]!.variance!.abs).toBeGreaterThan(layout.varMax);
  });

  it("keeps a same-magnitude summary on the shared scale (an average column)", () => {
    const avg: TrendDatum = { category: "Ø", AC: 2_430_000, PY: 2_252_500, summary: true };
    const layout = computeTrend([...months, avg]);
    expect(layout.cells[12]!.offScale).toBe(false);
    // Domain still comes from the months alone.
    expect(layout.domainMax).toBe(2_100_000 + 11 * 60_000);
  });

  it("flags a negative summary below the period floor too", () => {
    const layout = computeTrend([
      { category: "M1", AC: -120, PY: -100 },
      { category: "M2", AC: -90, PY: -110 },
      { category: "FY", AC: -210, PY: -210, summary: true },
    ]);
    expect(layout.domainMin).toBe(-120);
    expect(layout.cells[2]!.offScale).toBe(true);
  });

  it("survives an all-summary series with a sane fallback domain", () => {
    const layout = computeTrend([{ category: "FY", AC: 30_000_000, summary: true }]);
    expect(layout.domainMin).toBe(0);
    expect(layout.domainMax).toBe(1);
    expect(layout.cells[0]!.offScale).toBe(true);
  });

  it("changes nothing for a series without summaries", () => {
    const plain = computeTrend(months);
    expect(plain.domainMax).toBe(2_100_000 + 11 * 60_000);
    expect(plain.cells.every((c) => !c.offScale)).toBe(true);
  });
});
