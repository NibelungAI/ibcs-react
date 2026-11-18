/** @vitest-environment jsdom */
/**
 * CALLER-GIVEN WORDS: every fixed word a component writes can be replaced
 * through `labels` (an `IbcsThemeProvider`'s or the component's own), and the
 * defaults stay 1.4's (the markup snapshots prove that half).
 *
 * The invariant test renders every fixture under a provider whose words are
 * ALL replaced by sentinels, then scans what a user can read or hear - text,
 * `aria-label` and `title` - for any default word left behind; a second pass
 * hovers each fixture's hit targets and scans the tooltip the same way. A
 * chart's own accessible-name sentence and its table caption are left out of
 * the scan on purpose: they are English sentences, replaced whole by
 * `ariaLabel` (tested below), not word by word. Numbers' "n/a" belongs to
 * `format.notAvailable`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import {
  ChartState,
  ConformanceReport,
  DataTable,
  ExportMenu,
  HistogramChart,
  IbcsThemeProvider,
  MatrixTable,
  MiniVarianceMultiples,
  RankingVarianceChart,
  Skeleton,
  StatementTable,
  TrendChart,
  VarianceColumnChart,
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
 * either side, case-sensitive - except that a leading "Δ" does not hide one, so
 * a default "PL" in "ΔPL" is caught); a template must match whole, its
 * placeholders as wildcards. A template with no fixed word of its own ("{name}
 * {value}") has nothing to find and is not scanned.
 */
const DEFAULT_WORDS: Array<{ path: string; re: RegExp }> = leaves(defaultLabels)
  .filter(([, word]) => /[\p{L}\p{N}]/u.test(word.replace(/\{\w+\}/g, "")))
  .map(([path, word]) => {
    const body = word
      .split(/\{\w+\}/)
      .map(escape)
      .join(".+?");
    return {
      path,
      re: new RegExp(`(?<!(?!Δ)[\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u"),
    };
  });

/** The default words in a string, as "path in \"string\"". */
const offendersIn = (s: string) =>
  DEFAULT_WORDS.filter((w) => w.re.test(s)).map((w) => `${w.path} in "${s}"`);

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
  DataTable: new Set(["ΔPY"]), // its column's own label
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
      const offenders = [...texts.filter((t) => !own?.has(t)), ...attributes].flatMap(offendersIn);
      expect(offenders).toEqual([]);
    });
  }

  /** The open tooltip's text: a ChartTooltip, or StatementTable's fixed-position row tooltip. */
  const tooltipText = () =>
    (screen.queryByRole("tooltip") ?? document.body.querySelector("[style*='position: fixed']"))
      ?.textContent;

  it("tooltips write no default word under replaced labels", () => {
    // Hover every transparent hit target, path and table row of every fixture
    // (jsdom cannot measure the svg, so proximity gating is off and each hover
    // shows its tooltip), and scan each tooltip's text. Under reduced motion
    // every chart draws its finished marks on the first frame, so a mark that
    // grows in (a pie's slices) is there to hover.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const shown = new Set<string>();
    const offenders: string[] = [];
    try {
      for (const { name, element } of [...cases, ...featureCases]) {
        if (CALLER_WORDS_ONLY.has(name)) continue;
        const { container } = render(
          <IbcsThemeProvider labels={sentinels}>{element}</IbcsThemeProvider>,
        );
        const targets = container.querySelectorAll(
          "svg rect[fill='transparent'], svg path, tbody tr",
        );
        for (const target of targets) {
          fireEvent.pointerMove(target, { clientX: 10, clientY: 10, pointerType: "mouse" });
          const tip = tooltipText();
          if (!tip) continue;
          shown.add(name);
          offenders.push(...offendersIn(tip).map((o) => `${name}: ${o}`));
        }
        cleanup();
      }
    } finally {
      vi.unstubAllGlobals();
    }
    expect(offenders).toEqual([]);
    // Not vacuous, and complete: every component with a built-in tooltip
    // opened it.
    for (const name of [
      "BarVarianceWaterfallChart",
      "ColumnVarianceWaterfallChart",
      "GroupedVarianceChart",
      "HistogramChart",
      "HorizontalWaterfallChart",
      "IntegratedVarianceChart",
      "PieChart",
      "RankingVarianceChart",
      "RatioTreeChart",
      "StackedChart",
      "StatementTable",
      "StructureChart",
      "TrendChart",
      "VarianceAreaChart",
      "VarianceColumnChart",
      "WaterfallChart",
      "WaterfallStatementChart",
    ]) {
      expect(shown).toContain(name);
    }
  });

  it("writes StatementTable's tooltip Δ caption from the delta template once one is set", () => {
    const lines = [{ id: "rev", label: "Revenue", values: { AC: 500, PY: 460 } }];
    render(<StatementTable lines={lines} animate={false} labels={{ scenario: { PY: "PG" } }} />);
    const hover = () =>
      fireEvent.pointerMove(screen.getByText("Revenue").closest("tr")!, {
        clientX: 40,
        clientY: 60,
        pointerType: "mouse",
      });
    hover();
    // 1.4's spaced caption while `delta` is the default, with the caller's word.
    expect(tooltipText()).toContain("Δ PG");
    cleanup();
    render(
      <StatementTable
        lines={lines}
        animate={false}
        labels={{ scenario: { PY: "PG" }, delta: "Razlika {base}" }}
      />,
    );
    hover();
    expect(tooltipText()).toContain("Razlika PG");
  });

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
    // A default code right after a "Δ" is still found, and so is a fixed "Δ".
    expect(DEFAULT_WORDS.find((w) => w.path === "scenario.PL")!.re.test("ΔPL")).toBe(true);
    expect(DEFAULT_WORDS.find((w) => w.path === "delta")!.re.test("Δ ζ3")).toBe(true);
    expect(DEFAULT_WORDS.find((w) => w.path === "scenario.PL")!.re.test("PLAN")).toBe(false);
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

  it("names selectable marks with a heading when the scenario word is empty (no double space)", () => {
    render(
      <VarianceColumnChart
        data={[{ category: "Q1", AC: 120, PY: 100 }]}
        onSelect={() => {}}
        labels={{ scenario: { AC: "" } }}
      />,
    );
    expect(screen.getByRole("button", { name: "Select Q1, Actual 120" })).toBeTruthy();
    cleanup();
    render(
      <TrendChart
        data={[{ category: "Q1", AC: 120, PY: 100 }]}
        onSelect={() => {}}
        labels={{ scenario: { AC: "" } }}
      />,
    );
    expect(screen.getByRole("button", { name: "Select Q1, Actual 120" })).toBeTruthy();
  });

  it("writes the Δ headers from the delta and deltaPct templates", () => {
    const html = renderToStaticMarkup(
      <RankingVarianceChart
        data={[{ label: "A", AC: 2, base: 1 }]}
        labels={{
          delta: "Razlika {base}",
          deltaPct: "Razlika {base} u %",
          scenario: { PL: "plan" },
        }}
      />,
    );
    expect(html).toContain(">Razlika plan<");
    expect(html).toContain(">Razlika plan u %<");
    expect(html).not.toContain("Δ");
  });

  it("writes every HistogramChart word - mean, spread, n, count, share - from the dictionary", () => {
    const sentinels = sentinelLabels();
    const element = (
      <HistogramChart
        values={[1, 2, 2, 3, 3, 3, 4, 4, 5]}
        binning={{ bins: 5 }}
        mean={{ value: 3, halfWidth: 0.4, level: 0.95 }}
        title="DPS"
      />
    );
    // The defaults, unreplaced: each of the five words is there to be replaced.
    const plain = render(element);
    const plainText = plain.container.textContent ?? "";
    for (const word of ["Mean 3.00", "Middle half 2–4", "n = 9", "Count", "Share"]) {
      expect(plainText).toContain(word);
    }
    cleanup();
    const html = renderToStaticMarkup(
      <IbcsThemeProvider labels={sentinels}>{element}</IbcsThemeProvider>,
    );
    const { texts, attributes } = heardStrings(html);
    expect([...texts, ...attributes].flatMap(offendersIn)).toEqual([]);
    // Not vacuous: the sentinels took the five words' places.
    for (const path of ["mean", "spread", "sampleSize", "count", "share"] as const) {
      const word = sentinels[path].split(" ")[0]!;
      expect(texts.some((t) => t.startsWith(word))).toBe(true);
    }
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
