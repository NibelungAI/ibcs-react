/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import * as api from "../index";
import { cases } from "./fixtures";

afterEach(cleanup);

/**
 * Components deliberately left out of the smoke fixtures: context plumbing that
 * renders only its children, so a mount fixture would assert nothing about it.
 * Their behaviour is covered by the token-resolution tests instead.
 */
const NOT_SMOKE_TESTED = new Set(["IbcsThemeProvider"]);

/**
 * Is this barrel export a React component? Both shapes count: a plain function
 * component, and the exotic objects produced by `forwardRef` / `memo`, which
 * are objects carrying a `$$typeof` marker rather than functions.
 */
function isComponentLike(value: unknown): boolean {
  if (typeof value === "function") return true;
  return typeof value === "object" && value !== null && "$$typeof" in value;
}

/**
 * The component surface, derived from the PUBLIC barrel rather than a hardcoded
 * count — a new export shows up here the moment it is added. A non-component
 * capitalized export (a class, a helper) would land here too; add it to
 * `NOT_SMOKE_TESTED` with a reason if that ever happens.
 */
const exportedComponents = Object.entries(api)
  .filter(
    ([name, value]) => /^[A-Z]/.test(name) && isComponentLike(value) && !NOT_SMOKE_TESTED.has(name),
  )
  .map(([name]) => name)
  .sort();

/**
 * Mount smoke tests: every exported component renders without throwing and
 * produces non-empty DOM. Guards against crashes on mount (bad hooks, undefined
 * reads, broken geometry, etc.).
 */
describe("component render smoke tests", () => {
  for (const { name, element } of cases) {
    it(`${name} mounts and renders non-empty DOM`, () => {
      const { container } = render(element);
      // A real rendered surface — chart (svg), table, or a container div.
      // Portaled components (ChartTooltip) mount into document.body instead
      // of the container, so fall back to the document when it is empty.
      const root = container.innerHTML.length > 0 ? container : document.body;
      expect(root.querySelector("svg, table, div")).toBeTruthy();
      expect(root.innerHTML.length).toBeGreaterThan(0);
    });
  }

  it("covers every exported component (no silent gaps)", () => {
    const fixtured = new Set(cases.map((c) => c.name));
    const missing = exportedComponents.filter((name) => !fixtured.has(name));
    expect(
      missing,
      `no smoke fixture for exported component(s): ${missing.join(", ")} — add one to src/react/__tests__/fixtures.tsx`,
    ).toEqual([]);
  });

  it("has no fixtures for components the barrel no longer exports", () => {
    const known = new Set([...exportedComponents, ...NOT_SMOKE_TESTED]);
    const stale = cases.map((c) => c.name).filter((name) => !known.has(name));
    expect(stale, `fixture(s) for non-exported component(s): ${stale.join(", ")}`).toEqual([]);
  });
});
