-- 2026_04_21_05_adoption_extensions.sql
-- Adds sex + health_status to adoption_posts (bool fields for vaccines/neutered/dewormed already exist).

ALTER TABLE adoption_posts
  ADD COLUMN IF NOT EXISTS sex TEXT
    CHECK (sex IN ('male','female','unknown')) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS health_status TEXT
    CHECK (health_status IN ('healthy','treatment','chronic','special_needs')) DEFAULT 'healthy';
