import { describe, it, expect } from "vitest";
import { computeStructure, type StructureDatum } from "../structure";

/**
 * The `category` / `label` alias contract (consumer report D1).
 *
 * Every other datum in the library keys its name on `category`;
 * `StructureDatum` historically used `label` - the one break in "one data
 * model feeds every view". `category` is now the preferred key and `label`
 * stays as a permanent alias, so v1.0 data keeps computing identically.
 */
describe("computeStructure - category/label alias", () => {
  const byCategory: StructureDatum[] = [
    { category: "North America", AC: 120, PY: 100 },
    { category: "Europe", AC: 80, PY: 90 },
  ];
  const byLabel: StructureDatum[] = [
    { label: "North America", AC: 120, PY: 100 },
    { label: "Europe", AC: 80, PY: 90 },
  ];

  it("accepts `category` as the component name (the key every other chart uses)", () => {
    const layout = computeStructure(byCategory, { sort: "none" });
    expect(layout.segments.map((s) => s.label)).toEqual(["North America", "Europe"]);
    // The input key is echoed back too, so round-tripping keeps the data shape.
    expect(layout.segments.map((s) => s.category)).toEqual(["North America", "Europe"]);
  });

  it("computes identically from `category` data and legacy `label` data", () => {
    const a = computeStructure(byCategory, { sort: "none" });
    const b = computeStructure(byLabel, { sort: "none" });
    expect(a.total).toBe(b.total);
    expect(a.segments.map((s) => ({ label: s.label, current: s.current, share: s.share }))).toEqual(
      b.segments.map((s) => ({ label: s.label, current: s.current, share: s.share })),
    );
  });

  it("prefers `category` when both keys are present", () => {
    const layout = computeStructure([{ category: "Canonical", label: "Legacy", AC: 10 }]);
    expect(layout.segments[0]!.label).toBe("Canonical");
  });

  it("handles a mixed array - migrated and unmigrated rows side by side", () => {
    const layout = computeStructure(
      [
        { category: "New", AC: 60 },
        { label: "Old", AC: 40 },
      ],
      { sort: "none" },
    );
    expect(layout.segments.map((s) => s.label)).toEqual(["New", "Old"]);
    expect(layout.total).toBe(100);
  });

  it("feeds the same `category`-keyed array shape that category charts consume", () => {
    // The point of the alias: one array, two views, no renaming `.map()`.
    const shared = [{ category: "EMEA", AC: 5, PY: 4 }];
    const layout = computeStructure(shared);
    expect(layout.segments[0]!.label).toBe("EMEA");
    expect(layout.segments[0]!.share).toBe(1);
  });
});
