import { useMemo } from "react";
import type { KpiConfig } from "../core/kpi";
import { computeKpi } from "../core/kpi";
import type { IbcsTokensOverride } from "../core/tokens";
import { useIbcsTokens } from "./theme";
import { formatValue, formatSigned, formatPercent } from "../core/format";
import { useCountUp } from "./hooks";
import { Sparkline } from "./Sparkline";
import { cardSurface, type CardAppearance } from "./appearance";

export interface KpiCardProps extends KpiConfig {
  tokens?: IbcsTokensOverride;
  /**
   * Count up the headline number (from `0` on mount, then tweening on every
   * change). Default true — and `prefers-reduced-motion` is respected
   * automatically: for those users the final value renders immediately, with
   * no frame loop, regardless of this prop. SSR always renders the finished
   * value. `false` switches the count-up off for everyone — what you want in
   * tests, print and screenshot pipelines.
   */
  animate?: boolean;
  /**
   * Card chrome — border, background, corner radius, an optional left accent bar
   * and shadow. Defaults to a calm white card with an 8px radius and a hairline
   * border, and **no** colour accent bar (the variance figure carries the
   * favorability colour). Opt into `accent: true` for the coloured edge,
   * `shadow: true` to lift it, or `radius: 0` for square corners.
   */
  appearance?: CardAppearance;
  /** Class applied to the card root. */
  className?: string;
  /** Styles merged *over* the card's own surface styles. */
  style?: React.CSSProperties;
}

/**
 * A configurable KPI card: a headline figure (count-up animated), one or more
 * IBCS impact-coloured deltas (favorability, not sign), and an optional
 * sparkline. Built to drop into a report grid as a "kpi" block.
 *
 * The unit is part of `format` — `currency` for a leading symbol
 * (`{ currency: "€" }` → €30.1M), `suffix` for a trailing one
 * (`{ suffix: "%" }` → 18.4%) — and the card states it once, muted, beside the
 * headline rather than repeating it on every delta.
 */
export function KpiCard({
  label,
  values,
  comparisons = ["PY"],
  higherIsBetter = true,
  format = { compact: true, decimals: 1 },
  sparkline,
  sparklineType = "area",
  tokens: tokenOverride,
  animate = true,
  appearance,
  className,
  style,
}: KpiCardProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const result = useMemo(
    () => computeKpi({ label, values, comparisons, higherIsBetter }),
    [label, values, comparisons, higherIsBetter],
  );

  const target = result.current ?? 0;
  // `duration: 0` short-circuits the hook entirely (no RAF loop, no re-renders),
  // so `animate={false}` really is free; `from: 0` gives the mount count-up.
  const animated = useCountUp(target, {
    duration: animate ? 700 : 0,
    from: animate ? 0 : undefined,
  });
  const shown = animate ? animated : target;

  const statusColor =
    result.status === "good"
      ? tokens.color.good
      : result.status === "bad"
        ? tokens.color.bad
        : tokens.color.textMuted;

  // The card's unit lives in the format, on the side it belongs on:
  // `format.currency` leads the number ("€30.1M"), `format.suffix` trails it
  // ("82.4%"). The card prints those affixes itself — a touch smaller and
  // muted, as on a polished BI card — and strips them from the options the
  // figures are formatted with, so a symbol is stated once, on the headline,
  // and can never double up ("€€30.1M") or repeat on every delta.
  const { currency: prefixUnit = "", suffix: suffixUnit = "", ...numberFormat } = format;

  // Only comparisons that resolved to a real variance are shown. The first is
  // the headline comparison (sits beside the big number); the rest stack under.
  const deltas = result.deltas.filter((d) => d.variance);

  const renderDelta = (d: (typeof deltas)[number], primary: boolean) => {
    const v = d.variance!;
    const flat = v.abs === 0;
    const color = flat ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
    // Arrow follows the DIRECTION of change (sign); colour follows FAVORABILITY,
    // so a rising cost is a red ▲ — an IBCS staple. No pill: the coloured figure
    // is the signal. The marker scales gently with magnitude (Zebra-style).
    const arrow = flat ? "→" : v.abs > 0 ? "▲" : "▼";
    const tri = primary ? Math.max(7.5, Math.min(12, 7.5 + Math.abs(v.pct ?? 0) * 9)) : 8;
    return (
      <span
        key={d.base}
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 5,
          color,
          fontSize: primary ? 13 : 12,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        <span aria-hidden style={{ fontSize: tri, lineHeight: 1, alignSelf: "center" }}>
          {arrow}
        </span>
        <strong style={{ fontWeight: 700 }}>{formatSigned(v.abs, numberFormat)}</strong>
        <span style={{ fontWeight: 600, opacity: 0.85 }}>{formatPercent(v.pct)}</span>
        <span style={{ color: tokens.color.textMuted, fontWeight: 500, fontSize: "0.85em" }}>
          vs {d.base}
        </span>
      </span>
    );
  };

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        fontFamily: tokens.font.family,
        minWidth: 0,
        ...cardSurface(appearance, tokens, statusColor),
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: tokens.color.textMuted,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
        title={label}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: tokens.color.text,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -0.5,
            lineHeight: 1.05,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {prefixUnit && (
            <span
              style={{
                fontSize: "0.6em",
                fontWeight: 600,
                color: tokens.color.textMuted,
                marginRight: 1,
              }}
            >
              {prefixUnit}
            </span>
          )}
          {formatValue(shown, numberFormat)}
          {suffixUnit && (
            <span
              style={{
                fontSize: "0.6em",
                fontWeight: 600,
                color: tokens.color.textMuted,
                marginLeft: 1,
              }}
            >
              {suffixUnit}
            </span>
          )}
        </span>
        {deltas[0] && renderDelta(deltas[0], true)}
      </div>

      {deltas.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px" }}>
          {deltas.slice(1).map((d) => renderDelta(d, false))}
        </div>
      )}

      {sparkline && sparkline.length > 1 && (
        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          <Sparkline
            data={sparkline}
            type={sparklineType}
            color={tokens.color.neutral}
            width={260}
            height={42}
            fluid
            fillOpacity={0.16}
          />
        </div>
      )}
    </div>
  );
}
