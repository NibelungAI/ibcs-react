---
"ibcs-react": patch
---

`checkIbcs` chart-type errors now speak the API's vocabulary. An unknown `type` gets a did-you-mean (`"variance-column"` → `did you mean "varianceColumn"?`, typos within edit distance 2 are corrected) plus the list of valid `CHART_TYPES` values; a known non-linear type (pie, gauge, radar, …) keeps the IBCS explanation but lists the real alternatives instead of conceptual names like "column" and "bar" that the config vocabulary does not accept; a missing `type` gets its own message. All three variants stay under the `linear-chart-type` rule id.
