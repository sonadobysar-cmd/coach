-- Elitea marketing operator: connected accounts, immutable previews,
-- explicit approvals and auditable execution results.
-- Apply first to a Neon preview branch. OAuth tokens belong in an encrypted
-- secret vault; this schema stores only a provider-side connection reference.

CREATE TABLE IF NOT EXISTS marketing_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta_ads', 'instagram', 'facebook_page', 'website', 'email')),
  provider_account_id text NOT NULL,
  provider_account_name text NOT NULL DEFAULT '',
  connection_secret_ref text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (user_id, provider, provider_account_id)
);

COMMENT ON COLUMN marketing_connections.connection_secret_ref IS
  'Opaque reference to an encrypted token in a secret vault. Never store a raw OAuth token here.';

CREATE TABLE IF NOT EXISTS marketing_action_drafts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  connection_id uuid REFERENCES marketing_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  action text NOT NULL,
  risk text NOT NULL CHECK (risk IN ('read', 'draft', 'write_paused', 'publish', 'spend', 'spend_control', 'destructive')),
  status text NOT NULL DEFAULT 'awaiting_approval'
    CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'executing', 'succeeded', 'failed', 'cancelled', 'expired')),
  preview jsonb NOT NULL,
  preview_fingerprint text NOT NULL CHECK (char_length(preview_fingerprint) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES marketing_action_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  preview_fingerprint text NOT NULL CHECK (char_length(preview_fingerprint) = 64),
  approval_text text NOT NULL CHECK (char_length(approval_text) BETWEEN 1 AND 1000),
  approved_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (draft_id, preview_fingerprint)
);

CREATE TABLE IF NOT EXISTS marketing_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES marketing_action_drafts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('started', 'provider_succeeded', 'provider_failed', 'verified', 'rolled_back')),
  provider_object_id text,
  safe_result jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_connections_user_idx ON marketing_connections (user_id, provider, status);
CREATE INDEX IF NOT EXISTS marketing_drafts_user_idx ON marketing_action_drafts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_events_draft_idx ON marketing_execution_events (draft_id, occurred_at DESC);

ALTER TABLE marketing_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_action_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_action_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_connections_read_own ON marketing_connections
  FOR SELECT USING (user_id = auth.user_id());
CREATE POLICY marketing_drafts_read_own ON marketing_action_drafts
  FOR SELECT USING (user_id = auth.user_id());
CREATE POLICY marketing_approvals_read_own ON marketing_action_approvals
  FOR SELECT USING (user_id = auth.user_id());
CREATE POLICY marketing_events_read_own ON marketing_execution_events
  FOR SELECT USING (user_id = auth.user_id());

-- Mutations intentionally have no client-side RLS policy. They must pass
-- through the authenticated server workflow that validates fingerprints,
-- scopes, expiry, budgets and provider responses.
