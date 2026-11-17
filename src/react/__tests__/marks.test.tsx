/** @vitest-environment jsdom */
/**
 * The 1.5 marks as rendered: error bars, value bands, DataTable magnitude
 * marks, and exact, locale-correct numbers and caller words on the charts that
 * carry them. Geometry is asserted from the markup the user would get.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DataTable,
  ErrorBar,
  KpiCard,
  LineChart,
  RankingVarianceChart,
  VarianceColumnChart,
  defaultTokens,
  type DataTableColumn,
  type DataTableRow,
} from "../../index";

afterEach(cleanup);

const NB = "\u00a0";
const sr2 = { compact: false, locale: "sr-Latn", fractionDigits: 2 } as const;

/** Every <line> of the error bar(s) under `root`, ink lines only (the halo is the surface colour). */
function inkLines(root: Element): Element[] {
  return [...root.querySelectorAll("g[role='img'] line")].filter(
    (l) => l.getAttribute("stroke") !== defaultTokens.color.surface,
  );
}

const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

/**
 * Server markup as a DOM: charts grow in on mount, so a client render shows the
 * animation's first frame - the FINISHED geometry is the server's (see ssr.test).
 */
function ssr(element: React.ReactElement): HTMLElement {
  return new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html").body;
}

describe("ErrorBar", () => {
  const linear = (v: number) => 10 + v * 2;

  it("draws a whisker and two caps over a surface-coloured halo, named by its interval", () => {
    const { container } = render(
      <svg>
        <ErrorBar value={910.7916} halfWidth={0.7605} scale={linear} cross={20} format={sr2} />
      </svg>,
    );
    const g = container.querySelector("g[role='img']")!;
    expect(g.getAttribute("aria-label")).toBe(`910,79${NB}±${NB}0,76`);
    expect(g.querySelector("title")!.textContent).toBe(`910,79${NB}±${NB}0,76`);
    const lines = [...g.querySelectorAll("line")];
    expect(lines).toHaveLength(6);
    expect(lines.slice(0, 3).every((l) => l.getAttribute("stroke") === "#fff")).toBe(true);
    expect(lines.slice(3).every((l) => l.getAttribute("stroke") === defaultTokens.color.text)).toBe(
      true,
    );
    const [whisker] = inkLines(container);
    expect(num(whisker!, "x1")).toBeCloseTo(linear(910.7916 - 0.7605), 9);
    expect(num(whisker!, "x2")).toBeCloseTo(linear(910.7916 + 0.7605), 9);
  });

  it("signs a difference, takes a caller's label, and runs vertically", () => {
    const signed = render(
      <svg>
        <ErrorBar value={3.4573} halfWidth={0.4621} scale={linear} cross={5} signed format={sr2} />
      </svg>,
    );
    expect(signed.container.querySelector("g")!.getAttribute("aria-label")).toBe(
      `+3,46${NB}±${NB}0,46`,
    );
    cleanup();
    const vertical = render(
      <svg>
        <ErrorBar
          value={70}
          halfWidth={12}
          orientation="vertical"
          scale={(v) => 130 - v * 1.5}
          cross={352}
          label="70 ± 12 (95 %)"
        />
      </svg>,
    );
    const g = vertical.container.querySelector("g")!;
    expect(g.getAttribute("aria-label")).toBe("70 ± 12 (95 %)");
    const [whisker] = inkLines(vertical.container);
    expect(whisker!.getAttribute("x1")).toBe("352");
    expect(whisker!.getAttribute("x2")).toBe("352");
    expect(num(whisker!, "y1")).toBeCloseTo(130 - 58 * 1.5, 9);
  });

  it("renders nothing for an exact value and is SSR-safe", () => {
    const { container } = render(
      <svg>
        <ErrorBar value={1} halfWidth={0} scale={linear} cross={5} />
      </svg>,
    );
    expect(container.querySelector("g")).toBeNull();
    const html = renderToStaticMarkup(
      <svg>
        <ErrorBar value={1} halfWidth={0.5} scale={linear} cross={5} />
      </svg>,
    );
    expect(html).toContain('aria-label="1');
  });
});

/* ------------------------------ DataTable ------------------------------ */

const dps: DataTableColumn = {
  key: "dps",
  label: "DPS",
  mark: "bar",
  format: { compact: false, locale: "sr-Latn", fractionDigits: 1 },
};
const abilities: DataTableRow[] = [
  { id: "shoot", label: "Shoot", values: { dps: 215 }, errors: { dps: 2 } },
  { id: "raptor", label: "Raptor Strike", values: { dps: 91 } },
];

/** The svg of the cell in `row` (by row label) and column index. */
function cellSvg(container: HTMLElement, rowLabel: string, columnIndex = 0): SVGSVGElement | null {
  const row = [...container.querySelectorAll("tbody tr")].find((tr) =>
    tr.querySelector("th")?.textContent?.includes(rowLabel),
  );
  if (!row) throw new Error(`no row ${rowLabel}`);
  return row.querySelectorAll("td")[columnIndex]!.querySelector("svg");
}

describe("DataTable - value marks (magnitude bars)", () => {
  it("draws the value itself as a bar on the column's shared scale, its number beside it", () => {
    const { container } = render(<DataTable columns={[dps]} rows={abilities} />);
    // width 160 → bar area 80px from x = 8; the scale spans 0 … 217 (215 + its error).
    const shoot = cellSvg(container, "Shoot")!.querySelector("rect")!;
    const raptor = cellSvg(container, "Raptor Strike")!.querySelector("rect")!;
    expect(num(shoot, "x")).toBe(8);
    expect(num(shoot, "width")).toBeCloseTo((215 / 217) * 80, 9);
    expect(num(raptor, "width")).toBeCloseTo((91 / 217) * 80, 9);
    expect(shoot.getAttribute("fill")).toBe(defaultTokens.scenario.AC.fill);
    expect(cellSvg(container, "Shoot")!.querySelector("text")!.textContent).toBe("215,0");
  });

  it("names the row's error bar with its interval, in the column's digits", () => {
    const { container } = render(<DataTable columns={[dps]} rows={abilities} />);
    const g = cellSvg(container, "Shoot")!.querySelector("g[role='img']")!;
    expect(g.getAttribute("aria-label")).toBe(`215,0${NB}±${NB}2,0`);
    expect(cellSvg(container, "Raptor Strike")!.querySelector("g[role='img']")).toBeNull();
  });

  it("keeps the totals row to the plain number", () => {
    const { container } = render(<DataTable columns={[dps]} rows={abilities} showTotals />);
    const total = [...container.querySelectorAll("tbody tr")].slice(-1)[0]!;
    expect(total.querySelector("svg")).toBeNull();
    expect(total.querySelector("td")!.textContent).toBe("306,0");
  });

  it("shifts the zero axis right for negatives and grows them leftward", () => {
    const rows: DataTableRow[] = [
      { id: "a", label: "Gain", values: { m: 30 } },
      { id: "b", label: "Loss", values: { m: -10 } },
    ];
    const { container } = render(
      <DataTable columns={[{ key: "m", label: "M", mark: "bar" }]} rows={rows} />,
    );
    const axisX = 8 + (10 / 40) * 80;
    const loss = cellSvg(container, "Loss")!.querySelector("rect")!;
    expect(num(loss, "x")).toBeCloseTo(8, 9);
    expect(num(loss, "width")).toBeCloseTo(axisX - 8, 9);
    const gain = cellSvg(container, "Gain")!.querySelector("rect")!;
    expect(num(gain, "x")).toBeCloseTo(axisX, 9);
  });

  it("wears its scenario's IBCS fill: PL a frame, FC a hatch, PY grey", () => {
    const rows: DataTableRow[] = [{ id: "a", label: "A", values: { m: { PL: 5, FC: 6, PY: 4 } } }];
    const col = (scenario: "PL" | "FC" | "PY"): DataTableColumn => ({
      key: `m${scenario}`,
      measure: "m",
      label: scenario,
      mark: "bar",
      scenario,
    });
    const { container } = render(
      <DataTable columns={[col("PL"), col("FC"), col("PY")]} rows={rows} />,
    );
    const [pl, fc, py] = [0, 1, 2].map((i) => cellSvg(container, "A", i)!.querySelector("rect")!);
    expect(pl!.getAttribute("fill")).toBe(defaultTokens.color.surface);
    expect(pl!.getAttribute("stroke")).toBe(defaultTokens.scenario.PL.stroke);
    expect(fc!.getAttribute("fill")).toMatch(/^url\(#.+\)$/);
    expect(cellSvg(container, "A", 1)!.querySelector("pattern")).not.toBeNull();
    expect(py!.getAttribute("fill")).toBe(defaultTokens.scenario.PY.fill);
  });

  it("draws a pin mark as a stem and a dot at the value", () => {
    const { container } = render(
      <DataTable columns={[{ ...dps, mark: "pin" }]} rows={abilities} />,
    );
    const svg = cellSvg(container, "Raptor Strike")!;
    expect(num(svg.querySelector("circle")!, "cx")).toBeCloseTo(8 + (91 / 217) * 80, 9);
    expect(svg.querySelector("rect")).toBeNull();
  });

  it("writes a plain value column's interval as text", () => {
    const { container } = render(
      <DataTable
        columns={[{ key: "dps", label: "DPS", format: sr2 }]}
        rows={[{ id: "best", label: "Best", values: { dps: 914.3013 }, errors: { dps: 0.4682 } }]}
      />,
    );
    expect(container.querySelector("tbody td")!.textContent).toBe(`914,30${NB}±${NB}0,47`);
  });

  it("shades a column's bands on the body rows, not the totals row", () => {
    const { container } = render(
      <DataTable
        columns={[{ ...dps, bands: [{ from: 200, to: 217, label: "Top" }] }]}
        rows={abilities}
        showTotals
      />,
    );
    const band = cellSvg(container, "Shoot")!.querySelector("rect[opacity]")!;
    expect(band.querySelector("title")!.textContent).toBe("Top");
    expect(num(band, "x")).toBeCloseTo(8 + (200 / 217) * 80, 9);
    expect(num(band, "width")).toBeCloseTo((17 / 217) * 80, 9);
    expect(cellSvg(container, "Raptor Strike")!.querySelector("rect[opacity]")).not.toBeNull();
    const total = [...container.querySelectorAll("tbody tr")].slice(-1)[0]!;
    expect(total.querySelector("rect[opacity]")).toBeNull();
  });
});

describe("DataTable - variance error bars", () => {
  const rows: DataTableRow[] = [
    { id: "a", label: "Ring", values: { m: { AC: 914.05, PY: 910.84 } }, errors: { d: 0.44 } },
    { id: "b", label: "Trinket", values: { m: { AC: 907.96, PY: 910.84 } }, errors: { d: 0.54 } },
  ];
  const pin: DataTableColumn = {
    key: "d",
    label: "Δ",
    kind: "variance",
    measure: "m",
    mark: "pin",
    format: sr2,
    width: 190,
  };

  it("lays a pin column with errors out with its labels in a right gutter", () => {
    const { container } = render(<DataTable columns={[pin]} rows={rows} />);
    for (const label of ["Ring", "Trinket"]) {
      const text = cellSvg(container, label)!.querySelector("text")!;
      expect(text.getAttribute("text-anchor")).toBe("end");
      expect(num(text, "x")).toBe(190 - 6);
    }
    const g = cellSvg(container, "Trinket")!.querySelector("g[role='img']")!;
    expect(g.getAttribute("aria-label")).toBe(`-2,88${NB}±${NB}0,54`);
    // The whisker is drawn under the dot: the dot comes after the error bar.
    const svg = cellSvg(container, "Trinket")!;
    const children = [...svg.children].map((c) => c.tagName.toLowerCase());
    expect(children.indexOf("circle")).toBeGreaterThan(children.indexOf("g"));
  });

  it("keeps the 1.4 pin layout when the column has no errors", () => {
    const plain = rows.map((r) => ({ ...r, errors: undefined }));
    const { container } = render(<DataTable columns={[pin]} rows={plain} />);
    const axis = cellSvg(container, "Ring")!.querySelector("line")!;
    expect(num(axis, "x1")).toBe(Math.round(190 * 0.4));
    expect(cellSvg(container, "Ring")!.querySelector("text")!.getAttribute("text-anchor")).toBe(
      "start",
    );
  });

  it("cuts a magnitude bar's whisker at its axis when the interval reaches past zero", () => {
    const cols: DataTableColumn[] = [{ key: "d", label: "Δ", kind: "variance", measure: "m" }];
    const small: DataTableRow[] = [
      { id: "a", label: "Bracers", values: { m: { AC: 910.9, PY: 910.84 } }, errors: { d: 0.13 } },
      { id: "b", label: "Big", values: { m: { AC: 920, PY: 910 } } },
    ];
    const { container } = render(<DataTable columns={cols} rows={small} />);
    const lines = inkLines(cellSvg(container, "Bracers")!);
    // A whisker and ONE cap: the low end is cut at the left axis (x = 8).
    expect(lines).toHaveLength(2);
    expect(num(lines[0]!, "x1")).toBe(8);
  });

  it("writes Δ% cells in the column's locale, with the interval on the error bar", () => {
    const pct: DataTableColumn = {
      key: "p",
      label: "Δ%",
      kind: "variance",
      measure: "m",
      mode: "pct",
      format: { locale: "sr-Latn" },
    };
    const data: DataTableRow[] = [
      { id: "a", label: "A", values: { m: { AC: 106.9, PY: 100 } }, errors: { p: 0.4 } },
    ];
    const { container } = render(<DataTable columns={[pct]} rows={data} />);
    const svg = cellSvg(container, "A")!;
    expect(svg.querySelector("text")!.textContent).toBe("+6,9");
    expect(svg.querySelector("g[role='img']")!.getAttribute("aria-label")).toBe(
      `+6,9${NB}±${NB}0,4`,
    );
  });

  it("writes a numeric (mark none) variance with its interval as text", () => {
    const none: DataTableColumn = { ...pin, mark: "none" };
    const { container } = render(<DataTable columns={[none]} rows={rows} />);
    const cell = [...container.querySelectorAll("tbody tr")][0]!.querySelector("td")!;
    expect(cell.textContent).toBe(`+3,21${NB}±${NB}0,44`);
  });
});

/* --------------------------- RankingVarianceChart --------------------------- */

const topGear = [
  { label: "Best", AC: 914.3013, base: 910.8441, acError: 0.4682, absError: 0.4621 },
  { label: "Trinket", AC: 907.9623, base: 910.8441, acError: 0.4793, absError: 0.5439 },
];

describe("RankingVarianceChart - error bars, bands, words", () => {
  const chart = (extra: Partial<React.ComponentProps<typeof RankingVarianceChart>> = {}) =>
    render(
      <RankingVarianceChart
        data={topGear}
        format={sr2}
        labels={{ scenario: { AC: "DPS", PL: "trenutne" }, total: "Ukupno" }}
        bands={[{ panel: "abs", from: 2.9952, to: 3.9194, label: "Izjednačeno" }]}
        {...extra}
      />,
    );

  it("draws an error bar on the AC bar and the ΔPL bar, named by their intervals", () => {
    const container = ssr(
      <RankingVarianceChart
        data={topGear}
        format={sr2}
        labels={{ scenario: { AC: "DPS", PL: "trenutne" } }}
      />,
    );
    const names = [...container.querySelectorAll("svg g[role='img']")].map((g) =>
      g.getAttribute("aria-label"),
    );
    expect(names).toEqual([
      `914,30${NB}±${NB}0,47`,
      `+3,46${NB}±${NB}0,46`,
      `907,96${NB}±${NB}0,48`,
      `-2,88${NB}±${NB}0,54`,
    ]);
  });

  it("puts the intervals and the caller's words in the screen-reader table", () => {
    const { container } = chart();
    const table = container.querySelector("table")!;
    const headers = [...table.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(headers).toEqual(["", "DPS", "trenutne", "Δtrenutne", "Δtrenutne%"]);
    const best = within(table).getByText("Best").closest("tr")!;
    const cells = [...best.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells).toEqual([`914,30${NB}±${NB}0,47`, "910,84", `+3,46${NB}±${NB}0,46`, "+0,4%"]);
    expect(within(table).getByText("Ukupno")).toBeTruthy();
    expect(table.querySelector("caption")!.textContent).toBe(
      "Ranked variance versus trenutne - data table. Izjednačeno: 3,00–3,92",
    );
  });

  it("shades the band across the data rows only and captions it above the headers", () => {
    const { container } = chart();
    const band = container.querySelector("svg rect[opacity]")!;
    expect(band.querySelector("title")!.textContent).toBe("Izjednačeno");
    // padT 12 + band caption line 14, header 18: the body starts at y = 44 and
    // holds two 26px rows; the total row below is not shaded.
    expect(num(band, "y")).toBe(44);
    expect(num(band, "height")).toBe(52);
    const texts = [...container.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(texts).toContain("Izjednačeno");
    expect(texts).toContain("DPS");
    expect(texts).toContain("Δtrenutne");
    expect(texts).toContain("Ukupno");
  });

  it("shows the intervals in the tooltip", () => {
    const { container } = chart();
    fireEvent.pointerMove(container.querySelector("svg rect[fill='transparent']")!, {
      clientX: 10,
      clientY: 50,
      pointerType: "mouse",
    });
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain(`914,30${NB}±${NB}0,47`);
    expect(tip.textContent).toContain(`+3,46${NB}±${NB}0,46 (+0,4%)`);
  });

  it("names the chart with the caller's ariaLabel, also as its table caption", () => {
    const { container } = chart({ ariaLabel: "Rangiranje varijanti", bands: undefined });
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe("Rangiranje varijanti");
    expect(container.querySelector("caption")!.textContent).toBe("Rangiranje varijanti");
  });

  it("draws no error bar or band without them", () => {
    const container = ssr(
      <RankingVarianceChart data={topGear.map(({ label, AC, base }) => ({ label, AC, base }))} />,
    );
    expect(container.querySelector("svg g[role='img']")).toBeNull();
    expect(container.querySelector("svg rect[opacity]")).toBeNull();
  });
});

/* ------------------------------ LineChart ------------------------------ */

describe("LineChart - caller words and per-series digits", () => {
  const narrowing = [
    { category: "1", AC: 0.2416 },
    { category: "2", AC: 0.1693 },
    { category: "3", AC: 0.138 },
  ];

  it("drops the scenario code from an end label when the caller's word is empty", () => {
    const { container } = render(
      <LineChart
        data={narrowing}
        labels={{ scenario: { AC: "" } }}
        format={{ compact: false, locale: "sr-Latn", fractionDigits: 2, suffix: "%" }}
      />,
    );
    const texts = [...container.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(texts).toContain("0,14%");
    expect(texts.some((t) => t?.startsWith("AC"))).toBe(false);
  });

  it("formats each series with its own seriesFormat entry", () => {
    const { container } = render(
      <LineChart
        data={[
          { category: "Q1", AC: 120, PY: 100 },
          { category: "Q2", AC: 150.5, PY: 140 },
        ]}
        seriesFormat={{ AC: { compact: false, fractionDigits: 2 }, PY: { fractionDigits: 0 } }}
      />,
    );
    const texts = [...container.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(texts).toContain("AC 150.50");
    expect(texts).toContain("PY 140");
    const cells = [...container.querySelectorAll("table tbody td")].map((td) => td.textContent);
    expect(cells).toEqual(["120.00", "100", "150.50", "140"]);
  });

  it("writes the variance panel's Δ% in the format's locale", () => {
    const { container } = render(
      <LineChart
        data={[
          { category: "Q1", AC: 120, PY: 100 },
          { category: "Q2", AC: 150, PY: 140 },
        ]}
        variance="pct"
        format={{ locale: "sr-Latn" }}
      />,
    );
    const cells = [...container.querySelectorAll("table tbody td")].map((td) => td.textContent);
    expect(cells).toContain("+20,0%");
    expect(cells).toContain("+7,1%");
  });
});

/* ------------------------------ KpiCard ------------------------------ */

describe("KpiCard - caller words and locale percent", () => {
  it("writes the caller's words for vs, the base and pp", () => {
    render(
      <KpiCard
        label="Marža"
        values={{ AC: 0.184, PY: 0.178 }}
        unit="ratio"
        format={{ compact: false, locale: "sr-Latn", fractionDigits: 1 }}
        labels={{ versus: "u odnosu na", scenario: { PY: "PG" }, percentagePoints: "p.p." }}
        animate={false}
      />,
    );
    expect(screen.getByText("u odnosu na PG")).toBeTruthy();
    expect(screen.getByText("p.p.")).toBeTruthy();
  });

  it("writes the relative change in the format's locale", () => {
    render(
      <KpiCard
        label="Prihod"
        values={{ AC: 500, PY: 460 }}
        format={{ locale: "sr-Latn" }}
        animate={false}
      />,
    );
    expect(screen.getByText("+8,7%")).toBeTruthy();
  });
});

/* --------------------------- VarianceColumnChart --------------------------- */

describe("VarianceColumnChart - vertical error bars", () => {
  const drift = [
    { category: "Hunter", AC: 910.8, PY: 909.6, acError: 0.8, absError: 0.6 },
    { category: "Ret", AC: 890.5, PY: 892.9, acError: 1.2, absError: 0.9 },
  ];
  const fmt = { compact: false, locale: "sr-Latn", fractionDigits: 1 } as const;

  it("stands a vertical error bar on each AC column and each variance bar", () => {
    const container = ssr(
      <VarianceColumnChart data={drift} width={400} height={260} format={fmt} />,
    );
    const names = [...container.querySelectorAll("svg g[role='img']")].map((g) =>
      g.getAttribute("aria-label"),
    );
    expect(names).toEqual([
      `910,8\u00a0±\u00a00,8`,
      `890,5\u00a0±\u00a01,2`,
      `+1,2\u00a0±\u00a00,6`,
      `-2,4\u00a0±\u00a00,9`,
    ]);
    for (const g of container.querySelectorAll("svg g[role='img']")) {
      const [whisker] = inkLines(g);
      expect(whisker!.getAttribute("x1")).toBe(whisker!.getAttribute("x2"));
      expect(num(whisker!, "y1")).not.toBe(num(whisker!, "y2"));
    }
  });

  it("widens the value scale to the whisker's top and lifts the value label above it", () => {
    const container = ssr(
      <VarianceColumnChart data={drift} width={400} height={260} format={fmt} variance="none" />,
    );
    // No variance panel: topBase = 260 - 22 = 238, the scale spans 0 … 911.6
    // (910.8 + 0.8) over 238 - 14 (top padding) - 14 (label headroom) = 210px.
    const [hunter] = [...container.querySelectorAll("svg g[role='img']")];
    const [whisker] = inkLines(hunter!);
    const top = Math.min(num(whisker!, "y1"), num(whisker!, "y2"));
    expect(top).toBeCloseTo(238 - 210, 9);
    const label = [...container.querySelectorAll("svg text")].find(
      (t) => t.textContent === "910,8",
    )!;
    expect(num(label, "y")).toBeCloseTo(top - 5, 9);
  });

  it("puts the intervals in the screen-reader table and the tooltip", () => {
    const { container } = render(
      <VarianceColumnChart data={drift} width={400} height={260} format={fmt} />,
    );
    const row = within(container.querySelector("table")!).getByText("Hunter").closest("tr")!;
    const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells[0]).toBe(`910,8\u00a0±\u00a00,8`);
    expect(cells[2]).toBe(`+1,2\u00a0±\u00a00,6`);
    fireEvent.pointerMove(container.querySelector("svg rect[fill='transparent']")!, {
      clientX: 10,
      clientY: 10,
      pointerType: "mouse",
    });
    expect(screen.getByRole("tooltip").textContent).toContain(`910,8\u00a0±\u00a00,8`);
  });

  it("writes a pct variance's interval in percent and draws no error bar without errors", () => {
    const container = ssr(
      <VarianceColumnChart
        data={[{ category: "A", AC: 110, PY: 100, pctError: 0.5 }]}
        variance="pct"
        format={{ locale: "sr-Latn" }}
      />,
    );
    const names = [...container.querySelectorAll("svg g[role='img']")].map((g) =>
      g.getAttribute("aria-label"),
    );
    // The AC column has no error; the pct variance bar's is in percent units.
    expect(names).toEqual([`+10,0%\u00a0±\u00a00,5%`]);
    const plain = ssr(<VarianceColumnChart data={[{ category: "A", AC: 110, PY: 100 }]} />);
    expect(plain.querySelector("svg g[role='img']")).toBeNull();
  });
});
