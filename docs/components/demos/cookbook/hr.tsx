"use client";

/**
 * Report cookbook — People & HR. One component per recipe; each renders the
 * exact snippet printed next to it in `content/docs/cookbook.mdx`.
 */
import {
  DataTable,
  VarianceColumnChart,
  StructureChart,
  StackedChart,
  LineChart,
  BubbleChart,
  ComboChart,
} from "ibcs-react";
import { CARD_W, fK, fN, fN1, C, L, S, varCols } from "@/lib/demo-data/cookbook";
import { KpiStrip } from "./shared";

/** Headcount by department — Aurora Retail · FTE · AC vs PY */
export function HeadcountByDepartment() {
  return (
    <StructureChart
      data={[
        S("Operations", 412, 398),
        S("Engineering", 168, 140),
        S("Sales", 134, 122),
        S("Customer success", 96, 81),
        S("Marketing", 54, 60),
        S("G&A", 48, 45),
      ]}
      comparison="PY"
      width={CARD_W}
      height={230}
      labelWidth={130}
      format={fN}
    />
  );
}

/** Attrition trend — Aurora Retail · % annualized · lower better */
export function AttritionTrend() {
  return (
    <LineChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m, i) =>
        L(m, { AC: 14 - i * 0.3 + (i % 2 ? 1 : 0), PY: 16 - i * 0.2 }),
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

/** Hiring funnel — Aurora Retail · count · application → hire */
export function HiringFunnel() {
  return (
    <StructureChart
      data={[
        S("Applications", 2840),
        S("Phone screen", 640),
        S("Onsite", 220),
        S("Offer", 96),
        S("Hired", 71),
      ]}
      comparison="PY"
      showComparison={false}
      variance="none"
      width={CARD_W}
      height={210}
      labelWidth={104}
      format={fK}
    />
  );
}

/** Compensation by level — Aurora Retail · € k · base salary spread */
export function CompensationByLevel() {
  return (
    <BubbleChart
      data={[
        { x: 1, y: 42, size: 180, group: "IC", label: "L1" },
        { x: 2, y: 58, size: 240, group: "IC", label: "L2" },
        { x: 3, y: 78, size: 160, group: "IC", label: "L3" },
        { x: 4, y: 102, size: 90, group: "Manager", label: "M1" },
        { x: 5, y: 138, size: 50, group: "Manager", label: "M2" },
        { x: 6, y: 190, size: 22, group: "Director", label: "D1" },
      ]}
      xLabel="Level"
      yLabel="Median base (€ k)"
      sizeLabel="Headcount"
      width={CARD_W}
      height={220}
      format={fN}
    />
  );
}

/** Gender diversity by org — Aurora Retail · % · current */
export function GenderDiversityByOrg() {
  return (
    <StackedChart
      data={[
        { category: "Engineering", values: { w: 32, m: 64, o: 4 } },
        { category: "Sales", values: { w: 48, m: 49, o: 3 } },
        { category: "Operations", values: { w: 41, m: 56, o: 3 } },
        { category: "Leadership", values: { w: 38, m: 60, o: 2 } },
      ]}
      series={[
        { key: "w", label: "Women" },
        { key: "m", label: "Men" },
        { key: "o", label: "Other / N/A" },
      ]}
      orientation="bar"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Headcount plan vs actual — Aurora Retail · FTE · AC vs PL by quarter */
export function HeadcountPlanVsActual() {
  return (
    <VarianceColumnChart
      data={[
        C("Q1", 920, undefined, 940),
        C("Q2", 968, undefined, 980),
        C("Q3", 1010, undefined, 1005),
        C("Q4", 1048, undefined, 1060),
      ]}
      comparison="PL"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Tenure distribution — Aurora Retail · FTE · by band */
export function TenureDistribution() {
  return (
    <StackedChart
      data={[
        {
          category: "All staff",
          values: { y0: 240, y1: 380, y3: 290, y5: 180 },
        },
      ]}
      series={[
        { key: "y0", label: "<1 yr" },
        { key: "y1", label: "1–3 yr" },
        { key: "y3", label: "3–5 yr" },
        { key: "y5", label: "5+ yr" },
      ]}
      orientation="bar"
      width={CARD_W}
      height={150}
      format={fK}
      showTotals
    />
  );
}

/** Talent KPIs — Aurora Retail · AC vs PY */
export function TalentKPIs() {
  return (
    <KpiStrip
      items={[
        {
          label: "Time to hire",
          values: { AC: 32, PY: 41 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: { ...fN, suffix: " d" },
        },
        {
          label: "Offer accept",
          values: { AC: 84, PY: 79 },
          comparisons: ["PY"],
          format: { ...fN, suffix: "%" },
        },
        {
          label: "eNPS",
          values: { AC: 28, PY: 19 },
          comparisons: ["PY"],
          format: fN,
        },
      ]}
    />
  );
}

/** Span of control — Aurora Retail · reports per manager · by org */
export function SpanOfControl() {
  return (
    <DataTable
      columns={varCols("span", "Avg span")}
      rows={[
        {
          id: "o1",
          label: "Operations",
          values: { span: { AC: 9.2, PY: 8.4 } },
        },
        {
          id: "o2",
          label: "Engineering",
          values: { span: { AC: 6.1, PY: 5.8 } },
        },
        { id: "o3", label: "Sales", values: { span: { AC: 7.4, PY: 7.9 } } },
        {
          id: "o4",
          label: "Support",
          values: { span: { AC: 11.0, PY: 10.2 } },
        },
      ]}
      format={fN1}
      defaultSort={{ key: "span", dir: "desc" }}
    />
  );
}

/** Offer acceptance rate — Aurora Retail · % · monthly AC vs PY */
export function OfferAcceptanceRate() {
  return (
    <LineChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m, i) =>
        L(m, { AC: 78 + i + (i % 2 ? 3 : 0), PY: 75 + i }),
      )}
      comparison="PY"
      width={CARD_W}
      height={200}
      format={fN}
    />
  );
}

/** Training hours per FTE — Aurora Retail · hours · AC vs PL target */
export function TrainingHoursPerFTE() {
  return (
    <VarianceColumnChart
      data={[
        C("Eng", 28, undefined, 24),
        C("Sales", 16, undefined, 20),
        C("Ops", 12, undefined, 14),
        C("Support", 22, undefined, 18),
      ]}
      comparison="PL"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Workforce cost & FTE — Aurora Retail · € m / FTE · combo */
export function WorkforceCostAndFTE() {
  return (
    <ComboChart
      data={[C("FY23", 58), C("FY24", 64), C("FY25", 71), C("FY26", 78)]}
      secondary={[
        { category: "FY23", value: 840 },
        { category: "FY24", value: 910 },
        { category: "FY25", value: 990 },
        { category: "FY26", value: 1048 },
      ]}
      primaryLabel="Cost (€ m)"
      secondaryLabel="FTE"
      secondaryFormat={fK}
      width={CARD_W}
      height={220}
      format={fK}
    />
  );
}

/** Absenteeism rate — Aurora Retail · % · monthly, lower better */
export function AbsenteeismRate() {
  return (
    <LineChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m, i) =>
        L(m, { AC: 3.1 + (i % 3 === 0 ? 0.8 : -0.2), PY: 3.4 }),
      )}
      comparison="PY"
      higherIsBetter={false}
      width={CARD_W}
      height={200}
      format={fN1}
    />
  );
}
