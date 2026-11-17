import { describe, expect, it } from "vitest";
import { defaultLabels, fillLabel, mergeLabels, prefixLabel } from "../labels";

describe("defaultLabels", () => {
  it("keeps the IBCS scenario codes and 1.4's words", () => {
    expect(defaultLabels.scenario).toEqual({ AC: "AC", PY: "PY", PL: "PL", FC: "FC" });
    expect(defaultLabels.total).toBe("Total");
    expect(defaultLabels.versus).toBe("vs");
    expect(defaultLabels.percentagePoints).toBe("pp");
    expect(defaultLabels.scenarioTitle).toEqual({
      AC: "Actual",
      PY: "PY",
      PL: "Plan / budget",
      FC: "Forecast",
    });
  });

  it("has no empty word", () => {
    const walk = (o: object, path: string[] = []): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "string" ? (v === "" ? [[...path, k].join(".")] : []) : walk(v, [...path, k]),
      );
    expect(walk(defaultLabels)).toEqual([]);
  });
});

describe("mergeLabels", () => {
  it("merges a partial dictionary group by group, leaving the rest", () => {
    const sr = mergeLabels({
      total: "Ukupno",
      scenario: { AC: "Ostvareno" },
      export: { print: "Štampaj" },
    });
    expect(sr.total).toBe("Ukupno");
    expect(sr.scenario).toEqual({ AC: "Ostvareno", PY: "PY", PL: "PL", FC: "FC" });
    expect(sr.export.print).toBe("Štampaj");
    expect(sr.export.svg).toBe("SVG");
    expect(sr.versus).toBe("vs");
  });

  it("composes onto a base other than the defaults", () => {
    const base = mergeLabels({ total: "Ukupno", versus: "u odnosu na" });
    const inner = mergeLabels({ versus: "naspram" }, base);
    expect(inner.total).toBe("Ukupno");
    expect(inner.versus).toBe("naspram");
  });

  it("keeps the base word for an explicit undefined, and accepts an empty word", () => {
    const merged = mergeLabels({ total: undefined, scenario: { AC: "" } });
    expect(merged.total).toBe("Total");
    expect(merged.scenario.AC).toBe("");
  });

  it("returns the base itself for no override and never mutates the defaults", () => {
    expect(mergeLabels(undefined)).toBe(defaultLabels);
    mergeLabels({ total: "X", scenario: { PY: "Y" } });
    expect(defaultLabels.total).toBe("Total");
    expect(defaultLabels.scenario.PY).toBe("PY");
  });
});

describe("fillLabel and prefixLabel", () => {
  it("fills placeholders and leaves unknown ones as written", () => {
    expect(fillLabel("Point {n}", { n: 3 })).toBe("Point 3");
    expect(fillLabel("+{count} more", { count: 12 })).toBe("+12 more");
    expect(fillLabel("showing {shown} of {total}", { shown: "1,000" })).toBe(
      "showing 1,000 of {total}",
    );
    expect(fillLabel("Tačka {n}, opet {n}", { n: 2 })).toBe("Tačka 2, opet 2");
  });

  it("joins a series word to its value, or writes the value alone for an empty word", () => {
    expect(prefixLabel("AC", "150")).toBe("AC 150");
    expect(prefixLabel("", "0,14%")).toBe("0,14%");
  });
});
