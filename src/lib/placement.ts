/**
 * Placement match logic.
 *
 * After each game is reviewed, call `recordPlacementResult` with the player's
 * accuracy score (0–100). It updates their Supabase profile:
 *   - Adjusts `rating` based on accuracy vs the target for their bracket
 *   - Decrements `placement_games_remaining`
 *   - When placement_games_remaining reaches 0, placement is complete
 */

import { supabase } from "@/integrations/supabase/client";

/** Target accuracy % for each bracket — used to calibrate rating movement */
const BRACKET_TARGET_ACCURACY: Record<string, number> = {
  beginner: 55,
  intermediate: 65,
  advanced: 75,
  expert: 82,
};

/**
 * Returns how many rating points to shift for a given accuracy delta.
 * Positive accuracy delta → climb; negative → drop.
 */
function ratingDeltaFromAccuracy(
  accuracy: number,
  bracket: string
): number {
  const target = BRACKET_TARGET_ACCURACY[bracket] ?? 65;
  const delta = accuracy - target; // e.g. played at 80% with target 65 → +15
  // Scale: each 1% above/below target = ±8 rating points, capped at ±120
  const raw = Math.round(delta * 8);
  return Math.max(-120, Math.min(120, raw));
}

interface RecordPlacementOptions {
  userId: string;
  /** Player's accuracy this game (0–100) */
  accuracy: number;
  currentRating: number;
  bracket: string;
  placementGamesRemaining: number;
}

export async function recordPlacementResult({
  userId,
  accuracy,
  currentRating,
  bracket,
  placementGamesRemaining,
}: RecordPlacementOptions): Promise<void> {
  if (placementGamesRemaining <= 0) return; // already done

  const ratingDelta = ratingDeltaFromAccuracy(accuracy, bracket);
  const newRating = Math.max(100, currentRating + ratingDelta);
  const newRemaining = placementGamesRemaining - 1;

  await supabase
    .from("profiles")
    .update({
      rating: newRating,
      placement_games_remaining: newRemaining,
    })
    .eq("user_id", userId);
}
