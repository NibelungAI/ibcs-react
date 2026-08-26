import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Zero-dependency animation primitives. Everything is requestAnimationFrame +
 * an easing function — no motion library — and everything collapses to its
 * final value instantly when the user prefers reduced motion.
 *
 * Every hook here is **SSR-safe in the strong sense**: the value rendered on the
 * server (and on the first client render, before hydration) is the *finished*
 * one. Animations are started from a layout effect, which only ever runs in the
 * browser — so server markup carries real geometry instead of a collapsed
 * `height="0"` frame, and a reduced-motion user never sees a flash.
 */

export type Easing = (t: number) => number;

/** Standard ease-out: fast then settling. The default for entrance + value tweens. */
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuart: Easing = (t) => 1 - Math.pow(1 - t, 4);
export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export interface AnimateOptions {
  /** Milliseconds. Default 600. `0` (or less) renders the target instantly, with no frame loop. */
  duration?: number;
  /** Easing curve. Default easeOutCubic. */
  easing?: Easing;
  /** Start delay in ms (useful for staggering). Default 0. */
  delay?: number;
  /**
   * Start value for the **first** animation only — e.g. `0` for a real mount
   * count-up. Later target changes still tween from wherever the value
   * currently sits (retargeting). Ignored under reduced motion or `duration <= 0`,
   * where the target is shown immediately. Omit to start at the target (no
   * mount animation, just tweens on change).
   */
  from?: number;
}

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server — React warns
 * about layout effects during SSR, and there is nothing to lay out there.
 * Animations need the layout-effect timing: the "start" frame must be committed
 * before the browser paints, otherwise the finished state flashes for a frame.
 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// The MediaQueryList is created lazily (never at module load — that would touch
// `window` on the server) and cached, so every component shares one listener
// target. The cache is keyed on the `matchMedia` function identity so a test
// harness (or a re-created window) that swaps `window.matchMedia` is picked up
// instead of being served a stale list.
let cachedMatchMedia: unknown;
let cachedQuery: MediaQueryList | null = null;

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  if (cachedMatchMedia !== window.matchMedia) {
    cachedMatchMedia = window.matchMedia;
    cachedQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  }
  return cachedQuery;
}

/** Subscribe to OS-level reduced-motion changes (Safari <14 used `addListener`). */
function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mq = reducedMotionQuery();
  if (!mq) return () => {};
  if (mq.addEventListener) {
    mq.addEventListener("change", onStoreChange);
    return () => mq.removeEventListener("change", onStoreChange);
  }
  mq.addListener?.(onStoreChange);
  return () => mq.removeListener?.(onStoreChange);
}

const getReducedMotion = (): boolean => reducedMotionQuery()?.matches ?? false;
// The server can't know the user's preference; it renders the finished state
// anyway, so "no reduced motion" is the safe, hydration-stable answer.
const getServerReducedMotion = (): boolean => false;

/**
 * True when the OS asks for reduced motion. Kept live via `matchMedia` and read
 * through `useSyncExternalStore`, so the very first client render already
 * reflects the real preference (a `useState` + `useEffect` version reports
 * `false` for one render — long enough to flash an animation at exactly the
 * users who asked not to see one).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
}

/** Cap for object signatures — enough to be distinctive, cheap to compute. */
const MAX_SIGNATURE_CHARS = 200;
const cap = (s: string): string =>
  s.length > MAX_SIGNATURE_CHARS ? s.slice(0, MAX_SIGNATURE_CHARS) : s;

/**
 * A cheap *structural* fingerprint of the replay key. Comparing identities
 * would replay the entrance on every parent render whenever the caller passes
 * an inline literal (`data={[{...}]}`), which is the common case.
 *
 * Arrays are fingerprinted by `length | first | last` — O(1) regardless of size.
 * A change buried in the middle of a same-length array therefore does *not*
 * replay the entrance; that is the deliberate trade for not stringifying every
 * point on every render.
 */
function signatureOf(key: unknown): string {
  if (key === undefined) return "";
  if (key === null) return "null";
  if (typeof key !== "object") return String(key);

  const cached = signatureCache.get(key);
  if (cached !== undefined) return cached;
  const signature = fingerprint(key);
  signatureCache.set(key, signature);
  return signature;
}

// Charts usually pass a memoized layout/data object, so caching by identity
// means the fingerprint is computed once per distinct key rather than on every
// render. Mutating a key in place is not detected — the same rule React applies
// to state, and the reason layout modules return fresh objects.
const signatureCache = new WeakMap<object, string>();

function fingerprint(key: object): string {
  if (Array.isArray(key)) {
    try {
      return cap(`${key.length}|${JSON.stringify(key[0])}|${JSON.stringify(key[key.length - 1])}`);
    } catch {
      // Cyclic or non-serializable entries — fall back to the cheapest signal.
      return `${key.length}`;
    }
  }
  try {
    const json = JSON.stringify(key);
    return json === undefined ? "obj" : cap(json);
  } catch {
    return "obj";
  }
}

/**
 * Eased progress 0 → 1 for an entrance animation (bars growing out of the
 * baseline, arcs sweeping in, …).
 *
 * The hook renders **1** — the finished state — on the server and on the first
 * client render, then plays the entrance from a layout effect (browser only,
 * before paint, so there is no full-size flash). That ordering is what keeps
 * server markup renderable: an SSR chart ships real geometry rather than
 * `height="0"` bars, and a client that never runs effects (or a reduced-motion
 * user) simply keeps the finished frame.
 *
 * Pass `key` as the value that identifies the data. The entrance replays on a
 * real **data change** but no longer on mere re-renders with equal data — the
 * key is reduced to a cheap structural signature (see {@link signatureOf}), so
 * an inline `data={[…]}` literal no longer restarts the animation every time
 * the parent renders.
 *
 * Reduced motion, `duration <= 0`, or an environment without
 * `requestAnimationFrame` → stays at 1, with no frame loop at all.
 */
export function useMountGrow(duration = 600, delay = 0, key?: unknown): number {
  const reduced = usePrefersReducedMotion();
  // Start finished: correct for SSR, for the first paint, and for anyone whose
  // effects never run. The entrance rewinds to 0 in the layout effect below.
  const [p, setP] = useState(1);
  const signature = signatureOf(key);

  useIsoLayoutEffect(() => {
    if (reduced || duration <= 0 || typeof requestAnimationFrame === "undefined") {
      setP(1);
      return;
    }
    // Committed before paint, so the finished frame is never shown first.
    setP(0);
    let raf = 0;
    let start = 0;
    let cancelled = false;
    const loop = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setP(easeOutCubic(t));
      if (t < 1 && !cancelled) raf = requestAnimationFrame(loop);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(loop);
    }, delay);
    // StrictMode double-invokes this effect; the second run simply restarts the
    // entrance, so the value can never be left stranded at 0.
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [signature, duration, delay, reduced]);

  return p;
}

/**
 * Smoothly tween a number toward `target` whenever it changes — the value
 * animates from where it was to the new target (retargeting mid-flight is
 * supported: it continues from the currently displayed value). Reduced motion,
 * or `duration <= 0`, → jumps straight to the target with no frame loop.
 *
 * The first render (server included) shows `target`, so SSR markup and static
 * renders are always correct. Pass `from` to opt into a mount animation — the
 * first tween then runs `from → target` (a real count-up), started before the
 * browser paints so the target is not flashed first.
 *
 * Pair with a formatter for count-up figures (see {@link useCountUp}).
 */
export function useAnimatedValue(target: number, opts: AnimateOptions = {}): number {
  const { duration = 600, easing = easeOutCubic, delay = 0, from } = opts;
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const easingRef = useRef(easing);
  const startedRef = useRef(false);

  // Keep the latest easing without restarting the tween when the caller passes
  // an inline arrow (a new identity every render). Synced in an effect rather
  // than during render — render must stay pure — and declared *before* the
  // animation effect so it is already fresh when a tween starts.
  useIsoLayoutEffect(() => {
    easingRef.current = easing;
  });

  const setAnimatedValue = (next: number) => {
    valueRef.current = next;
    setValue(next);
  };

  useIsoLayoutEffect(() => {
    if (reduced || duration <= 0 || typeof requestAnimationFrame === "undefined") {
      // No animation at all: no state update unless the number actually moved.
      if (valueRef.current !== target) setAnimatedValue(target);
      return;
    }
    // `from` seeds the first animated run only; later runs retarget from the
    // value on screen.
    const origin = !startedRef.current && from !== undefined ? from : valueRef.current;
    startedRef.current = true;
    if (origin === target) return;
    if (origin !== valueRef.current) setAnimatedValue(origin);

    let raf = 0;
    let start = 0;
    let cancelled = false;
    const loop = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const next = origin + (target - origin) * easingRef.current(t);
      setAnimatedValue(next);
      if (t < 1 && !cancelled) raf = requestAnimationFrame(loop);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(loop);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, reduced, duration, delay, from]);

  return value;
}

/**
 * Convenience: an animated number you render through your own formatter.
 *
 * ```tsx
 * // counts 0 → revenue on mount, then tweens on every change
 * const shown = useCountUp(revenue, { duration: 700, from: 0 });
 * <span>{formatValue(shown, { compact: true })}</span>
 * ```
 */
export function useCountUp(target: number, opts?: AnimateOptions): number {
  return useAnimatedValue(target, opts);
}
