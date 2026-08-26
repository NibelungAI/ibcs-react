/**
 * Reference lines, target markers, and tolerance bands — a small, framework-
 * agnostic spec plus a pure resolver that maps each reference onto pixel
 * geometry given a chart's axis scales and plot box.
 *
 * This module deliberately knows nothing about React or SVG: a renderer hands
 * in the value→pixel scales it already uses for its data, and gets back plain
 * numbers (line endpoints / band rectangles) it can draw however it likes. That
 * keeps it SSR-safe (no DOM, no measuring) and lets every chart in the library
 * adopt the same reference vocabulary — a budget target line, a min/max
 * tolerance band, a "today" divider — without re-implementing the math.
 *
 * Axis convention (matches the visual result, not the scale used):
 *  - `axis: "y"` → a HORIZONTAL line / band at a value on the value axis
 *    (e.g. a sales target). Spans the full plot width.
 *  - `axis: "x"` → a VERTICAL line / band at a position on the category axis
 *    (e.g. a "forecast starts here" divider, addressed by period index).
 *    Spans the full plot height.
 */

/** A single straight reference line or target marker. */
export interface ReferenceLine {
  /**
   * Explicit discriminator. Optional for backward compatibility — omit it and
   * the kind is inferred from the shape ({@link isReferenceBand}) — but set it
   * whenever an object carries both a `value` and `from`/`to` fields, where
   * structural inference would otherwise have to guess.
   */
  kind?: "line";
  /** "y" → horizontal line at `value`; "x" → vertical line at `value`. */
  axis: "x" | "y";
  /** Position on the reference's axis (a value for "y", a category index/position for "x"). */
  value: number;
  /** Optional caption drawn inside the plot beside the line. */
  label?: string;
  /** Stroke (and label) colour. Defaults to the chart's impact-neutral axis colour. */
  color?: string;
  /** Dash the line so it reads as "not data". Default true. */
  dash?: boolean;
}

/** A shaded tolerance / target band spanning `from`..`to` on one axis. */
export interface ReferenceBand {
  /**
   * Explicit discriminator. Optional for backward compatibility — omit it and
   * the kind is inferred from the shape ({@link isReferenceBand}).
   */
  kind?: "band";
  /** "y" → horizontal band between two values; "x" → vertical band between two positions. */
  axis: "x" | "y";
  /** One edge of the band, in the same units as {@link ReferenceLine.value}. */
  from: number;
  /** The other edge of the band (order does not matter). */
  to: number;
  /** Optional caption drawn inside the band. */
  label?: string;
  /** Fill colour. Defaults to the chart's impact-neutral axis colour (drawn faint). */
  color?: string;
}

/** Either kind of reference annotation. */
export type Reference = ReferenceLine | ReferenceBand;

/**
 * Narrow a {@link Reference} to a {@link ReferenceBand}.
 *
 * The explicit `kind` discriminator WINS when present. Otherwise the shape
 * decides, and only an unambiguous band shape counts: BOTH `from` and `to` are
 * numbers AND there is no `value`. The old test looked at `from`/`to` alone, so
 * a line that also carried a tolerance pair (`{ axis, value: 5, from: 1, to: 2 }`)
 * was silently drawn as a band.
 */
export function isReferenceBand(r: Reference): r is ReferenceBand {
  if (r.kind === "band") return true;
  if (r.kind === "line") return false;
  const s = r as Partial<ReferenceBand> & Partial<ReferenceLine>;
  return typeof s.from === "number" && typeof s.to === "number" && s.value == null;
}

/**
 * Narrow a {@link Reference} to a {@link ReferenceLine} — the exact complement
 * of {@link isReferenceBand}, so every reference is one or the other.
 */
export function isReferenceLine(r: Reference): r is ReferenceLine {
  return !isReferenceBand(r);
}

/** The pixel rectangle a chart draws its data into (SVG coords, y grows downward). */
export interface PlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The value→pixel scales a renderer already uses for its data. */
export interface AxisScales {
  /** Map an x-axis value (e.g. a period index) to a pixel x. */
  x: (value: number) => number;
  /** Map a y-axis value to a pixel y. */
  y: (value: number) => number;
}

/** A reference line resolved to drawable endpoints, clamped inside the plot box. */
export interface ResolvedReferenceLine {
  kind: "line";
  axis: "x" | "y";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  color?: string;
  dash: boolean;
}

/** A reference band resolved to a drawable rectangle, clamped inside the plot box. */
export interface ResolvedReferenceBand {
  kind: "band";
  axis: "x" | "y";
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
}

export type ResolvedReference = ResolvedReferenceLine | ResolvedReferenceBand;

/** Clamp `v` into `[lo, hi]`; tolerant of an inverted/degenerate range. */
function clamp(v: number, lo: number, hi: number): number {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return Math.min(b, Math.max(a, v));
}

/**
 * Resolve one {@link Reference} into pixel geometry, clamped to `box`. Returns
 * `null` when the input is degenerate (non-finite value, or a scale that maps
 * it off to infinity) so callers can simply skip it. Pure & SSR-safe.
 *
 * NOTE — clamping: a reference whose value falls OUTSIDE the current value
 * domain is not dropped; it is clamped to the nearest plot edge (a band is
 * clipped to the visible slice, and can therefore collapse to zero width/height
 * when it lies entirely off-scale). Renderers rely on this to keep an
 * off-scale target visible as an edge marker — label the edge case in the UI if
 * that matters.
 */
export function resolveReference(
  ref: Reference,
  box: PlotBox,
  scales: AxisScales,
): ResolvedReference | null {
  const { left, right, top, bottom } = box;

  if (isReferenceBand(ref)) {
    if (!isFinite(ref.from) || !isFinite(ref.to)) return null;
    if (ref.axis === "y") {
      const a = scales.y(ref.from);
      const b = scales.y(ref.to);
      if (!isFinite(a) || !isFinite(b)) return null;
      const ca = clamp(a, top, bottom);
      const cb = clamp(b, top, bottom);
      return {
        kind: "band",
        axis: "y",
        x: left,
        y: Math.min(ca, cb),
        width: Math.max(0, right - left),
        height: Math.abs(ca - cb),
        label: ref.label,
        color: ref.color,
      };
    }
    const a = scales.x(ref.from);
    const b = scales.x(ref.to);
    if (!isFinite(a) || !isFinite(b)) return null;
    const ca = clamp(a, left, right);
    const cb = clamp(b, left, right);
    return {
      kind: "band",
      axis: "x",
      x: Math.min(ca, cb),
      y: top,
      width: Math.abs(ca - cb),
      height: Math.max(0, bottom - top),
      label: ref.label,
      color: ref.color,
    };
  }

  if (!isFinite(ref.value)) return null;
  const dash = ref.dash ?? true;
  if (ref.axis === "y") {
    const p = scales.y(ref.value);
    if (!isFinite(p)) return null;
    const cp = clamp(p, top, bottom);
    return {
      kind: "line",
      axis: "y",
      x1: left,
      y1: cp,
      x2: right,
      y2: cp,
      label: ref.label,
      color: ref.color,
      dash,
    };
  }
  const p = scales.x(ref.value);
  if (!isFinite(p)) return null;
  const cp = clamp(p, left, right);
  return {
    kind: "line",
    axis: "x",
    x1: cp,
    y1: top,
    x2: cp,
    y2: bottom,
    label: ref.label,
    color: ref.color,
    dash,
  };
}

/**
 * Resolve a list of references, dropping any that are degenerate. Order is
 * preserved so callers can rely on later references drawing over earlier ones.
 */
export function resolveReferences(
  refs: readonly Reference[] | undefined,
  box: PlotBox,
  scales: AxisScales,
): ResolvedReference[] {
  if (!refs || !refs.length) return [];
  const out: ResolvedReference[] = [];
  for (const r of refs) {
    const res = resolveReference(r, box, scales);
    if (res) out.push(res);
  }
  return out;
}
