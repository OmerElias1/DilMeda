/*
  # Tree Grower Profile Columns
  Adds tree tracking columns to the profiles table used by the TreeGrower game.
  Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tree_height       integer     DEFAULT 0   NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_count       integer     DEFAULT 5   NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS waters_used_today integer     DEFAULT 0   NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_water_date   timestamptz DEFAULT NULL;

-- Backfill existing rows with sensible defaults
UPDATE profiles SET tree_height = 0       WHERE tree_height IS NULL;
UPDATE profiles SET water_count = 5       WHERE water_count IS NULL;
UPDATE profiles SET waters_used_today = 0 WHERE waters_used_today IS NULL;
