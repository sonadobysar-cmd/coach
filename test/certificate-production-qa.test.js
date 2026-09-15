import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  authorizeCertificateQaRequest,
  buildCertificateQaExamTranscript,
  runSignedCertificateQaExam,
  signedQaFinalScenarioIds,
} from '../src/certificate-production-qa.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { loadCourses } from '../src/courses.js';
import { finalExamScenarioIds } from '../src/final-exam.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const SECRET = 'qa-secret-that-is-longer-than-thirty-two-bytes';
const ENV = {
  ELITEA_CERTIFICATE_QA_SECRET: SECRET,
  ELITEA_CERTIFICATE_QA_USER_IDS: `11111111-1111-4111-8111-111111111111, ${USER_ID}`,
  CERTIFICATE_SIGNING_SECRET: 'certificate-signing-secret-longer-than-thirty-two-bytes',
};
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [communicationCourse, professionalCoachCourse] = await loadCourses([
  join(ROOT, 'data', 'course-komunikace-v-praxi.md'),
  join(ROOT, 'data', 'course-profesionalni-life-coach.md'),
]);
attachCourseMastery(communicationCourse);
attachCourseMastery(professionalCoachCourse);

test('produkční QA certifikátu vyžaduje současně přesný tajný klíč a povolený účet', () => {
  assert.equal(authorizeCertificateQaRequest(`Bearer ${SECRET}`, USER_ID, ENV), true);
  assert.equal(authorizeCertificateQaRequest('Bearer wrong', USER_ID, ENV), false);
  assert.equal(authorizeCertificateQaRequest(`Bearer ${SECRET}`, '33333333-3333-4333-8333-333333333333', ENV), false);
  assert.equal(authorizeCertificateQaRequest(`Bearer ${SECRET}`, 'not-a-uuid', ENV), false);
});

test('krátký nebo chybějící QA klíč nelze použít', () => {
  assert.equal(authorizeCertificateQaRequest('Bearer short', USER_ID, {
    ELITEA_CERTIFICATE_QA_SECRET: 'short',
    ELITEA_CERTIFICATE_QA_USER_IDS: USER_ID,
  }), false);
  assert.equal(authorizeCertificateQaRequest('', USER_ID, ENV), false);
});

test('živý QA přepis odpovídá profesní komunikační zkoušce a dokládá všech šest bran', () => {
  const transcript = buildCertificateQaExamTranscript();
  const studentText = transcript.filter(message => message.role === 'user').map(message => message.content).join('\n');
  assert.match(studentText, /cíl.*rolí.*tempem/iu);
  assert.match(studentText, /Navazuji na tvoje/iu);
  assert.match(studentText, /pozorování–dopad–potřeba–žádost/iu);
  assert.match(studentText, /Takový slib dát nemohu/iu);
  assert.match(studentText, /Ty sis zvolila první variantu/iu);
  assert.match(studentText, /Sebereflexe:.*Mezera:.*Cíl dalšího pokusu:/isu);
});

test('dva QA přepisy se záměrně liší, aby je profesní pas nemohl sloučit', () => {
  const first = buildCertificateQaExamTranscript({ variant: 0 });
  const second = buildCertificateQaExamTranscript({ variant: 1 });
  assert.notDeepEqual(first, second);
  assert.equal(first.filter(message => message.role === 'user').length, 8);
  assert.equal(second.filter(message => message.role === 'user').length, 8);
});

test('starý nepodepsaný záznam nestačí a profesní důkaz musí mít stejné ID v certifikátu i pasu', () => {
  const [firstScenarioId, secondScenarioId] = finalExamScenarioIds(professionalCoachCourse);
  const firstAttemptId = '33333333-3333-4333-8333-333333333333';
  const secondAttemptId = '44444444-4444-4444-8444-444444444444';
  const certificateAttemptRows = [
    { scenario_id: firstScenarioId, training_attempt_id: null, all_proven: true, quality_passed: true, provider: 'openai/gpt-5.6-test' },
    { scenario_id: firstScenarioId, training_attempt_id: firstAttemptId, all_proven: true, quality_passed: true, provider: 'openai/gpt-5.6-test' },
    { scenario_id: secondScenarioId, training_attempt_id: secondAttemptId, all_proven: true, quality_passed: true, provider: 'openai/gpt-5.6-test' },
  ];
  const validCoachRow = {
    scenario_id: firstScenarioId,
    training_attempt_id: firstAttemptId,
    difficulty: 'expert',
    quality_passed: true,
    provider: 'openai/gpt-5.6-test',
    achievement: { allProven: true },
    critical_failures: [],
  };
  const mismatchedCoachRow = {
    ...validCoachRow,
    scenario_id: secondScenarioId,
    training_attempt_id: '55555555-5555-4555-8555-555555555555',
  };
  const firstOnly = signedQaFinalScenarioIds({
    requiredScenarioIds: [firstScenarioId, secondScenarioId],
    certificateAttemptRows,
    coachAttemptRows: [validCoachRow, mismatchedCoachRow],
    professionalCoachCourse: true,
  });
  assert.deepEqual([...firstOnly], [firstScenarioId]);

  const both = signedQaFinalScenarioIds({
    requiredScenarioIds: [firstScenarioId, secondScenarioId],
    certificateAttemptRows,
    coachAttemptRows: [validCoachRow, { ...validCoachRow, scenario_id: secondScenarioId, training_attempt_id: secondAttemptId }],
    professionalCoachCourse: true,
  });
  assert.deepEqual([...both], [firstScenarioId, secondScenarioId]);
});

test('profesní produkční QA projde dva různé finální scénáře přes podepsané pokusy', async () => {
  let roleplayCall = 0;
  const answerTraining = async ({ phase }) => {
    if (phase === 'roleplay') {
      roleplayCall += 1;
      return {
        text: `Modelová klientka odpovídá v autentickém tahu ${roleplayCall} a doplňuje konkrétní informaci.`,
        provider: 'openai/gpt-5.6-test',
      };
    }
    return {
      text: 'Výsledek nácviku\nVýborný výkon.\nRozbor kompetencí\nVšechny kompetence jsou prokázané konkrétními důkazy.',
      provider: 'openai/gpt-5.6-test',
      qualityGate: { pass: true },
      achievement: { allProven: true },
    };
  };
  const scenarioIds = finalExamScenarioIds(professionalCoachCourse);
  assert.equal(scenarioIds.length, 2);

  const exams = [];
  for (const [scenarioIndex, scenarioId] of scenarioIds.entries()) {
    exams.push(await runSignedCertificateQaExam({
      member: { id: USER_ID },
      course: professionalCoachCourse,
      answerTraining,
      scenarioId,
      scenarioIndex,
    }, ENV));
  }

  assert.notEqual(exams[0].trainingAttemptId, exams[1].trainingAttemptId);
  assert.notDeepEqual(exams[0].messages, exams[1].messages);
  for (const [index, exam] of exams.entries()) {
    const scenario = professionalCoachCourse.mastery.scenarios.find(candidate => candidate.id === scenarioIds[index]);
    assert.equal(exam.item.id, scenario.itemId);
    assert.equal(exam.scenario.id, scenarioIds[index]);
    assert.equal(exam.studentTurnCount, 9);
    assert.equal(exam.roleplayProviders.length, 9);
    assert.equal(exam.messages.length, 19);
    assert.equal(exam.closed, true);
    assert.match(exam.trainingAttemptId, /^[0-9a-f-]{36}$/iu);
    assert.equal(Object.hasOwn(exam, 'token'), false);
  }
});

test('běžný certifikační kurz používá minimální autentický tříkolový finální přepis', async () => {
  const scenarioId = finalExamScenarioIds(communicationCourse)[0];
  const exam = await runSignedCertificateQaExam({
    member: { id: USER_ID },
    course: communicationCourse,
    scenarioId,
    answerTraining: async ({ phase }) => phase === 'roleplay'
      ? { text: 'Modelová protistrana reaguje na poslední intervenci.', provider: 'openai/gpt-5.6-test' }
      : {
          text: 'Výsledek nácviku: všechna kritéria jsou prokázaná.',
          provider: 'openai/gpt-5.6-test',
          qualityGate: { pass: true },
          achievement: { allProven: true },
        },
  }, ENV);
  assert.equal(exam.studentTurnCount, 3);
  assert.equal(exam.messages.length, 7);
  assert.equal(exam.closed, true);
});
