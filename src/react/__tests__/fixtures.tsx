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
  ErrorBar,
} from "../index";
import type { DataTableColumn, DataTableRow, RankingDatum } from "../../index";

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
    // Same `category` key as `series` itself - the point of the alias is that
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
  {
    // A mark, so the fixture supplies the chart svg it lives in: a horizontal
    // bar and a vertical column, each with its error bar on its own scale.
    name: "ErrorBar",
    element: (
      <svg width={480} height={140} viewBox="0 0 480 140">
        <rect x={20} y={28} width={62 * 3} height={14} fill="#54534e" />
        <ErrorBar value={62} halfWidth={9} scale={(v) => 20 + v * 3} cross={35} capSize={10} />
        <rect x={340} y={130 - 70 * 1.5} width={24} height={70 * 1.5} fill="#54534e" />
        <ErrorBar
          value={70}
          halfWidth={12}
          orientation="vertical"
          scale={(v) => 130 - v * 1.5}
          cross={352}
          capSize={12}
        />
        {/* A point: its error bar first, the point on top, so the point stays whole. */}
        <ErrorBar
          value={48}
          halfWidth={20}
          orientation="vertical"
          scale={(v) => 130 - v * 1.5}
          cross={420}
          clip={[130, 40]}
        />
        <circle cx={420} cy={130 - 48 * 1.5} r={3.5} fill="#2b2b29" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ *
 * Feature fixtures: one component in a configuration a single smoke case
 * cannot show (error bars, bands, exact decimals, caller-given words). The
 * markup, SSR, a11y and visual suites render these too; the one-case-per-
 * export coverage check reads `cases` only, so a feature case never stands in
 * for a component's plain smoke test.
 * ------------------------------------------------------------------ */

/**
 * A Top Gear ranking: each variant's DPS with its own 95% half-width, the
 * difference to the current setup with its paired one. Best set, Bracers swap,
 * Equipped, Trinket swap and Weapon swap carry the DPS and Δ ± figures of the
 * F1b-R review's table (rows 19-25), Best set and Equipped its DPS ± too; the
 * Ring swap row and the other DPS half-widths are made up for the fixture.
 */
const topGear: RankingDatum[] = [
  { label: "Best set", AC: 914.3013, base: 910.8441, acError: 0.4682, absError: 0.4621 },
  { label: "Ring swap", AC: 914.0512, base: 910.8441, acError: 0.4511, absError: 0.4402 },
  { label: "Bracers swap", AC: 910.9064, base: 910.8441, acError: 0.4744, absError: 0.1347 },
  { label: "Equipped", AC: 910.8441, base: 910.8441, acError: 0.4808, absError: 0 },
  { label: "Trinket swap", AC: 907.9623, base: 910.8441, acError: 0.4793, absError: 0.5439 },
  { label: "Weapon swap", AC: 906.2537, base: 910.8441, acError: 0.4951, absError: 0.6408 },
];

const srLatn2 = { compact: false, locale: "sr-Latn", fractionDigits: 2 } as const;

/** A Quick Sim's damage by ability: plain magnitudes (no base), with a share and casts. */
const abilityColumns: DataTableColumn[] = [
  {
    key: "dps",
    label: "DPS",
    mark: "bar",
    format: { compact: false, locale: "sr-Latn", fractionDigits: 1 },
  },
  {
    key: "share",
    label: "Udeo %",
    format: { compact: false, locale: "sr-Latn", fractionDigits: 1 },
  },
  {
    key: "casts",
    label: "Korišćenja",
    format: { compact: false, locale: "sr-Latn", fractionDigits: 1 },
  },
];
const abilityRows: DataTableRow[] = [
  {
    id: "shoot",
    label: "Shoot",
    values: { dps: 215.037, share: 23.609, casts: 41.647 },
    errors: { dps: 1.84 },
  },
  {
    id: "raptor",
    label: "Raptor Strike",
    values: { dps: 91.041, share: 9.996, casts: 30.2 },
    errors: { dps: 1.12 },
  },
  {
    id: "wing",
    label: "Wing Clip",
    values: { dps: 40.3, share: 4.425, casts: 35.156 },
    errors: { dps: 0.71 },
  },
  {
    id: "trap",
    label: "Immolation Trap",
    values: { dps: 31.5, share: 3.459, casts: 6 },
    errors: { dps: 0.94 },
  },
];

/** The Top Gear as a table: DPS ± in text, the Δ as a signed pin with its error bar and a tied band. */
const topGearColumns: DataTableColumn[] = [
  { key: "dps", label: "DPS", format: srLatn2 },
  {
    key: "delta",
    label: "Δ",
    kind: "variance",
    measure: "dps",
    base: "PL",
    mark: "pin",
    format: srLatn2,
    width: 190,
    bands: [{ from: 2.9952, to: 3.9194, label: "Izjednačeno sa najboljom" }],
  },
];
const topGearRows: DataTableRow[] = topGear.map((d) => ({
  id: d.label,
  label: d.label,
  values: { dps: { AC: d.AC, PL: d.base } },
  errors: { dps: d.acError!, delta: d.absError! },
}));

/** Engine drift (old vs new artifact): DPS per spec with its own interval, Δ with the paired one. */
const drift = [
  { category: "Hunter", AC: 910.8, PY: 909.6, acError: 0.8, absError: 0.6 },
  { category: "Ret", AC: 890.5, PY: 892.9, acError: 1.2, absError: 0.9 },
  { category: "Fire", AC: 860.1, PY: 859.8, acError: 1.0, absError: 0.7 },
];

export const featureCases: SmokeCase[] = [
  {
    name: "VarianceColumnChart-errors",
    element: (
      <VarianceColumnChart
        data={drift}
        width={400}
        height={260}
        format={{ compact: false, locale: "sr-Latn", fractionDigits: 1 }}
        labels={{ scenario: { AC: "novo", PY: "staro" } }}
      />
    ),
  },
  {
    name: "RankingVarianceChart-errors-band",
    element: (
      <RankingVarianceChart
        data={topGear}
        sortBy="value"
        format={srLatn2}
        labels={{ scenario: { AC: "DPS", PL: "trenutne" }, total: "Ukupno" }}
        bands={[{ panel: "abs", from: 2.9952, to: 3.9194, label: "Izjednačeno sa najboljom" }]}
        showTotals={false}
        width={640}
      />
    ),
  },
  {
    name: "DataTable-magnitude-bars",
    element: <DataTable columns={abilityColumns} rows={abilityRows} />,
  },
  {
    name: "DataTable-errors-band",
    element: <DataTable columns={topGearColumns} rows={topGearRows} />,
  },
];
