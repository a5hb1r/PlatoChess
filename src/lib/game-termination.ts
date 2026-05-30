import type { Chess } from "chess.js";

export type TerminationReason =
  | "checkmate"
  | "stalemate"
  | "threefold-repetition"
  | "fifty-move-rule"
  | "insufficient-material"
  | "draw";

export interface GameTermination {
  over: boolean;
  /** Human-readable result message. Checkmate messages keep the "White wins"/"Black wins" prefix. */
  message: string | null;
  reason: TerminationReason | null;
  isDraw: boolean;
}

const NOT_OVER: GameTermination = { over: false, message: null, reason: null, isDraw: false };

/**
 * Classify how (and whether) a game has ended, declaring the precise draw type
 * per spec Section 2. Draw reasons are evaluated in a fixed precedence so a
 * stalemate is never reported as a generic draw and the 50-move rule is only
 * reported once the more specific draw conditions are ruled out.
 */
export function describeGameTermination(game: Chess): GameTermination {
  if (game.isCheckmate()) {
    const message = game.turn() === "w" ? "Black wins by checkmate!" : "White wins by checkmate!";
    return { over: true, message, reason: "checkmate", isDraw: false };
  }

  if (game.isStalemate()) {
    return { over: true, message: "Draw by stalemate.", reason: "stalemate", isDraw: true };
  }

  if (game.isInsufficientMaterial()) {
    return {
      over: true,
      message: "Draw by insufficient material.",
      reason: "insufficient-material",
      isDraw: true,
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      over: true,
      message: "Draw by threefold repetition.",
      reason: "threefold-repetition",
      isDraw: true,
    };
  }

  if (game.isDraw()) {
    // isDraw() also covers the conditions handled above; anything left is the 50-move rule.
    return { over: true, message: "Draw by the 50-move rule.", reason: "fifty-move-rule", isDraw: true };
  }

  return NOT_OVER;
}
