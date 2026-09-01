import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression config - opt-in, never part of `npm test`.
 *
 * `npm run test:visual` compares the fixture catalogue against committed PNG
 * baselines; `npm run test:visual:update` rewrites them. Baselines are stored
 * per platform (`tests/visual/__screenshots__/<platform>/`) because font
 * rasterization and antialiasing differ between Windows, macOS and Linux - only
 * the Linux set is committed, produced by `.github/workflows/visual.yml`. See
 * the "Visual regression" section of CONTRIBUTING.md.
 */

/** Harness dev-server port. Must match `server.port` in tests/visual/vite.config.ts. */
const PORT = 5174;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/visual",
  // Vitest owns `*.test.*` / `*.spec.*` repo-wide, so the Playwright specs use a
  // `.pw.ts` suffix: each file belongs to exactly one runner, no cross-pickup.
  testMatch: /.*\.pw\.ts$/,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  // One worker: screenshots are the one thing worth serializing - parallel
  // Chromium instances share the GPU/compositor and produce flakier output.
  workers: 1,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  // Platform-scoped baselines, no project/suffix noise in the filename.
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      // ~0.1% of pixels may differ: absorbs subpixel antialiasing on text edges
      // without letting a moved bar or a changed colour through.
      maxDiffPixelRatio: 0.001,
      // Keep the 2x device pixels instead of downscaling to CSS pixels.
      scale: "device",
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // The charts honour `prefers-reduced-motion`, so this freezes every entrance
    // animation at its final frame - no waiting, no half-drawn bars.
    reducedMotion: "reduce",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: "npx vite --config tests/visual/vite.config.ts",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !isCI,
    stdout: "ignore",
    timeout: 60_000,
  },
});
