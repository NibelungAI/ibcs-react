"use client";

import {
  DataTable,
  KpiCard,
  RankingVarianceChart,
  VarianceColumnChart,
  type DataTableColumn,
} from "ibcs-react";
import { Dashboard, DashGrid, KpiStrip, Panel, series } from "./dashboard-layout";

/** Bookings, two variance columns (vs plan, vs PY) and a run-rate sparkline. */
const repColumns: DataTableColumn[] = [
  { key: "book", label: "Bookings AC", kind: "value" },
  {
    key: "book_dpl",
    label: "ΔPlan",
    kind: "variance",
    measure: "book",
    base: "PL",
    mode: "abs",
    mark: "bar",
  },
  {
    key: "book_dpl_pct",
    label: "ΔPlan %",
    kind: "variance",
    measure: "book",
    base: "PL",
    mode: "pct",
    mark: "pin",
  },
  {
    key: "book_dpy_pct",
    label: "ΔPY %",
    kind: "variance",
    measure: "book",
    base: "PY",
    mode: "pct",
    mark: "pin",
  },
  { key: "trend", label: "Run-rate", kind: "sparkline", measure: "book", sparkType: "line" },
];

/**
 * 2 · Sales performance - Northwind Trading.
 * Bookings vs plan by region, product lines ranked by ΔPlan, and a rep table
 * that sorts on any column.
 */
export function SalesPerformance() {
  return (
    <Dashboard>
      <KpiStrip>
        <KpiCard
          label="Bookings"
          values={{ AC: 25_400_000, PY: 22_300_000, PL: 23_500_000 }}
          comparisons={["PL", "PY"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(7.6e6, 0.18)}
        />
        <KpiCard
          label="Net new logos"
          values={{ AC: 184, PY: 151, PL: 170 }}
          comparisons={["PL"]}
          format={{ decimals: 0 }}
          sparkline={series(52, 0.18)}
        />
        <KpiCard
          label="Avg deal size"
          values={{ AC: 138_000, PY: 121_000 }}
          comparisons={["PY"]}
          format={{ compact: true, decimals: 0 }}
          sparkline={series(124e3, 0.12)}
        />
        <KpiCard
          label="Win rate"
          values={{ AC: 27.5, PY: 24.0, PL: 26.0 }}
          comparisons={["PL"]}
          format={{ decimals: 1, suffix: "%" }}
          sparkline={series(25, 0.1)}
        />
      </KpiStrip>

      <DashGrid style={{ marginBottom: 16 }}>
        <Panel title="Bookings by region · quarterly AC vs Plan">
          <VarianceColumnChart
            comparison="PL"
            width={460}
            height={290}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "EMEA", AC: 9_100_000, PL: 9_600_000 },
              { category: "Americas", AC: 8_400_000, PL: 7_900_000 },
              { category: "APAC", AC: 5_300_000, PL: 4_500_000 },
              { category: "LATAM", AC: 2_600_000, PL: 2_500_000 },
            ]}
          />
        </Panel>
        <Panel title="Product lines · ranked by ΔPlan">
          <RankingVarianceChart
            title="Bookings by product line - AC vs Plan"
            baseLabel="PL"
            width={560}
            rowHeight={26}
            format={{ compact: true, decimals: 1 }}
            data={[
              { label: "Cloud platform", AC: 8_900_000, base: 7_400_000 },
              { label: "Analytics", AC: 5_200_000, base: 4_800_000 },
              { label: "Security", AC: 4_100_000, base: 3_900_000 },
              { label: "Integration", AC: 2_900_000, base: 3_000_000 },
              { label: "On-prem licences", AC: 2_300_000, base: 2_900_000 },
              { label: "Professional svc", AC: 2_000_000, base: 1_500_000 },
            ]}
          />
        </Panel>
      </DashGrid>

      <Panel title="Sales team · bookings, variance and run-rate" span2>
        <DataTable
          columns={repColumns}
          format={{ compact: true, decimals: 1 }}
          showTotals
          totalsLabel="Total"
          defaultSort={{ key: "book", dir: "desc" }}
          rows={[
            {
              id: "rivera",
              label: "Rivera (Enterprise)",
              values: { book: { AC: 7_400_000, PY: 6_300_000, PL: 6_800_000 } },
              spark: { book: [1.6e6, 1.7e6, 1.8e6, 2.1e6, 2.3e6, 2.4e6] },
            },
            {
              id: "okafor",
              label: "Okafor (Strategic)",
              values: { book: { AC: 6_100_000, PY: 5_200_000, PL: 5_700_000 } },
              spark: { book: [1.3e6, 1.4e6, 1.5e6, 1.6e6, 1.8e6, 2.0e6] },
            },
            {
              id: "tan",
              label: "Tan (APAC)",
              values: { book: { AC: 5_300_000, PY: 4_100_000, PL: 4_500_000 } },
              spark: { book: [0.9e6, 1.1e6, 1.3e6, 1.5e6, 1.7e6, 1.9e6] },
            },
            {
              id: "haas",
              label: "Haas (Mid-market)",
              values: { book: { AC: 3_600_000, PY: 3_700_000, PL: 4_100_000 } },
              spark: { book: [1.1e6, 1.0e6, 0.9e6, 0.9e6, 0.8e6, 0.8e6] },
            },
            {
              id: "moreau",
              label: "Moreau (Channel)",
              values: { book: { AC: 3_000_000, PY: 3_000_000, PL: 2_400_000 } },
              spark: { book: [0.7e6, 0.8e6, 0.9e6, 1.0e6, 1.0e6, 1.1e6] },
            },
          ]}
        />
      </Panel>
    </Dashboard>
  );
}
