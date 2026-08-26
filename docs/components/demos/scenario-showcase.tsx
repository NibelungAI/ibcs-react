"use client";

import { useState, type CSSProperties } from "react";
import { VarianceColumnChart, defaultTokens } from "ibcs-react";

const DATA = [
  { category: "Q1", AC: 6_800_000, PY: 6_100_000, PL: 6_500_000 },
  { category: "Q2", AC: 7_300_000, PY: 6_400_000, PL: 7_000_000 },
  { category: "Q3", AC: 7_600_000, PY: 6_700_000, PL: 7_400_000 },
  { category: "Q4", AC: 8_400_000, PY: 6_400_000, PL: 7_600_000 },
];

/**
 * Flip the comparison base between PL and PY: the hollow plan frames appear
 * and the variance panel changes meaning, with the data untouched.
 */
export function ScenarioShowcase() {
  const [base, setBase] = useState<"PL" | "PY">("PL");
  const button = (key: "PL" | "PY"): CSSProperties => ({
    padding: "5px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${base === key ? defaultTokens.color.text : "#d8d7d1"}`,
    background: base === key ? defaultTokens.color.text : "#fff",
    color: base === key ? "#fff" : defaultTokens.color.textMuted,
    borderRadius: 6,
  });

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#9a9992", marginRight: 4 }}>Compare actuals to:</span>
        <button type="button" style={button("PL")} onClick={() => setBase("PL")}>
          Plan · PL
        </button>
        <button type="button" style={button("PY")} onClick={() => setBase("PY")}>
          Previous year · PY
        </button>
      </div>
      <VarianceColumnChart
        data={DATA}
        comparison={base}
        title={base === "PL" ? "Revenue — Actual vs Plan" : "Revenue — Actual vs Previous year"}
        width={520}
        height={300}
        format={{ compact: true, currency: "€" }}
      />
    </div>
  );
}
