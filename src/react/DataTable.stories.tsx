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
 * T01 - "Table with hierarchical rows and variance columns".
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

/** Value columns drawn as magnitude bars (the value itself, not a difference), exact digits. */
export const MagnitudeBars: Story = {
  args: {
    showTotals: false,
    defaultSort: { key: "dps", dir: "desc" },
    format: { compact: false, fractionDigits: 1 },
    columns: [
      { key: "dps", label: "DPS", mark: "bar" },
      { key: "share", label: "Share %" },
      { key: "casts", label: "Casts" },
    ],
    rows: [
      { id: "shoot", label: "Shoot", values: { dps: 215.037, share: 23.609, casts: 41.647 } },
      { id: "raptor", label: "Raptor Strike", values: { dps: 91.041, share: 9.996, casts: 30.2 } },
      { id: "wing", label: "Wing Clip", values: { dps: 40.3, share: 4.425, casts: 35.156 } },
      { id: "trap", label: "Immolation Trap", values: { dps: 31.5, share: 3.459, casts: 6 } },
    ],
  },
};

/** Intervals: DPS ± in text, the Δ as a pin with its error bar, and a band of the tied variants. */
export const IntervalsAndBand: Story = {
  args: {
    showTotals: false,
    defaultSort: null,
    format: { compact: false, fractionDigits: 2 },
    columns: [
      { key: "dps", label: "DPS" },
      {
        key: "delta",
        label: "Δ vs equipped",
        kind: "variance",
        measure: "dps",
        base: "PL",
        mark: "pin",
        width: 190,
        bands: [{ from: 2.9952, to: 3.9194, label: "Tied with the best" }],
      },
    ],
    rows: [
      ["Best set", 914.3013, 0.4682, 0.4621],
      ["Ring swap", 914.0512, 0.4511, 0.4402],
      ["Bracers swap", 910.9064, 0.4744, 0.1347],
      ["Equipped", 910.8441, 0.4808, 0],
      ["Trinket swap", 907.9623, 0.4793, 0.5439],
      ["Weapon swap", 906.2537, 0.4951, 0.6408],
    ].map(([label, dps, own, paired]) => ({
      id: String(label),
      label: String(label),
      values: { dps: { AC: Number(dps), PL: 910.8441 } },
      errors: { dps: Number(own), delta: Number(paired) },
    })),
  },
};

/** A plain svg glyph as a 56 px `data:` URI - a stand-in for a game icon, not game art. */
const glyph = (background: string, shape: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect width="56" height="56" fill="${background}"/>${shape}</svg>`,
  )}`;

/**
 * Icons in row labels: a spell icon per row, an item named in its quality's
 * colour and framed in it, an 18 px file drawn at 18 px, and a row without an
 * icon that keeps the labels aligned.
 */
export const IconsInRowLabels: Story = {
  args: {
    showTotals: true,
    defaultSort: null,
    columns: [
      { key: "dps", label: "DPS", mark: "bar", format: { compact: false, fractionDigits: 1 } },
      { key: "casts", label: "Casts", format: { compact: false, fractionDigits: 1 } },
    ],
    rows: [
      {
        id: "shoot",
        label: "Shoot",
        icon: {
          src: glyph(
            "#24382c",
            '<path d="M13 43 L41 15 M27 15 H41 V29" stroke="#d3e6b5" stroke-width="5" fill="none"/>',
          ),
          naturalSize: 56,
        },
        values: { dps: 215.04, casts: 41.65 },
      },
      {
        id: "ring",
        label: "Signet of Embers",
        labelColor: "#a335ee",
        icon: {
          src: glyph(
            "#3d2f4a",
            '<circle cx="28" cy="30" r="12" fill="none" stroke="#e2c46a" stroke-width="6"/>',
          ),
          naturalSize: 56,
          border: "#a335ee",
        },
        values: { dps: 40.3, casts: 12 },
      },
      {
        id: "trap",
        label: "Immolation Trap",
        icon: {
          src: glyph(
            "#4a2a1f",
            '<path d="M28 10 C40 24 40 34 28 46 C16 34 18 24 28 10Z" fill="#f0a23a"/>',
          ),
          naturalSize: 18,
        },
        values: { dps: 31.5, casts: 6 },
      },
      { id: "melee", label: "Melee", values: { dps: 20.07, casts: 52.3 } },
    ],
  },
};
