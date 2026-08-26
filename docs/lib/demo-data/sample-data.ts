/**
 * Sample datasets for the docs demos — copied from the library's own demo data
 * (`src/demo/sampleData.ts`) so the docs app depends only on the published
 * package surface (`ibcs-react`).
 */
import type {
  StatementLine,
  ColumnDatum,
  TrendDatum,
  StructureDatum,
  DataTableColumn,
  DataTableRow,
} from "ibcs-react";

/**
 * P&L matching the reference income statement. Two groups are expandable:
 * Revenue (Product + Service) and Operating expenses (R&D, S&M, G&A,
 * Restructuring). Values are in currency units; the waterfall cumulative
 * is internally consistent with each result subtotal.
 */
export const sampleStatement: StatementLine[] = [
  {
    id: "revenue",
    label: "Revenue",
    flow: "add",
    emphasis: true,
    values: {},
    children: [
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
    ],
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
    id: "opex",
    label: "Operating expenses",
    flow: "subtract",
    higherIsBetter: false,
    defaultCollapsed: true,
    values: {},
    children: [
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
        id: "opex-restr",
        label: "Restructuring",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 0, PY: 306_000, PL: 0 },
      },
    ],
  },
  {
    id: "operating-income",
    label: "Operating income",
    flow: "result",
    values: { AC: 10_400_000, PY: 7_700_000, PL: 9_100_000 },
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
    values: { AC: 10_700_000, PY: 8_000_000, PL: 9_390_000 },
  },
  {
    id: "tax",
    label: "Provision for income taxes",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 1_800_000, PY: -111_000, PL: 1_900_000 },
  },
  {
    id: "net-income",
    label: "Net income",
    flow: "result",
    values: { AC: 8_900_000, PY: 8_100_000, PL: 7_490_000 },
  },
];

/**
 * The same P&L in the flat "build-up" layout of the IBCS reference:
 * detail lines first, then a `= subtotal` result, no nesting. Every result is
 * the exact running total of the steps above it, so the waterfall is consistent.
 * This is the shape that reproduces the reference screenshot 1:1.
 */
export const sampleStatementFlat: StatementLine[] = [
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
    id: "opex-restr",
    label: "Restructuring",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 0, PY: 306_000, PL: 0 },
  },
  {
    id: "operating-income",
    label: "Operating income",
    flow: "result",
    values: { AC: 10_400_000, PY: 7_694_000, PL: 9_100_000 },
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
    values: { AC: 10_701_000, PY: 7_970_000, PL: 9_390_000 },
  },
  {
    id: "tax",
    label: "Provision for income taxes",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 1_800_000, PY: -111_000, PL: 1_900_000 },
  },
  {
    id: "net-income",
    label: "Net income",
    flow: "result",
    values: { AC: 8_901_000, PY: 8_081_000, PL: 7_490_000 },
  },
];

/**
 * A loss-making year: heavy opex pushes operating income below zero, and the
 * running total stays negative through net income. Used to exercise the
 * negative-aware waterfall (steps run left, the total crosses the zero axis).
 * Every result equals the running total of the steps above it, and children
 * sum to their parent — so the waterfall is internally consistent.
 */
export const sampleLossStatement: StatementLine[] = [
  {
    id: "revenue",
    label: "Revenue",
    flow: "add",
    emphasis: true,
    values: {},
    children: [
      {
        id: "rev-product",
        label: "Product revenue",
        flow: "add",
        values: { AC: 5_000_000, PY: 5_400_000, PL: 5_200_000 },
      },
      {
        id: "rev-service",
        label: "Service and other revenue",
        flow: "add",
        values: { AC: 3_000_000, PY: 3_200_000, PL: 3_100_000 },
      },
    ],
  },
  {
    id: "cost-product",
    label: "Product cost",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 4_500_000, PY: 3_900_000, PL: 4_200_000 },
  },
  {
    id: "cost-service",
    label: "Service and other costs",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 3_200_000, PY: 2_800_000, PL: 3_000_000 },
  },
  {
    id: "gross-margin",
    label: "Gross margin",
    flow: "result",
    values: { AC: 300_000, PY: 1_900_000, PL: 1_100_000 },
  },
  {
    id: "opex",
    label: "Operating expenses",
    flow: "subtract",
    higherIsBetter: false,
    defaultCollapsed: true,
    values: {},
    children: [
      {
        id: "opex-rnd",
        label: "Research and development",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 2_000_000, PY: 1_800_000, PL: 1_900_000 },
      },
      {
        id: "opex-sm",
        label: "Sales and marketing",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 1_800_000, PY: 1_600_000, PL: 1_700_000 },
      },
      {
        id: "opex-ga",
        label: "General and administrative",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 600_000, PY: 600_000, PL: 600_000 },
      },
    ],
  },
  {
    id: "operating-income",
    label: "Operating income",
    flow: "result",
    values: { AC: -4_100_000, PY: -2_100_000, PL: -3_100_000 },
  },
  {
    id: "other-income",
    label: "Other income, net",
    flow: "add",
    values: { AC: 200_000, PY: 250_000, PL: 200_000 },
  },
  {
    id: "ibt",
    label: "Income before income taxes",
    flow: "result",
    values: { AC: -3_900_000, PY: -1_850_000, PL: -2_900_000 },
  },
  {
    id: "tax",
    label: "Income tax benefit",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: -500_000, PY: -400_000, PL: -600_000 },
  },
  {
    id: "net-income",
    label: "Net loss",
    flow: "result",
    values: { AC: -3_400_000, PY: -1_450_000, PL: -2_300_000 },
  },
];

/**
 * A large consolidation — 10 divisions × 24 accounts (~250 rows once expanded),
 * generated deterministically. Used to demo virtualization: render
 * `<StatementTable maxHeight={…} />` and only the rows in view are mounted.
 * Each division is an "add" group; the result is the exact running total.
 */
function buildConsolidation(): StatementLine[] {
  // Deliberately VARIED divisions so the consolidation tells a story: big
  // growers, flat units, and decliners (red) of different sizes — not ten
  // near-identical +6% rows. Each division's 24 accounts are distributed
  // deterministically to its AC target, with a per-account wobble so individual
  // accounts can buck the division's trend. (ac = 2025 actual, growth vs PY.)
  const profiles: Array<{ name: string; ac: number; growth: number }> = [
    { name: "North", ac: 8_900_000, growth: 0.14 },
    { name: "South", ac: 2_400_000, growth: -0.12 },
    { name: "East", ac: 6_200_000, growth: 0.06 },
    { name: "West", ac: 1_500_000, growth: 0.31 },
    { name: "Central", ac: 3_800_000, growth: 0.03 },
    { name: "Northeast", ac: 4_100_000, growth: -0.08 },
    { name: "Southwest", ac: 2_100_000, growth: 0.01 },
    { name: "Pacific", ac: 5_600_000, growth: 0.11 },
    { name: "Mountain", ac: 1_200_000, growth: -0.18 },
    { name: "Atlantic", ac: 2_900_000, growth: 0.2 },
  ];
  const out: StatementLine[] = [];
  let grandAC = 0;
  let grandPY = 0;
  profiles.forEach((p, di) => {
    const pyTarget = Math.round(p.ac / (1 + p.growth));
    // Deterministic per-account weights (sum normalised to the division total).
    const weights: number[] = [];
    let wSum = 0;
    for (let a = 0; a < 24; a++) {
      const w = 0.5 + ((di * 5 + a * 7) % 13) * 0.09;
      weights.push(w);
      wSum += w;
    }
    const children: StatementLine[] = [];
    let accAC = 0;
    let accPY = 0;
    for (const [a, weight] of weights.entries()) {
      let ac = Math.round((p.ac * weight) / wSum);
      // ±12% per-account wobble around the division's growth so some accounts
      // run counter to the trend (a green division still has a few red lines).
      const wobble = 1 + (((di + a) % 7) - 3) * 0.04;
      let py = Math.round((ac / (1 + p.growth)) * wobble);
      if (a === 23) {
        ac = p.ac - accAC;
        py = pyTarget - accPY;
      } // absorb rounding → exact totals
      accAC += ac;
      accPY += py;
      children.push({
        id: `d${di}-a${a}`,
        label: `${p.name} · account ${String(a + 1).padStart(2, "0")}`,
        flow: "add",
        values: { AC: ac, PY: py },
      });
    }
    grandAC += accAC;
    grandPY += accPY;
    out.push({
      id: `div-${di}`,
      label: `${p.name} division`,
      flow: "add",
      emphasis: true,
      values: {},
      children,
    });
  });
  out.push({
    id: "consolidated",
    label: "Consolidated revenue",
    flow: "result",
    values: { AC: grandAC, PY: grandPY },
  });
  return out;
}

/** ~250-row consolidation for the virtualization demo. */
export const sampleConsolidation: StatementLine[] = buildConsolidation();

/** Quarterly revenue for the column chart demo. */
export const sampleQuarterlyRevenue: ColumnDatum[] = [
  { category: "Q1", AC: 6_800_000, PY: 6_100_000, PL: 6_500_000 },
  { category: "Q2", AC: 7_300_000, PY: 6_400_000, PL: 7_000_000 },
  { category: "Q3", AC: 7_600_000, PY: 6_700_000, PL: 7_400_000 },
  { category: "Q4", AC: 8_400_000, PY: 6_400_000, PL: 7_600_000 },
];

/**
 * The same quarterly revenue as a statement model (for the budget-vs-actual
 * table): each quarter an "add" line carrying AC / PY / PL, then a full-year
 * result. AC, PY and PL each sum to the P&L revenue line (30.1M / 25.6M / 28.5M).
 */
export const sampleQuarterlyStatement: StatementLine[] = [
  { id: "q1", label: "Q1", flow: "add", values: { AC: 6_800_000, PY: 6_100_000, PL: 6_500_000 } },
  { id: "q2", label: "Q2", flow: "add", values: { AC: 7_300_000, PY: 6_400_000, PL: 7_000_000 } },
  { id: "q3", label: "Q3", flow: "add", values: { AC: 7_600_000, PY: 6_700_000, PL: 7_400_000 } },
  { id: "q4", label: "Q4", flow: "add", values: { AC: 8_400_000, PY: 6_400_000, PL: 7_600_000 } },
  {
    id: "fy",
    label: "Full year",
    flow: "result",
    values: { AC: 30_100_000, PY: 25_600_000, PL: 28_500_000 },
  },
];

/**
 * A 13-period revenue trend (the IBCS "13-period" view — thirteen four-week
 * retail periods spanning a 52-week year). P1–P9 are actual (AC); P10–P13 are
 * forecast (FC, drawn hatched where actuals run out). Previous year (PY) and
 * plan (PL) ride along as reference lines. All periods are of comparable
 * magnitude, so the trend reads cleanly on one value axis.
 */
export const sampleMonthlyTrend: TrendDatum[] = [
  { category: "P1", AC: 2_300_000, PY: 2_150_000, PL: 2_250_000 },
  { category: "P2", AC: 2_420_000, PY: 2_200_000, PL: 2_350_000 },
  { category: "P3", AC: 2_550_000, PY: 2_380_000, PL: 2_480_000 },
  { category: "P4", AC: 2_480_000, PY: 2_420_000, PL: 2_500_000 },
  { category: "P5", AC: 2_620_000, PY: 2_450_000, PL: 2_550_000 },
  { category: "P6", AC: 2_710_000, PY: 2_500_000, PL: 2_620_000 },
  { category: "P7", AC: 2_660_000, PY: 2_580_000, PL: 2_680_000 },
  { category: "P8", AC: 2_800_000, PY: 2_630_000, PL: 2_740_000 },
  { category: "P9", AC: 2_930_000, PY: 2_700_000, PL: 2_850_000 },
  { category: "P10", FC: 2_970_000, PY: 2_780_000, PL: 2_900_000 },
  { category: "P11", FC: 3_050_000, PY: 2_860_000, PL: 3_000_000 },
  { category: "P12", FC: 3_120_000, PY: 2_950_000, PL: 3_080_000 },
  { category: "P13", FC: 3_200_000, PY: 3_020_000, PL: 3_150_000 },
];

/**
 * A balance sheet — a STOCK statement (ending balances at a point in time, not
 * period movements). Rendered with `<StatementTable mode="stock" />`: each line
 * is an absolute level, not a waterfall step. Assets balance against
 * liabilities + equity (both total 37.0M AC / 34.0M PY). Liability lines carry
 * `higherIsBetter: false` so a rise in debt reads as unfavorable.
 */
export const sampleBalanceSheet: StatementLine[] = [
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
    defaultCollapsed: true,
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
    id: "current-liabilities",
    label: "Current liabilities",
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
    ],
  },
  {
    id: "noncurrent-liabilities",
    label: "Non-current liabilities",
    flow: "add",
    higherIsBetter: false,
    emphasis: true,
    values: {},
    children: [
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
    id: "total-liabilities",
    label: "Total liabilities",
    flow: "result",
    higherIsBetter: false,
    values: { AC: 17_000_000, PY: 17_300_000 },
  },
  {
    id: "equity",
    label: "Shareholders’ equity",
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

/**
 * Composition of revenue by region — the parts of the 30.1M total. AC vs PY
 * (last year), with each region's share of the whole. Ranked largest-first by
 * the structure chart. The components sum to the P&L revenue line.
 */
export const sampleRevenueStructure: StructureDatum[] = [
  { label: "North America", AC: 12_400_000, PY: 11_100_000, PL: 12_000_000 },
  { label: "Europe", AC: 8_900_000, PY: 8_000_000, PL: 8_600_000 },
  { label: "Asia Pacific", AC: 5_600_000, PY: 4_200_000, PL: 5_200_000 },
  { label: "Latin America", AC: 2_100_000, PY: 1_500_000, PL: 2_000_000 },
  { label: "Middle East & Africa", AC: 1_100_000, PY: 800_000, PL: 700_000 },
];

/* ============================================================================ *
 * IBCS TABLE TEMPLATES (T01 / T02 / T03) — data for the general DataTable.
 *
 * T01 + T02 share one hierarchical region/country dataset with two measures:
 *   `sales` (the current month) and `ytd` (year to date), each scenario-keyed
 *   (AC / PY / PL). Countries nest under Europe / Americas / Rest of world
 *   subtotals; a "World" totals row sums the regions (via `showTotals`).
 * T03 is a multi-year profit-and-loss STATEMENT (flow markers + year columns).
 * ============================================================================ */

/**
 * Hierarchical region → country rows for the IBCS T01/T02 templates, with the
 * exact figures of the ibcs.com reference ("Electronic Inc. — Profit after tax
 * in kEUR"). Each country carries two scenario-keyed measures: `m` (the current
 * month, November) and `y` (year to date, January–November). Region rows are
 * bold subtotals that auto-sum their children; the "World" grand total is added
 * by `showTotals`. Shared by {@link sampleTableT01} and {@link sampleTableT02}.
 *
 * Values are in kEUR (so render with `format={{ compact:false }}`). The printed
 * variances are computed (AC−PY etc.), so they stay internally consistent.
 */
export const sampleTableRegions: DataTableRow[] = [
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
        id: "be",
        label: "Belgium",
        values: { m: { PY: 56, PL: 72, AC: 58 }, y: { PY: 531, PL: 529, AC: 484 } },
      },
      {
        id: "fr",
        label: "France",
        values: { m: { PY: 140, PL: 149, AC: 134 }, y: { PY: 1_290, PL: 1_488, AC: 1_354 } },
      },
      {
        id: "de",
        label: "Germany",
        values: { m: { PY: 345, PL: 279, AC: 260 }, y: { PY: 3_124, PL: 2_815, AC: 2_850 } },
      },
      {
        id: "pl",
        label: "Poland",
        values: { m: { PY: 78, PL: 91, AC: 86 }, y: { PY: 816, PL: 818, AC: 854 } },
      },
      {
        id: "se",
        label: "Sweden",
        values: { m: { PY: 77, PL: 81, AC: 86 }, y: { PY: 809, PL: 722, AC: 764 } },
      },
      {
        id: "ch",
        label: "Switzerland",
        values: { m: { PY: 61, PL: 70, AC: 66 }, y: { PY: 604, PL: 582, AC: 678 } },
      },
      {
        id: "eu-other",
        label: "Other",
        values: { m: { PY: 502, PL: 498, AC: 545 }, y: { PY: 5_602, PL: 6_022, AC: 5_441 } },
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
        id: "br",
        label: "Brazil",
        values: { m: { PY: 119, PL: 109, AC: 121 }, y: { PY: 1_205, PL: 1_254, AC: 1_314 } },
      },
      {
        id: "ca",
        label: "Canada",
        values: { m: { PY: 65, PL: 71, AC: 59 }, y: { PY: 629, PL: 656, AC: 718 } },
      },
      {
        id: "us",
        label: "USA",
        values: { m: { PY: 346, PL: 326, AC: 311 }, y: { PY: 3_406, PL: 3_124, AC: 3_239 } },
      },
      {
        id: "am-other",
        label: "Other",
        values: { m: { PY: 438, PL: 401, AC: 399 }, y: { PY: 4_166, PL: 4_219, AC: 4_008 } },
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
        id: "au",
        label: "Australia",
        values: { m: { PY: 54, PL: 66, AC: 62 }, y: { PY: 517, PL: 609, AC: 588 } },
      },
      {
        id: "cn",
        label: "China",
        values: { m: { PY: 266, PL: 204, AC: 231 }, y: { PY: 2_107, PL: 1_925, AC: 2_399 } },
      },
      {
        id: "jp",
        label: "Japan",
        values: { m: { PY: 9, PL: 12, AC: 11 }, y: { PY: 67, PL: 87, AC: 144 } },
      },
      {
        id: "row-other",
        label: "Other",
        values: { m: { PY: 234, PL: 311, AC: 255 }, y: { PY: 2_351, PL: 2_099, AC: 2_145 } },
      },
    ],
  },
];

/** T01 rows — the hierarchical region table (numeric variance columns). */
export const sampleTableT01: DataTableRow[] = sampleTableRegions;

/** T02 rows — the same hierarchy, rendered with embedded bars + pins. */
export const sampleTableT02: DataTableRow[] = sampleTableRegions;

/**
 * T01 — the LEFT (current month, "November") column group for the flanking
 * {@link ComparisonTable}: PY · PL · AC value columns, then NUMERIC AC-PY and
 * AC-PL variances (each an absolute + a % column, `mark:"none"`, impact
 * coloured). `subgroup` centres the "AC-PY" / "AC-PL" header over its pair;
 * `gapBefore` opens the IBCS group gaps. The RIGHT group repeats the same shape
 * on the `y` measure.
 */
export const tableT01Left: DataTableColumn[] = [
  { key: "m_py", label: "PY", kind: "value", measure: "m", scenario: "PY" },
  { key: "m_pl", label: "PL", kind: "value", measure: "m", scenario: "PL" },
  { key: "m_ac", label: "AC", kind: "value", measure: "m", scenario: "AC" },
  {
    key: "m_dpy",
    label: "ΔPY",
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
  {
    key: "m_dpl",
    label: "ΔPL",
    kind: "variance",
    measure: "m",
    base: "PL",
    mode: "abs",
    mark: "none",
    subgroup: "AC-PL",
    gapBefore: true,
  },
  {
    key: "m_dpl_pct",
    label: "%",
    kind: "variance",
    measure: "m",
    base: "PL",
    mode: "pct",
    mark: "none",
    subgroup: "AC-PL",
  },
];

export const tableT01Right: DataTableColumn[] = [
  { key: "y_py", label: "PY", kind: "value", measure: "y", scenario: "PY" },
  { key: "y_pl", label: "PL", kind: "value", measure: "y", scenario: "PL" },
  { key: "y_ac", label: "AC", kind: "value", measure: "y", scenario: "AC" },
  {
    key: "y_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "y",
    base: "PY",
    mode: "abs",
    mark: "none",
    subgroup: "AC-PY",
    gapBefore: true,
  },
  {
    key: "y_dpy_pct",
    label: "%",
    kind: "variance",
    measure: "y",
    base: "PY",
    mode: "pct",
    mark: "none",
    subgroup: "AC-PY",
  },
  {
    key: "y_dpl",
    label: "ΔPL",
    kind: "variance",
    measure: "y",
    base: "PL",
    mode: "abs",
    mark: "none",
    subgroup: "AC-PL",
    gapBefore: true,
  },
  {
    key: "y_dpl_pct",
    label: "%",
    kind: "variance",
    measure: "y",
    base: "PL",
    mode: "pct",
    mark: "none",
    subgroup: "AC-PL",
  },
];

/**
 * T02 — the same flanking layout, but the variance is EMBEDDED: PY + AC figures,
 * then ΔPY as a signed magnitude bar and ΔPY% as a pin (with off-scale arrows).
 */
export const tableT02Left: DataTableColumn[] = [
  { key: "m_py", label: "PY", kind: "value", measure: "m", scenario: "PY" },
  { key: "m_ac", label: "AC", kind: "value", measure: "m", scenario: "AC" },
  {
    key: "m_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "m",
    base: "PY",
    mode: "abs",
    mark: "bar",
    gapBefore: true,
  },
  {
    key: "m_dpy_pct",
    label: "ΔPY%",
    kind: "variance",
    measure: "m",
    base: "PY",
    mode: "pct",
    mark: "pin",
    gapBefore: true,
  },
];

export const tableT02Right: DataTableColumn[] = [
  { key: "y_py", label: "PY", kind: "value", measure: "y", scenario: "PY" },
  { key: "y_ac", label: "AC", kind: "value", measure: "y", scenario: "AC" },
  {
    key: "y_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "y",
    base: "PY",
    mode: "abs",
    mark: "bar",
    gapBefore: true,
  },
  {
    key: "y_dpy_pct",
    label: "ΔPY%",
    kind: "variance",
    measure: "y",
    base: "PY",
    mode: "pct",
    mark: "pin",
    gapBefore: true,
  },
];

/**
 * T03 rows — a multi-year P&L statement. Each line carries a `flow` marker
 * (+ / − / =) and a measure per year (`y2012` … `y2015`), each scenario-keyed.
 * Result lines are bold with a top rule; the final "Net income" gets a double
 * rule. Every result equals the running total of the steps above it, per year
 * and scenario (e.g. 2014 AC: 17.2 + 12.9 = 30.1M revenue).
 */
export const sampleTableT03: DataTableRow[] = [
  {
    id: "sw",
    label: "Software revenue",
    flow: "add",
    values: {
      y2012: { PL: 467, AC: 453 },
      y2013: { PL: 543, AC: 520 },
      y2014: { PL: 620, AC: 640 },
      y2015: { PL: 700, FC: 710 },
    },
  },
  {
    id: "sup",
    label: "Support revenue",
    flow: "add",
    values: {
      y2012: { PL: 99, AC: 87 },
      y2013: { PL: 132, AC: 120 },
      y2014: { PL: 150, AC: 158 },
      y2015: { PL: 170, FC: 175 },
    },
  },
  {
    id: "con",
    label: "Consulting revenue",
    flow: "add",
    values: {
      y2012: { PL: 145, AC: 121 },
      y2013: { PL: 231, AC: 150 },
      y2014: { PL: 240, AC: 252 },
      y2015: { PL: 260, FC: 265 },
    },
  },
  {
    id: "rev",
    label: "Revenue",
    flow: "result",
    values: {
      y2012: { PL: 711, AC: 661 },
      y2013: { PL: 906, AC: 790 },
      y2014: { PL: 1_010, AC: 1_050 },
      y2015: { PL: 1_130, FC: 1_150 },
    },
  },
  {
    id: "cos",
    label: "Cost of sales",
    flow: "subtract",
    values: {
      y2012: { PL: 282, AC: 231 },
      y2013: { PL: 340, AC: 300 },
      y2014: { PL: 360, AC: 372 },
      y2015: { PL: 400, FC: 405 },
    },
  },
  {
    id: "gp",
    label: "Gross profit",
    flow: "result",
    values: {
      y2012: { PL: 429, AC: 430 },
      y2013: { PL: 566, AC: 490 },
      y2014: { PL: 650, AC: 678 },
      y2015: { PL: 730, FC: 745 },
    },
  },
  {
    id: "rnd",
    label: "Research and development expenses",
    flow: "subtract",
    values: {
      y2012: { PL: 79, AC: 78 },
      y2013: { PL: 91, AC: 88 },
      y2014: { PL: 98, AC: 104 },
      y2015: { PL: 110, FC: 112 },
    },
  },
  {
    id: "sga",
    label: "Selling and general administrative expenses",
    flow: "subtract",
    values: {
      y2012: { PL: 34, AC: 45 },
      y2013: { PL: 41, AC: 44 },
      y2014: { PL: 48, AC: 52 },
      y2015: { PL: 55, FC: 56 },
    },
  },
  {
    id: "ooi",
    label: "Other operating income",
    flow: "add",
    values: {
      y2012: { PL: 44, AC: 22 },
      y2013: { PL: 45, AC: 30 },
      y2014: { PL: 40, AC: 38 },
      y2015: { PL: 42, FC: 44 },
    },
  },
  {
    id: "ooe",
    label: "Other operating expenses",
    flow: "subtract",
    values: {
      y2012: { PL: 18, AC: 16 },
      y2013: { PL: 13, AC: 11 },
      y2014: { PL: 14, AC: 15 },
      y2015: { PL: 16, FC: 17 },
    },
  },
  {
    id: "ofi",
    label: "Other financial income, net",
    flow: "add",
    values: {
      y2012: { PL: 10, AC: 12 },
      y2013: { PL: 6, AC: 8 },
      y2014: { PL: 5, AC: 6 },
      y2015: { PL: 7, FC: 8 },
    },
  },
  {
    id: "ebt",
    label: "Income from continuing operations before tax",
    flow: "result",
    values: {
      y2012: { PL: 352, AC: 325 },
      y2013: { PL: 472, AC: 385 },
      y2014: { PL: 535, AC: 551 },
      y2015: { PL: 598, FC: 612 },
    },
  },
  {
    id: "tax",
    label: "Income tax expenses",
    flow: "subtract",
    values: {
      y2012: { PL: 59, AC: 54 },
      y2013: { PL: 88, AC: 92 },
      y2014: { PL: 110, AC: 120 },
      y2015: { PL: 130, FC: 135 },
    },
  },
  {
    id: "ico",
    label: "Income from continuing operations",
    flow: "result",
    values: {
      y2012: { PL: 293, AC: 271 },
      y2013: { PL: 384, AC: 293 },
      y2014: { PL: 425, AC: 431 },
      y2015: { PL: 468, FC: 477 },
    },
  },
  {
    id: "ido",
    label: "Income from discontinued operations",
    flow: "add",
    values: {
      y2012: { PL: 16, AC: 6 },
      y2013: { PL: 1, AC: 4 },
      y2014: { PL: 6, AC: 8 },
      y2015: { PL: 8, FC: 10 },
    },
  },
  {
    id: "ni",
    label: "Net income",
    flow: "result",
    doubleRule: true,
    values: {
      y2012: { PL: 309, AC: 277 },
      y2013: { PL: 385, AC: 297 },
      y2014: { PL: 431, AC: 439 },
      y2015: { PL: 476, FC: 487 },
    },
  },
];

/**
 * T03 columns — one group per year (2012 … 2015). 2012-2014 show PL and AC; the
 * current year 2015 shows PL and FC (forecast). Plain numeric value columns.
 */
export const tableT03Columns: DataTableColumn[] = [
  { key: "y2012_pl", label: "PL", kind: "value", measure: "y2012", scenario: "PL", group: "2012" },
  { key: "y2012_ac", label: "AC", kind: "value", measure: "y2012", scenario: "AC", group: "2012" },
  { key: "y2013_pl", label: "PL", kind: "value", measure: "y2013", scenario: "PL", group: "2013" },
  { key: "y2013_ac", label: "AC", kind: "value", measure: "y2013", scenario: "AC", group: "2013" },
  { key: "y2014_pl", label: "PL", kind: "value", measure: "y2014", scenario: "PL", group: "2014" },
  { key: "y2014_ac", label: "AC", kind: "value", measure: "y2014", scenario: "AC", group: "2014" },
  { key: "y2015_pl", label: "PL", kind: "value", measure: "y2015", scenario: "PL", group: "2015" },
  { key: "y2015_fc", label: "FC", kind: "value", measure: "y2015", scenario: "FC", group: "2015" },
];
