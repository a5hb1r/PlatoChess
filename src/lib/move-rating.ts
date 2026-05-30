import { Chess, type Color, type Move, type PieceSymbol } from "chess.js";

/** Elo at/above which a player is treated as "high level" for brilliancy scaling. */
export const BRILLIANT_ELO_THRESHOLD = 1200;

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Static, level-independent detection of a piece sacrifice (spec Section 3).
 *
 * A move counts as a sacrifice when a non-pawn piece is placed on a square where
 * the opponent can capture it, and the material gained on the move is strictly
 * less than the value of the piece committed (i.e. material is given up). Equal
 * or material-winning captures are not sacrifices.
 */
export function moveIsSacrifice(fenBefore: string, move: Pick<Move, "from" | "to" | "promotion">): boolean {
  const board = new Chess();
  try {
    board.load(fenBefore);
  } catch {
    return false;
  }
  const piece = board.get(move.from as Move["from"]);
  if (!piece) return false;
  const movedType = piece.type;
  if (movedType === "p" || movedType === "k") return false; // only piece sacrifices

  const result = board.move({ from: move.from, to: move.to, promotion: move.promotion });
  if (!result) return false;

  const gained = result.captured ? PIECE_VALUE[result.captured] : 0;
  const movedValue = PIECE_VALUE[movedType];
  if (gained >= movedValue) return false; // even trade or winning capture, not a sacrifice

  // After our move it is the opponent's turn; can they capture the committed piece?
  const recaptureExists = board
    .moves({ verbose: true })
    .some((m) => m.to === move.to && !!m.captured);
  return recaptureExists;
}

/**
 * Decide the brilliancy verdict for a confirmed, position-maintaining sacrifice,
 * scaled by the player's Elo (spec Section 3).
 *
 * - Below the threshold: any such sacrifice is Brilliant (hard to spot at low level).
 * - At/above the threshold: only the uniquely best (only winning/saving) sacrifice
 *   is Brilliant; standard/visible sacrifices are downgraded to a Best move.
 */
export function brilliancyVerdictForLevel(
  playerElo: number | undefined,
  isOnlyGoodMove: boolean
): "brilliant" | "best" {
  if (playerElo === undefined || playerElo < BRILLIANT_ELO_THRESHOLD) return "brilliant";
  return isOnlyGoodMove ? "brilliant" : "best";
}

/** Map UI eval (may use 9999 for mate) to comparable centipawn scale (white = positive). */
export function uiEvalToCp(evalVal: number): number {
  if (evalVal >= 9000) return 32000 - Math.min(Math.abs(evalVal), 9999);
  if (evalVal <= -9000) return -32000 + Math.min(Math.abs(evalVal), 9999);
  return evalVal;
}

/** Normalize Stockfish probe result to same CP scale as `uiEvalToCp`. */
export function probeResultToCp(r: { score?: number; mate?: number }): number {
  if (r.mate !== undefined && r.mate !== 0) {
    return r.mate > 0 ? 32000 - r.mate * 80 : -32000 + Math.abs(r.mate) * 80;
  }
  return r.score ?? 0;
}

export type MoveRating = { label: string; color: string };

export type RatedMove = MoveRating & {
  cpLoss: number;
  bestMove?: string;
};

/**
 * White's centipawn loss after their move (eval before, white to move vs after, black to move).
 * Both should be white-positive CP on the same approximate scale.
 */
export function rateWhiteMoveLoss(beforeUi: number, afterProbe: { score?: number; mate?: number }, move: Move): MoveRating {
  const before = uiEvalToCp(beforeUi);
  const after = probeResultToCp(afterProbe);
  const loss = before - after;

  const wasSac = !!move.captured || move.san.includes("x");

  if (loss < -60 && wasSac) {
    return { label: "Brilliant", color: "text-foreground font-semibold" };
  }
  if (loss <= 0) {
    return { label: "Best", color: "text-foreground/90" };
  }
  if (loss <= 12) {
    return { label: "Excellent", color: "text-muted-foreground" };
  }
  if (loss <= 35) {
    return { label: "Good", color: "text-muted-foreground/90" };
  }
  if (loss <= 70) {
    return { label: "Inaccuracy", color: "text-foreground/70" };
  }
  if (loss <= 150) {
    return { label: "Mistake", color: "text-foreground/55" };
  }
  return { label: "Blunder", color: "text-destructive" };
}

function cpLossForSide(beforeCpWhite: number, afterCpWhite: number, side: Color): number {
  // White wants eval up; Black wants eval down.
  const raw = side === "w" ? beforeCpWhite - afterCpWhite : afterCpWhite - beforeCpWhite;
  return Math.max(0, raw);
}

/**
 * Chess.com-style coarse labeling (post-game analysis).
 * Not identical to proprietary logic, but intentionally similar UX semantics.
 */
export interface MoveRatingOptions {
  /** Player Elo, used to scale the brilliancy threshold (spec Section 3). */
  playerElo?: number;
  /** Whether the played move is the unique best (only winning/saving) move. */
  isOnlyGoodMove?: boolean;
  /** Pre-computed sacrifice flag (overrides the internal heuristic when provided). */
  isSacrifice?: boolean;
}

export function rateMoveLikeChessCom(
  side: Color,
  beforeProbe: { score?: number; mate?: number },
  afterProbe: { score?: number; mate?: number },
  playedMove: Move,
  bestMoveUci?: string,
  options?: MoveRatingOptions
): RatedMove {
  const beforeCp = probeResultToCp(beforeProbe);
  const afterCp = probeResultToCp(afterProbe);
  const cpLoss = cpLossForSide(beforeCp, afterCp, side);

  const playedUci = `${playedMove.from}${playedMove.to}${playedMove.promotion ?? ""}`;
  const isBest = !!bestMoveUci && playedUci === bestMoveUci;
  const isCheck = playedMove.san.includes("+") || playedMove.san.includes("#");
  const isCapture = playedMove.san.includes("x");

  // Level-dependent brilliancy (spec Section 3): when a player Elo is supplied we
  // classify a position-maintaining piece sacrifice relative to the player's level.
  if (options?.playerElo !== undefined) {
    const isSacrifice = options.isSacrifice ?? false;
    if (isSacrifice && cpLoss <= 30) {
      const verdict = brilliancyVerdictForLevel(
        options.playerElo,
        options.isOnlyGoodMove ?? isBest
      );
      if (verdict === "brilliant") {
        return { label: "Brilliant", color: "text-foreground font-semibold", cpLoss, bestMove: bestMoveUci };
      }
      return { label: "Best", color: "text-foreground", cpLoss, bestMove: bestMoveUci };
    }
  }

  const isSacrifice = !isCapture && /[QRBN]/.test(playedMove.san) && cpLoss <= 24;

  if ((isSacrifice || (isCheck && cpLoss <= 20)) && cpLoss <= 24) {
    return { label: "Brilliant", color: "text-foreground font-semibold", cpLoss, bestMove: bestMoveUci };
  }
  if (isBest || cpLoss <= 10) {
    return { label: "Best", color: "text-foreground", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 30) {
    return { label: "Excellent", color: "text-muted-foreground", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 60) {
    return { label: "Good", color: "text-muted-foreground/90", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 110) {
    return { label: "Inaccuracy", color: "text-foreground/70", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 190) {
    return { label: "Mistake", color: "text-foreground/55", cpLoss, bestMove: bestMoveUci };
  }
  return { label: "Blunder", color: "text-destructive", cpLoss, bestMove: bestMoveUci };
}
