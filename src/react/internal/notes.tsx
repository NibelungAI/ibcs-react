import type { IbcsTokens } from "../../core/tokens";
import { estTextW, wrapText } from "./text";

/**
 * Numbered notes - a number in a dark disc on the chart, at the mark it
 * explains, and the same number before its text in a list under the chart
 * (IBCS UN 2.4: annotations linked to the marks by references). The
 * timeline's annotations are drawn this way, and so is any point callout that
 * finds no free place beside its point.
 *
 * Internal module: not part of the public API surface.
 */

/** The font size of a note's text, px. */
export const NOTE_FONT = 10.5;
/** The height of one line of the list, px. */
export const NOTE_LINE_H = 14;
/** The space above the list, px. */
export const NOTE_TOP_GAP = 6;
/** The font size of a disc's number, px. */
const BADGE_FONT = 9;
/** The gap between a disc and its text in the list, px. */
const BADGE_TEXT_GAP = 5;

/** The radius of the disc that holds `n`: wide enough for its digits. */
export function badgeRadius(n: number): number {
  return Math.max(6.5, estTextW(String(n), BADGE_FONT) / 2 + 2.5);
}

/** A number in a disc: dark on light themes, light on dark ones (the text ink, then the surface). */
export function NoteBadge({
  cx,
  cy,
  n,
  tokens,
}: {
  cx: number;
  cy: number;
  n: number;
  tokens: IbcsTokens;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={badgeRadius(n)} fill={tokens.color.text} />
      <text
        x={cx}
        y={cy + BADGE_FONT * 0.35}
        fontSize={BADGE_FONT}
        fontWeight={600}
        fill={tokens.color.surface}
        textAnchor="middle"
      >
        {n}
      </text>
    </g>
  );
}

/** One line of the list: the first line of a note carries its number. */
export interface NoteLine {
  number: number | null;
  text: string;
}

/**
 * The notes as lines no wider than `maxWidth` - each note's text wrapped
 * after its disc, never cut - in the order given.
 */
export function layoutNotes(
  notes: ReadonlyArray<{ number: number; text: string }>,
  maxWidth: number,
): NoteLine[] {
  const widest = notes.reduce((r, n) => Math.max(r, badgeRadius(n.number)), 0);
  const textW = Math.max(24, maxWidth - widest * 2 - BADGE_TEXT_GAP);
  return notes.flatMap((note) =>
    wrapText(note.text, textW, NOTE_FONT).map((text, i) => ({
      number: i === 0 ? note.number : null,
      text,
    })),
  );
}

/** The height the list takes, its top gap included (0 for no line). */
export function notesHeight(lines: readonly NoteLine[]): number {
  return lines.length > 0 ? NOTE_TOP_GAP + lines.length * NOTE_LINE_H : 0;
}

/** The list: from `y`, each line's disc at `x`, the text after the widest disc. */
export function NoteList({
  lines,
  x,
  y,
  tokens,
}: {
  lines: readonly NoteLine[];
  x: number;
  y: number;
  tokens: IbcsTokens;
}) {
  if (lines.length === 0) return null;
  const widest = lines.reduce(
    (r, l) => (l.number == null ? r : Math.max(r, badgeRadius(l.number))),
    0,
  );
  const textX = x + widest * 2 + BADGE_TEXT_GAP;
  return (
    <g>
      {lines.map((line, i) => {
        const top = y + NOTE_TOP_GAP + i * NOTE_LINE_H;
        const cy = top + NOTE_LINE_H / 2;
        return (
          <g key={`note-${i}`}>
            {line.number != null && (
              <NoteBadge cx={x + widest} cy={cy} n={line.number} tokens={tokens} />
            )}
            <text x={textX} y={cy + NOTE_FONT * 0.35} fontSize={NOTE_FONT} fill={tokens.color.text}>
              {line.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
