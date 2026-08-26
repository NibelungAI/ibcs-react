import type { Variance } from "./types";
import type { FormatOptions } from "./format";
import { computeVariance } from "./variance";

/**
 * Pure layout for an IBCS calculation tree (template C11): boxes holding a
 * label + a value (+ optional Δ vs PY) connected by links that express a math
 * relationship — e.g. Return on assets = Return / Assets, with Net sales and
 * Assets feeding in. Framework-agnostic and JSON-serializable: the React
 * `TreeChart` is just a renderer over the positions computed here.
 *
 * Layout is deterministic. Every node gets a `depth` (distance from the root)
 * and a `row` (vertical slot, in leaf units): leaves take successive integer
 * slots in traversal order and each parent is centered on its children. The
 * renderer maps (depth, row) to pixels — left-to-right for "horizontal", or
 * top-down for "vertical".
 */

/** A node in the calculation tree. `op` combines THIS node's children into its value. */
export interface TreeNode {
  id: string;
  label: string;
  value: number;
  /** Previous-year value, for the Δ badge. */
  py?: number;
  /** How the children combine into this node's value (root = a / b, etc.). */
  op?: "+" | "-" | "*" | "/";
  /** Per-node number format, overriding the chart's — e.g. a ratio/percent root
   *  among currency drivers (ROA shown as % while its children stay in €). */
  format?: FormatOptions;
  children?: TreeNode[];
}

/** A placed node: original fields plus its grid position, parent, and variance. */
export interface TreeLayoutNode {
  id: string;
  label: string;
  value: number;
  py: number | undefined;
  format?: FormatOptions;
  op: "+" | "-" | "*" | "/" | undefined;
  /** Column index — 0 is the root. */
  depth: number;
  /** Vertical slot in leaf units (float; parents are centered on their children). */
  row: number;
  parentId: string | null;
  /** Ids of this node's children, in order. */
  childIds: string[];
  /** value vs py, colored by favorability. */
  variance: Variance | null;
}

/** A connector between a parent and one child. `op` is the parent's operator. */
export interface TreeLink {
  from: string;
  to: string;
  op: "+" | "-" | "*" | "/" | undefined;
}

export interface TreeLayout {
  nodes: TreeLayoutNode[];
  links: TreeLink[];
  /** Number of columns (max depth + 1). */
  depthCount: number;
  /** Number of leaf rows — the vertical extent in slot units. */
  rowCount: number;
  orientation: "horizontal" | "vertical";
}

export interface ComputeTreeOptions {
  /** Whether a higher value is good (false for cost measures). Default true. */
  higherIsBetter?: boolean;
  /** "horizontal" lays root → leaves left-to-right; "vertical" top-down. Default "horizontal". */
  orientation?: "horizontal" | "vertical";
}

/**
 * Lay out a calculation tree. Returns placed nodes (with depth/row, parent,
 * child ids, and Δ-vs-PY variance), the parent→child links, and the grid
 * extents the renderer scales into the plot rectangle.
 */
export function computeTree(root: TreeNode, opts: ComputeTreeOptions = {}): TreeLayout {
  const higherIsBetter = opts.higherIsBetter ?? true;
  const orientation = opts.orientation ?? "horizontal";

  const nodes: TreeLayoutNode[] = [];
  const links: TreeLink[] = [];
  const byId = new Map<string, TreeLayoutNode>();
  let leafCursor = 0;
  let depthCount = 0;

  // First walk: create nodes, assign depths + leaf rows; parents centered after.
  function walk(node: TreeNode, depth: number, parentId: string | null): number {
    depthCount = Math.max(depthCount, depth + 1);
    const childIds = (node.children ?? []).map((c) => c.id);
    const placed: TreeLayoutNode = {
      id: node.id,
      label: node.label,
      value: node.value,
      py: node.py,
      op: node.op,
      format: node.format,
      depth,
      row: 0,
      parentId,
      childIds,
      variance: node.py != null ? computeVariance(node.value, node.py, higherIsBetter) : null,
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
    const parent = byId.get(link.from);
    link.op = parent?.op;
  }

  return {
    nodes,
    links,
    depthCount,
    rowCount: Math.max(1, leafCursor),
    orientation,
  };
}
