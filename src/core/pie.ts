/**
 * Framework-agnostic pie / donut slice geometry - pure math, fully SSR-safe
 * (no `window`, `Date`, or `Math.random`; deterministic for the same input).
 *
 * AGENT CONTEXT: this is the geometry engine behind `react/PieChart.tsx`. It
 * turns a serializable list of numeric values into angular slices and builds
 * the SVG `path` `d` strings to draw them, so the React layer stays a thin
 * renderer. All angles are in RADIANS, measured CLOCKWISE from 12 o'clock
 * (the IBCS-conventional starting point for a part-to-whole pie):
 *
 *   angle 0      → top      (12 o'clock)
 *   angle π/2    → right    (3 o'clock)
 *   angle π      → bottom   (6 o'clock)
 *   angle 3π/2   → left     (9 o'clock)
 *
 * with screen coordinates `x = cx + r·sin(angle)`, `y = cy − r·cos(angle)`.
 *
 * NOTE: pie charts are DISCOURAGED in IBCS / ISO 24896 - see `PieChart` for the
 * rationale. This module exists to serve that one component faithfully.
 */

/** A point in SVG user space. */
export interface Point {
  x: number;
  y: number;
}

/**
 * One computed slice. Angles are radians, clockwise from 12 o'clock.
 * `value` is the non-negative magnitude used for the geometry; `rawValue`
 * preserves the original input (which may be negative - those are clamped to 0
 * for the pie, since a slice cannot have negative area).
 */
export interface PieSlice {
  /** Position in the original input array. */
  index: number;
  /** Non-negative magnitude that drove the angle (negatives clamped to 0). */
  value: number;
  /** Original input value, unclamped (may be negative). */
  rawValue: number;
  /** `value / total`, in `[0, 1]`. 0 when the total is 0. */
  fraction: number;
  /** Slice start angle (radians, clockwise from top). */
  startAngle: number;
  /** Slice end angle (radians, clockwise from top); always ≥ `startAngle`. */
  endAngle: number;
  /** `(startAngle + endAngle) / 2` - handy for label / leader placement. */
  midAngle: number;
}

/** Result of {@link computePieSlices}. */
export interface PieLayout {
  slices: PieSlice[];
  /** Sum of the clamped (non-negative) values. */
  total: number;
  /** True when any input value was negative (and therefore clamped to 0). */
  hadNegative: boolean;
}

/** Options for {@link computePieSlices}. */
export interface ComputePieOptions {
  /**
   * Angle (radians) where the first slice begins. Default 0 (12 o'clock).
   * Slices proceed clockwise from here.
   */
  startAngle?: number;
}

const TAU = Math.PI * 2;

/**
 * Point on a circle in the module's angle convention (clockwise from top).
 * SSR-safe pure trig - never returns NaN for finite inputs.
 */
export function pointOnCircle(cx: number, cy: number, r: number, angle: number): Point {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

/**
 * Lay out pie slices for a list of values. Negative values are clamped to 0
 * (a slice has no negative area - `hadNegative` flags this so the caller can
 * note it). An all-zero / empty input yields slices with `fraction` 0 and zero
 * angular width, so the renderer can still draw an empty ring.
 */
export function computePieSlices(
  values: readonly number[],
  opts: ComputePieOptions = {},
): PieLayout {
  const start = opts.startAngle ?? 0;
  let hadNegative = false;
  const clamped = values.map((v) => {
    const n = typeof v === "number" && isFinite(v) ? v : 0;
    if (n < 0) {
      hadNegative = true;
      return 0;
    }
    return n;
  });
  const total = clamped.reduce((a, b) => a + b, 0);

  const slices: PieSlice[] = [];
  let cursor = start;
  for (const [i, value] of clamped.entries()) {
    const raw = values[i];
    const fraction = total > 0 ? value / total : 0;
    const startAngle = cursor;
    const endAngle = cursor + fraction * TAU;
    slices.push({
      index: i,
      value,
      rawValue: typeof raw === "number" && isFinite(raw) ? raw : 0,
      fraction,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
    });
    cursor = endAngle;
  }

  return { slices, total, hadNegative };
}

/** Options for {@link arcPath}. */
export interface ArcPathOptions {
  cx: number;
  cy: number;
  /** Outer radius. */
  r: number;
  startAngle: number;
  endAngle: number;
  /**
   * Inner radius for a donut/annular slice. When `> 0` and `< r` the slice is
   * drawn as a ring segment (two arcs); otherwise a solid wedge from the centre.
   */
  innerR?: number;
}

/**
 * Build the SVG `path` `d` for one slice.
 *
 * - Solid wedge: `M cx cy L x1 y1 A r r 0 largeArc 1 x2 y2 Z`.
 * - Donut slice: outer arc out, line in, inner arc back (sweep reversed).
 * - A (near) full 360° span is drawn as a closed disc / annulus using two
 *   half-arcs, since a single arc whose start equals its end renders nothing.
 *
 * Returns `""` for a non-positive radius or a zero-width angular span, so the
 * renderer simply emits nothing rather than a degenerate path. Never NaN.
 */
export function arcPath(opts: ArcPathOptions): string {
  const { cx, cy, r, startAngle, endAngle } = opts;
  const innerR = opts.innerR && opts.innerR > 0 ? Math.min(opts.innerR, r) : 0;
  const span = endAngle - startAngle;
  if (!(r > 0) || !(span > 1e-7)) return "";

  const isFull = span >= TAU - 1e-6;

  // Full circle / annulus: two half arcs (a single arc can't close a circle).
  if (isFull) {
    const oTop = pointOnCircle(cx, cy, r, startAngle);
    const oBot = pointOnCircle(cx, cy, r, startAngle + Math.PI);
    const outer =
      `M ${fmt(oTop.x)} ${fmt(oTop.y)} ` +
      `A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(oBot.x)} ${fmt(oBot.y)} ` +
      `A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(oTop.x)} ${fmt(oTop.y)} Z`;
    if (innerR <= 0) return outer;
    // Inner ring drawn with the opposite winding so the non-zero fill rule
    // punches a hole.
    const iTop = pointOnCircle(cx, cy, innerR, startAngle);
    const iBot = pointOnCircle(cx, cy, innerR, startAngle + Math.PI);
    const inner =
      `M ${fmt(iTop.x)} ${fmt(iTop.y)} ` +
      `A ${fmt(innerR)} ${fmt(innerR)} 0 1 0 ${fmt(iBot.x)} ${fmt(iBot.y)} ` +
      `A ${fmt(innerR)} ${fmt(innerR)} 0 1 0 ${fmt(iTop.x)} ${fmt(iTop.y)} Z`;
    return `${outer} ${inner}`;
  }

  const largeArc = span > Math.PI ? 1 : 0;
  const o1 = pointOnCircle(cx, cy, r, startAngle);
  const o2 = pointOnCircle(cx, cy, r, endAngle);

  if (innerR <= 0) {
    return (
      `M ${fmt(cx)} ${fmt(cy)} ` +
      `L ${fmt(o1.x)} ${fmt(o1.y)} ` +
      `A ${fmt(r)} ${fmt(r)} 0 ${largeArc} 1 ${fmt(o2.x)} ${fmt(o2.y)} Z`
    );
  }

  const i2 = pointOnCircle(cx, cy, innerR, endAngle);
  const i1 = pointOnCircle(cx, cy, innerR, startAngle);
  return (
    `M ${fmt(o1.x)} ${fmt(o1.y)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 ${largeArc} 1 ${fmt(o2.x)} ${fmt(o2.y)} ` +
    `L ${fmt(i2.x)} ${fmt(i2.y)} ` +
    `A ${fmt(innerR)} ${fmt(innerR)} 0 ${largeArc} 0 ${fmt(i1.x)} ${fmt(i1.y)} Z`
  );
}

/** Round to 3 dp to keep path strings short and stable; guards against NaN. */
function fmt(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}
