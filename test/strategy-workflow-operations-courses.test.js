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
const definitions = [
  { file: 'strategic-thinking-decision-lab', id: 'strategic-thinking-decision-lab', audioId: 'std-audio-pack', trainer: 'Lektorka strategického myšlení a rozhodování', audioCount: 8, required: /SWOT|TOWS|PESTLE|VRIO|Decision Memo|OKR/i },
  { file: 'workflow-productivity-toolkit', id: 'workflow-productivity-toolkit', audioId: 'wpt-audio-pack', trainer: 'Lektorka workflow a produktivních technik', audioCount: 8, required: /GTD|Pomodoro|Flowtime|Eisenhower|Kanban|WIP/i },
  { file: 'project-workflow-operations-management', id: 'project-workflow-operations-management', audioId: 'pwo-audio-pack', trainer: 'Lektorka projektového a provozního řízení', audioCount: 8, required: /RACI|WBS|Scrum|RAID|SOP|rollback/i },
];

for (const definition of definitions) {
  test(`${definition.id} je plný 24hodinový interaktivní výcvik`, async () => {
    const coursePath = join(ROOT, 'data', `course-${definition.file}.md`);
    const materialsPath = join(ROOT, 'data', `course-${definition.file}-materials.json`);
    const audioPath = join(ROOT, 'data', `course-${definition.file}-audio-scripts.md`);
    const [course] = await loadCourses(coursePath);
    const materials = expandBusinessMaterials(JSON.parse(await readFile(materialsPath, 'utf8')));
    const audioScripts = await readFile(audioPath, 'utf8');
    materials.find(material => material.id === definition.audioId).resourceMarkdown = audioScripts;
    course.materials = materials;
    attachCourseMastery(course);

    assert.equal(course.id, definition.id);
    assert.equal(course.moduleCount, 12);
    assert.equal(course.itemCount, 72);
    assert.equal(course.durationHours, 24);
    assert.equal(course.categoryId, COURSE_CATEGORIES.BUSINESS_STRATEGY.id);
    assert.ok(course.modules.every(module => module.items.length === 6));
    assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 1440);
    assert.equal(course.modules.flatMap(module => module.items).filter(item => item.kind === 'lesson').length, 36);
    assert.ok(course.modules.flatMap(module => module.items).filter(item => item.kind === 'lesson').every(item => item.markdown.includes('Aktivní část lekce')));
    const searchable = course.modules.flatMap(module => module.items).map(item => `${item.title}\n${item.markdown}`).join('\n');
    assert.match(searchable, definition.required);
    const words = searchable.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 2400, `${definition.id} má pouze ${words} slov`);

    assert.equal(materials.length, 25);
    assert.equal(publicCourseDetail(course).materials.length, 24);
    assert.equal(courseSummary(course).materialCount, 24);
    assert.ok(course.modules.every((module, moduleIndex) => publicCourseDetail(course).materials.filter(material => material.moduleIndex === moduleIndex).length === 2));
    const itemIds = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
    for (const material of materials) {
      assert.ok(itemIds.has(material.itemId), `${material.id} odkazuje na neexistující část`);
      assert.ok(material.purpose.length > 45 && material.boundary.length > 55 && material.takeaway.length > 35);
      assert.ok(material.howToUse.length >= 4 && material.prompts.length >= 6);
    }
    assert.equal([...audioScripts.matchAll(/^## AUDIO (\d+) —/gm)].length, definition.audioCount);
    assert.equal((audioScripts.match(/### Doslovný text/g) || []).length, definition.audioCount);

    assert.equal(course.trainer.label, definition.trainer);
    assert.equal(course.mastery.summary.scenarioCount, 72);
    assert.equal(course.mastery.summary.levelCount, 4);
    const coverage = courseKnowledgeCoverage([course], buildCourseKnowledge([course]));
    assert.equal(coverage.complete, true);
    assert.equal(coverage.coveredCourseItems, 72);
    assert.equal(coverage.coveredCourseMaterials, 25);
  });
}

test('schválená rozvojová roadmapa uchovává všechny potvrzené směry a první tři označuje jako implementované', async () => {
  const roadmap = JSON.parse(await readFile(join(ROOT, 'data', 'brand-marketing-training-backlog.json'), 'utf8')).approvedExpansionRoadmap;
  assert.equal(roadmap.length, 23);
  assert.deepEqual(roadmap.map(item => item.priority), Array.from({ length: 23 }, (_, index) => index + 1));
  assert.deepEqual(roadmap.slice(0, 3).map(item => item.status), ['implemented', 'implemented', 'implemented']);
  assert.ok(roadmap.some(item => item.id === 'czech-business-legal-gdpr' && item.requires.includes('qualified_review')));
});
