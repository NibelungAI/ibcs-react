import type { ReactNode } from "react";
import type { IbcsTokens } from "../../core/tokens";
import {
  ROW_ICON_MAX_PX,
  ROW_ICON_MORE_GAP,
  fitRowIcons,
  rowIconsOf,
  rowIconsWidth,
  type FittedRowIcons,
  type RowIcon,
} from "../../core/rowIcon";
import { RowIconImagesSvg } from "./rowIcons";
import { estTextW } from "./text";

/**
 * The icon slot of the row labels of an svg chart with one row per category
 * (`TimelineChart`, `RangeBarChart`), as `RankingVarianceChart` draws it:
 * every row's icons at one size, in a slot as wide as the widest row's, so
 * the labels after it align; chips with no room are left out from the end
 * and counted in a "+N", and their `alt`s join the label's tooltip; a
 * caller's `renderIcon` element takes the place of a row's icons.
 *
 * Internal module: not part of the public API surface.
 */

/** The smallest row icon drawn, px. */
export const ICON_MIN = 8;
/** The space between a row's icon slot and its label, px. */
export const ICON_LABEL_GAP = 6;

/** The icon size of rows `rowH` tall: the caller's, else `fallback`; from 8 to `rowH − 4`, at most 56; 0 when the rows are too short. */
export function rowIconPx(iconSize: number | undefined, rowH: number, fallback: number): number {
  const max = Math.min(ROW_ICON_MAX_PX, rowH - 4);
  if (max < ICON_MIN) return 0;
  const want = Number.isFinite(iconSize) ? iconSize! : fallback;
  return Math.min(max, Math.max(ICON_MIN, Math.round(want)));
}

/** The laid-out slot. */
export interface RowLabelIcons {
  /** The slot's width (0: no icons at all, and the labels start at the column's edge). */
  slotW: number;
  /** Where a row's label starts, past the slot. */
  labelInset: number;
  /** Draw row `i`'s icons (or the caller's element) from `x`, centred on `cy`; null when it has none. */
  draw: (i: number, x: number, cy: number) => ReactNode;
  /** The icons left out of row `i`, from the end. */
  dropped: (i: number) => RowIcon[];
}

/**
 * Lay out the slot for `rows`, at `iconPx` (0: none), in at most `maxSlot` px.
 * The "+N" is written with `moreText` at `fontPx`.
 */
export function layoutRowLabelIcons<R>(options: {
  rows: readonly R[];
  iconOf: (row: R) => RowIcon | readonly RowIcon[] | undefined;
  iconPx: number;
  maxSlot: number;
  moreText: (count: number) => string;
  fontPx: number;
  renderIcon?: (row: R, size: number, icon: ReactNode) => ReactNode;
  tokens: IbcsTokens;
}): RowLabelIcons {
  const { rows, iconOf, iconPx, maxSlot, moreText, fontPx, renderIcon, tokens } = options;
  const lists = rows.map((r) => (iconPx > 0 ? rowIconsOf(iconOf(r)) : []));
  const moreWidth = (count: number) => estTextW(moreText(count), fontPx);
  const wanted = rows.reduce(
    (w, _, i) =>
      Math.max(w, rowIconsWidth(lists[i]!, iconPx), renderIcon && iconPx > 0 ? iconPx : 0),
    0,
  );
  if (wanted === 0) {
    return { slotW: 0, labelInset: 0, draw: () => null, dropped: () => [] };
  }
  const fitted: FittedRowIcons[] = lists.map((list) =>
    fitRowIcons(list, iconPx, Math.max(0, maxSlot), moreWidth),
  );
  const drawIcons = (i: number, x: number, cy: number): ReactNode => {
    const f = fitted[i]!;
    if (f.kept.length === 0 && !f.more) return null;
    const keptW = rowIconsWidth(f.kept, iconPx);
    return (
      <>
        <RowIconImagesSvg icons={f.kept} size={iconPx} x={x} cy={cy} />
        {f.more && (
          <text
            x={x + keptW + (f.kept.length > 0 ? ROW_ICON_MORE_GAP : 0)}
            y={cy + fontPx * 0.34}
            fontSize={fontPx}
            fill={tokens.color.textMuted}
          >
            {moreText(f.dropped.length)}
          </text>
        )}
      </>
    );
  };
  // The caller's element, given the chart's own icons (box coordinates) to wrap.
  const elements = rows.map((r, i) => {
    if (!renderIcon || !(iconPx > 0) || iconPx > maxSlot) return null;
    const el = renderIcon(r, iconPx, drawIcons(i, 0, iconPx / 2));
    return el == null || typeof el === "boolean" ? null : el;
  });
  const rowSlot = (i: number) =>
    elements[i] != null ? Math.max(iconPx, fitted[i]!.width) : fitted[i]!.width;
  const slotW = rows.reduce((w, _, i) => Math.max(w, rowSlot(i)), 0);
  return {
    slotW,
    labelInset: slotW > 0 ? slotW + ICON_LABEL_GAP : 0,
    draw: (i, x, cy) =>
      elements[i] != null ? (
        <g transform={`translate(${x} ${Math.round(cy - iconPx / 2)})`}>{elements[i]}</g>
      ) : (
        drawIcons(i, x, cy)
      ),
    dropped: (i) => fitted[i]?.dropped ?? [],
  };
}
