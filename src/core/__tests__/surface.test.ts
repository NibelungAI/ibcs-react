import { describe, expect, it } from "vitest";

import * as core from "../index";
import * as root from "../../index";

/**
 * INTENTIONAL-SURFACE GUARD.
 *
 * Every name a barrel exports is a semver promise. This test pins the runtime
 * export names of both entries - `ibcs-react/core` and the `ibcs-react` root -
 * so adding or removing one is a deliberate, reviewed act rather than a side
 * effect of an `export *`. When it fails, read the diff: if the change is
 * intended, update the snapshot in the same commit (and the docs / changeset
 * that go with a public API change); if it is not, the barrel leaked or lost
 * an export.
 *
 * LIMITATION: only runtime values (functions, constants, components) can be
 * enumerated with `Object.keys`. Type-only exports are erased at runtime and
 * therefore NOT covered here - `npx tsc --noEmit` over `src`, `demo` and the
 * README examples is what guards those.
 */
const names = (module: object): string[] => Object.keys(module).sort();

/** Root = core + the React layer; this is the React-only half of it. */
const reactOnly = names(root).filter((name) => !(name in core));

describe("public export surface", () => {
  it("ibcs-react/core exports exactly the curated maths surface", () => {
    expect(names(core)).toMatchInlineSnapshot(`
      [
        "CHART_TYPES",
        "IBCS_RULES",
        "SCATTER_PALETTE",
        "SCENARIO_KEYS",
        "azureTokens",
        "bandScale",
        "bubbleRadius",
        "buildColumnLayout",
        "buildComparisonModel",
        "buildDataTableModel",
        "cellRefOf",
        "cellVariance",
        "checkIbcs",
        "checkIbcsProps",
        "computeBarVarianceWaterfall",
        "computeBridge",
        "computeColumnVarianceWaterfall",
        "computeCombo",
        "computeGroupedVariance",
        "computeIntegratedVariance",
        "computeIsoLines",
        "computeKpi",
        "computeLevels",
        "computeLines",
        "computeMiniVariances",
        "computePieSlices",
        "computeRankingVariance",
        "computeRatioTree",
        "computeSharedScale",
        "computeStacked",
        "computeStructure",
        "computeTicks",
        "computeTree",
        "computeTrend",
        "computeVariance",
        "computeVarianceArea",
        "computeVarianceCell",
        "computeWaterfall",
        "computeWaterfallStatement",
        "computeWindow",
        "computeXyScale",
        "cvdTokens",
        "darkTokens",
        "defaultCollapsedRowIds",
        "defaultExpandedColIds",
        "defaultStructureConfig",
        "defaultTokens",
        "defaultTrendConfig",
        "defaultVarianceColumnConfig",
        "defaultWaterfallConfig",
        "flattenVisible",
        "formatPercent",
        "formatPercentPlain",
        "formatSigned",
        "formatValue",
        "greenRedTokens",
        "isReferenceBand",
        "isReferenceLine",
        "isoLinePoints",
        "lineVariance",
        "mergeTokens",
        "monoTokens",
        "niceBounds",
        "oceanTokens",
        "resolveBandPadding",
        "resolveMark",
        "resolveReference",
        "resolveReferences",
        "resolveSharedScales",
        "resolveValue",
        "rowBands",
        "sharedDomain",
        "splitForecast",
        "statementToCSV",
        "statementToDataTableRows",
        "statementToMatrix",
        "statementToStructure",
        "statementToWaterfall",
        "toCSV",
        "tokenPresetLabels",
        "tokenPresets",
        "validateChartConfig",
        "validateKpiConfig",
        "validateReportConfig",
        "vividTokens",
      ]
    `);
  });

  it("the root entry re-exports every core value", () => {
    // `export *` silently drops names that clash between two starred modules,
    // so assert containment rather than trusting the star.
    const missing = names(core).filter((name) => !(name in root));
    expect(missing, "core exports missing from the root entry").toEqual([]);
  });

  it("the root entry adds exactly the React layer on top of core", () => {
    expect(reactOnly).toMatchInlineSnapshot(`
      [
        "AreaChart",
        "BarVarianceWaterfallChart",
        "BubbleChart",
        "ChartBox",
        "ChartDataTable",
        "ChartFrame",
        "ChartState",
        "ChartTooltip",
        "ColumnVarianceWaterfallChart",
        "ComboChart",
        "ComparisonTable",
        "ConfiguredChart",
        "ConformanceReport",
        "DataTable",
        "ExportMenu",
        "GroupedVarianceChart",
        "HorizontalWaterfallChart",
        "IbcsThemeProvider",
        "IntegratedVarianceChart",
        "KpiCard",
        "LineChart",
        "MatrixTable",
        "MiniVarianceMultiples",
        "PieChart",
        "RankingVarianceChart",
        "RatioTreeChart",
        "Report",
        "ResponsiveChart",
        "ScatterChart",
        "ScrollChart",
        "Skeleton",
        "SmallMultiples",
        "Sparkline",
        "StackedChart",
        "StatementTable",
        "StructureChart",
        "TreeChart",
        "TrendChart",
        "VarianceAreaChart",
        "VarianceBar",
        "VarianceColumnChart",
        "WaterfallChart",
        "WaterfallStatementChart",
        "canCopyImage",
        "cardSurface",
        "copyPngToClipboard",
        "copySvgToClipboard",
        "downloadCSV",
        "downloadPNG",
        "downloadSVG",
        "downloadTextFile",
        "easeInOutCubic",
        "easeOutCubic",
        "easeOutQuart",
        "printSvg",
        "serializeSvg",
        "srOnly",
        "svgToPngBlob",
        "useAnimatedValue",
        "useAsyncData",
        "useChartHover",
        "useChartSelection",
        "useCountUp",
        "useDataTween",
        "useElementSize",
        "useFilters",
        "useIbcsTokens",
        "useLiveData",
        "useMountGrow",
        "usePrefersReducedMotion",
        "useStatement",
        "useStatementBridge",
        "useVariance",
        "useVariances",
      ]
    `);
  });
});
