import { describe, it, expect } from "vitest";
import { ulpOf } from "../histogram";
import { computeTicks, assignGroupColors, distinctGroups, computeXyScale } from "../xy";

/**
 * Node's `vm`, whose `timeout` stops even a loop that never yields. The
 * library's tsconfig has no Node types, so it is reached as
 * `exportMenu.test.tsx` reaches `process`: through `globalThis`, typed here.
 */
const vm = (
  globalThis as unknown as {
    process: {
      getBuiltinModule(id: "node:vm"): {
        runInNewContext(code: string, context: object, options: { timeout: number }): unknown;
      };
    };
  }
).process.getBuiltinModule("node:vm");

describe("computeTicks - tick count", () => {
  it("returns about the requested number of ticks (D3 error-based step)", () => {
    // Regression: rounding the raw step DOWN turned this into 9 ticks
    // (step 10 instead of 20).
    expect(computeTicks(0, 80, 5)).toEqual([0, 20, 40, 60, 80]);
  });

  it("stays within the √2 bound the error-based step guarantees", () => {
    // The step is never smaller than rawStep/√2, so the interval count can
    // never exceed count·√2 (the old round-down step allowed ~2× that).
    for (const max of [1, 3, 7, 9, 12, 47, 80, 99, 123, 999, 1234, 87654]) {
      for (const count of [3, 4, 5, 6, 8, 10]) {
        const ticks = computeTicks(0, max, count);
        expect(ticks.length).toBeLessThanOrEqual(Math.ceil(count * Math.SQRT2) + 1);
        expect(ticks.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("matches D3's tick selection on the reference cases", () => {
    expect(computeTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(computeTicks(0, 9, 3)).toEqual([0, 2, 4, 6, 8]);
    expect(computeTicks(0, 123, 5)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(computeTicks(0, 87654, 3)).toEqual([0, 20000, 40000, 60000, 80000]);
  });

  it("keeps the 1/2/5×10ⁿ ladder", () => {
    expect(computeTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(computeTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(computeTicks(0, 50, 5)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("covers negative and asymmetric domains, ascending", () => {
    const ticks = computeTicks(-40, 60, 5);
    expect(ticks[0]).toBeGreaterThanOrEqual(-40);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(60);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(ticks).toContain(0);
  });
});

describe("computeTicks - floating point", () => {
  it("emits clean decimals instead of accumulated drift", () => {
    const ticks = computeTicks(0, 1, 5);
    expect(ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    // The old additive loop produced 0.30000000000000004 here.
    expect(computeTicks(0, 0.5, 5)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    for (const t of computeTicks(0, 0.7, 7)) {
      expect(String(t).length).toBeLessThanOrEqual(4);
    }
  });

  it("returns an exact zero tick (not -0 or 1e-17)", () => {
    const ticks = computeTicks(-0.3, 0.3, 6);
    const zero = ticks.find((t) => Math.abs(t) < 1e-9)!;
    expect(zero).toBe(0);
    expect(Object.is(zero, -0)).toBe(false);
  });
});

describe("computeTicks - degenerate input", () => {
  it("returns no ticks for non-finite ends (never [NaN])", () => {
    expect(computeTicks(NaN, 10)).toEqual([]);
    expect(computeTicks(0, NaN)).toEqual([]);
    expect(computeTicks(-Infinity, Infinity)).toEqual([]);
  });

  it("returns the single level for an empty span", () => {
    expect(computeTicks(5, 5)).toEqual([5]);
    expect(computeTicks(5, 1)).toEqual([5]);
    expect(computeTicks(0, 10, 0)).toEqual([0]);
  });

  it("survives an infinite tick count request", () => {
    expect(computeTicks(0, 10, Infinity)).toEqual([0]);
  });

  it("walks on past a tick that repeats, to the range's end", () => {
    // On a range a few doubles wide, toFixed writes two neighbouring multiples
    // of the step as one value. That tick is skipped, not the end of the axis:
    // ending the walk there stopped computeTicks(1, 1.000000000000003, 10) at
    // 1.0000000000000009. 1.6.0 reached the end, with two ticks written twice.
    for (const [min, max, count] of [
      [1, 1.000000000000003, 15],
      [0.001, 0.001000000000000003, 15],
      [1e-9, 1.0000000000000032e-9, 16],
    ] as const) {
      const ticks = computeTicks(min, max, 10);
      expect(ticks.length).toBe(count);
      expect(ticks[0]).toBe(min);
      expect(ticks[ticks.length - 1]).toBe(max);
      for (const [i, t] of ticks.entries()) if (i > 0) expect(t).toBeGreaterThan(ticks[i - 1]!);
    }
  });

  it("returns on narrow ranges far from zero, its ticks strictly increasing", () => {
    // Up to 1.6, `computeTicks(1e17, 1e17 + 16)` never returned: past 2^53 its
    // integer step index could not move. The call runs under a vm deadline, so
    // a loop that never ends fails this test instead of hanging the run.
    const cases: Array<[number, number]> = [
      [1e17, 1e17 + 16],
      [2 ** 53, 2 ** 53 + 8],
      [1e300, 1e300 + ulpOf(1e300) * 4],
      [1.7e18, 1.7e18 + 1e3],
      [1e6, 1e6 + ulpOf(1e6)],
      [-Number.MAX_VALUE, Number.MAX_VALUE],
      [5e-324, 1e-323],
    ];
    for (const [min, max] of cases) {
      const ticks = vm.runInNewContext(
        "computeTicks(min, max)",
        { computeTicks, min, max },
        { timeout: 2000 },
      ) as number[];
      // It returned: now the call alone, timed without the vm's new context.
      const t0 = performance.now();
      computeTicks(min, max);
      expect(performance.now() - t0).toBeLessThan(50);
      expect(ticks.length).toBeGreaterThan(0);
      for (const [i, t] of ticks.entries()) {
        expect(Number.isFinite(t)).toBe(true);
        if (i > 0) expect(t).toBeGreaterThan(ticks[i - 1]!);
      }
    }
    // Its two ends, though the steps between them round to one or the other.
    expect(computeTicks(1e17, 1e17 + 16)).toEqual([1e17, 1e17 + 16]);
    expect(computeTicks(2 ** 53, 2 ** 53 + 8)).toEqual([
      2 ** 53,
      2 ** 53 + 2,
      2 ** 53 + 4,
      2 ** 53 + 6,
      2 ** 53 + 8,
    ]);
  });
});

describe("assignGroupColors", () => {
  it("assigns palette colors in first-seen order and dedupes", () => {
    const colors = assignGroupColors(["a", "b", "a"], ["#111", "#222", "#333"]);
    expect(colors.a).toBe("#111");
    expect(colors.b).toBe("#222");
    expect(Object.keys(colors)).toEqual(["a", "b"]);
  });

  it("lets colorBy override per group", () => {
    const colors = assignGroupColors(["a", "b"], ["#111", "#222"], (g) =>
      g === "b" ? "#f00" : undefined,
    );
    expect(colors.b).toBe("#f00");
    expect(colors.a).toBe("#111");
  });

  it("handles groups named after Object.prototype members", () => {
    // Regression: `g in out` was true for "constructor"/"toString" on a plain
    // object, so those groups silently got no color.
    const groups = ["constructor", "toString", "__proto__", "real"];
    const colors = assignGroupColors(groups, ["#111", "#222", "#333", "#444"]);
    expect(colors.constructor).toBe("#111");
    expect(colors.toString).toBe("#222");
    expect(colors["__proto__"]).toBe("#333");
    expect(colors.real).toBe("#444");
    expect(Object.keys(colors).sort()).toEqual(["__proto__", "constructor", "real", "toString"]);
  });
});

describe("distinctGroups", () => {
  it("keeps first-seen order and maps a missing group to ''", () => {
    expect(
      distinctGroups([
        { x: 1, y: 1, group: "b" },
        { x: 2, y: 2 },
        { x: 3, y: 3, group: "b" },
      ]),
    ).toEqual(["b", ""]);
  });
});

describe("computeXyScale", () => {
  it("maps the domain onto the plot rectangle", () => {
    const scale = computeXyScale(
      [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ],
      {
        width: 200,
        height: 100,
        padding: 0,
      },
    );
    expect(scale.left).toBe(0);
    expect(scale.right).toBe(200);
    expect(scale.xOf(scale.xMin)).toBeCloseTo(0);
    expect(scale.xOf(scale.xMax)).toBeCloseTo(200);
    // y is inverted: the domain minimum sits at the bottom.
    expect(scale.yOf(scale.yMin)).toBeCloseTo(100);
    expect(scale.yOf(scale.yMax)).toBeCloseTo(0);
  });
});
