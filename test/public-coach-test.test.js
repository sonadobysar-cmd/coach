import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_COACH_TEST_DURATION_MS,
  PUBLIC_COACH_TEST_MAX_TURNS,
  advancePublicCoachTestSession,
  issuePublicCoachTestSession,
  listPublicCoachTestFeedback,
  sanitizePublicCoachTestFeedback,
  sanitizePublicTestMessages,
  savePublicCoachTestFeedback,
  verifyPublicCoachTestSession,
} from '../src/public-coach-test-service.js';

const env = { CRON_SECRET: 'test-secret-that-is-long-enough-for-hmac' };

test('veřejný coach test vydá podepsanou omezenou relaci bez účtu', () => {
  const session = issuePublicCoachTestSession({ mode: 'mentor' }, env, 1_000);
  assert.equal(session.mode, 'mentor');
  assert.equal(session.turnsUsed, 0);
  assert.equal(session.remainingTurns, PUBLIC_COACH_TEST_MAX_TURNS);
  const payload = verifyPublicCoachTestSession(session.token, env, 1_001);
  assert.equal(payload.sid, session.sessionId);
  assert.equal(payload.mode, 'mentor');
});

test('veřejný test odmítne změněný nebo prošlý token', () => {
  const session = issuePublicCoachTestSession({ mode: 'coach' }, env, 1_000);
  assert.throws(() => verifyPublicCoachTestSession(`${session.token}x`, env, 1_001), /není platná/);
  assert.throws(() => verifyPublicCoachTestSession(session.token, env, Date.parse(session.expiresAt) + 1), /vypršela/);
});

test('každá úspěšná odpověď obnoví čtyřhodinovou platnost testu', () => {
  const now = 1_000;
  const session = issuePublicCoachTestSession({ mode: 'mentor' }, env, now);
  assert.equal(Date.parse(session.expiresAt), now + PUBLIC_COACH_TEST_DURATION_MS);
  const advancedAt = now + 30 * 60 * 1000;
  const advanced = advancePublicCoachTestSession(
    session.token,
    [{ role: 'user', content: 'Mám problém s prodejem.' }],
    env,
    advancedAt,
  );
  assert.equal(Date.parse(advanced.nextSession.expiresAt), advancedAt + PUBLIC_COACH_TEST_DURATION_MS);
});

test('každý navazující tah zvyšuje čítač a šestý test ukončí', () => {
  let session = issuePublicCoachTestSession({ mode: 'coach' }, env, 1_000);
  const messages = [];
  for (let index = 0; index < PUBLIC_COACH_TEST_MAX_TURNS; index += 1) {
    messages.push({ role: 'user', content: `Moje zpráva ${index + 1}` });
    const advanced = advancePublicCoachTestSession(session.token, messages, env, 1_100 + index);
    session = advanced.nextSession;
    if (index < PUBLIC_COACH_TEST_MAX_TURNS - 1) messages.push({ role: 'assistant', content: `Odpověď ${index + 1}` });
  }
  assert.equal(session.remainingTurns, 0);
  messages.push({ role: 'assistant', content: 'Odpověď 6' }, { role: 'user', content: 'Sedmá zpráva' });
  assert.throws(() => advancePublicCoachTestSession(session.token, messages, env, 2_000), /limitu šesti/);
});

test('testovací zprávy mažou přímé identifikátory před odesláním modelu', () => {
  const messages = sanitizePublicTestMessages([{ role: 'user', content: 'Napiš mi na eva@example.cz nebo +420 777 123 456.' }]);
  assert.equal(messages[0].content, 'Napiš mi na [e-mail odstraněn] nebo [telefon odstraněn].');
});

test('feedback vyžaduje dvě odpovědi a přepis ukládá jen se souhlasem', () => {
  const now = Date.now();
  let session = issuePublicCoachTestSession({ mode: 'coach' }, env, now);
  const first = [{ role: 'user', content: 'První téma' }];
  session = advancePublicCoachTestSession(session.token, first, env, now + 100).nextSession;
  const premature = sanitizePublicCoachTestFeedback({
    sessionToken: session.token,
    evaluatorName: 'Eva', usefulness: 4, roleFidelity: 4, wouldUse: 'yes', notes: 'Bylo to konkrétní.',
  }, env);
  assert.equal(premature.ok, false);

  const transcript = [...first, { role: 'assistant', content: 'První odpověď' }, { role: 'user', content: 'Druhá odpověď' }];
  session = advancePublicCoachTestSession(session.token, transcript, env, now + 200).nextSession;
  const parsed = sanitizePublicCoachTestFeedback({
    sessionToken: session.token,
    evaluatorName: 'Eva', usefulness: 5, roleFidelity: 4, wouldUse: 'yes', notes: 'Přesná otázka a užitečný další krok.',
    transcriptConsent: false,
    messages: transcript,
  }, env);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.transcript, null);
  assert.equal(parsed.value.turnCount, 2);
});

test('uložení feedbacku nepadá, když e-mailové upozornění není nakonfigurované', async () => {
  const calls = [];
  const sql = async (strings, ...values) => { calls.push({ strings, values }); return []; };
  const result = await savePublicCoachTestFeedback({
    id: 'feedback-id', sessionId: 'session-id', mode: 'coach', turnCount: 2,
    evaluatorName: 'Eva', contact: '', usefulness: 5, roleFidelity: 5,
    wouldUse: 'yes', notes: 'Velmi konkrétní a přirozená práce.', transcriptConsent: false, transcript: null,
  }, { DATABASE_URL: 'postgres://example' }, { sqlFactory: () => sql });
  assert.equal(result.stored, true);
  assert.equal(result.emailed, false);
  assert.equal(calls.length, 1);
});

test('interní přehled seřadí a shrne uložené testy', async () => {
  const rows = [{
    id: 'feedback-id', role_mode: 'mentor', turn_count: 3, evaluator_name: 'Eva', contact: 'eva@example.cz',
    usefulness: 3, role_fidelity: 4, would_use: 'maybe', notes: 'Chyběla mi konkrétnější rada.',
    transcript_consent: true, transcript: [
      { role: 'user', content: 'Nevím, jak prodávat.' },
      { role: 'assistant', content: 'Pojďme to rozebrat.' },
    ], created_at: '2026-08-28T20:00:00.000Z', updated_at: '2026-08-28T20:00:00.000Z',
  }];
  const result = await listPublicCoachTestFeedback(
    { DATABASE_URL: 'postgres://example' },
    { sqlFactory: () => async () => rows },
  );
  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.mentor, 1);
  assert.equal(result.summary.needsAttention, 1);
  assert.equal(result.feedback[0].transcriptComplete, false);
});
