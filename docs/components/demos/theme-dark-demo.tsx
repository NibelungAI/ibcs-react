"use client";

import { IbcsThemeProvider, KpiCard, StatementTable, darkTokens } from "ibcs-react";

const LINES = [
  {
    id: "rev-product",
    label: "Product revenue",
    flow: "add" as const,
    values: { AC: 17_200_000, PY: 16_100_000 },
  },
  {
    id: "rev-service",
    label: "Service and other revenue",
    flow: "add" as const,
    values: { AC: 12_900_000, PY: 9_500_000 },
  },
  {
    id: "revenue",
    label: "Revenue",
    flow: "result" as const,
    values: { AC: 30_100_000, PY: 25_600_000 },
  },
  {
    id: "cogs",
    label: "Cost of goods sold",
    flow: "subtract" as const,
    higherIsBetter: false,
    values: { AC: 9_700_000, PY: 8_400_000 },
  },
  {
    id: "gross-margin",
    label: "Gross margin",
    flow: "result" as const,
    values: { AC: 20_400_000, PY: 17_200_000 },
  },
];

/** The Dark preset applied through a provider - chrome, ink and bars included. */
export function ThemeDarkDemo() {
  return (
    <IbcsThemeProvider tokens={darkTokens}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 210 }}>
          <KpiCard
            label="Revenue"
            values={{ AC: 30_100_000, PY: 25_600_000 }}
            comparisons={["PY"]}
            format={{ compact: true, decimals: 1, currency: "€" }}
            animate={false}
          />
        </div>
        <div style={{ flex: "1 1 380px", minWidth: 320 }}>
          <StatementTable
            lines={LINES}
            waterfallWidth={180}
            format={{ compact: true, decimals: 1 }}
            animate={false}
          />
        </div>
      </div>
    </IbcsThemeProvider>
  );
}
