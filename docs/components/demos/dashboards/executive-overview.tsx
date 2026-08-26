"use client";

import { KpiCard, ScrollChart, StructureChart, TrendChart, WaterfallChart } from "ibcs-react";
import { Dashboard, DashGrid, KpiStrip, Panel, series } from "./dashboard-layout";

/**
 * 1 · Executive overview — Contoso Group.
 * KPI strip, an operating-income bridge, revenue structure by region and a
 * full 12-month trend that scrolls sideways instead of squashing.
 */
export function ExecutiveOverview() {
  return (
    <Dashboard>
      <KpiStrip>
        <KpiCard
          label="Revenue"
          values={{ AC: 30_100_000, PY: 26_100_000, PL: 28_500_000 }}
          comparisons={["PY", "PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(2.1e6, 0.45)}
        />
        <KpiCard
          label="EBIT margin"
          values={{ AC: 18.4, PY: 16.8 }}
          comparisons={["PY"]}
          format={{ decimals: 1, suffix: "%" }}
          sparkline={series(16.5, 0.12)}
        />
        <KpiCard
          label="Net income"
          values={{ AC: 8_900_000, PY: 8_100_000, PL: 7_490_000 }}
          comparisons={["PY", "PL"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(0.62e6, 0.4)}
        />
        <KpiCard
          label="Free cash flow"
          values={{ AC: 6_300_000, PY: 5_400_000 }}
          comparisons={["PY"]}
          format={{ compact: true, decimals: 1 }}
          sparkline={series(0.45e6, 0.35)}
        />
      </KpiStrip>

      <DashGrid variant="wide-left" style={{ marginBottom: 16 }}>
        <Panel title="Operating-income bridge · revenue to EBIT">
          <WaterfallChart
            width={560}
            height={290}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "Revenue", value: 30_100_000, flow: "add" },
              { category: "COGS", value: 9_700_000, flow: "subtract", higherIsBetter: false },
              { category: "Gross margin", value: 20_400_000, flow: "result" },
              { category: "R&D", value: 3_900_000, flow: "subtract", higherIsBetter: false },
              { category: "S&M", value: 4_800_000, flow: "subtract", higherIsBetter: false },
              { category: "G&A", value: 1_400_000, flow: "subtract", higherIsBetter: false },
              { category: "Op. income", value: 10_300_000, flow: "result" },
            ]}
          />
        </Panel>
        <Panel title="Revenue by region · share and ΔPY">
          <StructureChart
            comparison="PY"
            variance="abs"
            width={360}
            height={290}
            format={{ compact: true, decimals: 1 }}
            data={[
              { category: "Europe", AC: 13_200_000, PY: 12_000_000 },
              { category: "Americas", AC: 9_400_000, PY: 8_300_000 },
              { category: "Asia Pacific", AC: 5_300_000, PY: 4_000_000 },
              { category: "Rest of world", AC: 2_200_000, PY: 1_800_000 },
            ]}
          />
        </Panel>
      </DashGrid>

      <Panel title="Revenue — 12 months, AC / FC vs PY" span2>
        {/* ScrollChart fills the wide panel on a laptop and keeps 760px,
            scrolling sideways on a phone instead of squashing 12 months. */}
        <ScrollChart height={250} minWidth={760}>
          {(w, h) => (
            <TrendChart
              comparison="PY"
              width={w}
              height={h}
              format={{ compact: true }}
              data={[
                { category: "Jan", AC: 2.1e6, PY: 1.95e6 },
                { category: "Feb", AC: 2.18e6, PY: 1.98e6 },
                { category: "Mar", AC: 2.42e6, PY: 2.2e6 },
                { category: "Apr", AC: 2.31e6, PY: 2.12e6 },
                { category: "May", AC: 2.49e6, PY: 2.2e6 },
                { category: "Jun", AC: 2.63e6, PY: 2.28e6 },
                { category: "Jul", AC: 2.55e6, PY: 2.24e6 },
                { category: "Aug", AC: 2.61e6, PY: 2.3e6 },
                { category: "Sep", AC: 2.74e6, PY: 2.36e6 },
                { category: "Oct", FC: 2.79e6, PY: 2.42e6 },
                { category: "Nov", FC: 2.88e6, PY: 2.5e6 },
                { category: "Dec", FC: 2.98e6, PY: 2.61e6 },
              ]}
            />
          )}
        </ScrollChart>
      </Panel>
    </Dashboard>
  );
}
