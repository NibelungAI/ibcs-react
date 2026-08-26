import { finiteOr, isFiniteNumber, normalizeDomain } from "./domain";
import type {
  FlatRow,
  ScenarioKey,
  StatementLine,
  WaterfallBar,
  WaterfallLayout,
  WaterfallRow,
} from "./types";
import { resolveValue } from "./variance";

/**
 * Flatten the model into render rows. A group is expanded unless its id is in
 * the `collapsed` set, which the table owns and toggles.
 */
export function flattenVisible(
  lines: StatementLine[],
  collapsed: Set<string>,
  depth = 0,
): FlatRow[] {
  const out: FlatRow[] = [];
  for (const line of lines) {
    const hasChildren = !!line.children?.length;
    const isExpanded = hasChildren && !collapsed.has(line.id);
    out.push({ line, depth, hasChildren, isExpanded });
    if (isExpanded) {
      out.push(...flattenVisible(line.children!, collapsed, depth + 1));
    }
  }
  return out;
}

/**
 * Compute the actual-column waterfall over already-flattened rows.
 *
 * Rules:
 *  - expanded group header -> hollow "outline" bracket spanning the group; the
 *    running total is NOT advanced here (the children below carry the flow and
 *    fill the bracket). The group stays visible instead of disappearing.
 *  - collapsed group / leaf -> "delta" bar that moves the running total
 *  - result line            -> "full" bar origin..runningTotal, total unchanged
 *
 * Every row also reports `cumBefore`/`cumAfter` (the running total entering and
 * leaving it) so the renderer can draw connector lines, and the domain tracks
 * both extremes so negative running totals map correctly around a zero axis (an
 * all-negative statement keeps `domainMax === 0`). A missing / non-finite value
 * contributes 0 to the run rather than poisoning every level below it.
 */
export function computeWaterfall(rows: FlatRow[], scenario: ScenarioKey = "AC"): WaterfallLayout {
  let cum = 0;
  // Always include 0 so the zero axis sits inside the lane for all-positive data.
  let domainMin = 0;
  let domainMax = 0;
  const track = (...vals: number[]) => {
    for (const v of vals) {
      if (!isFiniteNumber(v)) continue;
      domainMin = Math.min(domainMin, v);
      domainMax = Math.max(domainMax, v);
    }
  };

  const result: WaterfallRow[] = rows.map((row) => {
    const { line, hasChildren, isExpanded } = row;
    const flow = line.flow ?? "add";
    const v = finiteOr(resolveValue(line, scenario));

    // Expanded group: a hollow bracket over the span its children will fill.
    // The model invariant (children sum to the parent) means this bracket ends
    // exactly where the children's steps do, so we don't advance `cum` here.
    if (hasChildren && isExpanded) {
      const from = cum;
      const to = flow === "subtract" ? cum - v : cum + v;
      track(from, to);
      return {
        ...row,
        cumBefore: cum,
        cumAfter: cum,
        bar: {
          kind: "delta",
          from,
          to,
          direction: flow === "subtract" ? "subtract" : "add",
          outline: true,
        },
      };
    }

    if (flow === "result") {
      track(0, cum);
      return { ...row, cumBefore: cum, cumAfter: cum, bar: { kind: "full", from: 0, to: cum } };
    }

    const from = cum;
    const to = flow === "subtract" ? cum - v : cum + v;
    cum = to;
    track(from, to);
    return {
      ...row,
      cumBefore: from,
      cumAfter: to,
      bar: { kind: "delta", from, to, direction: flow === "subtract" ? "subtract" : "add" },
    };
  });

  return { rows: result, ...normalizeDomain(domainMin, domainMax) };
}

/**
 * Compute a "stock" (levels) layout — the balance-sheet view. Unlike the
 * waterfall, nothing flows into a running total: every row is an absolute
 * **level**, a full bar from the zero axis to its own value (the ending
 * balance). Subtotals (result lines) and group headers are emphasised (drawn
 * as the thick `full` bar); leaf components are neutral `delta` bars from 0.
 *
 * Connectors collapse to the axis (cumBefore = cumAfter = 0), so the lane reads
 * as a set of stacked-magnitude bars rather than a moving total. Use this when
 * the statement is a balance sheet (assets / liabilities / equity) instead of a
 * P&L. The shape matches {@link computeWaterfall} so the same renderer draws it.
 */
export function computeLevels(rows: FlatRow[], scenario: ScenarioKey = "AC"): WaterfallLayout {
  let domainMin = 0;
  let domainMax = 0;

  const result: WaterfallRow[] = rows.map((row) => {
    const v = finiteOr(resolveValue(row.line, scenario));
    domainMin = Math.min(domainMin, v);
    domainMax = Math.max(domainMax, v);

    // A subtotal is a result line or any group header (its value is the sum of
    // its parts) — drawn as the emphasised full bar. Everything else is a leaf
    // level, a neutral bar from the axis.
    const isSubtotal = (row.line.flow ?? "add") === "result" || row.hasChildren;
    const bar: WaterfallBar = isSubtotal
      ? { kind: "full", from: 0, to: v }
      : { kind: "delta", from: 0, to: v, direction: v < 0 ? "subtract" : "add" };

    return { ...row, cumBefore: 0, cumAfter: 0, bar };
  });

  return { rows: result, ...normalizeDomain(domainMin, domainMax) };
}
