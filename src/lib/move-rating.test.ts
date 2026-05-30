import { describe, expect, it } from "vitest";
import {
  brilliancyVerdictForLevel,
  moveIsSacrifice,
  rateMoveLikeChessCom,
  rateWhiteMoveLoss,
  uiEvalToCp,
} from "./move-rating";
import type { Move } from "chess.js";

function mockMove(san: string, captured = false): Move {
  return {
    san,
    from: "e2",
    to: "e4",
    promotion: undefined,
    captured: captured ? "p" : undefined,
  } as Move;
}

describe("uiEvalToCp", () => {
  it("passes through normal centipawns", () => {
    expect(uiEvalToCp(45)).toBe(45);
    expect(uiEvalToCp(-120)).toBe(-120);
  });
});

describe("rateWhiteMoveLoss", () => {
  it("labels non-positive loss as best", () => {
    const r = rateWhiteMoveLoss(40, { score: 45 }, mockMove("e4"));
    expect(r.label).toBe("Best");
  });

  it("labels large loss as blunder", () => {
    const r = rateWhiteMoveLoss(200, { score: -50 }, mockMove("Qxh8"));
    expect(r.label).toBe("Blunder");
  });

  it("labels moderate loss as inaccuracy", () => {
    const r = rateWhiteMoveLoss(100, { score: 40 }, mockMove("Nd2"));
    expect(r.label).toBe("Inaccuracy");
  });
});

describe("rateMoveLikeChessCom", () => {
  it("labels best when move equals engine best", () => {
    const mv = { ...mockMove("e4"), from: "e2", to: "e4" } as Move;
    const r = rateMoveLikeChessCom("w", { score: 20 }, { score: 18 }, mv, "e2e4");
    expect(r.label).toBe("Best");
  });

  it("labels blunder on huge cp loss", () => {
    const mv = { ...mockMove("Qh5"), from: "d1", to: "h5" } as Move;
    const r = rateMoveLikeChessCom("w", { score: 120 }, { score: -140 }, mv, "e2e4");
    expect(r.label).toBe("Blunder");
  });

  it("flags low-level position-maintaining sacrifices as Brilliant", () => {
    const mv = { ...mockMove("Nxe7"), from: "d5", to: "e7" } as Move;
    const r = rateMoveLikeChessCom("w", { score: 30 }, { score: 30 }, mv, "d5e7", {
      playerElo: 800,
      isSacrifice: true,
    });
    expect(r.label).toBe("Brilliant");
  });

  it("downgrades a visible high-level sacrifice to Best", () => {
    const mv = { ...mockMove("Nxe7"), from: "d5", to: "e7" } as Move;
    const r = rateMoveLikeChessCom("w", { score: 30 }, { score: 30 }, mv, "g1f3", {
      playerElo: 1600,
      isSacrifice: true,
      isOnlyGoodMove: false,
    });
    expect(r.label).toBe("Best");
  });

  it("keeps a uniquely-best high-level sacrifice as Brilliant", () => {
    const mv = { ...mockMove("Nxe7"), from: "d5", to: "e7" } as Move;
    const r = rateMoveLikeChessCom("w", { score: 30 }, { score: 30 }, mv, "d5e7", {
      playerElo: 1600,
      isSacrifice: true,
      isOnlyGoodMove: true,
    });
    expect(r.label).toBe("Brilliant");
  });
});

describe("brilliancyVerdictForLevel", () => {
  it("treats any qualifying sacrifice as brilliant for low-level players", () => {
    expect(brilliancyVerdictForLevel(800, false)).toBe("brilliant");
    expect(brilliancyVerdictForLevel(1199, false)).toBe("brilliant");
  });

  it("requires the only winning move for high-level players", () => {
    expect(brilliancyVerdictForLevel(1200, false)).toBe("best");
    expect(brilliancyVerdictForLevel(1600, true)).toBe("brilliant");
  });

  it("defaults to brilliant when no Elo is provided", () => {
    expect(brilliancyVerdictForLevel(undefined, false)).toBe("brilliant");
  });
});

describe("moveIsSacrifice", () => {
  it("detects giving up a knight for a pawn on a recapturable square", () => {
    expect(moveIsSacrifice("4k3/4p3/8/3N4/8/8/8/4K3 w - - 0 1", { from: "d5", to: "e7" })).toBe(true);
  });

  it("does not flag an even trade", () => {
    expect(moveIsSacrifice("4k3/4n3/8/3N4/8/8/8/4K3 w - - 0 1", { from: "d5", to: "e7" })).toBe(false);
  });

  it("does not flag a piece moving to a safe square", () => {
    expect(moveIsSacrifice("4k3/8/8/3N4/8/8/8/4K3 w - - 0 1", { from: "d5", to: "f4" })).toBe(false);
  });

  it("does not flag pawn moves", () => {
    expect(moveIsSacrifice("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", { from: "e2", to: "e4" })).toBe(false);
  });
});
