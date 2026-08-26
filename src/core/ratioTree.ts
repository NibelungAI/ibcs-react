/**
 * Pure layout for an IBCS *ratio / calculation tree* where every node is a
 * **time series** rather than a single value — template **C11** (the "ROI tree":
 * Return on investment = Return on sales × Capital turnover, Return on sales =
 * Return ÷ Net sales, …). It is the time-aware sibling of {@link computeTree}:
 * instead of one number per box, each node carries `series` (the periods, e.g.
 * 2021…2027) plus an optional `py` reference series, and the renderer draws a
 * small column/line micro-chart inside every box.
 *
 * Framework-agnostic and JSON-serializable: the React `RatioTreeChart` is just a
 * renderer over the positions computed here. Layout is deterministic — every
 * node gets a `depth` (distance from the root) and a `row` (vertical slot in
 * leaf units): leaves take successive integer slots in traversal order and each
 * parent is centered on its children. The renderer maps (depth, row) to pixels —
 * left-to-right for "horizontal", or top-down for "vertical".
 */

/** How a node's children combine into it (root = a × b, a ÷ b, …). */
export type RatioOp = "+" | "-" | "*" | "/";

/**
 * A node in a ratio/calculation tree. Unlike a {@link TreeNode}, the measure is
 * a whole period series (`series`, drawn left→right; the last point is the
 * "current"/latest) with an optional previous-period reference (`py`). `op`
 * describes how THIS node's children combine into it.
 */
export interface RatioNode {
  id: string;
  label: string;
  /** How the children combine into this node (root = a / b, etc.). */
  op?: RatioOp;
  /** The period series for this measure (e.g. 2021…2027). Drawn left→right. */
  series: number[];
  /** Optional previous-period reference series, plotted as a faint overlay. */
  py?: number[];
  children?: RatioNode[];
}

/** A placed node: original fields plus its grid position and derived latest. */
export interface RatioLayoutNode {
  id: string;
  label: string;
  op: RatioOp | undefined;
  series: number[];
  py: number[] | undefined;
  /** Last finite value of `series` (the headline / "current"), or undefined. */
  latest: number | undefined;
  /** Last finite value of `py`, aligned with `latest`, or undefined. */
  latestPy: number | undefined;
  /** Column index — 0 is the root. */
  depth: number;
  /** Vertical slot in leaf units (float; parents are centered on children). */
  row: number;
  parentId: string | null;
  /** Ids of this node's children, in order. */
  childIds: string[];
}

/** A connector between a parent and one child. `op` is the parent's operator. */
export interface RatioLink {
  from: string;
  to: string;
  op: RatioOp | undefined;
}

export interface RatioTreeLayout {
  nodes: RatioLayoutNode[];
  links: RatioLink[];
  /** Number of columns (max depth + 1). */
  depthCount: number;
  /** Number of leaf rows — the vertical extent in slot units. */
  rowCount: number;
  /** Longest `series` across all nodes (handy for a shared period axis). */
  maxPeriods: number;
  orientation: "horizontal" | "vertical";
}

export interface ComputeRatioTreeOptions {
  /** "horizontal" lays root → leaves left-to-right; "vertical" top-down. Default "horizontal". */
  orientation?: "horizontal" | "vertical";
}

/** Last finite (non-NaN/±Inf) element of an array, or undefined when none. */
export function lastFinite(xs: readonly number[] | undefined): number | undefined {
  if (!xs) return undefined;
  for (let i = xs.length - 1; i >= 0; i--) {
    if (Number.isFinite(xs[i])) return xs[i];
  }
  return undefined;
}

/**
 * Lay out a ratio/calculation tree. Returns placed nodes (with depth/row, parent
 * and child ids, plus the derived `latest`/`latestPy` headline values), the
 * parent→child links (each stamped with the parent's operator so the renderer
 * can badge the branch), and the grid extents the renderer scales into the plot.
 */
export function computeRatioTree(
  root: RatioNode,
  opts: ComputeRatioTreeOptions = {},
): RatioTreeLayout {
  const orientation = opts.orientation ?? "horizontal";

  const nodes: RatioLayoutNode[] = [];
  const links: RatioLink[] = [];
  const byId = new Map<string, RatioLayoutNode>();
  let leafCursor = 0;
  let depthCount = 0;
  let maxPeriods = 0;

  // First walk: create nodes, assign depths + leaf rows; parents centered after.
  function walk(node: RatioNode, depth: number, parentId: string | null): number {
    depthCount = Math.max(depthCount, depth + 1);
    const series = node.series ?? [];
    maxPeriods = Math.max(maxPeriods, series.length);
    const childIds = (node.children ?? []).map((c) => c.id);
    const placed: RatioLayoutNode = {
      id: node.id,
      label: node.label,
      op: node.op,
      series,
      py: node.py,
      latest: lastFinite(series),
      latestPy: lastFinite(node.py),
      depth,
      row: 0,
      parentId,
      childIds,
    };
    nodes.push(placed);
    byId.set(node.id, placed);
    if (parentId != null) links.push({ from: parentId, to: node.id, op: undefined });

    if (!node.children || node.children.length === 0) {
      placed.row = leafCursor;
      leafCursor += 1;
      return placed.row;
    }

    const childRows = node.children.map((c) => walk(c, depth + 1, node.id));
    // `children.length > 0` was checked above, so both ends are present.
    const firstRow = childRows[0] ?? 0;
    const lastRow = childRows[childRows.length - 1] ?? firstRow;
    placed.row = (firstRow + lastRow) / 2;
    return placed.row;
  }

  walk(root, 0, null);

  // Stamp each link with the parent's operator so the renderer can label it.
  for (const link of links) {
    link.op = byId.get(link.from)?.op;
  }

  return {
    nodes,
    links,
    depthCount,
    rowCount: Math.max(1, leafCursor),
    maxPeriods,
    orientation,
  };
}
