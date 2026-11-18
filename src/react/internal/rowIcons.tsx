import { Fragment } from "react";
import { ROW_ICON_GAP, rowIconSize, type RowIcon } from "../../core/rowIcon";
import { srOnly } from "../a11y";

/**
 * The row-icon slot of a label, drawn two ways: as `<img>` elements for an
 * HTML table cell, and as `<image>` elements inside a chart's svg. Both draw
 * each icon at `rowIconSize` - never above `naturalSize / pixelRatio` or 56
 * CSS px - with its `border` as a 1 px frame over the edge of its box, so the
 * bitmap itself is drawn at the full box size in both.
 *
 * Internal module: not part of the public API surface.
 */

/**
 * The icons of one table row, left to right, as `<img>` elements in one flex
 * box - so a caller can wrap the whole group in an element of their own and
 * the icons stay side by side. Each is decorative unless `alt` is set; a
 * visually hidden ", " follows each icon with an `alt`, so the row header's
 * name reads the alts and the label apart ("Signet of Embers, Best set").
 */
export function RowIconImages({ icons, size }: { icons: readonly RowIcon[]; size: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: ROW_ICON_GAP }}>
      {icons.map((icon, i) => {
        const d = rowIconSize(icon, size);
        return (
          <Fragment key={i}>
            <img
              src={icon.src}
              alt={icon.alt ?? ""}
              width={d}
              height={d}
              style={{
                display: "block",
                flex: "0 0 auto",
                objectFit: "contain",
                ...(icon.border
                  ? { outline: `1px solid ${icon.border}`, outlineOffset: -1 }
                  : null),
              }}
            />
            {icon.alt ? <span style={srOnly}>, </span> : null}
          </Fragment>
        );
      })}
    </span>
  );
}

/**
 * The icons of one chart row as svg `<image>` elements, left to right from
 * `x`, each centred on the row's centre line `cy` (whole pixels, so the
 * bitmap is not resampled across a half pixel).
 */
export function RowIconImagesSvg({
  icons,
  size,
  x,
  cy,
}: {
  icons: readonly RowIcon[];
  size: number;
  x: number;
  cy: number;
}) {
  // Each icon's size and left edge, side by side from `x`.
  const placed = icons.map((icon) => ({ icon, d: rowIconSize(icon, size), ix: 0 }));
  placed.forEach((p, i) => {
    p.ix = i === 0 ? x : placed[i - 1]!.ix + placed[i - 1]!.d + ROW_ICON_GAP;
  });
  return (
    <>
      {placed.map(({ icon, d, ix }, i) => {
        const iy = Math.round(cy - d / 2);
        return (
          <g key={i}>
            <image
              href={icon.src}
              x={ix}
              y={iy}
              width={d}
              height={d}
              preserveAspectRatio="xMidYMid meet"
            />
            {icon.border && (
              <rect
                x={ix + 0.5}
                y={iy + 0.5}
                width={d - 1}
                height={d - 1}
                fill="none"
                stroke={icon.border}
                strokeWidth={1}
              />
            )}
          </g>
        );
      })}
    </>
  );
}
