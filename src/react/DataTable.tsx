import React, { useId, useMemo, useState } from "react";
import {
  buildDataTableModel,
  resolveMark,
  valueMarkOf,
  type ColumnModel,
  type DataTableColumn,
  type DataTableRow,
  type DataTableSort,
  type ResolvedCell,
  type VarianceCellData,
} from "../core/datatable";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import type { IbcsLabelsOverride } from "../core/labels";
import type { ValueBand } from "../core/reference";
import type { ScenarioKey } from "../core/types";
import {
  formatInterval,
  formatPercentPlain,
  formatSigned,
  formatValue,
  percentFormatOf,
  type FormatOptions,
  type PercentFormatOptions,
} from "../core/format";
import { Sparkline } from "./Sparkline";
import { ErrorBar } from "./ErrorBar";
import { srOnly } from "./a11y";
import { useIbcsLabels, useIbcsTokens } from "./theme";
import { toIdSet } from "./internal/ids";
import { svgSafeId } from "./internal/text";
import { ValueBandRects } from "./internal/valueBand";

export interface DataTableProps {
  /** Column definitions (value / variance / sparkline). */
  columns: DataTableColumn[];
  /** Row entities/categories; may nest via `children`. */
  rows: DataTableRow[];
  /**
   * Number formatting (compact, decimals, currency, locale, exact
   * `fractionDigits`); a column's own `format` wins for its cells. Percent
   * cells follow its `locale` and `percentFractionDigits`.
   */
  format?: FormatOptions;
  /** Theme overrides (colors, scenario fills). */
  tokens?: IbcsTokensOverride;
  /**
   * The table's own words - the totals row ("Total") and the expand / collapse
   * buttons' names - merged onto `IbcsThemeProvider`'s. See `IbcsLabels`.
   */
  labels?: IbcsLabelsOverride;
  /** Append a bold, summed totals row. Default false. */
  showTotals?: boolean;
  /**
   * Sort applied on mount - the uncontrolled seed. Click a header to (re)sort;
   * click again to flip direction, a third time to clear. Ignored once `sort`
   * is provided.
   */
  defaultSort?: DataTableSort | null;
  /**
   * Sort as a CONTROLLED value (`null` = unsorted): when provided the table
   * renders exactly this sort and never mutates it - header clicks report the
   * next sort through `onSortChange` for the parent to apply.
   */
  sort?: DataTableSort | null;
  /**
   * Fired with the NEXT sort on every header activation (desc → asc → null).
   * Required for controlled mode; a plain observer when uncontrolled.
   */
  onSortChange?: (sort: DataTableSort | null) => void;
  /**
   * Group ids collapsed on mount - the uncontrolled seed (else each row's
   * `defaultCollapsed` flag). Ignored once `collapsed` is provided.
   */
  defaultCollapsed?: readonly string[];
  /**
   * Collapsed group ids as a CONTROLLED value: when provided the table renders
   * exactly this set and never mutates it - every toggle reports the next set
   * through `onCollapsedChange` for the parent to apply (URL sync, persistence,
   * cross-linked tables). Omit it for the uncontrolled behaviour.
   */
  collapsed?: ReadonlySet<string> | readonly string[];
  /**
   * Fired with the NEXT collapsed ids (sorted) whenever a group is toggled.
   * Required for controlled mode; a plain observer when uncontrolled.
   */
  onCollapsedChange?: (collapsedIds: string[]) => void;
  /** Totals row label. Wins over `labels.total`; default "Total". */
  totalsLabel?: string;
  /**
   * Cap the row-label column width (px). Longer labels are truncated with an
   * ellipsis and the full text is exposed via a `title` tooltip. Default
   * unset (labels size to content). Useful to keep a wide table compact.
   */
  maxLabelWidth?: number;
  /**
   * A short description of the table, rendered as a visually-hidden
   * `<caption>` - screen-reader users get a name for the table without any
   * visual change. Omit for a purely decorative/duplicated table.
   */
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
}

const ROW_H = 34;

/**
 * Row hover tint + the sort-header button reset, as static CSS.
 *
 * The tint deliberately lives in a stylesheet rather than in React state: a
 * `hoverId` state re-renders EVERY row (and every embedded variance svg) on
 * each mouse move between rows, which is a real cost on a long table for a
 * purely decorative effect. `tr:hover` gets the same pixels for free.
 *
 * The sort button inherits the header's font/colour/padding so wrapping the
 * label in a real `<button>` (for keyboard sorting) is visually invisible.
 */
const TABLE_CSS = `
.ibcs-dtbl tbody td, .ibcs-dtbl tbody th { transition: background 90ms }
.ibcs-dtbl tbody tr:hover td, .ibcs-dtbl tbody tr:hover th { background: rgba(0,0,0,0.025) }
.ibcs-dtbl-sort { font: inherit; color: inherit; letter-spacing: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; white-space: nowrap }
.ibcs-dtbl-sort:focus-visible { outline: 2px solid currentColor; outline-offset: 2px }
@media (prefers-reduced-motion: reduce) { .ibcs-dtbl tbody td, .ibcs-dtbl tbody th { transition: none } }
`;

export function DataTable({
  columns,
  rows,
  format = {},
  tokens: tokenOverride,
  labels,
  showTotals = false,
  defaultSort = null,
  sort: sortProp,
  onSortChange,
  defaultCollapsed,
  collapsed: collapsedProp,
  onCollapsedChange,
  totalsLabel: totalsLabelProp,
  maxLabelWidth,
  caption,
  className,
  style,
}: DataTableProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const words = useIbcsLabels(labels);
  const totalsLabel = totalsLabelProp ?? words.total;

  // Sort: internal state is the source of truth ONLY while `sort` is absent.
  const [uncontrolledSort, setUncontrolledSort] = useState<DataTableSort | null>(defaultSort);
  const sortControlled = sortProp !== undefined;
  const sort = sortControlled ? sortProp : uncontrolledSort;

  // Collapsed groups: likewise uncontrolled until `collapsed` is provided.
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState<Set<string>>(() => {
    const set = new Set<string>(defaultCollapsed ?? []);
    if (!defaultCollapsed) {
      const walk = (list: DataTableRow[]) => {
        for (const r of list) {
          if (r.defaultCollapsed) set.add(r.id);
          if (r.children) walk(r.children);
        }
      };
      walk(rows);
    }
    return set;
  });
  const collapsedControlled = collapsedProp !== undefined;
  const controlledCollapsed = useMemo(
    () => (collapsedProp === undefined ? null : toIdSet(collapsedProp)),
    [collapsedProp],
  );
  const collapsed = controlledCollapsed ?? uncontrolledCollapsed;

  /**
   * The single write path for each piece of state: controlled mode only reports
   * the next value, uncontrolled mode applies it and reports it too (observer,
   * like onChange on an uncontrolled input).
   */
  const commitCollapsed = (next: Set<string>) => {
    if (!collapsedControlled) setUncontrolledCollapsed(next);
    onCollapsedChange?.([...next].sort());
  };
  const commitSort = (next: DataTableSort | null) => {
    if (!sortControlled) setUncontrolledSort(next);
    onSortChange?.(next);
  };

  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commitCollapsed(next);
  };

  const model = useMemo(
    () =>
      buildDataTableModel(columns, rows, {
        collapsed,
        sort,
        showTotals,
        totalsLabel,
      }),
    [columns, rows, collapsed, sort, showTotals, totalsLabel],
  );

  const onSort = (key: string) => {
    const next: DataTableSort | null =
      sort?.key !== key ? { key, dir: "desc" } : sort.dir === "desc" ? { key, dir: "asc" } : null; // third click clears the sort
    commitSort(next);
  };

  const headerCell: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: tokens.color.textMuted,
    padding: "0 10px 8px",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  const allRows = model.totals ? [...model.rows, model.totals] : model.rows;

  // Subtle divider before a column that starts a new group (IBCS sets column
  // groups visually apart). Always empty for ungrouped tables.
  const divider = (cm: ColumnModel | undefined): React.CSSProperties =>
    cm?.borderLeft ? { borderLeft: `1px solid ${tokens.color.axis}` } : {};

  const groupCell: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: tokens.color.text,
    letterSpacing: 0.2,
    padding: "0 10px 6px",
    whiteSpace: "nowrap",
    userSelect: "none",
    textAlign: "center",
  };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        minWidth: 0,
        fontFamily: tokens.font.family,
        ...style,
      }}
    >
      <style>{TABLE_CSS}</style>
      {/* Horizontal-scroll wrapper: fixed-width variance/sparkline columns never
          overflow or overlap a narrow container - they scroll instead. */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table
          className="ibcs-dtbl"
          style={{ borderCollapse: "collapse", width: "100%", minWidth: "min-content" }}
        >
          {caption && <caption style={srOnly}>{caption}</caption>}
          <thead>
            {/* Top row: column-group super-headers (only when columns are grouped). */}
            {model.headerGroups && (
              <tr>
                <th
                  scope="col"
                  rowSpan={2}
                  style={{ ...headerCell, textAlign: "left", verticalAlign: "bottom" }}
                >
                  &nbsp;
                </th>
                {(() => {
                  let idx = 0;
                  return model.headerGroups.map((g, gi) => {
                    const start = model.columns[idx];
                    idx += g.span;
                    return (
                      <th
                        key={gi}
                        scope="colgroup"
                        colSpan={g.span}
                        style={{
                          ...groupCell,
                          ...divider(start),
                          borderBottom: g.label ? `1px solid ${tokens.color.rowBorder}` : undefined,
                          color: g.label ? tokens.color.text : "transparent",
                        }}
                      >
                        {g.label || " "}
                      </th>
                    );
                  });
                })()}
              </tr>
            )}
            <tr style={{ borderBottom: `2px solid ${tokens.color.text}` }}>
              {/* The label column's header lives in the group row when grouped. */}
              {!model.headerGroups && (
                <th scope="col" style={{ ...headerCell, textAlign: "left" }}>
                  &nbsp;
                </th>
              )}
              {model.columns.map((cm) => {
                const align = headerAlign(cm.column);
                const sortable = cm.kind !== "sparkline";
                const active = sort?.key === cm.column.key;
                return (
                  <th
                    key={cm.column.key}
                    scope="col"
                    aria-sort={
                      active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined
                    }
                    style={{
                      ...headerCell,
                      // When grouped, give the PL/AC sub-headers breathing room below
                      // the year-group rule so they sit balanced, not glued to the line.
                      ...(model.headerGroups ? { padding: "7px 10px 8px" } : null),
                      ...divider(cm),
                      textAlign: align,
                      width: columnWidth(cm),
                      color: active ? tokens.color.text : tokens.color.textMuted,
                    }}
                  >
                    {/* Sorting hangs off a real <button> so it is reachable (and
                      activatable with Enter/Space) by keyboard; the CSS reset
                      makes it indistinguishable from the plain header text. */}
                    {sortable ? (
                      <button
                        type="button"
                        className="ibcs-dtbl-sort"
                        onClick={() => onSort(cm.column.key)}
                      >
                        {cm.column.label}
                        {active && (
                          <span style={{ marginLeft: 4 }}>{sort!.dir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </button>
                    ) : (
                      cm.column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allRows.map((vr) => {
              const flow = vr.row.flow;
              const isResult = flow === "result" || !!vr.row.doubleRule;
              const emphasis = vr.isTotal || !!vr.row.emphasis || isResult;
              // Top rule: double for a grand-total line, 2px for a totals row, a
              // 1px solid rule above a statement subtotal/result, else the hairline.
              const borderTop = vr.row.doubleRule
                ? `3px double ${tokens.color.text}`
                : vr.isTotal
                  ? `2px solid ${tokens.color.text}`
                  : isResult
                    ? `1px solid ${tokens.color.text}`
                    : `1px solid ${tokens.color.rowBorder}`;
              return (
                <tr
                  key={vr.row.id}
                  style={{
                    height: ROW_H,
                    borderTop,
                  }}
                >
                  {/* Label cell: chevron + indentation. A row header (<th
                    scope="row">) so assistive tech announces the entity name
                    with every figure; the <th> defaults (bold, centred) are
                    overridden so the rendering matches the old <td> exactly. */}
                  <th
                    scope="row"
                    style={{
                      padding: "0 10px",
                      whiteSpace: "nowrap",
                      textAlign: "left",
                      fontWeight: 400,
                      ...(maxLabelWidth != null ? { maxWidth: maxLabelWidth } : null),
                    }}
                  >
                    <span
                      style={{
                        display: maxLabelWidth != null ? "flex" : "inline-flex",
                        alignItems: "center",
                        paddingLeft: vr.depth * 16,
                        minWidth: 0,
                      }}
                    >
                      {vr.hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggle(vr.row.id)}
                          aria-label={vr.isExpanded ? words.collapse : words.expand}
                          aria-expanded={vr.isExpanded}
                          style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            padding: 0,
                            marginRight: 4,
                            width: 12,
                            flex: "0 0 auto",
                            color: tokens.color.textMuted,
                            fontSize: 10,
                            lineHeight: 1,
                            transition: "transform 120ms",
                            transform: vr.isExpanded ? "rotate(90deg)" : "none",
                          }}
                        >
                          ▶
                        </button>
                      ) : (
                        <span style={{ width: 16, flex: "0 0 auto" }} />
                      )}
                      {flow && (
                        <span
                          aria-hidden
                          style={{
                            width: 13,
                            flex: "0 0 auto",
                            textAlign: "center",
                            marginRight: 4,
                            color: tokens.color.textMuted,
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {flowMarker(flow)}
                        </span>
                      )}
                      <span
                        title={vr.row.label}
                        style={{
                          fontSize: emphasis ? 13 : 12.5,
                          fontWeight: emphasis ? 700 : 400,
                          color:
                            vr.depth > 0 && !emphasis ? tokens.color.textMuted : tokens.color.text,
                          ...(maxLabelWidth != null
                            ? {
                                flex: "1 1 auto",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                              }
                            : null),
                        }}
                      >
                        {vr.row.label}
                      </span>
                    </span>
                  </th>

                  {/* Measure cells */}
                  {model.columns.map((cm, ci) => {
                    // One resolved cell per column, in column order.
                    const cell = vr.cells[ci];
                    return cell ? (
                      <td
                        key={cm.column.key}
                        style={{ padding: 0, width: columnWidth(cm), ...divider(cm) }}
                      >
                        <CellView
                          cell={cell}
                          cm={cm}
                          emphasis={emphasis}
                          isTotal={vr.isTotal}
                          format={format}
                          tokens={tokens}
                        />
                      </td>
                    ) : null;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- per-kind cell rendering ---------------- */

function CellView({
  cell,
  cm,
  emphasis,
  isTotal,
  format,
  tokens,
}: {
  cell: ResolvedCell;
  cm: ColumnModel;
  emphasis: boolean;
  isTotal: boolean;
  format: FormatOptions;
  tokens: IbcsTokens;
}) {
  const fmt = cm.column.format ?? format;

  if (cell.kind === "value") {
    // A bar / pin of the value itself - on the body rows only: the totals row's
    // sum has no place on the detail scale, so it keeps the plain number.
    const mark = valueMarkOf(cm.column);
    if (mark && cm.extent && !isTotal && cell.value != null) {
      return (
        <ValueMarkCell
          value={cell.value}
          error={cell.error}
          extent={cm.extent}
          mark={mark}
          scenario={cm.column.scenario ?? "AC"}
          bands={cm.column.bands}
          width={columnWidth(cm)}
          emphasis={emphasis}
          format={fmt}
          tokens={tokens}
        />
      );
    }
    const align = cm.column.align ?? "right";
    return (
      <div
        style={{
          fontSize: 12.5,
          padding: "0 10px",
          textAlign: align,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          fontWeight: emphasis ? 700 : 400,
          color: tokens.color.text,
        }}
      >
        {cell.value == null ? "" : formatInterval(cell.value, cell.error, fmt)}
      </div>
    );
  }

  if (cell.kind === "sparkline") {
    const w = cm.column.width ?? 96;
    return (
      <div
        style={{ display: "flex", justifyContent: "center", alignItems: "center", height: ROW_H }}
      >
        {cell.data.length > 0 && (
          <Sparkline
            data={cell.data}
            type={cm.column.sparkType ?? "line"}
            width={w - 16}
            height={ROW_H - 12}
            color={emphasis ? tokens.color.total : tokens.color.neutral}
          />
        )}
      </div>
    );
  }

  // variance
  if (!cell.variance) return <div style={{ height: ROW_H }} />;
  const mark = resolveMark(cm.column);
  const mode = cm.column.mode ?? "abs";

  // "none": a plain signed, impact-coloured number - the IBCS T01 numeric
  // variance column (no embedded bar/pin).
  if (mark === "none") {
    const { value, favorable } = cell.variance;
    const color =
      value === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;
    const label = varianceText(value, cell.error, mode, fmt);
    return (
      <div
        style={{
          fontSize: 12.5,
          padding: "0 10px",
          textAlign: cm.column.align ?? "right",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          fontStyle: mode === "pct" ? "italic" : "normal",
          fontWeight: emphasis ? 700 : 400,
          color,
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <VarianceCell
      data={cell.variance}
      error={cell.error}
      gutter={cm.errors === true}
      bands={isTotal ? undefined : cm.column.bands}
      domain={cm.domain}
      width={columnWidth(cm)}
      mark={mark}
      mode={mode}
      emphasis={emphasis}
      format={fmt}
      tokens={tokens}
    />
  );
}

/** Percent options for a pct cell's half-width: unsigned, same locale and digits as its value. */
function pctHalfWidthOptions(fmt: FormatOptions): PercentFormatOptions {
  const opts = percentFormatOf(fmt);
  return { ...(typeof opts === "number" ? { fractionDigits: opts } : opts), signDisplay: "auto" };
}

/**
 * A variance cell's number: the signed Δ, or the Δ% without its "%" (the
 * header carries it), followed by "± half-width" when the row has one.
 */
function varianceText(
  value: number,
  error: number | undefined,
  mode: "abs" | "pct",
  fmt: FormatOptions,
): string {
  if (mode !== "pct") return formatInterval(value, error, fmt, true);
  const label = formatPercentPlain(value / 100, percentFormatOf(fmt));
  if (error == null) return label;
  return `${label}\u00a0±\u00a0${formatPercentPlain(error / 100, pctHalfWidthOptions(fmt))}`;
}

/**
 * A value column's `mark`: the value ITSELF as a magnitude bar (or a pin) on
 * the column's shared scale, its number right-aligned beside it, with the
 * row's error bar and the column's bands. The scale spans `extent` (always
 * containing 0), so negative values grow left of a shifted zero axis.
 */
function ValueMarkCell({
  value,
  error,
  extent,
  mark,
  scenario,
  bands,
  width,
  emphasis,
  format,
  tokens,
}: {
  value: number;
  error: number | undefined;
  extent: { min: number; max: number };
  mark: "bar" | "pin";
  scenario: ScenarioKey;
  bands: readonly ValueBand[] | undefined;
  width: number;
  emphasis: boolean;
  format: FormatOptions;
  tokens: IbcsTokens;
}) {
  const hatchId = svgSafeId(useId());
  const cy = ROW_H / 2;
  const x0 = 8;
  const barMaxW = Math.max(Math.round(width * 0.5), 40);
  const lo = x0;
  const hi = x0 + barMaxW;
  const span = extent.max - extent.min || 1;
  const x = (v: number) => x0 + ((v - extent.min) / span) * barMaxW;
  const axisX = x(0);
  // A parent's aggregate can overrun the detail scale: clamp it to the edge.
  const tip = Math.min(hi, Math.max(lo, x(value)));
  const barH = emphasis ? 17 : 13;
  const style = tokens.scenario[scenario];
  const solidFill = scenario === "AC" && emphasis ? tokens.color.total : style.fill;
  const barX = Math.min(axisX, tip);
  const barW = Math.max(Math.abs(tip - axisX), 1.5);

  return (
    <svg width={width} height={ROW_H} style={{ display: "block" }}>
      <ValueBandRects
        bands={bands}
        scale={x}
        range={[lo, hi]}
        y={0}
        height={ROW_H}
        tokens={tokens}
      />
      <line
        x1={axisX}
        y1={3}
        x2={axisX}
        y2={ROW_H - 3}
        stroke={tokens.color.axis}
        strokeWidth={0.75}
      />
      {mark === "bar" && value !== 0 && style.variant === "hatch" && (
        <defs>
          <pattern
            id={hatchId}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke={style.stroke} strokeWidth="1" />
          </pattern>
        </defs>
      )}
      {mark === "bar" &&
        value !== 0 &&
        (style.variant === "solid" ? (
          <rect x={barX} y={cy - barH / 2} width={barW} height={barH} fill={solidFill} />
        ) : (
          <rect
            x={barX}
            y={cy - barH / 2}
            width={barW}
            height={barH}
            fill={style.variant === "hatch" ? `url(#${hatchId})` : tokens.color.surface}
            stroke={style.stroke}
            strokeWidth={1}
          />
        ))}
      {mark === "pin" && value !== 0 && (
        <line x1={axisX} y1={cy} x2={tip} y2={cy} stroke={style.stroke} strokeWidth={2} />
      )}
      {/* Over a bar the whisker must sit on top to stay visible; under a pin's
        dot, so the head stays whole. */}
      {error != null && (
        <ErrorBar
          value={value}
          halfWidth={error}
          scale={x}
          cross={cy}
          clip={[lo, hi]}
          capSize={mark === "bar" ? Math.round(barH * 0.7) : 9}
          format={format}
          tokens={tokens}
        />
      )}
      {mark === "pin" && <circle cx={tip} cy={cy} r={emphasis ? 4 : 3.5} fill={style.stroke} />}
      {/* The number at the value cells' size, so it lines up with plain value columns. */}
      <text
        x={width - 10}
        y={cy + 4.5}
        textAnchor="end"
        fontSize={12.5}
        fontWeight={emphasis ? 700 : 400}
        fill={tokens.color.text}
      >
        {formatValue(value, format)}
      </text>
    </svg>
  );
}

/** Statement marker glyph for a row's `flow`. */
function flowMarker(flow: "add" | "subtract" | "result"): string {
  return flow === "add" ? "+" : flow === "subtract" ? "−" : "=";
}

/**
 * Embedded variance bar/pin - the IBCS VarianceCell convention reused from
 * StatementTable: a left-axis magnitude bar for absolute deltas, a centred/
 * offset pin (with off-scale arrows) for percentages. Colour follows business
 * impact (favorable green / unfavorable red), never the raw sign.
 */
function VarianceCell({
  data,
  error,
  gutter,
  bands,
  domain,
  width,
  mark,
  mode,
  emphasis,
  format,
  tokens,
}: {
  data: VarianceCellData;
  error: number | undefined;
  /**
   * The column carries error bars: a pin then sits in a symmetric area with
   * its label right-aligned in a gutter, so no whisker or label collides.
   */
  gutter: boolean;
  bands: readonly ValueBand[] | undefined;
  domain: number;
  width: number;
  mark: "bar" | "pin";
  mode: "abs" | "pct";
  emphasis: boolean;
  format: FormatOptions;
  tokens: IbcsTokens;
}) {
  const { value, favorable, outlier } = data;
  const cy = ROW_H / 2;
  const color = value === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;
  const labelColor = mode === "pct" ? color : tokens.color.text;
  const weight = emphasis ? 700 : 400;
  const italic = mode === "pct" ? "italic" : "normal";
  const label =
    mode === "pct"
      ? formatPercentPlain(value / 100, percentFormatOf(format))
      : formatSigned(value, format);
  // The error bar names itself with the full interval (its tooltip and
  // accessible text); the printed label stays the point value.
  const errorText = error == null ? "" : varianceText(value, error, mode, format);

  // Absolute: magnitude bar from a left axis, value in an aligned right column.
  if (mark === "bar") {
    const axisX = 8;
    const barMaxW = Math.max(width * 0.42, 36);
    const barW = Math.max(Math.min(Math.abs(value) / domain, 1) * barMaxW, value === 0 ? 0 : 1.5);
    const barH = emphasis ? 17 : 13;
    // The bar's axis is its LENGTH |Δ| from 0: the whisker centres on the
    // bar's end, and a low end below 0 is cut at the axis (open end).
    const lengthX = (m: number) => axisX + (m / domain) * barMaxW;
    const range = [axisX, axisX + barMaxW] as const;
    return (
      <svg width={width} height={ROW_H} style={{ display: "block" }}>
        <ValueBandRects
          bands={bands}
          scale={lengthX}
          range={range}
          y={0}
          height={ROW_H}
          tokens={tokens}
        />
        <line
          x1={axisX}
          y1={3}
          x2={axisX}
          y2={ROW_H - 3}
          stroke={tokens.color.axis}
          strokeWidth={0.75}
        />
        {value !== 0 && (
          <rect x={axisX} y={cy - barH / 2} width={barW} height={barH} fill={color} />
        )}
        {error != null && (
          <ErrorBar
            value={Math.abs(value)}
            halfWidth={error}
            scale={lengthX}
            cross={cy}
            clip={range}
            capSize={Math.round(barH * 0.7)}
            label={errorText}
            tokens={tokens}
          />
        )}
        <text
          x={width - 6}
          y={cy + 3.5}
          textAnchor="end"
          fontSize={11}
          fontStyle={italic}
          fontWeight={weight}
          fill={labelColor}
        >
          {label}
        </text>
      </svg>
    );
  }

  // Percent: pin (or off-scale arrow) on a left-offset axis so positives get
  // room. With error bars in the column: a centred, symmetric pin area and the
  // label in a right-hand gutter (as ComparisonTable lays its pins out).
  const labelRoom = Math.max(46, Math.round(width * 0.32));
  const areaRight = width - labelRoom - 6;
  const axisX = gutter ? Math.round((8 + areaRight) / 2) : Math.round(width * 0.4);
  const posRoom = gutter ? (areaRight - 8) / 2 : width - axisX - 50;
  const negRoom = gutter ? (areaRight - 8) / 2 : axisX - 10;
  const dir = value >= 0 ? 1 : -1;
  const frac = Math.min(Math.abs(value) / domain, 1);

  // The pin's two sides may have their own lengths: one scale per side.
  const posR = Math.max(posRoom, 8);
  const negR = Math.max(negRoom, 8);
  const pinX = (v: number) => axisX + (v / domain) * (v >= 0 ? posR : negR);
  const pinRange = [axisX - negR, axisX + posR] as const;

  let markX: number;
  let labelX: number;
  let anchor: "start" | "end";
  if (gutter) {
    markX = outlier
      ? dir > 0
        ? axisX + posR
        : axisX - negR
      : axisX + dir * frac * (dir > 0 ? posR : negR);
    labelX = width - 6;
    anchor = "end";
  } else if (outlier) {
    markX = dir > 0 ? width - 8 : 8;
    labelX = dir > 0 ? width - 16 : 18;
    anchor = dir > 0 ? "end" : "start";
  } else {
    markX = axisX + dir * frac * Math.max(dir > 0 ? posRoom : negRoom, 8);
    labelX = dir > 0 ? markX + 6 : markX - 6;
    anchor = dir > 0 ? "start" : "end";
  }

  return (
    <svg width={width} height={ROW_H} style={{ display: "block" }}>
      <ValueBandRects
        bands={bands}
        scale={pinX}
        range={pinRange}
        y={0}
        height={ROW_H}
        tokens={tokens}
      />
      <line
        x1={axisX}
        y1={3}
        x2={axisX}
        y2={ROW_H - 3}
        stroke={tokens.color.axis}
        strokeWidth={0.75}
      />
      {!outlier && value !== 0 && (
        <line x1={axisX} y1={cy} x2={markX} y2={cy} stroke={color} strokeWidth={2} />
      )}
      {/* The whisker under the dot, so the pin's head stays whole. */}
      {!outlier && error != null && (
        <ErrorBar
          value={value}
          halfWidth={error}
          scale={pinX}
          cross={cy}
          clip={pinRange}
          capSize={9}
          label={errorText}
          tokens={tokens}
        />
      )}
      {!outlier && value !== 0 && <circle cx={markX} cy={cy} r={3.5} fill={tokens.color.text} />}
      {outlier && (
        <polygon
          points={`${markX},${cy} ${markX - dir * 8},${cy - 4.5} ${markX - dir * 8},${cy + 4.5}`}
          fill={color}
        />
      )}
      <text
        x={labelX}
        y={cy + 3.5}
        textAnchor={anchor}
        fontSize={11}
        fontStyle={italic}
        fontWeight={weight}
        fill={labelColor}
      >
        {label}
      </text>
    </svg>
  );
}

/* ---------------- layout helpers ---------------- */

function headerAlign(col: DataTableColumn): "left" | "right" | "center" {
  if (col.align) return col.align;
  const kind = col.kind ?? "value";
  if (kind === "sparkline") return "center";
  if (kind === "variance") {
    // Numeric ("none") variances are plain right-aligned figures; pins centre.
    if (resolveMark(col) === "none") return "right";
    return (col.mode ?? "abs") === "pct" ? "center" : "right";
  }
  return "right";
}

function columnWidth(cm: ColumnModel): number {
  if (cm.column.width != null) return cm.column.width;
  if (cm.extent) return 160;
  if (cm.kind === "variance") {
    const mark = resolveMark(cm.column);
    if (mark === "none") return 76;
    return mark === "pin" ? 150 : 108;
  }
  if (cm.kind === "sparkline") return 110;
  return 96;
}
