import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceTrainingAttempt,
  hashTrainingMessages,
  issueTrainingAttempt,
  PROFESSIONAL_FINAL_EXAM_MINIMUM_TURNS,
  PROFESSIONAL_PRACTICE_MINIMUM_TURNS,
  trainingAttemptSigningConfigured,
  verifyTrainingAttemptStep,
} from '../src/training-attempt-auth.js';

const ENV = { ELITEA_TRAINING_SECRET: 't'.repeat(48) };
const MEMBER = { id: '11111111-1111-4111-8111-111111111111' };
const COURSE = {
  id: 'profesionalni-life-coach',
  slug: 'profesionalni-life-coach-od-kontraktu-k-vysledku',
  mastery: { finalExam: { scenarioId: 'final-case' } },
};
const ITEM = { id: 'life-m17-client-practice' };
const SCENARIO = { id: 'practice-case', difficulty: 'advanced', openingLine: 'Co chceš dnes řešit?' };

function start({ scenario = SCENARIO, finalExam = false } = {}) {
  return issueTrainingAttempt({
    member: MEMBER,
    course: COURSE,
    item: ITEM,
    scenario,
    finalExam,
    messages: [{ role: 'assistant', content: scenario.openingLine }],
  }, ENV, 1_000);
}

function binding(messages, overrides = {}) {
  return {
    member: MEMBER,
    course: COURSE,
    item: ITEM,
    messages,
    requestedPhase: 'roleplay',
    requestedScenarioId: SCENARIO.id,
    requestedDifficulty: SCENARIO.difficulty,
    requestedFinalExam: false,
    ...overrides,
  };
}

test('podepsaná relace váže účet, kurz, lekci, scénář a historii každého tahu', () => {
  const issued = start();
  assert.equal(trainingAttemptSigningConfigured(ENV), true);
  const firstMessages = [
    { role: 'assistant', content: SCENARIO.openingLine, meta: 'nezapočítává se' },
    { role: 'user', content: 'Co by pro tebe dnes bylo užitečné?' },
  ];
  const first = verifyTrainingAttemptStep(issued.token, binding(firstMessages), ENV, 2_000);
  assert.equal(first.kind, 'roleplay_turn');
  const advanced = advanceTrainingAttempt(first, 'Chci získat jasno.', ENV, 2_000);
  assert.equal(advanced.turns, 1);
  assert.equal(advanced.closed, false);

  const changedHistory = [
    { role: 'assistant', content: 'Podvržený začátek.' },
    { role: 'user', content: 'Další otázka?' },
  ];
  assert.throws(
    () => verifyTrainingAttemptStep(advanced.token, binding(changedHistory), ENV, 3_000),
    error => error.code === 'TRAINING_ATTEMPT_HISTORY_CHANGED',
  );
  assert.equal(hashTrainingMessages(firstMessages).length, 64);
});

test('klient nemůže po vydání relace změnit scénář, obtížnost, typ zkoušky ani účet', () => {
  const issued = start();
  const messages = [{ role: 'assistant', content: SCENARIO.openingLine }, { role: 'user', content: 'Začneme?' }];
  for (const changed of [
    { requestedScenarioId: 'jiny-scenar' },
    { requestedDifficulty: 'guided' },
    { requestedFinalExam: true },
    { member: { id: '22222222-2222-4222-8222-222222222222' } },
  ]) {
    assert.throws(() => verifyTrainingAttemptStep(issued.token, binding(messages, changed), ENV, 2_000));
  }
});

test('příliš krátký profesní nácvik se nevyhodnotí ani nezapíše', () => {
  let current = start();
  let messages = [{ role: 'assistant', content: SCENARIO.openingLine }];
  for (let index = 0; index < PROFESSIONAL_PRACTICE_MINIMUM_TURNS - 1; index += 1) {
    messages.push({ role: 'user', content: `Otázka ${index + 1}?` });
    const step = verifyTrainingAttemptStep(current.token, binding(messages), ENV, 2_000 + index);
    const answer = `Odpověď ${index + 1}.`;
    current = advanceTrainingAttempt(step, answer, ENV, 2_000 + index);
    messages.push({ role: 'assistant', content: answer });
  }
  assert.throws(
    () => verifyTrainingAttemptStep(current.token, binding(messages, { requestedPhase: 'debrief' }), ENV, 5_000),
    error => error.code === 'TRAINING_ATTEMPT_TOO_SHORT',
  );
});

test('expertní finále vyžaduje osm autentických intervencí a po uzavření nepovolí návrat do roleplay', () => {
  const finalScenario = { id: 'final-case', difficulty: 'expert', openingLine: 'Potřebuji, abys mi řekla, co mám dělat.' };
  let current = start({ scenario: finalScenario, finalExam: true });
  let messages = [{ role: 'assistant', content: finalScenario.openingLine }];
  for (let index = 0; index < PROFESSIONAL_FINAL_EXAM_MINIMUM_TURNS; index += 1) {
    messages.push({ role: 'user', content: `Intervence ${index + 1}?` });
    const step = verifyTrainingAttemptStep(current.token, binding(messages, {
      requestedScenarioId: finalScenario.id,
      requestedDifficulty: 'expert',
      requestedFinalExam: true,
    }), ENV, 2_000 + index);
    const answer = `Reakce klientky ${index + 1}.`;
    current = advanceTrainingAttempt(step, answer, ENV, 2_000 + index);
    messages.push({ role: 'assistant', content: answer });
  }
  const debrief = verifyTrainingAttemptStep(current.token, binding(messages, {
    requestedPhase: 'debrief',
    requestedScenarioId: finalScenario.id,
    requestedDifficulty: 'expert',
    requestedFinalExam: true,
  }), ENV, 5_000);
  assert.equal(debrief.kind, 'debrief_start');
  const closed = advanceTrainingAttempt(debrief, '## Výsledek nácviku\nProkázáno.', ENV, 5_000);
  assert.equal(closed.closed, true);
  const closedMessages = [
    ...messages,
    { role: 'assistant', content: '## Výsledek nácviku\nProkázáno.' },
  ];
  assert.throws(() => verifyTrainingAttemptStep(closed.token, binding([
    ...closedMessages,
    { role: 'user', content: 'Vrátím se do simulace.' },
  ], {
    requestedScenarioId: finalScenario.id,
    requestedDifficulty: 'expert',
    requestedFinalExam: true,
  }), ENV, 6_000), error => error.code === 'TRAINING_ATTEMPT_ALREADY_CLOSED');
  const followup = verifyTrainingAttemptStep(closed.token, binding([
    ...closedMessages,
    { role: 'user', content: 'Můžeš mi vysvětlit jednu část rozboru?' },
  ], {
    requestedPhase: 'debrief',
    requestedScenarioId: finalScenario.id,
    requestedDifficulty: 'expert',
    requestedFinalExam: true,
  }), ENV, 6_000);
  assert.equal(followup.kind, 'debrief_followup');
  const followed = advanceTrainingAttempt(followup, 'Ano, podíváme se na ni.', ENV, 6_000);
  assert.equal(followed.turns, PROFESSIONAL_FINAL_EXAM_MINIMUM_TURNS);
  assert.equal(followed.closed, true);
});

test('změnu podepsaného payloadu nelze použít ani se zachovanou starou signaturou', () => {
  const issued = start();
  const payload = JSON.parse(Buffer.from(issued.token.split('.')[0], 'base64url').toString('utf8'));
  const closedPayload = { ...payload, closed: true, t: 3, r: 4, h: hashTrainingMessages([
    { role: 'assistant', content: SCENARIO.openingLine },
    { role: 'user', content: 'Otázka?' },
    { role: 'assistant', content: 'Odpověď.' },
    { role: 'user', content: 'Otázka dva?' },
    { role: 'assistant', content: 'Odpověď dva.' },
    { role: 'user', content: 'Otázka tři?' },
    { role: 'assistant', content: 'Odpověď tři.' },
    { role: 'assistant', content: 'Rozbor.' },
  ]) };
  // Tento test používá veřejné API a proto uzavře relaci skutečným přechodem v jiných testech;
  // zde pouze ověřujeme, že nepodepsanou manipulaci payloadu nelze použít.
  const forged = `${Buffer.from(JSON.stringify(closedPayload)).toString('base64url')}.${issued.token.split('.')[1]}`;
  assert.throws(() => verifyTrainingAttemptStep(forged, binding([], { requestedPhase: 'debrief' }), ENV, 6_000), error => error.code === 'TRAINING_ATTEMPT_INVALID');
});
