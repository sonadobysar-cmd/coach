import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  academyTrainerReleaseBaseline,
  ACADEMY_TRAINER_EVAL_STANDARD,
  ACADEMY_TRAINER_PROVENANCE_FILE_GROUPS,
  academyTrainerEvalPlanFingerprint,
  academyTrainerRuntimeClaimFingerprint,
  academyTrainerRuntimeClaimValid,
  assessAcademyTrainerBaselineEligibility,
  buildAcademyTrainerEvalPlan,
  debriefEvalRequest,
  evaluateTrainerDebrief,
  evaluateTrainerSimulation,
  evaluateTrainerStudy,
  simulationEvalRequest,
  studyEvalRequest,
  summarizeAcademyTrainerEval,
} from '../src/academy-trainer-evals.js';
import { loadCourses } from '../src/courses.js';
import { resolveTrainingModel } from '../src/training.js';

const execFileAsync = promisify(execFile);

const baseUrl = String(process.env.ELITEA_TRAINER_EVAL_URL || 'http://127.0.0.1:4173').replace(/\/$/u, '');
const jwt = String(process.env.ELITEA_TRAINER_EVAL_JWT || '').trim();
const releaseToken = String(process.env.ELITEA_TRAINER_EVAL_TOKEN || '').trim();
const concurrency = Math.max(1, Math.min(6, Number(process.env.ELITEA_TRAINER_EVAL_CONCURRENCY || 2)));
const requestTimeoutMs = Math.max(60_000, Math.min(900_000, Number(process.env.ELITEA_TRAINER_EVAL_TIMEOUT_MS || 600_000)));
const writeBaseline = process.argv.includes('--write-baseline');
const resumePath = String(process.env.ELITEA_TRAINER_EVAL_RESUME_REPORT || '').trim();
const reportOutputPath = cliValue('--report') || String(process.env.ELITEA_TRAINER_EVAL_REPORT || '').trim();
const releaseArtifactOutputPath = cliValue('--release-artifact')
  || String(process.env.ELITEA_TRAINER_EVAL_RELEASE_ARTIFACT || '').trim();
const startedAt = new Date().toISOString();
const runId = startedAt.replace(/[:.]/gu, '-');
if (writeBaseline && resumePath) {
  throw new Error('--write-baseline nelze kombinovat s resume. Release baseline vyžaduje jeden čerstvý běh všech 81 případů.');
}
const coursePaths = (await readdir(resolve('data')))
  .filter(name => /^course-.*\.md$/u.test(name) && !name.includes('audio-scripts'))
  .sort()
  .map(name => resolve('data', name));
const courses = await loadCourses(coursePaths);
const plan = buildAcademyTrainerEvalPlan(courses);
const provenanceSeed = await buildProvenanceSeed({ plan, baseUrl, startedAt, runId });
assertReleasePreflight({ provenance: provenanceSeed, writeBaseline, jwt, releaseToken });
const previousReport = resumePath ? JSON.parse(await readFile(resolve(resumePath), 'utf8')) : null;
if (previousReport && Number(previousReport.standardVersion) !== ACADEMY_TRAINER_EVAL_STANDARD.version) {
  throw new Error(`Nelze pokračovat z eval standardu ${previousReport.standardVersion}; aktuální je ${ACADEMY_TRAINER_EVAL_STANDARD.version}.`);
}
if (previousReport && String(previousReport.baseUrl || '') !== baseUrl) {
  throw new Error(`Nelze míchat evaly z ${previousReport.baseUrl} a ${baseUrl}.`);
}
const previousById = new Map((previousReport?.results || []).map(result => [result.id, result]));
const resultsById = new Map(previousById);
const tasks = plan.flatMap(entry => ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => ({ entry, type })))
  .filter(task => previousById.get(`${task.entry.course.id}:${task.type}`)?.pass !== true);
const reusedPassedCases = ACADEMY_TRAINER_EVAL_STANDARD.requiredCases - tasks.length;

console.log(`Elitea Academy trainer eval: ${plan.length} kurzů × 3 živé případy = ${plan.length * 3}; ověřit nyní ${tasks.length}, převzato PASS ${reusedPassedCases}.`);
await runPool(tasks, concurrency, async (task, index) => {
  const { entry, type } = task;
  const id = `${entry.course.id}:${type}`;
  const prefix = `[${index + 1}/${tasks.length}] ${entry.course.id} · ${caseLabel(type)}`;
  const priorAttempts = Number(previousById.get(id)?.attempts || (previousById.has(id) ? 1 : 0));
  try {
    const result = await runCase(entry, type);
    resultsById.set(id, { ...result, attempts: priorAttempts + 1, evaluationRunId: runId });
    console.log(`${prefix} ${result.pass ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    resultsById.set(id, {
      id,
      courseId: entry.course.id,
      courseSlug: entry.course.slug,
      courseTitle: entry.course.title,
      trainer: entry.profile.label,
      itemId: entry.item.id,
      itemTitle: entry.item.title,
      type,
      pass: false,
      checks: [{ name: 'request-completed', pass: false, detail: [String(error?.message || error).slice(0, 500)] }],
      provider: null,
      qualityGate: null,
      responseWords: 0,
      responseFingerprint: null,
      attempts: priorAttempts + 1,
      evaluationRunId: runId,
    });
    console.error(`${prefix} ERROR ${error?.message || error}`);
  }
});

const results = [...resultsById.values()];
const completedAt = new Date().toISOString();
const report = summarizeAcademyTrainerEval(results, { baseUrl, startedAt, completedAt, plan });
report.run = {
  id: runId,
  resumedFrom: resumePath || null,
  reusedPassedCases,
  reusedCases: reusedPassedCases,
  freshCases: tasks.length,
  attemptedCases: tasks.length,
  totalAttempts: results.reduce((sum, result) => sum + Number(result.attempts || 1), 0),
};
report.provenance = {
  ...provenanceSeed,
  modelIds: {
    ...provenanceSeed.modelIds,
    observedByType: Object.fromEntries(ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => [
      type,
      [...new Set(results.filter(result => result.type === type).map(result => result.provider).filter(Boolean))].sort(),
    ])),
  },
};
report.baselineEligibility = assessAcademyTrainerBaselineEligibility(report, {
  plan,
  runtimeClaimSecret: releaseToken,
});
const reportPath = reportOutputPath
  ? resolve(reportOutputPath)
  : resolve('reports', 'academy-trainer-evals', `${runId}.json`);
const reportDir = dirname(reportPath);
await mkdir(reportDir, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

let outcomeAttestation = null;
if (writeBaseline && report.baselineEligibility.eligible) {
  outcomeAttestation = await getAcademyOutcomeAttestation(report);
  const releaseArtifactPath = releaseArtifactOutputPath
    ? resolve(releaseArtifactOutputPath)
    : resolve('config', 'academy-trainer-release.json');
  await mkdir(dirname(releaseArtifactPath), { recursive: true });
  await writeFile(
    releaseArtifactPath,
    `${JSON.stringify(academyTrainerReleaseBaseline(report, {
      plan,
      runtimeClaimSecret: releaseToken,
      outcomeAttestation,
    }), null, 2)}\n`,
    'utf8',
  );
}

console.log(JSON.stringify({
  ...report.summary,
  byType: report.byType,
  reportPath,
  baselineEligibility: report.baselineEligibility,
  baselineUpdated: writeBaseline && report.baselineEligibility.eligible && Boolean(outcomeAttestation),
}, null, 2));
if (!report.summary.complete || (writeBaseline && !report.baselineEligibility.eligible)) process.exitCode = 1;

async function runCase(entry, type) {
  if (type === 'study') {
    const request = studyEvalRequest(entry);
    return evaluateTrainerStudy(entry, await postTraining(request, {
      caseId: `${entry.course.id}:study`,
      stepId: 'study',
    }), request);
  }
  if (type === 'simulation') {
    const live = await startEvalSimulation(entry, type);
    return evaluateTrainerSimulation(entry, live.payload);
  }
  const live = await startEvalSimulation(entry, type);
  const prerequisite = evaluateTrainerSimulation(entry, live.payload);
  if (!prerequisite.pass) throw new Error(`Debrief prerequisite failed: ${failedChecks(prerequisite)}`);
  const extraTurns = entry.course.id === 'profesionalni-life-coach' ? 2 : 0;
  for (let index = 0; index < extraTurns; index += 1) {
    const studentText = [
      'Co z toho, co jsi právě řekla, je pro tebe teď nejdůležitější?',
      'Jaký výsledek tohoto rozhovoru by byl ve tvých rukou a podle čeho ho poznáš?',
    ][index];
    live.messages.push({ role: 'user', content: studentText });
    live.request = {
      ...live.request,
      phase: 'roleplay',
      messages: live.messages,
      attemptToken: live.payload.attemptToken || live.request.attemptToken || null,
    };
    live.payload = await postTraining(live.request, {
      caseId: `${entry.course.id}:debrief`,
      stepId: `roleplay-${index + 2}`,
    });
    live.messages.push({ role: 'assistant', content: live.payload.text });
  }
  const request = {
    ...debriefEvalRequest(entry, live.payload.text),
    messages: [
      ...live.messages,
      { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik pouze podle přepisu.' },
    ],
    scenarioId: live.scenario.id,
    difficulty: live.scenario.difficulty,
    attemptToken: live.payload.attemptToken || live.request.attemptToken || null,
  };
  return evaluateTrainerDebrief(entry, await postTraining(request, {
    caseId: `${entry.course.id}:debrief`,
    stepId: 'debrief',
  }), request);
}

async function startEvalSimulation(entry, resultType) {
  const caseId = `${entry.course.id}:${resultType}`;
  const scenario = await getTrainingScenario(entry, caseId);
  const baseRequest = simulationEvalRequest(entry);
  const messages = [
    { role: 'assistant', content: scenario.openingLine },
    ...baseRequest.messages,
  ];
  const request = {
    ...baseRequest,
    messages,
    scenarioId: scenario.id,
    difficulty: scenario.difficulty,
    attemptToken: scenario.attemptToken || null,
  };
  const payload = await postTraining(request, { caseId, stepId: 'roleplay-1' });
  messages.push({ role: 'assistant', content: payload.text });
  return { scenario, request, payload, messages };
}

async function getTrainingScenario(entry, caseId) {
  const query = new URLSearchParams({
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    difficulty: entry.scenario.difficulty,
    scenarioId: entry.scenario.id,
  });
  const response = await fetch(`${baseUrl}/api/training/scenario?${query}`, {
    headers: academyEvalHeaders(false, { caseId, stepId: 'scenario' }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const text = await response.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`scenario HTTP ${response.status}: ${payload.error || text.slice(0, 240)}`);
  return payload;
}

async function postTraining(body, binding) {
  const response = await fetch(`${baseUrl}/api/training`, {
    method: 'POST',
    headers: academyEvalHeaders(true, binding),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const text = await response.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload.error || text.slice(0, 240)}`);
  return payload;
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

function caseLabel(type) {
  return { study: 'výklad', simulation: 'simulace', debrief: 'debrief' }[type] || type;
}

function failedChecks(result) {
  return (result?.checks || []).filter(check => !check.pass).map(check => check.name).join(', ') || 'unknown';
}

async function buildProvenanceSeed({ plan: evalPlan, baseUrl: evaluatedBaseUrl, startedAt: generatedAt, runId: evaluationRunId }) {
  const packageMetadata = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  const [{ stdout: commitOutput }, { stdout: statusOutput }] = await Promise.all([
    execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd() }),
    execFileAsync('git', ['status', '--porcelain'], { cwd: process.cwd() }),
  ]);
  const gitCommitSha = String(commitOutput || '').trim();
  const localFingerprints = {
    applicationFingerprint: await fingerprintFiles(ACADEMY_TRAINER_PROVENANCE_FILE_GROUPS.applicationFingerprint),
    promptSystemFingerprint: await fingerprintFiles(ACADEMY_TRAINER_PROVENANCE_FILE_GROUPS.promptSystemFingerprint),
    evaluationCodeFingerprint: await fingerprintFiles(ACADEMY_TRAINER_PROVENANCE_FILE_GROUPS.evaluationCodeFingerprint),
    evalPlanFingerprint: academyTrainerEvalPlanFingerprint(evalPlan),
  };
  const localModels = {
    study: resolveTrainingModel('study', 'study'),
    simulation: resolveTrainingModel('simulation', 'roleplay'),
    debrief: resolveTrainingModel('simulation', 'debrief'),
  };
  const runtimeClaim = writeBaseline ? await getAcademyRuntimeClaim() : null;
  const runtimeClaimVerified = Boolean(runtimeClaim && academyTrainerRuntimeClaimValid(runtimeClaim, {
    secret: releaseToken,
    expectedBaseUrl: evaluatedBaseUrl,
    expectedAppVersion: String(packageMetadata.version || ''),
    expectedGitCommitSha: gitCommitSha,
    expectedModels: localModels,
    expectedFingerprints: localFingerprints,
  }));
  const deploymentIdentity = runtimeClaimVerified
    ? runtimeClaim.identity
    : resolveDiagnosticDeploymentIdentity(evaluatedBaseUrl, gitCommitSha);
  return {
    runId: evaluationRunId,
    appVersion: String(packageMetadata.version || ''),
    gitCommitSha,
    gitDirty: Boolean(String(statusOutput || '').trim()),
    ...localFingerprints,
    modelIds: localModels,
    authentication: {
      releaseEvalTokenUsed: Boolean(releaseToken),
      memberJwtUsed: Boolean(jwt),
      runtimeClaimVerified,
    },
    deployment: {
      baseUrl: evaluatedBaseUrl,
      identity: deploymentIdentity,
      gitCommitSha,
      runtimeClaim,
      runtimeClaimFingerprint: academyTrainerRuntimeClaimFingerprint(runtimeClaim),
    },
    generatedAt,
  };
}

function resolveDiagnosticDeploymentIdentity(evaluatedBaseUrl, gitCommitSha) {
  const hostname = new URL(evaluatedBaseUrl).hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return `local:${gitCommitSha}`;
  }
  return null;
}

function assertReleasePreflight({ provenance, writeBaseline: releaseRequested, jwt: memberJwt, releaseToken: evalToken }) {
  if (!releaseRequested) return;
  const errors = [];
  if (provenance.gitDirty !== false) errors.push('pracovní strom není čistý');
  if (!evalToken) errors.push('chybí ELITEA_TRAINER_EVAL_TOKEN');
  if (memberJwt) errors.push('členský JWT je povolen jen pro diagnostický běh');
  if (provenance.authentication?.runtimeClaimVerified !== true) errors.push('deployment neposkytl platný podepsaný Academy runtime claim');
  if (!provenance.deployment?.identity) errors.push('chybí neměnná identita deploymentu');
  if (provenance.evalPlanFingerprint !== academyTrainerEvalPlanFingerprint(plan)) errors.push('eval plán není přesný kanonický plán 27 × 3');
  if (errors.length) throw new Error(`Release baseline se nezapíše: ${errors.join('; ')}.`);
}

async function getAcademyRuntimeClaim() {
  const response = await fetch(`${baseUrl}/api/release-evaluation/runtime-claim`, {
    headers: academyReleaseAuthHeaders(false),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const payload = await readJsonResponse(response, 'ACADEMY_RUNTIME_CLAIM_REQUEST_FAILED');
  if (!payload?.claim || typeof payload.claim !== 'object') throw new Error('Deployment nevrátil Academy runtime claim.');
  return payload.claim;
}

async function getAcademyOutcomeAttestation(report) {
  const response = await fetch(`${baseUrl}/api/release-evaluation/outcome-attestation`, {
    method: 'POST',
    headers: academyReleaseAuthHeaders(true),
    body: JSON.stringify({ report }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const payload = await readJsonResponse(response, 'ACADEMY_OUTCOME_ATTESTATION_REQUEST_FAILED');
  if (!payload?.attestation || typeof payload.attestation !== 'object') throw new Error('Deployment nevrátil Academy outcome attestation.');
  return payload.attestation;
}

function academyReleaseAuthHeaders(json) {
  return {
    accept: 'application/json',
    ...(json ? { 'content-type': 'application/json' } : {}),
    origin: new URL(baseUrl).origin,
    'user-agent': 'Elitea-Academy-Trainer-Readiness-Eval/1',
    ...(releaseToken ? {
      'x-elitea-release-eval-token': releaseToken,
      'x-elitea-release-suite': 'academy-trainers',
    } : {}),
  };
}

function academyEvalHeaders(json, binding = {}) {
  const headers = {
    ...academyReleaseAuthHeaders(json),
    ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
  };
  if (releaseToken && provenanceSeed?.deployment?.runtimeClaim && binding.caseId && binding.stepId) {
    headers['x-elitea-release-run-id'] = runId;
    headers['x-elitea-release-case-id'] = binding.caseId;
    headers['x-elitea-release-step-id'] = binding.stepId;
    headers['x-elitea-release-runtime-claim'] = Buffer.from(
      JSON.stringify(provenanceSeed.deployment.runtimeClaim),
      'utf8',
    ).toString('base64url');
  }
  return headers;
}

async function readJsonResponse(response, fallbackCode) {
  const raw = await response.text();
  let payload = {};
  try { payload = JSON.parse(raw); } catch {}
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${payload?.error || raw.slice(0, 240)}`);
    error.code = payload?.code || fallbackCode;
    throw error;
  }
  return payload;
}

async function fingerprintFiles(paths) {
  const content = await Promise.all(paths.map(async path => `${path}\n${await readFile(resolve(path), 'utf8')}`));
  return fingerprint(content.join('\n\n---FILE---\n\n'));
}

function fingerprint(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function cliValue(name) {
  const exact = process.argv.find(argument => argument.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1).trim();
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
}
