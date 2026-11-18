/** @vitest-environment jsdom */
/**
 * The icon slot in row labels (`DataTable`, `RankingVarianceChart`): an image
 * or the caller's element per row, drawn at the component's icon size but
 * never above `naturalSize / pixelRatio` or 56 CSS px; the label keeps naming
 * the row, rows without an icon keep the labels aligned, chips without room
 * are counted, and without icons nothing in the markup changes (the markup
 * snapshots hold the fixtures' 1.5 output, byte for byte).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { cloneElement, type ReactElement } from "react";

import {
  DataTable,
  RankingVarianceChart,
  defaultTokens,
  type DataTableColumn,
  type DataTableRow,
  type RankingDatum,
  type RankingVarianceChartProps,
  type RowIcon,
} from "../../index";
import { estTextW } from "../internal/text";
import { featureCases } from "./fixtures";

afterEach(cleanup);

const ssr = (element: ReactElement): HTMLElement =>
  new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html").body;
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

const big = (src = "big.png", extra: Partial<RowIcon> = {}): RowIcon => ({
  src,
  naturalSize: 56,
  ...extra,
});
const small: RowIcon = { src: "small.png", naturalSize: 18 };

/* -------------------------------- DataTable -------------------------------- */

const columns: DataTableColumn[] = [{ key: "dps", label: "DPS" }];
const rows: DataTableRow[] = [
  { id: "shoot", label: "Shoot", icon: big("shoot.png"), values: { dps: 215 } },
  { id: "trap", label: "Immolation Trap", icon: small, values: { dps: 31.5 } },
  { id: "melee", label: "Melee", values: { dps: 20 } },
];

/** The label cell's inner span (chevron spacer, flow marker, icon slot, label). */
const labelParts = (th: Element) => [...th.querySelector("span")!.children] as HTMLElement[];

describe("DataTable - icons in row labels", () => {
  it("adds nothing to the markup when no row has an icon and no renderIcon is given", () => {
    const plain: DataTableRow[] = rows.map(({ icon: _icon, ...r }) => r);
    const before = renderToStaticMarkup(<DataTable columns={columns} rows={plain} showTotals />);
    // The new props alone change nothing: no slot without an icon to put in it.
    expect(
      renderToStaticMarkup(
        <DataTable
          columns={columns}
          rows={plain.map((r) => ({ ...r, icon: undefined }))}
          showTotals
          iconSize={24}
        />,
      ),
    ).toBe(before);
    expect(before).not.toContain("<img");
  });

  it("draws each icon at the icon size, never above its own size", () => {
    const body = ssr(<DataTable columns={columns} rows={rows} />);
    const imgs = [...body.querySelectorAll("img")];
    expect(imgs.map((i) => [i.getAttribute("src"), num(i, "width"), num(i, "height")])).toEqual([
      ["shoot.png", 20, 20],
      ["small.png", 18, 18],
    ]);
    for (const [iconSize, want] of [
      [24, [24, 18]],
      [40, [28, 18]], // at most 28: the row is 34px tall
      [4, [8, 8]], // at least 8
      [Number.NaN, [20, 18]],
    ] as const) {
      const sized = ssr(<DataTable columns={columns} rows={rows} iconSize={iconSize} />);
      expect([...sized.querySelectorAll("img")].map((i) => num(i, "width"))).toEqual(want);
    }
  });

  it("frames an icon with an outline over its edge, so the bitmap keeps the full box size", () => {
    const body = ssr(
      <DataTable
        columns={columns}
        rows={[
          {
            id: "r",
            label: "Ring",
            icon: big("ring.png", { border: "#a335ee" }),
            values: { dps: 1 },
          },
        ]}
      />,
    );
    const img = body.querySelector("img")!;
    // An outline drawn 1 px inside the edge, as the svg frame is: no border
    // box shrinks the image, so a 20 px icon is drawn on 20 × 20 pixels.
    expect(img.getAttribute("style")).toContain("outline:1px solid #a335ee;outline-offset:-1px");
    expect(img.style.border).toBe("");
    expect(img.style.boxSizing).toBe("");
    expect([num(img, "width"), num(img, "height")]).toEqual([20, 20]);
    expect(img.style.objectFit).toBe("contain");
    expect(
      ssr(<DataTable columns={columns} rows={rows} />)
        .querySelector("img")!
        .getAttribute("style"),
    ).not.toContain("outline");
  });

  it("keeps the label the row's name: icons are decorative unless they carry an alt", () => {
    render(
      <DataTable
        columns={columns}
        rows={[
          ...rows,
          {
            id: "best",
            label: "Best set",
            icon: [
              big("a.png", { alt: "Signet of Embers" }),
              big("b.png", { alt: "Runed Greatsword" }),
            ],
            values: { dps: 914 },
          },
        ]}
      />,
    );
    expect(screen.getByRole("rowheader", { name: "Shoot" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "Melee" })).toBeTruthy();
    expect(screen.getAllByRole("img", { hidden: false }).map((i) => i.getAttribute("alt"))).toEqual(
      ["Signet of Embers", "Runed Greatsword"],
    );
    // The alts and the label are read apart: a hidden ", " follows each alt.
    // (The images are blocks, so the name algorithm also puts spaces around
    // their alts; a screen reader pauses at the commas.)
    expect(
      screen.getByRole("rowheader", { name: "Signet of Embers , Runed Greatsword , Best set" }),
    ).toBeTruthy();
    // Decorative icons are left out of the accessibility tree by their empty alt.
    for (const img of document.querySelectorAll("img[src$='shoot.png'], img[src$='small.png']")) {
      expect(img.getAttribute("alt")).toBe("");
    }
  });

  it("keeps the labels aligned: one slot width on every row, the totals row and icon-less rows included", () => {
    const body = ssr(
      <DataTable
        columns={columns}
        rows={[...rows, { id: "two", label: "Two", icon: [big(), big()], values: { dps: 1 } }]}
        showTotals
      />,
    );
    const slots = [...body.querySelectorAll("tbody th")].map((th) => labelParts(th)[1]!);
    // Widest row: two 20px icons and a 2px gap.
    expect(slots.map((s) => s.style.width)).toEqual(new Array(5).fill("42px"));
    expect(slots.every((s) => s.style.marginRight === "6px" && s.style.flex === "0 0 auto")).toBe(
      true,
    );
    expect(slots[2]!.children).toHaveLength(0); // Melee: an empty slot
    expect(slots[4]!.children).toHaveLength(0); // the totals row
    // A row's icons side by side in one flex box, 2px apart.
    const group = slots[3]!.firstElementChild as HTMLElement;
    expect([group.style.display, group.style.gap, group.children.length]).toEqual([
      "flex",
      "2px",
      2,
    ]);
  });

  it("colours a label with its labelColor, and leaves the others in the theme's colours", () => {
    const body = ssr(
      <DataTable
        columns={columns}
        rows={[
          { id: "a", label: "Signet", labelColor: "#a335ee", values: { dps: 1 } },
          {
            id: "g",
            label: "Group",
            values: {},
            children: [{ id: "c", label: "Child", values: { dps: 2 } }],
          },
        ]}
      />,
    );
    const label = (s: string) => body.querySelector(`span[title='${s}']`) as HTMLElement;
    expect(label("Signet").style.color).toBe("rgb(163, 53, 238)");
    expect(label("Group").style.color).toBe("rgb(43, 43, 41)"); // color.text
    expect(label("Child").style.color).toBe("rgb(107, 106, 100)"); // color.textMuted (nested)
  });

  it("puts the caller's element in the slot, and falls back to the row's icon when it returns null", () => {
    const renderIcon = vi.fn((row: DataTableRow, size: number, _icon: unknown) =>
      row.id === "melee" ? null : (
        <button type="button" aria-label={`About ${row.label}`} style={{ width: size }} />
      ),
    );
    render(
      <DataTable columns={columns} rows={rows} renderIcon={renderIcon} showTotals iconSize={24} />,
    );
    // Called for every row but the totals row, with the row, the icon size and
    // the row's own icons (null for a row without).
    expect(renderIcon.mock.calls.map(([r, s, icon]) => [r.id, s, icon != null])).toEqual([
      ["shoot", 24, true],
      ["trap", 24, true],
      ["melee", 24, false],
    ]);
    const button = screen.getByRole("button", { name: "About Shoot" });
    const slot = button.parentElement!;
    expect(slot.style.minWidth).toBe("24px");
    expect(slot.style.height).toBe("24px");
    // Melee returned null and has no icon: an empty slot of the same width.
    const melee = screen.getByRole("rowheader", { name: "Melee" });
    expect(labelParts(melee)[1]!.style.width).toBe("24px");
    expect(within(melee).queryByRole("img")).toBeNull();
  });

  it("hands renderIcon the row's own icons, to wrap in a trigger without redrawing them", () => {
    const body = ssr(
      <DataTable
        columns={columns}
        rows={[
          ...rows,
          {
            id: "two",
            label: "Two",
            icon: [big("a.png", { border: "#a335ee", alt: "Ring" }), small],
            values: { dps: 1 },
          },
        ]}
        renderIcon={(row, _size, icon) => icon && <span data-tip={row.id}>{icon}</span>}
      />,
    );
    const tips = [...body.querySelectorAll("[data-tip]")];
    expect(tips.map((t) => t.getAttribute("data-tip"))).toEqual(["shoot", "trap", "two"]);
    // The icons as the table draws them - sized, framed, named - side by side
    // in one flex box, so the wrapper does not stack them.
    const group = tips[2]!.firstElementChild as HTMLElement;
    expect([group.style.display, group.style.gap]).toEqual(["flex", "2px"]);
    const imgs = [...group.querySelectorAll("img")];
    expect(
      imgs.map((i) => [i.getAttribute("src"), num(i, "width"), i.getAttribute("alt")]),
    ).toEqual([
      ["a.png", 20, "Ring"],
      ["small.png", 18, ""],
    ]);
    expect(imgs[0]!.getAttribute("style")).toContain("outline:1px solid #a335ee");
    // Melee has no icon: renderIcon gets null and returns it, so the slot stays empty.
    const melee = body.querySelectorAll("tbody th")[2]!;
    expect(melee.textContent).toBe("Melee");
    expect(melee.querySelector("img, [data-tip]")).toBeNull();
  });

  it("does not shrink the slot when the label is cut to maxLabelWidth", () => {
    const body = ssr(<DataTable columns={columns} rows={rows} maxLabelWidth={80} />);
    const parts = labelParts(body.querySelector("tbody th")!);
    expect(parts[1]!.style.flex).toBe("0 0 auto");
    expect(parts[2]!.style.textOverflow).toBe("ellipsis");
  });

  it("draws no icon that cannot be drawn: an empty src, or a natural size under 1", () => {
    const body = ssr(
      <DataTable
        columns={columns}
        rows={[
          { id: "a", label: "A", icon: { src: "", naturalSize: 56 }, values: { dps: 1 } },
          { id: "b", label: "B", icon: { src: "b.png", naturalSize: 0 }, values: { dps: 1 } },
        ]}
      />,
    );
    expect(body.querySelector("img")).toBeNull();
    // Nothing to draw anywhere: no slot either.
    expect(labelParts(body.querySelector("tbody th")!)).toHaveLength(2);
  });
});

describe("icons on dense screens: pixelRatio", () => {
  it("draws an icon no larger than naturalSize / pixelRatio, in both components", () => {
    const tableWidth = (icon: RowIcon) =>
      num(
        ssr(
          <DataTable
            columns={columns}
            rows={[{ id: "r", label: "R", icon, values: { dps: 1 } }]}
            iconSize={28}
          />,
        ).querySelector("img")!,
        "width",
      );
    expect(tableWidth({ src: "r.png", naturalSize: 36 })).toBe(28);
    expect(tableWidth({ src: "r.png", naturalSize: 36, pixelRatio: 2 })).toBe(18);
    const chartWidth = (icon: RowIcon) =>
      num(
        ssr(
          <RankingVarianceChart
            data={[{ label: "R", AC: 2, base: 1, icon }]}
            rowHeight={40}
            iconSize={36}
          />,
        ).querySelector("image")!,
        "width",
      );
    expect(chartWidth({ src: "r.png", naturalSize: 56 })).toBe(36);
    expect(chartWidth({ src: "r.png", naturalSize: 56, pixelRatio: 2 })).toBe(28);
  });
});

/* ---------------------------- RankingVarianceChart ---------------------------- */

const ranking: RankingDatum[] = [
  {
    label: "Best set",
    AC: 914.3,
    base: 910.84,
    icon: [
      big("ring.png", { border: "#a335ee", alt: "Signet of Embers" }),
      big("sword.png", { alt: "Runed Greatsword" }),
    ],
  },
  {
    label: "Signet of Embers",
    labelColor: "#a335ee",
    AC: 914.05,
    base: 910.84,
    icon: big("ring.png"),
  },
  { label: "Equipped", AC: 910.84, base: 910.84 },
  { label: "Runed Greatsword", AC: 906.25, base: 910.84, icon: small },
];

/**
 * The ranking chart's panels, from its headers: the AC panel's start and the
 * three panels' widths, split 44 / 30 / 26 as 1.5 splits them, with 10px gaps.
 */
function panelsOf(svg: Element) {
  const heads = [...svg.querySelectorAll(":scope > text[font-size='10.5']")];
  const acX0 = num(heads.find((t) => !t.hasAttribute("text-anchor"))!, "x");
  const absCx = num(
    heads.find((t) => t.getAttribute("text-anchor") === "middle" && !t.hasAttribute("font-style"))!,
    "x",
  );
  const pctCx = num(heads.find((t) => t.getAttribute("font-style") === "italic")!, "x");
  // pctCx - absCx = absW / 2 + 10 + pctW / 2 = 0.28 of the panels' room, + 10.
  const room = (pctCx - absCx - 10) / 0.28;
  const absW = room * 0.3;
  const pctW = room * 0.26;
  return {
    acX0,
    absCx,
    pctCx,
    acW: absCx - absW / 2 - 10 - acX0,
    absW,
    pctW,
    right: pctCx + pctW / 2,
  };
}

/** The row labels (the 12px texts with a native <title>), and the AC header's x. */
function rankingParts(body: HTMLElement) {
  const svg = body.querySelector("svg")!;
  const labels = [...svg.querySelectorAll("g > text")].filter((t) => t.querySelector("title"));
  const header = [...svg.querySelectorAll(":scope > text")].find((t) => t.textContent === "AC")!;
  return { svg, labels, acX0: num(header, "x"), images: [...svg.querySelectorAll("image")] };
}

describe("RankingVarianceChart - icons in row labels", () => {
  it("adds nothing to the markup when no datum has an icon", () => {
    const plain = ranking.map(({ icon: _i, labelColor: _c, ...d }) => d);
    const before = renderToStaticMarkup(<RankingVarianceChart data={plain} sortBy="none" />);
    expect(
      renderToStaticMarkup(<RankingVarianceChart data={plain} sortBy="none" iconSize={30} />),
    ).toBe(before);
    expect(before).not.toContain("<image");
  });

  it("draws each icon at the icon size, never above its own size, centred on its row", () => {
    const { images, labels } = rankingParts(
      ssr(<RankingVarianceChart data={ranking} sortBy="none" />),
    );
    expect(images.map((i) => [i.getAttribute("href"), num(i, "width")])).toEqual([
      ["ring.png", 20],
      ["sword.png", 20],
      ["ring.png", 20],
      ["small.png", 18],
    ]);
    // Chips side by side from the label's start, 2px apart.
    expect(num(images[0]!, "x")).toBe(12);
    expect(num(images[1]!, "x")).toBe(12 + 20 + 2);
    // Centred on the row's text line: 26px rows from y = 30 (no title), centre 43.
    expect(num(images[0]!, "y")).toBe(Math.round(43 - 10));
    expect(num(images[3]!, "y")).toBe(Math.round(43 + 3 * 26 - 9));
    expect(labels).toHaveLength(4);
  });

  it("frames an icon in its border colour, a 1px stroke inside its box", () => {
    const svg = rankingParts(ssr(<RankingVarianceChart data={ranking} sortBy="none" />)).svg;
    const frame = svg.querySelector("image + rect")!;
    expect(frame.getAttribute("stroke")).toBe("#a335ee");
    expect([num(frame, "x"), num(frame, "y"), num(frame, "width"), num(frame, "height")]).toEqual([
      12.5, 33.5, 19, 19,
    ]);
    expect(frame.getAttribute("fill")).toBe("none");
  });

  it("starts every label, and the total's, past the widest row's icons, the label column grown by them", () => {
    const plain = ranking.map(({ icon: _i, ...d }) => d);
    const p0 = rankingParts(ssr(<RankingVarianceChart data={plain} sortBy="none" />));
    const p1 = rankingParts(ssr(<RankingVarianceChart data={ranking} sortBy="none" />));
    // Slot: two 20px chips and a 2px gap = 42, then 6px to the label.
    expect(p0.labels.map((t) => num(t, "x"))).toEqual([12, 12, 12, 12]);
    expect(p1.labels.map((t) => num(t, "x"))).toEqual([60, 60, 60, 60]);
    const total = [...p1.svg.querySelectorAll("text")].find((t) => t.textContent === "Total")!;
    expect(num(total, "x")).toBe(60);
    expect(p1.acX0 - p0.acX0).toBe(48);
  });

  it("leaves chips that would cut a label under 24px out, from the end, and caps the column at 40%", () => {
    const many: RankingDatum[] = [
      {
        label: "Seven chips",
        AC: 10,
        base: 9,
        icon: Array.from({ length: 7 }, (_, i) => big(`c${i}.png`)),
      },
      { label: "One", AC: 9, base: 9, icon: big("one.png") },
    ];
    const width = 400;
    const innerW = width - 24;
    const { images, labels, acX0 } = rankingParts(
      ssr(<RankingVarianceChart data={many} sortBy="none" width={width} />),
    );
    const labelW = acX0 - 12;
    expect(labelW).toBeLessThanOrEqual(innerW * 0.4 + 1e-9);
    const textX = num(labels[0]!, "x");
    // At least 24px left for the label, inside the label column (6px short of the AC axis).
    expect(12 + labelW - 6 - textX).toBeGreaterThanOrEqual(24);
    const firstRow = images.filter((i) => i.getAttribute("href")!.startsWith("c"));
    expect(firstRow.length).toBeLessThan(7);
    expect(firstRow.map((i) => i.getAttribute("href"))).toEqual(
      Array.from({ length: firstRow.length }, (_, i) => `c${i}.png`),
    );
    // The last chip ends 6px before the label.
    const last = firstRow[firstRow.length - 1]!;
    expect(num(last, "x") + num(last, "width") + 6).toBeLessThanOrEqual(textX);
  });

  it("keeps the label inside its room: cut to fit past the icons", () => {
    const long: RankingDatum[] = [
      {
        label: "A label much longer than the label column could ever hold",
        AC: 2,
        base: 1,
        icon: big(),
      },
    ];
    const { labels, acX0 } = rankingParts(ssr(<RankingVarianceChart data={long} />));
    const text = labels[0]!.childNodes[0]!.textContent!;
    expect(text.endsWith("…")).toBe(true);
    expect(num(labels[0]!, "x") + estTextW(text, 12)).toBeLessThanOrEqual(acX0 - 6 + 1e-9);
    // The full label stays in its native tooltip.
    expect(labels[0]!.querySelector("title")!.textContent).toBe(long[0]!.label);
  });

  it("colours a label with its labelColor", () => {
    const { labels } = rankingParts(ssr(<RankingVarianceChart data={ranking} sortBy="none" />));
    expect(labels.map((t) => t.getAttribute("fill"))).toEqual([
      defaultTokens.color.text,
      "#a335ee",
      defaultTokens.color.text,
      defaultTokens.color.text,
    ]);
  });

  it("reads the icons' alt before the label in the screen-reader table", () => {
    const { container } = render(
      <RankingVarianceChart data={ranking} sortBy="none" tooltip={false} />,
    );
    const heads = [...container.querySelectorAll("tbody th")].map((t) => t.textContent);
    expect(heads).toEqual([
      "Signet of Embers, Runed Greatsword, Best set",
      "Signet of Embers",
      "Equipped",
      "Runed Greatsword",
      "Total",
    ]);
  });

  it("draws the caller's svg element in a size × size box at the label's start", () => {
    const renderIcon = vi.fn((row: { label: string }, size: number) =>
      row.label === "Equipped" ? null : (
        <circle cx={size / 2} cy={size / 2} r={size / 2} fill="#000" />
      ),
    );
    const svg = rankingParts(
      ssr(
        <RankingVarianceChart data={ranking} sortBy="none" renderIcon={renderIcon} iconSize={16} />,
      ),
    ).svg;
    const boxes = [...svg.querySelectorAll("g[transform^='translate']")];
    expect(boxes.map((g) => g.getAttribute("transform"))).toEqual([
      "translate(12 35)",
      "translate(12 61)",
      "translate(12 113)",
    ]);
    expect(boxes[0]!.querySelector("circle")!.getAttribute("r")).toBe("8");
    // Equipped returned null and has no icon: nothing drawn, label still aligned.
    expect(svg.querySelectorAll("image")).toHaveLength(0);
    expect(renderIcon.mock.calls.map(([, s]) => s)).toEqual([16, 16, 16, 16]);
  });

  it("counts the chips it has no room for in a +N, and names them in the label's tooltip (320px)", () => {
    const six = Array.from({ length: 6 }, (_, i) => big(`c${i}.png`, { alt: `Item ${i + 1}` }));
    const data: RankingDatum[] = [
      { label: "Best set", AC: 914.3, base: 910.84, icon: six },
      { label: "Equipped", AC: 910.84, base: 910.84 },
    ];
    const cases = [
      [undefined, (n: number) => `+${n}`],
      [{ moreIcons: "{count} more" }, (n: number) => `${n} more`],
    ] as const;
    for (const [labels, more] of cases) {
      const body = ssr(
        <RankingVarianceChart data={data} sortBy="none" width={320} labels={labels} />,
      );
      const { svg, labels: heads, images } = rankingParts(body);
      const kept = images.length;
      expect(kept).toBeGreaterThan(0);
      expect(kept).toBeLessThan(6);
      expect(images.map((i) => i.getAttribute("href"))).toEqual(
        six.slice(0, kept).map((i) => i.src),
      );
      // In the label column (the variance panels write their own "+3"s).
      const plus = [...svg.querySelectorAll("text")].filter(
        (t) => t.textContent === more(6 - kept) && num(t, "x") < panelsOf(svg).acX0,
      );
      expect(plus).toHaveLength(1);
      const plusX = num(plus[0]!, "x");
      const last = images[kept - 1]!;
      // After the last chip and a 3px gap; it ends at least 6px before the
      // label, which starts where every row's label starts.
      expect(plusX).toBe(num(last, "x") + num(last, "width") + 3);
      const plusW = estTextW(more(6 - kept), num(plus[0]!, "font-size"));
      expect(plusX + plusW).toBeLessThanOrEqual(num(heads[0]!, "x") - 6);
      expect(num(heads[1]!, "x")).toBe(num(heads[0]!, "x"));
      // The chips left out are named in the label's tooltip, after the label;
      // the screen-reader table names all six.
      expect(heads[0]!.querySelector("title")!.textContent).toBe(
        ["Best set", ...six.slice(kept).map((i) => i.alt)].join(", "),
      );
      expect(heads[1]!.querySelector("title")!.textContent).toBe("Equipped");
    }
    cleanup();
    const { container } = render(
      <RankingVarianceChart data={data} sortBy="none" width={320} tooltip={false} />,
    );
    expect(container.querySelector("tbody th")!.textContent).toBe(
      [...six.map((i) => i.alt), "Best set"].join(", "),
    );
  });

  it("hands renderIcon the chart's own icons, drawn in its box, to wrap without redrawing them", () => {
    const six = Array.from({ length: 6 }, (_, i) => big(`c${i}.png`));
    const data: RankingDatum[] = [
      { label: "Best set", AC: 914.3, base: 910.84, icon: six },
      { label: "Equipped", AC: 910.84, base: 910.84 },
      { label: "Signet", AC: 914.05, base: 910.84, icon: big("ring.png", { border: "#a335ee" }) },
    ];
    const calls: Array<[string, boolean]> = [];
    const svg = rankingParts(
      ssr(
        <RankingVarianceChart
          data={data}
          sortBy="none"
          width={320}
          renderIcon={(row, _size, icon) => {
            calls.push([row.label, icon != null]);
            return icon && <g data-tip={row.label}>{icon}</g>;
          }}
        />,
      ),
    ).svg;
    expect(calls).toEqual([
      ["Best set", true],
      ["Equipped", false],
      ["Signet", true],
    ]);
    const tips = [...svg.querySelectorAll("g[data-tip]")];
    expect(tips.map((g) => g.getAttribute("data-tip"))).toEqual(["Best set", "Signet"]);
    // In the box's own coordinates: chips from x 0, centred on the box's
    // middle (20px chips in a 20px box: y 0), then the +N; the frame too.
    const chips = [...tips[0]!.querySelectorAll("image")];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThan(6);
    expect(chips.map((i) => [num(i, "x"), num(i, "y")])).toEqual(chips.map((_, k) => [k * 22, 0]));
    expect(tips[0]!.querySelector("text")!.textContent).toBe(`+${6 - chips.length}`);
    expect(tips[1]!.querySelector("rect")!.getAttribute("stroke")).toBe("#a335ee");
    // The box itself sits at the label's start, centred on the row.
    expect(tips[0]!.parentElement!.getAttribute("transform")).toBe("translate(12 33)");
  });

  it("takes the icon slot from the AC panel: the variance panels keep 1.5's widths (560px)", () => {
    const fixture = featureCases.find((c) => c.name === "RankingVarianceChart-icons")!
      .element as ReactElement<RankingVarianceChartProps>;
    const at = (withIcons: boolean) => {
      const data = withIcons
        ? fixture.props.data
        : fixture.props.data.map(({ icon: _i, ...d }) => d);
      return ssr(cloneElement(fixture, { width: 560, data })).querySelector("svg")!;
    };
    const plain = at(false);
    const icons = at(true);
    const [p0, p1] = [panelsOf(plain), panelsOf(icons)];
    // The label column grew by the slot (two 20px chips, a 2px gap, 6px to the label) ...
    expect(p1.acX0 - p0.acX0).toBe(48);
    // ... and the AC panel alone gave it up.
    expect(p1.acW).toBeCloseTo(p0.acW - 48, 9);
    expect([p1.absCx, p1.pctCx, p1.right]).toEqual([p0.absCx, p0.pctCx, p0.right]);
    // So every variance mark and label sits where 1.5 draws it at this width.
    const deltaSide = (svg: Element, from: number) =>
      [...svg.querySelectorAll("text, circle, line, rect")]
        .map((el) => [
          el.tagName,
          el.getAttribute("x") ?? el.getAttribute("cx") ?? el.getAttribute("x1"),
          el.textContent,
        ])
        .filter(([, x]) => x != null && Number(x) >= from);
    const from = p0.absCx - p0.absW / 2;
    expect(deltaSide(icons, from)).toEqual(deltaSide(plain, from));
    expect(deltaSide(plain, from).length).toBeGreaterThan(10);
  });

  it("shrinks the three panels together past half the AC panel, never jumping as the slot grows", () => {
    // 1000px: the label column may grow by up to 222px, more than half the AC panel.
    const chips = (n: number): RankingDatum[] => [
      {
        label: "Set",
        AC: 10,
        base: 9,
        icon: Array.from({ length: n }, (_, i) => big(`w${i}.png`)),
      },
      { label: "One", AC: 9, base: 9 },
    ];
    const layouts = Array.from({ length: 13 }, (_, n) =>
      panelsOf(
        ssr(<RankingVarianceChart data={chips(n)} sortBy="none" width={1000} />).querySelector(
          "svg",
        )!,
      ),
    );
    const plain = layouts[0]!;
    for (const [n, p] of layouts.entries()) {
      // The panels always end at the chart's right edge.
      expect(p.right).toBeCloseTo(1000 - 12, 9);
      if (n === 0) continue;
      const prev = layouts[n - 1]!;
      // One more chip never widens a panel.
      expect(p.acW).toBeLessThanOrEqual(prev.acW + 1e-9);
      expect(p.absW).toBeLessThanOrEqual(prev.absW + 1e-9);
      expect(p.pctW).toBeLessThanOrEqual(prev.pctW + 1e-9);
      if (p.acW >= plain.acW / 2 - 1e-9) {
        // Within half the AC panel: the variance panels keep their widths.
        expect([p.absW, p.pctW]).toEqual([plain.absW, plain.pctW]);
      } else {
        // Past it: AC at half, all three shrunk together in 22 : 30 : 26.
        expect(p.acW / p.absW).toBeCloseTo(0.22 / 0.3, 9);
        expect(p.absW).toBeLessThan(plain.absW);
      }
    }
    // Both regimes occur.
    expect(layouts.some((p) => p.absW < plain.absW)).toBe(true);
    expect(layouts.filter((p) => p.absW === plain.absW).length).toBeGreaterThan(2);
  });

  it("sizes icons to the row: at most its height minus 4 and 56, at least 8", () => {
    const one = [{ label: "A", AC: 2, base: 1, icon: big() }];
    const size = (props: object) =>
      num(ssr(<RankingVarianceChart data={one} {...props} />).querySelector("image")!, "width");
    expect(size({})).toBe(20);
    expect(size({ rowHeight: 20 })).toBe(14);
    expect(size({ rowHeight: 14 })).toBe(8);
    expect(size({ rowHeight: 40, iconSize: 80 })).toBe(36);
    const huge = [{ label: "A", AC: 2, base: 1, icon: { src: "x.png", naturalSize: 128 } }];
    expect(
      num(
        ssr(<RankingVarianceChart data={huge} rowHeight={90} iconSize={80} />).querySelector(
          "image",
        )!,
        "width",
      ),
    ).toBe(56);
    // Rows are never under 14px (the chart's floor): 8px icons there too.
    expect(size({ rowHeight: 6 })).toBe(8);
  });
});
