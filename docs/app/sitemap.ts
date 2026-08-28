import type { MetadataRoute } from "next";
import { source } from "@/lib/source";

const BASE = "https://ibcs-react.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/playground`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/report`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/skills`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/skills/ibcs-report`, changeFrequency: "monthly", priority: 0.7 },
    ...source.getPages().map((page) => ({
      url: `${BASE}${page.url}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
