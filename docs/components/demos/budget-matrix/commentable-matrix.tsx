"use client";

import { useState, type ReactNode } from "react";
import { MatrixTable, cellRefOf, oceanTokens } from "ibcs-react";
import {
  budgetColumns,
  budgetFormat,
  budgetRows,
  budgetValues,
} from "@/lib/demo-data/budget-matrix";

/**
 * A comment layer built on the matrix's per-cell hooks: a click flags the cell
 * (corner ribbon), and the `cellRef` is what a real sidebar would store and
 * scroll back to.
 */
export function CommentableMatrix() {
  const [commented, setCommented] = useState<Set<string>>(() => new Set());
  const [last, setLast] = useState<ReactNode>("nothing yet");
  return (
    <div>
      <MatrixTable
        rows={budgetRows}
        columns={budgetColumns}
        values={budgetValues}
        scenarios={["PL", "AC"]}
        showVariance
        tokens={oceanTokens}
        format={budgetFormat}
        defaultExpandedCols={["2024", "2024-Q1"]}
        onCellClick={(c) => {
          const ref = cellRefOf(c.rowId, c.periodId, c.scenario);
          setCommented((prev) => {
            const next = new Set(prev);
            if (next.has(ref)) next.delete(ref);
            else next.add(ref);
            return next;
          });
          setLast(
            <>
              <b>{c.rowLabel}</b> · {c.periodLabel} · {c.scenario} ={" "}
              {c.value == null ? "-" : c.value.toLocaleString()}{" "}
              <span style={{ color: "#9a9992", fontFamily: "ui-monospace, Menlo, monospace" }}>
                ({ref})
              </span>
            </>,
          );
        }}
        cellDecorations={(ref) => (commented.has(ref) ? { ribbon: true } : undefined)}
      />
      <div style={{ fontSize: 12.5, color: "#6b6a64", marginTop: 8 }}>
        <b>{commented.size}</b> flagged · last click: {last}
      </div>
    </div>
  );
}
