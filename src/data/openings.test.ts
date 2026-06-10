import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { OPENING_LINES } from "./openings";

describe("opening lines", () => {
  it("has unique ids", () => {
    const ids = OPENING_LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const line of OPENING_LINES) {
    it(`${line.id}: moves are legal and theory covers every ply`, () => {
      const board = new Chess();
      for (const san of line.moves) {
        let played: unknown = null;
        try {
          played = board.move(san);
        } catch {
          played = null;
        }
        expect(played, `illegal move "${san}" at ply ${board.history().length + 1} in ${line.id}`).toBeTruthy();
      }
      expect(line.theory.length, `${line.id} theory count must equal moves count`).toBe(line.moves.length);
      expect(line.summary.length).toBeGreaterThan(10);
    });
  }

  it("offers lines in every tier", () => {
    const tiers = new Set(OPENING_LINES.map((l) => l.tier));
    expect(tiers.has("free")).toBe(true);
    expect(tiers.has("pro")).toBe(true);
    expect(tiers.has("master")).toBe(true);
  });

  it("every family has at least one free line", () => {
    const families = new Set(OPENING_LINES.map((l) => l.family));
    for (const family of families) {
      const freeLines = OPENING_LINES.filter((l) => l.family === family && l.tier === "free");
      expect(freeLines.length, `${family} needs a free line`).toBeGreaterThan(0);
    }
  });
});
