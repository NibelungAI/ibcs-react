/**
 * The `ibcs-react/core` entry — the framework-agnostic maths surface.
 *
 * This barrel is CURATED, not a mirror of `src/core/*`: every name below is a
 * public API promise (semver, docs, deprecation cycles), so it lists exports
 * explicitly instead of `export *`. The rule of thumb:
 *
 *  - IN: every `compute*` layout function and the input/result types it needs
 *    (the "core for Vue/Svelte/plain SVG" story), plus config, validation,
 *    tokens, formatting, conformance, report and statement adapters.
 *  - OUT: internal plumbing a renderer happens to share — tiny geometry/array
 *    helpers, value-resolution utilities, parsers and layout intermediates.
 *    They stay exported from their own module, so `src/react` (and anything
 *    else in-repo) keeps importing them by path; they are simply not part of
 *    the package's public contract.
 *
 * `src/core/__tests__/surface.test.ts` snapshots the runtime names below — a
 * failure there means the public surface changed, which should be deliberate.
 */

/* ./types — statement model: scenario keys, lines, flat + waterfall rows */
export { SCENARIO_KEYS } from "./types";
export type {
  FlatRow,
  LineFlow,
  ScenarioDatum,
  ScenarioKey,
  StatementLine,
  Variance,
  VarianceColumnSpec,
  WaterfallBar,
  WaterfallLayout,
  WaterfallRow,
} from "./types";

/* ./tokens — IBCS design tokens and the built-in theme presets */
export {
  azureTokens,
  cvdTokens,
  darkTokens,
  defaultTokens,
  greenRedTokens,
  mergeTokens,
  monoTokens,
  oceanTokens,
  tokenPresets,
  vividTokens,
} from "./tokens";
export type { IbcsScenarioStyle, IbcsTokens, IbcsTokensOverride } from "./tokens";

/* ./format — number, percent and signed-value formatting */
export { formatPercent, formatPercentPlain, formatSigned, formatValue } from "./format";
export type { CompactSuffixes, FormatOptions } from "./format";

/* ./bandScale — categorical band placement (padding-based, D3-compatible) */
export { bandScale, resolveBandPadding } from "./bandScale";
export type { BandPadding, BandScale } from "./bandScale";

/* ./variance — variance maths over the statement model */
export { computeVariance, lineVariance, resolveValue } from "./variance";

/* ./layout — statement layouts: flatten, then flow (waterfall) or stock (levels) */
export { computeLevels, computeWaterfall, flattenVisible } from "./layout";

/* ./trend — time-series column layout with a comparison scenario */
export { computeTrend } from "./trend";
export type { ComputeTrendOptions, TrendCell, TrendDatum, TrendLayout } from "./trend";

/* ./structure — part-to-whole (100%) bar layout */
export { computeStructure } from "./structure";
export type {
  ComputeStructureOptions,
  StructureDatum,
  StructureLayout,
  StructureSegment,
} from "./structure";

/* ./virtualize — windowing maths for long tables */
export { computeWindow } from "./virtualize";
export type { WindowOptions, WindowRange } from "./virtualize";

/* ./export — statement to CSV / matrix serialization */
export { statementToCSV, statementToMatrix, toCSV } from "./export";
export type { StatementCsvOptions } from "./export";

/* ./config — serializable chart configs, their defaults and validation */
export {
  CHART_TYPES,
  defaultStructureConfig,
  defaultTrendConfig,
  defaultVarianceColumnConfig,
  defaultWaterfallConfig,
  validateChartConfig,
} from "./config";
export type {
  AreaChartConfig,
  BubbleChartConfig,
  CategoryDatum,
  ChartConfig,
  ChartType,
  ComboChartConfig,
  ConfigValidation,
  LineChartConfig,
  ScatterChartConfig,
  StackedChartConfig,
  StructureChartConfig,
  TreeChartConfig,
  TrendChartConfig,
  VarianceColumnChartConfig,
  WaterfallChartConfig,
} from "./config";

/* ./kpi — KPI value + delta maths and config validation */
export { computeKpi, validateKpiConfig } from "./kpi";
export type { KpiConfig, KpiDelta, KpiResult, KpiValues } from "./kpi";

/* ./report — declarative report configs, validation and shared scales */
export { resolveSharedScales, validateReportConfig } from "./report";
export type {
  ChartBlock,
  KpiBlock,
  ReportBlock,
  ReportConfig,
  ReportValidation,
  SharedScaleGroupResult,
  StatementBlock,
  StatementBlockConfig,
  StructuredTitle,
  TableBlock,
  TableBlockConfig,
  TextBlock,
} from "./report";

/* ./waterfall — standalone bridge (waterfall) layout */
export { computeBridge } from "./waterfall";
export type { BridgeBar, BridgeLayout, ComputeBridgeOptions, WaterfallDatum } from "./waterfall";

/* ./smallMultiples — shared scales and mini variance panels */
export {
  computeMiniVariances,
  computeSharedScale,
  niceBounds,
  sharedDomain,
} from "./smallMultiples";
export type {
  ComputeMiniVariancesOptions,
  MiniDatum,
  MiniGroupInput,
  MiniVarianceBar,
  MiniVarianceGroup,
  MiniVarianceLayout,
  SharedDomainOptions,
  SharedDomainPanel,
  SharedDomainResult,
  SharedScale,
} from "./smallMultiples";

/* ./datatable — the data-table model (rows, columns, variance cells) */
export { buildDataTableModel, computeVarianceCell, resolveMark } from "./datatable";
export type {
  ColumnModel,
  DataTableCell,
  DataTableColumn,
  DataTableHeaderGroup,
  DataTableModel,
  DataTableOptions,
  DataTableRow,
  DataTableSort,
  DataTableViewRow,
  ResolvedCell,
  VarianceCellData,
} from "./datatable";

/* ./adapters — one statement model into the other views' inputs */
export { statementToDataTableRows, statementToStructure, statementToWaterfall } from "./adapters";
export type {
  StatementToDataTableRowsOptions,
  StatementToStructureOptions,
  StatementToWaterfallOptions,
} from "./adapters";

/* ./comparisonTable — side-by-side comparison table model */
export { buildComparisonModel } from "./comparisonTable";
export type {
  ComparisonColumnModel,
  ComparisonHeaderCell,
  ComparisonModel,
  ComparisonOptions,
  ComparisonRowKind,
  ComparisonViewRow,
} from "./comparisonTable";

/* ./conformance — the IBCS / ISO 24896 rule set and linter */
export { checkIbcs, IBCS_RULES } from "./conformance";
export type { IbcsFinding, IbcsRule } from "./conformance";

/* ./stacked — stacked column layout */
export { computeStacked } from "./stacked";
export type {
  ComputeStackedOptions,
  StackedColumn,
  StackedDatum,
  StackedLayout,
  StackedSegment,
  StackedSeries,
} from "./stacked";

/* ./lineArea — line / area series layout and the actual-forecast split */
export { computeLines, splitForecast } from "./lineArea";
export type {
  ComputeLinesOptions,
  ForecastSplit,
  LineDatum,
  LinePoint,
  LineSeries,
  LinesLayout,
  VariancePoint,
} from "./lineArea";

/* ./xy — cartesian scales, ticks, bubble radii and iso-lines */
export {
  bubbleRadius,
  computeIsoLines,
  computeTicks,
  computeXyScale,
  isoLinePoints,
  SCATTER_PALETTE,
} from "./xy";
export type {
  BubbleDatum,
  ComputeXyScaleOptions,
  IsoLinePointsOptions,
  ScatterDatum,
  XyDomain,
  XyPadding,
  XyScale,
} from "./xy";

/* ./combo — column + line combination layout */
export { computeCombo } from "./combo";
export type {
  ComboCell,
  ComboDatum,
  ComboLayout,
  ComboSecondaryDatum,
  ComputeComboOptions,
} from "./combo";

/* ./tree — hierarchy (org / driver tree) layout */
export { computeTree } from "./tree";
export type { ComputeTreeOptions, TreeLayout, TreeLayoutNode, TreeLink, TreeNode } from "./tree";

/* ./matrixTable — matrix (rows x periods x scenarios) table model */
export {
  buildColumnLayout,
  cellRefOf,
  cellVariance,
  defaultCollapsedRowIds,
  defaultExpandedColIds,
} from "./matrixTable";
export type {
  CellVariance,
  ColumnHeaderCell,
  ColumnLayout,
  LeafColumn,
  MatrixCellClick,
  MatrixCellScenario,
  MatrixFlow,
  MatrixPeriod,
  MatrixRow,
  MatrixValues,
  ScenarioHeaderCell,
} from "./matrixTable";

/* ./pie — pie / donut slice layout (discouraged by IBCS; here for completeness) */
export { computePieSlices } from "./pie";
export type { ComputePieOptions, PieLayout, PieSlice } from "./pie";

/* ./varianceArea — actual-vs-plan area layout with signed fill segments */
export { computeVarianceArea } from "./varianceArea";
export type {
  VarianceAreaDatum,
  VarianceAreaLayout,
  VarianceAreaOptions,
  VarianceAreaPlot,
  VarianceAreaPoint,
  VarianceAreaSegment,
  VarianceAreaTotal,
  XY,
} from "./varianceArea";

/* ./integratedVariance — year-to-date variance with full-year totals */
export { computeIntegratedVariance } from "./integratedVariance";
export type {
  ComputeIntegratedOptions,
  FySegment,
  FySegmentInput,
  FyTotalInput,
  FyTotalLayout,
  IntegratedCell,
  IntegratedDatum,
  IntegratedLayout,
} from "./integratedVariance";

/* ./rankingVariance — ranked bars with their variance lane */
export { computeRankingVariance } from "./rankingVariance";
export type {
  RankingDatum,
  RankingRow,
  RankingTotalRow,
  RankingVarianceLayout,
  RankingVarianceOptions,
} from "./rankingVariance";

/* ./groupedVariance — grouped (clustered) columns with variance */
export { computeGroupedVariance } from "./groupedVariance";
export type {
  ComputeGroupedOptions,
  GroupedCell,
  GroupedComparison,
  GroupedDatum,
  GroupedLayout,
} from "./groupedVariance";

/* ./reference — reference lines / bands resolved against a plot box */
export { isReferenceBand, isReferenceLine, resolveReference, resolveReferences } from "./reference";
export type {
  AxisScales,
  PlotBox,
  Reference,
  ReferenceBand,
  ReferenceLine,
  ResolvedReference,
  ResolvedReferenceBand,
  ResolvedReferenceLine,
} from "./reference";

/* ./waterfallStatement — a statement rendered as lane-by-lane waterfall rows */
export { computeWaterfallStatement } from "./waterfallStatement";
export type {
  ComputeWaterfallStatementOptions,
  WaterfallStatementLayout,
  WaterfallStatementLine,
  WaterfallStatementRow,
  WsLaneBar,
} from "./waterfallStatement";

/* ./barVarianceWaterfall — horizontal variance bridge over categories */
export { computeBarVarianceWaterfall } from "./barVarianceWaterfall";
export type {
  BarVarianceDatum,
  BarVarianceRow,
  BarVarianceTotals,
  BarVarianceWaterfallLayout,
  BarVarianceWaterfallOptions,
} from "./barVarianceWaterfall";

/* ./columnVarianceWaterfall — vertical variance bridge with end totals */
export { computeColumnVarianceWaterfall } from "./columnVarianceWaterfall";
export type {
  ColumnVarianceCell,
  ColumnVarianceDatum,
  ColumnVarianceLayout,
  ComputeColumnVarianceOptions,
  EndSegment,
  EndSegmentInput,
  EndTotalInput,
  PriorTotalInput,
  ResolvedEndTotal,
} from "./columnVarianceWaterfall";

/* ./ratioTree — driver / ratio tree layout (KPI decomposition) */
export { computeRatioTree } from "./ratioTree";
export type {
  ComputeRatioTreeOptions,
  RatioLayoutNode,
  RatioLink,
  RatioNode,
  RatioOp,
  RatioTreeLayout,
} from "./ratioTree";

/* ./horizontalWaterfall — row bands for the horizontal bridge (rest is ./waterfall) */
export { rowBands } from "./horizontalWaterfall";
export type { RowBand, RowBandLayout } from "./horizontalWaterfall";
