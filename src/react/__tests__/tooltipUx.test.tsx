// @vitest-environment jsdom
/**
 * Tooltip UX contract (Wave B):
 *  - the tooltip fires only near a visible mark, not over blank hit-band space
 *  - when the svg cannot be measured (jsdom default), gating disables itself
 *  - Escape dismisses without moving pointer or focus (WCAG 1.4.13)
 *  - a touch tap shows a mark-anchored tooltip; tapping elsewhere dismisses
 *  - tooltip values are exact (compact: false), never an echo of the printed
 *    compact labels
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VarianceColumnChart } from "../VarianceColumnChart";

afterEach(cleanup);

const DATA = [{ category: "Q1", AC: 120, PY: 100 }];

/** Stamp a real layout box onto the svg so client→SVG mapping engages. */
function measureSvg(container: HTMLElement, width: number, height: number): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no svg rendered");
  svg.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      x: 0,
      y: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
  return svg;
}

/** The transparent full-band hit rect (events bubble from it to the mark <g>). */
function hitTarget(container: HTMLElement): Element {
  const rect = container.querySelector("svg rect[fill='transparent']");
  if (!rect) throw new Error("no hit target rendered");
  return rect;
}

/** Center x of the solid AC column (default tokens fill #54534e). */
function acCenterX(container: HTMLElement): number {
  const ac = [...container.querySelectorAll("rect")].find(
    (r) => r.getAttribute("fill") === "#54534e",
  );
  if (!ac) throw new Error("no AC column rendered");
  return Number(ac.getAttribute("x")) + Number(ac.getAttribute("width")) / 2;
}

describe("tooltip proximity gating", () => {
  // Geometry for width=400 height=260, no title, variance="abs" (default):
  // padT=14, zeroY=144, AC(120) top y=28, PY(100) top y≈47, variance lane
  // y≈158..225. Tolerance is 8px at 1:1 scale.
  it("shows near the marks, hides over blank band space", () => {
    const { container } = render(<VarianceColumnChart data={DATA} width={400} height={260} />);
    measureSvg(container, 400, 260);
    const target = hitTarget(container);
    const cx = acCenterX(container);

    // On the AC column.
    fireEvent.pointerMove(target, { clientX: cx, clientY: 100, pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    // Same band, blank space above the columns.
    fireEvent.pointerMove(target, { clientX: cx, clientY: 12, pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    // The variance-panel mark is a real mark too.
    fireEvent.pointerMove(target, { clientX: cx, clientY: 191, pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    // Far off to the side (outside every mark's x range).
    fireEvent.pointerMove(target, { clientX: cx - 150, clientY: 100, pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays permissive when the svg has no measurable layout box", () => {
    const { container } = render(<VarianceColumnChart data={DATA} width={400} height={260} />);
    // No measureSvg: jsdom's zero-size rect must disable gating, not hovering.
    fireEvent.pointerMove(hitTarget(container), {
      clientX: 10,
      clientY: 10,
      pointerType: "mouse",
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});

describe("tooltip dismissal (WCAG 1.4.13)", () => {
  it("Escape dismisses and hovering again re-shows", () => {
    const { container } = render(<VarianceColumnChart data={DATA} />);
    const target = hitTarget(container);

    fireEvent.pointerMove(target, { clientX: 10, clientY: 20, pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerMove(target, { clientX: 12, clientY: 22, pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});

describe("touch support", () => {
  it("tap shows a sticky tooltip; tapping elsewhere dismisses; mouse clicks don't", () => {
    const { container } = render(<VarianceColumnChart data={DATA} width={400} height={260} />);
    measureSvg(container, 400, 260);
    const target = hitTarget(container);

    fireEvent.pointerDown(target, { clientX: 5, clientY: 5, pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    // The tap's implicit pointer-leave must not dismiss it…
    fireEvent.pointerLeave(target, { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    // …nor a mouse press elsewhere (mouse dismisses by moving away)…
    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeTruthy();

    // …but a tap elsewhere does.
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("tooltip content precision", () => {
  it("prints exact values while the chart labels stay compact", () => {
    const { container } = render(
      <VarianceColumnChart data={[{ category: "Q1", AC: 1_234_567, PY: 1_000_000 }]} />,
    );

    // The printed value label is compact…
    expect(container.querySelector("svg")!.textContent).toContain("1.2M");

    fireEvent.pointerMove(hitTarget(container), {
      clientX: 10,
      clientY: 20,
      pointerType: "mouse",
    });
    const tip = screen.getByRole("tooltip");
    // …while the tooltip carries the full figures and the Δ with percent.
    expect(tip.textContent).toContain("1,234,567");
    expect(tip.textContent).toContain("1,000,000");
    expect(tip.textContent).toContain("+234,567");
    expect(tip.textContent).toContain("(+23.5%)");
  });
});
