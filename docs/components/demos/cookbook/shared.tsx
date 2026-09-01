"use client";

import React from "react";
import { KpiCard, Sparkline } from "ibcs-react";

/** A row of KPI cards that wraps - the header strip of most cookbook recipes. */
export function KpiStrip({ items }: { items: React.ComponentProps<typeof KpiCard>[] }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {items.map((k, i) => (
        <div key={i} style={{ minWidth: 128, flex: "0 0 auto" }}>
          <KpiCard {...k} />
        </div>
      ))}
    </div>
  );
}

/** A labelled sparkline tile used in compact KPI strips. */
export function SparkTile({
  label,
  value,
  data,
  color,
}: {
  label: string;
  value: string;
  data: number[];
  color?: string;
}) {
  return (
    <div style={{ minWidth: 132, flex: "0 0 auto" }}>
      <div style={{ fontSize: 11.5, color: "#6b6a64" }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#2b2b29",
          margin: "1px 0 2px",
        }}
      >
        {value}
      </div>
      <Sparkline data={data} type="area" width={132} height={26} color={color} />
    </div>
  );
}
