/**
 * Browser download helpers. Kept out of `core` because they touch the DOM —
 * core stays framework- and environment-agnostic. Pair with `statementToCSV`
 * (from the core) to let a user save the resolved model.
 */

/** Trigger a client-side download of `content` as a file. No-op outside a browser. */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): void {
  if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next task, not synchronously: some engines abort a download
  // whose object URL disappears in the same tick as the click that started it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Download CSV text as a file. A UTF-8 BOM is prepended so Excel detects the
 * encoding and opens the file directly (μ, Δ, accented labels stay intact).
 */
export function downloadCSV(filename: string, csv: string): void {
  downloadTextFile(filename, "﻿" + csv, "text/csv;charset=utf-8");
}
