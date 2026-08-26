import type { Metadata } from "next";
import { Gallery } from "@/components/demos/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Every ibcs-react view on one page: income statements, budget comparisons, a balance sheet, a virtualized consolidation, variance columns, trends and structures — retheme or switch the comparison base live.",
};

export default function GalleryPage() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <Gallery />
    </main>
  );
}
