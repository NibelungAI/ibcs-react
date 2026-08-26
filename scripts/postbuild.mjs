/**
 * Post-build step: stamp the React `"use client"` directive onto the root
 * bundle entries.
 *
 * The root entry (`ibcs-react`) ships React components that use hooks, so in a
 * Next.js App Router server component it throws. Bundlers only honour the
 * directive when it is the *first* statement of the entry file, and tsup does
 * not preserve directives through its bundling, so we prepend it here.
 *
 * Deliberately scoped to `dist/index.js` + `dist/index.cjs`:
 *
 * - `dist/core/*` stays directive-free so `ibcs-react/core` (pure layout maths,
 *   zero React) remains importable from server components / RSC.
 * - shared chunks stay directive-free too — a chunk is imported by both entries
 *   and marking it client-only would poison the core entry through the back
 *   door.
 *
 * Idempotent: running it twice does not stack directives.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIRECTIVE = '"use client";';

/** Entry files that must be marked client-only. Order is cosmetic (logging). */
const targets = ["dist/index.js", "dist/index.cjs"];

/** Matches a leading `"use client"` / `'use client'` directive, quotes either way. */
const leadingDirective = /^\s*(["'])use client\1\s*;?/;

let stamped = 0;

for (const target of targets) {
  const file = join(root, target);
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    console.error(
      `[postbuild] missing build output: ${relative(root, file)} — run \`tsup\` first.`,
    );
    console.error(String(error));
    process.exit(1);
  }

  if (leadingDirective.test(source)) {
    console.log(`[postbuild] ${target} already has "use client" — skipped.`);
    continue;
  }

  writeFileSync(file, `${DIRECTIVE}\n${source}`, "utf8");
  stamped += 1;
  console.log(`[postbuild] ${target} ← "use client"`);
}

console.log(
  `[postbuild] done (${stamped} of ${targets.length} entr${targets.length === 1 ? "y" : "ies"} stamped).`,
);
