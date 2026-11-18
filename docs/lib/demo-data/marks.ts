import type { FanBand, LineDatum, RangeDatum, TimelineAnnotation, TimelineRow } from "ibcs-react";
import { EPIC, RARE, glyphs, ringChip, swordChip } from "./distribution";

/* ============================================================================
 * Sample data for the TimelineChart and RangeBarChart pages, and the callout
 * and fan sections of the LineChart and TrendChart pages. Made-up figures,
 * deterministic, so the pages render the same on every build.
 * ========================================================================= */

const tenths = (v: number) => Math.round(v * 10) / 10;

/** Auto shots every 2.9 s, Aimed Shot and Multi-Shot every 10.4 s. */
const autoShots = Array.from({ length: 63 }, (_, i) => tenths(i * 2.9));
const aimedShots = Array.from({ length: 17 }, (_, i) => tenths(1.5 + i * 10.4));
const multiShots = Array.from({ length: 17 }, (_, i) => tenths(4.6 + i * 10.4));

/** One fight of 180 s, as a combat log's derivation would hand it over. */
export const fightRows: TimelineRow[] = [
  { label: "Auto Shot", icon: { src: glyphs.arrow, naturalSize: 56 }, ticks: autoShots },
  {
    label: "Aimed Shot",
    icon: { src: glyphs.arrow, naturalSize: 56 },
    ticks: aimedShots,
    spans: aimedShots.map((t) => ({ from: t, to: t + 6, kind: "waiting" as const })),
  },
  {
    label: "Multi-Shot",
    icon: { src: glyphs.arrow, naturalSize: 56 },
    ticks: multiShots,
    spans: multiShots.map((t) => ({ from: t, to: t + 10, kind: "waiting" as const })),
  },
  {
    label: "Rapid Fire",
    icon: { src: glyphs.flame, naturalSize: 56 },
    ticks: [30],
    spans: [
      { from: 30, to: 45 },
      { from: 30, to: 330, kind: "waiting" },
    ],
  },
  {
    label: "Quick Shots",
    spans: [
      { from: 8, to: 20 },
      { from: 41, to: 53 },
      { from: 77, to: 89 },
      { from: 118, to: 130 },
      { from: 161, to: 173 },
    ],
  },
  { label: "Haste Potion", ticks: [60], spans: [{ from: 60, to: 75 }] },
];

export const fightNotes: TimelineAnnotation[] = [
  { at: 30, row: 3, text: "Rapid Fire: 15 s of 40% faster shots" },
  { at: 60, text: "The potion while Quick Shots is up" },
  { at: 165.5, row: 1, text: "Mana runs low: one Aimed Shot is skipped" },
];

/** Each variant's fights: the 10th and 90th percentiles and the mean. */
export const variantSpread: RangeDatum[] = [
  { label: "Best set", from: 870.2, to: 952.6, mark: 914.3, icon: [ringChip, swordChip] },
  {
    label: "Signet of Embers",
    labelColor: EPIC,
    from: 869.9,
    to: 952.1,
    mark: 914.1,
    icon: { ...ringChip, alt: "" },
  },
  { label: "Equipped", from: 866.5, to: 948.9, mark: 910.8 },
  {
    label: "Runed Greatsword",
    labelColor: RARE,
    from: 862.0,
    to: 946.4,
    mark: 906.3,
    icon: { ...swordChip, alt: "" },
  },
];

/** A simulation's estimate ± its 95% half-width after each wave. */
export const waves: RangeDatum[] = [
  { label: "Wave 1", from: 902.1, to: 919.5, mark: 910.8 },
  { label: "Wave 2", from: 905.0, to: 917.2, mark: 911.1 },
  { label: "Wave 3", from: 907.9, to: 914.1, mark: 911.0 },
  { label: "Wave 4", from: 909.5, to: 912.6, mark: 911.05 },
  { label: "Wave 5", from: 910.3, to: 911.8, mark: 911.07 },
];

/** Twenty runs of one character. */
export const runs: LineDatum[] = [
  884.1, 886.0, 885.2, 887.9, 899.8, 901.2, 900.4, 903.0, 902.1, 904.6, 905.0, 914.9, 916.2, 915.0,
  917.7, 918.3, 919.4, 921.1, 931.2, 930.4,
].map((v, i) => ({ category: `${i + 1}`, AC: v }));

/** DPS over one fight every 3 s, and a fan of all fights per moment: two nested bands. */
const seconds = Array.from({ length: 61 }, (_, i) => i * 3);
export const fightDps: LineDatum[] = seconds.map((t, i) => ({
  category: `${t}`,
  AC: tenths(910 + 140 * Math.exp(-t / 25) * Math.cos(i / 2.2) - (i > 40 ? 12 : 0)),
}));
const edge = (k: number, spread: number) =>
  seconds.map((t) => tenths(910 + k * (spread * Math.exp(-t / 40) + spread / 7)));
export const fightFans: FanBand[] = [
  { from: edge(-1, 210), to: edge(1, 240), label: "10th to 90th percentile" },
  { from: edge(-1, 90), to: edge(1, 100), label: "Middle half" },
];
