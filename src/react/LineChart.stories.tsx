import type { Meta, StoryObj } from "@storybook/react";
import { LineChart } from "./LineChart";

const runs = [
  884.1, 886.0, 885.2, 887.9, 899.8, 901.2, 900.4, 903.0, 902.1, 904.6, 905.0, 914.9, 916.2, 915.0,
  917.7, 918.3, 919.4, 921.1, 931.2, 930.4,
].map((v, i) => ({ category: `${i + 1}`, AC: v }));

const seconds = Array.from({ length: 61 }, (_, i) => i * 3);
const tenths = (v: number) => Math.round(v * 10) / 10;
const edge = (k: number, spread: number) =>
  seconds.map((t) => tenths(910 + k * (spread * Math.exp(-t / 40) + spread / 7)));

const meta: Meta<typeof LineChart> = {
  title: "Charts/LineChart",
  component: LineChart,
  args: {
    title: "DPS across 20 runs",
    data: runs,
    format: { compact: false, fractionDigits: 1 },
    width: 640,
    height: 300,
  },
};
export default meta;

type Story = StoryObj<typeof LineChart>;

export const Default: Story = {};

/** Labelled points (GTM p. 4): beside their points, clear of the line and each other. */
export const Callouts: Story = {
  args: {
    callouts: [
      { index: 4, label: "Run 5: T1 helm\n899.8" },
      { index: 11, label: "Run 12: Signet of Embers\n914.9" },
      { index: 18, label: "Run 19: the best set\n931.2" },
    ],
  },
};

/** A fan: the 10th to the 90th percentile and the middle half at every moment of a fight. */
export const Fan: Story = {
  args: {
    title: "DPS over one fight, against all fights",
    data: seconds.map((t, i) => ({
      category: `${t}`,
      AC: tenths(910 + 140 * Math.exp(-t / 25) * Math.cos(i / 2.2)),
    })),
    format: { compact: false, fractionDigits: 0 },
    fans: [
      { from: edge(-1, 210), to: edge(1, 240), label: "10th to 90th percentile" },
      { from: edge(-1, 90), to: edge(1, 100), label: "Middle half" },
    ],
  },
};
