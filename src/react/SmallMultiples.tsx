import {
  forwardRef,
  useId,
  useMemo,
  type CSSProperties,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import {
  computeSharedScale,
  computeMiniVariances,
  sharedDomain,
  type SharedScale,
  type MiniGroupInput,
} from "../core/smallMultiples";
import { formatSigned, formatValue, type FormatOptions } from "../core/format";
import type { ScenarioKey } from "../core/types";
import { useMountGrow, useDataTween } from "./hooks";
import { ChartDataTable, type ChartDataRow } from "./a11y";
import { useIbcsTokens } from "./theme";
import { svgSafeId } from "./internal/text";

export type { SharedScale, MiniGroupInput, MiniDatum } from "../core/smallMultiples";

export interface SmallMultiplesProps<T> {
  /** The panels to render - one per item. */
  items: readonly T[];
  /** Render one panel. Receives the SHARED scale so every panel matches. */
  renderItem: (item: T, scale: SharedScale, index: number) => ReactNode;
  /**
   * The numbers each item contributes to the shared domain (e.g. all scenario
   * values). Required for shared scaling; omit only if a panel ignores `scale`.
   */
  valuesOf?: (item: T) => number[];
  /** Target column count on a wide viewport. Default 3. Collapses responsively. */
  columns?: number;
  /** Gap between panels, in px. Default 16. */
  gap?: number;
  /**
   * Opt in to the shared-scale solver for `valuesOf`: round the shared domain to
   * "nice" bounds. Default false (the raw data extent, fully backward-compatible).
   */
  nice?: boolean;
  /**
   * Opt in to outlier clamping of the shared domain - a fraction in (0,1), e.g.
   * `0.95`. See {@link sharedDomain}. Stops one giant panel flattening the rest.
   * Default undefined (no clamp).
   */
  clampPercentile?: number;
  /** Force the shared domain symmetric about 0 (e.g. for variance). Default false. */
  symmetric?: boolean;
  /**
   * Stable React key per panel. Default: the array index - fine for a static
   * grid, but pass e.g. `(item) => item.id` when panels are inserted, removed
   * or reordered so React keeps each panel's DOM (and its mount animation)
   * attached to its own datum.
   */
  keyOf?: (item: T, index: number) => string;
  title?: string;
  /** Token override merged over the nearest {@link IbcsThemeProvider} theme. */
  tokens?: IbcsTokensOverride;
  /** Class applied to the grid root `<div>`. */
  className?: string;
  /** Styles merged *over* the root's own layout styles. */
  style?: CSSProperties;
}

/*
 * Note: the panel labels use a LOCAL, CJK-aware text fitter rather than the
 * shared `fitLabel` from ./internal/text. A mini panel's title sits in ~200px,
 * where the shared 0.6em-per-glyph heuristic overflows badly on full-width
 * glyphs; this variant measures wide code points at ~1.05em. Kept deliberately
 * (same reasoning as RatioTreeChart).
 */

/** Approx. glyph width in px (CJK/full-width/emoji count as ~1em). SSR-safe. */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    cp >= 0x1f000
  );
}

/** Truncate a label with an ellipsis so it fits within `maxPx` at `fontSize`. */
function fitText(s: string, maxPx: number, fontSize: number): string {
  if (maxPx <= 0 || !s) return "";
  const wOf = (ch: string) => fontSize * (isWide(ch.codePointAt(0) ?? 0) ? 1.05 : 0.62);
  const chars = [...s];
  let total = 0;
  for (const ch of chars) total += wOf(ch);
  if (total <= maxPx) return s;
  let budget = maxPx - fontSize * 0.62; // reserve room for the ellipsis
  let out = "";
  for (const ch of chars) {
    const w = wOf(ch);
    if (budget - w < 0) break;
    budget -= w;
    out += ch;
  }
  out = out.trimEnd();
  return out ? out + "…" : "…";
}

/** Build the responsive grid CSS, scoped to a unique class (no CSS files). */
function gridCss(cls: string, columns: number, gap: number): string {
  const cols = Math.max(1, Math.round(columns));
  const mid = Math.max(1, Math.min(cols, 2));
  return `
.${cls} { display: grid; gap: ${gap}px; grid-template-columns: repeat(1, minmax(0, 1fr)); }
@media (min-width: 480px) { .${cls} { grid-template-columns: repeat(${mid}, minmax(0, 1fr)); } }
@media (min-width: 768px) { .${cls} { grid-template-columns: repeat(${cols}, minmax(0, 1fr)); } }
`;
}

/** The screen-reader table a grid renders, when a caller supplies a richer one. */
interface SmallMultiplesA11y {
  caption: string;
  columns: string[];
  rows: ChartDataRow[];
}

/**
 * INTERNAL props. `a11y` lets a built-in mode ({@link MiniVarianceMultiples})
 * substitute its own screen-reader table for the generic `valuesOf`-derived one,
 * so the grid never exposes two tables for the same numbers. Not public API -
 * the exported {@link SmallMultiples} is typed with {@link SmallMultiplesProps}.
 */
interface SmallMultiplesInnerProps<T> extends SmallMultiplesProps<T> {
  a11y?: SmallMultiplesA11y;
}

/**
 * A readable row header for a panel: the first string-ish identifying field the
 * item carries, else its 1-based position. Panels are opaque `T`s, so this is
 * the only honest label the grid itself can offer.
 */
function panelLabel(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    for (const key of ["label", "category", "title", "name", "id"]) {
      const v = (item as Record<string, unknown>)[key];
      if (typeof v === "string" && v) return v;
    }
  }
  return `Panel ${index + 1}`;
}

/** Implementation of {@link SmallMultiples}; exported through the wrapper below. */
function SmallMultiplesInner<T>(
  {
    items,
    renderItem,
    valuesOf,
    columns = 3,
    gap = 16,
    nice = false,
    clampPercentile,
    symmetric = false,
    keyOf,
    title,
    tokens: tokenOverride,
    className,
    style,
    a11y,
  }: SmallMultiplesInnerProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const tokens = useIbcsTokens(tokenOverride);
  const cls = "ibcs-sm-" + svgSafeId(useId());

  // Use the solver only when a shaping option is set; otherwise keep the exact
  // legacy domain (raw extent) so existing callers are byte-for-byte unchanged.
  const useSolver = nice || symmetric || clampPercentile != null;
  const scale = useMemo<SharedScale>(() => {
    if (!valuesOf) return { domainMin: 0, domainMax: 1 };
    if (!useSolver) return computeSharedScale(items, valuesOf);
    const { domainMin, domainMax } = sharedDomain(
      items.map((it) => ({ values: valuesOf(it) })),
      { nice, symmetric, clampPercentile },
    );
    return { domainMin, domainMax };
  }, [items, valuesOf, useSolver, nice, symmetric, clampPercentile]);

  // Screen-reader data table for the whole grid: one row per panel, holding the
  // numbers that panel contributes (`valuesOf` - by contract the panel's own
  // series). A caller-supplied `a11y` wins; without either there is nothing the
  // grid knows about opaque panels, so the panels' own tables stand alone.
  const derived = useMemo<SmallMultiplesA11y | undefined>(() => {
    if (a11y) return a11y;
    if (!valuesOf || items.length === 0) return undefined;
    const values = items.map((item) => valuesOf(item));
    const width = values.reduce((m, v) => Math.max(m, v.length), 0);
    if (width === 0) return undefined;
    return {
      caption: title ? `${title} - data table` : "Small multiples data table",
      columns: Array.from({ length: width }, (_, i) => (width === 1 ? "Value" : `Value ${i + 1}`)),
      rows: items.map((item, i) => ({
        label: panelLabel(item, i),
        cells: Array.from({ length: width }, (_, k) => {
          const v = values[i]?.[k];
          return v != null && Number.isFinite(v) ? formatValue(v) : "n/a";
        }),
      })),
    };
  }, [a11y, items, valuesOf, title]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        fontFamily: tokens.font.family,
        color: tokens.color.text,
        ...style,
      }}
    >
      <style>{gridCss(cls, columns, gap)}</style>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: tokens.color.text }}>
          {title}
        </div>
      )}
      <div className={cls}>
        {items.map((item, i) => (
          <div key={keyOf ? keyOf(item, i) : i}>{renderItem(item, scale, i)}</div>
        ))}
      </div>
      {derived && (
        <ChartDataTable caption={derived.caption} columns={derived.columns} rows={derived.rows} />
      )}
    </div>
  );
}

/**
 * IBCS small multiples (the "CHECK" principle - consistent scaling). Renders an
 * array of items in a responsive grid, computing ONE shared value domain across
 * all of them and passing it to every panel via `renderItem`, so the panels are
 * visually comparable at a glance. The grid is responsive through an injected
 * `<style>` media query (no CSS files), like `StatementTable`'s row animation.
 *
 * For the common case of a mini variance column per group, use the built-in
 * {@link MiniVarianceMultiples}.
 *
 * The forwarded ref lands on the ROOT `<div>` (the grid wrapper) rather than on
 * an svg - a small-multiples surface is MANY svgs, so the div is the element a
 * caller can measure, scroll or export. `forwardRef` erases generics, so the
 * wrapper is re-typed to keep `T` inferred from `items` / `renderItem` exactly
 * as before.
 */
export const SmallMultiples = forwardRef(SmallMultiplesInner) as <T>(
  props: SmallMultiplesProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;

/**
 * The same component, re-typed with the INTERNAL `a11y` prop so the built-in
 * modes below can hand the grid their own screen-reader table. Module-private.
 */
const SmallMultiplesGrid = SmallMultiples as <T>(
  props: SmallMultiplesInnerProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;

/* ---------------- Built-in: a mini variance column per group ---------------- */

export interface MiniVarianceMultiplesProps {
  /** Grouped CategoryDatum-like rows - one panel per group. */
  groups: MiniGroupInput[];
  /** Scenario each category is compared against. Default "PY". */
  comparison?: ScenarioKey;
  /** Group-level higher-is-better default (per-row value wins). Default true. */
  higherIsBetter?: boolean;
  /** Target column count on a wide viewport. Default 3. */
  columns?: number;
  /** Height of each mini chart, in px. Default 120. */
  panelHeight?: number;
  /**
   * Run the shared-scale solver across ALL groups so every panel's bars are
   * directly comparable at a glance (IBCS "same scale = same meaning"). The
   * shared variance half-scale is rounded to a "nice" symmetric bound. Default
   * false - without it, panels already share the raw `varMax` (unchanged
   * behaviour), but the bound is the exact data max rather than a rounded one.
   */
  sharedScale?: boolean;
  /**
   * With `sharedScale`, clamp outliers via this percentile (0,1), e.g. `0.95`,
   * so one extreme group doesn't flatten the others. Bars beyond the clamp fill
   * to full height (their true value is still labelled). Default undefined.
   */
  clampPercentile?: number;
  /**
   * With `sharedScale`, render the shared scale ONCE as a small caption above
   * the grid (instead of relying on per-panel reading). Default true.
   */
  showScaleHint?: boolean;
  title?: string;
  format?: FormatOptions;
  /** Token override merged over the nearest {@link IbcsThemeProvider} theme. */
  tokens?: IbcsTokensOverride;
  /** Class applied to the root `<div>`. */
  className?: string;
  /** Styles merged *over* the root's own layout styles. */
  style?: CSSProperties;
}

/**
 * Built-in small-multiples mode: a mini AC-vs-comparison variance column chart
 * per group, every panel sharing ONE variance scale (computed across all
 * groups) so the panels are directly comparable. Columns are colored by
 * favorability with explicit +/- value labels and a zero baseline.
 *
 * Like {@link SmallMultiples}, the forwarded ref lands on the ROOT `<div>` -
 * the grid (and, with `sharedScale` + `showScaleHint`, the caption above it)
 * is the surface, not any single svg.
 */
export const MiniVarianceMultiples = forwardRef<HTMLDivElement, MiniVarianceMultiplesProps>(
  function MiniVarianceMultiples(
    {
      groups: groupsProp,
      comparison = "PY",
      higherIsBetter = true,
      columns = 3,
      panelHeight = 120,
      sharedScale = false,
      clampPercentile,
      showScaleHint = true,
      title,
      format = {},
      tokens: tokenOverride,
      className,
      style,
    },
    ref,
  ) {
    const tokens = useIbcsTokens(tokenOverride);
    const groups = useDataTween(groupsProp);
    const grow = useMountGrow(700, 0, groups);

    const layout = useMemo(
      () => computeMiniVariances(groups, { comparison, higherIsBetter }),
      [groups, comparison, higherIsBetter],
    );

    // With sharedScale on, run the solver across all groups for a rounded,
    // optionally-clamped symmetric variance half-scale; otherwise keep the exact
    // shared `varMax` (the long-standing behaviour) so nothing changes by default.
    const varMax = useMemo(() => {
      if (!sharedScale) return layout.varMax;
      const dom = sharedDomain(
        layout.groups.map((g) => ({
          values: g.bars.map((b) => (b.variance ? b.variance.abs : 0)),
          kind: "currency" as const,
        })),
        { symmetric: true, nice: true, clampPercentile },
      );
      return dom.domainMax || layout.varMax;
    }, [sharedScale, layout, clampPercentile]);

    // Screen-reader data table for the whole grid: one row per panel category,
    // carrying the current value and the comparison it is measured against (read
    // straight off the input rows, exactly as `computeMiniVariances` resolves
    // them: AC, else FC) plus the variance the mini column actually draws. This
    // replaces the grid's generic table, so there is exactly one.
    const a11yColumns = ["AC", comparison, `Δ${comparison}`];
    const a11yRows: ChartDataRow[] = layout.groups.flatMap((g, gi) =>
      g.bars.map((b, bi) => {
        const d = groups[gi]?.data[bi];
        const current = d ? (d.AC ?? d.FC) : undefined;
        const base = d ? d[comparison] : undefined;
        return {
          label: `${g.label} - ${b.category}`,
          cells: [
            current != null ? formatValue(current, format) : "n/a",
            base != null ? formatValue(base, format) : "n/a",
            b.variance ? formatSigned(b.variance.abs, format) : "n/a",
          ],
        };
      }),
    );

    // Reuse SmallMultiples for the responsive grid; the shared scale here is the
    // symmetric variance domain (the panels all key off `varMax`).
    // With the scale caption on, the caption div is the root and owns the ref /
    // className / style; otherwise the grid itself is the root and takes them.
    const captioned = sharedScale && showScaleHint;
    const grid = (
      <SmallMultiplesGrid
        items={layout.groups}
        a11y={{
          caption: title ? `${title} - data table` : `Variance versus ${comparison} - data table`,
          columns: a11yColumns,
          rows: a11yRows,
        }}
        columns={columns}
        title={captioned ? undefined : title}
        tokens={tokenOverride}
        ref={captioned ? undefined : ref}
        className={captioned ? undefined : className}
        style={captioned ? undefined : style}
        valuesOf={(g) => g.bars.map((b) => (b.variance ? b.variance.abs : 0))}
        renderItem={(g) => (
          <MiniVariancePanel
            label={g.label}
            bars={g.bars}
            varMax={varMax}
            height={panelHeight}
            grow={grow}
            format={format}
            tokens={tokens}
          />
        )}
      />
    );

    if (!captioned) return grid;

    // Render the shared scale exactly once as a caption, so panels need no
    // per-panel axis. Title is rendered here too (kept above the hint).
    return (
      <div
        ref={ref}
        className={className}
        style={{
          fontFamily: tokens.font.family,
          color: tokens.color.text,
          ...style,
        }}
      >
        {title && (
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: tokens.color.text }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: 11, color: tokens.color.textMuted, marginBottom: 8 }}>
          Shared scale - full bar height ≈ ±{formatValue(varMax, format)} vs {comparison}
        </div>
        {grid}
      </div>
    );
  },
);

function MiniVariancePanel({
  label,
  bars,
  varMax,
  height,
  grow,
  format,
  tokens,
}: {
  label: string;
  bars: ReturnType<typeof computeMiniVariances>["groups"][number]["bars"];
  varMax: number;
  height: number;
  grow: number;
  format: FormatOptions;
  tokens: IbcsTokens;
}) {
  const width = 220;
  // padT clears the panel title above the tallest column; padB leaves room for
  // the value label below a downward column AND the category label beneath it.
  const padT = 28;
  const padB = 26;
  const padX = 6;
  const innerW = width - padX * 2;
  const plotH = Math.max(10, height - padT - padB);
  const midY = padT + plotH / 2;

  const n = bars.length || 1;
  const band = innerW / n;
  const colW = Math.min(band * 0.6, 26);
  const cxOf = (i: number) => padX + band * i + band / 2;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${label}: variance by category, shared scale.`}
      style={{ display: "block" }}
    >
      <text x={padX} y={14} fontSize={11.5} fontWeight={600} fill={tokens.color.text}>
        {fitText(label, width - padX * 2, 11.5)}
      </text>

      {/* Zero baseline */}
      <line
        x1={padX}
        y1={midY}
        x2={width - padX}
        y2={midY}
        stroke={tokens.color.axis}
        strokeWidth={1}
      />

      {bars.map((b, i) => {
        const v = b.variance;
        if (!v || !Number.isFinite(v.abs)) return null;
        const val = v.abs;
        const frac = Math.min(Math.abs(val) / varMax, 1);
        const h = frac * (plotH / 2) * grow;
        const up = val >= 0;
        const color =
          val === 0 ? tokens.color.zero : v.favorable ? tokens.color.good : tokens.color.bad;
        const cx = cxOf(i);
        return (
          <g key={`${b.category}-${i}`}>
            <rect
              x={cx - colW / 2}
              y={up ? midY - h : midY}
              width={colW}
              height={Math.max(h, 1)}
              fill={color}
            />
            <text
              x={cx}
              y={up ? midY - h - 3 : midY + h + 9}
              fontSize={8.5}
              fill={color}
              textAnchor="middle"
            >
              {formatSigned(val, format)}
            </text>
            <text
              x={cx}
              y={height - 7}
              fontSize={8.5}
              fill={tokens.color.textMuted}
              textAnchor="middle"
            >
              {fitText(b.category, band - 1, 8.5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
