import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rating: number;
  games_played: number;
  puzzles_solved: number;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  max_active_games: number;
  premove_enabled: boolean;
  is_guest: boolean;
  onboarding_complete: boolean;
  onboarding_elo_bracket: string | null;
  placement_games_remaining: number | null;
}

interface UseProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  /** true if user has an active Pro or Master subscription */
  isPro: boolean;
  /** true if user has an active Master subscription */
  isMaster: boolean;
  /** true if the current user is an anonymous guest */
  isGuest: boolean;
  /** true if onboarding hasn't been completed yet */
  needsOnboarding: boolean;
  /** how many placement games remain (null = not in placement) */
  placementGamesRemaining: number | null;
  refetch: () => void;
}

export function useProfile(): UseProfileResult {
  const { user, loading: authLoading, isGuest: authIsGuest } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select(
        "user_id, display_name, username, avatar_url, rating, games_played, puzzles_solved, subscription_status, subscription_plan, subscription_current_period_end, subscription_cancel_at_period_end, stripe_customer_id, max_active_games, premove_enabled, is_guest, onboarding_complete, onboarding_elo_bracket, placement_games_remaining"
      )
      .eq("user_id", user.id)
      .single();
    setProfile(data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) fetch();
  }, [authLoading, fetch]);

  const isActive = profile?.subscription_status === "active";
  const plan = profile?.subscription_plan ?? "";
  const isPro = isActive && (plan === "pro" || plan === "master");
  const isMaster = isActive && plan === "master";
  const isGuest = authIsGuest || (profile?.is_guest ?? false);
  const needsOnboarding = Boolean(profile && !profile.onboarding_complete);
  const placementGamesRemaining = profile?.placement_games_remaining ?? null;

  return {
    profile,
    loading: authLoading || loading,
    isPro,
    isMaster,
    isGuest,
    needsOnboarding,
    placementGamesRemaining,
    refetch: fetch,
  };
}
