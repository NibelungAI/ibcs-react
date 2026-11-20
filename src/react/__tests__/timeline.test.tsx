/** @vitest-environment jsdom */
/**
 * TimelineChart as rendered: every tick and span on one time scale, active
 * spans as bars and waiting spans as thin lines, rows in order with their
 * icons, numbered annotations whose numbers never overlap and whose notes are
 * never cut, an axis whose labels never overlap, and the caller's words in the
 * screen-reader table and tooltip. Geometry is read from the server markup.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  TimelineChart,
  defaultTokens,
  type ChartHover,
  type TimelineAnnotation,
  type TimelineMark,
  type TimelineRow,
} from "../../index";
import { estTextW } from "../internal/text";

afterEach(cleanup);

const ssr = (element: ReactElement): HTMLElement =>
  new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html").body;
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

/** The chart's parts, read back from its markup. */
function parts(body: HTMLElement) {
  const svg = body.querySelector("svg")!;
  const axis = [...svg.querySelectorAll(":scope > line")].find(
    (l) => l.getAttribute("stroke") === defaultTokens.color.axis,
  )!;
  const x0 = num(axis, "x1");
  const x1 = num(axis, "x2");
  const rows = [...svg.querySelectorAll(":scope > g")].filter((g) =>
    g.querySelector(":scope > text title"),
  );
  return { svg, axis, x0, x1, axisY: num(axis, "y1"), rows };
}

/** The x of every tick a row draws, from its ink path ("M x,y v h"). */
function tickXs(row: Element): number[] {
  const ink = [...row.querySelectorAll("path")].find(
    (p) => p.getAttribute("stroke") === defaultTokens.color.text,
  );
  if (!ink) return [];
  return [...ink.getAttribute("d")!.matchAll(/M([\d.-]+),/g)].map((m) => Number(m[1]));
}

/** A row's span rects: x, width, height and fill. */
function spanRects(row: Element) {
  return [...row.querySelectorAll(":scope > rect")].map((r) => ({
    x: num(r, "x"),
    width: num(r, "width"),
    height: num(r, "height"),
    fill: r.getAttribute("fill"),
  }));
}

/** Estimated text boxes, as the library lays text out (0.6 em a glyph, one em high). */
function textBox(t: Element) {
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
const overlap = (a: ReturnType<typeof textBox>, b: ReturnType<typeof textBox>) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const fight: TimelineRow[] = [
  { label: "Auto Shot", ticks: [0, 2.9, 5.8, 8.7, 30, 60, 90] },
  {
    label: "Aimed Shot",
    ticks: [1.5, 40],
    spans: [
      { from: 1.5, to: 7.5, kind: "waiting" },
      { from: 40, to: 46, kind: "waiting" },
    ],
  },
  { label: "Rapid Fire", ticks: [30], spans: [{ from: 30, to: 45 }] },
];

describe("TimelineChart: marks on one time scale", () => {
  const body = ssr(<TimelineChart rows={fight} domain={[0, 100]} width={600} />);
  const { x0, x1, rows } = parts(body);
  const xOf = (t: number) => x0 + (t / 100) * (x1 - x0);

  it("draws one row per given row, in order, each with its label", () => {
    expect(rows.map((g) => g.querySelector(":scope > text title")!.textContent)).toEqual([
      "Auto Shot",
      "Aimed Shot",
      "Rapid Fire",
    ]);
  });

  it("puts every tick at its moment on the axis's scale", () => {
    for (const [i, r] of fight.entries()) {
      const xs = tickXs(rows[i]!);
      expect(xs.length).toBe(r.ticks!.length);
      xs.forEach((x, k) => expect(x).toBeCloseTo(xOf(r.ticks![k]!), 1));
    }
  });

  it("draws ticks as one ink path per row, however many casts", () => {
    const paths = rows[0]!.querySelectorAll("path");
    expect(paths.length).toBe(1);
    expect(paths[0]!.getAttribute("stroke")).toBe(defaultTokens.color.text);
    expect(rows[0]!.querySelectorAll("line").length).toBe(0);
  });

  it("draws an active span as a bar and a waiting span as a thin line, from start to end", () => {
    const waiting = spanRects(rows[1]!);
    expect(waiting.map((r) => [r.height, r.fill])).toEqual([
      [2, defaultTokens.color.neutral],
      [2, defaultTokens.color.neutral],
    ]);
    expect(waiting[0]!.x).toBeCloseTo(xOf(1.5), 6);
    expect(waiting[0]!.x + waiting[0]!.width).toBeCloseTo(xOf(7.5), 6);
    const [bar] = spanRects(rows[2]!);
    expect(bar!.height).toBe(8);
    expect(bar!.fill).toBe(defaultTokens.scenario.AC.fill);
    expect(bar!.x).toBeCloseTo(xOf(30), 6);
    expect(bar!.width).toBeCloseTo(xOf(45) - xOf(30), 6);
  });
});

describe("TimelineChart: a cast never splits a bar", () => {
  // A buff refreshed while it is up: one bar from 0 to 57 s, crossed by
  // three casts. Drawn over a halo in the surface colour, each cast cut the
  // bar, and an uptime that never dropped read as three drops.
  const scene: TimelineRow[] = [
    { label: "Serpent Sting", ticks: [0, 14, 28, 42], spans: [{ from: 0, to: 57 }] },
    { label: "Haste Potion", ticks: [30], spans: [{ from: 30, to: 45 }] },
    {
      label: "Aimed Shot",
      ticks: [5, 20, 35, 50],
      spans: [5, 20, 35, 50].map((t) => ({ from: t, to: t + 6, kind: "waiting" as const })),
    },
  ];
  for (const rowHeight of [14, 18, 22, 30]) {
    it(`draws nothing in the surface colour across a span, at rows ${rowHeight} px tall`, () => {
      const body = ssr(
        <TimelineChart rows={scene} domain={[0, 60]} width={480} rowHeight={rowHeight} />,
      );
      const { rows } = parts(body);
      const spans = rows.flatMap((g) =>
        [...g.querySelectorAll(":scope > rect")].map((r) => ({
          left: num(r, "x"),
          right: num(r, "x") + num(r, "width"),
          top: num(r, "y"),
          bottom: num(r, "y") + num(r, "height"),
        })),
      );
      expect(spans.length).toBe(6);
      const surface = defaultTokens.color.surface;
      const surfaced = [...body.querySelectorAll("svg [stroke]")].filter(
        (el) => el.getAttribute("stroke") === surface,
      );
      // Badges keep their surface ring, but they sit above the rows.
      for (const el of surfaced) {
        const d = el.getAttribute("d") ?? "";
        for (const m of d.matchAll(/M([\d.-]+),([\d.-]+)v([\d.-]+)/g)) {
          const [x, y0, h] = [Number(m[1]), Number(m[2]), Number(m[3])];
          for (const sp of spans) {
            const crosses = x >= sp.left && x <= sp.right && y0 <= sp.bottom && y0 + h >= sp.top;
            expect(crosses).toBe(false);
          }
        }
      }
      expect(surfaced.filter((el) => el.tagName === "path").length).toBe(0);
    });
  }

  it("draws the refreshed buff as one unbroken bar, its casts standing out of it", () => {
    const body = ssr(<TimelineChart rows={scene} domain={[0, 60]} width={480} />);
    const { x0, x1, rows } = parts(body);
    const xOf = (t: number) => x0 + (t / 60) * (x1 - x0);
    const sting = rows[0]!;
    const bars = [...sting.querySelectorAll(":scope > rect")];
    expect(bars.length).toBe(1);
    const bar = bars[0]!;
    expect(num(bar, "x")).toBeCloseTo(xOf(0), 6);
    expect(num(bar, "x") + num(bar, "width")).toBeCloseTo(xOf(57), 6);
    // Each tick is taller than the bar: 3 px of ink above it and below it.
    const ink = [...sting.querySelectorAll("path")];
    expect(ink.length).toBe(1);
    const ticks = [...ink[0]!.getAttribute("d")!.matchAll(/M([\d.-]+),([\d.-]+)v([\d.-]+)/g)];
    expect(ticks.length).toBe(4);
    for (const m of ticks) {
      const top = Number(m[2]);
      const bottom = top + Number(m[3]);
      expect(num(bar, "y") - top).toBeCloseTo(3, 6);
      expect(bottom - (num(bar, "y") + num(bar, "height"))).toBeCloseTo(3, 6);
    }
  });
});

describe("TimelineChart: the time range", () => {
  it("clips a span to the domain and leaves out a tick outside it; the table keeps both", () => {
    const body = ssr(
      <TimelineChart
        rows={[{ label: "Buff", ticks: [5, 150], spans: [{ from: 80, to: 330, kind: "waiting" }] }]}
        domain={[0, 120]}
        width={600}
      />,
    );
    const { x1, rows } = parts(body);
    expect(tickXs(rows[0]!).length).toBe(1);
    const [span] = spanRects(rows[0]!);
    expect(span!.x + span!.width).toBeCloseTo(x1, 6);
    const cells = [...body.querySelectorAll("tbody td")].map((td) => td.textContent);
    expect(cells).toEqual(["5, 150", "", "80–330"]);
  });

  it("spans the data without a domain", () => {
    const body = ssr(<TimelineChart rows={[{ label: "A", ticks: [10, 20, 30] }]} width={600} />);
    const { x0, x1, rows } = parts(body);
    const xs = tickXs(rows[0]!);
    expect(xs[0]).toBeCloseTo(x0, 6);
    expect(xs[2]).toBeCloseTo(x1, 6);
  });

  it("draws a range wider than the largest double with finite marks, in order", () => {
    const max = Number.MAX_VALUE;
    const body = ssr(
      <TimelineChart
        rows={[{ label: "A", ticks: [-max, 0, max], spans: [{ from: -max / 2, to: max / 2 }] }]}
        width={600}
      />,
    );
    const { x0, x1, rows } = parts(body);
    const xs = tickXs(rows[0]!);
    expect(xs[0]).toBeCloseTo(x0, 6);
    expect(xs[1]).toBeCloseTo((x0 + x1) / 2, 6);
    expect(xs[2]).toBeCloseTo(x1, 6);
    const [span] = spanRects(rows[0]!);
    expect(span!.x).toBeCloseTo(x0 + (x1 - x0) / 4, 6);
    expect(span!.width).toBeCloseTo((x1 - x0) / 2, 6);
  });

  it("draws a single moment at the lane's centre", () => {
    const body = ssr(<TimelineChart rows={[{ label: "A", ticks: [7] }]} width={600} />);
    const { x0, x1, rows } = parts(body);
    expect(tickXs(rows[0]!)[0]).toBeCloseTo((x0 + x1) / 2, 6);
  });
});

describe("TimelineChart: the time axis", () => {
  const widths = [240, 320, 390, 480, 640, 900];
  const ranges: Array<[number, number, "number" | "clock"]> = [
    [0, 180, "clock"],
    [0, 600, "clock"],
    [0, 7200, "clock"],
    [0, 12.5, "clock"],
    [0, 1, "number"],
    [1.7e12, 1.7e12 + 86400000, "number"],
  ];
  for (const w of widths) {
    for (const [a, b, mode] of ranges) {
      it(`labels ${a}-${b} (${mode}) at ${w}px without overlap, inside the chart`, () => {
        const body = ssr(
          <TimelineChart
            rows={[{ label: "A", ticks: [a, b] }]}
            domain={[a, b]}
            timeFormat={mode}
            width={w}
          />,
        );
        const { svg, axisY } = parts(body);
        const labels = [...svg.querySelectorAll("g > text")]
          .filter((t) => Math.abs(num(t, "y") - (axisY + 15)) < 0.01)
          .map(textBox);
        expect(labels.length).toBeGreaterThan(0);
        for (const [i, l] of labels.entries()) {
          expect(l.left).toBeGreaterThanOrEqual(0);
          expect(l.right).toBeLessThanOrEqual(w);
          if (i > 0) expect(overlap(labels[i - 1]!, l)).toBe(false);
        }
      });
    }
  }

  it("writes a clock axis in minutes and seconds", () => {
    const body = ssr(
      <TimelineChart rows={fight} domain={[0, 180]} timeFormat="clock" width={640} />,
    );
    const { svg, axisY } = parts(body);
    const labels = [...svg.querySelectorAll("g > text")]
      .filter((t) => Math.abs(num(t, "y") - (axisY + 15)) < 0.01)
      .map((t) => t.textContent);
    expect(labels).toEqual(["0:00", "0:30", "1:00", "1:30", "2:00", "2:30", "3:00"]);
  });

  it("writes a number axis with the format's suffix and locale, in full", () => {
    const body = ssr(
      <TimelineChart
        rows={[{ label: "A", ticks: [0, 2500] }]}
        domain={[0, 2500]}
        format={{ suffix: " s", locale: "sr-Latn" }}
        width={640}
      />,
    );
    const texts = [...body.querySelectorAll("svg g > text")].map((t) => t.textContent);
    expect(texts).toContain("1.000 s");
    expect(texts.some((t) => /K/.test(t ?? ""))).toBe(false);
  });

  it("writes compact times with the digits that tell neighbours apart, on the axis and in the table", () => {
    // 1,000 to 1,100 s compact: six axis labels once all read "1K", and two
    // casts 35 s apart read alike in the table.
    const body = ssr(
      <TimelineChart
        rows={[{ label: "A", ticks: [1012, 1047], spans: [{ from: 1000, to: 1100 }] }]}
        domain={[1000, 1100]}
        format={{ compact: true }}
        width={640}
      />,
    );
    const { svg, axisY } = parts(body);
    const labels = [...svg.querySelectorAll("g > text")]
      .filter((t) => Math.abs(num(t, "y") - (axisY + 15)) < 0.01)
      .map((t) => t.textContent);
    expect(labels).toEqual(["1.00K", "1.02K", "1.04K", "1.06K", "1.08K", "1.10K"]);
    const cells = [...body.querySelectorAll("tbody td")].map((td) => td.textContent);
    expect(cells).toEqual(["1.01K, 1.05K", "1.00K–1.10K", ""]);
    expect(svg.getAttribute("aria-label")).toBe("Timeline of 1 rows, 1.00K to 1.10K");
  });

  for (const w of widths) {
    it(`never writes two neighbouring compact axis labels alike, at ${w}px`, () => {
      for (const [a, b] of [
        [1000, 1100],
        [0, 0.9],
        [999_000, 1_001_000],
        [1.7e12, 1.7e12 + 5e6],
      ] as const) {
        const body = ssr(
          <TimelineChart
            rows={[{ label: "A", ticks: [a, b] }]}
            domain={[a, b]}
            format={{ compact: true }}
            width={w}
          />,
        );
        const { svg, axisY } = parts(body);
        const labels = [...svg.querySelectorAll("g > text")]
          .filter((t) => Math.abs(num(t, "y") - (axisY + 15)) < 0.01)
          .map((t) => t.textContent);
        expect(labels.length).toBeGreaterThan(0);
        for (const [i, l] of labels.entries()) if (i > 0) expect(l).not.toBe(labels[i - 1]);
      }
    });
  }
});

const notes: TimelineAnnotation[] = [
  { at: 30, row: 2, text: "Rapid Fire: 15 s of 40% faster shots" },
  { at: 60, text: "A note long enough that it has to wrap onto a second line in a narrow chart" },
  { at: 90, row: 0, text: "The last auto shot" },
];

describe("TimelineChart: numbered annotations", () => {
  const body = ssr(
    <TimelineChart rows={fight} annotations={notes} domain={[0, 100]} width={320} />,
  );
  const { svg, x0, x1, axisY, rows } = parts(body);
  const xOf = (t: number) => x0 + (t / 100) * (x1 - x0);
  const badges = [...svg.querySelectorAll(":scope > g > circle")].map((c) => ({
    cx: num(c, "cx"),
    cy: num(c, "cy"),
    r: num(c, "r"),
    n: c.parentElement!.querySelector("text")!.textContent,
  }));
  const assists = [...svg.querySelectorAll(":scope > path[stroke-dasharray]")];

  it("numbers each annotation, in the order given, at its moment above the rows", () => {
    const strip = badges.slice(0, 3);
    expect(strip.map((b) => b.n)).toEqual(["1", "2", "3"]);
    strip.forEach((b, i) => expect(b.cx).toBeCloseTo(xOf(notes[i]!.at), 6));
    const firstRowTop = num(rows[0]!.querySelector("text")!, "y") - 12;
    for (const b of strip) expect(b.cy + b.r).toBeLessThan(firstRowTop);
  });

  it("runs each assisting line to its row's marks, or across every row to the axis", () => {
    expect(assists.length).toBe(3);
    const ends = assists.map((p) => Number(/V([\d.]+)$/.exec(p.getAttribute("d")!)![1]));
    const rowTop = (i: number) => num(rows[i]!.querySelector(":scope > text")!, "y");
    // Row 2's marks, the axis, row 0's marks: each line stops just above the row's ticks.
    expect(ends[1]).toBeCloseTo(axisY, 6);
    expect(ends[0]).toBeLessThan(rowTop(2));
    expect(ends[2]).toBeLessThan(rowTop(0));
  });

  it("lists every note by its number under the axis, wrapping a long one, never cutting it", () => {
    const listed = [...svg.querySelectorAll(":scope > g > g")]
      .filter(
        (g) =>
          g.querySelector(":scope > text") && num(g.querySelector(":scope > text")!, "y") > axisY,
      )
      .map((g) => ({
        n: g.querySelector("circle") ? g.querySelector("g text")!.textContent : null,
        text: g.querySelector(":scope > text")!.textContent!,
      }));
    expect(listed.filter((l) => l.n != null).map((l) => l.n)).toEqual(["1", "2", "3"]);
    const second = listed.slice(
      1,
      listed.findIndex((l, i) => i > 1 && l.n != null),
    );
    expect(second.length).toBeGreaterThan(1);
    expect(second.map((l) => l.text).join(" ")).toBe(notes[1]!.text);
    for (const l of listed) expect(l.text.endsWith("…")).toBe(false);
  });

  it("carries the notes in the table's caption, by number", () => {
    expect(body.querySelector("caption")!.textContent).toBe(
      `Timeline - data table. 1 ${notes[0]!.text}. 2 ${notes[1]!.text}. 3 ${notes[2]!.text}`,
    );
  });

  it("sets crowded numbers side by side, never overlapping, each line still at its moment", () => {
    const crowded = Array.from({ length: 12 }, (_, i) => ({ at: 50 + i * 0.2, text: `n${i}` }));
    const b = ssr(
      <TimelineChart rows={fight} annotations={crowded} domain={[0, 100]} width={640} />,
    );
    const p = parts(b);
    const xs = [...p.svg.querySelectorAll(":scope > g > circle")]
      .slice(0, 12)
      .map((c) => ({ cx: num(c, "cx"), r: num(c, "r") }));
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!.cx - xs[i - 1]!.cx).toBeGreaterThanOrEqual(xs[i]!.r + xs[i - 1]!.r);
    }
    // With room to the right, the first number keeps its moment and the
    // others are set after it, left to right.
    expect(xs[0]!.cx).toBeCloseTo(p.x0 + (crowded[0]!.at / 100) * (p.x1 - p.x0), 6);
    const lines = [...p.svg.querySelectorAll(":scope > path[stroke-dasharray]")];
    const at = (t: number) => p.x0 + (t / 100) * (p.x1 - p.x0);
    lines.forEach((l, i) => {
      // The line runs straight down at the moment (after a slanted part from a
      // number moved aside).
      expect(l.getAttribute("d")).toMatch(new RegExp(`[ML]${at(crowded[i]!.at)},[\\d.]+V`));
    });
    expect(lines.some((l) => /L/.test(l.getAttribute("d")!))).toBe(true);
  });

  it("keeps a note outside the domain: its number at the nearest end, no assisting line", () => {
    const b = ssr(
      <TimelineChart
        rows={fight}
        annotations={[{ at: 500, text: "after the end" }]}
        domain={[0, 100]}
        width={640}
      />,
    );
    const p = parts(b);
    expect(p.svg.querySelectorAll(":scope > path[stroke-dasharray]").length).toBe(0);
    const c = p.svg.querySelector(":scope > g > circle")!;
    expect(num(c, "cx") + num(c, "r")).toBeCloseTo(p.x1, 6);
    expect(b.textContent).toContain("after the end");
  });
});

describe("TimelineChart: labels and icons", () => {
  const icon = { src: "data:image/png;base64,AA==", naturalSize: 56, alt: "Spell" };

  it("draws icons before the labels at the size rule, keeping the labels aligned", () => {
    const body = ssr(
      <TimelineChart
        rows={[
          { label: "With", icon, ticks: [1] },
          { label: "Without", ticks: [2] },
        ]}
        width={600}
      />,
    );
    const img = body.querySelector("image")!;
    expect([num(img, "width"), num(img, "height")]).toEqual([16, 16]);
    const labels = [...body.querySelectorAll("svg > g > text")].filter((t) =>
      t.querySelector("title"),
    );
    expect(num(labels[0]!, "x")).toBe(num(labels[1]!, "x"));
    expect(num(labels[0]!, "x")).toBeGreaterThan(num(img, "x") + 16);
    // The icon's alt is read before the label in the table.
    expect(body.querySelector("tbody th")!.textContent).toBe("Spell, With");
  });

  it("cuts a long label to its column, the whole label in its tooltip", () => {
    const long = "An ability whose name is far too long for the label column";
    const body = ssr(<TimelineChart rows={[{ label: long, ticks: [1] }]} width={320} />);
    const t = [...body.querySelectorAll("svg text")].find((e) => e.querySelector("title"))!;
    expect(t.firstChild!.textContent!.endsWith("…")).toBe(true);
    expect(t.querySelector("title")!.textContent).toBe(long);
  });

  it("hands renderIcon the row and its own icons to wrap", () => {
    const seen: string[] = [];
    const body = ssr(
      <TimelineChart
        rows={[{ label: "A", icon, ticks: [1] }]}
        renderIcon={(row, size, own) => {
          seen.push(`${row.label}:${size}:${own != null}`);
          return <g data-wrapped="">{own}</g>;
        }}
        width={600}
      />,
    );
    expect(seen).toEqual(["A:16:true"]);
    expect(body.querySelector("[data-wrapped] image")).not.toBeNull();
  });
});

describe("TimelineChart: words, table and tooltip", () => {
  it("writes every time in the table with the format, clock or number", () => {
    const body = ssr(<TimelineChart rows={fight} timeFormat="clock" width={600} />);
    const cells = [...body.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent),
    );
    expect(cells[2]).toEqual(["0:30.0", "0:30.0–0:45.0", ""]);
    expect(cells[1]![2]).toBe("0:01.5–0:07.5, 0:40.0–0:46.0");
  });

  it("names its table's columns and its tooltip's rows in the caller's words", () => {
    const labels = {
      events: "Korišćenja",
      event: "Korišćenje",
      active: "Aktivno",
      waiting: "Čeka",
    };
    const { container } = render(
      <TimelineChart rows={fight} timeFormat="clock" labels={labels} width={600} />,
    );
    const heads = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads.slice(1)).toEqual(["Korišćenja", "Aktivno", "Čeka"]);
    const targets = container.querySelectorAll("svg rect[fill='transparent']");
    // The first targets are row 0's ticks (spans come first per row, row 0 has none).
    fireEvent.pointerMove(targets[0]!, { clientX: 10, clientY: 10, pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toContain("Auto Shot");
    expect(screen.getByRole("tooltip").textContent).toContain("Korišćenje");
    expect(screen.getByRole("tooltip").textContent).toContain("0:00.0");
    const spanTarget = [...targets].find(
      (t) => Number(t.getAttribute("width")) > 20 && Number(t.getAttribute("y")) > 40,
    )!;
    fireEvent.pointerMove(spanTarget, { clientX: 10, clientY: 10, pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toMatch(/Čeka|Aktivno/);
  });

  it("describes itself in English unless ariaLabel replaces the sentence", () => {
    const plain = ssr(<TimelineChart rows={fight} domain={[0, 100]} width={600} />);
    expect(plain.querySelector("svg")!.getAttribute("aria-label")).toBe(
      "Timeline of 3 rows, 0 to 100",
    );
    const named = ssr(<TimelineChart rows={fight} ariaLabel="Jedna borba" width={600} />);
    expect(named.querySelector("svg")!.getAttribute("aria-label")).toBe("Jedna borba");
    expect(named.querySelector("caption")!.textContent).toBe("Jedna borba");
  });

  it("draws an empty timeline: the axis, no row, an empty table", () => {
    const body = ssr(<TimelineChart rows={[]} width={400} />);
    expect(parts(body).rows.length).toBe(0);
    expect(body.querySelectorAll("tbody tr").length).toBe(0);
  });
});

describe("TimelineChart: hover", () => {
  it("redraws none of its rows on a hover change: the tooltip alone follows the pointer", () => {
    // renderIcon is called once per row each time the rows are drawn.
    let drawn = 0;
    const renderIcon = () => {
      drawn += 1;
      return null;
    };
    const { container } = render(
      <TimelineChart rows={fight} width={600} renderIcon={renderIcon} />,
    );
    expect(drawn).toBe(fight.length);
    const targets = [...container.querySelectorAll("svg rect[fill='transparent']")];
    // Seven casts in the first row, two and two cooldowns in the second, one and a buff in the third.
    expect(targets.length).toBe(13);
    for (const t of targets) {
      fireEvent.pointerMove(t, { clientX: 10, clientY: 10, pointerType: "mouse" });
      expect(screen.getByRole("tooltip")).toBeTruthy();
    }
    fireEvent.pointerLeave(targets[0]!, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(drawn).toBe(fight.length);
  });

  it("reports to the onHover of the latest render, though its targets were drawn before it", () => {
    const seen = (into: Array<string | null>) => (h: ChartHover<TimelineMark> | null) => {
      into.push(h ? `${h.category} ${h.datum.kind} ${h.datum.from}` : null);
    };
    const first: Array<string | null> = [];
    const latest: Array<string | null> = [];
    const { container, rerender } = render(
      <TimelineChart rows={fight} width={600} tooltip={false} onHover={seen(first)} />,
    );
    rerender(<TimelineChart rows={fight} width={600} tooltip={false} onHover={seen(latest)} />);
    const target = container.querySelector("svg rect[fill='transparent']")!;
    fireEvent.pointerMove(target, { clientX: 10, clientY: 10, pointerType: "mouse" });
    fireEvent.pointerLeave(target, { pointerType: "mouse" });
    expect(first).toEqual([]);
    expect(latest).toEqual(["Auto Shot event 0", null]);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
