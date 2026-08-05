-- ═══ Harden RPC grants + null-caller guards ══════════════════════════════════
--
-- Found by the Supabase security advisor immediately after applying
-- 20260804120000 / 20260804130000. Two distinct problems:
--
-- 1. CRITICAL (pre-existing) — public._finish_live_game is EXECUTE-able by
--    `authenticated`. It takes the game as a COMPOSITE PARAMETER rather than
--    looking it up, and it is SECURITY DEFINER, so any signed-in user could
--    POST a hand-built live_games row to /rest/v1/rpc/_finish_live_game and
--    have it write arbitrary ratings into public.profiles for arbitrary users.
--    Being SECURITY DEFINER (owner = postgres) it also sails straight past the
--    profiles_column_guard trigger added in 20260804130000.
--    It is an internal helper; no client should ever call it.
--
-- 2. CRITICAL (introduced by 20260804120000) — confirm_live_result was created
--    with only an explicit grant to `authenticated`, but Postgres grants
--    EXECUTE to PUBLIC on new functions by default, so `anon` could call it
--    too. And for an anonymous caller auth.uid() is NULL, which makes
--        if me <> g.white_id and me <> g.black_id then raise ...
--    evaluate to NULL rather than TRUE — so the "not a player" guard never
--    fires and the function falls through. A cheater could claim a win, then
--    confirm their OWN claim from a signed-out browser, completely defeating
--    the opponent-corroboration design.
--
--    The same NULL-comparison shape exists in claim_live_timeout and
--    abort_live_game, so they get explicit NULL guards here too.
--    (play_live_move and resign_live_game use if/elsif/else, whose ELSE branch
--    already catches NULL correctly — left as-is.)

-- ─── 1. internal helpers must not be client-callable ──────────────────────

revoke execute on function public._finish_live_game(public.live_games, text, text)
  from public, anon, authenticated;

revoke execute on function public._elo_delta(int, int, numeric)
  from public, anon, authenticated;

-- Trigger function; invoked by the auth.users trigger, never over the API.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- ─── 2. confirm_live_result: signed-in players only, with a NULL guard ────

revoke execute on function public.confirm_live_result(uuid, text) from public, anon;

create or replace function public.confirm_live_result(p_game_id uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.live_games%rowtype;
  me uuid := auth.uid();
begin
  -- Explicit: a NULL caller must never reach the comparisons below, because
  -- `NULL <> uuid` is NULL, not TRUE, and would slip past the membership check.
  if me is null then raise exception 'not authenticated'; end if;

  select * into g from public.live_games where id = p_game_id for update;
  if g.id is null or g.status <> 'active' then return; end if;
  if me <> g.white_id and me <> g.black_id then raise exception 'not a player in this game'; end if;
  if g.pending_result is null then return; end if;
  -- Only the OTHER player can corroborate; the proposer cannot confirm itself.
  if me = g.pending_result_by then return; end if;
  if g.pending_result <> p_result then return; end if;

  perform public._finish_live_game(g, g.pending_result,
    coalesce(g.pending_result_reason, 'game over'));
end;
$$;

revoke execute on function public.confirm_live_result(uuid, text) from public, anon;
grant  execute on function public.confirm_live_result(uuid, text) to authenticated;

-- ─── 3. same NULL-comparison shape in the other two RPCs ─────────────────

create or replace function public.claim_live_timeout(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.live_games%rowtype;
  me uuid := auth.uid();
  turn_ms bigint;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into g from public.live_games where id = p_game_id for update;
  if g.id is null or g.status <> 'active' then return; end if;
  if me <> g.white_id and me <> g.black_id then raise exception 'not a player'; end if;

  turn_ms := (case when g.turn = 'w' then g.white_ms else g.black_ms end)
             - extract(epoch from (now() - g.last_move_at)) * 1000;
  if turn_ms > 0 then return; end if;  -- not actually flagged

  perform public._finish_live_game(g,
    case when g.turn = 'w' then '0-1' else '1-0' end, 'timeout');
end;
$$;

create or replace function public.abort_live_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.live_games%rowtype;
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into g from public.live_games where id = p_game_id for update;
  if g.id is null or g.status <> 'active' then return; end if;
  if me <> g.white_id and me <> g.black_id then raise exception 'not a player'; end if;
  if g.moves <> '' then raise exception 'game already started'; end if;
  update public.live_games set status = 'aborted', end_reason = 'aborted',
    updated_at = now() where id = p_game_id;
end;
$$;

revoke execute on function public.claim_live_timeout(uuid) from public, anon;
grant  execute on function public.claim_live_timeout(uuid) to authenticated;
revoke execute on function public.abort_live_game(uuid)    from public, anon;
grant  execute on function public.abort_live_game(uuid)    to authenticated;

-- ─── 4. pin search_path on the remaining helper ──────────────────────────
alter function public._elo_delta(int, int, numeric) set search_path = public;
