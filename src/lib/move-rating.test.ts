import { describe, expect, it } from "vitest";
import { rateMoveLikeChessCom, rateWhiteMoveLoss, uiEvalToCp } from "./move-rating";
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
});
