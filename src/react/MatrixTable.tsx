import React, { useMemo, useState } from "react";
import type { ScenarioKey } from "../core/types";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import { formatValue, formatSigned, type FormatOptions } from "../core/format";
import { srOnly } from "./a11y";
import { useIbcsTokens } from "./theme";
import { toIdSet } from "./internal/ids";
import {
  type MatrixRow,
  type MatrixPeriod,
  type MatrixValues,
  type ColumnHeaderCell,
  type MatrixCellScenario,
  type MatrixCellClick,
  flattenMatrixRows,
  buildColumnLayout,
  defaultCollapsedRowIds,
  defaultExpandedColIds,
  resolveCell,
  cellVariance,
  cellRefOf,
} from "../core/matrixTable";

export interface MatrixTableProps {
  /** Row tree - a statement (P&L), with flow markers and drill-down. */
  rows: MatrixRow[];
  /** Period tree - Year → Quarter → Month, expanding in place. */
  columns: MatrixPeriod[];
  /** `values[rowId][periodId][scenario]` lookup. */
  values: MatrixValues;
  /** Default scenario sub-column order for leaves that don't override. Default ["PL","AC"]. */
  scenarios?: ScenarioKey[];
  /** Add a ΔBudget (AC − PL) column to every leaf period. Default false. */
  showVariance?: boolean;
  /** Which scenario is "actual" / "base" for the variance. Default {actual:"AC", base:"PL"}. */
  varianceScenarios?: { actual: ScenarioKey; base: ScenarioKey };
  /** Number formatting (compact M/K, decimals, currency). */
  format?: FormatOptions;
  /** Theme tokens (colors). Merged onto the defaults; never hardcode colors. */
  tokens?: IbcsTokensOverride;
  /**
   * Row ids expanded on mount - the uncontrolled seed. Default: all except
   * `defaultCollapsed` rows. Note the polarity: unlike StatementTable/DataTable
   * (which track a COLLAPSED set) the matrix names what is OPEN, because its
   * periods deliberately start collapsed - a matrix opens Year by Year.
   */
  defaultExpandedRows?: readonly string[];
  /**
   * Period ids expanded on mount - the uncontrolled seed. Default: those with
   * `defaultExpanded`. Expanded (not collapsed) ids, per the note above.
   */
  defaultExpandedCols?: readonly string[];
  /**
   * Expanded row ids as a CONTROLLED value: when provided the matrix renders
   * exactly this set and never mutates it - every toggle reports the next set
   * through `onExpandedRowsChange` for the parent to apply (URL sync,
   * persistence, cross-linked views). Omit it for the uncontrolled behaviour.
   */
  expandedRows?: ReadonlySet<string> | readonly string[];
  /** Fired with the NEXT expanded row ids (sorted) on every row toggle. */
  onExpandedRowsChange?: (ids: string[]) => void;
  /**
   * Expanded period ids as a CONTROLLED value - same contract as
   * `expandedRows`, for the period columns.
   */
  expandedCols?: ReadonlySet<string> | readonly string[];
  /**
   * Fired with the NEXT expanded period ids (sorted) on a period toggle or the
   * Expand all / Collapse all buttons. Required for controlled mode; a plain
   * observer when uncontrolled.
   */
  onExpandedColsChange?: (ids: string[]) => void;
  /** Cap table height (px) → vertical scroll with a sticky header. */
  maxHeight?: number;
  /** Freeze the first (row-label) column during horizontal scroll. Default true. */
  stickyFirstColumn?: boolean;
  /** Width of the sticky label column in px. Default 240. */
  labelWidth?: number;
  /** Show an "Expand all / Collapse all" toolbar for the period columns. Default false. */
  columnExpandControls?: boolean;
  /**
   * Fired when a value sub-cell (AC / comparison / Δ) is clicked. Turns every
   * value cell into a click target (e.g. to attach a comment). The payload
   * carries the row/period ids and labels, the scenario ("DELTA" for the Δ
   * cell) and the cell's value.
   */
  onCellClick?: (cell: MatrixCellClick) => void;
  /**
   * Decorate individual cells. Called per value cell with its `cellRef`
   * (`cellRefOf(rowId, periodId, scenario)`); return `{ ribbon: true }` to draw
   * a small corner marker - e.g. on cells that carry a comment.
   */
  cellDecorations?: (cellRef: string) => { ribbon?: boolean } | undefined;
  /** Optional className per value cell (by `cellRef`) - for flash / selected state. */
  getCellClassName?: (cellRef: string) => string | undefined;
  /** Colour of the cell ribbon marker. Default a blue (#2f6fed). */
  ribbonColor?: string;
  /**
   * A short description of the matrix, rendered as a visually-hidden
   * `<caption>` - a name for screen-reader users, no visual change.
   */
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SCENARIO_LABEL: Record<ScenarioKey, string> = { AC: "AC", PY: "PY", PL: "PL", FC: "FC" };

const DEFAULT_SCENARIOS: ScenarioKey[] = ["PL", "AC"];
const SUBCOL_W = 62; // width of one scenario sub-column
const VAR_W = 72; // width of a ΔBudget column
const GROUP_GAP = 18; // whitespace between year groups (no vertical lines)
const HEADER_ROW_H = 26; // fixed height per header row → cumulative sticky offsets

/**
 * On a phone, freezing the label column eats most of the screen and the frozen
 * column overlapping the scrolled cells reads awkwardly - so below 640px the
 * label column un-freezes and scrolls with the rest.
 */
const STICKY_CSS = `@media (max-width:640px){.ibcs-mtx-lbl{position:static !important;left:auto !important;}}`;

/**
 * The period-header toggle is a real `<button>` (keyboard reachable, with a
 * spoken "Expand Q1" name) that must look exactly like the header text it
 * replaced - hence the full reset to inherited typography.
 */
const MATRIX_CSS = `
.ibcs-mtx-hbtn { font: inherit; color: inherit; letter-spacing: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap }
.ibcs-mtx-hbtn:focus-visible, .ibcs-mtx-cell:focus-visible { outline: 2px solid currentColor; outline-offset: -2px }
`;

/** Every row id that has children (any depth) - the expandable rows. */
function expandableRowIds(rows: MatrixRow[]): string[] {
  const ids: string[] = [];
  const walk = (rs: MatrixRow[]) => {
    for (const r of rs) {
      if (r.children?.length) {
        ids.push(r.id);
        walk(r.children);
      }
    }
  };
  walk(rows);
  return ids;
}

/** Corner marker drawn on a decorated cell (e.g. one carrying a comment). */
function Ribbon({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 0,
        height: 0,
        borderTop: `8px solid ${color}`,
        borderLeft: "8px solid transparent",
      }}
    />
  );
}

/** Spoken name of a value column: a scenario, or the variance pair for "DELTA". */
function scenarioName(
  scenario: MatrixCellScenario,
  varianceScenarios: { actual: ScenarioKey; base: ScenarioKey },
): string {
  return scenario === "DELTA"
    ? `${SCENARIO_LABEL[varianceScenarios.actual]} minus ${SCENARIO_LABEL[varianceScenarios.base]}`
    : SCENARIO_LABEL[scenario];
}

export function MatrixTable({
  rows,
  columns,
  values,
  scenarios = DEFAULT_SCENARIOS,
  showVariance = false,
  varianceScenarios = { actual: "AC", base: "PL" },
  format = {},
  tokens: tokenOverride,
  defaultExpandedRows,
  defaultExpandedCols,
  expandedRows: expandedRowsProp,
  onExpandedRowsChange,
  expandedCols: expandedColsProp,
  onExpandedColsChange,
  maxHeight,
  stickyFirstColumn = true,
  labelWidth = 240,
  columnExpandControls = false,
  onCellClick,
  cellDecorations,
  getCellClassName,
  ribbonColor = "#2f6fed",
  caption,
  className,
  style,
}: MatrixTableProps) {
  const tokens = useIbcsTokens(tokenOverride);

  // Rows are tracked internally as the INVERSE (a collapsed set) because that is
  // what `flattenMatrixRows` consumes; the props stay in expanded terms.
  const allExpandableRowIds = useMemo(() => expandableRowIds(rows), [rows]);

  const [uncontrolledCollapsedRows, setUncontrolledCollapsedRows] = useState<Set<string>>(() => {
    if (defaultExpandedRows) {
      // Everything not listed as expanded that has children starts collapsed.
      const expanded = new Set(defaultExpandedRows);
      const collapsed = new Set<string>();
      const walk = (rs: MatrixRow[]) => {
        for (const r of rs) {
          if (r.children?.length && !expanded.has(r.id)) collapsed.add(r.id);
          if (r.children) walk(r.children);
        }
      };
      walk(rows);
      return collapsed;
    }
    return new Set(defaultCollapsedRowIds(rows));
  });
  const rowsControlled = expandedRowsProp !== undefined;
  const controlledCollapsedRows = useMemo(() => {
    if (expandedRowsProp === undefined) return null;
    const expanded = toIdSet(expandedRowsProp);
    return new Set(allExpandableRowIds.filter((id) => !expanded.has(id)));
  }, [expandedRowsProp, allExpandableRowIds]);
  const collapsedRows = controlledCollapsedRows ?? uncontrolledCollapsedRows;

  // Expanded COLUMNS (period ids).
  const [uncontrolledExpandedCols, setUncontrolledExpandedCols] = useState<Set<string>>(
    () => new Set(defaultExpandedCols ?? defaultExpandedColIds(columns)),
  );
  const colsControlled = expandedColsProp !== undefined;
  const controlledExpandedCols = useMemo(
    () => (expandedColsProp === undefined ? null : toIdSet(expandedColsProp)),
    [expandedColsProp],
  );
  const expandedCols = controlledExpandedCols ?? uncontrolledExpandedCols;

  /**
   * The single write path per axis: every toggle / expand-all / collapse-all
   * funnels through here, so controlled and uncontrolled mode cannot drift.
   * Controlled mode only reports the next value; uncontrolled mode applies it
   * and reports it too (observer, like onChange on an uncontrolled input).
   * Row callbacks are translated back to EXPANDED ids - the prop's polarity.
   */
  const commitCollapsedRows = (next: Set<string>) => {
    if (!rowsControlled) setUncontrolledCollapsedRows(next);
    onExpandedRowsChange?.(allExpandableRowIds.filter((id) => !next.has(id)).sort());
  };
  const commitExpandedCols = (next: Set<string>) => {
    if (!colsControlled) setUncontrolledExpandedCols(next);
    onExpandedColsChange?.([...next].sort());
  };

  const toggleRow = (id: string) => {
    const next = new Set(collapsedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commitCollapsedRows(next);
  };

  // All period ids that have children (any depth) - for whole-tree expand. So a
  // reader can open EVERY year→quarter→month at once, not click them one by one.
  const allExpandableColIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (ps: MatrixPeriod[]) => {
      for (const p of ps) {
        if (p.children?.length) {
          ids.push(p.id);
          walk(p.children);
        }
      }
    };
    walk(columns);
    return ids;
  }, [columns]);
  const expandAllCols = () => commitExpandedCols(new Set(allExpandableColIds));
  const collapseAllCols = () => commitExpandedCols(new Set());
  const allColsExpanded =
    allExpandableColIds.length > 0 && allExpandableColIds.every((id) => expandedCols.has(id));
  const allColsCollapsed = expandedCols.size === 0;

  const toggleCol = (id: string) => {
    const next = new Set(expandedCols);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commitExpandedCols(next);
  };

  const flatRows = useMemo(() => flattenMatrixRows(rows, collapsedRows), [rows, collapsedRows]);

  const layout = useMemo(
    () =>
      buildColumnLayout(columns, {
        expanded: expandedCols,
        defaultScenarios: scenarios,
        showVariance,
      }),
    [columns, expandedCols, scenarios, showVariance],
  );

  const fmt = (v?: number) => (v == null || !Number.isFinite(v) ? "" : formatValue(v, format));

  /* ----------------------------- shared styles ----------------------------- */

  const sticky = stickyFirstColumn;
  const labelColBase: React.CSSProperties = sticky
    ? { position: "sticky", left: 0, zIndex: 2, background: tokens.color.surface }
    : {};

  // Every header row is a fixed height so the period rows (year / quarter /
  // month) and the scenario row can each stick at a *cumulative* top offset and
  // stack under one another instead of all collapsing onto top:0 (which hid the
  // month labels while scrolling). box-sizing keeps padding inside that height.
  const headerCellBase: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: tokens.color.textMuted,
    whiteSpace: "nowrap",
    background: tokens.color.surface,
    height: HEADER_ROW_H,
    boxSizing: "border-box",
  };

  const numCell: React.CSSProperties = {
    fontSize: 12.5,
    padding: "0 8px",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    color: tokens.color.text,
  };

  // Each header level sticks at its own cumulative offset so the full header -
  // year, quarter, month AND the AC/PY/ΔBdg row - stays frozen while the body
  // scrolls. Without the per-level `top`, every row would pin to 0 and overlap.
  const stickyTopAt = (level: number): React.CSSProperties =>
    maxHeight != null ? { position: "sticky", top: level * HEADER_ROW_H, zIndex: 3 } : {};

  // The label column header should sit above both the period and scenario rows.
  const labelHeaderZ: React.CSSProperties = sticky ? { zIndex: 4 } : {};

  const periodRows = layout.headerRows; // arrays per level
  const headerRowCount = periodRows.length; // = maxLevel + 1

  // Per value-cell interaction wiring: a stable `data-cell-ref`, the optional
  // click handler, a className, and any decoration (the ribbon marker). Shared
  // by the scenario cells and the Δ cell so both behave identically.
  const interactive = onCellClick != null;
  const cellAttrs = (
    scenario: MatrixCellScenario,
    rowId: string,
    rowLabel: string,
    periodId: string,
    periodLabel: string,
    value: number | null,
    text: string,
  ) => {
    const ref = cellRefOf(rowId, periodId, scenario);
    const onClick = onCellClick
      ? () => onCellClick({ rowId, periodId, scenario, value, rowLabel, periodLabel })
      : undefined;
    // A clickable <td> is a button in all but name, so give it the role, a tab
    // stop, Enter/Space activation and a spoken name (row + period + column +
    // value) - otherwise the interaction is mouse-only and silent.
    const activation: React.TdHTMLAttributes<HTMLTableCellElement> = onClick
      ? {
          role: "button",
          tabIndex: 0,
          "aria-label": `${rowLabel}, ${periodLabel}, ${scenarioName(scenario, varianceScenarios)}: ${text || "no value"}`,
          onKeyDown: (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            if (e.key === " ") e.preventDefault(); // Space would scroll the page
            onClick();
          },
        }
      : {};
    return {
      "data-cell-ref": ref,
      className:
        [getCellClassName?.(ref), onClick ? "ibcs-mtx-cell" : undefined]
          .filter(Boolean)
          .join(" ") || undefined,
      onClick,
      activation,
      ribbon: cellDecorations?.(ref)?.ribbon ?? false,
    };
  };

  /* ------------------------------- render ------------------------------- */

  const colBtn = (disabled: boolean): React.CSSProperties => ({
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 6,
    border: `1px solid ${tokens.color.rowBorder}`,
    background: tokens.color.surface,
    color: disabled ? tokens.color.zero : tokens.color.textMuted,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div
      className={className}
      style={{
        fontFamily: tokens.font.family,
        // `min-width: 0` lets the table shrink - and therefore its inner
        // horizontal scroll engage - when it sits in a flex or grid cell (a
        // dashboard panel). Without it the flex item's default `min-width: auto`
        // is the table's full width, so a wide matrix overflows or squashes its
        // columns instead of scrolling. No effect in a normal block context.
        minWidth: 0,
        ...style,
      }}
    >
      <style>{sticky ? MATRIX_CSS + STICKY_CSS : MATRIX_CSS}</style>
      {columnExpandControls && allExpandableColIds.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button
            type="button"
            onClick={expandAllCols}
            disabled={allColsExpanded}
            style={colBtn(allColsExpanded)}
          >
            Expand all periods
          </button>
          <button
            type="button"
            onClick={collapseAllCols}
            disabled={allColsCollapsed}
            style={colBtn(allColsCollapsed)}
          >
            Collapse all
          </button>
        </div>
      )}
      <div
        style={{
          overflowX: "auto",
          overflowY: maxHeight != null ? "auto" : "visible",
          maxHeight,
          border: `1px solid ${tokens.color.gridline}`,
          borderRadius: 8,
        }}
      >
        <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
          {caption && <caption style={srOnly}>{caption}</caption>}
          <thead>
            {/* Period header rows (year → quarter → month super-headers). */}
            {periodRows.map((cells, level) => (
              <tr key={`ph-${level}`}>
                {level === 0 && (
                  <th
                    scope="col"
                    rowSpan={headerRowCount + 1}
                    className={sticky ? "ibcs-mtx-lbl" : undefined}
                    style={{
                      ...headerCellBase,
                      ...labelColBase,
                      ...stickyTopAt(0),
                      // The frozen top-left corner must sit above BOTH the sticky
                      // header row and the sticky label column (applied last so
                      // its z-index wins the merge). It spans every header row.
                      ...labelHeaderZ,
                      textAlign: "left",
                      verticalAlign: "bottom",
                      minWidth: labelWidth,
                      maxWidth: labelWidth,
                      padding: "0 12px 6px",
                      borderBottom: `2px solid ${tokens.color.text}`,
                    }}
                  >
                    &nbsp;
                  </th>
                )}
                {cells.map((cell) => (
                  <PeriodHeader
                    key={cell.key}
                    cell={cell}
                    tokens={tokens}
                    stickyTop={stickyTopAt(level)}
                    onToggle={toggleCol}
                    headerCellBase={headerCellBase}
                  />
                ))}
              </tr>
            ))}
            {/* Scenario sub-header row. */}
            <tr>
              {layout.leaves.map((leaf) => (
                <React.Fragment key={`sc-${leaf.period.id}`}>
                  {leaf.scenarios.map((scn, si) => (
                    <th
                      key={`sc-${leaf.period.id}-${scn}`}
                      scope="col"
                      style={{
                        ...headerCellBase,
                        ...stickyTopAt(headerRowCount),
                        textAlign: "right",
                        padding: "2px 8px 6px",
                        paddingLeft: si === 0 && leaf.startsGap ? GROUP_GAP + 8 : 8,
                        borderBottom: `2px solid ${tokens.color.text}`,
                        fontStyle: scn === "FC" ? "italic" : "normal",
                        ...(scn === "FC" ? hatchStyle(tokens) : null),
                      }}
                      title={
                        scn === "FC"
                          ? "Forecast"
                          : scn === "PL"
                            ? "Plan / budget"
                            : scn === "AC"
                              ? "Actual"
                              : scn
                      }
                    >
                      {SCENARIO_LABEL[scn]}
                    </th>
                  ))}
                  {showVariance && (
                    <th
                      scope="col"
                      style={{
                        ...headerCellBase,
                        ...stickyTopAt(headerRowCount),
                        textAlign: "right",
                        padding: "2px 8px 6px",
                        borderBottom: `2px solid ${tokens.color.text}`,
                        color: tokens.color.textMuted,
                      }}
                      title={`${SCENARIO_LABEL[varianceScenarios.actual]} − ${SCENARIO_LABEL[varianceScenarios.base]}`}
                    >
                      ΔBdg
                    </th>
                  )}
                </React.Fragment>
              ))}
            </tr>
          </thead>

          <tbody>
            {flatRows.map(({ row, depth, hasChildren, isExpanded }) => {
              const flow = row.flow ?? "add";
              const isResult = flow === "result";
              const emphasis = row.emphasis || isResult;
              const marker = isResult ? "=" : flow === "subtract" ? "−" : flow === "add" ? "+" : "";

              return (
                <tr
                  key={row.id}
                  style={{
                    borderTop: isResult ? `1.5px solid ${tokens.color.text}` : "none",
                  }}
                >
                  {/* Sticky label cell - a row header, so a screen reader names
                      the line with every figure. The <th> defaults (bold,
                      centred) are overridden to keep the old <td> rendering. */}
                  <th
                    scope="row"
                    className={sticky ? "ibcs-mtx-lbl" : undefined}
                    style={{
                      ...labelColBase,
                      padding: "0 12px",
                      height: 30,
                      whiteSpace: "nowrap",
                      maxWidth: labelWidth,
                      textAlign: "left",
                      fontWeight: 400,
                      borderBottom: row.doubleRule ? `3px double ${tokens.color.text}` : "none",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: depth * 16,
                        minWidth: 0,
                      }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleRow(row.id)}
                          aria-label={isExpanded ? "Collapse row" : "Expand row"}
                          aria-expanded={isExpanded}
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
                            transform: isExpanded ? "rotate(90deg)" : "none",
                          }}
                        >
                          ▶
                        </button>
                      ) : (
                        <span style={{ width: 16, flex: "0 0 auto" }} />
                      )}
                      <span
                        style={{
                          width: 12,
                          flex: "0 0 auto",
                          color: tokens.color.textMuted,
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {marker}
                      </span>
                      <span
                        title={row.label}
                        style={{
                          fontSize: emphasis ? 13 : 12.5,
                          fontWeight: emphasis ? 700 : 400,
                          color: depth > 0 ? tokens.color.textMuted : tokens.color.text,
                          flex: "1 1 auto",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                      >
                        {row.label}
                      </span>
                    </span>
                  </th>

                  {/* Value cells, per leaf period */}
                  {layout.leaves.map((leaf) => (
                    <React.Fragment key={`v-${row.id}-${leaf.period.id}`}>
                      {leaf.scenarios.map((scn, si) => {
                        const v = resolveCell(values, row, leaf.period.id, scn);
                        const text = fmt(v);
                        const a = cellAttrs(
                          scn,
                          row.id,
                          row.label,
                          leaf.period.id,
                          leaf.period.label,
                          v ?? null,
                          text,
                        );
                        return (
                          <td
                            key={`v-${row.id}-${leaf.period.id}-${scn}`}
                            data-cell-ref={a["data-cell-ref"]}
                            className={a.className}
                            onClick={a.onClick}
                            {...a.activation}
                            style={{
                              ...numCell,
                              position: "relative",
                              cursor: interactive ? "pointer" : undefined,
                              minWidth: SUBCOL_W,
                              fontWeight: emphasis ? 700 : 400,
                              fontStyle: scn === "FC" ? "italic" : "normal",
                              color: scn === "PL" ? tokens.color.textMuted : tokens.color.text,
                              paddingLeft: si === 0 && leaf.startsGap ? GROUP_GAP + 8 : 8,
                              borderTop: isResult ? `1.5px solid ${tokens.color.text}` : "none",
                              borderBottom: row.doubleRule
                                ? `3px double ${tokens.color.text}`
                                : "none",
                            }}
                          >
                            {text}
                            {a.ribbon && <Ribbon color={ribbonColor} />}
                          </td>
                        );
                      })}
                      {showVariance &&
                        (() => {
                          const varc = cellVariance(
                            values,
                            row,
                            leaf.period.id,
                            varianceScenarios.actual,
                            varianceScenarios.base,
                          );
                          const color =
                            !varc || varc.abs === 0
                              ? tokens.color.zero
                              : varc.favorable
                                ? tokens.color.good
                                : tokens.color.bad;
                          const text = varc ? formatSigned(varc.abs, format) : "";
                          const a = cellAttrs(
                            "DELTA",
                            row.id,
                            row.label,
                            leaf.period.id,
                            leaf.period.label,
                            varc ? varc.abs : null,
                            text,
                          );
                          return (
                            <td
                              data-cell-ref={a["data-cell-ref"]}
                              className={a.className}
                              onClick={a.onClick}
                              {...a.activation}
                              style={{
                                ...numCell,
                                position: "relative",
                                cursor: interactive ? "pointer" : undefined,
                                minWidth: VAR_W,
                                color,
                                fontWeight: emphasis ? 700 : 500,
                                borderTop: isResult ? `1.5px solid ${tokens.color.text}` : "none",
                                borderBottom: row.doubleRule
                                  ? `3px double ${tokens.color.text}`
                                  : "none",
                              }}
                            >
                              {text}
                              {a.ribbon && <Ribbon color={ribbonColor} />}
                            </td>
                          );
                        })()}
                    </React.Fragment>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------- header cell ------------------------------- */

function PeriodHeader({
  cell,
  tokens,
  stickyTop,
  onToggle,
  headerCellBase,
}: {
  cell: ColumnHeaderCell;
  tokens: IbcsTokens;
  stickyTop: React.CSSProperties;
  onToggle: (id: string) => void;
  headerCellBase: React.CSSProperties;
}) {
  const clickable = cell.expandable && cell.periodId != null;
  // Expanded parent bands (e.g. a Year over its Quarters) are left-aligned so the
  // label stays pinned to the left edge of its span - it remains visible and
  // attached to its columns even when the group is wide and scrolled. Leaf
  // headers (the actual columns) stay centered over their scenario sub-columns.
  const alignLeft = cell.expanded;
  const toggleLabel = `${cell.expanded ? "Collapse" : "Expand"} ${cell.label}`;
  const chevron = clickable && (
    <span
      aria-hidden
      style={{
        fontSize: 9,
        color: tokens.color.textMuted,
        transition: "transform 120ms",
        transform: cell.expanded ? "rotate(90deg)" : "none",
        display: "inline-block",
      }}
    >
      ▶
    </span>
  );
  return (
    <th
      scope={cell.colSpan > 1 ? "colgroup" : "col"}
      colSpan={cell.colSpan}
      rowSpan={cell.rowSpan}
      style={{
        ...headerCellBase,
        ...stickyTop,
        textAlign: alignLeft ? "left" : "center",
        verticalAlign: "bottom",
        padding: "6px 8px 4px",
        paddingLeft: cell.startsGap ? GROUP_GAP + 8 : 8,
        borderBottom: `1px solid ${tokens.color.rowBorder}`,
        fontSize: 12,
        fontWeight: 700,
        color: tokens.color.text,
        cursor: clickable ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {/* Expanding a period hangs off a real <button> with a spoken name
          ("Expand Q1"), not a bare <th onClick> with an aria-hidden chevron:
          keyboard users can reach and activate it, and the CSS reset keeps it
          looking exactly like the header text. */}
      {clickable ? (
        <button
          type="button"
          className="ibcs-mtx-hbtn"
          onClick={() => onToggle(cell.periodId!)}
          aria-expanded={cell.expanded}
          aria-label={toggleLabel}
          title={toggleLabel}
          style={{ justifyContent: alignLeft ? "flex-start" : "center" }}
        >
          {chevron}
          {cell.label}
        </button>
      ) : (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            justifyContent: alignLeft ? "flex-start" : "center",
          }}
        >
          {cell.label}
        </span>
      )}
    </th>
  );
}

/** A subtle diagonal hatch behind FC (forecast) headers, per IBCS notation. */
function hatchStyle(tokens: IbcsTokens): React.CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(135deg, ${tokens.color.gridline} 0, ${tokens.color.gridline} 2px, transparent 2px, transparent 5px)`,
  };
}
