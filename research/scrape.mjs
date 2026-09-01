#!/usr/bin/env node
/**
 * IBCS reference-material farm - a small, dependency-free crawler.
 *
 * Harvests pages from ibcs.com (text + images + metadata) into research/data/
 * so we can study the official IBCS examples/templates offline and reproduce
 * them faithfully as react-ibcs components. The engine is version-controlled;
 * the harvested data (research/data/) is gitignored and never pushed.
 *
 * Zero npm dependencies - uses Node 18+ built-ins (global fetch, fs, path).
 *
 * Usage:
 *   node research/scrape.mjs                      # crawl the default seeds
 *   node research/scrape.mjs <url> [<url> ...]    # crawl specific seeds
 *   node research/scrape.mjs --max 200 --depth 3  # tune crawl limits
 *   node research/scrape.mjs --force <url>        # re-fetch even if cached
 *   node research/scrape.mjs --no-crawl <url>     # fetch only the given page(s)
 *
 * Output layout (research/data/):
 *   manifest.json                  index of every page farmed
 *   pages/<slug>/page.html         raw HTML
 *   pages/<slug>/page.md           extracted readable text (headings + prose)
 *   pages/<slug>/meta.json         { url, title, scrapedAt, images[], links[] }
 *   pages/<slug>/images/<file>     downloaded images (with captions in meta)
 *
 * Re-runnable & resumable: pages already in the manifest are skipped unless
 * --force. Add new seeds any time to farm more of the site.
 */

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");
const PAGES_DIR = join(DATA_DIR, "pages");
const MANIFEST = join(DATA_DIR, "manifest.json");

const HOST = "www.ibcs.com";
// Only crawl into these path prefixes (the substantive reference material).
const ALLOW_PREFIXES = ["/resource", "/resource_category", "/resources"];
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) react-ibcs-research/1.0 (+offline study of IBCS standard)";

const DEFAULT_SEEDS = [
  "https://www.ibcs.com/resource_category/examples/",
  "https://www.ibcs.com/resource_category/chart-templates/",
  "https://www.ibcs.com/resource_category/table-templates/",
];

/* --------------------------------- args --------------------------------- */

function parseArgs(argv) {
  const opts = { seeds: [], max: 150, depth: 3, force: false, crawl: true, delayMs: 700 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--max") opts.max = Number(argv[++i]);
    else if (a === "--depth") opts.depth = Number(argv[++i]);
    else if (a === "--delay") opts.delayMs = Number(argv[++i]);
    else if (a === "--force") opts.force = true;
    else if (a === "--no-crawl") opts.crawl = false;
    else if (a.startsWith("http")) opts.seeds.push(a);
    else console.warn(`(ignoring unknown arg: ${a})`);
  }
  if (opts.seeds.length === 0) opts.seeds = DEFAULT_SEEDS;
  return opts;
}

/* ------------------------------ html helpers ----------------------------- */

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
  "#8217": "’",
  "#8211": "-",
  "#8220": "“",
  "#8221": "”",
};
function decodeEntities(s) {
  return s.replace(/&(#?\w+);/g, (m, e) =>
    e in ENTITIES ? ENTITIES[e] : /^#\d+$/.test(e) ? String.fromCodePoint(Number(e.slice(1))) : m,
  );
}

function extractTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeEntities(h1[1].replace(/<[^>]+>/g, "").trim());
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? decodeEntities(t[1].replace(/<[^>]+>/g, "").trim()) : "";
}

/** Strip a page down to readable markdown-ish text (headings + paragraphs). */
function htmlToText(html) {
  let s = html;
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Keep only the <body>, and prefer <main>/<article> if present.
  const main = s.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (main) s = main[1];
  s = s
    .replace(/<h([1-6])[^>]*>/gi, (m, n) => "\n\n" + "#".repeat(Number(n)) + " ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/(p|div|section|li|tr|figcaption|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+|[ \t]+$/gm, "");
  return s.trim();
}

function resolveUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** Extract image URLs + nearby alt/caption. Handles src, data-src, srcset. */
function extractImages(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const src =
      (tag.match(/\bdata-src=["']([^"']+)["']/i) || [])[1] ||
      (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] ||
      ((tag.match(/\bsrcset=["']([^"']+)["']/i) || [])[1] || "")
        .split(",")[0]
        ?.trim()
        .split(/\s+/)[0];
    if (!src) continue;
    const abs = resolveUrl(src, baseUrl);
    if (!abs || seen.has(abs)) continue;
    if (/\.(svg|gif)$/i.test(abs) && /icon|logo|sprite/i.test(abs)) continue; // skip chrome
    seen.add(abs);
    const alt = decodeEntities((tag.match(/\balt=["']([^"']*)["']/i) || [])[1] || "");
    out.push({ url: abs, alt });
  }
  // Also catch <a href="...jpg|png"> direct image links.
  const aRe = /<a\b[^>]*\bhref=["']([^"']+\.(?:png|jpe?g|webp))["'][^>]*>/gi;
  while ((m = aRe.exec(html))) {
    const abs = resolveUrl(m[1], baseUrl);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      out.push({ url: abs, alt: "" });
    }
  }
  return out;
}

/** In-site links worth crawling (resource pages/categories). */
function extractLinks(html, baseUrl) {
  const out = new Set();
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const abs = resolveUrl(m[1], baseUrl);
    if (!abs) continue;
    let u;
    try {
      u = new URL(abs);
    } catch {
      continue;
    }
    if (u.host !== HOST) continue;
    if (!ALLOW_PREFIXES.some((p) => u.pathname.startsWith(p))) continue;
    u.hash = "";
    out.add(u.toString());
  }
  return [...out];
}

/* ------------------------------ fs helpers ------------------------------- */

function slugify(url) {
  const u = new URL(url);
  let s = (u.pathname + (u.search || ""))
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "index";
}
function imgFilename(url) {
  const u = new URL(url);
  const base = u.pathname.split("/").pop() || "image";
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 8);
  return /\.\w{2,5}$/.test(base) ? `${hash}-${base}` : `${hash}-${base}.img`;
}
async function ensureDir(d) {
  await mkdir(d, { recursive: true });
}
async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadManifest() {
  if (!existsSync(MANIFEST)) return { scrapedAt: null, pages: {} };
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { scrapedAt: null, pages: {} };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "" };
}

/* -------------------------------- crawler -------------------------------- */

async function scrapePage(url, manifest, opts, nowIso) {
  const slug = slugify(url);
  const dir = join(PAGES_DIR, slug);
  if (!opts.force && manifest.pages[url] && (await exists(join(dir, "meta.json")))) {
    return { slug, links: manifest.pages[url].links || [], skipped: true };
  }
  let html, type;
  try {
    ({ buf: html, type } = await fetchBuf(url));
  } catch (e) {
    console.warn(`  ✗ ${url} - ${e.message}`);
    return { slug, links: [], error: e.message };
  }
  if (!/text\/html/i.test(type)) return { slug, links: [], skipped: true };
  const text = html.toString("utf8");

  await ensureDir(join(dir, "images"));
  await writeFile(join(dir, "page.html"), text);

  const title = extractTitle(text);
  const md = `# ${title}\n\n<${url}>\n\n${htmlToText(text)}\n`;
  await writeFile(join(dir, "page.md"), md);

  const images = extractImages(text, url);
  const downloaded = [];
  for (const img of images) {
    const file = imgFilename(img.url);
    const dest = join(dir, "images", file);
    if (!(await exists(dest))) {
      try {
        const { buf } = await fetchBuf(img.url);
        await writeFile(dest, buf);
      } catch (e) {
        console.warn(`    (img fail ${img.url} - ${e.message})`);
        continue;
      }
      await sleep(120);
    }
    downloaded.push({ file, url: img.url, alt: img.alt });
  }

  const links = extractLinks(text, url);
  const meta = { url, slug, title, scrapedAt: nowIso, images: downloaded, links };
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  manifest.pages[url] = { slug, title, images: downloaded.length, links, scrapedAt: nowIso };
  console.log(`  ✓ ${title || slug}  (${downloaded.length} imgs, ${links.length} links)`);
  return { slug, links };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await ensureDir(PAGES_DIR);
  const manifest = await loadManifest();
  const nowIso = new Date().toISOString();

  const queue = opts.seeds.map((u) => ({ url: u, depth: 0 }));
  const visited = new Set();
  let farmed = 0;

  console.log(`IBCS farm → ${DATA_DIR}`);
  console.log(
    `seeds: ${opts.seeds.length}, max ${opts.max}, depth ${opts.depth}, crawl ${opts.crawl}\n`,
  );

  while (queue.length && farmed < opts.max) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const { links = [], skipped, error } = await scrapePage(url, manifest, opts, nowIso);
    if (!skipped && !error) {
      farmed++;
      await sleep(opts.delayMs);
    }
    if (opts.crawl && depth < opts.depth) {
      for (const l of links) if (!visited.has(l)) queue.push({ url: l, depth: depth + 1 });
    }
  }

  manifest.scrapedAt = nowIso;
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(
    `\nDone. Farmed ${farmed} new page(s); ${Object.keys(manifest.pages).length} total in manifest.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
