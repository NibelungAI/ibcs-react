/**
 * A complete dictionary written for 1.5.0 keeps compiling and working. The
 * repository's `typecheck` compiles this file, so the type half of the check
 * is `tsc` itself: `srLabels` below names every 1.5.0 word and nothing more,
 * typed as `IbcsLabels`; the `@ts-expect-error` line fails the build if the
 * strict `IbcsLabelsComplete` stops listing the words added since.
 */
import { describe, expect, it } from "vitest";

import { defaultLabels, mergeLabels, type IbcsLabels, type IbcsLabelsComplete } from "../labels";

/** Every word of 1.5.0's dictionary, in a translator's words. */
const srLabels: IbcsLabels = {
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

// @ts-expect-error The strict type lists the words added after 1.5.0, which srLabels lacks.
const strict: IbcsLabelsComplete = srLabels;

describe("a complete 1.5.0 dictionary", () => {
  it("compiles as IbcsLabels and merges, the defaults filling the words added since", () => {
    const merged = mergeLabels({ total: "Svega" }, srLabels);
    expect(merged.total).toBe("Svega");
    expect(merged.share).toBe("Udeo");
    expect(merged.scenario.AC).toBe("Ostvareno");
    expect({
      count: merged.count,
      mean: merged.mean,
      spread: merged.spread,
      sampleSize: merged.sampleSize,
      moreIcons: merged.moreIcons,
    }).toEqual({
      count: defaultLabels.count,
      mean: defaultLabels.mean,
      spread: defaultLabels.spread,
      sampleSize: defaultLabels.sampleSize,
      moreIcons: defaultLabels.moreIcons,
    });
    // With no override the base comes back with its gaps filled, and a complete base unchanged.
    expect(mergeLabels(undefined, srLabels).count).toBe("Count");
    expect(mergeLabels(undefined, defaultLabels)).toBe(defaultLabels);
    // The strict type and the defaults agree at run time too.
    expect(Object.keys(strict).length).toBeLessThan(Object.keys(defaultLabels).length);
  });
});
