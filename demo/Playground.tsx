import React, { useMemo } from "react";
import {
  StructureChart,
  VarianceColumnChart,
  DataTable,
  KpiCard,
  useFilters,
  useLiveData,
  type IbcsTokens,
  type ColumnDatum,
} from "ibcs-react";
import { sampleRevenueStructure, sampleQuarterlyRevenue } from "../src/demo/sampleData";

/**
 * The interactive flagship: one filter bar (built on `useFilters`) drives a KPI
 * strip, a region structure chart, a quarter column chart and a region table -
 * every view re-renders from the same filtered model. A live-data toggle
 * (`useLiveData`) jitters the source on an interval so the charts tween to new
 * values, and the scenario toggle (AC vs PY / PL / FC) flows everywhere.
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
const baseQuarters: ColumnDatum[] = sampleQuarterlyRevenue.map((q) => ({
  ...q,
  FC: Math.round(q.AC * 1.03),
}));

/** A region datum as authored here - `category` known present, plus an FC. */
type Region = (typeof baseRegions)[number];

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

export function Playground({ tokens }: { tokens: IbcsTokens }) {
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
    <section style={card}>
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
            <span style={pill}>live</span>
          </div>
          <p style={{ fontSize: 12.5, color: "#6b6a64", margin: "4px 0 0", maxWidth: 620 }}>
            One filter bar, four linked views. Pick a comparison base, toggle regions and quarters,
            and stream live data - the KPIs, structure chart, quarter chart and table all re-render
            from the same filtered model.
          </p>
        </div>
      </div>

      {/* ----- the filter bar (useFilters + useLiveData) ----- */}
      <div style={filterBar}>
        <Field label="Compare AC vs">
          <Segmented
            value={comparison}
            onChange={(v) => setFilter("comparison", v)}
            options={[
              { value: "PY" as Base, label: "PY" },
              { value: "PL" as Base, label: "PL" },
              { value: "FC" as Base, label: "FC" },
            ]}
          />
        </Field>

        <Divider />

        <Field label="Regions">
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_REGIONS.map((label) => (
              <Chip
                key={label}
                on={regions.includes(label)}
                onClick={() => toggleRegion(label)}
                color={tokens.color.neutral}
              >
                {label}
              </Chip>
            ))}
            <TextButton
              onClick={() =>
                setFilter("regions", allRegionsOn ? ALL_REGIONS.slice(0, 1) : ALL_REGIONS)
              }
            >
              {allRegionsOn ? "Only first" : "All"}
            </TextButton>
          </span>
        </Field>

        <Divider />

        <Field label="Quarters">
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_QUARTERS.map((cat) => (
              <Chip
                key={cat}
                on={quarters.includes(cat)}
                onClick={() => toggleQuarter(cat)}
                color={tokens.color.neutral}
              >
                {cat}
              </Chip>
            ))}
            <TextButton
              onClick={() =>
                setFilter("quarters", allQuartersOn ? ALL_QUARTERS.slice(0, 1) : ALL_QUARTERS)
              }
            >
              {allQuartersOn ? "Only Q1" : "All"}
            </TextButton>
          </span>
        </Field>

        <Divider />

        <Field label="Live data">
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button
              onClick={() => (feed.running ? feed.stop() : feed.start())}
              style={feed.running ? liveOnBtn : liveOffBtn}
            >
              <span style={{ ...dot, background: feed.running ? "#fff" : "#b6b4ad" }} />
              {feed.running ? "Streaming" : "Go live"}
            </button>
            <TextButton onClick={feed.refresh} disabled={!feed.running}>
              ↻ Tick
            </TextButton>
            <TextButton
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
        <Panel title={`Revenue by region - AC vs ${comparison}`} sub={BASE_LABELS[comparison]}>
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
            <Empty>Select a region above.</Empty>
          )}
        </Panel>

        <Panel
          title={`Revenue by quarter - AC vs ${comparison}`}
          sub={`${quarters.length} of ${ALL_QUARTERS.length} quarters`}
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
            <Empty>Select a quarter above.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Region detail" sub={`AC and Δ vs ${comparison}, ranked`} full>
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
          <Empty>Select a region above.</Empty>
        )}
      </Panel>
    </section>
  );
}

/* ------------------------------- bits -------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: "#9a9992" }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", minHeight: 26 }}>{children}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ alignSelf: "stretch", width: 1, background: "#ece9e2" }} />;
}

function Panel({
  title,
  sub,
  children,
  full,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ flex: full ? "1 1 100%" : "1 1 360px", minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {sub ? <div style={{ fontSize: 11.5, color: "#9a9992" }}>{sub}</div> : null}
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#b6b4ad",
        fontSize: 13,
        border: "1px dashed #ece9e2",
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
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        border: "1px solid #e6e5e0",
        borderRadius: 6,
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            border: "none",
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            background: value === o.value ? "#2b2b29" : "#fff",
            color: value === o.value ? "#fff" : "#6b6a64",
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
  children,
}: {
  on: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${on ? color : "#e6e5e0"}`,
        background: on ? color : "#fff",
        color: on ? "#fff" : "#8a8982",
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
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid #e6e5e0",
        borderRadius: 6,
        background: "#fff",
        color: disabled ? "#c8c6bf" : "#3a3a36",
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

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece9e2",
  borderRadius: 10,
  padding: "18px 20px",
  marginBottom: 20,
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const filterBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: 16,
  background: "#faf9f6",
  border: "1px solid #ece9e2",
  borderRadius: 10,
  padding: "12px 16px",
  margin: "14px 0 18px",
};

const kpiBox: React.CSSProperties = { flex: "1 1 220px", minWidth: 200 };

const pill: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#fff",
  background: "#3a8a4a",
  borderRadius: 999,
  padding: "2px 7px",
};

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

const liveOnBtn: React.CSSProperties = {
  ...liveBtnBase,
  border: "1px solid #3a8a4a",
  background: "#3a8a4a",
  color: "#fff",
};
const liveOffBtn: React.CSSProperties = {
  ...liveBtnBase,
  border: "1px solid #e6e5e0",
  background: "#fff",
  color: "#3a3a36",
};
