import type { Meta, StoryObj } from "@storybook/react";
import { VarianceColumnChart } from "./VarianceColumnChart";
import { sampleQuarterlyRevenue } from "../demo/sampleData";

const meta: Meta<typeof VarianceColumnChart> = {
  title: "Charts/VarianceColumnChart",
  component: VarianceColumnChart,
  args: {
    data: sampleQuarterlyRevenue,
    comparison: "PY",
    width: 560,
    height: 320,
    variance: "abs",
    title: "Revenue - AC vs PY",
  },
  argTypes: {
    comparison: { control: "select", options: ["PY", "PL", "FC"] },
    variance: { control: "inline-radio", options: ["abs", "pct", "none"] },
  },
};
export default meta;

type Story = StoryObj<typeof VarianceColumnChart>;

export const Absolute: Story = {};
export const Percent: Story = { args: { variance: "pct" } };
export const NoPanel: Story = { args: { variance: "none" } };

/** Vertical error bars on the AC columns and the variance bars. */
export const ErrorBars: Story = {
  args: {
    title: "DPS - new vs old engine",
    format: { compact: false, fractionDigits: 1 },
    labels: { scenario: { AC: "new", PY: "old" } },
    data: [
      { category: "Hunter", AC: 910.8, PY: 909.6, acError: 0.8, absError: 0.6 },
      { category: "Ret", AC: 890.5, PY: 892.9, acError: 1.2, absError: 0.9 },
      { category: "Fire", AC: 860.1, PY: 859.8, acError: 1.0, absError: 0.7 },
    ],
  },
};
