/**
 * ISO 24896 / IBCS conformance linter.
 *
 * This is the "CHECK" half of the notation standard: given a serializable
 * config (a chart, a KPI, or a whole report), report where it departs from the
 * IBCS visual grammar — non-linear chart types, unstructured titles, missing
 * variance, wrong favorability for cost measures, and so on.
 *
 * Pure logic: zero React, zero deps, JSON-serializable input and output. The
 * input is typed `unknown` on purpose — these checks run on values that may have
 * been hand-authored or round-tripped through JSON, so every access is guarded.
 */

import type { ChartConfig } from "./config";
import type { ReportConfig } from "./report";
import type { KpiConfig } from "./kpi";

/** A single conformance observation. `path` locates it within the input. */
export interface IbcsFinding {
  /** Rule id — matches an entry in {@link IBCS_RULES}. */
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  /** JSON-ish path to the offending value, e.g. `blocks[2].title`. */
  path?: string;
}

/** A catalog entry describing one rule, for docs and UI legends. */
export interface IbcsRule {
  id: string;
  title: string;
  severity: IbcsFinding["severity"];
  doc: string;
}

/**
 * The rules this linter encodes, distilled from ISO 24896 (IBCS UNIFY + CHECK).
 * Each finding's `rule` references one of these ids.
 */
export const IBCS_RULES: readonly IbcsRule[] = [
  {
    id: "linear-chart-type",
    title: "Linear chart types only",
    severity: "error",
    doc: "IBCS permits only linear charts (column, bar, line, area, scatter, bubble, waterfall). Pie, gauge, radar and similar are forbidden because area/angle encodings distort comparison.",
  },
  {
    id: "structured-title",
    title: "Structured Who / What / When title",
    severity: "warning",
    doc: "ISO 24896 SAY: a title states Who (entity), What (measure + unit) and When (period) on separate lines, kept apart from the interpretive key message. A bare string title loses that structure.",
  },
  {
    id: "show-variance",
    title: "Show a variance",
    severity: "info",
    doc: "IBCS reports compare actuals against a scenario (AC vs PY / PL / FC). A chart or KPI with no comparison shows a number without a yardstick.",
  },
  {
    id: "data-present",
    title: "Data must be present",
    severity: "error",
    doc: "A chart or KPI with no data cannot be rendered or checked.",
  },
  {
    id: "block-type",
    title: "Known report block type",
    severity: "error",
    doc: "Report blocks must be one of kpi, chart, statement, table or text.",
  },
  {
    id: "cost-favorability",
    title: "Correct favorability for cost measures",
    severity: "warning",
    doc: "For cost / expense / tax measures a higher value is unfavorable. Set higherIsBetter:false so impact (favorability) coloring shows overruns in red, not green.",
  },
  {
    id: "shared-scale",
    title: "Consistent scaling across same-unit charts",
    severity: "info",
    doc: "Charts of the same unit should share a value scale (and a zero baseline) so bar lengths are comparable across the report.",
  },
  {
    id: "input-shape",
    title: "Recognizable config shape",
    severity: "info",
    doc: "The linter inspects ChartConfig, KpiConfig and ReportConfig shapes. Other values can't be checked.",
  },
] as const;

/** Chart `type` values that map to a linear chart family (IBCS-conformant). */
const LINEAR_CHART_TYPES = new Set<string>([
  // Generic IBCS linear families.
  "column",
  "bar",
  "line",
  "area",
  "scatter",
  "bubble",
  "waterfall",
  // This library's chart configs — all linear by construction.
  "varianceColumn",
  "trend",
  "structure",
  "stacked",
  "combo",
  "tree",
]);

const COST_LABEL = /cost|expense|tax|opex/i;

/* ------------------------------------------------------------------ guards */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* ------------------------------------------------------------- title check */

/**
 * Flag a title that is a bare string instead of a structured Who/What/When.
 * Pushes nothing when the title is absent or already structured.
 */
function checkTitle(title: unknown, path: string, out: IbcsFinding[]): void {
  if (typeof title === "string" && title.trim() !== "") {
    out.push({
      rule: "structured-title",
      severity: "warning",
      message: `title "${title}" is a bare string — use a Who/What/When structured title (ISO 24896 SAY).`,
      path,
    });
  }
}

/* ------------------------------------------------------------- chart check */

function checkChart(c: Record<string, unknown>, base = ""): IbcsFinding[] {
  const out: IbcsFinding[] = [];
  const p = (k: string) => (base ? `${base}.${k}` : k);
  const type = c.type;

  if (typeof type !== "string" || !LINEAR_CHART_TYPES.has(type)) {
    out.push({
      rule: "linear-chart-type",
      severity: "error",
      message: `non-linear chart type ${JSON.stringify(type)} — IBCS allows only linear charts (column, bar, line, area, scatter, bubble, waterfall).`,
      path: p("type"),
    });
  }

  // Data presence is SHAPE-AWARE: most configs carry a `data` array, but a tree
  // (C11 calculation tree) carries a single `root` node instead. Testing every
  // config for `data` made every valid TreeChartConfig a false-positive error.
  const isTree = type === "tree";
  const hasData = Array.isArray(c.data) ? c.data.length > 0 : isTree ? isObject(c.root) : false;
  if (!hasData) {
    out.push({
      rule: "data-present",
      severity: "error",
      message: isTree
        ? "tree chart has no root node — nothing to plot."
        : "chart has no data — nothing to plot.",
      path: isTree ? p("root") : p("data"),
    });
  }

  checkTitle(c.title, p("title"), out);

  // Variance is only flagged when explicitly switched off; relying on the
  // default comparison (PY) is conformant, so a clean chart returns [].
  // Category charts spell it `variance:"none"`; combo/tree still carry a
  // boolean `showVariance`.
  const variancePanelOff = c.variance === "none" || c.showVariance === false;
  if (variancePanelOff) {
    out.push({
      rule: "show-variance",
      severity: "info",
      message: "no variance shown — IBCS reports typically show AC vs a comparison.",
      path: base || undefined,
    });
  }

  // Cost-like measure must read overruns as unfavorable.
  if (typeof c.title === "string" && COST_LABEL.test(c.title) && c.higherIsBetter !== false) {
    out.push({
      rule: "cost-favorability",
      severity: "warning",
      message: `"${c.title}" looks like a cost measure — set higherIsBetter:false so impact coloring is correct.`,
      path: p("higherIsBetter"),
    });
  }

  return out;
}

/* --------------------------------------------------------------- kpi check */

function checkKpi(c: Record<string, unknown>, base = ""): IbcsFinding[] {
  const out: IbcsFinding[] = [];
  const p = (k: string) => (base ? `${base}.${k}` : k);

  const values = c.values;
  if (!isObject(values) || typeof values.AC !== "number") {
    out.push({
      rule: "data-present",
      severity: "error",
      message: "KPI has no headline value — values.AC must be a number.",
      path: p("values"),
    });
  }

  if (Array.isArray(c.comparisons) && c.comparisons.length === 0) {
    out.push({
      rule: "show-variance",
      severity: "info",
      message: "no variance shown — IBCS reports typically show AC vs a comparison.",
      path: p("comparisons"),
    });
  }

  if (typeof c.label === "string" && COST_LABEL.test(c.label) && c.higherIsBetter !== false) {
    out.push({
      rule: "cost-favorability",
      severity: "warning",
      message: `"${c.label}" looks like a cost measure — set higherIsBetter:false so impact coloring is correct.`,
      path: p("higherIsBetter"),
    });
  }

  return out;
}

/* ------------------------------------------------------------ report check */

const BLOCK_TYPES = new Set<string>(["kpi", "chart", "statement", "table", "text"]);

function checkReport(r: Record<string, unknown>): IbcsFinding[] {
  const out: IbcsFinding[] = [];

  checkTitle(r.title, "title", out);

  const blocks = r.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    out.push({
      rule: "data-present",
      severity: "error",
      message: "report has no blocks.",
      path: "blocks",
    });
    return out;
  }

  let chartBlocks = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const bp = `blocks[${i}]`;
    if (!isObject(b)) {
      out.push({
        rule: "block-type",
        severity: "error",
        message: `${bp} is not an object.`,
        path: bp,
      });
      continue;
    }

    if (typeof b.type !== "string" || !BLOCK_TYPES.has(b.type)) {
      out.push({
        rule: "block-type",
        severity: "error",
        message: `unknown report block type ${JSON.stringify(b.type)} — expected kpi, chart, statement, table or text.`,
        path: `${bp}.type`,
      });
    }

    checkTitle(b.title, `${bp}.title`, out);

    // Recurse into the configs the linter understands.
    if (b.type === "chart") {
      chartBlocks++;
      if (isObject(b.config)) out.push(...checkChart(b.config, `${bp}.config`));
    } else if (b.type === "kpi") {
      if (isObject(b.config)) out.push(...checkKpi(b.config, `${bp}.config`));
    } else if (b.type === "statement") {
      const cfg = b.config;
      if (!isObject(cfg) || !Array.isArray(cfg.lines) || cfg.lines.length === 0) {
        out.push({
          rule: "data-present",
          severity: "error",
          message: "statement block has no lines.",
          path: `${bp}.config.lines`,
        });
      }
    } else if (b.type === "table") {
      const cfg = b.config;
      if (!isObject(cfg) || !Array.isArray(cfg.columns) || cfg.columns.length === 0) {
        out.push({
          rule: "data-present",
          severity: "error",
          message: "table block has no columns.",
          path: `${bp}.config.columns`,
        });
      }
      if (!isObject(cfg) || !Array.isArray(cfg.rows)) {
        out.push({
          rule: "data-present",
          severity: "error",
          message: "table block has no rows.",
          path: `${bp}.config.rows`,
        });
      }
    }
  }

  // Same-unit charts should share a scale; we can't infer units, so this is an
  // advisory whenever the report holds more than one chart.
  if (chartBlocks >= 2) {
    out.push({
      rule: "shared-scale",
      severity: "info",
      message: `report has ${chartBlocks} charts — give same-unit charts a shared, zero-based value scale so bar lengths are comparable.`,
      path: "blocks",
    });
  }

  return out;
}

/* ----------------------------------------------------------------- public */

/**
 * Check a config against the IBCS / ISO 24896 notation rules.
 *
 * Detects whether `target` is a {@link ReportConfig}, {@link ChartConfig} or
 * {@link KpiConfig} and runs the applicable rules. Returns an empty array for a
 * fully conforming input, or a single `input-shape` info when the value isn't a
 * recognizable config.
 */
export function checkIbcs(target: ChartConfig | ReportConfig | KpiConfig | unknown): IbcsFinding[] {
  if (!isObject(target)) {
    return [
      {
        rule: "input-shape",
        severity: "info",
        message: "value is not a config object — nothing to check.",
      },
    ];
  }

  // Report: the only shape with a `blocks` array.
  if (Array.isArray(target.blocks)) return checkReport(target);

  // Chart: discriminated by a `type` string.
  if (typeof target.type === "string") return checkChart(target);

  // KPI: a labelled measure with scenario values.
  if (typeof target.label === "string" && "values" in target) return checkKpi(target);

  return [
    {
      rule: "input-shape",
      severity: "info",
      message: "unrecognized config shape — expected a ChartConfig, KpiConfig or ReportConfig.",
    },
  ];
}
