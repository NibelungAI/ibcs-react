import type { InferPageType } from "fumadocs-core/source";
import type { source } from "@/lib/source";

export const SITE_URL = "https://ibcs-react.com";

/**
 * One docs page as agent-ready plain Markdown: title + canonical URL header,
 * then the page body compiled to Markdown (custom JSX demos/prop tables are
 * reduced to placeholders by fumadocs' remark-llms postprocess step).
 */
export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");
  // The MDX → Markdown serializer entity-escapes JSX attribute strings; decode
  // the common ones so code examples read as written (&amp; last - no double
  // decoding).
  const readable = processed
    .replaceAll("&#x22;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#x3C;", "<")
    .replaceAll("&#x3E;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\n{3,}/g, "\n\n");
  return `# ${page.data.title}\nURL: ${SITE_URL}${page.url}\n\n${readable}`;
}
