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
const coursePath = join(ROOT, 'data', 'course-visual-content-strategy-campaign-lab.md');
const materialPath = join(ROOT, 'data', 'course-visual-content-strategy-campaign-lab-materials.json');
const audioPath = join(ROOT, 'data', 'course-visual-content-strategy-campaign-lab-audio-scripts.md');
const [course] = await loadCourses(coursePath);
const materials = expandBusinessMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
materials.find(material => material.id === 'vcs-audio-pack').resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('Visual Content Strategy & Campaign Lab má 14 modulů, 84 částí a 28 hodin', () => {
  assert.equal(course.id, 'visual-content-strategy-campaign-lab');
  assert.equal(course.moduleCount, 14);
  assert.equal(course.itemCount, 84);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 1680);
  const words = course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 4500, `výcvik má pouze ${words} slov`);
  assert.equal(course.durationHours, 28);
  assert.equal(course.categoryId, COURSE_CATEGORIES.MARKETING.id);
  assert.match(course.certificate.note, /negarantuje viralitu, dosah, engagement, konverze, prodej/i);
});

test('každý modul má aktivní výklad, laboratoř, campaign review a test i úplnou knowledge coverage', () => {
  const items = course.modules.flatMap(module => module.items);
  assert.equal(items.filter(item => item.kind === 'lesson').length, 42);
  assert.ok(items.filter(item => item.kind === 'lesson').every(item => item.markdown.includes('Aktivní část lekce')));
  assert.equal(items.filter(item => item.kind === 'self-practice').length, 14);
  assert.equal(items.filter(item => item.kind === 'client-practice').length, 14);
  assert.equal(items.filter(item => item.kind === 'quiz').length, 14);
  const coverage = courseKnowledgeCoverage([course], buildCourseKnowledge([course]));
  assert.equal(coverage.complete, true);
  assert.equal(coverage.coveredCourseItems, 84);
  assert.equal(coverage.coveredCourseMaterials, 29);
});

test('kurz má 28 veřejných materiálů a 10 přesných audio vedení', () => {
  assert.equal(materials.length, 29);
  const publicMaterials = publicCourseDetail(course).materials;
  assert.equal(publicMaterials.length, 28);
  assert.equal(courseSummary(course).materialCount, 28);
  assert.ok(course.modules.every((module, moduleIndex) => publicMaterials.filter(material => material.moduleIndex === moduleIndex).length === 2));
  const ids = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
  for (const material of materials) {
    assert.ok(ids.has(material.itemId));
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 6);
  }
  assert.equal([...audioScripts.matchAll(/^## AUDIO (\d+) —/gm)].length, 10);
  assert.equal((audioScripts.match(/### Doslovný text/g) || []).length, 10);
});

test('kurz má vlastní visual content lektorku a 84 campaign review simulací', () => {
  assert.equal(course.trainer.label, 'Lektorka visual content strategie a campaign review');
  assert.equal(course.trainer.studyAction, 'Pracovat s visual content lektorkou');
  assert.match(course.trainer.studyOpening, /estetický dojem od rozhodovací práce/i);
  assert.equal(course.mastery.summary.scenarioCount, 84);
  assert.equal(course.mastery.summary.levelCount, 4);
});
