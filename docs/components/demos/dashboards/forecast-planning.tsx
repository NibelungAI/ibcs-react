"use client";

import {
  IntegratedVarianceChart,
  KpiCard,
  MatrixTable,
  TrendChart,
  type MatrixPeriod,
  type MatrixRow,
  type MatrixValues,
} from "ibcs-react";
import { Dashboard, DashGrid, KpiStrip, Panel, series } from "./dashboard-layout";

const forecastMatrixRows: MatrixRow[] = [
  { id: "orders", label: "Order intake" },
  { id: "revenue", label: "Revenue" },
  { id: "ebit", label: "EBIT", flow: "result" },
];

/** H1 closed on actuals, H2 still on forecast - set per period. */
const forecastMatrixCols: MatrixPeriod[] = [
  { id: "q1", label: "Q1", scenarios: ["PL", "AC"] },
  { id: "q2", label: "Q2", scenarios: ["PL", "AC"] },
  { id: "q3", label: "Q3", scenarios: ["PL", "FC"] },
  { id: "q4", label: "Q4", scenarios: ["PL", "FC"] },
];

const forecastMatrixValues: MatrixValues = {
  orders: {
    q1: { PL: 6.2e6, AC: 6.5e6 },
    q2: { PL: 6.4e6, AC: 6.8e6 },
    q3: { PL: 6.6e6, FC: 7.1e6 },
    q4: { PL: 6.8e6, FC: 7.4e6 },
  },
  revenue: {
    q1: { PL: 5.9e6, AC: 6.1e6 },
    q2: { PL: 6.1e6, AC: 6.3e6 },
    q3: { PL: 6.3e6, FC: 6.6e6 },
    q4: { PL: 6.5e6, FC: 6.9e6 },
  },
  ebit: {
    q1: { PL: 0.71e6, AC: 0.78e6 },
    q2: { PL: 0.74e6, AC: 0.82e6 },
    q3: { PL: 0.77e6, FC: 0.88e6 },
    q4: { PL: 0.8e6, FC: 0.95e6 },
  },
};

/**
 * 7 · Forecast and planning - Atlas Industrial.
 * A 9+3 view: nine actual months plus a forecast tail against plan, the EBIT
 * build-up with an FY landing bar, and a matrix whose scenarios switch from
 * AC to FC at the half-year.
 */
export function ForecastPlanning() {
  return (
    <Dashboard>
      <KpiStrip>
        <KpiCard
          label="FY revenue (FC)"
          values={{ AC: 25_900_000, PL: 24_800_000, PY: 23_100_000 }}
          comparisons={["PL", "PY"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(6.1e6, 0.13)}
        />
        <KpiCard
          label="FY EBIT (FC)"
          values={{ AC: 3_430_000, PL: 3_020_000 }}
          comparisons={["PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(0.78e6, 0.18)}
        />
        <KpiCard
          label="Order backlog"
          values={{ AC: 18_600_000, PY: 15_900_000 }}
          comparisons={["PY"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(1.4e6, 0.3)}
        />
        <KpiCard
          label="Forecast accuracy"
          values={{ AC: 96.2, PY: 93.8 }}
          comparisons={["PY"]}
          format={{ decimals: 1, suffix: "%" }}
          sparkline={series(94, 0.03)}
        />
      </KpiStrip>

      <DashGrid style={{ marginBottom: 16 }}>
        <Panel title="Revenue · actuals plus forecast tail vs Plan">
          <TrendChart
            comparison="PL"
            width={460}
            height={290}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "Jan", AC: 1.95e6, PL: 1.92e6 },
              { category: "Feb", AC: 2.02e6, PL: 1.98e6 },
              { category: "Mar", AC: 2.13e6, PL: 2.0e6 },
              { category: "Apr", AC: 2.05e6, PL: 2.02e6 },
              { category: "May", AC: 2.11e6, PL: 2.06e6 },
              { category: "Jun", AC: 2.18e6, PL: 2.1e6 },
              { category: "Jul", AC: 2.09e6, PL: 2.08e6 },
              { category: "Aug", AC: 2.14e6, PL: 2.1e6 },
              { category: "Sep", AC: 2.2e6, PL: 2.12e6 },
              { category: "Oct", FC: 2.28e6, PL: 2.16e6 },
              { category: "Nov", FC: 2.34e6, PL: 2.2e6 },
              { category: "Dec", FC: 2.41e6, PL: 2.24e6 },
            ]}
          />
        </Panel>
        <Panel title="EBIT build-up · AC plus FC vs Plan, FY landing">
          <IntegratedVarianceChart
            comparison="PL"
            width={460}
            height={290}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "Q1", AC: 780_000, PL: 710_000 },
              { category: "Q2", AC: 820_000, PL: 740_000 },
              { category: "Q3", AC: 880_000, PL: 770_000, isForecast: true },
              { category: "Q4", AC: 950_000, PL: 800_000, isForecast: true },
            ]}
            fyTotal={{
              label: "FY26",
              segments: [
                { label: "AC", value: 1_600_000 },
                { label: "FC", value: 1_830_000 },
              ],
            }}
          />
        </Panel>
      </DashGrid>

      <Panel title="Plan vs actual/forecast matrix · scenarios switch from AC to FC at H2" span2>
        <MatrixTable
          rows={forecastMatrixRows}
          columns={forecastMatrixCols}
          values={forecastMatrixValues}
          scenarios={["PL", "AC"]}
          format={{ compact: true, decimals: 1 }}
        />
      </Panel>
    </Dashboard>
  );
}
