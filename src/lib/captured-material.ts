/**
 * Material accounting for the captured-pieces indicators shown beside each
 * player banner. Derives both the list of captured piece types and the running
 * point differential straight from a FEN, so it always matches the live board
 * (including after promotions, where the differential is computed from the
 * pieces actually on the board rather than naive "missing piece" counts).
 */
import { Chess, type PieceSymbol, type Color } from "chess.js";

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const INITIAL_COUNTS: Record<PieceSymbol, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};

/** Display order for captured piece rows (least to most valuable). */
export const CAPTURE_ORDER: PieceSymbol[] = ["p", "n", "b", "r", "q"];

export interface MaterialState {
  /** Black pieces white has captured (rendered next to the White player). */
  capturedByWhite: PieceSymbol[];
  /** White pieces black has captured (rendered next to the Black player). */
  capturedByBlack: PieceSymbol[];
  /** Point differential from White's perspective (positive = White ahead). */
  diff: number;
}

export function computeMaterial(fen: string): MaterialState {
  const chess = new Chess(fen);
  const board = chess.board();

  const counts: Record<Color, Record<PieceSymbol, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  let whitePoints = 0;
  let blackPoints = 0;

  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      counts[cell.color][cell.type] += 1;
      const value = PIECE_VALUES[cell.type];
      if (cell.color === "w") whitePoints += value;
      else blackPoints += value;
    }
  }

  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];

  for (const type of CAPTURE_ORDER) {
    const missingBlack = Math.max(0, INITIAL_COUNTS[type] - counts.b[type]);
    const missingWhite = Math.max(0, INITIAL_COUNTS[type] - counts.w[type]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(type);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(type);
  }

  return {
    capturedByWhite,
    capturedByBlack,
    diff: whitePoints - blackPoints,
  };
}
