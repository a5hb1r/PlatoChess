-- ═══ Live multiplayer: result integrity + Elo anti-farming ═══════════════════
--
-- Fixes two defects in 20260713100000_live_multiplayer.sql:
--
-- 1. CRITICAL — play_live_move trusted p_game_over / p_result / p_end_reason,
--    which are pure client input. Any authenticated player could call the RPC
--    from the browser console on their own turn with p_result = '1-0' and
--    fabricate a win, moving both players' ratings by the full K=32 and writing
--    a bogus pvp_matches ledger row. Postgres holds no chess engine, so it
--    cannot verify checkmate on its own.
--
--    Fix: a player may never unilaterally declare a result in their own favour.
--      * A result that LOSES for the caller finishes immediately — that is just
--        a resignation, and nobody lies to lose.
--      * A result that WINS for the caller, or a DRAW, is recorded as PENDING
--        and only finalised once the OPPONENT's client independently reports
--        the same terminal position (confirm_live_result below).
--    Fabricating a win now requires both accounts to collude, which is exactly
--    the case the existing anti-farming caps already cover.
--
--    Liveness: if the opponent never corroborates (rage-quit / closed tab) the
--    game simply stays active and their clock keeps running, so the existing
--    server-verified claim_live_timeout still ends it. No deadlock.
--
-- 2. HIGH — _finish_live_game applied the raw K=32 delta directly to profiles,
--    bypassing constrain_elo_gain. Live games were the only PvP path with no
--    farming cap. Now routed through the same constraint as every other path.

-- ─── 1. pending-result columns ────────────────────────────────────────────

alter table public.live_games
  add column if not exists pending_result        text
    check (pending_result in ('1-0','0-1','1/2-1/2')),
  add column if not exists pending_result_by     uuid references auth.users(id) on delete set null,
  add column if not exists pending_result_reason text;

comment on column public.live_games.pending_result is
  'Terminal result claimed by one player, awaiting corroboration from the opponent. Never trusted alone.';

-- ─── 2. Elo now respects the anti-farming cap ─────────────────────────────

create or replace function public._finish_live_game(
  g public.live_games, p_result text, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare
  score_w numeric := case p_result when '1-0' then 1 when '0-1' then 0 else 0.5 end;
  dw int := public._elo_delta(g.white_rating, g.black_rating, score_w);
  db int := public._elo_delta(g.black_rating, g.white_rating, 1 - score_w);
begin
  -- Gains are capped by the shared anti-farming rules; losses pass through.
  dw := public.constrain_elo_gain(g.white_rating, g.black_rating, dw);
  db := public.constrain_elo_gain(g.black_rating, g.white_rating, db);

  update public.live_games set
    status = 'finished', result = p_result, end_reason = p_reason,
    rating_delta_w = dw, rating_delta_b = db,
    pending_result = null, pending_result_by = null, pending_result_reason = null,
    updated_at = now()
  where id = g.id;

  update public.profiles set rating = greatest(100, rating + dw),
    games_played = games_played + 1, updated_at = now()
  where user_id = g.white_id;
  update public.profiles set rating = greatest(100, rating + db),
    games_played = games_played + 1, updated_at = now()
  where user_id = g.black_id;

  -- match_id is UNIQUE; ON CONFLICT keeps a double-finish from erroring.
  insert into public.pvp_matches (match_id, white_user_id, black_user_id, result,
    white_rating_before, black_rating_before, white_rating_after, black_rating_after,
    white_delta, black_delta)
  values (g.id::text, g.white_id, g.black_id,
    case p_result when '1-0' then 'white_win' when '0-1' then 'black_win' else 'draw' end,
    g.white_rating, g.black_rating, g.white_rating + dw, g.black_rating + db, dw, db)
  on conflict (match_id) do nothing;
end;
$$;

-- ─── 3. play_live_move no longer trusts a self-favouring result ───────────

create or replace function public.play_live_move(
  p_game_id uuid, p_uci text, p_fen text,
  p_game_over boolean default false,
  p_result text default null,
  p_end_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  g public.live_games%rowtype;
  me uuid := auth.uid();
  my_color text;
  elapsed_ms bigint;
  new_ms bigint;
  claim_is_my_loss boolean;
begin
  select * into g from public.live_games where id = p_game_id for update;
  if g.id is null then raise exception 'game not found'; end if;
  if g.status <> 'active' then raise exception 'game is over'; end if;
  if me = g.white_id then my_color := 'w';
  elsif me = g.black_id then my_color := 'b';
  else raise exception 'not a player in this game'; end if;
  if g.turn <> my_color then raise exception 'not your turn'; end if;
  if p_uci !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then raise exception 'bad move format'; end if;

  elapsed_ms := extract(epoch from (now() - g.last_move_at)) * 1000;
  new_ms := (case when my_color = 'w' then g.white_ms else g.black_ms end) - elapsed_ms;

  if new_ms <= 0 then
    -- mover flagged before the move arrived
    perform public._finish_live_game(g,
      case when my_color = 'w' then '0-1' else '1-0' end, 'timeout');
    return;
  end if;

  new_ms := new_ms + g.increment_seconds * 1000;

  update public.live_games set
    moves = case when moves = '' then p_uci else moves || ' ' || p_uci end,
    fen = p_fen,
    turn = case when my_color = 'w' then 'b' else 'w' end,
    white_ms = case when my_color = 'w' then new_ms else white_ms end,
    black_ms = case when my_color = 'b' then new_ms else black_ms end,
    last_move_at = now(),
    updated_at = now()
  where id = p_game_id;

  if p_game_over and p_result in ('1-0', '0-1', '1/2-1/2') then
    claim_is_my_loss := (my_color = 'w' and p_result = '0-1')
                     or (my_color = 'b' and p_result = '1-0');

    if claim_is_my_loss then
      -- Conceding is always honest — finalise straight away.
      select * into g from public.live_games where id = p_game_id;
      perform public._finish_live_game(g, p_result, coalesce(p_end_reason, 'game over'));
    else
      -- A win or a draw for the caller only becomes real once the opponent's
      -- client reports the same terminal position.
      update public.live_games set
        pending_result = p_result,
        pending_result_by = me,
        pending_result_reason = coalesce(p_end_reason, 'game over'),
        updated_at = now()
      where id = p_game_id;
    end if;
  end if;
end;
$$;

-- ─── 4. the opponent's corroboration ──────────────────────────────────────

create or replace function public.confirm_live_result(p_game_id uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.live_games%rowtype;
  me uuid := auth.uid();
begin
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

grant execute on function public.confirm_live_result(uuid, text) to authenticated;
