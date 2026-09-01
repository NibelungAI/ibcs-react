/** @vitest-environment jsdom */
/**
 * ExportMenu interaction tests: the popup has to be operable by keyboard
 * (open → focus in, arrows rove, Escape restores focus), dismiss itself when
 * focus or a pointer leaves it, and route every failing action to `onError`
 * rather than to an unhandled rejection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExportMenu, type ExportMenuProps } from "../ExportMenu";

const trigger = () => screen.getByRole("button", { name: "Export chart" });
const menuItems = () => screen.getAllByRole("menuitem") as HTMLButtonElement[];
const menuIsOpen = () => screen.queryByRole("menu") != null;

function renderMenu(props: Partial<ExportMenuProps> = {}) {
  return render(
    <div>
      <button type="button" data-testid="outside">
        outside
      </button>
      <ExportMenu filename="chart" csv="a,b" {...props}>
        <svg data-testid="chart" viewBox="0 0 100 50" width={100} height={50} />
      </ExportMenu>
    </div>,
  );
}

/** Open the popup the way a mouse user would, then hand back its items. */
function openMenu(): HTMLButtonElement[] {
  fireEvent.click(trigger());
  return menuItems();
}

/** Original descriptor so the object-URL stubs never leak between tests. */
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

function stubObjectUrls(createObjectURL: () => string) {
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  stubObjectUrls(vi.fn(() => "blob:mock"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalCreateObjectURL)
    Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
  else delete (URL as unknown as Record<string, unknown>).createObjectURL;
  if (originalRevokeObjectURL)
    Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
  else delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});

describe("ExportMenu keyboard and focus behaviour", () => {
  it("opens on click and moves focus onto the first menu item", () => {
    renderMenu();
    expect(menuIsOpen()).toBe(false);
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    const items = openMenu();
    expect(menuIsOpen()).toBe(true);
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(items.map((i) => i.textContent)).toEqual(["SVG", "PNG", "CSV", "Copy SVG", "Print"]);
    expect(items.every((i) => i.tabIndex === -1)).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it("opens from the keyboard with ArrowDown", () => {
    renderMenu();
    trigger().focus();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(menuIsOpen()).toBe(true);
    expect(document.activeElement).toBe(menuItems()[0]);
  });

  it("closes on Escape and returns focus to the trigger", () => {
    renderMenu();
    const items = openMenu();

    fireEvent.keyDown(items[0]!, { key: "Escape" });

    expect(menuIsOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  it("roves focus with the arrow keys, wrapping at both ends", () => {
    renderMenu();
    const items = openMenu();
    const last = items.length - 1;

    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(items[1]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);

    // Up from the first item wraps to the last; down from the last wraps back.
    fireEvent.keyDown(items[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[last]);

    fireEvent.keyDown(items[last]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(document.activeElement).toBe(items[last]);

    fireEvent.keyDown(items[last]!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("stays open while focus moves between items, closes when it leaves", () => {
    renderMenu();
    const items = openMenu();

    // Focus moving from one item to the next stays inside the control.
    fireEvent.focusOut(items[0]!, { relatedTarget: items[1]! });
    expect(menuIsOpen()).toBe(true);

    // …as does focus returning to the trigger.
    fireEvent.focusOut(items[1]!, { relatedTarget: trigger() });
    expect(menuIsOpen()).toBe(true);

    // Tabbing out to an unrelated control dismisses it.
    fireEvent.focusOut(items[0]!, { relatedTarget: screen.getByTestId("outside") });
    expect(menuIsOpen()).toBe(false);
  });

  it("closes on a pointer press outside, but not inside", () => {
    renderMenu();
    const items = openMenu();

    fireEvent.pointerDown(items[0]!);
    expect(menuIsOpen()).toBe(true);

    fireEvent.pointerDown(document.body);
    expect(menuIsOpen()).toBe(false);
  });

  it("closes, restores focus and defers URL revocation when an action is picked", async () => {
    // jsdom would log "navigation to another Document" for a real anchor click.
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderMenu();
    const items = openMenu();

    fireEvent.click(items[2]!); // CSV - a synchronous download that succeeds

    expect(menuIsOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger());
    expect(anchorClick).toHaveBeenCalledTimes(1);
    // Revoking in the same tick as the click aborts the download in some
    // engines, so it must be deferred to a later task.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});

/** The Node host, reached without `@types/node` (the package has no node types). */
type RejectionHost = {
  on(event: "unhandledRejection", listener: (reason: unknown) => void): void;
  off(event: "unhandledRejection", listener: (reason: unknown) => void): void;
};
const host = (globalThis as { process?: RejectionHost }).process;

describe("ExportMenu error handling", () => {
  /** Rejections that escaped to the host, collected per test. */
  const escaped: unknown[] = [];
  const onUnhandled = (reason: unknown) => escaped.push(reason);

  beforeEach(() => {
    escaped.length = 0;
    host?.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    host?.off("unhandledRejection", onUnhandled);
    delete (globalThis as unknown as Record<string, unknown>).ClipboardItem;
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  /** Let pending microtasks (and the unhandled-rejection check) settle. */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("reports a synchronous failure to onError instead of throwing", async () => {
    const boom = new Error("object URLs are blocked");
    stubObjectUrls(() => {
      throw boom;
    });
    const onError = vi.fn();
    renderMenu({ onError });

    const items = openMenu();
    fireEvent.click(items[2]!); // CSV

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(boom, "csv");
    await flush();
    expect(escaped).toEqual([]);
  });

  it("reports a rejected clipboard write to onError, with no unhandled rejection", async () => {
    const denied = new Error("NotAllowedError");
    const write = vi.fn(() => Promise.reject(denied));
    Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });
    (globalThis as unknown as Record<string, unknown>).ClipboardItem = class {
      constructor(public items: Record<string, unknown>) {}
    };

    const onError = vi.fn();
    renderMenu({ onError });

    const items = openMenu();
    const copySvg = items.find((i) => i.textContent === "Copy SVG");
    expect(copySvg).toBeTruthy();
    fireEvent.click(copySvg as HTMLButtonElement);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(denied, "copy-svg");
    await flush();
    expect(escaped).toEqual([]);
  });

  it("falls back to console.error when no onError is supplied", async () => {
    const boom = new Error("object URLs are blocked");
    stubObjectUrls(() => {
      throw boom;
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderMenu();

    const items = openMenu();
    fireEvent.click(items[0]!); // SVG

    expect(spy).toHaveBeenCalledWith("[ibcs-react] export failed:", "svg", boom);
    await flush();
    expect(escaped).toEqual([]);
  });
});
