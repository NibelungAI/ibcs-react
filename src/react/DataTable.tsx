import React, { useMemo, useState } from "react";
import {
  buildDataTableModel,
  resolveMark,
  type ColumnModel,
  type DataTableColumn,
  type DataTableRow,
  type DataTableSort,
  type ResolvedCell,
  type VarianceCellData,
} from "../core/datatable";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import { formatValue, formatSigned, formatPercentPlain, type FormatOptions } from "../core/format";
import { Sparkline } from "./Sparkline";
import { srOnly } from "./a11y";
import { useIbcsTokens } from "./theme";
import { toIdSet } from "./internal/ids";

export interface DataTableProps {
  /** Column definitions (value / variance / sparkline). */
  columns: DataTableColumn[];
  /** Row entities/categories; may nest via `children`. */
  rows: DataTableRow[];
  /** Number formatting (compact, decimals, currency, locale). */
  format?: FormatOptions;
  /** Theme overrides (colors, scenario fills). */
  tokens?: IbcsTokensOverride;
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
  /** Totals row label. Default "Total". */
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
  showTotals = false,
  defaultSort = null,
  sort: sortProp,
  onSortChange,
  defaultCollapsed,
  collapsed: collapsedProp,
  onCollapsedChange,
  totalsLabel = "Total",
  maxLabelWidth,
  caption,
  className,
  style,
}: DataTableProps) {
  const tokens = useIbcsTokens(tokenOverride);

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
                          aria-label={vr.isExpanded ? "Collapse" : "Expand"}
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
  format,
  tokens,
}: {
  cell: ResolvedCell;
  cm: ColumnModel;
  emphasis: boolean;
  format: FormatOptions;
  tokens: IbcsTokens;
}) {
  const fmt = cm.column.format ?? format;

  if (cell.kind === "value") {
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
        {cell.value == null ? "" : formatValue(cell.value, fmt)}
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
    const label = mode === "pct" ? formatPercentPlain(value / 100) : formatSigned(value, fmt);
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
  domain,
  width,
  mark,
  mode,
  emphasis,
  format,
  tokens,
}: {
  data: VarianceCellData;
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
  const label = mode === "pct" ? formatPercentPlain(value / 100) : formatSigned(value, format);

  // Absolute: magnitude bar from a left axis, value in an aligned right column.
  if (mark === "bar") {
    const axisX = 8;
    const barMaxW = Math.max(width * 0.42, 36);
    const barW = Math.max(Math.min(Math.abs(value) / domain, 1) * barMaxW, value === 0 ? 0 : 1.5);
    const barH = emphasis ? 17 : 13;
    return (
      <svg width={width} height={ROW_H} style={{ display: "block" }}>
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

  // Percent: pin (or off-scale arrow) on a left-offset axis so positives get room.
  const axisX = Math.round(width * 0.4);
  const posRoom = width - axisX - 50;
  const negRoom = axisX - 10;
  const dir = value >= 0 ? 1 : -1;
  const frac = Math.min(Math.abs(value) / domain, 1);

  let markX: number;
  let labelX: number;
  let anchor: "start" | "end";
  if (outlier) {
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
  if (cm.kind === "variance") {
    const mark = resolveMark(cm.column);
    if (mark === "none") return 76;
    return mark === "pin" ? 150 : 108;
  }
  if (cm.kind === "sparkline") return 110;
  return 96;
}
