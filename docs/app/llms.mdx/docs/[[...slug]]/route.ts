import { source } from "@/lib/source";
import { getLLMText } from "@/lib/get-llm-text";
import { notFound } from "next/navigation";

// Static: every page is pre-rendered at build time.
export const revalidate = false;

/**
 * Raw-Markdown twin of every docs page. Reached through the
 * `/docs/*.mdx` rewrites in next.config.mjs, e.g.
 * `/docs/components/kpi-card.mdx` → this handler.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  return new Response(await getLLMText(page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
