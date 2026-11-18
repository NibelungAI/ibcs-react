import type { Meta, StoryObj } from "@storybook/react";
import { HistogramChart } from "./HistogramChart";

/** A roughly normal sample, deterministic: the mean of four LCG uniforms (Irwin-Hall), scaled. */
function fightSample(n: number, mean: number, sd: number, seed: number): number[] {
  let s = seed;
  const u = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return Array.from({ length: n }, () => mean + sd * (u() + u() + u() + u() - 2) * Math.sqrt(3));
}

const fights = fightSample(6000, 910.8, 30, 7);
const mean = fights.reduce((a, b) => a + b, 0) / fights.length;
const sd = Math.sqrt(fights.reduce((a, b) => a + (b - mean) ** 2, 0) / (fights.length - 1));
const halfWidth = (1.959964 * sd) / Math.sqrt(fights.length);

const meta: Meta<typeof HistogramChart> = {
  title: "Charts/HistogramChart",
  component: HistogramChart,
  args: {
    width: 640,
    height: 300,
    title: "DPS of 6,000 fights",
    values: fights,
    format: { compact: false, fractionDigits: 1 },
  },
};
export default meta;

type Story = StoryObj<typeof HistogramChart>;

/** Raw values binned by the rule; the middle half of the values as the default spread. */
export const Default: Story = {};

/** The mean's 95% interval as an error bar above the columns, against the middle half. */
export const MeanAndSpread: Story = {
  args: { mean: { value: mean, halfWidth, level: 0.95 } },
};

/** An engine's own classes, hatched as a forecast, with a spread of the caller's in its own words. */
export const EngineBins: Story = {
  args: {
    title: undefined,
    values: undefined,
    bins: { start: 850, width: 10, counts: [4, 19, 61, 152, 288, 401, 395, 301, 170, 72, 25, 6] },
    mean: { value: 909.6, halfWidth: 0.7, level: 0.95 },
    spread: { from: 877.2, to: 942.4, label: "10th to 90th percentile {range}" },
    scenario: "FC",
    height: 260,
  },
};

/** sr-Latn with one digit, and the caller's words. */
export const CallerWords: Story = {
  args: {
    title: "DPS po borbi",
    mean: { value: mean, halfWidth, level: 0.95 },
    format: { compact: false, locale: "sr-Latn", fractionDigits: 1 },
    labels: {
      mean: "prosek {value}",
      spread: "srednja polovina borbi {range}",
      sampleSize: "{n} borbi",
      count: "Borbi",
      share: "Udeo",
    },
  },
};
