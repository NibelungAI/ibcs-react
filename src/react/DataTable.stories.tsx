import type { Meta, StoryObj } from "@storybook/react";
import { DataTable } from "./DataTable";
import type { DataTableColumn, DataTableRow } from "../core/datatable";

const columns: DataTableColumn[] = [
  { key: "revenue", label: "Revenue AC", kind: "value", scenario: "AC" },
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
    key: "rev_dpy_pct",
    label: "ΔPY %",
    kind: "variance",
    measure: "revenue",
    base: "PY",
    mode: "pct",
    mark: "pin",
  },
  { key: "trend", label: "Trend", kind: "sparkline", measure: "revenue", sparkType: "line" },
];

const rows: DataTableRow[] = [
  {
    id: "emea",
    label: "EMEA",
    values: { revenue: { AC: 8.6e6, PY: 7.4e6 } },
    spark: { revenue: [6.1, 6.4, 6.9, 7.4, 8.0, 8.6].map((v) => v * 1e6) },
  },
  {
    id: "amer",
    label: "Americas",
    values: { revenue: { AC: 11.2e6, PY: 11.9e6 } },
    spark: { revenue: [12.4, 12.1, 11.8, 11.5, 11.3, 11.2].map((v) => v * 1e6) },
  },
  {
    id: "apac",
    label: "APAC",
    values: { revenue: { AC: 5.1e6, PY: 3.7e6 } },
    spark: { revenue: [3.0, 3.3, 3.7, 4.2, 4.7, 5.1].map((v) => v * 1e6) },
  },
  {
    id: "other",
    label: "Other",
    values: { revenue: { AC: 0.9e6, PY: 0.95e6 } },
    spark: { revenue: [1.0, 0.98, 0.97, 0.95, 0.92, 0.9].map((v) => v * 1e6) },
  },
];

const meta: Meta<typeof DataTable> = {
  title: "Tables/DataTable",
  component: DataTable,
  args: {
    columns,
    rows,
    format: { compact: true, decimals: 1 },
    showTotals: true,
    defaultSort: { key: "revenue", dir: "desc" },
  },
};
export default meta;

type Story = StoryObj<typeof DataTable>;

export const RevenueByRegion: Story = {};

export const NoTotals: Story = { args: { showTotals: false } };

export const SortedByVariance: Story = { args: { defaultSort: { key: "rev_dpy", dir: "asc" } } };

export const CostTable: Story = {
  args: {
    columns: [
      { key: "cost", label: "Cost AC", kind: "value", scenario: "AC" },
      {
        key: "cost_dpl",
        label: "ΔPL",
        kind: "variance",
        measure: "cost",
        base: "PL",
        mode: "abs",
        mark: "bar",
        higherIsBetter: false,
      },
      {
        key: "cost_dpl_pct",
        label: "ΔPL %",
        kind: "variance",
        measure: "cost",
        base: "PL",
        mode: "pct",
        mark: "pin",
        higherIsBetter: false,
      },
    ],
    rows: [
      { id: "ops", label: "Operations", values: { cost: { AC: 4.2e6, PL: 3.9e6 } } },
      { id: "sales", label: "Sales & Mktg", values: { cost: { AC: 2.1e6, PL: 2.4e6 } } },
      { id: "ga", label: "G&A", values: { cost: { AC: 1.3e6, PL: 1.25e6 } } },
    ],
  },
};

/* -------------------------------------------------------------------------- *
 * T01 — "Table with hierarchical rows and variance columns".
 * Two column GROUPS ("Current month" / "Year to date"), each with AC plus an
 * absolute (ΔPY bar) and a relative (ΔPY% pin) variance. Regions are
 * hierarchical rows; a divider separates the two groups; totals are summed.
 * -------------------------------------------------------------------------- */

const t01Columns: DataTableColumn[] = [
  // Current month
  {
    key: "m_ac",
    label: "AC",
    kind: "value",
    measure: "month",
    scenario: "AC",
    group: "Current month",
  },
  {
    key: "m_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "month",
    base: "PY",
    mode: "abs",
    mark: "bar",
    group: "Current month",
  },
  {
    key: "m_dpy_pct",
    label: "ΔPY %",
    kind: "variance",
    measure: "month",
    base: "PY",
    mode: "pct",
    mark: "pin",
    group: "Current month",
  },
  // Year to date
  {
    key: "y_ac",
    label: "AC",
    kind: "value",
    measure: "ytd",
    scenario: "AC",
    group: "Year to date",
  },
  {
    key: "y_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "ytd",
    base: "PY",
    mode: "abs",
    mark: "bar",
    group: "Year to date",
  },
  {
    key: "y_dpy_pct",
    label: "ΔPY %",
    kind: "variance",
    measure: "ytd",
    base: "PY",
    mode: "pct",
    mark: "pin",
    group: "Year to date",
  },
];

const leaf = (
  id: string,
  label: string,
  mAc: number,
  mPy: number,
  yAc: number,
  yPy: number,
): DataTableRow => ({
  id,
  label,
  values: { month: { AC: mAc, PY: mPy }, ytd: { AC: yAc, PY: yPy } },
});

const t01Rows: DataTableRow[] = [
  {
    id: "emea",
    label: "EMEA",
    values: {},
    children: [
      leaf("de", "Germany", 1.42e6, 1.28e6, 8.1e6, 7.6e6),
      leaf("uk", "United Kingdom", 0.96e6, 1.02e6, 5.7e6, 6.0e6),
      leaf("fr", "France", 0.74e6, 0.69e6, 4.3e6, 4.1e6),
    ],
  },
  {
    id: "amer",
    label: "Americas",
    values: {},
    children: [
      leaf("us", "United States", 2.31e6, 2.05e6, 13.4e6, 12.2e6),
      leaf("ca", "Canada", 0.58e6, 0.61e6, 3.4e6, 3.5e6),
      leaf("latam", "LATAM", 0.41e6, 0.33e6, 2.2e6, 1.9e6),
    ],
  },
  {
    id: "apac",
    label: "APAC",
    values: {},
    children: [
      leaf("jp", "Japan", 0.83e6, 0.88e6, 4.9e6, 5.1e6),
      leaf("au", "Australia", 0.47e6, 0.41e6, 2.7e6, 2.4e6),
      leaf("cn", "China", 0.69e6, 0.52e6, 3.8e6, 2.9e6),
    ],
  },
];

export const T01_GroupedHeaders: Story = {
  args: {
    columns: t01Columns,
    rows: t01Rows,
    format: { compact: true, decimals: 1 },
    showTotals: true,
    totalsLabel: "Group",
    defaultSort: { key: "m_ac", dir: "desc" },
    style: { maxWidth: 760 },
  },
};
