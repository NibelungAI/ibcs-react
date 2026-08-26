import { describe, it, expect } from "vitest";
import { computeVariance } from "../variance";
import {
  cellRefOf,
  parseCellRef,
  resolveCell,
  cellVariance,
  flattenMatrixRows,
  defaultCollapsedRowIds,
  defaultExpandedColIds,
  buildColumnLayout,
  type MatrixRow,
  type MatrixValues,
  type MatrixPeriod,
} from "../matrixTable";

const rows: MatrixRow[] = [
  {
    id: "gross",
    label: "Gross profit",
    flow: "result",
    children: [
      { id: "rev", label: "Revenue", flow: "add" },
      { id: "cogs", label: "COGS", flow: "subtract", higherIsBetter: false },
    ],
  },
];

const values: MatrixValues = {
  rev: { y2026: { AC: 100, PL: 90 } },
  cogs: { y2026: { AC: 70, PL: 60 } },
  // "gross" intentionally has no own values -> must aggregate from children
};

describe("resolveCell", () => {
  it("reads a row's own value for a period/scenario", () => {
    expect(resolveCell(values, rows[0]!.children![0]!, "y2026", "AC")).toBe(100);
  });

  it("aggregates children when a parent row has no own value", () => {
    expect(resolveCell(values, rows[0]!, "y2026", "AC")).toBe(170); // 100 + 70
    expect(resolveCell(values, rows[0]!, "y2026", "PL")).toBe(150); // 90 + 60
  });

  it("returns undefined when neither the row nor children have data", () => {
    expect(resolveCell(values, rows[0]!, "y2099", "AC")).toBeUndefined();
    expect(resolveCell(values, rows[0]!.children![0]!, "y2026", "FC")).toBeUndefined();
  });

  it("treats non-finite stored values as missing", () => {
    const bad: MatrixValues = { rev: { y2026: { AC: NaN } }, cogs: { y2026: { AC: Infinity } } };
    expect(resolveCell(bad, rows[0]!.children![0]!, "y2026", "AC")).toBeUndefined();
    expect(resolveCell(bad, rows[0]!, "y2026", "AC")).toBeUndefined();
  });
});

describe("cellVariance", () => {
  it("computes AC vs base (e.g. PL) and the percent", () => {
    const v = cellVariance(values, rows[0]!.children![0]!, "y2026", "AC", "PL")!;
    expect(v.abs).toBe(10); // 100 - 90
    expect(v.pct).toBeCloseTo(10 / 90);
    expect(v.favorable).toBe(true);
  });

  it("respects higherIsBetter:false on a cost row (overrun = unfavorable)", () => {
    const v = cellVariance(values, rows[0]!.children![1]!, "y2026", "AC", "PL")!;
    expect(v.abs).toBe(10); // COGS 70 vs 60
    expect(v.favorable).toBe(false);
  });

  it("aggregates children for a parent-row variance", () => {
    // gross AC 170 vs PL 150 -> +20, favorable (higher is better by default)
    const v = cellVariance(values, rows[0]!, "y2026", "AC", "PL")!;
    expect(v.abs).toBe(20);
    expect(v.favorable).toBe(true);
  });

  it("returns null pct when the base is zero", () => {
    const zero: MatrixValues = { rev: { p: { AC: 5, PL: 0 } } };
    const v = cellVariance(zero, { id: "rev", label: "R" }, "p", "AC", "PL")!;
    expect(v.abs).toBe(5);
    expect(v.pct).toBeNull();
  });

  it("returns null when either side is missing", () => {
    expect(cellVariance(values, rows[0]!.children![0]!, "y2026", "AC", "FC")).toBeNull();
  });

  it("matches the shared computeVariance exactly (same shape, same rules)", () => {
    const v = cellVariance(values, rows[0]!.children![0]!, "y2026", "AC", "PL")!;
    expect(v).toEqual(computeVariance(100, 90, true));
    expect(Object.keys(v).sort()).toEqual(["abs", "favorable", "pct"]);
  });
});

describe("flattenMatrixRows", () => {
  it("expands children when not collapsed", () => {
    const flat = flattenMatrixRows(rows, new Set());
    expect(flat.map((f) => f.row.id)).toEqual(["gross", "rev", "cogs"]);
    expect(flat[0]).toMatchObject({ depth: 0, hasChildren: true, isExpanded: true });
    expect(flat[1]!.depth).toBe(1);
  });

  it("hides children of a collapsed parent", () => {
    const flat = flattenMatrixRows(rows, new Set(["gross"]));
    expect(flat.map((f) => f.row.id)).toEqual(["gross"]);
    expect(flat[0]!.isExpanded).toBe(false);
  });
});

describe("default collapse / expand id collection", () => {
  it("collects defaultCollapsed row ids recursively", () => {
    const r: MatrixRow[] = [
      {
        id: "a",
        label: "A",
        defaultCollapsed: true,
        children: [{ id: "b", label: "B", defaultCollapsed: true }],
      },
      { id: "c", label: "C" },
    ];
    expect(defaultCollapsedRowIds(r)).toEqual(["a", "b"]);
  });

  it("collects defaultExpanded period ids recursively", () => {
    const cols: MatrixPeriod[] = [
      {
        id: "y",
        label: "Year",
        defaultExpanded: true,
        children: [{ id: "q1", label: "Q1", defaultExpanded: true }],
      },
      { id: "y2", label: "Year2" },
    ];
    expect(defaultExpandedColIds(cols)).toEqual(["y", "q1"]);
  });
});

describe("buildColumnLayout", () => {
  const columns: MatrixPeriod[] = [
    { id: "y2025", label: "2025" },
    {
      id: "y2026",
      label: "2026",
      children: [
        { id: "q1", label: "Q1" },
        { id: "q2", label: "Q2" },
      ],
    },
  ];

  it("treats a collapsed parent as a single leaf and fans scenarios under each leaf", () => {
    const layout = buildColumnLayout(columns, {
      expanded: new Set(),
      defaultScenarios: ["PL", "AC"],
      showVariance: false,
    });
    expect(layout.leaves.map((l) => l.period.id)).toEqual(["y2025", "y2026"]);
    // 2 leaves x 2 scenarios, no variance column
    expect(layout.subColumnCount).toBe(4);
    expect(layout.leaves[1]!.expandable).toBe(true);
  });

  it("expands a period in place into its child leaves", () => {
    const layout = buildColumnLayout(columns, {
      expanded: new Set(["y2026"]),
      defaultScenarios: ["PL", "AC"],
      showVariance: false,
    });
    expect(layout.leaves.map((l) => l.period.id)).toEqual(["y2025", "q1", "q2"]);
    expect(layout.subColumnCount).toBe(6); // 3 leaves x 2 scenarios
  });

  it("adds one variance sub-column per leaf when showVariance is on", () => {
    const layout = buildColumnLayout(columns, {
      expanded: new Set(),
      defaultScenarios: ["PL", "AC"],
      showVariance: true,
    });
    // 2 leaves x (2 scenarios + 1 variance) = 6
    expect(layout.subColumnCount).toBe(6);
  });

  it("marks the inter-group gap at the start of each new top-level group (not the first)", () => {
    const layout = buildColumnLayout(columns, {
      expanded: new Set(["y2026"]),
      defaultScenarios: ["AC"],
      showVariance: false,
    });
    expect(layout.leaves[0]!.startsGap).toBe(false); // first group
    expect(layout.leaves[1]!.startsGap).toBe(true); // q1 = first leaf of the 2026 group
    expect(layout.leaves[2]!.startsGap).toBe(false); // q2 = same group
  });

  it("honours a per-period scenario override", () => {
    const cols: MatrixPeriod[] = [{ id: "p", label: "P", scenarios: ["PL", "FC"] }];
    const layout = buildColumnLayout(cols, {
      expanded: new Set(),
      defaultScenarios: ["AC"],
      showVariance: false,
    });
    expect(layout.leaves[0]!.scenarios).toEqual(["PL", "FC"]);
    expect(layout.scenarioRow.map((s) => s.scenario)).toEqual(["PL", "FC"]);
  });

  it("cellRefOf / parseCellRef round-trip (incl. the DELTA column)", () => {
    expect(cellRefOf("net", "2024-01", "AC")).toBe("net::2024-01::AC");
    expect(cellRefOf("net", "2024-01", "DELTA")).toBe("net::2024-01::DELTA");
    expect(parseCellRef("net::2024-01::DELTA")).toEqual({
      rowId: "net",
      periodId: "2024-01",
      scenario: "DELTA",
    });
    expect(parseCellRef("rev::2024::PY")).toEqual({
      rowId: "rev",
      periodId: "2024",
      scenario: "PY",
    });
    expect(parseCellRef("malformed")).toBeNull();
    // round-trip
    const ref = cellRefOf("opex", "Q3", "PL");
    const back = parseCellRef(ref)!;
    expect(cellRefOf(back.rowId, back.periodId, back.scenario)).toBe(ref);
  });

  it("rejects malformed refs instead of casting an unknown scenario", () => {
    // Regression: the scenario segment was cast unchecked, so a stale or
    // hand-written data-cell-ref smuggled a bogus scenario into typed handlers.
    expect(parseCellRef("net::2024-01::TOTAL")).toBeNull();
    expect(parseCellRef("net::2024-01::ac")).toBeNull(); // case-sensitive
    expect(parseCellRef("net::2024-01::")).toBeNull();
    expect(parseCellRef("::2024-01::AC")).toBeNull(); // empty row id
    expect(parseCellRef("net::::AC")).toBeNull(); // empty period id
    expect(parseCellRef("net::2024-01")).toBeNull(); // too few segments
    expect(parseCellRef("net::2024-01::AC::extra")).toBeNull(); // too many
    expect(parseCellRef("")).toBeNull();
  });

  it("accepts every real scenario plus DELTA", () => {
    for (const s of ["AC", "PY", "PL", "FC", "DELTA"] as const) {
      expect(parseCellRef(cellRefOf("r", "p", s))?.scenario).toBe(s);
    }
  });
});
