import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { cases } from "./fixtures";

/**
 * Deterministic markup snapshots — the always-on half of the visual regression
 * story (the pixel half lives in `tests/visual/`, see CONTRIBUTING.md).
 *
 * Every fixture from the shared catalogue is server-rendered and its markup is
 * snapshotted. `renderToString` is pure and the layout maths is float-stable, so
 * this is flake-free in Node while still catching what unit tests miss: a bar
 * that moved four pixels, a lost `<defs>` hatch, a dropped aria attribute, a
 * colour token that resolves differently.
 *
 * When a diff shows up, read it: an intended geometry/markup change is accepted
 * with `npx vitest run -u`, an unintended one is a regression.
 */

/**
 * Where generated ids surface in the markup. `useId()` output is stable for a
 * given tree, but it shifts whenever an unrelated component is added above a
 * chart — normalizing keeps those churn-only diffs out of the snapshots.
 */
const ID_PATTERNS: RegExp[] = [
  // Fragment definitions and aria targets: id="…".
  /\sid="([^"]*)"/g,
  // Paint-server references: fill="url(#…)".
  /url\(#([^)]*)\)/g,
  // SmallMultiples' generated grid class (id-derived, never in an id attribute).
  /ibcs-sm-[A-Za-z0-9_-]+/g,
];

/**
 * Replace every generated id with a stable `ID1`, `ID2`, … placeholder, numbered
 * in document order, so `url(#…)` references keep matching their `<defs>` entry.
 */
function normalizeIds(html: string): string {
  const hits: { index: number; token: string }[] = [];
  for (const pattern of ID_PATTERNS) {
    for (const match of html.matchAll(pattern)) {
      const token = match[1] ?? match[0];
      if (token) hits.push({ index: match.index ?? 0, token });
    }
  }
  hits.sort((a, b) => a.index - b.index);

  const placeholders = new Map<string, string>();
  for (const { token } of hits) {
    if (!placeholders.has(token)) placeholders.set(token, `ID${placeholders.size + 1}`);
  }

  // Longest token first: `ibcs-sm-r0` must be rewritten before the `r0` it contains.
  let out = html;
  for (const [token, placeholder] of [...placeholders].sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(token).join(placeholder);
  }
  return out;
}

/** One tag per line: turns the snapshot diff into something a human can read. */
function readable(html: string): string {
  return html.split("><").join(">\n<");
}

describe("component markup snapshots", () => {
  for (const { name, element } of cases) {
    it(`${name} renders stable markup`, () => {
      expect(readable(normalizeIds(renderToString(element)))).toMatchSnapshot();
    });
  }
});
