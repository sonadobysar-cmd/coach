import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getCourseTrainerProfile } from './course-trainer-profiles.js';
import { attachCourseMastery } from './course-mastery.js';
import {
  assessDebriefResponse,
  assessRoleplayResponse,
  assessStudyResponse,
} from './training-quality.js';
import { createTrainingScenario, trainingMode } from './training.js';

export const ACADEMY_TRAINER_EVAL_STANDARD = Object.freeze({
  id: 'elitea-academy-trainer-readiness',
  resultSchemaId: 'elitea-academy-trainer-case-v5',
  runtimeClaimSchemaId: 'elitea-academy-trainer-runtime-claim-v1',
  caseReceiptSchemaId: 'elitea-academy-trainer-case-receipt-v1',
  outcomeAttestationSchemaId: 'elitea-academy-trainer-outcome-attestation-v1',
  version: 5,
  courseCount: 27,
  casesPerCourse: 3,
  requiredCases: 81,
  requiredPassRate: 100,
  caseTypes: Object.freeze(['study', 'simulation', 'debrief']),
  responseWordBounds: Object.freeze({
    study: Object.freeze({ min: 45, max: 1_200 }),
    simulation: Object.freeze({ min: 4, max: 120 }),
    debrief: Object.freeze({ min: 60, max: 1_800 }),
  }),
});

export const ACADEMY_TRAINER_PROVENANCE_FILE_GROUPS = Object.freeze({
  applicationFingerprint: Object.freeze([
    'package.json',
    'package-lock.json',
    'src/server.js',
    'src/training.js',
    'src/ai-meter.js',
    'src/elitea.js',
    'src/runtime-schema.js',
    'src/release-evaluation-auth.js',
    'src/release-evaluation-ledger.js',
    'src/training-attempt-auth.js',
  ]),
  promptSystemFingerprint: Object.freeze([
    'config/system-prompt.md',
    'src/training.js',
    'src/ai-context.js',
    'src/ai-meter.js',
    'src/elitea.js',
    'src/training-quality.js',
    'src/course-trainer-profiles.js',
    'src/course-knowledge.js',
    'src/course-mastery.js',
    'src/coach-competencies.js',
    'src/language-profile.js',
    'src/safety.js',
  ]),
  evaluationCodeFingerprint: Object.freeze([
    'src/academy-trainer-evals.js',
    'scripts/evaluate-academy-trainers.mjs',
  ]),
});

const DISALLOWED_PROVIDERS = /(?:demo|fallback|course-role-router)/iu;
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const CODE_ID = /^[A-Za-z0-9_.:/-]{1,240}$/u;
const FINGERPRINT_FIELDS = Object.freeze([
  'applicationFingerprint',
  'promptSystemFingerprint',
  'evaluationCodeFingerprint',
  'evalPlanFingerprint',
]);
const RESULT_CHECK_NAMES = Object.freeze({
  study: Object.freeze([
    'real-model-provider', 'study-mode', 'study-phase', 'server-quality-gate',
    'lesson-grounding', 'substantive-explanation', 'one-checking-question',
  ]),
  simulation: Object.freeze([
    'real-model-provider', 'simulation-mode', 'roleplay-phase', 'server-quality-gate',
    'counterpart-role-integrity', 'scenario-fidelity', 'specific-target-behavior',
    'natural-counterpart-turn',
  ]),
  debrief: Object.freeze([
    'real-model-provider', 'debrief-mode', 'debrief-phase', 'server-quality-gate',
    'evidence-grounded-debrief', 'evidence-grounded-priority-correction',
    'useful-improved-formulation', 'targeted-retry', 'complete-course-rubric',
    'no-missing-rubric-status',
  ]),
});

export function selectTrainerEvalItem(course) {
  const candidates = (course?.modules || [])
    .flatMap(module => module.items || [])
    .filter(item => item?.kind !== 'quiz' && item?.type !== 'quiz' && String(item?.markdown || '').trim().length >= 240);
  if (!candidates.length) throw new Error(`${course?.id || 'unknown'}: chybí odborná část pro živý eval trenérky.`);

  return [...candidates].sort((left, right) => {
    const leftIntro = /(?:úvod|přehled|co kurz|co program|co .* je)/iu.test(`${left.title} ${left.markdown}`) ? 1 : 0;
    const rightIntro = /(?:úvod|přehled|co kurz|co program|co .* je)/iu.test(`${right.title} ${right.markdown}`) ? 1 : 0;
    if (leftIntro !== rightIntro) return leftIntro - rightIntro;
    return String(right.markdown || '').length - String(left.markdown || '').length;
  })[0];
}

export function buildAcademyTrainerEvalPlan(courses = []) {
  if (courses.length !== ACADEMY_TRAINER_EVAL_STANDARD.courseCount) {
    throw new Error(`Eval vyžaduje přesně ${ACADEMY_TRAINER_EVAL_STANDARD.courseCount} kurzů, nalezeno ${courses.length}.`);
  }
  const defaultProfile = getCourseTrainerProfile('__missing-course__');
  const plan = courses
    .map(rawCourse => {
      const course = rawCourse?.mastery?.scenarios?.length ? rawCourse : attachCourseMastery(rawCourse);
      const profile = getCourseTrainerProfile(course.id);
      if (profile === defaultProfile) throw new Error(`${course.id}: kurz používá obecnou trenérku.`);
      const item = selectTrainerEvalItem(course);
      const scenario = createTrainingScenario(course, item, 'advanced');
      if (!Array.isArray(scenario.rubric) || scenario.rubric.length < 5) {
        throw new Error(`${course.id}: scénář nemá úplnou odbornou rubriku.`);
      }
      return {
        course,
        item,
        profile,
        scenario,
        expectedStudyMode: trainingMode(course, 'study'),
        expectedSimulationMode: trainingMode(course, 'simulation'),
      };
    })
    .sort((left, right) => left.course.id.localeCompare(right.course.id, 'cs'));

  const caseCount = plan.length * ACADEMY_TRAINER_EVAL_STANDARD.casesPerCourse;
  if (caseCount !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) {
    throw new Error(`Eval plán má ${caseCount}/${ACADEMY_TRAINER_EVAL_STANDARD.requiredCases} případů.`);
  }
  return plan;
}

export function academyTrainerEvalPlanManifest(plan = []) {
  return plan.flatMap(entry => ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => ({
    id: `${entry.course.id}:${type}`,
    type,
    courseId: String(entry.course.id || ''),
    courseSlug: String(entry.course.slug || ''),
    courseTitle: String(entry.course.title || ''),
    itemId: String(entry.item.id || ''),
    itemTitle: String(entry.item.title || ''),
    itemFingerprint: hash(String(entry.item.markdown || '')),
    trainer: String(entry.profile.label || ''),
    expectedMode: type === 'study' ? entry.expectedStudyMode : entry.expectedSimulationMode,
    scenarioId: type === 'study' ? null : String(entry.scenario.id || ''),
    scenarioFingerprint: type === 'study' ? null : hash(canonicalJson({
      id: entry.scenario.id,
      itemId: entry.scenario.itemId,
      difficulty: entry.scenario.difficulty,
      counterpart: entry.scenario.counterpart,
      openingLine: entry.scenario.openingLine,
      rubric: entry.scenario.rubric,
    })),
  })));
}

export function academyTrainerEvalPlanFingerprint(plan = []) {
  const manifest = academyTrainerEvalPlanManifest(plan);
  if (manifest.length !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) return null;
  return hash(canonicalJson(manifest));
}

export function studyEvalRequest(entry) {
  return {
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    activity: 'study',
    phase: 'study',
    difficulty: 'advanced',
    memory: evaluationMemory(),
    messages: [{
      role: 'user',
      content: `Vysvětli mi odborný princip části „${entry.item.title}“ vlastními slovy, ukaž jeden konkrétní příklad použití v roli ${entry.profile.studentRole} a nakonec jednou otázkou ověř moje pochopení.`,
    }],
  };
}

export function simulationEvalRequest(entry) {
  return {
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    activity: 'simulation',
    phase: 'roleplay',
    difficulty: 'advanced',
    memory: evaluationMemory(),
    messages: [{
      role: 'user',
      content: 'Než se rozhodneme, co dál: co je v této situaci pro tebe nejdůležitější a jaká konkrétní fakta už máš?',
    }],
  };
}

export function debriefEvalRequest(entry, simulationText) {
  const studentText = simulationEvalRequest(entry).messages[0].content;
  return {
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    activity: 'simulation',
    phase: 'debrief',
    difficulty: 'advanced',
    memory: evaluationMemory(),
    messages: [
      { role: 'user', content: studentText },
      { role: 'assistant', content: String(simulationText || '') },
      { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik pouze podle přepisu.' },
    ],
  };
}

export function evaluateTrainerStudy(entry, payload, request) {
  const deterministic = assessStudyResponse(payload?.text, {
    messages: request.messages,
    course: entry.course,
    item: entry.item,
  });
  return finishCase(entry, 'study', payload, [
    check('real-model-provider', realProvider(payload?.provider)),
    check('study-mode', payload?.mode === entry.expectedStudyMode),
    check('study-phase', payload?.activity === 'study' && payload?.phase === 'study'),
    check('server-quality-gate', payload?.qualityGate?.pass === true),
    check('lesson-grounding', deterministic.pass, deterministic.issues),
    check('substantive-explanation', wordCount(payload?.text) >= 45),
    check('one-checking-question', questionCount(payload?.text) === 1),
  ]);
}

export function evaluateTrainerSimulation(entry, payload, request = simulationEvalRequest(entry)) {
  const deterministic = assessRoleplayResponse(payload?.text, {
    scenario: entry.scenario,
    messages: request?.messages || [],
  });
  const issueSet = new Set(deterministic.issues);
  return finishCase(entry, 'simulation', payload, [
    check('real-model-provider', realProvider(payload?.provider)),
    check('simulation-mode', payload?.mode === entry.expectedSimulationMode),
    check('roleplay-phase', payload?.activity === 'simulation' && payload?.phase === 'roleplay'),
    check('server-quality-gate', payload?.qualityGate?.pass === true),
    check('counterpart-role-integrity', ![
      'empty',
      'too_long_for_counterpart',
      'list_or_heading',
      'role_break',
      'trainer_advice_leak',
      'trailing_fragment',
      'response_language_mismatch',
      'counterpart_voice_missing',
    ].some(issue => issueSet.has(issue)), deterministic.issues),
    check('scenario-fidelity', !issueSet.has('scenario_fidelity_missing'), deterministic.issues),
    check('specific-target-behavior', ![
      'generic_counterpart_turn',
      'target_behavior_missing',
    ].some(issue => issueSet.has(issue)), deterministic.issues),
    check('natural-counterpart-turn', wordCount(payload?.text) >= 4 && wordCount(payload?.text) <= 120),
  ]);
}

export function evaluateTrainerDebrief(entry, payload, request) {
  const deterministic = assessDebriefResponse(payload?.text, {
    messages: request.messages,
    rubric: entry.scenario.rubric,
    courseId: entry.course.id,
  });
  const issueSet = new Set(deterministic.issues);
  const achievementRows = Array.isArray(payload?.achievement?.rows) ? payload.achievement.rows : [];
  return finishCase(entry, 'debrief', payload, [
    check('real-model-provider', realProvider(payload?.provider)),
    check('debrief-mode', payload?.mode === entry.expectedSimulationMode),
    check('debrief-phase', payload?.activity === 'simulation' && payload?.phase === 'debrief'),
    check('server-quality-gate', payload?.qualityGate?.pass === true),
    check('evidence-grounded-debrief', deterministic.pass, deterministic.issues),
    check('evidence-grounded-priority-correction', ![
      'empty_improvement',
      'improvement_missing_priority',
      'improvement_not_evidence_grounded',
      'all_not_proven_without_actionable_debrief',
    ].some(issue => issueSet.has(issue)), deterministic.issues),
    check('useful-improved-formulation', ![
      'empty_better_formulation',
      'better_formulation_not_usable',
    ].some(issue => issueSet.has(issue)), deterministic.issues),
    check('targeted-retry', ![
      'empty_next_attempt',
      'next_attempt_not_targeted',
    ].some(issue => issueSet.has(issue)), deterministic.issues),
    check('complete-course-rubric', achievementRows.length === entry.scenario.rubric.length),
    check('no-missing-rubric-status', achievementRows.length > 0 && achievementRows.every(row => row.status !== 'missing')),
  ]);
}

export function summarizeAcademyTrainerEval(results = [], {
  baseUrl = '', startedAt = '', completedAt = '', plan = null,
} = {}) {
  const ordered = canonicalResultOrder(results, plan);
  const passed = ordered.filter(result => result.pass === true).length;
  const failed = ordered.length - passed;
  const courses = [...new Set(ordered.map(result => result.courseId))];
  const byType = Object.fromEntries(ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => {
    const cases = ordered.filter(result => result.type === type);
    const typePassed = cases.filter(result => result.pass === true).length;
    return [type, { total: cases.length, passed: typePassed, failed: cases.length - typePassed }];
  }));
  const passRate = ordered.length ? Number((passed / ordered.length * 100).toFixed(2)) : 0;
  const expectedIds = Array.isArray(plan) ? academyTrainerEvalPlanManifest(plan).map(item => item.id) : [];
  const exactPlan = expectedIds.length === ACADEMY_TRAINER_EVAL_STANDARD.requiredCases
    && sameOrderedStrings(ordered.map(result => result?.id), expectedIds);
  return {
    standardId: ACADEMY_TRAINER_EVAL_STANDARD.id,
    standardVersion: ACADEMY_TRAINER_EVAL_STANDARD.version,
    resultSchemaId: ACADEMY_TRAINER_EVAL_STANDARD.resultSchemaId,
    startedAt,
    completedAt,
    baseUrl: normalizeBaseUrl(baseUrl),
    liveModelCalls: true,
    privacy: 'Výstupy ani vstupy konverzací se neukládají; report obsahuje jen kontrolní výsledky, délku a otisk odpovědi.',
    summary: {
      courseCount: courses.length,
      total: ordered.length,
      passed,
      failed,
      passRate,
      complete: courses.length === ACADEMY_TRAINER_EVAL_STANDARD.courseCount
        && ordered.length === ACADEMY_TRAINER_EVAL_STANDARD.requiredCases
        && failed === 0
        && passRate === ACADEMY_TRAINER_EVAL_STANDARD.requiredPassRate
        && exactPlan,
    },
    byType,
    results: ordered,
  };
}

export function assessAcademyTrainerBaselineEligibility(report, {
  plan = null,
  runtimeClaimSecret = '',
} = {}) {
  const reasons = [];
  const run = report?.run || {};
  const provenance = report?.provenance || {};
  const modelIds = provenance.modelIds || {};
  const observedByType = modelIds.observedByType || {};
  const deployment = provenance.deployment || {};
  const results = Array.isArray(report?.results) ? report.results : [];
  const runId = String(run.id || '');
  const planManifest = Array.isArray(plan) ? academyTrainerEvalPlanManifest(plan) : [];
  const expectedIds = planManifest.map(item => item.id);
  const observedIds = results.map(result => String(result?.id || ''));

  if (report?.standardId !== ACADEMY_TRAINER_EVAL_STANDARD.id) reasons.push('standard-id-mismatch');
  if (Number(report?.standardVersion) !== ACADEMY_TRAINER_EVAL_STANDARD.version) {
    reasons.push('standard-version-mismatch');
  }
  if (report?.resultSchemaId !== ACADEMY_TRAINER_EVAL_STANDARD.resultSchemaId) reasons.push('result-schema-id-mismatch');
  if (planManifest.length !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) reasons.push('canonical-plan-required');
  if (report?.summary?.complete !== true) reasons.push('incomplete-81-case-result');
  if (run.resumedFrom) reasons.push('resumed-run-cannot-release');
  if (Number(run.freshCases) !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) {
    reasons.push('all-cases-must-be-fresh');
  }
  if (Number(run.reusedCases ?? run.reusedPassedCases) !== 0) reasons.push('reused-cases-present');
  if (Number(run.attemptedCases) !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) {
    reasons.push('all-cases-must-be-attempted-in-run');
  }
  if (!runId || provenance.runId !== runId) reasons.push('run-id-missing-or-mismatched');
  if (results.length !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases
    || results.some(result => result.evaluationRunId !== runId)) {
    reasons.push('results-not-bound-to-current-run');
  }
  if (new Set(observedIds).size !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) {
    reasons.push('result-identities-not-unique');
  }
  if (!sameOrderedStrings(observedIds, expectedIds)) reasons.push('result-identities-not-exact-canonical-plan');
  for (const expected of planManifest) {
    const result = results.find(item => item?.id === expected.id);
    const configuredProvider = String(modelIds[expected.type] || '');
    if (!academyTrainerCaseResultIntegrity(result, expected, runId, configuredProvider)) {
      reasons.push(`case-result-integrity-${expected.id}`);
    }
  }

  const recomputed = summarizeAcademyTrainerEval(results, {
    baseUrl: report?.baseUrl,
    startedAt: report?.startedAt,
    completedAt: report?.completedAt,
    plan,
  });
  if (canonicalJson(report?.summary) !== canonicalJson(recomputed.summary)) {
    reasons.push('summary-not-recomputed-from-results');
  }
  if (canonicalJson(report?.byType) !== canonicalJson(recomputed.byType)) {
    reasons.push('by-type-not-recomputed-from-results');
  }
  const recomputedObservedByType = Object.fromEntries(ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => [
    type,
    [...new Set(results.filter(result => result?.type === type).map(result => result?.provider).filter(Boolean))].sort(),
  ]));
  if (canonicalJson(observedByType) !== canonicalJson(recomputedObservedByType)) {
    reasons.push('observed-models-not-recomputed-from-results');
  }
  const responseFingerprints = results.map(result => String(result?.responseFingerprint || ''));
  if (responseFingerprints.some(value => !SHA256.test(value))
    || new Set(responseFingerprints).size !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) {
    reasons.push('response-fingerprints-missing-or-reused');
  }

  if (!SEMVER.test(String(provenance.appVersion || ''))) {
    reasons.push('app-version-missing-or-invalid');
  }
  if (!/^[a-f0-9]{40}$/iu.test(String(provenance.gitCommitSha || ''))) {
    reasons.push('git-commit-missing');
  }
  if (provenance.gitDirty !== false) reasons.push('git-worktree-must-be-clean');
  for (const [field, reason] of [
    ['applicationFingerprint', 'application-fingerprint-missing'],
    ['promptSystemFingerprint', 'prompt-system-fingerprint-missing'],
    ['evaluationCodeFingerprint', 'evaluation-code-fingerprint-missing'],
    ['evalPlanFingerprint', 'eval-plan-fingerprint-missing'],
  ]) {
    if (!SHA256.test(String(provenance[field] || ''))) reasons.push(reason);
  }
  if (provenance.evalPlanFingerprint !== academyTrainerEvalPlanFingerprint(plan)) {
    reasons.push('eval-plan-not-canonical');
  }
  const startedAt = strictIsoTimestamp(report?.startedAt);
  const completedAt = strictIsoTimestamp(report?.completedAt);
  const generatedAt = strictIsoTimestamp(provenance.generatedAt);
  if (!startedAt || !completedAt || !generatedAt
    || generatedAt !== startedAt
    || Date.parse(completedAt) < Date.parse(startedAt)) {
    reasons.push('release-timestamps-invalid');
  }
  const normalizedBaseUrl = normalizeBaseUrl(report?.baseUrl);
  if (!deployment.identity
    || normalizeBaseUrl(deployment.baseUrl) !== normalizedBaseUrl
    || deployment.gitCommitSha !== provenance.gitCommitSha
    || deployment.runtimeClaimFingerprint !== academyTrainerRuntimeClaimFingerprint(deployment.runtimeClaim)
    || !academyTrainerRuntimeClaimValid(deployment.runtimeClaim, {
      secret: runtimeClaimSecret,
      expectedBaseUrl: normalizedBaseUrl,
      expectedAppVersion: provenance.appVersion,
      expectedGitCommitSha: provenance.gitCommitSha,
      expectedModels: {
        study: modelIds.study,
        simulation: modelIds.simulation,
        debrief: modelIds.debrief,
      },
      expectedFingerprints: provenance,
    })) {
    reasons.push('deployment-identity-missing-or-mismatched');
  }
  if (provenance.authentication?.releaseEvalTokenUsed !== true
    || provenance.authentication?.memberJwtUsed !== false
    || provenance.authentication?.runtimeClaimVerified !== true) {
    reasons.push('release-evaluation-authentication-not-proven');
  }
  if (results.some(result => result?.releaseEvaluation?.isolated !== true
    || result.releaseEvaluation.memberUsageCharged !== false
    || result.releaseEvaluation.passportPersisted !== false
    || result.releaseEvaluation.certificateEvidencePersisted !== false
    || result.releaseEvaluation.courseMasteryPersisted !== false
    || result.releaseEvaluation.suite !== 'academy-trainers'
    || result.releaseEvaluation.runId !== runId
    || result.releaseEvaluation.caseId !== result.id
    || result.releaseEvaluation.runtimeClaimFingerprint !== deployment.runtimeClaimFingerprint)) {
    reasons.push('release-evaluation-isolation-not-proven');
  }

  for (const type of ACADEMY_TRAINER_EVAL_STANDARD.caseTypes) {
    const configured = String(modelIds[type] || '');
    const observed = Array.isArray(observedByType[type]) ? observedByType[type] : [];
    if (!configured || observed.length !== 1 || observed[0] !== configured) {
      reasons.push(`model-provenance-${type}-mismatch`);
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

export function academyTrainerReleaseBaseline(report, options = {}) {
  const eligibility = assessAcademyTrainerBaselineEligibility(report, options);
  if (!eligibility.eligible) {
    throw new Error(`Academy trainer baseline nelze zapsat: ${eligibility.reasons.join(', ')}.`);
  }
  const evidence = academyTrainerReleaseEvidence(report);
  return {
    standardId: ACADEMY_TRAINER_EVAL_STANDARD.id,
    standardVersion: ACADEMY_TRAINER_EVAL_STANDARD.version,
    resultSchemaId: ACADEMY_TRAINER_EVAL_STANDARD.resultSchemaId,
    verifiedAt: report?.completedAt || null,
    baseUrl: report?.baseUrl || null,
    courseCount: Number(report?.summary?.courseCount || 0),
    caseCount: Number(report?.summary?.total || 0),
    passedCases: Number(report?.summary?.passed || 0),
    failedCases: Number(report?.summary?.failed || 0),
    passRate: Number(report?.summary?.passRate || 0),
    complete: report?.summary?.complete === true,
    runId: report.run.id,
    provenance: report.provenance,
    evidenceDigest: academyTrainerReleaseEvidenceDigest(evidence),
    outcomeAttestation: options.outcomeAttestation || null,
    evidence,
  };
}

export function academyTrainerReleaseEvidenceDigest(evidence) {
  return hash(canonicalJson(evidence));
}

export function academyTrainerReleaseArtifactValid(artifact, {
  plan = null,
  expectedFingerprints = null,
  expectedAppVersion = '',
  expectedModels = null,
  runtimeClaimSecret = '',
  outcomeAttestationSecret = '',
} = {}) {
  if (Buffer.byteLength(String(runtimeClaimSecret || ''), 'utf8') < 32
    || Buffer.byteLength(String(outcomeAttestationSecret || ''), 'utf8') < 32
    || String(runtimeClaimSecret) === String(outcomeAttestationSecret)) return false;
  const evidence = artifact?.evidence;
  const provenance = artifact?.provenance || {};
  const currentPlanFingerprint = academyTrainerEvalPlanFingerprint(plan);
  const evidenceValid = evidence
    && artifact?.evidenceDigest === academyTrainerReleaseEvidenceDigest(evidence)
    && evidence?.run?.id === artifact?.runId
    && evidence?.completedAt === artifact?.verifiedAt
    && evidence?.baseUrl === artifact?.baseUrl
    && canonicalJson(evidence?.provenance) === canonicalJson(provenance)
    && assessAcademyTrainerBaselineEligibility(evidence, { plan, runtimeClaimSecret }).eligible
    && academyTrainerReportReceiptsValid(evidence, { secret: outcomeAttestationSecret });
  const currentFingerprintsMatch = expectedFingerprints
    && FINGERPRINT_FIELDS.every(field => (
      SHA256.test(String(provenance[field] || ''))
      && provenance[field] === expectedFingerprints[field]
    ));
  const configuredModels = provenance?.modelIds || {};
  const modelsMatch = expectedModels
    && ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.every(type => (
      String(configuredModels[type] || '') === String(expectedModels[type] || '')
    ));
  const outcomeAttestationValid = academyTrainerOutcomeAttestationValid(artifact?.outcomeAttestation, {
    secret: outcomeAttestationSecret,
    expectedEvidenceDigest: artifact?.evidenceDigest,
    expectedRuntimeClaimFingerprint: academyTrainerRuntimeClaimFingerprint(provenance?.deployment?.runtimeClaim),
    expectedRunId: artifact?.runId,
  });
  return artifact?.standardId === ACADEMY_TRAINER_EVAL_STANDARD.id
    && Number(artifact?.standardVersion) === ACADEMY_TRAINER_EVAL_STANDARD.version
    && artifact?.resultSchemaId === ACADEMY_TRAINER_EVAL_STANDARD.resultSchemaId
    && artifact?.complete === true
    && Number(artifact?.courseCount) === ACADEMY_TRAINER_EVAL_STANDARD.courseCount
    && Number(artifact?.caseCount) === ACADEMY_TRAINER_EVAL_STANDARD.requiredCases
    && Number(artifact?.passedCases) === ACADEMY_TRAINER_EVAL_STANDARD.requiredCases
    && Number(artifact?.failedCases) === 0
    && Number(artifact?.passRate) === ACADEMY_TRAINER_EVAL_STANDARD.requiredPassRate
    && Boolean(artifact?.runId)
    && Boolean(evidenceValid)
    && outcomeAttestationValid
    && Boolean(currentFingerprintsMatch)
    && Boolean(modelsMatch)
    && SEMVER.test(String(expectedAppVersion || ''))
    && provenance.appVersion === String(expectedAppVersion)
    && provenance.evalPlanFingerprint === currentPlanFingerprint;
}

export function createAcademyTrainerRuntimeClaim({
  baseUrl,
  appVersion,
  gitCommitSha,
  modelIds,
  fingerprints,
  secret = process.env.ELITEA_RELEASE_EVAL_SECRET,
  env = process.env,
  now = Date.now(),
} = {}) {
  if (Buffer.byteLength(String(secret || ''), 'utf8') < 32
    || !SEMVER.test(String(appVersion || ''))
    || !/^[a-f0-9]{40}$/iu.test(String(gitCommitSha || ''))
    || !validModelManifest(modelIds)
    || !validFingerprintManifest(fingerprints)) return null;
  const descriptor = academyRuntimeDeploymentDescriptor({ baseUrl, gitCommitSha, env });
  if (!descriptor) return null;
  const unsigned = {
    schemaId: ACADEMY_TRAINER_EVAL_STANDARD.runtimeClaimSchemaId,
    provider: descriptor.provider,
    deploymentUrl: descriptor.deploymentUrl,
    identity: descriptor.identity,
    deploymentId: descriptor.deploymentId,
    gitCommitSha: String(gitCommitSha),
    appVersion: String(appVersion),
    modelIds: normalizedModelManifest(modelIds),
    fingerprints: normalizedFingerprintManifest(fingerprints),
    issuedAt: new Date(now).toISOString(),
  };
  return { ...unsigned, signature: signAcademyRuntimeClaim(unsigned, secret) };
}

export function academyTrainerRuntimeClaimValid(claim, {
  secret = process.env.ELITEA_RELEASE_EVAL_SECRET,
  expectedBaseUrl = '',
  expectedAppVersion = '',
  expectedGitCommitSha = '',
  expectedModels = null,
  expectedFingerprints = null,
  now = Date.now(),
} = {}) {
  if (!claim || claim.schemaId !== ACADEMY_TRAINER_EVAL_STANDARD.runtimeClaimSchemaId
    || Buffer.byteLength(String(secret || ''), 'utf8') < 32
    || !strictIsoTimestamp(claim.issuedAt)
    || Date.parse(claim.issuedAt) > Number(now) + 300_000
    || !safeHexEqual(claim.signature, signAcademyRuntimeClaim(claim, secret))) return false;
  const exactBaseUrl = normalizeBaseUrl(expectedBaseUrl);
  if (!exactBaseUrl || normalizeBaseUrl(claim.deploymentUrl) !== exactBaseUrl) return false;
  if (claim.appVersion !== String(expectedAppVersion || '')
    || claim.gitCommitSha !== String(expectedGitCommitSha || '')
    || !sameModelManifest(claim.modelIds, expectedModels)
    || !sameFingerprintManifest(claim.fingerprints, expectedFingerprints)) return false;
  return academyRuntimeIdentityMatches(claim);
}

export function academyTrainerRuntimeClaimFingerprint(claim) {
  if (!claim || typeof claim !== 'object') return null;
  return hash(canonicalJson(claim));
}

export function createAcademyTrainerOutcomeAttestation({
  report,
  plan,
  runtimeClaimSecret = process.env.ELITEA_RELEASE_EVAL_SECRET,
  secret = process.env.ELITEA_RELEASE_ATTESTATION_SECRET,
  now = Date.now(),
} = {}) {
  if (Buffer.byteLength(String(secret || ''), 'utf8') < 32
    || String(secret) === String(runtimeClaimSecret || '')
    || !assessAcademyTrainerBaselineEligibility(report, { plan, runtimeClaimSecret }).eligible
    || !academyTrainerReportReceiptsValid(report, { secret })) return null;
  const evidence = academyTrainerReleaseEvidence(report);
  const unsigned = {
    schemaId: ACADEMY_TRAINER_EVAL_STANDARD.outcomeAttestationSchemaId,
    standardId: ACADEMY_TRAINER_EVAL_STANDARD.id,
    standardVersion: ACADEMY_TRAINER_EVAL_STANDARD.version,
    runId: String(report?.run?.id || ''),
    evidenceDigest: academyTrainerReleaseEvidenceDigest(evidence),
    runtimeClaimFingerprint: academyTrainerRuntimeClaimFingerprint(report?.provenance?.deployment?.runtimeClaim),
    issuedAt: new Date(now).toISOString(),
  };
  return { ...unsigned, signature: signAcademyOutcomeAttestation(unsigned, secret) };
}

/**
 * Server-only proof that the response and the deterministic Academy verdict
 * really came from the evaluated deployment. The runner may inspect and store
 * this receipt, but cannot mint or alter it without the independent
 * attestation secret.
 */
export function createAcademyTrainerCaseReceipt({
  runId,
  caseId,
  type,
  stepId,
  runtimeClaimFingerprint,
  requestFingerprint,
  responseText,
  evaluation,
  secret = process.env.ELITEA_RELEASE_ATTESTATION_SECRET,
  now = Date.now(),
} = {}) {
  const responseHash = responseFingerprint(responseText);
  const checksFingerprint = hash(canonicalJson(evaluation?.checks || []));
  const qualityGateFingerprint = hash(canonicalJson(evaluation?.qualityGate || {}));
  const unsigned = {
    schemaId: ACADEMY_TRAINER_EVAL_STANDARD.caseReceiptSchemaId,
    standardId: ACADEMY_TRAINER_EVAL_STANDARD.id,
    standardVersion: ACADEMY_TRAINER_EVAL_STANDARD.version,
    runId: String(runId || ''),
    caseId: String(caseId || ''),
    type: String(type || ''),
    stepId: String(stepId || ''),
    runtimeClaimFingerprint: String(runtimeClaimFingerprint || ''),
    requestFingerprint: String(requestFingerprint || ''),
    responseFingerprint: responseHash,
    responseWords: Number(evaluation?.responseWords),
    provider: String(evaluation?.provider || ''),
    pass: evaluation?.pass === true,
    checksFingerprint,
    qualityGateFingerprint,
    issuedAt: new Date(now).toISOString(),
  };
  if (Buffer.byteLength(String(secret || ''), 'utf8') < 32
    || !CODE_ID.test(unsigned.runId)
    || !CODE_ID.test(unsigned.caseId)
    || !ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.includes(unsigned.type)
    || !CODE_ID.test(unsigned.stepId)
    || !SHA256.test(unsigned.runtimeClaimFingerprint)
    || !SHA256.test(unsigned.requestFingerprint)
    || !SHA256.test(unsigned.responseFingerprint)
    || !Number.isInteger(unsigned.responseWords)
    || !realProvider(unsigned.provider)
    || !strictIsoTimestamp(unsigned.issuedAt)) return null;
  return { ...unsigned, signature: signAcademyCaseReceipt(unsigned, secret) };
}

export function academyTrainerCaseReceiptValid(receipt, {
  result = null,
  secret = process.env.ELITEA_RELEASE_ATTESTATION_SECRET,
  now = Date.now(),
} = {}) {
  if (!receipt || Buffer.byteLength(String(secret || ''), 'utf8') < 32
    || receipt.schemaId !== ACADEMY_TRAINER_EVAL_STANDARD.caseReceiptSchemaId
    || receipt.standardId !== ACADEMY_TRAINER_EVAL_STANDARD.id
    || Number(receipt.standardVersion) !== ACADEMY_TRAINER_EVAL_STANDARD.version
    || !CODE_ID.test(String(receipt.runId || ''))
    || !CODE_ID.test(String(receipt.caseId || ''))
    || !ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.includes(String(receipt.type || ''))
    || !CODE_ID.test(String(receipt.stepId || ''))
    || !SHA256.test(String(receipt.runtimeClaimFingerprint || ''))
    || !SHA256.test(String(receipt.requestFingerprint || ''))
    || !SHA256.test(String(receipt.responseFingerprint || ''))
    || !SHA256.test(String(receipt.checksFingerprint || ''))
    || !SHA256.test(String(receipt.qualityGateFingerprint || ''))
    || !Number.isInteger(Number(receipt.responseWords))
    || !realProvider(receipt.provider)
    || !strictIsoTimestamp(receipt.issuedAt)
    || Date.parse(receipt.issuedAt) > Number(now) + 300_000
    || !safeHexEqual(receipt.signature, signAcademyCaseReceipt(receipt, secret))) return false;
  if (!result) return true;
  return receipt.runId === String(result.evaluationRunId || '')
    && receipt.caseId === String(result.id || '')
    && receipt.type === String(result.type || '')
    && receipt.stepId === String(result.releaseEvaluation?.stepId || '')
    && receipt.runtimeClaimFingerprint === String(result.releaseEvaluation?.runtimeClaimFingerprint || '')
    && receipt.responseFingerprint === String(result.responseFingerprint || '')
    && Number(receipt.responseWords) === Number(result.responseWords)
    && receipt.provider === String(result.provider || '')
    && receipt.pass === (result.pass === true)
    && receipt.checksFingerprint === hash(canonicalJson(result.checks || []))
    && receipt.qualityGateFingerprint === hash(canonicalJson(result.qualityGate || {}));
}

export function academyTrainerOutcomeAttestationValid(attestation, {
  secret = process.env.ELITEA_RELEASE_ATTESTATION_SECRET,
  expectedEvidenceDigest = '',
  expectedRuntimeClaimFingerprint = '',
  expectedRunId = '',
  now = Date.now(),
} = {}) {
  return Buffer.byteLength(String(secret || ''), 'utf8') >= 32
    && attestation?.schemaId === ACADEMY_TRAINER_EVAL_STANDARD.outcomeAttestationSchemaId
    && attestation?.standardId === ACADEMY_TRAINER_EVAL_STANDARD.id
    && Number(attestation?.standardVersion) === ACADEMY_TRAINER_EVAL_STANDARD.version
    && attestation?.runId === String(expectedRunId || '')
    && attestation?.evidenceDigest === String(expectedEvidenceDigest || '')
    && attestation?.runtimeClaimFingerprint === String(expectedRuntimeClaimFingerprint || '')
    && SHA256.test(String(attestation?.evidenceDigest || ''))
    && SHA256.test(String(attestation?.runtimeClaimFingerprint || ''))
    && Boolean(strictIsoTimestamp(attestation?.issuedAt))
    && Date.parse(attestation.issuedAt) <= Number(now) + 300_000
    && safeHexEqual(attestation?.signature, signAcademyOutcomeAttestation(attestation, secret));
}

function academyTrainerReleaseEvidence(report) {
  return {
    standardId: report.standardId,
    standardVersion: report.standardVersion,
    resultSchemaId: report.resultSchemaId,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    baseUrl: report.baseUrl,
    liveModelCalls: report.liveModelCalls === true,
    summary: report.summary,
    byType: report.byType,
    run: report.run,
    provenance: report.provenance,
    results: report.results,
  };
}

function academyTrainerReportReceiptsValid(report, { secret } = {}) {
  const results = Array.isArray(report?.results) ? report.results : [];
  return results.length === ACADEMY_TRAINER_EVAL_STANDARD.requiredCases
    && results.every(result => academyTrainerCaseReceiptValid(result?.releaseReceipt, { result, secret }));
}

function academyTrainerCaseResultIntegrity(result, expected, runId, configuredProvider) {
  if (!result || !expected) return false;
  const bounds = ACADEMY_TRAINER_EVAL_STANDARD.responseWordBounds[expected.type];
  const release = result.releaseEvaluation || {};
  const receipt = result.releaseReceipt || {};
  return result.standardId === ACADEMY_TRAINER_EVAL_STANDARD.resultSchemaId
    && result.id === expected.id
    && result.courseId === expected.courseId
    && result.courseSlug === expected.courseSlug
    && result.courseTitle === expected.courseTitle
    && result.itemId === expected.itemId
    && result.itemTitle === expected.itemTitle
    && result.trainer === expected.trainer
    && result.type === expected.type
    && (result.scenarioId ?? null) === expected.scenarioId
    && result.evaluationRunId === runId
    && Number(result.attempts) === 1
    && result.pass === true
    && exactPassingChecks(result.checks, RESULT_CHECK_NAMES[expected.type])
    && realProvider(result.provider)
    && result.provider === configuredProvider
    && result.qualityGate?.pass === true
    && Number.isInteger(result.responseWords)
    && result.responseWords >= bounds.min
    && result.responseWords <= bounds.max
    && SHA256.test(String(result.responseFingerprint || ''))
    && release.suite === 'academy-trainers'
    && release.runId === runId
    && release.caseId === expected.id
    && release.stepId === ({ study: 'study', simulation: 'roleplay-1', debrief: 'debrief' })[expected.type]
    && SHA256.test(String(release.runtimeClaimFingerprint || ''))
    && release.isolated === true
    && release.memberUsageCharged === false
    && release.passportPersisted === false
    && release.certificateEvidencePersisted === false
    && release.courseMasteryPersisted === false
    && receipt.schemaId === ACADEMY_TRAINER_EVAL_STANDARD.caseReceiptSchemaId
    && receipt.standardId === ACADEMY_TRAINER_EVAL_STANDARD.id
    && Number(receipt.standardVersion) === ACADEMY_TRAINER_EVAL_STANDARD.version
    && receipt.runId === runId
    && receipt.caseId === expected.id
    && receipt.type === expected.type
    && receipt.stepId === release.stepId
    && receipt.runtimeClaimFingerprint === release.runtimeClaimFingerprint
    && SHA256.test(String(receipt.requestFingerprint || ''))
    && receipt.responseFingerprint === result.responseFingerprint
    && Number(receipt.responseWords) === Number(result.responseWords)
    && receipt.provider === result.provider
    && receipt.pass === true
    && receipt.checksFingerprint === hash(canonicalJson(result.checks || []))
    && receipt.qualityGateFingerprint === hash(canonicalJson(result.qualityGate || {}))
    && Boolean(strictIsoTimestamp(receipt.issuedAt))
    && SHA256.test(String(receipt.signature || ''));
}

function exactPassingChecks(checks, expectedNames) {
  if (!Array.isArray(checks) || checks.some(item => item?.pass !== true)) return false;
  return sameStringSet(checks.map(item => item?.name), expectedNames);
}

function canonicalResultOrder(results, plan) {
  const rows = Array.isArray(results) ? [...results] : [];
  if (!Array.isArray(plan)) return rows;
  const positions = new Map(academyTrainerEvalPlanManifest(plan).map((entry, index) => [entry.id, index]));
  return rows.sort((left, right) => (
    (positions.get(left?.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right?.id) ?? Number.MAX_SAFE_INTEGER)
  ));
}

function evaluationMemory() {
  return {
    identity_preferences: { preferred_name: 'Eval', address_form: 'tykani' },
    business_context: { stage: 'test', industry: 'ověřovací scénář Elitea Academy' },
    coaching_profile: { support_accommodations: 'Jedna jasná otázka nebo jeden ověřovací krok.' },
  };
}

function finishCase(entry, type, payload, checks) {
  return {
    standardId: ACADEMY_TRAINER_EVAL_STANDARD.resultSchemaId,
    id: `${entry.course.id}:${type}`,
    courseId: entry.course.id,
    courseSlug: entry.course.slug,
    courseTitle: entry.course.title,
    trainer: entry.profile.label,
    itemId: entry.item.id,
    itemTitle: entry.item.title,
    type,
    scenarioId: type === 'study' ? null : entry.scenario.id,
    pass: checks.every(item => item.pass),
    checks,
    provider: String(payload?.provider || '') || null,
    qualityGate: sanitizeQualityGate(payload?.qualityGate),
    releaseEvaluation: sanitizeAcademyReleaseEvaluation(payload?.releaseEvaluation),
    releaseReceipt: sanitizeAcademyCaseReceipt(payload?.releaseReceipt),
    responseWords: wordCount(payload?.text),
    responseFingerprint: responseFingerprint(payload?.text),
  };
}

function check(name, pass, detail = []) {
  return { name, pass: Boolean(pass), ...(Array.isArray(detail) && detail.length ? { detail } : {}) };
}

function realProvider(provider) {
  const value = String(provider || '').trim();
  return value.length >= 3 && !DISALLOWED_PROVIDERS.test(value);
}

function questionCount(value) {
  return (String(value || '').match(/\?/gu) || []).length;
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean).length;
}

function responseFingerprint(value) {
  return hash(String(value || ''));
}

function sanitizeQualityGate(input) {
  return {
    pass: input?.pass === true,
    repaired: input?.repaired === true,
    issueCodes: (Array.isArray(input?.issueCodes) ? input.issueCodes : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .slice(0, 40),
  };
}

function sanitizeAcademyReleaseEvaluation(input) {
  return {
    suite: String(input?.suite || ''),
    runId: String(input?.runId || ''),
    caseId: String(input?.caseId || ''),
    stepId: String(input?.stepId || ''),
    runtimeClaimFingerprint: String(input?.runtimeClaimFingerprint || ''),
    isolated: input?.isolated === true,
    memberUsageCharged: input?.memberUsageCharged === true,
    passportPersisted: input?.passportPersisted === true,
    certificateEvidencePersisted: input?.certificateEvidencePersisted === true,
    courseMasteryPersisted: input?.courseMasteryPersisted === true,
  };
}

function sanitizeAcademyCaseReceipt(input) {
  if (!input || typeof input !== 'object') return null;
  return {
    schemaId: String(input.schemaId || ''),
    standardId: String(input.standardId || ''),
    standardVersion: Number(input.standardVersion),
    runId: String(input.runId || ''),
    caseId: String(input.caseId || ''),
    type: String(input.type || ''),
    stepId: String(input.stepId || ''),
    runtimeClaimFingerprint: String(input.runtimeClaimFingerprint || ''),
    requestFingerprint: String(input.requestFingerprint || ''),
    responseFingerprint: String(input.responseFingerprint || ''),
    responseWords: Number(input.responseWords),
    provider: String(input.provider || ''),
    pass: input.pass === true,
    checksFingerprint: String(input.checksFingerprint || ''),
    qualityGateFingerprint: String(input.qualityGateFingerprint || ''),
    issuedAt: String(input.issuedAt || ''),
    signature: String(input.signature || ''),
  };
}

function academyRuntimeDeploymentDescriptor({ baseUrl, gitCommitSha, env }) {
  if (String(env?.VERCEL || '') === '1') {
    const hostname = String(env?.VERCEL_URL || '').trim().toLowerCase()
      .replace(/^https?:\/\//u, '').replace(/\/+$/u, '');
    const immutableDeploymentUrl = normalizeBaseUrl(hostname ? `https://${hostname}` : '');
    if (!immutableDeploymentUrl || !hostname.endsWith('.vercel.app')) return null;
    const deploymentId = String(env?.VERCEL_DEPLOYMENT_ID || '').trim() || null;
    const requestedBaseUrl = normalizeBaseUrl(baseUrl);
    const requestedUrl = requestedBaseUrl ? new URL(requestedBaseUrl) : null;
    const deploymentUrl = deploymentId
      && requestedUrl?.protocol === 'https:'
      && !['localhost', '127.0.0.1', '::1'].includes(requestedUrl.hostname.toLowerCase())
      ? requestedBaseUrl
      : immutableDeploymentUrl;
    return {
      provider: 'vercel',
      deploymentUrl,
      deploymentId,
      identity: deploymentId ? `vercel:${deploymentId}` : `vercel-url:${hostname}`,
    };
  }
  const deploymentUrl = normalizeBaseUrl(baseUrl);
  if (!deploymentUrl) return null;
  const hostname = new URL(deploymentUrl).hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return null;
  return {
    provider: 'local',
    deploymentUrl,
    deploymentId: null,
    identity: `local:${String(gitCommitSha || '')}`,
  };
}

function academyRuntimeIdentityMatches(claim) {
  const deploymentUrl = normalizeBaseUrl(claim?.deploymentUrl);
  if (!deploymentUrl) return false;
  const hostname = new URL(deploymentUrl).hostname.toLowerCase();
  const identity = String(claim?.identity || '');
  const deploymentId = String(claim?.deploymentId || '');
  if (claim?.provider === 'local') {
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
      && !deploymentId
      && identity === `local:${String(claim?.gitCommitSha || '')}`;
  }
  if (claim?.provider !== 'vercel' || new URL(deploymentUrl).protocol !== 'https:') return false;
  if (deploymentId) return identity === `vercel:${deploymentId}`;
  return hostname.endsWith('.vercel.app') && identity === `vercel-url:${hostname}`;
}

function academyRuntimeClaimUnsigned(value) {
  return {
    schemaId: value?.schemaId,
    provider: value?.provider,
    deploymentUrl: value?.deploymentUrl,
    identity: value?.identity,
    deploymentId: value?.deploymentId ?? null,
    gitCommitSha: value?.gitCommitSha,
    appVersion: value?.appVersion,
    modelIds: value?.modelIds,
    fingerprints: value?.fingerprints,
    issuedAt: value?.issuedAt,
  };
}

function signAcademyRuntimeClaim(value, secret) {
  return createHmac('sha256', String(secret || ''))
    .update(canonicalJson(academyRuntimeClaimUnsigned(value)))
    .digest('hex');
}

function academyOutcomeAttestationUnsigned(value) {
  return {
    schemaId: value?.schemaId,
    standardId: value?.standardId,
    standardVersion: Number(value?.standardVersion),
    runId: String(value?.runId || ''),
    evidenceDigest: String(value?.evidenceDigest || ''),
    runtimeClaimFingerprint: String(value?.runtimeClaimFingerprint || ''),
    issuedAt: String(value?.issuedAt || ''),
  };
}

function signAcademyOutcomeAttestation(value, secret) {
  return createHmac('sha256', String(secret || ''))
    .update(canonicalJson(academyOutcomeAttestationUnsigned(value)))
    .digest('hex');
}

function academyCaseReceiptUnsigned(value) {
  return {
    schemaId: value?.schemaId,
    standardId: value?.standardId,
    standardVersion: Number(value?.standardVersion),
    runId: String(value?.runId || ''),
    caseId: String(value?.caseId || ''),
    type: String(value?.type || ''),
    stepId: String(value?.stepId || ''),
    runtimeClaimFingerprint: String(value?.runtimeClaimFingerprint || ''),
    requestFingerprint: String(value?.requestFingerprint || ''),
    responseFingerprint: String(value?.responseFingerprint || ''),
    responseWords: Number(value?.responseWords),
    provider: String(value?.provider || ''),
    pass: value?.pass === true,
    checksFingerprint: String(value?.checksFingerprint || ''),
    qualityGateFingerprint: String(value?.qualityGateFingerprint || ''),
    issuedAt: String(value?.issuedAt || ''),
  };
}

function signAcademyCaseReceipt(value, secret) {
  return createHmac('sha256', String(secret || ''))
    .update(canonicalJson(academyCaseReceiptUnsigned(value)))
    .digest('hex');
}

function normalizedModelManifest(value) {
  return Object.fromEntries(ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => [type, String(value?.[type] || '').trim()]));
}

function validModelManifest(value) {
  const normalized = normalizedModelManifest(value);
  return ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.every(type => realProvider(normalized[type]));
}

function sameModelManifest(left, right) {
  return validModelManifest(left) && validModelManifest(right)
    && ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.every(type => (
      normalizedModelManifest(left)[type] === normalizedModelManifest(right)[type]
    ));
}

function normalizedFingerprintManifest(value) {
  return Object.fromEntries(FINGERPRINT_FIELDS.map(field => [field, String(value?.[field] || '').trim().toLowerCase()]));
}

function validFingerprintManifest(value) {
  const normalized = normalizedFingerprintManifest(value);
  return FINGERPRINT_FIELDS.every(field => SHA256.test(normalized[field]));
}

function sameFingerprintManifest(left, right) {
  return validFingerprintManifest(left) && validFingerprintManifest(right)
    && FINGERPRINT_FIELDS.every(field => (
      normalizedFingerprintManifest(left)[field] === normalizedFingerprintManifest(right)[field]
    ));
}

function sameStringSet(leftValues, rightValues) {
  const left = Array.isArray(leftValues) ? leftValues.map(String) : [];
  const right = Array.isArray(rightValues) ? rightValues.map(String) : [];
  return left.length === right.length
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every(value => new Set(right).has(value));
}

function sameOrderedStrings(leftValues, rightValues) {
  const left = Array.isArray(leftValues) ? leftValues.map(String) : [];
  const right = Array.isArray(rightValues) ? rightValues.map(String) : [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
    return url.toString().replace(/\/$/u, '');
  } catch {
    return '';
  }
}

function strictIsoTimestamp(value) {
  const clean = String(value || '').trim();
  if (!ISO_TIMESTAMP.test(clean)) return '';
  const parsed = Date.parse(clean);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === clean ? clean : '';
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function safeHexEqual(left, right) {
  const cleanLeft = String(left || '');
  const cleanRight = String(right || '');
  if (!SHA256.test(cleanLeft) || !SHA256.test(cleanRight)) return false;
  return timingSafeEqual(Buffer.from(cleanLeft, 'hex'), Buffer.from(cleanRight, 'hex'));
}
