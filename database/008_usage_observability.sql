-- Atomic AI fair-use counters and privacy-preserving operational monitoring.

CREATE TABLE IF NOT EXISTS ai_usage_counters (
  user_id uuid PRIMARY KEY REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  usage_month date NOT NULL DEFAULT date_trunc('month', now())::date,
  daily_messages integer NOT NULL DEFAULT 0 CHECK (daily_messages >= 0),
  monthly_messages integer NOT NULL DEFAULT 0 CHECK (monthly_messages >= 0),
  last_role_code text NOT NULL DEFAULT 'coach_mentor'
    CHECK (last_role_code IN ('coach_mentor', 'brand_marketing', 'study_trainer', 'coaching_trainer')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operational_error_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint text NOT NULL,
  window_start timestamptz NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
  area text NOT NULL,
  error_code text NOT NULL,
  path text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  request_id text,
  occurrences integer NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint, window_start)
);

CREATE INDEX IF NOT EXISTS operational_error_events_last_seen_idx
  ON operational_error_events (last_seen DESC);
CREATE INDEX IF NOT EXISTS operational_error_events_severity_idx
  ON operational_error_events (severity, last_seen DESC);

ALTER TABLE ai_usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_error_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_counters_read_own_row ON ai_usage_counters
  FOR SELECT USING (auth.user_id()::uuid = user_id);

-- operational_error_events intentionally has no browser policy; server/owner access only.
