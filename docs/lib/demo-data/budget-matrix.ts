/**
 * The model behind the /docs/budget-matrix guide: a P&L row tree crossed with
 * a period column tree (Year → Quarter → Month), Plan / Actual / Forecast per
 * period, plus the monthly revenue distribution used by the companion chart.
 *
 * Everything is serializable - rows, columns and a `values[row][period][scn]`
 * lookup - so the same model can come straight out of an API.
 */
import type { ColumnDatum, MatrixPeriod, MatrixRow, MatrixValues } from "ibcs-react";

/** Row tree: a P&L with two collapsible groups (Revenue, Operating expenses). */
export const budgetRows: MatrixRow[] = [
  {
    id: "revenue",
    label: "Revenue",
    flow: "result",
    children: [
      { id: "software", label: "Software revenue", flow: "add" },
      { id: "support", label: "Support revenue", flow: "add" },
      { id: "consulting", label: "Consulting revenue", flow: "add" },
    ],
  },
  { id: "cogs", label: "Cost of sales", flow: "subtract", higherIsBetter: false },
  { id: "gross", label: "Gross profit", flow: "result" },
  {
    id: "opex",
    label: "Operating expenses",
    flow: "subtract",
    higherIsBetter: false,
    children: [
      { id: "rnd", label: "Research & development", flow: "subtract", higherIsBetter: false },
      { id: "sga", label: "Selling & admin", flow: "subtract", higherIsBetter: false },
    ],
  },
  { id: "ebit", label: "Operating income (EBIT)", flow: "result" },
  { id: "finance", label: "Other financial income, net", flow: "add" },
  { id: "ibt", label: "Income before tax", flow: "result" },
  { id: "tax", label: "Income tax", flow: "subtract", higherIsBetter: false },
  { id: "net", label: "Net income", flow: "result", doubleRule: true },
];

type Scn = "PL" | "AC" | "FC";
type Year = "2022" | "2023" | "2024";
type BaseRow = "software" | "support" | "consulting" | "cogs" | "rnd" | "sga" | "finance" | "tax";

/** Annual figures (mUSD) per base line, per year, per scenario. */
const BASE: Record<BaseRow, Record<Year, Record<Scn, number>>> = {
  software: {
    "2022": { PL: 467, AC: 453, FC: 455 },
    "2023": { PL: 543, AC: 565, FC: 560 },
    "2024": { PL: 620, AC: 598, FC: 610 },
  },
  support: {
    "2022": { PL: 99, AC: 87, FC: 90 },
    "2023": { PL: 132, AC: 121, FC: 125 },
    "2024": { PL: 140, AC: 128, FC: 131 },
  },
  consulting: {
    "2022": { PL: 145, AC: 121, FC: 124 },
    "2023": { PL: 231, AC: 209, FC: 213 },
    "2024": { PL: 205, AC: 218, FC: 213 },
  },
  cogs: {
    "2022": { PL: 282, AC: 231, FC: 240 },
    "2023": { PL: 199, AC: 222, FC: 215 },
    "2024": { PL: 230, AC: 244, FC: 240 },
  },
  rnd: {
    "2022": { PL: 79, AC: 78, FC: 80 },
    "2023": { PL: 91, AC: 104, FC: 100 },
    "2024": { PL: 110, AC: 118, FC: 124 },
  },
  sga: {
    "2022": { PL: 34, AC: 41, FC: 40 },
    "2023": { PL: 97, AC: 102, FC: 100 },
    "2024": { PL: 100, AC: 96, FC: 99 },
  },
  finance: {
    "2022": { PL: 8, AC: 12, FC: 10 },
    "2023": { PL: 6, AC: 3, FC: 4 },
    "2024": { PL: 5, AC: 6, FC: 4 },
  },
  tax: {
    "2022": { PL: 59, AC: 54, FC: 55 },
    "2023": { PL: 31, AC: 25, FC: 28 },
    "2024": { PL: 60, AC: 48, FC: 31 },
  },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Mild seasonality, sums to 1.0 (H2-weighted). */
const WEIGHTS = [0.07, 0.07, 0.09, 0.08, 0.08, 0.09, 0.08, 0.08, 0.09, 0.08, 0.09, 0.1];
const SCNS: Scn[] = ["PL", "AC", "FC"];
const YEARS: Year[] = ["2022", "2023", "2024"];
const BASE_ROWS = Object.keys(BASE) as BaseRow[];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Build the `values[rowId][periodId][scenario]` lookup. The derived result
 * lines (gross profit, EBIT, …) are computed from the base lines at every
 * granularity, so totals stay consistent when a column drills down. `Revenue`
 * and `Operating expenses` are deliberately NOT stored - they auto-aggregate
 * from their row children in the matrix's cell resolver.
 */
function buildValues(yearsWithMonths: string[]): MatrixValues {
  const v: MatrixValues = {};
  const set = (rid: string, pid: string, scn: Scn, val: number) => {
    v[rid] ??= {};
    v[rid][pid] ??= {};
    v[rid][pid][scn] = Math.round(val);
  };
  for (const year of YEARS) {
    const withMonths = yearsWithMonths.includes(year);
    for (const scn of SCNS) {
      const b = {} as Record<BaseRow, number>;
      for (const rid of BASE_ROWS) b[rid] = BASE[rid][year][scn];
      const rev = b.software + b.support + b.consulting;
      const gross = rev - b.cogs;
      const ebit = gross - (b.rnd + b.sga);
      const ibt = ebit + b.finance;
      const net = ibt - b.tax;
      const annual: Record<string, number> = { ...b, gross, ebit, ibt, net };
      for (const [rid, val] of Object.entries(annual)) set(rid, year, scn, val);
      if (!withMonths) continue;
      const qAcc: Record<string, number[]> = {};
      for (const [m, weight] of WEIGHTS.entries()) {
        const monthId = `${year}-${pad(m + 1)}`;
        const q = Math.floor(m / 3);
        for (const [rid, yearly] of Object.entries(annual)) {
          const val = yearly * weight;
          set(rid, monthId, scn, val);
          const acc = (qAcc[rid] ??= [0, 0, 0, 0]);
          acc[q] = (acc[q] ?? 0) + val;
        }
      }
      for (const [rid, acc] of Object.entries(qAcc)) {
        acc.forEach((sum, q) => set(rid, `${year}-Q${q + 1}`, scn, sum));
      }
    }
  }
  return v;
}

/** The four quarters of a year, each expanding into its three months. */
export const quartersOf = (year: string): MatrixPeriod[] =>
  [0, 1, 2, 3].map((q) => ({
    id: `${year}-Q${q + 1}`,
    label: `Q${q + 1}`,
    children: MONTHS.slice(q * 3, q * 3 + 3).map((label, mi) => ({
      id: `${year}-${pad(q * 3 + mi + 1)}`,
      label,
    })),
  }));

/** The 12 months of a year as leaf periods (no quarter grouping). */
export const monthsOf = (year: string): MatrixPeriod[] =>
  MONTHS.map((label, m) => ({ id: `${year}-${pad(m + 1)}`, label }));

export const budgetValues: MatrixValues = buildValues(["2023", "2024"]);

/** Three years; 2023 and 2024 drill into quarters and months. */
export const budgetColumns: MatrixPeriod[] = [
  { id: "2022", label: "2022" },
  { id: "2023", label: "2023", children: quartersOf("2023") },
  { id: "2024", label: "2024", children: quartersOf("2024") },
];

/** Historic years compare PL vs AC; the current year PL vs FC. */
export const budgetColumnsForecast: MatrixPeriod[] = [
  { id: "2022", label: "2022", scenarios: ["PL", "AC"] },
  { id: "2023", label: "2023", scenarios: ["PL", "AC"] },
  { id: "2024", label: "2024", scenarios: ["PL", "FC"] },
];

/** One year straight as four quarters. */
export const budgetColumnsQuarters: MatrixPeriod[] = [
  { id: "2024", label: "2024", children: quartersOf("2024") },
];

/** One year straight as 12 months - no year or quarter tier. */
export const budgetColumnsMonths: MatrixPeriod[] = monthsOf("2024");

/** Two years, each expanding directly into its 12 months. */
export const budgetColumnsYearMonths: MatrixPeriod[] = [
  { id: "2023", label: "2023", children: monthsOf("2023") },
  { id: "2024", label: "2024", children: monthsOf("2024") },
];

/** Plain figures, no compaction - the matrix prints full numbers. */
export const budgetFormat = { compact: false as const, decimals: 0 };

const revYear = (year: Year, scn: Scn) =>
  BASE.software[year][scn] + BASE.support[year][scn] + BASE.consulting[year][scn];

/**
 * Total revenue spread across 12 months: AC and PL from 2024, PY from the
 * 2023 actual, each split by the seasonal weights. One datum per month carries
 * all three scenarios, so the chart switches base by flipping `comparison`.
 */
export const monthlyRevenueDistribution: ColumnDatum[] = WEIGHTS.map((weight, m) => ({
  category: MONTHS[m] ?? "",
  AC: Math.round(revYear("2024", "AC") * weight),
  PL: Math.round(revYear("2024", "PL") * weight),
  PY: Math.round(revYear("2023", "AC") * weight),
}));
