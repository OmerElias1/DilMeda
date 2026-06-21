-- Migration to create support_reports table

CREATE TABLE IF NOT EXISTS support_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category    text NOT NULL,
  subject     text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE support_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports"
  ON support_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports"
  ON support_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_reports_user ON support_reports(user_id);
