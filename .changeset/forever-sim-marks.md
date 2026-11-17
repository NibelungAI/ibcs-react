---
"ibcs-react": minor
---

Exact decimals, caller-given words, error bars, value bands and magnitude bars. Every addition is opt-in: without the new options, components render as in 1.4.

- **Exact decimals.** `format.fractionDigits` fixes the fraction digits of every value a component writes, trailing zeros kept, in the format's `locale` ("914,30" in `sr-Latn`). Rounding is `Intl.NumberFormat`'s (half away from zero, as written), and a value that rounds to zero is unsigned. Set it per component (`format`), per `DataTable` column (`column.format`) or per series (`LineChart`'s new `seriesFormat`). `SmallMultiples` takes a `format` for its screen-reader table.
- **Percentages, written one way.** `format.percentFractionDigits` (default 1) sets the digits of the percentages a component writes itself. `formatPercent` and `formatPercentPlain` take an options object (`fractionDigits`, `locale`, `signDisplay`, `notAvailable`) as their second argument; the numeric form is unchanged.
- **Missing numbers.** `format.notAvailable` replaces "n/a".
- **Intervals.** `formatInterval(value, halfWidth, format, signed?)` writes "910.79 ± 0.76" with the format's digits.
- **Caller-given words.** Every word a component writes itself (scenario codes in headers and line end labels, "Total", "vs", "pp", table column names, button and menu names, empty and error states) comes from `defaultLabels`. Replace it for a subtree with `IbcsThemeProvider`'s new `labels` prop or per component with `labels`; `mergeLabels`, `fillLabel` and `useIbcsLabels` serve custom charts. An empty scenario word drops the code from a line's end label. Charts take an `ariaLabel` that replaces their generated English description and their table caption.
- **Error bars.** New `ErrorBar` mark (horizontal or vertical, named by its interval) and `computeErrorBar` / `errorBarExtent` in `ibcs-react/core`. `RankingVarianceChart` data and `VarianceColumnChart` data take `acError`, `absError` and `pctError`; `DataTable` rows take `errors` keyed by column key.
- **Value bands.** `RankingVarianceChart`'s `bands` and a `DataTable` column's `bands` shade a value range across the rows, e.g. a group tied with the best; `resolveValueBand` in core.
- **Magnitude bars.** A `DataTable` value column with `mark: "bar"` (or `"pin"`) draws the value itself on a shared scale, in its scenario's IBCS notation.

One visible change for existing code: a format that sets `locale` now also localizes the components' percent labels, which always used a decimal point before ("+17,5%" in `sr-Latn`, "+17,5 %" in `de-DE`, where 1.4 wrote "+17.5%"). Formats without `locale`, `fractionDigits`, `percentFractionDigits` or `notAvailable` write exactly what 1.4 wrote.
