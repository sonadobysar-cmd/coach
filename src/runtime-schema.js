import { neon } from '@neondatabase/serverless';

const RUNTIME_SCHEMA_STATEMENTS = [
  `SELECT pg_advisory_xact_lock(1162624051)`,
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
