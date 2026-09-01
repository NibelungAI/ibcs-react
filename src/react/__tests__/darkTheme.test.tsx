import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import {
  ChartState,
  ExportMenu,
  IbcsThemeProvider,
  KpiCard,
  MatrixTable,
  Skeleton,
  StatementTable,
  TrendChart,
} from "../index";
import { defaultTokens, tokenPresets } from "../../core/tokens";

/**
 * The Dark preset has to actually reach the pixels. Components used to hardcode
 * `#fff` for every card, menu, tooltip and sticky cell, so selecting `Dark`
 * produced white chrome with light-on-dark ink - unreadable. `color.surface` /
 * `color.surfaceMuted` / `color.onFill` and `font.family` exist to close that
 * hole; these tests fail the moment a component paints a background from a
 * literal again.
 */

const lines = [
  { id: "rev", label: "Revenue", flow: "add" as const, values: { AC: 500, PY: 460 } },
  { id: "cogs", label: "COGS", flow: "subtract" as const, values: { AC: 300, PY: 280 } },
  { id: "gp", label: "Gross profit", flow: "result" as const, values: { AC: 200, PY: 180 } },
];

const series = [
  { category: "Q1", values: { AC: 120, PY: 100 } },
  { category: "Q2", values: { AC: 140, PY: 130 } },
];

/** One render of the chrome-heavy surface area: cards, tables, menus, a chart. */
function scene() {
  return (
    <>
      <KpiCard label="Revenue" values={{ AC: 500, PY: 460 }} animate={false} />
      <StatementTable lines={lines} />
      <MatrixTable
        rows={[{ id: "rev", label: "Revenue" }]}
        columns={[{ id: "y24", label: "2024" }]}
        values={{ rev: { y24: { AC: 120 } } }}
        scenarios={["AC"]}
        stickyFirstColumn
      />
      <ExportMenu filename="chart" csv="a,b">
        <svg viewBox="0 0 100 50" width={100} height={50} />
      </ExportMenu>
      <TrendChart data={series} width={400} height={260} />
      <Skeleton variant="table" />
      <ChartState error={new Error("boom")} onRetry={() => {}} />
    </>
  );
}

/**
 * Every white background in the markup - from both `style="…"` attributes and
 * the `<style>` blocks the tables inject. Scoped to background declarations on
 * purpose: an in-bar label (`color` / `fill`) may legitimately be near-white in
 * a light theme, a surface may not be white in a dark one.
 */
function whiteBackgrounds(html: string): string[] {
  return [...html.matchAll(/background(?:-color)?\s*:\s*(#fff\b|#ffffff\b|white\b)/gi)].map(
    (m) => m[0],
  );
}

const darkTokens = tokenPresets.dark;
const darkHtml = renderToString(
  <IbcsThemeProvider tokens={darkTokens}>{scene()}</IbcsThemeProvider>,
);
const lightHtml = renderToString(scene());

describe("the Dark preset themes the component chrome", () => {
  it("paints no white background anywhere - inline styles or injected CSS", () => {
    expect(whiteBackgrounds(darkHtml)).toEqual([]);
  });

  it("paints its surfaces with the preset's dark surface colours", () => {
    expect(darkHtml).toContain(`background:${darkTokens.color.surface}`);
    // …and the muted fill (skeleton bars) follows the same theme.
    expect(darkHtml).toContain(darkTokens.color.surfaceMuted);
  });

  it("leaves no white SVG fill or stroke either (hollow frames, markers, labels)", () => {
    expect(darkHtml).not.toMatch(/(?:fill|stroke)="(?:#fff|#ffffff|white)"/i);
  });

  it("still paints white surfaces on the default theme (the sweep stayed literal-for-token)", () => {
    // Guards against an over-zealous sweep: the light theme must not have
    // silently gone grey.
    expect(whiteBackgrounds(lightHtml).length).toBeGreaterThan(0);
    expect(lightHtml).toContain(`background:${defaultTokens.color.surface}`);
  });
});

describe("font.family", () => {
  it("reaches the components' styles from the default theme", () => {
    expect(lightHtml).toContain(`font-family:${defaultTokens.font.family}`);
  });

  it("follows a provider override", () => {
    const html = renderToString(
      <IbcsThemeProvider tokens={{ font: { family: "Iosevka Etoile" } }}>
        <KpiCard label="Revenue" values={{ AC: 500 }} animate={false} />
      </IbcsThemeProvider>,
    );
    expect(html).toContain("font-family:Iosevka Etoile");
    expect(html).not.toContain(defaultTokens.font.family);
  });
});
