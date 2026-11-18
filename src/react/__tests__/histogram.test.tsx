/** @vitest-environment jsdom */
/**
 * HistogramChart as rendered: classes of one width from the axis, the mean's
 * interval and the spread of the values drawn apart, labels in rows of their
 * own (none overlapping another), the caller's words and number format, and
 * a screen-reader table whose counts sum to n. Geometry is read from the
 * server markup - the finished frame.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  HistogramChart,
  computeHistogram,
  defaultTokens,
  type HistogramChartProps,
} from "../../index";
import { estTextW } from "../internal/text";

afterEach(cleanup);

const NB = " ";
const AC = defaultTokens.scenario.AC.fill;

/** A deterministic, roughly normal sample (Irwin-Hall over an LCG). */
function sample(n: number, mean: number, sd: number, seed = 3): number[] {
  let s = seed;
  const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: n }, () => mean + sd * (u() + u() + u() + u() - 2) * Math.sqrt(3));
}

const ssr = (element: ReactElement): HTMLElement =>
  new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html").body;
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

/** The chart's parts, read back from its markup. */
function parts(body: HTMLElement) {
  const svg = body.querySelector("svg")!;
  const axis = [...svg.querySelectorAll("line")].find(
    (l) => l.getAttribute("stroke") === defaultTokens.color.axis,
  )!;
  const columns = [...svg.querySelectorAll(":scope > rect")].filter(
    (r) => r.getAttribute("fill") !== "transparent" && !r.hasAttribute("opacity"),
  );
  const band = svg.querySelector(":scope > rect[opacity]");
  const texts = [...svg.querySelectorAll(":scope > text")];
  const text = (s: string) => texts.find((t) => t.textContent === s);
  return {
    svg,
    x0: num(axis, "x1"),
    x1: num(axis, "x2"),
    baseline: num(axis, "y1"),
    columns,
    band,
    texts,
    text,
    errorBar: svg.querySelector("g[role='img']"),
    bracket: svg.querySelector(":scope > path"),
  };
}

/** The value → pixel scale of bins from `start`, `k` classes of `width`, on [x0, x1]. */
const scaleOf = (x0: number, x1: number, start: number, width: number, k: number) => (v: number) =>
  x0 + ((v - start) / (width * k)) * (x1 - x0);

/**
 * Every <text>'s box, estimated as the library lays text out (0.6 em per
 * glyph; a line from one em above the baseline to 2px below it).
 */
function textBoxes(svg: Element) {
  return [...svg.querySelectorAll(":scope > text")].map((t) => {
    const size = num(t, "font-size");
    const w = estTextW(t.textContent ?? "", size);
    const x = num(t, "x");
    const anchor = t.getAttribute("text-anchor") ?? "start";
    const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    const y = num(t, "y");
    return { s: t.textContent ?? "", left, right: left + w, top: y - size, bottom: y + 2 };
  });
}

const overlap = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe("HistogramChart - classes of one width (IBCS CH 1.3)", () => {
  it("draws one column per non-empty class, side by side, one width, from the axis", () => {
    const p = parts(
      ssr(<HistogramChart bins={{ start: 0, width: 10, counts: [1, 3, 0, 6] }} width={400} />),
    );
    expect(p.x0).toBe(12);
    expect(p.x1).toBe(388);
    const colW = (388 - 12) / 4;
    expect(p.columns).toHaveLength(3);
    expect(p.columns.map((c) => num(c, "x"))).toEqual([12.5, 12 + colW + 0.5, 12 + 3 * colW + 0.5]);
    for (const c of p.columns) {
      expect(num(c, "width")).toBe(colW - 1);
      expect(c.getAttribute("fill")).toBe(AC);
      expect(num(c, "y") + num(c, "height")).toBeCloseTo(p.baseline, 9);
    }
    // Heights in proportion to the counts 1 : 3 : 6.
    const h = p.columns.map((c) => num(c, "height"));
    expect(h[1]! / h[0]!).toBeCloseTo(3, 9);
    expect(h[2]! / h[0]!).toBeCloseTo(6, 9);
  });

  it("bins raw values with computeHistogram: the same classes and counts", () => {
    const values = sample(3000, 500, 40);
    const h = computeHistogram(values);
    const { container } = render(<HistogramChart values={values} tooltip={false} />);
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(h.counts.length);
    expect(rows.map((r) => Number(r.querySelector("td")!.textContent!.replace(/,/g, "")))).toEqual(
      h.counts,
    );
  });

  it("states n, and lists every class in its table with counts that sum to n", () => {
    const values = sample(1234, 50, 5);
    const { container } = render(<HistogramChart values={values} tooltip={false} />);
    expect(container.querySelector("svg")!.textContent).toContain("n = 1,234");
    const headers = [...container.querySelectorAll("thead th")].map((t) => t.textContent);
    expect(headers).toEqual(["", "Count", "Share"]);
    const counts = [...container.querySelectorAll("tbody tr")].map((r) =>
      Number(r.querySelector("td")!.textContent!.replace(/,/g, "")),
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1234);
    // Each row is named by its class's range.
    expect(container.querySelector("tbody th")!.textContent).toMatch(/^\d+–\d+$/);
  });

  it("labels every count when all fit their columns, else the tallest alone", () => {
    const few = parts(
      ssr(<HistogramChart bins={{ start: 0, width: 1, counts: [12, 40, 33, 7] }} />),
    );
    expect(["12", "40", "33", "7"].every((s) => few.text(s))).toBe(true);
    const counts = Array.from({ length: 50 }, (_, i) => 100 + i * (50 - i));
    const many = parts(ssr(<HistogramChart bins={{ start: 0, width: 1, counts }} width={400} />));
    const max = Math.max(...counts);
    // Count labels are the 9.5px texts (the axis's edge labels are numbers too).
    const countTexts = many.texts.filter((t) => t.getAttribute("font-size") === "9.5");
    expect(countTexts.map((t) => t.textContent)).toEqual([max.toLocaleString("en-US")]);
    expect(few.texts.filter((t) => t.getAttribute("font-size") === "9.5")).toHaveLength(4);
  });

  it("writes its numbers in the caller's format: exact digits, the locale's separators, whole counts", () => {
    const p = parts(
      ssr(
        <HistogramChart
          bins={{ start: 1000, width: 12.5, counts: [1200, 3400, 900] }}
          format={{ compact: false, locale: "sr-Latn", fractionDigits: 2 }}
        />,
      ),
    );
    expect(p.text("1.000,00")).toBeTruthy();
    expect(p.text("1.037,50")).toBeTruthy();
    expect(p.text("3.400")).toBeTruthy();
    expect(p.text("n = 5.500")).toBeTruthy();
  });
});

describe("HistogramChart - the mean's interval and the spread of the values, never confused", () => {
  const bins = { start: 0, width: 5, counts: [2, 8, 20, 30, 22, 12, 6] };
  const scale = scaleOf(12, 548, 0, 5, 7);
  const element = (props: Partial<HistogramChartProps> = {}) => (
    <HistogramChart
      bins={bins}
      mean={{ value: 17.3, halfWidth: 0.42, level: 0.95 }}
      spread={{ from: 12.5, to: 22.75 }}
      format={{ compact: false, fractionDigits: 2 }}
      {...props}
    />
  );

  it("draws the mean as a line with an error bar on the axis's scale, labelled with the interval and its level", () => {
    const p = parts(ssr(element()));
    expect(p.text(`Mean 17.30${NB}±${NB}0.42 (95%)`)).toBeTruthy();
    const ink = [...p.errorBar!.querySelectorAll("line")].filter(
      (l) => l.getAttribute("stroke") === defaultTokens.color.text,
    );
    const whisker = ink[0]!;
    expect(num(whisker, "x1")).toBeCloseTo(scale(17.3 - 0.42), 9);
    expect(num(whisker, "x2")).toBeCloseTo(scale(17.3 + 0.42), 9);
    expect(p.errorBar!.getAttribute("aria-label")).toBe(`17.30${NB}±${NB}0.42`);
    // The line from the error bar down to the axis, at the mean.
    const meanLines = [...p.svg.querySelectorAll(":scope > g:not([role]) > line")].filter(
      (l) => l.getAttribute("stroke") === defaultTokens.color.text,
    );
    expect(meanLines.length).toBeGreaterThan(0);
    for (const l of meanLines) expect(num(l, "x1")).toBeCloseTo(scale(17.3), 9);
    expect(Math.max(...meanLines.map((l) => num(l, "y2")))).toBe(p.baseline);
    expect(Math.min(...meanLines.map((l) => num(l, "y1")))).toBe(num(whisker, "y1"));
  });

  it("draws the spread as a band behind the columns, bracketed and captioned under the axis", () => {
    const p = parts(ssr(element()));
    expect(num(p.band!, "x")).toBeCloseTo(scale(12.5), 9);
    expect(num(p.band!, "width")).toBeCloseTo(scale(22.75) - scale(12.5), 9);
    expect(num(p.band!, "y") + num(p.band!, "height")).toBe(p.baseline);
    // Behind: the band comes before the first column in the markup.
    const all = [...p.svg.children];
    expect(all.indexOf(p.band!)).toBeLessThan(all.indexOf(p.columns[0]!));
    const d = p.bracket!.getAttribute("d")!;
    const [, a, b] = /^M([\d.]+),[\d.]+V[\d.]+H([\d.]+)/.exec(d)!;
    expect(Number(a)).toBeCloseTo(scale(12.5), 9);
    expect(Number(b)).toBeCloseTo(scale(22.75), 9);
    expect(p.text("Middle half 12.50–22.75")).toBeTruthy();
  });

  it("keeps the two apart: the mean above the columns, the spread under the axis, in other marks and words", () => {
    const p = parts(ssr(element()));
    const meanLabel = p.text(`Mean 17.30${NB}±${NB}0.42 (95%)`)!;
    const spreadLabel = p.text("Middle half 12.50–22.75")!;
    const plotTop = Math.min(...p.columns.map((c) => num(c, "y")));
    expect(num(meanLabel, "y")).toBeLessThan(plotTop);
    expect(num(p.errorBar!.querySelector("line")!, "y1")).toBeLessThan(plotTop);
    expect(num(spreadLabel, "y")).toBeGreaterThan(p.baseline);
    // An error bar (a whisker with caps) for the estimate; a filled band for the values.
    expect(p.errorBar!.querySelectorAll("line").length).toBe(6);
    expect(p.band!.tagName.toLowerCase()).toBe("rect");
  });

  it("names the middle half of the values by default, and none with spread={false}", () => {
    const values = sample(2000, 100, 10);
    const h = computeHistogram(values);
    const p = parts(
      ssr(<HistogramChart values={values} format={{ compact: false, fractionDigits: 1 }} />),
    );
    const s = scaleOf(p.x0, p.x1, h.start, h.width, h.counts.length);
    expect(num(p.band!, "x")).toBeCloseTo(s(h.q1), 9);
    expect(num(p.band!, "width")).toBeCloseTo(s(h.q3) - s(h.q1), 9);
    expect(p.text(`Middle half ${h.q1.toFixed(1)}–${h.q3.toFixed(1)}`)).toBeTruthy();
    const none = parts(ssr(<HistogramChart values={values} spread={false} />));
    expect(none.band).toBeNull();
    expect(none.bracket).toBeNull();
    // Caller bins have no values to take quartiles from: no spread unless given.
    expect(parts(ssr(<HistogramChart bins={bins} />)).band).toBeNull();
  });

  it("writes a level only with a half-width, in the fewest digits that hold it", () => {
    const label = (mean: HistogramChartProps["mean"]) =>
      parts(ssr(element({ mean }))).texts.find((t) => t.textContent!.startsWith("Mean"))!
        .textContent;
    expect(label({ value: 17.3, halfWidth: 0.42, level: 0.995 })).toBe(
      `Mean 17.30${NB}±${NB}0.42 (99.5%)`,
    );
    expect(label({ value: 17.3, halfWidth: 0.42, level: 0.9 })).toBe(
      `Mean 17.30${NB}±${NB}0.42 (90%)`,
    );
    expect(label({ value: 17.3, halfWidth: 0.42 })).toBe(`Mean 17.30${NB}±${NB}0.42`);
    expect(label({ value: 17.3, level: 0.95 })).toBe("Mean 17.30");
    expect(label({ value: 17.3, halfWidth: 0.42, level: 1.5 })).toBe(`Mean 17.30${NB}±${NB}0.42`);
  });

  it("draws no mean and no spread from numbers that are not finite", () => {
    const p = parts(
      ssr(
        element({
          mean: { value: Number.NaN, halfWidth: 1 },
          spread: { from: 1, to: Number.POSITIVE_INFINITY },
        }),
      ),
    );
    expect(p.texts.some((t) => t.textContent!.startsWith("Mean"))).toBe(false);
    expect(p.errorBar).toBeNull();
    expect(p.band).toBeNull();
    expect(p.bracket).toBeNull();
  });

  it("draws a mean off the axis as its label alone, with no line or error bar", () => {
    const p = parts(ssr(element({ mean: { value: 99, halfWidth: 1 } })));
    expect(p.text(`Mean 99.00${NB}±${NB}1.00`)).toBeTruthy();
    expect(p.errorBar).toBeNull();
    expect(p.svg.querySelector(":scope > g:not([role]) > line")).toBeNull();
  });
});

describe("HistogramChart - labels instead of grid lines, none overlapping another", () => {
  const values = sample(6000, 910.8, 30, 7);
  const configs: Array<[string, Partial<HistogramChartProps>]> = [
    ["bare", {}],
    ["titled", { title: "DPS of 6,000 fights - a long message title that must be cut to fit" }],
    ["mean", { mean: { value: 911.2, halfWidth: 0.76, level: 0.95 } }],
    [
      "everything",
      {
        title: "DPS per fight",
        mean: { value: 911.2, halfWidth: 0.76, level: 0.95 },
        format: { compact: false, locale: "sr-Latn", fractionDigits: 2 },
      },
    ],
  ];
  it("the overlap check itself sees an overlap (it is not vacuous)", () => {
    const box = { left: 0, right: 10, top: 0, bottom: 10 };
    expect(overlap(box, { left: 9, right: 20, top: 9, bottom: 20 })).toBe(true);
    expect(overlap(box, { left: 10, right: 20, top: 0, bottom: 10 })).toBe(false);
    // At 120px the two edge labels cannot both fit: the last edge is left out.
    const svg = ssr(
      <HistogramChart values={values} width={120} format={{ compact: false, fractionDigits: 2 }} />,
    ).querySelector("svg")!;
    const h = computeHistogram(values);
    const edges = [...svg.querySelectorAll(":scope > text[font-size='10.5']")]
      .map((t) => t.textContent)
      .filter((s) => !s!.startsWith("n ="));
    expect(edges).toEqual([h.start.toFixed(2)]);
    // At 240px both fit.
    const wide = ssr(
      <HistogramChart values={values} width={240} format={{ compact: false, fractionDigits: 2 }} />,
    ).querySelector("svg")!;
    expect(
      [...wide.querySelectorAll(":scope > text[font-size='10.5']")].filter(
        (t) => !t.textContent!.startsWith("n ="),
      ),
    ).toHaveLength(2);
  });

  for (const width of [120, 240, 320, 480, 560, 800]) {
    for (const binning of [{ bins: 6 }, { bins: 12 }, {}]) {
      for (const [name, props] of configs) {
        it(`${name} at ${width}px with ${binning.bins ?? "the rule's"} classes`, () => {
          const svg = ssr(
            <HistogramChart values={values} binning={binning} width={width} {...props} />,
          ).querySelector("svg")!;
          const boxes = textBoxes(svg);
          for (const [i, a] of boxes.entries()) {
            // Inside the chart.
            expect(a.left).toBeGreaterThanOrEqual(0);
            expect(a.right).toBeLessThanOrEqual(width);
            for (const b of boxes.slice(i + 1)) {
              expect(overlap(a, b), `"${a.s}" overlaps "${b.s}"`).toBe(false);
            }
          }
          // The mean's line never crosses a label.
          for (const l of svg.querySelectorAll(":scope > g:not([role]) > line")) {
            const x = num(l, "x1");
            const seg = { left: x - 1.5, right: x + 1.5, top: num(l, "y1"), bottom: num(l, "y2") };
            for (const b of boxes)
              expect(overlap(seg, b), `the mean's line crosses "${b.s}"`).toBe(false);
          }
        });
      }
    }
  }

  it("draws no grid line: the only line across the plot is the axis", () => {
    const svg = ssr(
      <HistogramChart values={values} mean={{ value: 911.2, halfWidth: 0.76 }} width={560} />,
    ).querySelector("svg")!;
    const horizontal = [...svg.querySelectorAll("line")].filter(
      (l) => l.getAttribute("y1") === l.getAttribute("y2") && num(l, "x2") - num(l, "x1") > 20,
    );
    expect(horizontal).toHaveLength(1);
    expect(horizontal[0]!.getAttribute("stroke")).toBe(defaultTokens.color.axis);
  });
});

describe("HistogramChart - IBCS notation, words and edge cases", () => {
  const bins = { start: 0, width: 1, counts: [3, 5, 2] };

  it("wears its scenario's notation: AC solid, PY grey, PL outlined, FC hatched", () => {
    const fill = (scenario: HistogramChartProps["scenario"]) =>
      parts(ssr(<HistogramChart bins={bins} scenario={scenario} />)).columns[0]!;
    expect(fill("AC").getAttribute("fill")).toBe(defaultTokens.scenario.AC.fill);
    expect(fill("AC").getAttribute("stroke")).toBeNull();
    expect(fill("PY").getAttribute("fill")).toBe(defaultTokens.scenario.PY.fill);
    expect(fill("PL").getAttribute("fill")).toBe(defaultTokens.color.surface);
    expect(fill("PL").getAttribute("stroke")).toBe(defaultTokens.scenario.PL.stroke);
    const fc = ssr(<HistogramChart bins={bins} scenario="FC" />);
    const pattern = fc.querySelector("pattern")!;
    expect(parts(fc).columns[0]!.getAttribute("fill")).toBe(`url(#${pattern.id})`);
  });

  it("writes every word from the caller's labels", () => {
    const { container } = render(
      <HistogramChart
        bins={{ start: 10, width: 2, counts: [4, 6] }}
        mean={{ value: 11.5, halfWidth: 0.25, level: 0.95 }}
        spread={{ from: 11, to: 12.5 }}
        format={{ compact: false, locale: "sr-Latn", fractionDigits: 1 }}
        labels={{
          mean: "prosek {value}",
          spread: "srednja polovina {range}",
          sampleSize: "{n} borbi",
          count: "Borbi",
          share: "Udeo",
        }}
        tooltip={false}
      />,
    );
    const svgText = container.querySelector("svg")!.textContent!;
    expect(svgText).toContain(`prosek 11,5${NB}±${NB}0,3 (95%)`);
    expect(svgText).toContain("srednja polovina 11,0–12,5");
    expect(svgText).toContain("10 borbi");
    expect([...container.querySelectorAll("thead th")].map((t) => t.textContent)).toEqual([
      "",
      "Borbi",
      "Udeo",
    ]);
    expect(container.querySelector("tbody td:last-child")!.textContent).toBe("40,0%");
    expect(container.querySelector("caption")!.textContent).toBe(
      `Histogram - data table. prosek 11,5${NB}±${NB}0,3 (95%). srednja polovina 11,0–12,5. 10 borbi`,
    );
  });

  it("names itself, and takes ariaLabel for its name and table caption", () => {
    const own = ssr(<HistogramChart bins={bins} title="DPS" />);
    expect(own.querySelector("svg")!.getAttribute("role")).toBe("img");
    expect(own.querySelector("svg")!.getAttribute("aria-label")).toBe(
      "DPS. Histogram of 10 values in 3 bins.",
    );
    const named = ssr(<HistogramChart bins={bins} ariaLabel="Raspodela DPS-a" />);
    expect(named.querySelector("svg")!.getAttribute("aria-label")).toBe("Raspodela DPS-a");
    expect(named.querySelector("caption")!.textContent).toBe("Raspodela DPS-a. n = 10");
  });

  it("shows a class's range, count and share in its tooltip", () => {
    render(
      <HistogramChart
        bins={{ start: 0, width: 10, counts: [3, 1] }}
        format={{ compact: false, fractionDigits: 1 }}
      />,
    );
    const hit = document.querySelectorAll("svg rect[fill='transparent']");
    expect(hit).toHaveLength(2);
    fireEvent.pointerMove(hit[0]!, { clientX: 10, clientY: 10, pointerType: "mouse" });
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("0.0–10.0");
    expect(tip.textContent).toContain("Count3");
    expect(tip.textContent).toContain("Share75.0%");
  });

  it("draws nothing to count for no values, and one class at the centre for equal values", () => {
    const empty = parts(ssr(<HistogramChart values={[]} />));
    expect(empty.columns).toHaveLength(0);
    expect(empty.text("n = 0")).toBeTruthy();
    const equal = parts(ssr(<HistogramChart values={[5, 5, 5, 5]} width={400} />));
    expect(equal.columns).toHaveLength(1);
    expect(num(equal.columns[0]!, "x") + num(equal.columns[0]!, "width") / 2).toBe(200);
    expect(num(equal.columns[0]!, "width")).toBe(23);
    // Its count above it, its one value under it, and a spread of one point.
    expect(equal.text("4")).toBeTruthy();
    expect(equal.texts.filter((t) => t.textContent === "5")).toHaveLength(1);
    expect(equal.text("Middle half 5")).toBeTruthy();
  });

  it("counts a negative or non-finite count in caller bins as 0", () => {
    const { container } = render(
      <HistogramChart
        bins={{ start: 0, width: 1, counts: [2, -3, Number.NaN, 4] }}
        tooltip={false}
      />,
    );
    const counts = [...container.querySelectorAll("tbody tr td:first-of-type")].map(
      (t) => t.textContent,
    );
    expect(counts).toEqual(["2", "0", "0", "4"]);
    expect(container.querySelector("svg")!.textContent).toContain("n = 6");
  });

  it("grows a height too short for its rows to what they need", () => {
    const svg = ssr(
      <HistogramChart
        bins={bins}
        title="t"
        mean={{ value: 1.5, halfWidth: 0.1 }}
        spread={{ from: 1, to: 2 }}
        height={100}
      />,
    ).querySelector("svg")!;
    // Title 26 + mean 30 + counts 14 + least plot 40 + edges 16 + spread 24 + 4.
    expect(num(svg, "height")).toBe(154);
    const tall = ssr(<HistogramChart bins={bins} height={300} />).querySelector("svg")!;
    expect(num(tall, "height")).toBe(300);
  });
});
