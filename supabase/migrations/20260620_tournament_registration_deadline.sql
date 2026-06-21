-- Migration to add registration deadline support for tournaments

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_deadline timestamptz;

-- For existing tournaments, default registration_deadline to end_time
UPDATE tournaments
SET registration_deadline = end_time
WHERE registration_deadline IS NULL;

-- Update sample tournaments with specific offsets
UPDATE tournaments
SET registration_deadline = now() + interval '1 day'
WHERE name = 'Gold Rush Cup';

UPDATE tournaments
SET registration_deadline = now() + interval '5 days'
WHERE name = 'Mega League';
