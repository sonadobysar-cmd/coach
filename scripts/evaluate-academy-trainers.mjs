import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  academyTrainerReleaseBaseline,
  ACADEMY_TRAINER_EVAL_STANDARD,
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

const baseUrl = String(process.env.ELITEA_TRAINER_EVAL_URL || 'http://127.0.0.1:4173').replace(/\/$/u, '');
const token = String(process.env.ELITEA_TRAINER_EVAL_JWT || '').trim();
const concurrency = Math.max(1, Math.min(6, Number(process.env.ELITEA_TRAINER_EVAL_CONCURRENCY || 2)));
const requestTimeoutMs = Math.max(60_000, Math.min(900_000, Number(process.env.ELITEA_TRAINER_EVAL_TIMEOUT_MS || 600_000)));
const writeBaseline = process.argv.includes('--write-baseline');
const resumePath = String(process.env.ELITEA_TRAINER_EVAL_RESUME_REPORT || '').trim();
const startedAt = new Date().toISOString();
const runId = startedAt.replace(/[:.]/gu, '-');
const coursePaths = (await readdir(resolve('data')))
  .filter(name => /^course-.*\.md$/u.test(name) && !name.includes('audio-scripts'))
  .sort()
  .map(name => resolve('data', name));
const courses = await loadCourses(coursePaths);
const plan = buildAcademyTrainerEvalPlan(courses);
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
    resultsById.set(id, { ...result, attempts: priorAttempts + 1 });
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
    });
    console.error(`${prefix} ERROR ${error?.message || error}`);
  }
});

const results = [...resultsById.values()];
results.sort((left, right) => left.id.localeCompare(right.id, 'cs'));
const completedAt = new Date().toISOString();
const report = summarizeAcademyTrainerEval(results, { baseUrl, startedAt, completedAt });
report.run = {
  resumedFrom: resumePath || null,
  reusedPassedCases,
  attemptedCases: tasks.length,
  totalAttempts: results.reduce((sum, result) => sum + Number(result.attempts || 1), 0),
};
const reportDir = resolve('reports', 'academy-trainer-evals');
await mkdir(reportDir, { recursive: true });
const reportPath = resolve(reportDir, `${runId}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (writeBaseline && report.summary.complete) {
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
  baselineUpdated: writeBaseline && report.summary.complete,
}, null, 2));
if (!report.summary.complete) process.exitCode = 1;

async function runCase(entry, type) {
  if (type === 'study') {
    const request = studyEvalRequest(entry);
    return evaluateTrainerStudy(entry, await postTraining(request), request);
  }
  if (type === 'simulation') {
    return evaluateTrainerSimulation(entry, await postTraining(simulationEvalRequest(entry)));
  }
  const simulationRequest = simulationEvalRequest(entry);
  const simulationPayload = await postTraining(simulationRequest);
  const prerequisite = evaluateTrainerSimulation(entry, simulationPayload);
  if (!prerequisite.pass) throw new Error(`Debrief prerequisite failed: ${failedChecks(prerequisite)}`);
  const request = debriefEvalRequest(entry, simulationPayload.text);
  return evaluateTrainerDebrief(entry, await postTraining(request), request);
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
