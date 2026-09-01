import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ibcs-report - statements in, board pack out",
  description:
    "An agent skill that turns a P&L, balance sheet or management pack into a print-ready A4 PDF board report whose charts and tables are ibcs-react components in IBCS / ISO 24896 notation.",
};

const DEMO = "/skills/ibcs-report/demo";
const REF = "/skills/ibcs-report/reference";

const DEMO_FILES = [
  {
    file: "01_Vantera_PnL_FY2025.xlsx",
    what: "P&L only - actual, prior year, budget, forecast",
    with: "drag it in together with the balance sheet",
  },
  {
    file: "02_Vantera_BalanceSheet_FY2025.xlsx",
    what: "Balance sheet - actual, prior year",
    with: "the other half of the pair",
  },
  {
    file: "03_Vantera_Full_Pack_FY2025.xlsx",
    what: "8 sheets: P&L, balance sheet, cash flow, monthly, segments, regions, KPIs",
    with: "produces a ~10-page report on its own",
  },
  {
    file: "Northbridge_Logistics_FY2025.xlsx",
    what: "A deliberately thin single P&L - two years, no budget, no balance sheet",
    with: "produces ~5 pages, and does not pad",
  },
];

const REFERENCES = [
  {
    file: "A_Vantera_8p_reference_design.pdf",
    label: "A - Vantera, 8 pages",
    note: "the reference design, from the P&L + balance sheet pair",
  },
  {
    file: "B_Vantera_10p_from_full_pack.pdf",
    label: "B - Vantera, 10 pages",
    note: "from the full workbook, one sentence of instruction",
  },
  {
    file: "C_Northbridge_5p_from_thin_pnl.pdf",
    label: "C - Northbridge, 5 pages",
    note: "same instruction, half the data - half the report",
  },
];

const PREVIEWS = [
  { src: "/skills/ibcs-report/previews/a-cover.png", alt: "Report cover page" },
  { src: "/skills/ibcs-report/previews/a-highlights.png", alt: "Financial highlights page" },
  {
    src: "/skills/ibcs-report/previews/a-income-statement.png",
    alt: "Income statement as an integrated waterfall",
  },
  {
    src: "/skills/ibcs-report/previews/c-highlights.png",
    alt: "Northbridge highlights page from a thin P&L",
  },
];

export default function IbcsReportSkillPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <p className="text-sm text-fd-muted-foreground">
        <Link href="/skills" className="underline underline-offset-4">
          Agent skills
        </Link>{" "}
        / ibcs-report
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Statements in, board pack out</h1>
      <p className="mt-4 max-w-2xl text-lg text-fd-muted-foreground">
        <code>ibcs-report</code> teaches a coding agent to turn financial statements - a P&L, a
        balance sheet, a whole management pack - into a print-ready A4 PDF report: a designed cover,
        contents, commentary that says what happened, and every chart and table drawn with{" "}
        <code>ibcs-react</code> in IBCS® notation.
      </p>

      <div className="mt-8 rounded-xl border bg-fd-card p-5">
        <div className="text-sm font-medium">Use it</div>
        <p className="mt-2 text-sm text-fd-muted-foreground">
          Install once, then attach a workbook and ask in plain language:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-fd-muted p-3 text-sm">
          <code>
            {"npx skills add NibelungAI/ibcs-react@ibcs-report\n\n"}
            {"“Turn these statements into a board report PDF.”"}
          </code>
        </pre>
        <p className="mt-3 text-sm text-fd-muted-foreground">
          Or skip installing - the skill is served from this site, so one sentence is enough:{" "}
          <em>
            “read{" "}
            <Link href="/skills/ibcs-report/SKILL.md" className="underline underline-offset-4">
              ibcs.at/skills/ibcs-report/SKILL.md
            </Link>{" "}
            and follow it to turn the attached workbook into a board report.”
          </em>{" "}
          For claude.ai, download{" "}
          <a href="/skills/ibcs-report.skill" className="underline underline-offset-4">
            ibcs-report.skill
          </a>{" "}
          (
          <a href="/skills/ibcs-report.zip" className="underline underline-offset-4">
            .zip
          </a>
          ) and upload it under Settings → Capabilities.
        </p>
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">What comes out</h2>
      <p className="mt-2 max-w-2xl text-sm text-fd-muted-foreground">
        Real runs, not mockups. B and C come from the same one-sentence instruction - ten pages and
        five - because the page plan follows the data, not a template.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {PREVIEWS.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.src}
            src={p.src}
            alt={p.alt}
            className="w-full rounded-lg border shadow-sm"
            loading="lazy"
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        {REFERENCES.map((r) => (
          <li key={r.file} className="rounded-lg border p-3">
            <a href={`${REF}/${r.file}`} className="font-medium underline underline-offset-4">
              {r.label}
            </a>
            <div className="mt-1 text-fd-muted-foreground">{r.note}</div>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Try it with the demo data</h2>
      <p className="mt-2 max-w-2xl text-sm text-fd-muted-foreground">
        Two fictional companies with internally consistent figures - every statement foots, the
        balance sheet balances. Download, attach, and use prompts like{" "}
        <em>“Here’s our FY2025 management pack - turn it into a proper board report PDF”</em> or{" "}
        <em>
          “Can you make a management report out of this P&L? It’s all I have - no balance sheet and
          we don’t run a budget.”
        </em>
      </p>
      <ul className="mt-4 grid gap-2 text-sm">
        {DEMO_FILES.map((d) => (
          <li key={d.file} className="flex flex-wrap items-baseline gap-x-3 rounded-lg border p-3">
            <a
              href={`${DEMO}/${d.file}`}
              className="font-mono text-[13px] underline underline-offset-4"
            >
              {d.file}
            </a>
            <span className="text-fd-muted-foreground">
              {d.what} · {d.with}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">How it works</h2>
      <ol className="mt-3 max-w-2xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-fd-muted-foreground">
        <li>Reads every sheet - scenarios, units, periods - and checks that subtotals foot.</li>
        <li>
          Finds the story first: both comparisons (prior year <b>and</b> budget), the ratios, and
          where they disagree.
        </li>
        <li>Plans pages against the data - a thin P&L makes a short report, not a padded one.</li>
        <li>
          Writes one <code>build.mjs</code> that composes A4 pages of server-rendered{" "}
          <code>ibcs-react</code> components.
        </li>
        <li>
          Gates on a fit check (fixed-height pages, nothing silently clipped), then prints via
          Chromium.
        </li>
        <li>Hands over the PDF with what it built, what it left out, and why.</li>
      </ol>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">What’s inside</h2>
      <ul className="mt-3 grid gap-1.5 text-sm md:grid-cols-2">
        {[
          ["SKILL.md", "the workflow and the rules that decide whether it’s right"],
          ["references/components.md", "which component answers which question"],
          ["references/notation.md", "the IBCS rules that change a decision"],
          ["references/layout.md", "page geometry, fitting, units, the page menu"],
          ["references/example-build.mjs", "a complete worked six-page build"],
          ["assets/kit.mjs", "print chrome: page shell, tokens, cover, notation key"],
          ["scripts/setup.mjs", "one-command build directory (bash wrapper included)"],
          ["scripts/fit.mjs + render.mjs", "the overflow gate and the PDF printer"],
        ].map(([f, note]) => (
          <li key={f} className="text-fd-muted-foreground">
            <Link
              href={`/skills/ibcs-report/${f.split(" ")[0]}`}
              className="font-mono text-[13px] text-fd-foreground underline underline-offset-4"
            >
              {f}
            </Link>{" "}
            - {note}
          </li>
        ))}
      </ul>

      <p className="mt-12 text-xs leading-relaxed text-fd-muted-foreground">
        Vantera Industrial Group and Northbridge Logistics are fictional companies; the figures are
        internally consistent demo data and no real entity is depicted. Reports contain no
        ibcs-react branding - they are documents a company would publish.
      </p>
    </main>
  );
}
