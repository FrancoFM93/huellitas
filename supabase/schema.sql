-- ============================================================
-- HUELLITAS - Supabase Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- for geo queries (optional, if available)

-- ─── Profiles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('user', 'vet', 'clinic')),
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  bio         TEXT,
  phone       TEXT,
  location    JSONB,  -- { lat, lng, address }
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS vet_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  license_number    TEXT NOT NULL,
  specialties       TEXT[] DEFAULT '{}',
  consultation_fee  NUMERIC(10,2),
  available         BOOLEAN DEFAULT TRUE,
  schedule          JSONB DEFAULT '{}',
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  UNIQUE(profile_id)
);

CREATE TABLE IF NOT EXISTS clinic_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  address        TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT,
  website        TEXT,
  schedule       JSONB DEFAULT '{}',
  services       TEXT[] DEFAULT '{}',
  emergency_24h  BOOLEAN DEFAULT FALSE,
  UNIQUE(profile_id)
);

-- ─── Pets ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  species        TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other')),
  breed          TEXT,
  age_years      INTEGER,
  age_months     INTEGER,
  weight_kg      NUMERIC(6,2),
  color          TEXT NOT NULL,
  photos         TEXT[] DEFAULT '{}',
  microchip      TEXT,
  medical_notes  TEXT,
  is_missing     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missing_pet_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id              UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  reporter_id         UUID NOT NULL REFERENCES profiles(id),
  last_seen_lat       DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_seen_lng       DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_seen_address   TEXT NOT NULL,
  last_seen_at        TIMESTAMPTZ NOT NULL,
  description         TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'found', 'closed')),
  sightings_count     INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_sightings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id   UUID NOT NULL REFERENCES missing_pet_reports(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  lat         DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng         DOUBLE PRECISION NOT NULL DEFAULT 0,
  address     TEXT NOT NULL,
  photo_url   TEXT,
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Community Alerts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('injured', 'abandoned', 'abuse', 'stray', 'emergency', 'other')),
  severity        INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  lat             DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng             DOUBLE PRECISION NOT NULL DEFAULT 0,
  address         TEXT NOT NULL,
  photos          TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_progress', 'resolved')),
  responses_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_responses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id     UUID NOT NULL REFERENCES community_alerts(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES profiles(id),
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'completed')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Fundraising ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fundraisers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id        UUID NOT NULL REFERENCES profiles(id),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  beneficiary_type  TEXT NOT NULL CHECK (beneficiary_type IN ('person', 'animal', 'emergency_fund')),
  target_amount     NUMERIC(12,2) NOT NULL,
  current_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  cover_photo       TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fundraiser_id  UUID REFERENCES fundraisers(id),  -- NULL = emergency fund
  donor_id       UUID NOT NULL REFERENCES profiles(id),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  anonymous      BOOLEAN DEFAULT FALSE,
  message        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_fund (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  last_updated     TIMESTAMPTZ DEFAULT NOW()
);

-- Insert single emergency fund row
INSERT INTO emergency_fund (total_amount, transactions_count)
VALUES (0, 0)
ON CONFLICT DO NOTHING;

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  read       BOOLEAN DEFAULT FALSE,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vet_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE missing_pet_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundraisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Vet / Clinic profiles: public read, own write
CREATE POLICY "vet_profiles_public_read" ON vet_profiles FOR SELECT USING (true);
CREATE POLICY "vet_profiles_own_write" ON vet_profiles FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "vet_profiles_own_update" ON vet_profiles FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "clinic_profiles_public_read" ON clinic_profiles FOR SELECT USING (true);
CREATE POLICY "clinic_profiles_own_write" ON clinic_profiles FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "clinic_profiles_own_update" ON clinic_profiles FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Pets: public read, owner write
CREATE POLICY "pets_public_read" ON pets FOR SELECT USING (true);
CREATE POLICY "pets_own_write" ON pets FOR INSERT
  WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "pets_own_update" ON pets FOR UPDATE
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Missing pet reports: public read, authenticated write
CREATE POLICY "missing_reports_public_read" ON missing_pet_reports FOR SELECT USING (true);
CREATE POLICY "missing_reports_auth_insert" ON missing_pet_reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "missing_reports_own_update" ON missing_pet_reports FOR UPDATE
  USING (reporter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Pet sightings: public read, authenticated write
CREATE POLICY "sightings_public_read" ON pet_sightings FOR SELECT USING (true);
CREATE POLICY "sightings_auth_insert" ON pet_sightings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Community alerts: public read, authenticated write
CREATE POLICY "alerts_public_read" ON community_alerts FOR SELECT USING (true);
CREATE POLICY "alerts_auth_insert" ON community_alerts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "alerts_own_update" ON community_alerts FOR UPDATE
  USING (creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Alert responses: public read, authenticated write
CREATE POLICY "responses_public_read" ON alert_responses FOR SELECT USING (true);
CREATE POLICY "responses_auth_insert" ON alert_responses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fundraisers: public read, authenticated write
CREATE POLICY "fundraisers_public_read" ON fundraisers FOR SELECT USING (true);
CREATE POLICY "fundraisers_auth_insert" ON fundraisers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "fundraisers_own_update" ON fundraisers FOR UPDATE
  USING (creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Donations: public read, authenticated write
CREATE POLICY "donations_public_read" ON donations FOR SELECT USING (true);
CREATE POLICY "donations_auth_insert" ON donations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Emergency fund: public read only
CREATE POLICY "fund_public_read" ON emergency_fund FOR SELECT USING (true);

-- Notifications: own only
CREATE POLICY "notifications_own" ON notifications FOR ALL
  USING (user_id = auth.uid());

-- ─── Functions / RPC ──────────────────────────────────────────────────────────

-- Increment emergency fund total
CREATE OR REPLACE FUNCTION increment_emergency_fund(amount_to_add NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE emergency_fund
  SET total_amount = total_amount + amount_to_add,
      transactions_count = transactions_count + 1,
      last_updated = NOW();
END;
$$;

-- Increment fundraiser current_amount
CREATE OR REPLACE FUNCTION increment_fundraiser(fundraiser_id UUID, amount_to_add NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE fundraisers
  SET current_amount = current_amount + amount_to_add,
      updated_at = NOW()
  WHERE id = fundraiser_id;
END;
$$;

-- Auto-notify vets/clinics when a high-severity alert is created
CREATE OR REPLACE FUNCTION notify_vets_on_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.severity >= 3 THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    SELECT
      p.user_id,
      'community_alert',
      '🚨 Nueva alerta: ' || NEW.title,
      'Nivel ' || NEW.severity || ' - ' || NEW.address,
      jsonb_build_object('alert_id', NEW.id, 'severity', NEW.severity)
    FROM profiles p
    WHERE p.type IN ('vet', 'clinic');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_alert_created
  AFTER INSERT ON community_alerts
  FOR EACH ROW EXECUTE FUNCTION notify_vets_on_alert();

-- Auto-notify pet owner on new sighting
CREATE OR REPLACE FUNCTION notify_owner_on_sighting()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  pet_owner_user_id UUID;
  pet_name TEXT;
BEGIN
  SELECT p.user_id, pets.name INTO pet_owner_user_id, pet_name
  FROM missing_pet_reports r
  JOIN pets ON pets.id = r.pet_id
  JOIN profiles p ON p.id = r.reporter_id
  WHERE r.id = NEW.report_id;

  IF pet_owner_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      pet_owner_user_id,
      'pet_sighting',
      '👀 Avistaron a ' || COALESCE(pet_name, 'tu mascota'),
      'Reportaron un avistamiento en: ' || NEW.address,
      jsonb_build_object('report_id', NEW.report_id, 'sighting_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sighting_created
  AFTER INSERT ON pet_sightings
  FOR EACH ROW EXECUTE FUNCTION notify_owner_on_sighting();

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_community_alerts_status ON community_alerts(status);
CREATE INDEX IF NOT EXISTS idx_community_alerts_severity ON community_alerts(severity DESC);
CREATE INDEX IF NOT EXISTS idx_community_alerts_created ON community_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missing_reports_status ON missing_pet_reports(status);
CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_fundraisers_status ON fundraisers(status);
CREATE INDEX IF NOT EXISTS idx_donations_fundraiser ON donations(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sightings_report ON pet_sightings(report_id);

-- ─── Adoption Posts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS adoption_posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poster_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  species        TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other')),
  breed          TEXT,
  age_range      TEXT NOT NULL CHECK (age_range IN ('puppy', 'young', 'adult', 'senior')),
  color          TEXT,
  description    TEXT NOT NULL,
  location       TEXT NOT NULL,
  contact_info   TEXT NOT NULL,
  photos         TEXT[] DEFAULT '{}',
  is_vaccinated  BOOLEAN DEFAULT FALSE,
  is_neutered    BOOLEAN DEFAULT FALSE,
  is_dewormed    BOOLEAN DEFAULT FALSE,
  good_with_kids BOOLEAN DEFAULT FALSE,
  good_with_pets BOOLEAN DEFAULT FALSE,
  status         TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'adopted')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE adoption_posts ENABLE ROW LEVEL SECURITY;

-- Public read, authenticated insert, own update
CREATE POLICY "adoptions_public_read" ON adoption_posts FOR SELECT USING (true);
CREATE POLICY "adoptions_auth_insert" ON adoption_posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "adoptions_own_update" ON adoption_posts FOR UPDATE
  USING (poster_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_adoptions_status ON adoption_posts(status);
CREATE INDEX IF NOT EXISTS idx_adoptions_species ON adoption_posts(species);
CREATE INDEX IF NOT EXISTS idx_adoptions_created ON adoption_posts(created_at DESC);
