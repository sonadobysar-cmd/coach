import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertPrivateStatefulReport,
  runStatefulScenario,
  STATEFUL_COACHING_SCENARIOS,
  STATEFUL_COACHING_STANDARD,
  summarizeStatefulCoachingEval,
} from './stateful-coaching-eval-core.mjs';

export async function runStatefulCoachingLiveEvaluation(options = {}) {
  const config = resolveConfig(options);
  const scenarios = options.scenarios || STATEFUL_COACHING_SCENARIOS;
  validatePlan(scenarios, { strict: !options.scenarios });
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/gu, '-');
  const reportPath = config.reportPath || resolve('reports', 'stateful-coaching-live-evals', `${runId}.json`);
  const results = [];

  config.logger(`Stavový CZ/SK live-model eval: ${scenarios.length} skutečných vícekolových sezení, ${scenarios.reduce((sum, item) => sum + item.turns.length, 0)} navazujících tahů.`);
  for (const [index, scenario] of scenarios.entries()) {
    try {
      const result = await runStatefulScenario({
        scenario,
        postJson: (endpoint, body) => postJson(config, endpoint, body),
      });
      results.push(result);
      config.logger(`[${index + 1}/${scenarios.length}] ${scenario.id}: ${result.pass ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      results.push(failedScenario(scenario, error));
      config.logger(`[${index + 1}/${scenarios.length}] ${scenario.id}: ERROR`);
    }
    await persist({ reportPath, results, config, scenarios, startedAt, completedAt: null });
  }

  const report = summarizeStatefulCoachingEval(results, {
    baseUrl: config.baseUrl,
    startedAt,
    completedAt: new Date().toISOString(),
  });
  ensurePrivate(report, scenarios);
  await atomicWriteJson(reportPath, report);
  return { report, reportPath };
}

function resolveConfig(options) {
  const baseUrl = String(options.baseUrl || process.env.ELITEA_STATEFUL_EVAL_URL || '').trim().replace(/\/$/u, '');
  if (!baseUrl) throw new Error('Nastav ELITEA_STATEFUL_EVAL_URL nebo použij --url. Žádný live eval nebyl spuštěn.');
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new Error('ELITEA_STATEFUL_EVAL_URL není platná URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Eval URL musí používat http nebo https.');
  return {
    baseUrl,
    origin: parsed.origin,
    jwt: String(options.jwt ?? process.env.ELITEA_STATEFUL_EVAL_JWT ?? '').trim(),
    timeoutMs: boundedInteger(options.timeoutMs ?? process.env.ELITEA_STATEFUL_EVAL_TIMEOUT_MS, 180_000, 10_000, 600_000),
    reportPath: optionalPath(options.reportPath ?? process.env.ELITEA_STATEFUL_EVAL_REPORT),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    logger: options.logger || console.log,
  };
}

function validatePlan(scenarios, { strict }) {
  if (!Array.isArray(scenarios) || !scenarios.length) throw new Error('Eval plán je prázdný.');
  if (new Set(scenarios.map(item => item.id)).size !== scenarios.length) throw new Error('Eval plán obsahuje duplicitní ID.');
  if (!strict) return;
  const turnCount = scenarios.reduce((sum, item) => sum + item.turns.length, 0);
  if (scenarios.length !== STATEFUL_COACHING_STANDARD.scenarioCount || turnCount !== STATEFUL_COACHING_STANDARD.turnCount) {
    throw new Error(`Standard vyžaduje ${STATEFUL_COACHING_STANDARD.scenarioCount} sezení a ${STATEFUL_COACHING_STANDARD.turnCount} tahů.`);
  }
  const capabilities = new Set(scenarios.flatMap(item => item.capabilities || []));
  for (const required of ['workshop-failure', 'external-stop-scope', 'no-effect-pivot', 'long-memory', 'loop-prevention', 'slovak']) {
    if (!capabilities.has(required)) throw new Error(`Eval plán nepokrývá ${required}.`);
  }
}

async function postJson(config, endpoint, body) {
  const response = await config.fetchImpl(`${config.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: config.origin,
      'user-agent': 'Elitea-Stateful-Coaching-Live-Eval/1',
      ...(config.jwt ? { authorization: `Bearer ${config.jwt}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
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

async function persist({ reportPath, results, config, scenarios, startedAt, completedAt }) {
  const report = summarizeStatefulCoachingEval(results, {
    baseUrl: config.baseUrl,
    startedAt,
    completedAt,
  });
  ensurePrivate(report, scenarios);
  await atomicWriteJson(reportPath, report);
}

function ensurePrivate(report, scenarios) {
  return assertPrivateStatefulReport(report, scenarios.flatMap(item => item.turns.map(selectedTurn => selectedTurn.content)));
}

function failedScenario(scenario, error) {
  return {
    id: scenario.id,
    locale: scenario.locale,
    capabilities: [...(scenario.capabilities || [])],
    pass: false,
    turns: [{
      id: 'request-error',
      pass: false,
      checks: [{
        name: 'request-completed',
        pass: false,
        detail: {
          name: String(error?.name || 'Error').slice(0, 80),
          code: /^[A-Z0-9_]{2,80}$/u.test(String(error?.code || '')) ? error.code : null,
          status: Number.isInteger(error?.status) ? error.status : null,
        },
      }],
      fingerprints: null,
      provider: null,
      mode: null,
      activeRole: null,
      techniquePhase: null,
      specialistPrimary: null,
      durationMs: 0,
    }],
    state: { accumulatedMessages: 0, techniquePhase: null, specialistPrimary: null },
  };
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
    else if (flag === '--timeout-ms') options.timeoutMs = value;
    else if (flag === '--report') options.reportPath = value;
    else if (flag === '--help') options.help = true;
    else throw new Error(`Neznámý argument ${flag}.`);
  }
  return options;
}

function help() {
  return [
    'Stavový CZ/SK live-model eval skutečných vícekolových koučovacích sezení',
    '',
    'ELITEA_STATEFUL_EVAL_URL=http://127.0.0.1:4173 npm run eval:stateful-coach',
    '',
    'Volby: --url=URL --jwt=TOKEN --timeout-ms=MS --report=REPORT',
    'Report neobsahuje texty konverzací a nepočítá se jako human-reviewed session.',
  ].join('\n');
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
      console.log(help());
      process.exitCode = 0;
    } else {
      const { report, reportPath } = await runStatefulCoachingLiveEvaluation(options);
      console.log(JSON.stringify({ reportPath, summary: report.summary }, null, 2));
      process.exitCode = report.summary.complete ? 0 : 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

