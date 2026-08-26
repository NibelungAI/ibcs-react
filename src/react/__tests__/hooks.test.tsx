/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import { useMountGrow } from "../hooks/useAnimation";
import { useAsyncData } from "../hooks/useAsyncData";
import { useElementSize } from "../hooks/useElementSize";
import {
  useStatement,
  type UseStatementOptions,
  type UseStatementResult,
} from "../hooks/useStatement";
import type { StatementLine } from "../../core/types";

/**
 * Unit tests for the browser-facing hooks. Everything is deterministic: fake
 * timers plus a hand-rolled `requestAnimationFrame` queue that only advances
 * when a test flushes it — no real waiting, no flakes.
 */

// ---------------------------------------------------------------- RAF harness

let nextFrameId = 0;
const frames = new Map<number, FrameRequestCallback>();

/** Run every frame callback queued so far (a callback may queue the next one). */
function flushFrame(time: number): void {
  const pending = [...frames.values()];
  frames.clear();
  for (const cb of pending) cb(time);
}

// ------------------------------------------------------------ matchMedia mock

/** Install a `matchMedia` that reports `matches` and records its listeners. */
function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  };
  // A fresh function identity per test, so the hook's cached MediaQueryList is
  // invalidated instead of a previous test's mock being reused.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return { mql, listeners };
}

// -------------------------------------------------------- ResizeObserver mock

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }
  /** Fire the observer callback as the browser would, with a content rect. */
  emit(width: number, height: number): void {
    this.callback(
      [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

beforeEach(() => {
  // Fake timers first: our RAF stub must survive whatever the timer mock fakes.
  vi.useFakeTimers();
  nextFrameId = 0;
  frames.clear();
  MockResizeObserver.instances = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++nextFrameId;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const last = <T,>(xs: T[]): T => xs[xs.length - 1]!;

// ----------------------------------------------------------------------------

describe("useMountGrow", () => {
  /** Records the progress value of every render pass. */
  function makeProbe(seen: number[], duration = 1000) {
    return function Probe({ data, tick }: { data: number[]; tick?: number }) {
      seen.push(useMountGrow(duration, 0, data));
      return <output>{tick ?? 0}</output>;
    };
  }

  it("stays at the finished value when the user prefers reduced motion", () => {
    mockMatchMedia(true);
    const seen: number[] = [];
    const Probe = makeProbe(seen);

    render(<Probe data={[1, 2, 3]} />);

    // The very first render already knows about the preference (no flash), and
    // nothing ever rewinds it to 0.
    expect(seen[0]).toBe(1);
    expect(seen.every((p) => p === 1)).toBe(true);
    // Not a single frame was scheduled.
    expect(frames.size).toBe(0);
  });

  it("renders the finished value first, then plays the entrance in the browser", () => {
    mockMatchMedia(false);
    const seen: number[] = [];
    const Probe = makeProbe(seen);

    render(<Probe data={[1, 2, 3]} />);

    // First render = finished geometry (what the server emits and hydrates).
    expect(seen[0]).toBe(1);
    // The layout effect rewinds it before paint, so there is no full-size flash.
    expect(last(seen)).toBe(0);

    act(() => {
      vi.runOnlyPendingTimers();
      flushFrame(100);
      flushFrame(1100);
    });
    expect(last(seen)).toBe(1);
  });

  it("replays on a data change but not on a re-render with equal data", () => {
    mockMatchMedia(false);
    const seen: number[] = [];
    const Probe = makeProbe(seen);

    const { rerender } = render(<Probe data={[1, 2, 3]} tick={0} />);
    act(() => {
      vi.runOnlyPendingTimers();
      flushFrame(100);
      flushFrame(1100);
    });
    expect(last(seen)).toBe(1);

    // A new array with equal contents — the inline-literal case. No replay.
    seen.length = 0;
    rerender(<Probe data={[1, 2, 3]} tick={1} />);
    expect(seen.every((p) => p === 1)).toBe(true);
    expect(frames.size).toBe(0);

    // Real data change → the entrance replays from 0.
    seen.length = 0;
    rerender(<Probe data={[1, 2, 4]} tick={2} />);
    expect(last(seen)).toBe(0);
  });
});

describe("useAsyncData", () => {
  /** A fetcher that never settles, recording the signals it was handed. */
  function neverSettles() {
    const signals: Array<AbortSignal | undefined> = [];
    const fetcher = (signal?: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>(() => {});
    };
    return { fetcher, signals };
  }

  function Probe({
    enabled,
    fetcher,
  }: {
    enabled: boolean;
    fetcher: (signal?: AbortSignal) => Promise<string>;
  }) {
    const { loading } = useAsyncData(fetcher, { enabled });
    return <output>{loading ? "loading" : "idle"}</output>;
  }

  it("clears loading when `enabled` flips to false mid-flight", () => {
    const { fetcher, signals } = neverSettles();
    const { container, rerender } = render(<Probe enabled fetcher={fetcher} />);
    expect(container.textContent).toBe("loading");

    rerender(<Probe enabled={false} fetcher={fetcher} />);

    // The in-flight call is aborted AND the flag is cleared — the settle
    // handlers bail on an aborted signal, so nothing else would clear it.
    expect(signals[0]?.aborted).toBe(true);
    expect(container.textContent).toBe("idle");
  });

  it("re-runs when `enabled` flips back to true", () => {
    const { fetcher, signals } = neverSettles();
    const { container, rerender } = render(<Probe enabled={false} fetcher={fetcher} />);
    expect(container.textContent).toBe("idle");
    expect(signals.length).toBe(0);

    rerender(<Probe enabled fetcher={fetcher} />);
    expect(signals.length).toBe(1);
    expect(container.textContent).toBe("loading");
  });

  it("aborts the in-flight request on unmount", () => {
    const { fetcher, signals } = neverSettles();
    const { unmount } = render(<Probe enabled fetcher={fetcher} />);

    expect(signals.length).toBe(1);
    expect(signals[0]?.aborted).toBe(false);

    unmount();
    expect(signals[0]?.aborted).toBe(true);
  });
});

describe("useElementSize", () => {
  function SizeProbe() {
    const [ref, size] = useElementSize<HTMLDivElement>();
    return (
      <div ref={ref}>
        {size.width}x{size.height}
      </div>
    );
  }

  it("applies resize updates on the next frame and disconnects on cleanup", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const { container, unmount } = render(<SizeProbe />);

    const observer = MockResizeObserver.instances[0]!;
    expect(observer).toBeTruthy();
    expect(observer.observe).toHaveBeenCalledTimes(1);
    // jsdom has no layout, so the initial measurement is 0×0.
    expect(container.textContent).toBe("0x0");

    // The callback must not call setState synchronously — that is what trips
    // "ResizeObserver loop completed with undelivered notifications".
    act(() => observer.emit(320, 180));
    expect(container.textContent).toBe("0x0");
    expect(frames.size).toBe(1);

    act(() => flushFrame(16));
    expect(container.textContent).toBe("320x180");

    unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending frame when the element unmounts", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const { unmount } = render(<SizeProbe />);
    const observer = MockResizeObserver.instances[0]!;

    act(() => observer.emit(200, 100));
    expect(frames.size).toBe(1);

    unmount();
    expect(frames.size).toBe(0);
  });
});

describe("useStatement", () => {
  /** A two-level statement: Revenue > Services > (EMEA, US), plus Goods. */
  const lines: StatementLine[] = [
    {
      id: "rev",
      label: "Revenue",
      values: { AC: 100, PY: 90 },
      children: [
        {
          id: "svc",
          label: "Services",
          values: { AC: 60, PY: 50 },
          children: [
            { id: "svc-eu", label: "Services EMEA", values: { AC: 35, PY: 30 } },
            { id: "svc-us", label: "Services US", values: { AC: 25, PY: 20 } },
          ],
        },
        { id: "goods", label: "Goods", values: { AC: 40, PY: 40 } },
      ],
    },
    { id: "cogs", label: "COGS", flow: "subtract", values: { AC: 40, PY: 35 } },
    { id: "gp", label: "Gross profit", flow: "result", values: { AC: 60, PY: 55 } },
  ];

  const ALL = "rev,svc,svc-eu,svc-us,goods,cogs,gp";

  /** Renders the hook, records each render's result, and prints the visible ids. */
  function makeProbe(seen: UseStatementResult[]) {
    return function Probe({
      opts,
      model = lines,
    }: {
      opts?: UseStatementOptions;
      model?: StatementLine[];
    }) {
      const result = useStatement(model, opts);
      seen.push(result);
      return <output>{result.rows.map((r) => r.line.id).join(",")}</output>;
    };
  }

  it("toggles a group uncontrolled and reports the next set", () => {
    const seen: UseStatementResult[] = [];
    const Probe = makeProbe(seen);
    const onCollapsedChange = vi.fn();
    const { container } = render(<Probe opts={{ onCollapsedChange }} />);

    expect(container.textContent).toBe(ALL);

    act(() => last(seen).toggle("svc"));
    expect(container.textContent).toBe("rev,svc,goods,cogs,gp");
    expect(last(seen).isCollapsed("svc")).toBe(true);
    // The observer sees the sorted next value even uncontrolled.
    expect(onCollapsedChange).toHaveBeenLastCalledWith(["svc"]);

    act(() => last(seen).toggle("svc"));
    expect(container.textContent).toBe(ALL);
    expect(onCollapsedChange).toHaveBeenLastCalledWith([]);
  });

  it("seeds from defaultCollapsed (then owns it) or from the lines' flags", () => {
    const seen: UseStatementResult[] = [];
    const Probe = makeProbe(seen);
    const { container, rerender } = render(<Probe opts={{ defaultCollapsed: ["rev"] }} />);
    expect(container.textContent).toBe("rev,cogs,gp");

    // A seed, not a controlled value: the hook owns the set from here on, and a
    // later `defaultCollapsed` is ignored.
    act(() => last(seen).toggle("rev"));
    expect(container.textContent).toBe(ALL);
    rerender(<Probe opts={{ defaultCollapsed: ["rev", "svc"] }} />);
    expect(container.textContent).toBe(ALL);

    // Without `defaultCollapsed`, each line's own flag seeds the set.
    const flaggedLines: StatementLine[] = [
      { ...lines[0]!, defaultCollapsed: true },
      ...lines.slice(1),
    ];
    const view = render(<Probe model={flaggedLines} />);
    expect(view.container.textContent).toBe("rev,cogs,gp");
  });

  it("reflects a controlled `collapsed` set and never mutates it", () => {
    const seen: UseStatementResult[] = [];
    const Probe = makeProbe(seen);
    const onCollapsedChange = vi.fn();
    const { container, rerender } = render(
      <Probe opts={{ collapsed: ["svc"], onCollapsedChange }} />,
    );
    expect(container.textContent).toBe("rev,svc,goods,cogs,gp");

    // Reports the next set — and changes nothing until the caller applies it.
    act(() => last(seen).toggle("svc"));
    expect(onCollapsedChange).toHaveBeenLastCalledWith([]);
    expect(container.textContent).toBe("rev,svc,goods,cogs,gp");

    rerender(<Probe opts={{ collapsed: new Set<string>(), onCollapsedChange }} />);
    expect(container.textContent).toBe(ALL);

    // collapseAll goes through the same write path, so it cannot drift either.
    act(() => last(seen).collapseAll());
    expect(onCollapsedChange).toHaveBeenLastCalledWith(["rev", "svc"]);
    expect(container.textContent).toBe(ALL);
  });

  it("exposes the collapsible groups and the all-collapsed / all-expanded state", () => {
    const seen: UseStatementResult[] = [];
    const Probe = makeProbe(seen);
    const { container } = render(<Probe />);

    expect(last(seen).groupIds).toEqual(["rev", "svc"]);
    expect(last(seen).allExpanded).toBe(true);
    expect(last(seen).allCollapsed).toBe(false);

    act(() => last(seen).collapseAll());
    expect(container.textContent).toBe("rev,cogs,gp");
    expect(last(seen).allCollapsed).toBe(true);
    expect(last(seen).allExpanded).toBe(false);
    // The layout is recomputed against the visible rows: Revenue now moves the
    // running total in one step of 100.
    expect(last(seen).domainMax).toBe(100);
    expect(last(seen).domainMin).toBe(0);

    act(() => last(seen).expandAll());
    expect(container.textContent).toBe(ALL);
    expect(last(seen).allExpanded).toBe(true);
  });
});
