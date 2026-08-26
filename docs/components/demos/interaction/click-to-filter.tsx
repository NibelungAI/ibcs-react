"use client";

import {
  VarianceColumnChart,
  useChartSelection,
  formatValue,
  formatSigned,
  defaultTokens,
} from "ibcs-react";
import { sampleQuarterlyRevenue } from "@/lib/demo-data/sample-data";

const caption: React.CSSProperties = {
  fontSize: 12,
  color: "#6b6a64",
  marginTop: 6,
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  border: "1px solid #dde7cb",
  background: "#f4f7ee",
  color: "#3a3a36",
};

const btn: React.CSSProperties = {
  appearance: "none",
  border: "1px solid #d7d4cc",
  background: "#fff",
  color: "#2b2b29",
  borderRadius: 8,
  padding: "4px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * Click-to-filter: the chart's `onSelect` toggles a key in `useChartSelection`,
 * and a second view is driven entirely off that selection set.
 */
export function ClickToFilterDemo() {
  const sel = useChartSelection<string>();
  const data = sampleQuarterlyRevenue;
  const chosen = data.filter((d) => sel.isSelected(d.category));

  return (
    <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 360px", minWidth: 300 }}>
        <VarianceColumnChart
          data={data}
          comparison="PY"
          width={380}
          height={260}
          format={{ compact: true }}
          onSelect={(info) => sel.toggle(info.category)}
        />
        <div style={caption}>
          Click a quarter to select it (the cursor turns to a pointer); click again to deselect.
        </div>
      </div>

      <div style={{ flex: "1 1 240px", minWidth: 220 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: "#9a9992",
            }}
          >
            Selected {chosen.length ? `\u00b7 ${chosen.length}` : ""}
          </div>
          {chosen.length > 0 && (
            <button type="button" style={btn} onClick={sel.clear}>
              Clear
            </button>
          )}
        </div>

        {chosen.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9a9992" }}>
            Nothing selected yet — click a column.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {chosen.map((d) => {
              const delta = d.AC - (d.PY ?? d.AC);
              const good = delta >= 0; // revenue: up is favorable
              return (
                <div
                  key={d.category}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "6px 10px",
                    border: "1px solid #ece9e2",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#2b2b29" }}>{d.category}</span>
                  <span style={{ fontSize: 13, color: "#2b2b29" }}>
                    {formatValue(d.AC, { compact: true })}{" "}
                    <span
                      style={{
                        color: good ? defaultTokens.color.good : defaultTokens.color.bad,
                        fontWeight: 600,
                      }}
                    >
                      {formatSigned(delta, { compact: true })}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {chosen.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {chosen.map((d) => (
              <span key={d.category} style={chip}>
                {d.category}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
