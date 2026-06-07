import { supabase } from "@/integrations/supabase/client";
import { isRatedPvpGameType, type MatchGameType, type PvpMatchResult } from "@/lib/elo-rating";

export interface ApplyPvpRatingParams {
  matchId: string;
  gameType: MatchGameType;
  whiteUserId: string;
  blackUserId: string;
  result: PvpMatchResult;
}

export interface PvpRatingUpdateResult {
  applied: boolean;
  reason: string;
  whiteUserId: string;
  blackUserId: string;
  whiteRatingBefore: number | null;
  blackRatingBefore: number | null;
  whiteRatingAfter: number | null;
  blackRatingAfter: number | null;
  whiteDelta: number;
  blackDelta: number;
}

interface RpcApplyPvpRatingResult {
  applied: boolean;
  reason: string;
  white_user_id: string;
  black_user_id: string;
  white_rating_before: number | null;
  black_rating_before: number | null;
  white_rating_after: number | null;
  black_rating_after: number | null;
  white_delta: number;
  black_delta: number;
}

export interface ProfileRatingState {
  user_id: string;
  rating: number;
  games_played: number;
}

function mapRpcResult(row: RpcApplyPvpRatingResult): PvpRatingUpdateResult {
  return {
    applied: row.applied,
    reason: row.reason,
    whiteUserId: row.white_user_id,
    blackUserId: row.black_user_id,
    whiteRatingBefore: row.white_rating_before,
    blackRatingBefore: row.black_rating_before,
    whiteRatingAfter: row.white_rating_after,
    blackRatingAfter: row.black_rating_after,
    whiteDelta: row.white_delta,
    blackDelta: row.black_delta,
  };
}

function nonPvpBypass(params: ApplyPvpRatingParams): PvpRatingUpdateResult {
  return {
    applied: false,
    reason: "non_pvp_game",
    whiteUserId: params.whiteUserId,
    blackUserId: params.blackUserId,
    whiteRatingBefore: null,
    blackRatingBefore: null,
    whiteRatingAfter: null,
    blackRatingAfter: null,
    whiteDelta: 0,
    blackDelta: 0,
  };
}

export async function applyPvpRatingUpdate(
  params: ApplyPvpRatingParams
): Promise<PvpRatingUpdateResult> {
  if (!isRatedPvpGameType(params.gameType)) return nonPvpBypass(params);

  const { data, error } = await supabase.rpc("apply_pvp_elo_result", {
    p_match_id: params.matchId,
    p_game_type: params.gameType,
    p_white_user_id: params.whiteUserId,
    p_black_user_id: params.blackUserId,
    p_result: params.result,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    throw new Error("apply_pvp_elo_result returned no rows");
  }

  return mapRpcResult(row as RpcApplyPvpRatingResult);
}

export function mergeUpdatedRatingsIntoProfiles<T extends ProfileRatingState>(
  profiles: T[],
  update: PvpRatingUpdateResult
): T[] {
  if (!update.applied) return profiles;

  return profiles.map((profile) => {
    if (profile.user_id === update.whiteUserId && update.whiteRatingAfter !== null) {
      return {
        ...profile,
        rating: update.whiteRatingAfter,
        games_played: profile.games_played + 1,
      };
    }
    if (profile.user_id === update.blackUserId && update.blackRatingAfter !== null) {
      return {
        ...profile,
        rating: update.blackRatingAfter,
        games_played: profile.games_played + 1,
      };
    }
    return profile;
  });
}
