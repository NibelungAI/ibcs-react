import type { MetadataRoute } from "next";
import { source } from "@/lib/source";

const BASE = "https://ibcs-react.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/playground`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/report`, changeFrequency: "monthly", priority: 0.6 },
    ...source.getPages().map((page) => ({
      url: `${BASE}${page.url}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
