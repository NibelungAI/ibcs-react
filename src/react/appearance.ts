import type React from "react";
import type { IbcsTokens } from "../core/tokens";

/* ------------------------------------------------------------------ *
 * Shared "card surface" appearance - one flexible API for every
 * container-like component (KPI cards, report blocks) so callers control
 * border, background, corner rounding, the left accent bar and shadow,
 * instead of being forced into one look. Every default comes from the
 * theme's `card` token group, so a whole report goes flat (or framed) by
 * theme; the per-instance `appearance` overrides it.
 * ------------------------------------------------------------------ */

export interface CardAppearance {
  /** Corner radius in px. Default: the theme's `card.radius` (8). Set `0` for square corners. */
  radius?: number;
  /** Background colour. Defaults to the theme's `color.surface` ("#fff"). */
  background?: string;
  /**
   * Full border: `true` uses the theme's `rowBorder`, a string sets a custom
   * colour, `false` draws none. Omitted follows the theme's `card.border`
   * (a hairline by default, so a white card reads against a white page).
   */
  border?: boolean | string;
  /** Border width in px when `border` is on. Default: the theme's `card.borderWidth` (1). */
  borderWidth?: number;
  /**
   * Left favorability accent bar. `false` (default) draws none - a calm, neutral
   * card. `true` draws a 3px bar in the status colour; a number sets its width in
   * px. (Off by default: a coloured corner bar reads as a dashboard-template
   * cliché; the variance text already carries the favorability colour.)
   */
  accent?: boolean | number;
  /** Lift the card off the background with a soft drop shadow. Default: the theme's `card.shadow` (false). */
  shadow?: boolean;
  /** Padding - a px number or any CSS padding string. Default: the theme's `card.padding` ("15px 17px"). */
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
  const card = tokens.card;
  const accent = a.accent ?? false;
  const accentW = typeof accent === "number" ? accent : accent ? 3 : 0;
  // The instance decides first, then the theme: `true` is the theme's hairline
  // colour, a string a custom one, `false` no border at all.
  const border = a.border ?? card.border;
  const borderColor =
    border === false ? null : typeof border === "string" ? border : tokens.color.rowBorder;
  const bw = a.borderWidth ?? card.borderWidth;
  return {
    background: a.background ?? tokens.color.surface,
    borderRadius: a.radius ?? card.radius,
    padding: a.padding ?? card.padding,
    boxSizing: "border-box",
    ...(borderColor ? { border: `${bw}px solid ${borderColor}` } : null),
    // The accent bar wins on the left edge (drawn after any full border).
    ...(accentW ? { borderLeft: `${accentW}px solid ${accentColor}` } : null),
    ...((a.shadow ?? card.shadow)
      ? { boxShadow: "0 1px 3px rgba(0,0,0,0.09), 0 1px 2px rgba(0,0,0,0.05)" }
      : null),
  };
}
