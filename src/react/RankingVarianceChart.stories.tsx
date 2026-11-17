import type { Meta, StoryObj } from "@storybook/react";
import { RankingVarianceChart } from "./RankingVarianceChart";

const meta: Meta<typeof RankingVarianceChart> = {
  title: "Charts/RankingVarianceChart",
  component: RankingVarianceChart,
  args: {
    width: 680,
    title: "Net sales by state - AC vs Plan",
    data: [
      { label: "California", AC: 188, base: 154 },
      { label: "New York", AC: 211, base: 201 },
      { label: "Texas", AC: 197, base: 201 },
      { label: "Ohio", AC: 131, base: 100 },
      { label: "Virginia", AC: 69, base: 166 },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof RankingVarianceChart>;

export const Default: Story = {};

/** Error bars on the AC and ΔPL marks, a tied band on the ΔPL panel, exact digits and own words. */
export const ErrorBarsAndTiedBand: Story = {
  args: {
    title: undefined,
    sortBy: "value",
    showTotals: false,
    baseLabel: "Equipped",
    format: { compact: false, fractionDigits: 2 },
    labels: { scenario: { AC: "DPS" } },
    bands: [{ panel: "abs", from: 2.9952, to: 3.9194, label: "Tied with the best" }],
    data: [
      { label: "Best set", AC: 914.3013, base: 910.8441, acError: 0.4682, absError: 0.4621 },
      { label: "Ring swap", AC: 914.0512, base: 910.8441, acError: 0.4511, absError: 0.4402 },
      { label: "Bracers swap", AC: 910.9064, base: 910.8441, acError: 0.4744, absError: 0.1347 },
      { label: "Trinket swap", AC: 907.9623, base: 910.8441, acError: 0.4793, absError: 0.5439 },
      { label: "Weapon swap", AC: 906.2537, base: 910.8441, acError: 0.4951, absError: 0.6408 },
    ],
  },
};
