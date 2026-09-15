import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { czskCoachingGoldScenarios } from '../data/czsk-coaching-gold.js';
import {
  adaptGoldTrainerTranscript,
  buildTrainingFixture,
  CZSK_LIVE_EVAL_STANDARD,
  evaluateCzskLiveResponse,
  isNearDuplicate,
  mapGoldScenarioToRequest,
  reportContainsConversationText,
  summarizeCzskLiveEval,
} from '../scripts/czsk-live-eval-core.mjs';
import { runCzskLiveEvaluation } from '../scripts/evaluate-czsk-coaching-live.mjs';

const fixtureCourse = {
  slug: 'profesionalni-life-coach-od-kontraktu-k-vysledku',
  mastery: {
    scenarios: [1, 3, 6, 13, 60].map(number => ({
      id: `profesionalni-life-coach:mastery-case-${String(number).padStart(2, '0')}`,
      itemId: `m${number}-1`,
      difficulty: number === 60 ? 'expert' : 'advanced',
    })),
  },
};
const fixture = buildTrainingFixture(fixtureCourse);

test('live plán routuje 90 koučovacích případů do chatu a 10 debriefů do trenérky', () => {
  const requests = czskCoachingGoldScenarios.map(scenario => mapGoldScenarioToRequest(scenario, { trainingFixture: fixture }));
  assert.equal(requests.length, 100);
  assert.equal(requests.filter(request => request.endpoint === '/api/chat').length, 90);
  assert.equal(requests.filter(request => request.endpoint === '/api/training').length, 10);
  assert.ok(requests.filter(request => request.endpoint === '/api/chat').every(request => request.body.messages.length === 3));
  assert.ok(requests.filter(request => request.endpoint === '/api/training').every(request => (
    request.body.courseSlug === fixtureCourse.slug
      && request.body.activity === 'simulation'
      && request.body.phase === 'debrief'
      && request.body.scenarioId
      && request.body.itemId
  )));
});

test('adaptér trenérky převádí popis mluvčích na skutečný důkazní přepis', () => {
  for (const scenario of czskCoachingGoldScenarios.filter(item => item.domain === 'coach-training-feedback')) {
    const messages = adaptGoldTrainerTranscript(scenario);
    assert.ok(messages.some(message => message.role === 'user' && !/ukonč|ukončujem/iu.test(message.content)));
    assert.ok(messages.some(message => message.role === 'assistant'));
    assert.match(messages.at(-1).content, /(?:Ukončuji simulaci|Ukončujem simuláciu)/u);
    assert.doesNotMatch(messages.map(message => message.content).join(' '), /Studentka (?:řekla|povedala)|Študentka povedala/u);
  }
});

test('evaluator měří češtinu, opakování a pozorovatelné rubric/must-not signály', () => {
  const scenario = czskCoachingGoldScenarios.find(item => item.id === 'cs-self-confidence-01-competitor-comparison');
  const request = mapGoldScenarioToRequest(scenario, { trainingFixture: fixture });
  const good = evaluateCzskLiveResponse({
    scenario,
    request,
    payload: {
      text: 'Rozumím, že rozdíl ve výsledcích teď bolí. Je to důležitý fakt, ale není to rozsudek o celé tobě. Jaký jeden malý experiment by ti dal férovější důkaz o tvém vlastním posunu?',
      provider: 'openai/gpt-5.6-sol',
      mode: 'koucovaci_hodina',
      activeRole: 'coach',
      qualityGate: { pass: true, score: 94, repaired: false, issueCodes: [] },
    },
  });
  assert.equal(good.pass, true);
  assert.equal(good.checks.find(check => check.name === 'response-language').pass, true);
  assert.equal(good.checks.find(check => check.name === 'rubric-observable-signals').pass, true);

  const bad = evaluateCzskLiveResponse({
    scenario,
    request,
    payload: {
      text: 'Určite si krásna a úspešná. Opakuj si, že si skvelá.',
      provider: 'demo-no-api-key',
      mode: 'koucovaci_hodina',
      activeRole: 'coach',
      qualityGate: { pass: false, issueCodes: ['response_language_mismatch'] },
    },
  });
  assert.equal(bad.pass, false);
  assert.equal(bad.checks.find(check => check.name === 'response-language').pass, false);
  assert.equal(bad.checks.find(check => check.name === 'must-not-observable-signals').pass, false);
  assert.equal(bad.checks.find(check => check.name === 'real-model-provider').pass, false);
  assert.equal(isNearDuplicate('Než přidáme cokoli dalšího, zůstaneme u účinku.', 'Než přidáme cokoliv dalšího, zůstaneme u účinku.'), true);
});

test('report ukládá jen otisky a výslovně není human-reviewed session', () => {
  const scenario = czskCoachingGoldScenarios[0];
  const request = mapGoldScenarioToRequest(scenario, { trainingFixture: fixture });
  const secretAnswer = 'Rozumím, že tohle teď opravdu bolí. Jaký jeden fakt potřebuješ prozkoumat?';
  const result = evaluateCzskLiveResponse({
    scenario,
    request,
    payload: { text: secretAnswer, provider: 'openai/test', mode: 'koucovaci_hodina', activeRole: 'coach', qualityGate: { pass: true } },
  });
  const report = summarizeCzskLiveEval([result], { baseUrl: 'https://example.test', startedAt: '2026-09-15T10:00:00Z', completedAt: '2026-09-15T10:01:00Z' });
  assert.equal(report.evidence.type, 'synthetic-live-model-eval');
  assert.equal(report.evidence.humanReviewed, false);
  assert.equal(report.evidence.qualifiesAsHumanReviewedSession, false);
  assert.equal(reportContainsConversationText(report, [secretAnswer]), false);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(secretAnswer, 'u'));
  assert.equal(result.fingerprints.sha256.length, 64);
});

test('runner bezpečně obnoví 99 hotových případů a spustí jen chybějící oddělenou konverzaci', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'elitea-czsk-eval-'));
  const resumePath = join(directory, 'resume.json');
  const reportPath = join(directory, 'result.json');
  const missing = czskCoachingGoldScenarios.find(item => item.id === 'cs-self-confidence-01-competitor-comparison');
  const reused = czskCoachingGoldScenarios.filter(item => item.id !== missing.id).map(scenario => ({
    id: scenario.id,
    locale: scenario.locale,
    domain: scenario.domain,
    endpoint: scenario.domain === 'coach-training-feedback' ? '/api/training' : '/api/chat',
    apiRole: scenario.domain === 'coach-training-feedback' ? 'coaching_trainer' : 'coach_mentor',
    pass: true,
    checks: [{ name: 'seed', pass: true }],
    fingerprints: { sha256: 'a'.repeat(64), normalizedSha256: 'b'.repeat(64) },
    provider: 'openai/test',
    quality: { pass: true },
    attempts: 1,
  }));
  const previous = summarizeCzskLiveEval(reused, {
    baseUrl: 'https://example.test',
    startedAt: '2026-09-15T09:00:00Z',
    completedAt: '2026-09-15T09:10:00Z',
  });
  await writeFile(resumePath, JSON.stringify(previous), 'utf8');

  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).includes(`/api/courses/${fixtureCourse.slug}`)) return jsonResponse(fixtureCourse);
    if (String(url).includes('/api/training/scenario?')) {
      const id = decodeURIComponent(new URL(url).searchParams.get('scenarioId'));
      return jsonResponse(fixtureCourse.mastery.scenarios.find(item => item.id === id));
    }
    assert.equal(String(url), 'https://example.test/api/chat');
    return jsonResponse({
      text: 'Rozumím, že rozdíl ve výsledcích bolí. Je to jeden fakt, ne rozsudek o celé tobě. Jaký malý experiment ti dá poctivější důkaz?',
      provider: 'openai/gpt-5.6-sol',
      mode: 'koucovaci_hodina',
      activeRole: 'coach',
      qualityGate: { pass: true, score: 93 },
    });
  };
  const { report } = await runCzskLiveEvaluation({
    baseUrl: 'https://example.test',
    jwt: 'test-token-not-written',
    resumePath,
    reportPath,
    fetchImpl,
    logger: () => {},
  });
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(report.summary.total, CZSK_LIVE_EVAL_STANDARD.scenarioCount);
  assert.equal(report.summary.complete, true);
  const saved = await readFile(reportPath, 'utf8');
  assert.doesNotMatch(saved, /test-token-not-written/u);
  assert.doesNotMatch(saved, /Rozumím, že rozdíl/u);
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}
