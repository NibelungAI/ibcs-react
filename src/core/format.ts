/**
 * Number formatting tuned for financial statements (compact, sign-aware).
 *
 * These helpers return logical, sign-prefixed strings (the minus/plus is the
 * leftmost glyph). RTL layouts are the caller's concern: set `dir="rtl"` on the
 * container so the UA reorders the sign/currency/digits for display — we do not
 * inject bidi control characters here.
 */

/** Compact-mode unit suffixes; defaults to the en-US "B"/"M"/"K". */
export interface CompactSuffixes {
  B: string;
  M: string;
  K: string;
}

export interface FormatOptions {
  /** Collapse to K / M / B. Default true. */
  compact?: boolean;
  /** Decimals for compact mode. Default 1. */
  decimals?: number;
  /** Currency symbol placed before the number (sign stays leftmost). */
  currency?: string;
  /**
   * Unit appended AFTER the number and its compact scale suffix — "18.4%",
   * "1.2M€", "32 d". The counterpart of `currency`: use whichever side the
   * unit belongs on (a leading "€" is `currency`, a trailing "%" is `suffix`).
   */
  suffix?: string;
  /** Locale for thousands grouping and the compact decimal separator. Default "en-US". */
  locale?: string;
  /** Override the compact unit suffixes (e.g. German "Mrd."/"Mio."/"Tsd."). Default { B, M, K }. */
  compactSuffixes?: CompactSuffixes;
}

const DEFAULT_SUFFIXES: CompactSuffixes = { B: "B", M: "M", K: "K" };

const UNITS: Array<[number, keyof CompactSuffixes]> = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/**
 * "30.1M", "-111K", "1,234" — magnitude only, caller decides the sign prefix.
 *
 * Non-finite input (NaN / ±Infinity from a division by zero or a gap in the
 * source data) formats as "n/a", matching {@link formatPercent}: it must never
 * reach the page as "NaN" or "∞B".
 */
export function formatValue(n: number, opts: FormatOptions = {}): string {
  if (!Number.isFinite(n)) return "n/a";
  const {
    compact = true,
    decimals = 1,
    currency = "",
    suffix = "",
    locale = "en-US",
    compactSuffixes = DEFAULT_SUFFIXES,
  } = opts;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  let body: string;
  if (compact) {
    const unit = UNITS.find(([threshold]) => abs >= threshold);
    if (unit) {
      const [threshold, key] = unit;
      // Intl picks the locale's decimal separator; minimumFractionDigits 0
      // drops trailing zeros for us (30.0M -> 30M, 35.40M -> 35.4M).
      const magnitude = (abs / threshold).toLocaleString(locale, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: 0,
      });
      body = magnitude + compactSuffixes[key];
    } else {
      body = String(Math.round(abs));
    }
  } else {
    body = abs.toLocaleString(locale);
  }

  return `${sign}${currency}${body}${suffix}`;
}

/**
 * "+1.1M", "-306K" — always shows the sign, magnitude formatted compactly.
 * Non-finite input formats as an UNSIGNED "n/a" (never "+n/a"): there is no
 * direction to report when the number is missing.
 */
export function formatSigned(n: number, opts: FormatOptions = {}): string {
  if (!Number.isFinite(n)) return "n/a";
  const prefix = n > 0 ? "+" : n < 0 ? "-" : "";
  const { currency = "", suffix = "" } = opts;
  return `${prefix}${currency}${formatValue(Math.abs(n), { ...opts, currency: "", suffix: "" })}${suffix}`;
}

/** "+17.5%", "-100.0%", "n/a" — fraction in, percent out. */
export function formatPercent(fraction: number | null, decimals = 1): string {
  if (fraction == null || !isFinite(fraction)) return "n/a";
  const pct = fraction * 100;
  const prefix = pct > 0 ? "+" : pct < 0 ? "-" : "";
  return `${prefix}${Math.abs(pct).toFixed(decimals)}%`;
}

/**
 * Like formatPercent but with thousands grouping and no "%" suffix — the
 * IBCS ΔPY% column style: "+6.9", "-100.0", "+1,727.9". The column header
 * carries the "%", so the cells stay terse.
 */
export function formatPercentPlain(
  fraction: number | null,
  decimals = 1,
  locale = "en-US",
): string {
  if (fraction == null || !isFinite(fraction)) return "n/a";
  const pct = fraction * 100;
  const prefix = pct > 0 ? "+" : pct < 0 ? "-" : "";
  const body = Math.abs(pct).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${body}`;
}
