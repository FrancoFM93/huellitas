-- Create the base profile required by every client workflow. User metadata may
-- select a public profile type, but may never grant an admin role or verification.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_create_profile_for_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, type, name)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'type' IN ('user', 'vet', 'clinic', 'fundacion')
      THEN NEW.raw_user_meta_data->>'type' ELSE 'user' END,
    LEFT(COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
      'Usuario'
    ), 120)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_profile_for_auth_user()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS huellitas_create_profile ON auth.users;
CREATE TRIGGER huellitas_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_create_profile_for_auth_user();

-- Recover existing accounts with no profile, without overwriting any existing
-- profile, including an account that has requested deletion.
INSERT INTO public.profiles (user_id, type, name)
SELECT
  u.id,
  CASE WHEN u.raw_user_meta_data->>'type' IN ('user', 'vet', 'clinic', 'fundacion')
    THEN u.raw_user_meta_data->>'type' ELSE 'user' END,
  LEFT(COALESCE(
    NULLIF(btrim(u.raw_user_meta_data->>'name'), ''),
    NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''),
    'Usuario'
  ), 120)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
