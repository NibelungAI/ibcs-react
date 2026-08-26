import { forwardRef, useLayoutEffect, useRef, type ForwardedRef } from "react";
import { createPortal } from "react-dom";
import type { IbcsTokensOverride } from "../core/tokens";
import { useIbcsTokens } from "./theme";
import { applyTooltipPosition, TOOLTIP_OFFSET } from "./internal/tooltipPosition";

/** Attach a node to both the local ref and a forwarded one. */
function assignRefs(
  node: HTMLDivElement | null,
  local: { current: HTMLDivElement | null },
  forwarded: ForwardedRef<HTMLDivElement>,
): void {
  local.current = node;
  if (typeof forwarded === "function") forwarded(node);
  else if (forwarded) forwarded.current = node;
}

/** One label / value line inside a {@link ChartTooltip}. */
export interface ChartTooltipRow {
  /** Left-hand caption (muted), e.g. "AC", "ΔPY". */
  label: string;
  /** Right-hand value, pre-formatted, e.g. "30.1M", "+1.1M". */
  value: string;
  /**
   * Value color — pass an impact color (`tokens.color.good` / `.bad`) for a
   * signed delta. Defaults to the theme's `color.surface` (white on the default
   * theme's dark panel; the pair inverts with the theme).
   */
  color?: string;
  /** Render the value in bold (e.g. the headline AC row). */
  strong?: boolean;
}

export interface ChartTooltipProps {
  /** Pointer x in viewport coordinates (the panel sits at `x + 16`). */
  x: number;
  /** Pointer y in viewport coordinates (the panel sits at `y + 16`). */
  y: number;
  /** Bold heading — usually the hovered category. */
  title: string;
  /** Body rows, label + value. */
  rows: ChartTooltipRow[];
  /**
   * Deep-partial token override, merged onto the enclosing
   * {@link IbcsThemeProvider}'s theme (or the defaults) — same contract as
   * every other component's `tokens` prop. The panel is `color.text` filled,
   * inked with `color.surface`.
   */
  tokens?: IbcsTokensOverride;
}

/**
 * A reusable floating tooltip for charts — the same dark, white-on-`text`
 * panel `StatementTable` shows on row hover, generalized to any title + rows.
 * `position: fixed` at the pointer (`x + 16`, `y + 16`), flipped to the other
 * side of the pointer at the right/bottom viewport edges, `pointerEvents:
 * none` so it never steals the hover, a high `zIndex`, and tabular figures.
 *
 * On the client the panel renders into a `document.body` portal, so ancestors
 * with `transform`/`filter`/`overflow` (dashboard shells, `ChartBox`) can
 * neither re-anchor nor clip it.
 *
 * Render it only when something is hovered (it draws unconditionally), so on
 * the server / at rest nothing is emitted. SSR-safe — without a DOM it renders
 * inline with no portal and no measuring; the `color.surface` ink on the
 * `tokens.color.text` panel matches the table tooltip's contrast, and inverts
 * with the theme.
 *
 * ```tsx
 * const hover = useChartHover<MyDatum>();
 * {hover.hovered && (
 *   <ChartTooltip
 *     x={hover.hovered.x}
 *     y={hover.hovered.y}
 *     title={hover.hovered.category}
 *     rows={[{ label: "AC", value: "30.1M", strong: true }]}
 *   />
 * )}
 * ```
 */
export const ChartTooltip = forwardRef<HTMLDivElement, ChartTooltipProps>(function ChartTooltip(
  { x, y, title, rows, tokens: tokenOverride },
  ref,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const localRef = useRef<HTMLDivElement | null>(null);

  // First-paint placement: the render-time transform assumes no edge overflow;
  // once the panel exists (and its size is known) clamp/flip it before paint.
  // Subsequent pointer moves go through useChartHover's rAF, which applies the
  // same shared placement imperatively.
  useLayoutEffect(() => {
    if (localRef.current) applyTooltipPosition(localRef.current, x, y);
  }, [x, y]);

  const panel = (
    <div
      ref={(node) => assignRefs(node, localRef, ref)}
      role="tooltip"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate3d(${x + TOOLTIP_OFFSET}px, ${y + TOOLTIP_OFFSET}px, 0)`,
        zIndex: 1000,
        pointerEvents: "none",
        background: tokens.color.text,
        color: tokens.color.surface,
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 12,
        lineHeight: 1.5,
        minWidth: 160,
        boxShadow: "0 6px 24px rgba(0,0,0,0.22)",
        fontVariantNumeric: "tabular-nums",
        fontFamily: tokens.font.family,
        willChange: "transform",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: rows.length ? 6 : 0 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
          <span style={{ color: tokens.color.surface, opacity: 0.7 }}>{r.label}</span>
          <span
            style={{ fontWeight: r.strong ? 700 : 500, color: r.color ?? tokens.color.surface }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );

  // Client: escape transformed/clipping ancestors via a body portal. Server:
  // no DOM — render inline (hover state never exists there anyway).
  return typeof document !== "undefined" ? createPortal(panel, document.body) : panel;
});
