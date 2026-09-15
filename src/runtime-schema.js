import { neon } from '@neondatabase/serverless';

const RUNTIME_SCHEMA_STATEMENTS = [
  `SELECT pg_advisory_xact_lock(1162624051)`,
  `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS trial_consumed_at timestamptz`,
  `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS provider_event_created_at bigint`,
  `UPDATE memberships SET trial_consumed_at=COALESCE(updated_at, now())
    WHERE trial_consumed_at IS NULL AND provider_subscription_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS ai_call_events (
    id uuid PRIMARY KEY, request_id text NOT NULL, user_id uuid,
    event jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS ai_call_events_user_time_idx ON ai_call_events (user_id, created_at)`,
  `ALTER TABLE ai_call_events ENABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id text PRIMARY KEY,
    event_type text NOT NULL,
    event_created bigint NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('processing', 'processed')),
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_idx
    ON stripe_webhook_events (received_at DESC)`,
  `ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS membership_checkout_intents (
    user_id uuid PRIMARY KEY REFERENCES member_profiles(user_id) ON DELETE CASCADE,
    intent_id uuid NOT NULL UNIQUE,
    plan_code text NOT NULL CHECK (plan_code IN ('standard', 'founding30')),
    checkout_email text NOT NULL DEFAULT '' CHECK (char_length(checkout_email) <= 254),
    status text NOT NULL CHECK (status IN ('creating', 'open', 'completed', 'failed')),
    stripe_session_id text UNIQUE,
    checkout_url text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS membership_checkout_intents_expiry_idx
    ON membership_checkout_intents (expires_at)`,
  `ALTER TABLE membership_checkout_intents ENABLE ROW LEVEL SECURITY`,
  `UPDATE browser_operator_sessions SET status='ended', ended_at=COALESCE(ended_at, now())
    WHERE status='running' AND expires_at IS NOT NULL AND expires_at <= now()`,
  `WITH ranked AS (
      SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
      FROM browser_operator_sessions WHERE status='running'
    )
    UPDATE browser_operator_sessions SET status='ended', ended_at=COALESCE(ended_at, now())
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS browser_operator_one_active_per_user_idx
    ON browser_operator_sessions (user_id) WHERE status='running'`,
  `CREATE TABLE IF NOT EXISTS ai_usage_counters (
    user_id uuid PRIMARY KEY REFERENCES member_profiles(user_id) ON DELETE CASCADE,
    usage_date date NOT NULL DEFAULT current_date,
    usage_month date NOT NULL DEFAULT date_trunc('month', now())::date,
    daily_messages integer NOT NULL DEFAULT 0 CHECK (daily_messages >= 0),
    monthly_messages integer NOT NULL DEFAULT 0 CHECK (monthly_messages >= 0),
    last_role_code text NOT NULL DEFAULT 'coach_mentor'
      CHECK (last_role_code IN ('coach_mentor', 'brand_marketing', 'study_trainer', 'coaching_trainer')),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS operational_error_events (
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
  )`,
  `CREATE INDEX IF NOT EXISTS operational_error_events_last_seen_idx
    ON operational_error_events (last_seen DESC)`,
  `CREATE INDEX IF NOT EXISTS operational_error_events_severity_idx
    ON operational_error_events (severity, last_seen DESC)`,
  `ALTER TABLE ai_usage_counters ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE operational_error_events ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = current_schema()
        AND tablename = 'ai_usage_counters'
        AND policyname = 'ai_usage_counters_read_own_row'
    ) THEN
      CREATE POLICY ai_usage_counters_read_own_row ON ai_usage_counters
        FOR SELECT USING (auth.user_id()::uuid = user_id);
    END IF;
  END $$`,
  `CREATE TABLE IF NOT EXISTS member_lifecycle (
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
  )`,
  `ALTER TABLE member_lifecycle ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = current_schema()
        AND tablename = 'member_lifecycle'
        AND policyname = 'member_lifecycle_read_own_row'
    ) THEN
      CREATE POLICY member_lifecycle_read_own_row ON member_lifecycle
        FOR SELECT USING (auth.user_id()::uuid = user_id);
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS member_lifecycle_activity_idx
    ON member_lifecycle (last_activity_at)`,
  `CREATE TABLE IF NOT EXISTS public_coach_test_feedback (
    id text PRIMARY KEY,
    session_id text NOT NULL UNIQUE,
    role_mode text NOT NULL CHECK (role_mode IN ('coach', 'mentor')),
    turn_count integer NOT NULL CHECK (turn_count >= 0 AND turn_count <= 6),
    evaluator_name text NOT NULL CHECK (char_length(evaluator_name) BETWEEN 2 AND 100),
    contact text NOT NULL DEFAULT '' CHECK (char_length(contact) <= 180),
    usefulness smallint NOT NULL CHECK (usefulness BETWEEN 1 AND 5),
    role_fidelity smallint NOT NULL CHECK (role_fidelity BETWEEN 1 AND 5),
    would_use text NOT NULL CHECK (would_use IN ('yes', 'maybe', 'no')),
    notes text NOT NULL CHECK (char_length(notes) BETWEEN 10 AND 2400),
    transcript_consent boolean NOT NULL DEFAULT false,
    transcript jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (transcript_consent OR transcript IS NULL)
  )`,
  `ALTER TABLE public_coach_test_feedback ENABLE ROW LEVEL SECURITY`,
  `CREATE INDEX IF NOT EXISTS public_coach_test_feedback_created_idx
    ON public_coach_test_feedback (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS academy_course_evidence (
    user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
    course_id text NOT NULL,
    course_slug text NOT NULL,
    completed_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    portfolio_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    evidence_hash text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id)
  )`,
  `CREATE TABLE IF NOT EXISTS academy_exam_attempts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
    course_id text NOT NULL,
    course_slug text NOT NULL,
    item_id text NOT NULL,
    scenario_id text NOT NULL,
    all_proven boolean NOT NULL DEFAULT false,
    quality_passed boolean NOT NULL DEFAULT false,
    provider text NOT NULL,
    transcript_hash text NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE academy_exam_attempts ADD COLUMN IF NOT EXISTS training_attempt_id uuid`,
  `CREATE UNIQUE INDEX IF NOT EXISTS academy_exam_attempts_training_attempt_idx
    ON academy_exam_attempts (user_id, course_id, training_attempt_id)
    WHERE training_attempt_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS academy_exam_attempts_lookup_idx
    ON academy_exam_attempts (user_id, course_id, completed_at DESC)`,
  `CREATE TABLE IF NOT EXISTS academy_coach_debrief_attempts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
    course_id text NOT NULL,
    course_slug text NOT NULL,
    item_id text NOT NULL,
    scenario_id text NOT NULL,
    difficulty text NOT NULL CHECK (difficulty IN ('guided', 'standard', 'advanced', 'expert')),
    final_exam boolean NOT NULL DEFAULT false,
    provider text NOT NULL,
    quality_passed boolean NOT NULL DEFAULT false,
    achievement jsonb NOT NULL DEFAULT '{}'::jsonb,
    critical_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
    transcript_hash text NOT NULL CHECK (transcript_hash ~ '^[0-9a-f]{64}$'),
    completed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, course_id, transcript_hash)
  )`,
  `ALTER TABLE academy_coach_debrief_attempts ADD COLUMN IF NOT EXISTS training_attempt_id uuid`,
  `CREATE UNIQUE INDEX IF NOT EXISTS academy_coach_debrief_training_attempt_idx
    ON academy_coach_debrief_attempts (user_id, course_id, training_attempt_id)
    WHERE training_attempt_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS academy_coach_debrief_attempts_lookup_idx
    ON academy_coach_debrief_attempts (user_id, course_id, completed_at ASC)`,
  `CREATE TABLE IF NOT EXISTS academy_quiz_attempts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
    course_id text NOT NULL,
    course_slug text NOT NULL,
    item_id text NOT NULL,
    attempt_number integer NOT NULL CHECK (attempt_number > 0),
    correct_count integer NOT NULL CHECK (correct_count >= 0),
    question_count integer NOT NULL CHECK (question_count > 0),
    score_percent integer NOT NULL CHECK (score_percent BETWEEN 0 AND 100),
    pass_percent integer NOT NULL CHECK (pass_percent BETWEEN 1 AND 100),
    passed boolean NOT NULL DEFAULT false,
    selected_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    completed_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS academy_quiz_attempts_lookup_idx
    ON academy_quiz_attempts (user_id, course_id, item_id, passed, completed_at DESC)`,
  `CREATE TABLE IF NOT EXISTS academy_certificates (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
    course_id text NOT NULL,
    course_slug text NOT NULL,
    member_name text NOT NULL CHECK (char_length(member_name) BETWEEN 2 AND 120),
    course_title text NOT NULL,
    completed_at timestamptz NOT NULL,
    issued_at timestamptz NOT NULL DEFAULT now(),
    template_variant text NOT NULL CHECK (template_variant IN ('light', 'dark')),
    evidence_hash text NOT NULL,
    revoked_at timestamptz,
    UNIQUE (user_id, course_id)
  )`,
  `CREATE INDEX IF NOT EXISTS academy_certificates_member_idx
    ON academy_certificates (user_id, issued_at DESC)`,
  `ALTER TABLE academy_course_evidence ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE academy_exam_attempts ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE academy_coach_debrief_attempts ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE academy_quiz_attempts ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE academy_certificates ENABLE ROW LEVEL SECURITY`,
];

let bootstrapPromise = null;
let schemaReady = false;

export function runtimeSchemaStatements() {
  return [...RUNTIME_SCHEMA_STATEMENTS];
}

export function runtimeSchemaStatus() {
  return { configured: Boolean(process.env.DATABASE_URL), ready: schemaReady };
}

export async function ensureRuntimeSchema(env = process.env, dependencies = {}) {
  if (!env.DATABASE_URL) return { configured: false, ready: false };
  if (schemaReady) return { configured: true, ready: true };
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
    await sql.transaction(transaction => RUNTIME_SCHEMA_STATEMENTS.map(statement => transaction.query(statement)));
    schemaReady = true;
    return { configured: true, ready: true };
  })();

  try {
    return await bootstrapPromise;
  } catch (error) {
    bootstrapPromise = null;
    const wrapped = new Error('Produkční databázové schéma Elitea se nepodařilo připravit.');
    wrapped.code = 'RUNTIME_SCHEMA_BOOTSTRAP_FAILED';
    wrapped.cause = error;
    throw wrapped;
  }
}
