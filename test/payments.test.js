import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { checkoutSessionParams, handleStripeWebhook, paymentsConfigured, portalSessionParams } from '../src/payments.js';

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
  assert.equal(params.subscription_data.trial_period_days, 7);
  assert.equal('discounts' in params, false);
  assert.equal(params.metadata.planCode, 'elitea-standard');
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
