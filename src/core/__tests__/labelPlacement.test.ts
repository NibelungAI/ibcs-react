import { describe, expect, it } from "vitest";

import {
  boxesTouch,
  placeLabels,
  segmentHitsBox,
  type PlacementBox,
  type PlacementRequest,
  type PlacementSegment,
} from "../labelPlacement";

/** A deterministic uniform in [0, 1). */
function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** Brute force: does any of 2,001 points along the segment lie inside the box? */
function sampledHit(s: PlacementSegment, b: PlacementBox): boolean {
  for (let k = 0; k <= 2000; k++) {
    const t = k / 2000;
    const x = s.x1 + (s.x2 - s.x1) * t;
    const y = s.y1 + (s.y2 - s.y1) * t;
    if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return true;
  }
  return false;
}

/** The distance from a point to a segment. */
function distanceToSegment(px: number, py: number, s: PlacementSegment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - s.x1) * dx + (py - s.y1) * dy) / len2)) : 0;
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

/** The least distance between a segment and a box (0 when they meet), sampled finely. */
function segmentBoxGap(s: PlacementSegment, b: PlacementBox): number {
  let best = Infinity;
  for (let k = 0; k <= 400; k++) {
    const t = k / 400;
    const x = s.x1 + (s.x2 - s.x1) * t;
    const y = s.y1 + (s.y2 - s.y1) * t;
    const dx = Math.max(b.left - x, 0, x - b.right);
    const dy = Math.max(b.top - y, 0, y - b.bottom);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  // The box corners against the segment, for a segment passing near a corner.
  for (const [cx, cy] of [
    [b.left, b.top],
    [b.right, b.top],
    [b.left, b.bottom],
    [b.right, b.bottom],
  ] as const) {
    best = Math.min(best, distanceToSegment(cx, cy, s));
  }
  return best;
}

describe("segmentHitsBox", () => {
  it("agrees with a brute-force sampler on 3,000 random segments and boxes", () => {
    const u = lcg(17);
    let hits = 0;
    for (let k = 0; k < 3000; k++) {
      const box = { left: u() * 80, top: u() * 80, right: 0, bottom: 0 };
      box.right = box.left + 1 + u() * 30;
      box.bottom = box.top + 1 + u() * 30;
      const s = { x1: u() * 120, y1: u() * 120, x2: u() * 120, y2: u() * 120, pad: 0 };
      const exact = segmentHitsBox(s.x1, s.y1, s.x2, s.y2, box);
      // The sampler can miss a corner graze shorter than its step; it never
      // reports a hit that is not there.
      if (sampledHit(s, box)) expect(exact).toBe(true);
      else if (exact) expect(segmentBoxGap(s, box)).toBeLessThan(0.1);
      if (exact) hits++;
    }
    expect(hits).toBeGreaterThan(300);
  });

  it("handles points, axis-parallel segments and touching edges", () => {
    const b = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(segmentHitsBox(5, 5, 5, 5, b)).toBe(true);
    expect(segmentHitsBox(11, 5, 11, 5, b)).toBe(false);
    expect(segmentHitsBox(-5, 10, 15, 10, b)).toBe(true);
    expect(segmentHitsBox(-5, 10.01, 15, 10.01, b)).toBe(false);
    expect(segmentHitsBox(10, -5, 10, 15, b)).toBe(true);
    expect(segmentHitsBox(-1, -1, -5, -5, b)).toBe(false);
  });
});

describe("boxesTouch", () => {
  it("counts boxes closer than the margin as touching", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(boxesTouch(a, { left: 11, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(boxesTouch(a, { left: 11, top: 0, right: 20, bottom: 10 }, 2)).toBe(true);
    expect(boxesTouch(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
  });
});

const bounds: PlacementBox = { left: 0, top: 0, right: 300, bottom: 200 };
const req = (x: number, y: number, extra: Partial<PlacementRequest> = {}): PlacementRequest => ({
  x,
  y,
  width: 40,
  height: 12,
  clearance: 6,
  sides: ["above", "below"],
  ...extra,
});

describe("placeLabels", () => {
  it("puts a label right beside its point when that place is free, with no leader", () => {
    const [p] = placeLabels([req(150, 100)], { boxes: [], segments: [] }, bounds);
    expect(p).toEqual({
      box: { left: 130, top: 82, right: 170, bottom: 94 },
      side: "above",
      leader: null,
    });
  });

  it("moves a label away from a line that crosses its place, with a leader back to the mark", () => {
    const line = { x1: 100, y1: 90, x2: 200, y2: 90, pad: 1 };
    const [p] = placeLabels([req(150, 100, { reach: 3 })], { boxes: [], segments: [line] }, bounds);
    expect(p!.side).toBe("above");
    expect(p!.box.bottom).toBeLessThan(90 - 1 - 2);
    // The leader starts at the mark's reach and ends on the box's near edge.
    expect(p!.leader).toEqual({ x1: 150, y1: 97, x2: 150, y2: p!.box.bottom, pad: 0.5 });
  });

  it("takes its other side when the first has no room, and none at all when neither has", () => {
    const roof = { left: 0, top: 0, right: 300, bottom: 95 };
    const [below] = placeLabels([req(150, 100)], { boxes: [roof], segments: [] }, bounds);
    expect(below!.side).toBe("below");
    expect(below!.box.top).toBe(106);
    const floor = { left: 0, top: 105, right: 300, bottom: 200 };
    const [none] = placeLabels([req(150, 100)], { boxes: [roof, floor], segments: [] }, bounds);
    expect(none).toBeNull();
  });

  it("ties a label to its mark even right beside it when asked", () => {
    const [p] = placeLabels(
      [req(150, 100, { reach: 0, tie: true })],
      { boxes: [], segments: [] },
      bounds,
    );
    expect(p!.leader).toEqual({ x1: 150, y1: 100, x2: 150, y2: 94, pad: 0.5 });
  });

  it("shifts a label inside the bounds, and places none wider than them", () => {
    const [edge] = placeLabels([req(5, 100)], { boxes: [], segments: [] }, bounds);
    expect(edge!.box.left).toBe(0);
    const [wide] = placeLabels(
      [req(150, 100, { width: 301 })],
      { boxes: [], segments: [] },
      bounds,
    );
    expect(wide).toBeNull();
  });

  it("never lets a later label cover an earlier one or its leader", () => {
    // Two points side by side, the first one's place blocked by a line: its
    // label rises with a leader, and the second must clear both.
    const line = { x1: 120, y1: 90, x2: 160, y2: 90, pad: 1 };
    const [a, b] = placeLabels(
      [req(140, 100, { reach: 3 }), req(160, 100, { reach: 3 })],
      { boxes: [], segments: [line] },
      bounds,
    );
    expect(a!.leader).not.toBeNull();
    expect(boxesTouch(a!.box, b!.box, 2)).toBe(false);
    expect(segmentHitsBox(a!.leader!.x1, a!.leader!.y1, a!.leader!.x2, a!.leader!.y2, b!.box)).toBe(
      false,
    );
  });

  it("keeps every label clear of every obstacle, label and leader in 300 random scenes", () => {
    const u = lcg(29);
    let placedCount = 0;
    let movedCount = 0;
    let missing = 0;
    for (let scene = 0; scene < 300; scene++) {
      const segments: PlacementSegment[] = [];
      let y = 40 + u() * 120;
      for (let x = 0; x < 300; x += 6) {
        const next = Math.min(190, Math.max(10, y + (u() - 0.5) * 30));
        segments.push({ x1: x, y1: y, x2: x + 6, y2: next, pad: 1 });
        y = next;
      }
      const boxes: PlacementBox[] = Array.from({ length: 6 }, () => {
        const left = u() * 280;
        const top = u() * 180;
        return { left, top, right: left + 4 + u() * 20, bottom: top + 4 + u() * 14 };
      });
      const requests = Array.from({ length: 1 + Math.floor(u() * 7) }, () =>
        req(u() * 300, 20 + u() * 160, {
          width: 20 + u() * 80,
          height: 12 * (1 + Math.floor(u() * 3)),
          reach: u() < 0.5 ? 0 : 5,
          tie: u() < 0.3,
        }),
      );
      const t0 = performance.now();
      const placed = placeLabels(requests, { boxes, segments }, bounds);
      expect(performance.now() - t0).toBeLessThan(250);
      for (const [i, p] of placed.entries()) {
        if (!p) {
          missing++;
          continue;
        }
        placedCount++;
        if (p.leader && !requests[i]!.tie) movedCount++;
        const b = p.box;
        expect(b.left).toBeGreaterThanOrEqual(bounds.left);
        expect(b.right).toBeLessThanOrEqual(bounds.right);
        expect(b.top).toBeGreaterThanOrEqual(bounds.top);
        expect(b.bottom).toBeLessThanOrEqual(bounds.bottom);
        for (const o of boxes) expect(boxesTouch(b, o, 2)).toBe(false);
        // Every line keeps its pad and the 2 px margin from the label.
        for (const s of segments) expect(segmentBoxGap(s, b)).toBeGreaterThan(s.pad + 2 - 1e-6);
        for (const [j, q] of placed.entries()) {
          if (!q || j === i) continue;
          expect(boxesTouch(b, q.box, 2)).toBe(false);
          if (q.leader) {
            expect(segmentHitsBox(q.leader.x1, q.leader.y1, q.leader.x2, q.leader.y2, b)).toBe(
              false,
            );
          }
        }
        if (p.leader) {
          const r = requests[i]!;
          const reach = r.reach ?? r.clearance;
          expect(p.leader.x1).toBe(r.x);
          expect(p.leader.y1).toBe(p.side === "above" ? r.y - reach : r.y + reach);
          // A leader meets no obstacle box past the first 1.5 px it may touch.
          for (const o of boxes) {
            const len = Math.hypot(p.leader.x2 - p.leader.x1, p.leader.y2 - p.leader.y1);
            const t = len > 1.5 ? 1.5 / len : 1;
            const s = {
              ...p.leader,
              x1: p.leader.x1 + (p.leader.x2 - p.leader.x1) * t,
              y1: p.leader.y1 + (p.leader.y2 - p.leader.y1) * t,
            };
            expect(segmentHitsBox(s.x1, s.y1, s.x2, s.y2, o)).toBe(false);
          }
        }
      }
    }
    // Not vacuous: most labels find a place, some only by moving, some none.
    expect(placedCount).toBeGreaterThan(600);
    expect(movedCount).toBeGreaterThan(50);
    expect(missing).toBeGreaterThan(5);
    // 300 scenes of 50 segments and up to 7 labels each: about 0.5 s on a
    // laptop, 2.8 s on GitHub's Node 22 runner, so the 5 s default is too
    // close. Each scene keeps its own 250 ms bound above.
  }, 30_000);

  it("is bounded by the bounds, not by the values, for a point far outside them", () => {
    const t0 = performance.now();
    const [p] = placeLabels([req(150, 1e15)], { boxes: [], segments: [] }, bounds);
    expect(performance.now() - t0).toBeLessThan(50);
    expect(p).toBeNull();
  });
});
