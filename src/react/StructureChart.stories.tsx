import type { Meta, StoryObj } from "@storybook/react";
import { StructureChart } from "./StructureChart";
import { sampleRevenueStructure } from "../demo/sampleData";

const meta: Meta<typeof StructureChart> = {
  title: "Charts/StructureChart",
  component: StructureChart,
  args: {
    data: sampleRevenueStructure,
    comparison: "PY",
    sort: "desc",
    width: 600,
    height: 320,
    variance: "abs",
    showComparison: true,
    showShare: true,
    title: "Revenue by region — AC vs PY",
  },
  argTypes: {
    comparison: { control: "select", options: ["PY", "PL", "FC"] },
    sort: { control: "inline-radio", options: ["desc", "asc", "none"] },
    variance: { control: "inline-radio", options: ["abs", "pct", "none"] },
  },
};
export default meta;

type Story = StoryObj<typeof StructureChart>;

export const Absolute: Story = {};
export const Percent: Story = { args: { variance: "pct" } };
export const Unsorted: Story = { args: { sort: "none" } };
export const NoComparison: Story = { args: { showComparison: false, variance: "none" } };
