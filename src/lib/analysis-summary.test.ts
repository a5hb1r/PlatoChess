import { describe, expect, it } from "vitest";
import type { ReviewedPly } from "@/lib/game-review";
import {
  MOVE_QUALITY_ORDER,
  buildEvaluationPhases,
  describeEval,
  summarizeMoveClassifications,
} from "./analysis-summary";

function ply(partial: Partial<ReviewedPly> & { ply: number; label: string }): ReviewedPly {
  return {
    side: "w",
    san: "e4",
    colorClass: "",
    cpLoss: 0,
    playedUci: "e2e4",
    fenBefore: "",
    fenAfter: "",
    ...partial,
  } as ReviewedPly;
}

describe("summarizeMoveClassifications", () => {
  it("returns every quality bucket in display order with zeroed defaults", () => {
    const rows = summarizeMoveClassifications([]);
    expect(rows.map((r) => r.label)).toEqual(MOVE_QUALITY_ORDER.map((m) => m.label));
    expect(rows.every((r) => r.total === 0 && r.white === 0 && r.black === 0)).toBe(true);
  });

  it("tallies counts split by side", () => {
    const rows = summarizeMoveClassifications([
      ply({ ply: 1, label: "Best", side: "w" }),
      ply({ ply: 2, label: "Blunder", side: "b" }),
      ply({ ply: 3, label: "Best", side: "w" }),
      ply({ ply: 4, label: "Best", side: "b" }),
    ]);
    const best = rows.find((r) => r.label === "Best")!;
    const blunder = rows.find((r) => r.label === "Blunder")!;
    expect(best.total).toBe(3);
    expect(best.white).toBe(2);
    expect(best.black).toBe(1);
    expect(blunder.total).toBe(1);
    expect(blunder.black).toBe(1);
  });
});

describe("describeEval", () => {
  it("formats centipawns with a sign", () => {
    expect(describeEval(40)).toBe("+0.4");
    expect(describeEval(-210)).toBe("-2.1");
  });

  it("decodes white and black forced mates", () => {
    expect(describeEval(32000 - 3 * 80)).toBe("M3");
    expect(describeEval(-32000 + 2 * 80)).toBe("-M2");
  });
});

describe("buildEvaluationPhases", () => {
  it("returns three not-reached phases for an empty game", () => {
    const phases = buildEvaluationPhases([]);
    expect(phases.map((p) => p.name)).toEqual(["Opening", "Middlegame", "Endgame"]);
    expect(phases.every((p) => !p.present)).toBe(true);
  });

  it("splits moves into phases and surfaces the worst error", () => {
    const moves: ReviewedPly[] = [];
    for (let i = 1; i <= 9; i++) {
      moves.push(ply({ ply: i, label: "Best", evalAfterCp: 30 }));
    }
    // Inject a middlegame blunder at ply 5 (full move 3) for Black.
    moves[4] = ply({ ply: 5, label: "Blunder", side: "b", cpLoss: 400, san: "Qd7", evalAfterCp: -250 });
    const phases = buildEvaluationPhases(moves);
    expect(phases[1].note).toContain("Blunder by Black on move 3");
    expect(phases[1].present).toBe(true);
  });
});
