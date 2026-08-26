import { describe, it, expect } from "vitest";
import { buildComparisonModel } from "../comparisonTable";
import type { DataTableColumn, DataTableRow, ResolvedCell } from "../datatable";

const valueOf = (c: ResolvedCell) => (c.kind === "value" ? c.value : undefined);

const leftColumns: DataTableColumn[] = [
  { key: "ac", label: "AC", scenario: "AC", measure: "rev" },
  { key: "dpy", label: "ΔPY", kind: "variance", measure: "rev", base: "PY", subgroup: "AC-PY" },
  {
    key: "dpyp",
    label: "ΔPY%",
    kind: "variance",
    measure: "rev",
    base: "PY",
    mode: "pct",
    subgroup: "AC-PY",
  },
];
const rightColumns: DataTableColumn[] = [
  { key: "py", label: "PY", scenario: "PY", measure: "rev" },
];

const rows: DataTableRow[] = [
  {
    id: "europe",
    label: "Europe",
    values: {}, // parent aggregates from children
    children: [
      { id: "de", label: "Germany", values: { rev: { AC: 60, PY: 50 } } },
      { id: "fr", label: "France", values: { rev: { AC: 40, PY: 45 } } },
    ],
  },
  { id: "us", label: "United States", values: { rev: { AC: 120, PY: 100 } } },
];

describe("buildComparisonModel — build-up rows", () => {
  const model = buildComparisonModel(rows, leftColumns, rightColumns);

  it("emits detail rows first, then the group's bold subtotal", () => {
    expect(model.rows.map((r) => [r.row.id, r.kind])).toEqual([
      ["de", "detail"],
      ["fr", "detail"],
      ["europe", "subtotal"],
      ["us", "detail"],
    ]);
    const subtotal = model.rows.find((r) => r.row.id === "europe")!;
    expect(subtotal.emphasis).toBe(true);
    expect(subtotal.depth).toBe(0);
  });

  it("aggregates a parent subtotal from its children", () => {
    const subtotal = model.rows.find((r) => r.row.id === "europe")!;
    // AC value column = 60 + 40 = 100
    expect(valueOf(subtotal.leftCells[0]!)).toBe(100);
    // PY value column (right) = 50 + 45 = 95
    expect(valueOf(subtotal.rightCells[0]!)).toBe(95);
  });

  it("resolves variance cells against the row's resolved values", () => {
    const de = model.rows.find((r) => r.row.id === "de")!;
    const dpy = de.leftCells[1]!;
    expect(dpy.kind).toBe("variance");
    if (dpy.kind === "variance") expect(dpy.variance!.value).toBe(10); // 60 - 50
  });

  it("treats a childless top-level row as a depth-0 detail row", () => {
    const us = model.rows.find((r) => r.row.id === "us")!;
    expect(us.kind).toBe("detail");
    expect(us.depth).toBe(0);
  });
});

describe("buildComparisonModel — totals", () => {
  it("appends a grand-total row summed over the top-level groups", () => {
    const model = buildComparisonModel(rows, leftColumns, rightColumns, { showTotals: true });
    const total = model.rows[model.rows.length - 1]!;
    expect(total.kind).toBe("total");
    expect(total.row.label).toBe("Total");
    // AC: Europe(100) + US(120) = 220
    expect(valueOf(total.leftCells[0]!)).toBe(220);
    // PY: Europe(95) + US(100) = 195
    expect(valueOf(total.rightCells[0]!)).toBe(195);
  });

  it("totals a measure whose name collides with Object.prototype", () => {
    // Regression: `if (values[measure]) continue` saw Object.prototype members
    // on the accumulator, so such a measure never got summed.
    const cols: DataTableColumn[] = [{ key: "constructor", label: "Constructor", scenario: "AC" }];
    const protoRows: DataTableRow[] = [
      { id: "a", label: "A", values: { constructor: 10 } },
      { id: "b", label: "B", values: { constructor: 32 } },
    ];
    const model = buildComparisonModel(protoRows, cols, [], { showTotals: true });
    const total = model.rows[model.rows.length - 1]!;
    expect(valueOf(total.leftCells[0]!)).toBe(42);
  });

  it("sums every scenario of a measure into the grand total", () => {
    const model = buildComparisonModel(rows, leftColumns, rightColumns, { showTotals: true });
    const total = model.rows[model.rows.length - 1]!;
    // AC on the left, PY on the right — both scenarios of "rev" are summed.
    expect(valueOf(total.leftCells[0]!)).toBe(220);
    expect(valueOf(total.rightCells[0]!)).toBe(195);
  });

  it("uses a custom totals label", () => {
    const model = buildComparisonModel(rows, leftColumns, rightColumns, {
      showTotals: true,
      totalsLabel: "Group",
    });
    expect(model.rows[model.rows.length - 1]!.row.label).toBe("Group");
  });

  it("omits the total row by default", () => {
    const model = buildComparisonModel(rows, leftColumns, rightColumns);
    expect(model.rows.some((r) => r.kind === "total")).toBe(false);
  });
});

describe("buildComparisonModel — column models & headers", () => {
  const model = buildComparisonModel(rows, leftColumns, rightColumns);

  it("scales a variance column's domain to the max |Δ| over detail rows only", () => {
    // ΔPY over detail rows: DE +10, FR -5, US +20 -> 20 (subtotal/total excluded)
    const dpyCol = model.leftColumns[1]!;
    expect(dpyCol.kind).toBe("variance");
    expect(dpyCol.domain).toBe(20);
  });

  it("collapses a shared subgroup into one spanning header cell", () => {
    // AC column (span 1) then the AC-PY pair collapsed into one span-2 cell
    expect(model.leftHeader).toEqual([
      { label: "AC", span: 1, gapBefore: false },
      { label: "AC-PY", span: 2, gapBefore: false },
    ]);
  });

  it("keeps an ungrouped column as its own span-1 header cell", () => {
    expect(model.rightHeader).toEqual([{ label: "PY", span: 1, gapBefore: false }]);
  });
});
