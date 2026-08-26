"use client";

import {
  KpiCard,
  MatrixTable,
  StackedChart,
  StructureChart,
  type MatrixPeriod,
  type MatrixRow,
  type MatrixValues,
} from "ibcs-react";
import { Dashboard, DashGrid, KpiStrip, Panel, series } from "./dashboard-layout";

const regionMatrixRows: MatrixRow[] = [
  { id: "namer", label: "North America" },
  { id: "emea", label: "EMEA" },
  { id: "apac", label: "Asia Pacific" },
  { id: "latam", label: "Latin America" },
  { id: "total", label: "Group", flow: "result" },
];

const regionMatrixCols: MatrixPeriod[] = [
  { id: "q1", label: "Q1" },
  { id: "q2", label: "Q2" },
  { id: "q3", label: "Q3" },
  { id: "q4", label: "Q4" },
];

const regionMatrixValues: MatrixValues = {
  namer: {
    q1: { PY: 2.6e6, AC: 2.9e6 },
    q2: { PY: 2.7e6, AC: 3.1e6 },
    q3: { PY: 2.9e6, AC: 3.2e6 },
    q4: { PY: 2.9e6, AC: 3.3e6 },
  },
  emea: {
    q1: { PY: 1.9e6, AC: 2.1e6 },
    q2: { PY: 2.0e6, AC: 2.1e6 },
    q3: { PY: 2.0e6, AC: 2.2e6 },
    q4: { PY: 2.1e6, AC: 2.3e6 },
  },
  apac: {
    q1: { PY: 1.0e6, AC: 1.3e6 },
    q2: { PY: 1.0e6, AC: 1.4e6 },
    q3: { PY: 1.1e6, AC: 1.6e6 },
    q4: { PY: 1.1e6, AC: 1.8e6 },
  },
  latam: {
    q1: { PY: 0.5e6, AC: 0.6e6 },
    q2: { PY: 0.6e6, AC: 0.7e6 },
    q3: { PY: 0.6e6, AC: 0.7e6 },
    q4: { PY: 0.6e6, AC: 0.8e6 },
  },
  total: {
    q1: { PY: 6.0e6, AC: 6.9e6 },
    q2: { PY: 6.3e6, AC: 7.3e6 },
    q3: { PY: 6.6e6, AC: 7.7e6 },
    q4: { PY: 6.7e6, AC: 8.2e6 },
  },
};

/**
 * 5 · Regional breakdown — Global Retail Co.
 * The same four markets read three ways: stacked by quarter, as a share of
 * the group with ΔPY, and as a market x quarter matrix with a variance column.
 */
export function RegionalBreakdown() {
  return (
    <Dashboard>
      <KpiStrip>
        <KpiCard
          label="Net sales"
          values={{ AC: 30_100_000, PY: 25_600_000 }}
          comparisons={["PY"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(6.9e6, 0.18)}
        />
        <KpiCard
          label="Same-store growth"
          values={{ AC: 6.4, PY: 3.1 }}
          comparisons={["PY"]}
          format={{ decimals: 1, suffix: "%" }}
          sparkline={series(4, 0.5)}
        />
        <KpiCard
          label="Active stores"
          values={{ AC: 482, PY: 451 }}
          comparisons={["PY"]}
          format={{ decimals: 0 }}
          sparkline={series(452, 0.07)}
        />
        <KpiCard
          label="Sales / m²"
          values={{ AC: 7_240, PY: 6_580 }}
          comparisons={["PY"]}
          format={{ compact: true, decimals: 1, currency: "€" }}
          sparkline={series(6600, 0.1)}
        />
      </KpiStrip>

      <DashGrid style={{ marginBottom: 16 }}>
        <Panel title="Net sales by market · quarterly stacked">
          <StackedChart
            orientation="column"
            width={460}
            height={300}
            showTotals
            format={{ compact: true, decimals: 1 }}
            series={[
              { key: "namer", label: "North America" },
              { key: "emea", label: "EMEA" },
              { key: "apac", label: "Asia Pacific" },
              { key: "latam", label: "Latin America" },
            ]}
            data={[
              { category: "Q1", values: { namer: 2.9e6, emea: 2.1e6, apac: 1.3e6, latam: 0.6e6 } },
              { category: "Q2", values: { namer: 3.1e6, emea: 2.1e6, apac: 1.4e6, latam: 0.7e6 } },
              { category: "Q3", values: { namer: 3.2e6, emea: 2.2e6, apac: 1.6e6, latam: 0.7e6 } },
              { category: "Q4", values: { namer: 3.3e6, emea: 2.3e6, apac: 1.8e6, latam: 0.8e6 } },
            ]}
          />
        </Panel>
        <Panel title="Share of group and ΔPY">
          <StructureChart
            comparison="PY"
            variance="pct"
            width={400}
            height={300}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "North America", AC: 12_500_000, PY: 11_100_000 },
              { category: "EMEA", AC: 8_700_000, PY: 8_000_000 },
              { category: "Asia Pacific", AC: 6_100_000, PY: 4_200_000 },
              { category: "Latin America", AC: 2_800_000, PY: 2_300_000 },
            ]}
          />
        </Panel>
      </DashGrid>

      <Panel title="Market by quarter · AC vs PY with variance" span2>
        <MatrixTable
          rows={regionMatrixRows}
          columns={regionMatrixCols}
          values={regionMatrixValues}
          scenarios={["PY", "AC"]}
          showVariance
          varianceScenarios={{ actual: "AC", base: "PY" }}
          format={{ compact: true, decimals: 1 }}
        />
      </Panel>
    </Dashboard>
  );
}
