---
name: ibcs-notation
description: IBCS® / ISO 24896 notation rules for business and management reporting — scenario notation (AC actual, PY previous year, PL plan/budget, FC forecast), variance charts coloured by business impact rather than arithmetic sign, absolute vs percent deviation panels, zero-baseline and uniformly scaled axes, Who/What/When titles, waterfall/bridge conventions and the C01–C13 / T01–T04 templates. Use when building, reviewing or styling business reports, KPI dashboards, variance or waterfall charts, P&L and balance-sheet tables in any tool (React, D3, Vega, Excel, PowerPoint, matplotlib) so the output follows management-reporting conventions.
license: MIT
metadata:
  author: NibelungAI
  version: "1.0.0"
---

# IBCS notation (ISO 24896)

IBCS® is the notation for business communication standardised as **ISO 24896**.
It fixes _how_ business figures are drawn so a report is comparable across
periods, departments and companies — the way sheet music or circuit diagrams are
readable without a legend. Apply these rules with any charting tool.

Rule of thumb: **fill carries the scenario · colour carries favorability ·
length carries magnitude from zero · the title states facts, the message states
the point.**

## 1. Scenario notation

Four scenarios, distinguished by **fill, not hue** — so the report survives
greyscale printing and never confuses "what happened" with "what we planned":

| Key  | Scenario                     | Notation                                                                              |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `AC` | Actual                       | **solid dark** fill                                                                   |
| `PY` | Previous year (prior period) | **solid light grey** fill                                                             |
| `PL` | Plan / budget (`BU`)         | **outlined / hollow** — a frame with an opaque background, because it hasn't happened |
| `FC` | Forecast                     | **hatched** (diagonal lines) — expected, not yet real                                 |

- Never encode a scenario with a brand colour or a different chart type.
- Comparison columns **overlap** the actual (AC in front, PY behind) rather than
  standing side-by-side, so the deviation is visible as an offset.
- In a time series, the actual periods are solid and the forecast tail is
  hatched in the _same_ chart — one continuous story.

## 2. Variances are coloured by IMPACT, not by sign

A deviation is **green when it is good for the business** and **red when it is
bad**, whatever the arithmetic sign.

- Revenue **+**4.5M → green. Cost **+**1.3M → **red** (an overrun is bad even
  though the number is positive). Cost **−**0.4M → green.
- Every measure therefore needs a "higher is better" flag: `true` for revenue,
  margin, volume, satisfaction; **`false` for cost, expense, tax, headcount
  overrun, days sales outstanding, churn**.
- Signs are always printed: `+4.5M`, `−1.3M`, `+17.6%`. The sign tells the
  direction, the colour tells whether that direction is good. They are
  independent on purpose.
- Strict houses use black/red instead of green/red ("only bad stands out");
  colour-vision-safe palettes (teal/orange) are acceptable — but never drop the
  impact semantics or the sign.

## 3. Absolute vs relative deviations

Show the comparison, not just the value. A chart of AC alone has no yardstick.

- **Absolute deviations (currency units) → bars.** They live on the value scale,
  so lengths are comparable to the base chart.
- **Relative deviations (%) → pins** (a lollipop: thin line + dot) on their own
  percent scale, so a small swing on a small base can't masquerade as a big bar.
- Never mix absolute and percent marks on one axis. Stack them as separate
  panels beneath the value chart: values on top, Δ bars, Δ% pins.
- Clamp extreme percentages (e.g. |Δ%| ≥ 100) to an off-scale arrow and exclude
  them from the panel's scale, so one outlier doesn't flatten the rest.
- Percent deviations are meaningless on a base near zero or of opposite sign —
  print `n/a` instead of a giant number.

## 4. Axes, scales and outliers

- **Never truncate a value axis.** Bars and columns start at zero; the length of
  a bar must be proportional to its value.
- **Use one scale across charts that are compared.** Same unit + same visual
  size ⇒ same units-per-pixel, in the whole report (the IBCS _CHECK_ rule for
  small multiples and side-by-side panels). Report scale differences explicitly
  when they are unavoidable.
- Avoid gridlines and axis ticks where a data label does the job; label values
  directly on or beside the mark.
- **Outliers:** don't rescale the whole chart for one spike. Cut the bar with an
  outlier indicator (a break / arrow) and label its true value.
- Time runs **left→right** on columns (period comparison); structures/entities
  run **top→bottom** on horizontal bars (usually ranked by size).
- Keep the unit out of every data label — declare it once in the title.

## 5. Titles and messages

A descriptive title answers, kept apart from the interpretation:

- **Who** — entity / organisational unit ("ACME Group, EMEA").
- **What** — measure **and unit** ("Revenue — € thousands", "Headcount — FTE").
- **When** — period and comparison ("FY 2026 vs PY", "Jan–Nov 2026, AC/FC").

The **key message** ("Up 17.5% on prior year, led by Service revenue") is an
interpretation and belongs in its own line/field, visually distinct from the
title. Label scenarios explicitly (AC / PY / PL / FC) so a reader never guesses
which bar is which.

## 6. Waterfall (bridge) conventions

- A bridge walks a running total across labelled contributions: `add` steps move
  it up, `subtract` steps move it down.
- `result` checkpoints (Revenue, Gross margin, EBIT) are drawn as **full bars
  from the zero baseline** and emphasised; they don't move the running total.
- Connector lines tie each column to the next at the running-total level.
- Contribution columns are neutral-toned; favorability colouring belongs to the
  _variance_ panel, not to the bridge bars themselves.
- Keep the statement order (P&L order, or largest-contribution order for a
  variance bridge) — a bridge is a story, not a ranking.
- A bridge of _deviations_ (AC vs PL per driver, summing to the total variance)
  is the standard "why did we miss plan" chart.

## 7. Templates in brief

**Charts C01–C13:** C01/C02 stacked columns / bars · C03/C04 multi-tier grouped
columns / bars · C05 columns + horizontal waterfall · C06 bars + vertical
waterfall · C07 line · C08 area · C09 scattergram · C10 bubble · C11
calculation / ratio (DuPont) tree · C12 vertical waterfall(s) with variance ·
C13 small multiples (shared scale).

**Tables T01–T04:**

| Template | Layout                                                                            |
| -------- | --------------------------------------------------------------------------------- |
| T01      | Hierarchical table, variances as **numeric** columns (ΔPY, ΔPY%)                  |
| T02      | Hierarchical table, variances **embedded as bars/pins** in the cells              |
| T03      | P&L / financial statement with scenario **year columns** plus variances           |
| T04      | P&L with the **integrated variance** graphics (statement grid + Δ bars / Δ% pins) |

Table conventions: right-align numbers with tabular figures, indent the
hierarchy, bold the subtotals, and put a double rule above final results.

## 8. Forbidden or discouraged

Pie, donut, gauge, radar, funnel and 3-D charts — area and angle encodings
distort comparison. Also avoid: truncated axes, rainbow palettes for scenarios,
dual value axes without a stated scale, decorative shadows/gradients, and
"more decimals than the decision needs".

## Doing this in React

`ibcs-react` (`npm install ibcs-react`) implements all of the above by default:
scenario fills, impact colouring, signed labels, zero baselines, bar/pin
panels, bridges and the full C01–C13 / T01–T04 template set. Set
`higherIsBetter: false` on cost-like lines and the colouring follows. Lint any
chart / KPI / report config with the built-in notation linter:

```tsx
import { checkIbcs, IBCS_RULES } from "ibcs-react/core";

const findings = checkIbcs(config);
// [] when conforming; else { rule, severity: "error" | "warning" | "info", message, path? }
// rules include: linear-chart-type, structured-title, show-variance,
// cost-favorability, shared-scale, data-present
```

See the `ibcs-react` skill for the component API, and
<https://ibcs-react.com/docs/ibcs> (raw Markdown: append `.mdx`) for worked
examples.
