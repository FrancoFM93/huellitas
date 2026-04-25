-- 2026_04_21_09_push_tokens.sql
-- Promote push_token from manual SQL into proper migration, add index for fanout joins.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;
