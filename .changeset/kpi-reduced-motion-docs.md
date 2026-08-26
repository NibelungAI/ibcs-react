---
"ibcs-react": patch
---

Document that `KpiCard`'s default count-up already respects `prefers-reduced-motion` (the final value renders immediately, with no frame loop) and that SSR always emits the finished figure — the `animate` prop JSDoc and docs never said so. Behavior is unchanged; a regression test now pins it down.
