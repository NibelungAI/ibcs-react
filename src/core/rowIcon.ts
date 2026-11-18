/**
 * Row icons - a small picture before a row's label: an item or spell icon, a
 * portrait, or several of them as chips. `DataTable` rows and
 * `RankingVarianceChart` data carry them as plain data (`icon`), so a model
 * builder can produce them without React.
 *
 * Size rule: an icon is drawn at the component's icon size, but never larger
 * than its own image (`naturalSize`) and never larger than 56 CSS px - the
 * largest size the common icon hosts serve. So an icon is never upscaled.
 *
 * Pure data and arithmetic, like the rest of `core/`. SSR-safe.
 */

/** A small square picture before a row's label. */
export interface RowIcon {
  /**
   * The image: a URL, a path or a `data:` URI. A chart's PNG export and copy
   * (`svgToPngBlob`, `ExportMenu`) draw its svg as an image, which loads no
   * remote file: only an icon given as a `data:` URI appears in them.
   */
  src: string;
  /**
   * The image's own size in pixels - its larger side, for a picture that is
   * not square (e.g. 56 for a "large" 56 × 56 icon). The icon is never drawn
   * larger than this, so it is never upscaled. An icon whose `naturalSize` is
   * not a finite number of at least 1 is not drawn.
   */
  naturalSize: number;
  /**
   * A 1 px frame in this colour, drawn inside the icon's box - e.g. the item
   * quality's colour. Unset: no frame.
   */
  border?: string;
  /**
   * The icon's text alternative. Default "": the icon is decorative and the
   * row's label names the row. Give one when the picture says something the
   * label does not (the chips of the items a variant changes); it is read
   * before the label, as the markup orders them.
   */
  alt?: string;
}

/** The largest size, in CSS px, an icon is ever drawn at. */
export const ROW_ICON_MAX_PX = 56;

/** The gap between two icons of one row, in px. */
export const ROW_ICON_GAP = 2;

/**
 * A row's `icon` as a list of the icons that can be drawn: a single icon or
 * several, without those whose `src` is empty or whose `naturalSize` is not
 * a finite number of at least 1 (an image under one pixel draws nothing).
 *
 * Internal plumbing shared by the renderers - not part of the public surface.
 */
export function rowIconsOf(icon: RowIcon | readonly RowIcon[] | null | undefined): RowIcon[] {
  if (icon == null) return [];
  const list: readonly RowIcon[] = Array.isArray(icon) ? icon : [icon as RowIcon];
  return list.filter(
    (i) =>
      i != null &&
      typeof i.src === "string" &&
      i.src !== "" &&
      Number.isFinite(i.naturalSize) &&
      i.naturalSize >= 1,
  );
}

/**
 * The size an icon is drawn at, in whole CSS px: the requested `size`, but
 * never above the icon's `naturalSize` nor {@link ROW_ICON_MAX_PX}. Whole
 * pixels keep the edges crisp; the result is at most the image's own size.
 *
 * Internal plumbing - not part of the public surface.
 */
export function rowIconSize(icon: RowIcon, size: number): number {
  return Math.max(0, Math.floor(Math.min(size, icon.naturalSize, ROW_ICON_MAX_PX)));
}

/**
 * The width of a row's icons laid side by side at `size`, with
 * {@link ROW_ICON_GAP} between them; 0 for none.
 *
 * Internal plumbing - not part of the public surface.
 */
export function rowIconsWidth(icons: readonly RowIcon[], size: number): number {
  if (icons.length === 0) return 0;
  return (
    icons.reduce((w, icon) => w + rowIconSize(icon, size), 0) + ROW_ICON_GAP * (icons.length - 1)
  );
}

/**
 * The leading icons of a row that fit `maxWidth` side by side at `size`: the
 * ones that would overflow it are left out, from the end.
 *
 * Internal plumbing - not part of the public surface.
 */
export function fitRowIcons(icons: readonly RowIcon[], size: number, maxWidth: number): RowIcon[] {
  const out: RowIcon[] = [];
  for (const icon of icons) {
    if (rowIconsWidth([...out, icon], size) > maxWidth) break;
    out.push(icon);
  }
  return out;
}
