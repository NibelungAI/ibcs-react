"use client";

import { VarianceColumnChart, tokenPresets } from "ibcs-react";

const DATA = [
  { category: "Q1", AC: 6.8, PY: 6.1 },
  { category: "Q2", AC: 7.3, PY: 6.4 },
  { category: "Q3", AC: 7.6, PY: 6.7 },
  { category: "Q4", AC: 8.4, PY: 6.4 },
];

/**
 * All eight token presets, same data and same props — only `tokens` differs.
 * Each card paints itself with the preset's own `color.surface`, so the Dark
 * preset shows on the surface it was designed for.
 */
export function ThemePresetGallery() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: 14,
        width: "100%",
      }}
    >
      {Object.entries(tokenPresets).map(([name, theme]) => (
        <div
          key={name}
          style={{
            background: theme.color.surface,
            border: `1px solid ${theme.color.rowBorder}`,
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: theme.color.textMuted,
              marginBottom: 6,
            }}
          >
            {name}
          </div>
          <VarianceColumnChart
            data={DATA}
            comparison="PY"
            tokens={theme}
            width={250}
            height={180}
            format={{ compact: false, suffix: " m" }}
          />
        </div>
      ))}
    </div>
  );
}
