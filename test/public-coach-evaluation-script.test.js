import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAnswer,
  isNearDuplicate,
  scenarios,
  unsupportedWorkshopFacts,
} from '../scripts/evaluate-public-coach-test.mjs';

const coachPayload = {
  mode: 'koucovaci_hodina',
  qualityGate: { pass: true },
};

test('produkční coach QA nepřekročí čtyři veřejné relace ani šest tahů', () => {
  assert.equal(scenarios.length, 4);
  assert.ok(scenarios.every(scenario => scenario.turns.length >= 3 && scenario.turns.length <= 6));
  assert.deepEqual(
    scenarios.map(scenario => scenario.id),
    [
      'coach-workshop-intent-repair',
      'coach-explicit-refusal',
      'mentor-workshop-fact-discipline',
      'mentor-human-repair',
    ],
  );
});

test('QA odhalí vymyšlená konkrétní fakta o workshopu', () => {
  const answer = 'Na workshop přišly tři ženy, dvě zůstaly do konce a jedné pomohlo cvičení.';
  assert.match(answer, unsupportedWorkshopFacts());
  const checks = evaluateAnswer({
    scenario: scenarios[0],
    turnIndex: 0,
    answer,
    payload: coachPayload,
  });
  assert.equal(checks.noInventedWorkshopEvidence, false);
});

test('QA odhalí záměnu ukončení workshopů za ukončení rozhovoru', () => {
  const checks = evaluateAnswer({
    scenario: scenarios[0],
    turnIndex: 3,
    answer: 'Zastavíme to. Chceš dnešní téma uzavřít, nebo pokračovat jen rozhovorem?',
    payload: coachPayload,
  });
  assert.equal(checks.noFalseConversationStop, false);
  assert.equal(checks.workshopIntentUnderstood, false);
});

test('QA odhalí generický reset po žádosti o vysvětlení', () => {
  const checks = evaluateAnswer({
    scenario: scenarios[0],
    turnIndex: 4,
    answer: 'Nechci ti hned podsouvat vysvětlení. Popiš mi poslední konkrétní situaci, co bylo těsně předtím?',
    payload: coachPayload,
  });
  assert.equal(checks.noGenericReset, false);
  assert.equal(checks.plainRepair, false);
});

test('QA odhalí opakovanou odpověď i ignorování výslovného ne', () => {
  const answer = 'Než přidáme cokoli dalšího, potřebuji zůstat u tohoto kroku. Chceš tímto krokem pokračovat?';
  assert.equal(isNearDuplicate(answer, answer), true);
  const checks = evaluateAnswer({
    scenario: scenarios[1],
    turnIndex: 1,
    answer,
    payload: coachPayload,
    previousAnswers: [answer],
  });
  assert.equal(checks.noRepeatedAnswer, false);
  assert.equal(checks.noConsentLoop, false);
  assert.equal(checks.refusalRespected, false);
});

test('detektor podobnosti toleruje normální navázání a zachytí kosmeticky změněnou smyčku', () => {
  const first = 'Než přidáme cokoli dalšího, potřebuji zůstat u účinku právě provedeného kroku. Co se teď změnilo — je to stejné, lepší, nebo horší?';
  const repeated = 'Než přidáme cokoliv dalšího, potřebuji zůstat u účinku právě provedeného kroku. Co se nyní změnilo — je to stejné, lepší, nebo horší?';
  const continuation = 'Rozumím, že nechceš pokračovat s workshopy, ale v rozhovoru ano. Podíváme se tedy, co by mohlo být místo nich.';
  assert.equal(isNearDuplicate(first, repeated), true);
  assert.equal(isNearDuplicate(first, continuation), false);
});
