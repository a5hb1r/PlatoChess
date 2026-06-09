-- Add game_history table for cross-device sync when users are logged in.
-- Anonymous users continue to use localStorage only (no row written).
--
-- PK is (user_id, id) where `id` is the client-generated string
-- (e.g. "game-<ts>-<random>") set when a game ends in Game.tsx.

CREATE TABLE public.game_history (
  id            TEXT         NOT NULL,
  user_id       UUID         NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  opponent      TEXT         NOT NULL DEFAULT '',
  result        TEXT         NOT NULL DEFAULT '',
  result_detail TEXT         NOT NULL DEFAULT '',
  move_count    INTEGER      NOT NULL DEFAULT 0,
  accuracy_w    NUMERIC(6,2),
  accuracy_b    NUMERIC(6,2),
  pgn           TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- Fast per-user newest-first listing used by the Dashboard.
CREATE INDEX game_history_user_created_idx
  ON public.game_history (user_id, created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own game history"
  ON public.game_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game history"
  ON public.game_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game history"
  ON public.game_history FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
