import { useMemo } from "react";
import type { ChartConfig } from "../core/config";
import { validateChartConfig } from "../core/config";
import type { IbcsTokensOverride } from "../core/tokens";
import { VarianceColumnChart } from "./VarianceColumnChart";
import { TrendChart } from "./TrendChart";
import { StructureChart } from "./StructureChart";
import { WaterfallChart } from "./WaterfallChart";
import { StackedChart } from "./StackedChart";
import { LineChart } from "./LineChart";
import { AreaChart } from "./AreaChart";
import { ScatterChart } from "./ScatterChart";
import { BubbleChart } from "./BubbleChart";
import { ComboChart } from "./ComboChart";
import { TreeChart } from "./TreeChart";

export interface ConfiguredChartProps {
  /** A serializable chart config (typically authored as JSON). */
  config: ChartConfig;
  /** Theme overrides, deep-merged onto the defaults. */
  tokens?: IbcsTokensOverride;
  /** Rendered in place of the chart when the config fails validation. */
  renderError?: (error: string) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Render a chart from a plain JSON `ChartConfig`. This is the data-driven entry
 * point: one component, any chart type, fully described by serializable config.
 * Invalid config renders a readable message instead of throwing.
 */
export function ConfiguredChart({
  config,
  tokens,
  renderError,
  className,
  style,
}: ConfiguredChartProps) {
  const result = useMemo(() => validateChartConfig(config), [config]);

  // Config-level color overrides merge on top of any tokens prop - ONCE, for
  // every branch. Built inline per branch this was a fresh object on every
  // render, which invalidated the `useMemo(..., [tokens])` inside whichever
  // chart was mounted and re-ran its whole layout for nothing.
  const colors = result.ok ? result.config.colors : undefined;
  const mergedTokens = useMemo<IbcsTokensOverride | undefined>(
    () => (colors ? { ...tokens, color: { ...tokens?.color, ...colors } } : tokens),
    [colors, tokens],
  );

  if (!result.ok) {
    return <>{renderError ? renderError(result.error) : <ConfigError message={result.error} />}</>;
  }

  const c = result.config;
  switch (c.type) {
    case "varianceColumn": {
      return (
        <div className={className} style={style}>
          <VarianceColumnChart
            data={c.data}
            comparison={c.comparison}
            higherIsBetter={c.higherIsBetter}
            variance={c.variance}
            mark={c.mark}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "trend": {
      return (
        <div className={className} style={style}>
          <TrendChart
            data={c.data}
            comparison={c.comparison}
            higherIsBetter={c.higherIsBetter}
            variance={c.variance}
            referenceLines={c.referenceLines}
            showValueLabels={c.showValueLabels}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "structure": {
      return (
        <div className={className} style={style}>
          <StructureChart
            data={c.data}
            comparison={c.comparison}
            sort={c.sort}
            higherIsBetter={c.higherIsBetter}
            showComparison={c.showComparison}
            showShare={c.showShare}
            variance={c.variance}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "waterfall": {
      return (
        <div className={className} style={style}>
          <WaterfallChart
            data={c.data}
            scenario={c.scenario}
            comparisonData={c.comparisonData}
            higherIsBetter={c.higherIsBetter}
            showValueLabels={c.showValueLabels}
            mark={c.mark}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "stacked": {
      return (
        <div className={className} style={style}>
          <StackedChart
            data={c.data}
            series={c.series}
            orientation={c.orientation}
            showTotals={c.showTotals}
            highlight={c.highlight}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "line": {
      return (
        <div className={className} style={style}>
          <LineChart
            data={c.data}
            series={c.series}
            comparison={c.comparison}
            higherIsBetter={c.higherIsBetter}
            variance={c.variance}
            showMarkers={c.showMarkers}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "area": {
      return (
        <div className={className} style={style}>
          <AreaChart
            data={c.data}
            scenario={c.scenario}
            baseline={c.baseline}
            showMarkers={c.showMarkers}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "scatter": {
      return (
        <div className={className} style={style}>
          <ScatterChart
            data={c.data}
            xLabel={c.xLabel}
            yLabel={c.yLabel}
            isoLines={c.isoLines}
            pointRadius={c.pointRadius}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "bubble": {
      return (
        <div className={className} style={style}>
          <BubbleChart
            data={c.data}
            xLabel={c.xLabel}
            yLabel={c.yLabel}
            sizeLabel={c.sizeLabel}
            maxRadius={c.maxRadius}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "combo": {
      return (
        <div className={className} style={style}>
          <ComboChart
            data={c.data}
            secondary={c.secondary}
            secondaryKey={c.secondaryKey}
            primaryLabel={c.primaryLabel}
            secondaryLabel={c.secondaryLabel}
            secondaryFormat={c.secondaryFormat}
            comparison={c.comparison}
            higherIsBetter={c.higherIsBetter}
            showComparison={c.showComparison}
            showVariance={c.showVariance}
            showSecondaryLabels={c.showSecondaryLabels}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
    case "tree": {
      return (
        <div className={className} style={style}>
          <TreeChart
            root={c.root}
            higherIsBetter={c.higherIsBetter}
            orientation={c.orientation}
            showVariance={c.showVariance}
            width={c.width}
            height={c.height}
            format={c.format}
            title={c.title}
            tokens={mergedTokens}
          />
        </div>
      );
    }
  }
}

function ConfigError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 13,
        color: "#cf3a3a",
        background: "#fdf3f2",
        border: "1px solid #f3d3d0",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      Invalid chart config: {message}
    </div>
  );
}
