/**
 * ISO 24896 / IBCS conformance linter.
 *
 * This is the "CHECK" half of the notation standard: given a serializable
 * config (a chart, a KPI, or a whole report), report where it departs from the
 * IBCS visual grammar - non-linear chart types, unstructured titles, missing
 * variance, wrong favorability for cost measures, and so on.
 *
 * Pure logic: zero React, zero deps, JSON-serializable input and output. The
 * input is typed `unknown` on purpose - these checks run on values that may have
 * been hand-authored or round-tripped through JSON, so every access is guarded.
 */

import type { ChartConfig } from "./config";
import { CHART_TYPES } from "./config";
import type { ReportConfig } from "./report";
import type { KpiConfig } from "./kpi";

/** A single conformance observation. `path` locates it within the input. */
export interface IbcsFinding {
  /** Rule id - matches an entry in {@link IBCS_RULES}. */
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
    doc: "IBCS permits only linear charts (column, bar, line, area, scatter, bubble, waterfall families). Pie, gauge, radar and similar are forbidden because area/angle encodings distort comparison. Unknown type strings are flagged under this rule too, with the valid values listed.",
  },
  {
    id: "structured-title",
    title: "Structured Who / What / When title",
    severity: "warning",
    doc: "ISO 24896 SAY: a title states Who (entity), What (measure + unit) and When (period) on separate lines, kept apart from the interpretive key message. A bare string title loses that structure - and a chart or report with NO title at all says nothing. Both are flagged.",
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
    doc: 'For cost / expense / tax measures a higher value is unfavorable. Set higherIsBetter:false so impact (favorability) coloring shows overruns in red, not green. Detected from an explicit measureKind:"cost" declaration, or heuristically from the title / KPI label.',
  },
  {
    id: "shared-scale",
    title: "Consistent scaling across same-unit charts",
    severity: "info",
    doc: "Charts of the same unit should share a value scale (and a zero baseline) so bar lengths are comparable across the report.",
  },
  {
    id: "ratio-units",
    title: "Percentage-point deltas for ratio measures",
    severity: "info",
    doc: 'A percentage MEASURE (margin, rate, share) moves in percentage points, not percent-of-percent. A KPI formatted with suffix "%" should declare unit:"ratio" so its delta renders as +0.6pp instead of a misleading relative +0.9%.',
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
  // This library's chart configs - all linear by construction.
  "varianceColumn",
  "trend",
  "structure",
  "stacked",
  "combo",
  "tree",
]);

/**
 * Chart types IBCS explicitly forbids: area/angle encodings that distort
 * comparison. Anything not in this set and not in {@link LINEAR_CHART_TYPES}
 * is an UNKNOWN type - a different failure with a different message.
 */
const NON_LINEAR_CHART_TYPES = new Set<string>([
  "pie",
  "donut",
  "doughnut",
  "gauge",
  "radar",
  "spider",
  "polar",
  "radial",
  "funnel",
  "sunburst",
  "treemap",
]);

/** The values a user should actually type - this library's config vocabulary. */
const VALID_TYPE_LIST = CHART_TYPES.map((t) => `"${t}"`).join(", ");

const COST_LABEL = /cost|expense|tax|opex/i;

/* --------------------------------------------------------- did-you-mean */

const normalizeType = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Small, bounded Levenshtein - inputs are short type names, never user data. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3; // beyond our suggestion threshold; skip the work
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[n]!;
}

/**
 * Suggest the intended chart type for an unknown string: an exact match after
 * normalization ("variance-column" → "varianceColumn") or a near-miss within
 * edit distance 2 ("watrfall" → "waterfall"). Returns undefined when nothing
 * is plausibly close.
 */
function suggestChartType(input: string): string | undefined {
  const norm = normalizeType(input);
  if (!norm) return undefined;
  let best: string | undefined;
  let bestDist = 3;
  for (const candidate of LINEAR_CHART_TYPES) {
    const d = editDistance(norm, normalizeType(candidate));
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ guards */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* ------------------------------------------------------------- title check */

/** True when a title is present in any form - a non-blank string or an object. */
function hasTitle(title: unknown): boolean {
  if (typeof title === "string") return title.trim() !== "";
  return isObject(title);
}

/**
 * The searchable text of a title: the string itself, or the joined
 * who/what/when lines of a structured title. Used by the cost heuristic, so
 * the RECOMMENDED title form does not silently bypass cost detection.
 */
function titleText(title: unknown): string {
  if (typeof title === "string") return title;
  if (isObject(title)) {
    return [title.who, title.what, title.when]
      .filter((part): part is string => typeof part === "string")
      .join(" ");
  }
  return "";
}

/**
 * Flag a title that is a bare string instead of a structured Who/What/When -
 * and, where a title is REQUIRED (charts, reports), flag a missing one at the
 * same severity. Without the `required` arm, deleting the title would silence
 * the rule it violates.
 */
function checkTitle(
  title: unknown,
  path: string,
  out: IbcsFinding[],
  opts: { required?: boolean; subject?: string } = {},
): void {
  if (!hasTitle(title)) {
    if (opts.required) {
      out.push({
        rule: "structured-title",
        severity: "warning",
        message: `${opts.subject ?? "config"} has no title - ISO 24896 SAY requires a Who/What/When structured title.`,
        path,
      });
    }
    return;
  }
  if (typeof title === "string") {
    out.push({
      rule: "structured-title",
      severity: "warning",
      message: `title "${title}" is a bare string - use a Who/What/When structured title (ISO 24896 SAY).`,
      path,
    });
  }
}

/* ------------------------------------------------------ cost favorability */

/**
 * Push a cost-favorability warning when a cost-like measure does not read a
 * rise as unfavorable. Detection order:
 *
 *  1. explicit `measureKind` ("cost" → always check; "revenue" → never) - the
 *     declaration survives any title edit and beats the heuristic;
 *  2. text heuristic over the effective title / label (structured titles
 *     included via {@link titleText}).
 */
function checkCostFavorability(
  c: Record<string, unknown>,
  text: string,
  pathOf: (k: string) => string,
  out: IbcsFinding[],
): void {
  if (c.higherIsBetter === false) return;
  const kind = c.measureKind;
  if (kind === "revenue") return;
  const declaredCost = kind === "cost";
  if (!declaredCost && !COST_LABEL.test(text)) return;
  const why = declaredCost
    ? `measure is declared measureKind:"cost"`
    : `"${text.trim()}" looks like a cost measure`;
  out.push({
    rule: "cost-favorability",
    severity: "warning",
    message: `${why} - set higherIsBetter:false so impact coloring is correct.`,
    path: pathOf("higherIsBetter"),
  });
}

/* ------------------------------------------------------------- chart check */

function checkChart(
  c: Record<string, unknown>,
  base = "",
  /** A title carried by the surrounding report block, if any - it titles this chart too. */
  externalTitle?: unknown,
): IbcsFinding[] {
  const out: IbcsFinding[] = [];
  const p = (k: string) => (base ? `${base}.${k}` : k);
  const type = c.type;

  // Three distinct failures share this rule: no type at all, a type IBCS
  // forbids, and a type this library simply does not know. Each gets its own
  // message - and the valid values listed are the API vocabulary (CHART_TYPES),
  // not IBCS prose, so following the hint actually works.
  if (typeof type !== "string") {
    out.push({
      rule: "linear-chart-type",
      severity: "error",
      message: `chart config has no "type" - expected one of ${VALID_TYPE_LIST}.`,
      path: p("type"),
    });
  } else if (!LINEAR_CHART_TYPES.has(type)) {
    if (NON_LINEAR_CHART_TYPES.has(type.toLowerCase())) {
      out.push({
        rule: "linear-chart-type",
        severity: "error",
        message: `chart type "${type}" is non-linear - IBCS forbids area/angle encodings because they distort comparison. Use one of ${VALID_TYPE_LIST}.`,
        path: p("type"),
      });
    } else {
      const suggestion = suggestChartType(type);
      out.push({
        rule: "linear-chart-type",
        severity: "error",
        message: `unknown chart type "${type}"${suggestion ? ` - did you mean "${suggestion}"?` : ""} Valid types: ${VALID_TYPE_LIST}.`,
        path: p("type"),
      });
    }
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
        ? "tree chart has no root node - nothing to plot."
        : "chart has no data - nothing to plot.",
      path: isTree ? p("root") : p("data"),
    });
  }

  // The chart must be titled - by its own config, or by the report block that
  // hosts it. Only when BOTH are absent is the missing-title finding emitted;
  // a present-but-bare title is flagged wherever it sits.
  checkTitle(c.title, p("title"), out, {
    required: !hasTitle(externalTitle),
    subject: "chart",
  });

  // Variance is only flagged when explicitly switched off; relying on the
  // default comparison (PY) is conformant, so a clean chart returns [].
  // Category charts spell it `variance:"none"`; combo/tree still carry a
  // boolean `showVariance`.
  const variancePanelOff = c.variance === "none" || c.showVariance === false;
  if (variancePanelOff) {
    out.push({
      rule: "show-variance",
      severity: "info",
      message: "no variance shown - IBCS reports typically show AC vs a comparison.",
      path: base || undefined,
    });
  }

  // Cost-like measure must read overruns as unfavorable. The effective title
  // is the config's own, falling back to the hosting block's - so moving the
  // title up a level does not blind the check.
  const effectiveTitle = hasTitle(c.title) ? c.title : externalTitle;
  checkCostFavorability(c, titleText(effectiveTitle), p, out);

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
      message: "KPI has no headline value - values.AC must be a number.",
      path: p("values"),
    });
  }

  if (Array.isArray(c.comparisons) && c.comparisons.length === 0) {
    out.push({
      rule: "show-variance",
      severity: "info",
      message: "no variance shown - IBCS reports typically show AC vs a comparison.",
      path: p("comparisons"),
    });
  }

  checkCostFavorability(c, typeof c.label === "string" ? c.label : "", p, out);

  // A %-formatted KPI that has not been declared a ratio still shows the
  // relative delta of a percentage - the "+0.9% next to a margin" smell.
  if (
    isObject(c.format) &&
    typeof c.format.suffix === "string" &&
    c.format.suffix.trim() === "%" &&
    c.unit !== "ratio"
  ) {
    out.push({
      rule: "ratio-units",
      severity: "info",
      message:
        'KPI is formatted as a percentage but not declared unit:"ratio" - a ratio\'s delta should read as percentage points (+0.6pp), not as a relative change of the percentage.',
      path: p("unit"),
    });
  }

  return out;
}

/* ------------------------------------------------------------ report check */

const BLOCK_TYPES = new Set<string>(["kpi", "chart", "statement", "table", "text"]);

function checkReport(r: Record<string, unknown>): IbcsFinding[] {
  const out: IbcsFinding[] = [];

  checkTitle(r.title, "title", out, { required: true, subject: "report" });

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
        message: `unknown report block type ${JSON.stringify(b.type)} - expected kpi, chart, statement, table or text.`,
        path: `${bp}.type`,
      });
    }

    checkTitle(b.title, `${bp}.title`, out);

    // Recurse into the configs the linter understands.
    if (b.type === "chart") {
      chartBlocks++;
      if (isObject(b.config)) out.push(...checkChart(b.config, `${bp}.config`, b.title));
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
      message: `report has ${chartBlocks} charts - give same-unit charts a shared, zero-based value scale so bar lengths are comparable.`,
      path: "blocks",
    });
  }

  return out;
}

/* ------------------------------------------------------- component props */

/**
 * Chart components mapped to the `type` their props are linted as. Components
 * with an exact config counterpart use it; the specialised variance charts
 * lint as the linear family they render (their extra props simply carry no
 * rules); `PieChart` maps to `"pie"` on purpose - linting a pie must say so.
 */
const COMPONENT_CHART_TYPES = {
  VarianceColumnChart: "varianceColumn",
  TrendChart: "trend",
  StructureChart: "structure",
  WaterfallChart: "waterfall",
  StackedChart: "stacked",
  LineChart: "line",
  AreaChart: "area",
  ScatterChart: "scatter",
  BubbleChart: "bubble",
  ComboChart: "combo",
  TreeChart: "tree",
  PieChart: "pie",
  GroupedVarianceChart: "column",
  IntegratedVarianceChart: "column",
  RankingVarianceChart: "bar",
  ColumnVarianceWaterfallChart: "waterfall",
  BarVarianceWaterfallChart: "waterfall",
  HorizontalWaterfallChart: "waterfall",
  RatioTreeChart: "tree",
} as const;

/** Component names {@link checkIbcsProps} knows the notation rules for. */
export type LintableComponentName = keyof typeof COMPONENT_CHART_TYPES | "KpiCard";

const LINTABLE_LIST = [...Object.keys(COMPONENT_CHART_TYPES), "KpiCard"].join(", ");

/**
 * Lint COMPONENT PROPS - the JSX authoring path - against the same IBCS rules
 * {@link checkIbcs} runs on configs.
 *
 * The prop shapes of the chart components are near-identical to their config
 * shapes; the only thing missing is the `type` discriminator, which the
 * component name carries. This maps the name back to a type and runs the
 * config checks, so a dashboard written as JSX can be linted in a unit test
 * without restructuring into configs:
 *
 * ```ts
 * // <VarianceColumnChart data={productLines} comparison="PY" variance="abs" />
 * const findings = checkIbcsProps("VarianceColumnChart", {
 *   data: productLines,
 *   comparison: "PY",
 *   variance: "abs",
 * });
 * ```
 *
 * Extra, render-only props (`width`, `tokens`, `onSelect`, …) carry no rules
 * and are ignored. Lint-only declarations (`measureKind`) may be added to the
 * linted object even though the component does not render them. `KpiCard`
 * props already ARE a `KpiConfig`, so they lint directly. Unknown component
 * names return a single `input-shape` info naming the lintable components -
 * pure logic, zero React, same contract as {@link checkIbcs}.
 */
export function checkIbcsProps(
  component: LintableComponentName | (string & {}),
  props: Record<string, unknown> | unknown,
): IbcsFinding[] {
  if (!isObject(props)) {
    return [
      {
        rule: "input-shape",
        severity: "info",
        message: "props must be an object - nothing to check.",
      },
    ];
  }

  if (component === "KpiCard") return checkKpi(props);

  const type = (COMPONENT_CHART_TYPES as Record<string, string>)[component];
  if (type === undefined) {
    return [
      {
        rule: "input-shape",
        severity: "info",
        message: `no notation rules for component "${component}" - lintable components: ${LINTABLE_LIST}.`,
      },
    ];
  }

  // The component name wins over any stray `type` prop - the JSX said what it is.
  return checkChart({ ...props, type });
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
        message: "value is not a config object - nothing to check.",
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
      message: "unrecognized config shape - expected a ChartConfig, KpiConfig or ReportConfig.",
    },
  ];
}
