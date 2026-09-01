/**
 * Visual regression harness entry.
 *
 * Renders the shared smoke-test catalogue (the same `cases` array that drives
 * `render.test.tsx` / `ssr.test.tsx` / `markup.test.tsx`) into one fixed-width
 * cell per fixture, tagged `data-fixture="<name>"`. `visual.pw.ts` discovers the
 * cells from the DOM and screenshots them individually, so adding a fixture to
 * the catalogue automatically adds a screenshot - nothing to keep in sync here.
 *
 * Not part of the published package: `files` ships `dist` only.
 */
import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { cases } from "../../src/react/__tests__/fixtures";

/**
 * Width of every fixture cell. Charts that measure their container
 * (ResponsiveChart, ChartFrame, SmallMultiples, …) resolve against this, so it
 * must stay fixed - changing it invalidates every baseline.
 */
const CELL_WIDTH = 480;

function Harness() {
  useEffect(() => {
    let cancelled = false;
    // Signal "safe to screenshot" only once fonts are resolved and the
    // container-measuring components have had a frame to re-render at their
    // real size. Entrance animations are frozen by `reducedMotion: "reduce"`.
    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) document.documentElement.dataset.visualReady = "true";
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {cases.map(({ name, element }) => (
        <section key={name} id={name} data-fixture={name} style={{ width: CELL_WIDTH }}>
          {element}
        </section>
      ))}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
