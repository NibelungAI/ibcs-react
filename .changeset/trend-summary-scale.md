---
"ibcs-react": patch
---

`TrendChart`'s documented "year + total" layout is actually usable now. A `summary` period used to affect styling only (divider + emphasis colour) while its value still defined the shared scale — so a 30M full-year total crushed twelve ~2.5M months to slivers ~8% of the plot. Summary periods are now excluded from the period domain and the variance half-scale; a summary that exceeds the resulting domain is drawn capped with a marked scale break (the classic slanted cut) and its value label, in both the column and the variance panel. Summaries in the same range as the periods (an average, say) share the scale unchanged. The PY/PL reference lines also stop before summary periods — a total is not a point in the time series. `computeTrend` gains an `offScale` flag on cells; `TrendLayout` domains now describe the periods alone.
