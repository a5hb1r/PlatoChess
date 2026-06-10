import { describe, expect, it } from "vitest";
import { estimateGameRating } from "./game-rating";
import type { ReviewedPly } from "./game-review";

function ply(side: "w" | "b", cpLoss: number, label = "Good", n = 1): ReviewedPly {
  return {
    ply: n,
    side,
    san: "e4",
    label,
    colorClass: "",
    cpLoss,
    playedUci: "e2e4",
    fenBefore: "",
    fenAfter: "",
  };
}

function plies(side: "w" | "b", losses: number[], label = "Good"): ReviewedPly[] {
  return losses.map((cpLoss, i) => ply(side, cpLoss, label, i + 1));
}

describe("estimateGameRating", () => {
  it("rates near-perfect play far higher than blunder-filled play", () => {
    const clean = estimateGameRating(plies("w", Array(20).fill(5), "Best"));
    const messy = estimateGameRating(plies("w", Array(20).fill(150), "Blunder"));
    expect(clean.w.rating).toBeGreaterThan(2400);
    expect(messy.w.rating).toBeLessThan(900);
  });

  it("scores each side independently", () => {
    const mixed = estimateGameRating([
      ...plies("w", Array(15).fill(8), "Best"),
      ...plies("b", Array(15).fill(90), "Mistake"),
    ]);
    expect(mixed.w.rating).toBeGreaterThan(mixed.b.rating + 500);
  });

  it("reports ACPL and snaps ratings to 50s", () => {
    const r = estimateGameRating(plies("w", Array(12).fill(20), "Excellent"));
    expect(r.w.acpl).toBe(20);
    expect(r.w.rating % 50).toBe(0);
    expect(r.w.moves).toBe(12);
  });

  it("handles empty input without crashing", () => {
    const r = estimateGameRating([]);
    expect(r.w.rating).toBe(0);
    expect(r.b.moves).toBe(0);
  });

  it("regresses very short games toward the middle", () => {
    const short = estimateGameRating(plies("w", [0, 0, 0], "Best"));
    const long = estimateGameRating(plies("w", Array(30).fill(0), "Best"));
    expect(short.w.rating).toBeLessThan(long.w.rating);
  });
});
