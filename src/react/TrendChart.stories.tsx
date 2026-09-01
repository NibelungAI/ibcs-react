import type { Meta, StoryObj } from "@storybook/react";
import { TrendChart } from "./TrendChart";
import { sampleMonthlyTrend } from "../demo/sampleData";

const meta: Meta<typeof TrendChart> = {
  title: "Charts/TrendChart",
  component: TrendChart,
  args: {
    data: sampleMonthlyTrend,
    comparison: "PY",
    width: 820,
    height: 360,
    variance: "abs",
    referenceLines: ["PY", "PL"],
    title: "Revenue by period - AC / FC vs PY, plan as a band",
  },
  argTypes: {
    comparison: { control: "select", options: ["PY", "PL", "FC"] },
    variance: { control: "inline-radio", options: ["abs", "pct", "none"] },
  },
};
export default meta;

type Story = StoryObj<typeof TrendChart>;

export const Absolute: Story = {};
export const Percent: Story = { args: { variance: "pct" } };
export const NoPanel: Story = { args: { variance: "none" } };
export const LinesOnly: Story = { args: { variance: "none", showValueLabels: false } };
