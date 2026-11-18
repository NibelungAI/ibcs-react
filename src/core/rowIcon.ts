/**
 * Row icons - a small picture before a row's label: an item or spell icon, a
 * portrait, or several of them as chips. `DataTable` rows and
 * `RankingVarianceChart` data carry them as plain data (`icon`), so a model
 * builder can produce them without React.
 *
 * Size rule: an icon is drawn at the component's icon size, but never above
 * `naturalSize / pixelRatio` CSS px - the size at which its file stays crisp
 * on a screen of that pixel ratio - and never above 56 CSS px, the largest
 * size the common icon hosts serve.
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
   * above `naturalSize / pixelRatio` CSS px. An icon for which that is not a
   * finite number of at least 1 is not drawn.
   */
  naturalSize: number;
  /**
   * The device pixel ratio the icon must stay crisp at: a CSS pixel there is
   * `pixelRatio` device pixels, so the icon is never drawn above
   * `naturalSize / pixelRatio` CSS px. Default 1 (a CSS pixel is an image
   * pixel). Set 2 to keep a 56 px file sharp on 2× screens: it is then drawn at
   * 28 CSS px at most. A number under 1, or not finite, counts as 1.
   */
  pixelRatio?: number;
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

/** The gap before a row's "+N", the count of the icons it has no room for, in px. */
export const ROW_ICON_MORE_GAP = 3;

/** The largest CSS size an icon stays crisp at: `naturalSize / pixelRatio` (a ratio under 1 counts as 1). */
function crispSize(icon: RowIcon): number {
  const ratio = icon.pixelRatio;
  return icon.naturalSize / (Number.isFinite(ratio) && ratio! > 1 ? ratio! : 1);
}

/**
 * A row's `icon` as a list of the icons that can be drawn: a single icon or
 * several, without those whose `src` is empty or whose
 * `naturalSize / pixelRatio` is not a finite number of at least 1 (an image
 * under one pixel draws nothing).
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
      Number.isFinite(crispSize(i)) &&
      crispSize(i) >= 1,
  );
}

/**
 * The size an icon is drawn at, in whole CSS px: the requested `size`, but
 * never above `naturalSize / pixelRatio` nor {@link ROW_ICON_MAX_PX}. Whole
 * pixels keep the edges crisp.
 *
 * Internal plumbing - not part of the public surface.
 */
export function rowIconSize(icon: RowIcon, size: number): number {
  return Math.max(0, Math.floor(Math.min(size, crispSize(icon), ROW_ICON_MAX_PX)));
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

/** A row's icons fitted to its room: the ones drawn, the ones left out, and the width taken. */
export interface FittedRowIcons {
  /** The leading icons that are drawn. */
  kept: RowIcon[];
  /** The icons left out, from the end. */
  dropped: RowIcon[];
  /** Whether a "+N" follows the kept icons (some are left out and it has room). */
  more: boolean;
  /** The width the kept icons and the "+N" take, gaps included. */
  width: number;
}

/**
 * Fit a row's icons into `maxWidth` side by side at `size`. When they do not
 * all fit, the ones from the end are left out and a "+N" - its width given by
 * `moreWidth(N)` - takes their place after a gap, inside the same room; with no
 * room even for the "+N" alone, nothing is drawn.
 *
 * Internal plumbing - not part of the public surface.
 */
export function fitRowIcons(
  icons: readonly RowIcon[],
  size: number,
  maxWidth: number,
  moreWidth: (dropped: number) => number,
): FittedRowIcons {
  const all = rowIconsWidth(icons, size);
  if (all <= maxWidth) return { kept: [...icons], dropped: [], more: false, width: all };
  for (let m = icons.length - 1; m >= 0; m--) {
    const kept = icons.slice(0, m);
    const width =
      rowIconsWidth(kept, size) + (m > 0 ? ROW_ICON_MORE_GAP : 0) + moreWidth(icons.length - m);
    if (width <= maxWidth) return { kept, dropped: icons.slice(m), more: true, width };
  }
  return { kept: [], dropped: [...icons], more: false, width: 0 };
}
