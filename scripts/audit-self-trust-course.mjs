import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCourses } from '../src/courses.js';
import { expandSelfTrustMaterials } from '../src/self-trust-materials.js';

const [course] = await loadCourses(fileURLToPath(new URL('../data/course-pevna-v-sobe.md', import.meta.url)));
const definitions = JSON.parse(await readFile(new URL('../data/course-pevna-v-sobe-materials.json', import.meta.url), 'utf8'));
const materials = expandSelfTrustMaterials(definitions);
const audio = await readFile(new URL('../data/course-pevna-v-sobe-audio-scripts.md', import.meta.url), 'utf8');
const items = course.modules.flatMap(module => module.items);
const words = items.reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);

assert.equal(course.moduleCount, 20);
assert.equal(course.itemCount, 120);
assert.equal(items.reduce((sum, item) => sum + item.minutes, 0), 2400);
assert.ok(course.modules.every(module => module.items.length === 6));
assert.equal(items.filter(item => item.kind === 'lesson').length, 60);
assert.equal(items.filter(item => item.kind === 'self-practice').length, 20);
assert.equal(items.filter(item => item.kind === 'client-practice').length, 20);
assert.equal(items.filter(item => item.kind === 'quiz').length, 20);
assert.ok(words >= 10000, `Kurz má pouze ${words} slov.`);
assert.equal(materials.length, 21);
assert.ok(course.modules.every((_, index) => materials.some(material => material.moduleIndex === index)));
assert.equal((audio.match(/^## AUDIO \d+ —/gm) || []).length, 12);
assert.equal((audio.match(/### Doslovný text/g) || []).length, 12);
const corpus = `${items.map(item => item.markdown).join('\n')}\n${audio}`.toLowerCase();
for (const term of ['omluva','people-pleasing','hranice','pochvala','imposter','automatické myšlenky','růstové nastavení','sebesoucit','systémová']) {
  assert.ok(corpus.includes(term), `Chybí téma: ${term}`);
}
assert.doesNotMatch(corpus, /vyléčí\s+(trauma|depresi|úzkost)|garantuji\s+(sebevědomí|výsledek)|imposter\s+syndrom\s+je\s+diagnóza/i);

console.log(JSON.stringify({ ok:true, modules:20, items:120, minutes:2400, words, materials:21, audios:12 }, null, 2));
