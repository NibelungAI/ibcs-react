import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { TrendChart, VarianceColumnChart } from "../index";
import { cases } from "./fixtures";

/**
 * Server-render smoke tests (Node env, no jsdom). Every exported component must
 * `renderToString` without throwing and emit a non-empty string. This guards
 * SSR safety: no `window` / `document` / ResizeObserver access during render.
 */
describe("component SSR smoke tests", () => {
  for (const { name, element } of cases) {
    it(`${name} renders to a non-empty string on the server`, () => {
      let html = "";
      expect(() => {
        html = renderToString(element);
      }).not.toThrow();
      expect(html.length).toBeGreaterThan(0);
    });
  }
});

/** Every numeric `height="…"` on a `<rect>` in the markup, in document order. */
function rectHeights(html: string): number[] {
  return [...html.matchAll(/<rect\b[^>]*\bheight="([^"]*)"/g)]
    .map((m) => Number(m[1]))
    .filter((h) => Number.isFinite(h));
}

/**
 * Server markup must carry the FINISHED geometry, not the first frame of the
 * entrance animation. The mount-grow hook used to seed its progress at 0 (it
 * only learned about reduced motion in an effect, which never runs on the
 * server), so every server-rendered chart shipped collapsed `height="0"` bars —
 * an empty chart for crawlers, print, and everyone before hydration.
 */
describe("server-rendered chart geometry", () => {
  const data = [
    { category: "Q1", AC: 120, PY: 100 },
    { category: "Q2", AC: 90, PY: 110 },
    { category: "Q3", AC: 140, PY: 130 },
  ];

  it("renders full-size bars on the server (entrance animation is client-only)", () => {
    const html = renderToString(<VarianceColumnChart data={data} width={480} height={280} />);

    const heights = rectHeights(html);
    expect(heights.length).toBeGreaterThan(0);
    // One bar per category, plus the variance-panel bars — all non-zero here.
    expect(heights.filter((h) => h > 0).length).toBeGreaterThanOrEqual(3);
    // No collapsed geometry at all: not a single zero-height rect.
    expect(heights.filter((h) => h === 0)).toEqual([]);
  });

  it("keeps the value labels of a server-rendered chart", () => {
    const html = renderToString(<VarianceColumnChart data={data} width={480} height={280} />);
    expect(html).toContain("Q1");
    expect(html).toContain("Q3");
  });
});

/**
 * Summary-scale treatment (consumer report B3): the documented "year + total"
 * layout must keep the months legible. Server markup carries the finished
 * geometry, so it is the honest place to assert column heights.
 */
describe("TrendChart summary scale", () => {
  const months = Array.from({ length: 12 }, (_, i) => ({
    category: `M${i + 1}`,
    AC: 2_100_000 + i * 60_000,
    PY: 1_950_000 + i * 55_000,
  }));
  const year = [...months, { category: "FY", AC: 30_060_000, PY: 27_030_000, summary: true }];

  it("keeps the months legible next to an FY total and marks the break", () => {
    const html = renderToString(<TrendChart data={year} width={720} height={360} />);

    // Every month column still spans most of the plot (~135–180px of a 180px
    // scale here). Before the fix the total owned the domain and the months
    // collapsed to ~13px — this band is empty exactly when the bug is back.
    // The only other rects in this range would be the full-band hit targets
    // (336px) and legend swatches (9px), both far outside the band.
    const columns = rectHeights(html).filter((h) => h >= 100 && h <= 200);
    expect(columns.length).toBeGreaterThanOrEqual(13); // 12 months + capped FY

    // The capped column and its capped variance bar both carry the marked
    // scale break — the IBCS-legible "drawn shorter than its value" signal.
    expect((html.match(/data-scale-break/g) ?? []).length).toBeGreaterThanOrEqual(2);

    // The value label still states the real figure.
    expect(html).toContain("30.1M");
  });

  it("leaves the PY reference line out of the summary period", () => {
    const html = renderToString(<TrendChart data={year} width={720} height={360} />);
    // One PY dot per MONTH; the total is not a point in the time series.
    expect((html.match(/<circle/g) ?? []).length).toBe(12);
  });

  it("keeps a same-magnitude summary on the shared scale, without a break", () => {
    const avg = [...months, { category: "Ø", AC: 2_430_000, PY: 2_252_500, summary: true }];
    const html = renderToString(<TrendChart data={avg} width={720} height={360} />);
    expect(html).not.toContain("data-scale-break");
  });
});
