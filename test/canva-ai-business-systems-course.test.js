import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { expandBusinessMaterials } from '../src/business-materials.js';
import { buildCourseKnowledge, courseKnowledgeCoverage } from '../src/course-knowledge.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { COURSE_CATEGORIES, courseSummary, loadCourses, publicCourseDetail } from '../src/courses.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const coursePath = join(ROOT, 'data', 'course-canva-ai-business-systems-lab.md');
const materialPath = join(ROOT, 'data', 'course-canva-ai-business-systems-lab-materials.json');
const audioPath = join(ROOT, 'data', 'course-canva-ai-business-systems-lab-audio-scripts.md');

const [course] = await loadCourses(coursePath);
const materials = expandBusinessMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
const audioPack = materials.find(material => material.id === 'canva-ai-audio-pack');
audioPack.resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('Canva AI & Business Systems Lab má 20 modulů, 120 částí a reálných 40 hodin', () => {
  assert.equal(course.id, 'canva-ai-business-systems-lab');
  assert.equal(course.moduleCount, 20);
  assert.equal(course.itemCount, 120);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2400);
  const words = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 5000, `výcvik má pouze ${words} slov studijního obsahu`);
  assert.equal(course.durationHours, 40);
  assert.equal(course.categoryId, COURSE_CATEGORIES.MARKETING.id);
  assert.match(course.certificate.note, /nejde o certifikaci ani autorizaci Canva/i);
});

test('každý modul má aktivní lekce, laboratoř, profesní simulaci a test', () => {
  const items = course.modules.flatMap(module => module.items);
  const lessons = items.filter(item => item.kind === 'lesson');
  assert.equal(lessons.length, 60);
  assert.ok(lessons.every(item => item.markdown.includes('Aktivní část lekce')));
  assert.equal(items.filter(item => item.kind === 'self-practice').length, 20);
  assert.equal(items.filter(item => item.kind === 'client-practice').length, 20);
  assert.equal(items.filter(item => item.kind === 'quiz').length, 20);
  const coverage = courseKnowledgeCoverage([course], buildCourseKnowledge([course]));
  assert.equal(coverage.complete, true);
  assert.equal(coverage.coveredCourseItems, 120);
  assert.equal(coverage.coveredCourseMaterials, 41);
});

test('kurz má 40 veřejných pracovních materiálů a 12 přesných audio vedení', () => {
  assert.equal(materials.length, 41);
  const publicMaterials = publicCourseDetail(course).materials;
  assert.equal(publicMaterials.length, 40);
  assert.equal(courseSummary(course).materialCount, 40);
  assert.equal(new Set(materials.map(material => material.id)).size, 41);
  assert.ok(course.modules.every((module, moduleIndex) => publicMaterials.filter(material => material.moduleIndex === moduleIndex).length === 2));
  const itemIds = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
  for (const material of materials) {
    assert.ok(itemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 6);
  }
  const sections = [...audioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 12);
  assert.deepEqual(sections.map(match => Number(match[1])), [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal((audioScripts.match(/### Doslovný text/g) || []).length, 12);
});

test('kurz má specializovanou lektorku a 120 Canva systems review simulací', () => {
  assert.equal(course.trainer.label, 'Lektorka Canva AI a digitálních pracovních systémů');
  assert.equal(course.trainer.studyAction, 'Pracovat s lektorkou Canva AI systémů');
  assert.match(course.trainer.studyOpening, /zdroj pravdy od AI výstupu/i);
  assert.match(course.trainer.description, /brand governance/i);
  assert.equal(course.mastery.summary.scenarioCount, 120);
  assert.equal(course.mastery.summary.levelCount, 4);
  assert.ok(course.mastery.summary.professionalTemplates >= 12);
});
