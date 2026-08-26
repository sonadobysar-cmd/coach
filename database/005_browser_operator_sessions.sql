-- Isolated remote-browser sessions owned by one authenticated Elitea member.
-- Live-view URLs are deliberately not persisted because they grant temporary access.

CREATE TABLE IF NOT EXISTS browser_operator_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('browserbase')),
  provider_session_id text NOT NULL UNIQUE,
  target text NOT NULL CHECK (target IN ('canva', 'meta_ads')),
  start_url text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ended', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS browser_operator_sessions_user_idx
  ON browser_operator_sessions (user_id, created_at DESC);

ALTER TABLE browser_operator_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY browser_operator_sessions_read_own ON browser_operator_sessions
  FOR SELECT USING (auth.user_id()::uuid = user_id);

-- Creation, release and state changes remain server-only so another browser
-- client cannot start billable sessions or terminate somebody else's work.
