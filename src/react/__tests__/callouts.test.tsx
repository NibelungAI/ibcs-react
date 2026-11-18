/** @vitest-environment jsdom */
/**
 * Point callouts on LineChart and TrendChart, and LineChart's fans, as
 * rendered: every callout's label beside its point and clear of every line,
 * marker, label and leader - or, with no room, numbered at its point and
 * written under the chart, so none is left out; the plot's room for them; the
 * fans' edges on the lines' scale, broken at gaps, captioned and tied to the
 * edge they name; and the screen-reader table's columns for both. Geometry is
 * read from the server markup.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  LineChart,
  TrendChart,
  defaultTokens,
  type FanBand,
  type LineDatum,
  type PointCallout,
} from "../../index";
import { segmentHitsBox } from "../../core/labelPlacement";
import { estTextW } from "../internal/text";

afterEach(cleanup);

const ssr = (element: ReactElement): HTMLElement =>
  new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html").body;
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));
const T = defaultTokens;

interface Box {
  s: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}
const touch = (a: Box, b: Box, m = 0) =>
  a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;

/** LineChart's text width: 0.62 em a Latin glyph (its own estimate). */
const lineTextW = (s: string, size: number) => [...s].length * size * 0.62;

/** A text's box at its font size: from 0.75 em above the baseline to 0.25 em below. */
function textBox(t: Element, measure: (s: string, size: number) => number): Box {
  const size = num(t, "font-size");
  const s = t.textContent ?? "";
  const w = measure(s, size);
  const x = num(t, "x");
  const anchor = t.getAttribute("text-anchor") ?? "start";
  const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  const y = num(t, "y");
  return { s, left, right: left + w, top: y - size * 0.75, bottom: y + size * 0.25 };
}

/** Every straight piece of every path's "M x,y L x,y …" (a gap starts a new piece). */
function pathSegments(svg: Element, pick: (p: Element) => boolean) {
  const out: Array<{ x1: number; y1: number; x2: number; y2: number; w: number }> = [];
  for (const p of svg.querySelectorAll("path")) {
    if (!pick(p)) continue;
    const w = num(p, "stroke-width") || 1;
    let prev: [number, number] | null = null;
    for (const m of p.getAttribute("d")!.matchAll(/([ML])([\d.-]+),([\d.-]+)/g)) {
      const pt: [number, number] = [Number(m[2]), Number(m[3])];
      if (m[1] === "L" && prev) out.push({ x1: prev[0], y1: prev[1], x2: pt[0], y2: pt[1], w });
      prev = pt;
    }
  }
  return out;
}

/** The callouts as drawn: each label's lines (one box for all), its dot, and the leaders. */
function callouts(svg: Element) {
  // The callout labels' lines are 10 px, centred; nothing else LineChart or
  // TrendChart writes is both.
  const groups = new Map<Element, Element[]>();
  for (const t of svg.querySelectorAll("text")) {
    if (t.getAttribute("font-size") !== "10" || t.getAttribute("text-anchor") !== "middle")
      continue;
    const g = t.parentElement!;
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  const labels = [...groups.values()].map((ts) => {
    const boxes = ts.map((t) => {
      const w = Math.max(lineTextW(t.textContent ?? "", 10), estTextW(t.textContent ?? "", 10));
      const x = num(t, "x");
      const y = num(t, "y");
      return { left: x - w / 2, right: x + w / 2, top: y - 9, bottom: y + 3 };
    });
    return {
      s: ts.map((t) => t.textContent).join(" / "),
      left: Math.min(...boxes.map((b) => b.left)),
      right: Math.max(...boxes.map((b) => b.right)),
      top: Math.min(...boxes.map((b) => b.top)),
      bottom: Math.max(...boxes.map((b) => b.bottom)),
    };
  });
  const dots = [...svg.querySelectorAll("circle")].filter((c) => c.getAttribute("r") === "3.5");
  const leaders = [...svg.querySelectorAll("line")].filter(
    (l) =>
      l.getAttribute("stroke-width") === "0.75" && l.getAttribute("stroke") === T.color.textMuted,
  );
  const discs = [...svg.querySelectorAll("circle")].filter(
    (c) => c.getAttribute("fill") === T.color.text && Number(c.getAttribute("r")) >= 6.5,
  );
  return { labels, dots, leaders, discs };
}

/** A row of runs: a slow climb with steps at gear changes. */
const runs = [
  884.1, 886.0, 885.2, 887.9, 899.8, 901.2, 900.4, 903.0, 902.1, 904.6, 905.0, 914.9, 916.2, 915.0,
  917.7, 918.3, 919.4, 921.1, 931.2, 930.4,
];
const runData: LineDatum[] = runs.map((v, i) => ({ category: `${i + 1}`, AC: v }));
/** A wave: peaks and troughs, both signs, a PY line beside it. */
const wave: LineDatum[] = Array.from({ length: 30 }, (_, i) => ({
  category: `P${i + 1}`,
  AC: Math.round(Math.sin(i / 3) * 400) / 10,
  PY: Math.round(Math.cos(i / 4) * 300) / 10,
}));

describe("LineChart callouts: beside their points", () => {
  const data: LineDatum[] = [10, 20, 30, 45, 30, 20, 12, 5, 12, 20].map((v, i) => ({
    category: `${i}`,
    AC: v,
  }));
  const body = ssr(
    <LineChart
      data={data}
      width={600}
      height={300}
      callouts={[
        { index: 3, label: "Peak" },
        { index: 7, label: "Trough" },
      ]}
    />,
  );
  const svg = body.querySelector("svg")!;
  const { labels, dots, leaders } = callouts(svg);
  const line = pathSegments(svg, (p) => p.getAttribute("stroke") === T.scenario.AC.stroke)[0]!;

  it("marks each point with a dot on the line", () => {
    expect(dots.length).toBe(2);
    const ac = svg.querySelector(`path[stroke='${T.scenario.AC.stroke}']`)!.getAttribute("d")!;
    const pts = [...ac.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(num(dots[0]!, "cx")).toBeCloseTo(pts[3]![0]!, 0);
    expect(num(dots[0]!, "cy")).toBeCloseTo(pts[3]![1]!, 0);
    expect(num(dots[1]!, "cy")).toBeCloseTo(pts[7]![1]!, 0);
    expect(line).toBeDefined();
  });

  it("writes a peak's label above it and a trough's below it, right beside, with no leader", () => {
    const peak = labels.find((l) => l.s === "Peak")!;
    const trough = labels.find((l) => l.s === "Trough")!;
    expect(peak.bottom).toBeLessThan(num(dots[0]!, "cy"));
    expect(trough.top).toBeGreaterThan(num(dots[1]!, "cy"));
    expect(num(dots[0]!, "cy") - peak.bottom).toBeLessThan(14);
    expect(leaders.length).toBe(0);
  });

  it("keeps room above the highest point for its label, and none without callouts", () => {
    const top = (b: HTMLElement) =>
      Math.min(
        ...[
          ...b
            .querySelector(`path[stroke='${T.scenario.AC.stroke}']`)!
            .getAttribute("d")!
            .matchAll(/,([\d.-]+)/g),
        ].map((m) => Number(m[1])),
      );
    const plain = ssr(<LineChart data={data} width={600} height={300} />);
    expect(top(body)).toBeGreaterThan(top(plain) + 12);
    expect(labels.find((l) => l.s === "Peak")!.top).toBeGreaterThanOrEqual(16);
  });

  it("carries each callout's text in its period's row of the table, under the word for notes", () => {
    const named = ssr(
      <LineChart
        data={data}
        callouts={[
          { index: 3, label: "Peak\n45" },
          { index: 3, label: "Again" },
        ]}
        labels={{ note: "Napomena" }}
      />,
    );
    const heads = [...named.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads[heads.length - 1]).toBe("Napomena");
    const row3 = [...named.querySelectorAll("tbody tr")][3]!;
    expect(row3.lastElementChild!.textContent).toBe("Peak, 45; Again");
    expect([...named.querySelectorAll("tbody tr")][0]!.lastElementChild!.textContent).toBe("");
  });

  it("draws no callout on a period without a value for its series, nor an empty one", () => {
    const b = ssr(
      <LineChart
        data={[{ category: "a", AC: 1 }, { category: "b" }, { category: "c", AC: 3, PY: 2 }]}
        callouts={[
          { index: 1, label: "missing value" },
          { index: 9, label: "no such period" },
          { index: 0, label: "  " },
          { index: 2, series: "PL", label: "no such series" },
          { index: 2, series: "PY", label: "on PY" },
        ]}
      />,
    );
    const c = callouts(b.querySelector("svg")!);
    expect(c.labels.map((l) => l.s)).toEqual(["on PY"]);
    expect(c.dots[0]!.getAttribute("fill")).toBe(T.color.neutral);
  });
});

describe("LineChart callouts: nothing touches them, and none is left out", () => {
  const datasets: Array<[string, LineDatum[]]> = [
    ["runs", runData],
    ["a wave with PY", wave],
  ];
  const sets: Array<[string, (n: number) => PointCallout[]]> = [
    ["one", (n) => [{ index: Math.floor(n / 2), label: "Midway\n921.1" }]],
    [
      "four",
      (n) => [
        { index: 1, label: "Early" },
        { index: Math.floor(n / 3), label: "A third of the way\nwith a second line" },
        { index: Math.floor((2 * n) / 3), label: "Two thirds" },
        { index: n - 1, label: "The last point\nends here" },
      ],
    ],
    [
      "eight crowded",
      (n) =>
        Array.from({ length: 8 }, (_, k) => ({
          index: Math.min(n - 1, 4 + k),
          label: k % 2 ? `Callout ${k}\nsecond line` : `Callout ${k}`,
          series: k === 3 ? ("PY" as const) : undefined,
        })),
    ],
  ];
  for (const w of [240, 320, 390, 480, 640, 900]) {
    for (const h of [200, 260, 360]) {
      for (const [dn, data] of datasets) {
        for (const [cn, make] of sets) {
          it(`${dn}, ${cn}, ${w}x${h}`, () => {
            const given = make(data.length);
            const body = ssr(
              <LineChart
                data={data}
                width={w}
                height={h}
                callouts={given}
                references={[{ axis: "y", value: data[0]!.AC! + 5, label: "target" }]}
                format={{ compact: false, fractionDigits: 1 }}
              />,
            );
            const svg = body.querySelector("svg")!;
            const { labels, dots, leaders, discs } = callouts(svg);
            const segments = pathSegments(svg, (p) => p.getAttribute("fill") === "none");
            const others: Box[] = [
              ...[...svg.querySelectorAll("text")]
                .filter(
                  (t) =>
                    t.getAttribute("font-size") !== "10" ||
                    t.getAttribute("text-anchor") !== "middle",
                )
                .filter((t) => num(t, "y") <= h)
                .map((t) => textBox(t, lineTextW)),
              ...[...svg.querySelectorAll("circle")].map((c) => ({
                s: "a marker",
                left: num(c, "cx") - num(c, "r"),
                right: num(c, "cx") + num(c, "r"),
                top: num(c, "cy") - num(c, "r"),
                bottom: num(c, "cy") + num(c, "r"),
              })),
            ];
            const refLines = [...svg.querySelectorAll("line[stroke-dasharray]")];
            for (const l of labels) {
              expect(l.left).toBeGreaterThanOrEqual(0);
              expect(l.right).toBeLessThanOrEqual(w);
              for (const o of others) expect(touch(l, o), `"${l.s}" on ${o.s}`).toBe(false);
              for (const m of labels)
                if (m !== l) expect(touch(l, m), `"${l.s}" on "${m.s}"`).toBe(false);
              for (const s of segments) {
                const grow = s.w / 2;
                expect(
                  segmentHitsBox(s.x1, s.y1, s.x2, s.y2, {
                    left: l.left - grow,
                    top: l.top - grow,
                    right: l.right + grow,
                    bottom: l.bottom + grow,
                  }),
                  `a line through "${l.s}"`,
                ).toBe(false);
              }
              for (const r of refLines) {
                expect(
                  segmentHitsBox(num(r, "x1"), num(r, "y1"), num(r, "x2"), num(r, "y2"), l),
                  `the reference line through "${l.s}"`,
                ).toBe(false);
              }
              for (const ld of leaders) {
                // A leader touches only its own label's edge.
                const inner = {
                  left: l.left + 0.5,
                  right: l.right - 0.5,
                  top: l.top + 0.5,
                  bottom: l.bottom - 0.5,
                };
                expect(
                  segmentHitsBox(num(ld, "x1"), num(ld, "y1"), num(ld, "x2"), num(ld, "y2"), inner),
                ).toBe(false);
              }
            }
            // Every callout with a point is on the chart: as a label, or numbered under it.
            const drawable = given.filter((c) => data[c.index]?.[c.series ?? "AC"] != null).length;
            const noteNumbers = [...svg.querySelectorAll("circle")].filter(
              (c) => c.getAttribute("fill") === T.color.text && num(c, "cy") > h,
            );
            expect(dots.length).toBe(drawable);
            expect(labels.length + noteNumbers.length).toBe(drawable);
            expect(discs.filter((c) => num(c, "cy") <= h).length).toBeLessThanOrEqual(
              noteNumbers.length,
            );
            if (noteNumbers.length > 0) expect(num(svg, "height")).toBeGreaterThan(h);
          });
        }
      }
    }
  }
});

describe("LineChart callouts: numbered notes when there is no room", () => {
  // A plot too short for eight labels between the line and its edges.
  const body = ssr(
    <LineChart
      data={runData}
      width={240}
      height={140}
      callouts={Array.from({ length: 8 }, (_, k) => ({
        index: 6 + k,
        label: `Change ${k + 1}\nmore`,
      }))}
    />,
  );
  const svg = body.querySelector("svg")!;
  const { labels, discs } = callouts(svg);
  const notes = [...svg.querySelectorAll("text")].filter((t) => num(t, "y") > 140);

  it("numbers the callouts it cannot place and lists them under the chart, which grows", () => {
    expect(labels.length).toBeLessThan(8);
    const listed = notes
      .filter((t) => t.getAttribute("font-size") === "10.5")
      .map((t) => t.textContent);
    expect(listed.length).toBe(8 - labels.length);
    expect(listed.every((t) => /Change \d, more$/.test(t ?? ""))).toBe(true);
    expect(num(svg, "height")).toBeGreaterThan(140);
  });

  it("draws each note's number beside its point, clear of the labels, or names its period", () => {
    const inPlot = discs.filter((c) => num(c, "cy") <= 140);
    const named = notes.filter((t) => /^\d+: /.test(t.textContent ?? ""));
    expect(inPlot.length + named.length).toBe(8 - labels.length);
    for (const d of inPlot) {
      const box = {
        s: "disc",
        left: num(d, "cx") - num(d, "r"),
        right: num(d, "cx") + num(d, "r"),
        top: num(d, "cy") - num(d, "r"),
        bottom: num(d, "cy") + num(d, "r"),
      };
      for (const l of labels) expect(touch(box, l)).toBe(false);
    }
  });
});

describe("TrendChart callouts", () => {
  const trend = runs.slice(0, 13).map((v, i) => ({ category: `R${i + 1}`, AC: v, PY: v - 20 }));

  it("writes a column's callout above its value label, tied to it by a short line", () => {
    const body = ssr(
      <TrendChart
        data={trend}
        variance="none"
        callouts={[{ index: 4, label: "T1 helm" }]}
        width={600}
      />,
    );
    const svg = body.querySelector("svg")!;
    const { labels, leaders } = callouts(svg);
    expect(labels.map((l) => l.s)).toEqual(["T1 helm"]);
    const value = [...svg.querySelectorAll("text")].find((t) => t.textContent === "900")!;
    const vb = textBox(value, estTextW);
    expect(labels[0]!.bottom).toBeLessThan(vb.top);
    expect(leaders.length).toBe(1);
    const tie = leaders[0]!;
    expect(num(tie, "x1")).toBeCloseTo(num(value, "x"), 6);
    expect(num(tie, "y1")).toBeLessThan(vb.top);
    expect(num(tie, "y2")).toBeCloseTo(labels[0]!.bottom, 0);
  });

  it("writes a negative column's callout below it, and a reference line's beside its dot", () => {
    const body = ssr(
      <TrendChart
        data={[
          { category: "A", AC: 50, PY: 40 },
          { category: "B", AC: -30, PY: 20 },
          { category: "C", AC: 60, PY: 45 },
        ]}
        variance="none"
        callouts={[
          { index: 1, label: "Loss" },
          { index: 2, series: "PY", label: "Last year" },
        ]}
        width={480}
      />,
    );
    const svg = body.querySelector("svg")!;
    const { labels, dots } = callouts(svg);
    const loss = labels.find((l) => l.s === "Loss")!;
    const col = [...svg.querySelectorAll("rect")].filter(
      (r) => r.getAttribute("fill") === T.scenario.AC.fill,
    )[1]!;
    expect(loss.top).toBeGreaterThan(num(col, "y") + num(col, "height"));
    expect(dots.length).toBe(1);
    expect(dots[0]!.getAttribute("fill")).toBe(T.color.neutral);
  });

  const crowd: PointCallout[] = [
    { index: 4, label: "T1 helm" },
    { index: 5, label: "T1 gloves" },
    { index: 11, label: "Signet of Embers" },
    { index: 12, label: "Enchanted boots" },
  ];
  const crowded = (w: number) =>
    ssr(
      <TrendChart
        data={trend}
        variance="none"
        referenceLines={[]}
        callouts={crowd}
        width={w}
        height={240}
      />,
    ).querySelector("svg")!;

  it("makes more room before writing notes: neighbours' labels stack and all find a place", () => {
    const chart = (given: PointCallout[]) =>
      ssr(
        <TrendChart
          data={trend}
          variance="none"
          referenceLines={[]}
          callouts={given}
          width={480}
          height={240}
        />,
      ).querySelector("svg")!;
    const pairs: PointCallout[] = [
      { index: 4, label: "T1 helm" },
      { index: 5, label: "T1 gloves" },
      { index: 8, label: "Ring" },
      { index: 9, label: "Boots" },
    ];
    const svg = chart(pairs);
    expect(callouts(svg).labels.length).toBe(4);
    expect(num(svg, "height")).toBe(240);
    // The second of each pair rose above the first: the plot gave more room
    // than for one label alone.
    const tallestTop = (el: Element) =>
      Math.min(
        ...[...el.querySelectorAll("rect")]
          .filter((r) => r.getAttribute("fill") === T.scenario.AC.fill)
          .filter((r) => !r.parentElement!.hasAttribute("transform")) // not the legend's swatch
          .map((r) => num(r, "y")),
      );
    expect(tallestTop(svg)).toBeGreaterThan(tallestTop(chart(pairs.slice(0, 1))) + 10);
  });

  it("writes a callout as a note when no room can be made: two wide labels at the right edge", () => {
    // At 320 px both last labels are pushed against the right edge, and any
    // leader from R13 would cross "Signet of Embers": "Enchanted boots" is a
    // note, its period named, since its number has no place either.
    const svg = crowded(320);
    expect(callouts(svg).labels.length).toBe(3);
    const notes = [...svg.querySelectorAll("text")].filter((t) => num(t, "y") > 240);
    expect(notes.map((t) => t.textContent)).toContain("R13: Enchanted boots");
  });

  for (const w of [240, 320, 480, 720]) {
    for (const panel of ["abs", "none"] as const) {
      it(`keeps every label clear of columns, value labels, lines and labels (${w}px, ${panel})`, () => {
        const given: PointCallout[] = [
          { index: 0, label: "First" },
          { index: 3, label: "Fourth run\nnew helm" },
          { index: 4, series: "PY", label: "PY here" },
          { index: 8, label: "Ninth" },
          { index: 12, label: "Last run of the season" },
        ];
        const body = ssr(
          <TrendChart data={trend} variance={panel} callouts={given} width={w} height={300} />,
        );
        const svg = body.querySelector("svg")!;
        const { labels } = callouts(svg);
        const blocks: Box[] = [
          ...[...svg.querySelectorAll("rect")]
            .filter((r) => r.getAttribute("fill") !== "transparent")
            .map((r) => ({
              s: "a column",
              left: num(r, "x"),
              right: num(r, "x") + num(r, "width"),
              top: num(r, "y"),
              bottom: num(r, "y") + num(r, "height"),
            })),
          ...[...svg.querySelectorAll("text")]
            .filter(
              (t) =>
                t.getAttribute("font-size") !== "10" || t.getAttribute("text-anchor") !== "middle",
            )
            .filter((t) => num(t, "y") <= 300)
            .map((t) => textBox(t, estTextW)),
        ];
        const lines = pathSegments(svg, (p) => p.getAttribute("fill") === "none");
        for (const l of labels) {
          for (const b of blocks) expect(touch(l, b), `"${l.s}" on ${b.s}`).toBe(false);
          for (const m of labels) if (m !== l) expect(touch(l, m)).toBe(false);
          for (const s of lines) {
            expect(segmentHitsBox(s.x1, s.y1, s.x2, s.y2, l), `a line through "${l.s}"`).toBe(
              false,
            );
          }
        }
        const notes = [...svg.querySelectorAll("text")].filter((t) => num(t, "y") > 300);
        expect(labels.length + notes.length).toBeGreaterThanOrEqual(given.length);
      });
    }
  }

  it("carries each callout's text in its period's row of the table", () => {
    const body = ssr(
      <TrendChart
        data={trend}
        callouts={[{ index: 2, label: "New\nring" }]}
        labels={{ note: "Beleška" }}
      />,
    );
    const heads = [...body.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads[heads.length - 1]).toBe("Beleška");
    expect([...body.querySelectorAll("tbody tr")][2]!.lastElementChild!.textContent).toBe(
      "New, ring",
    );
  });
});

describe("LineChart fans", () => {
  const data: LineDatum[] = Array.from({ length: 8 }, (_, i) => ({
    category: `${i}`,
    AC: 100 + i,
  }));
  const outer: FanBand = {
    from: [80, 82, 84, null, 88, 90, 92, 94],
    to: [130, 128, 126, 124, NaN, 122, 121, 140],
    label: "10th to 90th percentile",
  };
  const inner: FanBand = { from: data.map((d) => d.AC! - 5), to: data.map((d) => d.AC! + 5) };
  const body = ssr(<LineChart data={data} fans={[outer, inner]} width={600} height={300} />);
  const svg = body.querySelector("svg")!;
  const fanShapes = [...svg.querySelectorAll(":scope > g > path, :scope > g > rect")].filter(
    (e) => e.getAttribute("opacity") === "0.2",
  );

  it("draws a band per run of periods with both edges, beneath the lines, in the order given", () => {
    // The outer band breaks at its two gaps: periods 0-2 and 5-7 (3 and 4 lack an edge).
    const paths = fanShapes.filter((e) => e.tagName === "path");
    expect(paths.length).toBe(3);
    const first = fanShapes[0]!;
    const svgChildren = [...svg.children];
    const fanGroup = first.parentElement!;
    const lineIdx = svgChildren.findIndex(
      (c) => c.getAttribute?.("stroke") === T.scenario.AC.stroke,
    );
    expect(svgChildren.indexOf(fanGroup)).toBeLessThan(lineIdx);
    // The inner band, given second, is the last one drawn.
    expect(paths[2]!.getAttribute("d")!.match(/[ML]/g)!.length).toBe(16);
  });

  it("puts the edges on the lines' scale: the upper edge left to right, the lower edge back", () => {
    const ac = svg.querySelector(`path[stroke='${T.scenario.AC.stroke}']`)!.getAttribute("d")!;
    const acPts = [...ac.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    const innerPts = [
      ...fanShapes
        .filter((e) => e.tagName === "path")[2]!
        .getAttribute("d")!
        .matchAll(/[ML]([\d.-]+),([\d.-]+)/g),
    ].map((m) => [Number(m[1]), Number(m[2])]);
    // AC + 5 above the line and AC - 5 below it, at the same x, on one scale.
    const up = innerPts.slice(0, 8);
    const down = innerPts.slice(8).reverse();
    up.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(acPts[i]![0]!, 1);
      expect(acPts[i]![1]! - p[1]!).toBeCloseTo(
        p[1]! - acPts[i]![1]! + 2 * (acPts[i]![1]! - p[1]!),
        0,
      );
      expect(down[i]![1]! - acPts[i]![1]!).toBeCloseTo(acPts[i]![1]! - p[1]!, 0);
    });
  });

  it("grows the value axis to hold the bands", () => {
    const tops = fanShapes.flatMap((e) =>
      [...(e.getAttribute("d") ?? `M0,${e.getAttribute("y")}`).matchAll(/,([\d.-]+)/g)].map((m) =>
        Number(m[1]),
      ),
    );
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(16 - 0.05);
  });

  it("captions a band beside its right end, tied to its edge", () => {
    const caption = [...svg.querySelectorAll("text")].find((t) => t.textContent === outer.label)!;
    const box = textBox(caption, lineTextW);
    const ties = callouts(svg).leaders;
    expect(ties.length).toBe(1);
    const tie = ties[0]!;
    // From the band's last period, at its upper edge (or lower), into the caption.
    const ac = svg.querySelector(`path[stroke='${T.scenario.AC.stroke}']`)!.getAttribute("d")!;
    const lastX = Number([...ac.matchAll(/[ML]([\d.-]+),/g)].pop()![1]);
    expect(num(tie, "x1")).toBeCloseTo(lastX, 0);
    expect(num(tie, "x2")).toBeGreaterThanOrEqual(box.left - 1);
    expect(num(tie, "x2")).toBeLessThanOrEqual(box.right + 1);
  });

  it("names a band's table column by its label, else by number, its cells from-to", () => {
    const heads = [...body.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads.slice(-2)).toEqual(["10th to 90th percentile", "Band 2"]);
    const rows = [...body.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].slice(-2).map((td) => td.textContent),
    );
    expect(rows[0]).toEqual(["80–130", "95–105"]);
    expect(rows[3]![0]).toBe("n/a");
    const named = ssr(<LineChart data={data} fans={[inner]} labels={{ band: "Opseg {n}" }} />);
    expect([...named.querySelectorAll("thead th")].map((th) => th.textContent).pop()).toBe(
      "Opseg 1",
    );
  });

  it("draws a lone period between gaps as a narrow strip, in the band's colour", () => {
    const b = ssr(
      <LineChart
        data={data}
        fans={[{ from: [null, 90, null], to: [null, 110, null], color: "#336699" }]}
      />,
    );
    const strip = [...b.querySelectorAll("svg > g > rect")].find(
      (r) => r.getAttribute("opacity") === "0.2",
    )!;
    expect(strip.getAttribute("fill")).toBe("#336699");
    expect(num(strip, "width")).toBeLessThanOrEqual(4);
    expect(num(strip, "height")).toBeGreaterThan(0);
  });
});

describe("LineChart period labels", () => {
  it("gives a thinned label the room of the periods it stands for", () => {
    const data = Array.from({ length: 61 }, (_, i) => ({ category: `${i * 3}`, AC: 900 + i }));
    const body = ssr(<LineChart data={data} width={480} height={240} />);
    const labels = [...body.querySelectorAll("svg text")].filter(
      (t) => t.getAttribute("font-size") === "10.5",
    );
    expect(labels.map((t) => t.textContent)).toEqual([
      "0",
      "18",
      "36",
      "54",
      "72",
      "90",
      "108",
      "126",
      "144",
      "162",
      "180",
    ]);
  });

  it("keeps a long thinned label inside the chart and off its neighbours", () => {
    const data = Array.from({ length: 61 }, (_, i) => ({
      category: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
      AC: 900 + i,
    }));
    const body = ssr(<LineChart data={data} width={480} height={240} />);
    const labels = [...body.querySelectorAll("svg text")]
      .filter((t) => t.getAttribute("font-size") === "10.5")
      .map((t) => textBox(t, lineTextW));
    expect(labels.length).toBeGreaterThan(5);
    for (const [k, l] of labels.entries()) {
      expect(l.left).toBeGreaterThanOrEqual(0);
      if (k > 0) expect(l.left).toBeGreaterThanOrEqual(labels[k - 1]!.right);
    }
  });
});
