import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScenarioKey, StatementLine, WaterfallBar, VarianceColumnSpec } from "../core/types";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import { computeWindow } from "../core/virtualize";
import { lineVariance, resolveValue } from "../core/variance";
import {
  formatValue,
  formatSigned,
  formatPercent,
  formatPercentPlain,
  type FormatOptions,
} from "../core/format";
import { useMountGrow } from "./hooks";
import { useStatement } from "./hooks/useStatement";
import { useHoverDismissal } from "./internal/dismiss";
import { srOnly } from "./a11y";
import { useIbcsTokens } from "./theme";

export interface StatementTableProps {
  /** The statement model (P&L or balance sheet). */
  lines: StatementLine[];
  /**
   * Statement kind. "flow" (default) renders the integrated waterfall — each
   * line moves a running total (a P&L). "stock" renders the balance-sheet view:
   * each line is an absolute level (ending balance), no running total.
   */
  mode?: "flow" | "stock";
  /** Scenario rendered as the waterfall. Default "AC". */
  scenario?: ScenarioKey;
  /**
   * Right-hand variance panels. Default mirrors the IBCS reference:
   * `[{base:"PY",mode:"abs",mark:"bar"}, {base:"PY",mode:"pct",mark:"pin"}]`.
   */
  varianceColumns?: VarianceColumnSpec[];
  /** Show a raw value column for each comparison base (e.g. PY). Default true. */
  showBaseValues?: boolean;
  /** Pixel width of the waterfall lane. Default 260. */
  waterfallWidth?: number;
  /**
   * Cap the row-label width (px). Labels longer than this are clamped to two
   * lines and ellipsized (…), with the full text available on hover. Default 260.
   */
  labelMaxWidth?: number;
  /**
   * Render the integrated waterfall lane (the scenario "Actual" svg column with
   * stepping bars/connectors/zero-axis and AC labels-on-bars). Default true.
   * When false, the lane is omitted entirely and the scenario value is shown as
   * a plain numeric column instead — yielding IBCS template T04: a financial
   * statement grid (label | base value(s) | AC | variance bars/pins, no lane).
   */
  showWaterfall?: boolean;
  /** Waterfall lane drawn as filled "bar" (default) or "pin" (line + dot). */
  mark?: "bar" | "pin";
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  /**
   * Group ids collapsed on mount — the uncontrolled seed (overrides each
   * line's `defaultCollapsed` flag). Ignored once `collapsed` is provided.
   */
  defaultCollapsed?: readonly string[];
  /**
   * Collapsed group ids as a CONTROLLED value: when provided the table renders
   * exactly this set and never mutates it — every toggle reports the next set
   * through `onCollapsedChange` for the parent to apply (URL sync, persistence,
   * two tables kept in step). Omit it for the uncontrolled behaviour.
   */
  collapsed?: ReadonlySet<string> | readonly string[];
  /**
   * Fired with the NEXT collapsed ids (sorted) whenever a group is toggled or
   * the Expand all / Collapse all buttons are used. Required for controlled
   * mode; in uncontrolled mode it is a plain observer of the internal state.
   */
  onCollapsedChange?: (collapsedIds: string[]) => void;
  /** Show an "Expand all / Collapse all" toolbar above the table. Default false. */
  expandControls?: boolean;
  /** Stagger each row's fade-in on mount. Default true. */
  animate?: boolean;
  /**
   * Follow the pointer with a value tooltip (line, scenario value, every
   * variance). Default true. Set false on very large statements: without the
   * tooltip no hover state is tracked at all, so moving the mouse across the
   * table costs zero re-renders (the hover tint is pure CSS).
   */
  tooltip?: boolean;
  /**
   * Cap the table height (px) and make the body scroll, with a sticky header.
   * Needed for large consolidations / transaction drill-down. When set, row
   * virtualization is enabled by default (see `virtualize`).
   */
  maxHeight?: number;
  /**
   * Only render the rows in (and near) the viewport — windowing for big
   * statements. Defaults to true whenever `maxHeight` is set. Has no effect
   * without `maxHeight`. Row fade-in is suppressed while virtualizing.
   */
  virtualize?: boolean;
  /** Extra rows rendered above/below the viewport while virtualizing. Default 6. */
  overscan?: number;
  /**
   * A short description of the statement, rendered as a visually-hidden
   * `<caption>` — a name for screen-reader users, no visual change.
   */
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
}

const ROW_H = 34;
const BAR_H = 16;
const RESULT_BAR_H = 18;
const PIN_R = 3.5;
const LANE_RPAD = 52; // room on the right for result value labels
const LANE_LPAD = 8;

const SCENARIO_LABEL: Record<ScenarioKey, string> = { AC: "AC", PY: "PY", PL: "PL", FC: "FC" };

const DEFAULT_VARIANCE_COLUMNS: VarianceColumnSpec[] = [
  { base: "PY", mode: "abs", mark: "bar" },
  { base: "PY", mode: "pct", mark: "pin" },
];

/** Small toolbar button style for Expand all / Collapse all. */
function expandBtn(disabled: boolean, tokens: IbcsTokens): React.CSSProperties {
  return {
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
  };
}

interface HoverState {
  id: string;
  x: number;
  y: number;
}

/** Per-row computed variance for one column, plus the column's shared scale. */
interface ColumnData {
  spec: Required<Pick<VarianceColumnSpec, "base" | "mode" | "mark">> & VarianceColumnSpec;
  header: string;
  /** Display value per row (currency delta for abs, percent for pct), or null. */
  values: Array<{ value: number; favorable: boolean; outlier: boolean } | null>;
  domain: number;
  width: number;
}

const ROW_ANIM_CSS = `
@keyframes ibcsRowIn { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { tr.ibcs-row { animation: none !important; opacity: 1 !important } }
`;

/**
 * The row hover tint, as static CSS. Tinting from React state re-renders every
 * row (and its waterfall/variance svgs) on each move between rows — a heavy
 * price for a decorative background. `tr:hover` is free, and the spacer rows a
 * virtualized body pads with (`.ibcs-row-pad`) are excluded so hovering the
 * empty space above/below the window doesn't light up.
 */
const ROW_HOVER_CSS = `
.ibcs-stmt tbody tr:not(.ibcs-row-pad) > * { transition: background 90ms }
.ibcs-stmt tbody tr:not(.ibcs-row-pad):hover > * { background: rgba(0,0,0,0.025) }
@media (prefers-reduced-motion: reduce) { .ibcs-stmt tbody tr > * { transition: none } }
`;

export function StatementTable({
  lines,
  mode = "flow",
  scenario = "AC",
  varianceColumns = DEFAULT_VARIANCE_COLUMNS,
  showBaseValues = true,
  waterfallWidth = 260,
  labelMaxWidth = 260,
  showWaterfall = true,
  mark = "bar",
  format = {},
  tokens: tokenOverride,
  defaultCollapsed,
  collapsed: collapsedProp,
  onCollapsedChange,
  expandControls = false,
  animate = true,
  tooltip = true,
  maxHeight,
  virtualize,
  overscan = 6,
  caption,
  className,
  style,
}: StatementTableProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const [scrollTop, setScrollTop] = useState(0);

  // Collapse/expand state + the waterfall (or stock levels) layout come from the
  // hook, so the table and `useStatement` can never drift: controlled vs
  // uncontrolled, the toolbar's write path and the memoized layout are all one
  // implementation, and the table only renders what it hands back.
  const {
    rows,
    domainMin,
    domainMax,
    toggle,
    expandAll,
    collapseAll,
    groupIds,
    allCollapsed,
    allExpanded,
  } = useStatement(lines, {
    mode,
    scenario,
    defaultCollapsed,
    collapsed: collapsedProp,
    onCollapsedChange,
  });
  const [hover, setHover] = useState<HoverState | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverPosRef = useRef({ x: 0, y: 0 });
  const hoverRafRef = useRef(0);
  const scrollRafRef = useRef(0);
  const pendingScrollRef = useRef(0);
  const grow = useMountGrow(600, 0, lines);

  const positionTooltip = (x: number, y: number) => {
    hoverPosRef.current = { x, y };
    if (hoverRafRef.current) return;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = 0;
      const node = tooltipRef.current;
      if (!node) return;
      node.style.transform = `translate3d(${hoverPosRef.current.x + 16}px, ${hoverPosRef.current.y + 16}px, 0)`;
    });
  };

  // Hover state exists purely to feed the tooltip — the row tint is CSS. With
  // the tooltip off no hover handler is attached at all, so a mouse sweep
  // across a 5000-row statement costs zero renders.
  const moveHover = (id: string, x: number, y: number) => {
    positionTooltip(x, y);
    setHover((prev) => (prev?.id === id ? prev : { id, x, y }));
  };
  const leaveHover = (id: string) => setHover((h) => (h?.id === id ? null : h));
  // Escape (WCAG 1.4.13) and outside-tap dismissal, shared with the charts.
  // Stable identity so the listeners are not re-bound on every hover move.
  const dismissHover = useCallback(() => setHover(null), []);
  useHoverDismissal(hover != null, dismissHover);

  /**
   * Scroll → window recompute, throttled to one state update per animation
   * frame. A raw `onScroll` handler fires far more often than the browser
   * paints, so an unthrottled `setScrollTop` re-renders the visible rows many
   * times per frame while flinging a long statement.
   */
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    pendingScrollRef.current = e.currentTarget.scrollTop;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      setScrollTop(pendingScrollRef.current);
    });
  };

  useEffect(() => {
    return () => {
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // Bases we need raw value columns for (unique, in first-seen order).
  const baseColumns = useMemo(() => {
    const seen: ScenarioKey[] = [];
    for (const vc of varianceColumns) if (!seen.includes(vc.base)) seen.push(vc.base);
    return seen;
  }, [varianceColumns]);

  // Per variance-column: compute every row's value, the favorable flag, which
  // rows are off-scale outliers, and the axis scale (excluding outliers).
  const columns: ColumnData[] = useMemo(() => {
    return varianceColumns.map((raw) => {
      const spec = { mode: "abs" as const, mark: "bar" as const, ...raw };
      const isPct = spec.mode === "pct";
      const clamp = spec.clampPct ?? 100;
      let domain = 0;
      const values = rows.map((r) => {
        const v = lineVariance(r.line, spec.base, scenario);
        if (!v) return null;
        if (isPct) {
          if (v.pct == null || !Number.isFinite(v.pct)) return null;
          const p = v.pct * 100;
          const outlier = Math.abs(p) >= clamp;
          if (!outlier) domain = Math.max(domain, Math.abs(p));
          return { value: p, favorable: v.favorable, outlier };
        }
        if (!Number.isFinite(v.abs)) return null;
        domain = Math.max(domain, Math.abs(v.abs));
        return { value: v.abs, favorable: v.favorable, outlier: false };
      });
      return {
        spec,
        header:
          spec.label ??
          (isPct ? `Δ${SCENARIO_LABEL[spec.base]}%` : `Δ${SCENARIO_LABEL[spec.base]}`),
        values,
        domain: domain || (isPct ? clamp : 1),
        // Pins need room for the value + an off-scale arrow; abs bars are tighter.
        width: spec.mark === "pin" ? 150 : 108,
      };
    });
  }, [rows, varianceColumns, scenario]);

  // Waterfall value -> pixel, honouring negatives and reserving label room.
  // Clamp the lane geometry so a tiny `waterfallWidth` (or non-finite span)
  // can't yield a negative inner width or push marks outside the cell.
  const span = domainMax - domainMin || 1;
  const laneInner = Math.max(waterfallWidth - LANE_LPAD - LANE_RPAD, 1);
  const xOf = (v: number) => {
    const x = LANE_LPAD + ((v - domainMin) / span) * laneInner;
    return Number.isFinite(x) ? Math.max(0, Math.min(waterfallWidth, x)) : LANE_LPAD;
  };
  const zeroX = xOf(0);
  const fmt = (v?: number) => (v == null || !Number.isFinite(v) ? "" : formatValue(v, format));

  const headerCell: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: tokens.color.textMuted,
    padding: "0 10px 8px",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  const numCell: React.CSSProperties = {
    fontSize: 12.5,
    padding: "0 10px",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  };

  const hoveredRow = hover ? rows.find((r) => r.line.id === hover.id) : null;

  // Viewport + row windowing for large statements. `maxHeight` makes the body
  // scroll with a sticky header; virtualization (on by default once scrolling)
  // renders only the rows in/near the viewport, between two spacer rows.
  const scroller = maxHeight != null;
  const doVirtualize = scroller && (virtualize ?? true);
  const win = doVirtualize
    ? computeWindow({
        scrollTop,
        viewportHeight: maxHeight!,
        rowHeight: ROW_H,
        count: rows.length,
        overscan,
      })
    : { start: 0, end: rows.length, padTop: 0, padBottom: 0 };
  const visibleRows = rows.slice(win.start, win.end);
  const totalCols = 1 + (showBaseValues ? baseColumns.length : 0) + 1 + columns.length;
  const rowAnim = animate && !doVirtualize;

  const stickyHead: React.CSSProperties = scroller
    ? {
        position: "sticky",
        top: 0,
        zIndex: 1,
        background: tokens.color.surface,
        borderBottom: `2px solid ${tokens.color.text}`,
      }
    : {};

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
      <style>{rowAnim ? ROW_HOVER_CSS + ROW_ANIM_CSS : ROW_HOVER_CSS}</style>
      {expandControls && groupIds.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button
            type="button"
            onClick={expandAll}
            disabled={allExpanded}
            style={expandBtn(allExpanded, tokens)}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={allCollapsed}
            style={expandBtn(allCollapsed, tokens)}
          >
            Collapse all
          </button>
        </div>
      )}
      <div
        onScroll={scroller ? onScroll : undefined}
        // Always allow horizontal scroll so the fixed-width waterfall + variance
        // lanes never overflow / overlap a narrow container; vertical scroll
        // (with a sticky header) engages only when `maxHeight` is set.
        style={scroller ? { maxHeight, overflow: "auto" } : { overflowX: "auto" }}
      >
        <table
          className="ibcs-stmt"
          style={{ borderCollapse: "collapse", width: "100%", minWidth: "min-content" }}
        >
          {caption && <caption style={srOnly}>{caption}</caption>}
          <thead>
            <tr style={scroller ? undefined : { borderBottom: `2px solid ${tokens.color.text}` }}>
              <th scope="col" style={{ ...headerCell, ...stickyHead, textAlign: "left" }}>
                &nbsp;
              </th>
              {showBaseValues &&
                baseColumns.map((base) => (
                  <th key={`bh-${base}`} scope="col" style={{ ...headerCell, ...stickyHead }}>
                    {SCENARIO_LABEL[base]}
                  </th>
                ))}
              {showWaterfall ? (
                <th
                  scope="col"
                  style={{
                    ...headerCell,
                    ...stickyHead,
                    textAlign: "left",
                    paddingLeft: 8,
                    width: waterfallWidth,
                  }}
                >
                  {SCENARIO_LABEL[scenario]}
                </th>
              ) : (
                <th scope="col" style={{ ...headerCell, ...stickyHead }}>
                  {SCENARIO_LABEL[scenario]}
                </th>
              )}
              {columns.map((c, i) => (
                <th
                  key={`vh-${i}`}
                  scope="col"
                  style={{ ...headerCell, ...stickyHead, textAlign: "center", width: c.width }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {win.padTop > 0 && (
              <tr aria-hidden="true" className="ibcs-row-pad">
                <td
                  colSpan={totalCols}
                  style={{ padding: 0, border: "none", height: win.padTop }}
                />
              </tr>
            )}
            {visibleRows.map((row, idx) => {
              const ri = win.start + idx;
              const { line, depth, hasChildren, isExpanded, bar, cumBefore, cumAfter } = row;
              const flow = line.flow ?? "add";
              const isResult = flow === "result";
              const emphasis = line.emphasis || isResult;
              const marker = isResult ? "=" : flow === "subtract" ? "−" : "";
              const acValue = resolveValue(line, scenario);

              return (
                <tr
                  key={line.id}
                  className={rowAnim ? "ibcs-row" : undefined}
                  // Pointer events (not mouse): a touch device gets a sticky
                  // tap tooltip instead of a phantom hover, matching the
                  // charts' shared `markInteraction` wiring. The whole row is
                  // the mark, so there is no proximity gating to do.
                  onPointerMove={
                    tooltip
                      ? (e) => {
                          if (e.pointerType === "touch") return;
                          moveHover(line.id, e.clientX, e.clientY);
                        }
                      : undefined
                  }
                  onPointerLeave={
                    tooltip
                      ? (e) => {
                          // A tap's implicit leave must not dismiss the tap
                          // tooltip — Escape / a tap elsewhere does that.
                          if (e.pointerType !== "touch") leaveHover(line.id);
                        }
                      : undefined
                  }
                  onPointerDown={
                    tooltip
                      ? (e) => {
                          if (e.pointerType === "touch") moveHover(line.id, e.clientX, e.clientY);
                        }
                      : undefined
                  }
                  style={{
                    // IBCS: a thin, visible rule above a result/subtotal line (the
                    // old 2px rowBorder hairline was near-invisible on a light
                    // surface). Matches the DataTable result rule.
                    borderTop: isResult ? `1px solid ${tokens.color.text}` : "none",
                    height: ROW_H,
                    animation: rowAnim
                      ? `ibcsRowIn 360ms ease-out ${Math.min(ri * 22, 400)}ms both`
                      : undefined,
                  }}
                >
                  {/* Label: marker + chevron + indentation. A min-width keeps the
                    description column from being crushed (and wrapping mid-word)
                    when the table is squeezed — e.g. two tables side by side. */}
                  <th
                    scope="row"
                    style={{
                      padding: "0 10px",
                      whiteSpace: "nowrap",
                      minWidth: 148,
                      textAlign: "left",
                      fontWeight: 400,
                    }}
                  >
                    {/* Align the chevron + marker to the label's FIRST line, not
                      the vertical centre — otherwise on a two-line label the
                      "−"/"+" marker drops between the lines and reads as a stray
                      underscore. */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        paddingLeft: depth * 16,
                      }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggle(line.id)}
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                          aria-expanded={isExpanded}
                          style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            padding: 0,
                            marginRight: 4,
                            width: 12,
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
                        <span style={{ width: 16 }} />
                      )}
                      <span
                        style={{
                          width: 12,
                          color: tokens.color.textMuted,
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {marker}
                      </span>
                      <span
                        title={line.label}
                        style={{
                          fontSize: emphasis ? 13 : 12.5,
                          fontWeight: emphasis ? 600 : 400,
                          color: depth > 0 ? tokens.color.textMuted : tokens.color.text,
                          // Wrap up to two lines, then ellipsize. Full text on hover
                          // via the title attribute above — so even a clamped label
                          // stays fully readable.
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          maxWidth: labelMaxWidth,
                        }}
                      >
                        {line.label}
                      </span>
                    </span>
                  </th>

                  {/* Base value columns (PY) */}
                  {showBaseValues &&
                    baseColumns.map((base) => (
                      <td
                        key={`bv-${line.id}-${base}`}
                        style={{
                          ...numCell,
                          color: emphasis ? tokens.color.text : tokens.color.textMuted,
                          fontWeight: emphasis ? 600 : 400,
                        }}
                      >
                        {fmt(resolveValue(line, base))}
                      </td>
                    ))}

                  {/* Scenario (AC) column: waterfall lane, or a plain numeric value
                    when the lane is disabled (IBCS T04). */}
                  {showWaterfall ? (
                    <td style={{ padding: 0, width: waterfallWidth }}>
                      <WaterfallCell
                        bar={bar}
                        cumBefore={cumBefore}
                        cumAfter={cumAfter}
                        xOf={xOf}
                        zeroX={zeroX}
                        width={waterfallWidth}
                        mark={mark}
                        isResult={isResult}
                        grow={grow}
                        acLabel={fmt(acValue)}
                        emphasis={emphasis}
                        tokens={tokens}
                      />
                    </td>
                  ) : (
                    <td
                      style={{
                        ...numCell,
                        color: tokens.color.text,
                        fontWeight: emphasis ? 600 : 400,
                      }}
                    >
                      {fmt(acValue)}
                    </td>
                  )}

                  {/* Variance columns */}
                  {columns.map((c, ci) => {
                    const cell = c.values[ri];
                    return (
                      <td key={`v-${line.id}-${ci}`} style={{ padding: 0, width: c.width }}>
                        {cell && (
                          <VarianceCell
                            value={cell.value}
                            domain={c.domain}
                            width={c.width}
                            favorable={cell.favorable}
                            outlier={cell.outlier}
                            mark={c.spec.mark}
                            mode={c.spec.mode}
                            label={
                              c.spec.mode === "pct"
                                ? formatPercentPlain(cell.value / 100)
                                : formatSigned(cell.value, format)
                            }
                            emphasis={emphasis}
                            tokens={tokens}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {win.padBottom > 0 && (
              <tr aria-hidden="true" className="ibcs-row-pad">
                <td
                  colSpan={totalCols}
                  style={{ padding: 0, border: "none", height: win.padBottom }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hover && hoveredRow && (
        <RowTooltip
          ref={tooltipRef}
          x={hover.x}
          y={hover.y}
          line={hoveredRow.line}
          scenario={scenario}
          bases={baseColumns}
          format={format}
          tokens={tokens}
        />
      )}
    </div>
  );
}

/* ---------------- Waterfall cell: connectors, bars/pins, AC label ---------------- */

function WaterfallCell({
  bar,
  cumBefore,
  cumAfter,
  xOf,
  zeroX,
  width,
  mark,
  isResult,
  grow,
  acLabel,
  emphasis,
  tokens,
}: {
  bar: WaterfallBar;
  cumBefore: number;
  cumAfter: number;
  xOf: (v: number) => number;
  zeroX: number;
  width: number;
  mark: "bar" | "pin";
  isResult: boolean;
  grow: number;
  acLabel: string;
  emphasis: boolean;
  tokens: IbcsTokens;
}) {
  const mid = ROW_H / 2;
  const stepColor = isResult ? tokens.color.total : tokens.color.neutral;
  const inX = xOf(cumBefore);
  const outX = xOf(cumAfter);
  const animTo = (from: number, to: number) => xOf(from + (to - from) * grow);

  // AC label sits just outside the bar's leading (`to`) edge, clamped to the cell.
  let label: { x: number; anchor: "start" | "end" } | null = null;
  if (bar.kind !== "none" && acLabel) {
    const endX = xOf(bar.to);
    const goingRight = bar.kind === "full" ? true : bar.to >= bar.from;
    let x = goingRight ? endX + 5 : endX - 5;
    let anchor: "start" | "end" = goingRight ? "start" : "end";
    if (anchor === "start" && x > width - 4) {
      x = endX - 5;
      anchor = "end";
    }
    if (anchor === "end" && x < 30) {
      x = endX + 5;
      anchor = "start";
    }
    label = { x: Math.max(3, Math.min(width - 3, x)), anchor };
  }

  return (
    <svg width={width} height={ROW_H} style={{ display: "block" }}>
      <line x1={zeroX} y1={0} x2={zeroX} y2={ROW_H} stroke={tokens.color.axis} strokeWidth={0.75} />
      {/* Step connectors tying each bar's level to the next row's start. Drawn at
          the axis weight (was a near-invisible 1px rowBorder) so the vertical
          run between stacked bars actually reads. */}
      <line x1={inX} y1={0} x2={inX} y2={mid} stroke={tokens.color.axis} strokeWidth={1.5} />
      <line x1={outX} y1={mid} x2={outX} y2={ROW_H} stroke={tokens.color.axis} strokeWidth={1.5} />

      {bar.kind === "full" && (
        <Mark
          from={xOf(bar.from)}
          to={animTo(bar.from, bar.to)}
          mid={mid}
          color={tokens.color.total}
          mark={mark}
          thick
        />
      )}
      {bar.kind === "delta" &&
        (bar.outline ? (
          <OutlineBracket x1={xOf(bar.from)} x2={xOf(bar.to)} mid={mid} color={stepColor} />
        ) : (
          <Mark
            from={xOf(bar.from)}
            to={animTo(bar.from, bar.to)}
            mid={mid}
            color={stepColor}
            mark={mark}
          />
        ))}

      {label && (
        <text
          x={label.x}
          y={mid + 4}
          textAnchor={label.anchor}
          fontSize={11.5}
          fontWeight={emphasis ? 700 : 400}
          fill={tokens.color.text}
        >
          {acLabel}
        </text>
      )}
    </svg>
  );
}

function Mark({
  from,
  to,
  mid,
  color,
  mark,
  thick,
}: {
  from: number;
  to: number;
  mid: number;
  color: string;
  mark: "bar" | "pin";
  thick?: boolean;
}) {
  if (mark === "pin") {
    return (
      <g>
        <line x1={from} y1={mid} x2={to} y2={mid} stroke={color} strokeWidth={2} />
        <circle cx={to} cy={mid} r={PIN_R} fill={color} />
      </g>
    );
  }
  const x = Math.min(from, to);
  const w = Math.max(Math.abs(to - from), 1);
  const h = thick ? RESULT_BAR_H : BAR_H;
  return <rect x={x} y={mid - h / 2} width={w} height={h} fill={color} />;
}

function OutlineBracket({
  x1,
  x2,
  mid,
  color,
}: {
  x1: number;
  x2: number;
  mid: number;
  color: string;
}) {
  const x = Math.min(x1, x2);
  const w = Math.max(Math.abs(x2 - x1), 1);
  return (
    <rect
      x={x}
      y={mid - BAR_H / 2}
      width={w}
      height={BAR_H}
      fill="none"
      stroke={color}
      strokeWidth={1.25}
      strokeDasharray="2 2"
    />
  );
}

/* ---------------- Variance cell: bar or pin, off-scale arrows, label ---------------- */

function VarianceCell({
  value,
  domain,
  width,
  favorable,
  outlier,
  mark,
  mode,
  label,
  emphasis,
  tokens,
}: {
  value: number;
  domain: number;
  width: number;
  favorable: boolean;
  outlier: boolean;
  mark: "bar" | "pin";
  mode: "abs" | "pct";
  label: string;
  emphasis: boolean;
  tokens: IbcsTokens;
}) {
  const cy = ROW_H / 2;
  const color = value === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;
  const labelColor = mode === "pct" ? color : tokens.color.text;
  const weight = emphasis ? 700 : 400;
  const italic = mode === "pct" ? "italic" : "normal";

  // Bars: magnitude from a left axis, value in an aligned right-hand column
  // (the IBCS absolute-variance convention).
  if (mark === "bar") {
    const axisX = 8;
    const barMaxW = 46;
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

  // Pins: dot (or off-scale arrow) on a left-offset axis so positives get the
  // room. Off-scale marks sit at the edge with the value beside them.
  const axisX = Math.round(width * 0.4);
  const posRoom = width - axisX - 50; // reserve label room on the right
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
      {/* Inliers draw a connecting line + dot; outliers just an edge arrow. */}
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

/* ---------------- Hover tooltip ---------------- */

const RowTooltip = React.forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    line: StatementLine;
    scenario: ScenarioKey;
    bases: ScenarioKey[];
    format: FormatOptions;
    tokens: IbcsTokens;
  }
>(function RowTooltip({ x, y, line, scenario, bases, format, tokens }, ref) {
  const ac = resolveValue(line, scenario);
  // Values at FULL precision (compact: false): the table cells print compact
  // figures, so the tooltip adds the exact number instead of echoing them.
  const exact = { ...format, compact: false };
  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate3d(${x + 16}px, ${y + 16}px, 0)`,
        zIndex: 1000,
        pointerEvents: "none",
        background: tokens.color.text,
        color: tokens.color.surface,
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 12,
        lineHeight: 1.5,
        minWidth: 180,
        boxShadow: "0 6px 24px rgba(0,0,0,0.22)",
        fontVariantNumeric: "tabular-nums",
        willChange: "transform",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{line.label}</div>
      <TipRow
        k={SCENARIO_LABEL[scenario]}
        val={ac == null ? "—" : formatValue(ac, exact)}
        surface={tokens.color.surface}
        strong
      />
      {bases.map((base) => {
        const v = lineVariance(line, base, scenario);
        const baseVal = resolveValue(line, base);
        // Impact colors pulled toward the panel ink so they stay legible on
        // the `color.text` panel in every theme (light ink on the default dark
        // panel, dark ink on a dark theme's light panel).
        const color =
          !v || v.abs === 0
            ? `color-mix(in srgb, ${tokens.color.surface} 80%, transparent)`
            : `color-mix(in srgb, ${
                v.favorable ? tokens.color.good : tokens.color.bad
              } 70%, ${tokens.color.surface})`;
        return (
          <div
            key={base}
            style={{
              marginTop: 4,
              borderTop: `1px solid color-mix(in srgb, ${tokens.color.surface} 12%, transparent)`,
              paddingTop: 4,
            }}
          >
            <TipRow
              k={SCENARIO_LABEL[base]}
              val={baseVal == null ? "—" : formatValue(baseVal, exact)}
              surface={tokens.color.surface}
            />
            <TipRow
              k={`Δ ${SCENARIO_LABEL[base]}`}
              val={v ? `${formatSigned(v.abs, exact)}  (${formatPercent(v.pct)})` : "—"}
              surface={tokens.color.surface}
              color={color}
            />
          </div>
        );
      })}
    </div>
  );
});

function TipRow({
  k,
  val,
  strong,
  color,
  surface,
}: {
  k: string;
  val: string;
  strong?: boolean;
  color?: string;
  /** Default ink of the panel — the theme's `color.surface`. */
  surface: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
      <span style={{ color: surface, opacity: 0.7 }}>{k}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: color ?? surface }}>{val}</span>
    </div>
  );
}
