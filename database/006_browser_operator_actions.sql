-- Server-owned browser action previews. Selectors and arguments never leave
-- the server; members receive only a human-readable description and risk.

CREATE TABLE IF NOT EXISTS browser_operator_action_drafts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES browser_operator_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  instruction_fingerprint text NOT NULL CHECK (char_length(instruction_fingerprint) = 64),
  action_fingerprint text NOT NULL CHECK (char_length(action_fingerprint) = 64),
  description text NOT NULL,
  method text NOT NULL,
  risk text NOT NULL CHECK (risk IN ('read', 'draft', 'secret', 'publish', 'spend', 'destructive')),
  can_execute boolean NOT NULL DEFAULT false,
  manual_reason text NOT NULL DEFAULT '',
  action jsonb NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK (status IN ('awaiting_confirmation', 'executing', 'succeeded', 'failed', 'cancelled', 'expired')),
  safe_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  executed_at timestamptz
);

CREATE INDEX IF NOT EXISTS browser_operator_action_drafts_user_idx
  ON browser_operator_action_drafts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS browser_operator_action_drafts_session_idx
  ON browser_operator_action_drafts (session_id, created_at DESC);

ALTER TABLE browser_operator_action_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY browser_operator_action_drafts_read_own ON browser_operator_action_drafts
  FOR SELECT USING (auth.user_id()::uuid = user_id);

-- Inserts and updates stay server-only. Client code cannot replace the
-- reviewed selector, arguments, fingerprint, risk or execution state.
