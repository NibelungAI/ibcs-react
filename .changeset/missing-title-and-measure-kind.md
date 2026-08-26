---
"ibcs-react": minor
---

`checkIbcs` no longer rewards deleting the title, and cost detection no longer hangs off the title text alone.

- A chart or report with **no** title now emits a `structured-title` warning (ISO 24896 SAY requires a Who/What/When title) — previously a bare-string title warned while omitting the title passed clean, so the linter incentivised removing it. A chart block inside a report is satisfied by either its own title or the block's.
- The `cost-favorability` heuristic now also reads **structured** titles (the recommended form used to bypass it) and the hosting block's title.
- New optional `measureKind?: "cost" | "revenue"` on chart and KPI configs declares what the measure is: `"cost"` makes the linter insist on `higherIsBetter: false` regardless of wording, `"revenue"` silences the heuristic for measures that merely sound like costs. Rendering is unaffected — favorability still follows `higherIsBetter`.

If you lint configs in CI, previously-clean untitled configs will now report a warning (errors are unchanged).
