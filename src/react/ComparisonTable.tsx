import React, { useCallback, useMemo } from "react";
import {
  buildComparisonModel,
  type ComparisonColumnModel,
  type ComparisonHeaderCell,
  type ComparisonViewRow,
} from "../core/comparisonTable";
import {
  resolveMark,
  type DataTableColumn,
  type DataTableRow,
  type ResolvedCell,
  type VarianceCellData,
} from "../core/datatable";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import { useIbcsTokens } from "./theme";
import { formatValue, formatSigned, formatPercentPlain, type FormatOptions } from "../core/format";

export interface ComparisonTableProps {
  /**
   * Hierarchical rows in build-up order: each top-level row is a GROUP whose
   * `children` are the detail rows (the group itself renders as a bold subtotal,
   * summed from its children). A childless top-level row is a plain detail row.
   */
  rows: DataTableRow[];
  /** Columns of the LEFT group (e.g. November): PY / PL / AC / variances. */
  leftColumns: DataTableColumn[];
  /** Columns of the RIGHT group (e.g. year-to-date), same measures repeated. */
  rightColumns: DataTableColumn[];
  /** Centred super-header over the left group (e.g. "November"). */
  leftGroupLabel: string;
  /** Centred super-header over the right group (e.g. "January–November"). */
  rightGroupLabel: string;
  /** Append a bold grand-total row with a heavier (double) rule. Default false. */
  showTotals?: boolean;
  /** Grand-total label (the centre cell). Default "Total". */
  totalsLabel?: string;
  /** Number formatting (compact, decimals, currency, locale). */
  format?: FormatOptions;
  /** Theme overrides (colors, scenario fills). */
  tokens?: IbcsTokensOverride;
  /** Pixel width of the centre label column. Default 116. */
  labelWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ROW_H = 26;
const GROUP_GAP = 16; // IBCS group gap — whitespace, never a rule

// Per-column geometry, in CSS px. `content` is the visible figure/mark width;
// `gap` is the IBCS whitespace that sets a column block apart from the previous
// one; `col` is what the <col>/table layout reserves. The gap lives INSIDE the
// fixed column width: right-aligned figures push the gap to the left as empty
// space, mark (bar/pin) cells get an equal left padding — so the header bands
// and the body share exactly the same column edges.
interface ColWidth {
  content: number;
  gap: number;
  col: number;
}

// Tabular figures are monospaced, so a column's pixel width can be derived from
// its widest formatted string — no DOM measurement (SSR-safe). 7.3px/char at the
// 12px cell size, plus slack for the 6px+6px cell padding (rounded up so a stray
// comma/sign never clips a right-aligned figure).
const CHAR_W = 7.3;
const CELL_PAD = 14;

function charsToPx(chars: number, min: number): number {
  return Math.max(min, Math.round(chars * CHAR_W) + CELL_PAD);
}

/** Visible content width for a column, given the side's equalized figure widths. */
function contentWidth(cm: ComparisonColumnModel, valueW: number, numW: number): number {
  if (cm.column.width != null) return cm.column.width;
  if (cm.kind === "variance") {
    const mark = resolveMark(cm.column);
    if (mark === "none") return numW;
    return mark === "pin" ? 104 : 92;
  }
  return valueW;
}

export function ComparisonTable({
  rows,
  leftColumns,
  rightColumns,
  leftGroupLabel,
  rightGroupLabel,
  showTotals = false,
  totalsLabel = "Total",
  format = {},
  tokens: tokenOverride,
  labelWidth = 116,
  className,
  style,
}: ComparisonTableProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const model = useMemo(
    () => buildComparisonModel(rows, leftColumns, rightColumns, { showTotals, totalsLabel }),
    [rows, leftColumns, rightColumns, showTotals, totalsLabel],
  );

  // Resolve every column's geometry from the data. Within a side, all value
  // columns share one width and all numeric-variance columns share another (IBCS:
  // columns of one type are identical in width) — sized to the side's widest
  // figure so the two flanking groups can differ (November is narrower than the
  // year-to-date) yet each stays internally aligned.
  const widths = useMemo(() => {
    const map = new Map<string, ColWidth>();
    const measureSide = (
      cols: ComparisonColumnModel[],
      cellsOf: (vr: ComparisonViewRow) => ResolvedCell[],
    ) => {
      let valChars = 3;
      let numChars = 3;
      cols.forEach((cm, i) => {
        if (cm.column.width != null) return;
        const fmt = cm.column.format ?? format;
        for (const vr of model.rows) {
          const cell = cellsOf(vr)[i];
          if (!cell) continue;
          if (cm.kind === "value" && cell.kind === "value" && cell.value != null) {
            valChars = Math.max(valChars, formatValue(cell.value, fmt).length);
          } else if (
            cm.kind === "variance" &&
            resolveMark(cm.column) === "none" &&
            cell.kind === "variance" &&
            cell.variance
          ) {
            const v = cell.variance.value;
            const s =
              (cm.column.mode ?? "abs") === "pct"
                ? formatPercentPlain(v / 100, 0) + "%"
                : formatSigned(v, fmt);
            numChars = Math.max(numChars, s.length);
          }
        }
      });
      const valueW = charsToPx(valChars, 40);
      const numW = charsToPx(numChars, 38);
      for (const cm of cols) {
        const content = contentWidth(cm, valueW, numW);
        const gap = cm.gapBefore ? GROUP_GAP : 0;
        map.set(cm.column.key, { content, gap, col: content + gap });
      }
    };
    measureSide(model.leftColumns, (vr) => vr.leftCells);
    measureSide(model.rightColumns, (vr) => vr.rightCells);
    return map;
  }, [model, format]);

  const colW = useCallback(
    (cm: ComparisonColumnModel): ColWidth =>
      widths.get(cm.column.key) ?? { content: 46, gap: 0, col: 46 },
    [widths],
  );

  // Fixed table layout needs an explicit total width so the <col> widths are
  // authoritative (and the centred group super-headers land exactly over their
  // sub-columns). The horizontal-scroll wrapper handles narrow containers.
  const tableWidth = useMemo(() => {
    let total = labelWidth;
    for (const cm of model.leftColumns) total += colW(cm).col;
    for (const cm of model.rightColumns) total += colW(cm).col;
    return total;
  }, [model, colW, labelWidth]);

  const headerCell: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: tokens.color.textMuted,
    padding: "0 6px 5px",
    textAlign: "right",
    whiteSpace: "nowrap",
    userSelect: "none",
  };
  const groupHeaderCell: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: tokens.color.text,
    padding: "0 6px 4px",
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  const leftSpan = model.leftColumns.length;
  const rightSpan = model.rightColumns.length;

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
      {/* Horizontal-scroll wrapper: the two fixed-width flanking column groups
          scroll rather than overflow / overlap inside a narrow container. */}
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: tableWidth }}>
          <colgroup>
            {model.leftColumns.map((cm) => (
              <col key={`lc-${cm.column.key}`} style={{ width: colW(cm).col }} />
            ))}
            <col style={{ width: labelWidth }} />
            {model.rightColumns.map((cm) => (
              <col key={`rc-${cm.column.key}`} style={{ width: colW(cm).col }} />
            ))}
          </colgroup>

          <thead>
            {/* Row 1: the two centred group super-headers, each with a thin rule
              spanning exactly its sub-columns. */}
            <tr>
              <th
                colSpan={leftSpan}
                style={{ ...groupHeaderCell, borderBottom: `1px solid ${tokens.color.text}` }}
              >
                {leftGroupLabel}
              </th>
              <th aria-hidden style={{ padding: 0 }} />
              <th
                colSpan={rightSpan}
                style={{ ...groupHeaderCell, borderBottom: `1px solid ${tokens.color.text}` }}
              >
                {rightGroupLabel}
              </th>
            </tr>
            {/* Row 2: per-column labels (PY/PL/AC + variance sub-spans). */}
            <tr style={{ borderBottom: `1.5px solid ${tokens.color.text}` }}>
              {renderHeaderRow(model.leftHeader, headerCell, tokens)}
              <th style={{ ...headerCell, textAlign: "left" }}>&nbsp;</th>
              {renderHeaderRow(model.rightHeader, headerCell, tokens)}
            </tr>
          </thead>

          <tbody>
            {model.rows.map((vr, i) => {
              const prev = model.rows[i - 1];
              // A subtotal closes a detail run; a total caps everything. IBCS puts
              // a thin rule above a subtotal and a double rule above the total.
              const borderTop =
                vr.kind === "total"
                  ? `3px double ${tokens.color.text}`
                  : vr.kind === "subtotal"
                    ? `1px solid ${tokens.color.text}`
                    : prev && prev.kind !== "detail"
                      ? `1px solid ${tokens.color.rowBorder}`
                      : "none";
              return (
                <ComparisonRow
                  key={vr.row.id}
                  vr={vr}
                  model={model}
                  widths={widths}
                  borderTop={borderTop}
                  labelWidth={labelWidth}
                  format={format}
                  tokens={tokens}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderHeaderRow(
  cells: ComparisonHeaderCell[],
  base: React.CSSProperties,
  tokens: IbcsTokens,
): React.ReactNode {
  return cells.map((hc, i) => (
    <th
      key={`h-${i}`}
      colSpan={hc.span}
      style={{
        ...base,
        // A header has the same orientation as its column: single (PY/PL/AC,
        // ΔPY…) sub-columns are right-aligned over their right-aligned figures;
        // a combined header (AC-PY over an abs+% pair) centres over its span.
        textAlign: hc.span > 1 ? "center" : "right",
        color: tokens.color.textMuted,
      }}
    >
      {hc.label}
    </th>
  ));
}

function ComparisonRow({
  vr,
  model,
  widths,
  borderTop,
  labelWidth,
  format,
  tokens,
}: {
  vr: ComparisonViewRow;
  model: { leftColumns: ComparisonColumnModel[]; rightColumns: ComparisonColumnModel[] };
  widths: Map<string, ColWidth>;
  borderTop: string;
  labelWidth: number;
  format: FormatOptions;
  tokens: IbcsTokens;
}) {
  const [hover, setHover] = React.useState(false);
  const emphasis = vr.emphasis;

  const renderCell = (cm: ComparisonColumnModel, cell: ResolvedCell, side: "l" | "r") => {
    const w = widths.get(cm.column.key) ?? { content: 46, gap: 0, col: 46 };
    // A mark (bar/pin) cell is a fixed-width svg, so its leading group gap is a
    // real left padding. Figure cells (value / numeric variance) are right-
    // aligned and simply let the gap fall as empty space on their left.
    const isMark = cm.kind === "variance" && resolveMark(cm.column) !== "none";
    return (
      <td key={`${side}-${cm.column.key}`} style={{ padding: 0, paddingLeft: isMark ? w.gap : 0 }}>
        <CellView
          cell={cell}
          cm={cm}
          width={w.content}
          emphasis={emphasis}
          format={format}
          tokens={tokens}
        />
      </td>
    );
  };

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: ROW_H,
        borderTop,
        background: hover ? "rgba(0,0,0,0.025)" : "transparent",
        transition: "background 90ms",
      }}
    >
      {model.leftColumns.map((cm, ci) => {
        const cell = vr.leftCells[ci];
        return cell ? renderCell(cm, cell, "l") : null;
      })}

      {/* Centre label column */}
      <td
        style={{ width: labelWidth, maxWidth: labelWidth, padding: "0 12px", whiteSpace: "nowrap" }}
      >
        <span
          title={vr.row.label}
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: emphasis ? 12.5 : 12,
            fontWeight: emphasis ? 700 : 400,
            color: tokens.color.text,
          }}
        >
          {vr.row.label}
        </span>
      </td>

      {model.rightColumns.map((cm, ci) => {
        const cell = vr.rightCells[ci];
        return cell ? renderCell(cm, cell, "r") : null;
      })}
    </tr>
  );
}

/* ---------------- per-kind cell rendering (mirrors DataTable) ---------------- */

function CellView({
  cell,
  cm,
  width,
  emphasis,
  format,
  tokens,
}: {
  cell: ResolvedCell;
  cm: ComparisonColumnModel;
  width: number;
  emphasis: boolean;
  format: FormatOptions;
  tokens: IbcsTokens;
}) {
  const fmt = cm.column.format ?? format;

  if (cell.kind === "value") {
    return (
      <div
        style={{
          fontSize: 12,
          padding: "0 6px",
          textAlign: cm.column.align ?? "right",
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

  if (cell.kind === "sparkline") return <div style={{ height: ROW_H }} />;

  if (!cell.variance) return <div style={{ height: ROW_H }} />;
  const mark = resolveMark(cm.column);
  const mode = cm.column.mode ?? "abs";

  // Plain numeric variance (IBCS T01): a signed, impact-coloured figure.
  if (mark === "none") {
    const { value, favorable } = cell.variance;
    const color =
      value === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;
    const label =
      mode === "pct" ? formatPercentPlain(value / 100, 0) + "%" : formatSigned(value, fmt);
    return (
      <div
        style={{
          fontSize: 12,
          padding: "0 6px",
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
      width={width}
      mark={mark}
      mode={mode}
      emphasis={emphasis}
      format={fmt}
      tokens={tokens}
    />
  );
}

/** Embedded variance bar (abs) / pin (pct) — the IBCS T02 marks. */
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
  const label = mode === "pct" ? formatPercentPlain(value / 100, 0) : formatSigned(value, format);

  // Absolute: a magnitude bar growing from a centred zero axis (signed), with
  // the value in an aligned right-hand column.
  if (mark === "bar") {
    const labelRoom = 34;
    const axisX = Math.round((width - labelRoom) * 0.5);
    const half = (width - labelRoom) * 0.5 - 3;
    const dir = value >= 0 ? 1 : -1;
    const barW = Math.max(Math.min(Math.abs(value) / domain, 1) * half, value === 0 ? 0 : 1);
    const barH = emphasis ? 13 : 10;
    const x = dir > 0 ? axisX : axisX - barW;
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
        {value !== 0 && <rect x={x} y={cy - barH / 2} width={barW} height={barH} fill={color} />}
        <text
          x={width - 4}
          y={cy + 3.5}
          textAnchor="end"
          fontSize={10.5}
          fontStyle={italic}
          fontWeight={weight}
          fill={labelColor}
        >
          {label}
        </text>
      </svg>
    );
  }

  // Percent: a pin (line + dot) on a centred axis, off-scale arrows at the edge.
  const labelRoom = 30;
  const axisX = Math.round((width - labelRoom) * 0.5);
  const room = (width - labelRoom) * 0.5 - 6;
  const dir = value >= 0 ? 1 : -1;
  const frac = Math.min(Math.abs(value) / domain, 1);

  let markX: number;
  let labelX: number;
  let anchor: "start" | "end";
  if (outlier) {
    markX = dir > 0 ? width - labelRoom - 2 : 4;
    labelX = width - 4;
    anchor = "end";
  } else {
    markX = axisX + dir * frac * room;
    labelX = width - 4;
    anchor = "end";
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
      {!outlier && value !== 0 && <circle cx={markX} cy={cy} r={3} fill={tokens.color.text} />}
      {outlier && (
        <polygon
          points={`${markX},${cy} ${markX - dir * 7},${cy - 4} ${markX - dir * 7},${cy + 4}`}
          fill={color}
        />
      )}
      <text
        x={labelX}
        y={cy + 3.5}
        textAnchor={anchor}
        fontSize={10.5}
        fontStyle={italic}
        fontWeight={weight}
        fill={labelColor}
      >
        {label}
      </text>
    </svg>
  );
}
