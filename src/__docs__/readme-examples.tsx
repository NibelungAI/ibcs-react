/**
 * Every code snippet in `README.md`, as real TypeScript that the repo's
 * `npm run typecheck` compiles.
 *
 * The README used to drift: it showed a `comparisons` prop `StatementTable`
 * never had, and object literals whose `flow` / `kind` fields widened to
 * `string`. Nothing caught it because Markdown doesn't compile. This file is
 * that missing compiler — **the snippets live here first**, so a prop rename or
 * a signature change breaks the build instead of the reader's copy-paste.
 *
 * House rules:
 *  - one exported symbol per README snippet, in README order, each tagged with
 *    the section it belongs to;
 *  - keep the code CHARACTER-IDENTICAL to the README wherever practical (the
 *    surrounding data/imports may differ — the README elides them);
 *  - **edit this file and the README in the same commit** — if you change one,
 *    change the other;
 *  - no runtime side effects: nothing here is imported by the library, nothing
 *    is ever rendered, and it is not part of any build entry (`tsdown.config.ts`
 *    names its entries explicitly).
 */

import {
  ChartBox,
  ConfiguredChart,
  ConformanceReport,
  IbcsThemeProvider,
  KpiCard,
  Report,
  StatementTable,
  TrendChart,
  tokenPresets,
  validateChartConfig,
  validateReportConfig,
} from "../index";
import type { ReportConfig, StatementLine, TrendDatum, VarianceColumnChartConfig } from "../index";
import { computeVariance, formatValue, statementToCSV, checkIbcs, defaultTokens } from "../core";

/* ------------------------------------------------------------------ *
 * README § Quick start
 * ------------------------------------------------------------------ */

// ONE data model — values keyed by scenario (AC actual / PY previous year /
// PL plan / FC forecast) — feeds every component.
export const statement: StatementLine[] = [
  { id: "rev-product", label: "Product revenue", flow: "add", values: { AC: 17.2e6, PY: 16.1e6 } },
  { id: "rev-service", label: "Service revenue", flow: "add", values: { AC: 12.9e6, PY: 9.5e6 } },
  { id: "revenue", label: "Revenue", flow: "result", values: { AC: 30.1e6, PY: 25.6e6 } },
  {
    id: "cogs",
    label: "Cost of goods",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 9.7e6, PY: 8.4e6 },
  },
  { id: "gm", label: "Gross margin", flow: "result", values: { AC: 20.4e6, PY: 17.2e6 } },
];

export function Dashboard() {
  return (
    <>
      <KpiCard
        label="Revenue"
        values={{ AC: 30.1e6, PY: 25.6e6 }}
        comparisons={["PY"]}
        format={{ compact: true, decimals: 1 }}
      />

      <StatementTable
        lines={statement}
        varianceColumns={[
          { base: "PY", mode: "abs", mark: "bar" },
          { base: "PY", mode: "pct", mark: "pin" },
        ]}
        format={{ compact: true, decimals: 1 }}
      />
    </>
  );
}

/** README § Quick start — "hand a `ReportConfig` to `<Report />`". */
export function ReportFromConfig() {
  return (
    <Report
      config={{
        title: { who: "ACME Group", what: "Revenue & margin", when: "FY 2026" },
        columns: 12,
        blocks: [
          {
            id: "k1",
            type: "kpi",
            span: 4,
            config: { label: "Revenue", values: { AC: 30.1e6, PY: 25.6e6 }, comparisons: ["PY"] },
          },
          {
            id: "k2",
            type: "kpi",
            span: 4,
            config: {
              label: "Gross margin",
              values: { AC: 20.4e6, PY: 17.2e6 },
              comparisons: ["PY"],
            },
          },
          { id: "s1", type: "statement", span: 12, config: { lines: statement } },
        ],
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * README § Sizing
 * ------------------------------------------------------------------ */

/** A 13-period series for the trend snippets (the README elides the data). */
const monthly: TrendDatum[] = [
  { category: "Jan", AC: 2.1e6, PY: 1.9e6 },
  { category: "Feb", AC: 2.3e6, PY: 2.0e6 },
  { category: "Mar", AC: 2.6e6, PY: 2.4e6 },
];

export function SizedTrend() {
  return (
    <ChartBox width={760} height={300} fit="scale" minWidth={680}>
      {(w, h) => <TrendChart width={w} height={h} data={monthly} />}
    </ChartBox>
  );
}

/* ------------------------------------------------------------------ *
 * README § One model, JSON config
 * ------------------------------------------------------------------ */

/** The chart data the config snippet refers to (elided in the README). */
const quarterlyRevenue: VarianceColumnChartConfig["data"] = [
  { category: "Q1", AC: 7.1e6, PY: 6.4e6 },
  { category: "Q2", AC: 7.6e6, PY: 6.9e6 },
  { category: "Q3", AC: 7.4e6, PY: 7.5e6 },
  { category: "Q4", AC: 8.0e6, PY: 7.3e6 },
];

export function ValidatedChart() {
  // Whatever the JSON editor / API / database hands you — hence `unknown`.
  const raw: unknown = { type: "varianceColumn", data: quarterlyRevenue, comparison: "PY" };

  const result = validateChartConfig(raw); // { ok: true, config } | { ok: false, error }
  if (result.ok) return <ConfiguredChart config={result.config} />; // config is a typed ChartConfig
  return null;
}

/** README § One model, JSON config — the `validateReportConfig` sentence. */
export function validatedReport(raw: unknown): ReportConfig | null {
  const result = validateReportConfig(raw);
  return result.ok ? result.config : null;
}

/* ------------------------------------------------------------------ *
 * README § ISO 24896 conformance
 * ------------------------------------------------------------------ */

export function Conformance({ reportConfig }: { reportConfig: ReportConfig }) {
  const findings = checkIbcs(reportConfig);
  // [] when fully conforming; otherwise { rule, severity, message, ... } items,
  // e.g. a bare-string title flagged for not using a Who/What/When structure.
  return <ConformanceReport findings={findings} />;
}

/* ------------------------------------------------------------------ *
 * README § Theming
 * ------------------------------------------------------------------ */

/** The per-component `tokens` prop (deep-merged). */
export function ThemedStatement() {
  return (
    <StatementTable lines={statement} tokens={{ color: { good: "#2e7d32", bad: "#c62828" } }} />
  );
}

/** One theme for a whole subtree; the nearest `tokens` prop still wins. */
export function ThemedSubtree() {
  return (
    <IbcsThemeProvider tokens={tokenPresets.cvd}>
      <KpiCard label="Revenue" values={{ AC: 30.1e6, PY: 25.6e6 }} />
      <StatementTable lines={statement} />
      {/* nearest wins — this one chart departs from the theme */}
      <TrendChart data={monthly} tokens={{ color: { bad: "#c62828" } }} />
    </IbcsThemeProvider>
  );
}

/* ------------------------------------------------------------------ *
 * README § `ibcs-react/core` — framework-agnostic
 * ------------------------------------------------------------------ *
 * The README imports these from "ibcs-react/core"; in-repo that entry is
 * `../core`, so the import list above is the same names from the same module.
 */

export function coreUsage() {
  const variance = computeVariance(30.1e6, 25.6e6);
  const headline = formatValue(30.1e6, { compact: true, decimals: 1 });
  const csv = statementToCSV(statement);
  const findings = checkIbcs({ label: "Revenue", values: { AC: 30.1e6, PY: 25.6e6 } });
  return { variance, headline, csv, findings, good: defaultTokens.color.good };
}
