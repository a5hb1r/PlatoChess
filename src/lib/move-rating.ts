import type { Color, Move } from "chess.js";

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
export function rateMoveLikeChessCom(
  side: Color,
  beforeProbe: { score?: number; mate?: number },
  afterProbe: { score?: number; mate?: number },
  playedMove: Move,
  bestMoveUci?: string
): RatedMove {
  const beforeCp = probeResultToCp(beforeProbe);
  const afterCp = probeResultToCp(afterProbe);
  const cpLoss = cpLossForSide(beforeCp, afterCp, side);

  const playedUci = `${playedMove.from}${playedMove.to}${playedMove.promotion ?? ""}`;
  const isBest = !!bestMoveUci && playedUci === bestMoveUci;
  const isCheck = playedMove.san.includes("+") || playedMove.san.includes("#");
  const isCapture = playedMove.san.includes("x");
  const isSacrifice = !isCapture && /[QRBN]/.test(playedMove.san) && cpLoss <= 20;

  if (isBest || cpLoss <= 8) {
    return { label: "Best", color: "text-foreground", cpLoss, bestMove: bestMoveUci };
  }
  if ((isSacrifice || (isCheck && cpLoss <= 15)) && cpLoss <= 20) {
    return { label: "Brilliant", color: "text-foreground font-semibold", cpLoss, bestMove: bestMoveUci };
  }
  if (isCheck && cpLoss <= 22) {
    return { label: "Great", color: "text-foreground/90", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 25) {
    return { label: "Excellent", color: "text-muted-foreground", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 45) {
    return { label: "Good", color: "text-muted-foreground/90", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 90) {
    return { label: "Inaccuracy", color: "text-foreground/70", cpLoss, bestMove: bestMoveUci };
  }
  // "Miss" = missed tactical/strategic chance, between inaccuracy and full blunder.
  if (cpLoss <= 140 && !isCapture) {
    return { label: "Miss", color: "text-foreground/65", cpLoss, bestMove: bestMoveUci };
  }
  if (cpLoss <= 180) {
    return { label: "Mistake", color: "text-foreground/55", cpLoss, bestMove: bestMoveUci };
  }
  return { label: "Blunder", color: "text-destructive", cpLoss, bestMove: bestMoveUci };
}
