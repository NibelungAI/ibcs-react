"use client";

import type { ReactNode } from "react";
import { ComparisonTable, DataTable, StatementTable, oceanTokens } from "ibcs-react";
import {
  sampleTableT01,
  tableT01Left,
  tableT01Right,
  sampleTableT02,
  tableT02Left,
  tableT02Right,
  sampleTableT03,
  tableT03Columns,
  sampleStatementFlat,
} from "@/lib/demo-data/sample-data";

/**
 * Live renders of the IBCS table templates T01-T04, each under the report title
 * block the notation asks for (company · report title with unit · period). One
 * palette (the Ocean preset) across all four, so the templates differ only in
 * layout and variance notation.
 */

const TOK = oceanTokens;

/** The IBCS report title block: who, what (with unit) and when. */
function TitleBlock({
  company,
  title,
  unit,
  period,
}: {
  company: string;
  title: string;
  unit: string;
  period: string;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12.5, color: TOK.color.textMuted }}>{company}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: TOK.color.text }}>
        {title} <span style={{ fontWeight: 400, color: TOK.color.textMuted }}>in {unit}</span>
      </div>
      <div style={{ fontSize: 12.5, color: TOK.color.textMuted }}>{period}</div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: TOK.font.family }}>{children}</div>;
}

/** T01 - the flanking hierarchy with numeric variance columns. */
export function TemplateT01() {
  return (
    <Card>
      <TitleBlock
        company="Electronic Inc."
        title="Profit after tax"
        unit="kEUR"
        period="2014 PY, PL, AC"
      />
      <ComparisonTable
        rows={sampleTableT01}
        leftColumns={tableT01Left}
        rightColumns={tableT01Right}
        leftGroupLabel="November"
        rightGroupLabel="January-November"
        showTotals
        totalsLabel="World"
        format={{ compact: false }}
        tokens={TOK}
      />
    </Card>
  );
}

/** T02 - the same hierarchy with the variance embedded as bars and pins. */
export function TemplateT02() {
  return (
    <Card>
      <TitleBlock
        company="Electronic Inc."
        title="Profit after tax"
        unit="kEUR"
        period="2014 PY, AC"
      />
      <ComparisonTable
        rows={sampleTableT02}
        leftColumns={tableT02Left}
        rightColumns={tableT02Right}
        leftGroupLabel="November"
        rightGroupLabel="January-November"
        showTotals
        totalsLabel="World"
        format={{ compact: false }}
        tokens={TOK}
        labelWidth={120}
      />
    </Card>
  );
}

/** T03 - a multi-year profit and loss statement with flow markers. */
export function TemplateT03() {
  return (
    <Card>
      <TitleBlock
        company="SoftCons International Inc."
        title="Profit and loss statement"
        unit="mUSD"
        period="2012…2015 PL and AC (FC)"
      />
      <DataTable
        columns={tableT03Columns}
        rows={sampleTableT03}
        format={{ compact: false }}
        tokens={TOK}
      />
    </Card>
  );
}

/** T04 - the integrated statement, waterfall lane dropped. */
export function TemplateT04() {
  return (
    <Card>
      <TitleBlock
        company="SoftCons International Inc."
        title="Profit and loss statement"
        unit="mUSD"
        period="2014 PY, AC"
      />
      <StatementTable
        lines={sampleStatementFlat}
        showWaterfall={false}
        format={{ compact: true, decimals: 1 }}
        tokens={TOK}
      />
    </Card>
  );
}
