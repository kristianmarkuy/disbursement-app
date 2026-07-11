-- Treat admin approval as the app's email confirmation step.
-- Supabase Auth rejects password sign-in while email_confirmed_at is null.

CREATE OR REPLACE FUNCTION confirm_auth_email_on_profile_approval()
RETURNS TRIGGER AS $$
DECLARE
  should_confirm BOOLEAN := false;
BEGIN
  IF NEW.approval_status = 'approved' THEN
    IF TG_OP = 'INSERT' THEN
      should_confirm := true;
    ELSIF OLD.approval_status IS DISTINCT FROM 'approved' THEN
      should_confirm := true;
    END IF;
  END IF;

  IF should_confirm THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = NEW.id
      AND email_confirmed_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS user_profiles_confirm_auth_email ON user_profiles;
CREATE TRIGGER user_profiles_confirm_auth_email
  AFTER INSERT OR UPDATE OF approval_status ON user_profiles
  FOR EACH ROW
  WHEN (NEW.approval_status = 'approved')
  EXECUTE FUNCTION confirm_auth_email_on_profile_approval();

UPDATE auth.users u
SET email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
    updated_at = now()
FROM public.user_profiles p
WHERE p.id = u.id
  AND p.approval_status = 'approved'
  AND u.email_confirmed_at IS NULL;
