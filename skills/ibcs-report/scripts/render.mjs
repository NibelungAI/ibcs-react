/**
 * report.html -> A4 PDF. Page geometry lives in the CSS (@page + fixed-height
 * .page blocks), so margins are zero here and preferCSSPageSize is on.
 *   node render.mjs [in.html] [out.pdf]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const IN = pathToFileURL(path.resolve(process.argv[2] || "report.html")).href;
const OUT = process.argv[3] || "report.pdf";

/** Env override, else Playwright's managed Chromium, else a system browser. */
async function launchBrowser() {
  const args = ["--no-sandbox", "--font-render-hinting=none"];
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
await page.waitForTimeout(400);
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true,
});
await browser.close();
console.log("wrote " + OUT);
