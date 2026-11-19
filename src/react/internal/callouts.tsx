import type { IbcsTokens } from "../../core/tokens";
import {
  placeLabels,
  type PlacedLabel,
  type PlacementBox,
  type PlacementObstacles,
  type PlacementSegment,
  type PlacementSide,
} from "../../core/labelPlacement";
import { NoteBadge, badgeRadius } from "./notes";

/**
 * Point callouts as a chart draws them: a label of one or more lines beside
 * the point it names, placed by `placeLabels` clear of every other label,
 * marker and line. A label beside a dot needs nothing more; a label beside a
 * mark without a dot - a column's end, a band's edge - is tied to it by a
 * short line, and any label moved away from its point gets a leader back to
 * the mark. A callout with no free place gets a number instead: a disc beside
 * its point, placed the same way, and its text in the chart's list of notes.
 * When even the disc has no place, no disc is drawn - nothing is drawn over
 * another mark - and its note names its period instead ("R6: T1 gloves"). A
 * callout whose point is not drawn - its period has no value, or its series
 * is not drawn - is such a note from the start ("b: On the gap"). So every
 * callout on a period is on the chart.
 *
 * Internal module: not part of the public API surface.
 */

/** The font size of a callout's text, px. */
export const CALLOUT_FONT = 10;
/** The height of one line of a callout, px. */
export const CALLOUT_LINE_H = 12;
/** The radius of the dot that marks a callout's point, px. */
export const CALLOUT_DOT_R = 3.5;
/** The width of the ring around the dot, in the surface colour, px. */
const DOT_RING = 1.5;
/** The space between a dot's ring and its label, px. */
const CALLOUT_GAP = 4;
/** The space between a dot-less mark's edge and its label: room for the line that ties them, px. */
const TIE_GAP = 7;

/** One callout to draw. */
export interface CalloutSpec {
  /** The point it names, px. */
  x: number;
  y: number;
  /** Its text, already wrapped into lines. */
  lines: string[];
  /** The sides its label may take, in order. */
  sides: PlacementSide[];
  /** A dot at the point in this colour; null when the point is a mark's edge or middle. */
  dot: string | null;
  /**
   * How far the mark reaches from the point towards the label, px: a leader
   * or tie starts there. Default the dot's radius and ring, or 0 (the point is
   * the mark's edge - a column's end). A band's caption names the band's
   * middle, with half its height here.
   */
  edge?: number;
  /** The callout's text in the list of notes, when its label finds no place. */
  note: string;
  /** The name of its period, for a note whose disc finds no place either. */
  where: string;
  /**
   * False when its point is not drawn - its period has no value, or its
   * series is not drawn. It then gets no dot, label or disc, and its note
   * names its period; `x`, `y` and `sides` go unused. Default true.
   */
  drawn?: boolean;
}

/** A callout, resolved: where its label went, or its note number and disc. */
export interface ResolvedCallout {
  spec: CalloutSpec;
  /** The label's place, or null when it is written as a note. */
  label: PlacedLabel | null;
  /** Its note number (from 1, in the order given), or null when its label is placed. */
  number: number | null;
  /**
   * The disc of a note: its centre, and its leader to the mark when it was
   * moved away. Null for a placed label, and for a note whose disc found no
   * place (its note names its period instead).
   */
  badge: { cx: number; cy: number; leader: PlacementSegment | null } | null;
}

/** The box a callout's lines take, px. */
export function calloutSize(
  lines: readonly string[],
  measure: (s: string, fontPx: number) => number,
): { width: number; height: number } {
  const width = lines.reduce((w, l) => Math.max(w, measure(l, CALLOUT_FONT)), 0) + 2;
  return { width, height: Math.max(1, lines.length) * CALLOUT_LINE_H };
}

/** The box a point's dot and its ring take: an obstacle to every other label. */
export function dotBox(x: number, y: number): PlacementBox {
  const r = CALLOUT_DOT_R + DOT_RING;
  return { left: x - r, top: y - r, right: x + r, bottom: y + r };
}

/** How far a callout's mark reaches from its point. */
function edgeOf(s: CalloutSpec): number {
  return s.edge ?? (s.dot ? CALLOUT_DOT_R + DOT_RING : 0);
}

/** The space between a callout's point and its label right beside it. */
function clearanceOf(s: CalloutSpec): number {
  return edgeOf(s) + (s.dot ? CALLOUT_GAP : TIE_GAP);
}

/**
 * Place the callouts: every label first, in the order given; then a disc for
 * each callout left without a place, numbered in order, placed beside its
 * point the same way. A callout whose point is not drawn is numbered in the
 * same order, with no label or disc. `obstacles` must hold everything else
 * the chart draws in `bounds` (the callouts' own dots included, see
 * {@link dotBox}).
 */
export function resolveCallouts(
  specs: readonly CalloutSpec[],
  obstacles: PlacementObstacles,
  bounds: PlacementBox,
  measure: (s: string, fontPx: number) => number,
): ResolvedCallout[] {
  const labels = placeLabels(
    specs.map((s) => ({
      x: s.x,
      y: s.y,
      ...calloutSize(s.lines, measure),
      clearance: clearanceOf(s),
      reach: edgeOf(s),
      tie: s.dot == null,
      sides: s.drawn === false ? [] : s.sides,
    })),
    obstacles,
    bounds,
  );
  let next = 0;
  const numbers = labels.map((l) => (l ? null : ++next));
  // The discs of the notes: placed beside their points, clear of the labels
  // just placed (and their leaders) and of each other.
  const placedBoxes = labels.flatMap((l) => (l ? [l.box] : []));
  const placedLeaders = labels.flatMap((l) => (l?.leader ? [l.leader] : []));
  const discs = placeLabels(
    specs.flatMap((s, i) => {
      const n = numbers[i];
      if (n == null || s.drawn === false) return [];
      const d = badgeRadius(n) * 2;
      return [
        {
          x: s.x,
          y: s.y,
          width: d,
          height: d,
          clearance: edgeOf(s) + CALLOUT_GAP,
          reach: edgeOf(s),
          sides: ["above", "below"] as PlacementSide[],
        },
      ];
    }),
    {
      boxes: [...obstacles.boxes, ...placedBoxes],
      segments: [...obstacles.segments, ...placedLeaders],
    },
    bounds,
  );
  let d = 0;
  return specs.map((spec, i) => {
    const label = labels[i] ?? null;
    const number = numbers[i] ?? null;
    if (number == null || spec.drawn === false) return { spec, label, number, badge: null };
    const disc = discs[d++] ?? null;
    const badge = disc
      ? {
          cx: (disc.box.left + disc.box.right) / 2,
          cy: (disc.box.top + disc.box.bottom) / 2,
          leader: disc.leader,
        }
      : null;
    return { spec, label, number, badge };
  });
}

/**
 * The notes of the callouts written as numbered notes, in number order; a
 * note without a disc - none found a place, or its point is not drawn -
 * names its period before its text.
 */
export function calloutNotes(
  callouts: readonly ResolvedCallout[],
): Array<{ number: number; text: string }> {
  return callouts.flatMap((c) =>
    c.number != null
      ? [{ number: c.number, text: c.badge ? c.spec.note : `${c.spec.where}: ${c.spec.note}` }]
      : [],
  );
}

/** Whether every callout with a drawn point found a place for its label beside it. */
export function allPlaced(callouts: readonly ResolvedCallout[]): boolean {
  return callouts.every((c) => c.label != null || c.spec.drawn === false);
}

/** The callouts' leaders and ties, under the marks: drawn before them so a line stays whole. */
export function CalloutLeaders({
  callouts,
  tokens,
}: {
  callouts: readonly ResolvedCallout[];
  tokens: IbcsTokens;
}) {
  const lines = calloutConnectors(callouts);
  if (lines.length === 0) return null;
  return (
    <g>
      {lines.map((l, i) => (
        <line
          key={`leader-${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={tokens.color.textMuted}
          strokeWidth={0.75}
        />
      ))}
    </g>
  );
}

/** The callouts' dots, labels and discs, over the marks. */
export function CalloutMarks({
  callouts,
  tokens,
}: {
  callouts: readonly ResolvedCallout[];
  tokens: IbcsTokens;
}) {
  return (
    <g>
      {callouts.map((c, i) => (
        <g key={`callout-${i}`}>
          {c.spec.dot && (
            <circle
              cx={c.spec.x}
              cy={c.spec.y}
              r={CALLOUT_DOT_R}
              fill={c.spec.dot}
              stroke={tokens.color.surface}
              strokeWidth={DOT_RING}
            />
          )}
          {c.label &&
            c.spec.lines.map((line, j) => (
              <text
                key={`line-${j}`}
                x={(c.label!.box.left + c.label!.box.right) / 2}
                y={c.label!.box.top + j * CALLOUT_LINE_H + CALLOUT_LINE_H - 3}
                fontSize={CALLOUT_FONT}
                fill={tokens.color.text}
                textAnchor="middle"
              >
                {line}
              </text>
            ))}
          {c.badge && c.number != null && (
            <NoteBadge cx={c.badge.cx} cy={c.badge.cy} n={c.number} tokens={tokens} />
          )}
        </g>
      ))}
    </g>
  );
}

/** Every line the callouts draw: the labels' leaders and ties, and the discs' leaders. */
export function calloutConnectors(callouts: readonly ResolvedCallout[]): PlacementSegment[] {
  return callouts.flatMap((c) => {
    const line = c.label ? c.label.leader : (c.badge?.leader ?? null);
    return line ? [line] : [];
  });
}
