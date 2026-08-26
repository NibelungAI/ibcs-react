import { spawnSync } from "node:child_process";

/**
 * Runs a git command and returns its stdout, exiting on failure.
 *
 * @param {string[]} args git arguments
 * @returns {string} stdout, trimmed
 */
function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

// Tracked files with local modifications...
const tracked = git(["diff", "--name-only", "--relative", "--diff-filter=ACMR", "HEAD"]);

// ...plus brand-new files git does not know about yet. `git diff HEAD` never
// lists untracked paths, so without this a freshly added component would be
// silently skipped by `npm run format` and then fail `npm run check-format`.
const untracked = git(["ls-files", "--others", "--exclude-standard"]);

const files = [
  ...new Set(
    `${tracked}\n${untracked}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ),
];

if (files.length === 0) {
  console.log("No changed files to format.");
  process.exit(0);
}

const result = spawnSync("npx", ["oxfmt", "--write", ...files], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
