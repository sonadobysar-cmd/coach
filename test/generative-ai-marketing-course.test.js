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
const coursePath = join(ROOT, 'data', 'course-generativni-ai-pro-marketing-a-byznys.md');
const materialPath = join(ROOT, 'data', 'course-generativni-ai-pro-marketing-a-byznys-materials.json');
const audioPath = join(ROOT, 'data', 'course-generativni-ai-pro-marketing-a-byznys-audio-scripts.md');

const [course] = await loadCourses(coursePath);
const materials = expandAiAgentMaterials(JSON.parse(await readFile(materialPath, 'utf8')));
const audioScripts = await readFile(audioPath, 'utf8');
course.materials = materials;
const audioPack = materials.find(material => material.id === 'genai-audio-pack');
audioPack.resourceMarkdown = audioScripts;
attachCourseMastery(course);

test('generativní AI výcvik má reálný 42hodinový rozsah a 84 částí', () => {
  assert.equal(course.id, 'generativni-ai-pro-marketing-a-byznys');
  assert.equal(course.moduleCount, 14);
  assert.equal(course.itemCount, 84);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2520);
  const words = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 4800, `výcvik má pouze ${words} slov studijního obsahu`);
  assert.equal(course.durationHours, 42);
  assert.equal(course.categoryId, COURSE_CATEGORIES.MARKETING.id);
  assert.match(course.certificate.note, /negarantuje úsporu, příjem ani bezchybnost/i);
});

test('každý generativní AI modul obsahuje aktivní studium, laboratoř, simulaci a test', () => {
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

test('AI marketingový výcvik má 28 veřejných materiálů a dvanáct přesných audio briefingů', () => {
  assert.equal(materials.length, 29);
  const publicMaterials = publicCourseDetail(course).materials;
  assert.equal(publicMaterials.length, 28);
  assert.equal(courseSummary(course).materialCount, 28);
  assert.equal(new Set(materials.map(material => material.id)).size, 29);
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

test('generativní AI lektorka má samostatnou roli a 84 multimodálních simulací', () => {
  assert.equal(course.trainer.label, 'Lektorka generativní AI a multimodální produkce');
  assert.equal(course.trainer.studyAction, 'Pracovat s AI lektorkou');
  assert.match(course.trainer.studyOpening, /modelový návrh od zdroje/i);
  assert.match(course.trainer.description, /právní či bezpečnostní oponentku/i);
  assert.equal(course.mastery.summary.scenarioCount, 84);
  assert.equal(course.mastery.summary.levelCount, 4);
  assert.ok(course.mastery.summary.professionalTemplates >= 12);
});
