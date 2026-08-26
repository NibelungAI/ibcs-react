"use client";

/**
 * Report cookbook — Product & SaaS. One component per recipe; each renders the
 * exact snippet printed next to it in `content/docs/cookbook.mdx`.
 */
import {
  MatrixTable,
  VarianceColumnChart,
  TrendChart,
  StructureChart,
  WaterfallChart,
  StackedChart,
  LineChart,
  BubbleChart,
  ComboChart,
} from "ibcs-react";
import { sampleMonthlyTrend } from "@/lib/demo-data/sample-data";
import {
  CARD_W,
  fK,
  fN,
  fN1,
  C,
  L,
  S,
  W,
  cohortRows,
  cohortCols,
  cohortValues,
} from "@/lib/demo-data/cookbook";
import { KpiStrip } from "./shared";

/** MRR trend — Vector Software · € k · 13 periods, AC + forecast */
export function MRRTrend() {
  return (
    <TrendChart
      data={sampleMonthlyTrend.map((d, i) => ({
        category: `M${i + 1}`,
        ...(d.AC ? { AC: d.AC / 1000 } : {}),
        ...(d.FC ? { FC: d.FC / 1000 } : {}),
        PL: (d.PL ?? 0) / 1000,
      }))}
      comparison="PL"
      width={CARD_W}
      height={236}
      format={fK}
    />
  );
}

/** ARR bridge — Vector Software · € k · beginning → ending ARR */
export function ARRBridge() {
  return (
    <WaterfallChart
      data={[
        W("Beginning ARR", 8200, "result"),
        W("New", 1640, "add"),
        W("Expansion", 920, "add"),
        W("Contraction", 310, "subtract", false),
        W("Churn", 540, "subtract", false),
        W("Ending ARR", 9910, "result"),
      ]}
      scenario="AC"
      width={CARD_W}
      height={220}
      format={fK}
    />
  );
}

/** Net revenue retention — Vector Software · % · AC vs PY */
export function NetRevenueRetention() {
  return (
    <KpiStrip
      items={[
        {
          label: "NRR",
          values: { AC: 114, PY: 108 },
          comparisons: ["PY"],
          format: { ...fN, suffix: "%" },
        },
        {
          label: "Gross retention",
          values: { AC: 92, PY: 90 },
          comparisons: ["PY"],
          format: { ...fN, suffix: "%" },
        },
        {
          label: "Logo retention",
          values: { AC: 88, PY: 91 },
          comparisons: ["PY"],
          format: { ...fN, suffix: "%" },
        },
      ]}
    />
  );
}

/** Monthly churn rate — Vector Software · % · lower is better */
export function MonthlyChurnRate() {
  return (
    <LineChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m, i) =>
        L(m, { AC: 3.4 - i * 0.1 + (i % 2 ? 0.3 : 0), PY: 3.8 - i * 0.05 }),
      )}
      comparison="PY"
      higherIsBetter={false}
      variance="abs"
      width={CARD_W}
      height={236}
      format={fN1}
    />
  );
}

/** Cohort retention — Vector Software · % retained by month (matrix) */
export function CohortRetention() {
  return (
    <MatrixTable
      rows={cohortRows}
      columns={cohortCols}
      values={cohortValues}
      scenarios={["AC"]}
      showVariance={false}
      labelWidth={92}
      format={fN}
    />
  );
}

/** DAU & stickiness — Vector Software · k users / DAU-MAU % */
export function DAUAndStickiness() {
  return (
    <ComboChart
      data={[
        C("Mon", 42),
        C("Tue", 48),
        C("Wed", 51),
        C("Thu", 49),
        C("Fri", 46),
        C("Sat", 28),
        C("Sun", 24),
      ]}
      secondary={[
        { category: "Mon", value: 31 },
        { category: "Tue", value: 35 },
        { category: "Wed", value: 37 },
        { category: "Thu", value: 36 },
        { category: "Fri", value: 33 },
        { category: "Sat", value: 20 },
        { category: "Sun", value: 18 },
      ]}
      primaryLabel="DAU (k)"
      secondaryLabel="Stickiness %"
      secondaryFormat={fN}
      width={CARD_W}
      height={220}
      format={fN}
    />
  );
}

/** NPS trend — Vector Software · score · quarterly (with PY) */
export function NPSTrend() {
  return (
    <VarianceColumnChart
      data={[C("Q1", 38, 31), C("Q2", 42, 35), C("Q3", 45, 44), C("Q4", 51, 46)]}
      comparison="PY"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Feature adoption — Vector Software · % of accounts using feature */
export function FeatureAdoption() {
  return (
    <StructureChart
      data={[
        S("Dashboards", 86, 80),
        S("Automations", 61, 48),
        S("API access", 44, 39),
        S("Mobile app", 38, 41),
        S("Single sign-on", 29, 18),
      ]}
      comparison="PY"
      width={CARD_W}
      height={220}
      labelWidth={120}
      format={fN}
    />
  );
}

/** Active users by plan — Vector Software · k · plan mix over time */
export function ActiveUsersByPlan() {
  return (
    <StackedChart
      data={[
        { category: "Q1", values: { free: 84, pro: 31, ent: 9 } },
        { category: "Q2", values: { free: 91, pro: 36, ent: 11 } },
        { category: "Q3", values: { free: 96, pro: 42, ent: 14 } },
        { category: "Q4", values: { free: 102, pro: 49, ent: 17 } },
      ]}
      series={[
        { key: "free", label: "Free" },
        { key: "pro", label: "Pro" },
        { key: "ent", label: "Enterprise" },
      ]}
      orientation="column"
      width={CARD_W}
      height={210}
      format={fN}
      highlight="ent"
    />
  );
}

/** Expansion vs contraction — Vector Software · € k · net by month */
export function ExpansionVsContraction() {
  return (
    <VarianceColumnChart
      data={[
        C("Jan", 120, 90),
        C("Feb", 140, 110),
        C("Mar", -40, 60),
        C("Apr", 180, 130),
        C("May", 210, 160),
        C("Jun", 95, 140),
      ]}
      comparison="PY"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Trial conversion funnel — Vector Software · count · signup → paid */
export function TrialConversionFunnel() {
  return (
    <StructureChart
      data={[
        S("Signups", 3200),
        S("Activated", 1980),
        S("Used core feature", 1240),
        S("Invited team", 680),
        S("Converted to paid", 410),
      ]}
      comparison="PY"
      showComparison={false}
      variance="none"
      width={CARD_W}
      height={210}
      labelWidth={120}
      format={fK}
    />
  );
}

/** Support volume & CSAT — Vector Software · tickets / CSAT % */
export function SupportVolumeAndCSAT() {
  return (
    <ComboChart
      data={[C("W1", 320), C("W2", 290), C("W3", 410), C("W4", 380), C("W5", 350), C("W6", 300)]}
      secondary={[
        { category: "W1", value: 91 },
        { category: "W2", value: 93 },
        { category: "W3", value: 87 },
        { category: "W4", value: 89 },
        { category: "W5", value: 92 },
        { category: "W6", value: 94 },
      ]}
      primaryLabel="Tickets"
      secondaryLabel="CSAT %"
      secondaryFormat={fN}
      width={CARD_W}
      height={220}
      format={fN}
    />
  );
}

/** Time-to-value vs account size — Vector Software · onboarded accounts */
export function TimeToValueVsAccountSize() {
  return (
    <BubbleChart
      data={[
        { x: 12, y: 88, size: 420, group: "Enterprise", label: "Brightline" },
        { x: 5, y: 76, size: 120, group: "Mid", label: "Tideway" },
        { x: 21, y: 91, size: 640, group: "Enterprise", label: "Meridian" },
        { x: 3, y: 64, size: 60, group: "SMB" },
        { x: 9, y: 80, size: 210, group: "Mid" },
        { x: 2, y: 58, size: 45, group: "SMB" },
      ]}
      xLabel="Days to value"
      yLabel="Health score"
      sizeLabel="ARR"
      width={CARD_W}
      height={220}
      format={fN}
    />
  );
}

/** ARPU by segment — Vector Software · € / month · AC vs PY */
export function ARPUBySegment() {
  return (
    <StructureChart
      data={[
        S("Enterprise", 1240, 1120),
        S("Mid-market", 410, 380),
        S("SMB", 96, 88),
        S("Self-serve", 29, 31),
      ]}
      comparison="PY"
      width={CARD_W}
      height={200}
      labelWidth={120}
      format={fN}
    />
  );
}
