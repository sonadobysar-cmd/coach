import test from 'node:test';
import assert from 'node:assert/strict';
import { usagePolicyFor } from '../src/usage-limits.js';

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
