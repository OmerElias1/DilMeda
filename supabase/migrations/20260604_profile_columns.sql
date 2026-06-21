/*
  # Ensure spin + game tracking columns exist on profiles
  These may have been added manually or in a lost migration.
  Safe to run multiple times (IF NOT EXISTS / DO NOTHING).
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS needs_ad_watch       boolean     DEFAULT false NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_game_played_at  timestamptz DEFAULT NULL;

-- Backfill: any existing rows get the default
UPDATE profiles SET needs_ad_watch = false WHERE needs_ad_watch IS NULL;
