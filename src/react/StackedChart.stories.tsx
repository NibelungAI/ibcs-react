import type { Meta, StoryObj } from "@storybook/react";
import { StackedChart } from "./StackedChart";
import type { StackedDatum, StackedSeries } from "../core/stacked";

const series: StackedSeries[] = [
  { key: "emea", label: "EMEA" },
  { key: "amer", label: "Americas" },
  { key: "apac", label: "APAC" },
  { key: "other", label: "Other" },
];

// C01 - stacked columns over time.
const monthly: StackedDatum[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
].map((m, i) => ({
  category: m,
  values: {
    emea: 120 + i * 6,
    amer: 90 + i * 4,
    apac: 60 + i * 7,
    other: 25 + (i % 3) * 5,
  },
}));

// C02 - stacked bars over a structure.
const byUnit: StackedDatum[] = [
  { category: "North", values: { emea: 0, amer: 320, apac: 40, other: 30 } },
  { category: "South", values: { emea: 0, amer: 210, apac: 30, other: 20 } },
  { category: "EU", values: { emea: 280, amer: 0, apac: 20, other: 25 } },
  { category: "Asia", values: { emea: 0, amer: 0, apac: 240, other: 18 } },
];

const meta: Meta<typeof StackedChart> = {
  title: "Charts/StackedChart",
  component: StackedChart,
  argTypes: {
    orientation: { control: "inline-radio", options: ["column", "bar"] },
    highlight: { control: "select", options: [undefined, "emea", "amer", "apac", "other"] },
  },
};
export default meta;

type Story = StoryObj<typeof StackedChart>;

export const C01_Columns: Story = {
  args: {
    data: monthly,
    series,
    orientation: "column",
    width: 760,
    height: 380,
    title: "Revenue by region - monthly (C01)",
  },
};

export const C02_Bars: Story = {
  args: {
    data: byUnit,
    series,
    orientation: "bar",
    width: 640,
    height: 300,
    title: "Revenue by unit (C02)",
  },
};

export const Highlighted: Story = {
  args: { ...C01_Columns.args, highlight: "apac", title: "Revenue - APAC highlighted" },
};
