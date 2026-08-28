import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent skills",
  description:
    "Installable SKILL.md skills that teach coding agents IBCS / ISO 24896 reporting: the ibcs-react component recipes, the notation rules, and ibcs-report — financial statements in, board-ready PDF out.",
};

const SKILLS = [
  {
    name: "ibcs-report",
    tagline: "Statements in, board pack out",
    body: "Hand an agent a P&L, a balance sheet or a whole management pack (XLSX, CSV…) and get back a print-ready A4 PDF report — cover, contents, commentary, and every chart and table drawn with ibcs-react in IBCS notation. Page count follows the data, not a template.",
    detail: "/skills/ibcs-report",
  },
  {
    name: "ibcs-react",
    tagline: "Use the library correctly",
    body: "Install and RSC/SSR setup, the scenario data model (AC / PY / PL / FC), canonical snippets for variance charts, waterfalls, statement tables, theming and export — plus reference sheets for every chart and table.",
  },
  {
    name: "ibcs-notation",
    tagline: "The notation itself, tool-agnostic",
    body: "Scenario fills, impact-based variance colouring, bars vs pins, zero-baseline and uniform scales, Who/What/When titles, templates C01–C13 / T01–T04. Useful with D3, Vega, Excel or PowerPoint too.",
  },
];

export default function SkillsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Agent skills</h1>
      <p className="mt-4 max-w-2xl text-lg text-fd-muted-foreground">
        Portable <code>SKILL.md</code> skills that teach coding agents IBCS® / ISO&nbsp;24896
        reporting — Claude Code, Cursor, Codex, Copilot, Gemini CLI and ~77 other agents.
      </p>

      <div className="mt-8 rounded-xl border bg-fd-card p-5">
        <div className="text-sm font-medium">Install</div>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-fd-muted p-3 text-sm">
          <code>
            {"npx skills add NibelungAI/ibcs-react              # pick from all three\n"}
            {"npx skills add NibelungAI/ibcs-react@ibcs-report  # or install just one"}
          </code>
        </pre>
        <p className="mt-3 text-sm text-fd-muted-foreground">
          No install needed either: every skill is served raw from this site, so you can simply tell
          your agent{" "}
          <em>
            “read{" "}
            <Link href="/skills/ibcs-report/SKILL.md" className="underline underline-offset-4">
              ibcs.at/skills/ibcs-report/SKILL.md
            </Link>{" "}
            and follow it”
          </em>
          .
        </p>
      </div>

      <div className="mt-10 grid gap-4">
        {SKILLS.map((s) => (
          <section key={s.name} className="rounded-xl border p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                <code>{s.name}</code>
                <span className="ml-3 text-sm font-normal text-fd-muted-foreground">
                  {s.tagline}
                </span>
              </h2>
              <div className="flex gap-4 text-sm">
                {s.detail && (
                  <Link href={s.detail} className="font-medium underline underline-offset-4">
                    Details →
                  </Link>
                )}
                <Link
                  href={`/skills/${s.name}/SKILL.md`}
                  className="text-fd-muted-foreground underline underline-offset-4"
                >
                  SKILL.md
                </Link>
                <a
                  href={`https://github.com/NibelungAI/ibcs-react/tree/main/skills/${s.name}`}
                  className="text-fd-muted-foreground underline underline-offset-4"
                >
                  GitHub
                </a>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fd-muted-foreground">
              {s.body}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-fd-muted-foreground">
        Skills live in the open{" "}
        <a href="https://agentskills.io" className="underline underline-offset-4">
          SKILL.md format
        </a>{" "}
        in the{" "}
        <a
          href="https://github.com/NibelungAI/ibcs-react/tree/main/skills"
          className="underline underline-offset-4"
        >
          repository
        </a>
        , MIT licensed like the library. Agents can also read the docs directly:{" "}
        <Link href="/llms.txt" className="underline underline-offset-4">
          /llms.txt
        </Link>
        .
      </p>
    </main>
  );
}
