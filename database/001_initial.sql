-- Elitea v0.5 — initial member platform schema
-- Intended for Neon Postgres + Neon Auth/Data API.
-- Apply only after Neon Auth is provisioned and test first on a preview branch.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS member_profiles (
  user_id uuid PRIMARY KEY,
  preferred_name text NOT NULL DEFAULT '',
  address_form text NOT NULL DEFAULT 'nezvoleno'
    CHECK (address_form IN ('tykani', 'vykani', 'nezvoleno')),
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching_profiles (
  user_id uuid PRIMARY KEY REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  desired_outcome text NOT NULL DEFAULT '',
  main_obstacle text NOT NULL DEFAULT '',
  support_style text NOT NULL DEFAULT 'kombinace'
    CHECK (support_style IN ('koucovani', 'mentoring', 'kombinace')),
  weekly_capacity text NOT NULL DEFAULT '',
  personal_boundaries text NOT NULL DEFAULT '',
  business_stage text NOT NULL DEFAULT 'nezjisteno'
    CHECK (business_stage IN ('napad', 'start', 'stabilita', 'rust', 'nezjisteno')),
  industry text NOT NULL DEFAULT '',
  primary_offer text NOT NULL DEFAULT '',
  target_customer text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'achieved', 'paused', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS goals_one_active_per_user_idx
  ON goals (user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS coaching_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'prijaty'
    CHECK (status IN ('navrzeny', 'prijaty', 'rozpracovany', 'splneny', 'odlozeny')),
  agreed_by_member boolean NOT NULL DEFAULT false,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coaching_tasks_user_status_idx
  ON coaching_tasks (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  mode text NOT NULL
    CHECK (mode IN ('diagnostika', 'mentoring', 'koucovaci_podpora', 'rychle_reseni', 'crisis')),
  method_id text,
  safety_level text NOT NULL DEFAULT 'normal'
    CHECK (safety_level IN ('normal', 'elevated', 'critical')),
  member_summary text NOT NULL DEFAULT '',
  outcome_summary text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN coaching_sessions.member_summary IS
  'Minimalizovaný pracovní souhrn. Neukládat hesla, platební údaje ani detailní zdravotní či krizový obsah.';

CREATE INDEX IF NOT EXISTS coaching_sessions_user_created_idx
  ON coaching_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  task_id uuid REFERENCES coaching_tasks(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestones_user_completed_idx
  ON milestones (user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS memberships (
  user_id uuid PRIMARY KEY REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe', 'manual')),
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text NOT NULL DEFAULT 'founding',
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'paused', 'cancelled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_provider_subscription_idx
  ON memberships (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS human_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  session_id uuid REFERENCES coaching_sessions(id) ON DELETE SET NULL,
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 1000),
  context_summary text NOT NULL DEFAULT '',
  member_consent_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'accepted', 'scheduled', 'completed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS human_handoffs_user_created_idx
  ON human_handoffs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  consent_type text NOT NULL
    CHECK (consent_type IN ('terms', 'privacy', 'ai_disclosure', 'memory', 'human_handoff')),
  document_version text NOT NULL,
  granted boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_events_user_type_idx
  ON consent_events (user_id, consent_type, occurred_at DESC);

-- Every user-owned table is protected with RLS. The Neon Data API validates
-- the JWT and exposes auth.user_id(). Server-side administrative workflows
-- must use a separate, audited path and never expose an owner connection.

ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_profiles_own_rows ON member_profiles
  FOR ALL USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE POLICY coaching_profiles_own_rows ON coaching_profiles
  FOR ALL USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE POLICY goals_own_rows ON goals
  FOR ALL USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE POLICY coaching_tasks_own_rows ON coaching_tasks
  FOR ALL USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE POLICY coaching_sessions_own_rows ON coaching_sessions
  FOR ALL USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE POLICY milestones_own_rows ON milestones
  FOR ALL USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE POLICY memberships_read_own_row ON memberships
  FOR SELECT USING (auth.user_id() = user_id);

CREATE POLICY human_handoffs_own_rows ON human_handoffs
  FOR ALL USING (auth.user_id() = user_id)
  WITH CHECK (auth.user_id() = user_id);

CREATE POLICY consent_events_read_own_rows ON consent_events
  FOR SELECT USING (auth.user_id() = user_id);

CREATE POLICY consent_events_insert_own_rows ON consent_events
  FOR INSERT WITH CHECK (auth.user_id() = user_id);
