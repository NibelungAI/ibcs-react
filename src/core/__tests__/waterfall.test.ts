import { describe, it, expect } from "vitest";
import { computeBridge, type WaterfallDatum } from "../waterfall";

const bridge: WaterfallDatum[] = [
  { category: "Revenue", value: 100, flow: "add" },
  { category: "COGS", value: 60, flow: "subtract" },
  { category: "Gross margin", value: 0, flow: "result" },
  { category: "OpEx", value: 25, flow: "subtract" },
  { category: "EBIT", value: 0, flow: "result" },
];

describe("computeBridge running totals", () => {
  const layout = computeBridge(bridge);

  it("accumulates add/subtract into a running total and final total", () => {
    expect(layout.total).toBe(15); // 100 - 60 - 25
  });

  it("positions each step bar from the entering total to the leaving total", () => {
    const rev = layout.bars[0]!;
    const cogs = layout.bars[1]!;
    expect(rev.from).toBe(0);
    expect(rev.to).toBe(100);
    expect(rev.delta).toBe(100);
    expect(cogs.from).toBe(100);
    expect(cogs.to).toBe(40);
    expect(cogs.delta).toBe(-60);
  });

  it("draws result columns as a full bar from 0 to the running total, without advancing it", () => {
    const gm = layout.bars[2]!;
    expect(gm.isTotal).toBe(true);
    expect(gm.from).toBe(0);
    expect(gm.to).toBe(40); // 100 - 60
    expect(gm.delta).toBe(0);
    // The step after the result resumes from the same running total (40).
    expect(layout.bars[3]!.from).toBe(40);
  });

  it("labels travel direction by sign of the step", () => {
    expect(layout.bars[0]!.direction).toBe("up"); // +revenue
    expect(layout.bars[1]!.direction).toBe("down"); // -cogs
  });

  it("sets cumBefore/cumAfter to the leaving total for a result column", () => {
    const ebit = layout.bars[4]!;
    expect(ebit.cumBefore).toBe(15);
    expect(ebit.cumAfter).toBe(15);
  });

  it("always includes the zero baseline in the domain even for an all-positive bridge", () => {
    const allUp = computeBridge([
      { category: "A", value: 10, flow: "add" },
      { category: "B", value: 20, flow: "add" },
    ]);
    expect(allUp.domainMin).toBe(0);
    expect(allUp.domainMax).toBe(30);
  });

  it("extends domainMin below zero when the running total goes negative", () => {
    const neg = computeBridge([
      { category: "Start", value: 10, flow: "add" },
      { category: "BigCost", value: 40, flow: "subtract" },
    ]);
    expect(neg.total).toBe(-30);
    expect(neg.domainMin).toBe(-30);
    expect(neg.domainMax).toBe(10);
  });

  it("defaults flow to 'add' when unset", () => {
    const l = computeBridge([{ category: "X", value: 5 }]);
    expect(l.bars[0]!.flow).toBe("add");
    expect(l.bars[0]!.to).toBe(5);
  });

  it("honours a negative value on an 'add' (moves the total down)", () => {
    const l = computeBridge([{ category: "X", value: -10, flow: "add" }]);
    expect(l.bars[0]!.delta).toBe(-10);
    expect(l.bars[0]!.to).toBe(-10);
    expect(l.bars[0]!.direction).toBe("down");
  });

  it("falls back domainMax to 1 and varMax to 1 to avoid a zero-height scale", () => {
    const l = computeBridge([{ category: "Z", value: 0, flow: "result" }]);
    expect(l.domainMax).toBe(1);
    expect(l.varMax).toBe(1);
  });
});

describe("computeBridge variance vs a comparison bridge", () => {
  it("compares each running level against the aligned comparison level", () => {
    const comparison: WaterfallDatum[] = [
      { category: "Revenue", value: 90, flow: "add" },
      { category: "COGS", value: 50, flow: "subtract" },
      { category: "Gross margin", value: 0, flow: "result" },
      { category: "OpEx", value: 20, flow: "subtract" },
      { category: "EBIT", value: 0, flow: "result" },
    ];
    const layout = computeBridge(bridge, "AC", { comparison });
    // Revenue level: 100 vs 90 -> +10 favorable
    expect(layout.bars[0]!.variance!.abs).toBe(10);
    expect(layout.bars[0]!.variance!.favorable).toBe(true);
    // Gross margin level: 40 vs 40 -> 0
    expect(layout.bars[2]!.variance!.abs).toBe(0);
    // EBIT level: 15 vs 20 -> -5 unfavorable (higher is better by default)
    expect(layout.bars[4]!.variance!.abs).toBe(-5);
    expect(layout.bars[4]!.variance!.favorable).toBe(false);
  });

  it("tracks varMax as the largest absolute level variance", () => {
    const comparison: WaterfallDatum[] = [
      { category: "Revenue", value: 70, flow: "add" }, // 100 vs 70 -> 30
      { category: "COGS", value: 60, flow: "subtract" }, // 40 vs 10 -> 30
    ];
    const layout = computeBridge(
      [
        { category: "Revenue", value: 100, flow: "add" },
        { category: "COGS", value: 60, flow: "subtract" },
      ],
      "AC",
      { comparison },
    );
    expect(layout.varMax).toBe(30);
  });

  it("yields null variance when there is no comparison", () => {
    const layout = computeBridge(bridge);
    expect(layout.bars.every((b) => b.variance === null)).toBe(true);
  });

  it("respects per-datum higherIsBetter for the variance favorability", () => {
    const comparison: WaterfallDatum[] = [{ category: "Cost", value: 100, flow: "add" }];
    const layout = computeBridge(
      [{ category: "Cost", value: 120, flow: "add", higherIsBetter: false }],
      "AC",
      { comparison },
    );
    // 120 vs 100 on a cost line -> overrun -> unfavorable
    expect(layout.bars[0]!.variance!.abs).toBe(20);
    expect(layout.bars[0]!.variance!.favorable).toBe(false);
  });
});
