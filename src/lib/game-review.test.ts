import { describe, expect, it } from "vitest";
import {
  formatPerformanceReport,
  resultBannerForSide,
  summarizeMoveClassifications,
} from "./game-review";

describe("summarizeMoveClassifications", () => {
  const moves = [
    { label: "Brilliant", side: "w" as const },
    { label: "Best", side: "w" as const },
    { label: "Best", side: "b" as const },
    { label: "Blunder", side: "w" as const },
    { label: "Good", side: "b" as const },
    { label: "Miss", side: "w" as const }, // not part of the report categories
  ];

  it("counts all classifications across both sides", () => {
    const counts = summarizeMoveClassifications(moves);
    expect(counts.Brilliant).toBe(1);
    expect(counts.Best).toBe(2);
    expect(counts.Blunder).toBe(1);
    expect(counts.Good).toBe(1);
    expect(counts.Great).toBe(0);
  });

  it("restricts counting to a single side when requested", () => {
    const white = summarizeMoveClassifications(moves, "w");
    expect(white.Best).toBe(1);
    expect(white.Brilliant).toBe(1);
    expect(white.Good).toBe(0);
  });
});

describe("resultBannerForSide", () => {
  it("maps results from the player's perspective", () => {
    expect(resultBannerForSide("White wins by checkmate!", "w")).toBe("WIN");
    expect(resultBannerForSide("White wins by checkmate!", "b")).toBe("LOSS");
    expect(resultBannerForSide("Black wins by checkmate!", "b")).toBe("WIN");
    expect(resultBannerForSide("Draw by stalemate.", "w")).toBe("DRAW");
    expect(resultBannerForSide("Draw by the 50-move rule.")).toBe("DRAW");
  });
});

describe("formatPerformanceReport", () => {
  it("renders the exact spec layout", () => {
    const counts = summarizeMoveClassifications([
      { label: "Brilliant" },
      { label: "Best" },
      { label: "Best" },
      { label: "Inaccuracy" },
    ]);
    const report = formatPerformanceReport("WIN", counts);
    expect(report).toBe(
      [
        "[GAME OVER: WIN]",
        "------------------------------------",
        "POST-GAME MOVE ANALYSIS REPORT",
        "------------------------------------",
        "Brilliant (!!) : 1",
        "Great Move (*) : 0",
        "Best Move      : 2",
        "Excellent      : 0",
        "Good           : 0",
        "Inaccuracy (?) : 1",
        "Mistake (?)    : 0",
        "Blunder (??)   : 0",
      ].join("\n")
    );
  });
});
