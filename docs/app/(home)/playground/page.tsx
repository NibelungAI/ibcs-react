import type { Metadata } from "next";
import { Playground } from "@/components/demos/playground";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "One filter bar drives four linked views - KPI cards, a structure chart, a variance column chart and a data table, all re-rendering from the same filtered model, with an optional live feed.",
};

export default function PlaygroundPage() {
  return (
    <main className="flex w-full flex-1 flex-col px-4 py-10 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
        <p className="mt-2 max-w-2xl text-fd-muted-foreground">
          Pick a comparison base, toggle regions and quarters, and stream live data. Every view is
          driven by the same filter state via the <code>useFilters</code> and{" "}
          <code>useLiveData</code> hooks.
        </p>
      </div>
      <Playground />
    </main>
  );
}
