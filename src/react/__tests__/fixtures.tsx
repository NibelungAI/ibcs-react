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
  HistogramChart,
  TimelineChart,
  RangeBarChart,
} from "../index";
import type {
  DataTableColumn,
  DataTableRow,
  RankingDatum,
  RowIcon,
  TimelineRow,
} from "../../index";

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

/**
 * A deterministic, roughly normal sample (a simulation's DPS per fight): the
 * mean of four LCG uniforms (Irwin-Hall), scaled. Exact IEEE arithmetic only,
 * so every platform bins it the same way.
 */
function fightSample(n: number, mean: number, sd: number, seed: number): number[] {
  let s = seed;
  const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: n }, () => mean + sd * (u() + u() + u() + u() - 2) * Math.sqrt(3));
}

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
  {
    // Raw values: binned by the rule, the middle half as the default spread.
    name: "HistogramChart",
    element: <HistogramChart values={fightSample(1000, 910, 30, 11)} width={400} height={240} />,
  },
  {
    // Two rows: casts as ticks, a buff as a span.
    name: "TimelineChart",
    element: (
      <TimelineChart
        rows={[
          { label: "Cast", ticks: [1, 4, 7] },
          { label: "Buff", spans: [{ from: 2, to: 6 }] },
        ]}
        width={400}
      />
    ),
  },
  {
    // Two ranges with their marks, on one value axis.
    name: "RangeBarChart",
    element: (
      <RangeBarChart
        data={[
          { label: "A", from: 80, to: 120, mark: 100 },
          { label: "B", from: 90, to: 130, mark: 112 },
        ]}
        width={400}
      />
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

/**
 * Row icons for the fixtures: plain svg glyphs drawn here as 56 px `data:`
 * URIs, so every suite renders them offline and the same way. Not game art.
 */
function glyph(background: string, shape: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect width="56" height="56" fill="${background}"/>${shape}</svg>`,
  )}`;
}
const icons = {
  arrow: glyph(
    "#24382c",
    '<path d="M13 43 L41 15 M27 15 H41 V29" stroke="#d3e6b5" stroke-width="5" fill="none"/>',
  ),
  blade: glyph(
    "#2f3d4a",
    '<path d="M15 41 L40 16" stroke="#e9dcb0" stroke-width="6" stroke-linecap="round"/><path d="M13 33 L23 43" stroke="#c7a35a" stroke-width="5"/>',
  ),
  flame: glyph(
    "#4a2a1f",
    '<path d="M28 10 C40 24 40 34 28 46 C16 34 18 24 28 10Z" fill="#f0a23a"/>',
  ),
  paw: glyph(
    "#3a3026",
    '<circle cx="28" cy="33" r="9" fill="#d9c3a0"/><circle cx="17" cy="21" r="5" fill="#d9c3a0"/><circle cx="28" cy="16" r="5" fill="#d9c3a0"/><circle cx="39" cy="21" r="5" fill="#d9c3a0"/>',
  ),
  ring: glyph(
    "#3d2f4a",
    '<circle cx="28" cy="30" r="12" fill="none" stroke="#e2c46a" stroke-width="6"/><circle cx="28" cy="16" r="4" fill="#9fd3ff"/>',
  ),
  greatsword: glyph(
    "#2b3442",
    '<path d="M28 8 V40" stroke="#dfe6ee" stroke-width="7"/><path d="M18 40 H38 M28 40 V49" stroke="#c7a35a" stroke-width="5"/>',
  ),
};
/** The item qualities' frame colours used here (both hold 4.5:1 on white as text). */
const EPIC = "#a335ee";
const RARE = "#0070dd";

/** A Quick Sim's damage by ability, with a spell icon per row and the pet's abilities grouped under it. */
const iconAbilityRows: DataTableRow[] = [
  {
    id: "shoot",
    label: "Shoot",
    icon: { src: icons.arrow, naturalSize: 56 },
    values: { dps: 215.037, casts: 41.647 },
  },
  {
    id: "raptor",
    label: "Raptor Strike",
    icon: { src: icons.blade, naturalSize: 56 },
    values: { dps: 91.041, casts: 30.2 },
  },
  {
    id: "wolf",
    label: "Wolf",
    icon: { src: icons.paw, naturalSize: 56 },
    values: {},
    children: [
      {
        id: "bite",
        label: "Bite",
        icon: { src: icons.paw, naturalSize: 56 },
        values: { dps: 48.2, casts: 22.4 },
      },
      {
        id: "claw",
        label: "Claw",
        icon: { src: icons.paw, naturalSize: 56 },
        values: { dps: 30.9, casts: 41.1 },
      },
    ],
  },
  // An 18 px file: drawn at 18, not stretched to the table's 20.
  {
    id: "trap",
    label: "Immolation Trap",
    icon: { src: icons.flame, naturalSize: 18 },
    values: { dps: 31.5, casts: 6 },
  },
  // No icon: an empty slot keeps the label aligned.
  { id: "melee", label: "Melee", values: { dps: 20.07, casts: 52.3 } },
];
const iconAbilityColumns: DataTableColumn[] = [
  { key: "dps", label: "DPS", mark: "bar", format: { compact: false, fractionDigits: 1 } },
  { key: "casts", label: "Casts", format: { compact: false, fractionDigits: 1 } },
];

/** Top Gear: single-item swaps named in their quality's colour, and the best set with the chips of the items it changes. */
const ringChip: RowIcon = {
  src: icons.ring,
  naturalSize: 56,
  border: EPIC,
  alt: "Signet of Embers",
};
const swordChip: RowIcon = {
  src: icons.greatsword,
  naturalSize: 56,
  border: RARE,
  alt: "Runed Greatsword",
};
const topGearIcons: RankingDatum[] = [
  {
    label: "Best set",
    AC: 914.3013,
    base: 910.8441,
    acError: 0.4682,
    absError: 0.4621,
    icon: [ringChip, swordChip],
  },
  {
    label: "Signet of Embers",
    labelColor: EPIC,
    AC: 914.0512,
    base: 910.8441,
    acError: 0.4511,
    absError: 0.4402,
    icon: { ...ringChip, alt: "" },
  },
  { label: "Equipped", AC: 910.8441, base: 910.8441, acError: 0.4808, absError: 0 },
  {
    label: "Runed Greatsword",
    labelColor: RARE,
    AC: 906.2537,
    base: 910.8441,
    acError: 0.4951,
    absError: 0.6408,
    icon: { ...swordChip, alt: "" },
  },
];

/** 6,000 fights: their mean with a 95% half-width (1.96 standard errors), computed here as an engine would. */
const fights = fightSample(6000, 910.8, 30, 7);
const fightsMean = fights.reduce((a, b) => a + b, 0) / fights.length;
const fightsSd = Math.sqrt(
  fights.reduce((a, b) => a + (b - fightsMean) ** 2, 0) / (fights.length - 1),
);
const fightsHalf = (1.959964 * fightsSd) / Math.sqrt(fights.length);

/**
 * One fight of 180 s, as a combat log's shaper would hand it over (made-up
 * moments): auto shots every 2.9 s, Aimed Shot and Multi-Shot with their
 * cooldowns as waiting spans, Rapid Fire's 15 s and its 5 min cooldown, a
 * proc and a potion as active spans, and three numbered notes.
 */
const autoShots = Array.from({ length: 63 }, (_, i) => Math.round(i * 29) / 10);
const aimedShots = Array.from({ length: 17 }, (_, i) => Math.round(15 + i * 104) / 10);
const multiShots = Array.from({ length: 17 }, (_, i) => Math.round(46 + i * 104) / 10);
const fightRows: TimelineRow[] = [
  { label: "Auto Shot", icon: { src: icons.arrow, naturalSize: 56 }, ticks: autoShots },
  {
    label: "Aimed Shot",
    icon: { src: icons.arrow, naturalSize: 56 },
    ticks: aimedShots,
    spans: aimedShots.map((t) => ({ from: t, to: t + 6, kind: "waiting" as const })),
  },
  {
    label: "Multi-Shot",
    icon: { src: icons.arrow, naturalSize: 56 },
    ticks: multiShots,
    spans: multiShots.map((t) => ({ from: t, to: t + 10, kind: "waiting" as const })),
  },
  {
    label: "Rapid Fire",
    icon: { src: icons.flame, naturalSize: 56 },
    ticks: [30],
    spans: [
      { from: 30, to: 45 },
      { from: 30, to: 330, kind: "waiting" },
    ],
  },
  {
    label: "Quick Shots",
    spans: [
      { from: 8, to: 20 },
      { from: 41, to: 53 },
      { from: 77, to: 89 },
      { from: 118, to: 130 },
      { from: 161, to: 173 },
    ],
  },
  { label: "Haste Potion", ticks: [60], spans: [{ from: 60, to: 75 }] },
];

/** Twenty runs of one character; three gear changes called out, and one more than the room above the line holds. */
const runDps = [
  884.1, 886.0, 885.2, 887.9, 899.8, 901.2, 900.4, 903.0, 902.1, 904.6, 905.0, 914.9, 916.2, 915.0,
  917.7, 918.3, 919.4, 921.1, 931.2, 930.4,
];

/** DPS over one fight every 3 s (made up), and a fan of all fights per moment: two nested bands. */
const fightSeconds = Array.from({ length: 61 }, (_, i) => i * 3);
const fightDps = fightSeconds.map(
  (t, i) =>
    Math.round((910 + 140 * Math.exp(-t / 25) * Math.cos(i / 2.2) - (i > 40 ? 12 : 0)) * 10) / 10,
);
const fanEdge = (k: number, spread: number) =>
  fightSeconds.map(
    (t) => Math.round((910 + k * (spread * Math.exp(-t / 40) + spread / 7)) * 10) / 10,
  );

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
  {
    name: "DataTable-icons",
    element: <DataTable columns={iconAbilityColumns} rows={iconAbilityRows} showTotals />,
  },
  {
    name: "RankingVarianceChart-icons",
    element: (
      <RankingVarianceChart
        data={topGearIcons}
        sortBy="value"
        baseLabel="Equipped"
        format={{ compact: false, fractionDigits: 2 }}
        labels={{ scenario: { AC: "DPS" } }}
        showTotals={false}
        width={640}
      />
    ),
  },
  {
    // The mean's interval against the middle half of the fights, in sr-Latn
    // with one digit and the caller's words.
    name: "HistogramChart-mean-spread",
    element: (
      <HistogramChart
        title="DPS po borbi"
        values={fights}
        mean={{ value: fightsMean, halfWidth: fightsHalf, level: 0.95 }}
        format={{ compact: false, locale: "sr-Latn", fractionDigits: 1 }}
        labels={{
          mean: "prosek {value}",
          spread: "srednja polovina borbi {range}",
          sampleSize: "{n} borbi",
          count: "Borbi",
          share: "Udeo",
        }}
        width={480}
        height={280}
      />
    ),
  },
  {
    // Twelve classes as an engine would return them (made-up figures, n =
    // 1,894), hatched (FC), with a spread of the caller's - the 10th to the
    // 90th percentile - named in the caller's words.
    name: "HistogramChart-engine-bins",
    element: (
      <HistogramChart
        bins={{
          start: 850,
          width: 10,
          counts: [4, 19, 61, 152, 288, 401, 395, 301, 170, 72, 25, 6],
        }}
        mean={{ value: 909.6, halfWidth: 0.7, level: 0.95 }}
        spread={{ from: 877.2, to: 942.4, label: "10th to 90th percentile {range}" }}
        scenario="FC"
        format={{ compact: false, fractionDigits: 1 }}
        width={480}
        height={240}
      />
    ),
  },
  {
    // One fight: casts as ticks, cooldowns as waiting lines, buffs as bars,
    // spell icons, a clock axis and three numbered notes.
    name: "TimelineChart-annotations",
    element: (
      <TimelineChart
        title="One of 6,000 fights: an example, not a guide"
        timeFormat="clock"
        domain={[0, 180]}
        rows={fightRows}
        annotations={[
          { at: 30, row: 3, text: "Rapid Fire: 15 s of 40% faster shots" },
          { at: 60, text: "The potion while Quick Shots is up" },
          { at: 165.5, row: 1, text: "Mana runs low: one Aimed Shot is skipped" },
        ]}
        width={480}
      />
    ),
  },
  {
    // Each variant's fights: the 10th to the 90th percentile and the mean,
    // the items' chips and quality colours in the row labels.
    name: "RangeBarChart-spread",
    element: (
      <RangeBarChart
        title="DPS of each variant's fights"
        data={[
          { label: "Best set", from: 870.2, to: 952.6, mark: 914.3, icon: [ringChip, swordChip] },
          {
            label: "Signet of Embers",
            labelColor: EPIC,
            from: 869.9,
            to: 952.1,
            mark: 914.1,
            icon: { ...ringChip, alt: "" },
          },
          { label: "Equipped", from: 866.5, to: 948.9, mark: 910.8 },
          {
            label: "Runed Greatsword",
            labelColor: RARE,
            from: 862.0,
            to: 946.4,
            mark: 906.3,
            icon: { ...swordChip, alt: "" },
          },
        ]}
        format={{ compact: false, fractionDigits: 1 }}
        labels={{ rangeLow: "p10", rangeHigh: "p90" }}
        width={480}
      />
    ),
  },
  {
    // The precision ladder's GTM form: the estimate ± its half-width after
    // each wave, narrowing, in sr-Latn at the digits the narrowest range needs.
    name: "RangeBarChart-ladder",
    element: (
      <RangeBarChart
        orientation="columns"
        title="Procena se sužava sa svakim talasom"
        data={[
          { label: "Talas 1", from: 902.1, to: 919.5, mark: 910.8 },
          { label: "Talas 2", from: 905.0, to: 917.2, mark: 911.1 },
          { label: "Talas 3", from: 907.9, to: 914.1, mark: 911.0 },
          { label: "Talas 4", from: 909.5, to: 912.6, mark: 911.05 },
          { label: "Talas 5", from: 910.3, to: 911.8, mark: 911.07 },
        ]}
        format={{ locale: "sr-Latn" }}
        labels={{
          rangeLow: "procena − polovina",
          rangeHigh: "procena + polovina",
          rangeMark: "procena",
        }}
        width={480}
        height={260}
      />
    ),
  },
  {
    // GTM p. 4: gear changes called out on a run of results; the fourth has no
    // room left above the line, so it is numbered and written under the chart.
    name: "LineChart-callouts",
    element: (
      <LineChart
        title="DPS across 20 runs"
        data={runDps.map((v, i) => ({ category: `${i + 1}`, AC: v }))}
        format={{ compact: false, fractionDigits: 1 }}
        callouts={[
          { index: 4, label: "Run 5: T1 helm\n899.8" },
          { index: 11, label: "Run 12: Signet of Embers\n914.9" },
          { index: 17, label: "Run 18: Runed Greatsword\n921.1" },
          { index: 18, label: "Run 19: the best set\n931.2" },
        ]}
        width={480}
        height={260}
      />
    ),
  },
  {
    // DPS over one fight with a fan of all fights per moment: the 10th to the
    // 90th percentile and the middle half, captioned and tied to their edges.
    name: "LineChart-fan",
    element: (
      <LineChart
        title="DPS over one fight, against all fights"
        data={fightSeconds.map((t, i) => ({ category: `${t}`, AC: fightDps[i]! }))}
        format={{ compact: false, fractionDigits: 0 }}
        fans={[
          { from: fanEdge(-1, 210), to: fanEdge(1, 240), label: "10th to 90th percentile" },
          { from: fanEdge(-1, 90), to: fanEdge(1, 100), label: "Middle half" },
        ]}
        references={[{ axis: "x", kind: "band", from: 10, to: 15, label: "Rapid Fire" }]}
        width={480}
        height={260}
      />
    ),
  },
  {
    // A trend of runs with two gear changes called out above their columns.
    name: "TrendChart-callouts",
    element: (
      <TrendChart
        title="DPS per run"
        data={runDps.slice(0, 13).map((v, i) => ({ category: `R${i + 1}`, AC: v }))}
        variance="none"
        referenceLines={[]}
        format={{ compact: false, fractionDigits: 0 }}
        callouts={[
          { index: 4, label: "T1 helm" },
          { index: 11, label: "Signet of Embers" },
        ]}
        width={480}
        height={260}
      />
    ),
  },
];
