import type { Meta, StoryObj } from "@storybook/react";
import { WaterfallChart } from "./WaterfallChart";
import type { WaterfallDatum } from "../core/waterfall";

const bridge: WaterfallDatum[] = [
  { category: "Revenue", value: 32_000, flow: "add" },
  { category: "COGS", value: 18_500, flow: "subtract", higherIsBetter: false },
  { category: "Gross margin", value: 0, flow: "result" },
  { category: "Opex", value: 6_200, flow: "subtract", higherIsBetter: false },
  { category: "Other income", value: 900, flow: "add" },
  { category: "EBIT", value: 0, flow: "result" },
];

const bridgePY: WaterfallDatum[] = [
  { category: "Revenue", value: 29_500, flow: "add" },
  { category: "COGS", value: 17_800, flow: "subtract", higherIsBetter: false },
  { category: "Gross margin", value: 0, flow: "result" },
  { category: "Opex", value: 6_000, flow: "subtract", higherIsBetter: false },
  { category: "Other income", value: 700, flow: "add" },
  { category: "EBIT", value: 0, flow: "result" },
];

const meta: Meta<typeof WaterfallChart> = {
  title: "Charts/WaterfallChart",
  component: WaterfallChart,
  args: {
    data: bridge,
    scenario: "AC",
    width: 640,
    height: 360,
    mark: "bar",
    title: "Operating result bridge — AC",
  },
  argTypes: {
    scenario: { control: "select", options: ["AC", "PY", "PL", "FC"] },
    mark: { control: "inline-radio", options: ["bar", "pin"] },
  },
};
export default meta;

type Story = StoryObj<typeof WaterfallChart>;

export const Basic: Story = {};
export const WithComparison: Story = {
  args: { comparisonData: bridgePY, title: "Operating result bridge — AC vs PY" },
};
export const ComparisonPins: Story = {
  args: { comparisonData: bridgePY, mark: "pin", title: "Bridge with variance pins" },
};
