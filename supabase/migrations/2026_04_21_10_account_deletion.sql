-- 2026_04_21_10_account_deletion.sql
-- User-initiated account deletion: anonymize profile immediately, queue auth.users
-- removal for an ops job. CASCADE on auth.users would wipe contracts/adoptions, so
-- we anonymize the profile in place and delete the auth row out-of-band.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS account_deletion_queue (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL UNIQUE,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

-- Hide deleted profiles from public reads. Owner can still see their own row
-- (in case the queue job is delayed and they re-open the app).
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (
  deleted_at IS NULL
  OR user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION fn_request_account_deletion() RETURNS VOID AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE profiles
     SET name       = 'Cuenta eliminada',
         avatar_url = NULL,
         bio        = NULL,
         phone      = NULL,
         location   = NULL,
         push_token = NULL,
         deleted_at = NOW()
   WHERE user_id = uid;

  -- Drop any active push token to stop fanout immediately.
  -- (Already nulled above, kept explicit for clarity.)

  INSERT INTO account_deletion_queue (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO UPDATE SET requested_at = NOW(), processed_at = NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
