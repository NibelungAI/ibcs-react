import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Dev server for the visual regression harness - deliberately separate from the
 * demo config so screenshots never depend on demo content or docs layout.
 *
 * Started by `playwright.config.ts`'s `webServer` block; run it by hand with
 * `npx vite --config tests/visual/vite.config.ts` to eyeball the fixtures.
 */
export default defineConfig({
  // Absolute, so the config works regardless of the cwd Playwright launches from.
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      // Same source alias as the demo: the harness renders the library from
      // `src/`, never from a stale `dist/`.
      "ibcs-react": fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
    },
  },
  server: {
    // Explicit IPv4: the default `localhost` binding resolves to ::1 only on
    // some machines, and Playwright's `webServer.url` poll would never connect.
    host: "127.0.0.1",
    // Fixed port, no fallback: `playwright.config.ts` waits on exactly this URL.
    port: 5174,
    strictPort: true,
    open: false,
  },
});
