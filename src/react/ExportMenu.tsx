/* oxlint-disable react/refs -- the export actions are closures that read the
   container ref when INVOKED (interaction time, which React sanctions); oxc's
   compiler-derived dataflow flags them at the point the `actions` array is
   rendered, a known false-positive pattern. Refs are never read during render
   here - `hasSvg` is probed in `setMenuOpen`, an event handler. */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { IbcsTokensOverride } from "../core/tokens";
import { useIbcsTokens } from "./theme";
import { downloadTextFile } from "./download";
import { downloadPNG, downloadSVG } from "./exportImage";
import { canCopyImage, copyPngToClipboard, copySvgToClipboard, printSvg } from "./exportClipboard";

/**
 * The menu entry an export attempt came from, handed to {@link ExportMenuProps.onError}
 * so a host can tailor its message ("clipboard blocked", "PNG export failed", …).
 */
export type ExportMenuAction = "svg" | "png" | "csv" | "json" | "copy-svg" | "copy-png" | "print";

export interface ExportMenuProps {
  /**
   * Base filename (without extension) for downloads. Each action appends its
   * own extension, e.g. `"revenue"` → `revenue.svg`, `revenue.png`, … Default
   * `"chart"`.
   */
  filename?: string;
  /** Pixel scale for the PNG export (higher = crisper, larger). Default 2. */
  pngScale?: number;
  /** Structured data to offer as a JSON download. Omit to hide the JSON action. */
  data?: unknown;
  /** Pre-built CSV text to offer as a CSV download. Omit to hide the CSV action. */
  csv?: string;
  /** Token overrides, so the control matches the chart's palette. */
  tokens?: IbcsTokensOverride;
  /**
   * Called when an export action fails - rasterization errors, denied clipboard
   * permissions, blocked downloads. Without a handler the failure is logged to
   * the console; either way it never escapes as an unhandled rejection.
   */
  onError?: (error: unknown, action: ExportMenuAction) => void;
  /** The chart (or anything containing a single `<svg>`) to wrap and export. */
  children: ReactNode;
}

/** Is `value` a thenable? Async actions are awaited for errors, sync ones are not. */
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null | undefined)?.then === "function";
}

/**
 * Wraps a chart and exposes a compact, IBCS-clean toolbar for downloading it.
 *
 * Image actions ("SVG" / "PNG") operate on the first `<svg>` found inside the
 * wrapped children; if none is present they are disabled. Data actions appear
 * only when their source prop is supplied: "CSV" when `csv` is given, "JSON"
 * when `data` is given. All DOM work happens inside the click handlers, so the
 * component is safe to render during SSR.
 *
 * The popup is a real menu: opening moves focus onto the first item, `ArrowUp`/
 * `ArrowDown` rove (wrapping) through the items, `Home`/`End` jump to the ends,
 * `Escape` closes and hands focus back to the trigger, and focus leaving the
 * control - or a pointer press outside it - dismisses it. Every action is
 * error-guarded: failures reach {@link ExportMenuProps.onError} (or the console)
 * instead of becoming unhandled rejections.
 */
export function ExportMenu({
  filename = "chart",
  pngScale = 2,
  data,
  csv,
  tokens: tokenOverride,
  onError,
  children,
}: ExportMenuProps) {
  const tokens = useIbcsTokens(tokenOverride);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Whether an exportable <svg> exists under the container. Detected at
  // interaction time (event handlers may read the DOM; render must not), so
  // the item disabled states are right the moment the menu opens while render
  // stays SSR-safe and idempotent.
  const [hasSvg, setHasSvg] = useState(true);
  const menuId = useId();
  const triggerId = `${menuId}-trigger`;

  const findSvg = useCallback((): SVGSVGElement | null => {
    return containerRef.current?.querySelector("svg") ?? null;
  }, []);

  /** Open/close the menu, probing for the exportable SVG on the way open. */
  const setMenuOpen = useCallback(
    (next: boolean) => {
      if (next) setHasSvg(findSvg() != null);
      setOpen(next);
    },
    [findSvg],
  );

  /** Focusable (i.e. enabled) menu items, in DOM order. */
  const menuItems = useCallback((): HTMLButtonElement[] => {
    const nodes = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [];
    return Array.from(nodes).filter((node) => !node.disabled);
  }, []);

  /**
   * Close the popup. `restoreFocus` hands focus back to the trigger - right for
   * keyboard dismissal and for activating an item, wrong when the user clicked
   * or tabbed somewhere else entirely.
   */
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /** Run an export action, closing the menu first and funnelling every failure to `onError`. */
  const runAction = useCallback(
    (action: ExportMenuAction, run: () => unknown) => {
      const report = (error: unknown) => {
        if (onError) onError(error, action);
        else console.error("[ibcs-react] export failed:", action, error);
      };
      close(true);
      try {
        const result = run();
        if (isPromiseLike(result)) Promise.resolve(result).catch(report);
      } catch (error) {
        report(error);
      }
    },
    [close, onError],
  );

  const onSvg = useCallback(() => {
    runAction("svg", () => {
      const svg = findSvg();
      if (svg) downloadSVG(svg, `${filename}.svg`);
    });
  }, [findSvg, filename, runAction]);

  const onPng = useCallback(() => {
    runAction("png", () => {
      const svg = findSvg();
      return svg ? downloadPNG(svg, `${filename}.png`, pngScale) : undefined;
    });
  }, [findSvg, filename, pngScale, runAction]);

  const onCsv = useCallback(() => {
    runAction("csv", () => {
      if (csv != null) downloadTextFile(`${filename}.csv`, csv, "text/csv;charset=utf-8");
    });
  }, [csv, filename, runAction]);

  const onJson = useCallback(() => {
    runAction("json", () => {
      if (data !== undefined) {
        downloadTextFile(
          `${filename}.json`,
          JSON.stringify(data, null, 2),
          "application/json;charset=utf-8",
        );
      }
    });
  }, [data, filename, runAction]);

  const onCopyPng = useCallback(() => {
    runAction("copy-png", () => {
      const svg = findSvg();
      return svg ? copyPngToClipboard(svg, { scale: pngScale }) : undefined;
    });
  }, [findSvg, pngScale, runAction]);

  const onCopySvg = useCallback(() => {
    runAction("copy-svg", () => {
      const svg = findSvg();
      return svg ? copySvgToClipboard(svg) : undefined;
    });
  }, [findSvg, runAction]);

  const onPrint = useCallback(() => {
    runAction("print", () => {
      const svg = findSvg();
      if (svg) printSvg(svg, { title: filename });
    });
  }, [findSvg, filename, runAction]);

  // Move focus into the menu as it opens, so the keyboard never lands in a dead
  // end (`role="menu"` promises arrow-key navigation - this is where it starts).
  useEffect(() => {
    if (!open) return;
    menuItems()[0]?.focus();
  }, [open, menuItems]);

  // Outside-click dismissal. `blur` alone is not enough: several engines report
  // `relatedTarget: null` when focus moves to a non-focusable region, and a
  // pointer press on the page body may not move focus at all.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const onPointerDown = (event: Event) => {
      const toolbar = toolbarRef.current;
      const target = event.target;
      if (toolbar && target instanceof Node && toolbar.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  /** Roving focus: `index` wraps around both ends of the item list. */
  const focusItemAt = useCallback(
    (index: number) => {
      const items = menuItems();
      if (items.length === 0) return;
      const wrapped = ((index % items.length) + items.length) % items.length;
      items[wrapped]?.focus();
    },
    [menuItems],
  );

  const moveFocus = useCallback(
    (delta: number) => {
      const items = menuItems();
      if (items.length === 0) return;
      const active = typeof document !== "undefined" ? document.activeElement : null;
      const current = items.indexOf(active as HTMLButtonElement);
      focusItemAt(current < 0 ? (delta > 0 ? 0 : items.length - 1) : current + delta);
    },
    [focusItemAt, menuItems],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      // Standard menu-button affordance: ArrowDown/ArrowUp open the popup.
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setMenuOpen(true);
      }
      return;
    }
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        event.preventDefault();
        focusItemAt(0);
        break;
      case "End":
        event.preventDefault();
        focusItemAt(-1);
        break;
      default:
        break;
    }
    // Enter/Space are left to the native <button> behaviour of the items.
  };

  // Dismiss when focus leaves the control entirely (tabbing out, clicking the
  // page). Focus moving *between* the trigger and the items stays inside.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!open) return;
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setOpen(false);
  };

  const actions: Array<{ key: string; label: string; onClick: () => void; disabled?: boolean }> = [
    { key: "svg", label: "SVG", onClick: onSvg, disabled: !hasSvg },
    { key: "png", label: "PNG", onClick: onPng, disabled: !hasSvg },
  ];
  if (csv != null) actions.push({ key: "csv", label: "CSV", onClick: onCsv });
  if (data !== undefined) actions.push({ key: "json", label: "JSON", onClick: onJson });
  // Clipboard image copy only when the browser supports it; text copy and print
  // work wherever a DOM is present, so they're gated on `hasSvg` alone.
  if (canCopyImage())
    actions.push({ key: "copy-png", label: "Copy PNG", onClick: onCopyPng, disabled: !hasSvg });
  actions.push({ key: "copy-svg", label: "Copy SVG", onClick: onCopySvg, disabled: !hasSvg });
  actions.push({ key: "print", label: "Print", onClick: onPrint, disabled: !hasSvg });

  const itemStyle = (disabled?: boolean): CSSProperties => ({
    appearance: "none",
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "6px 12px",
    fontFamily: tokens.font.family,
    fontSize: 12,
    lineHeight: 1.4,
    color: disabled ? tokens.color.textMuted : tokens.color.text,
    background: "transparent",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  });

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div
        ref={toolbarRef}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          zIndex: 1,
        }}
      >
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label="Export chart"
          title="Export"
          onClick={() => setMenuOpen(!open)}
          style={{
            appearance: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            padding: 0,
            fontFamily: tokens.font.family,
            fontSize: 13,
            lineHeight: 1,
            color: tokens.color.textMuted,
            background: tokens.color.surface,
            border: `1px solid ${tokens.color.rowBorder}`,
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {"⤓"}
        </button>

        {open && (
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby={triggerId}
            style={{
              position: "absolute",
              top: 26,
              right: 0,
              minWidth: 96,
              padding: "4px 0",
              background: tokens.color.surface,
              border: `1px solid ${tokens.color.rowBorder}`,
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
            // Keep the press from yanking focus out of the menu (which would
            // dismiss it) before the item's click handler runs.
            onMouseDown={(e) => e.preventDefault()}
          >
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={a.disabled}
                onClick={a.onClick}
                style={itemStyle(a.disabled)}
                onMouseEnter={(e) => {
                  if (!a.disabled) e.currentTarget.style.background = tokens.color.gridline;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef}>{children}</div>
    </div>
  );
}
