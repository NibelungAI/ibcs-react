import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", "core/index": "src/core/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  // Both entries re-export the same modules (`ibcs-react` re-exports
  // `ibcs-react/core`). Without code splitting every entry gets its own private
  // copy, so `require("ibcs-react").defaultTokens !== require("ibcs-react/core")
  // .defaultTokens` — a dual-package hazard that breaks identity checks and
  // doubles the bytes. Splitting is on by default for ESM; `splitting: true`
  // opts the CJS build in as well (tsup flags CJS splitting experimental — it is
  // smoke-tested after every build by `scripts/verify-dist.mjs`).
  splitting: true,
});
