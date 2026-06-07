-- Guest / anonymous-user onboarding + placement match columns

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_elo_bracket TEXT,        -- 'beginner' | 'intermediate' | 'advanced' | 'expert'
  ADD COLUMN IF NOT EXISTS placement_games_remaining INTEGER;  -- NULL = not in placement; 0 = done

-- Allow guests to write their own onboarding columns (previously blocked by UPDATE policy)
-- The existing "Users can update their own profile" policy already covers this via auth.uid() = user_id.

-- Update handle_new_user so anonymous Supabase users get is_guest = true
-- and start with placement_games_remaining = 5.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_guest BOOLEAN;
BEGIN
  -- Supabase sets is_anonymous = true in app_metadata for anonymous sign-ins
  _is_guest := COALESCE((NEW.raw_app_meta_data ->> 'is_anonymous')::boolean, false);

  INSERT INTO public.profiles (
    user_id,
    display_name,
    is_guest,
    placement_games_remaining,
    onboarding_complete,
    rating
  ) VALUES (
    NEW.id,
    CASE
      WHEN _is_guest THEN 'Guest'
      ELSE COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
    END,
    _is_guest,
    CASE WHEN _is_guest THEN 5 ELSE NULL END,
    false,
    800  -- default; overwritten by onboarding bracket selection
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
