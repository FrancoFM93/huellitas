-- 2026_04_21_04_emergency_broadcasts.sql
-- Admin/verified-org emergency broadcasts + fanout to all profiles in scope.

CREATE TABLE IF NOT EXISTS emergency_broadcasts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  scope       TEXT NOT NULL CHECK (scope IN ('city','region','country')),
  country     TEXT,
  region      TEXT,
  city_slug   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_broadcasts_country
  ON emergency_broadcasts(country);

ALTER TABLE emergency_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eb_public_read" ON emergency_broadcasts;
CREATE POLICY "eb_public_read" ON emergency_broadcasts FOR SELECT USING (true);

DROP POLICY IF EXISTS "eb_admin_or_verified_org_insert" ON emergency_broadcasts;
CREATE POLICY "eb_admin_or_verified_org_insert" ON emergency_broadcasts FOR INSERT
  WITH CHECK (
    creator_id IN (
      SELECT id FROM profiles
      WHERE user_id = auth.uid()
        AND (role = 'admin' OR (type = 'fundacion' AND verified = TRUE))
    )
  );

-- Fanout: notify every profile in scope. Inserts into notifications(user_id, metadata).
CREATE OR REPLACE FUNCTION fn_broadcast_fanout() RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
BEGIN
  FOR target_user IN
    SELECT p.user_id FROM profiles p
    WHERE
      (NEW.scope = 'country' AND p.country = NEW.country)
      OR (NEW.scope = 'region' AND p.country = NEW.country AND p.region = NEW.region)
      OR (NEW.scope = 'city' AND p.country = NEW.country AND p.city_slug = NEW.city_slug)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      target_user,
      'broadcast',
      NEW.title,
      NEW.body,
      jsonb_build_object('broadcast_id', NEW.id, 'scope', NEW.scope)
    );
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_broadcast_fanout ON emergency_broadcasts;
CREATE TRIGGER trg_broadcast_fanout AFTER INSERT ON emergency_broadcasts
  FOR EACH ROW EXECUTE FUNCTION fn_broadcast_fanout();
