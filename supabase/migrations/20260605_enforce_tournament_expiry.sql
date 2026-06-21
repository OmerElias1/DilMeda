/*
  # Enforce tournament expiry in increment_tournament_points
  Adds a server-side check so points can NEVER be awarded to an expired
  or inactive tournament, regardless of what the client sends.
*/

CREATE OR REPLACE FUNCTION increment_tournament_points(
  p_user_id       uuid,
  p_tournament_id uuid,
  p_points        integer
) RETURNS void AS $$
DECLARE
  v_end_time timestamptz;
  v_active   boolean;
BEGIN
  -- Fetch the tournament's deadline and active flag
  SELECT end_time, active
    INTO v_end_time, v_active
    FROM tournaments
   WHERE id = p_tournament_id;

  -- Silently reject if tournament not found, inactive, or already ended
  IF v_end_time IS NULL OR v_active IS FALSE OR v_end_time <= now() THEN
    RETURN;
  END IF;

  -- Safe upsert — only runs when tournament is live
  INSERT INTO tournament_points (user_id, tournament_id, points, updated_at)
  VALUES (p_user_id, p_tournament_id, p_points, now())
  ON CONFLICT (user_id, tournament_id)
  DO UPDATE SET
    points     = tournament_points.points + p_points,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
