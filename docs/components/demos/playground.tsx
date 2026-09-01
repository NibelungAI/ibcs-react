"use client";

import React, { useMemo } from "react";
import {
  StructureChart,
  VarianceColumnChart,
  DataTable,
  KpiCard,
  useFilters,
  useLiveData,
  useIbcsTokens,
  type IbcsTokens,
  type StructureDatum,
  type ColumnDatum,
} from "ibcs-react";
import { sampleRevenueStructure, sampleQuarterlyRevenue } from "@/lib/demo-data/sample-data";

/**
 * The interactive flagship: one filter bar (built on `useFilters`) drives a KPI
 * strip, a region structure chart, a quarter column chart and a region table -
 * every view re-renders from the same filtered model. A live-data toggle
 * (`useLiveData`) jitters the source on an interval so the charts tween to new
 * values, and the scenario toggle (AC vs PY / PL / FC) flows everywhere.
 *
 * All chrome colours come from the active token theme (own `tokens` prop or the
 * nearest `IbcsThemeProvider`), so the panel follows a dark preset too.
 */

/** The comparison bases the playground datasets actually carry. */
type Base = "PY" | "PL" | "FC";

/** Filter shape centralised by `useFilters`. */
interface PlaygroundFilters {
  comparison: Base;
  regions: string[];
  quarters: string[];
}

/** Source datasets bundled together so a live tick swaps them as one. */
interface Source {
  regions: Region[];
  quarters: ColumnDatum[];
}

/** Enrich the sample datasets with an FC scenario so AC-vs-FC works too. */
const baseRegions = sampleRevenueStructure.map((r) => ({
  ...r,
  FC: Math.round((r.AC ?? 0) * 1.04),
}));

/** A region datum as authored here - `category` known present, plus an FC. */
type Region = (typeof baseRegions)[number];
const baseQuarters: ColumnDatum[] = sampleQuarterlyRevenue.map((q) => ({
  ...q,
  FC: Math.round(q.AC * 1.03),
}));

const ALL_REGIONS = baseRegions.map((r) => r.category);
const ALL_QUARTERS = baseQuarters.map((q) => q.category);

/** Jitter every scenario value ±pct, preserving shape - the "live" feed. */
function jitter<T extends object>(rows: readonly T[], pct = 0.1): T[] {
  const j = (v: number) => Math.round(v * (1 + (Math.random() * 2 - 1) * pct));
  return rows.map((d) => {
    const out = { ...d } as Record<string, unknown>;
    for (const k of ["AC", "PY", "PL", "FC"])
      if (typeof out[k] === "number") out[k] = j(out[k] as number);
    return out as T;
  });
}

const BASE_LABELS: Record<Base, string> = {
  PY: "PY · last year",
  PL: "PL · budget",
  FC: "FC · forecast",
};

export function Playground({ tokens: tokensProp }: { tokens?: IbcsTokens }) {
  const tokens = useIbcsTokens(tokensProp);
  const { filters, setFilter, reset } = useFilters<PlaygroundFilters>({
    comparison: "PY",
    regions: ALL_REGIONS,
    quarters: ALL_QUARTERS,
  });
  const { comparison, regions, quarters } = filters;

  // Live feed: a jittered copy of the whole source, swapped every tick. When the
  // feed is stopped we fall back to the pristine base so "Reset" snaps back.
  const feed = useLiveData<Source>(
    () => ({ regions: jitter(baseRegions), quarters: jitter(baseQuarters) }),
    { enabled: false, immediate: true, intervalMs: 2200 },
  );
  const source: Source = feed.running
    ? feed.data
    : { regions: baseRegions, quarters: baseQuarters };

  // The two filtered views every section reads from - recomputed on any change.
  const regionData = useMemo(
    () => source.regions.filter((r) => regions.includes(r.category)),
    [source.regions, regions],
  );
  const quarterData = useMemo(
    () => source.quarters.filter((q) => quarters.includes(q.category)),
    [source.quarters, quarters],
  );

  // KPI: the selected regions' revenue, summed per scenario, vs the comparison.
  const kpiValues = useMemo(() => {
    const sum = (k: "AC" | "PY" | "PL" | "FC") =>
      regionData.reduce((t, r) => t + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
    return { AC: sum("AC"), PY: sum("PY"), PL: sum("PL"), FC: sum("FC") };
  }, [regionData]);

  // KPI: the single largest selected region (label + value), vs the comparison.
  const topRegion = useMemo(() => {
    return [...regionData].sort((a, b) => (b.AC ?? 0) - (a.AC ?? 0))[0];
  }, [regionData]);

  // Region table model: one row per selected region, AC + Δ vs the comparison.
  const tableRows = useMemo(
    () =>
      regionData.map((r) => ({
        id: r.category,
        label: r.category,
        values: { rev: { AC: r.AC, PY: r.PY, PL: r.PL, FC: r.FC } },
      })),
    [regionData],
  );

  const toggleRegion = (label: string) =>
    setFilter(
      "regions",
      regions.includes(label) ? regions.filter((r) => r !== label) : [...regions, label],
    );
  const toggleQuarter = (cat: string) =>
    setFilter(
      "quarters",
      quarters.includes(cat) ? quarters.filter((q) => q !== cat) : [...quarters, cat],
    );

  const allRegionsOn = regions.length === ALL_REGIONS.length;
  const allQuartersOn = quarters.length === ALL_QUARTERS.length;

  return (
    <section style={cardStyle(tokens)}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Interactive playground</h2>
            <span style={pillStyle(tokens)}>live</span>
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: tokens.color.textMuted,
              margin: "4px 0 0",
              maxWidth: 620,
            }}
          >
            One filter bar, four linked views. Pick a comparison base, toggle regions and quarters,
            and stream live data - the KPIs, structure chart, quarter chart and table all re-render
            from the same filtered model.
          </p>
        </div>
      </div>

      {/* ----- the filter bar (useFilters + useLiveData) ----- */}
      <div style={filterBarStyle(tokens)}>
        <Field label="Compare AC vs" tokens={tokens}>
          <Segmented
            value={comparison}
            onChange={(v) => setFilter("comparison", v)}
            tokens={tokens}
            options={[
              { value: "PY" as Base, label: "PY" },
              { value: "PL" as Base, label: "PL" },
              { value: "FC" as Base, label: "FC" },
            ]}
          />
        </Field>

        <Divider tokens={tokens} />

        <Field label="Regions" tokens={tokens}>
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_REGIONS.map((label) => (
              <Chip
                key={label}
                on={regions.includes(label)}
                onClick={() => toggleRegion(label)}
                color={tokens.color.neutral}
                tokens={tokens}
              >
                {label}
              </Chip>
            ))}
            <TextButton
              tokens={tokens}
              onClick={() =>
                setFilter("regions", allRegionsOn ? ALL_REGIONS.slice(0, 1) : ALL_REGIONS)
              }
            >
              {allRegionsOn ? "Only first" : "All"}
            </TextButton>
          </span>
        </Field>

        <Divider tokens={tokens} />

        <Field label="Quarters" tokens={tokens}>
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_QUARTERS.map((cat) => (
              <Chip
                key={cat}
                on={quarters.includes(cat)}
                onClick={() => toggleQuarter(cat)}
                color={tokens.color.neutral}
                tokens={tokens}
              >
                {cat}
              </Chip>
            ))}
            <TextButton
              tokens={tokens}
              onClick={() =>
                setFilter("quarters", allQuartersOn ? ALL_QUARTERS.slice(0, 1) : ALL_QUARTERS)
              }
            >
              {allQuartersOn ? "Only Q1" : "All"}
            </TextButton>
          </span>
        </Field>

        <Divider tokens={tokens} />

        <Field label="Live data" tokens={tokens}>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => (feed.running ? feed.stop() : feed.start())}
              style={feed.running ? liveOnBtn(tokens) : liveOffBtn(tokens)}
            >
              <span
                style={{
                  ...dot,
                  background: feed.running ? tokens.color.onFill : tokens.color.zero,
                }}
              />
              {feed.running ? "Streaming" : "Go live"}
            </button>
            <TextButton tokens={tokens} onClick={feed.refresh} disabled={!feed.running}>
              ↻ Tick
            </TextButton>
            <TextButton
              tokens={tokens}
              onClick={() => {
                feed.stop();
                reset();
              }}
            >
              ↺ Reset
            </TextButton>
          </span>
        </Field>
      </div>

      {/* ----- KPI strip (reacts to regions + comparison) ----- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <KpiCard
          label={`Revenue · ${regions.length}/${ALL_REGIONS.length} regions`}
          values={kpiValues}
          comparisons={[comparison]}
          format={{ compact: true, decimals: 1 }}
          tokens={tokens}
          style={kpiBox}
        />
        {topRegion ? (
          <KpiCard
            label={`Top region · ${topRegion.category}`}
            values={{ AC: topRegion.AC, PY: topRegion.PY, PL: topRegion.PL, FC: topRegion.FC }}
            comparisons={[comparison]}
            format={{ compact: true, decimals: 1 }}
            tokens={tokens}
            style={kpiBox}
          />
        ) : null}
      </div>

      {/* ----- charts + table (all react to filters) ----- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        <Panel
          title={`Revenue by region - AC vs ${comparison}`}
          sub={BASE_LABELS[comparison]}
          tokens={tokens}
        >
          {regionData.length ? (
            <StructureChart
              key={comparison}
              data={regionData}
              comparison={comparison}
              tokens={tokens}
              width={560}
              height={300}
              format={{ compact: true, decimals: 1 }}
            />
          ) : (
            <Empty tokens={tokens}>Select a region above.</Empty>
          )}
        </Panel>

        <Panel
          title={`Revenue by quarter - AC vs ${comparison}`}
          sub={`${quarters.length} of ${ALL_QUARTERS.length} quarters`}
          tokens={tokens}
        >
          {quarterData.length ? (
            <VarianceColumnChart
              key={comparison}
              data={quarterData}
              comparison={comparison}
              tokens={tokens}
              width={520}
              height={300}
              format={{ compact: true }}
            />
          ) : (
            <Empty tokens={tokens}>Select a quarter above.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Region detail" sub={`AC and Δ vs ${comparison}, ranked`} tokens={tokens} full>
        {tableRows.length ? (
          <DataTable
            rows={tableRows}
            showTotals
            defaultSort={{ key: "rev", dir: "desc" }}
            format={{ compact: true, decimals: 1 }}
            tokens={tokens}
            columns={[
              { key: "rev", label: "Revenue AC", kind: "value" },
              {
                key: "rev_d",
                label: `Δ${comparison}`,
                kind: "variance",
                measure: "rev",
                base: comparison,
                mode: "abs",
                mark: "bar",
              },
              {
                key: "rev_d_pct",
                label: `Δ${comparison} %`,
                kind: "variance",
                measure: "rev",
                base: comparison,
                mode: "pct",
                mark: "pin",
              },
            ]}
          />
        ) : (
          <Empty tokens={tokens}>Select a region above.</Empty>
        )}
      </Panel>
    </section>
  );
}

/* ------------------------------- bits -------------------------------- */

function Field({
  label,
  tokens,
  children,
}: {
  label: string;
  tokens: IbcsTokens;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: tokens.color.textMuted,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", minHeight: 26 }}>{children}</div>
    </div>
  );
}

function Divider({ tokens }: { tokens: IbcsTokens }) {
  return <div style={{ alignSelf: "stretch", width: 1, background: tokens.color.rowBorder }} />;
}

function Panel({
  title,
  sub,
  tokens,
  children,
  full,
}: {
  title: string;
  sub?: string;
  tokens: IbcsTokens;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ flex: full ? "1 1 100%" : "1 1 360px", minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {sub ? <div style={{ fontSize: 11.5, color: tokens.color.textMuted }}>{sub}</div> : null}
      </div>
      <div
        style={{
          maxWidth: "100%",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 4,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Empty({ tokens, children }: { tokens: IbcsTokens; children: React.ReactNode }) {
  return (
    <div
      style={{
        height: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tokens.color.textMuted,
        fontSize: 13,
        border: `1px dashed ${tokens.color.rowBorder}`,
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  tokens,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  tokens: IbcsTokens;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        border: `1px solid ${tokens.color.rowBorder}`,
        borderRadius: 6,
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            border: "none",
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            background: value === o.value ? tokens.color.text : tokens.color.surface,
            color: value === o.value ? tokens.color.surface : tokens.color.textMuted,
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function Chip({
  on,
  onClick,
  color,
  tokens,
  children,
}: {
  on: boolean;
  onClick: () => void;
  color: string;
  tokens: IbcsTokens;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${on ? color : tokens.color.rowBorder}`,
        background: on ? color : tokens.color.surface,
        color: on ? tokens.color.onFill : tokens.color.textMuted,
        borderRadius: 999,
        padding: "3px 11px",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 120ms, color 120ms, border-color 120ms",
      }}
    >
      {children}
    </button>
  );
}

function TextButton({
  onClick,
  disabled,
  tokens,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tokens: IbcsTokens;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${tokens.color.rowBorder}`,
        borderRadius: 6,
        background: tokens.color.surface,
        color: disabled ? tokens.color.zero : tokens.color.text,
        padding: "4px 10px",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------ styles ------------------------------- */

const cardStyle = (t: IbcsTokens): React.CSSProperties => ({
  background: t.color.surface,
  color: t.color.text,
  border: `1px solid ${t.color.rowBorder}`,
  borderRadius: 10,
  padding: "18px 20px",
  marginBottom: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  fontFamily: t.font.family,
});

const filterBarStyle = (t: IbcsTokens): React.CSSProperties => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: 16,
  background: t.color.surfaceMuted,
  border: `1px solid ${t.color.rowBorder}`,
  borderRadius: 10,
  padding: "12px 16px",
  margin: "14px 0 18px",
});

const kpiBox: React.CSSProperties = { flex: "1 1 220px", minWidth: 200 };

const pillStyle = (t: IbcsTokens): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: t.color.onFill,
  background: t.color.good,
  borderRadius: 999,
  padding: "2px 7px",
});

const dot: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  display: "inline-block",
};

const liveBtnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  borderRadius: 6,
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const liveOnBtn = (t: IbcsTokens): React.CSSProperties => ({
  ...liveBtnBase,
  border: `1px solid ${t.color.good}`,
  background: t.color.good,
  color: t.color.onFill,
});

const liveOffBtn = (t: IbcsTokens): React.CSSProperties => ({
  ...liveBtnBase,
  border: `1px solid ${t.color.rowBorder}`,
  background: t.color.surface,
  color: t.color.text,
});
