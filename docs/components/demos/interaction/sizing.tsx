"use client";

import { useState } from "react";
import { ChartBox, TrendChart, type ChartFit } from "ibcs-react";
import { sampleMonthlyTrend } from "@/lib/demo-data/sample-data";

const FITS: { value: ChartFit; hint: string }[] = [
  { value: "scale", hint: "fill width, keep the aspect ratio; scroll below minWidth" },
  { value: "contain", hint: "fit both dimensions, keep the aspect ratio, letterbox" },
  { value: "fixed", hint: "the intrinsic size; everything scrolls around it" },
  { value: "fill", hint: "stretch to the box" },
];

const btn = (on: boolean): React.CSSProperties => ({
  appearance: "none",
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 6,
  cursor: "pointer",
  border: `1px solid ${on ? "#2b2b29" : "#e0ded7"}`,
  background: on ? "#2b2b29" : "#fff",
  color: on ? "#fff" : "#3a3a36",
});

/** Switch `ChartBox`'s `fit` and resize the window to feel each mode. */
export function SizingDemo() {
  const [fit, setFit] = useState<ChartFit>("scale");
  const active = FITS.find((f) => f.value === fit)!;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        {FITS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFit(f.value)}
            style={btn(fit === f.value)}
          >
            {f.value}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#9a9992", marginBottom: 10 }}>
        fit=&quot;{active.value}&quot; - {active.hint}
      </div>
      <div style={{ border: "1px dashed #e0ded7", borderRadius: 8 }}>
        <ChartBox width={760} height={300} fit={fit} minWidth={520} maxHeight={300}>
          {(w, h) => (
            <TrendChart
              data={sampleMonthlyTrend}
              comparison="PY"
              width={w}
              height={h}
              format={{ compact: true }}
            />
          )}
        </ChartBox>
      </div>
    </div>
  );
}
