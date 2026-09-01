"use client";

import { useState, type CSSProperties } from "react";
import { VarianceColumnChart, oceanTokens } from "ibcs-react";
import { monthlyRevenueDistribution } from "@/lib/demo-data/budget-matrix";

/**
 * The matrix answers "what are the numbers"; this answers "how does the year
 * build up" - the same revenue, spread across 12 months, compared against
 * either Plan or Previous year. Clicking a column reports the selection.
 */
export function MonthlyDistribution() {
  const [base, setBase] = useState<"PL" | "PY">("PL");
  const [selected, setSelected] = useState<string | null>(null);
  const s = oceanTokens.scenario;
  const tab = (k: "PL" | "PY"): CSSProperties => ({
    padding: "5px 13px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${base === k ? oceanTokens.color.text : "#d8d7d1"}`,
    background: base === k ? oceanTokens.color.text : "#fff",
    color: base === k ? "#fff" : "#6b6a64",
    borderRadius: 6,
  });
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "#9a9992", marginRight: 2 }}>
          Compare each month&apos;s actual to:
        </span>
        <button type="button" style={tab("PL")} onClick={() => setBase("PL")}>
          Plan · PL
        </button>
        <button type="button" style={tab("PY")} onClick={() => setBase("PY")}>
          Previous year · PY
        </button>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            fontSize: 11.5,
            color: "#6b6a64",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{ width: 14, height: 14, background: s.AC.fill, borderRadius: 2 }}
              aria-hidden
            />{" "}
            AC
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {base === "PL" ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  background: "transparent",
                  border: `2px solid ${s.PL.stroke}`,
                  borderRadius: 2,
                }}
                aria-hidden
              />
            ) : (
              <span
                style={{ width: 14, height: 14, background: s.PY.fill, borderRadius: 2 }}
                aria-hidden
              />
            )}
            {base}
          </span>
        </span>
      </div>
      <VarianceColumnChart
        data={monthlyRevenueDistribution}
        comparison={base}
        title={
          base === "PL"
            ? "Revenue by month - Actual vs Plan"
            : "Revenue by month - Actual vs Previous year"
        }
        width={920}
        height={320}
        tokens={oceanTokens}
        format={{ compact: true }}
        onSelect={(sel) => setSelected(sel.datum?.category ?? null)}
      />
      <div style={{ fontSize: 12.5, color: "#6b6a64", marginTop: 8 }}>
        Selected month: <b>{selected ?? "none"}</b> - wire `onSelect` to filter the matrix above.
      </div>
    </div>
  );
}
