---
"ibcs-react": minor
---

New `useStatementBridge(lines, comparison?, options?)` hook derives a `WaterfallChart`'s `data` + `comparisonData` from one statement, so the bridge joins the same `comparison` toggle as every other chart: `<WaterfallChart {...useStatementBridge(pnl, comparison)} />`. Every sibling chart takes a scenario key while the bridge needs the other scenario's contributions spelled out as a dataset — the hook absorbs that asymmetry, keeps both datasets structurally parallel (same lines, same skipping rules) and memoizes on the inputs. Also fixes the `statementToWaterfall` doc example, which showed a `comparison` prop the chart does not have (it is `comparisonData`).
