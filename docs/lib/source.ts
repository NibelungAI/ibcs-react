import { defineDocs } from "fumadocs-mdx/macro";
import { loader } from "fumadocs-core/source";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // Store each page's compiled-to-plain-Markdown text alongside the MDX so
    // `page.data.getText("processed")` works - feeds /llms.txt, /llms-full.txt
    // and the per-page `<url>.mdx` raw-Markdown routes for AI agents.
    postprocess: { includeProcessedMarkdown: true },
  },
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
