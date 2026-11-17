import { useMemo } from "react";
import type { IbcsFinding } from "../core/conformance";
import { checkIbcs } from "../core/conformance";
import type { IbcsTokensOverride } from "../core/tokens";
import type { IbcsLabelsOverride } from "../core/labels";
import { useIbcsLabels, useIbcsTokens } from "./theme";

export interface ConformanceReportProps {
  /** Pre-computed findings. Provide this OR `target`. */
  findings?: IbcsFinding[];
  /** A config to lint with {@link checkIbcs}, when `findings` isn't supplied. */
  target?: unknown;
  /** Text shown when there are zero findings. Wins over `labels.conformant`. */
  emptyLabel?: string;
  tokens?: IbcsTokensOverride;
  /**
   * The report's own words - the no-findings line (`conformant`) and the
   * severity tags (`severity`) - merged onto `IbcsThemeProvider`'s. The
   * findings' messages are the linter's English diagnostics. See `IbcsLabels`.
   */
  labels?: IbcsLabelsOverride;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders IBCS / ISO 24896 conformance findings as a simple list: errors in
 * red, warnings in amber, info in grey. Pass either ready-made `findings` or a
 * `target` config to lint on the fly. Zero deps, SSR-safe (no browser APIs).
 */
export function ConformanceReport({
  findings,
  target,
  emptyLabel,
  tokens: tokenOverride,
  labels,
  className,
  style,
}: ConformanceReportProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const words = useIbcsLabels(labels);
  const items = useMemo(
    () => findings ?? (target !== undefined ? checkIbcs(target) : []),
    [findings, target],
  );

  const colorFor = (severity: IbcsFinding["severity"]) =>
    severity === "error"
      ? tokens.color.bad
      : severity === "warning"
        ? "#c98a1e"
        : tokens.color.textMuted;

  const fontFamily = tokens.font.family;

  if (items.length === 0) {
    return (
      <div
        className={className}
        style={{
          fontFamily,
          fontSize: 13,
          color: tokens.color.good,
          padding: "8px 12px",
          ...style,
        }}
      >
        {emptyLabel ?? words.conformant}
      </div>
    );
  }

  return (
    <ul
      className={className}
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        fontFamily,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...style,
      }}
    >
      {items.map((f, i) => {
        const color = colorFor(f.severity);
        return (
          <li
            key={`${f.rule}-${f.path ?? i}`}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "baseline",
              padding: "6px 10px",
              borderLeft: `3px solid ${color}`,
              background: tokens.color.surface,
              borderRadius: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color,
                minWidth: 56,
              }}
            >
              {words.severity[f.severity]}
            </span>
            <span style={{ fontSize: 13, color: tokens.color.text, lineHeight: 1.4 }}>
              {f.message}
              {f.path ? <span style={{ color: tokens.color.textMuted }}> ({f.path})</span> : null}
              <span style={{ color: tokens.color.textMuted, fontSize: 11 }}> · {f.rule}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
