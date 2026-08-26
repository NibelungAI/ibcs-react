"use client";

/**
 * Report cookbook — Finance & accounting. One component per recipe; each renders the
 * exact snippet printed next to it in `content/docs/cookbook.mdx`.
 */
import {
  StatementTable,
  DataTable,
  VarianceColumnChart,
  TrendChart,
  StructureChart,
  WaterfallChart,
  StackedChart,
  LineChart,
  AreaChart,
  ComboChart,
  TreeChart,
} from "ibcs-react";
import {
  sampleStatementFlat,
  sampleBalanceSheet,
  sampleMonthlyTrend,
  sampleRevenueStructure,
  sampleTableT03,
  tableT03Columns,
} from "@/lib/demo-data/sample-data";
import { CARD_W, fM, fK, fN, fN1, fPct1, C, L, S, W, varCols } from "@/lib/demo-data/cookbook";
import { KpiStrip } from "./shared";

/** Income statement (waterfall) — Northwind Materials · € m · FY26 vs PY/PL */
export function IncomeStatementWaterfall() {
  return (
    <StatementTable lines={sampleStatementFlat.slice(0, 11)} waterfallWidth={150} format={fM} />
  );
}

/** Balance sheet — Northwind Materials · € m · point-in-time */
export function BalanceSheet() {
  return (
    <StatementTable lines={sampleBalanceSheet} mode="stock" waterfallWidth={140} format={fM} />
  );
}

/** Cash flow bridge — Helios Foods · € m · opening → closing cash */
export function CashFlowBridge() {
  return (
    <WaterfallChart
      data={[
        W("Opening cash", 4.2, "result"),
        W("Operating", 8.6, "add"),
        W("Investing", 5.1, "subtract", false),
        W("Financing", 2.3, "subtract", false),
        W("FX effect", 0.2, "subtract", false),
        W("Closing cash", 5.2, "result"),
      ]}
      scenario="AC"
      width={CARD_W}
      height={220}
      format={fM}
    />
  );
}

/** P&L bridge — PY → AC operating income — Helios Foods · € m · effect decomposition */
export function PAndLBridgePYACOperatingIncome() {
  return (
    <WaterfallChart
      data={[
        W("PY op. income", 7.7, "result"),
        W("Volume", 1.9, "add"),
        W("Price", 1.4, "add"),
        W("Mix", 0.4, "subtract", false),
        W("Input cost", 0.9, "subtract", false),
        W("Opex", 0.1, "subtract", false),
        W("AC op. income", 10.4, "result"),
      ]}
      scenario="AC"
      width={CARD_W}
      height={220}
      format={fM}
    />
  );
}

/** Budget vs actual — quarterly revenue — Aurora Retail · € m · AC vs PL */
export function BudgetVsActualQuarterlyRevenue() {
  return (
    <VarianceColumnChart
      data={[
        C("Q1", 6.8, undefined, 6.5),
        C("Q2", 7.3, undefined, 7.0),
        C("Q3", 7.6, undefined, 7.4),
        C("Q4", 8.4, undefined, 7.6),
      ]}
      comparison="PL"
      width={CARD_W}
      height={210}
      format={fM}
    />
  );
}

/** Revenue variance analysis — Aurora Retail · € m · 13 periods, AC vs PY */
export function RevenueVarianceAnalysis() {
  return (
    <TrendChart data={sampleMonthlyTrend} comparison="PY" width={CARD_W} height={236} format={fK} />
  );
}

/** Gross-margin walk — Cobalt Devices · € m · PY → AC */
export function GrossMarginWalk() {
  return (
    <WaterfallChart
      data={[
        W("PY gross margin", 17.2, "result"),
        W("Volume", 2.1, "add"),
        W("Price/mix", 1.7, "add"),
        W("Material cost", 0.4, "subtract", false),
        W("Labour", 0.2, "subtract", false),
        W("AC gross margin", 20.4, "result"),
      ]}
      scenario="AC"
      width={CARD_W}
      height={220}
      format={fM}
    />
  );
}

/** Operating-expense breakdown — Cobalt Devices · € m · AC vs PY share */
export function OperatingExpenseBreakdown() {
  return (
    <StructureChart
      data={[
        S("Sales & marketing", 4.8, 4.3, undefined, false),
        S("Research & development", 3.9, 3.5, undefined, false),
        S("General & admin", 1.3, 1.4, undefined, false),
        S("Customer support", 0.9, 0.8, undefined, false),
        S("Facilities", 0.6, 0.7, undefined, false),
      ]}
      comparison="PY"
      higherIsBetter={false}
      width={CARD_W}
      height={220}
      labelWidth={120}
      format={fM}
    />
  );
}

/** Working-capital metrics — Northwind Materials · days · AC vs PY */
export function WorkingCapitalMetrics() {
  return (
    <KpiStrip
      items={[
        {
          label: "DSO",
          values: { AC: 47, PY: 52 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: fN,
        },
        {
          label: "DIO",
          values: { AC: 61, PY: 58 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: fN,
        },
        {
          label: "DPO",
          values: { AC: 39, PY: 35 },
          comparisons: ["PY"],
          format: fN,
        },
        {
          label: "Cash cycle",
          values: { AC: 69, PY: 75 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: fN,
        },
      ]}
    />
  );
}

/** AR aging by segment — Aurora Retail · € k · open receivables */
export function ARAgingBySegment() {
  return (
    <StackedChart
      data={[
        {
          category: "Enterprise",
          values: { cur: 820, d30: 210, d60: 90, d90: 140 },
        },
        {
          category: "Mid-market",
          values: { cur: 540, d30: 160, d60: 70, d90: 40 },
        },
        { category: "SMB", values: { cur: 310, d30: 120, d60: 55, d90: 95 } },
      ]}
      series={[
        { key: "cur", label: "Current" },
        { key: "d30", label: "1–30" },
        { key: "d60", label: "31–60" },
        { key: "d90", label: "61+" },
      ]}
      orientation="bar"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Revenue by region — Northwind Materials · € m · AC vs PY */
export function RevenueByRegion() {
  return (
    <StructureChart
      data={sampleRevenueStructure}
      comparison="PY"
      width={CARD_W}
      height={230}
      labelWidth={130}
      format={fM}
    />
  );
}

/** EBITDA trend — Helios Foods · € m · monthly, AC vs PL line */
export function EBITDATrend() {
  return (
    <LineChart
      data={[
        L("Jan", { AC: 2.1, PL: 2.0 }),
        L("Feb", { AC: 2.3, PL: 2.1 }),
        L("Mar", { AC: 2.2, PL: 2.2 }),
        L("Apr", { AC: 2.6, PL: 2.4 }),
        L("May", { AC: 2.5, PL: 2.5 }),
        L("Jun", { AC: 2.9, PL: 2.6 }),
        L("Jul", { AC: 3.1, PL: 2.8 }),
        L("Aug", { AC: 3.0, PL: 2.9 }),
      ]}
      comparison="PL"
      variance="abs"
      width={CARD_W}
      height={236}
      format={fK}
    />
  );
}

/** Multi-year P&L statement — Vector Software · € m · 2012–2015 (wide → scroll) */
export function MultiYearPAndLStatement() {
  return (
    <div style={{ minWidth: 560 }}>
      <DataTable columns={tableT03Columns} rows={sampleTableT03.slice(0, 8)} format={fN} />
    </div>
  );
}

/** Cost-centre variance — Cobalt Devices · € k · AC vs PY */
export function CostCentreVariance() {
  return (
    <DataTable
      columns={varCols("spend", "Spend", false)}
      rows={[
        {
          id: "eng",
          label: "Engineering",
          values: { spend: { AC: 1840, PY: 1620 } },
        },
        {
          id: "ops",
          label: "Operations",
          values: { spend: { AC: 960, PY: 1010 } },
        },
        {
          id: "sales",
          label: "Sales",
          values: { spend: { AC: 1370, PY: 1180 } },
        },
        { id: "ga", label: "G&A", values: { spend: { AC: 540, PY: 560 } } },
        {
          id: "it",
          label: "IT & security",
          values: { spend: { AC: 430, PY: 300 } },
        },
      ]}
      format={fN}
      showTotals
      defaultSort={{ key: "spend", dir: "desc" }}
    />
  );
}

/** Capex vs depreciation — Northwind Materials · € m · invest vs D&A % */
export function CapexVsDepreciation() {
  return (
    <ComboChart
      data={[C("FY22", 4.1), C("FY23", 5.3), C("FY24", 4.8), C("FY25", 6.2), C("FY26", 5.5)]}
      secondary={[
        { category: "FY22", value: 71 },
        { category: "FY23", value: 64 },
        { category: "FY24", value: 78 },
        { category: "FY25", value: 59 },
        { category: "FY26", value: 73 },
      ]}
      primaryLabel="Capex (€ m)"
      secondaryLabel="D&A cover %"
      secondaryFormat={fPct1}
      width={CARD_W}
      height={220}
      format={fK}
    />
  );
}

/** Free cash flow — Helios Foods · € m · monthly with PY baseline */
export function FreeCashFlow() {
  return (
    <AreaChart
      data={[
        L("Jan", { AC: 0.8, PY: 0.6 }),
        L("Feb", { AC: 1.1, PY: 0.9 }),
        L("Mar", { AC: -0.4, PY: 0.2 }),
        L("Apr", { AC: 0.9, PY: 0.7 }),
        L("May", { AC: 1.4, PY: 1.0 }),
        L("Jun", { AC: 1.7, PY: 1.3 }),
      ]}
      scenario="AC"
      baseline="PY"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Return-on-assets driver tree — Northwind Materials · ratio decomposition */
export function ReturnOnAssetsDriverTree() {
  return (
    <TreeChart
      root={{
        id: "roa",
        label: "Return on assets",
        value: 0.124,
        py: 0.118,
        op: "/",
        format: { decimals: 3 },
        children: [
          { id: "ni", label: "Net income", value: 31e6, py: 28.4e6 },
          { id: "ta", label: "Total assets", value: 250e6, py: 240.7e6 },
        ],
      }}
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Interest-coverage & leverage — Northwind Materials · ratios · AC vs PY */
export function InterestCoverageAndLeverage() {
  return (
    <KpiStrip
      items={[
        {
          label: "Interest cover",
          values: { AC: 6.4, PY: 5.1 },
          comparisons: ["PY"],
          format: { ...fN1, currency: "×" },
        },
        {
          label: "Net debt / EBITDA",
          values: { AC: 1.8, PY: 2.3 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: { ...fN1, currency: "×" },
        },
        {
          label: "Current ratio",
          values: { AC: 1.9, PY: 1.6 },
          comparisons: ["PY"],
          format: { ...fN1, currency: "×" },
        },
      ]}
    />
  );
}
