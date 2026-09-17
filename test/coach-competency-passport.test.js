import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoachCompetencyPassport,
  buildCoachDebriefRecord,
  buildCoachMasteryGain,
  COACH_ASSESSMENT_POLICY_VERSION,
  isTrustedCoachAssessmentProvider,
  recordCoachDebriefAttempt,
} from '../src/coach-competency-passport.js';
import { COACH_COMPETENCIES, coachCompetencyIdForCriterion } from '../src/coach-competencies.js';
import {
  COACH_REMEDIATION_FAILURE_CODES,
  coachRemediationChallengesForFailure,
} from '../src/coach-remediation-challenges.js';
import { buildCertificateStatus } from '../src/certificate-service.js';

const COURSE = {
  id: 'profesionalni-life-coach',
  slug: 'profesionalni-life-coach-od-kontraktu-k-vysledku',
  title: 'Profesionální life coach',
  certificate: { title: 'Elitea Certified Professional Life Coach' },
  modules: [{ items: [{ id: 'm0-1' }] }],
};

const LABELS = Object.freeze({
  contract: 'Kontrakt a jasný cíl rozhovoru',
  active_listening: 'Pozorovatelný důkaz: reflexe klientčiných slov',
  questions: 'Jedna otázka s jedním účelem',
  intervention_choice: 'Pojmenování účelu bez obhajoby modelu',
  refusal_autonomy: 'Respekt k odmítnutí otázky',
  alliance_repair: 'Přijetí opravy bez obhajování',
  ethical_boundaries: 'Jasné odmítnutí léčebného slibu',
  outcome: 'Klientkou zvolený ověřitelný krok',
  reflection: 'Práce s hypotézou místo prvního dojmu',
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
  scenarioFamilyId = null,
  challengeId = null,
  remediationFailureCodes = [],
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
    scenarioFamilyId,
    challengeId,
    remediationFailureCodes,
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

test('passport ignoruje výsledky vytvořené podle starší hodnoticí politiky', () => {
  const current = completeAttempts().map(entry => ({
    ...entry,
    assessmentPolicyVersion: COACH_ASSESSMENT_POLICY_VERSION,
  }));
  assert.equal(buildCoachCompetencyPassport(current).eligible, true);

  const stale = current.map(entry => ({
    ...entry,
    assessmentPolicyVersion: COACH_ASSESSMENT_POLICY_VERSION - 1,
  }));
  const status = buildCoachCompetencyPassport(stale);
  assert.equal(status.eligible, false);
  assert.equal(status.progress.practiceScenarios, 0);
  assert.equal(status.progress.finalExamsPassed, 0);
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

test('stejná stabilní výzva v jiné lekci a obtížnosti se započte jen jednou', () => {
  const first = attempt({
    index: 60,
    scenarioId: 'profesionalni-life-coach:sf-contract-under-pressure:ch-same-client-case:rf-none:m2-1:standard:lesson',
    competencyIds: ['contract'],
    difficulty: 'standard',
  });
  const relabeled = attempt({
    index: 61,
    scenarioId: 'profesionalni-life-coach:sf-contract-under-pressure:ch-same-client-case:rf-none:m2-5:expert:lesson',
    competencyIds: ['contract'],
    difficulty: 'expert',
  });
  const status = buildCoachCompetencyPassport([first, relabeled], {
    minimumPracticeScenarios: 1,
    minimumProofsPerCompetency: 1,
    minimumPassingFinalExams: 1,
    advancedDifficulties: ['advanced', 'expert'],
    coreCompetencyIds: [],
  });

  assert.equal(status.progress.practiceScenarios, 1);
  assert.equal(status.masteryGain.acceptedPracticeAttempts, 1);
  assert.equal(status.masteryGain.duplicateReasons.repeatedScenario, 1);
  assert.equal(status.competencies.contract.proofs, 1);
});

test('pozdější úspěšný retry se stane důkazem scénáře, ale nepředstírá nový scénář ani mastery gain', () => {
  const failed = attempt({
    index: 43,
    scenarioId: 'retry-contract-scenario',
    competencyStatuses: { contract: 'not_proven' },
    difficulty: 'standard',
  });
  const passedStandard = attempt({
    index: 44,
    scenarioId: 'retry-contract-scenario',
    competencyStatuses: { contract: 'proven' },
    difficulty: 'standard',
  });
  const passedAdvanced = attempt({
    index: 46,
    scenarioId: 'retry-contract-scenario',
    competencyStatuses: { contract: 'proven' },
    difficulty: 'advanced',
  });
  const status = buildCoachCompetencyPassport([failed, passedStandard, passedAdvanced], {
    minimumPracticeScenarios: 1,
    minimumProofsPerCompetency: 1,
    minimumPassingFinalExams: 1,
    advancedDifficulties: ['advanced', 'expert'],
  });

  assert.equal(status.progress.practiceScenarios, 1);
  assert.equal(status.competencies.contract.proofs, 1);
  assert.equal(status.competencies.contract.advancedProofs, 1);
  assert.deepEqual(status.competencies.contract.scenarioIds, ['retry-contract-scenario']);
  assert.equal(status.masteryGain.acceptedPracticeAttempts, 1);
  assert.equal(status.masteryGain.duplicateReasons.repeatedScenario, 2);
  assert.equal(status.masteryGain.competencies.contract.measured, false);
  assert.equal(status.masteryGain.competencies.contract.improved, false);
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

test('slabší řádek stejné kompetence zablokuje i passportový důkaz a nápravu', () => {
  const first = attempt({ index: 127, scenarioId: 'mixed-contract-one', competencyIds: [] });
  first.achievement.rows = [
    { label: LABELS.contract, status: 'proven' },
    { label: LABELS.contract, status: 'not_proven' },
  ];
  const second = attempt({ index: 128, scenarioId: 'mixed-contract-two', competencyIds: [], difficulty: 'expert' });
  second.achievement.rows = [
    { label: LABELS.contract, status: 'proven' },
    { label: LABELS.contract, status: 'partial' },
  ];

  const status = buildCoachCompetencyPassport([first, second], {
    minimumPracticeScenarios: 1,
    minimumProofsPerCompetency: 1,
    minimumPassingFinalExams: 1,
    advancedDifficulties: ['advanced', 'expert'],
  });
  assert.equal(status.progress.practiceScenarios, 0);
  assert.equal(status.competencies.contract.proofs, 0);
  assert.equal(status.competencies.contract.proven, false);
  assert.equal(status.competencies.contract.advancedProven, false);
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

test('způsobilost vyžaduje udržený rozvoj klíčových kompetencí a blokuje poslední regresi', () => {
  const base = completeAttempts();
  const latestRegression = attempt({
    index: 170,
    scenarioId: 'latest-contract-regression',
    scenarioFamilyId: 'contract-new-family',
    challengeId: 'new-contract-case',
    competencyStatuses: { contract: 'partial' },
    difficulty: 'expert',
  });
  const regressed = buildCoachCompetencyPassport([...base, latestRegression]);
  assert.equal(regressed.eligible, false);
  assert.deepEqual(regressed.latestRegressionCompetencyIds, ['contract']);
  assert.equal(regressed.progress.latestRegressions, 1);
  assert.match(regressed.reasons.join(' '), /posledním zhoršení/iu);

  const recoveryOne = attempt({
    index: 171,
    scenarioId: 'contract-recovery-one',
    scenarioFamilyId: 'contract-recovery-family',
    challengeId: 'contract-recovery-a',
    competencyStatuses: { contract: 'proven' },
    difficulty: 'expert',
  });
  const recovered = buildCoachCompetencyPassport([...base, latestRegression, recoveryOne]);
  assert.equal(recovered.eligible, true);
  assert.equal(recovered.progress.latestRegressions, 0);

  const developingOnly = [
    attempt({ index: 180, scenarioId: 'questions-baseline', competencyStatuses: { questions: 'not_proven' }, difficulty: 'standard' }),
    attempt({ index: 181, scenarioId: 'questions-one-good-result', competencyStatuses: { questions: 'proven' }, difficulty: 'advanced' }),
  ];
  const notSustained = buildCoachCompetencyPassport(developingOnly, {
    minimumPracticeScenarios: 1,
    minimumProofsPerCompetency: 1,
    minimumPassingFinalExams: 1,
    advancedDifficulties: ['advanced', 'expert'],
    coreCompetencyIds: ['questions'],
  });
  assert.deepEqual(notSustained.missingCoreDevelopmentIds, ['questions']);
  assert.match(notSustained.reasons.join(' '), /opakovaně udržený rozvoj/iu);
});

test('kritické pochybení napraví jen stejný kód v jiné ekvivalentní výzvě, ne obecná kompetence', () => {
  const failure = attempt({
    index: 40,
    competencyIds: [],
    scenarioFamilyId: 'coach-module-17',
    challengeId: 'coach-module-17-case-1',
    criticalFailures: [{ code: 'outcome_guarantee', competencyId: 'ethical_boundaries' }],
  });
  const blocked = buildCoachCompetencyPassport([...completeAttempts(), failure]);
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.progress.unresolvedCriticalFailures, 1);
  assert.match(blocked.reasons.join(' '), /nápravu 1 kritických/i);

  const broadCompetencyOnly = attempt({
    index: 41,
    competencyIds: ['ethical_boundaries'],
    scenarioId: 'generic-ethical-remediation',
    scenarioFamilyId: 'generic-business-case',
    challengeId: 'generic-safe-answer',
    remediationFailureCodes: ['outcome_guarantee'],
  });
  const stillBlocked = buildCoachCompetencyPassport([...completeAttempts(), failure, broadCompetencyOnly]);
  assert.equal(stillBlocked.progress.unresolvedCriticalFailures, 1);

  const wrongCodeChallenge = coachRemediationChallengesForFailure('clinical_scope_breach')[0];
  const wrongCode = attempt({
    index: 42,
    competencyIds: ['ethical_boundaries'],
    scenarioId: 'wrong-code-remediation',
    scenarioFamilyId: wrongCodeChallenge.scenarioFamilyId,
    challengeId: wrongCodeChallenge.challengeId,
    remediationFailureCodes: wrongCodeChallenge.remediationFailureCodes,
  });
  const wrongCodeBlocked = buildCoachCompetencyPassport([...completeAttempts(), failure, wrongCode]);
  assert.equal(wrongCodeBlocked.progress.unresolvedCriticalFailures, 1);

  const [challenge] = coachRemediationChallengesForFailure('outcome_guarantee');
  const remediation = attempt({
    index: 43,
    competencyIds: ['ethical_boundaries'],
    difficulty: 'expert',
    scenarioId: 'guarantee-remediation-b',
    scenarioFamilyId: challenge.scenarioFamilyId,
    challengeId: challenge.challengeId,
    remediationFailureCodes: challenge.remediationFailureCodes,
  });
  const remediated = buildCoachCompetencyPassport([...completeAttempts(), failure, broadCompetencyOnly, wrongCode, remediation]);
  assert.equal(remediated.progress.unresolvedCriticalFailures, 0);
  assert.equal(remediated.eligible, true);
  assert.equal(remediated.criticalFailures[0].remediatedBy.scenarioId, 'guarantee-remediation-b');
  assert.equal(remediated.criticalFailures[0].remediatedBy.failureCode, 'outcome_guarantee');
});

test('stejnou kritickou výzvu nelze opravit jejím přejmenovaným opakováním, druhý případ z páru ano', () => {
  const [challengeA, challengeB] = coachRemediationChallengesForFailure('ignored_explicit_refusal');
  const failure = attempt({
    index: 190,
    scenarioId: 'refusal-failure-a',
    scenarioFamilyId: challengeA.scenarioFamilyId,
    challengeId: challengeA.challengeId,
    remediationFailureCodes: challengeA.remediationFailureCodes,
    criticalFailures: [{ code: 'ignored_explicit_refusal', competencyId: 'refusal_autonomy' }],
  });
  const sameChallenge = attempt({
    index: 191,
    scenarioId: 'refusal-same-content-renamed',
    scenarioFamilyId: challengeA.scenarioFamilyId,
    challengeId: challengeA.challengeId,
    remediationFailureCodes: challengeA.remediationFailureCodes,
    competencyIds: ['refusal_autonomy'],
    difficulty: 'expert',
  });
  const stillBlocked = buildCoachCompetencyPassport([...completeAttempts(), failure, sameChallenge]);
  assert.equal(stillBlocked.progress.unresolvedCriticalFailures, 1);

  const equivalentChallenge = attempt({
    index: 192,
    scenarioId: 'refusal-equivalent-b',
    scenarioFamilyId: challengeB.scenarioFamilyId,
    challengeId: challengeB.challengeId,
    remediationFailureCodes: challengeB.remediationFailureCodes,
    competencyIds: ['refusal_autonomy'],
    difficulty: 'expert',
  });
  const remediated = buildCoachCompetencyPassport([
    ...completeAttempts(),
    failure,
    sameChallenge,
    equivalentChallenge,
  ]);
  assert.equal(remediated.progress.unresolvedCriticalFailures, 0);
});

test('každá alternativa nápravné výzvy obsahuje rubriku své povinné kompetence', () => {
  for (const failureCode of COACH_REMEDIATION_FAILURE_CODES) {
    for (const challenge of coachRemediationChallengesForFailure(failureCode)) {
      assert.ok(
        challenge.rubric.some(criterion => coachCompetencyIdForCriterion(criterion) === challenge.competencyId),
        `${challenge.challengeId} musí dokazovat ${challenge.competencyId}`,
      );
    }
  }
});

test('každý kritický kód má funkční nápravu z původní lekční situace jen příslušnou kompetencí', () => {
  const competencyByCode = {
    clinical_scope_breach: 'ethical_boundaries',
    confidentiality_breach: 'ethical_boundaries',
    outcome_guarantee: 'ethical_boundaries',
    ignored_explicit_refusal: 'refusal_autonomy',
    client_decision_takeover: 'refusal_autonomy',
    false_credential_claim: 'ethical_boundaries',
    suicide_risk_response_missing: 'ethical_boundaries',
  };
  assert.deepEqual(Object.keys(competencyByCode).sort(), [...COACH_REMEDIATION_FAILURE_CODES].sort());

  for (const [offset, failureCode] of COACH_REMEDIATION_FAILURE_CODES.entries()) {
    const competencyId = competencyByCode[failureCode];
    const challenge = coachRemediationChallengesForFailure(failureCode)[0];
    const failure = attempt({
      index: 210 + (offset * 3),
      scenarioFamilyId: `coach-module-${offset + 1}`,
      challengeId: `original-lesson-${offset + 1}`,
      criticalFailures: [{ code: failureCode, competencyId }],
    });
    const wrongCompetency = attempt({
      index: 211 + (offset * 3),
      scenarioFamilyId: challenge.scenarioFamilyId,
      challengeId: challenge.challengeId,
      remediationFailureCodes: challenge.remediationFailureCodes,
      competencyIds: [competencyId === 'ethical_boundaries' ? 'refusal_autonomy' : 'ethical_boundaries'],
      difficulty: 'expert',
    });
    const blocked = buildCoachCompetencyPassport([...completeAttempts(), failure, wrongCompetency]);
    assert.equal(blocked.progress.unresolvedCriticalFailures, 1, `${failureCode}: nesprávná kompetence`);

    const proven = attempt({
      index: 212 + (offset * 3),
      scenarioFamilyId: challenge.scenarioFamilyId,
      challengeId: challenge.challengeId,
      remediationFailureCodes: challenge.remediationFailureCodes,
      competencyIds: [competencyId],
      difficulty: 'expert',
    });
    const remediated = buildCoachCompetencyPassport([...completeAttempts(), failure, wrongCompetency, proven]);
    assert.equal(remediated.progress.unresolvedCriticalFailures, 0, `${failureCode}: náprava`);
  }
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

test('server nepočítá kompetenci jako prokázanou, pokud její slabší kritérium neprošlo', () => {
  const record = buildCoachDebriefRecord({
    course: COURSE,
    item: { id: 'm0-1' },
    scenarioId: 'mixed-contract-server-record',
    difficulty: 'advanced',
    messages: [{ role: 'user', content: 'Co by dnes bylo užitečné?' }],
    result: {
      provider: 'openai/gpt-5.6',
      qualityGate: { pass: true },
      achievement: {
        rows: [
          { label: LABELS.contract, status: 'proven' },
          { label: LABELS.contract, status: 'not_proven' },
        ],
      },
    },
  });

  assert.equal(record.achievement.proven, 0);
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
      scenario: {
        id: 'server-resolved-id',
        difficulty: 'advanced',
        scenarioFamilyId: 'server-family',
        challengeId: 'server-challenge',
        remediationFailureCodes: ['clinical_scope_breach'],
      },
      qualityGate: { pass: true },
      achievement: { rows: [{ label: LABELS.contract, status: 'proven' }] },
    },
  };
  const stored = await recordCoachDebriefAttempt(input, { DATABASE_URL: 'postgres://test' }, { sqlFactory: () => sql });
  assert.equal(stored.recorded, true);
  const insert = calls.find(call => /academy_coach_debrief_attempts/u.test(call.query));
  assert.ok(insert);
  assert.ok(insert.values.includes('server-resolved-id'));
  assert.ok(insert.values.includes('server-family'));
  assert.ok(insert.values.includes('server-challenge'));
  assert.ok(insert.values.includes('["clinical_scope_breach"]'));
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
