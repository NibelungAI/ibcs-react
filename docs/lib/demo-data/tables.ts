import type {
  DataTableColumn,
  DataTableRow,
  MatrixPeriod,
  MatrixRow,
  MatrixValues,
  StatementLine,
} from "ibcs-react";

/* ============================================================================
 * Sample data for the table component pages. Plain, serializable consts so the
 * MDX pages stay readable; figures mirror the library's own demo dataset.
 * ========================================================================= */

/**
 * A P&L in the flat IBCS build-up layout: detail lines, then a `= result`
 * subtotal. Every result is the exact running total of the steps above it, so
 * the integrated waterfall is internally consistent. Figures in EUR.
 */
export const statementLines: StatementLine[] = [
  {
    id: "rev-product",
    label: "Product revenue",
    flow: "add",
    values: { AC: 17_200_000, PY: 16_100_000, PL: 17_000_000 },
  },
  {
    id: "rev-service",
    label: "Service and other revenue",
    flow: "add",
    values: { AC: 12_900_000, PY: 9_500_000, PL: 11_500_000 },
  },
  {
    id: "revenue",
    label: "Revenue",
    flow: "result",
    values: { AC: 30_100_000, PY: 25_600_000, PL: 28_500_000 },
  },
  {
    id: "cost-product",
    label: "Product cost",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 3_500_000, PY: 3_100_000, PL: 3_400_000 },
  },
  {
    id: "cost-service",
    label: "Service and other costs",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 6_200_000, PY: 5_300_000, PL: 6_000_000 },
  },
  {
    id: "gross-margin",
    label: "Gross margin",
    flow: "result",
    values: { AC: 20_400_000, PY: 17_200_000, PL: 19_100_000 },
  },
  {
    id: "opex-rnd",
    label: "Research and development",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 3_900_000, PY: 3_500_000, PL: 4_000_000 },
  },
  {
    id: "opex-sm",
    label: "Sales and marketing",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 4_800_000, PY: 4_300_000, PL: 4_600_000 },
  },
  {
    id: "opex-ga",
    label: "General and administrative",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 1_300_000, PY: 1_400_000, PL: 1_400_000 },
  },
  {
    id: "operating-income",
    label: "Operating income",
    flow: "result",
    values: { AC: 10_400_000, PY: 8_000_000, PL: 9_100_000 },
  },
  {
    id: "other-income",
    label: "Other income, net",
    flow: "add",
    values: { AC: 301_000, PY: 276_000, PL: 290_000 },
  },
  {
    id: "ibt",
    label: "Income before income taxes",
    flow: "result",
    values: { AC: 10_701_000, PY: 8_276_000, PL: 9_390_000 },
  },
  {
    id: "tax",
    label: "Provision for income taxes",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 1_800_000, PY: 195_000, PL: 1_900_000 },
  },
  {
    id: "net-income",
    label: "Net income",
    flow: "result",
    values: { AC: 8_901_000, PY: 8_081_000, PL: 7_490_000 },
  },
];

/**
 * A balance sheet - a STOCK statement (ending balances, not period movements).
 * Assets balance against liabilities plus equity. Liability lines carry
 * `higherIsBetter: false`, so a rise in debt reads as unfavorable.
 */
export const balanceSheetLines: StatementLine[] = [
  {
    id: "current-assets",
    label: "Current assets",
    flow: "add",
    emphasis: true,
    values: {},
    children: [
      {
        id: "cash",
        label: "Cash and equivalents",
        flow: "add",
        values: { AC: 8_200_000, PY: 6_500_000 },
      },
      {
        id: "receivables",
        label: "Accounts receivable",
        flow: "add",
        values: { AC: 5_400_000, PY: 4_900_000 },
      },
      {
        id: "inventory",
        label: "Inventory",
        flow: "add",
        values: { AC: 3_100_000, PY: 3_400_000 },
      },
    ],
  },
  {
    id: "noncurrent-assets",
    label: "Non-current assets",
    flow: "add",
    emphasis: true,
    values: {},
    children: [
      {
        id: "ppe",
        label: "Property, plant & equipment",
        flow: "add",
        values: { AC: 12_000_000, PY: 11_200_000 },
      },
      {
        id: "goodwill",
        label: "Goodwill & intangibles",
        flow: "add",
        values: { AC: 6_300_000, PY: 6_300_000 },
      },
      {
        id: "other-nca",
        label: "Other non-current assets",
        flow: "add",
        values: { AC: 2_000_000, PY: 1_700_000 },
      },
    ],
  },
  {
    id: "total-assets",
    label: "Total assets",
    flow: "result",
    values: { AC: 37_000_000, PY: 34_000_000 },
  },
  {
    id: "liabilities",
    label: "Liabilities",
    flow: "add",
    higherIsBetter: false,
    emphasis: true,
    values: {},
    children: [
      {
        id: "payables",
        label: "Accounts payable",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 4_100_000, PY: 3_600_000 },
      },
      {
        id: "short-debt",
        label: "Short-term debt",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 2_500_000, PY: 3_000_000 },
      },
      {
        id: "long-debt",
        label: "Long-term debt",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 9_000_000, PY: 9_500_000 },
      },
      {
        id: "deferred",
        label: "Deferred tax & other",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 1_400_000, PY: 1_200_000 },
      },
    ],
  },
  {
    id: "equity",
    label: "Shareholders' equity",
    flow: "add",
    emphasis: true,
    values: {},
    children: [
      {
        id: "share-capital",
        label: "Share capital",
        flow: "add",
        values: { AC: 5_000_000, PY: 5_000_000 },
      },
      {
        id: "retained",
        label: "Retained earnings",
        flow: "add",
        values: { AC: 15_000_000, PY: 11_700_000 },
      },
    ],
  },
  {
    id: "total-le",
    label: "Total liabilities & equity",
    flow: "result",
    values: { AC: 37_000_000, PY: 34_000_000 },
  },
];

/* ------------------------------- DataTable ------------------------------- */

/** Six regions, two measures (revenue and operating income), AC vs PY. */
export const regionRows: DataTableRow[] = [
  {
    id: "amer",
    label: "North America",
    values: { rev: { AC: 11.2e6, PY: 11.9e6 }, oi: { AC: 2.0e6, PY: 2.3e6 } },
    spark: { rev: [12.4e6, 11.8e6, 11.5e6, 11.2e6] },
  },
  {
    id: "emea",
    label: "Europe",
    values: { rev: { AC: 8.6e6, PY: 7.4e6 }, oi: { AC: 1.7e6, PY: 1.3e6 } },
    spark: { rev: [6.1e6, 6.9e6, 7.4e6, 8.6e6] },
  },
  {
    id: "apac",
    label: "Asia Pacific",
    values: { rev: { AC: 5.1e6, PY: 3.7e6 }, oi: { AC: 1.1e6, PY: 0.7e6 } },
    spark: { rev: [3.0e6, 3.7e6, 4.7e6, 5.1e6] },
  },
  {
    id: "latam",
    label: "Latin America",
    values: { rev: { AC: 2.1e6, PY: 1.8e6 }, oi: { AC: 0.34e6, PY: 0.31e6 } },
    spark: { rev: [1.4e6, 1.6e6, 1.9e6, 2.1e6] },
  },
  {
    id: "mea",
    label: "Middle East & Africa",
    values: { rev: { AC: 1.1e6, PY: 0.8e6 }, oi: { AC: 0.18e6, PY: 0.1e6 } },
    spark: { rev: [0.5e6, 0.7e6, 0.9e6, 1.1e6] },
  },
  {
    id: "other",
    label: "Other",
    values: { rev: { AC: 0.9e6, PY: 1.0e6 }, oi: { AC: 0.08e6, PY: 0.12e6 } },
    spark: { rev: [1.2e6, 1.1e6, 1.0e6, 0.9e6] },
  },
];

/** Value, variance (bar + pin) and sparkline columns over those two measures. */
export const regionColumns: DataTableColumn[] = [
  { key: "rev", label: "Revenue", kind: "value", scenario: "AC" },
  {
    key: "rev_d",
    label: "\u0394PY",
    kind: "variance",
    measure: "rev",
    base: "PY",
    mode: "abs",
    mark: "bar",
  },
  {
    key: "rev_p",
    label: "\u0394PY %",
    kind: "variance",
    measure: "rev",
    base: "PY",
    mode: "pct",
    mark: "pin",
  },
  { key: "trend", label: "Trend", kind: "sparkline", measure: "rev" },
  { key: "oi", label: "Op. income", kind: "value", scenario: "AC" },
  {
    key: "oi_d",
    label: "\u0394PY",
    kind: "variance",
    measure: "oi",
    base: "PY",
    mode: "abs",
    mark: "bar",
  },
];

/* ---------------------------- ComparisonTable ---------------------------- */

/**
 * Profit after tax by region, in kEUR. Two measures per country: `m` (the
 * current month) and `y` (year to date), each with PY / PL / AC. Region rows
 * are bold subtotals summed from their children.
 */
export const comparisonRows: DataTableRow[] = [
  {
    id: "europe",
    label: "Europe",
    emphasis: true,
    values: {},
    children: [
      {
        id: "at",
        label: "Austria",
        values: { m: { PY: 560, PL: 590, AC: 558 }, y: { PY: 5_078, PL: 5_611, AC: 5_509 } },
      },
      {
        id: "de",
        label: "Germany",
        values: { m: { PY: 345, PL: 279, AC: 260 }, y: { PY: 3_124, PL: 2_815, AC: 2_850 } },
      },
      {
        id: "fr",
        label: "France",
        values: { m: { PY: 140, PL: 149, AC: 134 }, y: { PY: 1_290, PL: 1_488, AC: 1_354 } },
      },
    ],
  },
  {
    id: "americas",
    label: "Americas",
    emphasis: true,
    values: {},
    children: [
      {
        id: "us",
        label: "USA",
        values: { m: { PY: 346, PL: 326, AC: 311 }, y: { PY: 3_406, PL: 3_124, AC: 3_239 } },
      },
      {
        id: "br",
        label: "Brazil",
        values: { m: { PY: 119, PL: 109, AC: 121 }, y: { PY: 1_205, PL: 1_254, AC: 1_314 } },
      },
    ],
  },
  {
    id: "row",
    label: "Rest of world",
    emphasis: true,
    values: {},
    children: [
      {
        id: "cn",
        label: "China",
        values: { m: { PY: 266, PL: 204, AC: 231 }, y: { PY: 2_107, PL: 1_925, AC: 2_399 } },
      },
      {
        id: "au",
        label: "Australia",
        values: { m: { PY: 54, PL: 66, AC: 62 }, y: { PY: 517, PL: 609, AC: 588 } },
      },
    ],
  },
];

/** Left group - the current month: PY / PL / AC, then a numeric AC-PY pair. */
export const comparisonLeft: DataTableColumn[] = [
  { key: "m_py", label: "PY", kind: "value", measure: "m", scenario: "PY" },
  { key: "m_pl", label: "PL", kind: "value", measure: "m", scenario: "PL" },
  { key: "m_ac", label: "AC", kind: "value", measure: "m", scenario: "AC" },
  {
    key: "m_dpy",
    label: "\u0394PY",
    kind: "variance",
    measure: "m",
    base: "PY",
    mode: "abs",
    mark: "none",
    subgroup: "AC-PY",
    gapBefore: true,
  },
  {
    key: "m_dpy_pct",
    label: "%",
    kind: "variance",
    measure: "m",
    base: "PY",
    mode: "pct",
    mark: "none",
    subgroup: "AC-PY",
  },
];

/** Right group - the same measures year to date, with embedded marks. */
export const comparisonRight: DataTableColumn[] = [
  { key: "y_py", label: "PY", kind: "value", measure: "y", scenario: "PY" },
  { key: "y_pl", label: "PL", kind: "value", measure: "y", scenario: "PL" },
  { key: "y_ac", label: "AC", kind: "value", measure: "y", scenario: "AC" },
  {
    key: "y_dpy",
    label: "\u0394PY",
    kind: "variance",
    measure: "y",
    base: "PY",
    mode: "abs",
    mark: "bar",
    gapBefore: true,
  },
  {
    key: "y_dpy_pct",
    label: "\u0394PY%",
    kind: "variance",
    measure: "y",
    base: "PY",
    mode: "pct",
    mark: "pin",
    gapBefore: true,
  },
];

/* ------------------------------ MatrixTable ------------------------------ */

/** A short P&L row tree - one collapsible group plus result lines. */
export const matrixRows: MatrixRow[] = [
  {
    id: "revenue",
    label: "Revenue",
    flow: "result",
    children: [
      { id: "software", label: "Software revenue", flow: "add" },
      { id: "services", label: "Services revenue", flow: "add" },
    ],
  },
  { id: "cogs", label: "Cost of sales", flow: "subtract", higherIsBetter: false },
  { id: "gross", label: "Gross profit", flow: "result", doubleRule: true },
];

/** 2023 as a single column, 2024 drilling down to quarters. */
export const matrixColumns: MatrixPeriod[] = [
  { id: "2023", label: "2023" },
  {
    id: "2024",
    label: "2024",
    children: [
      { id: "2024-Q1", label: "Q1" },
      { id: "2024-Q2", label: "Q2" },
      { id: "2024-Q3", label: "Q3" },
      { id: "2024-Q4", label: "Q4" },
    ],
  },
];

/**
 * `values[rowId][periodId][scenario]`, in mUSD. `Revenue` carries no values of
 * its own - the matrix aggregates it from its children. Quarterly figures add
 * up to their year.
 */
export const matrixValues: MatrixValues = {
  software: {
    "2023": { PL: 543, AC: 565 },
    "2024": { PL: 620, AC: 598 },
    "2024-Q1": { PL: 143, AC: 138 },
    "2024-Q2": { PL: 152, AC: 147 },
    "2024-Q3": { PL: 158, AC: 152 },
    "2024-Q4": { PL: 167, AC: 161 },
  },
  services: {
    "2023": { PL: 231, AC: 209 },
    "2024": { PL: 205, AC: 218 },
    "2024-Q1": { PL: 48, AC: 51 },
    "2024-Q2": { PL: 50, AC: 53 },
    "2024-Q3": { PL: 52, AC: 55 },
    "2024-Q4": { PL: 55, AC: 59 },
  },
  cogs: {
    "2023": { PL: 199, AC: 222 },
    "2024": { PL: 230, AC: 244 },
    "2024-Q1": { PL: 55, AC: 59 },
    "2024-Q2": { PL: 57, AC: 61 },
    "2024-Q3": { PL: 58, AC: 62 },
    "2024-Q4": { PL: 60, AC: 62 },
  },
  gross: {
    "2023": { PL: 575, AC: 552 },
    "2024": { PL: 595, AC: 572 },
    "2024-Q1": { PL: 136, AC: 130 },
    "2024-Q2": { PL: 145, AC: 139 },
    "2024-Q3": { PL: 152, AC: 145 },
    "2024-Q4": { PL: 162, AC: 158 },
  },
};
