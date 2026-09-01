/**
 * Post-build step: stamp the React `"use client"` directive onto every module
 * that ships React code.
 *
 * The root entry (`ibcs-react`) is React components using hooks, so in a
 * Next.js App Router server component an unmarked import throws. Bundlers
 * only honour the directive when it is the *first* statement of a file, and
 * the build does not carry directives through from source (they are not
 * authored there), so we prepend them here.
 *
 * With the per-module ("unbundle") dist, that means:
 *
 * - `dist/index.js` + `dist/index.cjs` - the root barrels establish the
 *   client boundary for `import { … } from "ibcs-react"`.
 * - every module under `dist/react/` - so the boundary survives bundlers that
 *   follow the barrel's re-exports into individual modules, and any future
 *   per-component subpath exports are correct by construction.
 * - `dist/core/*` and `dist/_virtual/*` stay directive-free so
 *   `ibcs-react/core` (pure layout maths, zero React) remains importable from
 *   server components / RSC.
 *
 * Idempotent: running it twice does not stack directives.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIRECTIVE = '"use client";';

/** Matches a leading `"use client"` / `'use client'` directive, quotes either way. */
const leadingDirective = /^\s*(["'])use client\1\s*;?/;

/** Recursively collect .js/.cjs files under a directory. */
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

const rootEntries = ["dist/index.js", "dist/index.cjs"].map((t) => join(root, t));
for (const entry of rootEntries) {
  if (!existsSync(entry)) {
    console.error(
      `[postbuild] missing build output: ${relative(root, entry)} - run the build first.`,
    );
    process.exit(1);
  }
}

const targets = [...rootEntries, ...jsFilesUnder(join(root, "dist/react"))];

let stamped = 0;
let skipped = 0;

for (const file of targets) {
  const source = readFileSync(file, "utf8");
  if (leadingDirective.test(source)) {
    skipped += 1;
    continue;
  }
  writeFileSync(file, `${DIRECTIVE}\n${source}`, "utf8");
  stamped += 1;
}

console.log(
  `[postbuild] "use client" ← root barrels + dist/react modules: ${stamped} stamped, ${skipped} already marked (${targets.length} total).`,
);
