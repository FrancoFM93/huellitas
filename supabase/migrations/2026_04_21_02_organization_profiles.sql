-- 2026_04_21_02_organization_profiles.sql
CREATE TABLE IF NOT EXISTS organization_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  org_name       TEXT NOT NULL,
  logo_url       TEXT,
  description    TEXT,
  contact_email  TEXT,
  contact_phone  TEXT,
  website        TEXT,
  address        TEXT,
  gps            JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_profiles_profile ON organization_profiles(profile_id);

ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_public_read" ON organization_profiles FOR SELECT USING (true);

CREATE POLICY "org_owner_insert" ON organization_profiles FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_owner_update" ON organization_profiles FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
