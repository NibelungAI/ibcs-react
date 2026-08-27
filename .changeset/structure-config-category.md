---
"ibcs-react": patch
---

Config-driven structure charts accept `category`-keyed rows. `StructureDatum` made `category` the preferred name key (with `label` as a permanent alias), and the chart resolves it — but `validateChartConfig` still demanded `label`, so the same data a mounted `<StructureChart>` rendered fine failed inside `ConfiguredChart` and `Report` with "data[0].label must be a string." The validator now applies the datum contract (`category` preferred, `label` accepted, `category` wins when both are present) and its error speaks the preferred vocabulary: `data[0].category must be a string.`
