# ibcs-react - what to reach for, and the props that matter

`npm i ibcs-react` · peer deps `react` / `react-dom` >= 18 · MIT · zero runtime
dependencies · every component is pure React + inline SVG, so
`renderToStaticMarkup` gives you a finished chart with no browser involved.

Full docs: <https://ibcs-react.com/llms-full.txt>. The package also ships
`dist/**/*.d.ts` - when a prop is not listed below, read the `.d.ts` in
`node_modules/ibcs-react/dist/react/<Component>.d.ts` rather than guessing.

## Printing rules that apply to every component

- Charts take an explicit `width` / `height` in px. Nothing measures itself, so
  no `ResponsiveChart` / `ChartBox` wrapper is needed in print. Content width on
  the A4 page in `assets/kit.mjs` is **642 px**.
- Pass `animate: false` and `tooltip: false`. Mount animations render a
  half-drawn chart into the PDF, and hover state is dead weight on paper.
- Pass `tokens` on every component (or wrap in `IbcsThemeProvider`) - otherwise
  it falls back to the library default palette and the page loses its unity.

## Choosing

| The question the page answers                   | Component                                  |
| ----------------------------------------------- | ------------------------------------------ |
| What did the P&L do, line by line?              | `StatementTable` (flow)                    |
| What does the balance sheet look like?          | `StatementTable` with `mode="stock"`       |
| What moved a total from A to B?                 | `WaterfallChart` (+ `comparisonData`)      |
| How did a measure run over 12-13 periods?       | `TrendChart`                               |
| How do a few categories compare to a reference? | `VarianceColumnChart`                      |
| What is the composition of a whole?             | `StructureChart`                           |
| Which entities beat or missed plan, ranked?     | `RankingVarianceChart`                     |
| A grid of measures across entities              | `DataTable`                                |
| One measure, month vs YTD column groups         | `ComparisonTable`                          |
| A period tree crossed with a P&L tree           | `MatrixTable`                              |
| Same chart repeated by a dimension              | `SmallMultiples` / `MiniVarianceMultiples` |
| A calculation or DuPont tree                    | `TreeChart` / `RatioTreeChart`             |
| Part-to-whole as a pie                          | Don't - see `notation.md`                  |

## The data model

One shape feeds tables and charts alike: a tree of `StatementLine`.

```js
{ id: "cogs", label: "Cost of goods sold", flow: "subtract",
  higherIsBetter: false, values: { AC: 267.1e6, PY: 237.7e6, PL: 258.6e6 },
  children: [ /* must sum to the parent */ ] }
```

**Costs are positive magnitudes; `flow` carries the sign.** Workbooks usually
hold costs as negatives. Pass those through unchanged and `computeVariance`
inverts every cost comparison - an overrun draws green. Take the absolute value
when you map the source, and let `flow: "subtract"` step the total down.

- `flow`: `"add"` / `"subtract"` step the running total. `"result"` draws a full
  bar from zero to the running total **without advancing it** - so it is for
  subtotals that follow something (Gross profit, EBIT, Profit for the period).
  The **first** line of a statement must be `"add"`, or a group whose children
  add: a leading `"result"` has a running total of zero and draws nothing.
- `higherIsBetter: false` on cost, expense, tax and debt lines. Without it a
  cost that grew reads green - the single most common way to ship a wrong report.
- Scenario keys are `AC` actual, `PY` prior year, `PL` plan/budget, `FC` forecast.
  A missing key means "not drawn", never zero.

Category charts take `ScenarioDatum`: `{ category, AC?, PY?, PL?, FC? }`. The key
is `category` everywhere, so one array can feed several charts unchanged.

## Props worth knowing

**`StatementTable`** - `lines`, `mode` (`"flow"` | `"stock"`), `varianceColumns`
(`[{base,mode:"abs"|"pct",mark:"bar"|"pin",label,clampPct}]` - there is no `width`
here, the panels size themselves), `showBaseValues`
(a value column appears for each variance _base_, so two ΔPY columns still give
one PY column), `waterfallWidth`, `labelMaxWidth`, `showWaterfall: false` for the
plain T04 grid, `defaultCollapsed`, `maxHeight` + `virtualize` for long statements.

**`WaterfallChart`** - keep every `category` to **about 10 characters**. The
rotated axis labels are clipped to a fixed box that does not grow with `height`,
so `"Subcontracted haulage"` renders `"Subcontra…"` however tall you make the
chart. Abbreviate at the data level: `"EBIT '24"`, `"Materials"`, `"Overhead"`.

`data: [{category, value, flow}]`, plus `comparisonData`:
the _same columns as budgeted_, which draws a variance panel under the bridge.
The panel compares the **running level** against the comparison bridge at each
step - a cumulative position-vs-plan walk that ends on the total miss - not the
per-step deltas; write the caption and commentary to that reading. This is the
strongest single chart in the library: it shows what moved and where the plan
was lost. An opening balance is `flow:"add"`; a closing
balance is `flow:"result"` and ignores its `value`.

**`TrendChart`** - `data` of ~13 periods, `referenceLines: ["PY","PL"]`,
`variance: "abs"|"pct"|"none"`. Mark a full-year total `summary: true`: it is then
excluded from the period scale and drawn with a marked scale break, instead of
crushing the months.

**`VarianceColumnChart`** - `data` (AC required), `comparison`, `variance`.

**`StructureChart`** - `data`, `comparison`, `showShare`, `sort`, `labelWidth`
(raise it until the longest category stops truncating).

**`RankingVarianceChart`** - `data: [{label, AC, base}]`, `baseLabel: "PL"`,
`sortBy`, `rowHeight`, `clampPct`.

**`DataTable`** - `columns` + `rows`. A column is
`{key, label, kind:"value"|"variance"|"sparkline", measure, scenario, base, mode,
mark, higherIsBetter, width, group, format}`; a row is
`{id, label, values:{measure:{AC,PY,…}}, spark:{measure:[…]}, children}`.
`group` on consecutive columns draws a spanning super-header.

**`KpiCard`** - available, but see `notation.md` before using it in a report.

`animate` is a `StatementTable` / `KpiCard` prop; `tooltip` exists on most charts
and tables. Passing both everywhere is harmless (React drops what it does not
use) and saves you checking each signature.

**`checkIbcs(config)`** - lints a `ChartConfig` / `ReportConfig` against the
encoded rule set and returns findings. Worth running when you have built the
report from JSON configs.

## Known rough edges, and what to do about them

These are current library behaviours (verified against `ibcs-react` 1.3.0),
not mistakes in your code:

- **Value labels clip at a `StatementTable` lane edge.** A bar sitting close to
  the lane's left edge gets its label drawn partly outside the SVG. Widen
  `waterfallWidth`, or apply a `zoom` class to the wrapper so the whole table has
  more logical width. A full P&L in one lane (domain 0…revenue) will always
  squeeze the small opex steps - accept a little of this or split the statement.
- **`RankingVarianceChart`'s top row is unreadable.** When the AC bar fills its
  panel - which the largest entity always does - the value label flips inside the
  bar but keeps the dark text colour, so it disappears into the fill. Widening and
  zooming do not help, because the geometry is proportional. Until this is fixed,
  use a `VarianceColumnChart` or `GroupedVarianceChart` for ranked plan
  comparisons and keep `RankingVarianceChart` for long lists where the top value
  is not the point.
- **Percent variance pins clip on the negative side.** The pin axis sits at 40%
  of the column width, so a label to the _left_ of it has much less room than one
  to the right, and a large negative percentage is drawn partly outside its own
  SVG. On a `DataTable` you can widen the column, or set `clampPct` below the
  outlier so it becomes an off-scale arrow - but clamping only promotes the next
  negative into the same spot when the whole column is negative. The reliable
  escape is `mark: "none"`, the IBCS T01 numeric treatment: a signed,
  impact-coloured number with no mark, which never overflows. `StatementTable`
  has no `mark:"none"`, so there the choice is a wider lane or dropping the
  percent panel and pointing the reader at a table that carries it.
- **`DataTable` has a large min-content width** and will blow out a `1fr` grid
  track. Put it in a fixed-width track (`minmax(0,1fr) 300px`) and shrink it with
  `zoom` if needed.
- **`higherIsBetter` on `DataTable` is per column, not per row.** Measures with
  opposite polarity (DIO and DPO) cannot share a column. Split them into separate
  tables, or leave the odd one out and mention it in the caption.
