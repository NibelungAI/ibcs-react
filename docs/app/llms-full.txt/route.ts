import { source } from "@/lib/source";
import { getLLMText } from "@/lib/get-llm-text";

// Static: generated once at build time, served from cache.
export const revalidate = false;

/**
 * /llms-full.txt - every docs page compiled to plain Markdown in one file,
 * for agents and RAG pipelines that prefer a single ingest.
 */
export async function GET() {
  const pages = await Promise.all(source.getPages().map(getLLMText));
  return new Response(pages.join("\n\n---\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
