/**
 * Label placement - put text boxes beside the points they name without
 * covering anything else a chart draws: no other label, no marker, no line.
 * The point callouts of `LineChart` and `TrendChart` and the fan captions of
 * `LineChart` are placed this way.
 *
 * Each label is tried on its sides in turn, its box centred over its point
 * and shifted inside the bounds where it would leave them: first right beside
 * the point, then one step further away at a time, until it touches nothing.
 * A label moved away from its point gets a leader line back to the mark (and
 * a `tie` request gets one even right beside it); a leader may cross a data
 * line but never another label or marker, and no later label covers it. A
 * label with no free place on any of its sides is not placed (null): the
 * caller writes it as a numbered note instead, so nothing is left out.
 *
 * Every loop is bounded by the tries per side - the height of the bounds over
 * the step, and never more than 512 - and by the number of labels and
 * obstacles, never by the values themselves.
 *
 * Pure geometry in pixels (svg units, y growing downward). SSR-safe.
 * Internal plumbing shared by the renderers - not part of the public surface.
 */

/** An axis-aligned rectangle, in px. */
export interface PlacementBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A straight line of a chart, with the space a label must keep from its centre line. */
export interface PlacementSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Half the stroke's width, px: a label keeps this much and the margin from the centre line. */
  pad: number;
}

/** Which side of its point a label goes to. */
export type PlacementSide = "above" | "below";

/** One label to place. */
export interface PlacementRequest {
  /** The point it names, px. */
  x: number;
  y: number;
  /** The label's box, px. */
  width: number;
  height: number;
  /**
   * The space between the point and the box's near edge when the box sits
   * right beside it - the marker's radius and a gap, px.
   */
  clearance: number;
  /**
   * How far the mark reaches from the point towards the label, px: a leader
   * starts there (a dot's radius; 0 for a column's end). Default `clearance`.
   */
  reach?: number;
  /** Tie the label to its mark with a leader even right beside it (a mark without a dot). Default false. */
  tie?: boolean;
  /** The sides to try, in order (an empty list places nothing). */
  sides: readonly PlacementSide[];
}

/** Where a label went. */
export interface PlacedLabel {
  box: PlacementBox;
  side: PlacementSide;
  /**
   * The line from the mark (`reach` from the point) to the box, when the box
   * was moved away from the point or the request asks for a `tie`; else null.
   */
  leader: PlacementSegment | null;
}

/** What labels must not touch. */
export interface PlacementObstacles {
  /** Marks and other labels, as boxes. */
  boxes: readonly PlacementBox[];
  /** Lines: data lines, reference lines, axes. */
  segments: readonly PlacementSegment[];
}

export interface PlacementOptions {
  /** How far a label moves per try, px. Default 2. */
  step?: number;
  /** The space kept between a label and anything else, px. Default 2. */
  margin?: number;
}

/** Whether two boxes overlap, or come closer than `margin`. */
export function boxesTouch(a: PlacementBox, b: PlacementBox, margin = 0): boolean {
  return (
    a.left < b.right + margin &&
    a.right > b.left - margin &&
    a.top < b.bottom + margin &&
    a.bottom > b.top - margin
  );
}

/**
 * Whether the segment from (x1, y1) to (x2, y2) has a point inside the box,
 * edges included (Liang-Barsky clipping). A segment of zero length is a point.
 */
export function segmentHitsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  box: PlacementBox,
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - box.left, box.right - x1, y1 - box.top, box.bottom - y1];
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      if (qi < 0) return false;
      continue;
    }
    const u = qi / pi;
    if (pi < 0) {
      if (u > t1) return false;
      if (u > t0) t0 = u;
    } else {
      if (u < t0) return false;
      if (u < t1) t1 = u;
    }
  }
  return true;
}

/** Whether a segment, widened by its pad and `margin`, touches the box. */
function segmentTouches(s: PlacementSegment, box: PlacementBox, margin: number): boolean {
  const grow = s.pad + margin;
  return segmentHitsBox(s.x1, s.y1, s.x2, s.y2, {
    left: box.left - grow,
    top: box.top - grow,
    right: box.right + grow,
    bottom: box.bottom + grow,
  });
}

/** How far past the mark a leader is checked from, px: it may touch the mark it starts at. */
const LEADER_START_GAP = 1.5;

/** The segment without its first `gap` px (all of it when it is shorter). */
function shortened(s: PlacementSegment, gap: number): PlacementSegment {
  const length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  if (!(length > gap)) return { ...s, x1: s.x2, y1: s.y2 };
  const t = gap / length;
  return { ...s, x1: s.x1 + (s.x2 - s.x1) * t, y1: s.y1 + (s.y2 - s.y1) * t };
}

/**
 * The most tries per side: a label moves at most this many steps from its
 * point (about 1,000 px at the default step), however tall the bounds - a
 * label further away names nothing, and a plot 10^6 px tall costs no more
 * than one of 1,000 px.
 */
const MAX_TRIES = 512;

/** Width of one column of the segment index, px. */
const BUCKET_W = 16;
/** The most columns the index uses, whatever the bounds. */
const MAX_BUCKETS = 512;

/**
 * Segments indexed by the columns of x they cover, so a label checks only the
 * lines near it - a dense line has hundreds of segments.
 */
function indexSegments(segments: readonly PlacementSegment[], bounds: PlacementBox) {
  const width = Math.max(1, bounds.right - bounds.left);
  const bucketW = Math.max(BUCKET_W, width / MAX_BUCKETS);
  const count = Math.max(1, Math.ceil(width / bucketW));
  const buckets: PlacementSegment[][] = Array.from({ length: count }, () => []);
  const column = (x: number) =>
    Math.min(count - 1, Math.max(0, Math.floor((x - bounds.left) / bucketW)));
  for (const s of segments) {
    if (![s.x1, s.y1, s.x2, s.y2, s.pad].every(Number.isFinite)) continue;
    const a = column(Math.min(s.x1, s.x2) - s.pad);
    const b = column(Math.max(s.x1, s.x2) + s.pad);
    for (let c = a; c <= b; c++) buckets[c]!.push(s);
  }
  return {
    near(box: PlacementBox, margin: number): PlacementSegment[] {
      const a = column(box.left - margin);
      const b = column(box.right + margin);
      if (a === b) return buckets[a]!;
      const out: PlacementSegment[] = [];
      for (let c = a; c <= b; c++) out.push(...buckets[c]!);
      return out;
    },
  };
}

/**
 * Place labels in the order given, each clear of the obstacles and of the
 * labels and leaders placed before it, inside `bounds`. Returns one entry per
 * request: where it went, or null when it has no free place on any of its
 * sides (or does not fit the bounds at all).
 */
export function placeLabels(
  requests: readonly PlacementRequest[],
  obstacles: PlacementObstacles,
  bounds: PlacementBox,
  options: PlacementOptions = {},
): Array<PlacedLabel | null> {
  const step = options.step != null && options.step > 0 ? options.step : 2;
  const margin = options.margin != null && options.margin >= 0 ? options.margin : 2;
  const index = indexSegments(obstacles.segments, bounds);
  const boxes = obstacles.boxes.filter((b) =>
    [b.left, b.top, b.right, b.bottom].every(Number.isFinite),
  );
  const placedBoxes: PlacementBox[] = [];
  const leaders: PlacementSegment[] = [];
  const boundsW = bounds.right - bounds.left;
  const tries = Math.min(
    MAX_TRIES,
    Math.max(1, Math.ceil(Math.max(0, bounds.bottom - bounds.top) / step) + 1),
  );

  const free = (box: PlacementBox, leader: PlacementSegment | null): boolean => {
    for (const b of boxes) if (boxesTouch(box, b, margin)) return false;
    for (const b of placedBoxes) if (boxesTouch(box, b, margin)) return false;
    for (const s of leaders) if (segmentTouches(s, box, margin)) return false;
    for (const s of index.near(box, margin)) if (segmentTouches(s, box, margin)) return false;
    if (leader) {
      // A leader may cross a data line, never a label or a marker. Against
      // the marks it is checked from just past its start, so it may touch the
      // mark it starts at; against the labels placed before, all of it.
      const checked = shortened(leader, LEADER_START_GAP);
      for (const b of boxes) if (segmentTouches(checked, b, 0)) return false;
      for (const b of placedBoxes) if (segmentTouches(leader, b, 0)) return false;
    }
    return true;
  };

  return requests.map((r) => {
    const ok = [r.x, r.y, r.width, r.height, r.clearance].every(Number.isFinite);
    if (!ok || r.width > boundsW || r.width <= 0 || r.height <= 0) return null;
    const left = Math.min(Math.max(r.x - r.width / 2, bounds.left), bounds.right - r.width);
    for (const side of r.sides) {
      for (let k = 0; k < tries; k++) {
        const distance = r.clearance + k * step;
        const top = side === "above" ? r.y - distance - r.height : r.y + distance;
        const bottom = top + r.height;
        if (top < bounds.top || bottom > bounds.bottom) {
          // Further away only leaves the bounds more; beside the point is the
          // one try that may start outside them on the near side.
          if (side === "above" ? top < bounds.top : bottom > bounds.bottom) break;
          continue;
        }
        const box = { left, top, right: left + r.width, bottom };
        const lx = Math.min(Math.max(r.x, box.left + 1), box.right - 1);
        const reach = r.reach != null && Number.isFinite(r.reach) ? r.reach : r.clearance;
        const leader: PlacementSegment | null =
          k === 0 && !r.tie
            ? null
            : side === "above"
              ? { x1: r.x, y1: r.y - reach, x2: lx, y2: bottom, pad: 0.5 }
              : { x1: r.x, y1: r.y + reach, x2: lx, y2: top, pad: 0.5 };
        if (!free(box, leader)) continue;
        placedBoxes.push(box);
        if (leader) leaders.push(leader);
        return { box, side, leader };
      }
    }
    return null;
  });
}
