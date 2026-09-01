# research/ - IBCS reference farm & implementation plan

Local research workspace for studying the official IBCS / ISO 24896 material (and
other open references) so we can reproduce them faithfully as `react-ibcs`
components. **The engine and this plan are committed; the harvested data under
`research/data/` is gitignored and never pushed** (we don't redistribute IBCS's
copyrighted exhibits - we study them to build standard-compliant components).

> Ethical/legal note: research-only, rate-limited, local-only. Respect
> robots.txt and IBCS's terms; do not republish scraped images. The library ships
> only our own original SVG components.

## Layout

```
research/
  scrape.mjs        zero-dep Node crawler (committed)
  README.md         this plan (committed)
  data/             gitignored harvest:
    manifest.json     index of every page farmed
    index.md          (built by the farm agent) exhibit → component map
    oss-notes.md      (built by the OSS agent) borrowable ideas + licenses
    pages/<slug>/
      page.html         raw HTML
      page.md           extracted readable text
      meta.json         { url, title, images[], links[] }
      images/<file>     downloaded exhibit images
```

## Engine usage

```bash
node research/scrape.mjs                       # crawl default seeds (examples, chart/table templates)
node research/scrape.mjs --max 250 --depth 4   # widen the crawl
node research/scrape.mjs --no-crawl <url>       # one page only
node research/scrape.mjs --force <url>          # re-fetch (ignore cache)
node research/scrape.mjs <url> [<url> ...]       # custom seeds
```

Re-runnable & resumable: pages already in `manifest.json` are skipped unless
`--force`. Add seeds any time to farm more of the site.

### Known wrinkle - JS-rendered listings

The `resource_category/*` listing pages render their example tiles via JS, so the
static HTML only exposes the category nav. To enumerate the actual exhibits, use
the WordPress REST API the site is built on, e.g.:

```
https://www.ibcs.com/wp-json/wp/v2/resource?per_page=100&page=1
https://www.ibcs.com/wp-json/wp/v2/resource_category
```

Feed the resulting `/resource/...` permalinks back into `scrape.mjs` as seeds.

## Farm scope (priority order)

1. `resource_category/examples/` - the flagship example reports (the main page for this lib).
2. `resource_category/chart-templates/` (C01-C13) and `table-templates/` (T01-T04).
3. `resource_category/recommended-reading/` and `videos/` - metadata/text only.
4. Anything else under `/resource/` the crawl surfaces.

## Implementation roadmap (harvest → components)

Already reproduced (Zebra/IBCS exhibits the user sent + audit): variance columns,
PL hollow-frame notation, monthly distribution, integrated variance (vertical
3-tier), ranking variance (horizontal), variance area, pie multiples, small
multiples, waterfall, statement/matrix tables.

**Open gaps from the chart-template audit** (build next, data-driven by the farm):

- **C05 - columns + horizontal waterfall** (NO primitive yet): a horizontal
  waterfall bridging period variances beside grouped AC/PL columns. _New component._
- **C06 - bars + vertical waterfall** (composite): grouped structure bars next to a
  vertical waterfall of the absolute variances (sorted), + relative tier.
- **C03 / C04 - multi-tier grouped** : add a **grouped two-scenario** column/bar
  mode (AC + PL side-by-side) with stacked abs **and** rel variance tiers
  (IntegratedVarianceChart currently overlays the comparison rather than grouping).
- **C07 - line**: confirm IBCS forecast-tail styling (hatched/dashed) + PY/PL
  scenario lines with markers.
- **C09 - scattergram**: add hyperbolic iso-lines (constant product of axes).
- **C12 - vertical waterfall**: add the variant with abs+rel variance tiers beside
  the bridge.

Each harvested exhibit gets an entry in `data/index.md`: image → what it shows →
which `react-ibcs` component reproduces it (or the gap to close) → demo route.

## Extending later

Drop new seed URLs (other sites, more IBCS sections) into `scrape.mjs` or pass
them on the CLI. The same folder accumulates everything; `oss-notes.md` collects
ideas from other open-source libraries (with license provenance) we may borrow.
