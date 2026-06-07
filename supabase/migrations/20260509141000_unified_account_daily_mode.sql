-- Unified account settings + Daily mode game/session support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premove_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_active_games SMALLINT NOT NULL DEFAULT 3;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_key;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_check
  CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,30}$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_max_active_games_range_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_max_active_games_range_check
  CHECK (max_active_games BETWEEN 1 AND 10);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_unique_username(seed_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  candidate TEXT;
  suffix INTEGER := 0;
BEGIN
  base_username := regexp_replace(LOWER(COALESCE(seed_text, '')), '[^a-z0-9_]+', '', 'g');
  IF LENGTH(base_username) < 3 THEN
    base_username := 'player';
  END IF;
  base_username := LEFT(base_username, 24);
  candidate := base_username;

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE LOWER(username) = LOWER(candidate)
  ) LOOP
    suffix := suffix + 1;
    candidate := LEFT(base_username, GREATEST(3, 30 - LENGTH(suffix::TEXT))) || suffix::TEXT;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_display_name TEXT;
  requested_username TEXT;
  username_seed TEXT;
BEGIN
  requested_display_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  requested_username := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'username', '')), '');
  username_seed := COALESCE(
    requested_username,
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    NEW.id::TEXT
  );

  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(requested_display_name, NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), NEW.email),
    public.generate_unique_username(username_seed)
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode') THEN
    CREATE TYPE public.game_mode AS ENUM ('standard', 'blitz', 'increment', 'chess960', 'daily');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
    CREATE TYPE public.game_status AS ENUM ('pending', 'active', 'completed', 'abandoned');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_notification_channel') THEN
    CREATE TYPE public.game_notification_channel AS ENUM ('email', 'in_app');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_notification_status') THEN
    CREATE TYPE public.game_notification_status AS ENUM ('pending', 'delivered', 'failed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  black_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mode public.game_mode NOT NULL DEFAULT 'standard',
  status public.game_status NOT NULL DEFAULT 'pending',
  time_control TEXT,
  daily_move_window_seconds INTEGER NOT NULL DEFAULT 86400,
  turn_color TEXT CHECK (turn_color IN ('w', 'b')),
  move_deadline_at TIMESTAMP WITH TIME ZONE,
  next_turn_notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (daily_move_window_seconds BETWEEN 60 AND 172800),
  CHECK (white_user_id IS NOT NULL OR black_user_id IS NOT NULL)
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their own game sessions" ON public.game_sessions;
CREATE POLICY "Participants can view their own game sessions"
  ON public.game_sessions
  FOR SELECT
  USING (auth.uid() = white_user_id OR auth.uid() = black_user_id);

DROP POLICY IF EXISTS "Participants can create game sessions" ON public.game_sessions;
CREATE POLICY "Participants can create game sessions"
  ON public.game_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = white_user_id OR auth.uid() = black_user_id);

DROP POLICY IF EXISTS "Participants can update their own game sessions" ON public.game_sessions;
CREATE POLICY "Participants can update their own game sessions"
  ON public.game_sessions
  FOR UPDATE
  USING (auth.uid() = white_user_id OR auth.uid() = black_user_id)
  WITH CHECK (auth.uid() = white_user_id OR auth.uid() = black_user_id);

CREATE INDEX IF NOT EXISTS game_sessions_white_active_idx
  ON public.game_sessions (white_user_id)
  WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS game_sessions_black_active_idx
  ON public.game_sessions (black_user_id)
  WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS game_sessions_daily_turn_idx
  ON public.game_sessions (mode, status, turn_color, move_deadline_at)
  WHERE mode = 'daily';

CREATE OR REPLACE FUNCTION public.get_active_game_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.game_sessions
  WHERE status IN ('pending', 'active')
    AND (white_user_id = p_user_id OR black_user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_start_new_seek(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_active_game_count(p_user_id) < COALESCE(
    (SELECT max_active_games FROM public.profiles WHERE user_id = p_user_id),
    3
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_active_game_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_start_new_seek(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.daily_turn_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.game_notification_channel NOT NULL DEFAULT 'in_app',
  status public.game_notification_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.daily_turn_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients can view own notifications" ON public.daily_turn_notifications;
CREATE POLICY "Recipients can view own notifications"
  ON public.daily_turn_notifications
  FOR SELECT
  USING (auth.uid() = recipient_user_id);

DROP POLICY IF EXISTS "Recipients can update own notifications" ON public.daily_turn_notifications;
CREATE POLICY "Recipients can update own notifications"
  ON public.daily_turn_notifications
  FOR UPDATE
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

CREATE INDEX IF NOT EXISTS daily_turn_notifications_recipient_status_idx
  ON public.daily_turn_notifications (recipient_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS daily_turn_notifications_game_idx
  ON public.daily_turn_notifications (game_session_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_game_sessions_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_daily_move_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  turn_changed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    turn_changed := TRUE;
  ELSE
    turn_changed := NEW.turn_color IS DISTINCT FROM OLD.turn_color;
  END IF;

  IF NEW.mode = 'daily' AND NEW.status = 'active' THEN
    IF turn_changed OR NEW.move_deadline_at IS NULL THEN
      NEW.move_deadline_at := now() + make_interval(secs => COALESCE(NEW.daily_move_window_seconds, 86400));
      NEW.next_turn_notified_at := NULL;
    END IF;
  ELSE
    NEW.move_deadline_at := NULL;
    NEW.next_turn_notified_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_daily_turn_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
BEGIN
  IF NEW.mode <> 'daily' OR NEW.status <> 'active' OR NEW.turn_color IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.turn_color IS NOT DISTINCT FROM OLD.turn_color
    AND NEW.move_deadline_at IS NOT DISTINCT FROM OLD.move_deadline_at
    AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  recipient_id := CASE
    WHEN NEW.turn_color = 'w' THEN NEW.white_user_id
    WHEN NEW.turn_color = 'b' THEN NEW.black_user_id
    ELSE NULL
  END;

  IF recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.daily_turn_notifications (
    game_session_id,
    recipient_user_id,
    channel,
    payload
  )
  VALUES
    (
      NEW.id,
      recipient_id,
      'in_app',
      jsonb_build_object(
        'game_session_id', NEW.id,
        'mode', NEW.mode,
        'time_control', COALESCE(NEW.time_control, '24h/move'),
        'move_deadline_at', NEW.move_deadline_at
      )
    ),
    (
      NEW.id,
      recipient_id,
      'email',
      jsonb_build_object(
        'game_session_id', NEW.id,
        'mode', NEW.mode,
        'time_control', COALESCE(NEW.time_control, '24h/move'),
        'move_deadline_at', NEW.move_deadline_at
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_game_sessions_updated_at ON public.game_sessions;
CREATE TRIGGER update_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_game_sessions_updated_at_column();

DROP TRIGGER IF EXISTS refresh_daily_move_deadline ON public.game_sessions;
CREATE TRIGGER refresh_daily_move_deadline
  BEFORE INSERT OR UPDATE OF mode, status, turn_color, daily_move_window_seconds, move_deadline_at
  ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_daily_move_deadline();

DROP TRIGGER IF EXISTS queue_daily_turn_notifications ON public.game_sessions;
CREATE TRIGGER queue_daily_turn_notifications
  AFTER INSERT OR UPDATE OF status, turn_color, move_deadline_at
  ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_daily_turn_notifications();
