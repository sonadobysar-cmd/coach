import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoachCompetencyPassport,
  buildCoachDebriefRecord,
  isTrustedCoachAssessmentProvider,
  recordCoachDebriefAttempt,
} from '../src/coach-competency-passport.js';
import { COACH_COMPETENCIES } from '../src/coach-competencies.js';
import { buildCertificateStatus } from '../src/certificate-service.js';

const COURSE = {
  id: 'profesionalni-life-coach',
  slug: 'profesionalni-life-coach-od-kontraktu-k-vysledku',
  title: 'Profesionální life coach',
  certificate: { title: 'Elitea Certified Professional Life Coach' },
  modules: [{ items: [{ id: 'm0-1' }] }],
};

const LABELS = Object.freeze({
  contract: 'Přesný kontrakt a zakázka',
  active_listening: 'Aktivní naslouchání a reflexe klientčiných slov',
  questions: 'Jedna otevřená otázka',
  intervention_choice: 'Volba metody bez mechanického rámce',
  refusal_autonomy: 'Respekt k odmítnutí a autonomie',
  alliance_repair: 'Přijetí opravy bez obhajování',
  ethical_boundaries: 'Etika a profesní hranice',
  outcome: 'Klientkou zvolený další krok',
  reflection: 'Sebereflexe a bias',
});

function attempt({
  index,
  competencyIds = [],
  difficulty = 'advanced',
  provider = 'openai/gpt-5.6',
  qualityPassed = true,
  finalExam = false,
  allProven = false,
  criticalFailures = [],
  scenarioId = `scenario-${index}`,
} = {}) {
  return {
    id: `attempt-${index}`,
    itemId: `item-${index}`,
    scenarioId,
    difficulty,
    finalExam,
    provider,
    qualityPassed,
    achievement: {
      allProven,
      rows: competencyIds.map(id => ({ label: LABELS[id], status: 'proven' })),
    },
    criticalFailures,
    completedAt: new Date(Date.UTC(2026, 8, 1, 8, index)).toISOString(),
  };
}

function completeAttempts() {
  const competencyIds = COACH_COMPETENCIES.map(competency => competency.id);
  const practice = Array.from({ length: 18 }, (_, index) => attempt({
    index,
    competencyIds: [competencyIds[index % competencyIds.length]],
    difficulty: index % 2 ? 'expert' : 'advanced',
  }));
  return [
    ...practice,
    attempt({
      index: 30,
      competencyIds,
      difficulty: 'expert',
      finalExam: true,
      allProven: true,
      scenarioId: 'final-integrated-session',
    }),
  ];
}

test('passport vyžaduje 18 odlišných kvalitních praxí, dvojí důkaz všech kompetencí a finální zkoušku', () => {
  const status = buildCoachCompetencyPassport(completeAttempts());
  assert.equal(status.eligible, true);
  assert.equal(status.progress.practiceScenarios, 18);
  assert.equal(status.progress.provenCompetencies, 9);
  assert.equal(status.progress.advancedCompetencies, 9);
  assert.equal(status.progress.finalExamPassed, true);
  for (const competency of Object.values(status.competencies)) {
    assert.equal(competency.proofs, 2);
    assert.ok(competency.advancedProofs >= 1);
  }
});

test('stejný scénář, fallback a neúspěšná kontrola neuměle nenavyšují praxi', () => {
  const baseline = completeAttempts();
  const duplicates = [
    attempt({ index: 40, competencyIds: ['contract'], scenarioId: 'scenario-0', provider: 'openai/gpt-5.6' }),
    attempt({ index: 41, competencyIds: ['contract'], provider: 'deterministic-training-fallback' }),
    attempt({ index: 42, competencyIds: ['contract'], qualityPassed: false }),
  ];
  const status = buildCoachCompetencyPassport([...baseline, ...duplicates]);
  assert.equal(status.progress.practiceScenarios, 18);
  assert.equal(status.competencies.contract.proofs, 2);
  assert.equal(isTrustedCoachAssessmentProvider('openai/gpt-5.6-terra'), true);
  assert.equal(isTrustedCoachAssessmentProvider('openai/local-fallback'), false);
});

test('samotná standardní obtížnost nestačí bez náročného důkazu každé kompetence', () => {
  const attempts = completeAttempts().map(entry => (
    entry.finalExam ? entry : { ...entry, difficulty: 'standard' }
  ));
  const status = buildCoachCompetencyPassport(attempts);
  assert.equal(status.eligible, false);
  assert.equal(status.progress.practiceScenarios, 18);
  assert.equal(status.progress.provenCompetencies, 9);
  assert.equal(status.progress.advancedCompetencies, 0);
  assert.match(status.reasons.join(' '), /náročné nebo expertní obtížnosti/i);
});

test('kritické pochybení blokuje způsobilost, dokud ho pozdější jiný scénář ve stejné kompetenci nenapraví', () => {
  const failure = attempt({
    index: 40,
    competencyIds: [],
    criticalFailures: [{ code: 'outcome_guarantee', competencyId: 'ethical_boundaries' }],
  });
  const blocked = buildCoachCompetencyPassport([...completeAttempts(), failure]);
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.progress.unresolvedCriticalFailures, 1);
  assert.match(blocked.reasons.join(' '), /nápravu 1 kritických/i);

  const remediation = attempt({
    index: 41,
    competencyIds: ['ethical_boundaries'],
    scenarioId: 'ethical-remediation',
  });
  const remediated = buildCoachCompetencyPassport([...completeAttempts(), failure, remediation]);
  assert.equal(remediated.progress.unresolvedCriticalFailures, 0);
  assert.equal(remediated.eligible, true);
  assert.equal(remediated.criticalFailures[0].remediatedBy.scenarioId, 'ethical-remediation');
});

test('serverový záznam znovu odvodí achievement, kritické chyby a stabilní hash přepisu', () => {
  const messages = [
    { role: 'assistant', content: 'Mám dlouhodobé úzkosti.' },
    { role: 'user', content: 'Diagnostikuji ti depresi a budu tě léčit.' },
  ];
  const input = {
    course: COURSE,
    item: { id: 'm0-1' },
    scenarioId: 'clinical-boundary',
    difficulty: 'expert',
    messages,
    result: {
      provider: 'openai/gpt-5.6',
      qualityGate: { pass: true },
      achievement: { rows: [{ label: LABELS.ethical_boundaries, status: 'proven' }], allProven: true },
    },
  };
  const first = buildCoachDebriefRecord(input);
  const second = buildCoachDebriefRecord(input);
  assert.equal(first.transcriptHash, second.transcriptHash);
  assert.equal(first.transcriptHash.length, 64);
  assert.equal(first.criticalFailures[0].code, 'clinical_scope_breach');
  assert.equal(first.achievement.allProven, false);
  assert.equal('messages' in first, false);
  assert.deepEqual(Object.keys(first.criticalFailures[0]).sort(), ['code', 'competencyId', 'reference', 'studentTurnIndex'].sort());
});

test('uložení debriefu je databázově idempotentní a neprofesní kurz se nezapisuje', async () => {
  const calls = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    calls.push({ query, values });
    return /RETURNING id/u.test(query) ? [{ id: 'attempt-id' }] : [];
  };
  const input = {
    member: { id: '11111111-1111-4111-8111-111111111111' },
    course: COURSE,
    item: { id: 'm0-1' },
    scenarioId: 'client-supplied-id',
    difficulty: 'standard',
    messages: [{ role: 'user', content: 'Co by dnes bylo užitečným výsledkem?' }],
    result: {
      provider: 'openai/gpt-5.6',
      scenario: { id: 'server-resolved-id', difficulty: 'advanced' },
      qualityGate: { pass: true },
      achievement: { rows: [{ label: LABELS.contract, status: 'proven' }] },
    },
  };
  const stored = await recordCoachDebriefAttempt(input, { DATABASE_URL: 'postgres://test' }, { sqlFactory: () => sql });
  assert.equal(stored.recorded, true);
  const insert = calls.find(call => /academy_coach_debrief_attempts/u.test(call.query));
  assert.ok(insert);
  assert.ok(insert.values.includes('server-resolved-id'));
  assert.ok(insert.values.includes('advanced'));
  assert.equal(insert.values.some(value => JSON.stringify(value).includes('Co by dnes bylo')), false);

  const ignored = await recordCoachDebriefAttempt({ ...input, course: { ...COURSE, id: 'jiny-kurz' } });
  assert.deepEqual(ignored, { recorded: false, reason: 'not_professional_coach_course' });
});

test('profesní certifikát je blokovaný bez passportu, jiné kurzy zachovávají původní pravidla', () => {
  const evidence = {
    completedItemIds: ['m0-1'],
    portfolioSummary: { portfolioComplete: true },
  };
  const examAttempt = { allProven: true, qualityPassed: true, provider: 'openai/gpt-5.6' };
  const blocked = buildCertificateStatus(COURSE, { evidence, examAttempt });
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.progress.coachPassport.practiceScenarios, 0);

  const ready = buildCertificateStatus(COURSE, {
    evidence,
    examAttempt,
    coachDebriefAttempts: completeAttempts(),
  });
  assert.equal(ready.eligible, true);
  assert.equal(ready.coachPassport.eligible, true);

  const otherCourse = { ...COURSE, id: 'komunikace-v-praxi' };
  const unchanged = buildCertificateStatus(otherCourse, { evidence, examAttempt });
  assert.equal(unchanged.eligible, true);
  assert.equal('coachPassport' in unchanged, false);
});
