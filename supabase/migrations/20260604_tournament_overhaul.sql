/*
  # Tournament System Overhaul
  Adds per-tournament registration, per-tournament points, and seeds 3 sample tournaments.
*/

-- Extend tournaments with new UI/meta columns
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS description  text DEFAULT '';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee   text DEFAULT 'Free';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_players integer DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS banner_color text DEFAULT '#2D1555';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS start_time  timestamptz DEFAULT now();

-- ── tournament_registrations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  registered_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, tournament_id)
);

ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view registrations"
  ON tournament_registrations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own registrations"
  ON tournament_registrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── tournament_points ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_points (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  points        integer NOT NULL DEFAULT 0,
  updated_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, tournament_id)
);

ALTER TABLE tournament_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view tournament points"
  ON tournament_points FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own tournament points"
  ON tournament_points FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tournament points"
  ON tournament_points FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ── RPC: safely upsert tournament points ─────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_tournament_points(
  p_user_id       uuid,
  p_tournament_id uuid,
  p_points        integer
) RETURNS void AS $$
BEGIN
  INSERT INTO tournament_points (user_id, tournament_id, points, updated_at)
  VALUES (p_user_id, p_tournament_id, p_points, now())
  ON CONFLICT (user_id, tournament_id)
  DO UPDATE SET
    points     = tournament_points.points + p_points,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Seed tournaments ──────────────────────────────────────────────────────────
-- Update the existing S1 tournament with new fields
UPDATE tournaments
SET description  = 'The original DilMeda championship. Play games, watch ads and dominate!',
    entry_fee    = 'Free',
    banner_color = '#2D1555'
WHERE name = 'DilMeda Championship S1';

-- Add 2 more tournaments
INSERT INTO tournaments (name, description, end_time, prize_pool, entry_fee, banner_color, active)
VALUES
  (
    'Gold Rush Cup',
    'Fast-paced 3-day sprint. Every point counts. Winner takes all.',
    now() + interval '3 days',
    '💰 5,000 ETB Cash',
    'Free',
    '#3D2000',
    true
  ),
  (
    'Mega League',
    '14 days to prove yourself in the biggest DilMeda tournament yet.',
    now() + interval '14 days',
    '🎮 PlayStation 5',
    'Free',
    '#0D2D3D',
    true
  )
ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tournament_points_lb
  ON tournament_points (tournament_id, points DESC);
CREATE INDEX IF NOT EXISTS idx_treg_user
  ON tournament_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_treg_tournament
  ON tournament_registrations (tournament_id);
