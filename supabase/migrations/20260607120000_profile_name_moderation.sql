-- Enforce basic content moderation on display_name and username at the DB level.
-- This is a backstop — the frontend also validates before sending.

CREATE OR REPLACE FUNCTION public.check_profile_name_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  combined TEXT;
BEGIN
  combined := LOWER(COALESCE(NEW.display_name, '') || ' ' || COALESCE(NEW.username, ''));

  IF combined ~* '\y(fuck|shit|cunt|cock|dick|pussy|bitch|whore|slut|porn|rape|nigger|nigg[ae]|fag+ot|fag\y|kike|spic|chink|beaner|nazi|hitler|kys|killurself|killurself)\y' THEN
    RAISE EXCEPTION 'Profile name contains disallowed content.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_name_moderation ON public.profiles;
CREATE TRIGGER profile_name_moderation
  BEFORE INSERT OR UPDATE OF display_name, username
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_name_content();
