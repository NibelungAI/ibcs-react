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
  type TimelineAnnotation,
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

  it("draws ticks as one halo path and one ink path per row, however many casts", () => {
    expect(rows[0]!.querySelectorAll("path").length).toBe(2);
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
