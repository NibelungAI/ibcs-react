/**
 * Every .page is a fixed-height box with overflow hidden, so content that runs
 * long is silently cut rather than reflowed. This measures each page before the
 * PDF is made: `used` above `avail` means something is being clipped.
 *   node fit.mjs [in.html]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const IN = pathToFileURL(path.resolve(process.argv[2] || "report.html")).href;

/** Env override, else Playwright's managed Chromium, else a system browser. */
async function launchBrowser() {
  const args = ["--no-sandbox"];
  if (process.env.PLAYWRIGHT_CHROMIUM)
    return chromium.launch({ args, executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  try {
    return await chromium.launch({ args });
  } catch (err) {
    const found = [
      "/opt/pw-browsers/chromium",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ].find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    if (found) return chromium.launch({ args, executablePath: found });
    console.error("No Chromium available. Try: npx playwright install chromium\n" + err.message);
    process.exit(1);
  }
}

const browser = await launchBrowser();
const page = await browser.newPage();
await page.goto(IN, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

const rows = await page.evaluate(() =>
  [...document.querySelectorAll(".page")].map((pg) => {
    const body = pg.querySelector(".body"),
      flow = pg.querySelector(".flow");
    const edge = pg.getBoundingClientRect().right - 14;
    if (pg.classList.contains("cover"))
      return {
        page: +pg.dataset.page,
        avail: Math.round(body.clientHeight),
        used: Math.round(flow.scrollHeight),
        wide: 0,
      };
    const wide = [...pg.querySelectorAll(".flow *")].filter(
      (e) => e.getBoundingClientRect().right > edge,
    ).length;
    return {
      page: +pg.dataset.page,
      avail: Math.round(body.clientHeight),
      used: Math.round(flow.scrollHeight),
      wide,
    };
  }),
);
await browser.close();

console.table(
  rows.map((r) => ({
    ...r,
    status: r.used > r.avail ? "OVERFLOW" : r.wide ? "too wide" : "ok",
    slack: r.avail - r.used,
  })),
);

// Show what is tall on any page that does not fit, so the fix is obvious.
const bad = rows.filter((r) => r.used > r.avail);
if (bad.length) {
  const b2 = await launchBrowser();
  const p2 = await b2.newPage();
  await p2.goto(IN, { waitUntil: "load" });
  await p2.evaluate(() => document.fonts.ready);
  for (const r of bad) {
    const parts = await p2.evaluate(
      (n) =>
        [...document.querySelector(`[data-page="${n}"] .flow`).children].map((c) => ({
          el: c.tagName.toLowerCase() + (c.className ? "." + c.className.split(" ").join(".") : ""),
          h: Math.round(c.getBoundingClientRect().height),
        })),
      r.page,
    );
    console.log(`\npage ${r.page} — over by ${r.used - r.avail}px:`);
    console.table(parts);
  }
  await b2.close();
  process.exitCode = 1;
}
