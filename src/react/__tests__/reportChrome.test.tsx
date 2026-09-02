import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { Report } from "../Report";
import { flatCard } from "../../core/tokens";
import type { ReportConfig } from "../../core/report";

/**
 * How a report's blocks are framed is a theme decision (`card` tokens), not a
 * fixed look: the default is a hairline card, `flatCard` is whitespace only -
 * the IBCS SIMPLIFY ideal and what a printed page wants. The single-column
 * collapse is a screen rule with a declared breakpoint, never a print rule.
 */
const config: ReportConfig = {
  title: { who: "Acme", what: "Revenue", when: "2026" },
  blocks: [
    { id: "rev", type: "kpi", span: 4, config: { label: "Revenue", values: { AC: 10, PY: 8 } } },
    { id: "note", type: "text", span: 8, body: "Prose." },
  ],
};

const blocks = (html: string) =>
  [...html.matchAll(/<section class="ibcs-report-block"[^>]*style="([^"]*)"/g)].map((m) => m[1]);

describe("Report block chrome", () => {
  it("frames every block from the theme's card tokens by default", () => {
    const styles = blocks(renderToString(<Report config={config} />));
    expect(styles).toHaveLength(2);
    for (const style of styles) {
      expect(style).toContain("border:1px solid");
      expect(style).toContain("border-radius:8px");
      expect(style).not.toContain("box-shadow");
    }
  });

  it("frames a KPI block once: the card inside draws no border of its own", () => {
    const html = renderToString(<Report config={config} />);
    const kpi = html.slice(
      html.indexOf('data-block-type="kpi"'),
      html.indexOf('data-block-type="text"'),
    );
    expect(kpi.match(/border:1px solid/g)).toHaveLength(1);
  });

  it("goes flat with `tokens={{ card: flatCard }}` - no border, radius, shadow or padding", () => {
    const styles = blocks(renderToString(<Report config={config} tokens={{ card: flatCard }} />));
    for (const style of styles) {
      expect(style).not.toContain("border:");
      expect(style).toContain("border-radius:0");
      expect(style).not.toContain("box-shadow");
      expect(style).toContain("padding:0");
    }
  });

  it("names its parts with stable selectors", () => {
    const html = renderToString(<Report config={config} className="mine" />);
    expect(html).toContain('class="ibcs-report mine"');
    expect(html).toContain('class="ibcs-report-grid"');
    expect(html).toContain('data-block-type="kpi" data-block-id="rev"');
  });

  it("collapses to one column on screens only, at the declared breakpoint", () => {
    const html = renderToString(<Report config={config} collapseBelow={560} />);
    expect(html).toContain("@media screen and (max-width: 560px)");
    expect(html).toContain('.ibcs-report-grid[data-collapse="560"]');
    expect(html).toContain('data-collapse="560"');
    expect(html).not.toContain("@media (max-width");
  });

  it("emits no collapse rule at all with `collapseBelow={false}`", () => {
    const html = renderToString(<Report config={config} collapseBelow={false} />);
    expect(html).not.toContain("@media");
    expect(html).not.toContain("data-collapse");
  });
});
