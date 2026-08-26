"use client";

import type { CSSProperties } from "react";
import { IBCS_RULES } from "ibcs-react";

const SEVERITY_COLOR: Record<string, string> = {
  error: "#c0392b",
  warning: "#c98a1e",
  info: "#9a9992",
};

const th: CSSProperties = {
  padding: "6px 12px 8px",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  textAlign: "left",
  color: "#6b6a64",
};
const td: CSSProperties = { padding: "8px 12px", color: "#2b2b29", verticalAlign: "top" };

function SeverityPill({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] ?? "#9a9992";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}1a`,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {severity}
    </span>
  );
}

/** The linter's rule catalog, rendered live from the library's `IBCS_RULES`. */
export function IbcsRulesTable() {
  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 540, fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #2b2b29" }}>
            <th style={th}>Rule id</th>
            <th style={th}>Severity</th>
            <th style={th}>What it checks</th>
          </tr>
        </thead>
        <tbody>
          {IBCS_RULES.map((rule) => (
            <tr key={rule.id} style={{ borderBottom: "1px solid #ece9e2" }}>
              <td
                style={{
                  ...td,
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {rule.id}
              </td>
              <td style={td}>
                <SeverityPill severity={rule.severity} />
              </td>
              <td style={td}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{rule.title}</div>
                <div style={{ color: "#5a5a54", lineHeight: 1.5 }}>{rule.doc}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
