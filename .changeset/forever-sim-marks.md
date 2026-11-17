---
"ibcs-react": minor
---

Exact decimals, caller-given words, error bars, value bands and magnitude bars. A component whose `format` sets none of `locale`, `fractionDigits`, `percentFractionDigits` and `notAvailable`, and which gets no `labels`, renders as in 1.4; a format that already sets `locale` changes the percent labels (below).

- **Exact decimals.** `format.fractionDigits` fixes the fraction digits of every value a component writes, trailing zeros kept, in the format's `locale` ("914,30" in `sr-Latn`). Rounding is half away from zero, written by `Intl.NumberFormat` after rounding the number to 15 significant digits when its written digits fit in 14 (1.005 → "1.01"; `0.145 * 100` → "15" at 0 digits, where `Intl` alone writes "14"); a value with more written digits is written as `Intl` writes the double; a value that rounds to zero is unsigned, and a compact value that rounds up to 1,000 of its unit moves to the next one (999.996 → "1.00K"). Set it per component (`format`), per `DataTable` column (`column.format`, which replaces the table's format, as in 1.4) or per series (`LineChart`'s new `seriesFormat`, merged over `format`). `SmallMultiples` takes a `format` for its screen-reader table.
- **Percentages, written one way.** `format.percentFractionDigits` sets the digits of the percentages a component writes itself: default 1, except `ComparisonTable`'s Δ% and `StructureChart`'s shares (0) and `PieChart`'s centre share (1 for a share above 0 and under 10 %, else 0). `formatPercent` and `formatPercentPlain` take an options object (`fractionDigits`, `locale`, `signDisplay`, `notAvailable`) as their second argument, written with Intl's percent style, which scales by 100 in decimal (0.0045 → "+0.5%"); the numeric form is unchanged.
- **Missing numbers.** `format.notAvailable` replaces "n/a".
- **Intervals.** `formatInterval(value, halfWidth, format, signed?)` writes "910.79 ± 0.76". A positive half-width is never written as zero (within Intl's 20 fraction digits): with `fractionDigits` it takes at least the digits of its first significant figure ("914.30 ± 0.004") and, in compact mode, the value's unit ("12.35K ± 0.23K"); without, both numbers are written in full at two significant figures of the half-width ("914.30 ± 0.47").
- **Caller-given words.** Every word a component writes itself (scenario codes in headers and line end labels, "Total", "vs", "pp", table column names, button and menu names, empty and error states) comes from `defaultLabels`. Replace it for a subtree with `IbcsThemeProvider`'s new `labels` prop or per component with `labels`; `mergeLabels`, `fillLabel` and `useIbcsLabels` serve custom charts. The variance headers are templates (`delta` "Δ{base}", `deltaPct` "Δ{base}%"), and so is a line's end label (`endLabel` "{name} {value}"; `"{value}"` drops the code). A header never goes blank: an empty scenario word falls back to the scenario's `scenarioTitle`. Charts take an `ariaLabel` that replaces their generated English description and captions their screen-reader table; with `onSelect` the svg is a container of named marks and takes no name, so `ariaLabel` then names the table alone.
- **Error bars.** New `ErrorBar` mark (horizontal or vertical, with its interval as accessible text and tooltip) and `computeErrorBar` / `errorBarExtent` in `ibcs-react/core`. `RankingVarianceChart` data and `VarianceColumnChart` data take `acError`, `absError` and `pctError`; `DataTable` rows take `errors` keyed by column key. With `acError`, the ranking chart's AC labels get a gutter of their own, past the whiskers.
- **Value bands.** `RankingVarianceChart`'s `bands` and a `DataTable` column's `bands` shade a value range across the rows, e.g. a group tied with the best, and name it in the screen-reader caption; `resolveValueBand` in core.
- **Magnitude bars.** A `DataTable` value column with `mark: "bar"` (or `"pin"`) draws the value itself on a scale shared by the detail rows, in its scenario's IBCS notation; group rows and the totals row keep the plain number.

Changes for existing code: a format that sets `locale` - in any locale, `en-US` included - or `fractionDigits`, `percentFractionDigits` or `notAvailable` now writes the components' percent labels with Intl's percent style. Against 1.4 that changes four things:

- the locale's separators and percent sign: "+17,5%" in `sr-Latn`, "+17,5 %" in `de-DE` (1.4: "+17.5%");
- a value that rounds to zero is unsigned: "0.0%" (1.4: "+0.0%"), and `StatementTable`'s Δ% cell "0.0" (1.4: "+0.0");
- ties round half up as the number reads: 1.15 % → "+1.2%" (1.4: "+1.1%");
- 1,000 % and more are grouped: "+1,727.9%" (1.4: "+1727.9%").

A format that sets none of the four writes exactly what 1.4 wrote.

<!--
For the maintainer, before tagging 1.5.0 (merging the "Version Packages" PR): dispatch the Visual regression
workflow's `update-baselines` for the Linux baselines - five new fixtures (ErrorBar, VarianceColumnChart-errors,
RankingVarianceChart-errors-band, DataTable-magnitude-bars, DataTable-errors-band) and the two that already fail on
main (ConformanceReport, Report) - and review the new images. Delete this comment when you do.
-->
