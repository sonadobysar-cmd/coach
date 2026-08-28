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
const coursePath = join(ROOT, 'data', 'course-canva-content-design-studio.md');
const materialPath = join(ROOT, 'data', 'course-canva-content-design-studio-materials.json');
const audioPath = join(ROOT, 'data', 'course-canva-content-design-studio-audio-scripts.md');

const [course] = await loadCourses(coursePath);
const materials = expandBusinessMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
const audioPack = materials.find(material => material.id === 'canva-audio-pack');
audioPack.resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('Canva Content Design Studio má reálný 30hodinový rozsah a 90 částí', () => {
  assert.equal(course.id, 'canva-content-design-studio');
  assert.equal(course.moduleCount, 15);
  assert.equal(course.itemCount, 90);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 1800);
  const words = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 3600, `výcvik má pouze ${words} slov studijního obsahu`);
  assert.equal(course.durationHours, 30);
  assert.equal(course.categoryId, COURSE_CATEGORIES.MARKETING.id);
  assert.match(course.certificate.note, /negarantuje dosah, konverze, prodej ani obchodní výsledek/i);
});

test('každý Canva modul obsahuje aktivní studium, laboratoř, creative review a test', () => {
  const items = course.modules.flatMap(module => module.items);
  const lessons = items.filter(item => item.kind === 'lesson');
  assert.equal(lessons.length, 45);
  assert.ok(lessons.every(item => item.markdown.includes('Aktivní část lekce')));
  assert.equal(items.filter(item => item.kind === 'self-practice').length, 15);
  assert.equal(items.filter(item => item.kind === 'client-practice').length, 15);
  assert.equal(items.filter(item => item.kind === 'quiz').length, 15);
  const knowledge = buildCourseKnowledge([course]);
  const coverage = courseKnowledgeCoverage([course], knowledge);
  assert.equal(coverage.complete, true);
  assert.equal(coverage.coveredCourseItems, 90);
  assert.equal(coverage.coveredCourseMaterials, 31);
});

test('Canva výcvik má 30 veřejných materiálů a dvanáct přesných audio briefingů', () => {
  assert.equal(materials.length, 31);
  const publicMaterials = publicCourseDetail(course).materials;
  assert.equal(publicMaterials.length, 30);
  assert.equal(courseSummary(course).materialCount, 30);
  assert.equal(new Set(materials.map(material => material.id)).size, 31);
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

test('Canva kurz má specializovanou designovou lektorku a 90 creative review simulací', () => {
  assert.equal(course.trainer.label, 'Lektorka vizuálního designu a Canva produkce');
  assert.equal(course.trainer.studyAction, 'Pracovat s designovou lektorkou');
  assert.match(course.trainer.studyOpening, /estetickou preferenci od funkce/i);
  assert.match(course.trainer.description, /accessibility/i);
  assert.equal(course.mastery.summary.scenarioCount, 90);
  assert.equal(course.mastery.summary.levelCount, 4);
  assert.ok(course.mastery.summary.professionalTemplates >= 12);
});
