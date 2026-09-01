import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The measured size of an element, in CSS pixels.
 */
export interface ElementSize {
  width: number;
  height: number;
}

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server (React warns
 * about layout effects during SSR). Measuring in a *layout* effect is the
 * whole point of this hook: the first real numbers land before the browser
 * paints, so consumers like `ChartBox` / `ChartFrame` never flash an empty box
 * for a frame.
 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Observe an element's content-box size with a `ResizeObserver`.
 *
 * Returns a `[ref, size]` tuple: attach `ref` to the element you want to
 * measure and read the live `{ width, height }` from `size`. The size starts
 * at `{ 0, 0 }` and is updated in a layout effect once the element is mounted
 * (before the first paint), then on every subsequent resize.
 *
 * Resize updates are applied on the next animation frame rather than straight
 * from the observer callback. That keeps a consumer which *reacts* to its own
 * measurement by changing its box (e.g. `ChartBox` toggling `overflow`) from
 * tripping the browser's "ResizeObserver loop completed with undelivered
 * notifications" error.
 *
 * SSR-safe: nothing touches `window`, `document` or `ResizeObserver` at module
 * load or during render - all access happens inside effects. In environments
 * without `ResizeObserver` the element is measured once via `getBoundingClientRect`
 * and then left static (no live updates).
 *
 * @example
 * ```tsx
 * function Box() {
 *   const [ref, { width, height }] = useElementSize<HTMLDivElement>();
 *   return <div ref={ref}>{width} × {height}</div>;
 * }
 * ```
 */
export function useElementSize<T extends HTMLElement = HTMLElement>(): [
  React.RefObject<T | null>,
  ElementSize,
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  // Only update when the value actually changes, to avoid extra renders.
  const update = useCallback((width: number, height: number) => {
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Measure immediately so the first painted frame has real numbers.
    const rect = node.getBoundingClientRect();
    update(rect.width, rect.height);

    if (typeof ResizeObserver === "undefined") return;

    let frame = 0;
    let pending: ElementSize | null = null;
    const flush = () => {
      frame = 0;
      if (!pending) return;
      const { width, height } = pending;
      pending = null;
      update(width, height);
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const box = Array.isArray(entry.contentBoxSize)
            ? entry.contentBoxSize[0]
            : entry.contentBoxSize;
          pending = { width: box.inlineSize, height: box.blockSize };
        } else {
          pending = { width: entry.contentRect.width, height: entry.contentRect.height };
        }
      }
      // Defer the state update out of the observer callback (see the docblock).
      // One frame is enough; extra notifications coalesce into the pending size.
      if (typeof requestAnimationFrame === "undefined") flush();
      else if (!frame) frame = requestAnimationFrame(flush);
    });
    observer.observe(node);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [update]);

  return [ref, size];
}
