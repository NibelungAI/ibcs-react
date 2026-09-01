"use client";

import { useMemo, useState } from "react";
import { ConformanceReport, checkIbcs } from "ibcs-react";

const DEFAULT_JSON = `{
  "type": "pie",
  "title": "Revenue 2026",
  "data": []
}`;

const SEVERITY_COLOR: Record<string, string> = {
  error: "#c0392b",
  warning: "#c98a1e",
  info: "#9a9992",
};

/**
 * Edit a chart config as JSON and watch `checkIbcs` re-lint it on every
 * keystroke - the same component the docs describe, driven live.
 */
export function ConformancePlayground() {
  const [text, setText] = useState(DEFAULT_JSON);

  const { parsed, error } = useMemo(() => {
    try {
      return { parsed: JSON.parse(text) as unknown, error: null as string | null };
    } catch (e) {
      return { parsed: undefined as unknown, error: (e as Error).message };
    }
  }, [text]);

  const findings = useMemo(() => (error ? [] : checkIbcs(parsed)), [parsed, error]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { error: 0, warning: 0, info: 0 };
    for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
    return c;
  }, [findings]);

  return (
    <div style={{ display: "grid", gap: 16, width: "100%" }}>
      <div>
        <label
          htmlFor="conformance-config"
          style={{
            display: "block",
            fontSize: 11.5,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            color: "#9a9992",
            marginBottom: 6,
          }}
        >
          Config (JSON)
        </label>
        <textarea
          id="conformance-config"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={9}
          style={{
            width: "100%",
            boxSizing: "border-box",
            resize: "vertical",
            padding: "12px 14px",
            background: "#1f1f1d",
            color: "#eceae4",
            border: "1px solid #2b2b29",
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.55,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11.5,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: "#9a9992",
            }}
          >
            Findings
          </div>
          {!error && (
            <div style={{ display: "flex", gap: 8 }}>
              {(["error", "warning", "info"] as const).map((s) =>
                counts[s] ? (
                  <span
                    key={s}
                    style={{
                      display: "inline-flex",
                      gap: 5,
                      alignItems: "center",
                      fontSize: 12,
                      color: "#3a3a36",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: SEVERITY_COLOR[s],
                      }}
                      aria-hidden
                    />
                    {counts[s]} {s}
                    {counts[s] > 1 ? "s" : ""}
                  </span>
                ) : null,
              )}
            </div>
          )}
        </div>

        {error ? (
          <div
            style={{
              padding: "10px 14px",
              border: "1px solid #e6c4bd",
              background: "#fbeeec",
              borderRadius: 8,
              fontSize: 13,
              color: "#a23b2b",
            }}
          >
            <b>Parse error:</b> {error}. Fix the JSON above to run the check again.
          </div>
        ) : (
          <ConformanceReport target={parsed} />
        )}
      </div>
    </div>
  );
}
