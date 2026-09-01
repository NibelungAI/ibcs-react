import { forwardRef, useMemo, type CSSProperties } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import { computeTree, type TreeNode } from "../core/tree";
import { formatValue, formatSigned, type FormatOptions } from "../core/format";
import { useMountGrow, useDataTween } from "./hooks";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";

// Local, CJK-aware text metrics: wide glyphs count ~1em where the shared
// `./internal/text` heuristic assumes a uniform 0.6em - kept for label fitting.
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

export type { TreeNode } from "../core/tree";

export interface TreeChartProps {
  /** Root of the calculation tree. */
  root: TreeNode;
  /** Whether a higher value is good (false for cost measures). Default true. */
  higherIsBetter?: boolean;
  /** "horizontal" (root left → leaves right) or "vertical" (top-down). Default "horizontal". */
  orientation?: "horizontal" | "vertical";
  /** Print a Δ-vs-PY badge under each value when a `py` is given. Default true. */
  showVariance?: boolean;
  width?: number;
  height?: number;
  format?: FormatOptions;
  tokens?: IbcsTokensOverride;
  title?: string;
  /** Class name for the chart's root `<svg>`. */
  className?: string;
  /** Inline style merged over the root `<svg>`'s own layout style (your keys win). */
  style?: CSSProperties;
}

const OP_GLYPH: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/**
 * IBCS calculation tree (template C11): each measure is a small box holding its
 * label, value, and an impact-colored Δ vs PY; links express how children
 * combine into their parent (e.g. Return on assets = Return / Assets), with the
 * parent's operator drawn as a small badge on the branch. Layout is computed
 * deterministically in `computeTree` from tree depth/breadth.
 *
 * The forwarded ref lands on the chart's `<svg>` element.
 */
export const TreeChart = forwardRef<SVGSVGElement, TreeChartProps>(function TreeChart(
  {
    root: rootProp,
    higherIsBetter = true,
    orientation = "horizontal",
    showVariance = true,
    width = 720,
    height = 360,
    format = {},
    tokens: tokenOverride,
    title,
    className,
    style,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const root = useDataTween(rootProp);
  const grow = useMountGrow(500, 0, root);

  const layout = useMemo(
    () => computeTree(root, { higherIsBetter, orientation }),
    [root, higherIsBetter, orientation],
  );
  const { nodes, links, depthCount, rowCount } = layout;

  const padL = 12;
  const padR = 12;
  const padT = title ? 36 : 14;
  const padB = 14;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const horizontal = orientation === "horizontal";
  // Columns run along the "depth" axis, rows along the "breadth" axis.
  const depthSpan = horizontal ? innerW : innerH;
  const rowSpan = horizontal ? innerH : innerW;
  const depthStep = depthSpan / depthCount;
  const rowStep = rowSpan / rowCount;

  const boxW = horizontal ? Math.min(depthStep * 0.78, 132) : Math.min(rowStep * 0.86, 132);
  const boxH = horizontal ? Math.min(rowStep * 0.66, 54) : Math.min(depthStep * 0.6, 54);

  // Text is laid out as a fraction of the box so nothing spills out when the box
  // shrinks (deep/wide trees, small canvases). Fonts scale with the box too.
  const labelFont = Math.max(7, Math.min(10, boxH * 0.2));
  const valueFont = Math.max(9, Math.min(14, boxH * 0.3));
  const varFont = Math.max(7, Math.min(9.5, boxH * 0.185));

  // Center of a node's box in px, from its (depth, row) grid slot.
  const centerOf = (depth: number, row: number) => {
    const alongDepth = depthStep * depth + depthStep / 2;
    const alongRow = rowStep * row + rowStep / 2;
    return horizontal
      ? { x: padL + alongDepth, y: padT + alongRow }
      : { x: padL + alongRow, y: padT + alongDepth };
  };

  const posById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const node of nodes) m.set(node.id, centerOf(node.depth, node.row));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, depthStep, rowStep, horizontal, padL, padT]);

  // Connector from a parent box edge to a child box edge (elbow path).
  function connector(parent: { x: number; y: number }, child: { x: number; y: number }) {
    if (horizontal) {
      const x1 = parent.x + boxW / 2;
      const x2 = child.x - boxW / 2;
      const mx = (x1 + x2) / 2;
      return `M${x1.toFixed(1)},${parent.y.toFixed(1)} L${mx.toFixed(1)},${parent.y.toFixed(1)} L${mx.toFixed(1)},${child.y.toFixed(1)} L${x2.toFixed(1)},${child.y.toFixed(1)}`;
    }
    const y1 = parent.y + boxH / 2;
    const y2 = child.y - boxH / 2;
    const my = (y1 + y2) / 2;
    return `M${parent.x.toFixed(1)},${y1.toFixed(1)} L${parent.x.toFixed(1)},${my.toFixed(1)} L${child.x.toFixed(1)},${my.toFixed(1)} L${child.x.toFixed(1)},${y2.toFixed(1)}`;
  }

  // Screen-reader data table: the tree flattened in document order (root first,
  // then each branch), depth shown as a "· " prefix the way the boxes indent, so
  // the hierarchy the connectors draw survives in a linear reading. Each node
  // keeps its own `format` override, exactly as its box label does.
  const hasPy = nodes.some((node) => node.py != null);
  const showDelta = showVariance && hasPy;
  const a11yColumns = ["Value", ...(hasPy ? ["PY"] : []), ...(showDelta ? ["ΔPY"] : [])];
  const a11yRows: ChartDataRow[] = nodes.map((node) => {
    const f = node.format ?? format;
    const cells: Array<string | number> = [formatValue(node.value, f)];
    if (hasPy) cells.push(node.py != null ? formatValue(node.py, f) : "n/a");
    if (showDelta) cells.push(node.variance ? formatSigned(node.variance.abs, f) : "n/a");
    return { label: `${"· ".repeat(node.depth)}${node.label}`, cells };
  });

  return (
    <>
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          title
            ? `${title}. Calculation tree of ${nodes.length} measures.`
            : `Calculation tree of ${nodes.length} measures`
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
        {title && (
          <text x={padL} y={20} fontSize={13} fontWeight={500} fill={tokens.color.text}>
            {title}
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
          const bx = horizontal ? p.x + boxW / 2 + depthStep / 4 : p.x;
          const by = horizontal ? p.y : p.y + boxH / 2 + depthStep / 4;
          return (
            <g key={`op-${node.id}`} opacity={grow}>
              <circle
                cx={bx}
                cy={by}
                r={8}
                fill={tokens.color.surface}
                stroke={tokens.color.axis}
                strokeWidth={1}
              />
              <text
                x={bx}
                y={by + 3.5}
                fontSize={11}
                fontWeight={600}
                fill={tokens.color.text}
                textAnchor="middle"
              >
                {OP_GLYPH[node.op] ?? node.op}
              </text>
            </g>
          );
        })}

        {/* Node boxes */}
        {nodes.map((node) => {
          const p = posById.get(node.id);
          if (!p) return null;
          const isRoot = node.parentId == null;
          const x = p.x - boxW / 2;
          const y = p.y - boxH / 2;
          const v = node.variance;
          const dColor =
            v == null
              ? tokens.color.textMuted
              : v.abs === 0
                ? tokens.color.zero
                : v.favorable
                  ? tokens.color.good
                  : tokens.color.bad;
          return (
            <g key={`nd-${node.id}`} opacity={grow}>
              <rect
                x={x}
                y={y}
                width={boxW}
                height={boxH}
                rx={4}
                fill={tokens.color.surface}
                stroke={isRoot ? tokens.color.total : tokens.color.rowBorder}
                strokeWidth={isRoot ? 1.75 : 1}
              />
              <text
                x={p.x}
                y={y + boxH * (showVariance && v ? 0.28 : 0.32)}
                fontSize={labelFont}
                fill={tokens.color.textMuted}
                textAnchor="middle"
              >
                {fitLabel(node.label, boxW - 8, labelFont)}
              </text>
              <text
                x={p.x}
                y={y + boxH * (showVariance && v ? 0.58 : 0.64)}
                fontSize={valueFont}
                fontWeight={600}
                fill={tokens.color.text}
                textAnchor="middle"
              >
                {fitLabel(formatValue(node.value, node.format ?? format), boxW - 8, valueFont)}
              </text>
              {showVariance && v && (
                <text
                  x={p.x}
                  y={y + boxH * 0.85}
                  fontSize={varFont}
                  fill={dColor}
                  textAnchor="middle"
                >
                  {fitLabel(
                    `${formatSigned(v.abs, node.format ?? format)} vs PY`,
                    boxW - 6,
                    varFont,
                  )}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartDataTable
        caption={title ? `${title} - data table` : "Calculation tree data table"}
        columns={a11yColumns}
        rows={a11yRows}
      />
    </>
  );
});
