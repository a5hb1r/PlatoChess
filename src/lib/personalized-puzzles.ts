import type { Color } from "chess.js";
import type { ReviewedPly, PersonalizedPuzzle } from "@/lib/game-review";
import type { StockfishTopLine } from "@/lib/stockfish";

export interface PuzzleCandidateInput {
  move: ReviewedPly;
  topLines: StockfishTopLine[];
}

function lineScoreCp(line: StockfishTopLine): number {
  if (line.mate !== undefined) {
    return line.mate > 0 ? 32000 - Math.abs(line.mate) * 80 : -32000 + Math.abs(line.mate) * 80;
  }
  return line.score ?? 0;
}

function perspective(cp: number, side: Color): number {
  return side === "w" ? cp : -cp;
}

function firstMoveOfLine(line: StockfishTopLine): string {
  return line.pv[0] ?? "";
}

export function buildStrictPuzzleCandidate(input: PuzzleCandidateInput): PersonalizedPuzzle | null {
  const { move, topLines } = input;
  if (!move.bestUci || !move.fenBefore) return null;
  if (move.label !== "Blunder" && move.label !== "Mistake" && move.label !== "Inaccuracy") return null;

  const ranked = [...topLines]
    .filter((line) => line.pv.length > 0)
    .sort((a, b) => a.multipv - b.multipv);
  if (ranked.length < 2) return null;

  const best = ranked[0];
  const second = ranked[1];
  const bestMove = firstMoveOfLine(best);
  if (!bestMove || bestMove !== move.bestUci) return null;

  const bestPerspective = perspective(lineScoreCp(best), move.side);
  const secondPerspective = perspective(lineScoreCp(second), move.side);
  const gap = bestPerspective - secondPerspective;
  if (!Number.isFinite(gap) || gap < 70) return null;

  return {
    id: `missed-${move.ply}-${bestMove}`,
    sourcePly: move.ply,
    sourceLabel: move.label,
    fen: move.fenBefore,
    playerColor: move.side,
    solution: [bestMove],
    title: `Missed best move at ply ${move.ply}`,
    description: `Best move was ${bestMove}. Next-best is ${Math.round(gap)}cp worse.`,
    bestGapCp: Math.round(gap),
  };
}

export function buildPersonalizedPuzzles(inputs: PuzzleCandidateInput[]): PersonalizedPuzzle[] {
  const out: PersonalizedPuzzle[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const puzzle = buildStrictPuzzleCandidate(input);
    if (!puzzle || seen.has(puzzle.fen)) continue;
    seen.add(puzzle.fen);
    out.push(puzzle);
  }
  return out;
}
