import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildTrainingFixture,
  CZSK_LIVE_EVAL_STANDARD,
  evaluateCzskLiveResponse,
  failureResult,
  mapGoldScenarioToRequest,
  reportContainsConversationText,
  summarizeCzskLiveEval,
} from './czsk-live-eval-core.mjs';
import {
  CZSK_COACHING_GOLD_STANDARD,
  czskCoachingGoldScenarios,
} from '../data/czsk-coaching-gold.js';

const LIFE_COACH_SLUG = 'profesionalni-life-coach-od-kontraktu-k-vysledku';

export async function runCzskLiveEvaluation(options = {}) {
  const config = resolveConfig(options);
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/gu, '-');
  const previousReport = config.resumePath ? await readJson(config.resumePath) : null;
  validateResume(previousReport, config.baseUrl);

  const priorById = new Map((previousReport?.results || []).map(result => [result.id, result]));
  const resultsById = new Map([...priorById].filter(([id]) => czskCoachingGoldScenarios.some(scenario => scenario.id === id)));
  const trainingFixture = await loadAndVerifyTrainingFixture(config);
  const planned = czskCoachingGoldScenarios.map(scenario => ({
    scenario,
    request: mapGoldScenarioToRequest(scenario, { trainingFixture }),
  }));
  validatePlan(planned);

  const tasks = planned.filter(({ scenario }) => priorById.get(scenario.id)?.pass !== true);
  const reportPath = config.reportPath || resolve('reports', 'czsk-live-model-evals', `${runId}.json`);
  await persistCheckpoint({
    reportPath,
    resultsById,
    baseUrl: config.baseUrl,
    startedAt,
    resumedFrom: config.resumePath,
    allNeedles: conversationNeedles(),
  });

  config.logger(`CZ/SK synthetic live-model eval: ${planned.length} oddělených konverzací; ${tasks.length} spustit, ${planned.length - tasks.length} převzato PASS.`);
  for (let offset = 0; offset < tasks.length; offset += config.concurrency) {
    const batch = tasks.slice(offset, offset + config.concurrency);
    const completed = await Promise.all(batch.map(async ({ scenario, request }, batchIndex) => {
      const previousAttempts = Number(priorById.get(scenario.id)?.attempts || 0);
      try {
        const payload = await postJson(config, request.endpoint, request.body);
        return {
          ...evaluateCzskLiveResponse({ scenario, request, payload }),
          attempts: previousAttempts + 1,
        };
      } catch (error) {
        return failureResult({ scenario, request, error, attempt: previousAttempts + 1 });
      } finally {
        config.logger(`[${Math.min(offset + batchIndex + 1, tasks.length)}/${tasks.length}] ${scenario.id}`);
      }
    }));
    for (const result of completed) resultsById.set(result.id, result);
    await persistCheckpoint({
      reportPath,
      resultsById,
      baseUrl: config.baseUrl,
      startedAt,
      resumedFrom: config.resumePath,
      allNeedles: conversationNeedles(),
    });
  }

  const completedAt = new Date().toISOString();
  const report = summarizeCzskLiveEval([...resultsById.values()], {
    baseUrl: config.baseUrl,
    startedAt,
    completedAt,
    resumedFrom: config.resumePath || null,
  });
  ensurePrivateReport(report, conversationNeedles());
  await atomicWriteJson(reportPath, report);
  return { report, reportPath };
}

async function loadAndVerifyTrainingFixture(config) {
  const course = await getJson(config, `/api/courses/${LIFE_COACH_SLUG}`);
  const preliminary = buildTrainingFixture(course);
  const uniqueScenarios = [...new Map([...preliminary.scenariosByNumber.values()].map(item => [item.id, item])).values()];
  const verified = await Promise.all(uniqueScenarios.map(entry => getJson(
    config,
    `/api/training/scenario?courseSlug=${encodeURIComponent(preliminary.courseSlug)}&itemId=${encodeURIComponent(entry.itemId)}&difficulty=${encodeURIComponent(entry.difficulty)}&scenarioId=${encodeURIComponent(entry.id)}`,
  )));
  return buildTrainingFixture(course, verified);
}

function resolveConfig(options) {
  const baseUrl = String(options.baseUrl || process.env.ELITEA_CZSK_EVAL_URL || '').trim().replace(/\/$/u, '');
  if (!baseUrl) throw new Error('Nastav ELITEA_CZSK_EVAL_URL nebo použij --url. Žádný live eval nebyl spuštěn.');
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new Error('ELITEA_CZSK_EVAL_URL není platná URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Eval URL musí používat http nebo https.');
  const concurrency = boundedInteger(options.concurrency ?? process.env.ELITEA_CZSK_EVAL_CONCURRENCY, 2, 1, 4);
  const timeoutMs = boundedInteger(options.timeoutMs ?? process.env.ELITEA_CZSK_EVAL_TIMEOUT_MS, 180_000, 10_000, 600_000);
  return {
    baseUrl,
    origin: parsed.origin,
    jwt: String(options.jwt ?? process.env.ELITEA_CZSK_EVAL_JWT ?? '').trim(),
    concurrency,
    timeoutMs,
    resumePath: optionalPath(options.resumePath ?? process.env.ELITEA_CZSK_EVAL_RESUME),
    reportPath: optionalPath(options.reportPath ?? process.env.ELITEA_CZSK_EVAL_REPORT),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    logger: options.logger || console.log,
  };
}

function validateResume(report, baseUrl) {
  if (!report) return;
  if (Number(report.standardVersion) !== CZSK_LIVE_EVAL_STANDARD.version) {
    throw new Error(`Resume report používá standard ${report.standardVersion}; aktuální je ${CZSK_LIVE_EVAL_STANDARD.version}.`);
  }
  if (String(report.baseUrl || '') !== baseUrl) throw new Error('Resume report pochází z jiné URL.');
  if (report.evidence?.type !== CZSK_LIVE_EVAL_STANDARD.evidenceType || report.evidence?.humanReviewed !== false) {
    throw new Error('Resume report není syntetický live-model eval stejného typu.');
  }
}

function validatePlan(planned) {
  if (CZSK_COACHING_GOLD_STANDARD.scenarioCount !== CZSK_LIVE_EVAL_STANDARD.scenarioCount || planned.length !== CZSK_LIVE_EVAL_STANDARD.scenarioCount) {
    throw new Error(`Eval plán musí obsahovat přesně ${CZSK_LIVE_EVAL_STANDARD.scenarioCount} scénářů.`);
  }
  const chat = planned.filter(item => item.request.endpoint === '/api/chat').length;
  const training = planned.filter(item => item.request.endpoint === '/api/training').length;
  if (chat !== CZSK_LIVE_EVAL_STANDARD.expectedChatCases || training !== CZSK_LIVE_EVAL_STANDARD.expectedTrainingDebriefCases) {
    throw new Error(`Chybné routování eval plánu: chat=${chat}, training=${training}.`);
  }
  if (new Set(planned.map(item => item.scenario.id)).size !== planned.length) throw new Error('Eval plán obsahuje duplicitní ID.');
}

async function postJson(config, endpoint, body) {
  const response = await config.fetchImpl(`${config.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: requestHeaders(config),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  return parseResponse(response, endpoint);
}

async function getJson(config, endpoint) {
  const response = await config.fetchImpl(`${config.baseUrl}${endpoint}`, {
    headers: requestHeaders(config),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  return parseResponse(response, endpoint);
}

function requestHeaders(config) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    origin: config.origin,
    'user-agent': 'Elitea-CZSK-Synthetic-Live-Eval/1',
    ...(config.jwt ? { authorization: `Bearer ${config.jwt}` } : {}),
  };
}

async function parseResponse(response, endpoint) {
  const raw = await response.text();
  let payload = {};
  try { payload = JSON.parse(raw); } catch {}
  if (!response.ok) {
    const error = new Error(`${endpoint}: HTTP ${response.status}`);
    error.status = response.status;
    error.code = /^[A-Z0-9_]{2,80}$/u.test(String(payload?.code || '')) ? payload.code : null;
    throw error;
  }
  return payload;
}

async function persistCheckpoint({ reportPath, resultsById, baseUrl, startedAt, resumedFrom, allNeedles }) {
  const report = summarizeCzskLiveEval([...resultsById.values()], {
    baseUrl,
    startedAt,
    completedAt: null,
    resumedFrom: resumedFrom || null,
  });
  ensurePrivateReport(report, allNeedles);
  await atomicWriteJson(reportPath, report);
}

function ensurePrivateReport(report, needles) {
  if (reportContainsConversationText(report, needles)) {
    throw new Error('Ochrana soukromí zastavila zápis: report obsahuje text konverzace.');
  }
}

function conversationNeedles() {
  return czskCoachingGoldScenarios.flatMap(scenario => scenario.messages.map(message => message.content));
}

async function atomicWriteJson(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
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
    else if (flag === '--concurrency') options.concurrency = value;
    else if (flag === '--timeout-ms') options.timeoutMs = value;
    else if (flag === '--resume') options.resumePath = value;
    else if (flag === '--report') options.reportPath = value;
    else if (flag === '--help') options.help = true;
    else throw new Error(`Neznámý argument ${flag}.`);
  }
  return options;
}

function help() {
  return [
    'CZ/SK synthetic live-model eval (100 oddělených scénářů)',
    '',
    'ELITEA_CZSK_EVAL_URL=https://elitea.cz ELITEA_CZSK_EVAL_JWT=... npm run eval:czsk-live',
    '',
    'Volby: --url=URL --jwt=TOKEN --concurrency=1..4 --timeout-ms=MS --resume=REPORT --report=REPORT',
    'Report není lidské hodnocení a nepočítá se jako human-reviewed session.',
  ].join('\n');
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help) console.log(help());
    else {
      const { report, reportPath } = await runCzskLiveEvaluation(options);
      console.log(JSON.stringify({ ...report.summary, reportPath, evidence: report.evidence }, null, 2));
      if (!report.summary.complete) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
