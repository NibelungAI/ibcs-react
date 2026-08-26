/**
 * Shared smoke-test fixtures: one minimal, valid React element per exported
 * component. Imported by BOTH `render.test.tsx` (jsdom mount) and
 * `ssr.test.tsx` (renderToString) so the two suites stay in lock-step and
 * there is a single source of truth for "minimal valid props".
 *
 * This helper is `.tsx` rather than `.ts` because it constructs JSX elements.
 */
import type { ReactElement } from "react";

import {
  ChartBox,
  ChartFrame,
  ScrollChart,
  Skeleton,
  ChartState,
  VarianceColumnChart,
  TrendChart,
  StructureChart,
  StackedChart,
  GroupedVarianceChart,
  LineChart,
  AreaChart,
  VarianceAreaChart,
  ScatterChart,
  BubbleChart,
  ComboChart,
  TreeChart,
  RatioTreeChart,
  WaterfallChart,
  HorizontalWaterfallChart,
  ColumnVarianceWaterfallChart,
  BarVarianceWaterfallChart,
  WaterfallStatementChart,
  IntegratedVarianceChart,
  RankingVarianceChart,
  SmallMultiples,
  MiniVarianceMultiples,
  PieChart,
  VarianceBar,
  KpiCard,
  Sparkline,
  StatementTable,
  DataTable,
  ComparisonTable,
  MatrixTable,
  ConformanceReport,
  Report,
  ConfiguredChart,
  ChartTooltip,
  ResponsiveChart,
  ChartDataTable,
  ExportMenu,
} from "../index";

/* ------------------------------------------------------------------ *
 * Tiny shared data fixtures (reused across many charts).
 * ------------------------------------------------------------------ */

/** A 4-period AC / PY / PL series, the common category-chart input. */
const series = [
  { category: "Q1", AC: 120, PY: 100, PL: 110, FC: 118 },
  { category: "Q2", AC: 135, PY: 118, PL: 125, FC: 130 },
  { category: "Q3", AC: 128, PY: 130, PL: 132, FC: 133 },
  { category: "Q4", AC: 150, PY: 140, PL: 145, FC: 148 },
];

const scatterPoints = [
  { x: 1, y: 2, group: "A" },
  { x: 3, y: 5, group: "A" },
  { x: 4, y: 1, group: "B" },
];

const bubblePoints = scatterPoints.map((p, i) => ({ ...p, size: (i + 1) * 10 }));

const waterfallSteps = [
  { category: "Start", value: 100, flow: "result" as const },
  { category: "Growth", value: 30, flow: "add" as const },
  { category: "Cost", value: -15, flow: "subtract" as const },
  { category: "End", value: 115, flow: "result" as const },
];

const treeRoot = {
  id: "root",
  label: "ROA",
  value: 0.12,
  py: 0.1,
  op: "/" as const,
  children: [
    { id: "margin", label: "Margin", value: 0.2, py: 0.18 },
    { id: "turn", label: "Turnover", value: 0.6, py: 0.55 },
  ],
};

const ratioRoot = {
  id: "root",
  label: "ROA",
  op: "/" as const,
  series: [0.1, 0.11, 0.12],
  py: [0.09, 0.1, 0.11],
  children: [
    { id: "a", label: "Profit", series: [10, 11, 12] },
    { id: "b", label: "Assets", series: [100, 100, 100] },
  ],
};

const statementLines = [
  { id: "rev", label: "Revenue", flow: "add" as const, values: { AC: 500, PY: 460, PL: 480 } },
  {
    id: "cogs",
    label: "COGS",
    flow: "subtract" as const,
    higherIsBetter: false,
    values: { AC: 300, PY: 280, PL: 290 },
  },
  {
    id: "gp",
    label: "Gross profit",
    flow: "result" as const,
    values: { AC: 200, PY: 180, PL: 190 },
  },
];

/** Two small AC-vs-PY panels for the built-in mini-variance multiples (C13). */
const miniGroups = [
  {
    label: "EMEA",
    data: [
      { category: "Q1", AC: 120, PY: 100 },
      { category: "Q2", AC: 135, PY: 118 },
      { category: "Q3", AC: 128, PY: 130 },
    ],
  },
  {
    label: "Americas",
    data: [
      { category: "Q1", AC: 90, PY: 95 },
      { category: "Q2", AC: 104, PY: 99 },
      { category: "Q3", AC: 98, PY: 101 },
    ],
  },
];

const dataTableColumns = [
  { key: "revenue", label: "Revenue" },
  {
    key: "rev_var",
    label: "ΔPY",
    kind: "variance" as const,
    measure: "revenue",
    base: "PY" as const,
  },
];
const dataTableRows = [
  { id: "emea", label: "EMEA", values: { revenue: { AC: 120, PY: 100 } } },
  { id: "amer", label: "Americas", values: { revenue: { AC: 90, PY: 95 } } },
];

/* ------------------------------------------------------------------ *
 * One case per exported component.
 * ------------------------------------------------------------------ */

export interface SmokeCase {
  name: string;
  element: ReactElement;
}

export const cases: SmokeCase[] = [
  {
    name: "VarianceColumnChart",
    element: <VarianceColumnChart data={series} width={400} height={260} />,
  },
  { name: "TrendChart", element: <TrendChart data={series} width={400} height={260} /> },
  {
    name: "StructureChart",
    // Same `category` key as `series` itself — the point of the alias is that
    // no renaming map is needed; this one keeps the subset explicit.
    element: (
      <StructureChart
        data={series.map((d) => ({ category: d.category, AC: d.AC, PY: d.PY }))}
        width={400}
        height={260}
      />
    ),
  },
  {
    name: "StackedChart",
    element: (
      <StackedChart
        data={series.map((d) => ({ category: d.category, values: { east: d.AC, west: d.PY } }))}
        series={[
          { key: "east", label: "East" },
          { key: "west", label: "West" },
        ]}
        width={400}
        height={260}
      />
    ),
  },
  {
    name: "GroupedVarianceChart",
    element: (
      <GroupedVarianceChart
        data={series.map((d) => ({ category: d.category, AC: d.AC, comparisonValue: d.PY }))}
        width={400}
        height={260}
      />
    ),
  },
  { name: "LineChart", element: <LineChart data={series} width={400} height={260} /> },
  { name: "AreaChart", element: <AreaChart data={series} width={400} height={260} /> },
  {
    name: "VarianceAreaChart",
    element: (
      <VarianceAreaChart
        data={series.map((d) => ({ category: d.category, AC: d.AC, reference: d.PY }))}
        width={400}
        height={260}
      />
    ),
  },
  { name: "ScatterChart", element: <ScatterChart data={scatterPoints} width={400} height={260} /> },
  { name: "BubbleChart", element: <BubbleChart data={bubblePoints} width={400} height={260} /> },
  {
    name: "ComboChart",
    element: <ComboChart data={series} secondaryKey="PL" width={400} height={260} />,
  },
  { name: "TreeChart", element: <TreeChart root={treeRoot} width={400} height={260} /> },
  { name: "RatioTreeChart", element: <RatioTreeChart root={ratioRoot} width={400} /> },
  {
    name: "WaterfallChart",
    element: <WaterfallChart data={waterfallSteps} width={400} height={260} />,
  },
  {
    name: "HorizontalWaterfallChart",
    element: <HorizontalWaterfallChart data={waterfallSteps} width={400} />,
  },
  {
    name: "ColumnVarianceWaterfallChart",
    element: (
      <ColumnVarianceWaterfallChart
        data={series.map((d) => ({ category: d.category, ac: d.AC, pl: d.PL }))}
        width={400}
        height={260}
      />
    ),
  },
  {
    name: "BarVarianceWaterfallChart",
    element: (
      <BarVarianceWaterfallChart
        data={series.map((d) => ({ label: d.category, ac: d.AC, base: d.PL }))}
        width={400}
      />
    ),
  },
  {
    name: "WaterfallStatementChart",
    element: (
      <WaterfallStatementChart
        lines={[
          { label: "Revenue", ac: 500, base: 460, flow: "add" },
          { label: "COGS", ac: 300, base: 280, flow: "subtract", higherIsBetter: false },
          { label: "Gross profit", ac: 200, base: 180, flow: "result" },
        ]}
        width={400}
      />
    ),
  },
  {
    name: "IntegratedVarianceChart",
    element: <IntegratedVarianceChart data={series} width={400} height={260} />,
  },
  {
    name: "RankingVarianceChart",
    element: (
      <RankingVarianceChart
        data={series.map((d) => ({ label: d.category, AC: d.AC, base: d.PL }))}
        width={400}
      />
    ),
  },
  {
    name: "SmallMultiples",
    element: (
      <SmallMultiples
        items={series}
        valuesOf={(d) => [d.AC, d.PY]}
        renderItem={(d) => <div data-testid="panel">{d.category}</div>}
        columns={2}
      />
    ),
  },
  {
    name: "MiniVarianceMultiples",
    element: <MiniVarianceMultiples groups={miniGroups} comparison="PY" columns={2} />,
  },
  {
    name: "PieChart",
    element: (
      <PieChart
        data={[
          { label: "EMEA", value: 40 },
          { label: "Americas", value: 35 },
          { label: "APAC", value: 25 },
        ]}
        size={160}
      />
    ),
  },
  {
    name: "VarianceBar",
    element: <VarianceBar value={12} max={40} favorable width={120} height={16} />,
  },
  {
    name: "KpiCard",
    element: (
      <KpiCard
        label="Revenue"
        values={{ AC: 500, PY: 460 }}
        format={{ currency: "€" }}
        sparkline={[1, 3, 2, 5]}
        animate={false}
      />
    ),
  },
  { name: "Sparkline", element: <Sparkline data={[1, 3, 2, 5, 4]} width={120} height={24} /> },
  { name: "StatementTable", element: <StatementTable lines={statementLines} /> },
  { name: "DataTable", element: <DataTable columns={dataTableColumns} rows={dataTableRows} /> },
  {
    name: "ComparisonTable",
    element: (
      <ComparisonTable
        rows={dataTableRows}
        leftColumns={[{ key: "revenue", label: "Revenue" }]}
        rightColumns={[{ key: "revenue", label: "Revenue" }]}
        leftGroupLabel="This year"
        rightGroupLabel="Last year"
      />
    ),
  },
  {
    name: "MatrixTable",
    element: (
      <MatrixTable
        rows={[
          { id: "rev", label: "Revenue" },
          { id: "cost", label: "Cost", flow: "subtract" },
        ]}
        columns={[
          { id: "y23", label: "2023" },
          { id: "y24", label: "2024" },
        ]}
        values={{
          rev: { y23: { AC: 100 }, y24: { AC: 120 } },
          cost: { y23: { AC: 60 }, y24: { AC: 70 } },
        }}
        scenarios={["AC"]}
      />
    ),
  },
  { name: "ConformanceReport", element: <ConformanceReport findings={[]} /> },
  {
    name: "Report",
    element: (
      <Report
        config={{
          title: "Q4 review",
          blocks: [
            { id: "intro", type: "text", title: "Summary", message: "Revenue ahead of plan." },
            {
              id: "kpi",
              type: "kpi",
              config: { label: "Revenue", values: { AC: 500, PY: 460 } },
            },
          ],
        }}
      />
    ),
  },
  {
    name: "ConfiguredChart",
    element: (
      <ConfiguredChart
        config={{
          type: "varianceColumn",
          title: "Revenue vs PY",
          width: 400,
          height: 260,
          data: series.map((d) => ({ category: d.category, AC: d.AC, PY: d.PY })),
        }}
      />
    ),
  },
  {
    name: "ChartTooltip",
    element: (
      <ChartTooltip
        x={20}
        y={20}
        title="Q1"
        rows={[
          { label: "AC", value: "120", strong: true },
          { label: "ΔPY", value: "+20" },
        ]}
      />
    ),
  },
  {
    name: "ResponsiveChart",
    element: <ResponsiveChart aspect={2}>{(w, h) => <div>{`${w}x${h}`}</div>}</ResponsiveChart>,
  },
  {
    name: "ChartDataTable",
    element: (
      <ChartDataTable
        caption="Revenue by quarter"
        columns={["AC", "PY"]}
        rows={series.map((d) => ({ label: d.category, cells: [d.AC, d.PY] }))}
      />
    ),
  },
  {
    name: "ExportMenu",
    element: (
      <ExportMenu filename="export" csv="a,b\n1,2">
        <button type="button">Export</button>
      </ExportMenu>
    ),
  },
  {
    name: "ChartFrame",
    element: (
      <ChartFrame width={320} height={180} fit="contain" align="left">
        {(w, h) => <div>{`${w}x${h}`}</div>}
      </ChartFrame>
    ),
  },
  {
    name: "ScrollChart",
    element: (
      <ScrollChart height={180} minWidth={600}>
        {(w, h) => <div>{`${w}x${h}`}</div>}
      </ScrollChart>
    ),
  },
  {
    name: "ChartBox",
    element: (
      <ChartBox width={600} height={200} fit="scale" minWidth={400}>
        {(w, h) => <div>{`${w}x${h}`}</div>}
      </ChartBox>
    ),
  },
  {
    name: "Skeleton",
    element: <Skeleton variant="chart" width={320} height={180} />,
  },
  {
    name: "ChartState",
    element: (
      <ChartState loading height={180}>
        <div>ready</div>
      </ChartState>
    ),
  },
];
