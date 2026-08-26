/**
 * Export a rendered chart `<svg>` as a standalone SVG file or a rasterized PNG.
 *
 * Kept out of `core` because it touches the DOM (clone the live node, draw to a
 * canvas). Every entry point is SSR-safe: outside a browser the download
 * helpers are no-ops and `svgToPngBlob` rejects rather than throwing at import
 * time. Charts in this library paint with inline presentation attributes
 * (`fill`, `stroke`, …), so a deep clone of the node already carries its full
 * appearance — no computed-style inlining is required. The one thing CSS, not
 * attributes, supplies is the font, so the serializer pins `font-family` onto
 * the clone's root.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/** True only in a browser with a usable `document`. */
function hasDocument(): boolean {
  return typeof document !== "undefined";
}

/** The font charts render with, mirrored from the chart components' SVG style. */
const CHART_FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/**
 * Serialize a live chart `<svg>` into a standalone XML string.
 *
 * The node is deep-cloned (the live tree is never mutated), namespaces are
 * ensured so the markup stands alone in an `.svg` file or an `<img>`, and the
 * pixel `width`/`height` are pinned from the rendered size so rasterization has
 * an intrinsic size to work with. Returns `""` outside a browser.
 */
export function serializeSvg(svg: SVGSVGElement): string {
  if (!hasDocument() || typeof XMLSerializer === "undefined") return "";

  const clone = svg.cloneNode(true) as SVGSVGElement;

  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", XLINK_NS);

  // Pin an explicit pixel size from the rendered box so the file/image has an
  // intrinsic size even when the source sized itself via CSS rather than attrs.
  const { width, height } = svgPixelSize(svg);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  // Carry the font (supplied by CSS, not by presentation attributes) onto the
  // root so text renders with the intended typeface in standalone contexts.
  const existingFont = clone.style.fontFamily || svg.style.fontFamily;
  clone.style.fontFamily = existingFont || CHART_FONT_FAMILY;

  const xml = new XMLSerializer().serializeToString(clone);
  return xml.startsWith("<?xml")
    ? xml
    : `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${xml}`;
}

/** Rendered pixel size of an `<svg>`, falling back to its `viewBox` or attrs. */
function svgPixelSize(svg: SVGSVGElement): { width: number; height: number } {
  // `getBoundingClientRect` reflects the actual on-screen box (incl. CSS sizing).
  const rect = typeof svg.getBoundingClientRect === "function" ? svg.getBoundingClientRect() : null;
  let width = rect && rect.width ? rect.width : 0;
  let height = rect && rect.height ? rect.height : 0;

  if (!width || !height) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width && vb.height) {
      width = width || vb.width;
      height = height || vb.height;
    }
  }
  if (!width || !height) {
    width = width || Number(svg.getAttribute("width")) || 300;
    height = height || Number(svg.getAttribute("height")) || 150;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

/** Trigger a client-side download of a `Blob` as `filename`. No-op without a DOM. */
function downloadBlob(blob: Blob, filename: string): void {
  if (!hasDocument() || typeof URL?.createObjectURL !== "function") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next task, not synchronously: some engines abort a download
  // whose object URL disappears in the same tick as the click that started it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Serialize `svg` and download it as a standalone `.svg` file. No-op without a DOM. */
export function downloadSVG(svg: SVGSVGElement, filename = "chart.svg"): void {
  if (!hasDocument()) return;
  const xml = serializeSvg(svg);
  if (!xml) return;
  downloadBlob(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }), filename);
}

/**
 * Rasterize a chart `<svg>` to a PNG `Blob` at `scale`× the rendered size
 * (default 2× for crisp output on high-DPI displays).
 *
 * The serialized SVG is loaded into an `Image` via a UTF-8 data URL, drawn onto
 * an offscreen `<canvas>`, and encoded as PNG. `background` paints behind the
 * chart (default opaque white — PNGs have no document background, so without it
 * the transparent areas would show through wherever the chart is pasted); pass
 * `null` to keep the alpha channel transparent. Rejects outside a browser or if
 * image decoding / encoding fails.
 */
export function svgToPngBlob(
  svg: SVGSVGElement,
  scale = 2,
  background: string | null = "#ffffff",
): Promise<Blob> {
  if (!hasDocument() || typeof document.createElement !== "function") {
    return Promise.reject(new Error("svgToPngBlob requires a browser environment"));
  }

  const xml = serializeSvg(svg);
  if (!xml) return Promise.reject(new Error("Unable to serialize SVG"));

  const { width, height } = svgPixelSize(svg);
  const ratio = scale > 0 ? scale : 1;

  // Encode as a UTF-8 data URL (handles non-ASCII labels; avoids tainting the
  // canvas the way a blob: URL can in some browsers).
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas.toBlob produced no PNG"));
        }, "image/png");
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => reject(new Error("Failed to load SVG for rasterization"));
    img.src = dataUrl;
  });
}

/**
 * Rasterize `svg` to PNG and download it as `filename`. Resolves once the
 * download is triggered; no-op (resolves) outside a browser.
 */
export async function downloadPNG(
  svg: SVGSVGElement,
  filename = "chart.png",
  scale = 2,
  background: string | null = "#ffffff",
): Promise<void> {
  if (!hasDocument()) return;
  const blob = await svgToPngBlob(svg, scale, background);
  downloadBlob(blob, filename);
}
