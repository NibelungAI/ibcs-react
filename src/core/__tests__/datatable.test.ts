import { describe, it, expect } from "vitest";
import {
  measureValue,
  measureSeries,
  computeVarianceCell,
  flattenRows,
  buildDataTableModel,
  resolveMark,
  type DataTableColumn,
  type DataTableRow,
} from "../datatable";

describe("measureValue", () => {
  it("treats a plain number cell as the AC scenario", () => {
    const row: DataTableRow = { id: "r", label: "R", values: { rev: 120 } };
    expect(measureValue(row, "rev", "AC")).toBe(120);
    expect(measureValue(row, "rev", "PY")).toBeUndefined();
  });

  it("reads a scenario object cell per scenario", () => {
    const row: DataTableRow = { id: "r", label: "R", values: { rev: { AC: 120, PY: 100 } } };
    expect(measureValue(row, "rev", "AC")).toBe(120);
    expect(measureValue(row, "rev", "PY")).toBe(100);
    expect(measureValue(row, "rev", "FC")).toBeUndefined();
  });

  it("sums children when a parent has no own value for the measure", () => {
    const parent: DataTableRow = {
      id: "p",
      label: "P",
      values: {},
      children: [
        { id: "a", label: "A", values: { rev: { AC: 30, PY: 20 } } },
        { id: "b", label: "B", values: { rev: { AC: 12, PY: 10 } } },
      ],
    };
    expect(measureValue(parent, "rev", "AC")).toBe(42);
    expect(measureValue(parent, "rev", "PY")).toBe(30);
  });

  it("treats non-finite values as missing (NaN / Infinity)", () => {
    const row: DataTableRow = { id: "r", label: "R", values: { rev: { AC: NaN, PY: Infinity } } };
    expect(measureValue(row, "rev", "AC")).toBeUndefined();
    expect(measureValue(row, "rev", "PY")).toBeUndefined();
  });

  it("prefers an own value over child aggregation", () => {
    const row: DataTableRow = {
      id: "p",
      label: "P",
      values: { rev: 999 },
      children: [{ id: "c", label: "C", values: { rev: 1 } }],
    };
    expect(measureValue(row, "rev", "AC")).toBe(999);
  });
});

describe("measureSeries", () => {
  it("returns a row's own series, sanitising non-finite points to 0", () => {
    const row: DataTableRow = {
      id: "r",
      label: "R",
      values: {},
      spark: { t: [1, NaN, 3, Infinity] },
    };
    expect(measureSeries(row, "t")).toEqual([1, 0, 3, 0]);
  });

  it("sums children element-wise when the parent has no own series", () => {
    const parent: DataTableRow = {
      id: "p",
      label: "P",
      values: {},
      children: [
        { id: "a", label: "A", values: {}, spark: { t: [1, 2, 3] } },
        { id: "b", label: "B", values: {}, spark: { t: [10, 20, 30] } },
      ],
    };
    expect(measureSeries(parent, "t")).toEqual([11, 22, 33]);
  });
});

describe("computeVarianceCell", () => {
  const row: DataTableRow = { id: "r", label: "R", values: { rev: { AC: 120, PY: 100 } } };

  it("computes an absolute variance by default", () => {
    const col: DataTableColumn = {
      key: "dpy",
      label: "ΔPY",
      measure: "rev",
      kind: "variance",
      base: "PY",
    };
    const vc = computeVarianceCell(row, col)!;
    expect(vc.value).toBe(20);
    expect(vc.favorable).toBe(true);
    expect(vc.outlier).toBe(false);
  });

  it("computes a percent variance and flags outliers past clampPct", () => {
    const col: DataTableColumn = {
      key: "dpy",
      label: "ΔPY%",
      measure: "rev",
      kind: "variance",
      base: "PY",
      mode: "pct",
    };
    const vc = computeVarianceCell(row, col)!;
    expect(vc.value).toBeCloseTo(20); // +20%
    expect(vc.outlier).toBe(false);

    const big: DataTableRow = { id: "x", label: "X", values: { rev: { AC: 300, PY: 100 } } };
    const vcBig = computeVarianceCell(big, { ...col, clampPct: 100 })!;
    expect(vcBig.value).toBeCloseTo(200);
    expect(vcBig.outlier).toBe(true);
  });

  it("respects the column's higherIsBetter for favorability", () => {
    const cost: DataTableColumn = {
      key: "dpy",
      label: "ΔPY",
      measure: "rev",
      kind: "variance",
      base: "PY",
      higherIsBetter: false,
    };
    expect(computeVarianceCell(row, cost)!.favorable).toBe(false); // 120 > 100 = overrun
  });

  it("returns null when the percent base is zero in pct mode", () => {
    const zeroBase: DataTableRow = { id: "z", label: "Z", values: { rev: { AC: 50, PY: 0 } } };
    const col: DataTableColumn = {
      key: "d",
      label: "ΔPY%",
      measure: "rev",
      kind: "variance",
      base: "PY",
      mode: "pct",
    };
    expect(computeVarianceCell(zeroBase, col)).toBeNull();
  });
});

describe("flattenRows", () => {
  const rows: DataTableRow[] = [
    {
      id: "p",
      label: "P",
      values: {},
      children: [
        { id: "a", label: "A", values: {} },
        { id: "b", label: "B", values: {} },
      ],
    },
  ];

  it("expands children when not collapsed", () => {
    const flat = flattenRows(rows, new Set());
    expect(flat.map((f) => f.row.id)).toEqual(["p", "a", "b"]);
    expect(flat[0]).toMatchObject({ depth: 0, hasChildren: true, isExpanded: true });
    expect(flat[1]!.depth).toBe(1);
  });

  it("hides children of a collapsed row", () => {
    const flat = flattenRows(rows, new Set(["p"]));
    expect(flat.map((f) => f.row.id)).toEqual(["p"]);
    expect(flat[0]!.isExpanded).toBe(false);
  });
});

describe("buildDataTableModel", () => {
  const columns: DataTableColumn[] = [
    { key: "name", label: "Region" },
    { key: "rev", label: "Revenue", kind: "value", scenario: "AC" },
    { key: "dpy", label: "ΔPY", kind: "variance", measure: "rev", base: "PY" },
  ];
  const rows: DataTableRow[] = [
    { id: "n", label: "North", values: { rev: { AC: 100, PY: 80 } } },
    { id: "s", label: "South", values: { rev: { AC: 60, PY: 90 } } },
  ];

  it("sums the top-level rows into a totals row per measure", () => {
    const model = buildDataTableModel(columns, rows, { showTotals: true });
    expect(model.totals).not.toBeNull();
    const revCell = model.totals!.cells[1];
    expect(revCell).toEqual({ kind: "value", value: 160 });
    // totals variance: AC 160 vs PY 170 -> -10
    const dpy = model.totals!.cells[2]!;
    expect(dpy.kind).toBe("variance");
    if (dpy.kind === "variance") expect(dpy.variance!.value).toBe(-10);
  });

  it("scales the variance column domain to the max |Δ| over the rows", () => {
    const model = buildDataTableModel(columns, rows);
    const dpyCol = model.columns[2]!;
    expect(dpyCol.kind).toBe("variance");
    // North +20, South -30 -> domain 30
    expect(dpyCol.domain).toBe(30);
  });

  it("sorts rows ascending/descending by a column key, with totals unaffected", () => {
    const asc = buildDataTableModel(columns, rows, { sort: { key: "rev", dir: "asc" } });
    expect(asc.rows.map((r) => r.row.id)).toEqual(["s", "n"]); // 60, 100

    const desc = buildDataTableModel(columns, rows, { sort: { key: "rev", dir: "desc" } });
    expect(desc.rows.map((r) => r.row.id)).toEqual(["n", "s"]);
  });

  it("flattens nested rows and respects the collapsed set", () => {
    const nested: DataTableRow[] = [
      {
        id: "p",
        label: "P",
        values: {},
        children: [{ id: "c", label: "C", values: { rev: { AC: 10, PY: 5 } } }],
      },
    ];
    const open = buildDataTableModel(columns, nested);
    expect(open.rows.map((r) => r.row.id)).toEqual(["p", "c"]);

    const closed = buildDataTableModel(columns, nested, { collapsed: ["p"] });
    expect(closed.rows.map((r) => r.row.id)).toEqual(["p"]);
    // collapsed parent still reports the aggregated child value
    expect(closed.rows[0]!.cells[1]).toEqual({ kind: "value", value: 10 });
  });

  it("scales the variance domain over DETAIL rows only, never the parents", () => {
    const nested: DataTableRow[] = [
      {
        id: "europe",
        label: "Europe",
        values: {},
        children: [
          { id: "de", label: "Germany", values: { rev: { AC: 60, PY: 50 } } }, // +10
          { id: "fr", label: "France", values: { rev: { AC: 40, PY: 45 } } }, // -5
        ],
      },
      { id: "us", label: "United States", values: { rev: { AC: 120, PY: 100 } } }, // +20
    ];
    // The Europe subtotal is +5, but its children are the scale: max |Δ| = 20.
    const model = buildDataTableModel(columns, nested);
    expect(model.columns[2]!.domain).toBe(20);
  });

  it("keeps the variance domain STABLE across expand / collapse", () => {
    // Regression: the domain was computed over the VISIBLE rows, so collapsing a
    // group swapped its detail rows for a bigger parent aggregate and every bar
    // in the column silently rescaled.
    const nested: DataTableRow[] = [
      {
        id: "p",
        label: "P",
        values: {},
        children: [
          { id: "a", label: "A", values: { rev: { AC: 100, PY: 60 } } }, // +40
          { id: "b", label: "B", values: { rev: { AC: 100, PY: 70 } } }, // +30
        ],
      },
    ];
    const expanded = buildDataTableModel(columns, nested);
    const collapsed = buildDataTableModel(columns, nested, { collapsed: ["p"] });
    expect(expanded.columns[2]!.domain).toBe(40); // parent's +70 excluded
    expect(collapsed.columns[2]!.domain).toBe(expanded.columns[2]!.domain);
  });

  it("totals a measure whose name collides with Object.prototype", () => {
    // Regression: `if (values[measure]) continue` saw Object.prototype members
    // on the accumulator, so these measures were skipped in the totals row.
    const protoColumns: DataTableColumn[] = [
      { key: "constructor", label: "Constructor", kind: "value", scenario: "AC" },
      { key: "toString", label: "To string", kind: "value", scenario: "AC" },
    ];
    const protoRows: DataTableRow[] = [
      { id: "r1", label: "R1", values: { constructor: 10, toString: 3 } },
      { id: "r2", label: "R2", values: { constructor: 5, toString: 2 } },
    ];
    const model = buildDataTableModel(protoColumns, protoRows, { showTotals: true });
    expect(model.totals!.cells[0]).toEqual({ kind: "value", value: 15 });
    expect(model.totals!.cells[1]).toEqual({ kind: "value", value: 5 });
  });

  it("emits no header-group row when no column declares a group", () => {
    expect(buildDataTableModel(columns, rows).headerGroups).toBeNull();
  });

  it("resolves the variance mark: bar for abs, pin for pct, explicit wins", () => {
    expect(resolveMark({ key: "a", label: "A", kind: "variance" })).toBe("bar");
    expect(resolveMark({ key: "a", label: "A", kind: "variance", mode: "pct" })).toBe("pin");
    expect(resolveMark({ key: "a", label: "A", kind: "variance", mode: "pct", mark: "bar" })).toBe(
      "bar",
    );
    expect(resolveMark({ key: "a", label: "A", kind: "variance", mark: "none" })).toBe("none");
  });

  it("builds header groups by collapsing consecutive same-group columns", () => {
    const grouped: DataTableColumn[] = [
      { key: "name", label: "Region" },
      { key: "rev", label: "AC", group: "Current month" },
      {
        key: "dpy",
        label: "ΔPY",
        kind: "variance",
        measure: "rev",
        base: "PY",
        group: "Current month",
      },
      { key: "ytd", label: "AC", group: "Year to date" },
    ];
    const model = buildDataTableModel(grouped, rows);
    expect(model.headerGroups).toEqual([
      { label: "", span: 1 },
      { label: "Current month", span: 2 },
      { label: "Year to date", span: 1 },
    ]);
    // group dividers auto-drawn at the start of a new group
    expect(model.columns[1]!.borderLeft).toBe(true); // first of "Current month"
    expect(model.columns[2]!.borderLeft).toBe(false); // same group
    expect(model.columns[3]!.borderLeft).toBe(true); // new group
  });
});
