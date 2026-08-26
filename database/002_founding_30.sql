-- Elitea Founding 30 — uzavřený testerský program a anonymní provozní metriky.

CREATE TABLE IF NOT EXISTS founding_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES member_profiles(user_id) ON DELETE SET NULL,
  preferred_name text NOT NULL CHECK (char_length(preferred_name) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254),
  whatsapp_phone text NOT NULL CHECK (char_length(whatsapp_phone) BETWEEN 7 AND 40),
  primary_focus text NOT NULL
    CHECK (primary_focus IN ('coach_mentor', 'coaching_training', 'brand_marketing', 'academy', 'whole_elitea')),
  motivation text NOT NULL CHECK (char_length(motivation) BETWEEN 40 AND 3000),
  desired_result text NOT NULL CHECK (char_length(desired_result) BETWEEN 20 AND 2000),
  weekly_use_commitment boolean NOT NULL DEFAULT false,
  structured_feedback_commitment boolean NOT NULL DEFAULT false,
  whatsapp_commitment boolean NOT NULL DEFAULT false,
  honest_review_commitment boolean NOT NULL DEFAULT false,
  privacy_acknowledged boolean NOT NULL DEFAULT false,
  testimonial_contact_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'shortlisted', 'approved', 'active', 'declined', 'withdrawn', 'completed')),
  assigned_seat smallint UNIQUE CHECK (assigned_seat BETWEEN 1 AND 30),
  approved_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS founding_applications_email_idx
  ON founding_applications (lower(email));
CREATE INDEX IF NOT EXISTS founding_applications_status_created_idx
  ON founding_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS founding_applications_user_idx
  ON founding_applications (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS founding_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES founding_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT current_date,
  role_used text NOT NULL
    CHECK (role_used IN ('coach_mentor', 'coaching_training', 'brand_marketing', 'study_trainer', 'whole_elitea')),
  usefulness smallint NOT NULL CHECK (usefulness BETWEEN 1 AND 5),
  result_summary text NOT NULL CHECK (char_length(result_summary) BETWEEN 20 AND 3000),
  friction_summary text NOT NULL DEFAULT '' CHECK (char_length(friction_summary) <= 3000),
  follow_up_allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS founding_feedback_application_created_idx
  ON founding_feedback (application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES member_profiles(user_id) ON DELETE SET NULL,
  role_code text NOT NULL
    CHECK (role_code IN ('coach_mentor', 'brand_marketing', 'study_trainer', 'coaching_trainer')),
  model_id text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  cached_input_tokens integer NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  quality_passed boolean,
  repaired boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON ai_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_role_created_idx
  ON ai_usage_events (role_code, created_at DESC);

ALTER TABLE founding_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE founding_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY founding_applications_read_own_rows ON founding_applications
  FOR SELECT USING (auth.user_id()::uuid = user_id);

CREATE POLICY founding_feedback_read_own_rows ON founding_feedback
  FOR SELECT USING (auth.user_id()::uuid = user_id);

CREATE POLICY founding_feedback_insert_own_rows ON founding_feedback
  FOR INSERT WITH CHECK (auth.user_id()::uuid = user_id);

CREATE POLICY ai_usage_events_read_own_rows ON ai_usage_events
  FOR SELECT USING (auth.user_id()::uuid = user_id);
