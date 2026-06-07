import { describe, expect, it } from "vitest";
import { buildPersonalizedPuzzles, buildStrictPuzzleCandidate } from "./personalized-puzzles";
import type { ReviewedPly } from "./game-review";
import type { StockfishTopLine } from "./stockfish";

const baseMove: ReviewedPly = {
  ply: 17,
  side: "w",
  san: "Qh5?",
  label: "Mistake",
  colorClass: "",
  cpLoss: 142,
  bestUci: "d1h5",
  playedUci: "d1g4",
  fenBefore: "r1bqkbnr/pppp1ppp/2n5/4p3/3nP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4",
  fenAfter: "r1bqkbnr/pppp1ppp/2n5/4p2Q/3nP3/5N2/PPPP1PPP/RNB1KB1R b KQkq - 1 4",
  evalBeforeCp: 12,
  evalAfterCp: -130,
};

const dominantTopLines: StockfishTopLine[] = [
  { multipv: 1, depth: 12, score: 95, pv: ["d1h5", "g8f6"] },
  { multipv: 2, depth: 12, score: 5, pv: ["d2d4", "e5d4"] },
  { multipv: 3, depth: 12, score: -2, pv: ["b1c3"] },
];

describe("buildStrictPuzzleCandidate", () => {
  it("creates puzzle when best line has clear MultiPV gap", () => {
    const puzzle = buildStrictPuzzleCandidate({
      move: baseMove,
      topLines: dominantTopLines,
    });
    expect(puzzle).not.toBeNull();
    expect(puzzle?.solution).toEqual(["d1h5"]);
    expect(puzzle?.bestGapCp).toBeGreaterThanOrEqual(70);
  });

  it("rejects vague candidates with small best-vs-second gap", () => {
    const vagueLines: StockfishTopLine[] = [
      { multipv: 1, depth: 12, score: 32, pv: ["d1h5"] },
      { multipv: 2, depth: 12, score: 5, pv: ["d2d4"] },
    ];
    const puzzle = buildStrictPuzzleCandidate({ move: baseMove, topLines: vagueLines });
    expect(puzzle).toBeNull();
  });
});

describe("buildPersonalizedPuzzles", () => {
  it("deduplicates by source position", () => {
    const puzzles = buildPersonalizedPuzzles([
      { move: baseMove, topLines: dominantTopLines },
      { move: { ...baseMove, ply: 19 }, topLines: dominantTopLines },
    ]);
    expect(puzzles).toHaveLength(1);
  });
});
