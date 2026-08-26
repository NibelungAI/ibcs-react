"use client";

import {
  VarianceColumnChart,
  useLiveData,
  useCountUp,
  formatValue,
  type ColumnDatum,
} from "ibcs-react";
import { sampleQuarterlyRevenue } from "@/lib/demo-data/sample-data";

const btn = (on: boolean): React.CSSProperties => ({
  appearance: "none",
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 6,
  cursor: "pointer",
  border: `1px solid ${on ? "#2b2b29" : "#e0ded7"}`,
  background: on ? "#2b2b29" : "#fff",
  color: on ? "#fff" : "#3a3a36",
});

/** Jitter the base data — a stand-in for a real feed. */
const jitter = (): ColumnDatum[] =>
  sampleQuarterlyRevenue.map((d) => ({
    ...d,
    AC: Math.round(d.AC * (0.92 + Math.random() * 0.16)),
  }));

/**
 * `useLiveData` ticks a fresh dataset on an interval; `useCountUp` tweens the
 * headline total toward each new tick instead of snapping to it.
 */
export function LiveDataDemo() {
  const feed = useLiveData(jitter, { intervalMs: 2500, enabled: false });
  const total = feed.data.reduce((sum, d) => sum + d.AC, 0);
  const shown = useCountUp(total, { duration: 600 });

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          style={btn(feed.running)}
          onClick={() => (feed.running ? feed.stop() : feed.start())}
        >
          {feed.running ? "Streaming" : "Go live"}
        </button>
        <button type="button" style={btn(false)} onClick={feed.refresh}>
          Tick once
        </button>
        <span style={{ fontSize: 13, color: "#3a3a36" }}>
          Total AC{" "}
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatValue(shown, { compact: true, decimals: 1 })}
          </strong>
        </span>
      </div>
      <VarianceColumnChart
        data={feed.data}
        comparison="PY"
        width={420}
        height={240}
        format={{ compact: true }}
      />
    </div>
  );
}
