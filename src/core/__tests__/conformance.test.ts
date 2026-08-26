import { describe, it, expect } from "vitest";
import { checkIbcs, IBCS_RULES, type IbcsFinding } from "../conformance";
import { defaultTrendConfig, defaultWaterfallConfig, type TreeChartConfig } from "../config";

const rulesOf = (f: IbcsFinding[]) => f.map((x) => x.rule);

/**
 * A minimal, fully CONFORMANT tree chart: a calculation tree carries `root`,
 * not `data`. The structured title is added past the type — `ChartConfigBase`
 * types `title` as a plain string today (the components draw it inside the
 * svg), while the linter's ideal is the Who/What/When object that report
 * blocks accept. Widening the config type is a tracked follow-up.
 */
const treeConfig = {
  ...({
    type: "tree",
    root: {
      id: "roa",
      label: "Return on assets",
      value: 12.5,
      py: 11.8,
      op: "/",
      children: [
        { id: "ret", label: "Return", value: 250, py: 230 },
        { id: "assets", label: "Assets", value: 2000, py: 1950 },
      ],
    },
  } satisfies TreeChartConfig),
  title: { who: "ACME", what: "Return on assets (%)", when: "2026" },
};

describe("checkIbcs — chart configs", () => {
  it("passes a compliant linear chart (no findings)", () => {
    const findings = checkIbcs({
      type: "column",
      data: [{ category: "Jan", AC: 10, PY: 8 }],
      // structured title (object, not a bare string) -> not flagged
      title: { who: "ACME", what: "Revenue (€m)", when: "2026" },
    });
    expect(findings).toEqual([]);
  });

  it("flags a pie chart as a non-linear chart type (error)", () => {
    const findings = checkIbcs({ type: "pie", data: [{ category: "A", AC: 1 }] });
    const r = findings.find((f) => f.rule === "linear-chart-type");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("error");
    expect(r!.path).toBe("type");
  });

  it("flags gauge and radar as non-linear too", () => {
    expect(rulesOf(checkIbcs({ type: "gauge", data: [{ x: 1 }] }))).toContain("linear-chart-type");
    expect(rulesOf(checkIbcs({ type: "radar", data: [{ x: 1 }] }))).toContain("linear-chart-type");
  });

  it("accepts the library's own linear chart types", () => {
    for (const type of [
      "varianceColumn",
      "trend",
      "structure",
      "waterfall",
      "stacked",
      "bar",
      "line",
      "area",
      "scatter",
      "bubble",
      "combo",
    ]) {
      const findings = checkIbcs({ type, data: [{ x: 1 }] });
      expect(rulesOf(findings)).not.toContain("linear-chart-type");
    }
    // The tree chart carries `root` instead of `data` — checked with its real shape.
    expect(rulesOf(checkIbcs(treeConfig))).not.toContain("linear-chart-type");
  });

  it("flags a bare-string title (Who/What/When warning)", () => {
    const findings = checkIbcs({ type: "column", data: [{ x: 1 }], title: "Revenue" });
    const r = findings.find((f) => f.rule === "structured-title");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
    expect(r!.message).toContain("Revenue");
  });

  it("flags a chart with no data (error)", () => {
    const findings = checkIbcs({ type: "column", data: [] });
    const r = findings.find((f) => f.rule === "data-present");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("error");
  });

  it("does NOT flag a valid tree chart, which carries `root` instead of `data`", () => {
    // Regression: every conforming TreeChartConfig used to emit a bogus
    // data-present ERROR because the check only understood `data` arrays.
    expect(checkIbcs(treeConfig)).toEqual([]);
  });

  it("still flags a tree chart with no root", () => {
    const findings = checkIbcs({ type: "tree" });
    const r = findings.find((f) => f.rule === "data-present");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("error");
    expect(r!.path).toBe("root");
  });

  it("does not flag data-present for the library's own default configs once populated", () => {
    const trend = {
      ...defaultTrendConfig,
      title: undefined,
      data: [
        { category: "Jan", AC: 10, PY: 8 },
        { category: "Feb", AC: 12, PY: 11 },
      ],
    };
    expect(rulesOf(checkIbcs(trend))).not.toContain("data-present");

    const waterfall = {
      ...defaultWaterfallConfig,
      title: undefined,
      data: [
        { category: "Revenue", value: 1200, flow: "result" },
        { category: "COGS", value: -700 },
      ],
    };
    expect(rulesOf(checkIbcs(waterfall))).not.toContain("data-present");
  });

  it("flags the blank-slate defaults, which ship with an empty data array", () => {
    expect(rulesOf(checkIbcs(defaultTrendConfig))).toContain("data-present");
    expect(rulesOf(checkIbcs(defaultWaterfallConfig))).toContain("data-present");
  });

  it("flags variance only when explicitly switched off", () => {
    expect(rulesOf(checkIbcs({ type: "column", data: [{ x: 1 }] }))).not.toContain("show-variance");
    expect(rulesOf(checkIbcs({ type: "column", data: [{ x: 1 }], showVariance: false }))).toContain(
      "show-variance",
    );
    expect(rulesOf(checkIbcs({ type: "column", data: [{ x: 1 }], variance: "none" }))).toContain(
      "show-variance",
    );
  });

  it("flags a chart with NO title at all — omitting the title must not read cleaner than a bare one", () => {
    // Regression (consumer report B4): `{type, data}` with no title returned []
    // while the same chart WITH a title warned — the linter rewarded deleting it.
    const findings = checkIbcs({
      type: "varianceColumn",
      data: [{ category: "Q1", AC: 100, PY: 90 }],
    });
    const r = findings.find((f) => f.rule === "structured-title");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
    expect(r!.path).toBe("title");
    expect(r!.message).toContain("no title");
  });

  it("treats a whitespace-only title as missing", () => {
    const findings = checkIbcs({ type: "column", data: [{ x: 1 }], title: "   " });
    const r = findings.find((f) => f.rule === "structured-title");
    expect(r).toBeDefined();
    expect(r!.message).toContain("no title");
  });

  it("flags a cost-titled chart that lacks higherIsBetter:false", () => {
    const findings = checkIbcs({ type: "column", data: [{ x: 1 }], title: "Operating Expenses" });
    const r = findings.find((f) => f.rule === "cost-favorability");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("warning");
  });

  it("does not flag cost favorability once higherIsBetter:false is set", () => {
    const findings = checkIbcs({
      type: "column",
      data: [{ x: 1 }],
      title: "Tax expense",
      higherIsBetter: false,
    });
    expect(rulesOf(findings)).not.toContain("cost-favorability");
  });

  it("detects cost measures inside STRUCTURED titles — the recommended form must not bypass the rule", () => {
    const findings = checkIbcs({
      type: "column",
      data: [{ x: 1 }],
      title: { who: "ACME", what: "Operating expenses (€k)", when: "2026" },
    });
    expect(rulesOf(findings)).toContain("cost-favorability");
  });

  it('measureKind:"cost" forces the favorability check with no title at all', () => {
    const findings = checkIbcs({ type: "column", data: [{ x: 1 }], measureKind: "cost" });
    const r = findings.find((f) => f.rule === "cost-favorability");
    expect(r).toBeDefined();
    expect(r!.message).toContain('measureKind:"cost"');
    // …and is satisfied the same way the heuristic is.
    expect(
      rulesOf(
        checkIbcs({ type: "column", data: [{ x: 1 }], measureKind: "cost", higherIsBetter: false }),
      ),
    ).not.toContain("cost-favorability");
  });

  it('measureKind:"revenue" silences the heuristic for titles that merely SOUND like costs', () => {
    const findings = checkIbcs({
      type: "column",
      data: [{ x: 1 }],
      title: { what: "Cost recovery revenue (€k)" },
      measureKind: "revenue",
    });
    expect(rulesOf(findings)).not.toContain("cost-favorability");
  });
});

describe("checkIbcs — chart type messages", () => {
  const messageOf = (type: unknown): string =>
    checkIbcs({ type, data: [{ x: 1 }] }).find((f) => f.rule === "linear-chart-type")!.message;

  it("suggests the canonical name for a near-miss and lists only REAL type values", () => {
    // Regression (consumer report B5): the old message suggested "column" and
    // "bar", which the config vocabulary does not accept — following the hint
    // failed again. It must name valid values and offer a did-you-mean.
    const msg = messageOf("variance-column");
    expect(msg).toContain("unknown chart type");
    expect(msg).toContain('did you mean "varianceColumn"?');
    for (const t of ["varianceColumn", "trend", "structure", "waterfall", "tree"]) {
      expect(msg).toContain(`"${t}"`);
    }
  });

  it("corrects small typos within edit distance", () => {
    expect(messageOf("watrfall")).toContain('did you mean "waterfall"?');
    expect(messageOf("Trend")).toContain('did you mean "trend"?');
  });

  it("keeps the IBCS explanation for KNOWN non-linear types, distinct from unknown ones", () => {
    expect(messageOf("pie")).toContain("non-linear");
    expect(messageOf("pie")).not.toContain("unknown");
    expect(messageOf("banana")).toContain("unknown chart type");
    expect(messageOf("banana")).not.toContain("did you mean");
  });

  it("explains a missing type (reachable through a report's chart block)", () => {
    // A bare `checkIbcs({data})` can't dispatch to the chart checker at all —
    // but a report block DECLARES chartness, so a config with no `type` is
    // checked and told what the valid values are.
    const findings = checkIbcs({
      title: { who: "ACME", what: "Revenue (€k)", when: "2026" },
      blocks: [{ type: "chart", title: { what: "Revenue (€k)" }, config: { data: [{ x: 1 }] } }],
    });
    const r = findings.find((f) => f.rule === "linear-chart-type")!;
    expect(r.message).toContain('no "type"');
    expect(r.message).toContain('"varianceColumn"');
  });
});

describe("checkIbcs — KPI configs", () => {
  it("passes a compliant KPI with a comparison", () => {
    const findings = checkIbcs({
      label: "Revenue",
      values: { AC: 120, PY: 100 },
      comparisons: ["PY"],
    });
    expect(findings).toEqual([]);
  });

  it("flags a KPI with no headline AC value", () => {
    const findings = checkIbcs({ label: "Revenue", values: { PY: 100 } });
    const r = findings.find((f) => f.rule === "data-present");
    expect(r).toBeDefined();
    expect(r!.severity).toBe("error");
  });

  it("flags a KPI whose comparisons array is empty", () => {
    const findings = checkIbcs({ label: "Revenue", values: { AC: 1 }, comparisons: [] });
    expect(rulesOf(findings)).toContain("show-variance");
  });

  it("flags a cost-labelled KPI without higherIsBetter:false", () => {
    const findings = checkIbcs({ label: "Cost of sales", values: { AC: 1, PY: 1 } });
    expect(rulesOf(findings)).toContain("cost-favorability");
  });
});

describe("checkIbcs — report configs", () => {
  it("flags an unknown block type and a bare report title", () => {
    const findings = checkIbcs({
      title: "Q1 Report",
      blocks: [{ type: "banana", config: {} }],
    });
    expect(rulesOf(findings)).toContain("structured-title");
    expect(rulesOf(findings)).toContain("block-type");
  });

  it("flags a report with no blocks", () => {
    const findings = checkIbcs({ blocks: [] });
    expect(rulesOf(findings)).toContain("data-present");
  });

  it("flags a report with no title", () => {
    const findings = checkIbcs({ blocks: [{ type: "text", body: "hi" }] });
    const r = findings.find((f) => f.rule === "structured-title");
    expect(r).toBeDefined();
    expect(r!.path).toBe("title");
  });

  it("lets a BLOCK title satisfy an untitled chart config — and still carry the cost signal", () => {
    const report = {
      title: { who: "ACME", what: "Q1", when: "2026" },
      blocks: [
        {
          type: "chart",
          title: { who: "ACME", what: "Operating expenses (€k)", when: "2026" },
          config: { type: "varianceColumn", data: [{ category: "Q1", AC: 1, PY: 1 }] },
        },
      ],
    };
    const findings = checkIbcs(report);
    // The chart is titled by its block: no missing-title finding…
    expect(rulesOf(findings)).not.toContain("structured-title");
    // …but the block title's cost wording still reaches the favorability rule.
    expect(rulesOf(findings)).toContain("cost-favorability");
  });

  it("flags a chart block when NEITHER the block nor the config carries a title", () => {
    const findings = checkIbcs({
      title: { who: "ACME", what: "Q1", when: "2026" },
      blocks: [{ type: "chart", config: { type: "varianceColumn", data: [{ x: 1 }] } }],
    });
    const r = findings.find((f) => f.rule === "structured-title");
    expect(r).toBeDefined();
    expect(r!.path).toBe("blocks[0].config.title");
  });

  it("recurses into chart blocks and advises a shared scale for multiple charts", () => {
    const findings = checkIbcs({
      blocks: [
        { type: "chart", config: { type: "pie", data: [{ x: 1 }] } },
        { type: "chart", config: { type: "column", data: [{ x: 1 }] } },
      ],
    });
    expect(rulesOf(findings)).toContain("linear-chart-type"); // from the pie block
    expect(rulesOf(findings)).toContain("shared-scale");
  });

  it("flags a statement block with no lines", () => {
    const findings = checkIbcs({ blocks: [{ type: "statement", config: { lines: [] } }] });
    expect(rulesOf(findings)).toContain("data-present");
  });

  it("accepts a report table block with columns and rows", () => {
    const findings = checkIbcs({
      blocks: [
        {
          type: "table",
          config: {
            columns: [{ key: "revenue", label: "Revenue" }],
            rows: [{ id: "emea", label: "EMEA", values: { revenue: { AC: 120, PY: 100 } } }],
          },
        },
      ],
    });
    expect(rulesOf(findings)).not.toContain("block-type");
    expect(rulesOf(findings)).not.toContain("data-present");
  });

  it("flags a table block without columns or rows", () => {
    const findings = checkIbcs({ blocks: [{ type: "table", config: {} }] });
    expect(findings.filter((f) => f.rule === "data-present").map((f) => f.path)).toEqual([
      "blocks[0].config.columns",
      "blocks[0].config.rows",
    ]);
  });
});

describe("checkIbcs — unrecognized input", () => {
  it("returns an input-shape info for a non-object", () => {
    expect(checkIbcs(42)[0]!.rule).toBe("input-shape");
    expect(checkIbcs(null)[0]!.rule).toBe("input-shape");
  });

  it("returns an input-shape info for an object that is no known config", () => {
    expect(checkIbcs({ foo: "bar" })[0]!.rule).toBe("input-shape");
  });
});

describe("IBCS_RULES catalog", () => {
  it("documents every block type the linter actually accepts", () => {
    const doc = IBCS_RULES.find((r) => r.id === "block-type")!.doc;
    for (const t of ["kpi", "chart", "statement", "table", "text"]) expect(doc).toContain(t);
  });

  it("contains an entry for every rule id the linter can emit", () => {
    const ids = new Set(IBCS_RULES.map((r) => r.id));
    for (const id of [
      "linear-chart-type",
      "structured-title",
      "show-variance",
      "data-present",
      "block-type",
      "cost-favorability",
      "shared-scale",
      "input-shape",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
