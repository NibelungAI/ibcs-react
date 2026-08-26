import { useMemo } from "react";
import { Report, type ReportConfig, type IbcsTokens } from "ibcs-react";
import {
  sampleStatementFlat,
  sampleMonthlyTrend,
  sampleRevenueStructure,
  sampleQuarterlyRevenue,
} from "../src/demo/sampleData";

/**
 * A dynamic report assembled entirely from a JSON `ReportConfig`: a KPI strip,
 * the IBCS income statement, a 13-period trend, a revenue structure, and a
 * quarterly variance chart — all on one responsive grid, one theme. This is the
 * "build reports from components + cards in blocks" target, ISO 24896-styled
 * (Who/What/When title, impact-coloured variances, embedded variance bars).
 */
export function ExampleReport({ tokens }: { tokens?: IbcsTokens }) {
  const config = useMemo<ReportConfig>(
    () => ({
      title: {
        who: "Contoso Group",
        what: "Performance summary — € thousands",
        when: "FY 2026 · Actual vs Previous year",
      },
      message:
        "Revenue +17.5% on PY; margin expansion lifts net income to €8.9M despite a higher tax charge.",
      columns: 12,
      blocks: [
        {
          id: "kpi-rev",
          type: "kpi",
          span: 3,
          config: {
            label: "Revenue",
            values: { AC: 30_100_000, PY: 25_600_000, PL: 28_500_000 },
            comparisons: ["PY", "PL"],
            format: { compact: true, decimals: 1 },
            sparkline: [
              2_300_000, 2_450_000, 2_600_000, 2_400_000, 2_550_000, 2_700_000, 2_650_000,
              2_800_000, 2_900_000,
            ],
          },
        },
        {
          id: "kpi-gm",
          type: "kpi",
          span: 3,
          config: {
            label: "Gross margin",
            values: { AC: 20_400_000, PY: 17_200_000, PL: 19_100_000 },
            comparisons: ["PY"],
            format: { compact: true, decimals: 1 },
            sparkline: [1.4e6, 1.55e6, 1.6e6, 1.5e6, 1.7e6, 1.75e6, 1.8e6],
          },
        },
        {
          id: "kpi-oi",
          type: "kpi",
          span: 3,
          config: {
            label: "Operating income",
            values: { AC: 10_400_000, PY: 7_700_000, PL: 9_100_000 },
            comparisons: ["PY"],
            format: { compact: true, decimals: 1 },
            sparkline: [0.7e6, 0.8e6, 0.9e6, 0.85e6, 1.0e6, 1.05e6, 1.1e6],
          },
        },
        {
          id: "kpi-ni",
          type: "kpi",
          span: 3,
          config: {
            label: "Net income",
            values: { AC: 8_900_000, PY: 8_100_000, PL: 7_490_000 },
            comparisons: ["PY", "PL"],
            format: { compact: true, decimals: 1 },
            sparkline: [0.6e6, 0.7e6, 0.75e6, 0.7e6, 0.8e6, 0.82e6, 0.9e6],
          },
        },
        {
          id: "stmt",
          type: "statement",
          span: 7,
          title: { who: "Contoso Group", what: "Income statement — € thousands", when: "FY 2026" },
          config: {
            lines: sampleStatementFlat,
            waterfallWidth: 230,
            mark: "bar",
            format: { compact: true, decimals: 1 },
          },
        },
        {
          id: "trend",
          type: "chart",
          span: 5,
          title: {
            who: "Contoso Group",
            what: "Revenue — € thousands",
            when: "Jan–Dec 2026, AC/FC vs PY",
          },
          config: {
            type: "trend",
            data: sampleMonthlyTrend,
            width: 460,
            height: 300,
            format: { compact: true },
          },
        },
        {
          id: "structure",
          type: "chart",
          span: 6,
          title: {
            who: "Contoso Group",
            what: "Revenue by region — € thousands",
            when: "FY 2026 vs PY",
          },
          config: {
            type: "structure",
            data: sampleRevenueStructure,
            width: 520,
            height: 280,
            format: { compact: true },
          },
        },
        {
          id: "quarter",
          type: "chart",
          span: 6,
          title: {
            who: "Contoso Group",
            what: "Revenue by quarter — € thousands",
            when: "FY 2026 vs PY",
          },
          config: {
            type: "varianceColumn",
            data: sampleQuarterlyRevenue,
            comparison: "PY",
            width: 520,
            height: 280,
            format: { compact: true },
          },
        },
        {
          id: "bridge",
          type: "chart",
          span: 7,
          title: {
            who: "Contoso Group",
            what: "Operating income bridge — € thousands",
            when: "FY 2026, Revenue to Operating income",
          },
          message:
            "Gross margin of €20.4M absorbs €10.0M of operating expense, landing operating income at €10.4M.",
          config: {
            type: "waterfall",
            data: [
              { category: "Revenue", value: 30_100_000, flow: "add" },
              { category: "COGS", value: 9_700_000, flow: "subtract", higherIsBetter: false },
              { category: "Gross margin", value: 20_400_000, flow: "result" },
              { category: "Opex", value: 10_000_000, flow: "subtract", higherIsBetter: false },
              { category: "Operating income", value: 10_400_000, flow: "result" },
            ],
            width: 560,
            height: 300,
            format: { compact: true, decimals: 1 },
          },
        },
        {
          id: "regions",
          type: "table",
          span: 5,
          title: {
            who: "Contoso Group",
            what: "Revenue by region — € thousands",
            when: "FY 2026 · AC vs PY",
          },
          config: {
            showTotals: true,
            defaultSort: { key: "rev", dir: "desc" },
            format: { compact: true, decimals: 1 },
            columns: [
              { key: "rev", label: "Revenue AC", kind: "value" },
              {
                key: "rev_dpy",
                label: "ΔPY",
                kind: "variance",
                measure: "rev",
                base: "PY",
                mode: "abs",
                mark: "bar",
              },
              {
                key: "rev_dpy_pct",
                label: "ΔPY %",
                kind: "variance",
                measure: "rev",
                base: "PY",
                mode: "pct",
                mark: "pin",
              },
              {
                key: "trend",
                label: "Trend",
                kind: "sparkline",
                measure: "rev",
                sparkType: "line",
              },
            ],
            rows: [
              {
                id: "emea",
                label: "EMEA",
                values: { rev: { AC: 12_400_000, PY: 10_900_000 } },
                spark: { rev: [0.9e6, 0.95e6, 1.0e6, 1.0e6, 1.05e6, 1.1e6] },
              },
              {
                id: "amer",
                label: "Americas",
                values: { rev: { AC: 9_800_000, PY: 8_200_000 } },
                spark: { rev: [0.65e6, 0.7e6, 0.78e6, 0.8e6, 0.85e6, 0.9e6] },
              },
              {
                id: "apac",
                label: "APAC",
                values: { rev: { AC: 5_600_000, PY: 4_600_000 } },
                spark: { rev: [0.38e6, 0.4e6, 0.44e6, 0.46e6, 0.49e6, 0.52e6] },
              },
              {
                id: "other",
                label: "Other",
                values: { rev: { AC: 2_300_000, PY: 1_900_000 } },
                spark: { rev: [0.16e6, 0.17e6, 0.18e6, 0.19e6, 0.2e6, 0.21e6] },
              },
            ],
          },
        },
      ],
    }),
    [],
  );

  return <Report config={config} tokens={tokens} />;
}
