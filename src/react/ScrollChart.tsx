import type React from "react";
import { ChartBox, type ChartChildren } from "./ChartBox";

export interface ScrollChartProps {
  /** Fixed height; the width fills the container and scrolls below `minWidth`. */
  height?: number;
  /** Fixed width; the height fills up to `maxHeight` and scrolls below `minHeight`. */
  width?: number;
  /** Minimum width before horizontal scroll engages (with `height`). */
  minWidth?: number;
  /** Minimum height before vertical scroll engages (with `width`). */
  minHeight?: number;
  /** Viewport height cap for the vertical-scroll mode (with `width`). */
  maxHeight?: number;
  className?: string;
  style?: React.CSSProperties;
  /** The chart: a single element (sized automatically) or a render-prop. */
  children: ChartChildren;
}

/**
 * Fill one dimension, scroll the other — a thin preset of {@link ChartBox}.
 * `height` set → `fit="scale"` (fill width, scroll below `minWidth`); `width`
 * set → `fit="fixed"` with a `maxHeight` viewport (scroll vertically). For full
 * control over fit / align / padding use `ChartBox` directly.
 *
 * @example
 * ```tsx
 * <ScrollChart height={300} minWidth={680}>
 *   <TrendChart data={data} />
 * </ScrollChart>
 * ```
 */
export function ScrollChart({
  height,
  width,
  minWidth,
  minHeight,
  maxHeight,
  className,
  style,
  children,
}: ScrollChartProps): React.ReactElement {
  if (height != null) {
    return (
      <ChartBox
        width={minWidth ?? height * 2}
        height={height}
        fit="scale"
        minWidth={minWidth}
        className={className}
        style={style}
      >
        {children}
      </ChartBox>
    );
  }
  return (
    <ChartBox
      width={width ?? 600}
      height={minHeight ?? maxHeight ?? 400}
      fit="fixed"
      maxHeight={maxHeight}
      className={className}
      style={style}
    >
      {children}
    </ChartBox>
  );
}
