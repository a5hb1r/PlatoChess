import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { isDarkSquare, squareFromRowCol } from "./board-geometry";

describe("board geometry", () => {
  it("maps the four corners correctly in standard orientation", () => {
    expect(squareFromRowCol(0, 0)).toBe("a8"); // top-left
    expect(squareFromRowCol(0, 7)).toBe("h8"); // top-right
    expect(squareFromRowCol(7, 0)).toBe("a1"); // bottom-left
    expect(squareFromRowCol(7, 7)).toBe("h1"); // bottom-right
  });

  it("flips the board for Black's perspective", () => {
    expect(squareFromRowCol(0, 0, true)).toBe("h1");
    expect(squareFromRowCol(7, 7, true)).toBe("a8");
  });

  it("renders h1 (White's bottom-right) as a light square", () => {
    expect(isDarkSquare("h1")).toBe(false);
    expect(isDarkSquare("a1")).toBe(true);
    expect(isDarkSquare("a8")).toBe(false);
    expect(isDarkSquare("h8")).toBe(true);
  });
});

describe("starting position invariants", () => {
  const game = new Chess();

  it("places White on ranks 1-2 and Black on ranks 7-8", () => {
    const board = game.board();
    for (const square of ["a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1"] as const) {
      expect(game.get(square)?.color).toBe("w");
    }
    for (const square of ["a2", "h2"] as const) {
      expect(game.get(square)).toMatchObject({ type: "p", color: "w" });
    }
    for (const square of ["a8", "h8"] as const) {
      expect(game.get(square)?.color).toBe("b");
    }
    for (const square of ["a7", "h7"] as const) {
      expect(game.get(square)).toMatchObject({ type: "p", color: "b" });
    }
    // Sanity: no pieces on the middle ranks.
    expect(board[3].every((cell) => cell === null)).toBe(true);
    expect(board[4].every((cell) => cell === null)).toBe(true);
  });

  it("starts the queens on their own color (Qd1 white, Qd8 black)", () => {
    expect(game.get("d1")).toMatchObject({ type: "q", color: "w" });
    expect(game.get("d8")).toMatchObject({ type: "q", color: "b" });
  });

  it("starts kings on e1 / e8", () => {
    expect(game.get("e1")?.type).toBe("k");
    expect(game.get("e8")?.type).toBe("k");
  });
});
