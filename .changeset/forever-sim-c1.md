---
"ibcs-react": minor
---

Icons in row labels, and a histogram. Without the new props and data fields, every component renders as in 1.5.0, byte for byte.

- **Icons in row labels.** `DataTable` rows and `RankingVarianceChart` data take an `icon` - a `RowIcon` (`src`, `naturalSize`, and an optional `border` colour and `alt`) or several, drawn left to right as chips - and a `labelColor` for the label. An icon is drawn at the component's new `iconSize` (default 20; in `DataTable` from 8 to 28, in the ranking chart from 8 to its row height minus 4), but never above the image's own `naturalSize` nor 56 CSS px, so it is never upscaled. An icon is decorative unless it has an `alt`, which is read before the label. Rows without an icon, and the totals row, keep the slot's width, so the labels stay aligned; the ranking chart's label column grows by the slot, up to 40% of its width, and leaves out the chips that would cut a label under 24 px. `renderIcon(row, size)` puts your own element in the slot instead: HTML in `DataTable` (an icon that opens your own tooltip), svg in the ranking chart.
- **`HistogramChart`.** A distribution in classes of identical width (IBCS CH 1.3) on a horizontal value axis. Pass raw `values`, binned by the new `computeHistogram` in `ibcs-react/core` - the Freedman-Diaconis rule bounded to 20-60 classes (`binning`), counts summing to n, edges covering the smallest to the largest value - or an engine's own `bins` (a start, one width, the counts). The mean's interval (`mean`: the value, the half-width and its level, as you computed them; the chart never derives one) is drawn as a line with an error bar above the columns, and the spread of the values (`spread`; by default the middle half, from the first to the third quartile) as a band behind them, bracketed and captioned under the axis - two marks, two rows, two names, so they are never confused. Labels replace grid lines: every count above its column when all fit, else the tallest's; the edges at the two ends of the axis; n on the title line. The columns wear their `scenario`'s IBCS notation; numbers follow `format` (exact `fractionDigits`, `locale`); a screen-reader table lists every class with its count and share.
- **New words** in `IbcsLabels`, for the histogram: `count` ("Count"), `mean` ("Mean {value}"), `spread` ("Middle half {range}") and `sampleSize` ("n = {n}"). For TypeScript: a complete `IbcsLabels` object written out by hand needs these four words to compile; partial words (`IbcsLabelsOverride`, the `labels` props, `IbcsThemeProvider`, `mergeLabels`) and a dictionary spread from `defaultLabels` need nothing.

<!--
For the maintainer, before tagging 1.6.0 (merging the "Version Packages" PR): dispatch the Visual regression
workflow's `update-baselines` for the Linux baselines of the five new fixtures (HistogramChart, DataTable-icons,
RankingVarianceChart-icons, HistogramChart-mean-spread, HistogramChart-engine-bins), and review the new images.
Delete this comment when you do.
-->
