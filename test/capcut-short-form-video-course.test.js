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
const coursePath = join(ROOT, 'data', 'course-capcut-short-form-video-studio.md');
const materialPath = join(ROOT, 'data', 'course-capcut-short-form-video-studio-materials.json');
const audioPath = join(ROOT, 'data', 'course-capcut-short-form-video-studio-audio-scripts.md');
const [course] = await loadCourses(coursePath);
const materials = expandBusinessMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
materials.find(material => material.id === 'cap-audio-pack').resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('CapCut Desktop + Mobile + AI Video Studio má 20 modulů, 120 částí a 40 hodin', () => {
  assert.equal(course.id, 'capcut-short-form-video-studio');
  assert.equal(course.moduleCount, 20);
  assert.equal(course.itemCount, 120);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2400);
  const words = course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 6000, `výcvik má pouze ${words} slov`);
  assert.equal(course.durationHours, 40);
  assert.equal(course.categoryId, COURSE_CATEGORIES.MARKETING.id);
  assert.match(course.certificate.note, /negarantuje viralitu, dosah, retenci, engagement, konverze, prodej/i);
});

test('každý modul má aktivní výklad, laboratoř, produkční review a test i úplnou knowledge coverage', () => {
  const items = course.modules.flatMap(module => module.items);
  assert.equal(items.filter(item => item.kind === 'lesson').length, 60);
  assert.ok(items.filter(item => item.kind === 'lesson').every(item => item.markdown.includes('Aktivní část lekce')));
  assert.equal(items.filter(item => item.kind === 'self-practice').length, 20);
  assert.equal(items.filter(item => item.kind === 'client-practice').length, 20);
  assert.equal(items.filter(item => item.kind === 'quiz').length, 20);
  const coverage = courseKnowledgeCoverage([course], buildCourseKnowledge([course]));
  assert.equal(coverage.complete, true);
  assert.equal(coverage.coveredCourseItems, 120);
  assert.equal(coverage.coveredCourseMaterials, 41);
});

test('kurz má 40 veřejných materiálů a 14 přesných audio vedení', () => {
  assert.equal(materials.length, 41);
  const publicMaterials = publicCourseDetail(course).materials;
  assert.equal(publicMaterials.length, 40);
  assert.equal(courseSummary(course).materialCount, 40);
  assert.ok(course.modules.every((module, moduleIndex) => publicMaterials.filter(material => material.moduleIndex === moduleIndex).length === 2));
  const ids = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
  for (const material of materials) {
    assert.ok(ids.has(material.itemId));
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 6);
  }
  assert.equal([...audioScripts.matchAll(/^## AUDIO (\d+) —/gm)].length, 14);
  assert.equal((audioScripts.match(/### Doslovný text/g) || []).length, 14);
});

test('kurz má vlastní video editing lektorku a 120 production review simulací', () => {
  assert.equal(course.trainer.label, 'Lektorka short-form videa a CapCut production review');
  assert.equal(course.trainer.studyAction, 'Pracovat s video editing lektorkou');
  assert.match(course.trainer.studyOpening, /efektní střih od komunikační práce/i);
  assert.equal(course.mastery.summary.scenarioCount, 120);
  assert.equal(course.mastery.summary.levelCount, 4);
});
