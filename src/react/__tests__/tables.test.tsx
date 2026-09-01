/** @vitest-environment jsdom */
/**
 * Table interaction contract: the three data tables (DataTable, StatementTable,
 * MatrixTable) must be operable with a keyboard, safe to embed in a `<form>`,
 * and correctly structured for assistive tech (column/row headers).
 *
 * These are regression tests for a batch of real defects: chevrons that
 * submitted their surrounding form, sorting and drill-down that only worked
 * with a mouse, and value cells without an accessible name.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { DataTable, MatrixTable, StatementTable } from "../index";
import type { DataTableColumn, DataTableRow } from "../../core/datatable";
import type { StatementLine } from "../../core/types";
import type { MatrixPeriod, MatrixRow, MatrixValues } from "../../core/matrixTable";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------- fixtures ------------------------------- */

const columns: DataTableColumn[] = [{ key: "revenue", label: "Revenue" }];
const rows: DataTableRow[] = [
  { id: "emea", label: "EMEA", values: { revenue: { AC: 120, PY: 100 } } },
  { id: "amer", label: "Americas", values: { revenue: { AC: 90, PY: 95 } } },
];

const groupedRows: DataTableRow[] = [
  {
    id: "emea",
    label: "EMEA",
    values: { revenue: { AC: 120, PY: 100 } },
    children: [{ id: "de", label: "Germany", values: { revenue: { AC: 70, PY: 60 } } }],
  },
];

const statementLines: StatementLine[] = [
  {
    id: "rev",
    label: "Revenue",
    flow: "add",
    values: { AC: 500, PY: 460 },
    children: [{ id: "svc", label: "Services", flow: "add", values: { AC: 200, PY: 180 } }],
  },
];

const matrixRows: MatrixRow[] = [
  { id: "rev", label: "Revenue" },
  { id: "cost", label: "Cost", flow: "subtract" },
];
const matrixColumns: MatrixPeriod[] = [{ id: "y24", label: "2024" }];
const matrixValues: MatrixValues = {
  rev: { y24: { AC: 120 } },
  cost: { y24: { AC: 70 } },
};

/* -------------------------------- helpers -------------------------------- */

/**
 * Activate an element the way a browser would for a key press. jsdom dispatches
 * the `keydown` faithfully but implements none of the *default actions* - so
 * Enter/Space on a focused `<button>` never turns into the click a real browser
 * synthesizes. The helper spells that out, and only for real buttons: a control
 * that is a `<div onClick>` or a `<th onClick>` gets nothing, exactly as a
 * keyboard user would. Tests assert the tag/`type` separately, so "it is a
 * button" is proven rather than assumed.
 */
function pressKey(el: HTMLElement, key: string): boolean {
  el.focus();
  const notPrevented = fireEvent.keyDown(el, { key });
  const isButton = el.tagName === "BUTTON";
  if (notPrevented && isButton && (key === "Enter" || key === " ")) fireEvent.click(el);
  return notPrevented;
}

/** Every `<button>` currently in the document. */
const allButtons = () => Array.from(document.querySelectorAll("button"));

/* --------------------------------- tests --------------------------------- */

describe("DataTable sorting", () => {
  it("cycles descending → ascending → unsorted from the keyboard", () => {
    render(<DataTable columns={columns} rows={rows} />);

    const trigger = screen.getByRole("button", { name: /Revenue/ });
    const header = trigger.closest("th")!;
    expect(trigger.getAttribute("type")).toBe("button");
    expect(header.hasAttribute("aria-sort")).toBe(false);

    pressKey(trigger, "Enter");
    expect(header.getAttribute("aria-sort")).toBe("descending");

    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter");
    expect(header.getAttribute("aria-sort")).toBe("ascending");

    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter");
    expect(header.hasAttribute("aria-sort")).toBe(false);
  });

  it("re-orders the rows, not just the aria-sort state", () => {
    render(<DataTable columns={columns} rows={rows} />);

    const labels = () =>
      Array.from(document.querySelectorAll("tbody th[scope='row']")).map((th) => th.textContent);
    expect(labels()).toEqual(["EMEA", "Americas"]);

    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter"); // desc
    expect(labels()).toEqual(["EMEA", "Americas"]);
    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter"); // asc
    expect(labels()).toEqual(["Americas", "EMEA"]);
  });

  it("does not sort from a click on the header cell itself", () => {
    render(<DataTable columns={columns} rows={rows} />);

    const header = screen.getByRole("button", { name: /Revenue/ }).closest("th")!;
    fireEvent.click(header);
    expect(header.hasAttribute("aria-sort")).toBe(false);
  });
});

describe("form safety", () => {
  it("gives every table button an explicit type='button'", () => {
    render(
      <>
        <DataTable columns={columns} rows={groupedRows} />
        <StatementTable lines={statementLines} expandControls animate={false} />
        <MatrixTable
          rows={[{ id: "rev", label: "Revenue", children: [{ id: "svc", label: "Services" }] }]}
          columns={[{ id: "y24", label: "2024", children: [{ id: "q1", label: "Q1" }] }]}
          values={{ rev: { y24: { AC: 120 } }, svc: { y24: { AC: 40 } } }}
          scenarios={["AC"]}
          columnExpandControls
        />
      </>,
    );

    const buttons = allButtons();
    expect(buttons.length).toBeGreaterThan(4);
    for (const b of buttons) expect(b.getAttribute("type")).toBe("button");
  });

  it("does not submit the surrounding form when a StatementTable row is toggled", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <StatementTable lines={statementLines} animate={false} />
        <button id="control">Save</button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Services")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();

    // Control: a button WITHOUT type='button' in the same form does submit -
    // proving the assertion above is not vacuous in this environment.
    fireEvent.click(document.getElementById("control")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("MatrixTable cells", () => {
  it("activates a clickable cell with Enter and Space", () => {
    const onCellClick = vi.fn();
    render(
      <MatrixTable
        rows={matrixRows}
        columns={matrixColumns}
        values={matrixValues}
        scenarios={["AC"]}
        onCellClick={onCellClick}
      />,
    );

    const cell = screen.getByRole("button", { name: /^Revenue, 2024, AC:/ });
    expect(cell.tagName).toBe("TD");
    expect(cell.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(cell, { key: "Enter" });
    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ rowId: "rev", periodId: "y24", scenario: "AC", value: 120 }),
    );

    // Space activates too, and its default (page scroll) is suppressed.
    const notPrevented = fireEvent.keyDown(cell, { key: " " });
    expect(notPrevented).toBe(false);
    expect(onCellClick).toHaveBeenCalledTimes(2);

    // An unrelated key does nothing.
    fireEvent.keyDown(cell, { key: "a" });
    expect(onCellClick).toHaveBeenCalledTimes(2);
  });

  it("leaves cells inert when no click handler is supplied", () => {
    render(
      <MatrixTable
        rows={matrixRows}
        columns={matrixColumns}
        values={matrixValues}
        scenarios={["AC"]}
      />,
    );

    expect(document.querySelectorAll("td[role='button']").length).toBe(0);
    expect(document.querySelectorAll("td[tabindex]").length).toBe(0);
  });

  it("expands a period from the keyboard", () => {
    render(
      <MatrixTable
        rows={matrixRows}
        columns={[{ id: "y24", label: "2024", children: [{ id: "q1", label: "Q1" }] }]}
        values={{ rev: { y24: { AC: 120 }, q1: { AC: 30 } }, cost: { y24: { AC: 70 } } }}
        scenarios={["AC"]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Expand 2024" });
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Q1")).toBeNull();

    pressKey(toggle, "Enter");

    expect(screen.getByText("Q1")).toBeTruthy();
    const collapse = screen.getByRole("button", { name: "Collapse 2024" });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");

    pressKey(collapse, " ");
    expect(screen.queryByText("Q1")).toBeNull();
  });
});

describe("table semantics", () => {
  it("marks DataTable headers and row labels up as headers", () => {
    render(<DataTable columns={columns} rows={rows} />);

    const table = document.querySelector("table")!;
    const colHeaders = within(table).getAllByRole("columnheader");
    expect(colHeaders.length).toBeGreaterThan(0);
    for (const th of colHeaders) expect(th.getAttribute("scope")).toBe("col");

    const rowHeaders = Array.from(table.querySelectorAll("tbody th"));
    expect(rowHeaders.map((th) => th.textContent)).toEqual(["EMEA", "Americas"]);
    for (const th of rowHeaders) expect(th.getAttribute("scope")).toBe("row");
  });

  it("marks StatementTable headers and row labels up as headers", () => {
    render(<StatementTable lines={statementLines} animate={false} />);

    const table = document.querySelector("table")!;
    for (const th of Array.from(table.querySelectorAll("thead th"))) {
      expect(th.getAttribute("scope")).toBe("col");
    }
    const rowHeaders = Array.from(table.querySelectorAll("tbody th"));
    expect(rowHeaders.length).toBe(2);
    for (const th of rowHeaders) expect(th.getAttribute("scope")).toBe("row");
  });

  it("marks MatrixTable headers and row labels up as headers", () => {
    render(
      <MatrixTable
        rows={matrixRows}
        columns={matrixColumns}
        values={matrixValues}
        scenarios={["AC"]}
      />,
    );

    const table = document.querySelector("table")!;
    for (const th of Array.from(table.querySelectorAll("thead th"))) {
      expect(["col", "colgroup"]).toContain(th.getAttribute("scope"));
    }
    const rowHeaders = Array.from(table.querySelectorAll("tbody th"));
    expect(rowHeaders.map((th) => th.textContent?.replace(/[+−=]/g, ""))).toEqual([
      "Revenue",
      "Cost",
    ]);
    for (const th of rowHeaders) expect(th.getAttribute("scope")).toBe("row");
  });

  it("renders an optional caption for screen readers only", () => {
    render(<DataTable columns={columns} rows={rows} caption="Revenue by region" />);

    const caption = document.querySelector("caption")!;
    expect(caption.textContent).toBe("Revenue by region");
    // Visually hidden, but present in the accessibility tree.
    expect(caption.style.position).toBe("absolute");
    expect(caption.style.width).toBe("1px");
  });
});

/* --------------------------- controlled / uncontrolled --------------------------- */

describe("controlled tables", () => {
  it("StatementTable renders the `collapsed` prop and never its own state", () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = render(
      <StatementTable
        lines={statementLines}
        collapsed={["rev"]}
        onCollapsedChange={onCollapsedChange}
        expandControls
        animate={false}
      />,
    );

    // Seeded from the prop: the group is collapsed, its child hidden.
    expect(screen.queryByText("Services")).toBeNull();

    // The chevron reports the NEXT set - and changes nothing on its own, because
    // the parent (this test) has not applied it.
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(onCollapsedChange).toHaveBeenCalledTimes(1);
    expect(onCollapsedChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText("Services")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand" })).toBeTruthy();

    // The toolbar goes through the same write path, so it cannot drift either
    // - including its disabled state, which reads the controlled value.
    expect(screen.getByRole("button", { name: "Collapse all" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(onCollapsedChange).toHaveBeenCalledTimes(2);
    expect(onCollapsedChange).toHaveBeenLastCalledWith([]);

    // Applying the reported value is what actually toggles the row.
    rerender(
      <StatementTable
        lines={statementLines}
        collapsed={[]}
        onCollapsedChange={onCollapsedChange}
        expandControls
        animate={false}
      />,
    );
    expect(screen.getByText("Services")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(onCollapsedChange).toHaveBeenLastCalledWith(["rev"]);
    expect(screen.getByText("Services")).toBeTruthy();
  });

  it("DataTable sort still cycles uncontrolled, with onSortChange as an observer", () => {
    const onSortChange = vi.fn();
    render(<DataTable columns={columns} rows={rows} onSortChange={onSortChange} />);

    const header = screen.getByRole("button", { name: /Revenue/ }).closest("th")!;

    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter");
    expect(header.getAttribute("aria-sort")).toBe("descending");
    expect(onSortChange).toHaveBeenLastCalledWith({ key: "revenue", dir: "desc" });

    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter");
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(onSortChange).toHaveBeenLastCalledWith({ key: "revenue", dir: "asc" });

    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter");
    expect(header.hasAttribute("aria-sort")).toBe(false);
    expect(onSortChange).toHaveBeenLastCalledWith(null);
    expect(onSortChange).toHaveBeenCalledTimes(3);
  });

  it("DataTable renders the `sort` and `collapsed` props, not internal state", () => {
    const onSortChange = vi.fn();
    const labels = () =>
      Array.from(document.querySelectorAll("tbody th[scope='row']")).map((th) => th.textContent);

    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={rows}
        sort={{ key: "revenue", dir: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    expect(labels()).toEqual(["Americas", "EMEA"]);

    // Clicking reports desc→asc→... but the rendered order stays the prop's.
    pressKey(screen.getByRole("button", { name: /Revenue/ }), "Enter");
    expect(onSortChange).toHaveBeenLastCalledWith(null); // asc was active → third state
    expect(labels()).toEqual(["Americas", "EMEA"]);

    rerender(<DataTable columns={columns} rows={rows} sort={null} onSortChange={onSortChange} />);
    expect(labels()).toEqual(["EMEA", "Americas"]);

    // Collapsed groups behave the same way.
    const onCollapsedChange = vi.fn();
    cleanup();
    render(
      <DataTable
        columns={columns}
        rows={groupedRows}
        collapsed={["emea"]}
        onCollapsedChange={onCollapsedChange}
      />,
    );
    expect(screen.queryByText("Germany")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(onCollapsedChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText("Germany")).toBeNull();
  });

  it("MatrixTable renders the `expandedCols` prop when a period is expanded by keyboard", () => {
    const onExpandedColsChange = vi.fn();
    const cols: MatrixPeriod[] = [
      { id: "y24", label: "2024", children: [{ id: "q1", label: "Q1" }] },
    ];
    const vals: MatrixValues = {
      rev: { y24: { AC: 120 }, q1: { AC: 30 } },
      cost: { y24: { AC: 70 } },
    };

    const { rerender } = render(
      <MatrixTable
        rows={matrixRows}
        columns={cols}
        values={vals}
        scenarios={["AC"]}
        expandedCols={[]}
        onExpandedColsChange={onExpandedColsChange}
      />,
    );

    expect(screen.queryByText("Q1")).toBeNull();

    pressKey(screen.getByRole("button", { name: "Expand 2024" }), "Enter");
    expect(onExpandedColsChange).toHaveBeenLastCalledWith(["y24"]);
    // Still collapsed: the prop, not the click, decides what renders.
    expect(screen.queryByText("Q1")).toBeNull();

    rerender(
      <MatrixTable
        rows={matrixRows}
        columns={cols}
        values={vals}
        scenarios={["AC"]}
        expandedCols={["y24"]}
        onExpandedColsChange={onExpandedColsChange}
      />,
    );
    expect(screen.getByText("Q1")).toBeTruthy();
  });

  it("MatrixTable reports expanded ROW ids (the props' polarity), not collapsed ones", () => {
    const onExpandedRowsChange = vi.fn();
    render(
      <MatrixTable
        rows={[{ id: "rev", label: "Revenue", children: [{ id: "svc", label: "Services" }] }]}
        columns={matrixColumns}
        values={{ rev: { y24: { AC: 120 } }, svc: { y24: { AC: 40 } } }}
        scenarios={["AC"]}
        expandedRows={["rev"]}
        onExpandedRowsChange={onExpandedRowsChange}
      />,
    );

    expect(screen.getByText("Services")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse row" }));
    expect(onExpandedRowsChange).toHaveBeenLastCalledWith([]);
    // Controlled: the row stays open until the parent applies the new value.
    expect(screen.getByText("Services")).toBeTruthy();
  });
});

describe("uncontrolled seeds", () => {
  it("StatementTable seeds from defaultCollapsed and then owns the state", () => {
    render(<StatementTable lines={statementLines} defaultCollapsed={["rev"]} animate={false} />);

    expect(screen.queryByText("Services")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Services")).toBeTruthy();
  });

  it("DataTable seeds from defaultSort and defaultCollapsed", () => {
    render(
      <DataTable columns={columns} rows={rows} defaultSort={{ key: "revenue", dir: "asc" }} />,
    );

    const labels = () =>
      Array.from(document.querySelectorAll("tbody th[scope='row']")).map((th) => th.textContent);
    expect(labels()).toEqual(["Americas", "EMEA"]);
    expect(
      screen
        .getByRole("button", { name: /Revenue/ })
        .closest("th")!
        .getAttribute("aria-sort"),
    ).toBe("ascending");

    cleanup();
    render(<DataTable columns={columns} rows={groupedRows} defaultCollapsed={["emea"]} />);
    expect(screen.queryByText("Germany")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Germany")).toBeTruthy();
  });

  it("MatrixTable seeds from defaultExpandedCols / defaultExpandedRows", () => {
    render(
      <MatrixTable
        rows={[{ id: "rev", label: "Revenue", children: [{ id: "svc", label: "Services" }] }]}
        columns={[{ id: "y24", label: "2024", children: [{ id: "q1", label: "Q1" }] }]}
        values={{ rev: { y24: { AC: 120 }, q1: { AC: 30 } }, svc: { y24: { AC: 40 } } }}
        scenarios={["AC"]}
        defaultExpandedCols={["y24"]}
        defaultExpandedRows={[]}
      />,
    );

    // Period open on mount, row closed on mount - both straight from the seeds.
    expect(screen.getByText("Q1")).toBeTruthy();
    expect(screen.queryByText("Services")).toBeNull();

    // Still uncontrolled: the toggles work on their own.
    fireEvent.click(screen.getByRole("button", { name: "Expand row" }));
    expect(screen.getByText("Services")).toBeTruthy();
    pressKey(screen.getByRole("button", { name: "Collapse 2024" }), "Enter");
    expect(screen.queryByText("Q1")).toBeNull();
  });
});

describe("StatementTable virtualization", () => {
  it("coalesces a burst of scroll events into one update per frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const lines: StatementLine[] = Array.from({ length: 200 }, (_, i) => ({
      id: `l${i}`,
      label: `Line ${i}`,
      values: { AC: 100 + i, PY: 90 + i },
    }));
    render(<StatementTable lines={lines} maxHeight={200} animate={false} />);

    const scroller = document.querySelector("table")!.parentElement!;
    const before = frames.length;
    fireEvent.scroll(scroller, { target: { scrollTop: 200 } });
    fireEvent.scroll(scroller, { target: { scrollTop: 500 } });
    fireEvent.scroll(scroller, { target: { scrollTop: 800 } });
    // Three scroll events, one scheduled frame - and nothing re-rendered yet.
    expect(frames.length - before).toBe(1);
    expect(screen.getByText("Line 0")).toBeTruthy();

    act(() => {
      frames.slice(before).forEach((cb) => cb(0));
    });

    // The frame applies the LATEST offset (800px → row ~23), not the first.
    expect(screen.queryByText("Line 0")).toBeNull();
    expect(screen.getByText("Line 23")).toBeTruthy();
  });
});

describe("StatementTable tooltip UX", () => {
  it("Escape dismisses the row tooltip without moving the pointer", () => {
    render(<StatementTable lines={statementLines} animate={false} />);
    const row = screen.getByText("Revenue").closest("tr")!;

    fireEvent.pointerMove(row, { clientX: 40, clientY: 60, pointerType: "mouse" });
    expect(screen.getByText("Δ PY")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Δ PY")).toBeNull();

    // Moving again re-shows it (dismissal is not sticky).
    fireEvent.pointerMove(row, { clientX: 42, clientY: 62, pointerType: "mouse" });
    expect(screen.getByText("Δ PY")).toBeTruthy();
  });

  it("a touch tap shows a sticky tooltip; a tap elsewhere dismisses it", () => {
    render(<StatementTable lines={statementLines} animate={false} />);
    const row = screen.getByText("Revenue").closest("tr")!;

    fireEvent.pointerDown(row, { clientX: 40, clientY: 60, pointerType: "touch" });
    expect(screen.getByText("Δ PY")).toBeTruthy();

    // The tap's implicit pointer-leave must not dismiss it…
    fireEvent.pointerLeave(row, { pointerType: "touch" });
    expect(screen.getByText("Δ PY")).toBeTruthy();

    // …and a touch move is ignored (no hover on touch)…
    fireEvent.pointerMove(row, { clientX: 44, clientY: 64, pointerType: "touch" });
    expect(screen.getByText("Δ PY")).toBeTruthy();

    // …but a tap elsewhere does dismiss it.
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(screen.queryByText("Δ PY")).toBeNull();
  });
});
