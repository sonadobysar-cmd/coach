import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildCourseKnowledge, courseKnowledgeCoverage } from '../src/course-knowledge.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { COURSE_CATEGORIES, courseSummary, loadCourses, publicCourseDetail } from '../src/courses.js';
import { expandAiAgentMaterials } from '../src/ai-agent-materials.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const coursePath = join(ROOT, 'data', 'course-ai-agenti-a-automatizace.md');
const materialPath = join(ROOT, 'data', 'course-ai-agenti-a-automatizace-materials.json');
const audioPath = join(ROOT, 'data', 'course-ai-agenti-a-automatizace-audio-scripts.md');

const [course] = await loadCourses(coursePath);
const materials = expandAiAgentMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
const audioPack = materials.find(material => material.id === 'ai-audio-pack');
audioPack.resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('AI automation výcvik má reálný 28hodinový rozsah a 84 částí', () => {
  assert.equal(course.id, 'ai-agenti-a-automatizace');
  assert.equal(course.moduleCount, 14);
  assert.equal(course.itemCount, 84);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 1680);
  const words = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 4800, `výcvik má pouze ${words} slov studijního obsahu`);
  assert.equal(course.durationHours, 28);
  assert.equal(course.categoryId, COURSE_CATEGORIES.BUSINESS_STRATEGY.id);
  assert.match(course.certificate.note, /nejde o certifikaci společnosti Anthropic, OpenAI/i);
});

test('každý AI modul obsahuje aktivní studium, laboratoř, profesní simulaci a test', () => {
  const items = course.modules.flatMap(module => module.items);
  const lessons = items.filter(item => item.kind === 'lesson');
  assert.equal(lessons.length, 42);
  assert.ok(lessons.every(item => item.markdown.includes('Aktivní část lekce')));
  assert.equal(items.filter(item => item.kind === 'self-practice').length, 14);
  assert.equal(items.filter(item => item.kind === 'client-practice').length, 14);
  assert.equal(items.filter(item => item.kind === 'quiz').length, 14);
  const knowledge = buildCourseKnowledge([course]);
  const coverage = courseKnowledgeCoverage([course], knowledge);
  assert.equal(coverage.complete, true);
  assert.equal(coverage.coveredCourseItems, 84);
  assert.equal(coverage.coveredCourseMaterials, 29);
});

test('výcvik má 28 veřejných materiálů a deset přesných audio briefingů', () => {
  assert.equal(materials.length, 29);
  assert.equal(publicCourseDetail(course).materials.length, 28);
  assert.equal(courseSummary(course).materialCount, 28);
  assert.equal(new Set(materials.map(material => material.id)).size, 29);
  const itemIds = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
  const publicMaterials = publicCourseDetail(course).materials;
  assert.ok(course.modules.every((module, moduleIndex) => publicMaterials.filter(material => material.moduleIndex === moduleIndex).length === 2));
  for (const material of materials) {
    assert.ok(itemIds.has(material.itemId), `${material.id} míří na neexistující část`);
    assert.ok(material.purpose.length > 50 && material.takeaway.length > 40 && material.boundary.length > 50);
    assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 6);
  }
  const sections = [...audioScripts.matchAll(/^## AUDIO (\d+) — (.+)$/gm)];
  assert.equal(sections.length, 10);
  assert.deepEqual(sections.map(match => Number(match[1])), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal((audioScripts.match(/### Doslovný text/g) || []).length, 10);
});

test('AI workflow lektorka má oddělenou roli a 84 bezpečných simulací', () => {
  assert.equal(course.trainer.label, 'AI workflow lektorka a bezpečnostní oponentka');
  assert.equal(course.trainer.studyAction, 'Pracovat s AI workflow lektorkou');
  assert.match(course.trainer.studyOpening, /oprávnění jednat/i);
  assert.equal(course.mastery.summary.scenarioCount, 84);
  assert.equal(course.mastery.summary.levelCount, 4);
  assert.ok(course.mastery.summary.professionalTemplates >= 12);
});
