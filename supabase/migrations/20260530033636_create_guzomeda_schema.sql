/*
  # GuzoMeda Platform Schema

  ## New Tables

  ### profiles
  - `id` (uuid, PK, references auth.users)
  - `phone_or_email` (text) - user's contact identifier
  - `username` (text) - display name
  - `points` (integer, default 0) - total tournament points
  - `avatar_seed` (text) - seed for generating avatars
  - `spin_last_used` (timestamptz) - last time lucky spin was used
  - `created_at` (timestamptz)

  ### tournaments
  - `id` (uuid, PK)
  - `name` (text) - tournament display name
  - `end_time` (timestamptz) - when tournament ends
  - `prize_pool` (text) - prize description
  - `active` (boolean) - whether tournament is active
  - `created_at` (timestamptz)

  ### ad_views
  - `id` (uuid, PK)
  - `user_id` (uuid, FK -> profiles)
  - `tournament_id` (uuid, FK -> tournaments)
  - `points_earned` (integer)
  - `viewed_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Profiles: users can read all, update/insert own
  - Tournaments: public read
  - Ad views: users can insert/read own

  ## Functions
  - `increment_points` RPC for safe point incrementing
  - `handle_new_user` trigger to auto-create profile on signup
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_or_email text,
  username text,
  points integer DEFAULT 0 NOT NULL,
  avatar_seed text DEFAULT '',
  spin_last_used timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'DilMeda Championship',
  end_time timestamptz NOT NULL,
  prize_pool text NOT NULL DEFAULT 'Mobile Phone',
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (true);

-- Ad views table
CREATE TABLE IF NOT EXISTS ad_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES tournaments(id) ON DELETE SET NULL,
  points_earned integer DEFAULT 5 NOT NULL,
  viewed_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ad_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ad views"
  ON ad_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ad views"
  ON ad_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, phone_or_email, username, points, avatar_seed)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.phone),
    COALESCE(split_part(NEW.email, '@', 1), 'Player' || floor(random() * 9999)::text),
    0,
    NEW.id::text
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: safely increment user points
CREATE OR REPLACE FUNCTION increment_points(user_id uuid, points_to_add integer)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET points = points + points_to_add
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed an active tournament (ends 7 days from now)
INSERT INTO tournaments (name, end_time, prize_pool, active)
VALUES (
  'DilMeda Championship S1',
  now() + interval '7 days',
  'Mobile Phone',
  true
)
ON CONFLICT DO NOTHING;

-- Add index for leaderboard performance
CREATE INDEX IF NOT EXISTS idx_profiles_points_desc ON profiles (points DESC);
