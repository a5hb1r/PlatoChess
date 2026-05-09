export const ELO_K_FACTOR = 32;

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

export function calculatePvpEloChange({
  whiteRating,
  blackRating,
  result,
  kFactor = ELO_K_FACTOR,
}: PvpEloChangeParams): { whiteDelta: number; blackDelta: number } {
  const whiteScore: 0 | 0.5 | 1 =
    result === "white_win" ? 1 : result === "black_win" ? 0 : 0.5;
  const whiteDelta = calculateEloDelta({
    playerRating: whiteRating,
    opponentRating: blackRating,
    score: whiteScore,
    kFactor,
  });
  return { whiteDelta, blackDelta: whiteDelta === 0 ? 0 : -whiteDelta };
}
