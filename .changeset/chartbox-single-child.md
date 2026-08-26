---
"ibcs-react": minor
---

`ChartBox`, `ScrollChart`, `ResponsiveChart` and `ChartFrame` accept a single chart element as their child — the resolved integer `width`/`height` are cloned onto it — so the everyday case reads `<ChartBox width={620} height={340}><VarianceColumnChart data={data} /></ChartBox>`. The render-prop form `{(w, h) => …}` keeps working unchanged for charts whose size props are named differently or that need the numbers directly (`ChartChildren` type exported).
