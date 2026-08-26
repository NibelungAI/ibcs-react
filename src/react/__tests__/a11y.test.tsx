/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { cases } from "./fixtures";

afterEach(cleanup);

/**
 * THE CHART ACCESSIBILITY CONTRACT.
 *
 * An `<svg>` is a picture: a screen reader can announce its `aria-label` and
 * nothing else. So every component that DRAWS DATA must also render the same
 * numbers as a real, visually-hidden `<table>` (see `ChartDataTable` in
 * `../a11y`) — row headers, column headers, a caption. This suite derives the
 * component list from the shared fixture catalogue, so a new chart is covered
 * the moment it gets a fixture; there is no list to keep in sync here.
 */

/**
 * Components that legitimately draw an `<svg>` with NO data table. Every entry
 * is a DECORATIVE-BY-DESIGN mark whose numbers are already reachable as text
 * elsewhere in the DOM — not a gap in the contract.
 */
const DECORATIVE_SVG = new Map<string, string>([
  [
    // A single in-table variance mark. It annotates the row it sits in, whose
    // value + Δ are already real table cells (see `tables.test.tsx`); a table
    // inside a table cell would only repeat them.
    "VarianceBar",
    "one variance mark annotating a table row that already carries the numbers",
  ],
  [
    // The card's numbers (value, comparison, Δ) are plain DOM text; the only svg
    // is the optional `Sparkline` trend hint beside them.
    "KpiCard",
    "svg is the decorative sparkline; the KPI numbers are DOM text in the card",
  ],
  [
    // A micro-chart with no axes, labels or scale by definition — the shape of a
    // series next to the number it belongs to.
    "Sparkline",
    "micro-chart trend hint with no axes or labels; deliberately decorative",
  ],
  [
    // Loading placeholder: `variant="chart"` draws grey shapes. There is no data
    // yet, so there is nothing to tabulate.
    "Skeleton",
    "loading placeholder — grey shapes, no data",
  ],
  [
    // The loading state renders the same `Skeleton`; the real chart (with its
    // table) replaces it once data arrives.
    "ChartState",
    "renders Skeleton while loading — no data",
  ],
]);

/**
 * Two more exclusions worth spelling out, both of which render NO svg inside the
 * container and so never reach the assertion below:
 *  - `ChartTooltip` portals to `document.body` and repeats numbers a hovered
 *    chart already exposes in its own table;
 *  - `ExportMenu` renders only its trigger (a button) plus a menu — no marks.
 * They are left out of `DECORATIVE_SVG` on purpose: adding them would claim they
 * draw svg, and the staleness check below would fail.
 */

/** Render one fixture and report what kinds of node it produced. */
function shapeOf(element: (typeof cases)[number]["element"]) {
  const { container } = render(element);
  return {
    svg: container.querySelector("svg") != null,
    table: container.querySelector("table") != null,
    container,
  };
}

describe("chart accessibility: svg charts expose a data table", () => {
  for (const { name, element } of cases) {
    if (DECORATIVE_SVG.has(name)) continue;
    it(`${name} renders a data table beside its svg`, () => {
      const { svg, table } = shapeOf(element);
      if (!svg) {
        // Not a chart (a table component, a layout wrapper, a report block) —
        // nothing to assert, its content is already semantic DOM.
        expect(svg).toBe(false);
        return;
      }
      expect(
        table,
        `${name} draws an <svg> but renders no <table>: screen-reader users cannot reach its numbers. Render a <ChartDataTable> as a sibling of the svg (see VarianceColumnChart), or justify an exclusion in DECORATIVE_SVG.`,
      ).toBe(true);
    });
  }

  it("every DECORATIVE_SVG exclusion still draws an svg (no stale entries)", () => {
    const stale: string[] = [];
    for (const [name] of DECORATIVE_SVG) {
      const fixture = cases.find((c) => c.name === name);
      if (!fixture) {
        stale.push(`${name} (no fixture)`);
        continue;
      }
      const { svg } = shapeOf(fixture.element);
      cleanup();
      if (!svg) stale.push(`${name} (renders no svg)`);
    }
    expect(
      stale,
      `stale decorative-svg exclusion(s): ${stale.join(", ")} — drop them from DECORATIVE_SVG`,
    ).toEqual([]);
  });
});

/** The cells of the row whose row-header is `label`, within `container`. */
function rowCells(container: HTMLElement, label: string): string[] {
  const row = [...container.querySelectorAll("table tbody tr")].find(
    (tr) => tr.querySelector("th")?.textContent === label,
  );
  if (!row) throw new Error(`no data row labelled "${label}"`);
  return [...row.querySelectorAll("td")].map((td) => td.textContent ?? "");
}

/**
 * The table must carry the chart's REAL numbers, formatted the way the chart
 * labels them — an empty or placeholder table would satisfy the check above.
 * Two representative charts from this pass stand in for the rest.
 */
describe("chart data tables carry the fixture's formatted values", () => {
  it("PieChart tabulates each slice's value and its share of the whole", () => {
    const fixture = cases.find((c) => c.name === "PieChart");
    const { container, table } = shapeOf(fixture!.element);
    expect(table).toBe(true);

    const headers = [...container.querySelectorAll("table thead th")].map((th) => th.textContent);
    expect(headers).toEqual(["", "Value", "Share"]);
    // Fixture: EMEA 40, Americas 35, APAC 25 (whole = 100).
    expect(rowCells(container, "EMEA")).toEqual(["40", "40.0%"]);
    expect(rowCells(container, "APAC")).toEqual(["25", "25.0%"]);
    expect(rowCells(container, "Total")).toEqual(["100", "100.0%"]);
  });

  it("ScatterChart tabulates each point's coordinates and group", () => {
    const fixture = cases.find((c) => c.name === "ScatterChart");
    const { container, table } = shapeOf(fixture!.element);
    expect(table).toBe(true);

    const headers = [...container.querySelectorAll("table thead th")].map((th) => th.textContent);
    expect(headers).toEqual(["", "X", "Y", "Group"]);
    // Fixture: (1,2) group A, (3,5) group A, (4,1) group B — unlabelled points.
    expect(rowCells(container, "Point 1")).toEqual(["1", "2", "A"]);
    expect(rowCells(container, "Point 3")).toEqual(["4", "1", "B"]);
  });
});
