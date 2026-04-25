-- 2026_04_21_07_contracts_and_monitoring.sql
CREATE TABLE IF NOT EXISTS adoption_contracts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id   UUID NOT NULL UNIQUE REFERENCES adoption_applications(id) ON DELETE CASCADE,
  post_id          UUID NOT NULL REFERENCES adoption_posts(id) ON DELETE CASCADE,
  adopter_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  poster_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES organization_profiles(id) ON DELETE SET NULL,
  signed_at        TIMESTAMPTZ DEFAULT NOW(),
  monitoring_until TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))
);

CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id    UUID NOT NULL REFERENCES adoption_contracts(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('photo','video')),
  status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed')),
  photo_urls     TEXT[] DEFAULT '{}',
  notes          TEXT,
  jitsi_room     TEXT,
  verifier_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_contract ON monitoring_sessions(contract_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_scheduled ON monitoring_sessions(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE adoption_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_parties_read" ON adoption_contracts;
CREATE POLICY "contracts_parties_read" ON adoption_contracts FOR SELECT USING (
  adopter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR poster_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "sessions_parties_read" ON monitoring_sessions;
CREATE POLICY "sessions_parties_read" ON monitoring_sessions FOR SELECT USING (
  contract_id IN (
    SELECT id FROM adoption_contracts
    WHERE adopter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
       OR poster_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "sessions_adopter_update" ON monitoring_sessions;
CREATE POLICY "sessions_adopter_update" ON monitoring_sessions FOR UPDATE USING (
  contract_id IN (
    SELECT id FROM adoption_contracts
    WHERE adopter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION fn_approve_application(app_id UUID) RETURNS UUID AS $$
DECLARE
  app adoption_applications%ROWTYPE;
  post adoption_posts%ROWTYPE;
  contract_id UUID;
  org_profile_id UUID;
BEGIN
  SELECT * INTO app FROM adoption_applications WHERE id = app_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'application not found'; END IF;
  IF app.status <> 'pending' THEN RAISE EXCEPTION 'not pending'; END IF;

  SELECT * INTO post FROM adoption_posts WHERE id = app.post_id;
  IF post.status <> 'available' THEN RAISE EXCEPTION 'post not available'; END IF;

  IF post.poster_id NOT IN (SELECT id FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT op.id INTO org_profile_id FROM organization_profiles op
    WHERE op.profile_id = post.poster_id;

  UPDATE adoption_applications SET status='approved', decided_at=NOW() WHERE id=app_id;

  INSERT INTO adoption_contracts (application_id, post_id, adopter_id, poster_id, org_id, monitoring_until)
  VALUES (app_id, app.post_id, app.applicant_id, post.poster_id, org_profile_id, NOW() + INTERVAL '1 year')
  RETURNING id INTO contract_id;

  INSERT INTO monitoring_sessions (contract_id, scheduled_at, type) VALUES
    (contract_id, NOW() + INTERVAL '1 month',  'photo'),
    (contract_id, NOW() + INTERVAL '3 months', 'video'),
    (contract_id, NOW() + INTERVAL '6 months', 'photo'),
    (contract_id, NOW() + INTERVAL '12 months','video');

  UPDATE adoption_posts SET status='adopted' WHERE id = app.post_id;

  UPDATE adoption_applications
    SET status='rejected', decided_at=NOW()
    WHERE post_id = app.post_id AND id <> app_id AND status='pending';

  RETURN contract_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_verify_session(session_id UUID, note TEXT DEFAULT NULL) RETURNS VOID AS $$
DECLARE
  s monitoring_sessions%ROWTYPE;
  c adoption_contracts%ROWTYPE;
  caller_profile UUID;
BEGIN
  SELECT * INTO s FROM monitoring_sessions WHERE id = session_id FOR UPDATE;
  SELECT * INTO c FROM adoption_contracts WHERE id = s.contract_id;

  SELECT id INTO caller_profile FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  IF caller_profile IS NULL OR caller_profile <> c.poster_id THEN
    RAISE EXCEPTION 'only poster can verify';
  END IF;

  UPDATE monitoring_sessions
    SET status='completed', verifier_id=caller_profile, verified_at=NOW(), notes=COALESCE(note, notes)
    WHERE id = session_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
