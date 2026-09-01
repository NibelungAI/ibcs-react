import type React from "react";
import { cloneElement } from "react";
import { useElementSize } from "./hooks/useElementSize";

/**
 * What the sizing wrappers accept as their child: a render-prop called with
 * the resolved integer px size, or - the common case - a SINGLE chart element
 * that gets `width`/`height` cloned onto it:
 *
 * ```tsx
 * <ChartBox width={620} height={340}>
 *   <VarianceColumnChart data={data} />
 * </ChartBox>
 * ```
 *
 * The render-prop form remains for charts whose size props are named
 * differently or that need the numbers for something else.
 */
export type ChartChildren =
  | ((width: number, height: number) => React.ReactNode)
  | React.ReactElement<{ width?: number; height?: number }>;

/** Resolve {@link ChartChildren} at a size: call the render-prop, or clone the element. */
export function renderChartChild(
  children: ChartChildren,
  width: number,
  height: number,
): React.ReactNode {
  return typeof children === "function"
    ? children(width, height)
    : cloneElement(children, { width, height });
}

/**
 * How a chart maps to the space it's given - the chart equivalent of an
 * `<img>`'s `object-fit`:
 *
 * - `"scale"` (default): fill the available width keeping the chart's aspect
 *   ratio (`width / height`). It scales with the container but never below
 *   `minWidth` - past that it scrolls. The everyday responsive choice.
 * - `"fixed"`: always the intrinsic `width × height`. If the container is
 *   smaller it scrolls. "A set size, everything scrolls around it."
 * - `"contain"`: scale to fit BOTH dimensions of the box keeping aspect, then
 *   letterbox + `align` the spare space. Needs a bounded height (`maxHeight`).
 * - `"fill"`: stretch to the box - width fills, height = `maxHeight` (or the
 *   intrinsic height).
 */
export type ChartFit = "scale" | "fixed" | "contain" | "fill";

export interface ChartBoxProps {
  /** The chart's intrinsic width - its design size and aspect numerator. */
  width: number;
  /** The chart's intrinsic height - its design size and aspect denominator. */
  height: number;
  /** Fit mode (see {@link ChartFit}). Default `"scale"`. */
  fit?: ChartFit;
  /** Floor for `"scale"`: the width stops shrinking here and scrolls instead. */
  minWidth?: number;
  /** Cap the drawn width (`"scale"`/`"fill"`) so it doesn't grow past this. */
  maxWidth?: number;
  /** Cap the drawn / box height. */
  maxHeight?: number;
  /** Horizontal placement of any spare space. Default center. */
  align?: "left" | "center" | "right";
  /** Vertical placement of any spare space. Default middle. */
  verticalAlign?: "top" | "middle" | "bottom";
  /** Scroll when the chart overflows the box. `"auto"` (default) or `"none"`. */
  scroll?: "auto" | "none";
  /** Inset around the chart, like padding on a framed image. */
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  /** Box background (e.g. to tint the letterbox of `contain`). */
  background?: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * The chart to size: a single element (given `width`/`height` automatically)
   * or a render-prop `(w, h) => …` - see {@link ChartChildren}.
   */
  children: ChartChildren;
}

const JX = { left: "flex-start", center: "center", right: "flex-end" } as const;
const JY = { top: "flex-start", middle: "center", bottom: "flex-end" } as const;

function sides(p: ChartBoxProps["padding"]) {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
}

/**
 * One sizing primitive for every chart - fit, alignment, scroll and padding,
 * the way you'd size an image. Unlike scaling a bitmap, the chart re-renders at
 * the resolved pixel size, so text and strokes stay crisp at any fit.
 *
 * `ResponsiveChart`, `ChartFrame` and `ScrollChart` are thin presets of this.
 *
 * @example
 * ```tsx
 * // Scale with the space, but hold a readable 680px and scroll on a phone.
 * <ChartBox width={760} height={300} fit="scale" minWidth={680}>
 *   <TrendChart data={data} />
 * </ChartBox>
 *
 * // Render-prop form, when the numbers are needed directly:
 * <ChartBox width={760} height={300}>
 *   {(w, h) => <TrendChart width={w} height={h} data={data} />}
 * </ChartBox>
 * ```
 */
export function ChartBox({
  width,
  height,
  fit = "scale",
  minWidth,
  maxWidth,
  maxHeight,
  align = "center",
  verticalAlign = "middle",
  scroll = "auto",
  padding,
  background,
  className,
  style,
  children,
}: ChartBoxProps): React.ReactElement {
  const [ref, measured] = useElementSize<HTMLDivElement>();
  const aspect = height > 0 ? width / height : 1;
  const pad = sides(padding);
  const availW = Math.max(0, measured.width - pad.left - pad.right);

  const clampW = (w: number) => {
    let r = w;
    if (minWidth != null) r = Math.max(r, minWidth);
    if (maxWidth != null) r = Math.min(r, maxWidth);
    return r;
  };

  // Resolve the drawn chart size + the inner box height for this fit mode.
  let drawW: number;
  let drawH: number;
  let boxH: number;

  if (fit === "fixed") {
    drawW = width;
    drawH = height;
    boxH = maxHeight != null ? Math.min(height, maxHeight) : height;
  } else if (fit === "fill") {
    drawW = clampW(availW);
    drawH = maxHeight ?? height;
    boxH = drawH;
  } else if (fit === "contain") {
    boxH = maxHeight ?? (availW > 0 ? availW / aspect : height);
    if (availW / Math.max(boxH, 1) > aspect) {
      drawH = boxH;
      drawW = boxH * aspect;
    } else {
      drawW = availW;
      drawH = availW / aspect;
    }
  } else {
    // "scale": fill the width, keep the intrinsic HEIGHT (a wider container makes
    // a wider chart, not a taller one - what a time series wants). Floor the
    // width at minWidth (then it scrolls). maxHeight can shrink the height.
    drawW = clampW(availW);
    drawH = maxHeight != null ? Math.min(height, maxHeight) : height;
    boxH = drawH;
  }

  const w = Math.round(drawW);
  const h = Math.round(drawH);
  const ready = w > 0 && h > 0;

  const overflowX = scroll !== "none" && drawW > availW + 0.5;
  const overflowY = scroll !== "none" && drawH > boxH + 0.5;

  const outer: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: Math.round(boxH) + pad.top + pad.bottom || undefined,
    background,
    display: "flex",
    // When the chart overflows, start at the edge so the scroll reveals it all;
    // otherwise honour the requested alignment of the spare space.
    justifyContent: overflowX ? "flex-start" : JX[align],
    alignItems: overflowY ? "flex-start" : JY[verticalAlign],
    paddingTop: pad.top,
    paddingRight: pad.right,
    paddingBottom: pad.bottom,
    paddingLeft: pad.left,
    boxSizing: "border-box",
    overflowX: overflowX ? "auto" : undefined,
    overflowY: overflowY ? "auto" : undefined,
    ...style,
  };

  return (
    <div ref={ref} className={className} style={outer}>
      {ready && (
        <div style={{ flex: "0 0 auto", width: w, height: h }}>
          {renderChartChild(children, w, h)}
        </div>
      )}
    </div>
  );
}
