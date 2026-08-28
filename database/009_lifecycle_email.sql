-- Transactional member lifecycle communication. No chat content is stored here.

CREATE TABLE IF NOT EXISTS member_lifecycle (
  user_id uuid PRIMARY KEY REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  contact_email text NOT NULL DEFAULT '' CHECK (char_length(contact_email) <= 254),
  marketing_consent boolean NOT NULL DEFAULT false,
  email_suppressed boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  welcome_sent_at timestamptz,
  trial_ending_sent_at timestamptz,
  inactivity_sent_at timestamptz,
  winback_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE member_lifecycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_lifecycle_read_own_row ON member_lifecycle
  FOR SELECT USING (auth.user_id()::uuid = user_id);

CREATE INDEX IF NOT EXISTS member_lifecycle_activity_idx ON member_lifecycle (last_activity_at);
