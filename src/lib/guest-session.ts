/**
 * Guest session — stored entirely in localStorage.
 * No Supabase account needed. When the user signs up, migrateGuestToProfile
 * copies the guest's rating/placement progress into their fresh profile.
 */
import { supabase } from "@/integrations/supabase/client";

export interface GuestSession {
  rating: number;
  bracket: string; // 'beginner' | 'intermediate' | 'advanced' | 'expert'
  placementGamesRemaining: number;
  onboardingComplete: boolean;
  createdAt: number;
}

const KEY = "platochess:guest";

export function getGuestSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

export function saveGuestSession(session: GuestSession): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearGuestSession(): void {
  localStorage.removeItem(KEY);
}

/**
 * Copy a guest's progress (rating, bracket, placement state) into a freshly
 * created account so "Save progress" actually saves it. Only writes when the
 * profile is brand-new (onboarding not done, zero games) — signing in to an
 * established account never overwrites real history.
 */
export async function migrateGuestToProfile(userId: string): Promise<"migrated" | "skipped" | "error"> {
  const guest = getGuestSession();
  if (!guest?.onboardingComplete) return "skipped";

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("onboarding_complete, games_played")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError || !profile) return "error";
  if (profile.onboarding_complete || (profile.games_played ?? 0) > 0) {
    // Established account — keep its data, just drop the guest session.
    clearGuestSession();
    return "skipped";
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      rating: guest.rating,
      onboarding_complete: true,
      onboarding_elo_bracket: guest.bracket,
      placement_games_remaining: guest.placementGamesRemaining,
    })
    .eq("user_id", userId);

  if (error) return "error";
  clearGuestSession();
  return "migrated";
}

export const BRACKET_RATINGS: Record<string, number> = {
  beginner: 600,
  intermediate: 1000,
  advanced: 1400,
  expert: 1700,
};

const BRACKET_TARGET_ACCURACY: Record<string, number> = {
  beginner: 55,
  intermediate: 65,
  advanced: 75,
  expert: 82,
};

/**
 * Record a placement game result. Adjusts rating by accuracy vs bracket target.
 * Returns the updated session (caller should persist it).
 */
export function applyPlacementResult(
  session: GuestSession,
  accuracy: number
): GuestSession {
  if (session.placementGamesRemaining <= 0) return session;

  const target = BRACKET_TARGET_ACCURACY[session.bracket] ?? 65;
  const delta = Math.round((accuracy - target) * 8);
  const clampedDelta = Math.max(-120, Math.min(120, delta));
  const newRating = Math.max(100, session.rating + clampedDelta);

  return {
    ...session,
    rating: newRating,
    placementGamesRemaining: Math.max(0, session.placementGamesRemaining - 1),
  };
}
