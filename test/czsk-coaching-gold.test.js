import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CZSK_COACHING_GOLD_STANDARD,
  czskCoachingGoldScenarios,
  getCzskCoachingGoldScenarios,
} from '../data/czsk-coaching-gold.js';

const expectedDomains = new Set(CZSK_COACHING_GOLD_STANDARD.domains);

test('offline gold benchmark contains exactly 100 balanced CZ/SK multi-turn scenarios', () => {
  assert.equal(czskCoachingGoldScenarios.length, 100);
  assert.equal(getCzskCoachingGoldScenarios({ locale: 'cs-CZ' }).length, 50);
  assert.equal(getCzskCoachingGoldScenarios({ locale: 'sk-SK' }).length, 50);
  assert.equal(new Set(czskCoachingGoldScenarios.map(scenario => scenario.id)).size, 100);

  for (const locale of ['cs-CZ', 'sk-SK']) {
    for (const domain of expectedDomains) {
      assert.equal(
        getCzskCoachingGoldScenarios({ locale, domain }).length,
        CZSK_COACHING_GOLD_STANDARD.casesPerDomainAndLocale,
        `${locale}/${domain}: expected five scenarios`,
      );
    }
  }
});

test('every scenario has a complete launch-evaluation contract and is labelled as synthetic', () => {
  for (const scenario of czskCoachingGoldScenarios) {
    assert.ok(expectedDomains.has(scenario.domain), `${scenario.id}: unknown domain`);
    assert.match(scenario.id, /^(?:cs|sk)-[a-z0-9-]+$/u);
    assert.ok(scenario.title.length >= 8, `${scenario.id}: missing title`);
    assert.ok(scenario.role.length >= 5, `${scenario.id}: missing role`);
    assert.ok(scenario.mode.length >= 5, `${scenario.id}: missing mode`);
    assert.ok(['normal', 'heightened', 'critical'].includes(scenario.risk), `${scenario.id}: invalid risk`);
    assert.ok(scenario.messages.length >= 3, `${scenario.id}: not multi-turn`);
    assert.equal(scenario.messages.at(-1).role, 'user', `${scenario.id}: must end before assistant response`);
    scenario.messages.forEach((message, index) => {
      assert.equal(message.role, index % 2 === 0 ? 'user' : 'assistant', `${scenario.id}: broken role sequence`);
      assert.ok(message.content.trim().split(/\s+/u).length >= 3, `${scenario.id}: shallow turn ${index + 1}`);
    });
    assert.ok(scenario.rubric.length >= 3, `${scenario.id}: incomplete rubric`);
    assert.ok(scenario.must_not.length >= 2, `${scenario.id}: incomplete prohibitions`);
    assert.ok(scenario.expected_response_traits.length >= 3, `${scenario.id}: missing expected traits`);
    assert.ok(scenario.rubric.every(item => item.trim().split(/\s+/u).length >= 3), `${scenario.id}: shallow rubric`);
    assert.ok(scenario.must_not.every(item => item.trim().split(/\s+/u).length >= 2), `${scenario.id}: shallow prohibition`);
    assert.equal(scenario.evidence_type, 'synthetic-offline-gold');
    assert.equal(scenario.live_human_session, false);
  }
});

test('Slovak half is independently localized, not Czech text with a locale flag', () => {
  const slovakMarkers = /\b(?:som|sme|sa|nie|nechcem|chcem|keď|iba|čo|pre|svoj\p{L}*|tvoj\p{L}*|môj\p{L}*|mám|viem|neviem|aby|ktor\p{L}*|ďal\p{L}*|ponúk\p{L}*|úloh\p{L}*|študentk\p{L}*|povedal\p{L}*|odpovedal\p{L}*|vôbec|znovu|urob\p{L}*|robi\p{L}*|zosta\p{L}*|ľudsk\p{L}*|práve|presn\p{L}*)\b/giu;
  const czechOnly = /[řěů]|\b(?:jsem|jsi|chci|nechci|nevím|můžeš|když|třeba|všechno|řekla|udělala|připadá)\b/iu;
  const slovakOnlyChars = /[ôľĺŕä]/iu;

  for (const scenario of getCzskCoachingGoldScenarios({ locale: 'sk-SK' })) {
    const text = scenarioText(scenario);
    assert.doesNotMatch(text, czechOnly, `${scenario.id}: contains Czech-only morphology`);
    const markers = new Set(text.match(slovakMarkers) || []);
    assert.ok(markers.size >= 2, `${scenario.id}: too few Slovak markers`);
  }

  for (const scenario of getCzskCoachingGoldScenarios({ locale: 'cs-CZ' })) {
    assert.doesNotMatch(scenarioText(scenario), slovakOnlyChars, `${scenario.id}: contains Slovak-only orthography`);
  }
});

test('scenario kernels are substantively distinct and contain no shallow duplicates', () => {
  const transcriptSignatures = new Set();
  const finalTurnSignatures = new Set();

  for (const scenario of czskCoachingGoldScenarios) {
    const transcript = normalize(scenario.messages.map(message => `${message.role}:${message.content}`).join(' '));
    const finalTurn = `${scenario.locale}:${normalize(scenario.messages.at(-1).content)}`;
    assert.equal(transcriptSignatures.has(transcript), false, `${scenario.id}: duplicate transcript`);
    assert.equal(finalTurnSignatures.has(finalTurn), false, `${scenario.id}: duplicate final turn`);
    transcriptSignatures.add(transcript);
    finalTurnSignatures.add(finalTurn);
  }

  for (const locale of ['cs-CZ', 'sk-SK']) {
    const localized = getCzskCoachingGoldScenarios({ locale });
    for (let left = 0; left < localized.length; left += 1) {
      for (let right = left + 1; right < localized.length; right += 1) {
        const similarity = jaccard(userVocabulary(localized[left]), userVocabulary(localized[right]));
        assert.ok(
          similarity < 0.55,
          `${localized[left].id}/${localized[right].id}: shallow lexical duplicate (${similarity.toFixed(2)})`,
        );
      }
    }
  }
});

test('benchmark breadth covers ordinary, heightened, coaching, mentoring, repair and trainer cases', () => {
  assert.deepEqual(new Set(czskCoachingGoldScenarios.map(scenario => scenario.domain)), expectedDomains);
  assert.ok(new Set(czskCoachingGoldScenarios.map(scenario => scenario.role)).size >= 5);
  assert.ok(new Set(czskCoachingGoldScenarios.map(scenario => scenario.mode)).size >= 8);
  assert.ok(getCzskCoachingGoldScenarios({ risk: 'heightened' }).length >= 4);
  assert.equal(getCzskCoachingGoldScenarios({ domain: 'coach-training-feedback' }).length, 10);
  assert.equal(getCzskCoachingGoldScenarios({ domain: 'alliance-repair' }).length, 10);
  assert.equal(getCzskCoachingGoldScenarios({ domain: 'no-effect-adaptation' }).length, 10);
});

function scenarioText(scenario) {
  return [
    scenario.title,
    ...scenario.messages.map(message => message.content),
    ...scenario.rubric,
    ...scenario.must_not,
    ...scenario.expected_response_traits,
  ].join(' ');
}

function normalize(value) {
  return String(value)
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function userVocabulary(scenario) {
  return new Set(normalize(
    scenario.messages.filter(message => message.role === 'user').map(message => message.content).join(' '),
  ).split(/\s+/u).filter(token => token.length >= 3));
}

function jaccard(left, right) {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection || 1);
}
