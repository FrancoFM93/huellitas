-- 2026_04_21_01_geo_and_roles.sql
-- Adds geo hierarchy (country/region/city_slug), role, verified flag.
-- Extends profile type enum to include 'fundacion'.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city_slug TEXT;

-- Rewrite profile type check constraint to include 'fundacion'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_type_check
  CHECK (type IN ('user','vet','clinic','fundacion'));

CREATE INDEX IF NOT EXISTS idx_profiles_country_city ON profiles(country, city_slug);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role = 'admin';
