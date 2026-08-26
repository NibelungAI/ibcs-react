/**
 * Report model: a JSON-serializable layout of blocks (KPI cards, charts,
 * statements, text) on a responsive grid. This is what makes "dynamic reports
 * from components in blocks" authorable and round-trippable.
 *
 * Titles follow ISO 24896 / IBCS "SAY": a structured Who / What / When title is
 * kept separate from the interpretive key message.
 */

import type { ScenarioKey, StatementLine, VarianceColumnSpec } from "./types";
import type { FormatOptions } from "./format";
import type { ChartConfig } from "./config";
import { validateChartConfig } from "./config";
import type { KpiConfig } from "./kpi";
import { validateKpiConfig } from "./kpi";
import type { DataTableColumn, DataTableRow, DataTableSort } from "./datatable";
import { sharedDomain, type SharedDomainResult, type SharedDomainPanel } from "./smallMultiples";

/**
 * ISO 24896 structured title: Who (entity), What (measure + unit), When (period)
 * on separate lines. A plain string is accepted as the "what" line.
 */
export interface StructuredTitle {
  who?: string;
  what?: string;
  when?: string;
}

/** A serializable subset of StatementTable props for use inside a report. */
export interface StatementBlockConfig {
  lines: StatementLine[];
  mode?: "flow" | "stock";
  scenario?: ScenarioKey;
  varianceColumns?: VarianceColumnSpec[];
  mark?: "bar" | "pin";
  waterfallWidth?: number;
  showBaseValues?: boolean;
  maxHeight?: number;
  format?: FormatOptions;
}

interface ReportBlockBase {
  /** Stable id (React key, addressing). */
  id: string;
  /** Grid columns to span (1..report.columns). Default sensible per type. */
  span?: number;
  /** Block heading — a structured Who/What/When title, or a plain string. */
  title?: StructuredTitle | string;
  /** Interpretive one-liner, kept separate from the neutral title (SAY). */
  message?: string;
}

export interface KpiBlock extends ReportBlockBase {
  type: "kpi";
  config: KpiConfig;
}
export interface ChartBlock extends ReportBlockBase {
  type: "chart";
  config: ChartConfig;
  /**
   * Opt-in shared-scale tag. Chart blocks carrying the SAME `sharedScaleGroup`
   * measure the same thing and should share ONE value scale (IBCS "same scale =
   * same meaning"). Use {@link resolveSharedScales} to compute that shared
   * domain per group from the report config.
   *
   * NOTE (current limitation): `ConfiguredChart`/`ChartConfig` don't yet accept
   * an external domain override, so this tag is advisory — the resolver exposes
   * the shared domain for callers (and for a future `domain` prop on the chart
   * components) rather than forcing the rendered axis today.
   */
  sharedScaleGroup?: string;
}
export interface StatementBlock extends ReportBlockBase {
  type: "statement";
  config: StatementBlockConfig;
}
/**
 * A prose block: commentary, an executive summary, a methodology note.
 *
 * The three text slots are distinct on purpose (ISO 24896 "SAY"):
 *  - `title`   — the neutral heading (Who / What / When, or a plain string),
 *  - `message` — the interpretive one-liner (the key message),
 *  - `body`    — the prose itself, one or more paragraphs.
 *
 * Before `body` existed a text block could only borrow `message` for its prose,
 * which conflated the key message with the narrative. `message` is therefore
 * SOFT-DEPRECATED for prose — it still renders exactly as before (so existing
 * reports are untouched), and it remains the right field for a genuine one-line
 * key message alongside a `body`.
 */
export interface TextBlock extends ReportBlockBase {
  type: "text";
  /**
   * Prose paragraph(s) under the title. Blank lines (`\n\n`) split it into
   * separate paragraphs; single newlines are treated as ordinary whitespace.
   */
  body?: string;
}

/** A serializable subset of DataTable props — the general cross-entity comparison table. */
export interface TableBlockConfig {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  showTotals?: boolean;
  /** Sort applied on mount (the table's uncontrolled seed). */
  defaultSort?: DataTableSort | null;
  format?: FormatOptions;
}
export interface TableBlock extends ReportBlockBase {
  type: "table";
  config: TableBlockConfig;
}

export type ReportBlock = KpiBlock | ChartBlock | StatementBlock | TextBlock | TableBlock;

export interface ReportConfig {
  title?: StructuredTitle | string;
  message?: string;
  /** Grid column count. Default 12. */
  columns?: number;
  blocks: ReportBlock[];
}

export type ReportValidation = { ok: true; config: ReportConfig } | { ok: false; error: string };

/** Validate an unknown value as a ReportConfig (for JSON-authored reports). */
export function validateReportConfig(value: unknown): ReportValidation {
  if (typeof value !== "object" || value === null)
    return { ok: false, error: "Report must be an object." };
  const r = value as Record<string, unknown>;
  if (!Array.isArray(r.blocks)) return { ok: false, error: "report.blocks must be an array." };

  for (let i = 0; i < r.blocks.length; i++) {
    const b = r.blocks[i] as Record<string, unknown>;
    if (typeof b?.id !== "string") return { ok: false, error: `blocks[${i}].id must be a string.` };
    switch (b.type) {
      case "kpi": {
        const v = validateKpiConfig(b.config);
        if (!v.ok) return { ok: false, error: `blocks[${i}] (kpi): ${v.error}` };
        break;
      }
      case "chart": {
        const v = validateChartConfig(b.config);
        if (!v.ok) return { ok: false, error: `blocks[${i}] (chart): ${v.error}` };
        if (b.sharedScaleGroup != null && typeof b.sharedScaleGroup !== "string") {
          return { ok: false, error: `blocks[${i}] (chart): sharedScaleGroup must be a string.` };
        }
        break;
      }
      case "statement": {
        const cfg = b.config as Record<string, unknown> | undefined;
        if (!cfg || !Array.isArray(cfg.lines))
          return { ok: false, error: `blocks[${i}] (statement): config.lines must be an array.` };
        break;
      }
      case "table": {
        const cfg = b.config as Record<string, unknown> | undefined;
        if (!cfg || !Array.isArray(cfg.columns))
          return { ok: false, error: `blocks[${i}] (table): config.columns must be an array.` };
        if (!Array.isArray(cfg.rows))
          return { ok: false, error: `blocks[${i}] (table): config.rows must be an array.` };
        break;
      }
      case "text":
        if (b.body != null && typeof b.body !== "string") {
          return { ok: false, error: `blocks[${i}] (text): body must be a string.` };
        }
        break;
      default:
        return { ok: false, error: `blocks[${i}].type is invalid: ${JSON.stringify(b.type)}.` };
    }
  }
  return { ok: true, config: value as ReportConfig };
}

/** A block's default column span when it doesn't set one (on a 12-col grid). */
export function defaultSpan(type: ReportBlock["type"], columns = 12): number {
  switch (type) {
    case "kpi":
      return Math.max(2, Math.round(columns / 4)); // four KPIs per row
    case "text":
    case "table":
      return columns; // text + general table default to full width
    default:
      return Math.round(columns / 2); // charts/statements half-width
  }
}

/* ---------------- Shared-scale groups across report blocks ---------------- */

/** A resolved shared scale: the common domain plus the blocks that share it. */
export interface SharedScaleGroupResult {
  /** The group tag from {@link ChartBlock.sharedScaleGroup}. */
  group: string;
  /** Ids of the chart blocks contributing to (and sharing) this scale. */
  blockIds: string[];
  /** The shared value domain for every block in the group (always spans 0). */
  domain: SharedDomainResult;
}

/** Numeric keys a chart row can carry, across the scenario/point chart shapes. */
const VALUE_KEYS = ["AC", "PY", "PL", "FC", "value", "y", "x"] as const;

/** Pull every plottable number out of a chart config's data rows. SSR-safe, pure. */
function chartValues(config: ChartConfig): number[] {
  const out: number[] = [];
  const data = (config as { data?: unknown }).data;
  if (Array.isArray(data)) {
    for (const row of data) {
      if (row == null || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      for (const k of VALUE_KEYS) {
        const v = r[k];
        if (typeof v === "number" && isFinite(v)) out.push(v);
      }
    }
  }
  return out;
}

/**
 * Resolve every shared-scale group in a report: collect the chart blocks that
 * carry a matching {@link ChartBlock.sharedScaleGroup}, then run the shared-scale
 * solver across them so all blocks in a group expose ONE common value domain.
 *
 * This is the data half of "same scale = same meaning" for report blocks. The
 * rendering half (forcing each chart's axis to the shared domain) awaits a
 * `domain` override on the chart components / `ChartConfig`; until then callers
 * can read the resolved domains here and wire them as that lands.
 *
 * @example
 * const scales = resolveSharedScales(report, { clampPercentile: 0.95 });
 * const d = scales.get("revenue")?.domain; // { domainMin, domainMax, ... }
 */
export function resolveSharedScales(
  config: ReportConfig,
  opts: { nice?: boolean; clampPercentile?: number } = {},
): Map<string, SharedScaleGroupResult> {
  const buckets = new Map<string, { panels: SharedDomainPanel[]; ids: string[] }>();
  for (const b of config.blocks) {
    if (b.type !== "chart" || !b.sharedScaleGroup) continue;
    const bucket = buckets.get(b.sharedScaleGroup) ?? { panels: [], ids: [] };
    bucket.panels.push({ values: chartValues(b.config) });
    bucket.ids.push(b.id);
    buckets.set(b.sharedScaleGroup, bucket);
  }

  const out = new Map<string, SharedScaleGroupResult>();
  for (const [group, { panels, ids }] of buckets) {
    out.set(group, {
      group,
      blockIds: ids,
      domain: sharedDomain(panels, {
        nice: opts.nice ?? true,
        clampPercentile: opts.clampPercentile,
      }),
    });
  }
  return out;
}
