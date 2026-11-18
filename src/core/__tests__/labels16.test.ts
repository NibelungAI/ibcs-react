/**
 * A complete dictionary written for 1.6.0 - every 1.5.0 word and the five 1.6
 * words - keeps compiling and working in 1.7. The repository's `typecheck`
 * compiles this file, so the type half of the check is `tsc` itself:
 * `srLabels16` names every 1.6.0 word and nothing more, typed as `IbcsLabels`.
 * The `@ts-expect-error` line fails the build if the strict
 * `IbcsLabelsComplete` stops listing the words added in 1.7, as it is meant
 * to list every new word.
 */
import { describe, expect, it } from "vitest";

import { defaultLabels, mergeLabels, type IbcsLabels, type IbcsLabelsComplete } from "../labels";

/** Every word of 1.6.0's dictionary, in a translator's words. */
const srLabels16: IbcsLabels = {
  scenario: { AC: "Ostvareno", PY: "PG", PL: "Plan", FC: "Prognoza" },
  scenarioTitle: { AC: "Ostvareno", PY: "Prošla godina", PL: "Plan / budžet", FC: "Prognoza" },
  delta: "Δ{base}",
  deltaPct: "Δ{base}%",
  endLabel: "{name} {value}",
  total: "Ukupno",
  totalVariance: "Ukupno odstupanje",
  current: "Tekuće",
  value: "Vrednost",
  valueNumbered: "Vrednost {n}",
  share: "Udeo",
  count: "Broj",
  mean: "Prosek {value}",
  spread: "Srednja polovina {range}",
  sampleSize: "n = {n}",
  moreIcons: "+{count}",
  latest: "Poslednje",
  contribution: "Doprinos",
  runningTotal: "Kumulativno",
  deltaVsComparison: "Δ prema poređenju",
  secondary: "Sekundarno",
  group: "Grupa",
  size: "Veličina",
  point: "Tačka {n}",
  item: "Stavka {n}",
  panel: "Panel {n}",
  miniPanel: "{label}: odstupanje po kategoriji, zajednička skala.",
  sharedScaleHint: "Zajednička skala - puna visina ≈ ±{value} prema {base}",
  rest: "Ostalo",
  more: "+{count} još",
  sampled: "prikazano {shown} od {total} (uzorak)",
  negativeOmitted: "negativne vrednosti izostavljene",
  versus: "prema",
  minus: "minus",
  percentagePoints: "pp",
  selectMark: "Izaberi {label}, {value}",
  selectTotal: "Izaberi {label}, ukupno {value}",
  expand: "Otvori",
  collapse: "Zatvori",
  expandRow: "Otvori red",
  collapseRow: "Zatvori red",
  expandAll: "Otvori sve",
  collapseAll: "Zatvori sve",
  expandAllPeriods: "Otvori sve periode",
  noValue: "nema vrednosti",
  deltaBudget: "ΔBdž",
  loading: "Učitava se…",
  noData: "Nema podataka",
  loadError: "Podaci nisu učitani",
  error: "Greška",
  retry: "Pokušaj ponovo",
  conformant: "U skladu sa IBCS / ISO 24896 - bez nalaza.",
  severity: { error: "greška", warning: "upozorenje", info: "info" },
  export: {
    button: "Izvezi",
    menu: "Izvezi grafikon",
    svg: "SVG",
    png: "PNG",
    csv: "CSV",
    json: "JSON",
    copyPng: "Kopiraj PNG",
    copySvg: "Kopiraj SVG",
    print: "Štampaj",
  },
};

// @ts-expect-error The strict type lists the words added in 1.7, which srLabels16 lacks.
const strict: IbcsLabelsComplete = srLabels16;

// Types a 1.6.0 consumer derives from the helpers still take a 1.6.0 dictionary.
const viaDefaults: typeof defaultLabels = srLabels16;
const viaMerge: ReturnType<typeof mergeLabels> = srLabels16;

/** The words added in 1.7, with their defaults. */
const added17 = {
  events: "Events",
  event: "Event",
  active: "Active",
  waiting: "Waiting",
  rangeLow: "Low",
  rangeHigh: "High",
  rangeMark: "Mean",
  note: "Note",
  band: "Band {n}",
};

describe("a complete 1.6.0 dictionary", () => {
  it("compiles as IbcsLabels and merges, the defaults filling the words added in 1.7", () => {
    const merged = mergeLabels({ total: "Svega" }, srLabels16);
    expect(merged.total).toBe("Svega");
    expect(merged.count).toBe("Broj");
    expect(merged.moreIcons).toBe("+{count}");
    const filled = Object.fromEntries(
      Object.keys(added17).map((k) => [k, merged[k as keyof typeof added17]]),
    );
    expect(filled).toEqual(added17);
    // The defaults hold exactly these words, and a complete base comes back unchanged.
    for (const [k, v] of Object.entries(added17)) {
      expect(defaultLabels[k as keyof typeof added17]).toBe(v);
    }
    expect(mergeLabels(undefined, defaultLabels)).toBe(defaultLabels);
    expect(Object.keys(strict).length).toBeLessThan(Object.keys(defaultLabels).length);
    expect([viaDefaults.total, viaMerge.total]).toEqual(["Ukupno", "Ukupno"]);
  });
});

describe("each word added after 1.5.0", () => {
  it("is filled from the defaults in a dictionary that lacks only that word", () => {
    const optional = [
      "count",
      "mean",
      "spread",
      "sampleSize",
      "moreIcons",
      ...Object.keys(added17),
    ] as const;
    const full = { ...defaultLabels } as Record<string, unknown>;
    for (const word of optional) {
      const lacking = { ...full };
      delete lacking[word];
      const merged = mergeLabels(undefined, lacking as unknown as IbcsLabels);
      expect(merged[word as keyof IbcsLabels], word).toBe(defaultLabels[word as keyof IbcsLabels]);
    }
  });
});
