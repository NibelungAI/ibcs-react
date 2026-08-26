/**
 * IBCS visual grammar as tokens. Everything is overridable so a strict-IBCS
 * user can swap green/red for the black/red "good = neutral" convention, and
 * so the lib can be themed for dark mode by the caller.
 *
 * Defaults are tuned for a light surface — but the surface itself is a token
 * (`color.surface`), so a dark theme is a preset swap, not a fork.
 */

export interface IbcsScenarioStyle {
  fill: string;
  stroke: string;
  /** "solid" | "frame" (outline) | "hatch". Drives chart column rendering. */
  variant: "solid" | "frame" | "hatch";
}

export interface IbcsTokens {
  color: {
    /** Neutral actual bars (add/subtract steps). */
    neutral: string;
    /** Emphasised actual bars (subtotals / results). */
    total: string;
    /** Favorable variance. */
    good: string;
    /** Unfavorable variance. */
    bad: string;
    /** Zero / no change. */
    zero: string;
    axis: string;
    gridline: string;
    text: string;
    textMuted: string;
    rowBorder: string;
    /**
     * Opaque component background — cards, menus, tooltips, sticky table cells
     * and the fill of hollow (plan) scenario shapes, which must hide whatever
     * they overlap. This is what makes a dark theme possible: without it the
     * chrome is white on a dark page.
     */
    surface: string;
    /** Subtle fill on top of {@link surface}: skeleton bars, zebra rows, tints. */
    surfaceMuted: string;
    /**
     * Ink drawn ON a solid scenario bar (in-bar value labels). It has to
     * contrast with the bar fill, not with the page: light themes paint dark
     * bars and near-white labels, dark themes the other way round.
     */
    onFill: string;
  };
  scenario: Record<import("./types").ScenarioKey, IbcsScenarioStyle>;
  font: {
    /** Font stack for every component's own chrome and SVG text. */
    family: string;
  };
}

/** The system UI stack the components have always drawn with. */
const UI_FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

export const defaultTokens: IbcsTokens = {
  color: {
    neutral: "#7a7973",
    total: "#54534e",
    // Favorable: a clear, balanced green (not olive/yellow-green) so it reads
    // unambiguously "good" and carries visual weight comparable to `bad`.
    good: "#3f8f4f",
    bad: "#cf3a3a",
    zero: "#9a9992",
    axis: "#c9c8c2",
    gridline: "#eceae4",
    text: "#2b2b29",
    textMuted: "#6b6a64",
    rowBorder: "#e6e5e0",
    surface: "#fff",
    surfaceMuted: "#e7e6e1",
    onFill: "#fff",
  },
  scenario: {
    // Actual: solid, dark — "this is real".
    AC: { fill: "#54534e", stroke: "#54534e", variant: "solid" },
    // Previous year: solid, faded grey — "the past".
    PY: { fill: "#bdbcb6", stroke: "#bdbcb6", variant: "solid" },
    // Plan / budget: hollow frame — "not real yet".
    PL: { fill: "transparent", stroke: "#54534e", variant: "frame" },
    // Forecast: hatched — "expected".
    FC: { fill: "transparent", stroke: "#54534e", variant: "hatch" },
  },
  font: { family: UI_FONT_FAMILY },
};

/**
 * Strict-IBCS / business green-red variant: darker actual bars and vivid
 * green/red variance — the classic "good stands out, bad stands out" look.
 */
export const greenRedTokens: IbcsTokens = {
  ...defaultTokens,
  color: {
    ...defaultTokens.color,
    neutral: "#4a4a45",
    total: "#26261f",
    good: "#2e9e5b",
    bad: "#e23b3b",
  },
};

/** A more colourful theme: teal/blue actual bars, vivid variance. */
export const vividTokens: IbcsTokens = {
  ...defaultTokens,
  color: {
    ...defaultTokens.color,
    neutral: "#3b82a6",
    total: "#1f5e7d",
    good: "#2e9e5b",
    bad: "#e8743b",
  },
};

/**
 * "Ocean" — a cool blue-grey IBCS theme: Actual #233549 dark solid, Previous
 * year #758CA4 light solid, Forecast hatched, Plan outlined, with the IBCS
 * semantic green #178236 / red #D00A0A. A clean, standards-faithful alternative
 * to the default warm greys.
 */
export const oceanTokens: IbcsTokens = {
  color: {
    neutral: "#485E75",
    total: "#233549",
    good: "#178236",
    bad: "#D00A0A",
    zero: "#9DAEBE",
    axis: "#C5CFD9",
    gridline: "#EDF0F3",
    text: "#233549",
    textMuted: "#5B728B",
    rowBorder: "#EDF0F3",
    surface: "#fff",
    surfaceMuted: "#E4E9EE",
    onFill: "#fff",
  },
  scenario: {
    AC: { fill: "#233549", stroke: "#233549", variant: "solid" },
    PY: { fill: "#758CA4", stroke: "#758CA4", variant: "solid" },
    PL: { fill: "transparent", stroke: "#233549", variant: "frame" },
    FC: { fill: "transparent", stroke: "#233549", variant: "hatch" },
  },
  font: { family: UI_FONT_FAMILY },
};

/** "Azure" — a monochromatic bright-blue alternative. */
export const azureTokens: IbcsTokens = {
  color: {
    neutral: "#0074E2",
    total: "#003B72",
    good: "#178236",
    bad: "#D00A0A",
    zero: "#758CA4",
    axis: "#8BC7FF",
    gridline: "#EDF0F3",
    text: "#003B72",
    textMuted: "#0065C3",
    rowBorder: "#EDF0F3",
    surface: "#fff",
    surfaceMuted: "#E4EDF7",
    onFill: "#fff",
  },
  scenario: {
    AC: { fill: "#003B72", stroke: "#003B72", variant: "solid" },
    PY: { fill: "#168EFF", stroke: "#168EFF", variant: "solid" },
    PL: { fill: "transparent", stroke: "#003B72", variant: "frame" },
    FC: { fill: "transparent", stroke: "#003B72", variant: "hatch" },
  },
  font: { family: UI_FONT_FAMILY },
};

/**
 * "CVD-safe" — a colour-vision-deficiency-safe variance palette. Red/green is
 * the most common colour-blindness confusion, so favorable→teal and
 * unfavorable→orange (a CVD-distinguishable pair from the ColorBrewer Dark2 /
 * Okabe–Ito families) keep variance legible for ~8% of male viewers. Scenario
 * fills stay greyscale (IBCS distinguishes scenarios by fill, not hue) so only
 * the impact colours change.
 */
export const cvdTokens: IbcsTokens = {
  ...defaultTokens,
  color: { ...defaultTokens.color, good: "#1B9E77", bad: "#D95F02" },
};

/**
 * "Mono / print" — a greyscale palette for black-and-white printing and the
 * IBCS SIMPLIFY ideal. Favorable reads as a darker grey, unfavorable as a
 * lighter grey; combined with the signed +/- labels and hatched/framed scenario
 * fills, variance still reads without any colour.
 */
export const monoTokens: IbcsTokens = {
  color: {
    neutral: "#6e6e6e",
    total: "#2b2b2b",
    good: "#3a3a3a",
    bad: "#9a9a9a",
    zero: "#b5b5b5",
    axis: "#c8c8c8",
    gridline: "#ececec",
    text: "#1a1a1a",
    textMuted: "#666666",
    rowBorder: "#e2e2e2",
    surface: "#fff",
    surfaceMuted: "#e6e6e6",
    onFill: "#fff",
  },
  scenario: {
    AC: { fill: "#2b2b2b", stroke: "#2b2b2b", variant: "solid" },
    PY: { fill: "#bcbcbc", stroke: "#bcbcbc", variant: "solid" },
    PL: { fill: "transparent", stroke: "#2b2b2b", variant: "frame" },
    FC: { fill: "transparent", stroke: "#2b2b2b", variant: "hatch" },
  },
  font: { family: UI_FONT_FAMILY },
};

/**
 * "Dark" — an ink set tuned for dark surfaces. The components draw on a
 * transparent SVG; the caller supplies the dark page/card background, and these
 * tokens supply light-on-dark ink. Text is near-white, axis/gridline/rowBorder
 * are low-contrast light greys, and good/bad are brighter/more saturated than
 * the light theme so variance pops against a dark backdrop. Scenario fills keep
 * the IBCS solid/frame/hatch semantics: AC light solid, PY dimmer grey solid,
 * PL hollow frame, FC hatch.
 *
 * `surface`/`surfaceMuted` are the dark warm greys the chrome (cards, menus,
 * sticky cells, hollow plan fills) paints itself with, and `onFill` is DARK
 * here rather than near-white: this theme's solid bars are light, so an in-bar
 * label has to be dark ink to survive on them.
 */
export const darkTokens: IbcsTokens = {
  color: {
    neutral: "#a8a8a2",
    total: "#d7d7d2",
    good: "#4cc66a",
    bad: "#f25555",
    zero: "#7a7a74",
    axis: "#55554f",
    gridline: "#3a3a36",
    text: "#e8e8e4",
    textMuted: "#a0a09a",
    rowBorder: "#43433e",
    surface: "#262622",
    surfaceMuted: "#32322e",
    onFill: "#1f1f1c",
  },
  scenario: {
    AC: { fill: "#d7d7d2", stroke: "#d7d7d2", variant: "solid" },
    PY: { fill: "#7e7e78", stroke: "#7e7e78", variant: "solid" },
    PL: { fill: "transparent", stroke: "#d7d7d2", variant: "frame" },
    FC: { fill: "transparent", stroke: "#d7d7d2", variant: "hatch" },
  },
  font: { family: UI_FONT_FAMILY },
};

/** Named presets, handy for a theme switcher. */
export const tokenPresets: Record<string, IbcsTokens> = {
  Default: defaultTokens,
  Ocean: oceanTokens,
  Azure: azureTokens,
  "Green / Red": greenRedTokens,
  Vivid: vividTokens,
  "CVD-safe": cvdTokens,
  "Mono / print": monoTokens,
  Dark: darkTokens,
};

/**
 * Merge a partial override onto a base theme (group-by-group deep merge).
 * The base defaults to {@link defaultTokens}, so presets compose:
 * `mergeTokens({ color: { good: "#2e7d32" } }, darkTokens)`.
 */
export function mergeTokens(
  override?: IbcsTokensOverride,
  base: IbcsTokens = defaultTokens,
): IbcsTokens {
  if (!override) return base;
  return {
    color: { ...base.color, ...override.color },
    scenario: {
      AC: { ...base.scenario.AC, ...override.scenario?.AC },
      PY: { ...base.scenario.PY, ...override.scenario?.PY },
      PL: { ...base.scenario.PL, ...override.scenario?.PL },
      FC: { ...base.scenario.FC, ...override.scenario?.FC },
    },
    font: { ...base.font, ...override.font },
  };
}

/** Recursive partial — every group and leaf optional. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * The shape of the `tokens` prop every component accepts: a deep-partial
 * theme override, merged onto the active theme by {@link mergeTokens}.
 */
export type IbcsTokensOverride = DeepPartial<IbcsTokens>;
