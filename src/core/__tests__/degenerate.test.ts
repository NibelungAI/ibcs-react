import { describe, it, expect } from "vitest";
import { computeBarVarianceWaterfall, type BarVarianceDatum } from "../barVarianceWaterfall";
import { computeCombo, type ComboDatum } from "../combo";
import {
  computeColumnVarianceWaterfall,
  type ColumnVarianceDatum,
  type EndTotalInput,
  type PriorTotalInput,
} from "../columnVarianceWaterfall";
import { computeGroupedVariance, type GroupedDatum } from "../groupedVariance";
import {
  computeIntegratedVariance,
  type FyTotalInput,
  type IntegratedDatum,
} from "../integratedVariance";
import { computeLevels, computeWaterfall, flattenVisible } from "../layout";
import { computeLines, type LineDatum } from "../lineArea";
import { computeStacked, type StackedDatum, type StackedSeries } from "../stacked";
import { computeStructure, type StructureDatum } from "../structure";
import { computeTrend, type TrendDatum } from "../trend";
import type { StatementLine } from "../types";
import { computeBridge, type WaterfallDatum } from "../waterfall";
import { computeWaterfallStatement, type WaterfallStatementLine } from "../waterfallStatement";

/**
 * Degenerate-input conformance suite for the pure layout modules.
 *
 * Every layout must survive the four shapes real financial data actually takes
 * at the edges — empty, all-zero, ALL-NEGATIVE (a loss / cost / margin series)
 * and NaN-laced (a broken feed) — plus the single-row case, and for each must
 * guarantee the same four invariants:
 *
 *  1. every domain field is finite,
 *  2. the domain is zero-seeded (`min <= 0 <= max`) and non-empty (`min < max`),
 *  3. no `NaN` / `±Infinity` anywhere in the emitted geometry,
 *  4. the caller's input is never mutated.
 *
 * Plus the headline regression: for ALL-NEGATIVE data `domainMax` must stay
 * exactly 0. The old `domainMax || 1` idiom pushed it to 1, so a `[-0.5, 0]`
 * margin chart drew its data in the bottom third of an otherwise empty plot.
 */

/** A layout module under test, with a builder per input shape. */
interface Subject {
  name: string;
  /** Build the raw input for a set of sample values, plus the call over it. */
  build: (values: number[]) => { input: unknown; run: () => unknown };
  /** `[min, max]` field pairs on the result that must form a valid domain. */
  domains: [string, string][];
  /** Result keys skipped by the finite walk (input models echoed by reference). */
  ignore?: string[];
}

/** Sample value sets: the degenerate shapes every layout must absorb. */
const VALUE_SETS: Record<string, number[]> = {
  empty: [],
  "all-zero": [0, 0, 0],
  "all-negative": [-5, -3, -0.5],
  "NaN-laced": [NaN, 12, Infinity, -4, -Infinity],
  single: [42],
};

/** Collect a readable path for every non-finite number reachable in `node`. */
function nonFinitePaths(node: unknown, ignore: Set<string>, path = "$", out: string[] = []) {
  if (typeof node === "number") {
    if (!Number.isFinite(node)) out.push(`${path} = ${node}`);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => nonFinitePaths(v, ignore, `${path}[${i}]`, out));
    return out;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (ignore.has(k)) continue;
      nonFinitePaths(v, ignore, `${path}.${k}`, out);
    }
  }
  return out;
}

/** A flat P&L-ish line per sample value (AC + a slightly different comparison). */
const statementLines = (values: number[]): StatementLine[] =>
  values.map((v, i) => ({
    id: `l${i}`,
    label: `Line ${i}`,
    values: { AC: v, PY: v * 1.2 },
  }));

/** An expanded group (values live only on the children) closed by a subtotal. */
const statementTree = (values: number[]): StatementLine[] => [
  {
    id: "g",
    label: "Group",
    values: {},
    children: values.map((v, i) => ({
      id: `c${i}`,
      label: `Child ${i}`,
      values: { AC: v, PY: v * 1.2 },
    })),
  },
  { id: "total", label: "Total", flow: "result", values: {} },
];

const SUBJECTS: Subject[] = [
  {
    name: "computeWaterfall (flat lines)",
    build: (values) => {
      const input = statementLines(values);
      return { input, run: () => computeWaterfall(flattenVisible(input, new Set())) };
    },
    domains: [["domainMin", "domainMax"]],
    // `line` is the caller's model, echoed by reference — not our geometry.
    ignore: ["line"],
  },
  {
    name: "computeWaterfall (expanded group + subtotal)",
    build: (values) => {
      const input = statementTree(values);
      return { input, run: () => computeWaterfall(flattenVisible(input, new Set())) };
    },
    domains: [["domainMin", "domainMax"]],
    ignore: ["line"],
  },
  {
    name: "computeLevels",
    build: (values) => {
      const input = statementTree(values);
      return { input, run: () => computeLevels(flattenVisible(input, new Set())) };
    },
    domains: [["domainMin", "domainMax"]],
    ignore: ["line"],
  },
  {
    name: "computeBridge",
    build: (values) => {
      const input: WaterfallDatum[] = values.map((v, i) => ({
        category: `C${i}`,
        value: v,
        flow: i % 3 === 2 ? "result" : "add",
      }));
      const comparison: WaterfallDatum[] = input.map((d) => ({ ...d, value: d.value * 1.2 }));
      return { input, run: () => computeBridge(input, "AC", { comparison }) };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeTrend",
    build: (values) => {
      const input: TrendDatum[] = values.map((v, i) => ({
        category: `P${i}`,
        AC: v,
        PY: v * 1.2,
      }));
      return { input, run: () => computeTrend(input) };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeTrend (percent variance mode)",
    build: (values) => {
      const input: TrendDatum[] = values.map((v, i) => ({
        category: `P${i}`,
        AC: v,
        PY: v * 1.2,
        FC: v,
      }));
      return { input, run: () => computeTrend(input, { varianceMode: "pct" }) };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeLines",
    build: (values) => {
      const input: LineDatum[] = values.map((v, i) => ({
        category: `P${i}`,
        AC: v,
        PY: v * 1.2,
      }));
      return { input, run: () => computeLines(input) };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeCombo",
    build: (values) => {
      const input = {
        data: values.map((v, i) => ({ category: `P${i}`, AC: v, PY: v * 1.2 })) as ComboDatum[],
        secondary: values.map((v) => v / 2),
      };
      return { input, run: () => computeCombo(input.data, input.secondary) };
    },
    domains: [
      ["primaryMin", "primaryMax"],
      ["secondaryMin", "secondaryMax"],
    ],
  },
  {
    name: "computeStacked",
    build: (values) => {
      const series: StackedSeries[] = [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ];
      const input = {
        series,
        data: values.map((v, i) => ({
          category: `P${i}`,
          values: { a: v, b: v / 2 },
        })) as StackedDatum[],
      };
      return { input, run: () => computeStacked(input.data, { series: input.series }) };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeStructure",
    build: (values) => {
      const input: StructureDatum[] = values.map((v, i) => ({
        label: `Part ${i}`,
        AC: v,
        PY: v * 1.2,
      }));
      return { input, run: () => computeStructure(input) };
    },
    // A composition has no value domain — only the `maxAbs` bar scale.
    domains: [],
  },
  {
    name: "computeGroupedVariance",
    build: (values) => {
      const input: GroupedDatum[] = values.map((v, i) => ({
        category: `P${i}`,
        AC: v,
        comparisonValue: v * 1.2,
      }));
      return { input, run: () => computeGroupedVariance(input) };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeIntegratedVariance (+ FY stack)",
    build: (values) => {
      const input = {
        data: values.map((v, i) => ({
          category: `P${i}`,
          AC: v,
          PY: v * 1.2,
          PL: v * 0.9,
        })) as IntegratedDatum[],
        fyTotal: {
          label: "FY",
          segments: values.map((v, i) => ({ label: `S${i}`, value: v })),
        } as FyTotalInput,
      };
      return {
        input,
        run: () => computeIntegratedVariance(input.data, { fyTotal: input.fyTotal }),
      };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeColumnVarianceWaterfall (+ set-apart totals)",
    build: (values) => {
      const input = {
        data: values.map((v, i) => ({
          category: `P${i}`,
          ac: v,
          pl: v * 1.2,
        })) as ColumnVarianceDatum[],
        priorTotals: values.map((v, i) => ({
          label: `Y${i}`,
          value: v,
          scenario: "PL",
        })) as PriorTotalInput[],
        endTotal: {
          label: "AC+FC",
          segments: values.map((v, i) => ({ label: `S${i}`, value: v })),
        } as EndTotalInput,
      };
      return {
        input,
        run: () =>
          computeColumnVarianceWaterfall(input.data, {
            priorTotals: input.priorTotals,
            endTotal: input.endTotal,
          }),
      };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeBarVarianceWaterfall",
    build: (values) => {
      const input: BarVarianceDatum[] = values.map((v, i) => ({
        label: `E${i}`,
        ac: v,
        base: v * 1.2,
        py: v * 1.1,
      }));
      return { input, run: () => computeBarVarianceWaterfall(input) };
    },
    domains: [["domainMin", "domainMax"]],
  },
  {
    name: "computeWaterfallStatement",
    build: (values) => {
      const input: WaterfallStatementLine[] = values.map((v, i) => ({
        label: `Line ${i}`,
        ac: v,
        base: v * 1.2,
        flow: i % 3 === 2 ? "result" : "add",
      }));
      return { input, run: () => computeWaterfallStatement(input) };
    },
    domains: [["domainMin", "domainMax"]],
  },
];

describe("nonFinitePaths (the checker guarding every case below)", () => {
  it("finds planted non-finite numbers anywhere in a nested result", () => {
    const bad = nonFinitePaths(
      { rows: [{ bar: { from: 0, to: NaN } }, { bar: { from: -Infinity, to: 1 } }], ok: 3 },
      new Set(),
    );
    expect(bad).toEqual(["$.rows[0].bar.to = NaN", "$.rows[1].bar.from = -Infinity"]);
  });

  it("skips ignored keys and non-numeric leaves", () => {
    expect(nonFinitePaths({ line: { v: NaN }, label: "x", v: null }, new Set(["line"]))).toEqual(
      [],
    );
  });
});

for (const subject of SUBJECTS) {
  describe(`${subject.name} — degenerate input`, () => {
    const ignore = new Set(subject.ignore ?? []);

    for (const [shape, values] of Object.entries(VALUE_SETS)) {
      it(`stays finite, zero-seeded and non-mutating on ${shape} input`, () => {
        const { input, run } = subject.build(values);
        const before = structuredClone(input);

        const result = run() as Record<string, unknown>;

        // 4. The caller's data is ours to read, never to write.
        expect(input).toEqual(before);

        // 3. Not one NaN / Infinity may reach the renderer.
        expect(nonFinitePaths(result, ignore)).toEqual([]);

        // 1 + 2. Every domain is finite, brackets zero, and has real extent.
        for (const [minKey, maxKey] of subject.domains) {
          const min = result[minKey] as number;
          const max = result[maxKey] as number;
          expect(Number.isFinite(min), `${minKey} = ${min}`).toBe(true);
          expect(Number.isFinite(max), `${maxKey} = ${max}`).toBe(true);
          expect(min).toBeLessThanOrEqual(0);
          expect(max).toBeGreaterThanOrEqual(0);
          expect(min).toBeLessThan(max);
        }
      });
    }

    if (subject.domains.length) {
      it("keeps domainMax at 0 for all-negative data (no `|| 1` padding)", () => {
        const { run } = subject.build(VALUE_SETS["all-negative"]!);
        const result = run() as Record<string, number>;
        for (const [minKey, maxKey] of subject.domains) {
          expect(result[maxKey], `${maxKey} must not be padded to 1`).toBe(0);
          expect(result[minKey]).toBeLessThan(0);
        }
      });
    }
  });
}

describe("all-negative regression — the wasted-plot bug", () => {
  it("gives a small loss series the whole plot instead of an empty upper half", () => {
    // A margin-erosion series: every period is a loss between -0.5 and -0.1.
    const layout = computeTrend([
      { category: "Jan", AC: -0.5 },
      { category: "Feb", AC: -0.3 },
      { category: "Mar", AC: -0.1 },
    ]);
    expect(layout.domainMin).toBe(-0.5);
    // Was 1 before the fix — the data used ~33% of the lane.
    expect(layout.domainMax).toBe(0);
  });

  it("still widens a genuinely EMPTY domain so nothing divides by zero", () => {
    const layout = computeTrend([{ category: "Jan", AC: 0 }]);
    expect(layout.domainMin).toBe(0);
    expect(layout.domainMax).toBe(1);
  });
});

describe("missing (non-finite) values never accumulate", () => {
  it("computeBridge treats a NaN contribution as 0 and keeps the run intact", () => {
    const layout = computeBridge([
      { category: "Revenue", value: 100, flow: "add" },
      { category: "Broken", value: NaN, flow: "add" },
      { category: "COGS", value: 60, flow: "subtract" },
      { category: "EBIT", value: 0, flow: "result" },
    ]);
    expect(layout.total).toBe(40);
    expect(layout.bars[1]!.delta).toBe(0);
    expect(layout.bars[1]!.value).toBe(0);
    expect(layout.bars[2]!.to).toBe(40);
    expect(layout.domainMax).toBe(100);
    expect(layout.domainMin).toBe(0);
  });

  it("computeBridge runs the comparison lane through the same accumulation", () => {
    const items: WaterfallDatum[] = [
      { category: "Revenue", value: 100, flow: "add" },
      { category: "COGS", value: 60, flow: "subtract" },
    ];
    const comparison: WaterfallDatum[] = [
      { category: "Revenue", value: NaN, flow: "add" },
      { category: "COGS", value: 50, flow: "subtract" },
    ];
    const layout = computeBridge(items, "AC", { comparison });
    // Comparison levels: 0 (NaN skipped) then -50 — finite, so both variances are.
    expect(layout.bars[0]!.variance!.abs).toBe(100);
    expect(layout.bars[1]!.variance!.abs).toBe(90);
  });

  it("computeStacked skips a NaN BEFORE the sign test so the negative stack survives", () => {
    const layout = computeStacked([{ category: "Q1", values: { a: 10, b: NaN, c: -4 } }], {
      series: [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "c", label: "C" },
      ],
    });
    const col = layout.columns[0]!;
    expect(col.segments.map((s) => s.seriesKey)).toEqual(["a", "c"]);
    expect(col.positiveTotal).toBe(10);
    expect(col.negativeTotal).toBe(-4);
    expect(col.total).toBe(6);
    expect(layout.domainMin).toBe(-4);
    expect(layout.domainMax).toBe(10);
  });

  it("computeWaterfall falls through a NaN own value to the children's sum", () => {
    const lines: StatementLine[] = [
      {
        id: "g",
        label: "Group",
        values: { AC: NaN },
        children: [
          { id: "a", label: "A", values: { AC: 30 } },
          { id: "b", label: "B", values: { AC: 12 } },
        ],
      },
    ];
    // Collapsed: the group contributes its children's sum, not a NaN.
    const collapsed = computeWaterfall(flattenVisible(lines, new Set(["g"])));
    const bar = collapsed.rows[0]!.bar;
    expect(bar.kind).toBe("delta");
    expect(bar.kind === "delta" ? bar.to : null).toBe(42);
    expect(collapsed.rows[0]!.cumAfter).toBe(42);
    expect(collapsed.domainMax).toBe(42);
  });

  it("computeTrend reports a non-finite scenario value as missing", () => {
    const layout = computeTrend([
      { category: "Jan", AC: NaN, FC: 20, PY: 15 },
      { category: "Feb", AC: 30, PY: Infinity },
    ]);
    expect(layout.cells[0]!.AC).toBeUndefined();
    expect(layout.cells[0]!.current).toBe(20); // falls back to the forecast
    expect(layout.cells[0]!.isForecast).toBe(true);
    expect(layout.cells[1]!.PY).toBeUndefined();
    expect(layout.cells[1]!.variance).toBeNull(); // no comparison -> no variance
    expect(layout.domainMax).toBe(30);
  });

  it("computeLines omits a non-finite point so the line simply breaks", () => {
    const layout = computeLines([
      { category: "Jan", AC: 10 },
      { category: "Feb", AC: NaN },
      { category: "Mar", AC: 30 },
    ]);
    const ac = layout.series[0]!;
    expect(ac.points.map((p) => p.index)).toEqual([0, 2]);
    expect(ac.endPoint!.value).toBe(30);
    expect(layout.domainMax).toBe(30);
  });

  it("computeCombo drops a non-finite secondary point (the line breaks there)", () => {
    const layout = computeCombo(
      [
        { category: "Jan", AC: 10, PY: 8 },
        { category: "Feb", AC: NaN, PY: 9 },
      ],
      [0.4, Infinity],
    );
    expect(layout.cells[0]!.secondary).toBe(0.4);
    expect(layout.cells[1]!.secondary).toBeNull();
    expect(layout.cells[1]!.AC).toBeUndefined();
    expect(layout.cells[1]!.variance).toBeNull();
    expect(layout.primaryMax).toBe(10);
    expect(layout.secondaryMax).toBe(0.4);
  });

  it("computeStructure ignores a non-finite component in the totals", () => {
    const layout = computeStructure([
      { label: "A", AC: 60, PY: 50 },
      { label: "B", AC: NaN, PY: 50 },
    ]);
    expect(layout.total).toBe(60);
    expect(layout.segments.map((s) => s.current)).toEqual([60, 0]);
    expect(layout.segments[1]!.AC).toBeUndefined();
    expect(layout.maxAbs).toBe(60);
  });
});
