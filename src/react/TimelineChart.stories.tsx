import type { Meta, StoryObj } from "@storybook/react";
import { TimelineChart } from "./TimelineChart";
import type { TimelineRow } from "../core/timeline";

const tenths = (v: number) => Math.round(v * 10) / 10;
const autoShots = Array.from({ length: 63 }, (_, i) => tenths(i * 2.9));
const aimedShots = Array.from({ length: 17 }, (_, i) => tenths(1.5 + i * 10.4));

/** One fight of 180 s (made-up moments): casts, a cooldown, two buffs. */
const fight: TimelineRow[] = [
  { label: "Auto Shot", ticks: autoShots },
  {
    label: "Aimed Shot",
    ticks: aimedShots,
    spans: aimedShots.map((t) => ({ from: t, to: t + 6, kind: "waiting" as const })),
  },
  {
    label: "Rapid Fire",
    ticks: [30],
    spans: [
      { from: 30, to: 45 },
      { from: 30, to: 330, kind: "waiting" },
    ],
  },
  { label: "Haste Potion", ticks: [60], spans: [{ from: 60, to: 75 }] },
];

const meta: Meta<typeof TimelineChart> = {
  title: "Charts/TimelineChart",
  component: TimelineChart,
  args: {
    title: "One of 6,000 fights: an example, not a guide",
    rows: fight,
    domain: [0, 180],
    timeFormat: "clock",
    width: 640,
  },
};
export default meta;

type Story = StoryObj<typeof TimelineChart>;

/** Casts as ticks, a cooldown as a waiting line, buffs as bars, on a clock axis. */
export const Default: Story = {};

/** Numbered notes on the moments they explain, listed under the chart. */
export const Annotations: Story = {
  args: {
    annotations: [
      { at: 30, row: 2, text: "Rapid Fire: 15 s of 40% faster shots" },
      { at: 60, text: "The potion" },
      { at: 165.5, row: 1, text: "Mana runs low: one Aimed Shot is skipped" },
    ],
  },
};

/** Seconds as numbers with a unit, in the caller's words. */
export const NumberAxis: Story = {
  args: {
    timeFormat: "number",
    format: { suffix: " s", fractionDigits: 1 },
    labels: { events: "Korišćenja", event: "Korišćenje", active: "Aktivno", waiting: "Čeka" },
  },
};
