/**
 * One implementation of per-mark pointer/keyboard/touch wiring for every
 * chart.
 *
 * Before this module each chart hand-copied the same `onMouseMove` /
 * `onMouseLeave` closure pair (18 copies, three of which had drifted), no
 * chart showed its tooltip on keyboard focus, and any pointer inside a mark's
 * full-height transparent hit band — including the blank space above a short
 * column — triggered the tooltip. `markInteraction` builds the handlers once
 * per render from the chart's `useChartHover` state and its `tooltip` /
 * `onHover` props:
 *
 *   - pointer moves feed the built-in tooltip (when `tooltip`) and `onHover`
 *   - when a mark passes its geometry (`forMark(info, rects)`), the pointer
 *     must be within {@link MARK_HOVER_TOLERANCE_PX} screen pixels of one of
 *     those rects — the generous hit band stays for clicks/selection, but the
 *     tooltip no longer fires over blank plot space
 *   - a touch tap shows the tooltip anchored to the mark (there is no hover
 *     on touch); it stays until a tap elsewhere or Escape dismisses it (see
 *     `useHoverDismissal`, wired inside `useChartHover`)
 *   - keyboard focus on a selectable mark anchors the tooltip to the mark
 *     (WCAG 1.4.13 — hover content must also appear on focus)
 *   - leave/blur clears both
 *
 * Plain factory, not a hook — safe to call anywhere in render, no state.
 * Handlers never serialize into markup, so adopting this is render-identical.
 *
 * Internal module: not part of the public API surface.
 */

import type { FocusEvent, PointerEvent as ReactPointerEvent } from "react";
import type { ChartHover, ChartHoverInfo, UseChartHoverResult } from "../hooks/useChartHover";

/**
 * One mark's bounds in SVG user units (the chart's own coordinate space).
 * Pass the FINAL, un-animated geometry — the hover target must be right even
 * while the entrance animation is still growing the mark.
 */
export interface MarkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How close (in screen pixels) the pointer must be to a mark rect to count as
 * hovering it. Converted to SVG user units per move, so a `ChartBox`-scaled
 * chart keeps the same on-screen tolerance.
 */
export const MARK_HOVER_TOLERANCE_PX = 8;

/** The spreadable handler set for one mark. All absent when disabled. */
export interface MarkHandlerProps {
  onPointerMove?: (event: ReactPointerEvent<Element>) => void;
  onPointerLeave?: (event: ReactPointerEvent<Element>) => void;
  onPointerDown?: (event: ReactPointerEvent<Element>) => void;
  onFocus?: (event: FocusEvent<Element>) => void;
  onBlur?: () => void;
}

export interface MarkInteraction<D> {
  /**
   * True when anything consumes hover (built-in tooltip or `onHover`) — gate
   * transparent hit-target rendering on this, exactly like the old
   * `hoverEnabled` locals did.
   */
  enabled: boolean;
  /**
   * Handlers for one mark; spread onto the mark's `<g>`/`<rect>`/`<path>`.
   * `rects` (optional, SVG user units) are the visible marks within the hit
   * element: when given, pointer hover only counts within
   * {@link MARK_HOVER_TOLERANCE_PX} of one of them, and focus/touch anchor to
   * the first rect's center. Omit `rects` when the hit element IS the mark
   * (e.g. a pie slice path).
   */
  forMark(info: ChartHoverInfo<D>, rects?: readonly MarkRect[]): MarkHandlerProps;
}

/** Client-pixel ↔ SVG-user-unit mapping for the `<svg>` containing `el`. */
interface SvgSpace {
  left: number;
  top: number;
  minX: number;
  minY: number;
  /** SVG user units per screen pixel. */
  unitsPerPxX: number;
  unitsPerPxY: number;
}

/**
 * Resolve the coordinate mapping, or `null` when it cannot be measured (no
 * enclosing svg, zero layout size — e.g. jsdom — or `display: none`). A null
 * mapping disables proximity gating rather than guessing.
 */
function svgSpaceOf(el: Element): SvgSpace | null {
  const svg = el.closest("svg");
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  // Parse the attribute rather than `viewBox.baseVal` — identical result in
  // browsers, and it also works under jsdom's partial SVG DOM.
  const vb = (svg.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0;
  return {
    left: rect.left,
    top: rect.top,
    minX: hasVb ? vb[0]! : 0,
    minY: hasVb ? vb[1]! : 0,
    unitsPerPxX: (hasVb ? vb[2]! : rect.width) / rect.width,
    unitsPerPxY: (hasVb ? vb[3]! : rect.height) / rect.height,
  };
}

/** Is the pointer (SVG user coords) within `tol` of any mark rect? */
function nearAnyRect(
  rects: readonly MarkRect[],
  x: number,
  y: number,
  tolX: number,
  tolY: number,
): boolean {
  for (const r of rects) {
    const x0 = Math.min(r.x, r.x + r.width);
    const x1 = Math.max(r.x, r.x + r.width);
    const y0 = Math.min(r.y, r.y + r.height);
    const y1 = Math.max(r.y, r.y + r.height);
    if (x >= x0 - tolX && x <= x1 + tolX && y >= y0 - tolY && y <= y1 + tolY) return true;
  }
  return false;
}

/** Viewport-coordinate center of the first mark rect, when measurable. */
function markAnchor(
  target: Element,
  rects?: readonly MarkRect[],
): { clientX: number; clientY: number } | null {
  if (!rects || rects.length === 0) return null;
  const space = svgSpaceOf(target);
  if (!space) return null;
  const r = rects[0]!;
  return {
    clientX: space.left + (r.x + r.width / 2 - space.minX) / space.unitsPerPxX,
    clientY: space.top + (r.y + r.height / 2 - space.minY) / space.unitsPerPxY,
  };
}

/**
 * Build the per-mark handler factory for a chart render.
 *
 * @param hover    the chart's `useChartHover()` state
 * @param tooltip  the chart's `tooltip` prop (built-in tooltip on/off)
 * @param onHover  the chart's `onHover` prop, if any
 */
export function markInteraction<D>(
  hover: UseChartHoverResult<D>,
  tooltip: boolean,
  onHover?: (hover: ChartHover<D> | null) => void,
): MarkInteraction<D> {
  const enabled = tooltip || onHover != null;
  if (!enabled) return { enabled, forMark: () => ({}) };

  const leave = () => {
    hover.onLeave();
    onHover?.(null);
  };
  const show = (info: ChartHoverInfo<D>, at: { clientX: number; clientY: number }) => {
    if (tooltip) hover.onMove(info, at);
    onHover?.({ ...info, x: at.clientX, y: at.clientY });
  };

  return {
    enabled,
    forMark(info: ChartHoverInfo<D>, rects?: readonly MarkRect[]): MarkHandlerProps {
      return {
        onPointerMove: (event) => {
          // Touch has no hover: tap handling lives in onPointerDown.
          if (event.pointerType === "touch") return;
          if (rects && rects.length > 0) {
            const space = svgSpaceOf(event.currentTarget);
            if (space) {
              const x = space.minX + (event.clientX - space.left) * space.unitsPerPxX;
              const y = space.minY + (event.clientY - space.top) * space.unitsPerPxY;
              const near = nearAnyRect(
                rects,
                x,
                y,
                MARK_HOVER_TOLERANCE_PX * space.unitsPerPxX,
                MARK_HOVER_TOLERANCE_PX * space.unitsPerPxY,
              );
              if (!near) {
                // Inside the hit band but away from the marks: no tooltip.
                if (hover.hovered) leave();
                return;
              }
            }
          }
          show(info, event);
        },
        onPointerLeave: (event) => {
          // A tap's implicit pointer-leave must not dismiss the tap tooltip;
          // taps are dismissed by tapping elsewhere or Escape instead.
          if (event.pointerType !== "touch") leave();
        },
        // Touch parity: a tap anchors the tooltip to the mark, since there is
        // no pointer to follow (and no hover to end).
        onPointerDown: (event) => {
          if (event.pointerType !== "touch") return;
          show(info, markAnchor(event.currentTarget, rects) ?? event);
        },
        // Keyboard parity: focusing a selectable mark anchors the tooltip to
        // the mark's center, since there is no pointer to follow.
        onFocus: (event) => {
          const anchor = markAnchor(event.currentTarget, rects);
          if (anchor) {
            show(info, anchor);
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          show(info, { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
        },
        onBlur: () => leave(),
      };
    },
  };
}
