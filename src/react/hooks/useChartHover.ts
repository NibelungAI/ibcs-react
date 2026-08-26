import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ScenarioKey } from "../../core/types";
import { useHoverDismissal } from "../internal/dismiss";
import { applyTooltipPosition } from "../internal/tooltipPosition";

/**
 * The payload describing the chart mark currently under the pointer. It mirrors
 * {@link ChartSelection} (so `onHover` and `onSelect` carry the same fields) and
 * adds the pointer's viewport coordinates so a consumer can position a floating
 * tooltip at `clientX` / `clientY`.
 *
 * `D` is the chart's datum type (e.g. `ColumnDatum`, `StructureDatum`).
 */
export interface ChartHover<D = unknown> {
  /** The hovered category / component label (the chart's x-key). */
  category: string;
  /** The scenario the hovered mark represents, when meaningful (AC, FC, …). */
  scenario?: ScenarioKey;
  /** The numeric value of the hovered mark. */
  value: number;
  /** The original datum the mark was rendered from. */
  datum: D;
  /** Pointer x in viewport coordinates (`event.clientX`). */
  x: number;
  /** Pointer y in viewport coordinates (`event.clientY`). */
  y: number;
}

/** Just the data fields of {@link ChartHover}, without the pointer position. */
export type ChartHoverInfo<D = unknown> = Omit<ChartHover<D>, "x" | "y">;

/** A minimal mouse-event shape — satisfied by React's `MouseEvent`. */
export interface PointerLike {
  clientX: number;
  clientY: number;
}

/** The hover state + helpers returned by {@link useChartHover}. */
export interface UseChartHoverResult<D = unknown> {
  /** The mark currently under the pointer, or `null` when none. */
  hovered: ChartHover<D> | null;
  /** Ref to pass to `<ChartTooltip ref={hover.tooltipRef} />` for cheap pointer tracking. */
  tooltipRef: RefObject<HTMLDivElement | null>;
  /** Record a hover: stamps `event.clientX/clientY` onto `info`. */
  onMove: (info: ChartHoverInfo<D>, event: PointerLike) => void;
  /** Clear the hover (e.g. on `onMouseLeave`). */
  onLeave: () => void;
  /** Alias of {@link UseChartHoverResult.onLeave}. */
  clear: () => void;
}

/**
 * A tiny, framework-free hover model for charts: pair it with a chart's
 * `onHover` (or your own per-mark `onMouseMove`) to drive a floating
 * {@link ChartTooltip}. Holds the hovered datum plus the pointer's viewport
 * coordinates. SSR-safe — pure `useState`, no DOM access at module or render
 * time (coordinates come from the event you pass in).
 *
 * ```tsx
 * const hover = useChartHover<ColumnDatum>();
 * <VarianceColumnChart
 *   data={data}
 *   tooltip={false}
 *   onHover={(h) => (h ? hover.onMove(h, { clientX: h.x, clientY: h.y }) : hover.onLeave())}
 * />
 * {hover.hovered && (
 *   <ChartTooltip x={hover.hovered.x} y={hover.hovered.y} title={hover.hovered.category} rows={[…]} />
 * )}
 * ```
 */
export function useChartHover<D = unknown>(): UseChartHoverResult<D> {
  const [hovered, setHovered] = useState<ChartHover<D> | null>(null);
  const hoveredInfoRef = useRef<ChartHoverInfo<D> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  const positionTooltip = useCallback((x: number, y: number) => {
    posRef.current = { x, y };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const node = tooltipRef.current;
      if (!node) return;
      // Shared placement (pointer + offset, viewport-edge flip) — must agree
      // with ChartTooltip's own mount-time positioning.
      applyTooltipPosition(node, posRef.current.x, posRef.current.y);
    });
  }, []);

  const onMove = useCallback(
    (info: ChartHoverInfo<D>, event: PointerLike) => {
      positionTooltip(event.clientX, event.clientY);
      const prev = hoveredInfoRef.current;
      const sameMark =
        prev &&
        prev.category === info.category &&
        prev.scenario === info.scenario &&
        prev.value === info.value &&
        Object.is(prev.datum, info.datum);
      if (sameMark) return;
      hoveredInfoRef.current = info;
      setHovered({ ...info, x: event.clientX, y: event.clientY });
    },
    [positionTooltip],
  );

  const onLeave = useCallback(() => {
    hoveredInfoRef.current = null;
    setHovered(null);
  }, []);

  // WCAG 1.4.13 "dismissible": Escape hides the tooltip without moving the
  // pointer or focus; a touch tap elsewhere dismisses a tap-anchored one.
  useHoverDismissal(hovered !== null, onLeave);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return useMemo(
    () => ({ hovered, tooltipRef, onMove, onLeave, clear: onLeave }),
    [hovered, onMove, onLeave],
  );
}
