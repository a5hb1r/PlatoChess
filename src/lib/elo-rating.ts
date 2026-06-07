export const ELO_K_FACTOR = 32;

/**
 * Anti-farming distribution constants (see spec Section 5).
 * These constrain how much rating a player may GAIN from a single match so that
 * highly-rated players cannot farm rating against much weaker opponents.
 */
/** Absolute maximum Elo a player can gain from any single match. */
export const ELO_MAX_GAIN_PER_MATCH = 100;
/** At or below this rating, standard distribution applies so players can climb out of the beginner tier. */
export const LOW_ELO_PROTECTION_THRESHOLD = 200;
/** Beating an opponent at or below this rating (when above the protection tier) yields zero gain. */
export const SUB_TIER_OPPONENT_THRESHOLD = 100;
/** A player rated this much above their opponent gets diminishing returns on a win. */
export const DIMINISHING_RETURNS_GAP = 300;
/** The diminished maximum gain applied under the 400-vs-700 rule. */
export const DIMINISHED_MAX_GAIN = 1;

export type MatchGameType = "pvp" | "bot" | "engine" | "offline" | "local" | (string & {});
export type PvpMatchResult = "white_win" | "black_win" | "draw";

interface EloDeltaParams {
  playerRating: number;
  opponentRating: number;
  score: 0 | 0.5 | 1;
  kFactor?: number;
}

interface PvpEloChangeParams {
  whiteRating: number;
  blackRating: number;
  result: PvpMatchResult;
  kFactor?: number;
}

export function isRatedPvpGameType(gameType: MatchGameType): boolean {
  return String(gameType).toLowerCase() === "pvp";
}

export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function calculateEloDelta({
  playerRating,
  opponentRating,
  score,
  kFactor = ELO_K_FACTOR,
}: EloDeltaParams): number {
  const expected = calculateExpectedScore(playerRating, opponentRating);
  return Math.round(kFactor * (score - expected));
}

/**
 * Apply anti-farming constraints to a player's raw Elo gain (Section 5).
 *
 * Only positive deltas (gains) are constrained; losses pass through unchanged.
 * Constraint precedence:
 *   1. Players at/below the protection threshold keep standard rules (capped at the global max).
 *   2. Above the protection tier, beating a sub-tier opponent (<= 100) yields zero.
 *   3. Above the protection tier, being far higher-rated (gap >= 300) yields at most +1.
 *   4. Otherwise the gain is capped at the global per-match maximum.
 */
export function constrainEloGain(
  playerRating: number,
  opponentRating: number,
  rawDelta: number
): number {
  if (rawDelta <= 0) return rawDelta;

  if (playerRating <= LOW_ELO_PROTECTION_THRESHOLD) {
    return Math.min(rawDelta, ELO_MAX_GAIN_PER_MATCH);
  }

  if (opponentRating <= SUB_TIER_OPPONENT_THRESHOLD) {
    return 0;
  }

  if (playerRating - opponentRating >= DIMINISHING_RETURNS_GAP) {
    return Math.min(rawDelta, DIMINISHED_MAX_GAIN);
  }

  return Math.min(rawDelta, ELO_MAX_GAIN_PER_MATCH);
}

export function calculatePvpEloChange({
  whiteRating,
  blackRating,
  result,
  kFactor = ELO_K_FACTOR,
}: PvpEloChangeParams): { whiteDelta: number; blackDelta: number } {
  const whiteScore: 0 | 0.5 | 1 =
    result === "white_win" ? 1 : result === "black_win" ? 0 : 0.5;
  const rawWhiteDelta = calculateEloDelta({
    playerRating: whiteRating,
    opponentRating: blackRating,
    score: whiteScore,
    kFactor,
  });

  // Constrain whichever side is gaining rating, then mirror the result so the
  // match stays zero-sum after anti-farming caps are applied.
  if (rawWhiteDelta > 0) {
    const whiteDelta = constrainEloGain(whiteRating, blackRating, rawWhiteDelta);
    return { whiteDelta, blackDelta: whiteDelta === 0 ? 0 : -whiteDelta };
  }
  if (rawWhiteDelta < 0) {
    const blackDelta = constrainEloGain(blackRating, whiteRating, -rawWhiteDelta);
    return { whiteDelta: blackDelta === 0 ? 0 : -blackDelta, blackDelta };
  }
  return { whiteDelta: 0, blackDelta: 0 };
}
