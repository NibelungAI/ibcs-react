import { ROW_ICON_GAP, rowIconSize, type RowIcon } from "../../core/rowIcon";

/**
 * The row-icon slot of a label, drawn two ways: as `<img>` elements for an
 * HTML table cell, and as `<image>` elements inside a chart's svg. Both draw
 * each icon at `rowIconSize` - never above its `naturalSize` or 56 px - with
 * its `border` as a 1 px frame inside its box.
 *
 * Internal module: not part of the public API surface.
 */

/** The icons of one table row, left to right, as `<img>` elements (decorative unless `alt` is set). */
export function RowIconImages({ icons, size }: { icons: readonly RowIcon[]; size: number }) {
  return (
    <>
      {icons.map((icon, i) => {
        const d = rowIconSize(icon, size);
        return (
          <img
            key={i}
            src={icon.src}
            alt={icon.alt ?? ""}
            width={d}
            height={d}
            style={{
              display: "block",
              flex: "0 0 auto",
              boxSizing: "border-box",
              objectFit: "contain",
              ...(icon.border ? { border: `1px solid ${icon.border}` } : null),
            }}
          />
        );
      })}
    </>
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
