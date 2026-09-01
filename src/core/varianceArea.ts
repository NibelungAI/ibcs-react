import { computeVariance } from "./variance";

/**
 * Pure, SSR-safe geometry for the IBCS "actual vs average" variance AREA chart
 * (the Zebra-style small-multiple): a time series where ACTUAL sits over a grey
 * REFERENCE area (Ø average / PY / PL), the GAP between them is split into
 * favorable (green) / unfavorable (red) polygons by impact, and an optional
 * FORECAST tail is flagged for hatched rendering.
 *
 * Framework agnostic: {@link VarianceAreaChart} is a thin React renderer over
 * this. All math is linear interpolation - no DOM, no `window`, no `Date`,
 * no `Math.random` - so it is safe to run on the server and inside `useMemo`.
 */

/** One period: an actual, its reference level, and an optional forecast value. */
export interface VarianceAreaDatum {
  /** Period label along the horizontal axis ("Jan", "Q1", "2024", …). */
  category: string;
  /** Actual value - the dark line/area drawn on top. */
  AC: number;
  /** Reference level (Ø average / PY / PL) - the grey baseline area. */
  reference: number;
  /** Forecast value; used for the line in the forecast tail when present. */
  FC?: number;
}

export interface VarianceAreaOptions {
  /**
   * First index of the forecast tail (drawn hatched). Points at this index and
   * beyond are forecast; the line uses `FC` there when present. Omit (or pass a
   * value out of range) for an all-actual series.
   */
  forecastFrom?: number;
  /** Whether a higher value is good - set false for cost series. Default true. */
  higherIsBetter?: boolean;
}

/** The plot rectangle (px) plus the entrance-animation factor. */
export interface VarianceAreaPlot {
  /** Left edge of the plotting area, px. */
  x0: number;
  /** Right edge of the plotting area, px. */
  x1: number;
  /** Top edge of the plotting area, px. */
  y0: number;
  /** Bottom edge of the plotting area, px. */
  y1: number;
  /** 0→1 grow factor: at 0 everything collapses onto the zero line. Default 1. */
  grow?: number;
}

/** A pixel-space point. */
export interface XY {
  x: number;
  y: number;
}

/** One resolved period with its pixel coordinates (grow already applied). */
export interface VarianceAreaPoint {
  index: number;
  category: string;
  /** The actual/forecast value used for the line. */
  value: number;
  reference: number;
  /** `value − reference` (raw, not impact-signed). */
  gap: number;
  /** Favorable per `higherIsBetter` (impact, not sign). */
  favorable: boolean;
  /** Part of the forecast tail (index ≥ forecastFrom). */
  forecast: boolean;
  /** Pixel x of the period. */
  x: number;
  /** Pixel y of the value (AC/FC) line. */
  y: number;
  /** Pixel y of the reference line. */
  refY: number;
}

/** A closed gap polygon between the value and reference lines, colored by impact. */
export interface VarianceAreaSegment {
  /** Closed polygon in pixel space (3 verts at a crossing, else 4). */
  points: XY[];
  /** Favorable (green) when true, unfavorable (red) when false. */
  favorable: boolean;
  /** Lies in the forecast tail - render hatched. */
  forecast: boolean;
}

/** The overall AC-vs-reference variance for the right-side total mark. */
export interface VarianceAreaTotal {
  /** Σ value − Σ reference. */
  abs: number;
  /** abs / |Σ reference|, or null when the reference sum is 0. */
  pct: number | null;
  /** Favorable per `higherIsBetter`. */
  favorable: boolean;
}

export interface VarianceAreaLayout {
  /** Per-period pixel coordinates, in period order. */
  points: VarianceAreaPoint[];
  /** Green/red gap polygons, split at every AC↔reference crossing. */
  segments: VarianceAreaSegment[];
  /** Grey reference area (zero→reference) over the actual span. */
  referenceActual: XY[];
  /** Grey reference area over the forecast span (rendered hatched). */
  referenceForecast: XY[];
  /** Most negative value across AC/FC/reference (≤ 0). */
  domainMin: number;
  /** Most positive value across AC/FC/reference (≥ 0). */
  domainMax: number;
  /** Pixel y of the zero value line. */
  zeroY: number;
  /** Normalized first forecast index, or null when there is no tail. */
  forecastFrom: number | null;
  /** Pixel x where the forecast tail begins, or null. */
  forecastX: number | null;
  /** Overall variance for the right-side total mark. */
  total: VarianceAreaTotal;
}

/** Finite number or null. */
function num(v: number | undefined): number | null {
  return v != null && isFinite(v) ? v : null;
}

/**
 * Resolve `data` into pixel geometry for the variance area chart.
 *
 * The y-domain always brackets 0 so the zero baseline sits inside the plot.
 * Between each pair of periods, where the AC and reference lines cross, a
 * crossing x is found by linear interpolation (`t = gapA / (gapA − gapB)`) and
 * the band is split so green (favorable) stays above / red (unfavorable) below
 * cleanly - no polygon straddles a crossing. Robust to empty data, a single
 * point, negatives, zeros and non-finite inputs (treated as 0).
 */
export function computeVarianceArea(
  data: VarianceAreaDatum[],
  plot: VarianceAreaPlot,
  opts: VarianceAreaOptions = {},
): VarianceAreaLayout {
  const higherIsBetter = opts.higherIsBetter ?? true;
  const grow = plot.grow ?? 1;
  const n = data.length;

  const forecastFrom =
    opts.forecastFrom != null && opts.forecastFrom >= 0 && opts.forecastFrom < n
      ? Math.floor(opts.forecastFrom)
      : null;

  // Resolve the line value for a period: FC in the forecast tail when present,
  // otherwise AC (falling back across missing values without ever yielding NaN).
  const valueAt = (d: VarianceAreaDatum, i: number): number => {
    const ac = num(d.AC);
    const fc = num(d.FC);
    const isFc = forecastFrom != null && i >= forecastFrom;
    return isFc && fc != null ? fc : (ac ?? fc ?? 0);
  };

  // Value domain across every series, always including 0.
  let domainMin = 0;
  let domainMax = 0;
  let sumValue = 0;
  let sumRef = 0;
  for (const [i, d] of data.entries()) {
    const value = valueAt(d, i);
    const ref = num(d.reference) ?? 0;
    domainMin = Math.min(domainMin, value, ref);
    domainMax = Math.max(domainMax, value, ref);
    sumValue += value;
    sumRef += ref;
  }
  const range = domainMax - domainMin || 1;

  const innerW = plot.x1 - plot.x0;
  const band = n > 0 ? innerW / n : innerW;
  const xOf = (i: number) => plot.x0 + band * i + band / 2;
  const yRest = (v: number) => plot.y1 - ((v - domainMin) / range) * (plot.y1 - plot.y0);
  const zeroY = yRest(0);
  // Grow from the zero line so the whole figure rises on mount.
  const yOf = (v: number) => zeroY + (yRest(v) - zeroY) * grow;

  const points: VarianceAreaPoint[] = [];
  for (const [i, d] of data.entries()) {
    const value = valueAt(d, i);
    const reference = num(d.reference) ?? 0;
    const v = computeVariance(value, reference, higherIsBetter);
    points.push({
      index: i,
      category: d.category,
      value,
      reference,
      gap: value - reference,
      favorable: v ? v.favorable : true,
      forecast: forecastFrom != null && i >= forecastFrom,
      x: xOf(i),
      y: yOf(value),
      refY: yOf(reference),
    });
  }

  // Favorability of a band run from the raw gap sign and `higherIsBetter`.
  const sideFavorable = (sign: number) => (sign > 0 ? higherIsBetter : !higherIsBetter);

  const segments: VarianceAreaSegment[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue; // unreachable: i + 1 < n === points.length
    const ga = a.gap;
    const gb = b.gap;
    const forecast = forecastFrom != null && i >= forecastFrom;
    const push = (pts: XY[], sign: number) => {
      if (sign === 0) return; // zero gap → no area to fill
      segments.push({ points: pts, favorable: sideFavorable(sign), forecast });
    };

    if (ga === 0 && gb === 0) continue; // flat coincident lines, nothing to fill

    if (ga * gb < 0) {
      // The lines cross between i and i+1 - split into two triangles at the
      // crossing (where the value and reference pixels coincide).
      const t = ga / (ga - gb);
      const cx = a.x + t * (b.x - a.x);
      const cy = a.y + t * (b.y - a.y);
      push(
        [
          { x: a.x, y: a.y },
          { x: cx, y: cy },
          { x: a.x, y: a.refY },
        ],
        Math.sign(ga),
      );
      push(
        [
          { x: cx, y: cy },
          { x: b.x, y: b.y },
          { x: b.x, y: b.refY },
        ],
        Math.sign(gb),
      );
    } else {
      // Same side for the whole interval - one quad along value then reference.
      const sign = ga !== 0 ? Math.sign(ga) : Math.sign(gb);
      push(
        [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
          { x: b.x, y: b.refY },
          { x: a.x, y: a.refY },
        ],
        sign,
      );
    }
  }

  // Grey reference area (zero → reference), split at the forecast boundary point
  // so the tail can be drawn hatched while the actual span stays solid.
  const refPoly = (from: number, to: number): XY[] => {
    const first = points[from];
    const last = points[to];
    if (to - from < 1 || !first || !last) return [];
    const out: XY[] = [{ x: first.x, y: zeroY }];
    for (const p of points.slice(from, to + 1)) out.push({ x: p.x, y: p.refY });
    out.push({ x: last.x, y: zeroY });
    return out;
  };
  let referenceActual: XY[] = [];
  let referenceForecast: XY[] = [];
  if (n >= 2) {
    if (forecastFrom == null) {
      referenceActual = refPoly(0, n - 1);
    } else {
      referenceActual = refPoly(0, forecastFrom);
      referenceForecast = refPoly(forecastFrom, n - 1);
    }
  }

  const tv = computeVariance(sumValue, sumRef, higherIsBetter);
  const total: VarianceAreaTotal = {
    abs: sumValue - sumRef,
    pct: tv ? tv.pct : null,
    favorable: tv ? tv.favorable : true,
  };

  return {
    points,
    segments,
    referenceActual,
    referenceForecast,
    domainMin,
    domainMax,
    zeroY,
    forecastFrom,
    forecastX: forecastFrom != null && n > 0 ? xOf(forecastFrom) : null,
    total,
  };
}
