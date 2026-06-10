import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { FAMOUS_GAMES } from "./famous-games";

describe("famous games library", () => {
  it("has unique ids", () => {
    const ids = FAMOUS_GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const game of FAMOUS_GAMES) {
    it(`${game.id}: every move is legal`, () => {
      const board = new Chess();
      for (const san of game.moves) {
        let played: unknown = null;
        try {
          played = board.move(san);
        } catch {
          played = null;
        }
        expect(played, `illegal move "${san}" at ply ${board.history().length + 1} in ${game.id}`).toBeTruthy();
      }
      expect(board.history().length).toBe(game.moves.length);
    });
  }

  it("checkmate games actually end in mate", () => {
    for (const game of FAMOUS_GAMES) {
      const lastMove = game.moves[game.moves.length - 1];
      if (!lastMove.endsWith("#")) continue;
      const board = new Chess();
      for (const san of game.moves) board.move(san);
      expect(board.isCheckmate(), `${game.id} should end in checkmate`).toBe(true);
    }
  });

  it("covers all three tiers", () => {
    const tiers = new Set(FAMOUS_GAMES.map((g) => g.tier));
    expect(tiers.has("free")).toBe(true);
    expect(tiers.has("pro")).toBe(true);
    expect(tiers.has("master")).toBe(true);
  });
});
