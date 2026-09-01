"use client";

/**
 * Report cookbook - Sales. One component per recipe; each renders the
 * exact snippet printed next to it in `content/docs/cookbook.mdx`.
 */
import {
  DataTable,
  VarianceColumnChart,
  TrendChart,
  StructureChart,
  StackedChart,
  LineChart,
  ScatterChart,
  MiniVarianceMultiples,
} from "ibcs-react";
import { CARD_W, fM, fK, fN, C, L, S, varCols } from "@/lib/demo-data/cookbook";

/** Revenue by product line - Aurora Retail · € m · AC vs PY */
export function RevenueByProductLine() {
  return (
    <StructureChart
      data={[
        S("Apparel", 11.2, 9.8),
        S("Footwear", 7.4, 7.9),
        S("Accessories", 5.1, 4.2),
        S("Home & living", 3.8, 2.6),
        S("Outdoor gear", 2.6, 3.1),
      ]}
      comparison="PY"
      width={CARD_W}
      height={220}
      labelWidth={120}
      format={fM}
    />
  );
}

/** Revenue by channel - Aurora Retail · € m · channel mix over quarters */
export function RevenueByChannel() {
  return (
    <StackedChart
      data={[
        {
          category: "Q1",
          values: { online: 4.1, retail: 2.4, wholesale: 1.3 },
        },
        {
          category: "Q2",
          values: { online: 4.6, retail: 2.2, wholesale: 1.5 },
        },
        {
          category: "Q3",
          values: { online: 5.0, retail: 2.1, wholesale: 1.6 },
        },
        {
          category: "Q4",
          values: { online: 5.8, retail: 2.0, wholesale: 1.4 },
        },
      ]}
      series={[
        { key: "online", label: "Online" },
        { key: "retail", label: "Retail" },
        { key: "wholesale", label: "Wholesale" },
      ]}
      orientation="column"
      width={CARD_W}
      height={210}
      format={fK}
      highlight="online"
    />
  );
}

/** Sales-rep leaderboard - Vector Software · € k · bookings AC vs PY */
export function SalesRepLeaderboard() {
  return (
    <DataTable
      columns={varCols("book", "Bookings")}
      rows={[
        {
          id: "r1",
          label: "Dana Whitfield",
          values: { book: { AC: 1240, PY: 980 } },
        },
        {
          id: "r2",
          label: "Marco Pereira",
          values: { book: { AC: 1110, PY: 1190 } },
        },
        {
          id: "r3",
          label: "Aisha Karim",
          values: { book: { AC: 980, PY: 720 } },
        },
        {
          id: "r4",
          label: "Tom Becker",
          values: { book: { AC: 870, PY: 910 } },
        },
        {
          id: "r5",
          label: "Lena Ostrowski",
          values: { book: { AC: 760, PY: 540 } },
        },
      ]}
      format={fN}
      showTotals
      defaultSort={{ key: "book", dir: "desc" }}
    />
  );
}

/** Sales pipeline funnel - Vector Software · count · stage drop-off */
export function SalesPipelineFunnel() {
  return (
    <StructureChart
      data={[
        S("Leads", 4200),
        S("Qualified", 1850),
        S("Proposal", 940),
        S("Negotiation", 410),
        S("Closed won", 188),
      ]}
      comparison="PY"
      showComparison={false}
      variance="none"
      width={CARD_W}
      height={210}
      labelWidth={104}
      format={fN}
    />
  );
}

/** Win rate by region - Vector Software · % · AC vs PY */
export function WinRateByRegion() {
  return (
    <DataTable
      columns={[
        { key: "win", label: "Win %", kind: "value", scenario: "AC" },
        {
          key: "win_d",
          label: "ΔPY",
          kind: "variance",
          measure: "win",
          base: "PY",
          mode: "abs",
          mark: "bar",
        },
      ]}
      rows={[
        {
          id: "na",
          label: "North America",
          values: { win: { AC: 28, PY: 24 } },
        },
        { id: "eu", label: "Europe", values: { win: { AC: 31, PY: 33 } } },
        {
          id: "apac",
          label: "Asia Pacific",
          values: { win: { AC: 22, PY: 18 } },
        },
        {
          id: "latam",
          label: "Latin America",
          values: { win: { AC: 19, PY: 21 } },
        },
      ]}
      format={fN}
    />
  );
}

/** Quota attainment by team - Vector Software · % · AC vs target (PL=100) */
export function QuotaAttainmentByTeam() {
  return (
    <VarianceColumnChart
      data={[
        C("Enterprise", 112, undefined, 100),
        C("Mid-market", 94, undefined, 100),
        C("SMB", 103, undefined, 100),
        C("Channel", 88, undefined, 100),
        C("Public", 121, undefined, 100),
      ]}
      comparison="PL"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Bookings vs target - Vector Software · € m · monthly AC vs PL */
export function BookingsVsTarget() {
  return (
    <TrendChart
      data={[
        L("Jan", { AC: 1.2, PL: 1.3 }),
        L("Feb", { AC: 1.5, PL: 1.4 }),
        L("Mar", { AC: 1.8, PL: 1.6 }),
        L("Apr", { AC: 1.6, PL: 1.7 }),
        L("May", { AC: 2.0, PL: 1.8 }),
        L("Jun", { AC: 2.3, PL: 2.0 }),
        L("Jul", { FC: 2.2, PL: 2.1 }),
        L("Aug", { FC: 2.5, PL: 2.3 }),
      ]}
      comparison="PL"
      width={CARD_W}
      height={236}
      format={fK}
    />
  );
}

/** Discount vs deal size - Vector Software · won deals this quarter */
export function DiscountVsDealSize() {
  return (
    <ScatterChart
      data={[
        { x: 12, y: 8, group: "Enterprise" },
        { x: 45, y: 22, group: "Enterprise" },
        { x: 30, y: 15, group: "Mid" },
        { x: 8, y: 4, group: "SMB" },
        { x: 60, y: 31, group: "Enterprise" },
        { x: 22, y: 9, group: "Mid" },
        { x: 5, y: 2, group: "SMB" },
        { x: 38, y: 18, group: "Mid" },
        { x: 15, y: 6, group: "SMB" },
        { x: 52, y: 27, group: "Enterprise" },
      ]}
      xLabel="Deal size (€ k)"
      yLabel="Discount %"
      width={CARD_W}
      height={220}
      format={fN}
    />
  );
}

/** New vs existing business - Aurora Retail · € m · quarterly split */
export function NewVsExistingBusiness() {
  return (
    <StackedChart
      data={[
        { category: "Q1", values: { neww: 3.1, expand: 1.8, renew: 3.9 } },
        { category: "Q2", values: { neww: 3.4, expand: 2.0, renew: 3.9 } },
        { category: "Q3", values: { neww: 2.9, expand: 2.4, renew: 4.3 } },
        { category: "Q4", values: { neww: 3.8, expand: 2.6, renew: 4.0 } },
      ]}
      series={[
        { key: "neww", label: "New" },
        { key: "expand", label: "Expansion" },
        { key: "renew", label: "Renewal" },
      ]}
      orientation="column"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Average deal size trend - Vector Software · € k · 12 months (dense) */
export function AverageDealSizeTrend() {
  return (
    <LineChart
      data={[
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
      ].map((m, i) => L(m, { AC: 18 + Math.round(6 * Math.sin(i / 1.8)) + i, PY: 16 + i }))}
      comparison="PY"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Top accounts by revenue - Aurora Retail · € k · AC vs PY (sortable) */
export function TopAccountsByRevenue() {
  return (
    <DataTable
      columns={varCols("rev", "Revenue")}
      rows={[
        {
          id: "a1",
          label: "Brightline Logistics Group",
          values: { rev: { AC: 2140, PY: 1880 } },
        },
        {
          id: "a2",
          label: "Meridian Health Systems",
          values: { rev: { AC: 1760, PY: 1920 } },
        },
        {
          id: "a3",
          label: "Quantum Robotics",
          values: { rev: { AC: 1410, PY: 990 } },
        },
        {
          id: "a4",
          label: "Solstice Energy",
          values: { rev: { AC: 1180, PY: 1240 } },
        },
        {
          id: "a5",
          label: "Tideway Foods",
          values: { rev: { AC: 940, PY: 760 } },
        },
      ]}
      format={fN}
      showTotals
      defaultSort={{ key: "rev", dir: "desc" }}
    />
  );
}

/** Regional bookings - small multiples - Vector Software · € m · AC vs PY */
export function RegionalBookingsSmallMultiples() {
  return (
    <div style={{ width: CARD_W }}>
      <MiniVarianceMultiples
        groups={[
          {
            label: "North America",
            data: [C("Q1", 4.2, 4.4), C("Q2", 4.0, 4.3), C("Q3", 4.5, 4.2), C("Q4", 5.1, 4.6)],
          },
          {
            label: "Europe",
            data: [C("Q1", 3.1, 2.8), C("Q2", 3.4, 3.0), C("Q3", 3.6, 3.2), C("Q4", 3.9, 3.5)],
          },
          {
            label: "Asia Pacific",
            data: [C("Q1", 1.8, 1.4), C("Q2", 2.0, 1.6), C("Q3", 2.2, 1.7), C("Q4", 2.6, 1.9)],
          },
          {
            label: "Latin America",
            data: [C("Q1", 0.9, 1.1), C("Q2", 1.0, 1.0), C("Q3", 1.1, 1.2), C("Q4", 0.8, 0.9)],
          },
        ]}
        comparison="PY"
        columns={2}
        format={fK}
      />
    </div>
  );
}

/** Discount analysis by tier - Aurora Retail · % · AC vs PY (cost-like) */
export function DiscountAnalysisByTier() {
  return (
    <VarianceColumnChart
      data={[
        C("List", 0, 0),
        C("Tier 1", 8, 6),
        C("Tier 2", 14, 11),
        C("Tier 3", 22, 25),
        C("Clearance", 41, 38),
      ]}
      comparison="PY"
      higherIsBetter={false}
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Lost-deal reasons - Vector Software · count · this quarter */
export function LostDealReasons() {
  return (
    <StructureChart
      data={[
        S("Price", 64, 58, undefined, false),
        S("Missing feature", 41, 49, undefined, false),
        S("Lost to incumbent", 33, 30, undefined, false),
        S("No decision", 28, 22, undefined, false),
        S("Timing", 17, 19, undefined, false),
      ]}
      comparison="PY"
      higherIsBetter={false}
      width={CARD_W}
      height={210}
      labelWidth={120}
      format={fN}
    />
  );
}
