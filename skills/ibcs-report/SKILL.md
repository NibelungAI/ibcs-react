---
name: ibcs-report
description: Turn financial statements — a P&L, a balance sheet, a trial balance, a management pack in XLSX/CSV/PDF — into a print-ready A4 PDF management report whose charts and tables are real ibcs-react components in IBCS / ISO 24896 notation. Use this whenever someone hands over financial data and wants a report, board pack, management report, annual or quarterly report, investor update, or "make this look presentable"; also whenever ibcs-react, IBCS, ISO 24896, variance analysis, waterfall bridges, or actual-vs-budget reporting come up. Reach for it even when the person only says "make a PDF from these numbers" — a formatted statement is not the same thing as a report, and this builds the report.
license: MIT
metadata:
  author: NibelungAI
  version: "1.0.0"
---

# IBCS management report

Take a set of financial statements and produce a PDF that a board would accept:
a designed cover, contents, commentary that says what happened, and every chart
and table drawn with `ibcs-react` in the IBCS notation, where fill encodes the
scenario and colour is spent only on whether a number is better or worse than
its reference.

The deliverable is a PDF. The intermediate is a single HTML file of fixed-height
A4 pages that Chromium prints — so the whole report is one Node script you can
re-run, not a document you assemble by hand.

## Setup

```bash
node <skill>/scripts/setup.mjs report-build    # installs deps, copies the kit
cd report-build
```

(`scripts/setup.sh` is the same thing for bash-only environments.) If no
Chromium is found, setup fetches Playwright's own; `PLAYWRIGHT_CHROMIUM` can
point at an existing binary instead.

You now have `kit.mjs` (chrome, palette, page shell), `fit.mjs` and `render.mjs`.
Write `build.mjs` beside them. The kit is yours to edit — change the brand ink,
the cover, the CSS. The scenario tokens are the one part to leave alone.

## 1 · Read the data, all of it

Open every sheet before deciding anything. For XLSX use `openpyxl` twice —
`data_only=True` for values, the default pass for formulas — or read it with
pandas if you only need values. Note for each statement: which scenarios exist
(AC actual, PY prior year, PL budget, FC forecast), the units, the period, and
whether monthly or segment detail is present. Check that subtotals foot; if the
balance sheet does not balance, say so before building anything on top of it.

Do not start with the design. A report is only worth reading if the numbers were
understood first.

## 2 · Find the story before you place a single chart

Work out what actually happened this period — the two or three things a board
member needs to leave the room knowing. Compute the obvious ratios (margins,
growth, working capital days, leverage), compare actual against **both** prior
year and budget, and look for where those two disagree. A year can be up on last
year and badly behind plan at the same time; that tension is usually the report.

Then choose charts that carry that story. A waterfall bridge earns its page when
something moved a total; a trend chart earns its page when the shape over time
matters. Reaching for every component in the library produces a catalogue, not a
report.

## 3 · The company profile — ask first

If the source files or the conversation already describe the company, use that.
If they do not and the report wants a profile or governance section, **ask the
person for permission before searching the web**, and say what you intend to look
up. They may be working with confidential or pre-announcement figures where a
search is exactly the wrong move, and it is their call to make, not yours.

If permission is declined or the company is not findable, drop the profile page
rather than inventing one. Fabricated board members in a financial report is the
worst failure this skill can produce.

## 4 · Plan the pages against the data

Page count follows the data, not a template. Two scenarios and one statement is a
4–5 page report; a full pack with budget, forecast, monthly detail and segments
supports 8–10. `references/layout.md` has the page menu and what each page needs.
Tell the person what you included and what you left out for want of data.

## 5 · Build

`build.mjs` composes page HTML strings and writes `report.html`. The shape:

```js
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { StatementTable, WaterfallChart, TrendChart, DataTable } from "ibcs-react";
import {
  R,
  TOKENS,
  FMT,
  makePage,
  coverBody,
  contents,
  notationKey,
  lockup,
  css,
  documentHtml,
  scaleUnits,
  H2,
  H3,
  P,
  CAP,
} from "./kit.mjs";
import fs from "node:fs";

const h = React.createElement;
const INK = "#171B1F"; // brand ink; one colour, used sparingly
const TOTAL = 8;
const page = makePage({
  entity: "Acme Group AG",
  total: TOTAL,
  fallbackSection: "Annual Management Report 2025",
  ink: INK,
});

// Source workbook is in thousands — charts format compactly, so feed real units.
const pnl = scaleUnits(rawPnlLines);

const p1 = page(
  coverBody({
    lockupHtml: lockup({ name: "ACME", sub: "Group", scale: 1.25, light: true, ink: INK }),
    eyebrow: "Annual Management Report",
    title: "Growth on borrowed margin", // an editorial line about the year
    year: "2025",
    facts: [
      ["Reporting period", "1 January – 31 December 2025"],
      ["Reporting entity", "Acme Group AG, Vienna"],
      ["Presentation currency", "Euro (€), compact notation"],
      ["Status", "Unaudited management accounts"],
    ],
  }),
  { cover: true },
);

const p2 = page(
  `${H2("Contents")}
  ${contents([["Financial highlights", "Key figures and the revenue year", 3] /* … */])}
  ${notationKey()}
  <p class="basisline">Unaudited management accounts for the twelve months ended
  31 December 2025. <b>AC</b> actual · <b>PY</b> prior year · <b>PL</b> budget ·
  <b>FC</b> forecast. Amounts in euro, shown compactly.</p>`,
  { section: "Contents" },
);

const p3 = page(
  `${H2("Results of operations", "Consolidated income statement 2025 · amounts in euro")}
  <div class="table-wrap z90">${R(
    h(StatementTable, {
      lines: pnl,
      tokens: TOKENS,
      format: FMT,
      animate: false,
      tooltip: false,
      waterfallWidth: 250,
      labelMaxWidth: 212,
      varianceColumns: [
        { base: "PY", mode: "abs", mark: "bar" },
        { base: "PY", mode: "pct", mark: "pin" },
      ],
    }),
  )}</div>
  ${P(`Revenue grew €38.8 million (+10.4%) … `)}`,
  { section: "Results of operations" },
);

fs.writeFileSync(
  "report.html",
  documentHtml({
    title: "Acme Group AG — Annual Management Report 2025",
    css: css({ ink: INK }),
    pages: [p1, p2, p3 /* … */],
  }),
);
```

Charts are `renderToStaticMarkup` of a component with an explicit pixel size —
content width on the page is **642 px**. Pass `animate: false` and
`tooltip: false`, or the PDF captures a half-drawn chart; passing both to every
component is harmless, since React drops the ones that do not use them.

`references/components.md` is the component chooser plus the props that matter
and the library's current rough edges. Read it before writing the charts.
`references/example-build.mjs` is a complete worked `build.mjs` — a six-page
report over a P&L and a balance sheet — worth reading before writing your own.

## 6 · Fit, then render

```bash
node build.mjs && node fit.mjs && node render.mjs
```

`fit.mjs` measures each page. Pages are fixed-height boxes with `overflow:hidden`,
so anything too tall is silently cut — this catches it and shows which block is
the culprit. It exits non-zero on
overflow, so the chain above stops before printing a clipped page. Fix overflow by
cutting a paragraph, merging small detail rows, or putting a zoom class on the
tallest table — the kit defines every 2% from `.z98` to `.z70`, and a class
outside that range silently does nothing. (`zoom` shrinks layout height;
`transform: scale()` does not.) Then re-render.

Look at the result before you hand it over: `pdftoppm -png -r 82 report.pdf pg`
and read the pages as a reader would. Truncated labels, a chart whose bars all
vanish, a table running off the right edge, a cost variance that came out green,
a confident sentence about a fact you do not actually have — none of these show up
in the console, and all of them are cheap to fix at this point.

## 7 · Hand it over

Send the PDF. Say in two or three sentences what the numbers showed, which pages
you built and why, and anything you could not do — a missing statement, a
declined search, a subtotal that did not foot.

## The rules that decide whether it is right

**Polarity and sign.** Two failures here produce a report that says the opposite
of the truth, and both are easy to miss because the page still looks handsome:

- `higherIsBetter: false` on every cost, expense, tax and debt line.
- Costs entered as **positive magnitudes**, with `flow: "subtract"` carrying the
  sign. Source workbooks usually hold them as negatives; pass those through and
  every cost variance inverts, so an overrun draws green.

Check every line of the statement against both, and sanity-check the rendered
page: a year where costs rose should have red in the cost block.

**Units.** Convert thousands into real currency units before rendering and keep
the prose in the same units as the charts. A document that mixes TEUR and €M
loses the reader's trust in one paragraph.

**Colour.** Black, grey and white, with green and red reserved for favourable
and unfavourable. When something on a page is coloured, the reader should be able
to assume it is a deviation. Brand colour lives on the cover.

**No cards, no pies.** A row of bordered KPI cards is chrome around numbers that
a `DataTable` shows better — aligned, on a shared scale, with the variance bar in
the same row. Pie charts are discouraged by the standard and flagged by the
library's own linter; use `StructureChart`. `references/notation.md` explains why,
which is worth reading before you argue with a client about it.

**Commentary.** Every chart gets a paragraph that says what it means, leading
with the finding rather than restating the number. The notation shows what moved;
the prose is where the report earns its existence.

**No invented facts.** Every figure traces to the source data or to something the
person told you. Where a real report would carry a name, a date or a governance
detail you do not have, leave it out.

Watch the cover and the commentary in particular — they are where a plausible
flourish slips in unnoticed. "A record year", "the third consecutive year of
growth", "unaudited management accounts", a year-end date: each of those is a
factual claim, and a two-year comparative does not support any of them. The
example cover below is a _shape_, not content to copy; fill it only with what the
source states. Re-read the rendered pages for this specifically — invented detail
tends to survive drafting and die on the proofread.

## Reference files

- `references/components.md` — which component answers which question, the props
  that matter, and current library rough edges with workarounds.
- `references/example-build.mjs` — a complete worked build script: cover,
  contents, key figures, income statement, earnings bridge, balance sheet.
- `references/notation.md` — the IBCS rules that change a decision: colour,
  scales, cards and pies, titles, deviations.
- `references/layout.md` — page geometry, the cover, fitting, units, the page
  menu, typography.
