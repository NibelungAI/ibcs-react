"use client";

import {
  VarianceColumnChart,
  TrendChart,
  KpiCard,
  type ColumnDatum,
  type TrendDatum,
} from "ibcs-react";

// --- Inline sample data (scenario-keyed: AC / PY / PL / FC) ----------------

// Quarterly revenue: actual vs prior year, with plan riding along as a frame.
const quarterlyRevenue: ColumnDatum[] = [
  { category: "Q1", AC: 6_400_000, PY: 5_800_000, PL: 6_200_000 },
  { category: "Q2", AC: 7_100_000, PY: 6_300_000, PL: 6_900_000 },
  { category: "Q3", AC: 7_800_000, PY: 6_700_000, PL: 7_500_000 },
  { category: "Q4", AC: 8_800_000, PY: 6_800_000, PL: 7_900_000 },
];

// Monthly trend: actuals (AC) run out after Sep, then forecast (FC) carries the
// series to a full-year (FY) summary column. PY/PL ride along as reference lines.
const monthlyTrend: TrendDatum[] = [
  { category: "Jan", AC: 2_300_000, PY: 2_050_000, PL: 2_250_000 },
  { category: "Feb", AC: 2_100_000, PY: 1_980_000, PL: 2_200_000 },
  { category: "Mar", AC: 2_500_000, PY: 2_200_000, PL: 2_350_000 },
  { category: "Apr", AC: 2_450_000, PY: 2_180_000, PL: 2_400_000 },
  { category: "May", AC: 2_600_000, PY: 2_300_000, PL: 2_500_000 },
  { category: "Jun", AC: 2_750_000, PY: 2_400_000, PL: 2_600_000 },
  { category: "Jul", AC: 2_700_000, PY: 2_450_000, PL: 2_650_000 },
  { category: "Aug", AC: 2_900_000, PY: 2_500_000, PL: 2_750_000 },
  { category: "Sep", AC: 3_050_000, PY: 2_600_000, PL: 2_900_000 },
  // Forecast tail - no AC, carried by FC (drawn hatched).
  { category: "Oct", FC: 3_150_000, PY: 2_700_000, PL: 3_000_000 },
  { category: "Nov", FC: 3_250_000, PY: 2_800_000, PL: 3_100_000 },
  { category: "Dec", FC: 3_400_000, PY: 2_950_000, PL: 3_250_000 },
  // Full-year total, set off as a summary column.
  { category: "FY", AC: 32_800_000, PY: 29_110_000, PL: 31_950_000, summary: true },
];

const card = {
  background: "#fff",
  border: "1px solid #e6e8ec",
  borderRadius: 12,
  padding: 20,
};

export default function Demo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* KPI strip ---------------------------------------------------------- */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <KpiCard
          label="Revenue"
          values={{ AC: 30_100_000, PY: 25_600_000, PL: 28_500_000 }}
          comparisons={["PY", "PL"]}
          format={{ compact: true, decimals: 1, currency: "€" }}
          sparkline={[1.4e6, 1.55e6, 1.6e6, 1.5e6, 1.7e6, 1.75e6, 1.8e6]}
          appearance={{ border: true }}
        />
        <KpiCard
          label="Operating income"
          values={{ AC: 10_400_000, PY: 7_700_000, PL: 9_100_000 }}
          comparisons={["PY"]}
          format={{ compact: true, decimals: 1, currency: "€" }}
          sparkline={[0.7e6, 0.8e6, 0.9e6, 0.85e6, 1.0e6, 1.05e6, 1.1e6]}
          appearance={{ border: true }}
        />
        <KpiCard
          label="Operating expenses"
          values={{ AC: 10_000_000, PY: 9_200_000, PL: 10_000_000 }}
          comparisons={["PY"]}
          higherIsBetter={false}
          format={{ compact: true, decimals: 1, currency: "€" }}
          appearance={{ border: true }}
        />
      </section>

      {/* Variance column chart: AC vs PY with a Δ panel --------------------- */}
      <section style={card}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Revenue by quarter - AC vs PY</h2>
        <VarianceColumnChart
          data={quarterlyRevenue}
          comparison="PY"
          variance="abs"
          width={560}
          height={320}
          format={{ compact: true }}
          title="Quarterly revenue (€)"
        />
      </section>

      {/* Trend chart with a forecast tail ---------------------------------- */}
      <section style={card}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>
          Monthly trend - actual ▸ forecast ▸ FY total
        </h2>
        <TrendChart
          data={monthlyTrend}
          comparison="PY"
          variance="abs"
          width={720}
          height={360}
          format={{ compact: true }}
          title="Revenue trend (€)"
        />
      </section>
    </div>
  );
}
