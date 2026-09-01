"use client";

import {
  VarianceColumnChart,
  ChartTooltip,
  useChartHover,
  useIbcsTokens,
  formatValue,
  formatSigned,
  type ColumnDatum,
} from "ibcs-react";
import { sampleQuarterlyRevenue } from "@/lib/demo-data/sample-data";

/**
 * The built-in tooltip switched off (`tooltip={false}`) and rebuilt by hand:
 * the chart's `onHover` feeds `useChartHover`, and the hook's `tooltipRef`
 * lets `ChartTooltip` follow the pointer without a React re-render per move.
 */
export function CustomTooltipDemo() {
  const tokens = useIbcsTokens();
  const hover = useChartHover<ColumnDatum>();
  const d = hover.hovered?.datum;
  const delta = d && d.PY != null ? d.AC - d.PY : undefined;

  return (
    <div>
      <VarianceColumnChart
        data={sampleQuarterlyRevenue}
        comparison="PY"
        width={420}
        height={260}
        format={{ compact: true }}
        tooltip={false}
        onHover={(h) => (h ? hover.onMove(h, { clientX: h.x, clientY: h.y }) : hover.onLeave())}
      />
      <div style={{ fontSize: 12, color: "#6b6a64", marginTop: 6 }}>
        Hover, tab to a column or tap it - the panel is this page&apos;s own, not the built-in one.
        Escape dismisses it.
      </div>

      {hover.hovered && d && (
        <ChartTooltip
          ref={hover.tooltipRef}
          x={hover.hovered.x}
          y={hover.hovered.y}
          title={`${hover.hovered.category} \u00b7 custom panel`}
          rows={[
            { label: "AC", value: formatValue(d.AC, { compact: false }), strong: true },
            ...(d.PY != null
              ? [{ label: "PY", value: formatValue(d.PY, { compact: false }) }]
              : []),
            ...(delta != null
              ? [
                  {
                    label: "\u0394PY",
                    value: formatSigned(delta, { compact: false }),
                    color: delta >= 0 ? tokens.color.good : tokens.color.bad,
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
