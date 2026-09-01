"use client";

import React, { useState } from "react";
import {
  StatementTable,
  VarianceColumnChart,
  TrendChart,
  StructureChart,
  IbcsThemeProvider,
  tokenPresets,
  tokenPresetLabels,
  statementToCSV,
  downloadCSV,
  type IbcsTokens,
  type TokenPresetId,
} from "ibcs-react";
import {
  sampleStatement,
  sampleStatementFlat,
  sampleLossStatement,
  sampleBalanceSheet,
  sampleConsolidation,
  sampleQuarterlyRevenue,
  sampleQuarterlyStatement,
  sampleMonthlyTrend,
  sampleRevenueStructure,
} from "@/lib/demo-data/sample-data";
import { ExampleReport } from "./example-report";
import { Playground } from "./playground";

type Comparison = "PY" | "PL";

/** The chart datasets feeding the trend / structure / revenue views. */
interface ChartData {
  quarter: typeof sampleQuarterlyRevenue;
  trend: typeof sampleMonthlyTrend;
  structure: typeof sampleRevenueStructure;
}

const baseChartData = (): ChartData => ({
  quarter: sampleQuarterlyRevenue,
  trend: sampleMonthlyTrend,
  structure: sampleRevenueStructure,
});

/** The switchable income-statement datasets behind the "view" control. */
const STATEMENT_SETS = [
  {
    value: "standard",
    label: "Standard",
    lines: sampleStatementFlat,
    subtitle:
      "IBCS integrated waterfall: comparison column, AC labelled on the bars, Δ (bar) + Δ% (pin) with off-scale arrows.",
  },
  {
    value: "drill",
    label: "Drill-down",
    lines: sampleStatement,
    subtitle:
      "Same model, nested: Revenue and Operating expenses are groups - click the chevron to expand.",
  },
  {
    value: "loss",
    label: "Loss year",
    lines: sampleLossStatement,
    subtitle:
      "Everything can go negative: the running total crosses the zero axis and steps run left.",
  },
] as const;

/**
 * The gallery. A control bar drives every view: the theme preset and the
 * comparison base (AC vs PY or vs PL/budget). Charts and tables all read from
 * one model; the controls just re-render them.
 *
 * The whole page sits inside an `IbcsThemeProvider` and paints its own chrome
 * from the active tokens (`surface` / `surfaceMuted` / `text` / `textMuted`),
 * so switching to the Dark preset actually darkens the page - not just the
 * marks inside the charts.
 */
export function Gallery() {
  const [tokens, setTokens] = useState<IbcsTokens>(tokenPresets.default);
  const [comparison, setComparison] = useState<Comparison>("PY");
  const data = baseChartData();
  // Kept for the sections' remount key; the demo no longer exposes a replay control.
  const replay = 0;

  return (
    <IbcsThemeProvider tokens={tokens}>
      <div
        style={{
          background: tokens.color.surfaceMuted,
          color: tokens.color.text,
          fontFamily: tokens.font.family,
          minHeight: "100%",
          width: "100%",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "32px 24px 64px",
            overflowX: "hidden",
          }}
        >
          <header style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: tokens.color.textMuted,
              }}
            >
              ibcs-react
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: "4px 0 0" }}>
              IBCS reporting components
            </h1>
            <p style={{ fontSize: 13, color: tokens.color.textMuted, margin: "6px 0 0" }}>
              One model, many views. Switch the comparison base or retheme - every table and chart
              re-renders from the same data.
            </p>
          </header>

          <ControlBar
            tokens={tokens}
            onTokens={setTokens}
            comparison={comparison}
            onComparison={setComparison}
          />

          {/* Interactive flagship: one filter bar drives four linked views. */}
          <Playground tokens={tokens} />

          {/* Flagship: a whole report assembled from one JSON ReportConfig. */}
          <section style={{ marginBottom: 28 }}>
            <ExampleReport key={replay} tokens={tokens} />
          </section>

          <StatementExplorer comparison={comparison} replay={replay} tokens={tokens} />

          <BudgetSection
            title="Budget vs actual - income statement"
            subtitle="Actual against plan (PL / budget): the PL column is the budget, ΔBudget (bar) and ΔBudget% (pin) show the gap. Over-budget costs read red regardless of the comparison toggle above."
            lines={sampleStatementFlat}
            replay={replay}
            tokens={tokens}
          />

          <BudgetSection
            title="Budget vs actual - by quarter"
            subtitle="The same comparison on the quarterly build-up to full-year revenue. Q4 beat budget by the most; the full-year total lands 1.6M over plan."
            lines={sampleQuarterlyStatement}
            replay={replay}
            tokens={tokens}
          />

          <StatementSection
            title="Balance sheet - stock view"
            subtitle="A stock statement: each line is an ending balance (a level), not a period movement. Assets balance against liabilities + equity at 37.0M. Expand Non-current assets."
            lines={sampleBalanceSheet}
            mode="stock"
            comparison={comparison}
            replay={replay}
            tokens={tokens}
          />

          <StatementSection
            title="Consolidation - virtualized"
            subtitle="~250 rows (10 divisions × 24 accounts). The body scrolls with a sticky header and only the rows in view are mounted, so big consolidations and transaction drill-downs stay smooth. Scroll inside the table."
            lines={sampleConsolidation}
            maxHeight={440}
            expandControls
            comparison={comparison}
            replay={replay}
            tokens={tokens}
          />

          <RevenueCard
            data={data.quarter}
            comparison={comparison}
            replay={replay}
            tokens={tokens}
          />

          <TrendSection data={data.trend} comparison={comparison} replay={replay} tokens={tokens} />

          <StructureSection
            data={data.structure}
            comparison={comparison}
            replay={replay}
            tokens={tokens}
          />
        </div>
      </div>
    </IbcsThemeProvider>
  );
}

/* ----------------------------- control bar ----------------------------- */

const COLOR_FIELDS: Array<{ key: keyof IbcsTokens["color"]; label: string }> = [
  { key: "neutral", label: "Bars" },
  { key: "total", label: "Totals" },
  { key: "good", label: "Good" },
  { key: "bad", label: "Bad" },
];

function ControlBar({
  tokens,
  onTokens,
  comparison,
  onComparison,
}: {
  tokens: IbcsTokens;
  onTokens: (t: IbcsTokens) => void;
  comparison: Comparison;
  onComparison: (c: Comparison) => void;
}) {
  const setColor = (key: keyof IbcsTokens["color"], value: string) =>
    onTokens({ ...tokens, color: { ...tokens.color, [key]: value } });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 18,
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.rowBorder}`,
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 20,
      }}
    >
      <Control label="Compare AC vs" tokens={tokens}>
        <Segmented
          value={comparison}
          onChange={onComparison}
          tokens={tokens}
          options={[
            { value: "PY", label: "PY" },
            { value: "PL", label: "PL · budget" },
          ]}
        />
      </Control>

      <Control label="Theme" tokens={tokens}>
        <Segmented
          value={pickPreset(tokens)}
          onChange={(id) => onTokens(tokenPresets[id])}
          tokens={tokens}
          options={PRESET_IDS.map((id) => ({ value: id, label: tokenPresetLabels[id] }))}
        />
      </Control>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {COLOR_FIELDS.map(({ key, label }) => (
          <label
            key={key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: tokens.color.textMuted,
            }}
          >
            <input
              type="color"
              value={tokens.color[key]}
              onChange={(e) => setColor(key, e.target.value)}
              style={{
                width: 26,
                height: 22,
                border: `1px solid ${tokens.color.rowBorder}`,
                borderRadius: 5,
                padding: 0,
                background: "none",
                cursor: "pointer",
              }}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

const PRESET_IDS = Object.keys(tokenPresets) as TokenPresetId[];

/** Best-effort match of the active tokens back to a preset id (for the toggle). */
function pickPreset(tokens: IbcsTokens): TokenPresetId {
  for (const id of PRESET_IDS) {
    const preset = tokenPresets[id];
    if (preset.color.neutral === tokens.color.neutral && preset.color.good === tokens.color.good)
      return id;
  }
  return "default";
}

function Control({
  label,
  tokens,
  children,
}: {
  label: string;
  tokens: IbcsTokens;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: tokens.color.textMuted,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/* --------------------------- reusable controls ---------------------------- */

function Segmented<T extends string>({
  value,
  options,
  onChange,
  tokens,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  tokens: IbcsTokens;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        border: `1px solid ${tokens.color.rowBorder}`,
        borderRadius: 6,
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            border: "none",
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            background: value === o.value ? tokens.color.text : tokens.color.surface,
            color: value === o.value ? tokens.color.surface : tokens.color.textMuted,
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function MarkToggle({
  mark,
  onChange,
  tokens,
}: {
  mark: "bar" | "pin";
  onChange: (m: "bar" | "pin") => void;
  tokens: IbcsTokens;
}) {
  return (
    <Segmented
      value={mark}
      onChange={onChange}
      tokens={tokens}
      options={[
        { value: "bar", label: "Bar" },
        { value: "pin", label: "Pin" },
      ]}
    />
  );
}

function CsvButton({ onClick, tokens }: { onClick: () => void; tokens: IbcsTokens }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Download the resolved statement as CSV"
      style={{
        border: `1px solid ${tokens.color.rowBorder}`,
        borderRadius: 6,
        background: tokens.color.surface,
        color: tokens.color.text,
        padding: "5px 11px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
    >
      ⤓ CSV
    </button>
  );
}

/** Two Δ columns (bar + pin) for a comparison base - the IBCS reference pair. */
function comparisonColumns(base: Comparison) {
  return [
    { base, mode: "abs" as const, mark: "bar" as const },
    { base, mode: "pct" as const, mark: "pin" as const },
  ];
}

/* ----------------------------- sections ------------------------------- */

/** The primary statement: a dataset switcher + the global comparison + mark. */
function StatementExplorer({
  comparison,
  replay,
  tokens,
}: {
  comparison: Comparison;
  replay: number;
  tokens: IbcsTokens;
}) {
  const [set, setSet] = useState<(typeof STATEMENT_SETS)[number]["value"]>("standard");
  const [mark, setMark] = useState<"bar" | "pin">("bar");
  const current = STATEMENT_SETS.find((s) => s.value === set) ?? STATEMENT_SETS[0];
  const exportCsv = () =>
    downloadCSV(
      `income-statement-${set}.csv`,
      statementToCSV(current.lines, { comparisons: [comparison] }),
    );

  return (
    <Section
      title="Income statement"
      subtitle={current.subtitle}
      tokens={tokens}
      action={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Segmented
            value={set}
            onChange={setSet}
            tokens={tokens}
            options={STATEMENT_SETS.map((s) => ({ value: s.value, label: s.label }))}
          />
          <CsvButton onClick={exportCsv} tokens={tokens} />
          <MarkToggle mark={mark} onChange={setMark} tokens={tokens} />
        </span>
      }
    >
      <StatementTable
        key={`${set}-${replay}`}
        lines={current.lines}
        mark={mark}
        varianceColumns={comparisonColumns(comparison)}
        waterfallWidth={260}
        tokens={tokens}
        format={{ compact: true, decimals: 1 }}
      />
    </Section>
  );
}

/** Budget-vs-actual: fixed on PL (plan), with ΔBudget (bar) + ΔBudget% (pin). */
const BUDGET_COLUMNS = [
  { base: "PL" as const, mode: "abs" as const, mark: "bar" as const, label: "ΔBudget" },
  { base: "PL" as const, mode: "pct" as const, mark: "pin" as const, label: "ΔBudget%" },
];

function BudgetSection({
  title,
  subtitle,
  lines,
  replay,
  tokens,
}: {
  title: string;
  subtitle: string;
  lines: React.ComponentProps<typeof StatementTable>["lines"];
  replay: number;
  tokens: IbcsTokens;
}) {
  const [mark, setMark] = useState<"bar" | "pin">("bar");
  const exportCsv = () =>
    downloadCSV(
      `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`,
      statementToCSV(lines, { comparisons: ["PL", "PY"] }),
    );
  return (
    <Section
      title={title}
      subtitle={subtitle}
      tokens={tokens}
      action={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <CsvButton onClick={exportCsv} tokens={tokens} />
          <MarkToggle mark={mark} onChange={setMark} tokens={tokens} />
        </span>
      }
    >
      <StatementTable
        key={replay}
        lines={lines}
        mark={mark}
        varianceColumns={BUDGET_COLUMNS}
        waterfallWidth={260}
        tokens={tokens}
        format={{ compact: true, decimals: 1 }}
      />
    </Section>
  );
}

function StatementSection({
  title,
  subtitle,
  lines,
  tokens,
  comparison,
  replay,
  mode = "flow",
  maxHeight,
  expandControls,
}: {
  title: string;
  subtitle: string;
  lines: React.ComponentProps<typeof StatementTable>["lines"];
  tokens: IbcsTokens;
  comparison: Comparison;
  replay: number;
  mode?: "flow" | "stock";
  maxHeight?: number;
  expandControls?: boolean;
}) {
  const [mark, setMark] = useState<"bar" | "pin">("bar");
  const exportCsv = () =>
    downloadCSV(
      `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`,
      statementToCSV(lines, { comparisons: [comparison] }),
    );
  return (
    <Section
      title={title}
      subtitle={subtitle}
      tokens={tokens}
      action={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <CsvButton onClick={exportCsv} tokens={tokens} />
          <MarkToggle mark={mark} onChange={setMark} tokens={tokens} />
        </span>
      }
    >
      <StatementTable
        key={replay}
        lines={lines}
        mode={mode}
        waterfallWidth={260}
        mark={mark}
        maxHeight={maxHeight}
        expandControls={expandControls}
        varianceColumns={comparisonColumns(comparison)}
        tokens={tokens}
        format={{ compact: true, decimals: 1 }}
      />
    </Section>
  );
}

function RevenueCard({
  data,
  comparison,
  replay,
  tokens,
}: {
  data: ChartData["quarter"];
  comparison: Comparison;
  replay: number;
  tokens: IbcsTokens;
}) {
  const [mark, setMark] = useState<"bar" | "pin">("bar");
  return (
    <Section
      title={`Revenue by quarter - AC vs ${comparison}`}
      subtitle="AC columns with the comparison overlapped behind and an impact-coloured variance panel beneath. Switch the mark to pin for the lollipop variant."
      tokens={tokens}
      action={<MarkToggle mark={mark} onChange={setMark} tokens={tokens} />}
    >
      <VarianceColumnChart
        key={replay}
        data={data}
        comparison={comparison}
        mark={mark}
        tokens={tokens}
        width={560}
        height={300}
        format={{ compact: true }}
      />
    </Section>
  );
}

function TrendSection({
  data,
  comparison,
  replay,
  tokens,
}: {
  data: ChartData["trend"];
  comparison: Comparison;
  replay: number;
  tokens: IbcsTokens;
}) {
  const [mode, setMode] = useState<"abs" | "pct">("abs");
  return (
    <Section
      title="Revenue trend - 13 periods"
      subtitle="P1-P9 actual, P10-P13 forecast (hatched). PY/PL ride along as reference lines; the panel beneath shows AC/FC vs the comparison."
      tokens={tokens}
      action={
        <Segmented
          value={mode}
          onChange={setMode}
          tokens={tokens}
          options={[
            { value: "abs", label: "Δ" },
            { value: "pct", label: "Δ%" },
          ]}
        />
      }
    >
      <TrendChart
        key={replay}
        data={data}
        comparison={comparison}
        variance={mode}
        tokens={tokens}
        width={820}
        height={360}
        format={{ compact: true, decimals: 1 }}
      />
    </Section>
  );
}

function StructureSection({
  data,
  comparison,
  replay,
  tokens,
}: {
  data: ChartData["structure"];
  comparison: Comparison;
  replay: number;
  tokens: IbcsTokens;
}) {
  return (
    <Section
      title="Revenue by region - composition"
      subtitle="The structure of the revenue total: each region's bar, share of the whole, and Δ vs the comparison. Ranked largest-first; AC solid, comparison faded behind."
      tokens={tokens}
    >
      <StructureChart
        key={replay}
        data={data}
        comparison={comparison}
        tokens={tokens}
        width={600}
        height={320}
        format={{ compact: true, decimals: 1 }}
      />
    </Section>
  );
}

/* ----------------------------- shells ------------------------------- */

function Section({
  title,
  subtitle,
  action,
  tokens,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  tokens: IbcsTokens;
  children: React.ReactNode;
}) {
  return (
    <section style={cardStyle(tokens)}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 2px" }}>{title}</h2>
          <p
            style={{
              fontSize: 12.5,
              color: tokens.color.textMuted,
              margin: "0 0 14px",
              maxWidth: 560,
            }}
          >
            {subtitle}
          </p>
        </div>
        {action}
      </div>
      {/* Wide tables/charts keep their natural width and scroll on narrow screens. */}
      <div style={scrollX}>{children}</div>
    </section>
  );
}

const cardStyle = (t: IbcsTokens): React.CSSProperties => ({
  background: t.color.surface,
  color: t.color.text,
  border: `1px solid ${t.color.rowBorder}`,
  borderRadius: 10,
  padding: "18px 20px",
  marginBottom: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
});

/**
 * Let a wide child scroll horizontally inside its card instead of spilling off
 * the page. `maxWidth: 100%` caps the scroller to the card width; the wide
 * table/chart inside overflows into the scroll.
 */
const scrollX: React.CSSProperties = {
  maxWidth: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  paddingBottom: 6,
};
