"use client";

import {
  DataTable,
  IntegratedVarianceChart,
  KpiCard,
  RankingVarianceChart,
  type DataTableColumn,
} from "ibcs-react";
import { Dashboard, DashGrid, KpiStrip, Panel, series } from "./dashboard-layout";

/** Actual, budget, and a ΔBudget pair — cost columns, so higher reads red. */
const costCenterColumns: DataTableColumn[] = [
  { key: "spend", label: "Actual", kind: "value" },
  { key: "spend_pl", label: "Budget", kind: "value", measure: "spend", scenario: "PL" },
  {
    key: "spend_dpl",
    label: "ΔBudget",
    kind: "variance",
    measure: "spend",
    base: "PL",
    mode: "abs",
    mark: "bar",
    higherIsBetter: false,
  },
  {
    key: "spend_dpl_pct",
    label: "ΔBudget %",
    kind: "variance",
    measure: "spend",
    base: "PL",
    mode: "pct",
    mark: "pin",
    higherIsBetter: false,
  },
];

/**
 * 3 · Budget vs actual — Helios Manufacturing.
 * A monthly revenue build-up with a forecast tail and FY landing bar, cost
 * centres against budget and the ranked variance drivers.
 */
export function BudgetControl() {
  return (
    <Dashboard>
      <KpiStrip>
        <KpiCard
          label="Revenue YTD"
          values={{ AC: 13_120_000, PL: 12_700_000 }}
          comparisons={["PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(1.4e6, 0.12)}
        />
        <KpiCard
          label="Opex YTD"
          values={{ AC: 4_620_000, PL: 4_400_000 }}
          comparisons={["PL"]}
          higherIsBetter={false}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(0.5e6, 0.1)}
        />
        <KpiCard
          label="EBIT YTD"
          values={{ AC: 2_180_000, PL: 2_000_000 }}
          comparisons={["PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(0.22e6, 0.14)}
        />
        <KpiCard
          label="Budget utilisation"
          values={{ AC: 73, PL: 75 }}
          comparisons={["PL"]}
          higherIsBetter={false}
          format={{ decimals: 0, suffix: "%" }}
          sparkline={series(70, 0.05)}
        />
      </KpiStrip>

      <Panel title="Revenue build-up · monthly AC vs Plan, with FY landing" span2>
        <div style={{ marginBottom: 16 }}>
          <IntegratedVarianceChart
            comparison="PL"
            width={1000}
            height={320}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "Jan", AC: 1_320_000, PL: 1_300_000 },
              { category: "Feb", AC: 1_360_000, PL: 1_320_000 },
              { category: "Mar", AC: 1_540_000, PL: 1_420_000 },
              { category: "Apr", AC: 1_410_000, PL: 1_400_000 },
              { category: "May", AC: 1_470_000, PL: 1_450_000 },
              { category: "Jun", AC: 1_560_000, PL: 1_500_000 },
              { category: "Jul", AC: 1_480_000, PL: 1_460_000 },
              { category: "Aug", AC: 1_490_000, PL: 1_470_000 },
              { category: "Sep", AC: 1_490_000, PL: 1_380_000 },
              { category: "Oct", AC: 1_560_000, PL: 1_490_000, isForecast: true },
              { category: "Nov", AC: 1_610_000, PL: 1_520_000, isForecast: true },
              { category: "Dec", AC: 1_720_000, PL: 1_580_000, isForecast: true },
            ]}
            fyTotal={{
              label: "FY26",
              segments: [
                { label: "AC", value: 13_120_000 },
                { label: "FC", value: 4_890_000 },
              ],
            }}
          />
        </div>
      </Panel>

      <DashGrid variant="wide-left" style={{ marginTop: 16 }}>
        <Panel title="Cost centres · spend vs budget">
          <DataTable
            columns={costCenterColumns}
            format={{ compact: true, decimals: 1 }}
            showTotals
            totalsLabel="Total opex"
            defaultSort={{ key: "spend_dpl", dir: "desc" }}
            rows={[
              {
                id: "proc",
                label: "Procurement / raw mat.",
                values: { spend: { AC: 1_980_000, PL: 1_760_000 } },
              },
              {
                id: "prod",
                label: "Production",
                values: { spend: { AC: 1_240_000, PL: 1_220_000 } },
              },
              { id: "logi", label: "Logistics", values: { spend: { AC: 560_000, PL: 600_000 } } },
              {
                id: "qa",
                label: "Quality & maintenance",
                values: { spend: { AC: 410_000, PL: 420_000 } },
              },
              {
                id: "admin",
                label: "Admin & IT",
                values: { spend: { AC: 430_000, PL: 400_000 } },
              },
            ]}
          />
        </Panel>
        <Panel title="Variance drivers · ΔBudget by line (cost: higher is worse)">
          <RankingVarianceChart
            title="Spend vs budget — ΔPlan"
            baseLabel="PL"
            width={560}
            rowHeight={26}
            format={{ compact: true, decimals: 1 }}
            data={[
              { label: "Raw materials", AC: 1_980_000, base: 1_760_000, higherIsBetter: false },
              { label: "Energy", AC: 540_000, base: 470_000, higherIsBetter: false },
              { label: "Production", AC: 1_240_000, base: 1_220_000, higherIsBetter: false },
              { label: "Admin & IT", AC: 430_000, base: 400_000, higherIsBetter: false },
              { label: "Logistics", AC: 560_000, base: 600_000, higherIsBetter: false },
              { label: "Maintenance", AC: 410_000, base: 420_000, higherIsBetter: false },
            ]}
          />
        </Panel>
      </DashGrid>
    </Dashboard>
  );
}
