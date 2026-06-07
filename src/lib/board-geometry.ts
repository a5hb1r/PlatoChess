/**
 * Pure board-geometry helpers shared by the interactive boards.
 *
 * These encode the invariants the UI relies on:
 *  - White sits on ranks 1-2, Black on ranks 7-8 (chess.js default position).
 *  - From White's perspective the bottom-right square (h1) is a light square.
 *  - Standard orientation renders rank 8 at the top row and rank 1 at the bottom.
 */
import type { Square } from "chess.js";

/**
 * Map a grid cell (row 0 = top, col 0 = left) to an algebraic square.
 * When `flipped` is true the board is shown from Black's perspective.
 */
export function squareFromRowCol(row: number, col: number, flipped = false): Square {
  const displayRow = flipped ? 7 - row : row;
  const displayCol = flipped ? 7 - col : col;
  const file = String.fromCharCode(97 + displayCol); // 'a'..'h'
  const rank = 8 - displayRow; // 8..1
  return `${file}${rank}` as Square;
}

/**
 * A square is dark when the sum of its zero-based file and rank index is even.
 * (a1 -> 0+0 = 0 -> dark; h1 -> 7+0 = 7 -> light.)
 */
export function isDarkSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 97; // 0..7
  const rank = parseInt(square[1], 10) - 1; // 0..7
  return (file + rank) % 2 === 0;
}
