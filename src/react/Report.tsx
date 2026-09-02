import React, { useMemo } from "react";
import type { ReportConfig, ReportBlock, StructuredTitle } from "../core/report";
import { defaultSpan, resolveSharedScales } from "../core/report";
import type { IbcsTokens, IbcsTokensOverride } from "../core/tokens";
import { useIbcsTokens } from "./theme";
import { cardSurface } from "./appearance";
import { ConfiguredChart } from "./ConfiguredChart";
import { StatementTable } from "./StatementTable";
import { KpiCard } from "./KpiCard";
import { DataTable } from "./DataTable";

export interface ReportProps {
  config: ReportConfig;
  tokens?: IbcsTokensOverride;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Opt in to shared-scale resolution: chart blocks tagged with the same
   * `sharedScaleGroup` are run through the shared-scale solver and the resolved
   * common domain is published on each block's wrapper as `data-shared-scale-group`
   * and `data-shared-scale-domain` (JSON). Default false.
   *
   * NOTE: this is advisory - `ConfiguredChart` doesn't yet take an external
   * domain, so the resolved scale is exposed (in the DOM and via
   * {@link resolveSharedScales}) rather than forced onto each chart's axis.
   */
  sharedScales?: boolean;
  /** With `sharedScales`, clamp outliers via this percentile (0,1). Default off. */
  sharedScaleClampPercentile?: number;
  /**
   * Viewport width in px below which the grid collapses to a single column
   * (every block full width). Default 760. `false` never collapses. A screen
   * rule only: print keeps the authored spans whatever the paper width.
   */
  collapseBelow?: number | false;
}

/**
 * The single-column rule, scoped to grids that declared this breakpoint so
 * two reports with different breakpoints on one page do not fight. `screen`
 * on purpose: an A4 page area is narrower than a laptop and must not turn a
 * 12-column report into a stack of full-width blocks.
 */
const collapseCss = (px: number) => `
@media screen and (max-width: ${px}px) {
  .ibcs-report-grid[data-collapse="${px}"] { grid-template-columns: 1fr !important; }
  .ibcs-report-grid[data-collapse="${px}"] > * { grid-column: auto !important; }
}
`;

/**
 * Render a JSON `ReportConfig` as a responsive grid of blocks (KPI cards,
 * charts, statements, text). One theme flows to every block. Titles follow the
 * ISO 24896 Who/What/When convention with the key message kept separate.
 *
 * How blocks are framed comes from the theme's `card` tokens - `framedCard`
 * (the default: hairline border, rounded) or `flatCard` (nothing but
 * whitespace, the IBCS SIMPLIFY look and what paper wants):
 * `<Report config={c} tokens={{ card: flatCard }} />`.
 *
 * Stable selectors for the CSS a theme cannot express: `.ibcs-report` (root),
 * `.ibcs-report-grid`, `.ibcs-report-block[data-block-type][data-block-id]`.
 */
export function Report({
  config,
  tokens: tokenOverride,
  className,
  style,
  sharedScales = false,
  sharedScaleClampPercentile,
  collapseBelow = 760,
}: ReportProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const columns = config.columns ?? 12;
  // Every block is framed the same way, by the theme; the accent colour is
  // irrelevant here because a block never draws the KPI accent bar.
  const blockSurface = cardSurface(undefined, tokens, tokens.color.neutral);

  // Resolve shared-scale groups once (opt-in). We publish the resolved domain on
  // each tagged chart's wrapper so the info is addressable without yet forcing
  // any chart's internal axis (see ReportProps.sharedScales).
  const sharedScaleByBlock = useMemo(() => {
    if (!sharedScales) return null;
    const byBlock = new Map<string, { group: string; domain: unknown }>();
    for (const g of resolveSharedScales(config, {
      clampPercentile: sharedScaleClampPercentile,
    }).values()) {
      for (const id of g.blockIds) byBlock.set(id, { group: g.group, domain: g.domain });
    }
    return byBlock;
  }, [sharedScales, config, sharedScaleClampPercentile]);

  return (
    <div
      className={className ? `ibcs-report ${className}` : "ibcs-report"}
      style={{
        fontFamily: tokens.font.family,
        color: tokens.color.text,
        ...style,
      }}
    >
      {collapseBelow !== false && <style>{collapseCss(collapseBelow)}</style>}

      {(config.title || config.message) && (
        <header style={{ marginBottom: 16 }}>
          <TitleBlock title={config.title} tokens={tokens} big />
          {config.message && (
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: tokens.color.text }}>
              {config.message}
            </p>
          )}
        </header>
      )}

      <div
        className="ibcs-report-grid"
        data-collapse={collapseBelow === false ? undefined : collapseBelow}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {config.blocks.map((block) => {
          const span = Math.min(block.span ?? defaultSpan(block.type, columns), columns);
          const shared = sharedScaleByBlock?.get(block.id);
          return (
            <section
              key={block.id}
              className="ibcs-report-block"
              data-block-type={block.type}
              data-block-id={block.id}
              data-shared-scale-group={shared?.group}
              data-shared-scale-domain={shared ? JSON.stringify(shared.domain) : undefined}
              style={{
                ...blockSurface,
                gridColumn: `span ${span}`,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {block.type !== "kpi" && (block.title || block.message) && (
                <div style={{ marginBottom: 12 }}>
                  <TitleBlock title={block.title} tokens={tokens} />
                  {block.message && (
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: tokens.color.textMuted }}>
                      {block.message}
                    </p>
                  )}
                </div>
              )}
              <BlockBody block={block} tokens={tokenOverride} theme={tokens} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BlockBody({
  block,
  tokens,
  theme,
}: {
  block: ReportBlock;
  tokens?: IbcsTokensOverride;
  /** Resolved theme - for the bits this component paints itself (text prose). */
  theme: IbcsTokens;
}) {
  switch (block.type) {
    case "kpi":
      // The block is the frame; the card inside draws none of its own, or a
      // KPI would sit in two borders while every other block sits in one.
      return (
        <KpiCard
          {...block.config}
          tokens={tokens}
          appearance={{
            border: false,
            shadow: false,
            radius: 0,
            background: "transparent",
            padding: 0,
          }}
          style={{ flex: 1 }}
        />
      );
    case "chart":
      // Fill the cell's remaining height and centre the chart in it - sibling
      // blocks in the same grid row stretch to the tallest (often a statement),
      // and a top-aligned chart would otherwise leave a large empty gap beneath.
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "auto",
          }}
        >
          <ConfiguredChart config={block.config} tokens={tokens} />
        </div>
      );
    case "statement":
      return (
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <StatementTable {...block.config} tokens={tokens} />
        </div>
      );
    case "table":
      return (
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <DataTable
            columns={block.config.columns}
            rows={block.config.rows}
            showTotals={block.config.showTotals}
            defaultSort={block.config.defaultSort}
            format={block.config.format}
            tokens={tokens}
          />
        </div>
      );
    case "text":
      // Prose lives in `body`; the heading + key message are already drawn by
      // the shared block header above (which is also the fallback for a legacy
      // text block that only carries `message`).
      return block.body ? <TextBody body={block.body} tokens={theme} /> : null;
  }
}

/**
 * A text block's prose: blank-line-separated paragraphs, set at body size in
 * the block's own text colour (the muted, smaller header `message` stays the
 * one-line key message above it).
 */
function TextBody({ body, tokens }: { body: string; tokens: IbcsTokens }) {
  const paragraphs = body
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: tokens.color.text }}>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0" }}>
          {p}
        </p>
      ))}
    </div>
  );
}

/** Render a Who/What/When structured title (or a plain string). */
function TitleBlock({
  title,
  tokens,
  big,
}: {
  title?: StructuredTitle | string;
  tokens: IbcsTokens;
  big?: boolean;
}) {
  if (!title) return null;
  if (typeof title === "string") {
    return <div style={{ fontSize: big ? 20 : 15, fontWeight: 600 }}>{title}</div>;
  }
  return (
    <div style={{ lineHeight: 1.25 }}>
      {title.who && <div style={{ fontSize: big ? 20 : 14.5, fontWeight: 600 }}>{title.who}</div>}
      {title.what && (
        <div style={{ fontSize: big ? 15 : 13, fontWeight: 500, color: tokens.color.text }}>
          {title.what}
        </div>
      )}
      {title.when && (
        <div style={{ fontSize: big ? 13 : 11.5, color: tokens.color.textMuted }}>{title.when}</div>
      )}
    </div>
  );
}
