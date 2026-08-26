---
"ibcs-react": minor
---

Ratio KPIs speak percentage points. New `unit: "ratio"` on `KpiConfig`/`KpiCard` declares a percentage measure (margin, rate, share): the delta renders as `+0.6pp` and the relative delta is dropped — "+0.9%" beside "18.4%" invites reading a relative change as points, which ISO 24896 keeps apart for exactly this reason. Default (`"absolute"`) is unchanged. A new `ratio-units` lint rule (info) nudges KPIs formatted with `suffix: "%"` toward the declaration.
