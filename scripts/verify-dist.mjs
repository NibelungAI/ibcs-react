/**
 * Post-build smoke test for the published artifact.
 *
 * `npm test` covers `src/`; this covers the thing consumers actually install.
 * It loads `dist/` the same four ways a consumer can (ESM root, ESM core, CJS
 * root, CJS core) and asserts the properties that silently regress:
 *
 * 1. **No dual-package hazard.** `require("ibcs-react").defaultTokens` must be
 *    the *same object* as `require("ibcs-react/core").defaultTokens`. Both
 *    entries must resolve to the same per-module files; if the build ever
 *    regresses to bundling each entry privately, identity checks break and
 *    the bytes double - this catches it.
 * 2. **Public API is reachable** from every entry/format combination.
 * 3. **The dist is per-module** (tsdown `unbundle`) - one file per source
 *    module, barrels as pure re-exports. This is what makes the library
 *    tree-shake in consumers; a regression to a single bundle would silently
 *    re-inflate every consumer (55 KB gzip for one KpiCard, measured).
 *    `scripts/verify-treeshake.mjs` asserts the resulting bundle size.
 * 4. **`"use client"` is stamped on the root barrels and every react module,
 *    and nowhere in core** (see `scripts/postbuild.mjs`) - `ibcs-react/core`
 *    must stay usable from React Server Components.
 *
 * Exits non-zero with a list of every failure (not just the first one).
 */
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));

/** Collected failures; a non-empty list fails the run. */
const failures = [];
/** How many assertions held, so a green run still reports something. */
let passed = 0;

/**
 * Record an assertion.
 *
 * @param {boolean} condition truthy when the expectation holds
 * @param {string} message the problem, phrased for the failure report
 */
function check(condition, message) {
  if (condition) passed += 1;
  else failures.push(message);
}

/** Loads a CJS entry, or records a failure and returns `null`. */
function requireDist(relPath) {
  try {
    return require(join(root, relPath));
  } catch (error) {
    failures.push(`${relPath}: require() threw - ${error?.message ?? error}`);
    return null;
  }
}

/** Loads an ESM entry (file URL, so it works on Windows), or returns `null`. */
async function importDist(relPath) {
  try {
    return await import(pathToFileURL(join(root, relPath)).href);
  } catch (error) {
    failures.push(`${relPath}: import() threw - ${error?.message ?? error}`);
    return null;
  }
}

/** Exports every entry of the given kind must expose. */
const CORE_EXPORTS = ["computeVariance", "defaultTokens", "mergeTokens"];
const ROOT_EXPORTS = [...CORE_EXPORTS, "VarianceColumnChart", "StatementTable"];

/** Asserts a module namespace/exports object carries the expected names. */
function checkExports(label, mod, names) {
  if (!mod) return;
  for (const name of names) {
    check(mod[name] !== undefined, `${label}: missing export \`${name}\``);
  }
}

// ---------------------------------------------------------------- CJS entries
const cjsRoot = requireDist("dist/index.cjs");
const cjsCore = requireDist("dist/core/index.cjs");

checkExports("dist/index.cjs", cjsRoot, ROOT_EXPORTS);
checkExports("dist/core/index.cjs", cjsCore, CORE_EXPORTS);

if (cjsRoot && cjsCore) {
  check(
    cjsRoot.defaultTokens === cjsCore.defaultTokens,
    'dual-package hazard: require("ibcs-react").defaultTokens !== require("ibcs-react/core").defaultTokens - the CJS entries do not share module files (check `unbundle` in tsdown.config.ts)',
  );
}

// ---------------------------------------------------------------- ESM entries
const esmRoot = await importDist("dist/index.js");
const esmCore = await importDist("dist/core/index.js");

checkExports("dist/index.js", esmRoot, ROOT_EXPORTS);
checkExports("dist/core/index.js", esmCore, CORE_EXPORTS);

if (esmRoot && esmCore) {
  check(
    esmRoot.defaultTokens === esmCore.defaultTokens,
    'dual-package hazard: import("ibcs-react").defaultTokens !== import("ibcs-react/core").defaultTokens - the ESM entries do not share module files',
  );
}

// -------------------------------------------------- per-module dist structure
// A representative module per layer must exist as its OWN file. If these turn
// up missing, the build has regressed to a single bundle - which loads fine
// (everything above still passes) but destroys consumer tree-shaking.
for (const file of [
  "dist/react/KpiCard.js",
  "dist/react/KpiCard.cjs",
  "dist/core/tokens.js",
  "dist/core/tokens.cjs",
]) {
  check(
    existsSync(join(root, file)),
    `${file}: missing - the dist is no longer per-module (tsdown \`unbundle\`); consumer tree-shaking is broken`,
  );
}

/** Recursively collect .js/.cjs files under a dist subdirectory. */
function jsFilesUnder(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) out.push(...jsFilesUnder(file));
    else if (/\.(js|cjs)$/.test(name)) out.push(file);
  }
  return out;
}

// ------------------------------------------------------- "use client" stamping
const directive = /^\s*(["'])use client\1\s*;?/;

const clientModules = [
  join(root, "dist/index.js"),
  join(root, "dist/index.cjs"),
  ...jsFilesUnder(join(root, "dist/react")),
];
const unstamped = clientModules
  .filter((file) => {
    try {
      return !directive.test(readFileSync(file, "utf8"));
    } catch {
      return true;
    }
  })
  .map((file) => relative(root, file));
check(
  unstamped.length === 0,
  `react modules missing a leading "use client" (see scripts/postbuild.mjs) - they throw in a Next.js server component: ${unstamped.join(", ")}`,
);

const serverModules = [
  ...jsFilesUnder(join(root, "dist/core")),
  ...jsFilesUnder(join(root, "dist/_virtual")),
];
const poisoned = serverModules
  .filter((file) => {
    try {
      return readFileSync(file, "utf8").includes("use client");
    } catch {
      return true;
    }
  })
  .map((file) => relative(root, file));
check(
  poisoned.length === 0,
  `core/_virtual modules must NOT contain "use client" - ibcs-react/core is pure maths and has to stay importable from a React Server Component: ${poisoned.join(", ")}`,
);

// ------------------------------------------------------------------- report
if (failures.length > 0) {
  console.error(`\nverify-dist: ${failures.length} check(s) failed\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error("");
  process.exit(1);
}

console.log(`verify-dist: ${passed} checks passed`);
console.log("  - ESM + CJS, root + core entries all load");
console.log("  - public API reachable from every entry");
console.log("  - root and core share one instance (no dual-package hazard)");
console.log("  - dist is per-module (tree-shakeable)");
console.log('  - "use client" on root barrels + react modules; core clean');
