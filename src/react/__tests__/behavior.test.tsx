/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";

import { checkIbcs } from "../../core/conformance";
import { ChartState, KpiCard, StatementTable, VarianceColumnChart } from "../index";
import { useAnimatedValue } from "../hooks";

const rulesOf = (findings: ReturnType<typeof checkIbcs>) => findings.map((f) => f.rule);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Install fake timers plus a manually-driven `requestAnimationFrame` queue.
 * Returns a `flushFrame(time)` that runs every frame queued so far, so an
 * animation can be stepped through with exact timestamps and no real waiting.
 */
function installFrameHarness(): (time: number) => void {
  vi.useFakeTimers();
  let frameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  return (time: number) => {
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(time);
  };
}

describe("StatementTable interactions", () => {
  it("collapses and expands child rows", () => {
    render(
      <StatementTable
        lines={[
          {
            id: "revenue",
            label: "Revenue",
            flow: "add",
            values: { AC: 100, PY: 90 },
            children: [
              { id: "services", label: "Service revenue", flow: "add", values: { AC: 60, PY: 50 } },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Service revenue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Service revenue")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Service revenue")).toBeTruthy();
  });
});

describe("chart interactions", () => {
  it("activates selectable chart marks with the keyboard", () => {
    const onSelect = vi.fn();
    render(
      <VarianceColumnChart data={[{ category: "Q1", AC: 120, PY: 100 }]} onSelect={onSelect} />,
    );

    const mark = screen.getByRole("button", { name: /select q1/i });
    fireEvent.keyDown(mark, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ category: "Q1", value: 120 }));

    fireEvent.keyDown(mark, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("shows and hides the built-in tooltip on keyboard focus (WCAG 1.4.13)", () => {
    render(
      <VarianceColumnChart data={[{ category: "Q1", AC: 120, PY: 100 }]} onSelect={() => {}} />,
    );

    // Focusing a selectable mark must surface the same content hover shows,
    // anchored to the mark (there is no pointer to follow).
    const mark = screen.getByRole("button", { name: /select q1/i });
    fireEvent.focus(mark);
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.blur(mark);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("moves the built-in tooltip without requiring a new hover target", async () => {
    render(<VarianceColumnChart data={[{ category: "Q1", AC: 120, PY: 100 }]} />);

    const hitTarget = document.querySelector("svg rect[fill='transparent']");
    expect(hitTarget).toBeTruthy();

    fireEvent.pointerMove(hitTarget!, { clientX: 10, clientY: 20, pointerType: "mouse" });
    expect((await screen.findByRole("tooltip")).style.transform).toBe("translate3d(26px, 36px, 0)");

    fireEvent.pointerMove(hitTarget!, { clientX: 40, clientY: 50, pointerType: "mouse" });
    await waitFor(() => {
      expect(screen.getByRole("tooltip").style.transform).toBe("translate3d(56px, 66px, 0)");
    });
  });
});

describe("useAnimatedValue", () => {
  it("retargets from the current displayed value mid-animation", () => {
    vi.useFakeTimers();
    let rafId = 0;
    const rafs = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = ++rafId;
      rafs.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafs.delete(id);
    });

    const flushFrame = (time: number) => {
      const pending = [...rafs.values()];
      rafs.clear();
      for (const cb of pending) cb(time);
    };

    function Probe({ target }: { target: number }) {
      const value = useAnimatedValue(target, { duration: 1000, easing: (t) => t });
      useEffect(() => {}, [value]);
      return <output>{Math.round(value)}</output>;
    }

    const { rerender } = render(<Probe target={0} />);
    rerender(<Probe target={100} />);

    act(() => {
      vi.runOnlyPendingTimers();
      flushFrame(100);
      flushFrame(600);
    });
    expect(screen.getByText("50")).toBeTruthy();

    rerender(<Probe target={200} />);
    act(() => {
      vi.runOnlyPendingTimers();
      flushFrame(600);
    });

    expect(screen.getByText("50")).toBeTruthy();
  });
});

describe("KpiCard", () => {
  it("does zero animation work when animate is false", () => {
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);

    render(<KpiCard label="Revenue" values={{ AC: 30_100_000, PY: 28_000_000 }} animate={false} />);

    // No frame loop at all, and the final figure is on screen immediately.
    expect(raf).not.toHaveBeenCalled();
    expect(screen.getByText("30.1M")).toBeTruthy();
  });

  it("counts the headline up from zero on mount when animate is on", () => {
    const flushFrame = installFrameHarness();

    render(<KpiCard label="Revenue" values={{ AC: 100 }} animate />);

    // The entrance starts at 0 (committed before paint by the layout effect).
    expect(screen.getByText("0")).toBeTruthy();

    act(() => {
      vi.runOnlyPendingTimers();
      flushFrame(100);
      flushFrame(800);
    });
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("skips the count-up under prefers-reduced-motion — even with animate on (the default)", () => {
    // Consumer report D5.1 assumed the default count-up ignores the OS motion
    // preference. It never did — `useAnimatedValue` collapses to the target
    // when the media query matches — but nothing pinned that down. This does:
    // reduced motion + `animate` → final figure immediately, zero frames.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);

    render(<KpiCard label="Revenue" values={{ AC: 30_100_000, PY: 28_000_000 }} animate />);

    expect(raf).not.toHaveBeenCalled();
    expect(screen.getByText("30.1M")).toBeTruthy();
  });

  it("states the format's unit once, on either side of the headline", () => {
    render(
      <>
        <KpiCard
          label="Revenue"
          values={{ AC: 30_100_000, PY: 25_600_000 }}
          format={{ compact: true, decimals: 1, currency: "€" }}
          animate={false}
        />
        <KpiCard
          label="EBIT margin"
          values={{ AC: 18.4 }}
          format={{ compact: false, decimals: 1, suffix: "%" }}
          animate={false}
        />
      </>,
    );

    // The affix is a separate muted span, so the headline's own text is the
    // bare number — but it reads as one figure.
    expect(screen.getByText("30.1M")).toBeTruthy();
    expect(document.body.textContent).toContain("€30.1M");
    expect(document.body.textContent).toContain("18.4%");
    // The symbol is stated once: never doubled onto the number itself, and not
    // repeated on the delta beside it.
    expect(document.body.textContent).not.toContain("€€");
    expect(screen.getByText("+4.5M")).toBeTruthy();
  });
});

describe("ChartState", () => {
  it("announces an error as an alert and a placeholder as a status", () => {
    const { rerender } = render(
      <ChartState error={new Error("boom")}>
        <div>content</div>
      </ChartState>,
    );

    // An error replaces the content — assertive, not a polite status update.
    expect(screen.getByRole("alert").textContent).toContain("boom");
    expect(screen.queryByRole("status")).toBeNull();

    rerender(
      <ChartState empty>
        <div>content</div>
      </ChartState>,
    );
    expect(screen.getByRole("status").textContent).toContain("No data");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("marks the loading placeholder busy", () => {
    render(
      <ChartState loading>
        <div>content</div>
      </ChartState>,
    );
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
  });
});

describe("checkIbcs report table blocks", () => {
  it("accepts table blocks as valid report blocks", () => {
    const findings = checkIbcs({
      blocks: [
        {
          type: "table",
          config: {
            columns: [{ key: "revenue", label: "Revenue" }],
            rows: [{ id: "emea", label: "EMEA", values: { revenue: { AC: 120, PY: 100 } } }],
          },
        },
      ],
    });

    expect(rulesOf(findings)).not.toContain("block-type");
    expect(rulesOf(findings)).not.toContain("data-present");
  });
});
