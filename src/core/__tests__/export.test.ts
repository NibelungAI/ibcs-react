import { describe, it, expect } from "vitest";
import { statementToMatrix, statementToCSV, toCSV } from "../export";
import type { StatementLine } from "../types";

const lines: StatementLine[] = [
  { id: "rev", label: "Revenue", flow: "result", values: { AC: 1200, PY: 1000 } },
  {
    id: "cogs",
    label: "Cost of sales",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: -700, PY: -600 },
  },
  {
    id: "opex",
    label: "Operating expenses",
    flow: "subtract",
    values: { AC: -300, PY: -320 },
    children: [
      { id: "sales", label: "Sales & marketing", values: { AC: -180, PY: -200 } },
      { id: "admin", label: "Administration", values: { AC: -120, PY: -120 } },
    ],
  },
];

describe("statementToMatrix", () => {
  it("emits a header row plus one row per line, with raw numbers", () => {
    const matrix = statementToMatrix(lines);
    expect(matrix[0]).toEqual(["Item", "AC", "PY", "ΔPY", "ΔPY %"]);
    expect(matrix[1]).toEqual(["Revenue", 1200, 1000, 200, 20]);
    // children are indented, never renamed
    expect(matrix.map((r) => r[0])).toContain("  Sales & marketing");
  });

  it("keeps absent values null so a sheet leaves the cell empty", () => {
    const sparse: StatementLine[] = [{ id: "a", label: "A", values: { AC: 5 } }];
    const matrix = statementToMatrix(sparse, { comparisons: ["PL"] });
    expect(matrix[1]).toEqual(["A", 5, null, null]);
  });
});

describe("statementToCSV — normal statements are unchanged", () => {
  it("round-trips ordinary labels and numbers without decoration", () => {
    const csv = statementToCSV(lines);
    const rows = csv.split("\r\n");
    expect(rows[0]).toBe("Item,AC,PY,ΔPY,ΔPY %");
    expect(rows[1]).toBe("Revenue,1200,1000,200,20");
    // No stray apostrophes anywhere in a clean statement.
    expect(csv).not.toContain("'");
  });

  it("does NOT guard negative numbers in value cells", () => {
    const csv = statementToCSV(lines);
    expect(csv).toContain("Cost of sales,-700,-600,-100,-16.7");
    expect(csv).not.toContain("'-700");
  });

  it("still quotes per RFC-4180 (delimiter / quote / newline in a label)", () => {
    const tricky: StatementLine[] = [
      { id: "a", label: 'Revenue, "net"', values: { AC: 1 } },
      { id: "b", label: "Two\nlines", values: { AC: 2 } },
    ];
    const csv = statementToCSV(tricky);
    expect(csv).toContain('"Revenue, ""net"""');
    expect(csv).toContain('"Two\nlines"');
  });
});

describe("statementToCSV — formula guarding", () => {
  const hostile: StatementLine[] = [
    { id: "a", label: "=cmd|' /C calc'!A0", values: { AC: 1, PY: 1 } },
    { id: "b", label: "Revenue", values: { AC: 2, PY: 1 } },
  ];

  it("prefixes a formula-leading label with an apostrophe by default", () => {
    const csv = statementToCSV(hostile);
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).not.toContain("\n=cmd");
    // The harmless label next to it is untouched.
    expect(csv).toContain("Revenue,2,1");
  });

  it("guards an indented (nested) formula label, keeping the indent", () => {
    const nested: StatementLine[] = [
      {
        id: "p",
        label: "Group",
        values: {},
        children: [{ id: "c", label: '=HYPERLINK("http://evil")', values: { AC: 1 } }],
      },
    ];
    const csv = statementToCSV(nested);
    expect(csv).toContain('"\'  =HYPERLINK(""http://evil"")"');
  });

  it("restores the raw text with guardFormulas:false", () => {
    const csv = statementToCSV(hostile, { guardFormulas: false });
    expect(csv).toContain("=cmd|' /C calc'!A0");
    expect(csv).not.toContain("'=cmd");
  });
});

describe("toCSV", () => {
  it("guards every formula lead character in TEXT cells only", () => {
    const matrix = [
      ["=SUM(A1)", "+1", "-1", "@Import", "\tTabbed", "\rReturn"],
      [-700, 0, 12.5, null, undefined, "plain"],
    ];
    const rows = toCSV(matrix).split("\r\n");
    expect(rows[0]!.split(",")[0]).toBe("'=SUM(A1)");
    expect(rows[0]).toContain("'+1");
    expect(rows[0]).toContain("'-1");
    expect(rows[0]).toContain("'@Import");
    expect(rows[0]).toContain("'\tTabbed"); // tab lead guarded, tab preserved
    expect(rows[0]).toContain('"\'\rReturn"'); // CR lead guarded, cell still quoted
    // Numbers stay numeric: a negative VALUE is not an injection vector.
    expect(rows[1]!.startsWith("-700,0,12.5,,,plain")).toBe(true);
  });

  it("honours a custom delimiter and still quotes it inside cells", () => {
    const csv = toCSV([["a\tb", "c"]], { delimiter: "\t" });
    expect(csv).toBe('"a\tb"\tc');
  });

  it("emits nothing for null / undefined cells", () => {
    expect(toCSV([[null, undefined, ""]])).toBe(",,");
  });
});
