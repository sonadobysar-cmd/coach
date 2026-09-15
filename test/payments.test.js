import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  checkoutIdempotencyKey,
  checkoutSessionParams,
  createMembershipCheckout,
  handleStripeWebhook,
  isOwnerMember,
  membershipBlocksCheckout,
  membershipFor,
  normalizeMembershipAccess,
  paymentsConfigured,
  portalSessionParams,
  stripeSubscriptionPeriodEnd,
} from '../src/payments.js';

const complete = {
  STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_PRICE_ID: 'price_example', STRIPE_FOUNDING_COUPON_ID: 'coupon_example',
  STRIPE_WEBHOOK_SECRET: 'whsec_example', DATABASE_URL: 'postgresql://example',
  NEON_AUTH_JWKS_URL: 'https://auth.example/.well-known/jwks.json',
};

test('standardní platby nevyžadují veřejný slevový kupon', () => {
  assert.equal(paymentsConfigured(complete), true);
  for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'DATABASE_URL', 'NEON_AUTH_JWKS_URL']) {
    assert.equal(paymentsConfigured({ ...complete, [key]: '' }), false, key);
  }
  assert.equal(paymentsConfigured({ ...complete, STRIPE_FOUNDING_COUPON_ID: '' }), true);
});

test('produkční checkout vždy vyžaduje souhlas s obchodními podmínkami', () => {
  const params = checkoutSessionParams(
    { id: '00000000-0000-4000-8000-000000000001', email: 'clenka@example.cz' },
    '',
    { planCode: 'standard' },
    { ...complete, PUBLIC_APP_URL: 'https://elitea.cz' },
  );
  assert.deepEqual(params.consent_collection, { terms_of_service: 'required' });
  assert.equal(params.payment_method_collection, 'always');
  assert.equal(params.subscription_data.trial_period_days, 7);
  assert.equal('discounts' in params, false);
  assert.equal(params.metadata.planCode, 'elitea-standard');
});

test('vlastnický účet používá přihlášení, ale nikdy nepotřebuje Stripe předplatné', async () => {
  const member = { id: '00000000-0000-4000-8000-000000000001', email: 'nia@example.cz', emailVerified: true };
  const env = { ELITEA_OWNER_USER_IDS: member.id, ELITEA_OWNER_EMAILS: 'NIA@example.cz' };

  assert.equal(isOwnerMember(member, env), true);
  assert.equal(isOwnerMember({ ...member, id: '00000000-0000-4000-8000-000000000099', email: 'clenka@example.cz' }, env), false);
  assert.deepEqual(await membershipFor(member, env), {
    status: 'owner',
    plan_code: 'elitea-owner',
    current_period_end: null,
    cancel_at_period_end: false,
  });
});

test('vlastnický přístup podle e-mailu vyžaduje ověřenou adresu a nepoužívá provozní inbox', () => {
  const member = { id: '00000000-0000-4000-8000-000000000002', email: 'nia@example.cz', emailVerified: false };
  assert.equal(isOwnerMember(member, { ELITEA_OWNER_EMAILS: 'nia@example.cz' }), false);
  assert.equal(isOwnerMember({ ...member, emailVerified: true }, { ELITEA_OWNER_EMAILS: 'nia@example.cz' }), true);
  assert.equal(isOwnerMember({ ...member, emailVerified: true }, { NIA_TESTER_EMAIL: 'nia@example.cz' }), false);
});

test('Founding 30 má slevu jen pro explicitně zvolený testerský plán', () => {
  const params = checkoutSessionParams(
    { id: '00000000-0000-4000-8000-000000000001', email: 'testerka@example.cz' },
    '',
    { planCode: 'founding30' },
    complete,
  );
  assert.deepEqual(params.discounts, [{ coupon: complete.STRIPE_FOUNDING_COUPON_ID }]);
  assert.equal(params.metadata.planCode, 'elitea-founding30');
  assert.equal(params.subscription_data.trial_period_days, 7);
});

test('trial lze přidat jen účtu, který ho ještě nevyužil, a vracející se zákaznice použije stejné Stripe customer ID', () => {
  const member = { id: '00000000-0000-4000-8000-000000000001', email: 'testerka@example.cz' };
  const first = checkoutSessionParams(member, '', { planCode: 'standard', trialEligible: true }, complete);
  const returning = checkoutSessionParams(member, '', {
    planCode: 'standard', trialEligible: false, customerId: 'cus_returning',
  }, complete);
  assert.equal(first.subscription_data.trial_period_days, 7);
  assert.equal(first.customer_email, member.email);
  assert.equal('customer' in first, false);
  assert.equal('trial_period_days' in returning.subscription_data, false);
  assert.equal(returning.customer, 'cus_returning');
  assert.equal('customer_email' in returning, false);
});

test('existující neterminální Stripe předplatné blokuje nový checkout', () => {
  assert.equal(membershipBlocksCheckout({ status: 'trialing', provider_subscription_id: 'sub_1' }), true);
  assert.equal(membershipBlocksCheckout({ status: 'active', provider_subscription_id: 'sub_1' }), true);
  assert.equal(membershipBlocksCheckout({ status: 'inactive', provider_subscription_id: 'sub_incomplete' }), true);
  assert.equal(membershipBlocksCheckout({ status: 'cancelled', provider_subscription_id: 'sub_1' }), false);
  assert.equal(membershipBlocksCheckout({ status: 'inactive', provider_subscription_id: null }), false);
});

test('Stripe idempotence je stabilní pro jeden serverový checkout intent', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const intentA = '10000000-0000-4000-8000-000000000001';
  const intentB = '10000000-0000-4000-8000-000000000002';
  assert.equal(checkoutIdempotencyKey(userId, intentA), checkoutIdempotencyKey(userId, intentA));
  assert.notEqual(checkoutIdempotencyKey(userId, intentA), checkoutIdempotencyKey(userId, intentB));
});

test('Dahlia subscription používá konec trialu, potom nejzazší periodu položek a až nakonec legacy field', () => {
  assert.equal(stripeSubscriptionPeriodEnd({
    status: 'trialing', trial_end: 1_800_000_000,
    items: { data: [{ current_period_end: 1_900_000_000 }] },
  }), 1_800_000_000);
  assert.equal(stripeSubscriptionPeriodEnd({
    status: 'active', trial_end: 1_700_000_000,
    items: { data: [{ current_period_end: 1_800_000_000 }, { current_period_end: 1_850_000_000 }] },
  }), 1_850_000_000);
  assert.equal(stripeSubscriptionPeriodEnd({ status: 'active', current_period_end: 1_750_000_000 }), 1_750_000_000);
  assert.equal(stripeSubscriptionPeriodEnd({ status: 'active', items: { data: [] } }), 0);
});

test('aktivní členství bez platného konce období nikdy nedává časově neomezený přístup', () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);
  assert.equal(normalizeMembershipAccess({ status: 'active', current_period_end: null }, now).status, 'inactive');
  assert.equal(normalizeMembershipAccess({ status: 'trialing', current_period_end: 'invalid' }, now).status, 'inactive');
  assert.equal(normalizeMembershipAccess({ status: 'active', current_period_end: '2026-09-15T11:59:59.000Z' }, now).status, 'inactive');
  assert.equal(normalizeMembershipAccess({ status: 'active', current_period_end: '2026-09-15T12:00:01.000Z' }, now).status, 'active');
});

test('souběžné checkouty různých plánů vytvoří pouze jednu Stripe Session', async () => {
  const harness = checkoutHarness();
  const member = { id: '00000000-0000-4000-8000-000000000001', email: 'testerka@example.cz' };
  const dependencies = harness.dependencies();
  const results = await Promise.allSettled([
    createMembershipCheckout(member, '', { planCode: 'standard' }, complete, dependencies),
    createMembershipCheckout(member, '', { planCode: 'founding30' }, complete, dependencies),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'CHECKOUT_ALREADY_IN_PROGRESS');
  assert.equal(harness.stripeCalls.length, 1);
});

test('souběžné opakování stejného plánu sdílí intent, Stripe idempotency key i výslednou URL', async () => {
  const harness = checkoutHarness();
  const member = { id: '00000000-0000-4000-8000-000000000001', email: 'testerka@example.cz' };
  const dependencies = harness.dependencies();
  const results = await Promise.all([
    createMembershipCheckout(member, '', { planCode: 'standard' }, complete, dependencies),
    createMembershipCheckout(member, '', { planCode: 'standard' }, complete, dependencies),
  ]);
  assert.equal(results[0].url, results[1].url);
  assert.equal(new Set(harness.stripeCalls.map(call => call.idempotencyKey)).size, 1);
  assert.equal(new Set(harness.stripeCalls.map(call => call.params.expires_at)).size, 1);
});

test('souhlas ve Stripe lze vypnout pouze explicitně pro neostrý sandbox', () => {
  const params = checkoutSessionParams(
    { id: '00000000-0000-4000-8000-000000000001', email: 'clenka@example.cz' },
    '',
    { planCode: 'standard' },
    { ...complete, STRIPE_COLLECT_TERMS: 'false' },
  );
  assert.equal('consent_collection' in params, false);
});

test('zákaznický portál používá schválenou konfiguraci a vrací se do účtu Elitea', () => {
  const params = portalSessionParams('cus_example', {
    PUBLIC_APP_URL: 'https://elitea.cz',
    STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_example',
  });
  assert.deepEqual(params, {
    customer: 'cus_example',
    return_url: 'https://elitea.cz/#app-member',
    configuration: 'bpc_example',
  });
});

test('webhook přijme pouze událost s platným Stripe podpisem', async () => {
  const payload = JSON.stringify({ id: 'evt_elitea_verify', object: 'event', type: 'elitea.verification', data: { object: {} } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: complete.STRIPE_WEBHOOK_SECRET });
  assert.deepEqual(await handleStripeWebhook(payload, signature, complete), { received: true });
  await assert.rejects(() => handleStripeWebhook(payload, 't=1,v1=invalid', complete));
});

test('subscription webhook ukládá aktuální Dahlia periodu, ne zastaralý payload', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const captured = { membershipValues: null, processed: false };
  const sql = async (strings, ...values) => {
    const query = strings.join(' ');
    if (/INSERT INTO stripe_webhook_events/.test(query)) return [{ event_id: 'evt_period' }];
    if (/INSERT INTO member_profiles/.test(query)) return [];
    if (/INSERT INTO memberships/.test(query)) {
      captured.membershipValues = values;
      return [{ user_id: userId }];
    }
    if (/UPDATE stripe_webhook_events SET status='processed'/.test(query)) {
      captured.processed = true;
      return [];
    }
    throw new Error(`Unexpected SQL in webhook test: ${query}`);
  };
  const stripe = {
    webhooks: { constructEvent: () => ({
      id: 'evt_period', type: 'customer.subscription.updated', created: 1_790_000_000,
      data: { object: { id: 'sub_current', status: 'trialing', metadata: { eliteaUserId: userId } } },
    }) },
    subscriptions: { retrieve: async () => ({
      id: 'sub_current', status: 'active', customer: { id: 'cus_current' }, cancel_at_period_end: false,
      metadata: { eliteaUserId: userId, planCode: 'elitea-standard' },
      trial_end: 1_700_000_000,
      items: { data: [{ current_period_end: 1_850_000_000 }, { current_period_end: 1_860_000_000 }] },
    }) },
  };

  assert.deepEqual(await handleStripeWebhook('payload', 'signature', complete, { sql, stripe }), { received: true });
  assert.equal(captured.membershipValues[4], 'active');
  assert.equal(captured.membershipValues[5], new Date(1_860_000_000 * 1000).toISOString());
  assert.equal(captured.membershipValues[1], 'cus_current');
  assert.equal(captured.processed, true);
});

test('subscription bez bezpečné vazby na účet není označena jako zpracovaná', async () => {
  const queries = [];
  const sql = async (strings, ..._values) => {
    const query = strings.join(' ');
    queries.push(query);
    if (/INSERT INTO stripe_webhook_events/.test(query)) return [{ event_id: 'evt_orphan' }];
    if (/SELECT user_id::text AS user_id FROM memberships/.test(query)) return [];
    if (/DELETE FROM stripe_webhook_events/.test(query)) return [];
    if (/UPDATE stripe_webhook_events SET status='processed'/.test(query)) throw new Error('Orphan event must not be marked processed.');
    throw new Error(`Unexpected SQL in orphan webhook test: ${query}`);
  };
  const stripe = {
    webhooks: { constructEvent: () => ({
      id: 'evt_orphan', type: 'customer.subscription.deleted', created: 1_790_000_000,
      data: { object: { id: 'sub_orphan', metadata: {} } },
    }) },
    subscriptions: { retrieve: async () => ({
      id: 'sub_orphan', status: 'canceled', customer: 'cus_orphan', metadata: {}, items: { data: [] },
    }) },
  };

  await assert.rejects(
    () => handleStripeWebhook('payload', 'signature', complete, { sql, stripe }),
    error => error.code === 'STRIPE_SUBSCRIPTION_USER_MISSING',
  );
  assert.equal(queries.some(query => /status='processed'/.test(query)), false);
  assert.equal(queries.some(query => /DELETE FROM stripe_webhook_events/.test(query)), true);
});

test('webhook claim dovolí bezpečný retry pouze po desetiminutovém processing timeoutu', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/payments.js', import.meta.url), 'utf8'));
  assert.match(source, /ON CONFLICT \(event_id\) DO UPDATE SET[\s\S]*status='processing'/);
  assert.match(source, /received_at <= now\(\) - interval '10 minutes'/);
  assert.match(source, /WHERE stripe_webhook_events\.status='processing'/);
});

function checkoutHarness() {
  const now = Date.UTC(2026, 8, 15, 10, 0, 0);
  const state = { intent: null, membership: null };
  const stripeCalls = [];
  const stripeSessions = new Map();
  let uuidSequence = 0;

  const sql = async (strings, ...values) => {
    const query = strings.join(' ');
    if (/SELECT provider_customer_id, provider_subscription_id/.test(query)) {
      return state.membership ? [{ ...state.membership }] : [];
    }
    if (/INSERT INTO membership_checkout_intents/.test(query)) {
      const [userId, intentId, planCode, checkoutEmail, expiresAt] = values;
      const expired = state.intent && new Date(state.intent.expires_at).getTime() <= now;
      if (!state.intent || expired || state.intent.status === 'failed') {
        state.intent = {
          user_id: userId,
          intent_id: intentId,
          plan_code: planCode,
          checkout_email: checkoutEmail,
          status: 'creating',
          stripe_session_id: null,
          checkout_url: null,
          expires_at: expiresAt,
        };
        return [{ ...state.intent }];
      }
      return [];
    }
    if (/SELECT intent_id, plan_code, checkout_email/.test(query)) {
      return state.intent ? [{ ...state.intent }] : [];
    }
    if (/UPDATE membership_checkout_intents SET\s+status='open'/.test(query)) {
      const [sessionId, checkoutUrl, expiresAt, userId, intentId] = values;
      if (state.intent?.user_id === userId && state.intent?.intent_id === intentId) {
        Object.assign(state.intent, {
          status: 'open', stripe_session_id: sessionId, checkout_url: checkoutUrl, expires_at: expiresAt,
        });
      }
      return [];
    }
    throw new Error(`Unexpected SQL in checkout harness: ${query}`);
  };

  const stripe = {
    checkout: {
      sessions: {
        create: async (params, { idempotencyKey }) => {
          stripeCalls.push({ params, idempotencyKey });
          if (!stripeSessions.has(idempotencyKey)) {
            stripeSessions.set(idempotencyKey, {
              id: `cs_${stripeSessions.size + 1}`,
              url: `https://checkout.stripe.test/${stripeSessions.size + 1}`,
              expires_at: params.expires_at,
            });
          }
          await new Promise(resolve => setImmediate(resolve));
          return stripeSessions.get(idempotencyKey);
        },
      },
    },
  };

  return {
    stripeCalls,
    dependencies: () => ({
      sql,
      stripe,
      now: () => now,
      randomUUID: () => `10000000-0000-4000-8000-${String(++uuidSequence).padStart(12, '0')}`,
      rememberMemberContact: async () => {},
    }),
  };
}
