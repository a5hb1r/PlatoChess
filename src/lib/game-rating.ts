/**
 * Estimated game performance rating, Chess.com-style.
 *
 * Chess.com's "Game Rating" estimates how strongly each side played in a
 * single game. Our estimate blends two signals from the review pass:
 *   1. Average centipawn loss (ACPL) — the classic engine-strength proxy.
 *   2. Error density — blunders/mistakes per move hurt more than the same
 *      centipawns spread thinly across a long game.
 */
import type { ReviewedPly } from "@/lib/game-review";

/** Piecewise ACPL → Elo anchor curve (interpolated linearly between points). */
const ACPL_RATING_CURVE: Array<[acpl: number, rating: number]> = [
  [0, 3200],
  [5, 2900],
  [10, 2650],
  [15, 2450],
  [20, 2300],
  [25, 2150],
  [35, 1900],
  [45, 1650],
  [60, 1400],
  [80, 1100],
  [100, 900],
  [130, 650],
  [170, 450],
  [250, 250],
];

function ratingFromAcpl(acpl: number): number {
  if (acpl <= ACPL_RATING_CURVE[0][0]) return ACPL_RATING_CURVE[0][1];
  for (let i = 1; i < ACPL_RATING_CURVE.length; i++) {
    const [hiAcpl, hiRating] = ACPL_RATING_CURVE[i];
    if (acpl <= hiAcpl) {
      const [loAcpl, loRating] = ACPL_RATING_CURVE[i - 1];
      const t = (acpl - loAcpl) / (hiAcpl - loAcpl);
      return loRating + t * (hiRating - loRating);
    }
  }
  return ACPL_RATING_CURVE[ACPL_RATING_CURVE.length - 1][1];
}

/** Cap a single ply's loss so one catastrophic blunder doesn't dominate ACPL. */
const PER_MOVE_CP_CAP = 350;

export interface SideGameRating {
  /** Estimated single-game performance rating. */
  rating: number;
  /** Average centipawn loss used for the estimate. */
  acpl: number;
  /** Moves rated for this side. */
  moves: number;
}

export interface GameRatingEstimate {
  w: SideGameRating;
  b: SideGameRating;
}

function estimateSide(plies: ReviewedPly[]): SideGameRating {
  if (plies.length === 0) return { rating: 0, acpl: 0, moves: 0 };

  const losses = plies.map((p) => Math.min(Math.max(0, p.cpLoss), PER_MOVE_CP_CAP));
  const acpl = losses.reduce((sum, x) => sum + x, 0) / losses.length;

  let rating = ratingFromAcpl(acpl);

  // Error-density adjustment: each blunder/mistake beyond what the ACPL curve
  // already prices in drags the estimate down; a clean game nudges it up.
  const blunders = plies.filter((p) => p.label === "Blunder").length;
  const mistakes = plies.filter((p) => p.label === "Mistake" || p.label === "Miss").length;
  const perMovePenalty = (blunders * 150 + mistakes * 60) / plies.length;
  rating -= Math.min(300, perMovePenalty * 10);
  if (blunders === 0 && mistakes === 0 && plies.length >= 10) rating += 50;

  // Short games carry little signal — regress toward the middle of the pool.
  if (plies.length < 10) {
    const t = plies.length / 10;
    rating = 1200 + (rating - 1200) * t;
  }

  return {
    rating: Math.round(Math.max(100, Math.min(3500, rating)) / 50) * 50,
    acpl: Number(acpl.toFixed(1)),
    moves: plies.length,
  };
}

/** Estimate both sides' single-game performance ratings from reviewed plies. */
export function estimateGameRating(moves: ReviewedPly[]): GameRatingEstimate {
  return {
    w: estimateSide(moves.filter((m) => m.side === "w")),
    b: estimateSide(moves.filter((m) => m.side === "b")),
  };
}
