# ibcs-react - Next.js (App Router) example

A minimal, self-contained Next.js starter that imports and renders
[`ibcs-react`](https://www.npmjs.com/package/ibcs-react) - zero-dependency,
SSR-safe IBCS / ISO 24896 business charts and KPI cards.

It demonstrates:

- a **KPI strip** (`KpiCard`) with deltas vs PY/PL and sparklines,
- a **variance column chart** (`VarianceColumnChart`) - AC vs PY with a Δ panel,
- a **trend chart** (`TrendChart`) - actuals, a hatched **forecast tail**, and a
  full-year summary column.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build && npm run start   # production build
```

## A note on the `ibcs-react` dependency

`package.json` asks for `"ibcs-react": "^1.0.0"` - the published release on
npm, so a plain `npm install` just works.

If you're developing **against a local checkout** of the library (this repo),
point the example at it instead of npm. From `examples/nextjs/`:

```bash
# Option A - file: path (edit package.json):
#   "ibcs-react": "file:../.."
npm install

# Option B - npm link (build the lib first so dist/ exists):
#   (in the repo root)  npm run build && npm link
#   (here)              npm link ibcs-react
```

`next.config.mjs` sets `transpilePackages: ["ibcs-react"]`, which keeps things
working across linked checkouts and published builds alike.

## Open in StackBlitz

> Works once `ibcs-react` is on npm (see the dependency note above).

https://stackblitz.com/github/NibelungAI/ibcs-react/tree/main/examples/nextjs

## Architecture note: client vs server components

IBCS charts use React hooks for hover and mount animations, so they must run
inside a `"use client"` boundary. The page (`app/page.tsx`) is a **server
component** that renders static intro markup and mounts the interactive charts
via `app/Demo.tsx`, which carries the `"use client"` directive. That split is
the recommended App Router pattern.

Note that `ibcs-react`'s root entry ships its own `"use client"` directive, so
a server component may also import and render the charts directly - the
`Demo.tsx` wrapper here is code organization (it groups the demo's interactive
parts), not a technical requirement.
