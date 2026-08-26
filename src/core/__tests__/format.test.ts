import { describe, it, expect } from "vitest";
import { formatValue, formatSigned, formatPercent, formatPercentPlain } from "../format";

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
