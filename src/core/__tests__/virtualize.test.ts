import { describe, it, expect } from "vitest";
import { computeWindow } from "../virtualize";

describe("computeWindow — coverage", () => {
  it("covers the whole viewport with overscan 0 at the top", () => {
    const w = computeWindow({
      scrollTop: 0,
      viewportHeight: 90,
      rowHeight: 30,
      count: 100,
      overscan: 0,
    });
    expect(w).toEqual({ start: 0, end: 3, padTop: 0, padBottom: 97 * 30 });
  });

  it("covers the partially scrolled trailing row (regression: 15px blank strip)", () => {
    // scrollTop 15 shows rows 0..3 (0-15 clipped, then 3 full rows, then 15px
    // of row 3). The old `first + ceil(viewportHeight / rowHeight)` stopped at
    // row 2 and left the last 15px blank.
    const w = computeWindow({
      scrollTop: 15,
      viewportHeight: 90,
      rowHeight: 30,
      count: 100,
      overscan: 0,
    });
    expect(w.start).toBe(0);
    expect(w.end).toBe(4);
    expect(w.end * 30).toBeGreaterThanOrEqual(15 + 90);
  });

  it("always renders past the viewport bottom for any scroll offset", () => {
    for (let scrollTop = 0; scrollTop <= 300; scrollTop += 7) {
      const w = computeWindow({
        scrollTop,
        viewportHeight: 90,
        rowHeight: 30,
        count: 100,
        overscan: 0,
      });
      expect(w.start * 30).toBeLessThanOrEqual(scrollTop);
      expect(w.end * 30).toBeGreaterThanOrEqual(scrollTop + 90);
    }
  });

  it("adds the overscan margin on both sides", () => {
    const w = computeWindow({
      scrollTop: 300,
      viewportHeight: 90,
      rowHeight: 30,
      count: 100,
      overscan: 2,
    });
    expect(w.start).toBe(8); // row 10 minus 2
    expect(w.end).toBe(15); // ceil(390/30)=13 plus 2
    expect(w.padTop).toBe(8 * 30);
    expect(w.padBottom).toBe((100 - 15) * 30);
  });
});

describe("computeWindow — clamping", () => {
  it("clamps to [0, count] at the ends", () => {
    const top = computeWindow({
      scrollTop: 0,
      viewportHeight: 90,
      rowHeight: 30,
      count: 2,
      overscan: 6,
    });
    expect(top).toEqual({ start: 0, end: 2, padTop: 0, padBottom: 0 });

    const past = computeWindow({ scrollTop: 100000, viewportHeight: 90, rowHeight: 30, count: 10 });
    expect(past.start).toBe(10);
    expect(past.end).toBe(10);
    expect(past.padBottom).toBe(0);
  });

  it("treats a negative scrollTop as 0", () => {
    const w = computeWindow({
      scrollTop: -500,
      viewportHeight: 90,
      rowHeight: 30,
      count: 100,
      overscan: 0,
    });
    expect(w).toEqual({ start: 0, end: 3, padTop: 0, padBottom: 97 * 30 });
  });

  it("returns an empty window for an empty list", () => {
    expect(computeWindow({ scrollTop: 0, viewportHeight: 90, rowHeight: 30, count: 0 })).toEqual({
      start: 0,
      end: 0,
      padTop: 0,
      padBottom: 0,
    });
  });

  it("renders everything when the row height or viewport is unusable", () => {
    expect(
      computeWindow({ scrollTop: 0, viewportHeight: 0, rowHeight: 30, count: 5 }),
    ).toMatchObject({
      start: 0,
      end: 5,
    });
    expect(
      computeWindow({ scrollTop: 0, viewportHeight: 90, rowHeight: 0, count: 5 }),
    ).toMatchObject({
      start: 0,
      end: 5,
    });
    expect(
      computeWindow({ scrollTop: 0, viewportHeight: 90, rowHeight: NaN, count: 5 }),
    ).toMatchObject({
      start: 0,
      end: 5,
    });
  });
});

describe("computeWindow — non-finite scroll state", () => {
  it("coerces a NaN scrollTop to 0 instead of emitting NaN indices", () => {
    const w = computeWindow({
      scrollTop: NaN,
      viewportHeight: 90,
      rowHeight: 30,
      count: 100,
      overscan: 0,
    });
    expect(w).toEqual({ start: 0, end: 3, padTop: 0, padBottom: 97 * 30 });
  });

  it("coerces an Infinite scrollTop to 0", () => {
    const w = computeWindow({
      scrollTop: Infinity,
      viewportHeight: 90,
      rowHeight: 30,
      count: 100,
      overscan: 0,
    });
    expect(w.start).toBe(0);
    expect(w.end).toBe(3);
  });

  it("treats a non-finite viewportHeight as unmeasured (renders all rows)", () => {
    const w = computeWindow({ scrollTop: 0, viewportHeight: NaN, rowHeight: 30, count: 7 });
    expect(w).toEqual({ start: 0, end: 7, padTop: 0, padBottom: 0 });
  });
});
