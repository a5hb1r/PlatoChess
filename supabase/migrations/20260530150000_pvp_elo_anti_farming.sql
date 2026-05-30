-- Anti-farming Elo distribution constraints (spec Section 5).
-- Constrains the rating a player can GAIN from a single PvP match so that
-- highly-rated players cannot farm rating against much weaker opponents.

CREATE OR REPLACE FUNCTION public.constrain_elo_gain(
  p_player_rating INTEGER,
  p_opponent_rating INTEGER,
  p_raw_delta INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Only gains are constrained; losses pass through unchanged.
  IF p_raw_delta <= 0 THEN
    RETURN p_raw_delta;
  END IF;

  -- Low Elo protection pool: players at/below 200 keep standard rules so they
  -- can climb out of the beginner tier (still bounded by the global max gain).
  IF p_player_rating <= 200 THEN
    RETURN LEAST(p_raw_delta, 100);
  END IF;

  -- Above the protection tier, farming a sub-100 opponent yields zero reward.
  IF p_opponent_rating <= 100 THEN
    RETURN 0;
  END IF;

  -- Diminishing returns: being far higher-rated (gap >= 300, e.g. 700 vs 400)
  -- yields at most +1 on a victory.
  IF (p_player_rating - p_opponent_rating) >= 300 THEN
    RETURN LEAST(p_raw_delta, 1);
  END IF;

  -- Otherwise cap at the global per-match maximum.
  RETURN LEAST(p_raw_delta, 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.constrain_elo_gain(INTEGER, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_pvp_elo_result(
  p_match_id TEXT,
  p_game_type TEXT,
  p_white_user_id UUID,
  p_black_user_id UUID,
  p_result TEXT
)
RETURNS TABLE (
  applied BOOLEAN,
  reason TEXT,
  white_user_id UUID,
  black_user_id UUID,
  white_rating_before INTEGER,
  black_rating_before INTEGER,
  white_rating_after INTEGER,
  black_rating_after INTEGER,
  white_delta INTEGER,
  black_delta INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_match public.pvp_matches%ROWTYPE;
  current_white_rating INTEGER;
  current_black_rating INTEGER;
  next_white_rating INTEGER;
  next_black_rating INTEGER;
  expected_white NUMERIC;
  actual_white NUMERIC;
  base_delta_white INTEGER;
  delta_white INTEGER;
  delta_black INTEGER;
BEGIN
  IF lower(coalesce(p_game_type, '')) <> 'pvp' THEN
    RETURN QUERY
      SELECT FALSE, 'non_pvp_game', p_white_user_id, p_black_user_id, NULL, NULL, NULL, NULL, 0, 0;
    RETURN;
  END IF;

  IF p_match_id IS NULL OR btrim(p_match_id) = '' THEN
    RETURN QUERY
      SELECT FALSE, 'invalid_match_id', p_white_user_id, p_black_user_id, NULL, NULL, NULL, NULL, 0, 0;
    RETURN;
  END IF;

  IF p_white_user_id IS NULL OR p_black_user_id IS NULL OR p_white_user_id = p_black_user_id THEN
    RETURN QUERY
      SELECT FALSE, 'invalid_players', p_white_user_id, p_black_user_id, NULL, NULL, NULL, NULL, 0, 0;
    RETURN;
  END IF;

  IF p_result NOT IN ('white_win', 'black_win', 'draw') THEN
    RETURN QUERY
      SELECT FALSE, 'invalid_result', p_white_user_id, p_black_user_id, NULL, NULL, NULL, NULL, 0, 0;
    RETURN;
  END IF;

  SELECT *
  INTO existing_match
  FROM public.pvp_matches
  WHERE match_id = p_match_id;

  IF FOUND THEN
    RETURN QUERY
      SELECT
        TRUE,
        'already_applied',
        existing_match.white_user_id,
        existing_match.black_user_id,
        existing_match.white_rating_before,
        existing_match.black_rating_before,
        existing_match.white_rating_after,
        existing_match.black_rating_after,
        existing_match.white_delta,
        existing_match.black_delta;
    RETURN;
  END IF;

  SELECT rating
  INTO current_white_rating
  FROM public.profiles
  WHERE user_id = p_white_user_id
  FOR UPDATE;

  SELECT rating
  INTO current_black_rating
  FROM public.profiles
  WHERE user_id = p_black_user_id
  FOR UPDATE;

  IF current_white_rating IS NULL OR current_black_rating IS NULL THEN
    RETURN QUERY
      SELECT FALSE, 'missing_profile', p_white_user_id, p_black_user_id, NULL, NULL, NULL, NULL, 0, 0;
    RETURN;
  END IF;

  expected_white := 1 / (1 + power(10::NUMERIC, (current_black_rating - current_white_rating)::NUMERIC / 400));
  actual_white := CASE p_result
    WHEN 'white_win' THEN 1
    WHEN 'draw' THEN 0.5
    ELSE 0
  END;

  base_delta_white := round(32 * (actual_white - expected_white));

  -- Constrain whichever side is gaining rating, then mirror to keep the match
  -- zero-sum after anti-farming caps are applied.
  IF base_delta_white > 0 THEN
    delta_white := public.constrain_elo_gain(current_white_rating, current_black_rating, base_delta_white);
    delta_black := -delta_white;
  ELSIF base_delta_white < 0 THEN
    delta_black := public.constrain_elo_gain(current_black_rating, current_white_rating, -base_delta_white);
    delta_white := -delta_black;
  ELSE
    delta_white := 0;
    delta_black := 0;
  END IF;

  next_white_rating := current_white_rating + delta_white;
  next_black_rating := current_black_rating + delta_black;

  UPDATE public.profiles
  SET
    rating = next_white_rating,
    games_played = games_played + 1
  WHERE user_id = p_white_user_id;

  UPDATE public.profiles
  SET
    rating = next_black_rating,
    games_played = games_played + 1
  WHERE user_id = p_black_user_id;

  INSERT INTO public.pvp_matches (
    match_id,
    game_type,
    white_user_id,
    black_user_id,
    result,
    white_rating_before,
    black_rating_before,
    white_rating_after,
    black_rating_after,
    white_delta,
    black_delta
  )
  VALUES (
    p_match_id,
    lower(p_game_type),
    p_white_user_id,
    p_black_user_id,
    p_result,
    current_white_rating,
    current_black_rating,
    next_white_rating,
    next_black_rating,
    delta_white,
    delta_black
  );

  RETURN QUERY
    SELECT
      TRUE,
      'applied',
      p_white_user_id,
      p_black_user_id,
      current_white_rating,
      current_black_rating,
      next_white_rating,
      next_black_rating,
      delta_white,
      delta_black;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_pvp_elo_result(TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;
