import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourses } from '../src/courses.js';
import { expandLifeCoachMaterials } from '../src/life-coach-materials.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const coursePath = join(root, 'data', 'course-profesionalni-life-coach.md');
const [source, materialSource, audio] = await Promise.all([
  readFile(coursePath, 'utf8'),
  readFile(join(root, 'data', 'course-profesionalni-life-coach-materials.json'), 'utf8'),
  readFile(join(root, 'data', 'course-profesionalni-life-coach-audio-scripts.md'), 'utf8'),
]);
const [course] = await loadCourses(coursePath);
const items = course.modules.flatMap(module => module.items);
const materials = expandLifeCoachMaterials(JSON.parse(materialSource));
assert.equal(course.moduleCount, 18);
assert.equal(course.itemCount, 108);
assert.equal(items.reduce((sum, item) => sum + item.minutes, 0), 2160);
for (const [index, module] of course.modules.entries()) {
  assert.equal(module.items.length, 6, `Modul ${index} nemá šest částí.`);
  assert.equal(module.items.reduce((sum, item) => sum + item.minutes, 0), 120);
  assert.deepEqual(module.items.map(item => item.kind), ['lesson','lesson','lesson','self-practice','client-practice','quiz']);
}
assert.equal(materials.length, 19);
assert.ok(course.modules.every((_, index) => materials.some(material => material.moduleIndex === index)));
assert.equal((audio.match(/^## AUDIO \d+ —/gm) || []).length, 10);
assert.equal((audio.match(/### Doslovný text/g) || []).length, 10);
for (const term of ['GROW','HEART','Kolo života','NLP','mindfulness','self-talk','přesvědčení','fear setting','niche','důvěrnost','ICF']) assert.ok(`${source}\n${audio}`.includes(term), `Chybí ${term}`);
assert.doesNotMatch(`${source}\n${audio}`, /Elitea|garantuji\s+(výsledek|léčbu)|vyléčí\s+(trauma|úzkost|depresi)/i);
console.log(JSON.stringify({ok:true,modules:18,items:108,minutes:2160,materials:19,audios:10}, null, 2));
