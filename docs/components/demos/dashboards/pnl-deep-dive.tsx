"use client";

import {
  KpiCard,
  Sparkline,
  StatementTable,
  VarianceColumnChart,
  type StatementLine,
} from "ibcs-react";
import { Dashboard, DashGrid, KpiStrip, Panel, PanelColumn, series } from "./dashboard-layout";

/** A full P&L: add / subtract lines with subtotals, AC vs PY and PL. */
const plStatement: StatementLine[] = [
  {
    id: "rev-sw",
    label: "Software revenue",
    flow: "add",
    values: { AC: 17_200_000, PY: 15_400_000, PL: 16_800_000 },
  },
  {
    id: "rev-svc",
    label: "Service revenue",
    flow: "add",
    values: { AC: 16_700_000, PY: 14_700_000, PL: 15_200_000 },
  },
  {
    id: "revenue",
    label: "Total revenue",
    flow: "result",
    values: { AC: 33_900_000, PY: 30_100_000, PL: 32_000_000 },
  },
  {
    id: "cogs",
    label: "Cost of sales",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 9_700_000, PY: 9_000_000, PL: 9_600_000 },
  },
  {
    id: "gross",
    label: "Gross profit",
    flow: "result",
    values: { AC: 24_200_000, PY: 21_100_000, PL: 22_400_000 },
  },
  {
    id: "rnd",
    label: "Research & development",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 3_900_000, PY: 3_500_000, PL: 4_000_000 },
  },
  {
    id: "sm",
    label: "Sales & marketing",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 4_800_000, PY: 4_300_000, PL: 4_600_000 },
  },
  {
    id: "ga",
    label: "General & admin.",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 1_300_000, PY: 1_400_000, PL: 1_400_000 },
  },
  {
    id: "ebit",
    label: "Operating income (EBIT)",
    flow: "result",
    values: { AC: 14_200_000, PY: 11_900_000, PL: 12_400_000 },
  },
  {
    id: "fin",
    label: "Financial result, net",
    flow: "add",
    values: { AC: 300_000, PY: 280_000, PL: 290_000 },
  },
  {
    id: "ibt",
    label: "Income before taxes",
    flow: "result",
    values: { AC: 14_500_000, PY: 12_200_000, PL: 12_700_000 },
  },
  {
    id: "tax",
    label: "Income taxes",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 5_600_000, PY: 4_100_000, PL: 5_200_000 },
  },
  {
    id: "net",
    label: "Net income",
    flow: "result",
    emphasis: true,
    values: { AC: 8_900_000, PY: 8_100_000, PL: 7_500_000 },
  },
];

/**
 * 4 · P&L deep-dive - Software & Service Group.
 * The statement itself carries the integrated waterfall and two variance
 * columns; the right rail breaks EBIT down by segment and walks the margin.
 */
export function PnLDeepDive() {
  return (
    <Dashboard>
      <KpiStrip>
        <KpiCard
          label="Revenue"
          values={{ AC: 33_900_000, PY: 30_100_000, PL: 32_000_000 }}
          comparisons={["PY", "PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(2.4e6, 0.2)}
        />
        <KpiCard
          label="Gross margin"
          values={{ AC: 71.4, PY: 70.1 }}
          comparisons={["PY"]}
          format={{ decimals: 1, suffix: "%" }}
          sparkline={series(70, 0.04)}
        />
        <KpiCard
          label="EBIT"
          values={{ AC: 14_200_000, PY: 11_900_000, PL: 12_400_000 }}
          comparisons={["PY", "PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(1.0e6, 0.25)}
        />
        <KpiCard
          label="Net income"
          values={{ AC: 8_900_000, PY: 8_100_000, PL: 7_500_000 }}
          comparisons={["PY", "PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(0.62e6, 0.2)}
        />
      </KpiStrip>

      <DashGrid variant="wide-left">
        <Panel title="Income statement · integrated waterfall, AC with ΔPY / ΔPL">
          <StatementTable
            lines={plStatement}
            waterfallWidth={220}
            format={{ compact: true, decimals: 1 }}
            varianceColumns={[
              { base: "PY", mode: "abs", mark: "bar" },
              { base: "PL", mode: "abs", mark: "bar" },
            ]}
          />
        </Panel>
        <PanelColumn>
          <Panel title="EBIT by segment · AC vs PY">
            <VarianceColumnChart
              comparison="PY"
              width={420}
              height={250}
              format={{ compact: true, decimals: 1 }}
              data={[
                { category: "Applications", AC: 6_400_000, PY: 5_600_000 },
                { category: "Cloud", AC: 4_900_000, PY: 3_700_000 },
                { category: "Services", AC: 2_100_000, PY: 1_900_000 },
                { category: "Other", AC: 800_000, PY: 700_000 },
              ]}
            />
          </Panel>
          <Panel title="Margin walk · gross to net">
            <Sparkline
              data={[71.4, 41.9, 30.6, 9.5, 8.0, 9.4, 42.8, 26.3]}
              type="bar"
              width={400}
              height={56}
            />
            <div className="ibcs-dash-note">
              Gross 71% to EBIT 42% to net 26% margin (% of revenue, AC).
            </div>
          </Panel>
        </PanelColumn>
      </DashGrid>
    </Dashboard>
  );
}
