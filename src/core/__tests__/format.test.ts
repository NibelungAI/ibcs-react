import { describe, it, expect } from "vitest";
import {
  formatInterval,
  formatPercent,
  formatPercentInterval,
  formatPercentPlain,
  formatSigned,
  formatValue,
  percentFormatOf,
} from "../format";

describe("formatValue", () => {
  it("collapses to K / M / B with one decimal by default", () => {
    expect(formatValue(1234)).toBe("1.2K");
    expect(formatValue(30100000)).toBe("30.1M");
    expect(formatValue(2500000000)).toBe("2.5B");
  });

  it("trims trailing zeros so round magnitudes stay terse", () => {
    expect(formatValue(30000000)).toBe("30M"); // 30.0M -> 30M
    expect(formatValue(1000)).toBe("1K"); // 1.0K -> 1K
    expect(formatValue(35400000)).toBe("35.4M");
  });

  it("does not add a unit below 1000 and rounds the magnitude", () => {
    expect(formatValue(999)).toBe("999");
    expect(formatValue(12.4)).toBe("12");
    expect(formatValue(12.6)).toBe("13");
    expect(formatValue(0)).toBe("0");
  });

  it("emits magnitude only, with a leading minus for negatives", () => {
    expect(formatValue(-111000)).toBe("-111K");
    expect(formatValue(-2500000000)).toBe("-2.5B");
  });

  it("honours a custom decimals option", () => {
    expect(formatValue(1234567, { decimals: 2 })).toBe("1.23M");
    expect(formatValue(1234567, { decimals: 0 })).toBe("1M");
  });

  it("places the currency symbol after the sign, before the number", () => {
    expect(formatValue(1500000, { currency: "$" })).toBe("$1.5M");
    expect(formatValue(-1500000, { currency: "$" })).toBe("-$1.5M");
  });

  it("uses locale thousands grouping when compact is off", () => {
    expect(formatValue(1234567, { compact: false })).toBe("1,234,567");
    expect(formatValue(-1234, { compact: false })).toBe("-1,234");
  });

  it("uses 1000 as the lowest threshold (K), not below", () => {
    expect(formatValue(1000)).toBe("1K");
    expect(formatValue(1001)).toBe("1K"); // 1.001 -> toFixed(1) 1.0 -> trim 1
  });

  it("uses the locale decimal separator in compact mode (de-DE)", () => {
    expect(formatValue(30100000, { locale: "de-DE" })).toBe("30,1M");
    expect(formatValue(2500000000, { locale: "de-DE" })).toBe("2,5B");
    expect(formatValue(35400000, { locale: "de-DE" })).toBe("35,4M");
    // Round magnitudes still trim to no decimals.
    expect(formatValue(30000000, { locale: "de-DE" })).toBe("30M");
  });

  it("uses the locale grouping separator when compact is off (de-DE)", () => {
    expect(formatValue(1234567, { compact: false, locale: "de-DE" })).toBe("1.234.567");
    expect(formatValue(-1234, { compact: false, locale: "de-DE" })).toBe("-1.234");
  });

  it("groups the scaled magnitude with the locale separator (de-DE compact)", () => {
    // 1.2345 trillion -> 1.234,5 B in de-DE notation (grouping + decimal both localized).
    expect(formatValue(1234500000000, { locale: "de-DE" })).toBe("1.234,5B");
    // en-US groups the same magnitude with comma + dot.
    expect(formatValue(1234500000000)).toBe("1,234.5B");
  });

  it("accepts localized compact suffixes", () => {
    const de = { B: "Mrd.", M: "Mio.", K: "Tsd." };
    expect(formatValue(30100000, { locale: "de-DE", compactSuffixes: de })).toBe("30,1Mio.");
    expect(formatValue(2500000000, { locale: "de-DE", compactSuffixes: de })).toBe("2,5Mrd.");
    expect(formatValue(111000, { locale: "de-DE", compactSuffixes: de })).toBe("111Tsd.");
    // Suffix override works independently of locale too.
    expect(formatValue(1500000, { compactSuffixes: de })).toBe("1.5Mio.");
  });

  it("guards non-finite input with 'n/a'", () => {
    // Regression: these used to print "NaN" and "∞B" straight onto the page.
    expect(formatValue(NaN)).toBe("n/a");
    expect(formatValue(Infinity)).toBe("n/a");
    expect(formatValue(-Infinity)).toBe("n/a");
    // Options never re-introduce a unit or currency for a missing number.
    expect(formatValue(NaN, { currency: "$" })).toBe("n/a");
    expect(formatValue(Infinity, { compact: false, locale: "de-DE" })).toBe("n/a");
  });

  it("keeps en-US default output byte-identical (regression guard)", () => {
    expect(formatValue(1234)).toBe("1.2K");
    expect(formatValue(30100000)).toBe("30.1M");
    expect(formatValue(2500000000)).toBe("2.5B");
    expect(formatValue(30000000)).toBe("30M");
    expect(formatValue(-111000)).toBe("-111K");
    expect(formatValue(1500000, { currency: "$" })).toBe("$1.5M");
    expect(formatValue(1234567, { compact: false })).toBe("1,234,567");
  });
});

describe("formatSigned", () => {
  it("always shows an explicit + or - sign", () => {
    expect(formatSigned(1100000)).toBe("+1.1M");
    expect(formatSigned(-306000)).toBe("-306K");
  });

  it("shows no sign for zero", () => {
    expect(formatSigned(0)).toBe("0");
  });

  it("puts the sign before the currency symbol", () => {
    expect(formatSigned(-306000, { currency: "€" })).toBe("-€306K");
    expect(formatSigned(1100000, { currency: "€" })).toBe("+€1.1M");
  });

  it("guards non-finite input with an UNSIGNED 'n/a'", () => {
    expect(formatSigned(NaN)).toBe("n/a");
    expect(formatSigned(Infinity)).toBe("n/a");
    expect(formatSigned(-Infinity)).toBe("n/a");
    // No "+n/a" / "-n/a", and no currency symbol on a missing number.
    expect(formatSigned(Infinity, { currency: "€" })).toBe("n/a");
  });
});

describe("formatPercent", () => {
  it("turns a fraction into an explicit-signed percent", () => {
    expect(formatPercent(0.175)).toBe("+17.5%");
    expect(formatPercent(-1)).toBe("-100.0%");
  });

  it("renders zero without a sign", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("respects the decimals argument", () => {
    expect(formatPercent(0.12345, 2)).toBe("+12.35%");
    expect(formatPercent(0.12345, 0)).toBe("+12%");
  });

  it("guards null / non-finite input with 'n/a'", () => {
    expect(formatPercent(null)).toBe("n/a");
    expect(formatPercent(Infinity)).toBe("n/a");
    expect(formatPercent(-Infinity)).toBe("n/a");
    expect(formatPercent(NaN)).toBe("n/a");
  });
});

describe("formatPercentPlain", () => {
  it("groups thousands and omits the % suffix", () => {
    expect(formatPercentPlain(0.069)).toBe("+6.9");
    expect(formatPercentPlain(-1)).toBe("-100.0");
    expect(formatPercentPlain(17.279)).toBe("+1,727.9");
  });

  it("guards null / non-finite input with 'n/a'", () => {
    expect(formatPercentPlain(null)).toBe("n/a");
    expect(formatPercentPlain(Infinity)).toBe("n/a");
    expect(formatPercentPlain(NaN)).toBe("n/a");
  });

  it("respects a custom decimals count", () => {
    expect(formatPercentPlain(0.12345, 2)).toBe("+12.35");
  });
});

/* ------------------------------------------------------------------ *
 * 1.5 - exact decimals, locale-correct percents, intervals.
 * ------------------------------------------------------------------ */

describe("formatValue - exact fractionDigits", () => {
  it("keeps trailing zeros so one column never mixes 10 with 10.0 (en-US)", () => {
    const one = { compact: false, fractionDigits: 1 };
    expect(formatValue(10, one)).toBe("10.0");
    expect(formatValue(9.996, one)).toBe("10.0");
    expect(formatValue(23.609, one)).toBe("23.6");
    const two = { compact: false, fractionDigits: 2 };
    expect(formatValue(914.3013, two)).toBe("914.30");
    expect(formatValue(914.3, two)).toBe("914.30");
    expect(formatValue(6847.09, two)).toBe("6,847.09");
  });

  it("writes sr-Latn with a decimal comma and a thousands dot", () => {
    const sr = { compact: false, locale: "sr-Latn", fractionDigits: 2 };
    expect(formatValue(914.3013, sr)).toBe("914,30");
    expect(formatValue(6847.09, sr)).toBe("6.847,09");
    expect(formatValue(1234567.891, sr)).toBe("1.234.567,89");
    expect(formatValue(10, { ...sr, fractionDigits: 1 })).toBe("10,0");
    expect(formatValue(-2.8818, sr)).toBe("-2,88");
  });

  it("honours every digit count from 0 to 3", () => {
    const v = 1234.5678;
    expect(formatValue(v, { compact: false, fractionDigits: 0 })).toBe("1,235");
    expect(formatValue(v, { compact: false, fractionDigits: 1 })).toBe("1,234.6");
    expect(formatValue(v, { compact: false, fractionDigits: 2 })).toBe("1,234.57");
    expect(formatValue(v, { compact: false, fractionDigits: 3 })).toBe("1,234.568");
    const sr = { compact: false, locale: "sr-Latn" };
    expect(formatValue(v, { ...sr, fractionDigits: 0 })).toBe("1.235");
    expect(formatValue(v, { ...sr, fractionDigits: 1 })).toBe("1.234,6");
    expect(formatValue(v, { ...sr, fractionDigits: 2 })).toBe("1.234,57");
    expect(formatValue(v, { ...sr, fractionDigits: 3 })).toBe("1.234,568");
  });

  it("applies in compact mode: to scaled magnitudes and to values under 1,000", () => {
    expect(formatValue(1200000, { fractionDigits: 2 })).toBe("1.20M");
    expect(formatValue(30000000, { fractionDigits: 1 })).toBe("30.0M");
    expect(formatValue(999, { fractionDigits: 2 })).toBe("999.00");
    expect(formatValue(12.4, { fractionDigits: 1 })).toBe("12.4");
    expect(formatValue(1200000, { fractionDigits: 2, locale: "sr-Latn" })).toBe("1,20M");
    // fractionDigits wins over the compact `decimals` maximum.
    expect(formatValue(1234567, { decimals: 0, fractionDigits: 2 })).toBe("1.23M");
  });

  it("rounds half away from zero on the number as it reads (15 significant digits)", () => {
    const d = (n: number, fractionDigits: number) =>
      formatValue(n, { compact: false, fractionDigits });
    // Exact binary ties.
    expect(d(0.125, 2)).toBe("0.13");
    expect(d(2.5, 0)).toBe("3");
    expect(d(0.5, 0)).toBe("1");
    expect(d(1.5, 0)).toBe("2");
    expect(d(-2.5, 0)).toBe("-3");
    expect(d(-0.125, 2)).toBe("-0.13");
    // Decimal ties that are not exact in binary still round up, like Intl
    // (Number#toFixed would give 1.00, 9.99, 914.30 and 1.4 here).
    expect(d(1.005, 2)).toBe("1.01");
    expect(d(9.995, 2)).toBe("10.00");
    expect(d(914.305, 2)).toBe("914.31");
    expect(d(1.45, 1)).toBe("1.5");
    // Just below a tie rounds down.
    expect(d(0.124999, 2)).toBe("0.12");
    expect(d(2.4999, 0)).toBe("2");
  });

  it("writes a value that rounds to zero without a sign", () => {
    const two = { compact: false, fractionDigits: 2 };
    expect(formatValue(-0.001, two)).toBe("0.00");
    expect(formatValue(-0.004999, two)).toBe("0.00");
    expect(formatValue(-0.005, two)).toBe("-0.01");
    expect(formatValue(-0, two)).toBe("0.00");
    expect(formatValue(-0.4, { fractionDigits: 0 })).toBe("0");
    // The 1.4 path is untouched: it has always written "-0" here.
    expect(formatValue(-0.4)).toBe("-0");
  });

  it("keeps currency and suffix around the exact digits", () => {
    expect(formatValue(-1500000, { currency: "€", fractionDigits: 2 })).toBe("-€1.50M");
    expect(formatValue(0.14, { compact: false, suffix: "%", fractionDigits: 2 })).toBe("0.14%");
    expect(
      formatValue(0.14, { compact: false, suffix: "%", fractionDigits: 2, locale: "sr-Latn" }),
    ).toBe("0,14%");
  });

  it("rounds and clamps a digit count outside 0-20; NaN means unset", () => {
    expect(formatValue(1.23456, { compact: false, fractionDigits: 1.6 })).toBe("1.23");
    expect(formatValue(1.5, { compact: false, fractionDigits: -3 })).toBe("2");
    // Clamped to 20 digits; Intl pads the number as written (0.1), not its binary expansion.
    expect(formatValue(0.1, { compact: false, fractionDigits: 99 })).toBe("0.10000000000000000000");
    expect(formatValue(1.5, { compact: false, fractionDigits: NaN })).toBe("1.5");
  });

  it("writes notAvailable in place of a non-finite number", () => {
    expect(formatValue(NaN, { notAvailable: "—" })).toBe("—");
    expect(formatValue(Infinity, { fractionDigits: 2, notAvailable: "n/p" })).toBe("n/p");
    expect(formatSigned(-Infinity, { notAvailable: "—" })).toBe("—");
  });

  it("leaves the 1.4 output unchanged when fractionDigits is unset", () => {
    expect(formatValue(914.3)).toBe("914");
    expect(formatValue(914.3, { compact: false })).toBe("914.3");
    expect(formatValue(10, { compact: false })).toBe("10");
    expect(formatValue(1234.5678, { compact: false, locale: "sr-Latn" })).toBe("1.234,568");
  });
});

describe("formatSigned - exact fractionDigits", () => {
  it("signs with exact digits in both locales", () => {
    const two = { compact: false, fractionDigits: 2 };
    expect(formatSigned(3.4573, two)).toBe("+3.46");
    expect(formatSigned(-2.8818, two)).toBe("-2.88");
    expect(formatSigned(0.0623, two)).toBe("+0.06");
    expect(formatSigned(-2.8818, { ...two, locale: "sr-Latn" })).toBe("-2,88");
    expect(formatSigned(1234.5, { ...two, locale: "sr-Latn" })).toBe("+1.234,50");
  });

  it("leaves a value that rounds to zero unsigned, and zero itself", () => {
    const two = { compact: false, fractionDigits: 2 };
    expect(formatSigned(0.001, two)).toBe("0.00");
    expect(formatSigned(-0.001, two)).toBe("0.00");
    expect(formatSigned(0, two)).toBe("0.00");
    expect(formatSigned(0.005, two)).toBe("+0.01");
    // 1.4 path: unchanged ("+0" for a small positive).
    expect(formatSigned(0.4)).toBe("+0");
  });

  it("keeps the sign before the currency with exact digits", () => {
    expect(formatSigned(-306000, { currency: "€", fractionDigits: 1 })).toBe("-€306.0K");
  });
});

describe("formatInterval", () => {
  const NB = "\u00a0";
  it("writes value ± half-width with the same digits, joined by no-break spaces", () => {
    const two = { compact: false, fractionDigits: 2 };
    expect(formatInterval(910.7916, 0.7605, two)).toBe(`910.79${NB}±${NB}0.76`);
    expect(formatInterval(914.3013, 0.4682, { ...two, locale: "sr-Latn" })).toBe(
      `914,30${NB}±${NB}0,47`,
    );
  });

  it("signs a difference when asked", () => {
    const two = { compact: false, fractionDigits: 2 };
    expect(formatInterval(-2.8818, 0.5439, two, true)).toBe(`-2.88${NB}±${NB}0.54`);
    expect(formatInterval(3.4573, 0.4621, two, true)).toBe(`+3.46${NB}±${NB}0.46`);
    expect(formatInterval(0, 0, two, true)).toBe(`0.00${NB}±${NB}0.00`);
  });

  it("drops a missing or invalid half-width and writes notAvailable for a missing value", () => {
    const two = { compact: false, fractionDigits: 2, notAvailable: "—" };
    expect(formatInterval(1.5, undefined, two)).toBe("1.50");
    expect(formatInterval(1.5, -0.1, two)).toBe("1.50");
    expect(formatInterval(1.5, NaN, two)).toBe("1.50");
    expect(formatInterval(NaN, 0.1, two)).toBe("—");
  });
});

describe("formatPercent - options form", () => {
  it("writes the locale's separators and percent sign", () => {
    expect(formatPercent(0.175, { locale: "en-US" })).toBe("+17.5%");
    expect(formatPercent(0.175, { locale: "sr-Latn" })).toBe("+17,5%");
    expect(formatPercent(0.175, { locale: "de-DE" })).toBe("+17,5\u00a0%");
    expect(formatPercent(0.175, { locale: "tr-TR" })).toBe("+%17,5");
    expect(formatPercent(-0.0014, { locale: "sr-Latn", fractionDigits: 2 })).toBe("-0,14%");
    expect(formatPercent(17.279, { locale: "en-US" })).toBe("+1,727.9%");
    expect(formatPercent(17.279, { locale: "sr-Latn" })).toBe("+1.727,9%");
  });

  it("keeps exactly the digits asked for, trailing zeros included", () => {
    expect(formatPercent(0.1, { fractionDigits: 0 })).toBe("+10%");
    expect(formatPercent(0.1, { fractionDigits: 1 })).toBe("+10.0%");
    expect(formatPercent(0.1, { fractionDigits: 2 })).toBe("+10.00%");
    expect(formatPercent(0.09996, { fractionDigits: 1 })).toBe("+10.0%");
  });

  it("rounds half away from zero, symmetric for losses", () => {
    expect(formatPercent(0.0125, { fractionDigits: 1 })).toBe("+1.3%");
    expect(formatPercent(-0.0125, { fractionDigits: 1 })).toBe("-1.3%");
    expect(formatPercent(0.00125, { fractionDigits: 2 })).toBe("+0.13%");
    expect(formatPercent(0.01249, { fractionDigits: 1 })).toBe("+1.2%");
  });

  it("leaves zero, and a value that rounds to zero, unsigned", () => {
    expect(formatPercent(0, {})).toBe("0.0%");
    expect(formatPercent(0.0004, {})).toBe("0.0%");
    expect(formatPercent(-0.0004, {})).toBe("0.0%");
    // The 1.4 numeric form still signs it.
    expect(formatPercent(0.0004)).toBe("+0.0%");
  });

  it("writes only the minus with signDisplay auto (shares)", () => {
    expect(formatPercent(0.4, { signDisplay: "auto" })).toBe("40.0%");
    expect(formatPercent(-0.4, { signDisplay: "auto" })).toBe("-40.0%");
  });

  it("writes notAvailable for a missing ratio", () => {
    expect(formatPercent(null, { notAvailable: "—" })).toBe("—");
    expect(formatPercent(NaN, {})).toBe("n/a");
  });
});

describe("formatPercentPlain - options form", () => {
  it("follows the locale, keeps exact digits and leaves a rounded zero unsigned", () => {
    expect(formatPercentPlain(0.069, { locale: "sr-Latn" })).toBe("+6,9");
    expect(formatPercentPlain(17.279, { locale: "sr-Latn" })).toBe("+1.727,9");
    expect(formatPercentPlain(0.069, { fractionDigits: 2 })).toBe("+6.90");
    expect(formatPercentPlain(-0.0004, {})).toBe("0.0");
    expect(formatPercentPlain(null, { notAvailable: "—" })).toBe("—");
  });
});

describe("percentFormatOf", () => {
  it("returns the 1.4 decimals when the format opts into nothing", () => {
    expect(percentFormatOf({})).toBe(1);
    expect(percentFormatOf({ compact: false, currency: "€", suffix: "x", decimals: 2 })).toBe(1);
  });

  it("returns options carrying the locale, percent digits and notAvailable otherwise", () => {
    expect(percentFormatOf({ locale: "sr-Latn" })).toEqual({
      locale: "sr-Latn",
      fractionDigits: 1,
      notAvailable: undefined,
    });
    expect(percentFormatOf({ fractionDigits: 2 })).toEqual({
      locale: undefined,
      fractionDigits: 1,
      notAvailable: undefined,
    });
    expect(percentFormatOf({ percentFractionDigits: 2, notAvailable: "—" }, "auto")).toEqual({
      locale: undefined,
      fractionDigits: 2,
      notAvailable: "—",
      signDisplay: "auto",
    });
  });
});

describe("the 'Numbers and words' docs page, verbatim", () => {
  it("its table of fractionDigits", () => {
    const one = { compact: false, fractionDigits: 1 };
    const sr2 = { compact: false, fractionDigits: 2, locale: "sr-Latn" };
    const compact2 = { fractionDigits: 2 };
    expect([9.996, 914.3013, 6847.09].map((v) => formatValue(v, one))).toEqual([
      "10.0",
      "914.3",
      "6,847.1",
    ]);
    expect([9.996, 914.3013, 6847.09].map((v) => formatValue(v, sr2))).toEqual([
      "10,00",
      "914,30",
      "6.847,09",
    ]);
    expect([9.996, 914.3013, 6847.09].map((v) => formatValue(v, compact2))).toEqual([
      "10.00",
      "914.30",
      "6.85K",
    ]);
  });

  it("its examples", () => {
    const NB = "\u00a0";
    const sr = { compact: false, locale: "sr-Latn", fractionDigits: 2 };
    expect(formatValue(914.3013, sr)).toBe("914,30");
    expect(formatPercent(0.0014, { locale: "sr-Latn", fractionDigits: 2 })).toBe("+0,14%");
    expect(formatInterval(910.7916, 0.7605, sr)).toBe(`910,79${NB}±${NB}0,76`);
    expect(formatInterval(-2.8818, 0.5439, sr, true)).toBe(`-2,88${NB}±${NB}0,54`);
    expect(formatPercent(0.175, { locale: "sr-Latn" })).toBe("+17,5%");
    expect(formatPercent(0.175, { locale: "de-DE" })).toBe(`+17,5${NB}%`);
    expect(formatPercent(0.175)).toBe("+17.5%");
    expect(formatInterval(914.3013, 0.004, sr)).toBe(`914,30${NB}±${NB}0,004`);
    expect(formatInterval(914.3013, 0.4682)).toBe(`914.30${NB}±${NB}0.47`);
    expect(formatInterval(12345, 234, { fractionDigits: 2 })).toBe(`12.35K${NB}±${NB}0.23K`);
  });

  it("its rounding paragraph", () => {
    expect(formatValue(1.005, { compact: false, fractionDigits: 2 })).toBe("1.01");
    expect(formatValue(2.5, { compact: false, fractionDigits: 0 })).toBe("3");
    expect(formatValue(-2.5, { compact: false, fractionDigits: 0 })).toBe("-3");
    expect(0.145 * 100).toBe(14.499999999999998);
    expect(formatValue(0.145 * 100, { compact: false, fractionDigits: 0 })).toBe("15");
    expect((1.005).toFixed(2)).toBe("1.00");
    expect(formatValue(-0.001, { compact: false, fractionDigits: 2 })).toBe("0.00");
    expect(formatValue(999.996, { fractionDigits: 2 })).toBe("1.00K");
    expect(formatValue(12345678901234.56, { compact: false, fractionDigits: 2 })).toBe(
      "12,345,678,901,234.56",
    );
  });

  it("its percent table: the four changes once a format sets one of the four options", () => {
    const NB = "\u00a0";
    const en = percentFormatOf({ locale: "en-US" });
    expect(formatPercent(0.175, 1)).toBe("+17.5%");
    expect(formatPercent(0.175, percentFormatOf({ locale: "sr-Latn" }))).toBe("+17,5%");
    expect(formatPercent(0.175, percentFormatOf({ locale: "de-DE" }))).toBe(`+17,5${NB}%`);
    expect(formatPercent(0.0004, 1)).toBe("+0.0%");
    expect(formatPercent(0.0004, en)).toBe("0.0%");
    expect(formatPercent(0.0115, 1)).toBe("+1.1%");
    expect(formatPercent(0.0115, en)).toBe("+1.2%");
    expect(formatPercent(17.279, 1)).toBe("+1727.9%");
    expect(formatPercent(17.279, en)).toBe("+1,727.9%");
    expect(0.0045 * 100).toBe(0.44999999999999996);
    expect(formatPercent(0.0045, en)).toBe("+0.5%");
    expect(formatPercent(0.0185, en)).toBe("+1.9%");
    expect(formatPercent(0.0045, 1)).toBe("+0.4%");
    expect(formatPercent(0.0185, 1)).toBe("+1.8%");
  });
});

/* ------------------------------------------------------------------ *
 * 1.5 round 2 - ties as the number reads, intervals that never write a
 * positive half-width as zero, compact unit promotion.
 * ------------------------------------------------------------------ */

describe("percent ties round half up as the number reads (options form)", () => {
  it("rounds every one-digit tie 0.05 % … 199.95 % up", () => {
    const wrong: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const fraction = Number(`${10 * i + 5}e-4`); // 0.0005, 0.0015, … from decimal text
      const expected = `+${((i + 1) / 10).toFixed(1)}%`;
      const got = formatPercent(fraction, { fractionDigits: 1 });
      if (got !== expected) wrong.push(`${fraction} → ${got} (want ${expected})`);
    }
    expect(wrong).toEqual([]);
  });

  it("rounds every two-digit tie 0.005 % … 19.995 % up, in sr-Latn too", () => {
    const wrong: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const fraction = Number(`${10 * i + 5}e-5`);
      const expected = `+${((i + 1) / 100).toFixed(2).replace(".", ",")}%`;
      const got = formatPercent(fraction, { fractionDigits: 2, locale: "sr-Latn" });
      if (got !== expected) wrong.push(`${fraction} → ${got} (want ${expected})`);
    }
    expect(wrong).toEqual([]);
  });

  it("gives the review's cases and survives a ×100 / ÷100 round trip", () => {
    expect(formatPercent(0.0045, { fractionDigits: 1 })).toBe("+0.5%");
    expect(formatPercent(0.0185, { fractionDigits: 1 })).toBe("+1.9%");
    expect(formatPercent(-0.0045, { fractionDigits: 1 })).toBe("-0.5%");
    expect(formatPercentPlain(0.0045, { fractionDigits: 1 })).toBe("+0.5");
    // A table cell stores percent units and divides back: 0.44999999999999996 / 100.
    expect(formatPercentPlain((0.0045 * 100) / 100, { fractionDigits: 1 })).toBe("+0.5");
  });

  it("leaves the 1.4 numeric form byte-identical, binary rounding included", () => {
    expect(formatPercent(0.0045)).toBe("+0.4%");
    expect(formatPercent(0.0185)).toBe("+1.8%");
    expect(formatPercentPlain(0.0045)).toBe("+0.4");
  });
});

describe("values: ties at 15 significant digits, compact units promoted", () => {
  it("rounds a computed tie the way it reads", () => {
    // 0.145 * 100 is 14.499999999999998 in binary.
    expect(formatValue(0.145 * 100, { compact: false, fractionDigits: 0 })).toBe("15");
    expect(formatValue(1.005, { compact: false, fractionDigits: 2 })).toBe("1.01");
  });

  it("moves a compact value to the next unit when rounding reaches 1,000", () => {
    expect(formatValue(999.994, { fractionDigits: 2 })).toBe("999.99");
    expect(formatValue(999.996, { fractionDigits: 2 })).toBe("1.00K");
    expect(formatValue(999999.6, { fractionDigits: 2 })).toBe("1.00M");
    expect(formatValue(-999.996, { fractionDigits: 2 })).toBe("-1.00K");
    expect(formatValue(999.996, { compact: false, fractionDigits: 2 })).toBe("1,000.00");
    // The 1.4 path keeps its own rounding.
    expect(formatValue(999.6)).toBe("1000");
  });
});

describe("formatInterval - a positive half-width is never written as zero", () => {
  const NB = "\u00a0";

  it("writes both numbers in full at two figures of the half-width when no digits are set", () => {
    expect(formatInterval(914.3013, 0.4682, {})).toBe(`914.30${NB}±${NB}0.47`);
    expect(formatInterval(3.4573, 0.4621, {}, true)).toBe(`+3.46${NB}±${NB}0.46`);
    expect(formatInterval(12345, 234, {})).toBe(`12,345${NB}±${NB}234`);
    expect(formatInterval(5, 0.004, {})).toBe(`5.0000${NB}±${NB}0.0040`);
    expect(formatInterval(914.3013, 0.4682, { locale: "sr-Latn" })).toBe(`914,30${NB}±${NB}0,47`);
    expect(formatInterval(5, 0, {})).toBe(`5${NB}±${NB}0`);
  });

  it("keeps the value's exact digits and gives the half-width its first figure", () => {
    const two = { compact: false, fractionDigits: 2 };
    expect(formatInterval(914.3013, 0.004, two)).toBe(`914.30${NB}±${NB}0.004`);
    expect(formatInterval(914.3013, 0.0004, two)).toBe(`914.30${NB}±${NB}0.0004`);
    expect(formatInterval(914.3013, 0.4682, two)).toBe(`914.30${NB}±${NB}0.47`);
    expect(formatInterval(-2.8818, 0.004, two, true)).toBe(`-2.88${NB}±${NB}0.004`);
  });

  it("writes the half-width in the value's compact unit", () => {
    expect(formatInterval(12345, 234, { fractionDigits: 2 })).toBe(`12.35K${NB}±${NB}0.23K`);
    expect(formatInterval(12345, 1, { fractionDigits: 2 })).toBe(`12.35K${NB}±${NB}0.001K`);
    expect(formatInterval(1.5e6, 2.5e4, { fractionDigits: 1, currency: "€" })).toBe(
      `€1.5M${NB}±${NB}€0.03M`,
    );
    expect(formatInterval(250, 0.5, { fractionDigits: 1 })).toBe(`250.0${NB}±${NB}0.5`);
  });
});

describe("formatPercentInterval", () => {
  const NB = "\u00a0";
  it("writes the half-width unsigned, at least to its first figure", () => {
    expect(formatPercentInterval(0.069, 0.004, { locale: "sr-Latn" }, false)).toBe(
      `+6,9${NB}±${NB}0,4`,
    );
    expect(formatPercentInterval(0.069, 0.0004, { locale: "sr-Latn" }, false)).toBe(
      `+6,9${NB}±${NB}0,04`,
    );
    expect(formatPercentInterval(0.004, 0.005, 1, true)).toBe(`+0.4%${NB}±${NB}0.5%`);
    expect(formatPercentInterval(null, 0.005, 1, true)).toBe("n/a");
    expect(formatPercentInterval(0.069, undefined, 1, false)).toBe("+6.9");
  });
});

describe("the 15-digit step removes noise and never rounds a written digit", () => {
  const nf = (digits: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  it("writes a value with 15 or more written digits as Intl writes the double", () => {
    // 16 and 17 written digits: 15-digit rounding would end "…234.60" and "…460".
    expect(formatValue(12345678901234.56, { compact: false, fractionDigits: 2 })).toBe(
      "12,345,678,901,234.56",
    );
    expect(formatValue(1234567890123456, { compact: false, fractionDigits: 0 })).toBe(
      "1,234,567,890,123,456",
    );
    expect(formatValue(-12345678901234.56, { compact: false, fractionDigits: 2 })).toBe(
      "-12,345,678,901,234.56",
    );
    expect(formatPercent(123456789012.3456, { fractionDigits: 2 })).toBe("+12,345,678,901,234.56%");
    expect(formatPercentPlain(123456789012.3456, { fractionDigits: 2 })).toBe(
      "+12,345,678,901,234.56",
    );
    // Exactly 15 written digits: 15-digit rounding would round the last written
    // digit on the binary value (…987.644531… → "…987.64").
    expect(formatValue(9876543210987.645, { compact: false, fractionDigits: 2 })).toBe(
      nf(2).format(9876543210987.645),
    );
    expect(formatValue(9876543210987.645, { compact: false, fractionDigits: 2 })).toBe(
      "9,876,543,210,987.65",
    );
    expect(formatValue(123456789012.3445, { compact: false, fractionDigits: 3 })).toBe(
      "123,456,789,012.345",
    );
  });

  it("still drops binary noise when a guard digit is left", () => {
    // 14.499999999999998: Intl alone writes "14"; the 15-digit step writes "15".
    expect(nf(0).format(0.145 * 100)).toBe("14");
    expect(formatValue(0.145 * 100, { compact: false, fractionDigits: 0 })).toBe("15");
  });
});
