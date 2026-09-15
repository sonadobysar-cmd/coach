import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertPrivateStatefulReport,
  evaluateStatefulTurn,
  runStatefulScenario,
  STATEFUL_COACHING_SCENARIOS,
  STATEFUL_COACHING_STANDARD,
  summarizeStatefulCoachingEval,
} from '../scripts/stateful-coaching-eval-core.mjs';
import { runStatefulCoachingLiveEvaluation } from '../scripts/evaluate-stateful-coaching-live.mjs';

test('stavový plán pokrývá opravu workshopu, neúčinnou techniku, CZ/SK, dlouhou paměť a smyčky', () => {
  assert.equal(STATEFUL_COACHING_SCENARIOS.length, STATEFUL_COACHING_STANDARD.scenarioCount);
  assert.equal(
    STATEFUL_COACHING_SCENARIOS.reduce((sum, scenario) => sum + scenario.turns.length, 0),
    STATEFUL_COACHING_STANDARD.turnCount,
  );
  const capabilities = new Set(STATEFUL_COACHING_SCENARIOS.flatMap(scenario => scenario.capabilities));
  for (const expected of ['workshop-failure', 'external-stop-scope', 'no-effect-pivot', 'long-memory', 'loop-prevention', 'slovak']) {
    assert.ok(capabilities.has(expected), expected);
  }
  assert.ok(STATEFUL_COACHING_SCENARIOS.find(scenario => scenario.id === 'cs-long-session-memory').turns.length >= 12);
});

test('runner posílá celý skutečný přepis a mezi tahy přenáší techniku i specialistku', async () => {
  const custom = {
    id: 'state-carry',
    locale: 'cs-CZ',
    language: 'cs',
    consultationMode: 'coaching_session',
    capabilities: ['state-carry'],
    turns: [
      { id: 'one', content: 'Mám strach z dalšího kroku.', requires: [], forbids: [] },
      { id: 'two', content: 'Chci přesto pokračovat.', requires: [], forbids: [] },
    ],
  };
  const calls = [];
  const techniqueSession = { techniqueId: 'fact-feeling-separation', phase: 'assessment', turns: 1 };
  const specialistSession = { primary: 'professional_coach', active: ['professional_coach'] };
  const responses = [
    'Rozumím, že strach teď stojí vedle tvého dalšího kroku. Co o něm potřebuješ zjistit?',
    'Beru, že chceš pokračovat. Jaký nejmenší krok je pro tebe dnes skutečně proveditelný?',
  ];
  const result = await runStatefulScenario({
    scenario: custom,
    postJson: async (_endpoint, body) => {
      calls.push(structuredClone(body));
      return {
        text: responses[calls.length - 1],
        provider: 'openai/gpt-5.6-sol',
        qualityGate: { pass: true, score: 95, issueCodes: [] },
        mode: 'koucovaci_hodina',
        activeRole: 'coach',
        techniqueSession,
        specialistSession,
      };
    },
  });
  assert.equal(result.pass, true);
  assert.equal(calls[0].messages.length, 1);
  assert.equal(calls[0].techniqueSession, null);
  assert.equal(calls[1].messages.length, 3);
  assert.deepEqual(calls[1].messages.map(message => message.role), ['user', 'assistant', 'user']);
  assert.deepEqual(calls[1].techniqueSession, techniqueSession);
  assert.deepEqual(calls[1].specialistSession, specialistSession);
  assert.equal(result.state.accumulatedMessages, 4);
});

test('deterministické aserce zachytí známou smyčku i opakování starší odpovědi', () => {
  const scenario = { language: 'cs' };
  const turn = { id: 'loop', requires: [], forbids: [] };
  const repeated = 'Než přidáme cokoli dalšího, potřebuji zůstat u účinku právě provedeného kroku. Co se teď změnilo?';
  const result = evaluateStatefulTurn({
    scenario,
    turn,
    priorAssistantTexts: [repeated],
    payload: {
      text: repeated,
      provider: 'openai/gpt-5.6-sol',
      qualityGate: { pass: true, score: 92 },
      mode: 'koucovaci_hodina',
      activeRole: 'coach',
    },
  });
  assert.equal(result.pass, false);
  assert.equal(result.checks.find(check => check.name === 'no-prior-answer-loop').pass, false);
  assert.equal(result.checks.find(check => check.name === 'no-known-loop-template').pass, false);
});

test('workshopová oprava odmítne falešné ukončení sezení', () => {
  const scenario = STATEFUL_COACHING_SCENARIOS.find(item => item.id === 'cs-workshop-intent-repair');
  const turn = scenario.turns.find(item => item.id === 'scope-correction');
  const good = evaluateStatefulTurn({
    scenario,
    turn,
    payload: payload('Máš pravdu: končíš s workshopy, ne s naším rozhovorem. Podíváme se, co můžeš dělat místo nich. Který výsledek chceš zachovat?'),
  });
  const bad = evaluateStatefulTurn({
    scenario,
    turn,
    payload: payload('Rozumím, zastavíme dnešní sezení a celý rozhovor teď ukončíme.'),
  });
  assert.equal(good.pass, true);
  assert.equal(bad.pass, false);
  assert.equal(bad.checks.find(check => check.name === 'turn-forbidden-signals').pass, false);
});

test('dlouhá paměť vyžaduje všechna doložená fakta a zachování neznámého důvodu', () => {
  const scenario = STATEFUL_COACHING_SCENARIOS.find(item => item.id === 'cs-long-session-memory');
  const turn = scenario.turns.at(-1);
  const good = evaluateStatefulTurn({
    scenario,
    turn,
    payload: payload('Doložená fakta: přihlásily se tři ženy, dvě zůstaly do konce a jedna díky cvičení získala prvního klienta. Proč třetí odešla, nevíme.'),
  });
  const invented = evaluateStatefulTurn({
    scenario,
    turn,
    payload: payload('Přihlásily se tři ženy, dvě zůstaly a jedna získala prvního klienta. Třetí odešla proto, že ji workshop nebavil.'),
  });
  assert.equal(good.pass, true);
  assert.equal(invented.pass, false);
  assert.equal(invented.checks.find(check => check.name === 'turn-required-signals').pass, false);
  assert.equal(invented.checks.find(check => check.name === 'turn-forbidden-signals').pass, false);
});

test('CZ/SK evaluator uzná přirozený pivot, ale dál odmítne synonymní dechovou nabídku', () => {
  const cases = [
    {
      scenarioId: 'cs-no-effect-pivot',
      goodText: 'Pojmenování pocitu necháme stranou, protože nepřineslo změnu. Přejděme přímo k hovoru: jaká věta ti proběhla hlavou?',
      badText: 'Můžeme místo toho zkusit přirozený dech bez tlaku. Chceš ho vyzkoušet?',
      disguisedRetry: 'Pomalý dech nebudeme opakovat, ale zkusme přirozené dýchání.',
    },
    {
      scenarioId: 'sk-no-effect-pivot',
      goodText: 'Pomenovanie pocitu necháme bokom, pretože nič nezmenilo. Poďme priamo k hovoru: aká veta ti prebehla hlavou?',
      badText: 'Môžeme namiesto toho skúsiť prirodzený dych bez tlaku. Chceš ho vyskúšať?',
      disguisedRetry: 'Pomalý dych nebudeme opakovať, ale skúsme prirodzené dýchanie.',
    },
  ];
  for (const item of cases) {
    const scenario = STATEFUL_COACHING_SCENARIOS.find(candidate => candidate.id === item.scenarioId);
    const turn = scenario.turns.find(candidate => candidate.id === 'second-no-effect');
    const techniqueSession = { blockedModalities: ['breath', 'emotion_labeling'] };
    const good = evaluateStatefulTurn({ scenario, turn, payload: { ...payload(item.goodText), techniqueSession } });
    const bad = evaluateStatefulTurn({ scenario, turn, payload: { ...payload(item.badText), techniqueSession } });
    const disguised = evaluateStatefulTurn({ scenario, turn, payload: { ...payload(item.disguisedRetry), techniqueSession } });
    assert.equal(good.pass, true, item.scenarioId);
    assert.equal(bad.pass, false, item.scenarioId);
    assert.equal(disguised.pass, false, `${item.scenarioId}: disguised retry`);
    assert.equal(bad.checks.find(check => check.name === 'turn-forbidden-signals').pass, false, item.scenarioId);
    assert.equal(disguised.checks.find(check => check.name === 'turn-forbidden-signals').pass, false, item.scenarioId);
  }
});

test('stavový evaluator nepropustí pouhé uznání bez nové užitečné cesty', () => {
  const workshop = STATEFUL_COACHING_SCENARIOS.find(item => item.id === 'cs-workshop-intent-repair');
  const uncertainty = workshop.turns.find(item => item.id === 'uncertain-direction');
  const emptySupport = evaluateStatefulTurn({
    scenario: workshop,
    turn: uncertainty,
    payload: payload('Rozumím, že zatím nevíš. Jsem tu s tebou.'),
  });
  assert.equal(emptySupport.pass, false);

  const noEffect = STATEFUL_COACHING_SCENARIOS.find(item => item.id === 'cs-no-effect-pivot');
  const firstNoEffect = noEffect.turns.find(item => item.id === 'first-no-effect');
  const acknowledgementOnly = evaluateStatefulTurn({
    scenario: noEffect,
    turn: firstNoEffect,
    payload: {
      ...payload('Rozumím, pomalý dech ti nepomohl.'),
      techniqueSession: { blockedModalities: ['breath'] },
    },
  });
  assert.equal(acknowledgementOnly.pass, false);
});

test('report neukládá konverzaci, session payload ani JWT a zůstává syntetickým důkazem', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'elitea-stateful-eval-'));
  const reportPath = join(directory, 'report.json');
  const secretInput = 'Tajný vícekolový vstup testerky.';
  const secretAnswer = 'Tajná empatická odpověď Elitey.';
  const custom = [{
    id: 'private-stateful',
    locale: 'cs-CZ',
    language: 'cs',
    capabilities: ['privacy'],
    turns: [{ id: 'one', content: secretInput, requires: [], forbids: [] }],
  }];
  const fetchImpl = async (_url, options) => {
    assert.match(options.headers.authorization, /test-secret-jwt/u);
    return new Response(JSON.stringify(payload(secretAnswer)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const { report } = await runStatefulCoachingLiveEvaluation({
    baseUrl: 'https://example.test',
    jwt: 'test-secret-jwt',
    reportPath,
    scenarios: custom,
    fetchImpl,
    logger: () => {},
  });
  const saved = await readFile(reportPath, 'utf8');
  assert.equal(report.evidence.type, 'synthetic-stateful-live-model-eval');
  assert.equal(report.evidence.humanReviewed, false);
  assert.equal(report.evidence.qualifiesAsHumanReviewedSession, false);
  assert.equal(assertPrivateStatefulReport(report, [secretInput, secretAnswer]), true);
  assert.doesNotMatch(saved, /Tajný vícekolový|Tajná empatická|test-secret-jwt/u);
});

test('souhrn označí kompletní pouze celý standard bez jediné chyby', () => {
  const results = STATEFUL_COACHING_SCENARIOS.map(scenario => ({
    id: scenario.id,
    locale: scenario.locale,
    capabilities: scenario.capabilities,
    pass: true,
    turns: scenario.turns.map(selectedTurn => ({ id: selectedTurn.id, pass: true })),
    state: {},
  }));
  const complete = summarizeStatefulCoachingEval(results, { baseUrl: 'https://example.test' });
  assert.equal(complete.summary.complete, true);
  results[0].pass = false;
  results[0].turns[0].pass = false;
  const failed = summarizeStatefulCoachingEval(results, { baseUrl: 'https://example.test' });
  assert.equal(failed.summary.complete, false);
});

function payload(text) {
  return {
    text,
    provider: 'openai/gpt-5.6-sol',
    qualityGate: { pass: true, score: 95, issueCodes: [] },
    mode: 'koucovaci_hodina',
    activeRole: 'coach',
    techniqueSession: null,
    specialistSession: { primary: 'professional_coach' },
  };
}
