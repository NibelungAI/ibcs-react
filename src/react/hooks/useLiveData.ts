import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Options for {@link useLiveData}.
 */
export interface UseLiveDataOptions {
  /** Tick interval in milliseconds. Default 2000. */
  intervalMs?: number;
  /**
   * Run the feed? Reactive, like `useAsyncData`'s `enabled`: the feed starts
   * running when this flips to `true` and stops when it flips to `false`.
   * Between prop changes the user's own `start()` / `stop()` wins, so a manual
   * pause is never undone by an unrelated re-render. Default true.
   */
  enabled?: boolean;
  /**
   * Produce a fresh value immediately when the feed (re)starts, instead of
   * waiting a full interval for the first tick. Default false.
   */
  immediate?: boolean;
}

/**
 * A fake live feed driven by {@link useLiveData}.
 */
export interface UseLiveDataResult<T> {
  /** The latest produced value. */
  data: T;
  /** Produce a fresh value now (independent of the running interval). */
  refresh: () => void;
  /** True while the interval is ticking. */
  running: boolean;
  /** Start (or restart) the interval. */
  start: () => void;
  /** Stop the interval. `data` keeps its last value. */
  stop: () => void;
}

/**
 * Emit a fresh value on an interval — a zero-dependency "live data" feed that
 * mirrors the demo's randomize/live-data button. SSR-safe: the producer is
 * called once for the initial value, and the interval only ever runs inside
 * `useEffect` (never during render) and is cleared on unmount or when stopped.
 *
 * `enabled` is a live switch (a controlled prop), not just a seed: changing it
 * starts or stops the feed. `start()` / `stop()` still work on top of it — only
 * an actual `enabled` transition overrides a manual pause.
 *
 * Pass a *fresh-data* producer (e.g. jitter your base dataset) and the value
 * updates on each tick; charts animating off `data` then tween to it.
 *
 * ```tsx
 * const { data, running, start, stop, refresh } = useLiveData(
 *   () => jitter(baseRevenue),
 *   { intervalMs: 3000, immediate: true }
 * );
 * ```
 */
export function useLiveData<T>(
  producer: () => T,
  opts: UseLiveDataOptions = {},
): UseLiveDataResult<T> {
  const { intervalMs = 2000, enabled = true, immediate = false } = opts;

  // Seed synchronously so the first render (incl. SSR) has a real value.
  const [data, setData] = useState<T>(producer);
  const [running, setRunning] = useState(enabled);

  // Keep the latest producer without retriggering the interval effect. Synced
  // in an effect rather than during render (a discarded render must not mutate
  // a ref), and declared before the interval effect so a tick in the same
  // commit already sees the new producer.
  const producerRef = useRef(producer);
  useEffect(() => {
    producerRef.current = producer;
  });

  const refresh = useCallback(() => {
    setData(producerRef.current());
  }, []);

  const start = useCallback(() => setRunning(true), []);
  const stop = useCallback(() => setRunning(false), []);

  // Mirror the `enabled` PROP onto the running state, but only on a real
  // transition: re-running this effect (StrictMode, an unrelated re-render)
  // must not resurrect a feed the user paused with `stop()`.
  const prevEnabledRef = useRef(enabled);
  useEffect(() => {
    if (prevEnabledRef.current === enabled) return;
    prevEnabledRef.current = enabled;
    setRunning(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!running) return;
    if (immediate) setData(producerRef.current());
    const id = setInterval(
      () => {
        setData(producerRef.current());
      },
      Math.max(0, intervalMs),
    );
    return () => clearInterval(id);
  }, [running, intervalMs, immediate]);

  return { data, refresh, running, start, stop };
}
