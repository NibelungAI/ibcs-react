# Changelog

## 1.2.0

### Minor Changes

- 2671b10: `ChartBox`, `ScrollChart`, `ResponsiveChart` and `ChartFrame` accept a single chart element as their child — the resolved integer `width`/`height` are cloned onto it — so the everyday case reads `<ChartBox width={620} height={340}><VarianceColumnChart data={data} /></ChartBox>`. The render-prop form `{(w, h) => …}` keeps working unchanged for charts whose size props are named differently or that need the numbers directly (`ChartChildren` type exported).
- 2671b10: New `checkIbcsProps(component, props)` lints the JSX authoring path — the way most apps actually write charts — against the same IBCS rules as `checkIbcs`. Component props are the config shapes minus the `type` discriminator, which the component name carries; the function maps the name back and runs the config checks, so `<VarianceColumnChart data={…} comparison="PY" />` is lintable in a unit test without restructuring into configs. Render-only props are ignored, lint-only declarations (`measureKind`) ride along, `KpiCard` props lint directly as a `KpiConfig`, the specialised variance charts lint as their linear family, and `checkIbcsProps("PieChart", …)` flags the pie. Unknown component names return an `input-shape` info naming the lintable components (`LintableComponentName` type exported).
- 2671b10: Ratio KPIs speak percentage points. New `unit: "ratio"` on `KpiConfig`/`KpiCard` declares a percentage measure (margin, rate, share): the delta renders as `+0.6pp` and the relative delta is dropped — "+0.9%" beside "18.4%" invites reading a relative change as points, which ISO 24896 keeps apart for exactly this reason. Default (`"absolute"`) is unchanged. A new `ratio-units` lint rule (info) nudges KPIs formatted with `suffix: "%"` toward the declaration.
- 2671b10: New `useStatementBridge(lines, comparison?, options?)` hook derives a `WaterfallChart`'s `data` + `comparisonData` from one statement, so the bridge joins the same `comparison` toggle as every other chart: `<WaterfallChart {...useStatementBridge(pnl, comparison)} />`. Every sibling chart takes a scenario key while the bridge needs the other scenario's contributions spelled out as a dataset — the hook absorbs that asymmetry, keeps both datasets structurally parallel (same lines, same skipping rules) and memoizes on the inputs. Also fixes the `statementToWaterfall` doc example, which showed a `comparison` prop the chart does not have (it is `comparisonData`).

## 1.1.0

### Minor Changes

- 735a559: `checkIbcs` no longer rewards deleting the title, and cost detection no longer hangs off the title text alone.

  - A chart or report with **no** title now emits a `structured-title` warning (ISO 24896 SAY requires a Who/What/When title) — previously a bare-string title warned while omitting the title passed clean, so the linter incentivised removing it. A chart block inside a report is satisfied by either its own title or the block's.
  - The `cost-favorability` heuristic now also reads **structured** titles (the recommended form used to bypass it) and the hosting block's title.
  - New optional `measureKind?: "cost" | "revenue"` on chart and KPI configs declares what the measure is: `"cost"` makes the linter insist on `higherIsBetter: false` regardless of wording, `"revenue"` silences the heuristic for measures that merely sound like costs. Rendering is unaffected — favorability still follows `higherIsBetter`.

  If you lint configs in CI, previously-clean untitled configs will now report a warning (errors are unchanged).

- 735a559: `StructureDatum` now keys the component name on `category` — the same key every other datum in the library uses — so one array can feed a `VarianceColumnChart` and a `StructureChart` without a renaming `.map()`. `label` (the only key before this release) is accepted as an alias permanently; when both are present, `category` wins. Resolved `StructureSegment`s keep exposing `label` (now also echoing `category` when provided), and `statementToStructure` emits both keys so adapter output reaches category charts unchanged.
- 735a559: `tokenPresets` is now keyed by stable code ids (`default`, `ocean`, `azure`, `greenRed`, `vivid`, `cvd`, `mono`, `dark` — the new `TokenPresetId` type) instead of display strings, with display names in the new `tokenPresetLabels` map. Lookups autocomplete and typos fail to compile, and UI copy can change without breaking saved theme ids.

  The v1.0 display-string keys (`"Default"`, `"Green / Red"`, `"CVD-safe"`, `"Mono / print"`, …) still resolve at **runtime** as non-enumerable aliases — existing JavaScript keeps working, and `Object.keys`/`Object.entries` iteration sees each preset exactly once — but they are gone from the **type**: TypeScript code doing `tokenPresets.Dark` or `tokenPresets["Green / Red"]` must switch to `tokenPresets.dark` / `tokenPresets.greenRed`.

### Patch Changes

- 735a559: `checkIbcs` chart-type errors now speak the API's vocabulary. An unknown `type` gets a did-you-mean (`"variance-column"` → `did you mean "varianceColumn"?`, typos within edit distance 2 are corrected) plus the list of valid `CHART_TYPES` values; a known non-linear type (pie, gauge, radar, …) keeps the IBCS explanation but lists the real alternatives instead of conceptual names like "column" and "bar" that the config vocabulary does not accept; a missing `type` gets its own message. All three variants stay under the `linear-chart-type` rule id.
- 735a559: Document that `KpiCard`'s default count-up already respects `prefers-reduced-motion` (the final value renders immediately, with no frame loop) and that SSR always emits the finished figure — the `animate` prop JSDoc and docs never said so. Behavior is unchanged; a regression test now pins it down.
- 16d5e95: Tree-shaking actually works now. The dist was a single bundled module (plus a shared chunk), so bundlers could not drop unused components — importing one `KpiCard` cost ~55 KB gzip and carried WaterfallChart, StructureChart and TrendChart along. The build (now tsdown in unbundle mode, replacing tsup) emits one file per source module with the barrels as pure re-exports: a `KpiCard`-only bundle is now ~4.2 KB gzip (13× smaller), six components ~19 KB (3× smaller), measured with both esbuild and Rollup. `"use client"` is stamped on the root barrels and every `dist/react` module; `ibcs-react/core` stays directive-free for React Server Components. A new CI guard (`verify-treeshake`) bundles a KpiCard-only fixture against the dist on every build and fails on a size-budget or component-leak regression. Public entry points, exports map and types are unchanged (publint and attw both clean).
- 735a559: Fix the screen-reader data table inflating ancestor `scrollHeight` by its full height (~340px per chart). The visually-hidden style used to sit directly on the `<table>`, but CSS table layout treats `width`/`height` as a minimum — the box stayed full-size (invisible, clipped) and any ancestor with `overflow` set grew a phantom scrollbar. The hiding style now sits on a wrapper `<div>`, which honours the 1×1 clamp; the table stays in the accessibility tree exactly as before. If you use the exported `srOnly` style yourself, apply it to a `div`/`span` — never directly to a table.
- e37dab8: `TrendChart`'s documented "year + total" layout is actually usable now. A `summary` period used to affect styling only (divider + emphasis colour) while its value still defined the shared scale — so a 30M full-year total crushed twelve ~2.5M months to slivers ~8% of the plot. Summary periods are now excluded from the period domain and the variance half-scale; a summary that exceeds the resulting domain is drawn capped with a marked scale break (the classic slanted cut) and its value label, in both the column and the variance panel. Summaries in the same range as the periods (an average, say) share the scale unchanged. The PY/PL reference lines also stop before summary periods — a total is not a point in the time series. `computeTrend` gains an `offScale` flag on cells; `TrendLayout` domains now describe the periods alone.

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Entries below this heading are generated at release time from the changesets in
`.changeset/` — add one with `npx changeset` instead of editing this file by
hand (see [CONTRIBUTING.md](./CONTRIBUTING.md#changesets)).

## [1.0.0] - 2026-08-26

Initial public release. A zero-dependency, SSR-safe IBCS / ISO 24896:2026
component library for React with one shared data model (scenario-keyed values:
AC / PY / PL / FC) feeding every view. Complete IBCS chart-template coverage
(C01–C13) and table templates (T01–T04).

### Added

- **Tables (T01–T04):** `StatementTable` (flow & stock modes, integrated
  waterfall, expand/collapse-all, virtualization, CSV export), `DataTable`,
  `ComparisonTable`, `MatrixTable` (budget / control matrix with an expanding
  Year → Quarter → Month column tree). `MatrixTable` exposes per-cell hooks —
  `onCellClick`, `cellDecorations` (corner ribbon), `getCellClassName` and a
  `data-cell-ref` (+ `cellRefOf` helper) on every value cell — so a comment /
  annotation layer can be built on top without forking the table.
- **Controlled or uncontrolled table state**, exactly like a React `<input>`:
  uncontrolled seeds are `defaultCollapsed` / `defaultSort` /
  `defaultExpandedRows` / `defaultExpandedCols`, and each has a value +
  `onChange` pair to take the state over (`collapsed`/`onCollapsedChange` on
  `StatementTable`, `DataTable` and `useStatement`; `sort`/`onSortChange` on
  `DataTable`; `expandedRows`/`expandedCols` + change callbacks on
  `MatrixTable`) — URL sync, persistence and cross-linked views work out of
  the box. Callbacks fire in both modes, so `on…Change` doubles as an observer.
- **Charts (C01–C13):** `VarianceColumnChart`, `TrendChart`, `StructureChart`,
  `StackedChart` (C01/C02), `GroupedVarianceChart` (C03/C04), `LineChart` (C07,
  forecast tail + reference lines), `AreaChart` (C08), `VarianceAreaChart`,
  `ScatterChart` (C09, hyperbolic iso-lines), `BubbleChart` (C10), `ComboChart`,
  `TreeChart` / `RatioTreeChart` (C11), `WaterfallChart`,
  `HorizontalWaterfallChart` / `ColumnVarianceWaterfallChart` (C05),
  `BarVarianceWaterfallChart` (C06), `WaterfallStatementChart` (C12),
  `IntegratedVarianceChart`, `RankingVarianceChart`,
  `SmallMultiples` / `MiniVarianceMultiples` (C13), `PieChart` (+ pie multiples;
  flagged by `checkIbcs`), `VarianceBar`.
- **One API vocabulary across charts:** variance panels are a single
  `variance?: "abs" | "pct" | "none"` union; panel toggles are
  `showAbsPanel` / `showPctPanel`; totals are `showTotals`; trend reference
  lines are `referenceLines?: ScenarioKey[]`; waterfall contribution datasets
  are `comparisonData`. `ScenarioDatum`
  (`{ category, AC?, PY?, PL?, FC? }`, exported from `ibcs-react/core`) is THE
  canonical category-row shape — `CategoryDatum`, `ColumnDatum`, `LineDatum`
  and `ComboDatum` are aliases of it, and `TrendDatum` extends it with
  `summary?`.
- **Interactive tooltips** on every chart: triggered within 8 px of a visible
  mark (not anywhere in the category band), printing the exact figure
  (e.g. "30,123,457" where the chart label says "30.1M") plus the comparison
  and the signed Δ with percent. Keyboard focus shows the same tooltip
  (WCAG 1.4.13), touch shows a sticky mark-anchored tooltip on tap, and Escape
  or an outside tap dismisses. Tooltips render into a `document.body` portal,
  flip at viewport edges instead of clipping, and take their inks from the
  token theme so they stay legible on dark surfaces.
- **KPI:** `KpiCard` (configurable `appearance`: border / background / radius /
  accent / shadow) and `Sparkline`. One `format` drives the headline and every
  delta — `format.currency` renders as the muted prefix, `format.suffix` as
  the postfix — so a unit symbol can never print twice.
- **Report builder:** `Report` and `ConfiguredChart` from serializable
  `ReportConfig` / `ChartConfig`, with `validateReportConfig` /
  `validateChartConfig`.
- **Conformance:** `checkIbcs` (+ `IBCS_RULES`) ISO 24896 linter and the
  `ConformanceReport` view.
- **Hooks:** `useStatement` (literally `StatementTable`'s engine — same
  controlled/uncontrolled options, plus `groupIds`, `allCollapsed`,
  `allExpanded` for toolbar wiring), `useVariance`/`useVariances`,
  `useFilters`, `useLiveData`, `useAsyncData`, `useChartSelection`,
  `useChartHover`, `usePrefersReducedMotion`, `useMountGrow`,
  `useAnimatedValue`, `useCountUp`.
- **Statement adapters:** `statementToWaterfall`, `statementToStructure` and
  `statementToDataTableRows` derive chart/table inputs from a
  `StatementLine[]` — one data model, many views, no hand-reshaping.
- **Theming:** design tokens with presets `defaultTokens`, `oceanTokens`,
  `azureTokens`, `greenRedTokens`, `vividTokens`, `cvdTokens`
  (colour-blind-safe), `monoTokens` (greyscale / print) and `darkTokens`
  (`tokenPresets.Dark`). `IbcsThemeProvider` + `useIbcsTokens` set the theme
  once for a whole subtree; every component alternatively accepts a partial
  `tokens` override (`IbcsTokensOverride`), and `mergeTokens` composes presets.
  Tokens are dark-capable end to end: `color.surface`, `color.surfaceMuted`,
  `color.onFill` and `font.family` theme cards, menus, tooltips, sticky table
  cells and hollow plan fills — not just the marks.
- **Export helpers:** `downloadCSV`, `downloadSVG`, `downloadPNG`, `ExportMenu`,
  plus clipboard + print: `copySvgToClipboard`, `copyPngToClipboard`,
  `printSvg`, `canCopyImage` (surfaced as "Copy PNG / Copy SVG / Print" in
  `ExportMenu`). `ExportMenu` is fully keyboard-operable and reports export
  failures via `onError` (typed with the exported `ExportMenuAction`).
- **Sizing (`ChartBox`):** one object-fit-style sizer for any chart — `fit` of
  `scale` (fill width, scroll below `minWidth`) / `contain` / `fixed` / `fill`,
  plus nine-point alignment, padding and scroll. `ResponsiveChart`
  (ResizeObserver render-prop wrapper) and `ScrollChart` are thin presets of
  it, and the `useElementSize` hook sizes charts from their container.
  (`ChartFrame` is a deprecated preset — still exported and functional.)
- **Band spacing:** every categorical chart gains a `bandPadding` prop
  (`bandScale` core helper) to control column spacing and the edge gutter. The
  default trims that gutter so charts fill their box; pass
  `bandPadding={{ outer: 0 }}` for flush-to-edge.
- **Accessibility:** every chart renders a visually-hidden `ChartDataTable`
  beside the `aria-hidden` SVG (`role="img"` + `aria-label`), with values
  formatted exactly as the chart labels them — screen readers get the
  underlying numbers, not a decorative blob. Tables are keyboard-operable
  throughout (sorting, matrix cells, expand/collapse; chevron buttons never
  submit enclosing forms), header cells carry `scope`, and every table accepts
  an optional visually-hidden `caption`.
- **SSR guarantees:** no `window` / `document` access at module load or first
  render; server-rendered charts produce real geometry (no zero-height flash);
  entrance animations start client-side, respect `prefers-reduced-motion`
  without a flash, and replay on data changes rather than on every re-render.
- **Numeric robustness:** all-negative series scale correctly (loss / margin
  charts), non-finite values (`NaN` / `Infinity`) are treated as missing
  instead of blanking the chart, and `formatValue` / `formatSigned` print
  `n/a` for non-finite input.
- **i18n:** `formatValue` compact mode is locale-aware (decimal separator via
  `Intl`) with overridable `compactSuffixes` (e.g. `Mrd.`/`Mio.`/`Tsd.`).
- **Packaging:** dual ESM + CJS with correct type declarations for each
  (`require("ibcs-react")` type-checks under `node16`/`nodenext`), sharing one
  chunk so both entries hand out the same objects (no dual-package hazard).
  The root entry is marked `"use client"` — importing `ibcs-react` from a
  Next.js App Router server component just works — while `ibcs-react/core` is
  a directive-free, curated barrel with zero React dependency, importable from
  server components for pure layout math. `react-dom` is an optional peer
  (only the tooltip portal uses it), and `./package.json` is exported for
  tooling. A surface-guard test pins both public barrels so the API changes
  only deliberately.
- **React 18 & 19:** peer range `react >=18`; developed and tested on React
  19 (hover / size refs are typed `RefObject<T | null>`, matching React 19's
  ref model).
- **Tests:** vitest suite over the core logic plus jsdom render + SSR smoke
  tests for every component, markup snapshots of every fixture in the shared
  catalogue, and an opt-in Playwright screenshot harness (see CONTRIBUTING);
  CI runs on Node 20/22/24.
- **Docs:** the documentation site under `docs/`
  ([ibcs-react.com](https://ibcs-react.com)) — per-component pages with live
  examples and generated prop tables, guides, a gallery, a playground and a
  report-builder demo.
- **Examples:** a runnable Next.js (App Router) starter under `examples/nextjs`.
