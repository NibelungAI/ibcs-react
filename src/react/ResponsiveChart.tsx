import { useEffect, useRef, useState } from "react";
import { useElementSize } from "./hooks/useElementSize";

/**
 * Props for {@link ResponsiveChart}.
 */
export interface ResponsiveChartProps {
  /**
   * Width-to-height ratio (`width / height`). When set, the rendered height is
   * derived from the measured width (`height = width / aspect`) and the
   * container's own height is ignored. Example: `2` gives a 2:1 landscape box.
   */
  aspect?: number;
  /** Minimum width passed to the child, in pixels. Default `0`. */
  minWidth?: number;
  /** Minimum height passed to the child, in pixels. Default `0`. */
  minHeight?: number;
  /** Maximum height passed to the child, in pixels. Default `Infinity`. */
  maxHeight?: number;
  /**
   * Debounce in milliseconds before reacting to a size change. Smooths out
   * rapid resize storms. Default `0` (update synchronously on each measure,
   * with no extra state or timers in play).
   */
  debounce?: number;
  /** Class applied to the measured wrapper `<div>`. */
  className?: string;
  /** Styles merged over the wrapper's own sizing styles. */
  style?: React.CSSProperties;
  /**
   * Render-prop called with integer pixel `width`/`height` once the container
   * has been measured. Return the chart to render.
   */
  children: (width: number, height: number) => React.ReactNode;
}

/**
 * Make a fixed-size chart fill its parent.
 *
 * `ResponsiveChart` renders a block `<div>` that takes up its parent's full
 * width, measures it with a `ResizeObserver`, and hands integer `width`/`height`
 * to a render-prop child so charts that require explicit dimensions can adapt
 * to their container.
 *
 * - If `aspect` is given, height = `width / aspect` (the measured height is
 *   ignored). Otherwise the measured container height is used.
 * - The resulting width and height are clamped by `minWidth` / `minHeight` /
 *   `maxHeight` and rounded to whole pixels.
 * - Before the first measure (SSR / first paint) the child is not rendered, so
 *   there is no layout jump and the child never receives `0` or `NaN`.
 * - `className` and `style` go to the wrapper `<div>`; `style` is merged *over*
 *   the built-in sizing, so you can override `height`, add padding, and so on.
 *
 * SSR-safe and zero-dependency.
 *
 * @example
 * ```tsx
 * <div style={{ width: "100%", height: 320 }}>
 *   <ResponsiveChart aspect={16 / 9} minWidth={240}>
 *     {(width, height) => (
 *       <VarianceColumnChart width={width} height={height} data={data} />
 *     )}
 *   </ResponsiveChart>
 * </div>
 * ```
 */
export function ResponsiveChart({
  aspect,
  minWidth = 0,
  minHeight = 0,
  maxHeight = Infinity,
  debounce = 0,
  className,
  style,
  children,
}: ResponsiveChartProps): React.ReactElement {
  const [ref, measured] = useElementSize<HTMLDivElement>();
  const [debounced, setDebounced] = useState(measured);
  // Explicit `undefined`: the no-argument `useRef<T>()` overload was removed in
  // @types/react 19.
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Undebounced is the default, and then this state is pure overhead: the
    // render below already reads `measured`. Bail out *without* a setState so a
    // resize storm costs exactly one render per measurement, not two.
    if (debounce <= 0) return;
    timerRef.current = setTimeout(() => setDebounced(measured), debounce);
    return () => clearTimeout(timerRef.current);
  }, [measured, debounce]);

  const size = debounce <= 0 ? measured : debounced;

  const width = Math.max(minWidth, Math.round(size.width));
  const rawHeight = aspect && aspect > 0 ? size.width / aspect : size.height;
  const height = Math.min(maxHeight, Math.max(minHeight, Math.round(rawHeight)));

  // Fill the parent's width; let height collapse to the child (unless aspect-driven).
  const boxStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: aspect ? undefined : "100%",
    ...style,
  };

  const ready = width > 0 && height > 0;

  return (
    <div ref={ref} className={className} style={boxStyle}>
      {ready ? children(width, height) : null}
    </div>
  );
}
