-- 2026_04_21_06_adoption_applications.sql
CREATE TABLE IF NOT EXISTS adoption_applications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id        UUID NOT NULL REFERENCES adoption_posts(id) ON DELETE CASCADE,
  applicant_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message        TEXT,
  contact_phone  TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  decided_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adoption_apps_post ON adoption_applications(post_id);
CREATE INDEX IF NOT EXISTS idx_adoption_apps_applicant ON adoption_applications(applicant_id);

ALTER TABLE adoption_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_read" ON adoption_applications;
CREATE POLICY "apps_read" ON adoption_applications FOR SELECT USING (
  applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR post_id IN (
    SELECT ap.id FROM adoption_posts ap
    WHERE ap.poster_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "apps_insert" ON adoption_applications;
CREATE POLICY "apps_insert" ON adoption_applications FOR INSERT WITH CHECK (
  applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM adoption_posts WHERE id = post_id AND status = 'available')
);

DROP POLICY IF EXISTS "apps_withdraw" ON adoption_applications;
CREATE POLICY "apps_withdraw" ON adoption_applications FOR UPDATE USING (
  applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (status = 'withdrawn');
