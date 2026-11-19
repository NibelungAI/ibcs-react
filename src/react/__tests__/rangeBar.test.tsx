/** @vitest-environment jsdom */
/**
 * RangeBarChart as rendered: every bar from its low end to its high end on
 * one value scale, its mark a dot at its value, both ends labelled outside the
 * bar and the dot - in rows of their own (`"bars"`), or placed clear of every
 * column, dot and other label (`"columns"`) - at one digit count that keeps
 * the narrowest range's ends apart, in the caller's words. Geometry is read
 * from the server markup.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import { RangeBarChart, defaultTokens, type RangeDatum } from "../../index";
import { estTextW } from "../internal/text";

afterEach(cleanup);

const ssr = (element: ReactElement): HTMLElement =>
  new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html").body;
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));
const AC = defaultTokens.scenario.AC.fill;

interface Box {
  s: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** A <text>'s box as the library estimates it (0.6 em a glyph, one em above the baseline to 2 px below). */
function textBox(t: Element): Box {
  const size = num(t, "font-size");
  const s = [...t.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent)
    .join("");
  const w = estTextW(s, size);
  const x = num(t, "x");
  const anchor = t.getAttribute("text-anchor") ?? "start";
  const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  const y = num(t, "y");
  return { s, left, right: left + w, top: y - size, bottom: y + 2 };
}
const touch = (a: Box, b: Box) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const rectBox = (r: Element, s = "bar"): Box => ({
  s,
  left: num(r, "x"),
  right: num(r, "x") + num(r, "width"),
  top: num(r, "y"),
  bottom: num(r, "y") + num(r, "height"),
});
const dotBox = (c: Element): Box => ({
  s: "dot",
  left: num(c, "cx") - num(c, "r") - 0.75,
  right: num(c, "cx") + num(c, "r") + 0.75,
  top: num(c, "cy") - num(c, "r") - 0.75,
  bottom: num(c, "cy") + num(c, "r") + 0.75,
});

/** The drawn bars (no hit target), dots and value texts of a chart. */
function marks(body: HTMLElement) {
  const svg = body.querySelector("svg")!;
  const bars = [...svg.querySelectorAll("rect")].filter(
    (r) => r.getAttribute("fill") !== "transparent",
  );
  const dots = [...svg.querySelectorAll("circle")];
  const texts = [...svg.querySelectorAll("text")].filter((t) => !t.querySelector("title"));
  return { svg, bars, dots, texts };
}

const variants: RangeDatum[] = [
  { label: "Best set", from: 870.2, to: 952.6, mark: 914.3 },
  { label: "Signet of Embers", from: 952.1, to: 869.9, mark: 914.1 },
  { label: "Equipped", from: 866.5, to: 948.9, mark: 910.8 },
  { label: "Runed Greatsword", from: 862.0, to: 946.4, mark: 906.3 },
];

describe("RangeBarChart: bars on one value scale", () => {
  const body = ssr(<RangeBarChart data={variants} width={600} />);
  const { bars, dots, texts } = marks(body);

  it("draws each bar from its low end to its high end, in the order given", () => {
    // One scale: a bar's ends are linear in its values.
    const lo = (i: number) => num(bars[i]!, "x");
    const hi = (i: number) => num(bars[i]!, "x") + num(bars[i]!, "width");
    const scale = (hi(0) - lo(0)) / (952.6 - 870.2);
    const at = (v: number) => lo(0) + (v - 870.2) * scale;
    expect(lo(1)).toBeCloseTo(at(869.9), 6);
    expect(hi(1)).toBeCloseTo(at(952.1), 6);
    expect(lo(3)).toBeCloseTo(at(862.0), 6);
    expect(hi(2)).toBeCloseTo(at(948.9), 6);
    // The rows top to bottom.
    expect(bars.map((b) => num(b, "y"))).toEqual(
      [...bars.map((b) => num(b, "y"))].sort((a, b) => a - b),
    );
    expect(bars.every((b) => b.getAttribute("fill") === AC)).toBe(true);
  });

  it("marks each value with a hollow dot at its place on the bar", () => {
    const lo = num(bars[0]!, "x");
    const scale = num(bars[0]!, "width") / (952.6 - 870.2);
    variants.forEach((d, i) => {
      expect(num(dots[i]!, "cx")).toBeCloseTo(lo + (d.mark! - 870.2) * scale, 6);
      expect(num(dots[i]!, "cy")).toBeCloseTo(num(bars[i]!, "y") + num(bars[i]!, "height") / 2, 6);
    });
    expect(dots[0]!.getAttribute("fill")).toBe(defaultTokens.color.surface);
    expect(dots[0]!.getAttribute("stroke")).toBe(defaultTokens.color.text);
  });

  it("labels both ends outside the bar, at one digit count for the whole chart", () => {
    // The narrowest range is 82.2 wide: whole numbers, rounded half away from zero.
    expect(texts.map((t) => t.textContent)).toEqual([
      "870",
      "953",
      "870",
      "952",
      "867",
      "949",
      "862",
      "946",
    ]);
  });
});

describe("RangeBarChart: the digits", () => {
  const values = (data: RangeDatum[], format = {}) =>
    marks(ssr(<RangeBarChart data={data} format={format} width={600} />)).texts.map(
      (t) => t.textContent,
    );

  it("writes one decimal past the narrowest range's first significant digit", () => {
    // 82.2 wide: whole numbers; 1.5 wide: one digit; 0.04 wide: three.
    expect(values([{ label: "A", from: 870.2, to: 952.4 }])).toEqual(["870", "952"]);
    expect(
      values([
        { label: "A", from: 902.1, to: 919.5 },
        { label: "B", from: 910.3, to: 911.8 },
      ]),
    ).toEqual(["902.1", "919.5", "910.3", "911.8"]);
    expect(values([{ label: "A", from: 911.03, to: 911.07 }])).toEqual(["911.030", "911.070"]);
  });

  it("never writes a range's two ends alike, however narrow and far from zero", () => {
    for (const [a, b] of [
      [1e6, 1e6 + 0.001],
      [911.2, 911.2 + 1e-9],
      [1.7e12, 1.7e12 + 1],
      [-0.0001, 0.0001],
    ] as const) {
      const [lo, hi] = values([{ label: "A", from: a, to: b }]);
      expect(lo).not.toBe(hi);
    }
  });

  it("writes ranges of no width at the digits that tell their values apart", () => {
    // Two ranges of zero width at 910.84 and 911.26: their four ends once all
    // read "911".
    expect(
      values([
        { label: "A", from: 910.84, to: 910.84 },
        { label: "B", from: 911.26, to: 911.26 },
      ]),
    ).toEqual(["910.84", "910.84", "911.26", "911.26"]);
    expect(
      values(
        [
          { label: "A", from: 1300, to: 1300 },
          { label: "B", from: 1304, to: 1304 },
        ],
        { compact: true },
      ),
    ).toEqual(["1.300K", "1.300K", "1.304K", "1.304K"]);
  });

  it("takes the caller's digits and locale, in full unless compact is asked for", () => {
    expect(values(variants.slice(0, 1), { fractionDigits: 2, locale: "sr-Latn" })).toEqual([
      "870,20",
      "952,60",
    ]);
    expect(values([{ label: "A", from: 1300, to: 1450 }])).toEqual(["1,300", "1,450"]);
    // Compact: at the fewest digits that keep the ends apart.
    expect(values([{ label: "A", from: 1300, to: 1305 }], { compact: true })).toEqual([
      "1.30K",
      "1.31K",
    ]);
  });
});

describe("RangeBarChart: nothing overlaps", () => {
  const widths = [280, 320, 390, 480, 640];
  const heights = [14, 20, 26, 40];
  const sets: Array<[string, RangeDatum[]]> = [
    ["variants", variants],
    [
      "marks outside their ranges",
      [
        { label: "Low mark", from: 10, to: 20, mark: 4 },
        { label: "High mark", from: 10, to: 20, mark: 27 },
        { label: "At an end", from: 10, to: 20, mark: 10 },
      ],
    ],
    [
      "one value",
      [
        { label: "Same", from: 5, to: 5, mark: 5 },
        { label: "Same too", from: 5, to: 5 },
      ],
    ],
  ];
  for (const w of widths) {
    for (const h of heights) {
      for (const [name, data] of sets) {
        it(`bars: ${name}, ${w}px, rows ${h}px`, () => {
          const { svg, bars, dots, texts } = marks(
            ssr(<RangeBarChart data={data} width={w} rowHeight={h} />),
          );
          // The end labels, and the row labels beside them.
          const rowLabels = [...svg.querySelectorAll("text")].filter((t) =>
            t.querySelector("title"),
          );
          const labels = [...texts, ...rowLabels].map(textBox);
          const shapes = [...bars.map((b) => rectBox(b)), ...dots.map(dotBox)];
          for (const l of labels) {
            expect(l.left).toBeGreaterThanOrEqual(0);
            expect(l.right).toBeLessThanOrEqual(w);
            for (const s of shapes) expect(touch(l, s), `"${l.s}" on a ${s.s}`).toBe(false);
            for (const m of labels)
              if (m !== l) expect(touch(l, m), `"${l.s}" on "${m.s}"`).toBe(false);
          }
          expect(rowLabels.length).toBe(data.length);
          // The end labels stay in the lane: the 8 px gap after the label column is kept.
          const column = Math.max(...rowLabels.map((t) => textBox(t).right));
          for (const t of texts) expect(textBox(t).left).toBeGreaterThanOrEqual(column + 8 - 1e-6);
        });
      }
    }
  }

  const waves: RangeDatum[] = [
    { label: "Wave 1", from: 902.1, to: 919.5, mark: 910.8 },
    { label: "Wave 2", from: 905.0, to: 917.2, mark: 911.1 },
    { label: "Wave 3", from: 907.9, to: 914.1, mark: 911.0 },
    { label: "Wave 4", from: 909.5, to: 912.6, mark: 911.05 },
    { label: "Wave 5", from: 910.3, to: 911.8, mark: 911.07 },
  ];
  const many: RangeDatum[] = Array.from({ length: 12 }, (_, i) => ({
    label: `W${i + 1}`,
    from: 911 - 9 / (i + 1) - (i % 2) * 0.3,
    to: 911 + 8 / (i + 1),
    mark: 911,
  }));
  for (const w of [280, 320, 390, 480, 640]) {
    for (const [name, data] of [
      ["five waves", waves],
      ["twelve waves", many],
    ] as const) {
      it(`columns: ${name}, ${w}px: end labels clear of every column, dot and label`, () => {
        const { bars, dots, texts } = marks(
          ssr(<RangeBarChart data={data} orientation="columns" width={w} height={260} />),
        );
        const values = texts.filter(
          (t) => /\d/.test(t.textContent ?? "") && !/^W/.test(t.textContent ?? ""),
        );
        expect(values.length).toBe(data.length * 2);
        const labels = values.map(textBox);
        const shapes = [...bars.map((b) => rectBox(b)), ...dots.map(dotBox)];
        for (const l of labels) {
          expect(l.left).toBeGreaterThanOrEqual(0);
          expect(l.right).toBeLessThanOrEqual(w);
          for (const s of shapes) expect(touch(l, s), `"${l.s}" on a ${s.s}`).toBe(false);
          for (const m of labels)
            if (m !== l) expect(touch(l, m), `"${l.s}" on "${m.s}"`).toBe(false);
        }
      });
    }
  }

  it("columns too narrow for every end label: the first and last columns' ends alone, all in the table", () => {
    const thirty: RangeDatum[] = Array.from({ length: 30 }, (_, i) => ({
      label: `W${i + 1}`,
      from: 911 - 9 / (i + 1),
      to: 911 + 8 / (i + 1),
      mark: 911,
    }));
    const body = ssr(
      <RangeBarChart data={thirty} orientation="columns" width={320} height={260} />,
    );
    const { bars, dots, texts } = marks(body);
    const values = texts.filter((t) => /^\d/.test(t.textContent ?? ""));
    // 911 + 8 and 911 - 9 for the first, 911 + 0.27 and 911 - 0.3 for the last,
    // at two digits: the narrowest range is 0.57 wide.
    expect(values.map((t) => t.textContent)).toEqual(["919.00", "902.00", "911.27", "910.70"]);
    const labels = values.map(textBox);
    const shapes = [...bars.map((b) => rectBox(b)), ...dots.map(dotBox)];
    for (const l of labels) {
      for (const sh of shapes) expect(touch(l, sh)).toBe(false);
      for (const m of labels) if (m !== l) expect(touch(l, m)).toBe(false);
    }
    expect(bars.length).toBe(30);
    expect(body.querySelectorAll("tbody tr").length).toBe(30);
    expect(body.querySelectorAll("tbody tr")[14]!.textContent).toContain("911.53");
  });

  // Crowded columns, where end labels found no place: a narrowing ladder (its
  // first column's labels once started left of the svg), alternating ranges
  // (once written across a neighbour), a level run and a rising one.
  const crowdedShapes: Array<[string, (n: number) => RangeDatum[]]> = [
    [
      "a narrowing ladder",
      (n) =>
        Array.from({ length: n }, (_, i) => ({
          label: `W${i + 1}`,
          from: 911 - 9 / (i + 1),
          to: 911 + 8 / (i + 1),
          mark: 911,
        })),
    ],
    [
      "alternating ranges",
      (n) =>
        Array.from({ length: n }, (_, i) => ({
          label: `A${i + 1}`,
          from: i % 2 ? 905.2 : 898.4,
          to: i % 2 ? 912.6 : 919.9,
          mark: i % 2 ? 908.1 : 909.3,
        })),
    ],
    [
      "a level run",
      (n) => Array.from({ length: n }, (_, i) => ({ label: `L${i + 1}`, from: 900.5, to: 910.5 })),
    ],
    [
      "a rising run",
      (n) =>
        Array.from({ length: n }, (_, i) => ({
          label: `R${i + 1}`,
          from: 880 + i * 1.5,
          to: 890 + i * 1.5,
          mark: 885 + i * 1.5,
        })),
    ],
  ];
  for (const [name, make] of crowdedShapes) {
    for (const n of [20, 30, 40]) {
      it(`columns: ${name}, ${n} columns at 260-560px: no label over a column or past the svg`, () => {
        for (const w of [260, 330, 400, 560]) {
          const { bars, dots, texts } = marks(
            ssr(<RangeBarChart data={make(n)} orientation="columns" width={w} height={260} />),
          );
          const labels = texts.map(textBox);
          // The first and the last column keep both their ends, at least.
          expect(labels.length, `${w}px`).toBeGreaterThanOrEqual(4);
          const shapes = [...bars.map((b) => rectBox(b)), ...dots.map(dotBox)];
          for (const l of labels) {
            expect(l.left, `"${l.s}" at ${w}px`).toBeGreaterThanOrEqual(0);
            expect(l.right, `"${l.s}" at ${w}px`).toBeLessThanOrEqual(w);
            expect(l.top).toBeGreaterThanOrEqual(0);
            expect(l.bottom).toBeLessThanOrEqual(260);
            for (const sh of shapes)
              expect(touch(l, sh), `"${l.s}" on a ${sh.s} at ${w}px`).toBe(false);
            for (const m of labels)
              if (m !== l) expect(touch(l, m), `"${l.s}" on "${m.s}" at ${w}px`).toBe(false);
          }
        }
      });
    }
  }

  it("columns: an end label with no place is left out, never written past the chart's edge", () => {
    // Values wider than a 60 px chart: no place holds them, and right beside
    // their ends they would start left of the svg. The table keeps them.
    const body = ssr(
      <RangeBarChart
        data={[
          { label: "A", from: 1_234_567.891, to: 1_234_569.123 },
          { label: "B", from: 1_234_568.25, to: 1_234_568.75 },
        ]}
        orientation="columns"
        width={60}
        height={160}
      />,
    );
    const { bars, texts } = marks(body);
    expect(bars.length).toBe(2);
    for (const l of texts.map(textBox)) {
      expect(l.left, l.s).toBeGreaterThanOrEqual(0);
      expect(l.right, l.s).toBeLessThanOrEqual(60);
    }
    // At two digits: the narrowest range is 0.5 wide.
    const cells = [...body.querySelectorAll("tbody tr")[0]!.querySelectorAll("td")];
    expect(cells.map((td) => td.textContent)).toEqual(["1,234,567.89", "1,234,569.12"]);
  });

  it("columns: a thousand at 200px label their first and last ends at once, inside the chart", () => {
    // Two thousand labels cannot fit in a chart 200 px wide: the ends alone are
    // tried, at once (2.2 s here when every label was tried first).
    const thousand = crowdedShapes[0]![1](1000);
    const t0 = performance.now();
    const html = renderToStaticMarkup(
      <RangeBarChart data={thousand} orientation="columns" width={200} height={260} />,
    );
    expect(performance.now() - t0).toBeLessThan(1000);
    const { bars, texts } = marks(new DOMParser().parseFromString(html, "text/html").body);
    expect(bars.length).toBe(1000);
    const labels = texts.map(textBox);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(4);
    for (const l of labels) {
      expect(l.left).toBeGreaterThanOrEqual(0);
      expect(l.right).toBeLessThanOrEqual(200);
    }
  });

  it("columns: a label moved away from its end has a leader back to it", () => {
    const body = ssr(<RangeBarChart data={many} orientation="columns" width={280} height={260} />);
    const leaders = [...body.querySelectorAll("svg > line")];
    expect(leaders.length).toBeGreaterThan(0);
    for (const l of leaders) expect(l.getAttribute("stroke")).toBe(defaultTokens.color.textMuted);
  });
});

describe("RangeBarChart: notation, missing values, icons, words", () => {
  it("draws the scenario's notation: PL outlined, FC hatched", () => {
    const pl = marks(ssr(<RangeBarChart data={variants} scenario="PL" />)).bars[0]!;
    expect(pl.getAttribute("fill")).toBe(defaultTokens.color.surface);
    expect(pl.getAttribute("stroke")).toBe(defaultTokens.scenario.PL.stroke);
    const fcBody = ssr(<RangeBarChart data={variants} scenario="FC" />);
    const fc = marks(fcBody).bars[0]!;
    expect(fc.getAttribute("fill")).toMatch(/^url\(#/);
    expect(fcBody.querySelector("pattern")).not.toBeNull();
  });

  it("keeps a category whose ends are missing, written as not available", () => {
    for (const orientation of ["bars", "columns"] as const) {
      const body = ssr(
        <RangeBarChart
          data={[{ label: "Gone", from: NaN, to: 3 }, ...variants]}
          orientation={orientation}
          format={{ notAvailable: "–" }}
        />,
      );
      expect([...body.querySelectorAll("svg text")].some((t) => t.textContent === "–")).toBe(true);
      expect(body.querySelector("tbody td")!.textContent).toBe("–");
      expect(marks(body).bars.length).toBe(variants.length);
    }
  });

  it("draws icons before the labels at the size rule; an alt is read before the label", () => {
    const body = ssr(
      <RangeBarChart
        data={[
          {
            ...variants[0]!,
            icon: { src: "data:image/png;base64,AA==", naturalSize: 56, alt: "Ring" },
          },
          variants[1]!,
        ]}
        width={480}
      />,
    );
    const img = body.querySelector("image")!;
    expect(num(img, "width")).toBe(20);
    expect(body.querySelector("tbody th")!.textContent).toBe("Ring, Best set");
  });

  it("names its columns in the caller's words, with the mark's column only when there are marks", () => {
    const body = ssr(
      <RangeBarChart
        data={variants}
        labels={{ rangeLow: "p10", rangeHigh: "p90", rangeMark: "prosek" }}
      />,
    );
    expect([...body.querySelectorAll("thead th")].map((th) => th.textContent).slice(1)).toEqual([
      "p10",
      "prosek",
      "p90",
    ]);
    const plain = ssr(<RangeBarChart data={[{ label: "A", from: 1, to: 2 }]} />);
    expect([...plain.querySelectorAll("thead th")].map((th) => th.textContent).slice(1)).toEqual([
      "Low",
      "High",
    ]);
  });

  it("opens a tooltip with the ends and the mark, in the chart's words and digits", () => {
    const { container } = render(
      <RangeBarChart data={variants} labels={{ rangeLow: "p10", rangeHigh: "p90" }} />,
    );
    const row = container.querySelector("svg rect[fill='transparent']")!;
    fireEvent.pointerMove(row, { clientX: 10, clientY: 10, pointerType: "mouse" });
    const tip = screen.getByRole("tooltip").textContent!;
    expect(tip).toContain("Best set");
    expect(tip).toContain("p10");
    expect(tip).toContain("870");
    expect(tip).toContain("Mean");
    expect(tip).toContain("914");
  });

  it("describes itself in English unless ariaLabel replaces the sentence", () => {
    expect(
      ssr(<RangeBarChart data={variants} />)
        .querySelector("svg")!
        .getAttribute("aria-label"),
    ).toBe("Ranges of 4 categories");
    expect(
      ssr(<RangeBarChart data={variants} ariaLabel="Raspon" />).querySelector("caption")!
        .textContent,
    ).toBe("Raspon");
  });
});
