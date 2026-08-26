"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  Report,
  StructureChart,
  StatementTable,
  MiniVarianceMultiples,
  DataTable,
  defaultTokens,
  type ReportConfig,
  type DataTableColumn,
  type DataTableRow,
  type MiniGroupInput,
} from "ibcs-react";
import {
  sampleStatementFlat,
  sampleBalanceSheet,
  sampleMonthlyTrend,
  sampleRevenueStructure,
  sampleQuarterlyStatement,
} from "@/lib/demo-data/sample-data";

/**
 * The three complete dashboards of the Examples gallery, each assembled only
 * from library components over the shared sample model (AC / PY / PL / FC).
 * The grids reflow to one column on narrow screens; each panel scrolls
 * horizontally rather than widening the page.
 */

const TOK = defaultTokens;

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  alignItems: "start",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
};

const panelStyle: CSSProperties = {
  border: `1px solid ${TOK.color.rowBorder}`,
  borderRadius: 10,
  padding: "14px 16px",
  minWidth: 0,
  overflowX: "auto",
};

const panelHeadStyle: CSSProperties = {
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: TOK.color.textMuted,
  marginBottom: 8,
};

function Panel({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div style={panelStyle}>
      <div style={panelHeadStyle}>{heading}</div>
      {children}
    </div>
  );
}

/** A Who / What / When title block with the report's key message. */
function ReportHeader({
  who,
  what,
  when,
  message,
}: {
  who: string;
  what: string;
  when: string;
  message?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: TOK.color.textMuted }}>{who}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: TOK.color.text }}>{what}</div>
      <div style={{ fontSize: 12.5, color: TOK.color.textMuted }}>{when}</div>
      {message && (
        <div style={{ marginTop: 6, fontSize: 13, color: TOK.color.text, fontWeight: 600 }}>
          {message}
        </div>
      )}
    </div>
  );
}

function Dashboard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        fontFamily: TOK.font.family,
        color: TOK.color.text,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------- 1 · Executive overview ------------------------- */

/** Sparkline series from the actual periods of the shared trend. */
const acTrend = sampleMonthlyTrend.filter((d) => d.AC != null).map((d) => d.AC as number);

const executiveConfig: ReportConfig = {
  title: {
    who: "Contoso Group",
    what: "Performance summary — € thousands",
    when: "FY 2026 · Actual vs Previous year",
  },
  message: "Revenue +17.5% on PY; margin expansion lifts net income to €8.9M.",
  columns: 12,
  blocks: [
    {
      id: "k-rev",
      type: "kpi",
      span: 3,
      config: {
        label: "Revenue",
        values: { AC: 30_100_000, PY: 25_600_000, PL: 28_500_000 },
        comparisons: ["PY", "PL"],
        format: { compact: true, decimals: 1 },
        sparkline: acTrend,
      },
    },
    {
      id: "k-gm",
      type: "kpi",
      span: 3,
      config: {
        label: "Gross margin",
        values: { AC: 20_400_000, PY: 17_200_000 },
        comparisons: ["PY"],
        format: { compact: true, decimals: 1 },
        sparkline: acTrend.map((v) => v * 0.68),
      },
    },
    {
      id: "k-oi",
      type: "kpi",
      span: 3,
      config: {
        label: "Operating income",
        values: { AC: 10_400_000, PY: 7_700_000 },
        comparisons: ["PY"],
        format: { compact: true, decimals: 1 },
        sparkline: acTrend.map((v) => v * 0.35),
      },
    },
    {
      id: "k-ni",
      type: "kpi",
      span: 3,
      config: {
        label: "Net income",
        values: { AC: 8_900_000, PY: 8_100_000, PL: 7_490_000 },
        comparisons: ["PY", "PL"],
        format: { compact: true, decimals: 1 },
        sparkline: acTrend.map((v) => v * 0.3),
      },
    },
    {
      id: "ex-bridge",
      type: "chart",
      span: 7,
      title: {
        who: "Contoso Group",
        what: "Operating income bridge — € thousands",
        when: "FY 2026",
      },
      config: {
        type: "waterfall",
        data: [
          { category: "Revenue", value: 30_100_000, flow: "add" },
          { category: "COGS", value: 9_700_000, flow: "subtract", higherIsBetter: false },
          { category: "Gross margin", value: 20_400_000, flow: "result" },
          { category: "Opex", value: 10_000_000, flow: "subtract", higherIsBetter: false },
          { category: "Op. income", value: 10_400_000, flow: "result" },
        ],
        width: 460,
        height: 280,
        format: { compact: true, decimals: 1 },
      },
    },
    {
      id: "ex-structure",
      type: "chart",
      span: 5,
      title: {
        who: "Contoso Group",
        what: "Revenue by region — € thousands",
        when: "FY 2026 vs PY",
      },
      config: {
        type: "structure",
        data: sampleRevenueStructure,
        width: 360,
        height: 280,
        format: { compact: true },
      },
    },
    {
      id: "ex-trend",
      type: "chart",
      span: 12,
      title: {
        who: "Contoso Group",
        what: "Revenue — € thousands",
        when: "13 periods, AC/FC vs PY",
      },
      config: {
        type: "trend",
        data: sampleMonthlyTrend,
        width: 820,
        height: 260,
        format: { compact: true },
      },
    },
  ],
};

/** One `ReportConfig`, one component: KPI strip, bridge, structure and trend. */
export function ExecutiveOverview() {
  return <Report config={executiveConfig} />;
}

/* ------------------------- 2 · Sales performance ------------------------- */

const regionMultiples: MiniGroupInput[] = [
  {
    label: "North America",
    data: [
      { category: "Q1", AC: 2.9e6, PY: 2.6e6 },
      { category: "Q2", AC: 3.1e6, PY: 2.7e6 },
      { category: "Q3", AC: 3.2e6, PY: 2.9e6 },
      { category: "Q4", AC: 3.2e6, PY: 2.9e6 },
    ],
  },
  {
    label: "Europe",
    data: [
      { category: "Q1", AC: 2.1e6, PY: 1.9e6 },
      { category: "Q2", AC: 2.2e6, PY: 2.0e6 },
      { category: "Q3", AC: 2.3e6, PY: 2.0e6 },
      { category: "Q4", AC: 2.3e6, PY: 2.1e6 },
    ],
  },
  {
    label: "Asia Pacific",
    data: [
      { category: "Q1", AC: 1.3e6, PY: 1.0e6 },
      { category: "Q2", AC: 1.4e6, PY: 1.0e6 },
      { category: "Q3", AC: 1.4e6, PY: 1.1e6 },
      { category: "Q4", AC: 1.5e6, PY: 1.1e6 },
    ],
  },
  {
    label: "Rest of world",
    data: [
      { category: "Q1", AC: 0.7e6, PY: 0.5e6 },
      { category: "Q2", AC: 0.8e6, PY: 0.6e6 },
      { category: "Q3", AC: 0.8e6, PY: 0.6e6 },
      { category: "Q4", AC: 0.9e6, PY: 0.6e6 },
    ],
  },
];

const salesColumns: DataTableColumn[] = [
  { key: "rev", label: "Revenue AC", kind: "value" },
  {
    key: "rev_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "rev",
    base: "PY",
    mode: "abs",
    mark: "bar",
  },
  {
    key: "rev_dpy_pct",
    label: "ΔPY %",
    kind: "variance",
    measure: "rev",
    base: "PY",
    mode: "pct",
    mark: "pin",
  },
  { key: "trend", label: "Trend", kind: "sparkline", measure: "rev", sparkType: "line" },
];

const salesRows: DataTableRow[] = [
  {
    id: "na",
    label: "North America",
    values: { rev: { AC: 12_400_000, PY: 11_100_000 } },
    spark: { rev: [2.6e6, 2.7e6, 2.9e6, 3.1e6, 3.2e6, 3.2e6] },
  },
  {
    id: "eu",
    label: "Europe",
    values: { rev: { AC: 8_900_000, PY: 8_000_000 } },
    spark: { rev: [1.9e6, 2.0e6, 2.0e6, 2.1e6, 2.2e6, 2.3e6] },
  },
  {
    id: "apac",
    label: "Asia Pacific",
    values: { rev: { AC: 5_600_000, PY: 4_200_000 } },
    spark: { rev: [1.0e6, 1.0e6, 1.1e6, 1.3e6, 1.4e6, 1.5e6] },
  },
  {
    id: "row",
    label: "Rest of world",
    values: { rev: { AC: 3_200_000, PY: 2_300_000 } },
    spark: { rev: [0.5e6, 0.6e6, 0.6e6, 0.7e6, 0.8e6, 0.9e6] },
  },
];

/** A regional sales review: structure, small multiples and a sortable table. */
export function SalesDashboard() {
  return (
    <Dashboard>
      <ReportHeader
        who="Contoso Group · Sales"
        what="Revenue by region — € thousands"
        when="FY 2026 · Actual vs Previous year"
        message="Asia Pacific +33% leads growth; every region beats prior year."
      />
      <div style={gridStyle}>
        <Panel heading="Structure · share and ΔPY">
          <StructureChart
            data={sampleRevenueStructure}
            comparison="PY"
            width={380}
            height={280}
            format={{ compact: true }}
          />
        </Panel>
        <Panel heading="Small multiples · quarterly ΔPY">
          <MiniVarianceMultiples
            groups={regionMultiples}
            comparison="PY"
            columns={2}
            format={{ compact: true }}
          />
        </Panel>
      </div>
      <Panel heading="Detail · revenue, variance and trend">
        <DataTable
          columns={salesColumns}
          rows={salesRows}
          format={{ compact: true, decimals: 1 }}
          showTotals
          totalsLabel="Total"
          defaultSort={{ key: "rev", dir: "desc" }}
        />
      </Panel>
    </Dashboard>
  );
}

/* ----------------------- 3 · Financial statements ----------------------- */

const budgetColumns: DataTableColumn[] = [
  { key: "rev", label: "Actual", kind: "value" },
  { key: "rev_pl", label: "Plan", kind: "value", measure: "rev", scenario: "PL" },
  {
    key: "rev_dpl",
    label: "ΔPL",
    kind: "variance",
    measure: "rev",
    base: "PL",
    mode: "abs",
    mark: "bar",
  },
  {
    key: "rev_dpl_pct",
    label: "ΔPL %",
    kind: "variance",
    measure: "rev",
    base: "PL",
    mode: "pct",
    mark: "pin",
  },
];

const budgetRows: DataTableRow[] = sampleQuarterlyStatement
  .filter((l) => l.flow !== "result")
  .map((l) => ({
    id: l.id,
    label: l.label,
    values: { rev: { AC: l.values.AC, PL: l.values.PL } },
  }));

/** The finance pack: income statement, balance sheet and a budget table. */
export function FinancialsDashboard() {
  return (
    <Dashboard>
      <ReportHeader
        who="Contoso Group · Finance"
        what="Financial statements — € thousands"
        when="FY 2026 · Actual vs Previous year and Plan"
        message="Net income €8.9M, +10% on PY; balance sheet grows to €37.0M."
      />
      <div style={gridStyle}>
        <Panel heading="Income statement · flow (waterfall)">
          <StatementTable
            lines={sampleStatementFlat}
            waterfallWidth={170}
            format={{ compact: true, decimals: 1 }}
            maxHeight={300}
          />
        </Panel>
        <Panel heading="Balance sheet · stock (levels)">
          <StatementTable
            lines={sampleBalanceSheet}
            mode="stock"
            waterfallWidth={150}
            format={{ compact: true, decimals: 1 }}
            maxHeight={300}
          />
        </Panel>
      </div>
      <Panel heading="Budget · revenue by quarter, Actual vs Plan">
        <DataTable
          columns={budgetColumns}
          rows={budgetRows}
          format={{ compact: true, decimals: 1 }}
          showTotals
          totalsLabel="Full year"
        />
      </Panel>
    </Dashboard>
  );
}
