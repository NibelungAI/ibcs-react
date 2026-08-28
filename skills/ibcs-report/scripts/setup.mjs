#!/usr/bin/env node
/**
 * Create a build directory with the dependencies and the kit in place.
 *   node scripts/setup.mjs [target-dir]
 * Cross-platform (Windows, macOS, Linux). scripts/setup.sh wraps it for bash.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.resolve(process.argv[2] || "ibcs-report-build");
fs.mkdirSync(DIR, { recursive: true });

const sh = (cmd, quiet = false) =>
  execSync(cmd, { cwd: DIR, stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"] });

if (!fs.existsSync(path.join(DIR, "package.json"))) sh("npm init -y", true);
console.log("installing ibcs-react react react-dom @fontsource/inter playwright …");
sh("npm install --silent --no-fund --no-audit ibcs-react react react-dom @fontsource/inter playwright");

for (const f of ["assets/kit.mjs", "scripts/render.mjs", "scripts/fit.mjs"])
  fs.copyFileSync(path.join(SKILL_DIR, f), path.join(DIR, path.basename(f)));

// A browser to print with: the env override, a system Chromium/Chrome, or
// Playwright's own download (idempotent — skipped when already present).
const hasSystem = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium",
  "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
  .filter(Boolean).some((p) => { try { return fs.existsSync(p); } catch { return false; } });
if (!hasSystem) {
  try { sh("npx playwright install chromium"); }
  catch { console.warn("Chromium download failed — set PLAYWRIGHT_CHROMIUM to a Chrome/Chromium binary before fit/render."); }
}

console.log(`ready in ${DIR} — write build.mjs here, then: node build.mjs && node fit.mjs && node render.mjs`);
