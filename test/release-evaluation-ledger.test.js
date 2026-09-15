import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  releaseEvaluationRequestFingerprint,
  reserveReleaseEvaluationStep,
} from '../src/release-evaluation-ledger.js';

const valid = {
  runId: '2026-09-15T20-00-00-000Z',
  caseId: 'cs-whole-session-contract-to-result',
  phase: 'roleplay',
  stepId: 'contract',
  attemptId: 'attempt-00000000',
  previousReceiptSignature: 'a'.repeat(64),
  requestFingerprint: 'b'.repeat(64),
};

test('release ledger atomicky rezervuje právě jeden kanonický krok', async () => {
  const calls = [];
  const result = await reserveReleaseEvaluationStep(valid, { DATABASE_URL: 'postgres://test' }, {
    sqlFactory: () => async (strings, ...values) => {
      calls.push({ strings, values });
      return [{ run_id: valid.runId }];
    },
  });
  assert.equal(result.reserved, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].strings.join('').includes('ON CONFLICT DO NOTHING'));
});

test('release ledger odmítne druhou větev stejného run/case/step', async () => {
  await assert.rejects(
    reserveReleaseEvaluationStep(valid, { DATABASE_URL: 'postgres://test' }, {
      sqlFactory: () => async () => [],
    }),
    error => error?.code === 'RELEASE_EVALUATION_STEP_REPLAY' && error?.statusCode === 409,
  );
});

test('release ledger selže zavřeně bez databáze a bez předchozího receipt', async () => {
  await assert.rejects(
    reserveReleaseEvaluationStep(valid, {}, {}),
    error => error?.code === 'RELEASE_EVALUATION_LEDGER_NOT_CONFIGURED' && error?.statusCode === 503,
  );
  await assert.rejects(
    reserveReleaseEvaluationStep({ ...valid, previousReceiptSignature: null }, { DATABASE_URL: 'postgres://test' }, {
      sqlFactory: () => async () => [{ run_id: valid.runId }],
    }),
    error => error?.code === 'RELEASE_EVALUATION_STEP_INVALID',
  );
});

test('request fingerprint váže celý transcript včetně odpovědí modelové klientky', () => {
  const base = {
    scenario: { id: 'scenario-1', scenarioFamilyId: 'family', challengeId: 'challenge', difficulty: 'expert' },
    messages: [
      { role: 'assistant', content: 'Bojím se změny práce.' },
      { role: 'user', content: 'Co by dnes bylo užitečné?' },
      { role: 'assistant', content: 'Potřebuji získat jasno.' },
    ],
  };
  const first = releaseEvaluationRequestFingerprint(base);
  const second = releaseEvaluationRequestFingerprint({
    ...base,
    messages: base.messages.map((message, index) => index === 2 ? { ...message, content: 'Jiná větev odpovědi.' } : message),
  });
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.notEqual(first, second);
});
