# Tables — quick reference

Four tables cover the IBCS table templates T01–T04. All take `format`, `tokens`,
`className`/`style`; the interactive ones take a visually-hidden `caption`.

## StatementTable — T03 / T04 (P&L, balance sheet)

The integrated waterfall: a `StatementLine[]` tree with the scenario lane drawn
as stepping bars plus right-hand variance panels.

```tsx
<StatementTable
  lines={lines}
  mode="flow" // "flow" = P&L running total | "stock" = balance-sheet levels
  scenario="AC" // which scenario the lane draws
  varianceColumns={[
    // default: ΔPY bars + ΔPY% pins
    { base: "PY", mode: "abs", mark: "bar" },
    { base: "PY", mode: "pct", mark: "pin", clampPct: 100, label: "ΔPY%" },
  ]}
  showBaseValues // raw value column per comparison base (default true)
  showWaterfall // false ⇒ template T04: a plain grid, no lane
  mark="bar" // lane drawn as "bar" (default) or "pin"
  waterfallWidth={260}
  labelMaxWidth={260}
  expandControls // "Expand all / Collapse all" toolbar (default false)
  animate
  tooltip
  maxHeight={520}
  virtualize
  overscan={6} // windowing for big consolidations
  caption="FY26 P&L vs previous year"
/>
```

`VarianceColumnSpec` = `{ base, mode?: "abs"|"pct", mark?: "bar"|"pin", label?, clampPct? }`.

## DataTable — T01 (cross-entity comparison)

Rows = entities (hierarchical via `children`), columns = measures.

```tsx
const columns: DataTableColumn[] = [
  { key: "value", label: "AC" }, // measure defaults to key
  { key: "value_py", label: "PY", measure: "value", scenario: "PY" },
  {
    key: "d_py",
    label: "ΔPY",
    kind: "variance",
    measure: "value",
    base: "PY",
    mode: "abs",
    mark: "bar",
  },
  { key: "spark", label: "Trend", kind: "sparkline", sparkType: "line" },
];

<DataTable
  columns={columns}
  rows={statementToDataTableRows(lines)}
  showTotals
  totalsLabel="Total"
/>;
```

- `DataTableColumn`: `key`, `label`, `kind?: "value"|"variance"|"sparkline"`,
  `measure?`, `scenario?`, `base?`, `mode?`, `mark?: "bar"|"pin"|"none"`,
  `higherIsBetter?`, `sparkType?`, `clampPct?`, `format?`, `align?`, `width?`,
  `group?` / `subgroup?`, `borderLeft?`, `gapBefore?`.
- `DataTableCell` = `number | Partial<Record<ScenarioKey, number>> | undefined`.
- `DataTableRow`: `id`, `label`, `values: Record<string, DataTableCell>`,
  `spark?: Record<string, number[]>`, `children?`, `group?`, `emphasis?`,
  `flow?`, `doubleRule?`, `defaultCollapsed?`.

## ComparisonTable — T01 / T02 (centre-label flanking layout)

One measure, two column groups (e.g. Month vs YTD) flanking the row labels.
Static layout — no interactive state.

```tsx
<ComparisonTable
  rows={rows}
  leftColumns={monthCols}
  leftGroupLabel="November"
  rightColumns={ytdCols}
  rightGroupLabel="Year to date"
  labelWidth={200}
  showTotals
  totalsLabel="Total"
/>
```

## MatrixTable — budget / control matrix

A row tree crossed with an expanding period column tree (Year → Quarter → Month).

```tsx
<MatrixTable
  rows={rows} // MatrixRow: { id, label, flow?, emphasis?, doubleRule?, higherIsBetter?, children? }
  columns={periods} // MatrixPeriod: { id, label, scenarios?, children?, defaultExpanded? }
  values={values} // Record<rowId, Record<periodId, Partial<Record<ScenarioKey, number>>>>
  scenarios={["PL", "AC", "FC"]}
  showVariance
  varianceScenarios={{ actual: "AC", base: "PL" }}
  stickyFirstColumn
  columnExpandControls
  maxHeight={560}
  labelWidth={240}
  onCellClick={(cell) => open(cell)}
  cellDecorations={(ref) => (comments[ref] ? { ribbon: true } : undefined)}
  getCellClassName={(ref) => (flagged.has(ref) ? "flagged" : undefined)}
/>
```

Every value cell carries a `data-cell-ref` (build one with
`cellRefOf(rowId, periodId, scenario)` from `ibcs-react/core`) — enough to hang a comment/annotation layer off the table without
forking it.

## Controlled ⇄ uncontrolled state

Exactly the React `<input>` convention. Seed with `default*` and let the table
own the state, or pass the value + handler to take it over (URL sync,
persistence, two views kept in step). `on…Change` also fires in uncontrolled
mode, as an observer.

| Component                   | Uncontrolled seed                            | Controlled pair                                                               |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `StatementTable`            | `defaultCollapsed`                           | `collapsed` + `onCollapsedChange(ids: string[])`                              |
| `DataTable`                 | `defaultCollapsed`, `defaultSort`            | `collapsed` + `onCollapsedChange`, `sort` + `onSortChange(sort \| null)`      |
| `MatrixTable`               | `defaultExpandedRows`, `defaultExpandedCols` | `expandedRows`/`expandedCols` + `onExpandedRowsChange`/`onExpandedColsChange` |
| `useStatement(lines, opts)` | `defaultCollapsed`                           | `collapsed` + `onCollapsedChange`                                             |
| `ComparisonTable`           | —                                            | static, no state                                                              |

`collapsed` / `expanded*` accept a `ReadonlySet<string>` or a `readonly string[]`.
`useStatement` is literally `StatementTable`'s engine and additionally returns
`rows`, `toggle`, `isCollapsed`, `domainMax`, `groupIds`, `allCollapsed`,
`allExpanded` — use it to wire a custom toolbar or a second synced view.

## Statement → table/chart projections

`statementToDataTableRows(lines, { measure = "value" })`,
`statementToWaterfall(lines, scenario = "AC", { expandGroups = false })`,
`statementToStructure(lines, { skipResults = true })`,
`statementToMatrix(lines, opts)`, `statementToCSV(lines, opts)` / `toCSV`.
