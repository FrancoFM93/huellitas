-- Run this in the Supabase SQL editor to add push token support
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
