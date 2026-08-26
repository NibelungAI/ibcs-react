---
"ibcs-react": minor
---

New `checkIbcsProps(component, props)` lints the JSX authoring path — the way most apps actually write charts — against the same IBCS rules as `checkIbcs`. Component props are the config shapes minus the `type` discriminator, which the component name carries; the function maps the name back and runs the config checks, so `<VarianceColumnChart data={…} comparison="PY" />` is lintable in a unit test without restructuring into configs. Render-only props are ignored, lint-only declarations (`measureKind`) ride along, `KpiCard` props lint directly as a `KpiConfig`, the specialised variance charts lint as their linear family, and `checkIbcsProps("PieChart", …)` flags the pie. Unknown component names return an `input-shape` info naming the lintable components (`LintableComponentName` type exported).
