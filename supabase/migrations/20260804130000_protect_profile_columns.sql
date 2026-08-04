-- ═══ Lock down client-writable profile columns ═══════════════════════════════
--
-- CRITICAL. profiles has:
--   CREATE POLICY "Users can update their own profile"
--     ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
-- ...with no WITH CHECK and no column-level restriction, so any signed-in user
-- can PATCH their own row directly through PostgREST:
--
--   supabase.from('profiles').update({ rating: 30000 }).eq('user_id', me)
--   supabase.from('profiles').update({ subscription_status: 'active',
--                                      subscription_plan: 'master' })
--
-- That bypasses the whole security-definer RPC layer: the Elo those functions
-- so carefully compute lives in a table the client can just overwrite, and the
-- paid tiers gate on columns the client can grant itself. It also renders the
-- live-multiplayer result-integrity fix (20260804120000) moot, since a cheater
-- can skip the game entirely and set the rating directly.
--
-- RLS cannot express "these columns are read-only" — so we use a BEFORE UPDATE
-- trigger instead, which fires for PostgREST writes but is transparent to our
-- trusted server-side paths.
--
-- Trust model: SECURITY DEFINER functions run as their owner (postgres), and
-- the Stripe webhook uses the service_role key. Only the client-facing roles
-- ('authenticated', 'anon') are restricted; everything else passes through
-- untouched, so no RPC, trigger, or webhook behaviour changes.

-- NOTE: deliberately SECURITY INVOKER (the default). Inside a SECURITY DEFINER
-- function `current_user` is the function OWNER, so marking this one DEFINER
-- would make the check below always see 'postgres' and silently disable the
-- entire guard. As INVOKER, `current_user` is the role actually running the
-- UPDATE: 'authenticated' for a PostgREST call from the browser, 'postgres'
-- when reached from inside one of our SECURITY DEFINER RPCs. The function only
-- reads OLD/NEW and assigns, so it needs no elevated privileges.
create or replace function public.enforce_profile_column_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Trusted server-side callers (security-definer RPCs, service_role, admin)
  -- keep full write access.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- ── Never client-writable ────────────────────────────────────────────────
  -- Monetisation: granting yourself Pro/Master must go through Stripe.
  new.stripe_customer_id                  := old.stripe_customer_id;
  new.stripe_subscription_id              := old.stripe_subscription_id;
  new.subscription_status                 := old.subscription_status;
  new.subscription_plan                   := old.subscription_plan;
  new.subscription_current_period_end     := old.subscription_current_period_end;
  new.subscription_cancel_at_period_end   := old.subscription_cancel_at_period_end;
  new.subscription_canceled_at            := old.subscription_canceled_at;

  -- Tier-derived limits and identity flags.
  new.max_active_games := old.max_active_games;
  new.is_guest         := old.is_guest;

  -- Competitive integrity: only _finish_live_game / apply_pvp_elo_result move these.
  new.games_played := old.games_played;

  -- ── rating: writable ONLY during placement ───────────────────────────────
  -- src/lib/placement.ts and src/lib/guest-session.ts legitimately write rating
  -- while calibrating a new account, so allow it strictly inside that window
  -- and clamp it to a sane band. Outside placement it is server-only.
  if new.rating is distinct from old.rating then
    if coalesce(old.placement_games_remaining, 0) > 0
       and new.rating between 100 and 2000 then
      null;  -- permitted placement calibration
    else
      new.rating := old.rating;
    end if;
  end if;

  -- placement_games_remaining may only ever count DOWN from the client, so the
  -- placement window cannot be reopened to unlock more rating writes.
  if new.placement_games_remaining is distinct from old.placement_games_remaining
     and old.placement_games_remaining is not null
     and coalesce(new.placement_games_remaining, 0) > old.placement_games_remaining then
    new.placement_games_remaining := old.placement_games_remaining;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_column_guard on public.profiles;
create trigger profiles_column_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_column_guard();

-- ─── apply_pvp_elo_result must not be callable with arbitrary arguments ──────
--
-- 20260713100000_live_multiplayer.sql:285 re-granted EXECUTE on this to
-- `authenticated`, but the function never calls auth.uid() — it takes both user
-- ids and the result as parameters and writes both profiles rows. Any signed-in
-- user could award themselves a win against anyone. Verified safe to revoke:
-- the only reference in src/ is applyPvpRatingUpdate in src/lib/pvp-rating.ts,
-- which has no production caller (pvp-rating.test.ts is the sole importer), and
-- live games settle through _finish_live_game, which writes directly.
revoke execute on function public.apply_pvp_elo_result(text, text, uuid, uuid, text)
  from authenticated, anon;
