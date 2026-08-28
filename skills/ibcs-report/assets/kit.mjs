/**
 * ibcs-report kit — the print chrome, palette and page shell for an A4
 * management report whose charts and tables are ibcs-react components.
 *
 * Everything here is meant to be edited. The defaults encode a design that has
 * been through review; change the brand ink, the cover copy and the section
 * list per client, and leave the notation tokens alone unless the client has a
 * house palette that still keeps colour for deviation only.
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { greenRedTokens, mergeTokens } from "ibcs-react";

export const R = (el) => renderToStaticMarkup(el);

/* ------------------------------------------------------------------ type */
/** Inline Inter as base64 woff2 so the PDF never falls back silently. */
export function fontFaces(dir = "node_modules/@fontsource/inter/files", weights = [400, 500, 600, 700, 800]) {
  return weights.map((w) => {
    const b64 = fs.readFileSync(path.join(dir, `inter-latin-${w}-normal.woff2`)).toString("base64");
    return `@font-face{font-family:Inter;font-style:normal;font-weight:${w};font-display:block;` +
           `src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
  }).join("\n");
}

/* ---------------------------------------------------------------- colour */
/**
 * IBCS notation: scenarios are told apart by FILL, not by hue, so the whole
 * document is black and grey and the only saturated colour on the page is a
 * deviation that is better or worse than its reference. That contrast is what
 * makes a variance readable at a glance.
 */
export const TOKENS = mergeTokens({
  font: { family: "Inter, system-ui, sans-serif" },
  color: {
    neutral: "#3C4248", total: "#171B1F",
    good: "#178236", bad: "#C41616", zero: "#9AA0A6",
    axis: "#B7BDC3", gridline: "#E9ECEE", rowBorder: "#E2E5E8",
    text: "#171B1F", textMuted: "#6E757C", onFill: "#FFFFFF",
  },
  scenario: {
    AC: { fill: "#1D2226", stroke: "#1D2226", variant: "solid" },  // actual: solid black
    PY: { fill: "#B0B6BC", stroke: "#B0B6BC", variant: "solid" },  // prior year: solid grey
    PL: { fill: "transparent", stroke: "#1D2226", variant: "frame" }, // budget: hollow
    FC: { fill: "transparent", stroke: "#1D2226", variant: "hatch" }, // forecast: hatched
  },
}, greenRedTokens);

/**
 * Compact formatting. Feed components REAL currency units and let the library
 * print "412.3M". `currency` puts a symbol in front — set it per client
 * (`fmt("£")`), because a report whose numbers carry no unit is unreadable.
 * Compact mode trims trailing zeros, so 59,000,000 prints "59M" beside
 * "65.8M"; that is the library's behaviour, not a bug to chase.
 */
export const fmt = (currency, decimals = 1) => ({ compact: true, decimals, locale: "en-US",
  ...(currency ? { currency } : {}) });
export const FMT = fmt();

/* -------------------------------------------------------------- identity */
/**
 * A generated mark keeps the report looking like the client's document rather
 * than a template. Chamfer one corner and set the initial inside — legible at
 * 20px in the running header and at 40px on the cover.
 */
export function mark({ size = 26, fg = "#fff", bg = "#171B1F", glyph = "M8.6 8 L16 22.6 L23.4 8" } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M4 0h24a4 4 0 0 1 4 4v20l-8 8H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z" fill="${bg}"/>
  <path d="${glyph}" fill="none" stroke="${fg}" stroke-width="3.6"/>
</svg>`;
}

export function lockup({ name, sub, scale = 1, light = false, ink = "#171B1F", glyph } = {}) {
  return `<div class="lockup${light ? " light" : ""}" style="--s:${scale}">
  ${mark({ size: 38 * scale, fg: light ? ink : "#fff", bg: light ? "#fff" : ink, glyph })}
  <div><b>${name}</b><span>${sub}</span></div>
</div>`;
}

/* ------------------------------------------------------------ page shell */
/**
 * Returns a `page()` that stamps the running header, the body and the folio.
 * Pass the total page count up front so the folio reads "4/8" from page one.
 */
export function makePage({ entity, fallbackSection, total, ink = "#171B1F", glyph }) {
  let n = 0;
  return function page(inner, { cover = false, section = "" } = {}) {
    n += 1;
    return `<section class="page${cover ? " cover" : ""}" data-page="${n}">
  <header class="hdr">
    <div class="hdr-l">${mark({ size: 20, bg: ink, glyph })}<span>${entity}</span></div>
    <div class="hdr-r">${section || fallbackSection}</div>
  </header>
  <div class="body"><div class="flow">${inner}</div></div>
  <footer class="ftr"><b>${n}</b><i>/${total}</i></footer>
</section>`;
  };
}

/* small content helpers, so a build script reads like an outline */
export const H2 = (t, sub) => `<h2>${t}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}`;
export const H3 = (t) => `<h3>${t}</h3>`;
export const P = (t) => `<p>${t}</p>`;
export const CAP = (t) => `<p class="cap">${t}</p>`;

/**
 * The cover is a single full-bleed ink band across the top of the page with
 * the mark at its head and the title at its foot, then the reporting facts on
 * white below. Deliberately geometry-free: cut corners, diagonals and stepped
 * edges all read as somebody else's brand.
 */
export function coverBody({ lockupHtml, eyebrow, title, year, facts }) {
  return `<div class="cover-band">
  <div class="cover-top">${lockupHtml}</div>
  <div class="cover-bottom">
    <div class="cover-eyebrow">${eyebrow}</div>
    <div class="cover-title">${title}</div>
    <div class="cover-year">${year}</div>
  </div>
</div>
<div class="cover-meta">
  ${facts.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("\n  ")}
</div>`;
}

/** Contents list. `rows` are [title, subtitle, pageNumber]. */
export function contents(rows) {
  return `<ol class="toc">
  ${rows.map(([t, s, p]) => `<li><span class="t">${t}</span><span class="dots"></span><span class="n">${p}</span><em>${s}</em></li>`).join("\n  ")}
</ol>`;
}

/**
 * A four-line notation key. Readers need to know that fill encodes scenario
 * and colour encodes favourability; they do not need a lecture, and a legend
 * that fills half the page reads as padding.
 */
export function notationKey({ scenarios = ["AC", "PY", "PL", "FC"], marks = true } = {}) {
  const sw = (inner) => `<svg width="38" height="28" viewBox="0 0 38 28" style="flex:none">${inner}</svg>`;
  const has = (k) => scenarios.includes(k);
  const rows = [];
  if (has("AC") || has("PY")) rows.push(`<div>${sw('<rect x="0" y="4" width="16" height="20" fill="#1D2226"/><rect x="20" y="8" width="16" height="16" fill="#B0B6BC"/>')}
      <span><b>AC · PY</b> actual solid black, prior year solid grey</span></div>`);
  if (has("PL") || has("FC")) rows.push(`<div>${sw('<defs><pattern id="hx" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="#1D2226"/></pattern></defs><rect x="0" y="4" width="16" height="20" fill="#fff" stroke="#1D2226" stroke-width="1.4"/><rect x="20" y="4" width="16" height="20" fill="url(#hx)"/>')}
      <span><b>PL · FC</b> budget hollow, forecast hatched</span></div>`);
  rows.push(`<div>${sw('<rect x="0" y="10" width="18" height="9" fill="#178236"/><rect x="22" y="10" width="14" height="9" fill="#C41616"/>')}
      <span><b>Deviation</b> green favourable, red unfavourable</span></div>`);
  if (marks) rows.push(`<div>${sw('<rect x="0" y="5" width="14" height="7" fill="#1D2226"/><line x1="0" y1="21" x2="28" y2="21" stroke="#1D2226" stroke-width="1.4"/><circle cx="31" cy="21" r="4" fill="#1D2226"/>')}
      <span><b>Bars · pins</b> absolute values, relative values</span></div>`);
  // Only document notation the report actually uses — a legend entry for a
  // scenario that appears nowhere makes the reader hunt for something absent.
  return `<div class="key">
  <h4>Notation</h4>
  <div class="key-row">
    ${rows.join("\n    ")}
  </div>
</div>`;
}

/**
 * Chromium is not always on PATH where playwright expects it. Any ad-hoc script
 * that opens the report needs the same probe `render.mjs` and `fit.mjs` use.
 */
export function launchOptions(extraArgs = []) {
  const paths = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium",
    "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
    .filter(Boolean).filter((p) => { try { return fs.existsSync(p); } catch { return false; } });
  const o = { args: ["--no-sandbox", "--font-render-hinting=none", ...extraArgs] };
  if (paths.length) o.executablePath = paths[0];
  return o;
}

/* -------------------------------------------------------------- document */
export function css({ ink = "#171B1F", rule = "#D8DCE0", mute = "#6E757C", fonts = fontFaces() } = {}) {
  return `
${fonts}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:#20272E;-webkit-font-smoothing:antialiased;
  font-feature-settings:"tnum" 1}
@page{size:A4;margin:0}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff;
  page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto}

.hdr{position:absolute;top:0;left:12mm;right:12mm;height:16mm;display:flex;align-items:center;
  justify-content:space-between;border-bottom:1.5px solid ${ink}}
.hdr-l{display:flex;align-items:center;gap:8px}
.hdr-l span{font-size:9pt;font-weight:700;color:${ink};letter-spacing:-.1px}
.hdr-r{font-size:7.4pt;font-weight:600;color:${mute};text-transform:uppercase;letter-spacing:.13em}
.body{position:absolute;top:16mm;left:0;right:0;bottom:11mm;padding:8mm 12mm 0}
.ftr{position:absolute;right:12mm;bottom:7mm;font-size:11pt;font-weight:700;color:${ink}}
.ftr i{font-style:normal;font-size:8.5pt;font-weight:500;color:#9AA1A8}

h2{font-size:21pt;font-weight:800;color:${ink};margin:0 0 2px;letter-spacing:-.6px;line-height:1.1}
h3{font-size:11.5pt;font-weight:700;color:${ink};margin:12px 0 5px}
h4{font-size:8.6pt;font-weight:700;color:${ink};margin:11px 0 4px;text-transform:uppercase;letter-spacing:.6px}
p{font-size:9.1pt;line-height:1.5;margin:0 0 7px;color:#333C45}
p b{color:${ink};font-weight:600}
p.sub{font-size:9pt;color:${mute};margin:0 0 12px;font-weight:500}
p.cap{font-size:7.6pt;color:#8A9199;line-height:1.4;margin:3px 0 9px}

.lockup{display:flex;align-items:center;gap:calc(11px * var(--s,1))}
.lockup>div{display:flex;flex-direction:column;line-height:1}
.lockup b{font-size:calc(13pt * var(--s,1));font-weight:800;letter-spacing:calc(3.4px * var(--s,1));color:${ink}}
.lockup span{font-size:calc(6.6pt * var(--s,1));font-weight:600;letter-spacing:calc(2.1px * var(--s,1));
  color:${mute};text-transform:uppercase;margin-top:calc(4px * var(--s,1))}
.lockup.light b{color:#fff}
.lockup.light span{color:#9AA6B2}

/* cover — one flat band, no cut corners */
.cover .body{padding:0;top:0;bottom:0}
.cover .hdr{display:none}
.cover-band{position:absolute;top:0;left:0;right:0;height:142mm;background:${ink};
  display:flex;flex-direction:column;justify-content:space-between;padding:26mm 12mm 16mm}
.cover-bottom{max-width:130mm}
.cover-eyebrow{font-size:8pt;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
  color:#98A2AC;margin-bottom:9mm}
.cover-title{font-size:27pt;font-weight:700;letter-spacing:-.9px;line-height:1.14;color:#fff}
.cover-year{font-size:48pt;font-weight:800;letter-spacing:-2.6px;line-height:1;margin-top:5mm;color:#fff}
.cover-meta{position:absolute;top:168mm;left:12mm;right:12mm;display:grid;
  grid-template-columns:1fr 1fr;gap:8mm 10mm}
.cover-meta div{border-top:1.5px solid ${ink};padding-top:5px}
.cover-meta span{display:block;font-size:7.4pt;color:${mute};text-transform:uppercase;
  letter-spacing:.7px;font-weight:600;margin-bottom:2px}
.cover-meta b{font-size:10pt;font-weight:600;color:${ink}}

/* contents */
.toc{list-style:none;margin:12px 0 0;padding:0}
.toc li{display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;padding:8px 0;
  border-bottom:1px solid #EBEEF0}
.toc .t{font-size:11.5pt;font-weight:700;color:${ink}}
.toc .dots{border-bottom:1.5px dotted #C6CCD2;margin:0 8px 3px}
.toc .n{font-size:11.5pt;font-weight:700;color:${ink}}
.toc em{grid-column:1/-1;font-style:normal;font-size:8.6pt;color:#8A9199;margin-top:1px}

.key{margin-top:20px;border-top:1.5px solid ${ink};border-bottom:1px solid ${rule};padding:9px 0 10px}
.key h4{margin:0 0 8px}
.key-row{display:grid;grid-template-columns:1fr 1fr;gap:7px 20px}
.key-row>div{display:flex;align-items:center;gap:9px}
.key-row span{font-size:8pt;color:#6F7A85;line-height:1.35}
.key-row b{color:${ink};font-weight:700}
.basisline{margin-top:12px;font-size:8pt;color:#7A848E;line-height:1.55}
.basisline b{color:${ink};font-weight:700}

/* content blocks */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:0 14mm;margin:2px 0 8px}
.split{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:0 8mm;align-items:start;margin-top:6px}
.split h4{margin-top:0}
table.plain{width:100%;border-collapse:collapse}
table.plain td{font-size:8.3pt;padding:2.5px 0;border-bottom:1px solid #F0F2F4;color:#333C45;vertical-align:top}
table.plain td:first-child{font-weight:600;color:${ink};padding-right:8px}
table.plain td:last-child{text-align:right;color:#8A9199;white-space:nowrap}
table.plain td.r{text-align:right;font-weight:600;color:${ink}}
.chart{margin:2px 0 5px}
.table-wrap{margin:5px 0 8px}

/* ratio strip — plain typography, because ratios have mixed polarity and do
   not belong in a variance table */
.ratios{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;margin:6px 0 4px;
  border-top:1.5px solid ${ink};border-bottom:1px solid ${rule}}
.ratios div{padding:8px 10px 9px;border-right:1px solid #EBEEF0}
.ratios div:last-child{border-right:0}
.ratios span{display:block;font-size:7.2pt;font-weight:600;text-transform:uppercase;
  letter-spacing:.06em;color:${mute};margin-bottom:3px}
.ratios b{display:block;font-size:15pt;font-weight:700;color:${ink};letter-spacing:-.5px;line-height:1}
.ratios i{display:block;font-style:normal;font-size:7.6pt;color:#8A9199;margin-top:3px}

.signoff{display:flex;gap:11px;align-items:flex-start;margin-top:12px;border-top:1.5px solid ${ink};padding-top:9px}
.signoff div:last-child{font-size:8.2pt;color:#6F7A85;line-height:1.55}
.signoff b{color:${ink};font-weight:700}

/* fitting aids — zoom changes layout height, transform does not, so zoom is
   the one that actually buys a page back. Classes exist for every 2% from
   .z98 down to .z70; a class outside that range silently does nothing. */
${Array.from({ length: 15 }, (_, i) => 98 - i * 2).map((z) => `.z${z}{zoom:.${z}}`).join("")}
`;
}

export function documentHtml({ title, pages, css: sheet }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<style>${sheet}</style></head><body>${pages.join("")}</body></html>`;
}

/**
 * Source workbooks are usually kept in thousands. Charts format compactly, so
 * feed them real units and let the library print "412.3M" rather than an
 * ambiguous "412.3K".
 */
/**
 * Scales the keys AC / PY / PL / FC / value / base wherever they appear, at any
 * depth. That covers every datum shape in the library — but it means a numeric
 * prop you happen to call `value` or `base` in the same object also gets
 * multiplied. Scale your data before you mix it with component props.
 */
const SCALE_KEYS = new Set(["AC", "PY", "PL", "FC", "value", "base"]);
export function scaleUnits(v, factor = 1000) {
  if (Array.isArray(v)) return v.map((x) => scaleUnits(x, factor));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      o[k] = SCALE_KEYS.has(k) && typeof x === "number" ? x * factor : scaleUnits(x, factor);
    }
    return o;
  }
  return typeof v === "number" ? v * factor : v;
}
