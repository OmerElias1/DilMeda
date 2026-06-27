-- ============================================================
-- Tournament Prize Views
-- Run this in: Supabase → SQL Editor → New Query → Run
-- ============================================================

-- View 1: Top 3 players per tournament (with contact info for prize distribution)
CREATE OR REPLACE VIEW v_tournament_top_players AS
SELECT
  t.id           AS tournament_id,
  t.name         AS tournament_name,
  t.prize_pool,
  t.end_time,
  t.active,
  tp.user_id,
  tp.points      AS tournament_points,
  RANK() OVER (
    PARTITION BY tp.tournament_id
    ORDER BY tp.points DESC
  )              AS rank,
  p.username,
  p.full_name,
  p.phone_or_email,
  p.phone_number,
  tp.updated_at  AS last_active
FROM tournament_points tp
JOIN tournaments t ON tp.tournament_id = t.id
JOIN profiles    p ON tp.user_id       = p.id
WHERE tp.points > 0;

-- View 2: Only the #1 winner per tournament (quickest way to see who to pay)
CREATE OR REPLACE VIEW v_tournament_winners AS
SELECT *
FROM v_tournament_top_players
WHERE rank = 1
ORDER BY end_time DESC;

-- ── How to use in Supabase SQL Editor ────────────────────────────────────────
--
-- See ALL top 3 players across every tournament:
--   SELECT * FROM v_tournament_top_players WHERE rank <= 3 ORDER BY tournament_id, rank;
--
-- See only #1 winner per tournament:
--   SELECT * FROM v_tournament_winners;
--
-- See winners for a specific tournament by name:
--   SELECT * FROM v_tournament_winners WHERE tournament_name ILIKE '%your name%';
--
-- ─────────────────────────────────────────────────────────────────────────────
