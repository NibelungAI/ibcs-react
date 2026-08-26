import { source } from "@/lib/source";
import { SITE_URL } from "@/lib/get-llm-text";
import { llms } from "fumadocs-core/source";

// Static: generated once at build time, served from cache.
export const revalidate = false;

/**
 * /llms.txt — the llms.txt index (llmstxt.org): a curated, small Markdown
 * file agents read first. Every linked page is also available as raw
 * Markdown by appending `.mdx` to its URL; /llms-full.txt is the whole
 * corpus in one file.
 */
export function GET() {
  const list = llms(source);
  const tree = source.getPageTree();
  const index = tree.children
    .map((node) => list.indexNode(node))
    .join("\n")
    // Absolute URLs so the index works when read away from the site.
    .replaceAll("](/", `](${SITE_URL}/`);

  const text = `# ibcs-react

> Zero-dependency, SSR-safe React components for IBCS® business communication —
> variance charts, waterfalls, statement tables, dashboards and reports
> following the IBCS notation, the basis of ISO 24896.

- Install: \`npm install ibcs-react\` (React >= 18; \`react-dom\` optional for the core entry).
- One data model feeds every view: scenario-keyed values \`{ category, AC?, PY?, PL?, FC? }\`
  (Actual, Previous Year, Plan, Forecast).
- \`ibcs-react/core\` is React-free (layout math, formatting, validation) and safe in
  server components; the root entry is \`"use client"\`.
- IBCS notation essentials the components implement for you: AC solid dark ·
  PY light grey · PL outlined/hollow · FC hatched; variances coloured by business
  impact, not arithmetic sign; no truncated value axes; identical scales across
  compared charts. \`checkIbcs(config)\` is the built-in notation linter.
- Every docs page below is also served as raw Markdown: append \`.mdx\` to its URL.
  Full corpus in one file: ${SITE_URL}/llms-full.txt
- Agent skill (installable rules + recipes for coding agents): \`npx skills add NibelungAI/ibcs-react\`
- Source: https://github.com/NibelungAI/ibcs-react · npm: https://www.npmjs.com/package/ibcs-react

## Documentation

${index}
`;

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
