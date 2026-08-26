import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { VarianceColumnChart } from "../index";
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
