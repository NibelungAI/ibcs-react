import type React from "react";
import { useIbcsTokens } from "./theme";

/** What the placeholder should resemble while data loads. */
export type SkeletonVariant = "chart" | "table" | "card" | "block";

export interface SkeletonProps {
  /** Shape of the placeholder. Default "chart". */
  variant?: SkeletonVariant;
  /** Width - a px number or any CSS width. Default "100%". */
  width?: number | string;
  /** Height in px. Default depends on the variant. */
  height?: number;
  /** Rows for the "table" variant. Default 6. */
  rows?: number;
  /** Bars for the "chart" variant. Default 9. */
  bars?: number;
  /** Placeholder ink. Defaults to the theme's `color.surfaceMuted`. */
  color?: string;
  /** Accessible label announced to screen readers. Default "Loading…". */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_H: Record<SkeletonVariant, number> = {
  chart: 240,
  table: 220,
  card: 120,
  block: 160,
};
// A deterministic, pleasant set of bar heights (0..1) - no Math.random (SSR-safe
// and stable between server and client renders).
const HEIGHTS = [0.55, 0.8, 0.42, 0.95, 0.6, 0.72, 0.5, 0.88, 0.66, 0.78, 0.46, 0.7];

/**
 * A lightweight loading placeholder that resembles a chart, table or card while
 * its data loads. Drawn as a single self-animating SVG (a gentle opacity pulse
 * via SMIL) - zero-dependency, SSR-safe, and no global CSS. Size it to match the
 * component it stands in for.
 */
export function Skeleton({
  variant = "chart",
  width = "100%",
  height,
  rows = 6,
  bars = 9,
  color,
  label = "Loading…",
  className,
  style,
}: SkeletonProps): React.ReactElement {
  const tokens = useIbcsTokens();
  const ink = color ?? tokens.color.surfaceMuted;
  const H = height ?? DEFAULT_H[variant];
  // Logical coordinate width; the SVG scales to the real width via the viewBox.
  const W = 600;
  const pulse = (i: number) => (
    <animate
      attributeName="opacity"
      values="0.45;0.9;0.45"
      dur="1.4s"
      begin={`${(i % 8) * 0.12}s`}
      repeatCount="indefinite"
    />
  );

  let shapes: React.ReactNode;
  if (variant === "table") {
    const rowH = H / rows;
    const barH = Math.min(rowH * 0.5, 12);
    shapes = Array.from({ length: rows }, (_, r) => {
      const y = r * rowH + (rowH - barH) / 2;
      return (
        <g key={r}>
          <rect x={0} y={y} width={150} height={barH} rx={3} fill={ink}>
            {pulse(r)}
          </rect>
          {[0.62, 0.62, 0.62].map((_, c) => (
            <rect key={c} x={250 + c * 120} y={y} width={84} height={barH} rx={3} fill={ink}>
              {pulse(r + c)}
            </rect>
          ))}
        </g>
      );
    });
  } else if (variant === "card") {
    shapes = (
      <g>
        <rect x={0} y={10} width={120} height={12} rx={3} fill={ink}>
          {pulse(0)}
        </rect>
        <rect x={0} y={36} width={180} height={26} rx={4} fill={ink}>
          {pulse(1)}
        </rect>
        <rect x={0} y={H - 34} width={W} height={22} rx={4} fill={ink}>
          {pulse(2)}
        </rect>
      </g>
    );
  } else if (variant === "block") {
    shapes = (
      <rect x={0} y={0} width={W} height={H} rx={6} fill={ink}>
        {pulse(0)}
      </rect>
    );
  } else {
    // chart: a baseline with placeholder columns of varied height.
    const n = Math.max(1, bars);
    const step = W / n;
    const barW = step * 0.5;
    shapes = (
      <g>
        {Array.from({ length: n }, (_, i) => {
          // The modulo keeps the index in range; the fallback is unreachable.
          const bh = (H - 24) * (HEIGHTS[i % HEIGHTS.length] ?? 0.6);
          const x = i * step + (step - barW) / 2;
          return (
            <rect key={i} x={x} y={H - 16 - bh} width={barW} height={bh} rx={2} fill={ink}>
              {pulse(i)}
            </rect>
          );
        })}
        <rect x={0} y={H - 16} width={W} height={2} fill={ink} opacity={0.7} />
      </g>
    );
  }

  return (
    <div
      className={className}
      role="status"
      aria-busy="true"
      aria-label={label}
      style={{ width, ...style }}
    >
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        {shapes}
      </svg>
    </div>
  );
}
