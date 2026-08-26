"use client";

import { useState } from "react";
import { StatementTable } from "ibcs-react";
import { sampleStatement } from "@/lib/demo-data/sample-data";

const GROUPS = ["revenue", "opex"];

const btn: React.CSSProperties = {
  appearance: "none",
  fontFamily: "inherit",
  border: "1px solid #e0ded7",
  background: "#fff",
  color: "#3a3a36",
  borderRadius: 6,
  padding: "5px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * A controlled `StatementTable`: the collapsed set lives in the page, so the
 * table's own chevrons and the buttons above it edit the same state.
 */
export function ControlledStatementDemo() {
  const [collapsed, setCollapsed] = useState<string[]>(["opex"]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <button type="button" style={btn} onClick={() => setCollapsed([])}>
          Expand all
        </button>
        <button type="button" style={btn} onClick={() => setCollapsed(GROUPS)}>
          Collapse all
        </button>
        <button
          type="button"
          style={btn}
          onClick={() =>
            setCollapsed((prev) =>
              prev.includes("opex") ? prev.filter((id) => id !== "opex") : [...prev, "opex"],
            )
          }
        >
          Toggle operating expenses
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#9a9992", marginBottom: 10 }}>
        collapsed = [{collapsed.map((id) => `"${id}"`).join(", ")}]
      </div>
      <StatementTable
        lines={sampleStatement}
        waterfallWidth={220}
        format={{ compact: true, decimals: 1 }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
    </div>
  );
}
