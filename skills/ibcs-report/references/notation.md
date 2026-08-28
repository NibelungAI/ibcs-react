# The notation rules that actually change a decision

IBCS (the basis of ISO 24896) is a notation standard for business reporting: the
point is that a shape means the same thing in every report, so a reader who has
learned it once reads any conforming report faster. Most of it the library
handles. These are the places where _your_ choices decide whether the report
conforms.

## Colour is spent on meaning, never on decoration

Scenarios are told apart by **fill**, not hue: actual solid dark, prior year
solid light, plan a hollow frame, forecast hatched. That leaves colour free to
carry one job — **green favourable, red unfavourable, for the business**. A cost
line that grew is red even though the number went up; revenue that fell is red
even though it is a revenue line.

Practical consequence: build the whole document in black, grey and white.
Brand colour belongs on the cover and the running header at most. When a page
has a colour on it, the reader should be able to assume something is better or
worse than plan. `assets/kit.mjs` `TOKENS` already encodes this.

## Cards and pies

`KpiCard` exists and is well made, but a row of bordered cards is chrome around
numbers that a table shows better, aligned, with a shared scale and a variance
bar. In a printed management report prefer a `DataTable` of key figures: it
aligns perfectly, carries ΔPY and ΔPL in the same row, and can hold a sparkline.
Cards earn their place on screens where a card is a tap target.

Pie charts are discouraged outright — angle is the hardest encoding to compare,
and the library's own `checkIbcs` flags them. Use `StructureChart`: ranked
horizontal bars with the share printed beside each one, which answers both
"how big" and "what share" without asking the reader to judge wedges.

## Scales

Two bars of the same length on the same page must be the same amount. Charts
sharing a page should share a scale unless there is a stated reason not to;
`SmallMultiples` has an explicit shared-scale option for exactly this. Never
solve a crowded chart by giving one series its own axis.

## Titles and structure

A chart title says **who, what, when** — "Revenue by month, group, FY 2025" — not
"Revenue chart". The linter flags bare-string titles for this reason. Put the
unit in the page subtitle once rather than repeating it on every axis.

## Deviations

Absolute deviations are bars, relative deviations (%) are pins (a line and a
dot). Show both when the reader needs magnitude _and_ proportion: a €200k miss
matters differently on a €2m line than on a €200m one. When one relative
deviation is an order of magnitude larger than the rest, clamp it so it draws as
an off-scale arrow rather than flattening every other pin.

## What to write next to the numbers

The notation shows _what_ moved. The prose has to say _why_, and it is the part a
reader remembers. Lead each commentary block with the finding, not the
restatement: "materials cost €7.0m more than budgeted, which is on its own the
reason EBIT missed plan" beats "cost of goods sold increased by 12.4%". If a
number in the chart is surprising, the paragraph beside it should explain it or
say plainly that it is unexplained.
