/**
 * Shared tooltip placement: at the pointer plus a 16px offset, flipped to the
 * other side of the pointer when the panel would overflow the viewport, and
 * never pushed off the top/left edge.
 *
 * Used from two places that MUST agree: `ChartTooltip`'s mount-time layout
 * effect (first paint) and `useChartHover`'s rAF pointer tracking (every
 * subsequent move, applied imperatively so moves never re-render React).
 *
 * Internal module: not part of the public API surface.
 */

/** Gap between the pointer and the panel, in px. */
export const TOOLTIP_OFFSET = 16;

/**
 * Position `el` (a `position: fixed` panel) for a pointer at viewport
 * coordinates `x`/`y`, flipping left/up at the right/bottom viewport edges.
 * Reads the element's own size, so call it after the panel has content.
 */
export function applyTooltipPosition(el: HTMLElement, x: number, y: number): void {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const vw = typeof window !== "undefined" ? window.innerWidth : Infinity;
  const vh = typeof window !== "undefined" ? window.innerHeight : Infinity;
  let left = x + TOOLTIP_OFFSET;
  let top = y + TOOLTIP_OFFSET;
  if (left + w > vw) left = x - TOOLTIP_OFFSET - w;
  if (top + h > vh) top = y - TOOLTIP_OFFSET - h;
  left = Math.max(4, left);
  top = Math.max(4, top);
  el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
}
