# Contributing to ibcs-react

Thanks for your interest in improving **ibcs-react** — the IBCS / ISO 24896
business-reporting component library for React. This guide covers how to get set
up, the conventions the codebase holds itself to, and how to land a change.

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

```bash
git clone https://github.com/NibelungAI/ibcs-react
cd ibcs-react
npm ci
```

Node **>= 20.19** is required for development — the toolchain (jsdom, oxfmt)
declares it, and CI runs on Node 20 / 22 / 24. The _published_ package is less
demanding (`engines.node >= 18` in `package.json`): `dist/` is plain
ES2020-target JavaScript with no Node APIs. `npm ci` installs from the lockfile
for a reproducible tree — `package-lock.json` is the authoritative lockfile. Note that `react` / `react-dom` are
**peer dependencies** — they are present as devDependencies here so the demo and
tests run, but the published package does not bundle them.

## The dev loop

The fastest way to work on a component is the demo app, which aliases
`ibcs-react` straight at `src/` so edits hot-reload with no build step.

| Command                | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `npm run demo`         | Vite demo & docs app on **http://localhost:5180**             |
| `npm run storybook`    | Storybook on :6006 for isolated component states              |
| `npm run typecheck`    | `tsc --noEmit` — must be clean                                |
| `npm test`             | Vitest run over the core logic                                |
| `npm run test:watch`   | Vitest in watch mode                                          |
| `npm run build`        | `tsup` bundle (ESM + CJS + types) + the `"use client"` stamp  |
| `npm run verify-dist`  | Smoke-tests `dist/` the way a consumer loads it               |
| `npm run format`       | Formats the files you changed (tracked **and** untracked)     |
| `npm run check-format` | `oxfmt --check .` — what CI runs                              |
| `npm run ci`           | The whole gate: typecheck → lint → test → build → verify-dist |

Before opening a PR, make sure **`npm run ci` and `npm run check-format` pass**.

### About the build output

`npm run build` is `tsup` followed by `scripts/postbuild.mjs`, which prepends
`"use client"` to the root entries (`dist/index.js`, `dist/index.cjs`) so the
components work in a Next.js App Router server component. `dist/core/*` is left
directive-free on purpose — `ibcs-react/core` is pure maths and must stay
importable from a React Server Component. `scripts/verify-dist.mjs` enforces
both halves of that rule, plus that the root and core entries still share one
module instance (no dual-package hazard). If you touch `tsup.config.ts`, run
`npm run build && npm run verify-dist`.

## Code conventions

The library has a deliberately narrow set of non-negotiables. They are what make
it small, portable and correct — please keep them.

- **Zero runtime dependencies.** The published package depends on nothing at
  runtime. Charts are hand-rolled inline SVG — no D3, no charting engine, no
  utility libs. A PR that adds a runtime dependency will not be merged; if you
  reach for one, that logic almost always belongs in `core/` as a few lines of
  plain TypeScript instead.
- **Pure SVG rendering.** Visuals are emitted as inline SVG from React. No canvas,
  no DOM measurement on the render path that would break determinism.
- **SSR-safe.** Components must render on the server. Never touch `window`,
  `document` or other browser globals during render; guard browser-only work
  (export helpers, measurement) behind effects or feature checks.
- **Tokens-only theming.** All colours, scenario fills and styling come from the
  token set and are overridable via the `tokens` prop (deep-merged). Do not
  hard-code hex values in components — add or read a token. Chrome is themed too:
  component backgrounds (cards, menus, tooltips, sticky cells, hollow plan fills)
  read `color.surface`, subtle fills `color.surfaceMuted`, in-bar labels
  `color.onFill`, and every font stack `font.family` — that is what makes the
  `Dark` preset work, so a literal `#fff` background is a bug.
- **TypeScript strict.** The project compiles under `strict`. No `any` escape
  hatches; prefer precise types and discriminated unions (the config types are
  the model of how to do this).
- **IBCS correctness.** This is a notation library, so the notation is the spec.
  Scenarios render with their standard encodings:
  - **AC** (actual) — solid fill
  - **PY** (previous year) — grey / lighter solid reference
  - **PL** (plan / budget) — outlined frame (no fill)
  - **FC** (forecast) — hatched fill
  - Variance is coloured by **business impact, not arithmetic sign**: a positive
    number on a cost line (`higherIsBetter: false`) is **unfavorable** (red).
    Always derive favourability from the line, not from `value > 0`.

  When in doubt, run the change through `checkIbcs` — the conformance bar for any
  new visual is the IBCS notation that underpins ISO 24896.

## Adding a component

Components are split into framework-agnostic logic and a thin React renderer.
A complete addition touches five places:

1. **`src/core/<name>.ts`** — the pure layout/computation: take the normalized
   model + config in, return plain geometry/data out. No React, no SVG, no DOM.
   This is what makes a Vue/Svelte port or server precompute possible.
2. **`src/react/<Name>.tsx`** — the renderer: call the core function and emit
   inline SVG, reading styling from tokens. Keep it presentational.
3. **Barrels** — export the public API from `src/core/index.ts` and
   `src/react/index.ts` (re-exported by `src/index.ts`).
4. **A test** — add a Vitest spec under `src/core/__tests__/` covering the core
   logic (layout maths, variance sign, edge cases). Logic lives in `core/`
   precisely so it is testable without a DOM.
5. **A docs entry** — surface it in the demo (`demo/docs/`) and, where useful, a
   `*.stories.tsx` Storybook story so reviewers and users can see it.

New charts that map to an IBCS template should note the template (e.g. C05, T03)
in their docs the way existing ones do.

## Commits & pull requests

- Branch off `main`; keep PRs focused on one change.
- Write clear, imperative commit subjects (e.g. `Add C09 iso-line option`).
- In the PR, say **what** changed and **why**, and confirm the checklist in the
  [pull-request template](./.github/PULL_REQUEST_TEMPLATE.md): typecheck / test /
  build pass, tests added, IBCS-correct, docs updated, no new runtime deps.

### Changesets

Releases and `CHANGELOG.md` are automated with
[changesets](https://github.com/changesets/changesets) — **do not edit
`CHANGELOG.md` by hand**. For anything user-facing, add a changeset in the same
PR:

```bash
npx changeset
```

Pick the bump (`patch` for fixes, `minor` for new components/props, `major` for
breaking changes) and write the summary as a consumer-facing changelog entry —
what changed for someone using the library, not how you implemented it. That
writes a small Markdown file under `.changeset/`; commit it with your change.
Purely internal work (tests, refactors, CI, docs) does not need one.

On merge to `main`, the release workflow collects the pending changesets into a
"Version Packages" PR; merging that PR bumps the version, writes the changelog
and publishes to npm.

If you are planning a larger change, open an issue or a discussion first so we
can agree on the approach before you invest the time. Thank you for contributing!

## Visual regression

A charting library regresses in ways a unit test never sees: a bar drifts four
pixels, a `<defs>` hatch disappears, a colour token resolves to the wrong grey.
Two layers cover that, both driven by the same fixture catalogue
(`src/react/__tests__/fixtures.tsx`) the smoke tests use — add a fixture there and
both layers pick it up automatically.

### Layer 1 — markup snapshots (always on)

`src/react/__tests__/markup.test.tsx` server-renders every fixture and snapshots
the SVG/HTML. It runs as part of `npm test`, costs milliseconds and cannot flake:
`renderToString` is pure, and generated `useId` values are normalized to `ID1`,
`ID2`, … before snapshotting. A diff here is a real structural or geometry
change — read it, then accept it deliberately:

```bash
npx vitest run -u
```

Commit the updated `__snapshots__/markup.test.tsx.snap` with the change that
caused it, and mention the visual effect in the PR.

### Layer 2 — screenshots (opt-in)

`tests/visual/` is a dedicated Playwright harness: a tiny Vite app that renders
each fixture into a fixed-width `data-fixture="…"` cell, screenshotted one cell
at a time by `tests/visual/visual.pw.ts`. It is separate from the demo on
purpose, so docs edits never move a baseline.

```bash
npx playwright install chromium   # once, ~110 MB
npm run test:visual               # compare
npm run test:visual:update        # rewrite baselines
```

(The spec file is `*.pw.ts`, not `*.spec.ts`, because Vitest globs `*.spec.*`
repo-wide — each file belongs to exactly one runner.)

Pixel baselines are **linux-only** and not part of `npm test` or CI. Font
rasterization and antialiasing differ per platform, so a baseline recorded on
Windows or macOS fails everywhere else. Baselines are stored per platform in
`tests/visual/__screenshots__/<platform>/`, and `.gitignore` keeps only the
`linux/` folder — running the suite locally gives you a private win32/darwin set
to eyeball diffs against, with nothing to clean up afterwards.

The committed linux set comes from the **Visual regression** workflow
(`.github/workflows/visual.yml`): run it manually with the `update-baselines`
input, download the `visual-baselines-linux` artifact, unzip it over
`tests/visual/__screenshots__/linux/` and commit. The same workflow runs weekly
without the input to compare against those baselines and uploads the
expected/actual/diff images when something moved.
