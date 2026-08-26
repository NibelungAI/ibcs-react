import { forwardRef, type CSSProperties } from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import { useIbcsTokens } from "./theme";

export interface VarianceBarProps {
  /** Signed delta in value units. */
  value: number;
  /** Domain max (largest |delta| in the column) for consistent scaling. */
  max: number;
  /** Whether this delta is good for the business. */
  favorable: boolean;
  width?: number;
  height?: number;
  /** Filled "bar" (default) or "pin" (line + dot), matching the table's mark. */
  mark?: "bar" | "pin";
  /** Token override merged over the nearest {@link IbcsThemeProvider} theme. */
  tokens?: IbcsTokensOverride;
  /** Class applied to the root `<svg>`. */
  className?: string;
  /** Styles merged *over* the mark's own layout styles. */
  style?: CSSProperties;
}

/**
 * A pin/needle bar growing from a centre baseline: right when positive, left
 * when negative, colored by favorability — not by sign. This is the single
 * most important IBCS habit: "+376K" on a cost line is red because more cost
 * is bad, even though the number is positive.
 *
 * **Accessibility:** this is a decorative-by-design embedded mark — it always
 * sits beside the signed number it visualises (a table cell, a KPI line), so
 * it carries `aria-hidden="true"` and NO `role`. Announcing it would make a
 * screen reader read the same delta twice; the visible value is the a11y
 * contract. (Standalone charts do the opposite: `role="img"` + a label.)
 */
export const VarianceBar = forwardRef<SVGSVGElement, VarianceBarProps>(function VarianceBar(
  {
    value,
    max,
    favorable,
    width = 64,
    height = 14,
    mark = "bar",
    tokens: tokenOverride,
    className,
    style,
  },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const mid = width / 2;
  const cy = height / 2;
  const safeMax = max || 1;
  const half = (Math.abs(value) / safeMax) * (width / 2);
  const color = value === 0 ? tokens.color.zero : favorable ? tokens.color.good : tokens.color.bad;
  const end = value >= 0 ? mid + half : mid - half;

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className={className}
      style={{ display: "block", ...style }}
      aria-hidden="true"
    >
      <line x1={mid} y1={0} x2={mid} y2={height} stroke={tokens.color.axis} strokeWidth={0.5} />
      {mark === "pin" ? (
        <>
          <line x1={mid} y1={cy} x2={end} y2={cy} stroke={color} strokeWidth={2} />
          {value !== 0 && <circle cx={end} cy={cy} r={3} fill={color} />}
        </>
      ) : (
        (() => {
          const barH = Math.round(height * 0.7);
          const x = value >= 0 ? mid : mid - half;
          return (
            <rect
              x={x}
              y={(height - barH) / 2}
              width={Math.max(half, value === 0 ? 0 : 1)}
              height={barH}
              fill={color}
            />
          );
        })()
      )}
    </svg>
  );
});
