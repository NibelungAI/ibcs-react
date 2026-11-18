import type { Meta, StoryObj } from "@storybook/react";
import { RangeBarChart } from "./RangeBarChart";

const meta: Meta<typeof RangeBarChart> = {
  title: "Charts/RangeBarChart",
  component: RangeBarChart,
  args: {
    title: "DPS of each variant's fights",
    data: [
      { label: "Best set", from: 870.2, to: 952.6, mark: 914.3 },
      { label: "Signet of Embers", labelColor: "#a335ee", from: 869.9, to: 952.1, mark: 914.1 },
      { label: "Equipped", from: 866.5, to: 948.9, mark: 910.8 },
      { label: "Runed Greatsword", labelColor: "#0070dd", from: 862.0, to: 946.4, mark: 906.3 },
    ],
    format: { compact: false, fractionDigits: 1 },
    labels: { rangeLow: "p10", rangeHigh: "p90" },
    width: 640,
  },
};
export default meta;

type Story = StoryObj<typeof RangeBarChart>;

/** Each variant's 10th to 90th percentile, its mean marked, both ends labelled (GTM p. 67). */
export const Spread: Story = {};

/** An estimate ± its half-width per wave, narrowing (GTM p. 60). */
export const Ladder: Story = {
  args: {
    title: "The estimate narrows wave by wave",
    orientation: "columns",
    data: [
      { label: "Wave 1", from: 902.1, to: 919.5, mark: 910.8 },
      { label: "Wave 2", from: 905.0, to: 917.2, mark: 911.1 },
      { label: "Wave 3", from: 907.9, to: 914.1, mark: 911.0 },
      { label: "Wave 4", from: 909.5, to: 912.6, mark: 911.05 },
      { label: "Wave 5", from: 910.3, to: 911.8, mark: 911.07 },
    ],
    format: {},
    labels: { rangeMark: "Estimate" },
    height: 280,
  },
};

/** Planned ranges, outlined (PL). */
export const Plan: Story = { args: { scenario: "PL" } };
