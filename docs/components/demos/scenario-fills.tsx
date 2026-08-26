"use client";

import type { CSSProperties } from "react";
import { defaultTokens } from "ibcs-react";

const swatch: CSSProperties = { width: 30, height: 30, borderRadius: 3, flex: "0 0 auto" };

/** The four scenario fills of `defaultTokens`, drawn as swatches. */
export function ScenarioFills() {
  const s = defaultTokens.scenario;
  const items = [
    {
      key: "AC",
      label: "AC · Actual",
      sub: "solid, dark — this is real",
      style: { background: s.AC.fill } as CSSProperties,
    },
    {
      key: "PY",
      label: "PY · Previous year",
      sub: "solid grey — the past",
      style: { background: s.PY.fill } as CSSProperties,
    },
    {
      key: "PL",
      label: "PL · Plan / budget",
      sub: "outline frame — not real yet",
      style: {
        background: "transparent",
        border: `2px solid ${s.PL.stroke}`,
      } as CSSProperties,
    },
    {
      key: "FC",
      label: "FC · Forecast",
      sub: "hatched — expected",
      style: {
        backgroundImage: `repeating-linear-gradient(45deg, ${s.FC.stroke} 0 2px, transparent 2px 5px)`,
        border: `1px solid ${s.FC.stroke}`,
      } as CSSProperties,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 14,
        width: "100%",
      }}
    >
      {items.map((item) => (
        <div key={item.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ ...swatch, ...item.style }} aria-hidden />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: defaultTokens.color.text }}>
              {item.label}
            </div>
            <div style={{ fontSize: 12, color: defaultTokens.color.textMuted }}>{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
