import type React from "react";
import type { IbcsTokens } from "../core/tokens";

/* ------------------------------------------------------------------ *
 * Shared "card surface" appearance — one flexible API for every
 * container-like component (KPI cards today; report blocks etc. later)
 * so callers control border, background, corner rounding, the left
 * accent bar and shadow, instead of being forced into one look. Nothing
 * is rounded heavily or bordered by default unless asked.
 * ------------------------------------------------------------------ */

export interface CardAppearance {
  /** Corner radius in px. Default 8. Set `0` for square corners. */
  radius?: number;
  /** Background colour. Defaults to the theme's `color.surface` ("#fff"). */
  background?: string;
  /**
   * Full border: `true` uses the theme's `rowBorder`, a string sets a custom
   * colour, `false`/omitted draws no full border. Helps when a white card sits
   * on a white page.
   */
  border?: boolean | string;
  /** Border width in px when `border` is on. Default 1. */
  borderWidth?: number;
  /**
   * Left favorability accent bar. `false` (default) draws none — a calm, neutral
   * card. `true` draws a 3px bar in the status colour; a number sets its width in
   * px. (Off by default: a coloured corner bar reads as a dashboard-template
   * cliché; the variance text already carries the favorability colour.)
   */
  accent?: boolean | number;
  /** Lift the card off the background with a soft drop shadow. Default false. */
  shadow?: boolean;
  /** Padding — a px number or any CSS padding string. Default "15px 17px". */
  padding?: number | string;
}

/**
 * Resolve a {@link CardAppearance} into inline styles. `accentColor` is the
 * component's status/favorability colour for the left bar.
 */
export function cardSurface(
  appearance: CardAppearance | undefined,
  tokens: IbcsTokens,
  accentColor: string,
): React.CSSProperties {
  const a = appearance ?? {};
  const accent = a.accent ?? false;
  const accentW = typeof accent === "number" ? accent : accent ? 3 : 0;
  // Default to a subtle theme border so a white card reads against a white page;
  // `border: false` removes it, a string sets a custom colour.
  const borderColor =
    a.border === false ? null : typeof a.border === "string" ? a.border : tokens.color.rowBorder;
  const bw = a.borderWidth ?? 1;
  return {
    background: a.background ?? tokens.color.surface,
    borderRadius: a.radius ?? 8,
    padding: a.padding ?? "15px 17px",
    boxSizing: "border-box",
    ...(borderColor ? { border: `${bw}px solid ${borderColor}` } : null),
    // The accent bar wins on the left edge (drawn after any full border).
    ...(accentW ? { borderLeft: `${accentW}px solid ${accentColor}` } : null),
    ...(a.shadow ? { boxShadow: "0 1px 3px rgba(0,0,0,0.09), 0 1px 2px rgba(0,0,0,0.05)" } : null),
  };
}
