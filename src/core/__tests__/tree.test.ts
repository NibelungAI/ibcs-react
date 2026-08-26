import { describe, it, expect } from "vitest";
import { computeTree, type TreeNode } from "../tree";

const root: TreeNode = {
  id: "roa",
  label: "Return on assets",
  value: 0.12,
  py: 0.1,
  op: "/",
  format: { compact: false, decimals: 1 }, // ratio root shown differently
  children: [
    {
      id: "ret",
      label: "Return",
      value: 30,
      op: "-",
      children: [
        { id: "sales", label: "Net sales", value: 100, py: 90 },
        { id: "cost", label: "Cost", value: 70, py: 65 },
      ],
    },
    { id: "assets", label: "Assets", value: 250 },
  ],
};

describe("computeTree layout", () => {
  const layout = computeTree(root);
  const byId = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));

  it("assigns depth as the distance from the root", () => {
    expect(byId.roa!.depth).toBe(0);
    expect(byId.ret!.depth).toBe(1);
    expect(byId.assets!.depth).toBe(1);
    expect(byId.sales!.depth).toBe(2);
    expect(byId.cost!.depth).toBe(2);
  });

  it("gives leaves successive integer rows in traversal order", () => {
    expect(byId.sales!.row).toBe(0);
    expect(byId.cost!.row).toBe(1);
    expect(byId.assets!.row).toBe(2);
  });

  it("centers each parent on the midpoint of its first and last child rows", () => {
    expect(byId.ret!.row).toBe(0.5); // between sales(0) and cost(1)
    expect(byId.roa!.row).toBe(1.25); // between ret(0.5) and assets(2)
  });

  it("reports the grid extents (depthCount, rowCount)", () => {
    expect(layout.depthCount).toBe(3);
    expect(layout.rowCount).toBe(3);
  });

  it("defaults orientation to horizontal", () => {
    expect(layout.orientation).toBe("horizontal");
    expect(computeTree(root, { orientation: "vertical" }).orientation).toBe("vertical");
  });

  it("builds one link per parent→child edge, stamped with the parent's op", () => {
    expect(layout.links).toHaveLength(4); // ret, assets, sales, cost
    const rootChildLinks = layout.links.filter((l) => l.from === "roa");
    expect(rootChildLinks.every((l) => l.op === "/")).toBe(true);
    const retChildLinks = layout.links.filter((l) => l.from === "ret");
    expect(retChildLinks.every((l) => l.op === "-")).toBe(true);
  });

  it("computes Δ-vs-PY variance only for nodes that carry a py", () => {
    expect(byId.roa!.variance!.abs).toBeCloseTo(0.02);
    expect(byId.roa!.variance!.favorable).toBe(true);
    expect(byId.sales!.variance!.abs).toBe(10);
    expect(byId.assets!.variance).toBeNull(); // no py
  });

  it("applies the chart-level higherIsBetter to every node's variance (no per-node flag)", () => {
    // TreeNode has no per-node higherIsBetter; the default (true) is used, so a
    // rise reads favorable even for a cost-like driver.
    expect(byId.cost!.variance!.abs).toBe(5);
    expect(byId.cost!.variance!.favorable).toBe(true);
  });

  it("passes a node's format through to the placed node", () => {
    expect(byId.roa!.format).toEqual({ compact: false, decimals: 1 });
    expect(byId.sales!.format).toBeUndefined();
  });

  it("records parent ids and child ids", () => {
    expect(byId.roa!.parentId).toBeNull();
    expect(byId.ret!.parentId).toBe("roa");
    expect(byId.roa!.childIds).toEqual(["ret", "assets"]);
    expect(byId.ret!.childIds).toEqual(["sales", "cost"]);
    expect(byId.sales!.childIds).toEqual([]);
  });

  it("handles a single-node tree", () => {
    const single = computeTree({ id: "x", label: "X", value: 5 });
    expect(single.depthCount).toBe(1);
    expect(single.rowCount).toBe(1);
    expect(single.nodes[0]!.row).toBe(0);
    expect(single.links).toHaveLength(0);
  });
});

describe("computeTree higherIsBetter default", () => {
  it("uses chart-level higherIsBetter as the fallback", () => {
    const t = computeTree({ id: "r", label: "R", value: 80, py: 100 }, { higherIsBetter: false });
    // value fell with higherIsBetter:false -> favorable
    expect(t.nodes[0]!.variance!.favorable).toBe(true);
  });
});
