-- One trial and one canonical Stripe subscription state per Elitea account.
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS trial_consumed_at timestamptz;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS provider_event_created_at bigint;

-- Legacy subscriptions existed before the one-trial marker. Treat every account
-- already linked to Stripe as having consumed its introductory trial; otherwise
-- a cancelled legacy account could start another free trial after this rollout.
UPDATE memberships
SET trial_consumed_at=COALESCE(updated_at, now())
WHERE trial_consumed_at IS NULL
  AND provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  event_created bigint NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('processing', 'processed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_idx
  ON stripe_webhook_events (received_at DESC);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- A single canonical Checkout Session may be open for one member at a time.
-- The intent ID is also the stable Stripe idempotency identity, so retrying an
-- ambiguous network request cannot create another subscription.
CREATE TABLE IF NOT EXISTS membership_checkout_intents (
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
);

CREATE INDEX IF NOT EXISTS membership_checkout_intents_expiry_idx
  ON membership_checkout_intents (expires_at);

ALTER TABLE membership_checkout_intents ENABLE ROW LEVEL SECURITY;
