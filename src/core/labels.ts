/**
 * The words the components write on their own, as one replaceable dictionary.
 *
 * A chart's numbers and names come from the caller; everything else it writes
 * - the scenario codes in headers and end labels, the totals row, "vs", the
 * column names of a screen-reader table, button and menu names, empty and
 * error states - is listed here. Pass a whole or partial dictionary through
 * `IbcsThemeProvider`'s `labels` (every component below it) or a component's
 * own `labels` prop (that instance); a component's specific word props
 * (`totalsLabel`, `baseLabel`, `emptyMessage`, ...) still win over both.
 *
 * The defaults are the library's IBCS English, byte for byte as 1.4 wrote
 * them (the words of components added since, such as `HistogramChart`'s, are
 * new), so nothing changes until you pass words of your own.
 *
 * Two things live elsewhere on purpose:
 *  - the text for a missing number ("n/a") belongs to the number format -
 *    `FormatOptions.notAvailable` - since the formatter writes it;
 *  - each chart's generated accessible description ("Line chart of 4 periods
 *    across 2 series") is a sentence, not a word: replace it with the chart's
 *    `ariaLabel` prop.
 *
 * Entries with `{placeholders}` are templates; the component fills them in.
 */

import type { ScenarioKey } from "./types";
import type { DeepPartial } from "./tokens";

/** Names of the export menu's trigger and items (see `ExportMenu`). */
export interface IbcsExportLabels {
  /** The trigger button's tooltip. Default "Export". */
  button: string;
  /** The trigger button's accessible name. Default "Export chart". */
  menu: string;
  /** Download as SVG. Default "SVG". */
  svg: string;
  /** Download as PNG. Default "PNG". */
  png: string;
  /** Download as CSV. Default "CSV". */
  csv: string;
  /** Download as JSON. Default "JSON". */
  json: string;
  /** Copy the image to the clipboard. Default "Copy PNG". */
  copyPng: string;
  /** Copy the SVG markup to the clipboard. Default "Copy SVG". */
  copySvg: string;
  /** Print the chart. Default "Print". */
  print: string;
}

/** Every word the components write themselves. See the module comment. */
export interface IbcsLabels {
  /**
   * The IBCS scenario codes wherever a component writes one: column and panel
   * headers ("AC", "ΔPY", "ΔPY%"), line end labels ("AC 150"), legends,
   * tooltips and screen-reader tables. Default the codes themselves.
   *
   * A header never goes blank: where an empty word would name a column or a
   * row, the scenario's `scenarioTitle` is written, then its code. To show a
   * line's value without its name, set `endLabel` to `"{value}"` instead.
   */
  scenario: Record<ScenarioKey, string>;
  /**
   * Scenario names spelled out, shown as the tooltip of a scenario column
   * header (`MatrixTable`). Default "Actual", "PY", "Plan / budget",
   * "Forecast" - the 1.4 tooltips (PY never had a longer one).
   */
  scenarioTitle: Record<ScenarioKey, string>;
  /** A variance header: the difference to a base ("ΔPY"). Default "Δ{base}". */
  delta: string;
  /** A relative variance header ("ΔPY%"). Default "Δ{base}%". */
  deltaPct: string;
  /**
   * A line's end label (`LineChart`, `AreaChart`): its scenario word and its
   * last value. Default "{name} {value}"; `"{value}"` writes the value alone.
   */
  endLabel: string;
  /** The totals row, total bars and total columns. Default "Total". */
  total: string;
  /** The total-variance row of `VarianceAreaChart`'s table. Default "Total variance". */
  totalVariance: string;
  /** The current-series column of `TrendChart`'s table. Default "Current". */
  current: string;
  /** A plain value column or tooltip row (pie, structure, trees, small multiples). Default "Value". */
  value: string;
  /** Numbered value columns of `SmallMultiples`' table. Default "Value {n}". */
  valueNumbered: string;
  /** Share of the whole (pie, structure, a histogram class's share of n). Default "Share". */
  share: string;
  /** The number of values in a histogram class (table column, tooltip). Default "Count". */
  count: string;
  /**
   * `HistogramChart`'s mean label: `{value}` is the mean with its interval,
   * and the interval's level when given ("910.8 ± 0.9 (95%)"). Default
   * "Mean {value}".
   */
  mean: string;
  /**
   * `HistogramChart`'s caption of its spread band: `{range}` is "from–to".
   * Default "Middle half {range}", which names the default spread (the first
   * to the third quartile); a spread of your own needs its own words here.
   */
  spread: string;
  /** `HistogramChart`'s number of values. Default "n = {n}". */
  sampleSize: string;
  /** The latest value of `RatioTreeChart`. Default "Latest". */
  latest: string;
  /** A bridge step's own size (waterfalls). Default "Contribution". */
  contribution: string;
  /** A bridge's running total (waterfalls). Default "Running total". */
  runningTotal: string;
  /** A bridge step's variance to its comparison (waterfalls). Default "Δ vs comparison". */
  deltaVsComparison: string;
  /** The secondary (line) measure of `ComboChart`'s table. Default "Secondary". */
  secondary: string;
  /** The group column of scatter and bubble tables. Default "Group". */
  group: string;
  /**
   * The size column of `BubbleChart`'s table when no `sizeLabel` is given.
   * Default "Size". (Its X / Y columns are notation; name the axes with
   * `xLabel` / `yLabel`.)
   */
  size: string;
  /** An unlabelled scatter point. Default "Point {n}". */
  point: string;
  /** An unlabelled bubble. Default "Item {n}". */
  item: string;
  /** An unnamed small-multiples panel. Default "Panel {n}". */
  panel: string;
  /**
   * The accessible name of each `MiniVarianceMultiples` panel. Default
   * "{label}: variance by category, shared scale.".
   */
  miniPanel: string;
  /**
   * `MiniVarianceMultiples`' shared-scale caption (`sharedScale` +
   * `showScaleHint`). Default "Shared scale - full bar height ≈ ±{value} vs {base}".
   */
  sharedScaleHint: string;
  /** The pie slice that collects the small ones. Default "Rest". */
  rest: string;
  /** A legend's overflow row. Default "+{count} more". */
  more: string;
  /** `ScatterChart`'s down-sampling note. Default "showing {shown} of {total} (sampled)". */
  sampled: string;
  /** `PieChart`'s note when negative slices were left out. Default "negative values omitted". */
  negativeOmitted: string;
  /** Between a difference and its base ("+1.2M vs PY"). Default "vs". */
  versus: string;
  /** Between two scenarios in a variance column's spoken name ("AC minus PL"). Default "minus". */
  minus: string;
  /** The unit of a ratio's difference (`KpiCard` with `unit: "ratio"`). Default "pp". */
  percentagePoints: string;
  /**
   * A selectable mark's accessible name (charts with `onSelect`): "Select Q1,
   * AC 120". Default "Select {label}, {value}".
   */
  selectMark: string;
  /** A selectable stacked column's accessible name. Default "Select {label}, total {value}". */
  selectTotal: string;
  /** Expand a row (button name). Default "Expand". */
  expand: string;
  /** Collapse a row (button name). Default "Collapse". */
  collapse: string;
  /** Expand a `MatrixTable` row (button name). Default "Expand row". */
  expandRow: string;
  /** Collapse a `MatrixTable` row (button name). Default "Collapse row". */
  collapseRow: string;
  /** Expand every group (`StatementTable` toolbar). Default "Expand all". */
  expandAll: string;
  /** Collapse every group (`StatementTable`, `MatrixTable` toolbars). Default "Collapse all". */
  collapseAll: string;
  /** Expand every period (`MatrixTable` toolbar). Default "Expand all periods". */
  expandAllPeriods: string;
  /** An empty `MatrixTable` cell's spoken value. Default "no value". */
  noValue: string;
  /** `MatrixTable`'s variance column header. Default "ΔBdg". */
  deltaBudget: string;
  /** Loading placeholders (`Skeleton`, `ChartState`). Default "Loading…". */
  loading: string;
  /** `ChartState`'s empty state. Default "No data". */
  noData: string;
  /** `ChartState`'s error heading. Default "Couldn’t load data". */
  loadError: string;
  /** `ChartState`'s error detail when the error carries no message. Default "Something went wrong". */
  error: string;
  /** `ChartState`'s retry button. Default "Try again". */
  retry: string;
  /** `ConformanceReport` with no findings. Default "Conforms to IBCS / ISO 24896 - no findings.". */
  conformant: string;
  /** `ConformanceReport`'s severity tags. Default "error" / "warning" / "info". */
  severity: { error: string; warning: string; info: string };
  /** `ExportMenu`'s trigger and items. */
  export: IbcsExportLabels;
}

/** The 1.4 words, byte for byte, and the words of components added since (`count`, `mean`, `spread`, `sampleSize`). */
export const defaultLabels: IbcsLabels = {
  scenario: { AC: "AC", PY: "PY", PL: "PL", FC: "FC" },
  scenarioTitle: { AC: "Actual", PY: "PY", PL: "Plan / budget", FC: "Forecast" },
  delta: "Δ{base}",
  deltaPct: "Δ{base}%",
  endLabel: "{name} {value}",
  total: "Total",
  totalVariance: "Total variance",
  current: "Current",
  value: "Value",
  valueNumbered: "Value {n}",
  share: "Share",
  count: "Count",
  mean: "Mean {value}",
  spread: "Middle half {range}",
  sampleSize: "n = {n}",
  latest: "Latest",
  contribution: "Contribution",
  runningTotal: "Running total",
  deltaVsComparison: "Δ vs comparison",
  secondary: "Secondary",
  group: "Group",
  size: "Size",
  point: "Point {n}",
  item: "Item {n}",
  panel: "Panel {n}",
  miniPanel: "{label}: variance by category, shared scale.",
  sharedScaleHint: "Shared scale - full bar height ≈ ±{value} vs {base}",
  rest: "Rest",
  more: "+{count} more",
  sampled: "showing {shown} of {total} (sampled)",
  negativeOmitted: "negative values omitted",
  versus: "vs",
  minus: "minus",
  percentagePoints: "pp",
  selectMark: "Select {label}, {value}",
  selectTotal: "Select {label}, total {value}",
  expand: "Expand",
  collapse: "Collapse",
  expandRow: "Expand row",
  collapseRow: "Collapse row",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  expandAllPeriods: "Expand all periods",
  noValue: "no value",
  deltaBudget: "ΔBdg",
  loading: "Loading…",
  noData: "No data",
  loadError: "Couldn’t load data",
  error: "Something went wrong",
  retry: "Try again",
  conformant: "Conforms to IBCS / ISO 24896 - no findings.",
  severity: { error: "error", warning: "warning", info: "info" },
  export: {
    button: "Export",
    menu: "Export chart",
    svg: "SVG",
    png: "PNG",
    csv: "CSV",
    json: "JSON",
    copyPng: "Copy PNG",
    copySvg: "Copy SVG",
    print: "Print",
  },
};

/**
 * The shape of the `labels` prop: any subset of {@link IbcsLabels}, merged
 * onto the active dictionary by {@link mergeLabels}.
 */
export type IbcsLabelsOverride = DeepPartial<IbcsLabels>;

/** Copy `override`'s defined entries over `base` (an explicit `undefined` keeps the base word). */
function assignDefined<T extends object>(base: T, override: Partial<T> | undefined): T {
  if (!override) return base;
  const out = { ...base };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const value = override[key];
    if (value !== undefined) out[key] = value as T[keyof T];
  }
  return out;
}

/**
 * Merge a partial dictionary onto a base one (group by group). The base
 * defaults to {@link defaultLabels}, so overrides compose:
 * `mergeLabels({ total: "Ukupno" }, srLabels)`.
 */
export function mergeLabels(
  override?: IbcsLabelsOverride,
  base: IbcsLabels = defaultLabels,
): IbcsLabels {
  if (!override) return base;
  const { scenario, scenarioTitle, severity, export: exportLabels, ...words } = override;
  return {
    ...assignDefined(base, words as Partial<IbcsLabels>),
    scenario: assignDefined(base.scenario, scenario),
    scenarioTitle: assignDefined(base.scenarioTitle, scenarioTitle),
    severity: assignDefined(base.severity, severity),
    export: assignDefined(base.export, exportLabels),
  };
}

/**
 * Fill a template's `{name}` placeholders: `fillLabel("Point {n}", { n: 3 })`
 * → "Point 3". A placeholder without a value is left as written.
 */
export function fillLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/**
 * The scenario words as headers - column and panel headers, legend entries,
 * tooltip rows, screen-reader table columns - never empty: an empty word falls
 * back to the scenario's `scenarioTitle`, then to its code. Internal plumbing.
 */
export function scenarioHeadings(words: IbcsLabels): Record<ScenarioKey, string> {
  const heading = (key: ScenarioKey) => words.scenario[key] || words.scenarioTitle[key] || key;
  return { AC: heading("AC"), PY: heading("PY"), PL: heading("PL"), FC: heading("FC") };
}

/** "ΔPY" / "ΔPY%": a variance header from the `delta` / `deltaPct` templates. Internal plumbing. */
export function deltaHeading(words: IbcsLabels, base: string, pct = false): string {
  return fillLabel(pct ? words.deltaPct : words.delta, { base });
}

/**
 * The tooltip caption 1.4 wrote with a space ("Δ PY": `StatementTable`'s row
 * tooltip, `RatioTreeChart`'s node tooltip): byte-identical while `delta` is
 * the default, the caller's `delta` template once they set one. Internal
 * plumbing.
 */
export function deltaCaption(words: IbcsLabels, base: string): string {
  return words.delta === defaultLabels.delta ? `Δ ${base}` : deltaHeading(words, base);
}

/**
 * A line's end label from the `endLabel` template: "AC 150"; an empty name or
 * a "{value}" template leaves the value alone, with no dangling space.
 * Internal plumbing.
 */
export function endLabelText(words: IbcsLabels, name: string, value: string): string {
  return fillLabel(words.endLabel, { name, value }).trim();
}
