-- Add columns to profiles for tracking games and streak
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS games_played integer DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_streak integer DEFAULT 0 NOT NULL;

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, achievement_id)
);

-- Enable Row Level Security
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
DROP POLICY IF EXISTS "Anyone authenticated can view user achievements" ON user_achievements;
CREATE POLICY "Anyone authenticated can view user achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
CREATE POLICY "Users can insert own achievements"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION record_game_played(p_user_id uuid, p_timezone text DEFAULT 'UTC')
RETURNS void AS $$
DECLARE
  last_played timestamptz;
  today_date date;
  last_played_date date;
  curr_streak integer;
BEGIN
  -- Get current stats
  SELECT last_game_played_at, daily_streak INTO last_played, curr_streak 
  FROM profiles 
  WHERE id = p_user_id;

  -- Calculate dates based on the user's local timezone
  today_date := (now() AT TIME ZONE p_timezone)::date;

  IF last_played IS NULL THEN
    curr_streak := 1;
  ELSE
    last_played_date := (last_played AT TIME ZONE p_timezone)::date;
    IF last_played_date = today_date THEN
      -- Already played today, streak remains unchanged
    ELSIF last_played_date = today_date - 1 THEN
      -- Played yesterday, increment streak
      curr_streak := curr_streak + 1;
    ELSE
      -- Played before yesterday, reset streak
      curr_streak := 1;
    END IF;
  END IF;

  UPDATE profiles
  SET 
    games_played = games_played + 1,
    needs_ad_watch = ((games_played + 1) % 2 = 0),
    daily_streak = COALESCE(curr_streak, 1),
    last_game_played_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_and_unlock_achievements()
RETURNS trigger AS $$
BEGIN
  -- Wrap in exception block to prevent blocking signup if achievements fail
  BEGIN
    -- 1. Games played achievements
    IF NEW.games_played >= 1 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (NEW.id, 'first_game')
      ON CONFLICT (user_id, achievement_id) DO NOTHING;

      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (NEW.id, 'early_bird')
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;

    IF NEW.games_played >= 50 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (NEW.id, 'game_master')
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;

    -- 2. Points achievements
    IF NEW.points >= 1000 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (NEW.id, 'point_collector')
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;

    IF NEW.points >= 5000 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (NEW.id, 'point_hunter')
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;

    -- 3. Daily streak achievements
    IF NEW.daily_streak >= 7 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (NEW.id, 'daily_player')
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;

    -- 4. Champion (top 10 leaderboard)
    IF NEW.points > 0 AND EXISTS (
      SELECT 1 FROM (
        SELECT id FROM profiles ORDER BY points DESC LIMIT 10
      ) top_ten WHERE top_ten.id = NEW.id
    ) THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (NEW.id, 'champion')
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Silently handle error to prevent signup failure
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to evaluate achievements when profile stats change
DROP TRIGGER IF EXISTS trigger_check_and_unlock_achievements ON profiles;
CREATE TRIGGER trigger_check_and_unlock_achievements
  AFTER INSERT OR UPDATE OF points, games_played, daily_streak ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_and_unlock_achievements();
