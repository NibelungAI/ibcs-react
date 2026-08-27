---
"ibcs-react": minor
---

Charts glide between live-data ticks instead of re-entering from zero. The entrance animation used to replay on every data change, so a chart on a `useLiveData` feed (or any polling source) collapsed to the baseline and re-grew on each tick. Value-only updates now tween: every chart runs its rows through the new `useDataTween` hook — exported for custom charts — which interpolates numeric leaves from the currently displayed frame to the new values while the layout recomputes each frame, so bars move from their previous heights, scales stretch smoothly and variance pins slide. Retargeting mid-flight continues from what is on screen, reduced motion jumps straight to the target, and SSR still renders finished geometry. The entrance now replays only when the data genuinely changes shape — rows added or removed, categories renamed — which is also the new meaning of `useMountGrow`'s replay key: its structural signature ignores numbers.
