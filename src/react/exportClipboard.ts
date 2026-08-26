/**
 * Copy a rendered chart `<svg>` to the system clipboard, or send it to the
 * printer.
 *
 * A companion to {@link ./exportImage} (download helpers): same DOM-only,
 * SSR-safe posture, and the same serialize-then-rasterize pipeline reused via
 * `serializeSvg`. Every entry point guards `navigator`/`window`/`document` and
 * feature-detects the async Clipboard API (`navigator.clipboard` /
 * `ClipboardItem`) before touching it, so importing or calling these on the
 * server is harmless: the copy helpers reject with a clear `Error`, and
 * `printSvg` is a no-op. Charts paint with inline presentation attributes, so a
 * serialized clone already carries its full appearance.
 */

import { serializeSvg, svgToPngBlob } from "./exportImage";

/** True only in a browser with a usable `document`. */
function hasDocument(): boolean {
  return typeof document !== "undefined";
}

/** True when the async Clipboard API can write rich items (images). */
export function canCopyImage(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

/** True when the async Clipboard API can write plain/markup text via items. */
function canWriteClipboardItems(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

/** True when the async Clipboard API can write plain text. */
function canWriteText(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";
}

/**
 * Copy a chart `<svg>` to the clipboard as text.
 *
 * Writes the serialized SVG markup as `text/plain` (so it can be pasted into a
 * code editor or `.svg` file). When the async Clipboard API supports rich
 * items, the same markup is additionally offered as `text/html`, letting
 * graphics-aware targets paste it as a vector image. Falls back to
 * `navigator.clipboard.writeText` when only plain-text writing is available.
 * Rejects outside a browser or when no Clipboard API is present.
 */
export async function copySvgToClipboard(svg: SVGSVGElement): Promise<void> {
  if (!hasDocument() || typeof navigator === "undefined") {
    throw new Error("copySvgToClipboard requires a browser environment");
  }

  const xml = serializeSvg(svg);
  if (!xml) throw new Error("Unable to serialize SVG");

  if (canWriteClipboardItems()) {
    const items: Record<string, Blob> = {
      "text/plain": new Blob([xml], { type: "text/plain" }),
    };
    // Offer the markup as HTML too so graphics-aware targets can paste vector.
    if (typeof ClipboardItem.supports !== "function" || ClipboardItem.supports("text/html")) {
      items["text/html"] = new Blob([xml], { type: "text/html" });
    }
    await navigator.clipboard.write([new ClipboardItem(items)]);
    return;
  }

  if (canWriteText()) {
    await navigator.clipboard.writeText(xml);
    return;
  }

  throw new Error("Clipboard API is unavailable in this environment");
}

/**
 * Rasterize a chart `<svg>` to PNG and copy it to the clipboard as an
 * `image/png` item, ready to paste into documents, slides, or chat.
 *
 * Uses the same canvas pipeline as `downloadPNG` via `svgToPngBlob`. `scale`
 * controls pixel density (default 2× for crisp output on high-DPI displays) and
 * `background` paints behind the chart (default opaque white; pass `null` to
 * keep transparency). Rejects outside a browser or when the async Clipboard API
 * cannot write images (see {@link canCopyImage}).
 *
 * The `ClipboardItem` is built *synchronously* from the pending rasterization
 * promise: WebKit ends the user-gesture window at the first `await`, so an
 * awaited blob would arrive too late and the write would fail with
 * `NotAllowedError`. Engines that reject a promise-valued item fall back to the
 * awaited form.
 */
export async function copyPngToClipboard(
  svg: SVGSVGElement,
  opts: { scale?: number; background?: string } = {},
): Promise<void> {
  if (!hasDocument() || typeof navigator === "undefined") {
    throw new Error("copyPngToClipboard requires a browser environment");
  }
  if (!canCopyImage()) {
    throw new Error(
      "Clipboard image write (navigator.clipboard.write + ClipboardItem) is unavailable",
    );
  }

  const png = svgToPngBlob(svg, opts.scale ?? 2, opts.background ?? "#ffffff");

  let item: ClipboardItem;
  try {
    // Still inside the click's gesture window — no `await` has happened yet.
    item = new ClipboardItem({ "image/png": png });
  } catch {
    item = new ClipboardItem({ "image/png": await png });
  }

  await navigator.clipboard.write([item]);
}

/**
 * Print a chart `<svg>` on its own page.
 *
 * Mounts a hidden, sandboxed `<iframe>` containing just the serialized SVG plus
 * a minimal print stylesheet (white background, fit-to-page sizing), calls the
 * frame's `print()`, then removes the frame once printing settles. Keeping the
 * job in an iframe (rather than `window.open`) avoids popup blockers and never
 * disturbs the host page. No-op outside a browser.
 */
export function printSvg(svg: SVGSVGElement, opts: { title?: string } = {}): void {
  if (!hasDocument() || typeof window === "undefined") return;

  const xml = serializeSvg(svg);
  if (!xml) return;

  const title = opts.title ?? "Chart";
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<style>` +
    `*{margin:0;padding:0;box-sizing:border-box}` +
    `html,body{background:#ffffff}` +
    `body{display:flex;align-items:center;justify-content:center;padding:8px}` +
    `svg{max-width:100%;max-height:100%;height:auto;width:auto}` +
    `@media print{@page{margin:8mm}body{padding:0}}` +
    `</style></head><body>${xml}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  // Clean up once the dialog has been dismissed (or after a safety timeout).
  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }
    // Remove the frame after the print dialog closes; the timeout is a fallback
    // for browsers that don't fire `afterprint` on the frame window.
    frameWindow.onafterprint = cleanup;
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      cleanup();
      return;
    }
    window.setTimeout(cleanup, 60000);
  };

  document.body.appendChild(iframe);

  // Write the document; `srcdoc` is the SSR-safe, blocker-free path.
  iframe.srcdoc = html;
}

/** Escape the characters that matter inside an HTML text/attribute context. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
