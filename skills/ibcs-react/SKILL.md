---
name: ibcs-react
description: Build IBCS / ISO 24896 business reports in React with the ibcs-react npm package — variance column charts, waterfalls/bridges, trend charts, statement (P&L / balance sheet) tables, matrix tables, KPI cards and full dashboards driven by scenario data (AC actual / PY previous year / PL plan / FC forecast). Use when installing ibcs-react, importing its components (VarianceColumnChart, WaterfallChart, StatementTable, DataTable, MatrixTable, KpiCard, Report), theming with IbcsThemeProvider/tokens, exporting charts, or linting a report with checkIbcs.
license: MIT
metadata:
  author: NibelungAI
  version: "1.0.0"
---

# ibcs-react

Zero-dependency, SSR-safe React components that encode the IBCS® notation (the
basis of ISO 24896) — so charts and tables come out standards-correct without
chart wiring or a house-style debate.

## When to use

A React/Next.js app needs management-reporting visuals — variance charts,
bridges, P&L or balance-sheet tables, KPI cards, dashboards — over actual vs
previous year / plan / forecast numbers, and the output must be IBCS /
ISO 24896 conformant (or auditable by a linter).

Not for: general-purpose dataviz (no maps, gauges, radars) or data fetching
(components never fetch — bring the numbers). For the notation rules themselves
(any tool), see the `ibcs-notation` skill.

## Install

```bash
npm install ibcs-react
```

- Peers: `react` + `react-dom` **>= 18** (19 fine; `react-dom` optional — only
  the tooltip portal uses it). Zero other runtime deps (hand-rolled inline SVG),
  ESM + CJS with bundled types, SSR-safe (no `window`/`document` at module load
  or first render).
- The root entry ships `"use client"`, so a Next.js App Router **server**
  component can `import { VarianceColumnChart } from "ibcs-react"` directly. Add
  your own `"use client"` file only when _your_ code holds state/handlers.
- `ibcs-react/core` is a React-free barrel (layout math, `formatValue`,
  `computeVariance`, `statementToCSV`, `checkIbcs`, tokens) — import it in RSC,
  route handlers, cron jobs or CI.

## The one data model

Every view reads **values keyed by scenario**. Compute once, reuse everywhere.

```ts
type ScenarioKey = "AC" | "PY" | "PL" | "FC"; // actual · previous year · plan · forecast

interface ScenarioDatum {
  category: string;
  AC?: number;
  PY?: number;
  PL?: number;
  FC?: number;
}
```

`ScenarioDatum` is THE category-row shape (`CategoryDatum`, `ColumnDatum`,
`LineDatum`, `ComboDatum` alias it; `TrendDatum` adds `summary?`;
`StructureDatum` adds `higherIsBetter?` — same `category` key, so one array
feeds `VarianceColumnChart` and `StructureChart` alike). A missing scenario is
_not drawn_, never zero. Statements are a tree of `StatementLine`:

```ts
interface StatementLine {
  id: string;
  label: string;
  flow?: "add" | "subtract" | "result"; // moves / doesn't move the running total
  values: Partial<Record<ScenarioKey, number>>;
  higherIsBetter?: boolean; // false on cost/expense/tax lines
  children?: StatementLine[]; // collapsible group; must sum to the parent
  defaultCollapsed?: boolean;
  emphasis?: boolean;
}
```

Derive other views instead of reshaping by hand: `statementToWaterfall(lines, scenario?, opts?)`,
`statementToStructure(lines, opts?)`, `statementToDataTableRows(lines, opts?)`,
`statementToCSV`, `statementToMatrix`.

## Canonical snippets

Charts take explicit pixel `width`/`height` (defaults: VarianceColumnChart
560×320, WaterfallChart 640×360, TrendChart 720×360). Wrap in `ChartBox` to
follow a container.

```tsx
import { VarianceColumnChart } from "ibcs-react";

const quarterly = [
  { category: "Q1", AC: 6.8e6, PY: 6.1e6, PL: 6.5e6 },
  { category: "Q2", AC: 7.3e6, PY: 6.4e6, PL: 7.0e6 },
];

// variance="abs" (bars, default) | "pct" (pins) | "none"
<VarianceColumnChart
  data={quarterly}
  comparison="PY"
  variance="abs"
  mark="bar"
  width={620}
  height={320}
  format={{ compact: true, decimals: 1, currency: "€" }}
/>;
```

```tsx
import { WaterfallChart, statementToWaterfall } from "ibcs-react";

// comparisonData is a parallel BRIDGE (a dataset), not a scenario key.
<WaterfallChart
  data={statementToWaterfall(lines)} // AC contributions
  comparisonData={statementToWaterfall(lines, "PY")}
  mark="bar"
  width={720}
  height={380}
/>;
```

```tsx
import { StatementTable } from "ibcs-react";

// mode="flow" (P&L, integrated waterfall) | "stock" (balance sheet levels)
<StatementTable
  lines={lines}
  mode="flow"
  scenario="AC"
  varianceColumns={[
    { base: "PY", mode: "abs", mark: "bar" },
    { base: "PY", mode: "pct", mark: "pin" },
  ]} // ← also the default
  collapsed={collapsed}
  onCollapsedChange={setCollapsed} // controlled; or defaultCollapsed
  expandControls
  waterfallWidth={220}
  format={{ compact: true, decimals: 1 }}
/>;
```

```tsx
import { IbcsThemeProvider, tokenPresets, darkTokens, KpiCard } from "ibcs-react";

<IbcsThemeProvider tokens={dark ? darkTokens : tokenPresets.cvd}>
  <KpiCard
    label="Operating cost"
    values={{ AC: 9.7e6, PY: 8.4e6 }}
    comparisons={["PY"]}
    higherIsBetter={false} // cost up = red
    format={{ compact: true, decimals: 1, currency: "€" }}
  />
  {/* nearest wins: a component's own `tokens` merges onto the provider */}
</IbcsThemeProvider>;
```

## Lint the notation

```tsx
import { checkIbcs, ConformanceReport } from "ibcs-react"; // checkIbcs + IBCS_RULES: also in /core

const findings = checkIbcs(reportConfig); // ChartConfig | KpiConfig | ReportConfig
// [] when conforming; else { rule, severity: "error"|"warning"|"info", message, path? }
<ConformanceReport findings={findings} />;
```

Rule ids live in `IBCS_RULES` — run the check in CI over stored configs.
A chart/report with NO title is flagged (SAY requires Who/What/When); declare
`measureKind: "cost" | "revenue"` on a config when the title's wording
shouldn't drive the cost-favorability heuristic. JSX-authored charts lint via
`checkIbcsProps("VarianceColumnChart", props)` — the component name supplies
the `type`, same rules, same findings.

## Rules of thumb

- Set `higherIsBetter: false` on cost / expense / tax so an increase reads red.
- Absolute deviations are bars, relative ones pins — never on one axis.
- A group line with empty `values: {}` reports the sum of its children.
- Every chart forwards `ref` to its `<svg>` (the export handle) and renders a
  visually-hidden data table for screen readers.
- Tables are controlled/uncontrolled like `<input>`; `on…Change` fires in both.

## In this reference

| File                                                        | Purpose                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [charts.md](./references/charts.md)                         | Every chart, its data shape, key props, C01–C13 mapping                       |
| [tables.md](./references/tables.md)                         | StatementTable / DataTable / ComparisonTable / MatrixTable + controlled state |
| [theming-and-export.md](./references/theming-and-export.md) | Tokens, presets, provider, ExportMenu, ChartBox sizing, tooltips              |

Docs: <https://ibcs-react.com> — index for agents at `/llms.txt`, whole corpus at
`/llms-full.txt`, and any docs page is raw Markdown by appending `.mdx` to its
URL (e.g. `https://ibcs-react.com/docs/data-model.mdx`).
