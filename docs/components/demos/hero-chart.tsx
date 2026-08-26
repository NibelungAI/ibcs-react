"use client";

import { VarianceColumnChart } from "ibcs-react";

const DATA = [
  { category: "Jan", AC: 30.1, PY: 28.6 },
  { category: "Feb", AC: 27.4, PY: 28.9 },
  { category: "Mar", AC: 32.2, PY: 29.4 },
  { category: "Apr", AC: 29.8, PY: 30.4 },
  { category: "May", AC: 33.1, PY: 30.1 },
  { category: "Jun", AC: 34.5, PY: 31.2 },
];

/** The landing-page hero: a live variance column chart, AC vs PY. */
export function HeroChart() {
  return (
    <VarianceColumnChart
      title="Net sales — AC vs PY, mEUR"
      data={DATA}
      width={720}
      height={340}
      style={{ margin: "0 auto" }}
    />
  );
}
