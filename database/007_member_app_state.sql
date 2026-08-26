-- Elitea member study state used by the browser client.
-- The row is keyed directly by the Neon Auth user id: a newly registered
-- member may save her first state before checkout creates wider profile data.

CREATE TABLE IF NOT EXISTS member_app_state (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  course_progress jsonb NOT NULL DEFAULT '[]'::jsonb,
  course_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  worksheet_entries jsonb NOT NULL DEFAULT '{}'::jsonb,
  course_mastery jsonb NOT NULL DEFAULT '{}'::jsonb,
  training_portfolio jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome_store jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_consent_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE member_app_state
  ADD COLUMN IF NOT EXISTS memory_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE member_app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_app_state_own_rows ON member_app_state;
CREATE POLICY member_app_state_own_rows ON member_app_state
  FOR ALL
  USING (auth.user_id()::uuid = user_id)
  WITH CHECK (auth.user_id()::uuid = user_id);
