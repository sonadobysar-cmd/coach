import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContinuityPatch, emptyMemory, sanitizeMemory } from '../src/memory.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('každá prázdná paměť je samostatná kopie', () => {
  const first = emptyMemory();
  const second = emptyMemory();
  first.identity_preferences.preferred_name = 'Aneta';
  assert.equal(second.identity_preferences.preferred_name, '');
});

test('paměť ořízne text a odmítne neznámé volby', () => {
  const memory = sanitizeMemory({
    identity_preferences: { preferred_name: '  Aneta  ', address_form: 'neplatne' },
    business_context: { stage: 'tajna-faze', industry: 'beauty' },
  });

  assert.equal(memory.identity_preferences.preferred_name, 'Aneta');
  assert.equal(memory.identity_preferences.address_form, 'nezvoleno');
  assert.equal(memory.business_context.stage, 'nezjisteno');
  assert.equal(memory.business_context.industry, 'beauty');
});

test('koučovací profil zachová bezpečné preference a odmítne neznámý styl', () => {
  const safe = sanitizeMemory({
    coaching_profile: {
      onboarding_complete: true,
      desired_outcome: 'Dokončit nabídku',
      main_obstacle: 'Perfekcionismus',
      support_style: 'neznámý',
      weekly_capacity: '3 hodiny',
      personal_boundaries: 'Bez práce o víkendu',
      support_accommodations: 'Menší kroky a jedna priorita',
    },
    progress: {
      active_day_count: 4,
      last_active_day: '2026-08-21',
      completed_milestones: [{ title: 'První nabídka', completed_at: '2026-08-21T00:00:00.000Z' }],
    },
  });

  assert.equal(safe.schema_version, '3.2');
  assert.equal(safe.coaching_profile.onboarding_complete, true);
  assert.equal(safe.coaching_profile.support_style, 'kombinace');
  assert.equal(safe.coaching_profile.support_accommodations, 'Menší kroky a jedna priorita');
  assert.equal(safe.progress.active_day_count, 4);
  assert.equal(safe.progress.last_active_day, '2026-08-21');
  assert.equal(safe.progress.completed_milestones[0].title, 'První nabídka');
});

test('přímé identifikátory a tajné klíče se do pracovní paměti neuloží', () => {
  const safe = sanitizeMemory({
    business_context: {
      primary_offer: 'Weby, kontakt jana@example.cz, telefon +420 777 888 999',
    },
    current_goal: 'Klíč sk-abcdefghijklmnopqrstuv a karta 4111 1111 1111 1111',
  });

  assert.doesNotMatch(JSON.stringify(safe), /jana@example\.cz/);
  assert.doesNotMatch(JSON.stringify(safe), /777 888 999/);
  assert.doesNotMatch(JSON.stringify(safe), /sk-abcdefghijklmnopqrstuv/);
  assert.doesNotMatch(JSON.stringify(safe), /4111 1111 1111 1111/);
});

test('kontinuita ukládá bezpečné pracovní téma, ale ne trauma nebo zdravotní obsah', () => {
  const business = buildContinuityPatch({
    text: 'Řeším cenotvorbu nové brandingové služby pro malé firmy.',
    mode: 'mentoring',
    riskLevel: 'normal',
    memory: emptyMemory(),
  });
  const sensitive = buildContinuityPatch({
    text: 'Trauma mi zasahuje do podnikání a mám úzkost.',
    mode: 'podporna_stabilizace',
    riskLevel: 'heightened',
    memory: emptyMemory(),
  });

  assert.equal(business.roleMemory.role, 'coach');
  assert.match(business.roleMemory.continuity.last_focus, /cenotvorbu/);
  assert.equal(sensitive, null);
});

test('paměť dvou členek se nespojí ani při následné aktualizaci', () => {
  const aneta = sanitizeMemory({ identity_preferences: { preferred_name: 'Aneta' }, current_goal: 'Spustit salon' });
  const jana = sanitizeMemory({ identity_preferences: { preferred_name: 'Jana' }, current_goal: 'Nacenit weby' });
  const patch = buildContinuityPatch({
    text: 'Řeším marketing svého salonu.',
    mode: 'mentoring',
    riskLevel: 'normal',
    memory: aneta,
  });

  assert.equal(jana.identity_preferences.preferred_name, 'Jana');
  assert.equal(jana.current_goal, 'Nacenit weby');
  assert.doesNotMatch(JSON.stringify(jana), /Aneta|salonu/);
  assert.match(patch.roleMemory.continuity.last_focus, /salonu/);
});

test('koučovací a marketingová kontinuita zůstávají oddělené', () => {
  const memory = sanitizeMemory({
    role_memories: {
      coach: { continuity: { last_focus: 'Osobní rozhodnutí o vztahu', last_mode: 'mentoring' } },
      brand: { continuity: { last_focus: 'Obsahová série pro Instagram', last_mode: 'brand_growth_agent' } },
    },
  });
  assert.match(memory.role_memories.coach.continuity.last_focus, /vztahu/);
  assert.match(memory.role_memories.brand.continuity.last_focus, /Instagram/);
  assert.doesNotMatch(memory.role_memories.brand.continuity.last_focus, /vztahu/);
});

test('syrový chat je uložen jen v sessionStorage, ne v dlouhodobém localStorage', async () => {
  const client = await readFile(join(ROOT, 'public', 'app.js'), 'utf8');
  assert.match(client, /sessionStorage\.setItem\('elitea\.messages'/);
  assert.doesNotMatch(client, /localStorage\.setItem\('elitea\.messages'/);
});
