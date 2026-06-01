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
  const isSacrifice = !isCapture && /[QRBN]/.test(playedMove.san) && cpLoss <= 24;

  // Eval from the moving side's point of view (positive = good for the mover).
  const beforeForSide = side === "w" ? beforeCp : -beforeCp;
  const afterForSide = side === "w" ? afterCp : -afterCp;
  const beforeMateForSide =
    beforeProbe.mate !== undefined && beforeProbe.mate !== 0
      ? side === "w"
        ? beforeProbe.mate
        : -beforeProbe.mate
      : undefined;

  if ((isSacrifice || (isCheck && cpLoss <= 20)) && cpLoss <= 24) {
    return { label: "Brilliant", color: "text-[#14b8a6] font-semibold", cpLoss, bestMove: bestMoveUci };
  }
  // Missed win: the side was clearly winning (or had a forced mate) and let
  // most of that advantage slip. Flagged distinctly from a plain mistake.
  if (
    cpLoss >= 130 &&
    ((beforeForSide >= 250 && afterForSide < 120) ||
      (beforeMateForSide !== undefined && beforeMateForSide > 0))
  ) {
    return { label: "Miss", color: "text-[#f97316]", cpLoss, bestMove: bestMoveUci };
  }
  // Great: the precise, often only move that holds a difficult or worse
  // position together (matches the engine's top choice while under pressure).
  if (isBest && beforeForSide <= -40 && cpLoss <= 15) {
    return { label: "Great", color: "text-[#1d4ed8]", cpLoss, bestMove: bestMoveUci };
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
