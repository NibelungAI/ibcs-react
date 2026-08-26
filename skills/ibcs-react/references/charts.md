# Charts — quick reference

Every chart: pixel `width`/`height`, `format?: FormatOptions`, `tokens?`,
`title?`, `className`/`style`, `ref` → the `<svg>`, and (where interactive)
`onHover`, `tooltip` (default `true`), some `onSelect`. Categorical charts also
take `bandPadding?: { inner?, outer? }` — `{ outer: 0 }` for flush-to-edge.

Shared vocabulary: `comparison?: ScenarioKey` (the base scenario),
`variance?: "abs" | "pct" | "none"`, `mark?: "bar" | "pin"`,
`showAbsPanel` / `showPctPanel`, `showTotals`, `referenceLines?: ScenarioKey[]`,
`comparisonData` (a parallel _dataset_, waterfalls only), `higherIsBetter`.

## Core scenario charts

| Component             | Data                                                                                                                                                   | Key props                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `VarianceColumnChart` | `ColumnDatum[]` = `ScenarioDatum & { AC: number }`                                                                                                     | `comparison="PY"`, `variance="abs"`, `mark`, `higherIsBetter`, `onSelect` (560×320)               |
| `TrendChart`          | `TrendDatum[]` (`ScenarioDatum & { summary? }`; a `summary` total stays off the period scale — capped + marked scale break when it dwarfs the months)  | `comparison`, `variance`, `referenceLines={["PY","PL"]}`, `showValueLabels`, `onSelect` (720×360) |
| `StructureChart`      | `StructureDatum[]` = `{ category, AC?, PY?, PL?, FC?, higherIsBetter? }` — same `category` key as every other chart (`label` accepted as legacy alias) | `sort="desc"\|"asc"\|"none"`, `showComparison`, `showShare`, `variance`, `labelWidth` (600×320)   |
| `KpiCard`             | `KpiConfig` props: `label`, `values`, `comparisons=["PY"]`                                                                                             | `higherIsBetter`, `format`, `sparkline: number[]`, `sparklineType`, `appearance`, `animate`       |
| `Sparkline`           | `data: number[]`                                                                                                                                       | `type="line"\|"area"\|"bar"`, `showLast`, `fluid`, `color`                                        |
| `VarianceBar`         | —                                                                                                                                                      | `value`, `max`, `favorable`, `mark` (the primitive used in tables)                                |

## IBCS chart templates C01–C13

| Template                               | Component                      | Data / notes                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 stacked columns · C02 stacked bars | `StackedChart`                 | `data: StackedDatum[]` (`{ category, values: Record<string, number> }`) + `series: StackedSeries[]` (`{ key, label, color? }`), `orientation="column"\|"bar"`, `showTotals`, `highlight`                                    |
| C03/C04 multi-tier grouped             | `GroupedVarianceChart`         | `data: GroupedDatum[]` (`{ category, AC, comparisonValue, isForecast? }`), `comparison: "PY"\|"PL"\|"FC"`, `orientation`, `showAbsPanel`, `showPctPanel`, `clampPct`                                                        |
| C05 columns + horizontal waterfall     | `ColumnVarianceWaterfallChart` | `data: ColumnVarianceDatum[]` (`{ category, ac, pl, isForecast? }` — lowercase), `priorTotals`, `endTotal`, `showPctPanel`, `clampPct`                                                                                      |
| C05 horizontal bridge                  | `HorizontalWaterfallChart`     | `data: WaterfallDatum[]`, `comparisonData`, `scenario`, `rowHeight`, `showValueLabels`                                                                                                                                      |
| C06 bars + vertical waterfall          | `BarVarianceWaterfallChart`    | `data: BarVarianceDatum[]` (`{ label, ac, base, py? }`), `pyTotal`, `sortBy="variance"\|"value"\|"none"`, `pctBase="PY"\|"PL"`, `rowHeight`                                                                                 |
| C07 line                               | `LineChart`                    | `data: LineDatum[]` (= `ScenarioDatum`), `series?: ScenarioKey[]`, `comparison`, `variance`, `showMarkers`, `forecastFrom` (index where the hatched/forecast tail starts), `references: (ReferenceLine \| ReferenceBand)[]` |
| C08 area                               | `AreaChart`                    | `data: LineDatum[]`, `scenario="AC"`, `baseline?: ScenarioKey \| null` (reference line on top), `showMarkers`                                                                                                               |
| C09 scattergram                        | `ScatterChart`                 | `data: ScatterDatum[]` (`{ x, y, group?, label? }`), `xLabel`, `yLabel`, `isoLines` (constant-product lines), `pointRadius`, `markLimit`, `maxPoints`, `colorBy`                                                            |
| C10 bubble                             | `BubbleChart`                  | `data: BubbleDatum[]` (`ScatterDatum & { size }`), `sizeLabel`, `maxRadius`, `labelLimit`                                                                                                                                   |
| C11 calculation tree                   | `TreeChart`                    | `root: TreeNode` (`{ id, label, value, py?, op?: "+"\|"-"\|"*"\|"/", children? }`), `orientation`, `showVariance`                                                                                                           |
| C11 ratio / DuPont tree                | `RatioTreeChart`               | `root: RatioNode` (`{ id, label, series: number[], py?: number[], op?, children? }`), `miniChart="column"\|"line"`, `nodeWidth`, `nodeHeight`                                                                               |
| C12 vertical waterfall                 | `WaterfallChart`               | `data: WaterfallDatum[]` (`{ category, value, flow?, higherIsBetter? }`), `comparisonData`, `scenario="AC"`, `mark`, `showValueLabels`, `connector: { style, width, align }` (640×360)                                      |
| C12 two bridges + variance tiers       | `WaterfallStatementChart`      | `lines: WaterfallStatementLine[]` (`{ label, ac, base, flow? }`), `comparison`, `showPctPanel`, `clampPct`, `clampAbs`, `rowHeight`                                                                                         |
| C13 small multiples                    | `SmallMultiples`               | `items`, `renderItem: (item, scale, index) => ReactNode`, `valuesOf`, `columns`, `nice`, `symmetric`, `clampPercentile`, `keyOf` — the shared scale is the IBCS CHECK rule                                                  |
| C13 variance multiples                 | `MiniVarianceMultiples`        | `groups: MiniGroupInput[]` (`{ label, data }`), `comparison`, `columns`, `panelHeight`, `sharedScale`, `clampPercentile`, `showScaleHint`                                                                                   |

## Extras

| Component                 | Data                                                                              | Key props                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `ComboChart`              | `data: ComboDatum[]` + `secondary: ComboSecondaryDatum[]` (`{ category, value }`) | `secondaryKey`, `primaryLabel`, `secondaryLabel`, `secondaryFormat`, `comparison`, `showComparison`, `showVariance`, `showSecondaryLabels` |
| `IntegratedVarianceChart` | `data: IntegratedDatum[]` (`{ category, AC, PY?, PL?, isForecast? }`)             | `comparison: "PY"\|"PL"`, `showAbsPanel`, `showPctPanel`, `fyTotal` — the signature 3-tier Δ% pins / Δ bars / AC columns                   |
| `RankingVarianceChart`    | `data: RankingDatum[]` (`{ label, AC, base, higherIsBetter? }`)                   | `baseLabel`, `sortBy`, `clampPct`, `rowHeight`, `showTotals`                                                                               |
| `VarianceAreaChart`       | `data: VarianceAreaDatum[]` (`{ category, AC, reference, FC? }`)                  | `forecastFrom`, `referenceLabel`, `mark`, `higherIsBetter`                                                                                 |
| `PieChart`                | `data: PieDatum[]` (`{ label, value, color? }`) or `share`                        | `donut`, `size`, `emphasisIndex`, `growth` — **IBCS discourages pies; `checkIbcs` flags them**                                             |

## Config-driven charts

11 chart types are serializable JSON (`CHART_TYPES`: `varianceColumn`, `trend`,
`structure`, `waterfall`, `stacked`, `line`, `area`, `scatter`, `bubble`,
`combo`, `tree`). Specialist charts (pie, variance-waterfall family, small
multiples, ratio tree) are component-only.

```tsx
import { ConfiguredChart, validateChartConfig, Report, validateReportConfig } from "ibcs-react";

const result = validateChartConfig(raw); // { ok: true, config } | { ok: false, error }
if (result.ok) return <ConfiguredChart config={result.config} />;

<Report config={reportConfig} sharedScales sharedScaleClampPercentile={0.98} />;
```

`ReportConfig` = `{ title: { who, what, when }, message?, columns, blocks: [{ id, type: "kpi"|"chart"|"statement"|"table"|"text", span, config }] }`.

## Loading / empty states, a11y

- `ChartState` — `loading` / `error` / `empty` / children in one wrapper, with
  `renderLoading`/`renderError`/`renderEmpty`, `onRetry`; pairs with
  `useAsyncData` (`{ data, loading, error, refetch }`).
- `Skeleton` — `variant`, `rows`, `bars`, `label`.
- `ChartDataTable` — the visually-hidden numeric table charts already render.
- Hooks: `useStatement`, `useVariance`/`useVariances`, `useFilters`,
  `useLiveData`, `useAsyncData`, `useChartSelection`, `useChartHover`,
  `useElementSize`, `usePrefersReducedMotion`, `useMountGrow`,
  `useAnimatedValue`, `useCountUp`.
