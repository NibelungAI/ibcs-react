/** @vitest-environment jsdom */
/**
 * CALLER-GIVEN WORDS: every fixed word a component writes can be replaced
 * through `labels` (an `IbcsThemeProvider`'s or the component's own), and the
 * defaults stay 1.4's (the markup snapshots prove that half).
 *
 * The invariant test renders every fixture under a provider whose words are
 * ALL replaced by sentinels, then scans what a user can read or hear - text,
 * `aria-label` and `title` - for any default word left behind. A chart's own
 * accessible-name sentence and its table caption are left out of the scan on
 * purpose: they are English sentences, replaced whole by `ariaLabel` (tested
 * below), not word by word. Numbers' "n/a" belongs to `format.notAvailable`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  ChartState,
  ConformanceReport,
  DataTable,
  ExportMenu,
  IbcsThemeProvider,
  MatrixTable,
  MiniVarianceMultiples,
  RankingVarianceChart,
  Skeleton,
  StatementTable,
  TrendChart,
  defaultLabels,
  type IbcsLabels,
} from "../../index";
import { cases, featureCases } from "./fixtures";

afterEach(cleanup);

/* --------------------------- the sentinel words --------------------------- */

/** Every string leaf of the dictionary, with its dotted path. */
function leaves(o: object, path: string[] = []): Array<[string, string]> {
  return Object.entries(o).flatMap(
    ([k, v]): Array<[string, string]> =>
      typeof v === "string" ? [[[...path, k].join("."), v]] : leaves(v as object, [...path, k]),
  );
}

/** The same dictionary with each word replaced by "ζ<n>" (templates keep their placeholders). */
function sentinelLabels(): IbcsLabels {
  let i = 0;
  const walk = (o: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => {
        if (typeof v !== "string") return [k, walk(v as Record<string, unknown>)];
        const placeholders = v.match(/\{\w+\}/g) ?? [];
        return [k, [`ζ${i++}`, ...placeholders].join(" ")];
      }),
    );
  return walk(defaultLabels as unknown as Record<string, unknown>) as unknown as IbcsLabels;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One matcher per default word: a word must stand alone (no letter or digit
 * either side, case-sensitive); a template must match whole, its placeholders
 * as wildcards.
 */
const DEFAULT_WORDS: Array<{ path: string; re: RegExp }> = leaves(defaultLabels).map(
  ([path, word]) => {
    const body = word
      .split(/\{\w+\}/)
      .map(escape)
      .join(".+?");
    return { path, re: new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u") };
  },
);

/**
 * What a user reads or hears in server markup - text nodes, and `aria-label` /
 * `title` attributes - minus each chart's own name sentence and caption.
 */
function heardStrings(html: string): { texts: string[]; attributes: string[] } {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("style, caption").forEach((n) => n.remove());
  const texts: string[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim();
    if (t) texts.push(t);
  }
  const attributes: string[] = [];
  for (const el of doc.body.querySelectorAll("[aria-label], [title]")) {
    const isChartName = el.tagName.toLowerCase() === "svg" && el.getAttribute("role") === "img";
    const label = el.getAttribute("aria-label");
    if (label && !isChartName) attributes.push(label);
    const title = el.getAttribute("title");
    if (title) attributes.push(title);
  }
  return { texts, attributes };
}

/**
 * Fixtures whose words are the caller's own (they print exactly what the
 * fixture passes), and text a fixture passes as content (a child, a title) -
 * skipped as text only; attributes are always scanned.
 */
const CALLER_WORDS_ONLY = new Set(["ChartDataTable", "ChartTooltip"]);
const FIXTURE_TEXT: Record<string, ReadonlySet<string>> = {
  ExportMenu: new Set(["Export"]),
  ConfiguredChart: new Set(["Revenue vs PY"]),
};

describe("labels reach every fixed word", () => {
  const sentinels = sentinelLabels();

  for (const { name, element } of [...cases, ...featureCases]) {
    if (CALLER_WORDS_ONLY.has(name)) continue;
    it(`${name} writes no default word under replaced labels`, () => {
      const html = renderToStaticMarkup(
        <IbcsThemeProvider labels={sentinels}>{element}</IbcsThemeProvider>,
      );
      const { texts, attributes } = heardStrings(html);
      const own = FIXTURE_TEXT[name];
      const offenders = [...texts.filter((t) => !own?.has(t)), ...attributes].flatMap((s) =>
        DEFAULT_WORDS.filter((w) => w.re.test(s)).map((w) => `${w.path} in "${s}"`),
      );
      expect(offenders).toEqual([]);
    });
  }

  it("the scan itself sees default words (it is not vacuous)", () => {
    const html = renderToStaticMarkup(
      <RankingVarianceChart data={[{ label: "A", AC: 2, base: 1 }]} />,
    );
    const { texts } = heardStrings(html);
    expect(texts).toContain("AC");
    expect(texts).toContain("Total");
    expect(DEFAULT_WORDS.find((w) => w.path === "scenario.AC")!.re.test("AC 150")).toBe(true);
    expect(DEFAULT_WORDS.find((w) => w.path === "scenario.AC")!.re.test("TRACE")).toBe(false);
    expect(DEFAULT_WORDS.find((w) => w.path === "point")!.re.test("Point 3")).toBe(true);
  });
});

/* ------------------------------- precedence ------------------------------- */

const tableRows = [
  { id: "a", label: "A", values: { m: { AC: 120, PY: 100 } } },
  { id: "b", label: "B", values: { m: { AC: 90, PY: 95 } } },
];

function textOf(element: ReactElement): string {
  return render(element).container.textContent ?? "";
}

describe("labels precedence", () => {
  it("a component's labels win over the provider's, which win over the defaults", () => {
    const html = renderToStaticMarkup(
      <IbcsThemeProvider labels={{ total: "Ukupno", scenario: { PL: "Plan" } }}>
        <RankingVarianceChart data={[{ label: "A", AC: 2, base: 1 }]} />
        <RankingVarianceChart data={[{ label: "A", AC: 2, base: 1 }]} labels={{ total: "Svega" }} />
      </IbcsThemeProvider>,
    );
    expect(html).toContain(">Ukupno<");
    expect(html).toContain(">Svega<");
    expect(html).toContain("ΔPlan");
  });

  it("nested providers compose", () => {
    const html = renderToStaticMarkup(
      <IbcsThemeProvider labels={{ total: "Ukupno" }}>
        <IbcsThemeProvider labels={{ scenario: { AC: "Ostvareno" } }}>
          <RankingVarianceChart data={[{ label: "A", AC: 2, base: 1 }]} />
        </IbcsThemeProvider>
      </IbcsThemeProvider>,
    );
    expect(html).toContain(">Ukupno<");
    expect(html).toContain(">Ostvareno<");
  });

  it("a component's own word props win over labels", () => {
    const columns = [{ key: "m", label: "M" }];
    expect(
      textOf(
        <DataTable
          columns={columns}
          rows={tableRows}
          showTotals
          totalsLabel="Sum"
          labels={{ total: "Ukupno" }}
        />,
      ),
    ).toContain("Sum");
    cleanup();
    expect(
      textOf(
        <DataTable columns={columns} rows={tableRows} showTotals labels={{ total: "Ukupno" }} />,
      ),
    ).toContain("Ukupno");
    cleanup();
    expect(textOf(<ChartState empty emptyMessage="Nema" labels={{ noData: "Prazno" }} />)).toBe(
      "Nema",
    );
    cleanup();
    expect(textOf(<ChartState empty labels={{ noData: "Prazno" }} />)).toBe("Prazno");
    cleanup();
    const sk = render(<Skeleton label="Učitava se" labels={{ loading: "x" }} />);
    expect(sk.container.querySelector("[role='status']")!.getAttribute("aria-label")).toBe(
      "Učitava se",
    );
    cleanup();
    const own = render(<Skeleton labels={{ loading: "Učitava se" }} />);
    expect(own.container.querySelector("[role='status']")!.getAttribute("aria-label")).toBe(
      "Učitava se",
    );
  });

  it("a non-scenario baseLabel is written as given; a scenario one takes its word", () => {
    const own = renderToStaticMarkup(
      <RankingVarianceChart data={[{ label: "A", AC: 2, base: 1 }]} baseLabel="Budget" />,
    );
    expect(own).toContain("ΔBudget");
    const scenario = renderToStaticMarkup(
      <RankingVarianceChart
        data={[{ label: "A", AC: 2, base: 1 }]}
        baseLabel="PY"
        labels={{ scenario: { PY: "PG" } }}
      />,
    );
    expect(scenario).toContain("ΔPG");
  });
});

/* ------------------------- states the fixtures don't show ------------------------- */

describe("labels in interactive and conditional states", () => {
  it("names the export menu's trigger and items", () => {
    render(
      <ExportMenu
        csv="a,b"
        labels={{
          export: {
            menu: "Izvezi grafikon",
            button: "Izvezi",
            svg: "Preuzmi SVG",
            print: "Štampaj",
          },
        }}
      >
        <svg viewBox="0 0 10 10" width={10} height={10} />
      </ExportMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Izvezi grafikon" });
    expect(trigger.getAttribute("title")).toBe("Izvezi");
    fireEvent.click(trigger);
    const items = screen.getAllByRole("menuitem").map((b) => b.textContent);
    expect(items).toContain("Preuzmi SVG");
    expect(items).toContain("Štampaj");
    expect(items).toContain("CSV");
  });

  it("writes ChartState's error state in the caller's words", () => {
    render(
      <ChartState
        error={{ code: 1 }}
        onRetry={() => {}}
        labels={{ loadError: "Podaci nisu učitani", error: "Greška", retry: "Pokušaj ponovo" }}
      />,
    );
    expect(screen.getByText("Podaci nisu učitani")).toBeTruthy();
    expect(screen.getByText("Greška")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pokušaj ponovo" })).toBeTruthy();
  });

  it("names MatrixTable's toolbar, row and period buttons", () => {
    render(
      <MatrixTable
        rows={[{ id: "rev", label: "Revenue", children: [{ id: "svc", label: "Services" }] }]}
        columns={[{ id: "y", label: "2024", children: [{ id: "q1", label: "Q1" }] }]}
        values={{ rev: { q1: { AC: 1 } }, svc: { q1: { AC: 1 } } }}
        columnExpandControls
        labels={{
          expandAllPeriods: "Otvori sve periode",
          collapseAll: "Zatvori sve",
          collapseRow: "Zatvori red",
          collapse: "Zatvori",
          expand: "Otvori",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Otvori sve periode" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zatvori sve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zatvori red" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^(Otvori|Zatvori) 2024$/ })).toBeTruthy();
  });

  it("names StatementTable's toolbar and DataTable's chevrons", () => {
    render(
      <StatementTable
        lines={[
          {
            id: "rev",
            label: "Revenue",
            values: { AC: 5, PY: 4 },
            children: [{ id: "s", label: "S", values: { AC: 5, PY: 4 } }],
          },
        ]}
        expandControls
        animate={false}
        labels={{ expandAll: "Otvori sve", collapseAll: "Zatvori sve", collapse: "Zatvori" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Otvori sve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zatvori sve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zatvori" })).toBeTruthy();
    cleanup();
    render(
      <DataTable
        columns={[{ key: "m", label: "M" }]}
        rows={[{ id: "p", label: "P", values: {}, children: tableRows }]}
        labels={{ collapse: "Zatvori" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Zatvori" })).toBeTruthy();
  });

  it("writes ConformanceReport's no-findings line and severity tags", () => {
    expect(
      textOf(<ConformanceReport findings={[]} labels={{ conformant: "U skladu sa IBCS." }} />),
    ).toBe("U skladu sa IBCS.");
    cleanup();
    const text = textOf(
      <ConformanceReport
        findings={[{ rule: "r", severity: "warning", message: "m" }]}
        labels={{ severity: { warning: "upozorenje" } }}
      />,
    );
    expect(text).toContain("upozorenje");
  });

  it("names each MiniVarianceMultiples panel and writes its shared-scale caption", () => {
    const html = renderToStaticMarkup(
      <MiniVarianceMultiples
        groups={[{ label: "EMEA", data: [{ category: "Q1", AC: 120, PY: 100 }] }]}
        sharedScale
        labels={{
          miniPanel: "{label}: odstupanje po kategoriji",
          sharedScaleHint: "Zajednička skala ±{value} prema {base}",
          scenario: { PY: "PG" },
        }}
      />,
    );
    expect(html).toContain('aria-label="EMEA: odstupanje po kategoriji"');
    expect(html).toContain("Zajednička skala ±20 prema PG");
  });

  it("lays TrendChart's legend out for longer words without overlap", () => {
    const html = renderToStaticMarkup(
      <TrendChart
        data={[{ category: "Q1", AC: 120, PY: 100, PL: 110 }]}
        labels={{ scenario: { AC: "Ostvareno", PY: "Prošla godina" } }}
      />,
    );
    // Each word is placed from its estimated width (0.6em per glyph at 10.5px):
    // "Ostvareno" 56.7px → its swatch at x = -(56.7 + 16); the PY word 14px
    // further left; its line ends where "Prošla godina" (81.9px) begins.
    const doc = new DOMParser().parseFromString(html, "text/html");
    const legend = doc.querySelector("svg > g")!;
    const swatch = legend.querySelector("rect")!;
    expect(Number(swatch.getAttribute("x"))).toBeCloseTo(-72.7, 9);
    const py = [...legend.querySelectorAll("text")].find((t) => t.textContent === "Prošla godina")!;
    expect(Number(py.getAttribute("x"))).toBeCloseTo(-86.7, 9);
    const pyLine = legend.querySelector("line")!;
    expect(Number(pyLine.getAttribute("x2"))).toBeCloseTo(-86.7 - 81.9, 9);
  });
});
