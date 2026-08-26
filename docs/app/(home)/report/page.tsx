import type { Metadata } from "next";
import Link from "next/link";
import { ExampleReport } from "@/components/demos/example-report";

export const metadata: Metadata = {
  title: "Example report",
  description:
    "A complete management report assembled from a single JSON ReportConfig: KPI strip, income statement, trend, structure, variance columns, a bridge and a region table on one responsive grid.",
};

export default function ReportPage() {
  return (
    <main className="flex w-full flex-1 flex-col px-4 py-10 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Example report</h1>
        <p className="mt-2 max-w-2xl text-fd-muted-foreground">
          Every block below comes from one JSON <code>ReportConfig</code> rendered by the{" "}
          <code>Report</code> component — KPI cards, the income statement, charts and a table on one
          responsive grid. See the{" "}
          <Link href="/docs" className="underline underline-offset-4">
            documentation
          </Link>{" "}
          for the config schema.
        </p>
      </div>
      <div className="overflow-x-auto">
        <ExampleReport />
      </div>
    </main>
  );
}
