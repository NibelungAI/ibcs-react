# The page system

A4, 210 × 297 mm. Each page is a fixed-height `.page` box with `overflow:hidden`,
printed by Chromium with `@page{size:A4;margin:0}` and `preferCSSPageSize`. There
is no reflow across pages — you place content on a page and it either fits or is
silently cut, which is why `fit.mjs` exists.

## Geometry

| Region                       | Size                                                      |
| ---------------------------- | --------------------------------------------------------- |
| Page                         | 210 × 297 mm                                              |
| Side margins                 | 12 mm                                                     |
| Running header               | 16 mm, hairline rule under it                             |
| Body                         | top 16 mm, bottom 11 mm, 8 mm padding under the header    |
| Usable body height           | ~1020 px at 96 dpi (the cover has no header, so ~1123 px) |
| **Content width for charts** | **642 px**                                                |
| Widest fitting statement     | label + base values + **two** variance columns            |
| Folio                        | bottom right, bold page number + muted total              |

## Cover

One full-bleed ink band across the top 142 mm: mark and wordmark at its head,
eyebrow / title / year at its foot. Reporting facts sit on white below in a 2×2
grid with rules above each. No running header on the cover.

Keep the band a plain rectangle. Diagonal cuts, chamfers and stepped edges all
read as an imitation of some existing corporate identity, and a cover is the one
page a client will compare against reports they already know.

The title is a short editorial line about the year — "Precision under pressure" —
not a restatement of the filename. It is the only place in the document where a
sentence is allowed a point of view.

## Fitting

A `StatementTable` with `showBaseValues` and **three** variance columns renders
around 690–730 px and is clipped at any zoom worth using — and because the
overflow happens inside the SVG, the width check does not catch it. Two variance
columns is the working ceiling; put the third comparison on a key-figures
`DataTable` instead.

Run `node fit.mjs` before every render. It exits non-zero on overflow, so
`node build.mjs && node fit.mjs && node render.mjs` stops before printing a
clipped page — which is the point. It prints `avail` / `used` / `slack` per
page, and for any page that overflows it lists the height of each top-level block
so you can see what to cut. In order of preference:

1. Cut a paragraph. Report prose is almost always a sentence longer than it needs.
2. Drop detail rows by merging small lines ("Contract and other current assets").
3. Apply a `zoom` class to the wrapper of the tallest table. The kit defines
   every 2% from `.z98` to `.z70`; a class outside that range silently does
   nothing and the page gets no shorter. `zoom` changes layout height — a CSS
   `transform: scale()` looks the same on screen and buys you nothing.
4. Move a block to a page with slack.

Slack of 100–250 px is normal and looks composed. A page filled to the last pixel
looks anxious.

## Number units

Workbooks usually hold thousands. Multiply into real currency units before
rendering (`scaleUnits` in the kit) and let the library print `412.3M`. Then keep
the prose in the same units: "€412.3 million", never a mix of TEUR and €M in one
document.

Set the currency symbol through the format options — `fmt("£")` in the kit — or
every number in the report is a bare quantity. Compact mode trims trailing zeros,
so `59M` sits beside `65.8M`; that is the library's behaviour and not worth
fighting.

## Page menu

Include a page when the data supports it, and drop it when it does not. A report
padded with a page built from three numbers is worse than a shorter one.

| Page                        | Needs                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Cover                       | always                                                                                        |
| Contents + notation key     | when the report runs past ~4 pages                                                            |
| The company at a glance     | a profile and governance; ask before crawling for it                                          |
| Financial highlights        | key figures with a prior year; monthly series is a bonus                                      |
| Results of operations       | a P&L with at least two scenarios                                                             |
| Earnings bridge             | a P&L with any one comparison — a PY→AC bridge is often the best chart in a two-scenario pack |
| …with a plan-variance panel | additionally PL, passed as `comparisonData`                                                   |
| Segments and regions        | a segment or region split                                                                     |
| Financial position          | a balance sheet                                                                               |
| Cash flow and liquidity     | a cash flow statement                                                                         |
| Outlook                     | a forecast or an order book                                                                   |

Two scenarios and a single statement is a 4–5 page report. A full pack with
segments, monthly detail, budget and forecast supports 8–10. Say what you decided
and why in your summary, rather than silently padding or truncating.

## Typography

Inter throughout, inlined as base64 so nothing falls back silently, with
`font-feature-settings:"tnum"` so digits align in columns. Headings 21 pt / 800,
section headings 11.5 pt / 700, body 9.1 pt / 1.5, captions 7.6 pt. Uppercase
labels get letter-spacing; body text never does.

The running header carries the entity on the left and the current section on the
right, which is what a reader flipping through a printed pack is looking for.
