/**
 * Guest session — stored entirely in localStorage.
 * No Supabase account needed. When the user signs up, we migrate this data.
 */

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
