import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadCourses } from '../src/courses.js';
import { courseWordCount, MIN_LESSON_WORDS } from '../src/course-study-depth.js';

const DATA = resolve(process.cwd(), 'data');
const coursePaths = (await readdir(DATA))
  .filter(name => /^course-.*\.md$/.test(name) && !name.includes('audio-scripts'))
  .map(name => resolve(DATA, name));
const courses = await loadCourses(coursePaths);

const previouslyShallowCourseIds = new Set([
  'ai-agenti-a-automatizace',
  'ai-content-production-studio',
  'canva-ai-business-systems-lab',
  'canva-content-design-studio',
  'capcut-short-form-video-studio',
  'content-creator-personal-brand-studio',
  'content-marketing-editorial-growth-system',
  'founder-productivity-execution-os',
  'generativni-ai-pro-marketing-a-byznys',
  'napad-k-overene-prilezitosti',
  'project-workflow-operations-management',
  'social-media-management-strategie-a-rust',
  'strategicka-partnerstvi-business-development',
  'strategic-thinking-decision-lab',
  'vedlejsi-byznys-pri-zamestnani',
  'visual-content-strategy-campaign-lab',
  'workflow-productivity-toolkit',
]);

test('všech 27 programů splňuje trvalý standard hloubky každé odborné lekce', () => {
  assert.equal(courses.length, 27);
  for (const course of courses) {
    const lessons = course.modules.flatMap(module => module.items).filter(item => item.kind === 'lesson');
    assert.ok(lessons.length > 0, `${course.id}: chybí odborné lekce`);
    assert.ok(course.depth.meetsLessonDepthStandard, `${course.id}: souhrn neprošel`);
    assert.ok(course.depth.shortestLessonWords >= MIN_LESSON_WORDS, `${course.id}: nejkratší lekce má ${course.depth.shortestLessonWords} slov`);
    assert.ok(lessons.every(item => courseWordCount(item.markdown) >= MIN_LESSON_WORDS), `${course.id}: krátká lekce`);
    assert.equal(new Set(lessons.map(item => item.markdown)).size, lessons.length, `${course.id}: duplicitní lekce`);
  }
});

test('všech 27 programů má přesně a transparentně doloženou každou deklarovanou minutu', () => {
  assert.equal(courses.length, 27);
  for (const course of courses) {
    const items = course.modules.flatMap(module => module.items);
    assert.ok(course.studyLoad.complete, `${course.id}: časový plán není úplný`);
    assert.equal(course.studyLoad.declaredMinutes, course.durationHours * 60, `${course.id}: chybná deklarace`);
    assert.equal(course.studyLoad.scheduledMinutes, course.studyLoad.declaredMinutes, `${course.id}: časový nesoulad`);
    assert.equal(course.studyLoad.varianceMinutes, 0, `${course.id}: nenulový rozdíl`);
    assert.equal(course.studyLoad.itemCount, items.length, `${course.id}: plán nepokrývá všechny části`);
    assert.equal(course.studyLoad.uncategorizedItemCount, 0, `${course.id}: nezařazené části`);
    assert.equal(course.studyLoad.categories.reduce((sum, category) => sum + category.minutes, 0), course.durationHours * 60);
    assert.ok(items.every(item => Number(item.minutes) > 0 && item.studyCategory), `${course.id}: část bez času nebo kategorie`);
  }
});

test('neuroplasticita má skutečných 40 hodin včetně povinné praxe, AI simulací a portfolia', () => {
  const course = courses.find(item => item.id === 'neuroplasticita-practitioner');
  const requiredBlocks = course.modules.flatMap(module => module.items).filter(item => item.requiredStudyBlock);
  const categoryMinutes = Object.fromEntries(course.studyLoad.categories.map(category => [category.id, category.minutes]));
  assert.equal(course.studyLoad.scheduledMinutes, 2400);
  assert.equal(course.studyLoad.requiredStudyBlockCount, 27);
  assert.equal(course.studyLoad.requiredEvidenceItemCount, 27);
  assert.equal(requiredBlocks.length, 27);
  assert.equal(requiredBlocks.reduce((sum, item) => sum + item.minutes, 0), 1638);
  assert.deepEqual(categoryMinutes, {
    orientation: 36,
    instruction: 250,
    'guided-practice': 720,
    simulation: 725,
    portfolio: 573,
    assessment: 96,
  });
  for (const block of requiredBlocks) {
    assert.match(block.markdown, /### Povinný výstup/);
    assert.match(block.markdown, /### Důkaz dokončení/);
    assert.ok(block.requiredOutput.length > 40);
    assert.ok(block.requiredEvidence.length > 40);
  }
});

test('sedmnáct dříve mělkých kurzů má výklad, aktivní přenos i doložený časový rozsah', () => {
  const selected = courses.filter(course => previouslyShallowCourseIds.has(course.id));
  assert.equal(selected.length, 17);
  for (const course of selected) {
    const lessons = course.modules.flatMap(module => module.items).filter(item => item.kind === 'lesson');
    assert.ok(course.depth.averageLessonWords >= MIN_LESSON_WORDS);
    assert.ok(lessons.every(item => item.markdown.includes('Aktivní část lekce')));
    assert.ok(lessons.every(item => item.markdown.includes('### Přenos do praxe')));
    assert.ok(lessons.every(item => item.markdown.includes('### Kontrola zvládnutí')));
    assert.equal(course.studyLoad.scheduledMinutes, course.durationHours * 60, `${course.id}: deklarované hodiny nemají oporu v plánu`);
  }
});

test('automatické doplnění je ukotvené v konkrétní lekci a přiznává původní rozsah', () => {
  for (const course of courses) {
    for (const module of course.modules) {
      for (const item of module.items.filter(candidate => candidate.depth?.enriched)) {
        const focus = item.title.replace(/^Lekce\s+[\d.]+\s*[—–-]\s*/i, '').trim();
        assert.match(item.markdown, /elitea-study-depth:v1/);
        assert.ok(item.markdown.includes(focus), `${course.id}/${item.id}: chybí ukotvení v tématu`);
        assert.ok(item.depth.originalWordCount < MIN_LESSON_WORDS);
        assert.ok(item.depth.wordCount >= MIN_LESSON_WORDS);
      }
    }
  }
});
