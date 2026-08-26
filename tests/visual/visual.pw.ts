import { expect, test } from "@playwright/test";

/**
 * Pixel regression over the shared fixture catalogue.
 *
 * The fixture names are read back from the harness DOM (`data-fixture`) instead
 * of being imported: the catalogue is a `.tsx` module that pulls in the whole
 * library, and duplicating the names in a list here would rot. One page load,
 * one screenshot per cell.
 *
 * Everything runs inside a single test with `expect.soft` + `test.step` so a
 * first diff does not hide the other 40: the HTML report lists one step per
 * fixture, each with its expected/actual/diff attachment.
 *
 * File suffix is `.pw.ts`, not `.spec.ts`, because Vitest globs `*.spec.*`
 * repo-wide — this file must belong to exactly one runner.
 */
test("every fixture matches its baseline screenshot", async ({ page }) => {
  await page.goto("/");
  // The harness sets this once fonts are ready and the measuring components
  // have re-rendered at their real size.
  await page.waitForSelector("html[data-visual-ready='true']");

  const names = await page
    .locator("[data-fixture]")
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-fixture") ?? ""));

  // Guards against screenshotting an empty page if the harness fails to mount.
  expect(names.length).toBeGreaterThan(20);

  for (const name of names) {
    await test.step(name, async () => {
      await expect.soft(page.locator(`[data-fixture="${name}"]`)).toHaveScreenshot(`${name}.png`);
    });
  }
});
