/**
 * Shared SSR-safe text metrics for the chart components.
 *
 * Charts never measure the DOM (that would break server rendering), so label
 * fitting uses a monospace-ish width heuristic. One canonical copy lives here;
 * a component may keep a local variant only when it genuinely differs (e.g.
 * RatioTreeChart's CJK-aware width estimate).
 *
 * Internal module: not part of the public API surface.
 */

/** Clip a label to an approximate pixel budget, adding an ellipsis. SSR-safe (no measuring). */
export function fitLabel(s: string, maxPx: number, fontPx: number): string {
  if (maxPx <= 0 || !s) return "";
  const chars = [...s];
  const maxChars = Math.floor(maxPx / (fontPx * 0.6));
  if (maxChars < 1) return "";
  if (chars.length <= maxChars) return s;
  if (maxChars === 1) return "…";
  return (
    chars
      .slice(0, maxChars - 1)
      .join("")
      .trimEnd() + "…"
  );
}

/** Approximate rendered width of a string at a given font size. SSR-safe heuristic. */
export function estTextW(s: string, fontPx: number): number {
  return [...s].length * fontPx * 0.6;
}

/** Clamp v into [lo, hi]; if the range is degenerate, fall back to its midpoint. */
export function clampTo(v: number, lo: number, hi: number): number {
  if (!(hi > lo)) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Make a React `useId()` value safe for SVG fragment references. React 18 ids
 * contain `:` which browsers tolerate in `url(#…)` but which break
 * `querySelector("#…")` and some SVG consumers after export/serialization.
 */
export function svgSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}
