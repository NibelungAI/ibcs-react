"use client";

import {
  DataTable,
  KpiCard,
  RankingVarianceChart,
  WaterfallChart,
  type DataTableColumn,
} from "ibcs-react";
import { Dashboard, DashGrid, KpiStrip, Panel, series } from "./dashboard-layout";

/** Cost columns: every variance carries `higherIsBetter: false`. */
const opsCostColumns: DataTableColumn[] = [
  { key: "cost", label: "Actual", kind: "value" },
  { key: "cost_py", label: "PY", kind: "value", measure: "cost", scenario: "PY" },
  {
    key: "cost_dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "cost",
    base: "PY",
    mode: "abs",
    mark: "bar",
    higherIsBetter: false,
  },
  {
    key: "cost_dpy_pct",
    label: "ΔPY %",
    kind: "variance",
    measure: "cost",
    base: "PY",
    mode: "pct",
    mark: "pin",
    higherIsBetter: false,
  },
  { key: "trend", label: "12-mo", kind: "sparkline", measure: "cost", sparkType: "bar" },
];

/**
 * 6 · Operations and cost — Helios Plants.
 * A cost bridge from PY to AC, the ranked cost categories and a cost-centre
 * table — all on the "lower is better" polarity.
 */
export function OperationsCost() {
  return (
    <Dashboard>
      <KpiStrip>
        <KpiCard
          label="Output"
          values={{ AC: 1_284_000, PY: 1_190_000 }}
          comparisons={["PY"]}
          format={{ compact: true, decimals: 1, suffix: " u" }}
          sparkline={series(102e3, 0.1)}
        />
        <KpiCard
          label="Cost / unit"
          values={{ AC: 4.36, PY: 4.55 }}
          comparisons={["PY"]}
          higherIsBetter={false}
          format={{ decimals: 2, currency: "€" }}
          sparkline={series(4.6, -0.06)}
        />
        <KpiCard
          label="OEE"
          values={{ AC: 78.4, PY: 74.1 }}
          comparisons={["PY"]}
          format={{ decimals: 1, suffix: "%" }}
          sparkline={series(74, 0.07)}
        />
        <KpiCard
          label="Scrap rate"
          values={{ AC: 2.1, PY: 2.8 }}
          comparisons={["PY"]}
          higherIsBetter={false}
          format={{ decimals: 1, suffix: "%" }}
          sparkline={series(2.8, -0.25)}
        />
      </KpiStrip>

      <DashGrid variant="wide-left" style={{ marginBottom: 16 }}>
        <Panel title="Conversion-cost bridge · PY to AC (cost build-up)">
          <WaterfallChart
            width={540}
            height={290}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "PY cost", value: 5_415_000, flow: "result" },
              { category: "Volume", value: 280_000, flow: "add", higherIsBetter: false },
              { category: "Labour eff.", value: 210_000, flow: "subtract", higherIsBetter: false },
              {
                category: "Material yield",
                value: 160_000,
                flow: "subtract",
                higherIsBetter: false,
              },
              { category: "Energy", value: 220_000, flow: "add", higherIsBetter: false },
              { category: "AC cost", value: 5_545_000, flow: "result" },
            ]}
          />
        </Panel>
        <Panel title="Cost categories · ranked ΔPY (higher is worse)">
          <RankingVarianceChart
            title="Cost by category — AC vs PY"
            baseLabel="PY"
            width={560}
            rowHeight={26}
            format={{ compact: true, decimals: 1 }}
            data={[
              { label: "Energy", AC: 1_440_000, base: 1_220_000, higherIsBetter: false },
              { label: "Direct labour", AC: 1_980_000, base: 2_190_000, higherIsBetter: false },
              { label: "Materials", AC: 1_240_000, base: 1_400_000, higherIsBetter: false },
              { label: "Maintenance", AC: 520_000, base: 480_000, higherIsBetter: false },
              { label: "Consumables", AC: 365_000, base: 405_000, higherIsBetter: false },
            ]}
          />
        </Panel>
      </DashGrid>

      <Panel title="Cost centres · spend vs PY with 12-month run-rate" span2>
        <DataTable
          columns={opsCostColumns}
          format={{ compact: true, decimals: 1 }}
          showTotals
          totalsLabel="Total conversion cost"
          defaultSort={{ key: "cost", dir: "desc" }}
          rows={[
            {
              id: "line1",
              label: "Line 1 · Moulding",
              values: { cost: { AC: 1_980_000, PY: 2_080_000 } },
              spark: { cost: [172e3, 168e3, 166e3, 164e3, 163e3, 161e3] },
            },
            {
              id: "line2",
              label: "Line 2 · Assembly",
              values: { cost: { AC: 1_640_000, PY: 1_690_000 } },
              spark: { cost: [142e3, 140e3, 138e3, 137e3, 136e3, 135e3] },
            },
            {
              id: "energy",
              label: "Utilities & energy",
              values: { cost: { AC: 1_440_000, PY: 1_220_000 } },
              spark: { cost: [98e3, 104e3, 112e3, 120e3, 126e3, 132e3] },
            },
            {
              id: "maint",
              label: "Maintenance",
              values: { cost: { AC: 520_000, PY: 480_000 } },
              spark: { cost: [40e3, 41e3, 43e3, 44e3, 45e3, 46e3] },
            },
          ]}
        />
      </Panel>
    </Dashboard>
  );
}
