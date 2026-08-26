import type { Meta, StoryObj } from "@storybook/react";
import { MiniVarianceMultiples } from "./SmallMultiples";
import type { MiniGroupInput } from "../core/smallMultiples";

const groups: MiniGroupInput[] = [
  {
    label: "North",
    data: [
      { category: "Q1", AC: 1200, PY: 1100 },
      { category: "Q2", AC: 1350, PY: 1400 },
      { category: "Q3", AC: 1500, PY: 1300 },
      { category: "Q4", AC: 1280, PY: 1320 },
    ],
  },
  {
    label: "EMEA",
    data: [
      { category: "Q1", AC: 900, PY: 1000 },
      { category: "Q2", AC: 1100, PY: 1050 },
      { category: "Q3", AC: 1250, PY: 1200 },
      { category: "Q4", AC: 1400, PY: 1150 },
    ],
  },
  {
    label: "APAC",
    data: [
      { category: "Q1", AC: 600, PY: 500 },
      { category: "Q2", AC: 720, PY: 800 },
      { category: "Q3", AC: 850, PY: 700 },
      { category: "Q4", AC: 990, PY: 760 },
    ],
  },
];

const meta: Meta<typeof MiniVarianceMultiples> = {
  title: "Charts/SmallMultiples",
  component: MiniVarianceMultiples,
  args: {
    groups,
    comparison: "PY",
    columns: 3,
    title: "Regional ΔPY — shared scale",
  },
  argTypes: {
    comparison: { control: "select", options: ["PY", "PL", "FC"] },
    columns: { control: { type: "number", min: 1, max: 4 } },
  },
};
export default meta;

type Story = StoryObj<typeof MiniVarianceMultiples>;

export const Basic: Story = {};
export const TwoColumns: Story = { args: { columns: 2 } };
