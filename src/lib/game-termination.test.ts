import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { describeGameTermination } from "./game-termination";

describe("describeGameTermination", () => {
  it("reports an ongoing game as not over", () => {
    const t = describeGameTermination(new Chess());
    expect(t.over).toBe(false);
    expect(t.reason).toBeNull();
  });

  it("declares checkmate with the winning side", () => {
    // Fool's mate: White is checkmated, White to move.
    const game = new Chess("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    const t = describeGameTermination(game);
    expect(t.reason).toBe("checkmate");
    expect(t.message).toBe("Black wins by checkmate!");
    expect(t.isDraw).toBe(false);
  });

  it("declares stalemate as a draw", () => {
    const game = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    const t = describeGameTermination(game);
    expect(t.reason).toBe("stalemate");
    expect(t.isDraw).toBe(true);
  });

  it("declares insufficient material (K vs K)", () => {
    const t = describeGameTermination(new Chess("8/8/8/4k3/8/8/4K3/8 w - - 0 1"));
    expect(t.reason).toBe("insufficient-material");
    expect(t.isDraw).toBe(true);
  });

  it("declares insufficient material (K+B vs K)", () => {
    const t = describeGameTermination(new Chess("8/8/8/4k3/8/5B2/4K3/8 w - - 0 1"));
    expect(t.reason).toBe("insufficient-material");
  });

  it("declares the 50-move rule when the halfmove clock is exhausted", () => {
    const t = describeGameTermination(new Chess("8/8/4k3/8/8/3QK3/8/8 w - - 100 80"));
    expect(t.reason).toBe("fifty-move-rule");
    expect(t.isDraw).toBe(true);
  });

  it("declares threefold repetition", () => {
    const game = new Chess();
    for (const san of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]) {
      game.move(san);
    }
    const t = describeGameTermination(game);
    expect(t.reason).toBe("threefold-repetition");
    expect(t.isDraw).toBe(true);
  });
});
