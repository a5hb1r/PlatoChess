-- PvP Elo system (K=32) with idempotent match application
CREATE TABLE public.pvp_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE,
  game_type TEXT NOT NULL DEFAULT 'pvp',
  white_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  black_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('white_win', 'black_win', 'draw')),
  white_rating_before INTEGER NOT NULL,
  black_rating_before INTEGER NOT NULL,
  white_rating_after INTEGER NOT NULL,
  black_rating_after INTEGER NOT NULL,
  white_delta INTEGER NOT NULL,
  black_delta INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX pvp_matches_white_user_idx ON public.pvp_matches (white_user_id);
CREATE INDEX pvp_matches_black_user_idx ON public.pvp_matches (black_user_id);

ALTER TABLE public.pvp_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own PvP matches"
  ON public.pvp_matches
  FOR SELECT
  USING (auth.uid() = white_user_id OR auth.uid() = black_user_id);

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

  delta_white := round(32 * (actual_white - expected_white));
  delta_black := -delta_white;
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
