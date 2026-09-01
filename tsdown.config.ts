import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/core/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  // Per-module output ("bundleless"): dist mirrors src, one file per module,
  // and the barrels stay pure re-exports. This is what makes the library
  // actually tree-shake in consumers - the previous single-bundle output
  // (tsup) fused every component into one module graph node, so importing
  // just `KpiCard` dragged in ~93% of the library (55 KB gzip measured by the
  // first consumer integration report). With preserved modules a bundler
  // drops whole unused modules; `sideEffects: false` in package.json does the
  // rest. Both entries resolve to the SAME module files, so
  // `require("ibcs-react").defaultTokens === require("ibcs-react/core").defaultTokens`
  // holds by construction (no dual-package hazard) - asserted by
  // `scripts/verify-dist.mjs` after every build, alongside a bundle-size
  // guard in `scripts/verify-treeshake.mjs`.
  unbundle: true,
  // Keep the pre-tsdown file extensions (`type: "module"` package): ESM as
  // .js/.d.ts, CJS as .cjs/.d.cts - what package.json `exports` points at.
  outExtensions: ({ format }) =>
    format === "cjs" ? { js: ".cjs", dts: ".d.cts" } : { js: ".js", dts: ".d.ts" },
});
