"use client";

/**
 * Report cookbook — Executive & KPI scorecards. One component per recipe; each renders the
 * exact snippet printed next to it in `content/docs/cookbook.mdx`.
 */
import {
  DataTable,
  ComparisonTable,
  MatrixTable,
  TrendChart,
  StructureChart,
  WaterfallChart,
  AreaChart,
  MiniVarianceMultiples,
} from "ibcs-react";
import {
  sampleMonthlyTrend,
  sampleTableRegions,
  tableT02Left,
  tableT02Right,
} from "@/lib/demo-data/sample-data";
import { CARD_W, fM, fK, fN, fN1, C, L, S, W, varCols } from "@/lib/demo-data/cookbook";
import { KpiStrip, SparkTile } from "./shared";

/** Company scorecard — Northwind Materials · group KPIs · AC vs PY */
export function CompanyScorecard() {
  return (
    <KpiStrip
      items={[
        {
          label: "Revenue",
          values: { AC: 30.1e6, PY: 25.6e6 },
          comparisons: ["PY"],
          format: fM,
        },
        {
          label: "Op. margin",
          values: { AC: 34.6, PY: 30.1 },
          comparisons: ["PY"],
          format: { ...fN1, suffix: "%" },
        },
        {
          label: "Net income",
          values: { AC: 8.9e6, PY: 8.1e6 },
          comparisons: ["PY"],
          format: fM,
        },
        {
          label: "FCF",
          values: { AC: 6.2e6, PY: 4.8e6 },
          comparisons: ["PY"],
          format: fM,
        },
      ]}
    />
  );
}

/** Revenue vs plan — Group · € m · 13 periods, AC + FC vs PL */
export function RevenueVsPlan() {
  return (
    <TrendChart
      data={sampleMonthlyTrend}
      comparison="PL"
      variance="pct"
      width={CARD_W}
      height={236}
      format={fK}
    />
  );
}

/** Profit waterfall — Group · € m · revenue → net income */
export function ProfitWaterfall() {
  return (
    <WaterfallChart
      data={[
        W("Revenue", 30.1, "add"),
        W("COGS", 9.7, "subtract", false),
        W("Opex", 10.0, "subtract", false),
        W("Tax", 1.8, "subtract", false),
        W("Net income", 8.6, "result"),
      ]}
      scenario="AC"
      width={CARD_W}
      height={220}
      format={fM}
    />
  );
}

/** Regional performance — Group · € m · AC vs PY (small multiples) */
export function RegionalPerformance() {
  return (
    <div style={{ width: CARD_W }}>
      <MiniVarianceMultiples
        groups={[
          {
            label: "Americas",
            data: [C("Q1", 8.4, 7.9), C("Q2", 8.8, 8.1), C("Q3", 9.1, 8.6), C("Q4", 9.9, 9.0)],
          },
          {
            label: "EMEA",
            data: [C("Q1", 6.2, 5.8), C("Q2", 6.5, 6.0), C("Q3", 6.8, 6.4), C("Q4", 7.4, 6.9)],
          },
          {
            label: "APAC",
            data: [C("Q1", 3.1, 2.4), C("Q2", 3.4, 2.7), C("Q3", 3.7, 3.0), C("Q4", 4.2, 3.3)],
          },
          {
            label: "Other",
            data: [C("Q1", 1.1, 1.3), C("Q2", 1.0, 1.2), C("Q3", 1.2, 1.1), C("Q4", 0.9, 1.0)],
          },
        ]}
        comparison="PY"
        columns={2}
        format={fK}
      />
    </div>
  );
}

/** Strategic initiatives — Group · status & impact · current quarter */
export function StrategicInitiatives() {
  return (
    <DataTable
      columns={[
        { key: "prog", label: "Progress%", kind: "value", scenario: "AC" },
        {
          key: "impact",
          label: "€ m impact",
          kind: "value",
          scenario: "AC",
          format: fN1,
        },
        { key: "spk", label: "Trend", kind: "sparkline", measure: "spk" },
      ]}
      rows={[
        {
          id: "i1",
          label: "Margin recovery programme",
          values: { prog: { AC: 72 }, impact: { AC: 4.2 } },
          spark: { spk: [10, 20, 35, 50, 62, 72] },
        },
        {
          id: "i2",
          label: "ERP consolidation",
          values: { prog: { AC: 41 }, impact: { AC: 1.8 } },
          spark: { spk: [5, 12, 20, 28, 35, 41] },
        },
        {
          id: "i3",
          label: "DTC channel launch",
          values: { prog: { AC: 88 }, impact: { AC: 6.1 } },
          spark: { spk: [30, 48, 60, 71, 80, 88] },
        },
      ]}
      format={fN}
    />
  );
}

/** Market share — Group · % · AC vs PY by category */
export function MarketShare() {
  return (
    <StructureChart
      data={[
        S("Core materials", 24, 22),
        S("Specialty", 18, 14),
        S("Recycled", 11, 7),
        S("Coatings", 9, 10),
      ]}
      comparison="PY"
      width={CARD_W}
      height={210}
      labelWidth={120}
      format={fN}
    />
  );
}

/** Customer satisfaction — Group · CSAT · sparkline tiles */
export function CustomerSatisfaction() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <SparkTile label="CSAT" value="92%" data={[88, 89, 87, 90, 91, 92]} color="#3b6e8f" />
      <SparkTile label="NPS" value="51" data={[38, 42, 45, 44, 48, 51]} color="#5e8c22" />
      <SparkTile
        label="Complaints"
        value="1.2k"
        data={[1.8, 1.7, 1.6, 1.5, 1.3, 1.2]}
        color="#c0392b"
      />
    </div>
  );
}

/** Cash position — Group · € m · 12-month area, AC vs PY */
export function CashPosition() {
  return (
    <AreaChart
      data={[
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ].map((m, i) =>
        L(m, {
          AC: 4 + Math.round(Math.sin(i / 2) * 2) + i * 0.3,
          PY: 3.5 + i * 0.2,
        }),
      )}
      scenario="AC"
      baseline="PY"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Top & bottom movers — Group · € k · biggest ΔPY swings */
export function TopAndBottomMovers() {
  return (
    <DataTable
      columns={varCols("delta", "Revenue")}
      rows={[
        {
          id: "m1",
          label: "Recycled line",
          values: { delta: { AC: 4100, PY: 2600 } },
        },
        {
          id: "m2",
          label: "Specialty coatings",
          values: { delta: { AC: 3200, PY: 2400 } },
        },
        {
          id: "m3",
          label: "Legacy adhesives",
          values: { delta: { AC: 1800, PY: 2900 } },
        },
        {
          id: "m4",
          label: "Bulk resin",
          values: { delta: { AC: 5600, PY: 6100 } },
        },
      ]}
      format={fN}
      defaultSort={{ key: "delta_d", dir: "desc" }}
    />
  );
}

/** Balanced scorecard — Group · perspectives × quarters (AC vs PL) */
export function BalancedScorecard() {
  return (
    <MatrixTable
      rows={[
        {
          id: "fin",
          label: "Financial",
          emphasis: true,
          children: [
            { id: "rev", label: "Revenue" },
            { id: "mgn", label: "Margin %", higherIsBetter: true },
          ],
        },
        {
          id: "cust",
          label: "Customer",
          emphasis: true,
          children: [
            { id: "nps", label: "NPS" },
            { id: "ret", label: "Retention %" },
          ],
        },
        {
          id: "proc",
          label: "Process",
          emphasis: true,
          children: [{ id: "otif", label: "OTIF %" }],
        },
      ]}
      columns={[
        { id: "q3", label: "Q3" },
        { id: "q4", label: "Q4" },
      ]}
      values={{
        rev: { q3: { PL: 7.4, AC: 7.6 }, q4: { PL: 7.6, AC: 8.4 } },
        mgn: { q3: { PL: 33, AC: 34 }, q4: { PL: 34, AC: 36 } },
        nps: { q3: { PL: 44, AC: 45 }, q4: { PL: 46, AC: 51 } },
        ret: { q3: { PL: 90, AC: 92 }, q4: { PL: 91, AC: 92 } },
        otif: { q3: { PL: 95, AC: 91 }, q4: { PL: 95, AC: 96 } },
      }}
      scenarios={["PL", "AC"]}
      showVariance
      varianceScenarios={{ actual: "AC", base: "PL" }}
      labelWidth={120}
      format={fN}
    />
  );
}

/** ESG metrics — Group · sustainability KPIs · AC vs PY */
export function ESGMetrics() {
  return (
    <KpiStrip
      items={[
        {
          label: "CO₂ (kt)",
          values: { AC: 142, PY: 168 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: fN,
        },
        {
          label: "Renewable %",
          values: { AC: 61, PY: 48 },
          comparisons: ["PY"],
          format: { ...fN, suffix: "%" },
        },
        {
          label: "Recordables",
          values: { AC: 7, PY: 12 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: fN,
        },
      ]}
    />
  );
}

/** Flanking comparison table — Electronic Inc. · kEUR · month vs YTD */
export function FlankingComparisonTable() {
  return (
    <div style={{ minWidth: 560 }}>
      <ComparisonTable
        rows={sampleTableRegions}
        leftColumns={tableT02Left}
        rightColumns={tableT02Right}
        leftGroupLabel="Current month"
        rightGroupLabel="Year to date"
        showTotals
        totalsLabel="World"
        format={fN}
      />
    </div>
  );
}
