import { describe, expect, it } from "vitest";
import {
  defaultLabels,
  deltaHeading,
  endLabelText,
  fillLabel,
  mergeLabels,
  scenarioHeadings,
} from "../labels";

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

describe("fillLabel and the heading helpers", () => {
  it("fills placeholders and leaves unknown ones as written", () => {
    expect(fillLabel("Point {n}", { n: 3 })).toBe("Point 3");
    expect(fillLabel("+{count} more", { count: 12 })).toBe("+12 more");
    expect(fillLabel("showing {shown} of {total}", { shown: "1,000" })).toBe(
      "showing 1,000 of {total}",
    );
    expect(fillLabel("Tačka {n}, opet {n}", { n: 2 })).toBe("Tačka 2, opet 2");
  });

  it("writes an end label from its template, with no dangling space for an empty word", () => {
    expect(endLabelText(defaultLabels, "AC", "150")).toBe("AC 150");
    expect(endLabelText(defaultLabels, "", "0,14%")).toBe("0,14%");
    expect(endLabelText(mergeLabels({ endLabel: "{value}" }), "AC", "150")).toBe("150");
    expect(endLabelText(mergeLabels({ endLabel: "{value} ({name})" }), "DPS", "9")).toBe("9 (DPS)");
  });

  it("never leaves a heading blank: an empty word falls back to the title, then the code", () => {
    expect(scenarioHeadings(defaultLabels)).toEqual({ AC: "AC", PY: "PY", PL: "PL", FC: "FC" });
    const empty = mergeLabels({ scenario: { AC: "", PL: "" }, scenarioTitle: { PL: "" } });
    expect(scenarioHeadings(empty)).toEqual({ AC: "Actual", PY: "PY", PL: "PL", FC: "FC" });
  });

  it("writes the Δ headers from the delta templates", () => {
    expect(deltaHeading(defaultLabels, "PY")).toBe("ΔPY");
    expect(deltaHeading(defaultLabels, "PY", true)).toBe("ΔPY%");
    const sr = mergeLabels({ delta: "Δ {base}", deltaPct: "Δ {base} (%)" });
    expect(deltaHeading(sr, "PG")).toBe("Δ PG");
    expect(deltaHeading(sr, "PG", true)).toBe("Δ PG (%)");
  });
});
