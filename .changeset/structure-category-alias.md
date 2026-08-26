---
"ibcs-react": minor
---

`StructureDatum` now keys the component name on `category` — the same key every other datum in the library uses — so one array can feed a `VarianceColumnChart` and a `StructureChart` without a renaming `.map()`. `label` (the only key before this release) is accepted as an alias permanently; when both are present, `category` wins. Resolved `StructureSegment`s keep exposing `label` (now also echoing `category` when provided), and `statementToStructure` emits both keys so adapter output reaches category charts unchanged.
