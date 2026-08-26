/**
 * Export the resolved statement model as CSV (also opens in Excel).
 *
 * "Resolved" means the model after the same computation the views use:
 * every line flattened with its values resolved per scenario (groups summing
 * their children) and its variances computed. The result is a plain matrix of
 * numbers — no formatting, no React — so a spreadsheet can re-aggregate it.
 */

import { SCENARIO_KEYS, type ScenarioKey, type StatementLine } from "./types";
import { flattenVisible } from "./layout";
import { resolveValue, lineVariance } from "./variance";

export interface StatementCsvOptions {
  /** Scenario columns to include. Default: every scenario present in the model. */
  scenarios?: ScenarioKey[];
  /** Comparison bases to emit Δ (and Δ%) columns for. Default ["PY"]. */
  comparisons?: ScenarioKey[];
  /** Include a Δ% column next to each Δ column. Default true. */
  includePercent?: boolean;
  /** Field delimiter. Default "," (pass "\t" for tab-separated / Excel paste). */
  delimiter?: string;
  /** String prepended once per depth level to the label. Default two spaces. */
  indent?: string;
  /** Decimal places for the Δ% column. Default 1. */
  percentDecimals?: number;
  /**
   * Neutralize spreadsheet formula injection in TEXT cells. Default true.
   * See {@link toCSV}.
   */
  guardFormulas?: boolean;
}

/** Scenarios that actually carry a value anywhere in the tree, in canonical order. */
function detectScenarios(lines: StatementLine[]): ScenarioKey[] {
  const present = new Set<ScenarioKey>();
  const walk = (ls: StatementLine[]) => {
    for (const l of ls) {
      for (const s of SCENARIO_KEYS) if (resolveValue(l, s) != null) present.add(s);
      if (l.children) walk(l.children);
    }
  };
  walk(lines);
  return SCENARIO_KEYS.filter((s) => present.has(s));
}

/**
 * Build the resolved statement as a matrix (header row + one row per line).
 * The whole tree is included (nothing collapsed); the label is indented by
 * depth. Values are raw numbers (null where absent) so a spreadsheet keeps them
 * numeric.
 */
export function statementToMatrix(
  lines: StatementLine[],
  opts: StatementCsvOptions = {},
): Array<Array<string | number | null>> {
  const scenarios = opts.scenarios ?? detectScenarios(lines);
  const comparisons = opts.comparisons ?? ["PY"];
  const includePercent = opts.includePercent ?? true;
  const indent = opts.indent ?? "  ";
  const pdec = opts.percentDecimals ?? 1;

  const header: string[] = ["Item", ...scenarios];
  for (const base of comparisons) {
    header.push(`Δ${base}`);
    if (includePercent) header.push(`Δ${base} %`);
  }

  const rows = flattenVisible(lines, new Set());
  const body = rows.map(({ line, depth }) => {
    const cells: Array<string | number | null> = [indent.repeat(depth) + line.label];
    for (const s of scenarios) {
      const v = resolveValue(line, s);
      cells.push(v == null ? null : v);
    }
    for (const base of comparisons) {
      const variance = lineVariance(line, base);
      cells.push(variance ? variance.abs : null);
      if (includePercent) {
        cells.push(
          variance && variance.pct != null ? Number((variance.pct * 100).toFixed(pdec)) : null,
        );
      }
    }
    return cells;
  });

  return [header, ...body];
}

/**
 * A leading `=`, `+`, `-`, `@`, TAB or CR makes Excel / Sheets / LibreOffice
 * treat a cell as a FORMULA (`=HYPERLINK(...)`, `=cmd|'…'!A1`) rather than as
 * text — the classic "CSV injection" vector, since RFC-4180 quoting does not
 * stop it.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * True when a text cell would be parsed as a formula. Indentation is ignored
 * for the test (a nested statement label is prefixed with spaces) but kept in
 * the output — the apostrophe goes in front of it.
 */
function isFormulaText(s: string): boolean {
  return FORMULA_LEAD.test(s) || FORMULA_LEAD.test(s.trimStart());
}

/**
 * Serialize a matrix to delimiter-separated text, with RFC-4180 quoting.
 *
 * `guardFormulas` (default TRUE) prefixes a single apostrophe to any TEXT cell
 * that opens with a formula lead character, so a label like `"=HYPERLINK(...)"`
 * lands in the sheet as inert text. NUMBER cells are never touched — a negative
 * value stays a negative number, and the sheet can still re-aggregate the
 * export. Pass `false` to get the raw, unguarded text.
 */
export function toCSV(
  matrix: Array<Array<string | number | null | undefined>>,
  opts: { delimiter?: string; guardFormulas?: boolean } = {},
): string {
  const delimiter = opts.delimiter ?? ",";
  const guardFormulas = opts.guardFormulas ?? true;
  const esc = (cell: string | number | null | undefined): string => {
    if (cell == null) return "";
    // Only strings are text cells; numbers must stay numeric.
    const s =
      guardFormulas && typeof cell === "string" && isFormulaText(cell) ? `'${cell}` : String(cell);
    return /["\n\r]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return matrix.map((row) => row.map(esc).join(delimiter)).join("\r\n");
}

/**
 * Convenience: resolve a statement model and serialize it to CSV in one call.
 * Formula guarding is on by default (see {@link toCSV}); opt out with
 * `{ guardFormulas: false }`.
 */
export function statementToCSV(lines: StatementLine[], opts: StatementCsvOptions = {}): string {
  return toCSV(statementToMatrix(lines, opts), {
    delimiter: opts.delimiter,
    guardFormulas: opts.guardFormulas,
  });
}
