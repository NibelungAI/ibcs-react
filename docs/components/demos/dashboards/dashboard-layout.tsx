"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Layout primitives shared by the seven dashboards in `/docs/dashboards`.
 *
 * The chrome is deliberately plain: a KPI strip, a responsive panel grid and a
 * bordered panel with a small caps title. Media queries need real CSS, so the
 * rules ship in one hoisted `<style href>` block - React dedupes it across the
 * dashboards on the page.
 */
const DASH_CSS = `
.ibcs-dash { min-width: 0; }
.ibcs-dash-grid { display: grid; gap: 16px; align-items: start; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ibcs-dash-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ibcs-dash-grid--wide-left { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
.ibcs-dash-kpis { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 16px; }
.ibcs-dash-panel { background: #fff; border: 1px solid #ece9e2; border-radius: 10px; padding: 14px 16px; min-width: 0; overflow-x: auto; }
.ibcs-dash-panel--span2 { grid-column: 1 / -1; }
.ibcs-dash-panel-h { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #9a9992; margin-bottom: 10px; }
.ibcs-dash-note { font-size: 11.5px; color: #9a9992; margin-top: 6px; }
@media (max-width: 900px) {
  .ibcs-dash-grid, .ibcs-dash-grid--3, .ibcs-dash-grid--wide-left { grid-template-columns: 1fr; }
  .ibcs-dash-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

/** The dashboard shell: hoisted stylesheet + a min-width:0 root. */
export function Dashboard({ children }: { children: ReactNode }) {
  return (
    <div className="ibcs-dash">
      <style href="ibcs-dashboards" precedence="default">
        {DASH_CSS}
      </style>
      {children}
    </div>
  );
}

/** Four KPI cards across the top (two per row on a phone). */
export function KpiStrip({ children }: { children: ReactNode }) {
  return <div className="ibcs-dash-kpis">{children}</div>;
}

/** A panel grid: two equal columns, three columns, or a wider left column. */
export function DashGrid({
  variant = "two",
  style,
  children,
}: {
  variant?: "two" | "three" | "wide-left";
  style?: CSSProperties;
  children: ReactNode;
}) {
  const modifier =
    variant === "three"
      ? " ibcs-dash-grid--3"
      : variant === "wide-left"
        ? " ibcs-dash-grid--wide-left"
        : "";
  return (
    <div className={`ibcs-dash-grid${modifier}`} style={style}>
      {children}
    </div>
  );
}

/** One panel: a small caps title over a chart or table. `span2` fills the row. */
export function Panel({
  title,
  span2,
  children,
}: {
  title: string;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`ibcs-dash-panel${span2 ? " ibcs-dash-panel--span2" : ""}`}>
      <div className="ibcs-dash-panel-h">{title}</div>
      {children}
    </div>
  );
}

/** A stacked column of panels inside one grid cell. */
export function PanelColumn({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>{children}</div>
  );
}

/**
 * A fictitious seasonal series for the KPI sparklines: 12 points around
 * `base`, trending by `slope` with a little wiggle.
 */
export const series = (base: number, slope: number, wiggle = 0.04): number[] =>
  Array.from({ length: 12 }, (_, i) =>
    Math.round(base * (1 + slope * (i / 11)) * (1 + wiggle * Math.sin(i * 1.7))),
  );
