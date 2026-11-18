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

/** A plain svg glyph as a 56 px `data:` URI - a stand-in for a game icon, not game art. */
const glyph = (background: string, shape: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect width="56" height="56" fill="${background}"/>${shape}</svg>`,
  )}`;
const ring = {
  src: glyph(
    "#3d2f4a",
    '<circle cx="28" cy="30" r="12" fill="none" stroke="#e2c46a" stroke-width="6"/>',
  ),
  naturalSize: 56,
  border: "#a335ee",
  alt: "Signet of Embers",
};
const sword = {
  src: glyph(
    "#2b3442",
    '<path d="M28 8 V40" stroke="#dfe6ee" stroke-width="7"/><path d="M18 40 H38 M28 40 V49" stroke="#c7a35a" stroke-width="5"/>',
  ),
  naturalSize: 56,
  border: "#0070dd",
  alt: "Runed Greatsword",
};

/** Icon chips in the row labels: the items each variant changes, framed and named in their quality's colour. */
export const IconChips: Story = {
  args: {
    title: undefined,
    sortBy: "value",
    showTotals: false,
    baseLabel: "Equipped",
    format: { compact: false, fractionDigits: 2 },
    labels: { scenario: { AC: "DPS" } },
    data: [
      {
        label: "Best set",
        AC: 914.3013,
        base: 910.8441,
        acError: 0.4682,
        absError: 0.4621,
        icon: [ring, sword],
      },
      {
        label: "Signet of Embers",
        labelColor: "#a335ee",
        AC: 914.0512,
        base: 910.8441,
        acError: 0.4511,
        absError: 0.4402,
        icon: { ...ring, alt: "" },
      },
      { label: "Equipped", AC: 910.8441, base: 910.8441, acError: 0.4808, absError: 0 },
      {
        label: "Runed Greatsword",
        labelColor: "#0070dd",
        AC: 906.2537,
        base: 910.8441,
        acError: 0.4951,
        absError: 0.6408,
        icon: { ...sword, alt: "" },
      },
    ],
  },
};
