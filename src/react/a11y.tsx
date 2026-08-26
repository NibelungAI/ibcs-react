import type { CSSProperties, KeyboardEvent, SVGProps } from "react";

/**
 * The standard "visually hidden" (screen-reader-only) style. The node stays in
 * the DOM and the accessibility tree — so assistive tech reads it — but is
 * clipped out of visual layout. This is deliberately NOT `display: none`, which
 * would hide the node from screen readers too. SSR-safe (plain inline style,
 * no measuring or browser APIs).
 *
 * Apply it to a BLOCK-level element (`<div>`, `<span>`) — never directly to a
 * `<table>`. CSS table layout treats `height`/`width` as a MINIMUM, so a table
 * ignores the 1×1 clamp and keeps its full layout box: invisible (the clip
 * still suppresses painting) but inflating every scroll container above it by
 * hundreds of phantom pixels. Wrap the table instead — see {@link ChartDataTable}.
 */
export const srOnly: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

export const SELECTABLE_MARK_CSS = `
.ibcs-selectable-mark:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
`;

/**
 * Keyboard-accessible props for selectable SVG marks. SVG `<g>` elements are
 * not interactive by default, so charts that support `onSelect` should opt into
 * button semantics and Enter/Space activation for keyboard users.
 */
export function selectableMarkProps<T extends SVGElement = SVGGElement>(
  onSelect: (() => void) | undefined,
  label: string,
): SVGProps<T> {
  if (!onSelect) return {};
  const onKeyDown = (event: KeyboardEvent<T>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    className: "ibcs-selectable-mark",
    onClick: onSelect,
    onKeyDown,
  };
}

/** One data row: a row header `label` plus a cell per column. */
export interface ChartDataRow {
  label: string;
  cells: Array<string | number>;
}

export interface ChartDataTableProps {
  /** A `<caption>` describing what the table represents. */
  caption: string;
  /** Column headers, in order. The row-label column is implicit (first). */
  columns: string[];
  /** Body rows; each `cells` array should line up with `columns`. */
  rows: ChartDataRow[];
}

/**
 * A visually-hidden `<table>` that exposes a chart's underlying numbers to
 * screen-reader users. Rendered as a sibling of the chart `<svg>`, which itself
 * carries an accessible name (`role="img"` + `aria-label`) — never
 * `aria-hidden`; the table supplements that label with the real values,
 * row/column headers and a caption. Zero-dependency and SSR-safe — it renders
 * identically on the server.
 *
 * The hiding style sits on a WRAPPER `<div>`, not on the table: a `<div>`
 * honours the 1×1 clamp, while a CSS table box treats it as a minimum and
 * keeps a full-size (clipped, invisible) layout box — which used to add its
 * entire height to the scrollable overflow of any ancestor with `overflow`
 * set, growing phantom scrollbars around every chart.
 */
export function ChartDataTable({ caption, columns, rows }: ChartDataTableProps) {
  return (
    <div style={srOnly}>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {columns.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <th scope="row">{r.label}</th>
              {r.cells.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
