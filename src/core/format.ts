/**
 * Number formatting tuned for financial statements (compact, sign-aware).
 *
 * These helpers return logical, sign-prefixed strings (the minus/plus is the
 * leftmost glyph). RTL layouts are the caller's concern: set `dir="rtl"` on the
 * container so the UA reorders the sign/currency/digits for display - we do not
 * inject bidi control characters here.
 *
 * Exact decimals (`fractionDigits`, `percentFractionDigits`, the options form
 * of {@link formatPercent} and {@link formatPercentPlain}) are written by
 * `Intl.NumberFormat` - the locale's digits and separators, rounding half away
 * from zero - after one step of our own: when the digits to be written fit in
 * 14 significant digits (|x| < 10^(14 - digits)), the value is first rounded
 * to 15, one guard digit past the last written one, so noise that arithmetic
 * leaves past the 15th digit never decides a tie. So the output can differ
 * from `Intl` alone: `0.145 * 100` (14.499999999999998) is "15" at 0 digits,
 * where `Intl` writes "14". Also 1.005 → "1.01", 2.5 → "3", and 0.0045 →
 * "0.5%" (a percent is scaled by 100 in decimal, by Intl's percent style;
 * `0.0045 * 100` in binary is 0.44999999999999996). A value with more written
 * digits is written as `Intl` writes the double: 12345678901234.56 →
 * "12,345,678,901,234.56".
 *
 * The 1.4 forms - a format without exact digits, and the numeric second
 * argument of the percent helpers - are kept byte for byte, including their
 * rounding (`toFixed` rounds the binary value: 1.005 → "1.00", 0.0045 → "0.4%").
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
   * sr-Latn); rounding is half away from zero, on the number rounded to 15
   * significant digits when the written digits fit in 14 (1.005 → "1.01",
   * 2.5 → "3", -2.5 → "-3"; a larger value as `Intl` writes the double). A
   * value that rounds to
   * zero is written without a sign ("0.00", never "-0.00"), and a compact value
   * whose rounding reaches 1,000 moves to the next unit (999.996 → "1.00K").
   * An integer from 0 to 20; other numbers are rounded and clamped into that
   * range.
   *
   * Unset (the default) keeps the 1.4 behaviour: compact mode rounds values
   * under 1,000 to whole numbers, and non-compact mode drops trailing zeros.
   */
  fractionDigits?: number;
  /**
   * Exact fraction digits of the percentages a component writes itself - the
   * relative variance (ΔPY%) labels, shares, growth rates. Default 1, except
   * where a component has always written fewer: `ComparisonTable`'s Δ% and
   * `StructureChart`'s shares default to 0, and `PieChart`'s centre share to 1
   * for a share above 0 and under 10 %, else 0.
   *
   * Setting this, `fractionDigits`, `locale` or `notAvailable` moves those
   * percent labels onto the options form of {@link formatPercent} and
   * {@link formatPercentPlain}. Against 1.4 that changes four things, in every
   * locale including en-US: the locale's separators and percent sign ("+17,5%"
   * in sr-Latn, "+17,5 %" in de-DE); a value that rounds to zero loses its sign
   * ("0.0%", 1.4: "+0.0%"); ties round half up as the number reads (1.15 % →
   * "+1.2%", 1.4: "+1.1%"); and 1,000 % and more are grouped ("+1,727.9%", 1.4:
   * "+1727.9%"). With none of the four set, percent labels are byte-identical
   * to 1.4's.
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

/** One cached percent-style `Intl.NumberFormat` per locale and digit count. */
const percentFormatters = new Map<string, Intl.NumberFormat>();

function percentFormatter(locale: string, digits: number): Intl.NumberFormat {
  const key = `${locale}|${digits}`;
  let formatter = percentFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    percentFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * The number at 15 significant digits, when it is to be written with `digits`
 * fraction digits and those fit in 14 (|x| < 10^(14 - digits)): the 15th is a
 * guard digit, so this never rounds a written digit. A double carries 15-17,
 * and arithmetic leaves noise beyond the 15th (`0.0045 * 100` =
 * 0.44999999999999996); without it, a tie rounds the way the number reads. A
 * larger value is returned as it is, for Intl to write: rounding it to 15
 * digits would round a written digit on the binary value (12345678901234.56
 * would end "…234.60", 9876543210987.645 "…987.64").
 */
function denoise(x: number, digits: number): number {
  return x === 0 || !Number.isFinite(x) || Math.abs(x) >= 10 ** (14 - digits)
    ? x
    : Number(x.toPrecision(15));
}

/** A magnitude (≥ 0) rounded by Intl at `digits`, as a number (en-US digits). */
function roundedAt(abs: number, digits: number): number {
  return Number(fixedFormatter("en-US", digits).format(abs).replace(/,/g, ""));
}

/**
 * Whether a magnitude (≥ 0) is written as zero at `digits` - decided by Intl's
 * own rounding, so the sign rule can never disagree with the digits on the page.
 */
function roundsToZero(abs: number, digits: number): boolean {
  return roundedAt(abs, digits) === 0;
}

/**
 * Whether formatValue writes `abs` (≥ 0) as zero. On the 1.4 path only a true
 * zero counts (it has always written "-0" for -0.4); with exact digits, a value
 * that rounds to zero does too.
 */
function writtenAsZero(abs: number, compact: boolean, digits: number | undefined): boolean {
  if (digits == null) return abs === 0;
  const x = denoise(abs, digits);
  if (compact && compactUnit(x, digits) != null) return false;
  return roundsToZero(x, digits);
}

/**
 * The compact unit a magnitude (≥ 0, denoised) is written in at exact
 * `digits`: the largest unit it reaches, moved up while rounding would write
 * 1,000 or more of it (999.996 → K, 999,999.6 → M). Null under 1,000.
 */
function compactUnit(abs: number, digits: number): (typeof UNITS)[number] | null {
  let i = UNITS.findIndex(([threshold]) => abs >= threshold);
  if (i === -1) {
    if (roundedAt(abs, digits) < 1e3) return null;
    i = UNITS.length - 1;
  }
  while (i > 0 && roundedAt(denoise(abs / UNITS[i]![0], digits), digits) >= 1e3) i--;
  return UNITS[i]!;
}

/**
 * The fraction digits that show `x` (> 0) to `figures` significant figures -
 * 0 for a whole number - so a half-width is never rounded away.
 */
function figureDigits(x: number, figures: number): number {
  return Math.min(MAX_FRACTION_DIGITS, Math.max(0, figures - 1 - Math.floor(Math.log10(x))));
}

/**
 * A magnitude (≥ 0) written at exact `digits` in a given compact unit (or
 * none), with the format's currency and suffix around it.
 */
function exactMagnitude(
  abs: number,
  unit: (typeof UNITS)[number] | null,
  digits: number,
  opts: FormatOptions,
): string {
  const { currency = "", suffix = "", locale = "en-US", compactSuffixes = DEFAULT_SUFFIXES } = opts;
  const scaled = denoise(unit ? abs / unit[0] : abs, digits);
  const body =
    fixedFormatter(locale, digits).format(scaled) + (unit ? compactSuffixes[unit[1]] : "");
  return `${currency}${body}${suffix}`;
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
  const digits = digitsOf(opts.fractionDigits);
  if (digits != null) {
    // Exact digits: Intl on the denoised magnitude, in the compact unit its
    // rounding lands in.
    const abs = denoise(Math.abs(n), digits);
    const unit = (opts.compact ?? true) ? compactUnit(abs, digits) : null;
    const zero = unit == null && roundsToZero(abs, digits);
    return `${n < 0 && !zero ? "-" : ""}${exactMagnitude(abs, unit, digits, opts)}`;
  }

  // The 1.4 path, byte for byte.
  const {
    compact = true,
    decimals = 1,
    currency = "",
    suffix = "",
    locale = "en-US",
    compactSuffixes = DEFAULT_SUFFIXES,
  } = opts;
  const abs = Math.abs(n);

  let body: string;
  if (compact) {
    const unit = UNITS.find(([threshold]) => abs >= threshold);
    if (unit) {
      const [threshold, key] = unit;
      // Intl picks the locale's decimal separator; minimumFractionDigits 0
      // drops trailing zeros (30.0M -> 30M, 35.40M -> 35.4M).
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

  const sign = n < 0 && abs !== 0 ? "-" : "";
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
 * "910.79 ± 0.76" - a value and the half-width of its interval. `signed`
 * writes the value with {@link formatSigned} ("+3.46 ± 0.46"), for a
 * difference.
 *
 * A positive half-width is never written as zero (down to Intl's limit of 20
 * fraction digits - a half-width under 5e-21 of its unit is the exception):
 * - With exact `fractionDigits`, the value keeps them, and the half-width
 *   takes at least enough digits for its first significant figure
 *   ("914.30 ± 0.004"). In compact mode it is written in the value's unit
 *   ("12.35K ± 0.23K").
 * - Without them (the 1.4 default rounds to whole numbers under 1,000), both
 *   numbers are written in full, at the digits that show two significant
 *   figures of the half-width: 914.3013 ± 0.4682 → "914.30 ± 0.47".
 *
 * The "±" is held to its numbers by no-break spaces, so the pair never wraps
 * apart. A missing value writes `notAvailable`; a half-width that is missing,
 * negative or not finite is left out (the value alone is written as usual).
 */
export function formatInterval(
  value: number,
  halfWidth: number | null | undefined,
  opts: FormatOptions = {},
  signed = false,
): string {
  const write = (o: FormatOptions) => (signed ? formatSigned(value, o) : formatValue(value, o));
  if (!Number.isFinite(value)) return opts.notAvailable ?? "n/a";
  if (halfWidth == null || !Number.isFinite(halfWidth) || halfWidth < 0) return write(opts);

  const digits = digitsOf(opts.fractionDigits);
  if (digits == null) {
    const full: FormatOptions = {
      ...opts,
      compact: false,
      fractionDigits: halfWidth > 0 ? figureDigits(halfWidth, 2) : 0,
    };
    return `${write(full)}\u00a0±\u00a0${formatValue(halfWidth, full)}`;
  }

  // The half-width shares the value's compact unit, and its first figure shows.
  const unit =
    (opts.compact ?? true) ? compactUnit(denoise(Math.abs(value), digits), digits) : null;
  const scaled = denoise(unit ? halfWidth / unit[0] : halfWidth, digits);
  const halfDigits = halfWidth > 0 ? Math.max(digits, figureDigits(scaled, 1)) : digits;
  return `${write(opts)}\u00a0±\u00a0${exactMagnitude(halfWidth, unit, halfDigits, opts)}`;
}

/**
 * The sign of a percent written with the options form: none on a value that
 * rounds to zero (by the same Intl rounding the digits take), "-" on a loss,
 * "+" on a gain unless `signDisplay` is "auto". `abs` is the denoised fraction.
 */
function percentSign(
  fraction: number,
  abs: number,
  digits: number,
  options: PercentFormatOptions,
): string {
  if (!/[1-9]/.test(percentFormatter("en-US", digits).format(abs))) return "";
  if (fraction < 0) return "-";
  return options.signDisplay === "auto" ? "" : "+";
}

/** The parts of a percent that are the number itself (no sign, no percent sign, no spacing). */
const NUMBER_PARTS = new Set(["integer", "group", "decimal", "fraction"]);

/**
 * "+17.5%", "-100.0%", "n/a" - fraction in, percent out.
 *
 * The second argument is either the 1.4 decimals count (a number, default 1:
 * written with `toFixed` and a bare "%", byte-identical to 1.4, rounding the
 * binary product - 0.0045 → "+0.4%") or a {@link PercentFormatOptions} object:
 * Intl's percent style, which scales by 100 in decimal, on the fraction at 15
 * significant digits when the percent's digits fit in 14 - so ties round half
 * up as the number reads (0.0045 →
 * "+0.5%", 0.0185 → "+1.9%") - with the locale's separators and percent sign
 * ("+17,5%" in sr-Latn, "+17,5 %" in de-DE) and no sign on a value that rounds
 * to zero.
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
  const digits = digitsOf(options.fractionDigits) ?? 1;
  const abs = denoise(Math.abs(fraction), digits + 2);
  const body = percentFormatter(options.locale ?? "en-US", digits).format(abs);
  return `${percentSign(fraction, abs, digits, options)}${body}`;
}

/**
 * Like formatPercent but with thousands grouping and no "%" suffix - the
 * IBCS ΔPY% column style: "+6.9", "-100.0", "+1,727.9". The column header
 * carries the "%", so the cells stay terse.
 *
 * The second argument is the 1.4 decimals count (with `locale` as the third,
 * byte-identical to 1.4) or a {@link PercentFormatOptions} object: the number
 * part of Intl's percent style - scaled in decimal, rounded half up as the
 * number reads - with a value that rounds to zero unsigned and `notAvailable`.
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
  const abs = denoise(Math.abs(fraction), digits + 2);
  const body = percentFormatter(options.locale ?? "en-US", digits)
    .formatToParts(abs)
    .filter((part) => NUMBER_PARTS.has(part.type))
    .map((part) => part.value)
    .join("");
  return `${percentSign(fraction, abs, digits, options)}${body}`;
}

/**
 * A percentage and the half-width of its interval, both fractions: "+6.9% ±
 * 0.4%", or "+6.9 ± 0.4" without the percent sign (`withSign` false) for a
 * column whose header carries it. `format` is what {@link percentFormatOf}
 * returns. The value is written as {@link formatPercent} /
 * {@link formatPercentPlain} write it; the half-width is unsigned and takes at
 * least enough digits for its first significant figure, so it is never
 * written as zero.
 *
 * Internal plumbing shared by the renderers - not part of the public surface.
 */
export function formatPercentInterval(
  fraction: number | null,
  halfWidth: number | null | undefined,
  format: number | PercentFormatOptions,
  withSign: boolean,
): string {
  const write = (f: number | null, o: number | PercentFormatOptions) =>
    withSign ? formatPercent(f, o) : formatPercentPlain(f, o);
  const value = write(fraction, format);
  if (fraction == null || !Number.isFinite(fraction)) return value;
  if (halfWidth == null || !Number.isFinite(halfWidth) || halfWidth < 0) return value;
  const base = typeof format === "number" ? { fractionDigits: format } : format;
  const digits = digitsOf(base.fractionDigits) ?? 1;
  const halfDigits =
    halfWidth > 0 ? Math.max(digits, figureDigits(denoise(halfWidth * 100, digits), 1)) : digits;
  const half = write(halfWidth, { ...base, fractionDigits: halfDigits, signDisplay: "auto" });
  return `${value}\u00a0±\u00a0${half}`;
}

/**
 * The percent options a component derives from its number `format`: the same
 * `locale` and `notAvailable`, and `percentFractionDigits` (default 1; the few
 * components with another default override it) as the digits. When none of `locale`, `fractionDigits`, `percentFractionDigits` and
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
