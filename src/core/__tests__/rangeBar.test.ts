import { describe, expect, it } from "vitest";

import { computeRangeBars } from "../rangeBar";

describe("computeRangeBars", () => {
  it("puts each range's ends in order and keeps the categories' order", () => {
    const { rows } = computeRangeBars([
      { label: "A", from: 952.6, to: 870.2, mark: 914.3 },
      { label: "B", from: 866.5, to: 948.9 },
    ]);
    expect(rows.map((r) => [r.index, r.label, r.low, r.high, r.mark])).toEqual([
      [0, "A", 870.2, 952.6, 914.3],
      [1, "B", 866.5, 948.9, null],
    ]);
  });

  it("spans every drawable end and mark, a mark outside its range included", () => {
    const layout = computeRangeBars([
      { label: "A", from: 10, to: 20, mark: 25 },
      { label: "B", from: 5, to: 15, mark: 3 },
    ]);
    expect([layout.min, layout.max]).toEqual([3, 25]);
  });

  it("keeps a category whose ends are not both finite, with NaN ends and no mark", () => {
    const layout = computeRangeBars([
      { label: "A", from: NaN, to: 20, mark: 15 },
      { label: "B", from: 5, to: 15, mark: Infinity },
    ]);
    expect(layout.rows[0]).toMatchObject({ label: "A", low: NaN, high: NaN, mark: null });
    expect(layout.rows[1]).toMatchObject({ low: 5, high: 15, mark: null });
    expect([layout.min, layout.max]).toEqual([5, 15]);
  });

  it("spans 0 to 1 with nothing to draw, and one value with an extent of zero width", () => {
    expect(computeRangeBars([])).toMatchObject({ rows: [], min: 0, max: 1 });
    expect(computeRangeBars([{ label: "A", from: NaN, to: 1 }])).toMatchObject({ min: 0, max: 1 });
    expect(computeRangeBars([{ label: "A", from: 4, to: 4, mark: 4 }])).toMatchObject({
      min: 4,
      max: 4,
    });
  });
});
