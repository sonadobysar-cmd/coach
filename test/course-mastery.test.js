import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourses, parseCourse } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { COACH_COMPETENCIES, coachCompetencyIdForCriterion } from '../src/coach-competencies.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const paths = [
  'course-neuroplasticita-practitioner.md',
  'course-pevna-v-sobe.md',
  'course-spiritualni-koucink.md',
  'course-komunikace-v-praxi.md',
  'course-kbt-koucink-v-praxi.md',
  'course-adhd-focus-motivace.md',
  'course-bachovy-kvetove-esence.md',
  'course-profesionalni-life-coach.md',
  'course-zenske-kruhy.md',
].map(file => join(ROOT, 'data', file));
const courses = (await loadCourses(paths)).map(attachCourseMastery);

test('všech devět kurzů má kompletní Mastery Lab se stejným standardem rozsahu', () => {
  assert.equal(courses.length, 9);
  for (const course of courses) {
    const mastery = course.mastery;
    assert.ok(mastery, `${course.id}: chybí Mastery Lab`);
    assert.equal(mastery.journey.length, 30, `${course.id}: cesta`);
    assert.equal(mastery.scenarios.length, 60, `${course.id}: situace`);
    assert.equal(mastery.levels.length, 4, `${course.id}: úrovně`);
    assert.deepEqual(mastery.levels.map(level => level.id), ['guided', 'standard', 'advanced', 'expert']);
    assert.equal(mastery.assessment.dimensions.length, 10, `${course.id}: měření`);
    assert.equal(mastery.professionalPack.length, 12, `${course.id}: profesní balíček`);
    assert.equal(mastery.finalExam.rounds.length, 4, `${course.id}: zkouška`);
    assert.equal(mastery.finalExam.difficulty, 'expert');
  }
});

test('profesní life coach vyžaduje dva oddělené expertní finální výkony a portfolio zvlášť', () => {
  const course = courses.find(candidate => candidate.id === 'profesionalni-life-coach');
  assert.equal(course.mastery.finalExam.requiredPassingSessions, 2);
  assert.equal(course.mastery.finalExam.scenarioIds.length, 2);
  assert.equal(new Set(course.mastery.finalExam.scenarioIds).size, 2);
  assert.ok(course.mastery.finalExam.scenarioIds.every(id => (
    course.mastery.scenarios.find(scenario => scenario.id === id)?.difficulty === 'expert'
  )));
  assert.equal(course.mastery.summary.finalExamPassingSessions, 2);
  assert.match(course.mastery.finalExam.passRule, /dvě odlišná.*expertní sezení/iu);
  assert.match(course.mastery.finalExam.passRule, /samostatně.*profesní balíček/iu);
  assert.equal(course.mastery.finalExam.requiredEvidence.length, 4);
  assert.equal(course.mastery.finalExam.criteria.length, 9);
  assert.deepEqual(
    course.mastery.finalExam.criteria.map(coachCompetencyIdForCriterion),
    COACH_COMPETENCIES.map(competency => competency.id),
  );
  for (const scenarioId of course.mastery.finalExam.scenarioIds) {
    assert.match(course._masteryPrivate[scenarioId].behavior, /odmítni.*oprav/iu);
  }
});

test('situace a 30denní cesta vycházejí ze skutečných částí a pokrývají každý modul', () => {
  for (const course of courses) {
    const moduleIds = new Set(course.modules.map(module => module.id));
    const itemIds = new Set(course.modules.flatMap(module => module.items.map(item => item.id)));
    assert.equal(new Set(course.mastery.scenarios.map(item => item.id)).size, 60);
    assert.equal(new Set(course.mastery.journey.map(item => item.id)).size, 30);
    assert.deepEqual(new Set(course.mastery.scenarios.map(item => item.moduleId)), moduleIds, `${course.id}: situace nepokrývají všechny moduly`);
    assert.deepEqual(new Set(course.mastery.journey.map(item => item.moduleId)), moduleIds, `${course.id}: cesta nepokrývá všechny moduly`);
    for (const scenario of course.mastery.scenarios) {
      assert.ok(itemIds.has(scenario.itemId), `${course.id}: neexistující část ${scenario.itemId}`);
      assert.ok(scenario.openingLine.length > 55);
      assert.ok(scenario.assignment.length > 100);
      assert.ok(scenario.rubric.length >= 6);
    }
  }
});

test('skrytá fakta modelových klientek se neposílají v JSON kurzu', () => {
  for (const course of courses) {
    assert.ok(course._masteryPrivate);
    assert.equal(Object.prototype.propertyIsEnumerable.call(course, '_masteryPrivate'), false);
    assert.equal(Object.keys(course._masteryPrivate).length, 60);
    const serialized = JSON.stringify(course);
    assert.doesNotMatch(serialized, /"hiddenNeed"|"behavior"|"_masteryPrivate"/);
  }
});

test('stejný standard se automaticky vytvoří i pro budoucí kurz', () => {
  const future = parseCourse([
    '# MODUL 1 — Základ nové dovednosti',
    '## Lekce 1.1 — Princip',
    'Konkrétní odborný obsah budoucího kurzu.',
    '# MODUL 2 — Použití v praxi',
    '## Lekce 2.1 — Nácvik',
    'Praktická část budoucího kurzu.',
  ].join('\n'), {
    id: 'future-course', slug: 'future-course', title: 'Budoucí kurz', subtitle: 'Test', badge: 'TEST',
    level: 'Výcvik', durationHours: 8, instructor: 'Nia Dobyšar', description: 'Testovací budoucí kurz.',
    coverNumber: '10', topicLabel: 'BUDOUCNOST', categoryId: 'coaching-mental-health', categoryLabel: 'Koučink & Mental Health',
  });
  attachCourseMastery(future);
  assert.equal(future.mastery.journey.length, 30);
  assert.equal(future.mastery.scenarios.length, 60);
  assert.deepEqual(new Set(future.mastery.scenarios.map(item => item.moduleId)), new Set(future.modules.map(module => module.id)));
});
