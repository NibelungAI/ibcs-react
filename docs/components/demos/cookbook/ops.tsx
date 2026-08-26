"use client";

/**
 * Report cookbook — Operations & supply chain. One component per recipe; each renders the
 * exact snippet printed next to it in `content/docs/cookbook.mdx`.
 */
import {
  DataTable,
  VarianceColumnChart,
  TrendChart,
  StructureChart,
  WaterfallChart,
  LineChart,
  AreaChart,
  BubbleChart,
  MiniVarianceMultiples,
} from "ibcs-react";
import { CARD_W, fM, fK, fN, fN1, C, L, S, W, varCols } from "@/lib/demo-data/cookbook";
import { KpiStrip } from "./shared";

/** Inventory by warehouse — Northwind Materials · € m · AC vs PY */
export function InventoryByWarehouse() {
  return (
    <StructureChart
      data={[
        S("Rotterdam DC", 4.2, 3.8, undefined, false),
        S("Hamburg DC", 3.1, 3.4, undefined, false),
        S("Lyon DC", 2.6, 2.2, undefined, false),
        S("Madrid DC", 1.9, 1.7, undefined, false),
        S("Gdańsk DC", 1.1, 0.9, undefined, false),
      ]}
      comparison="PY"
      higherIsBetter={false}
      width={CARD_W}
      height={220}
      labelWidth={120}
      format={fM}
    />
  );
}

/** OTIF performance — Northwind Materials · % · AC vs target (PL=95) */
export function OTIFPerformance() {
  return (
    <VarianceColumnChart
      data={[
        C("Jan", 92, undefined, 95),
        C("Feb", 94, undefined, 95),
        C("Mar", 91, undefined, 95),
        C("Apr", 96, undefined, 95),
        C("May", 97, undefined, 95),
        C("Jun", 95, undefined, 95),
      ]}
      comparison="PL"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Capacity utilization — Cobalt Devices · % · 13 periods, AC vs PL */
export function CapacityUtilization() {
  return (
    <TrendChart
      data={["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"].map((p, i) =>
        L(p, { AC: 74 + (i % 3) * 4 + i, PL: 80 }),
      )}
      comparison="PL"
      width={CARD_W}
      height={236}
      format={fN}
    />
  );
}

/** Demand vs production — Cobalt Devices · k units · plan vs actual */
export function DemandVsProduction() {
  return (
    <LineChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m, i) =>
        L(m, { AC: 40 + i * 3 + (i % 2 ? 4 : -2), PL: 42 + i * 3 }),
      )}
      comparison="PL"
      higherIsBetter
      variance="abs"
      width={CARD_W}
      height={236}
      format={fN}
    />
  );
}

/** Supplier risk map — Northwind Materials · spend vs risk score */
export function SupplierRiskMap() {
  return (
    <BubbleChart
      data={[
        { x: 18, y: 72, size: 340, group: "Critical", label: "Forge Metals" },
        { x: 64, y: 31, size: 180, group: "Standard", label: "Cedar Pkg" },
        { x: 41, y: 58, size: 260, group: "Watch", label: "Volt Cells" },
        { x: 12, y: 22, size: 90, group: "Standard" },
        { x: 80, y: 48, size: 410, group: "Watch", label: "Apex Resin" },
        { x: 30, y: 14, size: 70, group: "Standard" },
      ]}
      xLabel="Annual spend (€ m)"
      yLabel="Risk score"
      sizeLabel="Volume"
      width={CARD_W}
      height={220}
      format={fN}
    />
  );
}

/** Inventory & service KPIs — Northwind Materials · AC vs PY */
export function InventoryAndServiceKPIs() {
  return (
    <KpiStrip
      items={[
        {
          label: "Inventory turns",
          values: { AC: 6.8, PY: 5.9 },
          comparisons: ["PY"],
          format: { ...fN1, currency: "×" },
        },
        {
          label: "Stockout rate",
          values: { AC: 2.1, PY: 3.4 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: { ...fN1, suffix: "%" },
        },
        {
          label: "Fill rate",
          values: { AC: 97, PY: 95 },
          comparisons: ["PY"],
          format: { ...fN, suffix: "%" },
        },
      ]}
    />
  );
}

/** On-time delivery trend — Northwind Materials · % · weekly, AC vs PY */
export function OnTimeDeliveryTrend() {
  return (
    <AreaChart
      data={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((w, i) =>
        L(w, { AC: 88 + (i % 3) * 2, PY: 85 + i * 0.5 }),
      )}
      scenario="AC"
      baseline="PY"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Defect rate (PPM) — Cobalt Devices · ppm · lower is better */
export function DefectRatePPM() {
  return (
    <LineChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m, i) =>
        L(m, { AC: 820 - i * 40 + (i % 2 ? 60 : 0), PY: 900 - i * 20 }),
      )}
      comparison="PY"
      higherIsBetter={false}
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Order backlog — Cobalt Devices · € m · monthly with PY */
export function OrderBacklog() {
  return (
    <AreaChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m, i) =>
        L(m, { AC: 12 + i * 1.4 - (i > 3 ? 2 : 0), PY: 11 + i }),
      )}
      scenario="AC"
      baseline="PY"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Lead time by supplier — Northwind Materials · days · AC vs PY */
export function LeadTimeBySupplier() {
  return (
    <DataTable
      columns={varCols("lt", "Lead days", false)}
      rows={[
        { id: "s1", label: "Forge Metals", values: { lt: { AC: 28, PY: 24 } } },
        {
          id: "s2",
          label: "Cedar Packaging",
          values: { lt: { AC: 14, PY: 16 } },
        },
        { id: "s3", label: "Volt Cells", values: { lt: { AC: 42, PY: 38 } } },
        { id: "s4", label: "Apex Resin", values: { lt: { AC: 19, PY: 21 } } },
      ]}
      format={fN}
      defaultSort={{ key: "lt", dir: "desc" }}
    />
  );
}

/** Production yield — small multiples — Cobalt Devices · % · AC vs PY by line */
export function ProductionYieldSmallMultiples() {
  return (
    <div style={{ width: CARD_W }}>
      <MiniVarianceMultiples
        groups={[
          {
            label: "Line A",
            data: [C("Q1", 94, 92), C("Q2", 95, 93), C("Q3", 96, 94)],
          },
          {
            label: "Line B",
            data: [C("Q1", 88, 90), C("Q2", 89, 91), C("Q3", 91, 90)],
          },
          {
            label: "Line C",
            data: [C("Q1", 97, 95), C("Q2", 96, 96), C("Q3", 98, 97)],
          },
          {
            label: "Line D",
            data: [C("Q1", 82, 86), C("Q2", 85, 87), C("Q3", 88, 88)],
          },
        ]}
        comparison="PY"
        columns={2}
        format={fN}
      />
    </div>
  );
}

/** Freight cost bridge — Northwind Materials · € k · PY → AC */
export function FreightCostBridge() {
  return (
    <WaterfallChart
      data={[
        W("PY freight", 1240, "result"),
        W("Volume", 180, "add", false),
        W("Fuel surcharge", 140, "add", false),
        W("Mode shift", 90, "subtract"),
        W("Rate renegotiation", 110, "subtract"),
        W("AC freight", 1360, "result"),
      ]}
      scenario="AC"
      width={CARD_W}
      height={220}
      format={fK}
    />
  );
}

/** Scrap & rework cost — Cobalt Devices · € k · PY → AC */
export function ScrapAndReworkCost() {
  return (
    <WaterfallChart
      data={[
        W("PY scrap", 410, "result"),
        W("New SKUs", 90, "add", false),
        W("Yield gain", 120, "subtract"),
        W("Automation", 60, "subtract"),
        W("AC scrap", 320, "result"),
      ]}
      scenario="AC"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}
