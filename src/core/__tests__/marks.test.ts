/**
 * The 1.5 marks in the layout models: error-bar half-widths and the scales
 * that make room for them (RankingVariance), magnitude marks and intervals in
 * the DataTable model.
 */
import { describe, expect, it } from "vitest";
import { computeRankingVariance, type RankingDatum } from "../rankingVariance";
import {
  buildDataTableModel,
  cellError,
  valueMarkOf,
  type DataTableColumn,
  type DataTableRow,
} from "../datatable";

const ranking: RankingDatum[] = [
  { label: "A", AC: 110, base: 100 },
  { label: "B", AC: 95, base: 100 },
  { label: "C", AC: 104, base: 100 },
];

describe("computeRankingVariance - error bars", () => {
  it("is unchanged by the feature when no datum has a half-width", () => {
    const layout = computeRankingVariance(ranking);
    expect(layout.acMax).toBe(110);
    expect(layout.absMax).toBe(10);
    expect(layout.pctMax).toBeCloseTo(10, 10);
    for (const r of layout.rows) {
      expect("acError" in r || "absError" in r || "pctError" in r).toBe(false);
    }
  });

  it("carries valid half-widths onto the rows and drops invalid ones", () => {
    const layout = computeRankingVariance(
      [
        { label: "A", AC: 110, base: 100, acError: 2, absError: 1.5, pctError: 0.4 },
        { label: "B", AC: 95, base: 100, acError: -1, absError: NaN, pctError: Infinity },
      ],
      { sortBy: "none" },
    );
    expect(layout.rows[0]).toMatchObject({ acError: 2, absError: 1.5, pctError: 0.4 });
    expect("acError" in layout.rows[1]!).toBe(false);
    expect("absError" in layout.rows[1]!).toBe(false);
    expect("pctError" in layout.rows[1]!).toBe(false);
  });

  it("widens each shared scale so the far end of a whisker fits", () => {
    const layout = computeRankingVariance([
      { label: "A", AC: 110, base: 100, acError: 6, absError: 3, pctError: 2 },
      { label: "B", AC: 95, base: 100 },
    ]);
    expect(layout.acMax).toBe(116);
    expect(layout.absMax).toBe(13);
    expect(layout.pctMax).toBeCloseTo(12, 10);
  });

  it("caps a percent whisker at the off-scale threshold", () => {
    const layout = computeRankingVariance([{ label: "A", AC: 190, base: 100, pctError: 30 }], {
      clampPct: 100,
    });
    // 90 % + 30 would reach 120: the scale stops at the clamp.
    expect(layout.pctMax).toBe(100);
  });

  it("gives the total no half-width (an interval of a sum is not their sum)", () => {
    const layout = computeRankingVariance([{ label: "A", AC: 110, base: 100, acError: 2 }]);
    expect("acError" in layout.total).toBe(false);
  });
});

const dpsColumn: DataTableColumn = { key: "dps", label: "DPS", mark: "bar" };
const abilities: DataTableRow[] = [
  { id: "shoot", label: "Shoot", values: { dps: 215 }, errors: { dps: 2 } },
  { id: "raptor", label: "Raptor Strike", values: { dps: 91 } },
  { id: "wing", label: "Wing Clip", values: { dps: 40 }, errors: { dps: -1 } },
];

describe("DataTable model - value marks", () => {
  it("resolves a value column's mark: bar or pin, else the plain number", () => {
    expect(valueMarkOf({ key: "v", label: "V", mark: "bar" })).toBe("bar");
    expect(valueMarkOf({ key: "v", label: "V", mark: "pin" })).toBe("pin");
    expect(valueMarkOf({ key: "v", label: "V", mark: "none" })).toBeNull();
    expect(valueMarkOf({ key: "v", label: "V" })).toBeNull();
    // A variance column's mark is resolveMark's business, not a value mark.
    expect(valueMarkOf({ key: "d", label: "Δ", kind: "variance", mark: "bar" })).toBeNull();
  });

  it("scales a bar column over its detail rows, 0 included, whiskers widening it", () => {
    const model = buildDataTableModel([dpsColumn], abilities);
    const cm = model.columns[0]!;
    expect(cm.extent).toEqual({ min: 0, max: 217 });
    expect(cm.domain).toBe(217);
    expect(cm.errors).toBe(true);
  });

  it("puts the zero inside a range with negatives", () => {
    const rows: DataTableRow[] = [
      { id: "a", label: "A", values: { m: 30 } },
      { id: "b", label: "B", values: { m: -10 }, errors: { m: 2 } },
    ];
    const cm = buildDataTableModel([{ key: "m", label: "M", mark: "pin" }], rows).columns[0]!;
    expect(cm.extent).toEqual({ min: -12, max: 30 });
    expect(cm.domain).toBe(30);
  });

  it("falls back to a unit range when there is nothing to scale", () => {
    const empty: DataTableRow[] = [{ id: "a", label: "A", values: { m: 0 } }];
    const cm = buildDataTableModel([{ key: "m", label: "M", mark: "bar" }], empty).columns[0]!;
    expect(cm.extent).toEqual({ min: 0, max: 1 });
  });

  it("leaves extent and errors off every other column", () => {
    const cm = buildDataTableModel([{ key: "dps", label: "DPS" }], abilities).columns[0]!;
    expect("extent" in cm).toBe(false);
    expect(cm.errors).toBe(true);
    const plain = buildDataTableModel(
      [{ key: "dps", label: "DPS" }],
      [{ id: "a", label: "A", values: { dps: 1 } }],
    ).columns[0]!;
    expect("extent" in plain || "errors" in plain).toBe(false);
  });
});

describe("DataTable model - intervals", () => {
  it("reads a valid half-width per column key and nothing else", () => {
    const row = abilities[0]!;
    expect(cellError(row, dpsColumn)).toBe(2);
    expect(cellError(abilities[2]!, dpsColumn)).toBeUndefined();
    expect(cellError(abilities[1]!, dpsColumn)).toBeUndefined();
    // A key that only exists on Object.prototype is not an error entry.
    expect(cellError(row, { key: "constructor", label: "x" })).toBeUndefined();
  });

  it("puts error on a resolved cell only when valid, and never on the totals row", () => {
    const model = buildDataTableModel([dpsColumn], abilities, { showTotals: true });
    expect(model.rows[0]!.cells[0]).toEqual({ kind: "value", value: 215, error: 2 });
    expect(model.rows[1]!.cells[0]).toStrictEqual({ kind: "value", value: 91 });
    expect(model.rows[2]!.cells[0]).toStrictEqual({ kind: "value", value: 40 });
    expect(model.totals!.cells[0]).toStrictEqual({ kind: "value", value: 346 });
  });

  it("widens a variance column's domain by its whiskers (a pct one only to the clamp)", () => {
    const rows: DataTableRow[] = [
      { id: "a", label: "A", values: { m: { AC: 105, PY: 100 } }, errors: { d: 3, p: 99 } },
      { id: "b", label: "B", values: { m: { AC: 98, PY: 100 } } },
    ];
    const abs: DataTableColumn = { key: "d", label: "Δ", kind: "variance", measure: "m" };
    const pct: DataTableColumn = {
      key: "p",
      label: "Δ%",
      kind: "variance",
      measure: "m",
      mode: "pct",
      clampPct: 50,
    };
    const [a, p] = buildDataTableModel([abs, pct], rows).columns;
    expect(a!.domain).toBe(8);
    expect(p!.domain).toBe(50);
    // Without errors the domains are the plain max |Δ| (1.4).
    const [a0, p0] = buildDataTableModel(
      [abs, pct],
      rows.map((r) => ({ ...r, errors: undefined })),
    ).columns;
    expect(a0!.domain).toBe(5);
    expect(p0!.domain).toBeCloseTo(5, 10);
  });
});
