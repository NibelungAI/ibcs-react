/**
 * Small datasets for the IBCS template gallery (`content/docs/templates.mdx`).
 * Each one is sized for a card-scale preview — the point is the notation, not
 * the numbers. Larger, shared models live in `sample-data.ts`.
 */
import type {
  StackedDatum,
  StackedSeries,
  ScatterDatum,
  BubbleDatum,
  WaterfallDatum,
  GroupedDatum,
  ColumnVarianceDatum,
  BarVarianceDatum,
  RatioNode,
  MiniGroupInput,
  DataTableColumn,
  DataTableRow,
} from "ibcs-react";

/** C01 / C02 — revenue split by offering, four quarters. */
export const stackedData: StackedDatum[] = [
  { category: "Q1", values: { product: 12e6, service: 8e6, other: 3e6 } },
  { category: "Q2", values: { product: 13.5e6, service: 9.2e6, other: 3.4e6 } },
  { category: "Q3", values: { product: 14.1e6, service: 9.8e6, other: 3.6e6 } },
  { category: "Q4", values: { product: 15.6e6, service: 10.4e6, other: 4.1e6 } },
];

export const stackedSeries: StackedSeries[] = [
  { key: "product", label: "Product" },
  { key: "service", label: "Service" },
  { key: "other", label: "Other" },
];

/** C03 — quarterly actual against previous year. */
export const groupedQuarters: GroupedDatum[] = [
  { category: "Q1", AC: 1240, comparisonValue: 1100 },
  { category: "Q2", AC: 980, comparisonValue: 1020 },
  { category: "Q3", AC: 1320, comparisonValue: 1180 },
  { category: "Q4", AC: 1510, comparisonValue: 1480 },
];

/** C04 — regional actual against plan. */
export const groupedRegions: GroupedDatum[] = [
  { category: "North", AC: 620, comparisonValue: 580 },
  { category: "South", AC: 410, comparisonValue: 460 },
  { category: "East", AC: 530, comparisonValue: 500 },
];

/** C05 — monthly actual vs plan, the last two months forecast. */
export const columnVarianceMonths: ColumnVarianceDatum[] = [
  { category: "Jan", ac: 15, pl: 11 },
  { category: "Feb", ac: 13, pl: 12 },
  { category: "Mar", ac: 17, pl: 14 },
  { category: "Apr", ac: 9, pl: 12, isForecast: true },
  { category: "May", ac: 11, pl: 12, isForecast: true },
];

/** C06 — regions with an actual, a plan base and a previous-year value. */
export const barVarianceRegions: BarVarianceDatum[] = [
  { label: "West", ac: 169, base: 150, py: 140 },
  { label: "East", ac: 120, base: 150, py: 160 },
  { label: "South", ac: 110, base: 95, py: 90 },
  { label: "North", ac: 90, base: 120, py: 130 },
];

/** C09 — revenue against gross profit by customer segment. */
export const scatterSegments: ScatterDatum[] = [
  { x: 120, y: 18, group: "Enterprise" },
  { x: 60, y: 9, group: "SMB" },
  { x: 90, y: 14, group: "Enterprise" },
  { x: 40, y: 6, group: "SMB" },
  { x: 150, y: 22, group: "Enterprise" },
  { x: 75, y: 8, group: "Mid" },
  { x: 110, y: 16, group: "Mid" },
];

/** C10 — growth, margin and revenue size by country. */
export const bubbleCountries: BubbleDatum[] = [
  { x: 12, y: 4.5, size: 320, group: "EU", label: "DE" },
  { x: 8, y: 2.1, size: 110, group: "NA", label: "US" },
  { x: 5, y: 6.2, size: 90, group: "APAC", label: "JP" },
  { x: 15, y: 3.0, size: 210, group: "EU", label: "UK" },
  { x: 3, y: 1.5, size: 60, group: "APAC", label: "AU" },
];

/** C11 — return on assets, split into its two drivers. */
export const ratioTreeRoot: RatioNode = {
  id: "roa",
  label: "RoA %",
  op: "/",
  series: [12.4, 13.1, 11.8, 14.0, 15.2],
  children: [
    { id: "ret", label: "Return", series: [5.0, 5.4, 4.8, 6.1, 6.7] },
    { id: "assets", label: "Assets", series: [40, 41, 41, 44, 44] },
  ],
};

/** C12 — a four-step operating-income bridge. */
export const bridgeSteps: WaterfallDatum[] = [
  { category: "Revenue", value: 30.1e6, flow: "add" },
  { category: "COGS", value: 9.7e6, flow: "subtract", higherIsBetter: false },
  { category: "Opex", value: 10e6, flow: "subtract", higherIsBetter: false },
  { category: "Op. income", value: 0, flow: "result" },
];

/** C13 — two regions, three quarters each, on a shared scale. */
export const miniGroups: MiniGroupInput[] = [
  {
    label: "EMEA",
    data: [
      { category: "Q1", AC: 3.1e6, PY: 2.8e6 },
      { category: "Q2", AC: 3.4e6, PY: 3.0e6 },
      { category: "Q3", AC: 3.6e6, PY: 3.2e6 },
    ],
  },
  {
    label: "Americas",
    data: [
      { category: "Q1", AC: 4.2e6, PY: 4.4e6 },
      { category: "Q2", AC: 4.0e6, PY: 4.3e6 },
      { category: "Q3", AC: 4.5e6, PY: 4.2e6 },
    ],
  },
];

/** T01 (card scale) — revenue by region with a bar and a pin variance. */
export const templateTableColumns: DataTableColumn[] = [
  { key: "revenue", label: "Rev AC", kind: "value", scenario: "AC" },
  {
    key: "rev_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "revenue",
    base: "PY",
    mode: "abs",
    mark: "bar",
  },
  {
    key: "rev_pct",
    label: "ΔPY %",
    kind: "variance",
    measure: "revenue",
    base: "PY",
    mode: "pct",
    mark: "pin",
  },
];

export const templateTableRows: DataTableRow[] = [
  { id: "emea", label: "EMEA", values: { revenue: { AC: 8.6e6, PY: 7.4e6 } } },
  { id: "amer", label: "Americas", values: { revenue: { AC: 11.2e6, PY: 11.9e6 } } },
  { id: "apac", label: "APAC", values: { revenue: { AC: 5.1e6, PY: 3.7e6 } } },
];
