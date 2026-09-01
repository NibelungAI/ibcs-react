/**
 * Escape / outside-tap dismissal for hover- and tap-triggered tooltips.
 *
 * WCAG 1.4.13 requires content that appears on hover/focus to be dismissible
 * without moving the pointer or focus - that is the Escape listener. The
 * capture-phase pointerdown listener dismisses a tap-anchored (touch) tooltip
 * when the user taps anywhere else; capture runs before the next mark's own
 * tap handler, so tapping another mark dismisses the old tooltip and shows
 * the new one in the same gesture.
 *
 * Listeners exist only while a tooltip is showing. SSR-safe (effect-only).
 *
 * Internal module: not part of the public API surface.
 */

import { useEffect } from "react";

export function useHoverDismissal(active: boolean, dismiss: () => void): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    const onPointerDown = (event: Event) => {
      // Mouse users dismiss by moving/leaving; only a tap dismisses here, so
      // clicking a mark (to select it) never blinks the hover tooltip.
      if ((event as globalThis.PointerEvent).pointerType === "touch") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [active, dismiss]);
}
