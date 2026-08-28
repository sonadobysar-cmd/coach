import test from 'node:test';
import assert from 'node:assert/strict';
import { lifecycleCampaignFor, lifecycleConfigured } from '../src/lifecycle-email.js';

const now = new Date('2026-08-27T10:00:00Z');

test('lifecycle vybere přivítání a před koncem trialu dá přednost upozornění', () => {
  assert.equal(lifecycleCampaignFor({ status: 'active' }, now).kind, 'welcome');
  assert.equal(lifecycleCampaignFor({ status: 'trialing', current_period_end: '2026-08-29T10:00:00Z' }, now).kind, 'trial_ending');
});

test('návratová komunikace po zrušení vyžaduje marketingový souhlas', () => {
  assert.equal(lifecycleCampaignFor({ status: 'cancelled', marketing_consent: false }, now), null);
  assert.equal(lifecycleCampaignFor({ status: 'cancelled', marketing_consent: true }, now).kind, 'winback');
});

test('odesílací doména je povinná a testovací fallback neexistuje', () => {
  const env = { DATABASE_URL: 'postgres://example', RESEND_API_KEY: 're_example', ELITEA_FROM_EMAIL: 'Elitea <ahoj@elitea.cz>' };
  assert.equal(lifecycleConfigured(env), true);
  assert.equal(lifecycleConfigured({ ...env, ELITEA_FROM_EMAIL: '' }), false);
});
