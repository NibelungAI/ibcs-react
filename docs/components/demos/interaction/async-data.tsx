"use client";

import {
  VarianceColumnChart,
  ChartState,
  useAsyncData,
  defaultTokens,
  type ColumnDatum,
} from "ibcs-react";
import { sampleQuarterlyRevenue } from "@/lib/demo-data/sample-data";

const btn: React.CSSProperties = {
  appearance: "none",
  border: "1px solid #d7d4cc",
  background: "#fff",
  color: "#2b2b29",
  borderRadius: 8,
  padding: "5px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * Stand-in for a real API call: resolves a jittered copy of the sample data
 * after a short delay and honours the AbortSignal, so a refetch or an unmount
 * mid-flight cancels cleanly - exactly like `fetch(url, { signal })`.
 */
function fakeFetchRevenue(signal?: AbortSignal): Promise<ColumnDatum[]> {
  return new Promise<ColumnDatum[]>((resolve, reject) => {
    const id = setTimeout(() => {
      resolve(
        sampleQuarterlyRevenue.map((d) => ({
          ...d,
          AC: Math.round(d.AC * (0.9 + Math.random() * 0.2)),
        })),
      );
    }, 900);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** `useAsyncData` + `ChartState`: first load, refresh, error and retry. */
export function AsyncDataDemo() {
  const { data, loading, refreshing, error, refetch, lastUpdated } = useAsyncData(
    (signal) => fakeFetchRevenue(signal),
    { keepPreviousData: true },
  );

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          style={{ ...btn, opacity: refreshing ? 0.6 : 1 }}
          onClick={refetch}
          disabled={loading}
        >
          {refreshing ? "Refreshing…" : "Refetch"}
        </button>
        <span style={{ fontSize: 12.5, color: "#6b6a64" }}>
          {loading
            ? "Loading…"
            : error
              ? `Error: ${error.message}`
              : lastUpdated
                ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
                : ""}
        </span>
        {refreshing && (
          <span style={{ fontSize: 12, color: defaultTokens.color.good, fontWeight: 600 }}>
            live
          </span>
        )}
      </div>

      <div style={{ minHeight: 260, position: "relative" }}>
        <ChartState
          loading={loading}
          error={error}
          empty={!loading && !(data && data.length)}
          height={260}
          onRetry={refetch}
        >
          <div style={{ opacity: refreshing ? 0.55 : 1, transition: "opacity .2s" }}>
            <VarianceColumnChart
              data={data ?? []}
              comparison="PY"
              width={420}
              height={260}
              format={{ compact: true }}
            />
          </div>
        </ChartState>
      </div>
    </div>
  );
}
