import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Options for {@link useAsyncData}.
 */
export interface UseAsyncDataOptions<T> {
  /**
   * Extra reactive inputs. The fetcher re-runs whenever any of these change
   * (alongside the automatic mount run). Mirrors a `useEffect` dependency list
   * - and, like one, its **length must stay constant across renders**: the list
   * is spliced into the internal effect's dependency array, so growing or
   * shrinking it between renders makes React throw. Pass a fixed-shape array
   * (use `null` for "not applicable" slots) rather than a conditional one.
   */
  deps?: unknown[];
  /**
   * Run the fetcher? Reactive: flipping it to `false` aborts any in-flight call
   * and clears the loading / refreshing flags; flipping it back to `true`
   * re-runs the fetcher. Default true.
   */
  enabled?: boolean;
  /** Seed value shown before the first fetch resolves (also the SSR value). */
  initialData?: T;
  /** Poll interval in ms. Omit / `0` to fetch once per deps-change. */
  refreshMs?: number;
  /**
   * Keep showing the previous `data` during a re-fetch (so the UI doesn't blank
   * out) - the re-fetch surfaces as `refreshing` rather than `loading`.
   * Default true.
   */
  keepPreviousData?: boolean;
}

/**
 * The async-resource state returned by {@link useAsyncData}.
 */
export interface UseAsyncDataResult<T> {
  /** The latest resolved value, or `initialData` / `undefined` before the first success. */
  data: T | undefined;
  /** The last error (aborts are ignored), cleared when a fetch starts. */
  error: Error | null;
  /** True during the first load (no data to show yet). */
  loading: boolean;
  /** True during a re-fetch while previous `data` is still shown (see `keepPreviousData`). */
  refreshing: boolean;
  /** Manually trigger a fetch now (aborts any in-flight one). Stable identity. */
  refetch: () => void;
  /** Epoch ms of the last successful fetch, or null. */
  lastUpdated: number | null;
}

/**
 * Drive a component off an async source (an API call, a DB query, anything that
 * returns a Promise) with first-class loading / refreshing / error state. The
 * fetcher runs on mount and whenever `deps` change; it never runs during render
 * or at module load, so the hook is **SSR-safe** (the server renders the
 * `initialData` / loading state and the browser fetches in an effect).
 *
 * In-flight requests are aborted on unmount, on a manual `refetch`, when
 * `enabled` flips to `false`, and before each new run - the fetcher receives an
 * {@link AbortSignal} to forward to `fetch`. Aborted requests are ignored
 * (never surfaced as errors) and never leave the hook stuck in `loading`. Set
 * `refreshMs` to poll.
 *
 * `deps` must keep a **constant length** across renders (see
 * {@link UseAsyncDataOptions.deps}) - it feeds React's dependency array.
 *
 * ```tsx
 * const { data, loading, refreshing, error, refetch } = useAsyncData(
 *   (signal) => fetch("/api/pnl", { signal }).then((r) => r.json()),
 *   { refreshMs: 30_000 }
 * );
 * if (error) return <Err onRetry={refetch} />;
 * return <StatementTable lines={data ?? []} />; // `loading` shows a skeleton
 * ```
 */
export function useAsyncData<T>(
  fetcher: (signal?: AbortSignal) => Promise<T>,
  opts: UseAsyncDataOptions<T> = {},
): UseAsyncDataResult<T> {
  const { deps = [], enabled = true, initialData, refreshMs, keepPreviousData = true } = opts;

  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<Error | null>(null);
  // Start in the loading state when we'll fetch and have nothing to show - this
  // is also the value the server renders, avoiding a mount flash in the browser.
  const [loading, setLoading] = useState<boolean>(enabled && initialData === undefined);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Latest fetcher without making it a dependency (deps drive re-runs instead).
  const fetcherRef = useRef(fetcher);

  // Do we currently hold data? Tracked in a ref so `run` need not depend on it.
  const hasDataRef = useRef(initialData !== undefined);
  // The in-flight controller, so refetch / unmount / a new run can abort it.
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(() => {
    // Cancel any request still in flight before kicking off a new one.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    // Re-fetch with data already on screen → "refreshing"; otherwise "loading".
    if (keepPreviousData && hasDataRef.current) setRefreshing(true);
    else setLoading(true);
    setError(null);

    fetcherRef.current(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setData(result);
        hasDataRef.current = true;
        setLastUpdated(Date.now());
        setLoading(false);
        setRefreshing(false);
      },
      (err: unknown) => {
        // Ignore aborts - they're our own cancellation, not a real failure.
        if (controller.signal.aborted || (err as { name?: string })?.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        setRefreshing(false);
      },
    );
  }, [keepPreviousData]);

  // Stable handle so `refetch` keeps the same identity across renders.
  const runRef = useRef(run);
  const refetch = useCallback(() => runRef.current(), []);

  // Refresh the "latest value" refs in an effect, never during render: a render
  // pass may be discarded (StrictMode, Suspense, concurrent re-entry), and
  // mutating a ref there is a purity violation. Declared *before* the fetching
  // effects below so both refs are already current when those run in the same
  // commit.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  useEffect(() => {
    runRef.current = run;
  });

  // Fetch on mount and whenever `enabled` or a dep changes; abort on cleanup.
  useEffect(() => {
    if (!enabled) {
      // Going idle mid-flight: aborting alone would strand the flags, because
      // the settle handlers bail out on an aborted signal and nothing else
      // clears them - the hook would report `loading` forever.
      controllerRef.current?.abort();
      controllerRef.current = null;
      setLoading(false);
      setRefreshing(false);
      return;
    }
    runRef.current();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  // Optional polling. Independent of the deps effect so changing deps doesn't
  // reset the timer; each tick re-runs through the latest fetcher.
  useEffect(() => {
    if (!enabled || !refreshMs || refreshMs <= 0) return;
    const id = setInterval(() => runRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [enabled, refreshMs]);

  return { data, error, loading, refreshing, refetch, lastUpdated };
}
