-- ═══ Live online multiplayer: matchmaking queue + games + RPCs ═══════════
-- (Applied to production 2026-07-13 via MCP; kept here for versioning.)

create table public.matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating int not null default 800,
  time_minutes int not null,
  increment_seconds int not null default 0,
  enqueued_at timestamptz not null default now()
);

alter table public.matchmaking_queue enable row level security;

create policy "queue_select_own" on public.matchmaking_queue
  for select to authenticated using (user_id = auth.uid());
-- inserts/deletes happen only inside security-definer RPCs

create table public.live_games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references auth.users(id) on delete cascade,
  black_id uuid not null references auth.users(id) on delete cascade,
  white_name text not null default 'White',
  black_name text not null default 'Black',
  white_rating int not null default 800,
  black_rating int not null default 800,
  time_minutes int not null,
  increment_seconds int not null default 0,
  moves text not null default '',
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn text not null default 'w' check (turn in ('w','b')),
  white_ms bigint not null,
  black_ms bigint not null,
  last_move_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','finished','aborted')),
  result text check (result in ('1-0','0-1','1/2-1/2')),
  end_reason text,
  rating_delta_w int,
  rating_delta_b int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index live_games_white_active on public.live_games (white_id) where status = 'active';
create index live_games_black_active on public.live_games (black_id) where status = 'active';

alter table public.live_games enable row level security;

create policy "games_select_players" on public.live_games
  for select to authenticated
  using (white_id = auth.uid() or black_id = auth.uid());
-- all writes go through security-definer RPCs below

alter publication supabase_realtime add table public.live_games;

-- ─── helpers ──────────────────────────────────────────────────────────────

create or replace function public._elo_delta(r_self int, r_opp int, score numeric)
returns int language sql immutable as $$
  select round(32 * (score - 1.0 / (1.0 + power(10, (r_opp - r_self) / 400.0))))::int;
$$;

create or replace function public._finish_live_game(
  g public.live_games, p_result text, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare
  score_w numeric := case p_result when '1-0' then 1 when '0-1' then 0 else 0.5 end;
  dw int := public._elo_delta(g.white_rating, g.black_rating, score_w);
  db int := public._elo_delta(g.black_rating, g.white_rating, 1 - score_w);
begin
  update public.live_games set
    status = 'finished', result = p_result, end_reason = p_reason,
    rating_delta_w = dw, rating_delta_b = db, updated_at = now()
  where id = g.id;

  update public.profiles set rating = greatest(100, rating + dw),
    games_played = games_played + 1, updated_at = now()
  where user_id = g.white_id;
  update public.profiles set rating = greatest(100, rating + db),
    games_played = games_played + 1, updated_at = now()
  where user_id = g.black_id;

  insert into public.pvp_matches (match_id, white_user_id, black_user_id, result,
    white_rating_before, black_rating_before, white_rating_after, black_rating_after,
    white_delta, black_delta)
  values (g.id::text, g.white_id, g.black_id,
    case p_result when '1-0' then 'white_win' when '0-1' then 'black_win' else 'draw' end,
    g.white_rating, g.black_rating, g.white_rating + dw, g.black_rating + db, dw, db);
end;
$$;

-- ─── matchmaking ──────────────────────────────────────────────────────────

create or replace function public.join_matchmaking(p_minutes int, p_increment int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_profile record;
  opponent record;
  game_id uuid;
  i_am_white boolean := random() < 0.5;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_minutes not between 1 and 60 or p_increment not between 0 and 60 then
    raise exception 'invalid time control';
  end if;

  -- already in an active game? return it (reconnect)
  select id into game_id from public.live_games
    where status = 'active' and (white_id = me or black_id = me)
    order by created_at desc limit 1;
  if game_id is not null then return game_id; end if;

  select coalesce(display_name, username, 'Player') as name, rating, country
    into my_profile from public.profiles where user_id = me;
  if my_profile is null then
    my_profile := row('Player', 800, null);
  end if;

  delete from public.matchmaking_queue where enqueued_at < now() - interval '3 minutes';

  select q.user_id, q.rating,
         coalesce(p.display_name, p.username, 'Player') as name
    into opponent
    from public.matchmaking_queue q
    left join public.profiles p on p.user_id = q.user_id
    where q.time_minutes = p_minutes and q.increment_seconds = p_increment
      and q.user_id <> me
    order by q.enqueued_at
    for update of q skip locked
    limit 1;

  if opponent.user_id is null then
    insert into public.matchmaking_queue (user_id, rating, time_minutes, increment_seconds)
    values (me, coalesce(my_profile.rating, 800), p_minutes, p_increment)
    on conflict (user_id) do update
      set time_minutes = excluded.time_minutes,
          increment_seconds = excluded.increment_seconds,
          enqueued_at = now();
    return null;
  end if;

  delete from public.matchmaking_queue where user_id in (opponent.user_id, me);

  insert into public.live_games (
    white_id, black_id, white_name, black_name, white_rating, black_rating,
    time_minutes, increment_seconds, white_ms, black_ms)
  values (
    case when i_am_white then me else opponent.user_id end,
    case when i_am_white then opponent.user_id else me end,
    case when i_am_white then my_profile.name else opponent.name end,
    case when i_am_white then opponent.name else my_profile.name end,
    case when i_am_white then coalesce(my_profile.rating, 800) else opponent.rating end,
    case when i_am_white then opponent.rating else coalesce(my_profile.rating, 800) end,
    p_minutes, p_increment, p_minutes * 60000, p_minutes * 60000)
  returning id into game_id;

  return game_id;
end;
$$;

create or replace function public.leave_matchmaking()
returns void language sql security definer set search_path = public as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
$$;

create or replace function public.my_active_game()
returns uuid language sql security definer set search_path = public as $$
  select id from public.live_games
    where status = 'active' and (white_id = auth.uid() or black_id = auth.uid())
    order by created_at desc limit 1;
$$;

-- ─── gameplay ─────────────────────────────────────────────────────────────

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
    select * into g from public.live_games where id = p_game_id;
    perform public._finish_live_game(g, p_result, coalesce(p_end_reason, 'game over'));
  end if;
end;
$$;

create or replace function public.resign_live_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.live_games%rowtype;
  me uuid := auth.uid();
begin
  select * into g from public.live_games where id = p_game_id for update;
  if g.id is null or g.status <> 'active' then return; end if;
  if me = g.white_id then perform public._finish_live_game(g, '0-1', 'resignation');
  elsif me = g.black_id then perform public._finish_live_game(g, '1-0', 'resignation');
  else raise exception 'not a player in this game'; end if;
end;
$$;

create or replace function public.claim_live_timeout(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.live_games%rowtype;
  me uuid := auth.uid();
  turn_ms bigint;
begin
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
  select * into g from public.live_games where id = p_game_id for update;
  if g.id is null or g.status <> 'active' then return; end if;
  if me <> g.white_id and me <> g.black_id then raise exception 'not a player'; end if;
  if g.moves <> '' then raise exception 'game already started'; end if;
  update public.live_games set status = 'aborted', end_reason = 'aborted',
    updated_at = now() where id = p_game_id;
end;
$$;

-- lock the RPCs down to signed-in users
revoke execute on all functions in schema public from anon, public;
grant execute on function public.join_matchmaking(int, int) to authenticated;
grant execute on function public.leave_matchmaking() to authenticated;
grant execute on function public.my_active_game() to authenticated;
grant execute on function public.play_live_move(uuid, text, text, boolean, text, text) to authenticated;
grant execute on function public.resign_live_game(uuid) to authenticated;
grant execute on function public.claim_live_timeout(uuid) to authenticated;
grant execute on function public.abort_live_game(uuid) to authenticated;
-- pre-existing client-called RPCs keep working for signed-in users
grant execute on function public.apply_pvp_elo_result(text, text, uuid, uuid, text) to authenticated;
grant execute on function public.can_start_new_seek(uuid) to authenticated;
grant execute on function public.get_active_game_count(uuid) to authenticated;
grant execute on function public.generate_unique_username(text) to authenticated;
