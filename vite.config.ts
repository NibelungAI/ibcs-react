import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Demo harness config. The demo app (`/demo`) imports the library through the
 * `ibcs-react` alias pointed straight at source, so component edits hot-reload
 * without a build step.
 */
export default defineConfig({
  plugins: [react()],
  // The library build (tsdown) owns `dist/`. Keep the demo bundle out of it so
  // `npm run demo:build` never clobbers the publishable package.
  build: {
    outDir: "demo-dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "ibcs-react": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5180,
    open: false,
    // Demo is shared over tunnels / netbird / LAN IPs - allow any Host header.
    // (Vite blocks unknown hosts by default; `true` disables that check.)
    allowedHosts: true,
  },
});
