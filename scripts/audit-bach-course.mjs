import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandBachMaterials } from '../src/bach-materials.js';
import { loadCourses } from '../src/courses.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const coursePath = join(ROOT, 'data', 'course-bachovy-kvetove-esence.md');
const materialsPath = join(ROOT, 'data', 'course-bachovy-kvetove-esence-materials.json');
const audioPath = join(ROOT, 'data', 'course-bachovy-kvetove-esence-audio-scripts.md');
const [courseSource, materialSource, audioSource] = await Promise.all([
  readFile(coursePath, 'utf8'),
  readFile(materialsPath, 'utf8'),
  readFile(audioPath, 'utf8'),
]);
const [course] = await loadCourses(coursePath);
const items = course.modules.flatMap(module => module.items);
const materials = expandBachMaterials(JSON.parse(materialSource));
const words = items.reduce((sum, item) => sum + item.markdown
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean).length, 0);

assert.equal(course.moduleCount, 20, 'Kurz musí mít 20 modulů.');
assert.equal(course.itemCount, 120, 'Kurz musí mít 120 studijních částí.');
assert.equal(items.reduce((sum, item) => sum + item.minutes, 0), 2400, 'Kurz musí mít poctivých 40 hodin.');
assert.ok(words >= 8500, `Kurz má pouze ${words} slov studijního obsahu.`);
for (const [moduleIndex, module] of course.modules.entries()) {
  assert.equal(module.items.length, 6, `Modul ${moduleIndex} nemá šest částí.`);
  assert.equal(module.items.reduce((sum, item) => sum + item.minutes, 0), 120, `Modul ${moduleIndex} nemá 120 minut.`);
  assert.equal(module.items.filter(item => item.kind === 'lesson').length, 3, `Modul ${moduleIndex} nemá tři lekce.`);
  assert.equal(module.items.filter(item => item.kind === 'self-practice').length, 1, `Modul ${moduleIndex} nemá laboratoř.`);
  assert.equal(module.items.filter(item => item.kind === 'client-practice').length, 1, `Modul ${moduleIndex} nemá profesní simulaci.`);
  assert.equal(module.items.filter(item => item.kind === 'quiz').length, 1, `Modul ${moduleIndex} nemá test.`);
}

const remedies = [
  'Mimulus', 'Aspen', 'Red Chestnut', 'Cherry Plum', 'Rock Rose',
  'Cerato', 'Scleranthus', 'Gentian', 'Gorse', 'Hornbeam', 'Wild Oat',
  'Clematis', 'Honeysuckle', 'Wild Rose', 'Olive', 'White Chestnut', 'Mustard', 'Chestnut Bud',
  'Water Violet', 'Impatiens', 'Heather',
  'Agrimony', 'Centaury', 'Walnut', 'Holly',
  'Larch', 'Pine', 'Elm', 'Sweet Chestnut', 'Star of Bethlehem', 'Willow', 'Oak', 'Crab Apple',
  'Chicory', 'Vervain', 'Vine', 'Beech', 'Rock Water',
];
assert.equal(new Set(remedies).size, 38);
for (const remedy of remedies) assert.match(courseSource, new RegExp(`\\b${remedy}\\b`), `Chybí esence ${remedy}.`);

assert.equal(materials.length, 21, 'Kurz musí mít 20 modulových materiálů a audio balíček.');
assert.equal(new Set(materials.map(material => material.id)).size, 21, 'ID materiálů se nesmí opakovat.');
assert.ok(course.modules.every((_, moduleIndex) => materials.some(material => material.moduleIndex === moduleIndex)), 'Každý modul musí mít materiál.');
const itemIds = new Set(items.map(item => item.id));
assert.ok(materials.every(material => itemIds.has(material.itemId)), 'Každý materiál musí odkazovat na existující část.');
assert.ok(materials.every(material => material.howToUse.length >= 4 && material.prompts.length >= 5), 'Materiály musí mít úplný postup a pracovní pole.');

const audioSections = [...audioSource.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
assert.equal(audioSections.length, 10, 'Musí existovat deset audio scénářů.');
assert.deepEqual(audioSections.map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal((audioSource.match(/### Doslovný text/g) || []).length, 10, 'Každé audio musí mít doslovný text.');

for (const required of ['placebo', 'alkohol', 'souhlas', 'kriz', 'veterin', 'těhoten', 'první pomoc', 'nenahrazuje']) {
  assert.ok(`${courseSource}\n${audioSource}`.toLocaleLowerCase('cs').includes(required), `Chybí bezpečnostní téma: ${required}`);
}
assert.doesNotMatch(`${courseSource}\n${audioSource}`, /Elitea|Elitea Academy/i, 'V kurzu zůstal starý název značky.');
assert.doesNotMatch(`${courseSource}\n${audioSource}`, /100\s*%\s*(bezpeč|účinn)|garantovan[áýé]\s+(léčba|účinek)|nulov[éý]\s+vedlejší\s+účinky/i, 'Kurz obsahuje nepřijatelné absolutní zdravotní tvrzení.');

console.log(JSON.stringify({
  ok: true,
  modules: course.moduleCount,
  items: course.itemCount,
  minutes: items.reduce((sum, item) => sum + item.minutes, 0),
  studyWords: words,
  remedies: remedies.length,
  materials: materials.length,
  audioScripts: audioSections.length,
}, null, 2));
