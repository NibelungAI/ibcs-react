"use client";

import { useState } from "react";
import { DataTable, type DataTableSort } from "ibcs-react";
import { regionRows, regionColumns } from "@/lib/demo-data/tables";

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

const SORTS: { label: string; sort: DataTableSort | null }[] = [
  { label: "Revenue desc", sort: { key: "rev", dir: "desc" } },
  { label: "Revenue asc", sort: { key: "rev", dir: "asc" } },
  { label: "ΔPY desc", sort: { key: "rev_d", dir: "desc" } },
  { label: "Unsorted", sort: null },
];

const same = (a: DataTableSort | null, b: DataTableSort | null) =>
  a === null || b === null ? a === b : a.key === b.key && a.dir === b.dir;

/**
 * A fully controlled `DataTable` sort: the parent owns the state, the table
 * only reports the next sort through `onSortChange`. Header clicks and the
 * buttons drive the same one value — which is what makes URL sync, persistence
 * or two tables kept in step possible.
 */
export function ControlledTableDemo() {
  const [sort, setSort] = useState<DataTableSort | null>({ key: "rev", dir: "desc" });

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {SORTS.map((s) => (
          <button
            key={s.label}
            type="button"
            style={btn(same(sort, s.sort))}
            onClick={() => setSort(s.sort)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#9a9992", marginBottom: 10 }}>
        sort = {sort ? `{ key: "${sort.key}", dir: "${sort.dir}" }` : "null"} — click a column
        header too; the state still lives here.
      </div>
      <DataTable
        rows={regionRows}
        columns={regionColumns}
        format={{ compact: true, decimals: 1 }}
        showTotals
        sort={sort}
        onSortChange={setSort}
        caption="Revenue and operating income by region, actual vs previous year"
      />
    </div>
  );
}
