import Link from "next/link";
import type { Metadata } from "next";
import { HeroChart } from "@/components/demos/hero-chart";
import { InstallTabs } from "@/components/install-tabs";

export const metadata: Metadata = {
  description:
    "Zero-dependency React components for IBCS® business communication — variance charts, waterfalls, statement tables, dashboards and reports following the IBCS notation, the basis of ISO 24896.",
};

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-16 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
        IBCS business charts for React
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-fd-muted-foreground">
        Variance columns, waterfalls, statement tables, dashboards — printable, self-explanatory
        components following the IBCS® notation, the basis of ISO&nbsp;24896. Zero runtime
        dependencies.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/docs"
          className="rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground"
        >
          Get started
        </Link>
        <Link
          href="/playground"
          className="rounded-full border px-5 py-2.5 text-sm font-medium hover:bg-fd-accent"
        >
          Playground
        </Link>
      </div>
      <div className="mt-12 w-full overflow-x-auto rounded-xl border bg-white p-6">
        <HeroChart />
      </div>
      <div className="mt-8 w-full text-left">
        <InstallTabs />
      </div>
    </main>
  );
}
