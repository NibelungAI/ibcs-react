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
    title: "Revenue — AC vs PY",
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
