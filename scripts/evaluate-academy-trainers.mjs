import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  academyTrainerReleaseBaseline,
  ACADEMY_TRAINER_EVAL_STANDARD,
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
const token = String(process.env.ELITEA_TRAINER_EVAL_JWT || '').trim();
const concurrency = Math.max(1, Math.min(6, Number(process.env.ELITEA_TRAINER_EVAL_CONCURRENCY || 2)));
const requestTimeoutMs = Math.max(60_000, Math.min(900_000, Number(process.env.ELITEA_TRAINER_EVAL_TIMEOUT_MS || 600_000)));
const writeBaseline = process.argv.includes('--write-baseline');
const resumePath = String(process.env.ELITEA_TRAINER_EVAL_RESUME_REPORT || '').trim();
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
if (writeBaseline && !provenanceSeed.deployment.identity) {
  throw new Error('Pro vzdálený release eval nastav ELITEA_TRAINER_EVAL_DEPLOYMENT_ID na neměnnou identitu testovaného deploymentu.');
}
if (writeBaseline && provenanceSeed.gitDirty) {
  throw new Error('Release eval spusť pouze z čistého pracovního stromu; jinak commit SHA neodpovídá testovanému kódu.');
}
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
results.sort((left, right) => left.id.localeCompare(right.id, 'cs'));
const completedAt = new Date().toISOString();
const report = summarizeAcademyTrainerEval(results, { baseUrl, startedAt, completedAt });
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
report.baselineEligibility = assessAcademyTrainerBaselineEligibility(report);
const reportDir = resolve('reports', 'academy-trainer-evals');
await mkdir(reportDir, { recursive: true });
const reportPath = resolve(reportDir, `${runId}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (writeBaseline && report.baselineEligibility.eligible) {
  await writeFile(
    resolve('config', 'academy-trainer-release.json'),
    `${JSON.stringify(academyTrainerReleaseBaseline(report), null, 2)}\n`,
    'utf8',
  );
}

console.log(JSON.stringify({
  ...report.summary,
  byType: report.byType,
  reportPath,
  baselineEligibility: report.baselineEligibility,
  baselineUpdated: writeBaseline && report.baselineEligibility.eligible,
}, null, 2));
if (!report.summary.complete || (writeBaseline && !report.baselineEligibility.eligible)) process.exitCode = 1;

async function runCase(entry, type) {
  if (type === 'study') {
    const request = studyEvalRequest(entry);
    return evaluateTrainerStudy(entry, await postTraining(request), request);
  }
  if (type === 'simulation') {
    const live = await startEvalSimulation(entry);
    return evaluateTrainerSimulation(entry, live.payload);
  }
  const live = await startEvalSimulation(entry);
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
    live.payload = await postTraining(live.request);
    live.messages.push({ role: 'assistant', content: live.payload.text });
  }
  const request = {
    ...debriefEvalRequest(entry, live.payload.text),
    messages: live.messages,
    scenarioId: live.scenario.id,
    difficulty: live.scenario.difficulty,
    attemptToken: live.payload.attemptToken || live.request.attemptToken || null,
  };
  return evaluateTrainerDebrief(entry, await postTraining(request), request);
}

async function startEvalSimulation(entry) {
  const scenario = await getTrainingScenario(entry);
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
  const payload = await postTraining(request);
  messages.push({ role: 'assistant', content: payload.text });
  return { scenario, request, payload, messages };
}

async function getTrainingScenario(entry) {
  const query = new URLSearchParams({
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    difficulty: entry.scenario.difficulty,
    scenarioId: entry.scenario.id,
  });
  const response = await fetch(`${baseUrl}/api/training/scenario?${query}`, {
    headers: {
      accept: 'application/json',
      origin: new URL(baseUrl).origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const text = await response.text();
  let payload = {};
  try { payload = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`scenario HTTP ${response.status}: ${payload.error || text.slice(0, 240)}`);
  return payload;
}

async function postTraining(body) {
  const response = await fetch(`${baseUrl}/api/training`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(baseUrl).origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
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
  const deploymentIdentity = resolveDeploymentIdentity(evaluatedBaseUrl, gitCommitSha);
  return {
    appVersion: String(packageMetadata.version || ''),
    gitCommitSha,
    gitDirty: Boolean(String(statusOutput || '').trim()),
    modelIds: {
      study: resolveTrainingModel('study', 'study'),
      simulation: resolveTrainingModel('simulation', 'roleplay'),
      debrief: resolveTrainingModel('simulation', 'debrief'),
    },
    promptSystemFingerprint: await fingerprintFiles([
      'src/training.js',
      'src/training-quality.js',
      'src/course-trainer-profiles.js',
      'src/course-knowledge.js',
      'src/life-coach-training.js',
      'src/coach-competencies.js',
    ]),
    evaluationCodeFingerprint: await fingerprintFiles([
      'src/academy-trainer-evals.js',
      'scripts/evaluate-academy-trainers.mjs',
    ]),
    evalPlanFingerprint: fingerprint(JSON.stringify(evalPlan.map(entry => ({
      courseId: entry.course.id,
      courseSlug: entry.course.slug,
      courseTitle: entry.course.title,
      itemId: entry.item.id,
      itemTitle: entry.item.title,
      itemFingerprint: fingerprint(String(entry.item.markdown || '')),
      trainer: entry.profile,
      scenario: entry.scenario,
    })))),
    deployment: {
      baseUrl: evaluatedBaseUrl,
      identity: deploymentIdentity,
    },
    generatedAt,
    runId: evaluationRunId,
  };
}

function resolveDeploymentIdentity(evaluatedBaseUrl, gitCommitSha) {
  const explicit = String(process.env.ELITEA_TRAINER_EVAL_DEPLOYMENT_ID || '').trim();
  if (explicit) return explicit;
  const hostname = new URL(evaluatedBaseUrl).hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return `local:${gitCommitSha}`;
  }
  return null;
}

async function fingerprintFiles(paths) {
  const content = await Promise.all(paths.map(async path => `${path}\n${await readFile(resolve(path), 'utf8')}`));
  return fingerprint(content.join('\n\n---FILE---\n\n'));
}

function fingerprint(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}
