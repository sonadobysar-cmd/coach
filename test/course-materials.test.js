import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCourse } from '../src/courses.js';
import { expandSelfTrustMaterials } from '../src/self-trust-materials.js';
import { expandAdhdMaterials } from '../src/adhd-materials.js';
import { expandBachMaterials } from '../src/bach-materials.js';
import { expandLifeCoachMaterials } from '../src/life-coach-materials.js';
import { expandWomensCircleMaterials } from '../src/womens-circle-materials.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const selfTrustMaterials = expandSelfTrustMaterials(JSON.parse(await readFile(join(ROOT, 'data', 'course-pevna-v-sobe-materials.json'), 'utf8')));
const selfTrustMarkdown = await readFile(join(ROOT, 'data', 'course-pevna-v-sobe.md'), 'utf8');
const selfTrustAudioScripts = await readFile(join(ROOT, 'data', 'course-pevna-v-sobe-audio-scripts.md'), 'utf8');
const selfTrustCourse = parseCourse(selfTrustMarkdown, { id: 'pevna-v-sobe-intensive' });
const selfTrustItemIds = new Set(selfTrustCourse.modules.flatMap(module => module.items.map(item => item.id)));
const materials = JSON.parse(await readFile(join(ROOT, 'data', 'course-spiritualni-koucink-materials.json'), 'utf8'));
const markdown = await readFile(join(ROOT, 'data', 'course-spiritualni-koucink.md'), 'utf8');
const audioScripts = await readFile(join(ROOT, 'data', 'course-spiritualni-koucink-audio-scripts.md'), 'utf8');
const course = parseCourse(markdown, { id: 'spiritualni-koucink-practice' });
const courseItemIds = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
const communicationMaterials = JSON.parse(await readFile(join(ROOT, 'data', 'course-komunikace-v-praxi-materials.json'), 'utf8'));
const communicationMarkdown = await readFile(join(ROOT, 'data', 'course-komunikace-v-praxi.md'), 'utf8');
const communicationAudioScripts = await readFile(join(ROOT, 'data', 'course-komunikace-v-praxi-audio-scripts.md'), 'utf8');
const communicationCourse = parseCourse(communicationMarkdown, { id: 'komunikace-v-praxi' });
const communicationItemIds = new Set(communicationCourse.modules.flatMap(module => module.items.map(item => item.id)));
const cbtMaterials = JSON.parse(await readFile(join(ROOT, 'data', 'course-kbt-koucink-v-praxi-materials.json'), 'utf8'));
const cbtMarkdown = await readFile(join(ROOT, 'data', 'course-kbt-koucink-v-praxi.md'), 'utf8');
const cbtAudioScripts = await readFile(join(ROOT, 'data', 'course-kbt-koucink-v-praxi-audio-scripts.md'), 'utf8');
const cbtCourse = parseCourse(cbtMarkdown, { id: 'kbt-koucink-v-praxi' });
const cbtItemIds = new Set(cbtCourse.modules.flatMap(module => module.items.map(item => item.id)));
const adhdMaterialDefinitions = JSON.parse(await readFile(join(ROOT, 'data', 'course-adhd-focus-motivace-materials.json'), 'utf8'));
const adhdMaterials = expandAdhdMaterials(adhdMaterialDefinitions);
const adhdMarkdown = await readFile(join(ROOT, 'data', 'course-adhd-focus-motivace.md'), 'utf8');
const adhdAudioScripts = await readFile(join(ROOT, 'data', 'course-adhd-focus-motivace-audio-scripts.md'), 'utf8');
const adhdCourse = parseCourse(adhdMarkdown, { id: 'adhd-focus-motivace' });
const adhdItemIds = new Set(adhdCourse.modules.flatMap(module => module.items.map(item => item.id)));
const bachMaterialDefinitions = JSON.parse(await readFile(join(ROOT, 'data', 'course-bachovy-kvetove-esence-materials.json'), 'utf8'));
const bachMaterials = expandBachMaterials(bachMaterialDefinitions);
const bachMarkdown = await readFile(join(ROOT, 'data', 'course-bachovy-kvetove-esence.md'), 'utf8');
const bachAudioScripts = await readFile(join(ROOT, 'data', 'course-bachovy-kvetove-esence-audio-scripts.md'), 'utf8');
const bachCourse = parseCourse(bachMarkdown, { id: 'bachovy-kvetove-esence' });
const bachItemIds = new Set(bachCourse.modules.flatMap(module => module.items.map(item => item.id)));
const lifeMaterials = expandLifeCoachMaterials(JSON.parse(await readFile(join(ROOT, 'data', 'course-profesionalni-life-coach-materials.json'), 'utf8')));
const lifeMarkdown = await readFile(join(ROOT, 'data', 'course-profesionalni-life-coach.md'), 'utf8');
const lifeAudioScripts = await readFile(join(ROOT, 'data', 'course-profesionalni-life-coach-audio-scripts.md'), 'utf8');
const lifeCourse = parseCourse(lifeMarkdown, { id: 'profesionalni-life-coach' });
const lifeItemIds = new Set(lifeCourse.modules.flatMap(module => module.items.map(item => item.id)));
const circleMaterials = expandWomensCircleMaterials(JSON.parse(await readFile(join(ROOT, 'data', 'course-zenske-kruhy-materials.json'), 'utf8')));
const circleMarkdown = await readFile(join(ROOT, 'data', 'course-zenske-kruhy.md'), 'utf8');
const circleAudioScripts = await readFile(join(ROOT, 'data', 'course-zenske-kruhy-audio-scripts.md'), 'utf8');
const circleCourse = parseCourse(circleMarkdown, { id: 'facilitace-zenskych-kruhu' });
const circleItemIds = new Set(circleCourse.modules.flatMap(module => module.items.map(item => item.id)));

test('Pevná v sobě má úplný materiál v každém modulu a dvanáct přesných audio scénářů', () => {
  assert.equal(selfTrustMaterials.length, 21);
  assert.equal(new Set(selfTrustMaterials.map(material => material.id)).size, 21);
  assert.ok(selfTrustCourse.modules.every((module, moduleIndex) => selfTrustMaterials.some(material => material.moduleIndex === moduleIndex)));
  for (const material of selfTrustMaterials) {
    assert.equal(material.courseId, 'pevna-v-sobe-intensive');
    assert.ok(selfTrustItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 5);
  }
  const sections = [...selfTrustAudioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 12);
  assert.deepEqual(sections.map(match => Number(match[1])), [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal((selfTrustAudioScripts.match(/### Doslovný text/g) || []).length, 12);
});

test('spirituální koučink má pracovní materiál v každém modulu', () => {
  assert.ok(materials.length >= 23);
  assert.equal(new Set(materials.map(material => material.id)).size, materials.length);
  assert.ok(course.modules.every((module, moduleIndex) => materials.some(material => material.moduleIndex === moduleIndex)));
  assert.ok(materials.every(material => courseItemIds.has(material.itemId)));
});

test('kurzové materiály mají účel, výstup, postup a dostatečně konkrétní pole', () => {
  for (const material of materials) {
    assert.equal(material.courseId, 'spiritualni-koucink-practice');
    assert.ok(courseItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50, `${material.id} má slabě popsaný účel`);
    assert.ok(material.takeaway.length > 40, `${material.id} nemá konkrétní výstup`);
    assert.ok(material.boundary.length > 50, `${material.id} nemá jasnou hranici použití`);
    assert.ok(material.howToUse.length >= 4, `${material.id} nemá úplný postup`);
    assert.ok(material.prompts.length >= 5, `${material.id} nemá dost pracovních částí`);
    assert.equal(new Set(material.prompts.map(prompt => prompt.id)).size, material.prompts.length);
    for (const prompt of material.prompts) {
      assert.ok(prompt.label.length > 8);
      assert.ok(prompt.help.length > 20);
    }
  }
});

test('kurz má deset úplných a očíslovaných scénářů k namluvení', () => {
  const sections = [...audioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 10);
  assert.deepEqual(sections.map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const section of sections) {
    assert.ok(section[2].trim().length > 8);
  }
  assert.equal((audioScripts.match(/### Doslovný text/g) || []).length, 10);
});

test('komunikační výcvik má materiál v každém modulu a osm scénářů k namluvení', () => {
  assert.equal(communicationMaterials.length, 17);
  assert.equal(new Set(communicationMaterials.map(material => material.id)).size, communicationMaterials.length);
  assert.ok(communicationCourse.modules.every((module, moduleIndex) => communicationMaterials.some(material => material.moduleIndex === moduleIndex)));
  for (const material of communicationMaterials) {
    assert.equal(material.courseId, 'komunikace-v-praxi');
    assert.ok(communicationItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50, `${material.id} má slabě popsaný účel`);
    assert.ok(material.takeaway.length > 40, `${material.id} nemá konkrétní výstup`);
    assert.ok(material.boundary.length > 50, `${material.id} nemá jasnou hranici použití`);
    assert.ok(material.howToUse.length >= 4, `${material.id} nemá úplný postup`);
    assert.ok(material.prompts.length >= 5, `${material.id} nemá dost pracovních částí`);
    assert.equal(new Set(material.prompts.map(prompt => prompt.id)).size, material.prompts.length);
  }
  const sections = [...communicationAudioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 8);
  assert.deepEqual(sections.map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal((communicationAudioScripts.match(/### Doslovný text/g) || []).length, 8);
});

test('KBT-inspirovaný výcvik má úplné materiály v každém modulu a osm audio scénářů', () => {
  assert.equal(cbtMaterials.length, 17);
  assert.equal(new Set(cbtMaterials.map(material => material.id)).size, cbtMaterials.length);
  assert.ok(cbtCourse.modules.every((module, moduleIndex) => cbtMaterials.some(material => material.moduleIndex === moduleIndex)));
  for (const material of cbtMaterials) {
    assert.equal(material.courseId, 'kbt-koucink-v-praxi');
    assert.ok(cbtItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50, `${material.id} má slabě popsaný účel`);
    assert.ok(material.takeaway.length > 40, `${material.id} nemá konkrétní výstup`);
    assert.ok(material.boundary.length > 50, `${material.id} nemá jasnou hranici použití`);
    assert.ok(material.howToUse.length >= 4, `${material.id} nemá úplný postup`);
    assert.ok(material.prompts.length >= 5, `${material.id} nemá dost pracovních částí`);
    assert.equal(new Set(material.prompts.map(prompt => prompt.id)).size, material.prompts.length);
    for (const prompt of material.prompts) {
      assert.ok(prompt.label.length > 8);
      assert.ok(prompt.help.length > 20);
    }
  }
  const sections = [...cbtAudioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 8);
  assert.deepEqual(sections.map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal((cbtAudioScripts.match(/### Doslovný text/g) || []).length, 8);
});

test('ADHD výcvik má 17 úplných materiálů a osm přesných audio scénářů', () => {
  assert.equal(adhdMaterials.length, 17);
  assert.equal(new Set(adhdMaterials.map(material => material.id)).size, 17);
  assert.ok(adhdCourse.modules.every((module, moduleIndex) => adhdMaterials.some(material => material.moduleIndex === moduleIndex)));
  for (const material of adhdMaterials) {
    assert.equal(material.courseId, 'adhd-focus-motivace');
    assert.ok(adhdItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50, `${material.id} má slabě popsaný účel`);
    assert.ok(material.takeaway.length > 40, `${material.id} nemá konkrétní výstup`);
    assert.ok(material.boundary.length > 50, `${material.id} nemá jasnou hranici použití`);
    assert.ok(material.howToUse.length >= 4, `${material.id} nemá úplný postup`);
    assert.ok(material.prompts.length >= 5, `${material.id} nemá dost pracovních částí`);
    assert.equal(new Set(material.prompts.map(prompt => prompt.id)).size, material.prompts.length);
    assert.ok(material.prompts.every(prompt => prompt.label.length > 8 && prompt.help.length > 20));
  }
  const sections = [...adhdAudioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 8);
  assert.deepEqual(sections.map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal((adhdAudioScripts.match(/### Doslovný text/g) || []).length, 8);
});

test('výcvik Bachových esencí má 21 úplných materiálů a deset přesných audio scénářů', () => {
  assert.equal(bachMaterials.length, 21);
  assert.equal(new Set(bachMaterials.map(material => material.id)).size, 21);
  assert.ok(bachCourse.modules.every((module, moduleIndex) => bachMaterials.some(material => material.moduleIndex === moduleIndex)));
  for (const material of bachMaterials) {
    assert.equal(material.courseId, 'bachovy-kvetove-esence');
    assert.ok(bachItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50, `${material.id} má slabě popsaný účel`);
    assert.ok(material.takeaway.length > 40, `${material.id} nemá konkrétní výstup`);
    assert.ok(material.boundary.length > 50, `${material.id} nemá jasnou hranici použití`);
    assert.ok(material.howToUse.length >= 4, `${material.id} nemá úplný postup`);
    assert.ok(material.prompts.length >= 5, `${material.id} nemá dost pracovních částí`);
    assert.equal(new Set(material.prompts.map(prompt => prompt.id)).size, material.prompts.length);
    assert.ok(material.prompts.every(prompt => prompt.label.length > 8 && prompt.help.length > 20));
  }
  const sections = [...bachAudioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 10);
  assert.deepEqual(sections.map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal((bachAudioScripts.match(/### Doslovný text/g) || []).length, 10);
});

test('profesní life coaching má 19 úplných materiálů a deset přesných audio scénářů', () => {
  assert.equal(lifeMaterials.length, 19);
  assert.equal(new Set(lifeMaterials.map(material => material.id)).size, 19);
  assert.ok(lifeCourse.modules.every((module, moduleIndex) => lifeMaterials.some(material => material.moduleIndex === moduleIndex)));
  for (const material of lifeMaterials) {
    assert.equal(material.courseId, 'profesionalni-life-coach');
    assert.ok(lifeItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 5);
  }
  const sections = [...lifeAudioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 10);
  assert.deepEqual(sections.map(match => Number(match[1])), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal((lifeAudioScripts.match(/### Doslovný text/g) || []).length, 10);
});

test('facilitace ženských kruhů má 21 úplných materiálů a dvanáct přesných audio scénářů', () => {
  assert.equal(circleMaterials.length, 21);
  assert.equal(new Set(circleMaterials.map(material => material.id)).size, 21);
  assert.ok(circleCourse.modules.every((module, moduleIndex) => circleMaterials.some(material => material.moduleIndex === moduleIndex)));
  for (const material of circleMaterials) {
    assert.equal(material.courseId, 'facilitace-zenskych-kruhu');
    assert.ok(circleItemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 5);
  }
  const sections = [...circleAudioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 12);
  assert.deepEqual(sections.map(match => Number(match[1])), [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal((circleAudioScripts.match(/### Doslovný text/g) || []).length, 12);
});

test('materiálová vrstva je obecná pro další kurzy a ukládá se lokálně', async () => {
  const client = await readFile(join(ROOT, 'public', 'app.js'), 'utf8');
  const html = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(client, /state\.activeCourse\?\.materials/);
  assert.match(client, /courseMaterialsForItem/);
  assert.match(client, /courseMaterialsForModule/);
  assert.match(client, /elitea\.worksheetEntries/);
  assert.match(html, /id="lesson-materials"/);
  assert.match(html, /PRACOVNÍ MATERIÁL K TÉTO ČÁSTI/);
});
