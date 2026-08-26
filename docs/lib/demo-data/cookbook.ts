/**
 * Shared shorthands for the Report cookbook demos: a width budget, a few
 * format presets, tiny datum builders and one column-trio helper. They exist
 * so each recipe stays one or two lines long — the same shorthands are printed
 * once at the top of `content/docs/cookbook.mdx`.
 */

/** Width budget every cookbook chart is sized to. */
export const CARD_W = 560;

/* ------------------------------- format presets ------------------------------- */

/** Currency in millions. */
export const fM = { compact: true, decimals: 1 } as const;
/** Compact, integer-ish. */
export const fK = { compact: true } as const;
/** Plain counts / scores. */
export const fN = { compact: false } as const;
/** Plain, one decimal. */
export const fN1 = { compact: false, decimals: 1 } as const;
/** Percentages, one decimal. */
export const fPct1 = { compact: false, decimals: 1 } as const;

/* ------------------------------- datum builders ------------------------------- */

/** Category datum with AC and optional PY / PL. */
export const C = (category: string, AC: number, PY?: number, PL?: number) => ({
  category,
  AC,
  ...(PY !== undefined ? { PY } : {}),
  ...(PL !== undefined ? { PL } : {}),
});

/** Category datum with an explicit scenario bag (AC / PY / PL / FC). */
export const L = (category: string, o: { AC?: number; PY?: number; PL?: number; FC?: number }) => ({
  category,
  ...o,
});

/** Component (part-of-whole) datum for StructureChart rows. */
export const S = (
  category: string,
  AC: number,
  PY?: number,
  PL?: number,
  higherIsBetter?: boolean,
) => ({
  category,
  AC,
  ...(PY !== undefined ? { PY } : {}),
  ...(PL !== undefined ? { PL } : {}),
  ...(higherIsBetter === false ? { higherIsBetter: false } : {}),
});

/** Waterfall datum: category, value and an optional flow / polarity. */
export const W = (
  category: string,
  value: number,
  flow?: "add" | "subtract" | "result",
  higherIsBetter?: boolean,
) => ({
  category,
  value,
  ...(flow ? { flow } : {}),
  ...(higherIsBetter === false ? { higherIsBetter: false } : {}),
});

/** A DataTable value + ΔPY (bar) + ΔPY% (pin) column trio for one measure. */
export const varCols = (measure: string, label: string, higherIsBetter?: boolean) => [
  { key: measure, label, kind: "value" as const, scenario: "AC" as const },
  {
    key: `${measure}_d`,
    label: "ΔPY",
    kind: "variance" as const,
    measure,
    base: "PY" as const,
    mode: "abs" as const,
    mark: "bar" as const,
    ...(higherIsBetter === false ? { higherIsBetter: false } : {}),
  },
  {
    key: `${measure}_p`,
    label: "ΔPY%",
    kind: "variance" as const,
    measure,
    base: "PY" as const,
    mode: "pct" as const,
    mark: "pin" as const,
    ...(higherIsBetter === false ? { higherIsBetter: false } : {}),
  },
];

/* ------------------------------- cohort matrix ------------------------------- */

/** Rows for the SaaS cohort-retention matrix (one signup month per row). */
export const cohortRows = [
  { id: "jan", label: "Jan cohort" },
  { id: "feb", label: "Feb cohort" },
  { id: "mar", label: "Mar cohort" },
  { id: "apr", label: "Apr cohort" },
  { id: "may", label: "May cohort" },
];

/** Columns for the cohort matrix: months since signup. */
export const cohortCols = [
  { id: "m0", label: "M0" },
  { id: "m1", label: "M1" },
  { id: "m2", label: "M2" },
  { id: "m3", label: "M3" },
  { id: "m4", label: "M4" },
  { id: "m5", label: "M5" },
];

/** Percent of the cohort still active — deliberately sparse (young cohorts). */
export const cohortValues = {
  jan: {
    m0: { AC: 100 },
    m1: { AC: 82 },
    m2: { AC: 71 },
    m3: { AC: 64 },
    m4: { AC: 59 },
    m5: { AC: 55 },
  },
  feb: {
    m0: { AC: 100 },
    m1: { AC: 85 },
    m2: { AC: 74 },
    m3: { AC: 66 },
    m4: { AC: 61 },
  },
  mar: { m0: { AC: 100 }, m1: { AC: 79 }, m2: { AC: 68 }, m3: { AC: 60 } },
  apr: { m0: { AC: 100 }, m1: { AC: 88 }, m2: { AC: 77 } },
  may: { m0: { AC: 100 }, m1: { AC: 84 } },
};
