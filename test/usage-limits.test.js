import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBillableAiResult,
  refundAiTurn,
  reserveAiTurn,
  usagePolicyFor,
} from '../src/usage-limits.js';

test('standardní členství má velkorysý, ale konečný fair-use limit', () => {
  assert.deepEqual(usagePolicyFor({ status: 'active', plan_code: 'elitea-standard' }, {}), {
    plan: 'standard', unlimited: false, monthlyMessages: 500, dailyMessages: 60,
  });
});

test('Founding 30 může produkt intenzivně testovat', () => {
  assert.deepEqual(usagePolicyFor({ status: 'active', plan_code: 'elitea-founding30' }, {}), {
    plan: 'founding30', unlimited: false, monthlyMessages: 3000, dailyMessages: 150,
  });
});

test('vlastnický účet je bez limitu a produkční limity lze řízeně změnit', () => {
  assert.equal(usagePolicyFor({ status: 'owner', plan_code: 'elitea-owner' }, {}).unlimited, true);
  assert.deepEqual(
    usagePolicyFor({ status: 'active', plan_code: 'elitea-standard' }, {
      ELITEA_STANDARD_MONTHLY_MESSAGES: '700', ELITEA_STANDARD_DAILY_MESSAGES: '80',
    }),
    { plan: 'standard', unlimited: false, monthlyMessages: 700, dailyMessages: 80 },
  );
});

test('vrácení tahu je svázané s datem a měsícem původní rezervace', async () => {
  const queries = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    queries.push({ query, values });
    if (query.includes('INSERT INTO ai_usage_counters')) {
      return [{
        daily_messages: 7,
        monthly_messages: 41,
        usage_date: '2026-08-31',
        usage_month: '2026-08-01',
      }];
    }
    if (query.includes('UPDATE ai_usage_counters')) return [{ user_id: 'test-user' }];
    return [];
  };
  const member = { id: '11111111-1111-4111-8111-111111111111' };
  const membership = { status: 'active', plan_code: 'elitea-standard' };
  const env = { DATABASE_URL: 'postgresql://test.invalid/db' };

  const reserved = await reserveAiTurn(member, membership, {}, env, { sql });
  assert.deepEqual(reserved.reservation, { usageDate: '2026-08-31', usageMonth: '2026-08-01' });
  assert.equal(await refundAiTurn(member, membership, reserved.reservation, env, { sql }), true);

  const refund = queries.find(entry => entry.query.includes('UPDATE ai_usage_counters'));
  assert.ok(refund);
  assert.deepEqual(refund.values, [
    '2026-08-31',
    '2026-08-01',
    member.id,
    '2026-08-31',
    '2026-08-01',
  ]);
  assert.match(refund.query, /usage_date=\?::date/);
  assert.match(refund.query, /usage_month=\?::date/);
  assert.doesNotMatch(refund.query, /usage_date=current_date|usage_month=date_trunc/);
});

test('bez platného rezervačního klíče se žádný čítač neodečítá', async () => {
  let sqlCalled = false;
  const result = await refundAiTurn(
    { id: '11111111-1111-4111-8111-111111111111' },
    { status: 'active', plan_code: 'elitea-standard' },
    null,
    { DATABASE_URL: 'postgresql://test.invalid/db' },
    { sql: async () => { sqlCalled = true; return []; } },
  );
  assert.equal(result, false);
  assert.equal(sqlCalled, false);
});

test('fair-use účtuje jen skutečné modelové tahy', () => {
  for (const provider of [
    'course-role-router',
    'demo-no-api-key',
    'local-training-fallback',
    'deterministic-training-fallback',
    'safety-protocol',
  ]) {
    assert.equal(isBillableAiResult({ provider, usage: { totalTokens: 99 } }, { training: true }), false, provider);
  }
  assert.equal(isBillableAiResult({ provider: 'openai/gpt-real', usage: null }, { training: true }), false);
  assert.equal(isBillableAiResult({ provider: 'openai/gpt-real', usage: { totalTokens: 0 } }, { training: true }), false);
  assert.equal(isBillableAiResult({ provider: 'openai/gpt-real', usage: { inputTokens: 12, outputTokens: 3 } }, { training: true }), true);
  assert.equal(isBillableAiResult({ provider: 'demo-no-api-key' }), false);
  assert.equal(isBillableAiResult({ provider: 'openai/gpt-real' }), true);
});
