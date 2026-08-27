import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import {
  computeRatioTree,
  type RatioNode,
  type RatioLayoutNode,
  type RatioOp,
} from "../core/ratioTree";
import { computeVariance } from "../core/variance";
import { formatValue, formatSigned, formatPercent, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween, useChartHover } from "./hooks";
import type { ChartHover } from "./hooks";
import { markInteraction } from "./internal/hover";
import { ChartTooltip, type ChartTooltipRow } from "./ChartTooltip";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { clampTo, svgSafeId } from "./internal/text";
import { useIbcsTokens } from "./theme";

// Local, CJK-aware text metrics: wide glyphs count ~1em where the shared
// `./internal/text` heuristics assume a uniform 0.6em — node labels and values
// are packed tightly into a fixed box, so the finer estimate matters here.
/** Approx. glyph width in px (CJK/full-width/emoji count as ~1em). SSR-safe. */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    cp >= 0x1f000
  );
}

/** Clip a label to an approximate pixel budget, adding an ellipsis. SSR-safe (no measuring). */
function fitLabel(s: string, maxPx: number, fontPx: number): string {
  if (maxPx <= 0 || !s) return "";
  const wOf = (ch: string) => fontPx * (isWide(ch.codePointAt(0) ?? 0) ? 1.05 : 0.62);
  const chars = [...s];
  let total = 0;
  for (const ch of chars) total += wOf(ch);
  if (total <= maxPx) return s;
  let budget = maxPx - fontPx * 0.62; // reserve room for the ellipsis
  let out = "";
  for (const ch of chars) {
    const w = wOf(ch);
    if (budget - w < 0) break;
    budget -= w;
    out += ch;
  }
  out = out.trimEnd();
  return out ? out + "…" : "…";
}

/** Approximate rendered width of a string at a given font size. SSR-safe heuristic. */
function estTextW(s: string, fontPx: number): number {
  let w = 0;
  for (const ch of s) w += fontPx * (isWide(ch.codePointAt(0) ?? 0) ? 1.05 : 0.62);
  return w;
}

export type { RatioNode, RatioLayoutNode, RatioOp } from "../core/ratioTree";

const OP_GLYPH: Record<RatioOp, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

export interface RatioTreeChartProps {
  /** Root of the ratio/calculation tree (each node is a period series). */
  root: RatioNode;
  /** "horizontal" (root left → leaves right) or "vertical" (top-down). Default "horizontal". */
  orientation?: "horizontal" | "vertical";
  /** Mini-chart inside each node: small "column" series (default) or a "line". */
  miniChart?: "column" | "line";
  /** Minimum SVG width; columns are spread to fill any extra. Height is derived. */
  width?: number;
  /** Width of each node box in px (kept legible, ~120–160). Default 152. */
  nodeWidth?: number;
  /** Height of each node box in px. Default 84. */
  nodeHeight?: number;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class name for the chart's `<svg>`. */
  className?: string;
  /** Inline style merged over the `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
  /**
   * Fired as the pointer moves over / leaves a node (`null` on leave) — for a
   * custom tooltip. Pairs naturally with `useChartHover`. Default undefined.
   */
  onHover?: (hover: ChartHover<RatioLayoutNode> | null) => void;
  /**
   * Show the built-in floating tooltip on node hover or keyboard focus (label,
   * latest value, and Δ vs the PY reference). Default true; set false to opt
   * out. Renders on the client only, near a hovered mark (or the focused /
   * tapped one); Escape dismisses it.
   */
  tooltip?: boolean;
}

/**
 * IBCS **chart-template C11** — a DuPont-style ratio tree where EACH node is a
 * small *time-series* chart, not a single value. Boxes hold a label, the latest
 * value, and a mini column (default) or line micro-chart of the node's `series`
 * with an optional faint PY reference overlay; links express how children
 * combine into their parent (e.g. ROI = Return on sales × Capital turnover),
 * with the parent's operator drawn as a small badge (× ÷ + −) on the branch.
 *
 * Layout is computed deterministically in {@link computeRatioTree}; each mini
 * chart uses its own per-node value scale that always includes zero (IBCS: the
 * baseline must be on the chart so negatives read correctly). Pure SVG, zero
 * dependencies, SSR-safe.
 *
 * The component renders the chart `<svg>` plus (on hover or keyboard focus) a
 * floating tooltip, so `className` / `style` / the forwarded ref all land on
 * the `<svg>`.
 */
export const RatioTreeChart = forwardRef<SVGSVGElement, RatioTreeChartProps>(
  function RatioTreeChart(
    {
      root: rootProp,
      orientation = "horizontal",
      miniChart = "column",
      width = 880,
      nodeWidth = 152,
      nodeHeight = 84,
      format = {},
      tokens: tokenOverride,
      title,
      className,
      style,
      onHover,
      tooltip = true,
    },
    ref,
  ) {
    const tokens = useIbcsTokens(tokenOverride);
    // Sanitised so the id stays a valid selector after an SVG export/serialization.
    const hatchId = svgSafeId(useId());
    const hover = useChartHover<RatioLayoutNode>();
    const marks = markInteraction(hover, tooltip, onHover);
    const hoverEnabled = marks.enabled;
    // Value ticks tween; the entrance replays only on a shape change.
    const root = useDataTween(rootProp);
    const grow = useMountGrow(550, 0, root);

    const layout = useMemo(() => computeRatioTree(root, { orientation }), [root, orientation]);
    const { nodes, links, depthCount, rowCount } = layout;

    const horizontal = orientation === "horizontal";
    const padL = 14;
    const padR = 14;
    const padT = title ? 40 : 16;
    const padB = 16;

    // The "depth" axis carries levels (root → leaves); the "row" axis stacks
    // siblings. Each maps to x or y depending on orientation.
    const depthExtent = horizontal ? nodeWidth : nodeHeight;
    const rowExtent = horizontal ? nodeHeight : nodeWidth;
    // Gap between depth levels leaves room for the connector + operator badge.
    const depthGapMin = horizontal ? 66 : 50;
    const rowGap = horizontal ? 22 : 30;

    // Geometry: lay out along depth/row, then project to x/y. The depth axis is
    // stretched to fill any extra `width` (horizontal) / fixed (vertical); the row
    // axis grows the cross-dimension to fit all siblings.
    const geom = useMemo(() => {
      const depthAxisIsX = horizontal;
      // --- depth axis ---
      const depthPad = depthAxisIsX ? padL + padR : padT + padB;
      const depthStart = depthAxisIsX ? padL : padT;
      const depthBaseSpan =
        depthPad + depthCount * depthExtent + Math.max(0, depthCount - 1) * depthGapMin;
      // Only the horizontal depth axis stretches to honour `width`.
      const depthSpan = depthAxisIsX ? Math.max(width, depthBaseSpan) : depthBaseSpan;
      const depthGap =
        depthCount > 1
          ? (depthSpan - depthPad - depthCount * depthExtent) / (depthCount - 1)
          : depthGapMin;
      const depthPitch = depthExtent + depthGap;

      // --- row axis ---
      const rowPad = depthAxisIsX ? padT + padB : padL + padR;
      const rowStart = depthAxisIsX ? padT : padL;
      const rowBaseSpan = rowPad + rowCount * rowExtent + Math.max(0, rowCount - 1) * rowGap;
      // The vertical layout stretches the (horizontal) row axis to honour `width`.
      const rowSpan = depthAxisIsX ? rowBaseSpan : Math.max(width, rowBaseSpan);
      const rowGapEff =
        depthAxisIsX || rowCount <= 1
          ? rowGap
          : (rowSpan - rowPad - rowCount * rowExtent) / (rowCount - 1);
      const rowPitch = rowExtent + rowGapEff;

      const svgW = depthAxisIsX ? depthSpan : rowSpan;
      const svgH = depthAxisIsX ? rowSpan : depthSpan;
      return { depthStart, depthPitch, depthGap, rowStart, rowPitch, svgW, svgH };
    }, [
      horizontal,
      depthCount,
      rowCount,
      depthExtent,
      rowExtent,
      depthGapMin,
      rowGap,
      width,
      padL,
      padR,
      padT,
      padB,
    ]);

    // Center of a node's box, from its (depth, row) grid slot.
    const centerOf = (depth: number, row: number) => {
      const alongDepth = geom.depthStart + depth * geom.depthPitch + depthExtent / 2;
      const alongRow = geom.rowStart + row * geom.rowPitch + rowExtent / 2;
      return horizontal ? { x: alongDepth, y: alongRow } : { x: alongRow, y: alongDepth };
    };

    const posById = useMemo(() => {
      const m = new Map<string, { x: number; y: number }>();
      for (const node of nodes) m.set(node.id, centerOf(node.depth, node.row));
      return m;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, geom, horizontal, depthExtent, rowExtent]);

    // Elbow connector from a parent box edge to a child box edge.
    function connector(p: { x: number; y: number }, c: { x: number; y: number }) {
      if (horizontal) {
        const x1 = p.x + nodeWidth / 2;
        const x2 = c.x - nodeWidth / 2;
        const mx = (x1 + x2) / 2;
        return `M${x1.toFixed(1)},${p.y.toFixed(1)} L${mx.toFixed(1)},${p.y.toFixed(1)} L${mx.toFixed(1)},${c.y.toFixed(1)} L${x2.toFixed(1)},${c.y.toFixed(1)}`;
      }
      const y1 = p.y + nodeHeight / 2;
      const y2 = c.y - nodeHeight / 2;
      const my = (y1 + y2) / 2;
      return `M${p.x.toFixed(1)},${y1.toFixed(1)} L${p.x.toFixed(1)},${my.toFixed(1)} L${c.x.toFixed(1)},${my.toFixed(1)} L${c.x.toFixed(1)},${y2.toFixed(1)}`;
    }

    // --- per-node mini-chart geometry ---
    const headerH = 24;
    const chartPadX = 9;
    const chartPadTop = 3;
    const chartPadBottom = 7;
    const chartW = Math.max(1, nodeWidth - 2 * chartPadX);
    const chartH = Math.max(8, nodeHeight - headerH - chartPadTop - chartPadBottom);
    const labelFont = 10;
    const valueFont = 12.5;

    /** Render the mini time-series for one node, positioned at the box's top-left. */
    function renderMini(node: RatioLayoutNode, boxX: number, boxY: number) {
      const cx0 = boxX + chartPadX;
      const cy0 = boxY + headerH + chartPadTop;
      const series = node.series;
      const py = node.py;

      // Per-node value scale, always including zero so the baseline is on-chart.
      let min = 0;
      let max = 0;
      for (const v of series)
        if (Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      if (py)
        for (const v of py)
          if (Number.isFinite(v)) {
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
      const range = max - min || 1;
      const yOf = (v: number) => cy0 + chartH - ((v - min) / range) * chartH;
      const zeroY = yOf(0);
      // Columns animate from the zero line outward.
      const gY = (v: number) => zeroY + (yOf(v) - zeroY) * grow;

      const n = series.length;
      const slot = n > 0 ? chartW / n : chartW;
      const xAt = (i: number) => cx0 + slot * i + slot / 2;
      const colW = Math.max(1, Math.min(slot * 0.6, 13));

      // PY reference points (aligned by index), skipping non-finite samples.
      const pyPts: Array<{ x: number; y: number }> = [];
      if (py) {
        py.forEach((v, i) => {
          if (Number.isFinite(v)) pyPts.push({ x: xAt(i), y: yOf(v) });
        });
      }
      const pyLine = pyPts
        .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
      const pyFirst = pyPts[0];
      const pyLast = pyPts[pyPts.length - 1];

      return (
        <g>
          {/* Zero baseline (faint) so positive/negative read correctly */}
          <line
            x1={cx0}
            y1={zeroY}
            x2={cx0 + chartW}
            y2={zeroY}
            stroke={tokens.color.axis}
            strokeWidth={1}
          />

          {/* Faint PY reference: a soft area + line behind the actuals */}
          {pyPts.length >= 2 && pyFirst && pyLast && (
            <>
              <path
                d={`${pyLine} L${pyLast.x.toFixed(1)} ${zeroY.toFixed(1)} L${pyFirst.x.toFixed(1)} ${zeroY.toFixed(1)} Z`}
                fill={tokens.scenario.PY.fill}
                fillOpacity={0.18 * grow}
                stroke="none"
              />
              <path
                d={pyLine}
                fill="none"
                stroke={tokens.scenario.PY.stroke}
                strokeWidth={1.25}
                opacity={0.85 * grow}
              />
            </>
          )}
          {pyPts.length === 1 && pyFirst && (
            <circle
              cx={pyFirst.x}
              cy={pyFirst.y}
              r={1.6}
              fill={tokens.scenario.PY.stroke}
              opacity={0.85 * grow}
            />
          )}

          {/* Actuals: solid columns (default) or a line */}
          {miniChart === "line"
            ? (() => {
                const pts: Array<{ x: number; y: number }> = [];
                series.forEach((v, i) => {
                  if (Number.isFinite(v)) pts.push({ x: xAt(i), y: yOf(v) });
                });
                const last = pts[pts.length - 1];
                if (!last) return null;
                const d = pts
                  .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                  .join(" ");
                return (
                  <g opacity={grow}>
                    <path
                      d={d}
                      fill="none"
                      stroke={tokens.scenario.AC.fill}
                      strokeWidth={1.75}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    <circle cx={last.x} cy={last.y} r={2.4} fill={tokens.scenario.AC.fill} />
                  </g>
                );
              })()
            : series.map((v, i) => {
                if (!Number.isFinite(v)) return null;
                const top = Math.min(zeroY, gY(v));
                const h = Math.max(Math.abs(gY(v) - zeroY), v === 0 ? 0 : 0.6);
                const bx = clampTo(xAt(i) - colW / 2, cx0, cx0 + chartW - colW);
                return (
                  <rect
                    key={i}
                    x={bx}
                    y={top}
                    width={colW}
                    height={h}
                    fill={tokens.scenario.AC.fill}
                  />
                );
              })}
        </g>
      );
    }

    // Built-in tooltip: label, latest value, PY reference, and the impact-coloured Δ.
    // Values render at FULL precision (compact: false): the box prints a compact
    // headline number, so the tooltip adds the exact figure instead of echoing.
    const renderTooltip = () => {
      const h = hover.hovered;
      if (!tooltip || !h) return null;
      const node = h.datum;
      const exact = { ...format, compact: false };
      const rows: ChartTooltipRow[] = [
        {
          label: "Latest",
          value: node.latest != null ? formatValue(node.latest, exact) : "—",
          strong: true,
        },
      ];
      if (node.latestPy != null) {
        rows.push({ label: "PY", value: formatValue(node.latestPy, exact) });
        const v = computeVariance(node.latest, node.latestPy, true);
        if (v) {
          const color =
            v.abs === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
          const pct = v.pct != null ? ` (${formatPercent(v.pct)})` : "";
          rows.push({ label: "Δ PY", value: `${formatSigned(v.abs, exact)}${pct}`, color });
        }
      }
      return (
        <ChartTooltip
          ref={hover.tooltipRef}
          x={h.x}
          y={h.y}
          title={node.label}
          rows={rows}
          tokens={tokens}
        />
      );
    };

    // Screen-reader data table: the tree flattened in document order (root first,
    // then each branch), depth shown as a "· " prefix the way the boxes indent.
    // Each node reports the headline number its box prints — the latest point of
    // its mini series — against the PY reference the overlay draws.
    const hasPy = nodes.some((node) => node.latestPy != null);
    const a11yColumns = ["Latest", ...(hasPy ? ["PY", "ΔPY"] : [])];
    const a11yRows: ChartDataRow[] = nodes.map((node) => {
      const cells: Array<string | number> = [
        node.latest != null ? formatValue(node.latest, format) : "n/a",
      ];
      if (hasPy) {
        cells.push(node.latestPy != null ? formatValue(node.latestPy, format) : "n/a");
        const v = computeVariance(node.latest, node.latestPy, true);
        cells.push(v ? formatSigned(v.abs, format) : "n/a");
      }
      return { label: `${"· ".repeat(node.depth)}${node.label}`, cells };
    });

    return (
      <>
        <svg
          ref={ref}
          width={geom.svgW}
          height={geom.svgH}
          viewBox={`0 0 ${geom.svgW} ${geom.svgH}`}
          role="img"
          aria-label={
            title
              ? `${title}. Ratio tree of ${nodes.length} time-series measures.`
              : `Ratio tree of ${nodes.length} time-series measures`
          }
          className={className}
          style={{
            display: "block",
            maxWidth: "100%",
            marginInline: "auto",
            fontFamily: tokens.font.family,
            ...style,
          }}
        >
          <defs>
            <pattern
              id={hatchId}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="5"
                stroke={tokens.scenario.FC.stroke}
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {title && (
            <text x={padL} y={22} fontSize={14} fontWeight={600} fill={tokens.color.text}>
              {fitLabel(title, geom.svgW - padL - padR, 14)}
            </text>
          )}

          {/* Connectors */}
          {links.map((link) => {
            const p = posById.get(link.from);
            const c = posById.get(link.to);
            if (!p || !c) return null;
            return (
              <path
                key={`lk-${link.from}-${link.to}`}
                d={connector(p, c)}
                fill="none"
                stroke={tokens.color.rowBorder}
                strokeWidth={1.25}
                opacity={grow}
              />
            );
          })}

          {/* Operator badges: one per parent that defines an op, on the branch side */}
          {nodes.map((node) => {
            if (!node.op || node.childIds.length === 0) return null;
            const p = posById.get(node.id);
            if (!p) return null;
            const bx = horizontal ? p.x + nodeWidth / 2 + geom.depthGap / 2 : p.x;
            const by = horizontal ? p.y : p.y + nodeHeight / 2 + geom.depthGap / 2;
            return (
              <g key={`op-${node.id}`} opacity={grow}>
                <circle
                  cx={bx}
                  cy={by}
                  r={9}
                  fill={tokens.color.surface}
                  stroke={tokens.color.axis}
                  strokeWidth={1}
                />
                <text
                  x={bx}
                  y={by + 3.6}
                  fontSize={12}
                  fontWeight={700}
                  fill={tokens.color.text}
                  textAnchor="middle"
                >
                  {OP_GLYPH[node.op]}
                </text>
              </g>
            );
          })}

          {/* Node boxes with their mini time-series */}
          {nodes.map((node) => {
            const p = posById.get(node.id);
            if (!p) return null;
            const isRoot = node.parentId == null;
            const x = p.x - nodeWidth / 2;
            const y = p.y - nodeHeight / 2;
            const valueStr = node.latest != null ? formatValue(node.latest, format) : "—";
            const valW = estTextW(valueStr, valueFont);
            const labelMax = nodeWidth - 10 - valW - 6;
            const info = { category: node.label, value: node.latest ?? 0, datum: node };
            return (
              <g key={`nd-${node.id}`} opacity={grow}>
                <rect
                  x={x}
                  y={y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={5}
                  fill={tokens.color.surface}
                  stroke={isRoot ? tokens.color.total : tokens.color.rowBorder}
                  strokeWidth={isRoot ? 1.75 : 1}
                />
                {/* Header: label (left, truncated) + latest value (right, bold) */}
                <text
                  x={x + 9}
                  y={y + 16}
                  fontSize={labelFont}
                  fontWeight={500}
                  fill={tokens.color.textMuted}
                >
                  {fitLabel(node.label, Math.max(10, labelMax), labelFont)}
                </text>
                <text
                  x={x + nodeWidth - 9}
                  y={y + 16.5}
                  fontSize={valueFont}
                  fontWeight={700}
                  fill={tokens.color.text}
                  textAnchor="end"
                >
                  {valueStr}
                </text>
                {renderMini(node, x, y)}
                {/* Transparent hit target for hover */}
                {hoverEnabled && (
                  <rect
                    x={x}
                    y={y}
                    width={nodeWidth}
                    height={nodeHeight}
                    fill="transparent"
                    {...marks.forMark(info)}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <ChartDataTable
          caption={title ? `${title} — data table` : "Ratio tree data table"}
          columns={a11yColumns}
          rows={a11yRows}
        />
        {renderTooltip()}
      </>
    );
  },
);
