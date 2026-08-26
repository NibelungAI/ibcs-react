import { describe, it, expect } from "vitest";
import { mergeTokens, defaultTokens, tokenPresets, type IbcsTokens } from "../tokens";

describe("mergeTokens", () => {
  it("returns the defaults unchanged when no override is given", () => {
    expect(mergeTokens()).toEqual(defaultTokens);
  });

  it("merges a partial color override onto the defaults", () => {
    const merged = mergeTokens({ color: { good: "#000000" } });
    expect(merged.color.good).toBe("#000000");
    // untouched keys fall back to the default
    expect(merged.color.bad).toBe(defaultTokens.color.bad);
    expect(merged.color.neutral).toBe(defaultTokens.color.neutral);
  });

  it("merges a partial font override onto the defaults", () => {
    const merged = mergeTokens({ font: { family: "Iosevka Etoile" } });
    expect(merged.font.family).toBe("Iosevka Etoile");
    // the other groups are untouched
    expect(merged.color).toEqual(defaultTokens.color);
  });

  it("keeps the base font when only colors are overridden", () => {
    const merged = mergeTokens({ color: { surface: "#101010" } }, tokenPresets.Dark);
    expect(merged.color.surface).toBe("#101010");
    expect(merged.color.surfaceMuted).toBe(tokenPresets.Dark!.color.surfaceMuted);
    expect(merged.font).toEqual(tokenPresets.Dark!.font);
    expect(merged.font).not.toBe(tokenPresets.Dark!.font);
  });

  it("merges a partial scenario override per scenario", () => {
    const merged = mergeTokens({ scenario: { AC: { fill: "#123456" } } });
    expect(merged.scenario.AC.fill).toBe("#123456");
    // other props of AC fall back to default
    expect(merged.scenario.AC.variant).toBe(defaultTokens.scenario.AC.variant);
    // other scenarios untouched
    expect(merged.scenario.PY).toEqual(defaultTokens.scenario.PY);
  });

  it("does not mutate the defaults", () => {
    const snapshot = JSON.parse(JSON.stringify(defaultTokens));
    mergeTokens({
      color: { good: "#abcabc", surface: "#000" },
      scenario: { AC: { fill: "#000" } },
      font: { family: "Comic Sans MS" },
    });
    expect(defaultTokens).toEqual(snapshot);
  });

  it("produces a fresh object (not the defaults reference) when merging", () => {
    const merged = mergeTokens({ color: { good: "#fff" } });
    expect(merged).not.toBe(defaultTokens);
    expect(merged.color).not.toBe(defaultTokens.color);
  });
});

/** Rough relative brightness (0 black → 1 white) of a "#rgb" / "#rrggbb" colour. */
function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join(""); // #rgb → #rrggbb
  const n = parseInt(h, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

describe("tokenPresets", () => {
  it("contains the expected named themes", () => {
    for (const name of [
      "Default",
      "Ocean",
      "Azure",
      "Green / Red",
      "Vivid",
      "CVD-safe",
      "Mono / print",
      "Dark",
    ]) {
      expect(tokenPresets[name]).toBeDefined();
    }
  });

  it("exposes Default as the default token set", () => {
    expect(tokenPresets.Default).toBe(defaultTokens);
  });

  it("gives every preset the full token shape: colors, scenarios and a font", () => {
    // Derived from the defaults, so a new token key is automatically demanded of
    // every preset instead of silently shipping `undefined` in one of them.
    const colorKeys = Object.keys(defaultTokens.color) as Array<keyof IbcsTokens["color"]>;
    const fontKeys = Object.keys(defaultTokens.font) as Array<keyof IbcsTokens["font"]>;
    for (const [name, tokens] of Object.entries(tokenPresets)) {
      for (const k of colorKeys) {
        expect(typeof tokens.color[k], `${name}.color.${k}`).toBe("string");
        expect(tokens.color[k], `${name}.color.${k}`).not.toBe("");
      }
      for (const k of fontKeys) {
        expect(typeof tokens.font[k], `${name}.font.${k}`).toBe("string");
      }
      for (const scn of ["AC", "PY", "PL", "FC"] as const) {
        expect(tokens.scenario[scn], `${name}.scenario.${scn}`).toBeDefined();
        expect(typeof tokens.scenario[scn].fill, `${name}.scenario.${scn}.fill`).toBe("string");
        expect(typeof tokens.scenario[scn].stroke, `${name}.scenario.${scn}.stroke`).toBe("string");
        expect(["solid", "frame", "hatch"], `${name}.scenario.${scn}.variant`).toContain(
          tokens.scenario[scn].variant,
        );
      }
    }
  });

  it("keeps every light preset on a white surface and every ink readable on it", () => {
    for (const name of [
      "Default",
      "Ocean",
      "Azure",
      "Green / Red",
      "Vivid",
      "CVD-safe",
      "Mono / print",
    ]) {
      expect(tokenPresets[name]!.color.surface, `${name}.color.surface`).toBe("#fff");
      expect(tokenPresets[name]!.color.onFill, `${name}.color.onFill`).toBe("#fff");
    }
  });

  it("inverts the Dark preset: dark surfaces, and in-bar ink dark enough for its light bars", () => {
    const dark = tokenPresets.Dark!;
    // Its chrome is not white — that was the whole bug.
    expect(dark.color.surface).not.toBe("#fff");
    expect(dark.color.surfaceMuted).not.toBe("#fff");
    expect(luminance(dark.color.surface)).toBeLessThan(0.25);
    expect(luminance(dark.color.surfaceMuted)).toBeLessThan(0.35);
    // The muted fill has to read as a step above the surface, not below it.
    expect(luminance(dark.color.surfaceMuted)).toBeGreaterThan(luminance(dark.color.surface));
    // Dark theme = LIGHT solid bars, so a label drawn on one must be dark ink.
    expect(luminance(dark.scenario.AC.fill)).toBeGreaterThan(0.5);
    expect(luminance(dark.color.onFill)).toBeLessThan(0.25);
  });

  it("models the IBCS scenario variants: AC solid, PL frame, FC hatch", () => {
    // Default and Ocean both follow the IBCS scenario-fill grammar.
    for (const name of ["Default", "Ocean", "Azure", "Mono / print"]) {
      const t = tokenPresets[name]!;
      expect(t.scenario.AC.variant).toBe("solid");
      expect(t.scenario.PY.variant).toBe("solid");
      expect(t.scenario.PL.variant).toBe("frame");
      expect(t.scenario.FC.variant).toBe("hatch");
    }
  });

  it("keeps CVD-safe scenario fills greyscale-identical to default (only impact hues change)", () => {
    expect(tokenPresets["CVD-safe"]!.scenario).toEqual(defaultTokens.scenario);
    expect(tokenPresets["CVD-safe"]!.color.good).not.toBe(defaultTokens.color.good);
    expect(tokenPresets["CVD-safe"]!.color.bad).not.toBe(defaultTokens.color.bad);
  });
});
