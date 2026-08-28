/**
 * A complete worked build.mjs — the six-page report this skill produces from a
 * P&L and a balance sheet (the Vantera demo pack: AC / PY / PL on the P&L,
 * AC / PY on the balance sheet, source figures in TEUR).
 *
 * To run: node <skill>/scripts/setup.mjs report-build, copy this file into
 * report-build/ as build.mjs, then: node build.mjs && node fit.mjs && node render.mjs
 *
 * What it demonstrates, page by page:
 *   1 cover        an editorial title; facts limited to what the source states
 *   2 contents     contents(), notationKey(), the basis line
 *   3 key figures  DataTable with a Budget column group + a plain ratio strip
 *   4 income stmt  StatementTable — the integrated waterfall, ΔPY bar + ΔPY% pin
 *   5 EBIT bridge  WaterfallChart with comparisonData = the budget bridge
 *   6 balance sht  StatementTable mode="stock", merged small lines
 *
 * Two conventions the whole skill hangs on, visible throughout:
 *   - costs are POSITIVE magnitudes; flow:"subtract" carries the sign
 *   - higherIsBetter:false on every cost / debt line, so an overrun reads red
 */
import React from "react";
import { StatementTable, WaterfallChart, DataTable } from "ibcs-react";
import {
  R,
  TOKENS,
  FMT,
  makePage,
  coverBody,
  contents,
  notationKey,
  lockup,
  css,
  documentHtml,
  scaleUnits,
  H2,
  P,
  CAP,
} from "./kit.mjs";
import fs from "node:fs";

const h = React.createElement;
const INK = "#171B1F";
const TOTAL = 6;
const page = makePage({
  entity: "Vantera Industrial Group AG",
  total: TOTAL,
  fallbackSection: "Annual Management Report 2025",
  ink: INK,
});

/* ---------------------------------------------------------------- data
   Straight from the workbook, in TEUR, costs flipped to positive magnitudes.
   scaleUnits(×1000) turns TEUR into euro so charts print "412.3M". */

const pnl = scaleUnits([
  {
    id: "revenue",
    label: "Revenue",
    flow: "add",
    values: { AC: 412300, PY: 373500, PL: 410500 },
    children: [
      {
        id: "drive",
        label: "Drive Systems",
        flow: "add",
        values: { AC: 214800, PY: 198400, PL: 220000 },
      },
      {
        id: "thermal",
        label: "Thermal Solutions",
        flow: "add",
        values: { AC: 121600, PY: 108900, PL: 118500 },
      },
      {
        id: "services",
        label: "Industrial Services",
        flow: "add",
        values: { AC: 75900, PY: 66200, PL: 72000 },
      },
    ],
  },
  {
    id: "cogs",
    label: "Cost of goods sold",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 267100, PY: 237700, PL: 258600 },
    children: [
      {
        id: "materials",
        label: "Raw materials and consumables",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 168900, PY: 146700, PL: 161900 },
      },
      {
        id: "labour",
        label: "Direct labour",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 63400, PY: 58900, PL: 62700 },
      },
      {
        id: "overhead",
        label: "Manufacturing overhead",
        flow: "subtract",
        higherIsBetter: false,
        values: { AC: 34800, PY: 32100, PL: 34000 },
      },
    ],
  },
  {
    id: "gp",
    label: "Gross profit",
    flow: "result",
    values: { AC: 145200, PY: 135800, PL: 151900 },
  },
  {
    id: "rd",
    label: "Research and development",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 24600, PY: 21800, PL: 24000 },
  },
  {
    id: "sd",
    label: "Selling and distribution",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 41200, PY: 38900, PL: 41800 },
  },
  {
    id: "admin",
    label: "Administrative expenses",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 19400, PY: 18600, PL: 20100 },
  },
  {
    id: "ooi",
    label: "Other operating income",
    flow: "add",
    values: { AC: 6200, PY: 5400, PL: 5000 },
  },
  {
    id: "ooe",
    label: "Other operating expenses",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 5900, PY: 4100, PL: 4500 },
  },
  { id: "ebit", label: "EBIT", flow: "result", values: { AC: 60300, PY: 57800, PL: 66500 } },
  // Financial income and expenses netted into one line to keep the page calm.
  {
    id: "finres",
    label: "Financial result, net",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 5700, PY: 4500, PL: 5400 },
  },
  {
    id: "pbt",
    label: "Profit before tax",
    flow: "result",
    values: { AC: 54600, PY: 53300, PL: 61100 },
  },
  {
    id: "tax",
    label: "Income tax expense",
    flow: "subtract",
    higherIsBetter: false,
    values: { AC: 13900, PY: 13600, PL: 15600 },
  },
  {
    id: "profit",
    label: "Profit for the period",
    flow: "result",
    values: { AC: 40700, PY: 39700, PL: 45500 },
  },
]);

// EBIT bridge, prior year → actual, as CONTRIBUTIONS to the change. Opex =
// R&D + S&D + admin; Other = other operating income less expenses. Category
// labels stay under ~10 characters or the rotated axis labels truncate.
const bridgeAC = scaleUnits([
  { category: "EBIT '24", value: 57800, flow: "add" },
  { category: "Revenue", value: 38800, flow: "add" },
  { category: "Materials", value: 22200, flow: "subtract" },
  { category: "Labour", value: 4500, flow: "subtract" },
  { category: "Overhead", value: 2700, flow: "subtract" },
  { category: "Opex", value: 5900, flow: "subtract" },
  { category: "Other", value: 1000, flow: "subtract" },
  { category: "EBIT '25", value: 0, flow: "result" }, // result ignores its value
]);
// The same bridge as budgeted (PY → PL). comparisonData compares the RUNNING
// level against this bridge at each step — a cumulative position-vs-plan walk
// that ends on the total EBIT miss, not per-step deltas.
const bridgePL = scaleUnits([
  { category: "EBIT '24", value: 57800, flow: "add" },
  { category: "Revenue", value: 37000, flow: "add" },
  { category: "Materials", value: 15200, flow: "subtract" },
  { category: "Labour", value: 3800, flow: "subtract" },
  { category: "Overhead", value: 1900, flow: "subtract" },
  { category: "Opex", value: 6600, flow: "subtract" },
  { category: "Other", value: 800, flow: "subtract" },
  { category: "EBIT '25", value: 0, flow: "result" },
]);

// Balance sheet at levels, small lines merged so the page stays readable.
// Debt lines carry higherIsBetter:false; equity growing is favourable.
const bs = scaleUnits([
  {
    id: "nca",
    label: "Non-current assets",
    flow: "add",
    emphasis: true,
    values: { AC: 211300, PY: 202100 },
    children: [
      {
        id: "intangibles",
        label: "Intangible assets and goodwill",
        flow: "add",
        values: { AC: 48600, PY: 46900 },
      },
      {
        id: "ppe",
        label: "Property, plant and equipment",
        flow: "add",
        values: { AC: 132400, PY: 124800 },
      },
      { id: "rou", label: "Right-of-use assets", flow: "add", values: { AC: 18900, PY: 19700 } },
      {
        id: "onca",
        label: "Deferred tax and other",
        flow: "add",
        values: { AC: 11400, PY: 10700 },
      },
    ],
  },
  {
    id: "ca",
    label: "Current assets",
    flow: "add",
    emphasis: true,
    values: { AC: 224700, PY: 200900 },
    children: [
      { id: "inventories", label: "Inventories", flow: "add", values: { AC: 96700, PY: 78400 } },
      {
        id: "receivables",
        label: "Trade receivables",
        flow: "add",
        values: { AC: 71800, PY: 61300 },
      },
      {
        id: "occa",
        label: "Contract and other current assets",
        flow: "add",
        values: { AC: 22000, PY: 19600 },
      },
      {
        id: "cash",
        label: "Cash and cash equivalents",
        flow: "add",
        values: { AC: 34200, PY: 41600 },
      },
    ],
  },
  { id: "ta", label: "Total assets", flow: "result", values: { AC: 436000, PY: 403000 } },
  {
    id: "equity",
    label: "Total equity",
    flow: "add",
    emphasis: true,
    values: { AC: 205200, PY: 181200 },
  },
  {
    id: "ncl",
    label: "Non-current liabilities",
    flow: "add",
    emphasis: true,
    higherIsBetter: false,
    values: { AC: 136600, PY: 131100 },
    children: [
      {
        id: "debt-nc",
        label: "Financial debt",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 88400, PY: 84300 },
      },
      {
        id: "lease-nc",
        label: "Lease liabilities",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 14200, PY: 15100 },
      },
      {
        id: "provisions",
        label: "Pensions, deferred tax, provisions",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 34000, PY: 31700 },
      },
    ],
  },
  {
    id: "cl",
    label: "Current liabilities",
    flow: "add",
    emphasis: true,
    higherIsBetter: false,
    values: { AC: 94200, PY: 90700 },
    children: [
      {
        id: "debt-c",
        label: "Financial debt",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 21500, PY: 24800 },
      },
      {
        id: "payables",
        label: "Trade payables",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 42600, PY: 40300 },
      },
      {
        id: "ocl",
        label: "Contract, lease and other",
        flow: "add",
        higherIsBetter: false,
        values: { AC: 30100, PY: 25600 },
      },
    ],
  },
  {
    id: "tel",
    label: "Total equity and liabilities",
    flow: "result",
    values: { AC: 436000, PY: 403000 },
  },
]);

// Key figures for the DataTable: one measure ("eur"), values per scenario.
const keyRows = scaleUnits([
  { id: "revenue", label: "Revenue", values: { eur: { AC: 412300, PY: 373500, PL: 410500 } } },
  { id: "gp", label: "Gross profit", values: { eur: { AC: 145200, PY: 135800, PL: 151900 } } },
  { id: "ebit", label: "EBIT", values: { eur: { AC: 60300, PY: 57800, PL: 66500 } } },
  {
    id: "profit",
    label: "Profit for the period",
    values: { eur: { AC: 40700, PY: 39700, PL: 45500 } },
  },
]);
const keyCols = [
  { key: "ac", label: "AC 2025", kind: "value", measure: "eur", scenario: "AC" },
  { key: "py", label: "PY 2024", kind: "value", measure: "eur", scenario: "PY" },
  {
    key: "dpy",
    label: "ΔPY",
    kind: "variance",
    measure: "eur",
    base: "PY",
    mode: "abs",
    mark: "bar",
  },
  {
    key: "dpyp",
    label: "ΔPY %",
    kind: "variance",
    measure: "eur",
    base: "PY",
    mode: "pct",
    mark: "pin",
  },
  { key: "pl", label: "PL 2025", kind: "value", measure: "eur", scenario: "PL", group: "Budget" },
  {
    key: "dpl",
    label: "ΔPL",
    kind: "variance",
    measure: "eur",
    base: "PL",
    mode: "abs",
    mark: "bar",
    group: "Budget",
  },
];

/* ---------------------------------------------------------------- pages */

const p1 = page(
  coverBody({
    lockupHtml: lockup({
      name: "VANTERA",
      sub: "Industrial Group",
      scale: 1.25,
      light: true,
      ink: INK,
    }),
    eyebrow: "Annual Management Report",
    // The one sentence in the document allowed a point of view.
    title: "Growth on borrowed margin",
    year: "2025",
    // Facts limited to what the source workbooks state — the P&L footer says
    // "unaudited management accounts"; no city or auditor is named, so none appears.
    facts: [
      ["Reporting period", "1 January – 31 December 2025"],
      ["Reporting entity", "Vantera Industrial Group AG"],
      ["Presentation currency", "Euro (€), compact notation"],
      ["Status", "Unaudited management accounts"],
    ],
  }),
  { cover: true },
);

const p2 = page(
  `${H2("Contents")}
  ${contents([
    ["Financial highlights", "Key figures against prior year and budget", 3],
    ["Results of operations", "Consolidated income statement 2025", 4],
    ["Earnings bridge", "EBIT, prior year to actual, each step against budget", 5],
    ["Financial position", "Statement of financial position at 31 December", 6],
  ])}
  ${notationKey({ scenarios: ["AC", "PY", "PL"] })}
  <p class="basisline">Unaudited management accounts for the twelve months ended
  31 December 2025. <b>AC</b> actual · <b>PY</b> prior year · <b>PL</b> budget.
  Amounts in euro, shown compactly; source figures maintained in TEUR.</p>`,
  { section: "Contents" },
);

const p3 = page(
  `${H2("Financial highlights", "2025 actual against prior year and budget · amounts in euro")}
  <div class="table-wrap z90">${R(
    h(DataTable, {
      columns: keyCols,
      rows: keyRows,
      tokens: TOKENS,
      format: FMT,
      animate: false,
      tooltip: false,
    }),
  )}</div><!-- z90: DataTable has a large min-content width; zoom fits it to the 642px column -->
  <div class="ratios">
    <div><span>Gross margin</span><b>35.2%</b><i>PY 36.4%</i></div>
    <div><span>EBIT margin</span><b>14.6%</b><i>PY 15.5%</i></div>
    <div><span>Equity ratio</span><b>47.1%</b><i>PY 45.0%</i></div>
    <div><span>Net debt / EBITDA</span><b>1.08×</b><i>PY 1.06×</i></div>
  </div>
  ${CAP("Ratios computed from the statements: EBITDA is EBIT plus the depreciation and amortisation memo line; net debt is financial and lease debt less cash.")}
  ${P(`Revenue reached <b>€412.3 million</b>, 10.4% above prior year and marginally
  ahead of the €410.5 million budget. Earnings did not keep pace: EBIT of €60.3
  million is <b>4.3% above prior year but 9.3% below budget</b>, and the EBIT
  margin fell from 15.5% to 14.6%. Profit for the period closed at €40.7 million
  against a budgeted €45.5 million.`)}
  ${P(`The year is therefore green against last year and red against plan on the
  same measures — the tension the following pages trace through the income
  statement, the earnings bridge and the balance sheet.`)}`,
  { section: "Financial highlights" },
);

const p4 = page(
  `${H2("Results of operations", "Consolidated income statement 2025 · amounts in euro")}
  <div class="table-wrap z90">${R(
    h(StatementTable, {
      lines: pnl,
      tokens: TOKENS,
      format: FMT,
      animate: false,
      tooltip: false,
      waterfallWidth: 250,
      labelMaxWidth: 212,
      varianceColumns: [
        { base: "PY", mode: "abs", mark: "bar" },
        { base: "PY", mode: "pct", mark: "pin" },
      ],
    }),
  )}</div>
  ${P(`Revenue grew €38.8 million, with every segment ahead of prior year. Cost
  of goods sold rose <b>12.4% against revenue growth of 10.4%</b>: raw materials
  alone absorbed €22.2 million more than prior year (+15.1%), and €7.0 million
  more than budgeted. The gross margin gave up 1.2 points to 35.2%.`)}
  ${P(`Operating expenses were held close to plan — administrative expenses came
  in €0.7 million under budget — but could not close the materials gap. EBIT
  finished €2.5 million above prior year and <b>€6.2 million behind budget</b>;
  after a €1.2 million heavier financial result and €13.9 million of tax, profit
  for the period is €40.7 million (+2.5%).`)}`,
  { section: "Results of operations" },
);

const p5 = page(
  `${H2("Earnings bridge", "EBIT, prior year to actual · amounts in euro · each step against budget")}
  <div class="chart">${R(
    h(WaterfallChart, {
      data: bridgeAC,
      comparisonData: bridgePL,
      width: 642,
      height: 330,
      tokens: TOKENS,
      format: FMT,
      animate: false,
      tooltip: false,
    }),
  )}</div>
  ${CAP("Steps are contributions to the change in EBIT. The panel beneath tracks the cumulative position against the budgeted bridge to the €66.5 million plan — where EBIT stood versus budget after each step.")}
  ${P(`The €2.5 million improvement in EBIT decomposes into a €38.8 million
  revenue contribution against €31.3 million of added cost of goods and €6.9
  million of operating expense and other movements. The panel walks the position
  against plan: <b>€1.8 million ahead</b> after revenue, then €5.2 million
  behind once raw materials have taken <b>€7.0 million more than budgeted</b> —
  on its own larger than the entire shortfall. Labour and overhead widen the gap
  to €6.7 million, operating expenses claw €0.7 million back, and the year ends
  <b>€6.2 million behind</b> the €66.5 million plan.`)}`,
  { section: "Earnings bridge" },
);

const p6 = page(
  `${H2("Financial position", "Statement of financial position at 31 December 2025 · amounts in euro")}
  <div class="table-wrap z92">${R(
    h(StatementTable, {
      lines: bs,
      mode: "stock",
      tokens: TOKENS,
      format: FMT,
      animate: false,
      tooltip: false,
      waterfallWidth: 250,
      labelMaxWidth: 220,
      // Abs ΔPY only: this sheet has large NEGATIVE percent moves (cash −17.8%),
      // and negative pct-pin labels clip left of the pin axis (see
      // components.md rough edges) — so the percents live in the prose instead.
      varianceColumns: [{ base: "PY", mode: "abs", mark: "bar" }],
    }),
  )}</div>
  ${P(`Total assets grew 8.2% to €436.0 million, and the growth sits in working
  capital: inventories rose <b>23.3%</b> and trade receivables <b>17.1%</b>
  against revenue growth of 10.4%, while cash fell 17.8%, or €7.4 million, to
  €34.2 million. Equity of €205.2 million lifts the equity ratio to 47.1%, and
  net debt of €95.0 million holds leverage at 1.08× EBITDA.`)}`,
  { section: "Financial position" },
);

fs.writeFileSync(
  "report.html",
  documentHtml({
    title: "Vantera Industrial Group AG — Annual Management Report 2025",
    css: css({ ink: INK }),
    pages: [p1, p2, p3, p4, p5, p6],
  }),
);
console.log("wrote report.html — now: node fit.mjs && node render.mjs");
