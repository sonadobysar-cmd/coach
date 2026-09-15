import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoachCompetencyPassport,
  buildCoachDebriefRecord,
  buildCoachMasteryGain,
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
  transcriptHash = `transcript-${index}`,
  trainingAttemptId = `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
  competencyStatuses = null,
  completedAt = new Date(Date.UTC(2026, 8, 1, 8, index)).toISOString(),
} = {}) {
  const rows = competencyStatuses
    ? Object.entries(competencyStatuses).map(([id, status]) => ({ label: LABELS[id], status }))
    : competencyIds.map(id => ({ label: LABELS[id], status: 'proven' }));
  return {
    id: `attempt-${index}`,
    itemId: `item-${index}`,
    scenarioId,
    transcriptHash,
    trainingAttemptId,
    difficulty,
    finalExam,
    provider,
    qualityPassed,
    achievement: {
      allProven,
      rows,
    },
    criticalFailures,
    completedAt,
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
    attempt({
      index: 31,
      competencyIds,
      difficulty: 'expert',
      finalExam: true,
      allProven: true,
      scenarioId: 'final-integrated-session-b',
    }),
  ];
}

test('passport vyžaduje 18 odlišných kvalitních praxí, dvojí důkaz všech kompetencí a dvě finální sezení', () => {
  const status = buildCoachCompetencyPassport(completeAttempts());
  assert.equal(status.eligible, true);
  assert.equal(status.progress.practiceScenarios, 18);
  assert.equal(status.progress.provenCompetencies, 9);
  assert.equal(status.progress.advancedCompetencies, 9);
  assert.equal(status.progress.finalExamsPassed, 2);
  assert.equal(status.progress.requiredFinalExams, 2);
  assert.equal(status.progress.finalExamPassed, true);
  for (const competency of Object.values(status.competencies)) {
    assert.equal(competency.proofs, 2);
    assert.ok(competency.advancedProofs >= 1);
  }
});

test('jedno finální sezení nestačí a důvod přesně ukáže postup 1/2', () => {
  const attempts = completeAttempts().filter(entry => entry.id !== 'attempt-31');
  const status = buildCoachCompetencyPassport(attempts);
  assert.equal(status.eligible, false);
  assert.equal(status.progress.finalExamsPassed, 1);
  assert.equal(status.progress.requiredFinalExams, 2);
  assert.equal(status.progress.finalExamPassed, false);
  assert.match(status.reasons.join(' '), /ještě 1 ze 2 odlišných expertních závěrečných/iu);
});

test('stejný finální pokus ani stejný přepis se pod jiným id nezapočítají dvakrát', () => {
  const oneFinal = completeAttempts().filter(entry => entry.id !== 'attempt-31');
  const original = oneFinal.find(entry => entry.finalExam);
  const repeatedRow = { ...original };
  const repeatedTranscript = {
    ...original,
    id: 'attempt-duplicate-transcript',
    completedAt: new Date(Date.UTC(2026, 8, 1, 8, 32)).toISOString(),
  };
  const status = buildCoachCompetencyPassport([...oneFinal, repeatedRow, repeatedTranscript]);
  assert.equal(status.progress.finalExamsPassed, 1);
  assert.equal(status.eligible, false);
});

test('finále se započítá jen na expert úrovni, z trusted modelu, po quality passu a bez kritické chyby', () => {
  const practices = completeAttempts().filter(entry => !entry.finalExam);
  const invalidFinals = [
    attempt({ index: 50, competencyIds: COACH_COMPETENCIES.map(item => item.id), difficulty: 'advanced', finalExam: true, allProven: true }),
    attempt({ index: 51, competencyIds: COACH_COMPETENCIES.map(item => item.id), difficulty: 'expert', provider: 'deterministic-training-fallback', finalExam: true, allProven: true }),
    attempt({ index: 52, competencyIds: COACH_COMPETENCIES.map(item => item.id), difficulty: 'expert', qualityPassed: false, finalExam: true, allProven: true }),
    attempt({ index: 53, competencyIds: COACH_COMPETENCIES.map(item => item.id), difficulty: 'expert', finalExam: true, allProven: true, criticalFailures: [{ code: 'outcome_guarantee', competencyId: 'ethical_boundaries' }] }),
    attempt({ index: 54, competencyIds: ['contract', 'active_listening'], difficulty: 'expert', finalExam: true, allProven: true }),
  ];
  const status = buildCoachCompetencyPassport([...practices, ...invalidFinals]);
  assert.equal(status.progress.finalExamsPassed, 0);
  assert.equal(status.eligible, false);
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

test('mastery gain změří skutečný posun každé kompetence od baseline k proven a advanced', () => {
  const baseline = attempt({
    index: 100,
    scenarioId: 'baseline-contract-and-questions',
    competencyStatuses: { contract: 'not_proven', questions: 'partial' },
    difficulty: 'standard',
  });
  const proven = attempt({
    index: 101,
    scenarioId: 'targeted-contract-retry',
    competencyStatuses: { contract: 'proven', questions: 'proven' },
    difficulty: 'standard',
  });
  const advanced = attempt({
    index: 102,
    scenarioId: 'advanced-integrated-practice',
    competencyStatuses: { contract: 'proven' },
    difficulty: 'advanced',
  });

  const gain = buildCoachMasteryGain([advanced, baseline, proven]);
  assert.equal(gain.metric, 'verified_competency_mastery_gain');
  assert.equal(gain.baselineCompetencies, 2);
  assert.equal(gain.measuredCompetencies, 2);
  assert.equal(gain.improvedCompetencies, 2);
  assert.equal(gain.provenGains, 1);
  assert.equal(gain.advancedGains, 1);
  assert.equal(gain.gainedPoints, 4);
  assert.equal(gain.availableGainPoints, 5);
  assert.equal(gain.normalizedGainPercent, 80);
  assert.equal(gain.measurementCoveragePercent, 22.2);
  assert.equal(gain.verifiedGainRatePercent, 100);
  assert.equal(gain.competencies.contract.stage, 'advanced');
  assert.equal(gain.competencies.contract.transition, 'baseline→advanced');
  assert.equal(gain.competencies.contract.distinctFollowUps, 2);
  assert.equal(gain.competencies.questions.stage, 'proven');
  assert.equal(gain.competencies.questions.transition, 'developing→proven');
});

test('stejný scénář ani stejný přepis nemohou předstírat růst dovednosti', () => {
  const baseline = attempt({
    index: 110,
    scenarioId: 'contract-baseline',
    transcriptHash: 'contract-baseline-transcript',
    competencyStatuses: { contract: 'not_proven' },
  });
  const repeatedScenario = attempt({
    index: 111,
    scenarioId: 'contract-baseline',
    transcriptHash: 'new-words-same-scenario',
    competencyStatuses: { contract: 'proven' },
    difficulty: 'expert',
  });
  const repeatedTranscript = attempt({
    index: 112,
    scenarioId: 'renamed-copy',
    transcriptHash: 'contract-baseline-transcript',
    competencyStatuses: { contract: 'proven' },
    difficulty: 'expert',
  });
  const realTargetedAttempt = attempt({
    index: 113,
    scenarioId: 'new-contract-situation',
    transcriptHash: 'new-contract-transcript',
    competencyStatuses: { contract: 'partial' },
  });

  const gain = buildCoachMasteryGain([
    baseline,
    repeatedScenario,
    repeatedTranscript,
    realTargetedAttempt,
  ]);
  assert.equal(gain.acceptedPracticeAttempts, 2);
  assert.equal(gain.ignoredDuplicateAttempts, 2);
  assert.equal(gain.duplicateReasons.repeatedScenario, 1);
  assert.equal(gain.duplicateReasons.repeatedTranscript, 1);
  assert.equal(gain.competencies.contract.stage, 'developing');
  assert.equal(gain.competencies.contract.bestFollowUp.status, 'partial');
  assert.equal(gain.competencies.contract.distinctFollowUps, 1);
  assert.equal(gain.advancedGains, 0);
});

test('mastery gain přijímá jen trusted quality-passed nácvik bez kritické chyby', () => {
  const attempts = [
    attempt({ index: 120, scenarioId: 'safe-baseline', competencyStatuses: { ethical_boundaries: 'not_proven' } }),
    attempt({ index: 121, scenarioId: 'fallback-fake-gain', competencyStatuses: { ethical_boundaries: 'proven' }, difficulty: 'expert', provider: 'deterministic-training-fallback' }),
    attempt({ index: 122, scenarioId: 'failed-quality-gain', competencyStatuses: { ethical_boundaries: 'proven' }, difficulty: 'expert', qualityPassed: false }),
    attempt({ index: 123, scenarioId: 'critical-fake-gain', competencyStatuses: { ethical_boundaries: 'proven' }, difficulty: 'expert', criticalFailures: [{ code: 'clinical_scope_breach', competencyId: 'ethical_boundaries' }] }),
    attempt({ index: 124, scenarioId: 'safe-targeted-proof', competencyStatuses: { ethical_boundaries: 'proven' }, difficulty: 'standard' }),
  ];

  const gain = buildCoachMasteryGain(attempts);
  assert.equal(gain.acceptedPracticeAttempts, 2);
  assert.equal(gain.competencies.ethical_boundaries.stage, 'proven');
  assert.equal(gain.competencies.ethical_boundaries.bestFollowUp.scenarioId, 'safe-targeted-proof');
  assert.equal(gain.competencies.ethical_boundaries.advancedGain, false);
  assert.equal(gain.normalizedGainPercent, 66.7);
});

test('jediný povedený řádek neschová slabší část stejné kompetence', () => {
  const baseline = attempt({ index: 125, scenarioId: 'mixed-question-baseline', competencyIds: [] });
  baseline.achievement.rows = [
    { label: LABELS.questions, status: 'proven' },
    { label: LABELS.questions, status: 'not_proven' },
  ];
  const followUp = attempt({ index: 126, scenarioId: 'complete-question-follow-up', competencyIds: [], difficulty: 'standard' });
  followUp.achievement.rows = [
    { label: LABELS.questions, status: 'proven' },
    { label: LABELS.questions, status: 'proven' },
  ];

  const gain = buildCoachMasteryGain([baseline, followUp]);
  assert.equal(gain.competencies.questions.baseline.status, 'not_proven');
  assert.equal(gain.competencies.questions.bestFollowUp.status, 'proven');
  assert.equal(gain.competencies.questions.gainPercent, 66.7);
});

test('mastery gain je deterministický i při shodném času a libovolném pořadí vstupu', () => {
  const completedAt = '2026-09-01T12:00:00.000Z';
  const firstByStableId = attempt({
    index: 130,
    scenarioId: 'same-time-a',
    competencyStatuses: { active_listening: 'partial' },
    completedAt,
  });
  const secondByStableId = attempt({
    index: 131,
    scenarioId: 'same-time-b',
    competencyStatuses: { active_listening: 'not_proven' },
    completedAt,
  });
  const later = attempt({
    index: 132,
    scenarioId: 'later-listening',
    competencyStatuses: { active_listening: 'proven' },
    difficulty: 'standard',
    completedAt: '2026-09-01T12:05:00.000Z',
  });

  const forward = buildCoachMasteryGain([firstByStableId, secondByStableId, later]);
  const reversed = buildCoachMasteryGain([later, secondByStableId, firstByStableId]);
  assert.deepEqual(forward, reversed);
  assert.equal(forward.competencies.active_listening.baseline.attemptId, 'attempt-130');
  assert.equal(forward.competencies.active_listening.distinctFollowUps, 1);
  assert.equal(forward.competencies.active_listening.transition, 'developing→proven');

  const anonymous = [firstByStableId, secondByStableId, later].map(entry => {
    const { id: _id, trainingAttemptId: _trainingAttemptId, ...withoutIdentifiers } = entry;
    return withoutIdentifiers;
  });
  assert.deepEqual(buildCoachMasteryGain(anonymous), buildCoachMasteryGain([...anonymous].reverse()));
});

test('výchozí advanced výkon se sleduje jako udržený, ale nevydává se za zlepšení', () => {
  const gain = buildCoachMasteryGain([
    attempt({ index: 140, scenarioId: 'advanced-baseline', competencyStatuses: { alliance_repair: 'proven' }, difficulty: 'advanced' }),
    attempt({ index: 141, scenarioId: 'advanced-confirmation', competencyStatuses: { alliance_repair: 'proven' }, difficulty: 'expert' }),
  ]);
  const development = gain.competencies.alliance_repair;
  assert.equal(development.transition, 'advanced→advanced');
  assert.equal(development.stage, 'baseline');
  assert.equal(development.improved, false);
  assert.equal(development.maintainedAdvanced, true);
  assert.equal(gain.gainEligibleCompetencies, 0);
  assert.equal(gain.normalizedGainPercent, null);
  assert.equal(gain.maintainedAdvancedCompetencies, 1);
});

test('passport vystaví mastery gain v progressu i u každé kompetence', () => {
  const status = buildCoachCompetencyPassport([
    attempt({ index: 150, scenarioId: 'outcome-baseline', competencyStatuses: { outcome: 'not_proven' } }),
    attempt({ index: 151, scenarioId: 'outcome-targeted', competencyStatuses: { outcome: 'proven' }, difficulty: 'advanced' }),
  ]);
  assert.equal(status.progress.masteryGainPercent, 100);
  assert.equal(status.progress.measuredCompetencies, 1);
  assert.equal(status.progress.improvedCompetencies, 1);
  assert.equal(status.progress.advancedGains, 1);
  assert.equal(status.competencies.outcome.development.stage, 'advanced');
  assert.deepEqual(status.competencies.outcome.development, status.masteryGain.competencies.outcome);
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

test('kritická chyba z trusted pokusu zůstane sticky i při neúspěšném quality gate', () => {
  const failure = attempt({
    index: 45,
    competencyIds: [],
    qualityPassed: false,
    criticalFailures: [{ code: 'ignored_explicit_refusal', competencyId: 'refusal_autonomy' }],
  });
  const status = buildCoachCompetencyPassport([...completeAttempts(), failure]);
  assert.equal(status.progress.unresolvedCriticalFailures, 1);
  assert.equal(status.eligible, false);
  assert.equal(status.criticalFailures[0].code, 'ignored_explicit_refusal');
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

test('server finále neoznačí allProven bez důkazu všech devíti koučovacích kompetencí', () => {
  const record = buildCoachDebriefRecord({
    course: COURSE,
    item: { id: 'm0-1' },
    scenarioId: 'final-integrated-session',
    difficulty: 'expert',
    finalExam: true,
    messages: [{ role: 'user', content: 'Co chceš dnes získat?' }],
    result: {
      provider: 'openai/gpt-5.6',
      qualityGate: { pass: true },
      achievement: {
        allProven: true,
        rows: [{ label: LABELS.contract, status: 'proven' }],
      },
    },
  });
  assert.equal(record.achievement.allProven, false);
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
    trainingAttemptId: '33333333-3333-4333-8333-333333333333',
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
  assert.ok(insert.values.includes('33333333-3333-4333-8333-333333333333'));
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
