/**
 * Pure XY-plane geometry for value/value charts — IBCS "Scattergrams" (C09)
 * and bubble charts (C10). Framework-agnostic: this module knows nothing about
 * React or the DOM. It turns data + a plot rectangle into pixel-space scales,
 * "nice" axis ticks, and the constant-profit hyperbolas (iso-lines) that the
 * C09 template overlays as thin gridlines.
 *
 * ISO 24896: both X and Y are value axes, zero-based where sensible so the
 * origin sits inside the plot and magnitudes read honestly.
 */

/** One point in an XY scatter: two values, an optional semantic group + label. */
export interface ScatterDatum {
  x: number;
  y: number;
  /** Category/series this point belongs to — drives its (semantic) color. */
  group?: string;
  /** Short annotation drawn next to the point when few are shown. */
  label?: string;
}

/** A scatter point that also carries a magnitude, drawn as the bubble's area. */
export interface BubbleDatum extends ScatterDatum {
  /** Non-negative magnitude; bubble area is proportional to it. */
  size: number;
}

/** Inner margins of the plot rectangle, in px. */
export interface XyPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ComputeXyScaleOptions {
  /** Total SVG width in px. */
  width: number;
  /** Total SVG height in px. */
  height: number;
  /** Inner margins (gutters for axes/labels). A number applies to all sides. */
  padding?: number | Partial<XyPadding>;
  /** Force the X domain to include 0. Default true. */
  zeroBasedX?: boolean;
  /** Force the Y domain to include 0. Default true. */
  zeroBasedY?: boolean;
  /** Fractional headroom added past the non-zero data extremes. Default 0.05. */
  headroom?: number;
  /** Explicit domain overrides (any subset). */
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

/** A value-domain extent on one axis. */
export interface XyDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * The result of {@link computeXyScale}: the resolved value domain, the plot
 * rectangle in px, and two pure mapping functions. `xOf`/`yOf` take a value and
 * return a pixel coordinate — they capture no DOM, only numbers, so they are
 * safe to call during render and in tests.
 */
export interface XyScale extends XyDomain {
  /** Map a data X value to a pixel X (left → right). */
  xOf(x: number): number;
  /** Map a data Y value to a pixel Y (bottom → top, i.e. inverted). */
  yOf(y: number): number;
  /** Plot rectangle edges in px. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Pixel position of the X=0 / Y=0 lines (may sit outside the plot). */
  zeroX: number;
  zeroY: number;
}

function normalizePadding(p: number | Partial<XyPadding> | undefined): XyPadding {
  if (p == null) return { top: 16, right: 16, bottom: 32, left: 40 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 16, right: p.right ?? 16, bottom: p.bottom ?? 32, left: p.left ?? 40 };
}

/** Expand a degenerate [min,max] (equal ends) into a usable unit interval. */
function deDegenerate(min: number, max: number): [number, number] {
  if (min < max) return [min, max];
  if (min === 0) return [0, 1];
  const pad = Math.abs(min) * 0.5 || 0.5;
  return [min - pad, max + pad];
}

/**
 * Build pixel-space scales for a set of XY points. The domain spans the data
 * extremes (optionally forced through 0), with a little headroom on the
 * non-zero ends, and maps onto the plot rectangle implied by `padding`.
 */
export function computeXyScale(
  points: ReadonlyArray<ScatterDatum>,
  opts: ComputeXyScaleOptions,
): XyScale {
  const { width, height } = opts;
  const zeroBasedX = opts.zeroBasedX ?? true;
  const zeroBasedY = opts.zeroBasedY ?? true;
  const headroom = opts.headroom ?? 0.05;
  const pad = normalizePadding(opts.padding);

  const left = pad.left;
  const right = width - pad.right;
  const top = pad.top;
  const bottom = height - pad.bottom;

  let dataXMin = Infinity;
  let dataXMax = -Infinity;
  let dataYMin = Infinity;
  let dataYMax = -Infinity;
  for (const p of points) {
    if (Number.isFinite(p.x)) {
      if (p.x < dataXMin) dataXMin = p.x;
      if (p.x > dataXMax) dataXMax = p.x;
    }
    if (Number.isFinite(p.y)) {
      if (p.y < dataYMin) dataYMin = p.y;
      if (p.y > dataYMax) dataYMax = p.y;
    }
  }
  if (!Number.isFinite(dataXMin)) {
    dataXMin = 0;
    dataXMax = 1;
  }
  if (!Number.isFinite(dataYMin)) {
    dataYMin = 0;
    dataYMax = 1;
  }

  if (zeroBasedX) {
    dataXMin = Math.min(dataXMin, 0);
    dataXMax = Math.max(dataXMax, 0);
  }
  if (zeroBasedY) {
    dataYMin = Math.min(dataYMin, 0);
    dataYMax = Math.max(dataYMax, 0);
  }

  let [xMin, xMax] = deDegenerate(dataXMin, dataXMax);
  let [yMin, yMax] = deDegenerate(dataYMin, dataYMax);

  // Headroom on the ends that are not pinned to zero.
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  if (!(zeroBasedX && dataXMax === 0)) xMax += xSpan * headroom;
  if (!(zeroBasedX && dataXMin === 0)) xMin -= xSpan * headroom;
  if (!(zeroBasedY && dataYMax === 0)) yMax += ySpan * headroom;
  if (!(zeroBasedY && dataYMin === 0)) yMin -= ySpan * headroom;

  // Explicit overrides win.
  if (opts.xMin != null) xMin = opts.xMin;
  if (opts.xMax != null) xMax = opts.xMax;
  if (opts.yMin != null) yMin = opts.yMin;
  if (opts.yMax != null) yMax = opts.yMax;

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const plotW = right - left;
  const plotH = bottom - top;

  const xOf = (x: number) => left + ((x - xMin) / xRange) * plotW;
  const yOf = (y: number) => bottom - ((y - yMin) / yRange) * plotH;

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    xOf,
    yOf,
    left,
    right,
    top,
    bottom,
    zeroX: xOf(0),
    zeroY: yOf(0),
  };
}

/**
 * How many decimal places a step needs to print exactly — used to snap the
 * emitted ticks so `0.1 * 3` reads "0.3", not "0.30000000000000004".
 * Handles exponential notation (`1e-7`) as well as plain decimals.
 */
function stepDecimals(step: number): number {
  const s = String(Math.abs(step));
  const e = s.indexOf("e");
  if (e < 0) return (s.split(".")[1] ?? "").length;
  const exp = Number(s.slice(e + 1));
  const mantissaDecimals = (s.slice(0, e).split(".")[1] ?? "").length;
  return Math.max(0, Math.min(100, mantissaDecimals - exp));
}

/**
 * "Nice" axis tick values across [min, max] — rounded to 1/2/5×10ⁿ steps so the
 * labels read cleanly. Returns ascending values, including the endpoints when
 * they land on the step. Pure; safe for both X and Y axes.
 *
 * The step is picked the way D3 does it — by ERROR, i.e. the 1/2/5/10 multiple
 * whose tick count lands CLOSEST to `count` (√2 / √10 / √50 thresholds) — not
 * by rounding the raw step down. Rounding down always overshoots: a raw step in
 * `[1, √2)×10ⁿ` was demoted to `1×10ⁿ`, which nearly DOUBLED the tick count
 * (`computeTicks(0, 80, 5)` used to return 9 ticks; it now returns 5).
 *
 * Degenerate input:
 *  - a non-finite `min`/`max` yields `[]` — an unlabelled axis beats a "NaN"
 *    label, and callers already render an empty tick list fine;
 *  - a finite but EMPTY span (`min === max`, or `count < 1`) yields `[min]`, so
 *    a flat series still shows its single level.
 */
export function computeTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (!(max > min) || !(count >= 1)) return [min];

  const rawStep = (max - min) / count;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const err = rawStep / pow10;
  const step =
    (err >= Math.sqrt(50) ? 10 : err >= Math.sqrt(10) ? 5 : err >= Math.sqrt(2) ? 2 : 1) * pow10;
  if (!Number.isFinite(step) || step <= 0) return [min];

  // Walk INTEGER step indices and multiply — an additive `v += step` loop
  // accumulates fp drift across the axis.
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];

  const decimals = stepDecimals(step);
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) {
    // toFixed at the step's own precision snaps away the multiplication residue
    // (and makes the zero tick exactly 0).
    ticks.push(Number((i * step).toFixed(decimals)));
  }
  return ticks;
}

/**
 * Constant-product hyperbolas x·y = k — the C09 "equal gross profit" iso-lines.
 * For each level `k`, samples a polyline of `{x,y}` points that stay inside the
 * domain rectangle (positive quadrant). Levels whose curve never enters the
 * domain yield an empty polyline. Pure geometry; the renderer turns each
 * polyline into a thin gridline-colored path.
 */
export function computeIsoLines(
  levels: ReadonlyArray<number>,
  domain: XyDomain,
  samples = 48,
): Array<{ level: number; points: Array<{ x: number; y: number }> }> {
  const { xMin, xMax, yMin, yMax } = domain;
  const n = Math.max(2, samples);

  return levels.map((level) => {
    const points: Array<{ x: number; y: number }> = [];
    if (level <= 0) return { level, points };

    // The curve y = k/x is only meaningful for x > 0; clamp the swept x-range to
    // the slice of the domain where y also falls within [yMin, yMax].
    const xLo = Math.max(xMin, yMax > 0 ? level / yMax : xMin, 1e-9);
    const xHi = Math.min(xMax, yMin > 0 ? level / yMin : xMax);
    if (!(xHi > xLo)) return { level, points };

    const step = (xHi - xLo) / (n - 1);
    for (let i = 0; i < n; i++) {
      const x = xLo + step * i;
      const y = level / x;
      if (y >= yMin && y <= yMax) points.push({ x, y });
    }
    return { level, points };
  });
}

/**
 * Solve `product(x, y) === value` for `y` within `[yLo, yHi]` by bisection,
 * assuming `product` is monotonic in `y` over the bracket (true for the default
 * `x·y` whenever `x ≠ 0`). Returns the root, or `null` when the bracket does not
 * change sign (the curve does not pass through this x-column) or the endpoints
 * are non-finite — so callers never receive NaN/±Infinity. Pure.
 */
function solveIsoY(
  x: number,
  value: number,
  yLo: number,
  yHi: number,
  product: (x: number, y: number) => number,
): number | null {
  let flo = product(x, yLo) - value;
  const fhi = product(x, yHi) - value;
  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return null;
  if (flo === 0) return yLo;
  if (fhi === 0) return yHi;
  // No sign change ⇒ the level is not crossed anywhere in this column.
  if (flo > 0 === fhi > 0) return null;

  let lo = yLo;
  let hi = yHi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fm = product(x, mid) - value;
    if (fm === 0) return mid;
    if (fm > 0 === flo > 0) {
      lo = mid;
      flo = fm;
    } else {
      hi = mid;
    }
  }
  const root = (lo + hi) / 2;
  return Number.isFinite(root) ? root : null;
}

/** Options for {@link isoLinePoints}. */
export interface IsoLinePointsOptions {
  /** Number of x-columns swept across the domain. Default 64 (min 2). */
  samples?: number;
  /**
   * The quantity held constant along the curve. Default `(x, y) => x * y`
   * (constant gross profit). Supply e.g. `(x, y) => x * (y / 100)` when one axis
   * is a percentage. May be any function monotonic in `y` over the y-domain.
   */
  product?: (x: number, y: number) => number;
}

/**
 * Sample one iso-line: the set of `{x, y}` where `product(x, y) === value`,
 * across the visible `xDomain`, keeping `y` inside `yDomain`. For the default
 * `x·y` product this traces the hyperbola `y = value / x`; a custom `product`
 * lets it trace e.g. constant-margin curves. `y` is found per column by
 * {@link solveIsoY} bisection, so columns where the curve leaves the plot (or
 * where `x = 0`, the asymptote) are simply skipped — never emitted as NaN/±Inf.
 *
 * Degrades to an empty array when the domain is degenerate, when `value` is
 * non-finite, or when an axis strictly straddles 0 (asymptote inside the plot,
 * which would split the curve). A zero-based axis with 0 at the very edge — the
 * normal C09 case — renders fine. Pure and SSR-safe.
 */
export function isoLinePoints(
  value: number,
  xDomain: readonly [number, number],
  yDomain: readonly [number, number],
  opts: IsoLinePointsOptions = {},
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const product = opts.product ?? ((x: number, y: number) => x * y);
  const samples = Math.max(2, Math.floor(opts.samples ?? 64));

  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;
  if (!Number.isFinite(value)) return points;
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !(xMax > xMin)) return points;
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || !(yMax > yMin)) return points;
  // An asymptote strictly inside the plot would tear the curve in two — bail.
  if (xMin < 0 && xMax > 0) return points;
  if (yMin < 0 && yMax > 0) return points;

  const step = (xMax - xMin) / (samples - 1);
  for (let i = 0; i < samples; i++) {
    const x = xMin + step * i;
    const y = solveIsoY(x, value, yMin, yMax, product);
    if (y != null && Number.isFinite(y)) points.push({ x, y });
  }
  return points;
}

/**
 * Pick ~`count` "nice" round iso-values (1/2/5 × 10ⁿ) spanning the open product
 * range `(min, max)` — used to auto-place iso-lines when the caller gives a
 * `product` range but no explicit levels. Only positive levels are returned
 * (a constant-product hyperbola needs a positive level). Returns ascending
 * values, or `[]` when the range is non-finite, non-positive, or degenerate.
 * Pure.
 */
export function niceIsoValues(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  let lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(min, max);
  if (!(hi > 0) || !(hi > lo)) return [];

  const n = Math.max(1, Math.floor(count));
  const rawStep = (hi - lo) / (n + 1);
  if (!(rawStep > 0)) return [];

  // Walk up the 1/2/5×10ⁿ ladder from the raw step until the level count lands
  // at or below the target, so a very wide range stays ~4–6 lines, not dozens.
  const ladder = [1, 2, 5];
  let mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  let li = ladder.findIndex((m) => m * mag >= rawStep);
  if (li < 0) {
    li = 0;
    mag *= 10;
  }
  const countAt = (step: number) =>
    step > 0
      ? Math.floor(hi / step + 1e-9) - Math.ceil(Math.max(lo, step) / step - 1e-9) + 1
      : Infinity;

  // `li` is always wrapped back into range below, so the rung is never missing.
  let step = (ladder[li] ?? 1) * mag;
  for (let guard = 0; guard < 40 && countAt(step) > n; guard++) {
    li += 1;
    if (li >= ladder.length) {
      li = 0;
      mag *= 10;
    }
    step = (ladder[li] ?? 1) * mag;
  }

  const start = Math.max(step, Math.ceil(lo / step) * step);
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-9 && out.length < 64; v += step) {
    if (v > 0) out.push(v);
  }
  return out;
}

/**
 * Evenly down-sample a large point set to at most `max` items, preserving order.
 * Returns the original array (not a copy) when it already fits, so callers can
 * cheaply detect "no sampling happened" by reference. Used by the scatter
 * renderer to keep thousands of points performant.
 */
export function samplePoints<T>(points: ReadonlyArray<T>, max: number): ReadonlyArray<T> {
  if (max <= 0 || points.length <= max) return points;
  const stride = points.length / max;
  const out: T[] = [];
  // i < max and stride = length / max, so floor(i·stride) is always in range;
  // `!` (rather than a skip) keeps a legitimately-undefined element in place.
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * stride)]!);
  return out;
}

/**
 * Radius (px) for a bubble whose AREA is proportional to `size` — area ∝ size
 * means radius ∝ √size. Normalizes against `maxSize` so the largest bubble hits
 * `maxRadius`. A small floor keeps tiny bubbles visible. Pure.
 */
export function bubbleRadius(
  size: number,
  maxSize: number,
  maxRadius: number,
  minRadius = 2,
): number {
  if (!(maxSize > 0) || !(maxRadius > 0)) return minRadius;
  const frac = Math.sqrt(Math.max(0, size) / maxSize);
  return minRadius + frac * (maxRadius - minRadius);
}

/**
 * A small, theme-independent fallback palette for grouping points/bubbles by
 * category when the caller supplies neither `colorBy` nor matching tokens. The
 * renderer prefers semantic token colors; this just guarantees distinguishable
 * hues for many groups.
 */
export const SCATTER_PALETTE: readonly string[] = [
  "#3b82a6",
  "#5e8c22",
  "#cf3a3a",
  "#9a6bb0",
  "#d98a2b",
  "#2f9e8f",
  "#54534e",
  "#c2557a",
];

/**
 * Map an ordered list of group names to colors. `colorBy` (if given) wins per
 * group; otherwise groups are assigned palette colors in first-seen order.
 * Returns a JSON-serializable record.
 *
 * The record is created with a NULL prototype and duplicates are tracked in a
 * `Set`: a group literally named `"constructor"` / `"__proto__"` used to hit
 * `Object.prototype` through the old `g in out` test (and silently lose its
 * color), which real category data can trigger.
 */
export function assignGroupColors(
  groups: ReadonlyArray<string>,
  palette: readonly string[] = SCATTER_PALETTE,
  colorBy?: (group: string) => string | undefined,
): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  const seen = new Set<string>();
  let i = 0;
  for (const g of groups) {
    if (seen.has(g)) continue;
    seen.add(g);
    const custom = colorBy?.(g);
    // An EMPTY palette used to hand back `undefined` here (`i % 0` is NaN),
    // which reached the DOM as fill="undefined"; inherit the color instead.
    out[g] = custom ?? palette[i % palette.length] ?? "currentColor";
    i++;
  }
  return out;
}

/** Distinct group names in first-seen order (used to build the color map). */
export function distinctGroups(points: ReadonlyArray<ScatterDatum>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of points) {
    const g = p.group ?? "";
    if (!seen.has(g)) {
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}

/**
 * Build a single SVG path `d` string drawing a filled circle at each point —
 * the fast path for large scatter sets (one `<path>` per color instead of one
 * `<circle>` per point). Each circle is two half-arcs. Coordinates are rounded
 * to keep the string compact.
 */
export function circlesPath(points: ReadonlyArray<{ cx: number; cy: number }>, r: number): string {
  const rr = Math.round(r * 10) / 10;
  const d2 = rr * 2;
  let d = "";
  for (const { cx, cy } of points) {
    const x = Math.round(cx * 10) / 10;
    const y = Math.round(cy * 10) / 10;
    d += `M${x - rr},${y}a${rr},${rr} 0 1,0 ${d2},0a${rr},${rr} 0 1,0 ${-d2},0`;
  }
  return d;
}
