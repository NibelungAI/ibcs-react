import type React from "react";
import { renderChartChild, type ChartChildren } from "./ChartBox";
import { useElementSize } from "./hooks/useElementSize";

/** How the chart fills its frame. `fill` stretches to the box; `contain` keeps
 *  the chart's aspect ratio and letterboxes the remainder.
 *
 * @deprecated Use `ChartBox`'s `fit` union instead - it covers both of these
 * modes (`"fill"` / `"contain"`) plus `"scale"` and `"fixed"`.
 */
export type ChartFitMode = "fill" | "contain";

/**
 * @deprecated Use `ChartBoxProps`. `ChartBox` takes the same `width`/`height`,
 * `align`/`verticalAlign`, `padding` and `background`, and its `fit` union is a
 * superset of {@link ChartFitMode}.
 */
export interface ChartFrameProps {
  /** Box width in px. Omit to fill and measure the parent (responsive). */
  width?: number;
  /** Box height in px. Omit to fill and measure the parent (needs a sized parent). */
  height?: number;
  /** `fill` (default) stretches the chart to the box; `contain` keeps `aspect`. */
  fit?: ChartFitMode;
  /** Chart width-to-height ratio used by `contain`. Defaults to the box aspect. */
  aspect?: number;
  /** Horizontal placement when the chart is narrower than the box. Default center. */
  align?: "left" | "center" | "right";
  /** Vertical placement when the chart is shorter than the box. Default middle. */
  verticalAlign?: "top" | "middle" | "bottom";
  /** Inset around the chart, like CSS padding on a framed image. */
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  /** Optional frame background (e.g. to letterbox `contain` on a tint). */
  background?: string;
  className?: string;
  style?: React.CSSProperties;
  /** The chart: a single element (sized automatically) or a render-prop. */
  children: ChartChildren;
}

const AX = { left: 0, center: 0.5, right: 1 } as const;
const AY = { top: 0, middle: 0.5, bottom: 1 } as const;

function sides(p: ChartFrameProps["padding"]) {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return { top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0 };
}

/**
 * Place a chart inside a box with image-style **fit, alignment and padding** -
 * the same controls you reach for when fitting a picture into a frame.
 *
 * - `fit="fill"` (default) draws the chart at the full inner box; `fit="contain"`
 *   keeps `aspect` (or the box's own ratio) and letterboxes the spare space.
 * - `align` / `verticalAlign` position the chart within that spare space (the
 *   nine-point grid: left/center/right × top/middle/bottom).
 * - `padding` insets the chart from the box edges.
 * - Give `width`/`height` for a fixed box, or omit them to measure the parent
 *   and fill it responsively (SSR-safe: nothing is drawn until measured).
 *
 * Unlike scaling an image, the chart is re-rendered at the resolved pixel size,
 * so text and strokes stay crisp at any fit. Zero-dependency.
 *
 * @deprecated Use `ChartBox` - its `fit` union covers both of this component's
 * modes and adds `"scale"` / `"fixed"`, with the same `align` / `verticalAlign`,
 * `padding` and `background` controls. `ChartFrame` stays exported (it is not
 * going anywhere in this release line) but new code should reach for `ChartBox`:
 *
 * ```tsx
 * // before
 * <ChartFrame width={480} height={260} fit="contain" align="left" padding={12}>
 * // after
 * <ChartBox width={480} height={260} fit="contain" align="left" padding={12}>
 * ```
 *
 * @example
 * ```tsx
 * <ChartFrame width={480} height={260} fit="contain" align="left" padding={12}>
 *   {(w, h) => <TrendChart width={w} height={h} data={data} />}
 * </ChartFrame>
 * ```
 */
export function ChartFrame({
  width,
  height,
  fit = "fill",
  aspect,
  align = "center",
  verticalAlign = "middle",
  padding,
  background,
  className,
  style,
  children,
}: ChartFrameProps): React.ReactElement {
  const [ref, measured] = useElementSize<HTMLDivElement>();

  const boxW = width ?? measured.width;
  const boxH = height ?? measured.height;
  const pad = sides(padding);

  const innerW = Math.max(0, boxW - pad.left - pad.right);
  const innerH = Math.max(0, boxH - pad.top - pad.bottom);

  let drawW = innerW;
  let drawH = innerH;
  if (fit === "contain" && innerW > 0 && innerH > 0) {
    const a = aspect && aspect > 0 ? aspect : innerW / innerH;
    if (innerW / innerH > a) {
      drawH = innerH;
      drawW = innerH * a;
    } else {
      drawW = innerW;
      drawH = innerW / a;
    }
  }

  const left = pad.left + (innerW - drawW) * AX[align];
  const top = pad.top + (innerH - drawH) * AY[verticalAlign];

  const w = Math.round(drawW);
  const h = Math.round(drawH);
  const ready = w > 0 && h > 0;

  const outer: React.CSSProperties = {
    position: "relative",
    width: width ?? "100%",
    height: height ?? "100%",
    background,
    ...style,
  };

  return (
    <div ref={ref} className={className} style={outer}>
      {ready && (
        <div
          style={{
            position: "absolute",
            left: Math.round(left),
            top: Math.round(top),
            width: w,
            height: h,
          }}
        >
          {renderChartChild(children, w, h)}
        </div>
      )}
    </div>
  );
}
