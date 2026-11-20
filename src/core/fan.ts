/**
 * Fan bands - a range that varies along the x axis: for each period, a lower
 * and an upper edge, shaded between them. The 10th to the 90th percentile of
 * all simulated fights at each moment of a fight is one; a forecast's
 * interval is another. `LineChart` draws them as `fans`, beneath its lines.
 *
 * The chart draws the edges it is given; computing them is the caller's.
 *
 * Pure data, like the rest of `core/`. SSR-safe.
 */

/** A band whose edges vary from period to period. */
export interface FanBand {
  /**
   * The lower edge per period, aligned with the chart's `data` by index. A
   * missing or non-finite entry (in either edge) leaves a gap: the band
   * breaks there, as a line does.
   */
  from: ReadonlyArray<number | null | undefined>;
  /** The upper edge per period (the two edges may be given in either order). */
  to: ReadonlyArray<number | null | undefined>;
  /**
   * Its caption - "10th to 90th percentile" - placed beside the band's right
   * end where there is room (else written as a numbered note), and the name
   * of its column in the screen-reader table.
   */
  label?: string;
  /** Fill colour. Default the chart's impact-neutral axis colour, drawn faint. */
  color?: string;
}

/** One period of a band: its index and its two edges, `low` ≤ `high`. */
export interface FanPoint {
  index: number;
  low: number;
  high: number;
}

/**
 * A band's periods with both edges finite, in runs of consecutive periods
 * (a gap ends a run), over the first `count` periods.
 *
 * Internal plumbing shared by the renderers - not part of the public surface.
 */
export function fanRuns(band: FanBand, count: number): FanPoint[][] {
  const runs: FanPoint[][] = [];
  let run: FanPoint[] = [];
  const from = band?.from ?? [];
  const to = band?.to ?? [];
  for (let i = 0; i < count; i++) {
    const a = from[i];
    const b = to[i];
    if (
      typeof a === "number" &&
      typeof b === "number" &&
      Number.isFinite(a) &&
      Number.isFinite(b)
    ) {
      run.push({ index: i, low: Math.min(a, b), high: Math.max(a, b) });
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);
  return runs;
}
