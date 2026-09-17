import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  PROFESSIONAL_COACH_READINESS_CASES,
  PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS,
  PROFESSIONAL_COACH_READINESS_STANDARD,
  PROFESSIONAL_COACH_TEACHING_CYCLES,
  assertPrivateProfessionalCoachReadinessReport,
  professionalCoachRuntimeClaimFingerprint,
  professionalCoachRuntimeClaimValid,
  evaluateProfessionalCoachDebrief,
  evaluateProfessionalCoachRoleplayTurn,
  failedProfessionalCoachReadinessCase,
  finishProfessionalCoachReadinessCase,
  immutableDeploymentIdentityMatches,
  professionalCoachDeploymentBindingFingerprint,
  professionalCoachReadinessPlanFingerprint,
  professionalCoachReleaseArtifact,
  summarizeProfessionalCoachReadiness,
  validateProfessionalCoachReadinessPlan,
} from '../src/professional-coach-readiness-eval.js';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { createTrainingScenario, resolveTrainingModel } from '../src/training.js';

const execFileAsync = promisify(execFile);
let canonicalProfessionalCoachCoursePromise = null;

export async function runProfessionalCoachReadinessEvaluation(options = {}) {
  const config = resolveConfig(options);
  if (config.writeRelease && (options.cases || config.onlyCase)) {
    throw new Error(`Release eval nepovoluje vlastní ani dílčí plán; použij všech ${PROFESSIONAL_COACH_READINESS_STANDARD.caseCount} kanonických případů.`);
  }
  const cases = options.cases || PROFESSIONAL_COACH_READINESS_CASES;
  validateProfessionalCoachReadinessPlan(cases, { strict: config.writeRelease || (!options.cases && !config.onlyCase) });
  const selectedCases = config.onlyCase ? cases.filter(item => item.id === config.onlyCase) : cases;
  if (!selectedCases.length) throw new Error(`Případ ${config.onlyCase} v profesním eval plánu neexistuje.`);
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/gu, '-');
  config.runId = runId;
  const reportPath = config.reportPath || resolve('reports', 'professional-coach-readiness', `${runId}.json`);
  const run = {
    id: runId,
    resumedFrom: null,
    freshCases: selectedCases.length,
    reusedCases: 0,
    attemptedCases: selectedCases.length,
    selectedCaseIds: selectedCases.map(item => item.id).sort(),
  };
  const provenanceSeed = await buildProvenance({ config, cases: selectedCases, startedAt, runId });
  config.runtimeClaimFingerprint = provenanceSeed.deployment?.runtimeClaimFingerprint || '';
  if (config.writeRelease) assertProfessionalCoachReleasePreflight({ config, provenance: provenanceSeed, selectedCases });
  const results = [];

  config.logger(`Profesní AI trenérka: ${selectedCases.length} CZ/SK vícetahových případů, ${selectedCases.reduce((sum, item) => sum + item.turns.length, 0)} tahů a ${selectedCases.length} evidence-only debriefů.`);
  const executeCase = async selectedCase => {
    const index = selectedCases.findIndex(item => item.id === selectedCase.id);
    let result;
    try {
      result = await runLiveCase(config, selectedCase);
      config.logger(`[${index + 1}/${selectedCases.length}] ${selectedCase.id}: ${result.pass ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      result = failedProfessionalCoachReadinessCase(selectedCase, error);
      config.logger(`[${index + 1}/${selectedCases.length}] ${selectedCase.id}: ERROR`);
    }
    results.push({ ...result, evaluationRunId: runId });
    return result;
  };
  const calibrationIds = new Set(PROFESSIONAL_COACH_TEACHING_CYCLES.flatMap(definition => [
    definition.baselineCaseId,
    definition.retryCaseId,
  ]));
  const diagnosticCases = selectedCases.filter(selectedCase => !calibrationIds.has(selectedCase.id));
  await runPool(diagnosticCases, config.concurrency, executeCase);
  for (const definition of PROFESSIONAL_COACH_TEACHING_CYCLES) {
    const baseline = selectedCases.find(item => item.id === definition.baselineCaseId);
    const correctedCalibration = selectedCases.find(item => item.id === definition.retryCaseId);
    if (baseline) await executeCase(baseline);
    if (correctedCalibration) await executeCase(correctedCalibration);
  }

  const provenance = {
    ...provenanceSeed,
    modelIds: {
      ...provenanceSeed.modelIds,
      observedByPhase: {
        roleplay: [...new Set(results.flatMap(result => result.roleplay?.turns || []).map(turn => turn.provider).filter(Boolean))].sort(),
        debrief: [...new Set(results.map(result => result.debrief?.provider).filter(Boolean))].sort(),
      },
    },
  };
  const report = summarizeProfessionalCoachReadiness(results, {
    baseUrl: config.baseUrl,
    startedAt,
    completedAt: new Date().toISOString(),
    provenance,
    run,
  });
  assertPrivateProfessionalCoachReadinessReport(report, selectedCases);
  await atomicWriteJson(reportPath, report);
  let releaseArtifactPath = null;
  if (config.writeRelease && report.releaseEligibility.eligible) {
    const outcomeAttestation = await getOutcomeAttestation(config, report);
    await atomicWriteJson(config.releaseArtifactPath, professionalCoachReleaseArtifact(report, {
      runtimeClaimSecret: config.evalToken,
      outcomeAttestation,
    }));
    releaseArtifactPath = config.releaseArtifactPath;
  }
  return { report, reportPath, releaseArtifactPath };
}

async function runLiveCase(config, selectedCase) {
  const canonicalScenario = await canonicalScenarioFor(selectedCase);
  const scenario = await getScenario(config, selectedCase);
  if (String(scenario?.scenarioFamilyId || '') !== selectedCase.expectedScenario.scenarioFamilyId
    || String(scenario?.challengeId || '') !== selectedCase.expectedScenario.challengeId) {
    const error = new Error('Scenario mismatch');
    error.code = 'SCENARIO_MISMATCH';
    throw error;
  }

  const messages = [{ role: 'assistant', content: String(scenario.openingLine || '') }];
  const roleplayTurns = [];
  const previousResponses = [];
  let attemptToken = scenario.attemptToken || null;
  let previousReleaseReceipt = scenario.releaseReceipt || null;

  for (const selectedTurn of selectedCase.turns) {
    messages.push({ role: 'user', content: selectedTurn.content });
    const started = Date.now();
    const payload = await postTraining(config, {
      selectedCase,
      scenario,
      messages,
      phase: 'roleplay',
      stepId: selectedTurn.id,
      attemptToken,
      previousReleaseReceipt,
    });
    const turnResult = evaluateProfessionalCoachRoleplayTurn({
      selectedCase,
      selectedTurn,
      payload,
      canonicalScenario,
      previousResponses,
      durationMs: Date.now() - started,
    });
    roleplayTurns.push(turnResult);
    const responseText = String(payload?.text || '').trim();
    previousResponses.push(responseText);
    messages.push({ role: 'assistant', content: responseText });
    attemptToken = payload?.attemptToken || attemptToken;
    previousReleaseReceipt = payload?.releaseReceipt || previousReleaseReceipt;
  }

  // Stejně jako členské rozhraní zahajujeme debrief změnou fáze bez přidání
  // administrativní uživatelské repliky. U podepsaného pokusu tak přesně sedí
  // serverový hash posledního autentického tahu.
  const debriefStarted = Date.now();
  const debriefPayload = await postTraining(config, {
    selectedCase,
    scenario,
    messages,
    phase: 'debrief',
    stepId: 'debrief',
    attemptToken,
    previousReleaseReceipt,
  });
  const debrief = evaluateProfessionalCoachDebrief({
    selectedCase,
    payload: debriefPayload,
    scenario: canonicalScenario,
    canonicalScenario,
    messages,
    durationMs: Date.now() - debriefStarted,
  });
  return finishProfessionalCoachReadinessCase({
    selectedCase,
    scenario,
    scenarioReceipt: scenario.releaseReceipt || null,
    roleplayTurns,
    debrief,
    transcript: messages,
  });
}

async function canonicalScenarioFor(selectedCase) {
  if (!canonicalProfessionalCoachCoursePromise) {
    canonicalProfessionalCoachCoursePromise = loadCourses([
      fileURLToPath(new URL('../data/course-profesionalni-life-coach.md', import.meta.url)),
    ]).then(([course]) => attachCourseMastery(course));
  }
  const course = await canonicalProfessionalCoachCoursePromise;
  const item = course.modules
    .flatMap(module => module.items || [])
    .find(candidate => candidate.id === selectedCase.itemId);
  if (!item) throw new Error(`Kanonická část kurzu ${selectedCase.itemId} nebyla nalezena.`);
  return createTrainingScenario(
    course,
    item,
    selectedCase.difficulty,
    selectedCase.expectedScenario?.id || null,
    null,
  );
}

async function getScenario(config, selectedCase) {
  const query = new URLSearchParams({
    courseSlug: selectedCase.courseSlug,
    itemId: selectedCase.itemId,
    difficulty: selectedCase.difficulty,
  });
  if (selectedCase.expectedScenario?.id) query.set('scenarioId', selectedCase.expectedScenario.id);
  const response = await config.fetchImpl(`${config.baseUrl}/api/training/scenario?${query}`, {
    headers: professionalCoachReadinessRequestHeaders(config, false, {
      caseId: selectedCase.id,
      stepId: 'scenario',
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  return readJsonResponse(response, 'SCENARIO_REQUEST_FAILED');
}

async function postTraining(config, {
  selectedCase,
  scenario,
  messages,
  phase,
  stepId,
  attemptToken,
  previousReleaseReceipt,
}) {
  const response = await config.fetchImpl(`${config.baseUrl}/api/training`, {
    method: 'POST',
    headers: professionalCoachReadinessRequestHeaders(config, true, {
      caseId: selectedCase.id,
      stepId,
    }),
    body: JSON.stringify({
      courseSlug: selectedCase.courseSlug,
      itemId: selectedCase.itemId,
      activity: 'simulation',
      phase,
      difficulty: selectedCase.difficulty,
      scenarioId: scenario.id,
      finalExam: false,
      memory: evaluationMemory(selectedCase),
      messages,
      ...(attemptToken ? { attemptToken } : {}),
      ...(previousReleaseReceipt ? { releasePreviousReceipt: previousReleaseReceipt } : {}),
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  return readJsonResponse(response, 'TRAINING_REQUEST_FAILED');
}

async function readJsonResponse(response, fallbackCode) {
  const raw = await response.text();
  let payload = {};
  try { payload = JSON.parse(raw); } catch {}
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.name = 'LiveEvalHttpError';
    error.status = response.status;
    error.code = /^[A-Z0-9_]{2,80}$/u.test(String(payload?.code || '')) ? payload.code : fallbackCode;
    throw error;
  }
  return payload;
}

export function professionalCoachReadinessRequestHeaders(config, json, binding = null) {
  return {
    accept: 'application/json',
    ...(json ? { 'content-type': 'application/json' } : {}),
    origin: config.origin,
    'user-agent': 'Elitea-Professional-Coach-Readiness-Eval/1',
    ...(config.jwt ? { authorization: `Bearer ${config.jwt}` } : {}),
    ...(config.evalToken ? {
      'x-elitea-release-eval-token': config.evalToken,
      'x-elitea-release-suite': 'professional-coach',
    } : {}),
    ...(config.evalToken && config.runId && binding?.caseId && binding?.stepId ? {
      'x-elitea-release-run-id': config.runId,
      'x-elitea-release-case-id': binding.caseId,
      'x-elitea-release-step-id': binding.stepId,
      'x-elitea-release-runtime-claim': config.runtimeClaimFingerprint,
    } : {}),
  };
}

function evaluationMemory(selectedCase) {
  return {
    identity_preferences: {
      preferred_name: 'Eval',
      address_form: 'tykani',
      language: selectedCase.language,
    },
    coaching_profile: {
      support_accommodations: selectedCase.language === 'sk'
        ? 'Výcvik profesionálneho koučovania; jedna presná intervencia naraz.'
        : 'Výcvik profesionálního koučování; jedna přesná intervence najednou.',
    },
  };
}

function resolveConfig(options) {
  const baseUrl = String(options.baseUrl || process.env.ELITEA_COACH_READINESS_EVAL_URL || '').trim().replace(/\/$/u, '');
  if (!baseUrl) throw new Error('Nastav ELITEA_COACH_READINESS_EVAL_URL nebo použij --url. Eval se nespustil.');
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new Error('ELITEA_COACH_READINESS_EVAL_URL není platná URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Eval URL musí používat http nebo https.');
  return {
    baseUrl,
    origin: parsed.origin,
    jwt: String(options.jwt ?? process.env.ELITEA_COACH_READINESS_EVAL_JWT ?? '').trim(),
    evalToken: String(options.evalToken ?? process.env.ELITEA_COACH_READINESS_EVAL_TOKEN ?? '').trim(),
    deploymentIdentity: String(options.deploymentIdentity ?? process.env.ELITEA_COACH_READINESS_DEPLOYMENT_ID ?? '').trim(),
    timeoutMs: boundedInteger(options.timeoutMs ?? process.env.ELITEA_COACH_READINESS_EVAL_TIMEOUT_MS, 180_000, 30_000, 600_000),
    concurrency: boundedInteger(options.concurrency ?? process.env.ELITEA_COACH_READINESS_EVAL_CONCURRENCY, 2, 1, 3),
    onlyCase: String(options.onlyCase ?? process.env.ELITEA_COACH_READINESS_EVAL_CASE ?? '').trim(),
    reportPath: optionalPath(options.reportPath ?? process.env.ELITEA_COACH_READINESS_EVAL_REPORT),
    writeRelease: options.writeRelease === true,
    releaseArtifactPath: optionalPath(options.releaseArtifactPath ?? process.env.ELITEA_COACH_READINESS_RELEASE_ARTIFACT)
      || resolve('config', 'professional-coach-trainer-release.json'),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    logger: options.logger || console.log,
  };
}

async function buildProvenance({ config, cases, startedAt, runId }) {
  const packageMetadata = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  const [{ stdout: commitOutput }, { stdout: statusOutput }] = await Promise.all([
    execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd() }),
    execFileAsync('git', ['status', '--porcelain'], { cwd: process.cwd() }),
  ]);
  const gitCommitSha = String(commitOutput || '').trim();
  const localFingerprints = {
    applicationFingerprint: await fingerprintFiles(PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS.applicationFingerprint),
    promptSystemFingerprint: await fingerprintFiles(PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS.promptSystemFingerprint),
    evaluationCodeFingerprint: await fingerprintFiles(PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS.evaluationCodeFingerprint),
    evalPlanFingerprint: professionalCoachReadinessPlanFingerprint(cases),
  };
  // Každý běh s release eval tokenem musí být svázaný s přesně tím
  // deploymentem, který testuje. Platí to i pro dílčí diagnostiku: server
  // bez otisku podepsaného runtime claimu požadavek správně odmítne dřív,
  // než se dostane k modelu. Dílčí běh tím nezískává právo vydat release
  // artefakt; to nadále hlídají writeRelease a kanonický úplný plán.
  const runtimeClaim = config.evalToken ? await getAuthenticatedRuntimeClaim(config) : null;
  const runtimeClaimVerified = Boolean(runtimeClaim && professionalCoachRuntimeClaimValid(runtimeClaim, {
    secret: config.evalToken,
    expectedBaseUrl: config.baseUrl,
    expectedAppVersion: String(packageMetadata.version || ''),
    expectedGitCommitSha: gitCommitSha,
    expectedFingerprints: localFingerprints,
  }));
  const configuredModels = runtimeClaimVerified
    ? runtimeClaim.modelIds
    : {
      roleplay: resolveTrainingModel('simulation', 'roleplay'),
      debrief: resolveTrainingModel('simulation', 'debrief'),
    };
  const deploymentIdentity = runtimeClaimVerified
    ? runtimeClaim.identity
    : resolveDiagnosticDeploymentIdentity(config.baseUrl, gitCommitSha);
  return {
    runId,
    appVersion: String(packageMetadata.version || ''),
    gitCommitSha,
    gitDirty: Boolean(String(statusOutput || '').trim()),
    ...localFingerprints,
    modelIds: configuredModels,
    authentication: {
      releaseEvalTokenUsed: Boolean(config.evalToken),
      memberJwtUsed: Boolean(config.jwt),
      runtimeClaimVerified,
    },
    deployment: {
      baseUrl: config.baseUrl,
      identity: deploymentIdentity,
      gitCommitSha,
      bindingFingerprint: professionalCoachDeploymentBindingFingerprint(config.baseUrl, deploymentIdentity, gitCommitSha),
      runtimeClaim,
      runtimeClaimFingerprint: professionalCoachRuntimeClaimFingerprint(runtimeClaim),
    },
    generatedAt: startedAt,
  };
}

export function assertProfessionalCoachReleasePreflight({ config, provenance, selectedCases }) {
  const errors = [];
  if (selectedCases.length !== PROFESSIONAL_COACH_READINESS_STANDARD.caseCount) {
    errors.push(`release vyžaduje všech ${PROFESSIONAL_COACH_READINESS_STANDARD.caseCount} čerstvých případů`);
  }
  if (provenance.gitDirty !== false) errors.push('pracovní strom není čistý');
  if (!config.evalToken) errors.push('chybí ELITEA_COACH_READINESS_EVAL_TOKEN nebo --eval-token');
  if (config.jwt) errors.push('členský JWT běh je pouze diagnostický');
  if (provenance.authentication?.runtimeClaimVerified !== true) errors.push('deployment neposkytl platný podepsaný runtime claim');
  if (config.deploymentIdentity && config.deploymentIdentity !== provenance.deployment?.identity) {
    errors.push('ručně zadaná deployment identita neodpovídá runtime claimu');
  }
  if (!immutableDeploymentIdentityMatches({
    baseUrl: config.baseUrl,
    identity: provenance.deployment.identity,
    gitCommitSha: provenance.gitCommitSha,
    runtimeClaim: provenance.deployment.runtimeClaim,
  })) errors.push('chybí neměnná identita odpovídající testovanému deploymentu');
  if (provenance.evalPlanFingerprint !== professionalCoachReadinessPlanFingerprint()) {
    errors.push('eval plán není přesný kanonický release plán');
  }
  for (const field of ['applicationFingerprint', 'promptSystemFingerprint', 'evaluationCodeFingerprint', 'evalPlanFingerprint']) {
    if (!/^[a-f0-9]{64}$/iu.test(String(provenance[field] || ''))) errors.push(`chybí ${field}`);
  }
  if (errors.length) {
    throw new Error(`Release artefakt se nezapíše: ${errors.join('; ')}.`);
  }
}

function resolveDiagnosticDeploymentIdentity(baseUrl, gitCommitSha) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return ['localhost', '127.0.0.1', '::1'].includes(hostname) ? `local:${gitCommitSha}` : null;
}

async function getAuthenticatedRuntimeClaim(config) {
  const response = await config.fetchImpl(`${config.baseUrl}/api/release-evaluation/runtime-claim`, {
    headers: professionalCoachReadinessRequestHeaders(config, false),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const payload = await readJsonResponse(response, 'RUNTIME_CLAIM_REQUEST_FAILED');
  if (!payload?.claim || typeof payload.claim !== 'object') {
    const error = new Error('Deployment nevrátil podepsaný runtime claim.');
    error.code = 'RUNTIME_CLAIM_MISSING';
    throw error;
  }
  return payload.claim;
}

async function getOutcomeAttestation(config, report) {
  const response = await config.fetchImpl(`${config.baseUrl}/api/release-evaluation/outcome-attestation`, {
    method: 'POST',
    headers: professionalCoachReadinessRequestHeaders(config, true),
    body: JSON.stringify({ report }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const payload = await readJsonResponse(response, 'OUTCOME_ATTESTATION_REQUEST_FAILED');
  if (!payload?.attestation || typeof payload.attestation !== 'object') {
    const error = new Error('Deployment nevrátil serverovou atestaci přesného výsledku.');
    error.code = 'OUTCOME_ATTESTATION_MISSING';
    throw error;
  }
  return payload.attestation;
}

async function fingerprintFiles(paths) {
  const contents = await Promise.all(paths.map(async path => `${path}\n${await readFile(resolve(path), 'utf8')}`));
  return createHash('sha256').update(contents.join('\n\n---FILE---\n\n')).digest('hex');
}

async function runPool(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }));
}

async function atomicWriteJson(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

function optionalPath(value) {
  const clean = String(value || '').trim();
  return clean ? resolve(clean) : null;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function parseCli(argv) {
  const options = {};
  for (const argument of argv) {
    const [flag, ...rest] = argument.split('=');
    const value = rest.join('=');
    if (flag === '--url') options.baseUrl = value;
    else if (flag === '--jwt') options.jwt = value;
    else if (flag === '--eval-token') options.evalToken = value;
    else if (flag === '--deployment-id') options.deploymentIdentity = value;
    else if (flag === '--timeout-ms') options.timeoutMs = value;
    else if (flag === '--concurrency') options.concurrency = value;
    else if (flag === '--case') options.onlyCase = value;
    else if (flag === '--report') options.reportPath = value;
    else if (flag === '--release-artifact') options.releaseArtifactPath = value;
    else if (flag === '--write-release') options.writeRelease = true;
    else if (flag === '--help') options.help = true;
    else throw new Error(`Neznámý argument ${flag}.`);
  }
  return options;
}

function help() {
  return [
    'Release eval AI trenérky kurzu Profesionální Life Coach',
    '',
    'ELITEA_COACH_READINESS_EVAL_URL=http://127.0.0.1:4173 npm run eval:coach-readiness',
    '',
    'Volby: --url=URL --jwt=TOKEN --eval-token=TOKEN --deployment-id=dpl_ID --timeout-ms=MS --concurrency=1..3 --case=ID --report=SOUBOR',
    'Release: --write-release [--release-artifact=SOUBOR]. Bez této volby vzniká jen diagnostický report.',
    `Release brána vyžaduje ${PROFESSIONAL_COACH_READINESS_STANDARD.caseCount}/${PROFESSIONAL_COACH_READINESS_STANDARD.caseCount} čerstvých případů, ${PROFESSIONAL_COACH_READINESS_STANDARD.roleplayTurnCount}/${PROFESSIONAL_COACH_READINESS_STANDARD.roleplayTurnCount} replik, ${PROFESSIONAL_COACH_READINESS_STANDARD.debriefCount}/${PROFESSIONAL_COACH_READINESS_STANDARD.debriefCount} debriefů, čistý git, izolovaný eval token, přesnou modelovou a deployment provenance a serverový ledger bez opakovaných kroků.`,
    'JWT běh může být diagnosticky kompletní, ale nikdy není releaseEligible.',
    'Report ukládá pouze metriky, kontrolní kódy a SHA-256 otisky; nejde o human-reviewed session.',
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
      console.log(help());
    } else {
      const { report, reportPath, releaseArtifactPath } = await runProfessionalCoachReadinessEvaluation(options);
      console.log(JSON.stringify({
        ...report.summary,
        byLocale: report.byLocale,
        releaseEligibility: report.releaseEligibility,
        reportPath,
        releaseArtifactPath,
      }, null, 2));
      if (!report.summary.diagnosticComplete || (options.writeRelease && !report.summary.releaseEligible)) process.exitCode = 1;
    }
  } catch (error) {
    console.error(String(error?.message || error));
    process.exitCode = 1;
  }
}
