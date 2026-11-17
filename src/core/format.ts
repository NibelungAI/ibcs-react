/**
 * Number formatting tuned for financial statements (compact, sign-aware).
 *
 * These helpers return logical, sign-prefixed strings (the minus/plus is the
 * leftmost glyph). RTL layouts are the caller's concern: set `dir="rtl"` on the
 * container so the UA reorders the sign/currency/digits for display - we do not
 * inject bidi control characters here.
 *
 * Exact decimals (`fractionDigits`, `percentFractionDigits`, the options form
 * of {@link formatPercent}) go through `Intl.NumberFormat` only, so a chart's
 * digits always match what an app writes with `Intl` beside it: the locale's
 * separators, and Intl's rounding - half away from zero on the number as
 * written (1.005 → "1.01", 2.5 → "3"). `Number.prototype.toFixed` rounds the
 * binary value instead (1.005 → "1.00") and is kept only on the 1.4 paths.
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
   * Unit appended AFTER the number and its compact scale suffix - "18.4%",
   * "1.2M€", "32 d". The counterpart of `currency`: use whichever side the
   * unit belongs on (a leading "€" is `currency`, a trailing "%" is `suffix`).
   */
  suffix?: string;
  /** Locale for thousands grouping and the compact decimal separator. Default "en-US". */
  locale?: string;
  /** Override the compact unit suffixes (e.g. German "Mrd."/"Mio."/"Tsd."). Default { B, M, K }. */
  compactSuffixes?: CompactSuffixes;
  /**
   * EXACT number of fraction digits for every value written with these
   * options, trailing zeros kept: `{ fractionDigits: 2 }` writes 914.3 as
   * "914.30" and 10 as "10.00", so one column or chart never mixes "10" with
   * "10.0". It applies to non-compact values, to compact magnitudes ("1.20M",
   * in place of `decimals`) and to compact values under 1,000 ("999.00").
   *
   * Digits and separators follow `locale` ("1,234.50" in en-US, "1.234,50" in
   * sr-Latn); rounding is half away from zero on the number as written
   * (1.005 → "1.01", 2.5 → "3", -2.5 → "-3"), exactly as `Intl.NumberFormat`
   * rounds. A value that rounds to zero is written without a sign ("0.00",
   * never "-0.00"). An integer from 0 to 20; other numbers are rounded and
   * clamped into that range.
   *
   * Unset (the default) keeps the 1.4 behaviour: compact mode rounds values
   * under 1,000 to whole numbers, and non-compact mode drops trailing zeros.
   */
  fractionDigits?: number;
  /**
   * Exact fraction digits of the percentages a component writes itself - the
   * relative variance (ΔPY%) labels, shares, growth rates. Default 1.
   *
   * Setting this, `fractionDigits`, `locale` or `notAvailable` also moves those
   * percent labels onto {@link formatPercent}'s options form, so they follow
   * `locale` too ("+17,5%" in sr-Latn, "+17,5 %" in de-DE). With none of the
   * four set, percent labels are byte-identical to 1.4's.
   */
  percentFractionDigits?: number;
  /**
   * The text written in place of a number that does not exist or cannot be
   * written: a missing value, NaN, ±Infinity, a ratio over a zero base.
   * Default "n/a".
   */
  notAvailable?: string;
}

/**
 * Options for the percent formatters ({@link formatPercent},
 * {@link formatPercentPlain}). A component derives them from its number
 * {@link FormatOptions}, so its percent labels and its values share one locale.
 */
export interface PercentFormatOptions {
  /** Exact fraction digits, trailing zeros kept (an integer 0-20). Default 1. */
  fractionDigits?: number;
  /**
   * Locale of the digits, the separators and the percent sign's place:
   * "17.5%" (en-US), "17,5%" (sr-Latn), "17,5 %" (de-DE), "%17,5" (tr-TR).
   * Default "en-US".
   */
  locale?: string;
  /**
   * Which signs to write. "exceptZero" (default) writes "+" on a gain and "-"
   * on a loss; "auto" writes only the "-" (a share or a rate). A value that
   * rounds to zero is unsigned either way.
   */
  signDisplay?: "exceptZero" | "auto";
  /** Text for a missing ratio (null, NaN, ±Infinity). Default "n/a". */
  notAvailable?: string;
}

const DEFAULT_SUFFIXES: CompactSuffixes = { B: "B", M: "M", K: "K" };

const UNITS: Array<[number, keyof CompactSuffixes]> = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** The most fraction digits `fractionDigits` accepts (Intl's portable maximum). */
const MAX_FRACTION_DIGITS = 20;

/**
 * Normalize a caller-given digit count. `undefined` (and NaN) stays undefined
 * - "not set", the 1.4 path - anything else becomes an integer from 0 to 20.
 */
function digitsOf(digits: number | undefined): number | undefined {
  if (digits == null || Number.isNaN(digits)) return undefined;
  return Math.min(MAX_FRACTION_DIGITS, Math.max(0, Math.round(digits)));
}

/**
 * One cached `Intl.NumberFormat` per locale and digit count. Building a
 * formatter costs far more than using one, and a table formats every cell.
 */
const fixedFormatters = new Map<string, Intl.NumberFormat>();

function fixedFormatter(locale: string, digits: number): Intl.NumberFormat {
  const key = `${locale}|${digits}`;
  let formatter = fixedFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    fixedFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Whether a magnitude (≥ 0) is written as zero at `digits` - decided by Intl's
 * own rounding (en-US digits, grouping stripped), so the sign rule can never
 * disagree with the digits on the page.
 */
function roundsToZero(abs: number, digits: number): boolean {
  return Number(fixedFormatter("en-US", digits).format(abs).replace(/,/g, "")) === 0;
}

/**
 * Whether formatValue writes `abs` (≥ 0) as zero. On the 1.4 path only a true
 * zero counts (it has always written "-0" for -0.4); with exact digits, a value
 * that rounds to zero does too.
 */
function writtenAsZero(abs: number, compact: boolean, digits: number | undefined): boolean {
  if (digits == null) return abs === 0;
  if (compact && abs >= UNITS[UNITS.length - 1]![0]) return false;
  return roundsToZero(abs, digits);
}

/**
 * "30.1M", "-111K", "1,234" - magnitude only, caller decides the sign prefix.
 *
 * Non-finite input (NaN / ±Infinity from a division by zero or a gap in the
 * source data) formats as `notAvailable` ("n/a"), matching
 * {@link formatPercent}: it must never reach the page as "NaN" or "∞B".
 */
export function formatValue(n: number, opts: FormatOptions = {}): string {
  if (!Number.isFinite(n)) return opts.notAvailable ?? "n/a";
  const {
    compact = true,
    decimals = 1,
    currency = "",
    suffix = "",
    locale = "en-US",
    compactSuffixes = DEFAULT_SUFFIXES,
  } = opts;
  const digits = digitsOf(opts.fractionDigits);
  const abs = Math.abs(n);

  let body: string;
  if (compact) {
    const unit = UNITS.find(([threshold]) => abs >= threshold);
    if (unit) {
      const [threshold, key] = unit;
      // Intl picks the locale's decimal separator. On the 1.4 path
      // minimumFractionDigits 0 drops trailing zeros (30.0M -> 30M, 35.40M ->
      // 35.4M); exact digits keep them (1.20M).
      const magnitude =
        digits == null
          ? (abs / threshold).toLocaleString(locale, {
              maximumFractionDigits: decimals,
              minimumFractionDigits: 0,
            })
          : fixedFormatter(locale, digits).format(abs / threshold);
      body = magnitude + compactSuffixes[key];
    } else {
      body = digits == null ? String(Math.round(abs)) : fixedFormatter(locale, digits).format(abs);
    }
  } else {
    body = digits == null ? abs.toLocaleString(locale) : fixedFormatter(locale, digits).format(abs);
  }

  const sign = n < 0 && !writtenAsZero(abs, compact, digits) ? "-" : "";
  return `${sign}${currency}${body}${suffix}`;
}

/**
 * "+1.1M", "-306K" - always shows the sign, magnitude formatted compactly.
 * Non-finite input formats as an UNSIGNED `notAvailable` (never "+n/a"):
 * there is no direction to report when the number is missing. With exact
 * `fractionDigits`, a value that rounds to zero is unsigned too ("0.00").
 */
export function formatSigned(n: number, opts: FormatOptions = {}): string {
  if (!Number.isFinite(n)) return opts.notAvailable ?? "n/a";
  const { currency = "", suffix = "", compact = true } = opts;
  const abs = Math.abs(n);
  const zero = writtenAsZero(abs, compact, digitsOf(opts.fractionDigits));
  const prefix = zero ? "" : n > 0 ? "+" : "-";
  return `${prefix}${currency}${formatValue(abs, { ...opts, currency: "", suffix: "" })}${suffix}`;
}

/**
 * "910.79 ± 0.76" - a value and the half-width of its interval, both written
 * with the same options, so they always carry the same digits. `signed` writes
 * the value with {@link formatSigned} ("+3.46 ± 0.46"), for a difference.
 *
 * The "±" is held to its numbers by no-break spaces, so the pair never wraps
 * apart. A missing value writes `notAvailable`; a half-width that is missing,
 * negative or not finite is left out (the value alone is written).
 */
export function formatInterval(
  value: number,
  halfWidth: number | null | undefined,
  opts: FormatOptions = {},
  signed = false,
): string {
  const point = signed ? formatSigned(value, opts) : formatValue(value, opts);
  if (!Number.isFinite(value)) return point;
  if (halfWidth == null || !Number.isFinite(halfWidth) || halfWidth < 0) return point;
  return `${point}\u00a0±\u00a0${formatValue(halfWidth, opts)}`;
}

/** The text a locale writes before and after a percent number, e.g. "" and " %" in de-DE. */
interface PercentAffixes {
  prefix: string;
  suffix: string;
}

const percentAffixCache = new Map<string, PercentAffixes>();

/**
 * Where a locale puts its percent sign, read once from Intl's own percent
 * pattern: everything before the first digit group and after the last one.
 */
function percentAffixes(locale: string): PercentAffixes {
  let affixes = percentAffixCache.get(locale);
  if (!affixes) {
    const parts = new Intl.NumberFormat(locale, { style: "percent" }).formatToParts(0.5);
    const numeric = new Set(["integer", "group", "decimal", "fraction"]);
    const first = parts.findIndex((p) => numeric.has(p.type));
    let last = first;
    for (let i = parts.length - 1; i > first; i--) {
      if (numeric.has(parts[i]!.type)) {
        last = i;
        break;
      }
    }
    affixes = {
      prefix: parts
        .slice(0, Math.max(first, 0))
        .map((p) => p.value)
        .join(""),
      suffix: parts
        .slice(last + 1)
        .map((p) => p.value)
        .join(""),
    };
    percentAffixCache.set(locale, affixes);
  }
  return affixes;
}

/**
 * The sign of a percent written with the options form: none on a value that
 * rounds to zero, "-" on a loss, "+" on a gain unless `signDisplay` is "auto".
 */
function percentSign(
  fraction: number,
  abs: number,
  digits: number,
  options: PercentFormatOptions,
): string {
  if (roundsToZero(abs, digits)) return "";
  if (fraction < 0) return "-";
  return options.signDisplay === "auto" ? "" : "+";
}

/**
 * "+17.5%", "-100.0%", "n/a" - fraction in, percent out.
 *
 * The second argument is either the 1.4 decimals count (a number, default 1:
 * written with `toFixed` and a bare "%", byte-identical to 1.4) or a
 * {@link PercentFormatOptions} object: exact digits through `Intl`, the
 * locale's separators and percent sign ("+17,5%" in sr-Latn, "+17,5 %" in
 * de-DE), and no sign on a value that rounds to zero.
 */
export function formatPercent(
  fraction: number | null,
  options: number | PercentFormatOptions = 1,
): string {
  if (typeof options === "number") {
    if (fraction == null || !isFinite(fraction)) return "n/a";
    const pct = fraction * 100;
    const prefix = pct > 0 ? "+" : pct < 0 ? "-" : "";
    return `${prefix}${Math.abs(pct).toFixed(options)}%`;
  }
  if (fraction == null || !Number.isFinite(fraction)) return options.notAvailable ?? "n/a";
  const locale = options.locale ?? "en-US";
  const digits = digitsOf(options.fractionDigits) ?? 1;
  const abs = Math.abs(fraction * 100);
  const { prefix, suffix } = percentAffixes(locale);
  const body = fixedFormatter(locale, digits).format(abs);
  return `${percentSign(fraction, abs, digits, options)}${prefix}${body}${suffix}`;
}

/**
 * Like formatPercent but with thousands grouping and no "%" suffix - the
 * IBCS ΔPY% column style: "+6.9", "-100.0", "+1,727.9". The column header
 * carries the "%", so the cells stay terse.
 *
 * The second argument is the 1.4 decimals count (with `locale` as the third)
 * or a {@link PercentFormatOptions} object, which also leaves a value that
 * rounds to zero unsigned and honours `notAvailable`.
 */
export function formatPercentPlain(
  fraction: number | null,
  decimals: number | PercentFormatOptions = 1,
  locale = "en-US",
): string {
  if (typeof decimals === "number") {
    if (fraction == null || !isFinite(fraction)) return "n/a";
    const pct = fraction * 100;
    const prefix = pct > 0 ? "+" : pct < 0 ? "-" : "";
    const body = Math.abs(pct).toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${prefix}${body}`;
  }
  const options = decimals;
  if (fraction == null || !Number.isFinite(fraction)) return options.notAvailable ?? "n/a";
  const digits = digitsOf(options.fractionDigits) ?? 1;
  const abs = Math.abs(fraction * 100);
  const body = fixedFormatter(options.locale ?? "en-US", digits).format(abs);
  return `${percentSign(fraction, abs, digits, options)}${body}`;
}

/**
 * The percent options a component derives from its number `format`: the same
 * `locale` and `notAvailable`, and `percentFractionDigits` (default 1) as the
 * digits. When none of `locale`, `fractionDigits`, `percentFractionDigits` and
 * `notAvailable` is set it returns the 1.4 decimals count (`1`) instead, so an
 * untouched chart's percent labels stay byte-identical.
 *
 * Internal plumbing shared by the renderers - not part of the public surface.
 */
export function percentFormatOf(
  format: FormatOptions,
  signDisplay?: PercentFormatOptions["signDisplay"],
): number | PercentFormatOptions {
  const { locale, fractionDigits, percentFractionDigits, notAvailable } = format;
  if (
    locale == null &&
    fractionDigits == null &&
    percentFractionDigits == null &&
    notAvailable == null
  ) {
    return 1;
  }
  return {
    locale,
    fractionDigits: percentFractionDigits ?? 1,
    notAvailable,
    ...(signDisplay ? { signDisplay } : null),
  };
}

/**
 * The text a component writes for a missing number - `format.notAvailable`,
 * else "n/a". Internal plumbing, not part of the public surface.
 */
export function notAvailableOf(format: FormatOptions | undefined): string {
  return format?.notAvailable ?? "n/a";
}
