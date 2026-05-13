import { OPENING_LINES, type OpeningLine } from "@/data/openings";

export interface DetectedOpening {
  name: string;
  eco?: string;
  family: string;
  matchedPlies: number;
}

/**
 * Strict opening lookup. Returns the longest book line whose entire SAN move
 * list has been played. Reporting a partial-prefix match is intentionally
 * avoided, since e.g. claiming "Bogo-Indian" after just `1.d4` (or any other
 * one-ply prefix that happens to be the shortest book line starting with `d4`)
 * is misleading.
 *
 * Returns `null` when no book line is fully matched yet, so the UI can fall
 * back to a neutral "out of book" / "awaiting first move" message.
 */
export function detectOpening(playedSan: readonly string[]): DetectedOpening | null {
  if (playedSan.length === 0) return null;

  let best: OpeningLine | null = null;

  outer: for (const line of OPENING_LINES) {
    if (line.moves.length > playedSan.length) continue;
    for (let i = 0; i < line.moves.length; i++) {
      if (line.moves[i] !== playedSan[i]) continue outer;
    }
    if (!best || line.moves.length > best.moves.length) best = line;
  }

  if (!best) return null;
  return {
    name: best.name,
    eco: best.eco,
    family: best.family,
    matchedPlies: best.moves.length,
  };
}
