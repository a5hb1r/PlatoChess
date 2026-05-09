import { OPENING_LINES, type OpeningLine } from "@/data/openings";

export interface DetectedOpening {
  name: string;
  eco?: string;
  family: string;
  matchedPlies: number;
}

/**
 * Best-prefix opening lookup. Iterates the curated `OPENING_LINES` book once
 * and returns the entry whose move list is the longest prefix of `playedSan`.
 *
 * Returns `null` for the empty start position or when no book line matches the
 * first played move.
 */
export function detectOpening(playedSan: readonly string[]): DetectedOpening | null {
  if (playedSan.length === 0) return null;

  let best: { line: OpeningLine; matched: number } | null = null;

  for (const line of OPENING_LINES) {
    const limit = Math.min(line.moves.length, playedSan.length);
    let i = 0;
    while (i < limit && line.moves[i] === playedSan[i]) i++;
    if (i === 0) continue;
    if (!best || i > best.matched || (i === best.matched && line.moves.length < best.line.moves.length)) {
      best = { line, matched: i };
    }
  }

  if (!best) return null;
  return {
    name: best.line.name,
    eco: best.line.eco,
    family: best.line.family,
    matchedPlies: best.matched,
  };
}
