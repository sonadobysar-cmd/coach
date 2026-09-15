import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACADEMY_TRAINER_EVAL_STANDARD,
  academyTrainerEvalPlanFingerprint,
  academyTrainerReleaseBaseline,
  academyTrainerReleaseArtifactValid,
  academyTrainerRuntimeClaimFingerprint,
  assessAcademyTrainerBaselineEligibility,
  buildAcademyTrainerEvalPlan,
  debriefEvalRequest,
  evaluateTrainerDebrief,
  evaluateTrainerSimulation,
  evaluateTrainerStudy,
  createAcademyTrainerCaseReceipt,
  createAcademyTrainerOutcomeAttestation,
  createAcademyTrainerRuntimeClaim,
  simulationEvalRequest,
  studyEvalRequest,
  summarizeAcademyTrainerEval,
} from '../src/academy-trainer-evals.js';
import { loadCourses } from '../src/courses.js';
import { createTrainingScenario } from '../src/training.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const paths = (await readdir(join(ROOT, 'data')))
  .filter(name => /^course-.*\.md$/u.test(name) && !name.includes('audio-scripts'))
  .sort()
  .map(name => join(ROOT, 'data', name));
const courses = await loadCourses(paths);
const plan = buildAcademyTrainerEvalPlan(courses);
const RUNTIME_SECRET = 'academy-runtime-secret-with-more-than-32-bytes';
const OUTCOME_SECRET = 'academy-outcome-secret-with-more-than-32-bytes';

test('živá maturita trenérek plánuje přesně 27 × 3 odborně ukotvených případů', () => {
  assert.equal(plan.length, ACADEMY_TRAINER_EVAL_STANDARD.courseCount);
  assert.equal(plan.length * ACADEMY_TRAINER_EVAL_STANDARD.casesPerCourse, 81);
  assert.equal(new Set(plan.map(entry => entry.profile.label)).size, 27);
  assert.equal(new Set(plan.map(entry => `${entry.course.id}:${entry.item.id}`)).size, 27);
  for (const entry of plan) {
    assert.ok(entry.item.markdown.length >= 240, `${entry.course.id}: krátká evaluační lekce`);
    assert.ok(entry.scenario.rubric.length >= 5, `${entry.course.id}: krátká rubrika`);
    const roundTrip = createTrainingScenario(
      entry.course,
      entry.item,
      entry.scenario.difficulty,
      entry.scenario.id,
    );
    assert.equal(roundTrip.id, entry.scenario.id, `${entry.course.id}: eval situaci nelze bezpečně znovu načíst`);
    assert.equal(roundTrip.itemId, entry.item.id, `${entry.course.id}: eval situace nepatří zvolené lekci`);
    assert.match(studyEvalRequest(entry).messages[0].content, new RegExp(escapeRegExp(entry.item.title), 'u'));
    assert.equal(simulationEvalRequest(entry).courseSlug, entry.course.slug);
  }
});

test('eval odmítne demo, fallback, rozbitou roli i nepodložený debrief', () => {
  const entry = plan[0];
  const studyRequest = studyEvalRequest(entry);
  const badStudy = evaluateTrainerStudy(entry, {
    text: 'Obecná odpověď bez vztahu k lekci?', provider: 'demo-no-api-key', mode: entry.expectedStudyMode,
    activity: 'study', phase: 'study', qualityGate: { pass: true },
  }, studyRequest);
  assert.equal(badStudy.pass, false);
  assert.equal(badStudy.checks.find(check => check.name === 'real-model-provider').pass, false);

  const badSimulation = evaluateTrainerSimulation(entry, {
    text: 'Jako AI trenérka ti doporučuji použít správnou techniku.', provider: 'openai/test',
    mode: entry.expectedSimulationMode, activity: 'simulation', phase: 'roleplay', qualityGate: { pass: true },
  });
  assert.equal(badSimulation.pass, false);

  const request = debriefEvalRequest(entry, 'Je pro mě důležité rozhodnout se správně.');
  const badDebrief = evaluateTrainerDebrief(entry, {
    text: 'Výborně, všechno bylo perfektní.', provider: 'openai/test', mode: entry.expectedSimulationMode,
    activity: 'simulation', phase: 'debrief', qualityGate: { pass: true }, achievement: { rows: [] },
  }, request);
  assert.equal(badDebrief.pass, false);
});

test('roleplay eval odmítne obecnou vatu a vyžaduje konkrétní návaznost na scénář i poslední otázku', () => {
  const entry = plan[0];
  const request = simulationEvalRequest(entry);
  const payload = text => ({
    text,
    provider: 'openai/test',
    mode: entry.expectedSimulationMode,
    activity: 'simulation',
    phase: 'roleplay',
    qualityGate: { pass: true },
  });

  const generic = evaluateTrainerSimulation(entry, payload('Nevím. Řekni mi prosím ještě trochu víc.'), request);
  assert.equal(generic.pass, false);
  assert.equal(generic.checks.find(check => check.name === 'specific-target-behavior').pass, false);
  assert.ok(generic.checks.find(check => check.name === 'specific-target-behavior').detail.includes('generic_counterpart_turn'));

  const unrelated = evaluateTrainerSimulation(
    entry,
    payload('Nejdůležitější je pro mě uspět a zatím vím, že potřebuji více informací.'),
    request,
  );
  assert.equal(unrelated.pass, false);
  assert.equal(unrelated.checks.find(check => check.name === 'scenario-fidelity').pass, false);

  const dodgesPriority = evaluateTrainerSimulation(
    entry,
    payload('Moje prostředí mě při práci rozptyluje a pomůckám zatím nevěřím.'),
    request,
  );
  assert.equal(dodgesPriority.pass, false);
  assert.equal(dodgesPriority.checks.find(check => check.name === 'specific-target-behavior').pass, false);

  const grounded = evaluateTrainerSimulation(
    entry,
    payload('Nejdůležitější je pro mě začít pracovat bez závislosti na pomůckách. Zatím vím, že mě moje prostředí při startu ruší.'),
    request,
  );
  assert.equal(grounded.pass, true, JSON.stringify(grounded.checks));
});

test('debrief se samými neprokázanými řádky projde jen s doloženou prioritou, použitelnou větou a cíleným opakováním', () => {
  const entry = plan[0];
  const simulation = 'Nejdůležitější je pro mě upravit prostředí. Zatím vím, že mě při startu ruší telefon.';
  const request = debriefEvalRequest(entry, simulation);
  const studentText = simulationEvalRequest(entry).messages[0].content;
  const rows = entry.scenario.rubric.map(label => (
    `- ZATÍM NEPROKÁZÁNO — ${label}: jeden vstup neposkytuje dost důkazů.`
  ));
  const payload = text => ({
    text,
    provider: 'openai/test',
    mode: entry.expectedSimulationMode,
    activity: 'simulation',
    phase: 'debrief',
    qualityGate: { pass: true },
    achievement: { rows: entry.scenario.rubric.map(() => ({ status: 'not_proven' })) },
  });
  const response = ({ improvement, better, retry }) => [
    '## Výsledek nácviku',
    'Jeden vstup zatím nestačí k prokázání celé rubriky.',
    '## Co fungovalo',
    `Studentka otevřela téma otázkou „${studentText}“.`,
    '## Rozbor kompetencí',
    ...rows,
    '## Co zlepšit',
    improvement,
    '## Lepší formulace',
    better,
    '## Další pokus',
    retry,
  ].join('\n\n');

  const generic = evaluateTrainerDebrief(entry, payload(response({
    improvement: 'Buď konkrétnější.',
    better: 'Zkus to říct lépe.',
    retry: 'Zkus to znovu.',
  })), request);
  assert.equal(generic.pass, false);
  assert.equal(generic.checks.find(check => check.name === 'evidence-grounded-priority-correction').pass, false);
  assert.equal(generic.checks.find(check => check.name === 'useful-improved-formulation').pass, false);
  assert.equal(generic.checks.find(check => check.name === 'targeted-retry').pass, false);

  const quoteOnly = evaluateTrainerDebrief(entry, payload(response({
    improvement: `Prioritou je zlepšit odpověď „${studentText}“.`,
    better: '„Co je pro tebe v této situaci teď nejdůležitější?“',
    retry: 'Zopakuj stejný okamžik a polož jednu konkrétní otázku před dalším krokem.',
  })), request);
  assert.equal(quoteOnly.pass, false);
  assert.ok(quoteOnly.checks
    .find(check => check.name === 'evidence-grounded-priority-correction')
    .detail.includes('improvement_missing_priority'));

  const empty = evaluateTrainerDebrief(entry, payload(response({
    improvement: '',
    better: '',
    retry: '',
  })), request);
  assert.equal(empty.pass, false);
  const emptyDetails = empty.checks.find(check => check.name === 'evidence-grounded-debrief').detail;
  assert.ok(emptyDetails.includes('empty_improvement'));
  assert.ok(emptyDetails.includes('empty_better_formulation'));
  assert.ok(emptyDetails.includes('empty_next_attempt'));

  const actionable = evaluateTrainerDebrief(entry, payload(response({
    improvement: `Prioritou je rozdělit dvojitou otázku „${studentText}“ na jeden účel, protože protistrana neví, na co odpovědět nejdřív.`,
    better: '„Co je pro tebe v této situaci teď nejdůležitější?“',
    retry: 'Zopakuj stejný okamžik a polož pouze jednu otázku; úspěch je jedna konkrétní odpověď protistrany před dalším krokem.',
  })), request);
  assert.equal(actionable.pass, true, JSON.stringify(actionable.checks));
});

test('release baseline lze zapsat pouze z jednoho čerstvého a verzovaného výsledku 81/81', () => {
  const runId = 'fresh-81-run';
  const report = completeReport(runId);
  assert.equal(report.summary.complete, true);
  assert.equal(report.summary.total, 81);
  assert.equal(report.byType.study.passed, 27);
  assert.deepEqual(assessAcademyTrainerBaselineEligibility(report, {
    plan,
    runtimeClaimSecret: RUNTIME_SECRET,
  }), { eligible: true, reasons: [] });
  const outcomeAttestation = createAcademyTrainerOutcomeAttestation({
    report,
    plan,
    runtimeClaimSecret: RUNTIME_SECRET,
    secret: OUTCOME_SECRET,
  });
  const baseline = academyTrainerReleaseBaseline(report, {
    plan,
    runtimeClaimSecret: RUNTIME_SECRET,
    outcomeAttestation,
  });
  assert.equal(baseline.standardVersion, 5);
  assert.equal(baseline.caseCount, 81);
  assert.equal(baseline.evidence.results.length, 81);
  assert.match(baseline.evidenceDigest, /^[a-f0-9]{64}$/u);
  assert.equal(academyTrainerReleaseArtifactValid(baseline, {
    plan,
    expectedFingerprints: report.provenance,
    expectedAppVersion: report.provenance.appVersion,
    expectedModels: report.provenance.modelIds,
    runtimeClaimSecret: RUNTIME_SECRET,
    outcomeAttestationSecret: OUTCOME_SECRET,
  }), true);
});

test('resume s 79 recyklovanými PASS nikdy nevytvoří release baseline', () => {
  const report = completeReport('resume-run');
  report.run.resumedFrom = 'reports/older.json';
  report.run.freshCases = 2;
  report.run.reusedCases = 79;
  report.run.attemptedCases = 2;
  for (const result of report.results.slice(0, 79)) result.evaluationRunId = 'older-run';

  const eligibility = assessAcademyTrainerBaselineEligibility(report, { plan, runtimeClaimSecret: RUNTIME_SECRET });
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes('resumed-run-cannot-release'));
  assert.ok(eligibility.reasons.includes('all-cases-must-be-fresh'));
  assert.ok(eligibility.reasons.includes('reused-cases-present'));
  assert.ok(eligibility.reasons.includes('results-not-bound-to-current-run'));
  assert.throws(() => academyTrainerReleaseBaseline(report, { plan, runtimeClaimSecret: RUNTIME_SECRET }), /baseline nelze zapsat/u);
});

test('baseline odmítne chybějící provenance, špinavý commit a jiný skutečně použitý model', () => {
  const missing = completeReport('missing-provenance');
  missing.provenance.promptSystemFingerprint = null;
  missing.provenance.deployment.identity = null;
  assert.deepEqual(
    assessAcademyTrainerBaselineEligibility(missing, { plan, runtimeClaimSecret: RUNTIME_SECRET }).reasons.includes('prompt-system-fingerprint-missing'),
    true,
  );

  const dirty = completeReport('dirty-run');
  dirty.provenance.gitDirty = true;
  dirty.provenance.modelIds.observedByType.simulation = ['openai/jiny-model'];
  const eligibility = assessAcademyTrainerBaselineEligibility(dirty, { plan, runtimeClaimSecret: RUNTIME_SECRET });
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes('git-worktree-must-be-clean'));
  assert.ok(eligibility.reasons.includes('model-provenance-simulation-mismatch'));
});

test('serverová atestace odmítne chybějící, změněný i lokálně vyrobený Academy výsledek', () => {
  const missing = completeReport('missing-receipt-run');
  missing.results[0].releaseReceipt = null;
  assert.equal(assessAcademyTrainerBaselineEligibility(missing, {
    plan,
    runtimeClaimSecret: RUNTIME_SECRET,
  }).eligible, false);

  const tampered = completeReport('tampered-receipt-run');
  tampered.results[0].releaseReceipt.signature = `${tampered.results[0].releaseReceipt.signature.slice(0, -1)}${tampered.results[0].releaseReceipt.signature.endsWith('0') ? '1' : '0'}`;
  assert.equal(createAcademyTrainerOutcomeAttestation({
    report: tampered,
    plan,
    runtimeClaimSecret: RUNTIME_SECRET,
    secret: OUTCOME_SECRET,
  }), null);

  const fabricated = completeReport('fabricated-receipt-run');
  fabricated.results[0].releaseReceipt.signature = hash('runner-cannot-sign-this-result');
  assert.equal(createAcademyTrainerOutcomeAttestation({
    report: fabricated,
    plan,
    runtimeClaimSecret: RUNTIME_SECRET,
    secret: OUTCOME_SECRET,
  }), null);
});

function completeReport(runId) {
  const provenance = validProvenance(runId);
  const runtimeClaimFingerprint = academyTrainerRuntimeClaimFingerprint(provenance.deployment.runtimeClaim);
  const results = plan.flatMap(entry => ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => passingResult(
    entry,
    type,
    runId,
    provenance.modelIds[type],
    runtimeClaimFingerprint,
  )));
  const report = summarizeAcademyTrainerEval(results, {
    baseUrl: 'http://127.0.0.1:4173',
    startedAt: '2026-08-31T10:00:00.000Z',
    completedAt: '2026-08-31T10:05:00.000Z',
    plan,
  });
  report.run = { id: runId, resumedFrom: null, freshCases: 81, reusedCases: 0, attemptedCases: 81 };
  report.provenance = provenance;
  return report;
}

function validProvenance(runId) {
  const fingerprints = {
    applicationFingerprint: 'e'.repeat(64),
    promptSystemFingerprint: 'b'.repeat(64),
    evaluationCodeFingerprint: 'c'.repeat(64),
    evalPlanFingerprint: academyTrainerEvalPlanFingerprint(plan),
  };
  const modelIds = {
    study: 'openai/gpt-5.6-terra',
    simulation: 'openai/gpt-5.6-luna',
    debrief: 'openai/gpt-5.6-terra',
  };
  const runtimeClaim = createAcademyTrainerRuntimeClaim({
    baseUrl: 'http://127.0.0.1:4173',
    appVersion: '0.39.0',
    gitCommitSha: 'a'.repeat(40),
    modelIds,
    fingerprints,
    secret: RUNTIME_SECRET,
    env: {},
    now: Date.parse('2026-08-31T10:00:00.000Z'),
  });
  return {
    runId,
    appVersion: '0.39.0',
    gitCommitSha: 'a'.repeat(40),
    gitDirty: false,
    modelIds: {
      ...modelIds,
      observedByType: {
        study: ['openai/gpt-5.6-terra'],
        simulation: ['openai/gpt-5.6-luna'],
        debrief: ['openai/gpt-5.6-terra'],
      },
    },
    ...fingerprints,
    authentication: { releaseEvalTokenUsed: true, memberJwtUsed: false, runtimeClaimVerified: true },
    deployment: {
      baseUrl: 'http://127.0.0.1:4173',
      identity: `local:${'a'.repeat(40)}`,
      gitCommitSha: 'a'.repeat(40),
      runtimeClaim,
      runtimeClaimFingerprint: academyTrainerRuntimeClaimFingerprint(runtimeClaim),
    },
    generatedAt: '2026-08-31T10:00:00.000Z',
  };
}

function passingResult(entry, type, runId, provider, runtimeClaimFingerprint) {
  const checkNames = {
    study: [
      'real-model-provider', 'study-mode', 'study-phase', 'server-quality-gate',
      'lesson-grounding', 'substantive-explanation', 'one-checking-question',
    ],
    simulation: [
      'real-model-provider', 'simulation-mode', 'roleplay-phase', 'server-quality-gate',
      'counterpart-role-integrity', 'scenario-fidelity', 'specific-target-behavior', 'natural-counterpart-turn',
    ],
    debrief: [
      'real-model-provider', 'debrief-mode', 'debrief-phase', 'server-quality-gate',
      'evidence-grounded-debrief', 'evidence-grounded-priority-correction', 'useful-improved-formulation',
      'targeted-retry', 'complete-course-rubric', 'no-missing-rubric-status',
    ],
  }[type];
  const id = `${entry.course.id}:${type}`;
  const result = {
    standardId: ACADEMY_TRAINER_EVAL_STANDARD.resultSchemaId,
    id,
    courseId: entry.course.id,
    courseSlug: entry.course.slug,
    courseTitle: entry.course.title,
    trainer: entry.profile.label,
    itemId: entry.item.id,
    itemTitle: entry.item.title,
    type,
    scenarioId: type === 'study' ? null : entry.scenario.id,
    pass: true,
    checks: checkNames.map(name => ({ name, pass: true })),
    provider,
    qualityGate: { pass: true, repaired: false, issueCodes: [] },
    responseWords: type === 'simulation' ? 20 : type === 'study' ? 80 : 120,
    responseFingerprint: hash(`response:${id}`),
    releaseEvaluation: {
      suite: 'academy-trainers',
      runId,
      caseId: id,
      stepId: type === 'study' ? 'study' : type === 'simulation' ? 'roleplay-1' : 'debrief',
      runtimeClaimFingerprint,
      isolated: true,
      memberUsageCharged: false,
      passportPersisted: false,
      certificateEvidencePersisted: false,
      courseMasteryPersisted: false,
    },
    attempts: 1,
    evaluationRunId: runId,
  };
  result.releaseReceipt = createAcademyTrainerCaseReceipt({
    runId,
    caseId: id,
    type,
    stepId: result.releaseEvaluation.stepId,
    runtimeClaimFingerprint,
    requestFingerprint: hash(`request:${id}`),
    responseText: `response:${id}`,
    evaluation: result,
    secret: OUTCOME_SECRET,
    now: Date.parse('2026-08-31T10:03:00.000Z'),
  });
  return result;
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
