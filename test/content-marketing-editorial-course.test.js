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
const coursePath = join(ROOT, 'data', 'course-content-marketing-editorial-growth-system.md');
const materialPath = join(ROOT, 'data', 'course-content-marketing-editorial-growth-system-materials.json');
const audioPath = join(ROOT, 'data', 'course-content-marketing-editorial-growth-system-audio-scripts.md');
const [course] = await loadCourses(coursePath);
const materials = expandBusinessMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
materials.find(material => material.id === 'cm-audio-pack').resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('Content Marketing Editorial Growth System má 18 modulů, 108 částí a 36 hodin', () => {
  assert.equal(course.id, 'content-marketing-editorial-growth-system');
  assert.equal(course.moduleCount, 18);
  assert.equal(course.itemCount, 108);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2160);
  const words = course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 4100, `výcvik má pouze ${words} slov`);
  assert.equal(course.durationHours, 36);
  assert.equal(course.categoryId, COURSE_CATEGORIES.MARKETING.id);
  assert.match(course.certificate.note, /negarantuje ranking, dosah, konverze, prodej/i);
});

test('každý modul má aktivní výklad, laboratoř, simulaci a test i úplnou knowledge coverage', () => {
  const items = course.modules.flatMap(module => module.items);
  assert.equal(items.filter(item => item.kind === 'lesson').length, 54);
  assert.ok(items.filter(item => item.kind === 'lesson').every(item => item.markdown.includes('Aktivní část lekce')));
  assert.equal(items.filter(item => item.kind === 'self-practice').length, 18);
  assert.equal(items.filter(item => item.kind === 'client-practice').length, 18);
  assert.equal(items.filter(item => item.kind === 'quiz').length, 18);
  const coverage = courseKnowledgeCoverage([course], buildCourseKnowledge([course]));
  assert.equal(coverage.complete, true);
  assert.equal(coverage.coveredCourseItems, 108);
  assert.equal(coverage.coveredCourseMaterials, 37);
});

test('kurz má 36 veřejných materiálů a 12 přesných audio vedení', () => {
  assert.equal(materials.length, 37);
  const publicMaterials = publicCourseDetail(course).materials;
  assert.equal(publicMaterials.length, 36);
  assert.equal(courseSummary(course).materialCount, 36);
  assert.ok(course.modules.every((module, moduleIndex) => publicMaterials.filter(material => material.moduleIndex === moduleIndex).length === 2));
  const ids = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
  for (const material of materials) {
    assert.ok(ids.has(material.itemId));
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 6);
  }
  assert.equal([...audioScripts.matchAll(/^## AUDIO (\d+) —/gm)].length, 12);
  assert.equal((audioScripts.match(/### Doslovný text/g) || []).length, 12);
});

test('kurz má vlastní content marketing lektorku a 108 board simulací', () => {
  assert.equal(course.trainer.label, 'Lektorka content marketingu a editorial growth');
  assert.equal(course.trainer.studyAction, 'Pracovat s content marketing lektorkou');
  assert.match(course.trainer.studyOpening, /publikační aktivitu od hodnoty/i);
  assert.equal(course.mastery.summary.scenarioCount, 108);
  assert.equal(course.mastery.summary.levelCount, 4);
});
