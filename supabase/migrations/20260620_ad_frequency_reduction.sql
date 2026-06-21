-- Migration to reduce ad frequency: watch ads after every 2 games instead of every game
-- Apply this in the Supabase SQL Editor to update your remote database immediately.

CREATE OR REPLACE FUNCTION record_game_played(p_user_id uuid)
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

  today_date := now()::date;

  IF last_played IS NULL THEN
    curr_streak := 1;
  ELSE
    last_played_date := last_played::date;
    IF last_played_date = today_date THEN
      -- Already played today, streak remains unchanged
      curr_streak := daily_streak;
    ELSIF last_played_date = today_date - 1 THEN
      -- Played yesterday, increment streak
      curr_streak := daily_streak + 1;
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
