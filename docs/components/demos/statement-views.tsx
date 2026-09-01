"use client";

import {
  StatementTable,
  WaterfallChart,
  statementToWaterfall,
  type StatementLine,
} from "ibcs-react";

/** ONE authored data set - every view below is derived from it. */
const LINES: StatementLine[] = [
  {
    id: "rev-product",
    label: "Product revenue",
    flow: "add",
    values: { AC: 17_200_000, PY: 16_100_000 },
  },
  {
    id: "rev-service",
    label: "Service revenue",
    flow: "add",
    values: { AC: 12_900_000, PY: 9_500_000 },
  },
  { id: "revenue", label: "Revenue", flow: "result", values: { AC: 30_100_000, PY: 25_600_000 } },
  {
    id: "cogs",
    label: "Cost of goods sold",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 9_700_000, PY: 8_400_000 },
  },
  {
    id: "gross-margin",
    label: "Gross margin",
    flow: "result",
    values: { AC: 20_400_000, PY: 17_200_000 },
  },
];

const caption = {
  fontSize: 11.5,
  textTransform: "uppercase" as const,
  letterSpacing: 0.6,
  color: "#9a9992",
  marginBottom: 6,
};

/**
 * The statement table reads the model directly; the bridge is projected from
 * the same array with `statementToWaterfall` - twice, once per scenario, so
 * the AC bridge can be compared against the PY one.
 */
export function StatementViews() {
  const acBridge = statementToWaterfall(LINES);
  const pyBridge = statementToWaterfall(LINES, "PY");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
      <div>
        <div style={caption}>View 1 · StatementTable (the model, unchanged)</div>
        <StatementTable
          lines={LINES}
          waterfallWidth={200}
          format={{ compact: true, decimals: 1 }}
          animate={false}
        />
      </div>
      <div>
        <div style={caption}>View 2 · WaterfallChart via statementToWaterfall</div>
        <WaterfallChart
          data={acBridge}
          comparisonData={pyBridge}
          title="Revenue to gross margin - AC, Δ vs PY"
          width={560}
          height={320}
          format={{ compact: true, decimals: 1, currency: "€" }}
        />
      </div>
    </div>
  );
}
