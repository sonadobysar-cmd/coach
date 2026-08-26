import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mergeUsage } from '../src/elitea.js';
import { trainingMemberProfile, trainingMode } from '../src/training.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const html = await readFile(`${ROOT}/public/index.html`, 'utf8');

test('hlavní přepínač nabízí jen dvě hlavní expertky', () => {
  const roles = [...html.matchAll(/data-assistant-role="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(roles, ['coach', 'brand']);
});

test('simulace v koučovacím výcviku patří koučovací trenérce', () => {
  assert.equal(trainingMode({ categoryId: 'coaching-mental-health' }, 'simulation'), 'coaching_trainer');
  assert.equal(trainingMode({ categoryId: 'coaching-mental-health' }, 'study'), 'study_trainer');
  assert.equal(trainingMode({ categoryId: 'brand-marketing' }, 'simulation'), 'study_trainer');
});

test('trenérky dostanou jen základní sdílený profil bez osobního tématu', () => {
  const profile = trainingMemberProfile({
    identity_preferences: { preferred_name: 'Klára', address_form: 'tykani' },
    business_context: { industry: 'fotografie', primary_offer: 'Citlivá nabídka' },
    coaching_profile: { support_accommodations: 'Jedna otázka', main_obstacle: 'Strach' },
    current_goal: 'Soukromé rozhodnutí',
    continuity: { last_focus: 'Vztah' },
  });
  assert.deepEqual(profile, {
    preferred_name: 'Klára',
    address_form: 'tykani',
    industry: 'fotografie',
    support_accommodations: 'Jedna otázka',
  });
  assert.doesNotMatch(JSON.stringify(profile), /Soukromé|Vztah|Strach|Citlivá nabídka/);
});

test('spotřeba se sčítá i přes opravu odpovědi', () => {
  assert.deepEqual(mergeUsage(
    { inputTokens: 100, outputTokens: 20, totalTokens: 120, inputTokenDetails: { cacheReadTokens: 50 } },
    { inputTokens: 80, outputTokens: 10, totalTokens: 90, inputTokenDetails: { cacheReadTokens: 30 } },
  ), {
    inputTokens: 180,
    outputTokens: 30,
    totalTokens: 210,
    inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: 80, cacheWriteTokens: undefined },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
  });
});

test('Founding 30 je výběrový program a veřejná cena zůstává 990 Kč', () => {
  assert.match(html, /ELITEA FOUNDING 30/);
  assert.match(html, /<strong>30<\/strong><small>vybraných členek<\/small>/);
  assert.match(html, /990 Kč/);
  assert.match(html, /3 placené měsíce za 590 Kč/);
  assert.doesNotMatch(html, /první tři placené měsíce 590 Kč pro každou/i);
});
