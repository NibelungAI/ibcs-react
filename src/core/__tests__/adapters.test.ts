/**
 * @vitest-environment jsdom
 *
 * The adapters themselves are pure core code, but the last block in this file
 * mounts `ConfiguredChart` to prove its merged-tokens memo actually holds — so
 * the whole file runs in jsdom (harmless for the pure assertions).
 */
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { statementToDataTableRows, statementToStructure, statementToWaterfall } from "../adapters";
import { buildDataTableModel, measureValue, type DataTableColumn } from "../datatable";
import { validateReportConfig, type ReportConfig } from "../report";
import { computeStructure } from "../structure";
import type { StatementLine } from "../types";
import { computeBridge } from "../waterfall";

/**
 * A realistic small P&L: revenue, two cost groups with breakdowns (one expanded
 * by default, one collapsed), a result checkpoint, tax, and the final result.
 * `tax.PY` is NaN — upstream "no data", which must never become a zero.
 */
const statement: StatementLine[] = [
  { id: "rev", label: "Revenue", flow: "add", values: { AC: 1200, PY: 1050 } },
  {
    id: "cogs",
    label: "Cost of goods sold",
    flow: "subtract",
    higherIsBetter: false,
    values: {},
    children: [
      {
        id: "cogs.mat",
        label: "Materials",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 430, PY: 400 },
      },
      {
        id: "cogs.lab",
        label: "Labour",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 270, PY: 250 },
      },
    ],
  },
  {
    id: "opex",
    label: "Operating expenses",
    flow: "subtract",
    higherIsBetter: false,
    values: {},
    defaultCollapsed: true,
    children: [
      {
        id: "opex.sm",
        label: "Sales & marketing",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 180, PY: 170 },
      },
      {
        id: "opex.adm",
        label: "Administration",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 120, PY: 110 },
      },
    ],
  },
  { id: "gm", label: "Gross margin", flow: "result", values: { AC: 200, PY: 120 }, emphasis: true },
  {
    id: "tax",
    label: "Income tax",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 60, PY: NaN },
  },
  { id: "net", label: "Net income", flow: "result", values: { AC: 140, PY: 120 } },
];

/** Snapshot taken before every call, compared after — the adapters are pure. */
const pristine = structuredClone(statement);

afterEach(() => {
  expect(statement).toEqual(pristine);
});

describe("statementToWaterfall", () => {
  it("preserves line order, labels and flows", () => {
    const bars = statementToWaterfall(statement);
    expect(bars.map((b) => b.category)).toEqual([
      "Revenue",
      "Cost of goods sold",
      "Operating expenses",
      "Gross margin",
      "Income tax",
      "Net income",
    ]);
    expect(bars.map((b) => b.flow)).toEqual([
      "add",
      "subtract",
      "subtract",
      "result",
      "subtract",
      "result",
    ]);
  });

  it("aggregates a group's children through resolveValue", () => {
    const bars = statementToWaterfall(statement);
    expect(bars[1]!.value).toBe(700); // 430 + 270, the parent has no own value
    expect(bars[2]!.value).toBe(300); // 180 + 120
    // The resulting bridge reproduces the statement's own arithmetic.
    expect(computeBridge(bars).total).toBe(140); // 1200 - 700 - 300 - 60
  });

  it("carries higherIsBetter only when the line sets it", () => {
    const bars = statementToWaterfall(statement);
    expect(bars[1]!.higherIsBetter).toBe(false);
    expect("higherIsBetter" in bars[0]!).toBe(false);
  });

  it("reads any scenario", () => {
    const py = statementToWaterfall(statement, "PY");
    expect(py[0]!.value).toBe(1050);
    expect(py[1]!.value).toBe(650); // 400 + 250
  });

  it("expandGroups walks expanded-by-default groups but keeps collapsed ones aggregated", () => {
    const bars = statementToWaterfall(statement, "AC", { expandGroups: true });
    expect(bars.map((b) => b.category)).toEqual([
      "Revenue",
      "Materials",
      "Labour",
      "Operating expenses", // defaultCollapsed: stays one aggregated bar
      "Gross margin",
      "Income tax",
      "Net income",
    ]);
    expect(bars[1]!.value).toBe(430);
    expect(bars[3]!.value).toBe(300);
    // Expanding changes the columns, never the arithmetic.
    expect(computeBridge(bars).total).toBe(140);
  });

  it("treats a non-finite value as MISSING: the contribution is skipped, not zeroed", () => {
    // Documented contract: an add/subtract line with no finite value for the
    // scenario is omitted (a phantom 0-valued column would claim the cost was
    // nil); result checkpoints always draw, from the running total.
    const py = statementToWaterfall(statement, "PY");
    expect(py.map((b) => b.category)).toEqual([
      "Revenue",
      "Cost of goods sold",
      "Operating expenses",
      "Gross margin",
      "Net income",
    ]);
    expect(py.some((b) => b.category === "Income tax")).toBe(false);
    // Nothing downstream is poisoned: every level stays finite and the NaN
    // never leaks in as a 0 either.
    const layout = computeBridge(py);
    expect(layout.bars.every((b) => Number.isFinite(b.to))).toBe(true);
    expect(layout.total).toBe(120); // 1050 - 650 - 280, tax simply absent
  });

  it("emits an empty series for an empty statement", () => {
    expect(statementToWaterfall([])).toEqual([]);
  });
});

describe("statementToStructure", () => {
  it("excludes result lines by default (a subtotal is not a component)", () => {
    const parts = statementToStructure(statement);
    expect(parts.map((p) => p.label)).toEqual([
      "Revenue",
      "Cost of goods sold",
      "Operating expenses",
      "Income tax",
    ]);
  });

  it("keeps result lines with skipResults: false", () => {
    const parts = statementToStructure(statement, { skipResults: false });
    expect(parts.map((p) => p.label)).toEqual([
      "Revenue",
      "Cost of goods sold",
      "Operating expenses",
      "Gross margin",
      "Income tax",
      "Net income",
    ]);
  });

  it("resolves every present scenario and maps higherIsBetter onto the datum", () => {
    const [rev, cogs] = statementToStructure(statement);
    expect(rev).toEqual({ label: "Revenue", AC: 1200, PY: 1050 });
    expect(cogs).toEqual({ label: "Cost of goods sold", AC: 700, PY: 650, higherIsBetter: false });
  });

  it("omits a scenario with no finite value instead of writing 0", () => {
    const tax = statementToStructure(statement).find((p) => p.label === "Income tax")!;
    expect(tax.AC).toBe(60);
    expect("PY" in tax).toBe(false);
    expect("PL" in tax).toBe(false);
    // computeStructure therefore reports no PY comparison for that component.
    const layout = computeStructure(statementToStructure(statement), { sort: "none" });
    expect(layout.segments[3]!.variance).toBeNull();
    expect(Number.isFinite(layout.total)).toBe(true);
  });
});

describe("statementToDataTableRows", () => {
  const columns: DataTableColumn[] = [
    { key: "value", label: "AC" },
    { key: "value_py", label: "PY", measure: "value", scenario: "PY" },
    { key: "d_py", label: "ΔPY", kind: "variance", measure: "value", base: "PY" },
  ];

  it("preserves the hierarchy and its depth", () => {
    const rows = statementToDataTableRows(statement);
    expect(rows.map((r) => r.id)).toEqual(["rev", "cogs", "opex", "gm", "tax", "net"]);
    expect(rows[1]!.children?.map((c) => c.id)).toEqual(["cogs.mat", "cogs.lab"]);
    const model = buildDataTableModel(columns, rows);
    expect(model.rows.map((r) => r.depth)).toEqual([0, 0, 1, 1, 0, 1, 1, 0, 0, 0]);
  });

  it("files own scenario values under the measure, letting the table aggregate parents", () => {
    const rows = statementToDataTableRows(statement);
    expect(rows[0]!.values.value).toEqual({ AC: 1200, PY: 1050 });
    expect(rows[1]!.values.value).toEqual({}); // no own value — children carry it
    expect(measureValue(rows[1]!, "value", "AC")).toBe(700);
    expect(measureValue(rows[1]!, "value", "PY")).toBe(650);
  });

  it("drops non-finite cells so they render blank rather than 0", () => {
    const tax = statementToDataTableRows(statement)[4]!;
    expect(tax.values.value).toEqual({ AC: 60 });
    expect(measureValue(tax, "value", "PY")).toBeUndefined();
  });

  it("carries flow / emphasis / defaultCollapsed across", () => {
    const rows = statementToDataTableRows(statement);
    expect(rows.map((r) => r.flow)).toEqual([
      "add",
      "subtract",
      "subtract",
      "result",
      "subtract",
      "result",
    ]);
    expect(rows[2]!.defaultCollapsed).toBe(true);
    expect(rows[3]!.emphasis).toBe(true);
    expect("emphasis" in rows[0]!).toBe(false);
  });

  it("honours a custom measure name", () => {
    const rows = statementToDataTableRows(statement, { measure: "rev" });
    expect(rows[0]!.values.rev).toEqual({ AC: 1200, PY: 1050 });
    expect(rows[0]!.values.value).toBeUndefined();
  });
});

describe("adapter purity", () => {
  it("never mutates or aliases the input lines", () => {
    const before = structuredClone(statement);
    const rows = statementToDataTableRows(statement);
    statementToWaterfall(statement, "PY", { expandGroups: true });
    statementToStructure(statement, { skipResults: false });
    expect(statement).toEqual(before);
    // Returned children are rebuilt, so mutating the output can't reach back in.
    expect(rows[1]!.children![0]).not.toBe(statement[1]!.children![0]);
    expect(rows[1]!.values).not.toBe(statement[1]!.values);
  });
});

/* --------------------------------------------------------------------------
 * ConfiguredChart's merged-tokens memo.
 *
 * The merge used to be an object literal rebuilt inside each switch branch, so
 * every render handed the chart a brand-new `tokens` object and defeated its
 * internal `useMemo(..., [tokens])`. Asserting that from the outside needs a
 * view of what actually reaches the child, so we stub ONE leaf chart component
 * and record its props — cheaper and far less flaky than trying to infer memo
 * behaviour from rendered SVG.
 * -------------------------------------------------------------------------- */

const captured = vi.hoisted(() => ({ tokens: [] as unknown[] }));

vi.mock("../../react/TrendChart", () => ({
  TrendChart: (props: { tokens?: unknown }) => {
    captured.tokens.push(props.tokens);
    return null;
  },
}));

describe("ConfiguredChart merged tokens", () => {
  afterEach(cleanup);

  it("hands the same merged-tokens object to the chart across renders with stable props", async () => {
    const { ConfiguredChart } = await import("../../react/ConfiguredChart");
    const config = {
      type: "trend" as const,
      data: [{ category: "Jan", AC: 10, PY: 8 }],
      colors: { good: "#0a7f3f" },
    };
    const tokens = { color: { text: "#111111" } };

    captured.tokens.length = 0;
    const { rerender } = render(createElement(ConfiguredChart, { config, tokens }));
    rerender(createElement(ConfiguredChart, { config, tokens }));

    expect(captured.tokens.length).toBe(2);
    expect(captured.tokens[0]).toBe(captured.tokens[1]);
    // …and the config colors really are merged on top of the tokens prop.
    expect(captured.tokens[0]).toEqual({ color: { text: "#111111", good: "#0a7f3f" } });
  });
});

describe("report text block body", () => {
  afterEach(cleanup);

  const base: ReportConfig = {
    blocks: [
      {
        id: "note",
        type: "text",
        title: "Commentary",
        message: "Margin up 4pp on PY.",
        body: "Pricing carried the quarter.\n\nMaterials inflation is the watch item.",
      },
    ],
  };

  it("renders body as paragraphs alongside the title and key message", async () => {
    const { Report } = await import("../../react/Report");
    const { container } = render(createElement(Report, { config: base }));
    const text = container.textContent ?? "";
    expect(text).toContain("Commentary");
    expect(text).toContain("Margin up 4pp on PY.");
    expect(container.querySelectorAll("p").length).toBe(3); // message + 2 body paragraphs
    expect(text).toContain("Pricing carried the quarter.");
    expect(text).toContain("Materials inflation is the watch item.");
  });

  it("falls back to the message-only rendering when body is absent", async () => {
    const { Report } = await import("../../react/Report");
    const config: ReportConfig = {
      blocks: [{ id: "note", type: "text", title: "Commentary", message: "Margin up 4pp on PY." }],
    };
    const { container } = render(createElement(Report, { config }));
    expect(container.querySelectorAll("p").length).toBe(1);
    expect(container.textContent).toContain("Margin up 4pp on PY.");
  });

  it("validates body as a string", () => {
    expect(validateReportConfig(base).ok).toBe(true);
    const bad = validateReportConfig({ blocks: [{ id: "note", type: "text", body: 42 }] });
    expect(bad.ok).toBe(false);
  });
});
