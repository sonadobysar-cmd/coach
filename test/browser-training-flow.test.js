import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canonicalTrainingDifficulty,
  inferTrainingCounterpartHint,
  isTrainingAttemptErrorCode,
  isTrainingDebriefCommand,
  isTrainingSimulationRequest,
  resolveTrainingEvidenceUpdate,
  trainingRetryScenarioId,
} from '../src/browser-training-flow.js';

const browserApp = await readFile(new URL('../src/browser-app.js', import.meta.url), 'utf8');

test('studijní požadavek na simulaci se zachytí před odesláním nepodepsaného tahu', () => {
  assert.equal(isTrainingSimulationRequest('Chci si vyzkoušet rozhovor s klientkou.'), true);
  assert.equal(isTrainingSimulationRequest('Pojďme na modelovou situaci, ty budeš studentka.'), true);
  assert.equal(isTrainingSimulationRequest('Vysvětli mi, proč se při simulaci používá reflexe.'), false);
  assert.equal(isTrainingSimulationRequest('Vysvětli mi rozdíl mezi otázkou a reflexí.'), false);
  assert.equal(isTrainingSimulationRequest('Chcem si to precvičiť so študentkou.'), true);
  assert.equal(inferTrainingCounterpartHint('Chci si to nacvičit s klientkou.'), 'client');
  assert.equal(inferTrainingCounterpartHint('Já budu lektorka a ty budeš studentka.'), 'student');
  assert.equal(inferTrainingCounterpartHint('Chcem si to vyskúšať so študentkou.'), 'student');
  assert.equal(inferTrainingCounterpartHint('Nácvik před publikem.'), 'audience');
});

test('ukončení simulace přijímá jen samostatný administrativní příkaz', () => {
  assert.equal(isTrainingDebriefCommand('Vyhodnoť to, prosím.'), true);
  assert.equal(isTrainingDebriefCommand('Ukonči simulaci.'), true);
  assert.equal(isTrainingDebriefCommand('stop'), true);
  assert.equal(isTrainingDebriefCommand('Koniec simulácie, prosím.'), true);
  assert.equal(isTrainingDebriefCommand('Pokud chceš, můžeme to ukončit a příště navázat.'), false);
  assert.equal(isTrainingDebriefCommand('Co by pro vás znamenalo ukončit spolupráci?'), false);
});

test('UI vždy používá obtížnost vrácenou kanonickým scénářem', () => {
  assert.equal(canonicalTrainingDifficulty({ difficulty: 'expert' }, 'guided'), 'expert');
  assert.equal(canonicalTrainingDifficulty({ difficulty: 'forged' }, 'advanced'), 'advanced');
  assert.equal(canonicalTrainingDifficulty(null, 'forged'), 'standard');
});

test('změna obtížnosti založí nový scénář, běžné opakování drží stejný případ', () => {
  assert.equal(trainingRetryScenarioId({ scenarioId: 'case-1' }), 'case-1');
  assert.equal(trainingRetryScenarioId({ scenarioId: 'case-1', preserveScenario: false }), '');
  assert.equal(trainingRetryScenarioId({ scenarioId: 'final-1', preserveScenario: false, finalExam: true }), 'final-1');
});

test('jen první podepsaný debrief smí uložit ověřený výkon', () => {
  const success = resolveTrainingEvidenceUpdate({
    result: {
      phase: 'debrief',
      qualityGate: { pass: true },
      trainingAttempt: { step: 'debrief_start', evidenceEligible: true },
      evidencePersistence: { required: true, verified: true },
    },
  });
  assert.equal(success.initialDebrief, true);
  assert.equal(success.shouldSave, true);
  assert.match(success.completedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(success.persistenceFailed, false);

  const completedAt = success.completedAt;
  const followup = resolveTrainingEvidenceUpdate({
    completedAt,
    persistenceFailed: false,
    result: {
      phase: 'debrief',
      qualityGate: { pass: false },
      trainingAttempt: { step: 'debrief_followup', evidenceEligible: false },
    },
  });
  assert.deepEqual(followup, {
    initialDebrief: false,
    completedAt,
    persistenceFailed: false,
    shouldSave: false,
  });

  const unsigned = resolveTrainingEvidenceUpdate({
    result: { phase: 'debrief', qualityGate: { pass: true } },
  });
  assert.equal(unsigned.initialDebrief, false);
  assert.equal(unsigned.shouldSave, false);
});

test('chyba serverového zápisu zůstane viditelná i po doplňující otázce', () => {
  const failed = resolveTrainingEvidenceUpdate({
    result: {
      phase: 'debrief',
      qualityGate: { pass: true },
      trainingAttempt: { step: 'debrief_start', evidenceEligible: true },
      evidencePersistence: { required: true, verified: false },
    },
  });
  assert.equal(failed.shouldSave, false);
  assert.equal(failed.persistenceFailed, true);

  const followup = resolveTrainingEvidenceUpdate({
    completedAt: failed.completedAt,
    persistenceFailed: failed.persistenceFailed,
    result: {
      phase: 'debrief',
      qualityGate: { pass: true },
      trainingAttempt: { step: 'debrief_followup', evidenceEligible: false },
    },
  });
  assert.equal(followup.persistenceFailed, true);
  assert.equal(followup.shouldSave, false);
});

test('chyba podepsaného pokusu se nerozpozná jako vypršelé přihlášení', () => {
  assert.equal(isTrainingAttemptErrorCode('TRAINING_ATTEMPT_EXPIRED'), true);
  assert.equal(isTrainingAttemptErrorCode('TRAINING_FINAL_EXAM_MISMATCH'), true);
  assert.equal(isTrainingAttemptErrorCode('TRAINING_SCENARIO_NOT_FOUND'), true);
  assert.equal(isTrainingAttemptErrorCode('AUTH_INVALID'), false);
});

test('browser drží podepsaný řetězec při startu, chybě, opakování i follow-upu', () => {
  const submit = browserApp.slice(
    browserApp.indexOf('async function submitTrainingMessage('),
    browserApp.indexOf('\nfunction handleMessageAction('),
  );
  const retry = browserApp.slice(
    browserApp.indexOf('async function retryTrainingSimulation('),
    browserApp.indexOf('\nfunction restartStudySession('),
  );
  const onSubmit = browserApp.slice(
    browserApp.indexOf('async function onSubmit('),
    browserApp.indexOf('\nasync function requestCoachReply('),
  );

  assert.match(onSubmit, /isTrainingSimulationRequest\(content\)[\s\S]*startTrainingSimulationFromStudyRequest\(content\)/u);
  assert.match(onSubmit, /isTrainingDebriefCommand\(content\)[\s\S]*finishTrainingSimulation\(\)/u);
  assert.match(submit, /const messagesBeforeRequest = \[\.\.\.state\.messages\]/u);
  assert.match(submit, /state\.trainingSession === session[\s\S]*state\.messages = messagesBeforeRequest/u);
  assert.match(submit, /resolveTrainingEvidenceUpdate/u);
  assert.match(submit, /if \(evidenceUpdate\.initialDebrief\)/u);
  assert.doesNotMatch(retry, /state\.messages\.push/u);
  assert.match(browserApp, /data-retry-training/u);
});
