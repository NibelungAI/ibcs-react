/**
 * Point callouts - labelled points the caller names on a line or trend chart:
 * the inflection points of J.P. Morgan's Guide to the Markets (p. 4), each
 * written with its date and value beside its point; a gear change in a run of
 * results. `LineChart` and `TrendChart` take them as `callouts`.
 *
 * The chart places each label beside its point, clear of every line, marker
 * and other label, and writes a callout that finds no room as a numbered
 * note instead - so every callout is on the chart. Which points to call out,
 * and what to say, is the caller's.
 *
 * Pure data, like the rest of `core/`. SSR-safe.
 */

import type { ScenarioKey } from "./types";
import type { PlacementSide } from "./labelPlacement";

/** A labelled point of a line or trend chart. */
export interface PointCallout {
  /** The period: its index in the chart's `data`. */
  index: number;
  /**
   * The text. A "\n" starts a new line: "Mar 24, 2000\n1,527". A line wider
   * than the chart allows is wrapped between words, never cut.
   */
  label: string;
  /**
   * The series the point lies on. `LineChart`: a drawn scenario, default
   * "AC" (else the first drawn). `TrendChart`: default the column - the
   * period's current value, AC or FC; "PY" or "PL" for a point of a drawn
   * reference line.
   */
  series?: ScenarioKey;
  /**
   * Which side of its point the label takes: `"auto"` (default) above a peak
   * and below a trough, else above, each falling back to the other side;
   * `"above"` or `"below"` keep that side (a callout with no room there is
   * written as a numbered note).
   */
  placement?: "auto" | "above" | "below";
}

/**
 * The sides a callout's label tries, in order, for a point of `value` between
 * the values of the periods before and after it (undefined where there is
 * none): above a peak, below a trough, else above - then the other side; or
 * the one side `placement` names.
 *
 * Internal plumbing shared by the renderers - not part of the public surface.
 */
export function calloutSides(
  value: number,
  before: number | undefined,
  after: number | undefined,
  placement: PointCallout["placement"],
): PlacementSide[] {
  if (placement === "above") return ["above"];
  if (placement === "below") return ["below"];
  const peak = (before == null || value >= before) && (after == null || value >= after);
  const trough = (before == null || value <= before) && (after == null || value <= after);
  return trough && !peak ? ["below", "above"] : ["above", "below"];
}
