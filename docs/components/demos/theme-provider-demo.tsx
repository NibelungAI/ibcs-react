"use client";

import type { CSSProperties } from "react";
import { IbcsThemeProvider, KpiCard, VarianceColumnChart, tokenPresets } from "ibcs-react";

const DATA = [
  { category: "Q1", AC: 6.8, PY: 6.1 },
  { category: "Q2", AC: 7.3, PY: 6.4 },
  { category: "Q3", AC: 7.6, PY: 6.7 },
  { category: "Q4", AC: 8.4, PY: 6.4 },
];

const caption: CSSProperties = {
  fontSize: 11.5,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "#9a9992",
  marginBottom: 6,
};

/**
 * One provider (Ocean) themes the whole subtree; the second card overrides a
 * single token through its own `tokens` prop, which wins over the provider.
 */
export function ThemeProviderDemo() {
  return (
    <IbcsThemeProvider tokens={tokenPresets.Ocean}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 210 }}>
          <div style={caption}>From the provider</div>
          <KpiCard
            label="Revenue"
            values={{ AC: 30_100_000, PY: 25_600_000 }}
            comparisons={["PY"]}
            format={{ compact: true, decimals: 1, currency: "€" }}
            animate={false}
          />
        </div>
        <div style={{ width: 210 }}>
          <div style={caption}>Provider + own override</div>
          <KpiCard
            label="Revenue"
            values={{ AC: 30_100_000, PY: 25_600_000 }}
            comparisons={["PY"]}
            format={{ compact: true, decimals: 1, currency: "€" }}
            tokens={{ color: { good: "#7d3cc8" } }}
            animate={false}
          />
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 280 }}>
          <div style={caption}>Also from the provider</div>
          <VarianceColumnChart
            data={DATA}
            comparison="PY"
            width={300}
            height={210}
            format={{ compact: false, suffix: " m" }}
          />
        </div>
      </div>
    </IbcsThemeProvider>
  );
}
