import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTechniqueAtlas } from '../src/technique-atlas.js';
import { buildWorksheetLibrary } from '../src/worksheets.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const atlas = await loadTechniqueAtlas(join(ROOT, 'data', 'master-technique-atlas.json'));
const library = buildWorksheetLibrary(atlas);

test('knihovna vytváří pracovní list ke každé AI koučovací technice', () => {
  const available = atlas.filter(card => card.access_level === 'ai_coaching');
  assert.equal(library.items.length, available.length);
  assert.ok(library.items.length >= 140);
  assert.equal(new Set(library.items.map(item => item.techniqueId)).size, library.items.length);
});

test('pracovní listy neobsahují podpůrné ani human-only techniky', () => {
  const allowed = new Set(atlas.filter(card => card.access_level === 'ai_coaching').map(card => card.id));
  assert.ok(library.items.every(item => allowed.has(item.techniqueId)));
  assert.ok(!library.items.some(item => ['emdr', 'prolonged_exposure', 'regression_hypnosis'].includes(item.techniqueId)));
});

test('každý pracovní list vysvětluje smysl, možné zjištění, výstup i způsob použití', () => {
  for (const worksheet of library.items) {
    assert.ok(worksheet.title.length > 1);
    assert.ok(worksheet.method.length > 20);
    assert.ok(worksheet.boundary.length > 4);
    assert.ok(worksheet.purpose.length > 100);
    assert.ok(worksheet.canDiscover.length > 100);
    assert.ok(worksheet.takeaway.length > 100);
    assert.ok(worksheet.usageSummary.length > 40);
    assert.equal(worksheet.howToUse.length, 4);
    assert.ok(worksheet.howToUse.every(step => step.length > 70));
    assert.equal(worksheet.prompts.length, 5);
    assert.equal(new Set(worksheet.prompts.map(prompt => prompt.id)).size, 5);
    assert.ok(worksheet.prompts.every(prompt => prompt.label && prompt.help));
  }
  assert.ok(library.categories.length >= 8);
});
