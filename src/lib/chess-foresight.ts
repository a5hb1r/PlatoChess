/**
 * Tactical Foresight — PlatoChess's signature training overlay.
 *
 * Pure, engine-free geometry helpers that power the "Tactical Foresight" HUD:
 *   - the squares an enemy piece currently controls (red ghost dots),
 *   - the legal destinations of one of your own pieces (green ghost dots),
 *   - absolute/relative pins (a slider pinning a piece to its King or Queen).
 *
 * Everything is derived from the board occupancy of a FEN, so it stays fast
 * enough to recompute on every hover without touching Stockfish.
 */
import { Chess, type Square, type Color } from "chess.js";

const FILES = "abcdefgh";

export interface SquareCoord {
  /** 0-7 for files a-h */
  f: number;
  /** 0-7 for ranks 1-8 */
  r: number;
}

export function squareToCoord(sq: string): SquareCoord {
  return { f: FILES.indexOf(sq[0]), r: Number(sq[1]) - 1 };
}

export function coordToSquare(f: number, r: number): Square {
  return `${FILES[f]}${r + 1}` as Square;
}

function inBounds(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

const KNIGHT_OFFSETS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;

const KING_OFFSETS = [...ROOK_DIRS, ...BISHOP_DIRS];

/**
 * Every square a piece controls from `from`, including squares occupied by
 * friendly pieces (i.e. defended squares). Pawns return only their diagonal
 * attack squares — never their pushes — because control is what matters for
 * spatial awareness.
 */
export function attackedSquares(chess: Chess, from: Square): Square[] {
  const piece = chess.get(from);
  if (!piece) return [];

  const { f, r } = squareToCoord(from);
  const out: Square[] = [];

  const slide = (dirs: ReadonlyArray<readonly [number, number]>) => {
    for (const [df, dr] of dirs) {
      let nf = f + df;
      let nr = r + dr;
      while (inBounds(nf, nr)) {
        out.push(coordToSquare(nf, nr));
        if (chess.get(coordToSquare(nf, nr))) break; // blocked (square still counted as controlled)
        nf += df;
        nr += dr;
      }
    }
  };

  switch (piece.type) {
    case "p": {
      const dr = piece.color === "w" ? 1 : -1;
      for (const df of [-1, 1]) {
        const nf = f + df;
        const nr = r + dr;
        if (inBounds(nf, nr)) out.push(coordToSquare(nf, nr));
      }
      break;
    }
    case "n":
      for (const [df, dr] of KNIGHT_OFFSETS) {
        const nf = f + df;
        const nr = r + dr;
        if (inBounds(nf, nr)) out.push(coordToSquare(nf, nr));
      }
      break;
    case "k":
      for (const [df, dr] of KING_OFFSETS) {
        const nf = f + df;
        const nr = r + dr;
        if (inBounds(nf, nr)) out.push(coordToSquare(nf, nr));
      }
      break;
    case "b":
      slide(BISHOP_DIRS);
      break;
    case "r":
      slide(ROOK_DIRS);
      break;
    case "q":
      slide([...ROOK_DIRS, ...BISHOP_DIRS]);
      break;
  }

  return out;
}

/**
 * Legal destinations for the piece on `from`. When it is that piece's side to
 * move, this respects pins/checks via chess.js. Otherwise it falls back to the
 * raw controlled squares so the overlay still teaches the piece's reach.
 */
export function legalOrControlledMoves(fen: string, from: Square): Square[] {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece) return [];

  if (piece.color === chess.turn()) {
    return chess.moves({ square: from, verbose: true }).map((m) => m.to as Square);
  }
  return attackedSquares(chess, from);
}

export interface Pin {
  /** The pinned (immobilized) piece. */
  pinned: Square;
  /** The enemy slider doing the pinning. */
  attacker: Square;
  /** The high-value piece behind the pin. */
  target: Square;
  /** Whether the piece is pinned to the King (absolute) or Queen (relative). */
  targetType: "k" | "q";
}

/**
 * Find every pin against `color`'s pieces — both absolute (to the King) and
 * relative (to the Queen). Works by scanning outward from each high-value
 * target along the rays a slider could travel; the first friendly piece is the
 * pin candidate and, if the very next piece is an enemy slider of the matching
 * ray type, the candidate is pinned.
 */
export function findPins(chess: Chess, color: Color): Pin[] {
  const pins: Pin[] = [];
  const board = chess.board();

  const targets: { sq: Square; type: "k" | "q" }[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.color === color && (cell.type === "k" || cell.type === "q")) {
        targets.push({ sq: cell.square as Square, type: cell.type });
      }
    }
  }

  for (const target of targets) {
    const { f: tf, r: tr } = squareToCoord(target.sq);

    const scanDir = (df: number, dr: number, sliderTypes: ReadonlyArray<string>) => {
      let nf = tf + df;
      let nr = tr + dr;
      let candidate: Square | null = null;

      while (inBounds(nf, nr)) {
        const sq = coordToSquare(nf, nr);
        const piece = chess.get(sq);
        if (piece) {
          if (!candidate) {
            // First piece from the target must be a friendly, non-king blocker.
            if (piece.color !== color || piece.type === "k") return;
            candidate = sq;
          } else {
            // Second piece must be an enemy slider of the matching ray type.
            if (piece.color !== color && sliderTypes.includes(piece.type)) {
              pins.push({
                pinned: candidate,
                attacker: sq,
                target: target.sq,
                targetType: target.type,
              });
            }
            return;
          }
        }
        nf += df;
        nr += dr;
      }
    };

    for (const [df, dr] of ROOK_DIRS) scanDir(df, dr, ["r", "q"]);
    for (const [df, dr] of BISHOP_DIRS) scanDir(df, dr, ["b", "q"]);
  }

  return pins;
}

/** Convenience lookup: is the piece on `square` pinned (and how)? */
export function pinForSquare(pins: Pin[], square: Square): Pin | null {
  // Prefer the absolute (king) pin if a piece is pinned to multiple targets.
  const matches = pins.filter((p) => p.pinned === square);
  if (matches.length === 0) return null;
  return matches.find((p) => p.targetType === "k") ?? matches[0];
}
