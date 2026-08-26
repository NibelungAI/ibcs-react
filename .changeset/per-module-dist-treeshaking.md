---
"ibcs-react": patch
---

Tree-shaking actually works now. The dist was a single bundled module (plus a shared chunk), so bundlers could not drop unused components — importing one `KpiCard` cost ~55 KB gzip and carried WaterfallChart, StructureChart and TrendChart along. The build (now tsdown in unbundle mode, replacing tsup) emits one file per source module with the barrels as pure re-exports: a `KpiCard`-only bundle is now ~4.2 KB gzip (13× smaller), six components ~19 KB (3× smaller), measured with both esbuild and Rollup. `"use client"` is stamped on the root barrels and every `dist/react` module; `ibcs-react/core` stays directive-free for React Server Components. A new CI guard (`verify-treeshake`) bundles a KpiCard-only fixture against the dist on every build and fails on a size-budget or component-leak regression. Public entry points, exports map and types are unchanged (publint and attw both clean).
