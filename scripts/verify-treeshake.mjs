/**
 * Tree-shaking guard for the published artifact.
 *
 * The dist is built per-module (tsdown `unbundle`) precisely so that a
 * consumer importing one component pays for one component. That property is
 * invisible to unit tests and easy to destroy silently — one build-config
 * change and every consumer bundle re-inflates to the whole library (55 KB
 * gzip for a single KpiCard, as the first consumer integration report
 * measured against v1.0.0). This script bundles two real fixtures against
 * `dist/` the way a consumer's bundler would (esbuild, minified ESM, react
 * externalized, package.json `sideEffects` honoured) and fails the build
 * when the property regresses:
 *
 * 1. A KpiCard-only bundle must stay under BUDGET_GZIP — generous headroom
 *    over the measured ~4.2 KB, but an order of magnitude below the broken
 *    state, so drift is caught long before it hurts.
 * 2. It must not contain other components' aria-caption markers ("Bridge
 *    of" = WaterfallChart, "Composition of" = StructureChart, "Trend of" =
 *    TrendChart) — the exact leak the integration report demonstrated.
 * 3. A six-component bundle must still contain those markers — proving the
 *    check itself works and nothing was over-shaken away.
 *
 * Run after `npm run build`; part of `npm run ci` and the CI workflow.
 */
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distEntry = join(root, "dist/index.js");

/** KpiCard-only gzip budget, in bytes. Measured ~4.2 KB when introduced. */
const BUDGET_GZIP = 10_000;

/** Other components' aria markers that must NOT ride along with KpiCard. */
const MARKERS = ["Bridge of", "Composition of", "Trend of"];

const dir = mkdtempSync(join(tmpdir(), "ibcs-treeshake-"));
const fixtures = {
  kpiOnly: `import { KpiCard } from "ibcs-react";\nconsole.log(KpiCard);\n`,
  many: `import { KpiCard, TrendChart, VarianceColumnChart, StructureChart, WaterfallChart, StatementTable } from "ibcs-react";\nconsole.log(KpiCard, TrendChart, VarianceColumnChart, StructureChart, WaterfallChart, StatementTable);\n`,
};

/** Bundle a fixture the way a consumer's bundler would, return the minified code. */
async function bundleFixture(name, source) {
  const entry = join(dir, `${name}.mjs`);
  writeFileSync(entry, source);
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    // Resolve the package name onto the local dist. esbuild still finds the
    // repo package.json above dist/, so `sideEffects: false` applies exactly
    // as it would for an installed copy.
    alias: { "ibcs-react": distEntry },
    external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    write: false,
    logLevel: "silent",
  });
  return out.outputFiles[0].text;
}

const failures = [];
let passed = 0;
const check = (condition, message) => {
  if (condition) passed += 1;
  else failures.push(message);
};

try {
  const kpi = await bundleFixture("kpiOnly", fixtures.kpiOnly);
  const many = await bundleFixture("many", fixtures.many);
  const kpiGzip = gzipSync(Buffer.from(kpi)).length;
  const manyGzip = gzipSync(Buffer.from(many)).length;

  check(
    kpi.length > 2_000,
    `KpiCard-only bundle is implausibly small (${kpi.length} B) — the fixture no longer bundles the component`,
  );
  check(
    kpiGzip <= BUDGET_GZIP,
    `KpiCard-only bundle is ${kpiGzip.toLocaleString()} B gzip — over the ${BUDGET_GZIP.toLocaleString()} B budget. Tree-shaking has regressed (single-bundle dist? side effects at module top level?)`,
  );
  for (const marker of MARKERS) {
    check(
      !kpi.includes(marker),
      `KpiCard-only bundle contains "${marker}" — another component rode along; tree-shaking has regressed`,
    );
    check(
      many.includes(marker),
      `six-component bundle is missing "${marker}" — the marker check is stale or the build over-shakes`,
    );
  }

  if (failures.length === 0) {
    console.log(`verify-treeshake: ${passed} checks passed`);
    console.log(
      `  - KpiCard only: ${kpiGzip.toLocaleString()} B gzip (budget ${BUDGET_GZIP.toLocaleString()}), no foreign chart markers`,
    );
    console.log(`  - six components: ${manyGzip.toLocaleString()} B gzip, all markers present`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\nverify-treeshake: ${failures.length} check(s) failed\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error("");
  process.exit(1);
}
