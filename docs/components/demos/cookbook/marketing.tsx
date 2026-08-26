"use client";

/**
 * Report cookbook — Marketing. One component per recipe; each renders the
 * exact snippet printed next to it in `content/docs/cookbook.mdx`.
 */
import {
  DataTable,
  VarianceColumnChart,
  StructureChart,
  StackedChart,
  LineChart,
  AreaChart,
  ComboChart,
} from "ibcs-react";
import { CARD_W, fK, fN, fN1, C, L, S } from "@/lib/demo-data/cookbook";
import { KpiStrip } from "./shared";

/** Marketing funnel — Lumen Media · count · impressions → won */
export function MarketingFunnel() {
  return (
    <StructureChart
      data={[
        S("Impressions", 1_240_000),
        S("Clicks", 96_400),
        S("Leads", 18_200),
        S("MQLs", 7_400),
        S("SQLs", 2_900),
        S("Won", 410),
      ]}
      comparison="PY"
      showComparison={false}
      variance="none"
      width={CARD_W}
      height={220}
      labelWidth={104}
      format={fK}
    />
  );
}

/** MQL → SQL conversion — Lumen Media · % · monthly AC vs PY */
export function MQLSQLConversion() {
  return (
    <VarianceColumnChart
      data={[
        C("Jan", 38, 34),
        C("Feb", 41, 36),
        C("Mar", 39, 40),
        C("Apr", 44, 38),
        C("May", 47, 41),
        C("Jun", 43, 42),
      ]}
      comparison="PY"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** CAC by channel — Lumen Media · € · cost per acquisition (lower better) */
export function CACByChannel() {
  return (
    <StructureChart
      data={[
        S("Paid search", 142, 128, undefined, false),
        S("Paid social", 98, 110, undefined, false),
        S("Events", 410, 380, undefined, false),
        S("Content / SEO", 54, 71, undefined, false),
        S("Referral", 31, 28, undefined, false),
      ]}
      comparison="PY"
      higherIsBetter={false}
      width={CARD_W}
      height={220}
      labelWidth={120}
      format={fN}
    />
  );
}

/** LTV : CAC & payback — Lumen Media · ratio / months · AC vs PY */
export function LTVCACAndPayback() {
  return (
    <KpiStrip
      items={[
        {
          label: "LTV : CAC",
          values: { AC: 4.2, PY: 3.6 },
          comparisons: ["PY"],
          format: { ...fN1, currency: "×" },
        },
        {
          label: "CAC payback",
          values: { AC: 11, PY: 14 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: { ...fN, suffix: " mo" },
        },
        {
          label: "Blended CAC",
          values: { AC: 96, PY: 104 },
          comparisons: ["PY"],
          higherIsBetter: false,
          format: { ...fN, currency: "€" },
        },
      ]}
    />
  );
}

/** Channel ROI — Lumen Media · € k · spend vs return (sortable) */
export function ChannelROI() {
  return (
    <DataTable
      columns={[
        { key: "spend", label: "Spend", kind: "value", scenario: "AC" },
        { key: "ret", label: "Return", kind: "value", scenario: "AC" },
        {
          key: "roi",
          label: "ROI×",
          kind: "value",
          scenario: "AC",
          format: fN1,
        },
      ]}
      rows={[
        {
          id: "ps",
          label: "Paid search",
          values: { spend: { AC: 210 }, ret: { AC: 820 }, roi: { AC: 3.9 } },
        },
        {
          id: "so",
          label: "Paid social",
          values: { spend: { AC: 180 }, ret: { AC: 540 }, roi: { AC: 3.0 } },
        },
        {
          id: "ev",
          label: "Events",
          values: { spend: { AC: 320 }, ret: { AC: 410 }, roi: { AC: 1.3 } },
        },
        {
          id: "co",
          label: "Content",
          values: { spend: { AC: 90 }, ret: { AC: 560 }, roi: { AC: 6.2 } },
        },
      ]}
      format={fN}
      defaultSort={{ key: "roi", dir: "desc" }}
    />
  );
}

/** Web traffic trend — Lumen Media · k sessions · AC vs PY */
export function WebTrafficTrend() {
  return (
    <AreaChart
      data={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((w, i) =>
        L(w, { AC: 120 + i * 9 + (i % 2 ? 8 : 0), PY: 110 + i * 6 }),
      )}
      scenario="AC"
      baseline="PY"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Campaign performance — Lumen Media · multi-metric · current month */
export function CampaignPerformance() {
  return (
    <DataTable
      columns={[
        { key: "imp", label: "Impr.", kind: "value", scenario: "AC" },
        {
          key: "ctr",
          label: "CTR%",
          kind: "value",
          scenario: "AC",
          format: fN1,
        },
        { key: "cpl", label: "CPL €", kind: "value", scenario: "AC" },
        {
          key: "spk",
          label: "Trend",
          kind: "sparkline",
          measure: "spk",
          sparkType: "bar",
        },
      ]}
      rows={[
        {
          id: "c1",
          label: "Spring launch",
          values: { imp: { AC: 480000 }, ctr: { AC: 2.4 }, cpl: { AC: 38 } },
          spark: { spk: [8, 12, 9, 15, 18, 14, 21] },
        },
        {
          id: "c2",
          label: "Retargeting",
          values: { imp: { AC: 210000 }, ctr: { AC: 4.1 }, cpl: { AC: 22 } },
          spark: { spk: [5, 6, 8, 7, 9, 11, 13] },
        },
        {
          id: "c3",
          label: "Brand always-on",
          values: { imp: { AC: 920000 }, ctr: { AC: 0.9 }, cpl: { AC: 61 } },
          spark: { spk: [20, 18, 19, 17, 16, 18, 15] },
        },
      ]}
      format={fN}
    />
  );
}

/** Email engagement — Lumen Media · % · open vs click, 8 weeks */
export function EmailEngagement() {
  return (
    <LineChart
      data={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((w, i) =>
        L(w, { AC: 24 + (i % 3) * 2, PY: 21 + i * 0.4 }),
      )}
      comparison="PY"
      width={CARD_W}
      height={210}
      format={fN}
    />
  );
}

/** Spend & cost-per-lead — Lumen Media · € k / € · monthly combo */
export function SpendAndCostPerLead() {
  return (
    <ComboChart
      data={[C("Jan", 64), C("Feb", 71), C("Mar", 58), C("Apr", 82), C("May", 90), C("Jun", 76)]}
      secondary={[
        { category: "Jan", value: 41 },
        { category: "Feb", value: 38 },
        { category: "Mar", value: 47 },
        { category: "Apr", value: 33 },
        { category: "May", value: 31 },
        { category: "Jun", value: 36 },
      ]}
      primaryLabel="Spend (€ k)"
      secondaryLabel="CPL (€)"
      secondaryFormat={fN}
      width={CARD_W}
      height={220}
      format={fN}
    />
  );
}

/** Channel mix of MQLs — Lumen Media · count · quarter-over-quarter */
export function ChannelMixOfMQLs() {
  return (
    <StackedChart
      data={[
        {
          category: "Q1",
          values: { search: 2100, social: 1400, content: 1800, events: 600 },
        },
        {
          category: "Q2",
          values: { search: 2300, social: 1600, content: 2000, events: 500 },
        },
        {
          category: "Q3",
          values: { search: 2200, social: 1900, content: 2400, events: 700 },
        },
      ]}
      series={[
        { key: "search", label: "Search" },
        { key: "social", label: "Social" },
        { key: "content", label: "Content" },
        { key: "events", label: "Events" },
      ]}
      orientation="column"
      width={CARD_W}
      height={210}
      format={fK}
    />
  );
}

/** Brand vs performance spend — Lumen Media · € k · split by half */
export function BrandVsPerformanceSpend() {
  return (
    <StackedChart
      data={[
        { category: "H1", values: { brand: 420, perf: 880 } },
        { category: "H2", values: { brand: 510, perf: 760 } },
      ]}
      series={[
        { key: "brand", label: "Brand" },
        { key: "perf", label: "Performance" },
      ]}
      orientation="bar"
      width={CARD_W}
      height={180}
      format={fK}
      showTotals
    />
  );
}

/** SEO vs paid sessions — Lumen Media · k · two-series line */
export function SEOVsPaidSessions() {
  return (
    <LineChart
      data={["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m, i) =>
        L(m, { AC: 60 + i * 8, PY: 50 + i * 4 }),
      )}
      series={["AC", "PY"]}
      width={CARD_W}
      height={200}
      format={fN}
    />
  );
}

/** Landing-page conversion — Lumen Media · % · AC vs PL target */
export function LandingPageConversion() {
  return (
    <VarianceColumnChart
      data={[
        C("Home", 3.2, undefined, 3.0),
        C("Pricing", 6.8, undefined, 6.0),
        C("Demo", 11.4, undefined, 10.0),
        C("Blog", 1.1, undefined, 1.5),
      ]}
      comparison="PL"
      width={CARD_W}
      height={210}
      format={fN1}
    />
  );
}
