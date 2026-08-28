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
const coursePath = join(ROOT, 'data', 'course-social-media-management-strategie-a-rust.md');
const materialPath = join(ROOT, 'data', 'course-social-media-management-strategie-a-rust-materials.json');
const audioPath = join(ROOT, 'data', 'course-social-media-management-strategie-a-rust-audio-scripts.md');

const [course] = await loadCourses(coursePath);
const materials = expandBusinessMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
const audioPack = materials.find(material => material.id === 'smm-audio-pack');
audioPack.resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('SMM výcvik má reálný 32hodinový rozsah a 96 částí', () => {
  assert.equal(course.id, 'social-media-management-strategie-a-rust');
  assert.equal(course.moduleCount, 16);
  assert.equal(course.itemCount, 96);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 1920);
  const words = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 4400, `výcvik má pouze ${words} slov studijního obsahu`);
  assert.equal(course.durationHours, 32);
  assert.equal(course.categoryId, COURSE_CATEGORIES.MARKETING.id);
  assert.match(course.certificate.note, /negarantuje dosah, viralitu, prodej ani obchodní výsledek/i);
});

test('každý SMM modul obsahuje aktivní studium, laboratoř, simulaci a test', () => {
  const items = course.modules.flatMap(module => module.items);
  const lessons = items.filter(item => item.kind === 'lesson');
  assert.equal(lessons.length, 48);
  assert.ok(lessons.every(item => item.markdown.includes('Aktivní část lekce')));
  assert.equal(items.filter(item => item.kind === 'self-practice').length, 16);
  assert.equal(items.filter(item => item.kind === 'client-practice').length, 16);
  assert.equal(items.filter(item => item.kind === 'quiz').length, 16);
  const knowledge = buildCourseKnowledge([course]);
  const coverage = courseKnowledgeCoverage([course], knowledge);
  assert.equal(coverage.complete, true);
  assert.equal(coverage.coveredCourseItems, 96);
  assert.equal(coverage.coveredCourseMaterials, 33);
});

test('SMM výcvik má 32 veřejných materiálů a dvanáct přesných audio briefingů', () => {
  assert.equal(materials.length, 33);
  const publicMaterials = publicCourseDetail(course).materials;
  assert.equal(publicMaterials.length, 32);
  assert.equal(courseSummary(course).materialCount, 32);
  assert.equal(new Set(materials.map(material => material.id)).size, 33);
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

test('SMM lektorka má samostatnou roli a 96 profesních simulací', () => {
  assert.equal(course.trainer.label, 'Lektorka social media managementu a klientská oponentka');
  assert.equal(course.trainer.studyAction, 'Pracovat se SMM lektorkou');
  assert.match(course.trainer.studyOpening, /skutečný insight a důkaz/i);
  assert.match(course.trainer.description, /community lead/i);
  assert.equal(course.mastery.summary.scenarioCount, 96);
  assert.equal(course.mastery.summary.levelCount, 4);
  assert.ok(course.mastery.summary.professionalTemplates >= 12);
});
