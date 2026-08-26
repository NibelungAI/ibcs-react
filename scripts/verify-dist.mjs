/**
 * Post-build smoke test for the published artifact.
 *
 * `npm test` covers `src/`; this covers the thing consumers actually install.
 * It loads `dist/` the same four ways a consumer can (ESM root, ESM core, CJS
 * root, CJS core) and asserts the properties that silently regress:
 *
 * 1. **No dual-package hazard.** `require("ibcs-react").defaultTokens` must be
 *    the *same object* as `require("ibcs-react/core").defaultTokens`. If tsup's
 *    (experimental) CJS code splitting stops working, each entry inlines its own
 *    copy, identity checks break and the bundle doubles — this catches it.
 * 2. **Public API is reachable** from every entry/format combination.
 * 3. **`"use client"` is stamped on the root entries only** (see
 *    `scripts/postbuild.mjs`) — `ibcs-react/core` must stay usable from React
 *    Server Components.
 *
 * Exits non-zero with a list of every failure (not just the first one).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

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

/** Reads a built file as UTF-8, or records a failure and returns `null`. */
function readDist(relPath) {
  try {
    return readFileSync(join(root, relPath), "utf8");
  } catch {
    failures.push(`${relPath}: missing — did \`npm run build\` run?`);
    return null;
  }
}

/** Loads a CJS entry, or records a failure and returns `null`. */
function requireDist(relPath) {
  try {
    return require(join(root, relPath));
  } catch (error) {
    failures.push(`${relPath}: require() threw — ${error?.message ?? error}`);
    return null;
  }
}

/** Loads an ESM entry (file URL, so it works on Windows), or returns `null`. */
async function importDist(relPath) {
  try {
    return await import(pathToFileURL(join(root, relPath)).href);
  } catch (error) {
    failures.push(`${relPath}: import() threw — ${error?.message ?? error}`);
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
    'dual-package hazard: require("ibcs-react").defaultTokens !== require("ibcs-react/core").defaultTokens — the CJS entries do not share a chunk (check `splitting` in tsup.config.ts)',
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
    'dual-package hazard: import("ibcs-react").defaultTokens !== import("ibcs-react/core").defaultTokens — the ESM entries do not share a chunk',
  );
}

// ------------------------------------------------------- "use client" stamping
const directive = /^\s*(["'])use client\1\s*;?/;

for (const entry of ["dist/index.js", "dist/index.cjs"]) {
  const source = readDist(entry);
  if (source !== null) {
    check(
      directive.test(source),
      `${entry}: must start with "use client" (see scripts/postbuild.mjs) — without it the package throws in a Next.js server component`,
    );
  }
}

for (const entry of ["dist/core/index.js", "dist/core/index.cjs"]) {
  const source = readDist(entry);
  if (source !== null) {
    check(
      !source.includes("use client"),
      `${entry}: must NOT contain "use client" — ibcs-react/core is pure maths and has to stay importable from a React Server Component`,
    );
  }
}

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
console.log('  - "use client" on the root entries only');
