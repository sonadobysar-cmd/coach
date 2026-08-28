import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildCourseKnowledge,
  isBusinessAcademyKnowledge,
  listBusinessAcademyFacultyCourses,
  retrieveBusinessAcademyKnowledge,
} from '../src/course-knowledge.js';
import { loadCourses } from '../src/courses.js';
import {
  buildTrainingInstructions,
  createTrainingScenario,
} from '../src/training.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const courses = await loadCourses([
  'course-podnikani-od-napadu-k-rustu.md',
  'course-content-creator-personal-brand-studio.md',
  'course-kbt-koucink-v-praxi.md',
].map(file => join(ROOT, 'data', file)));
const businessCourse = courses.find(course => course.id === 'podnikani-od-napadu-k-rustu');
const creatorCourse = courses.find(course => course.id === 'content-creator-personal-brand-studio');
const mentalHealthCourse = courses.find(course => course.id === 'kbt-koucink-v-praxi');
const records = buildCourseKnowledge(courses);

test('znalostní záznamy nesou kategorii a byznys fakulta nepřebírá Mental Health obsah', () => {
  assert.ok(records.every(record => record.course_category_id));
  const facultyRecords = records.filter(isBusinessAcademyKnowledge);
  assert.ok(facultyRecords.length > 100);
  assert.ok(facultyRecords.every(record => ['business-strategy', 'marketing'].includes(record.course_category_id)));
  assert.ok(!facultyRecords.some(record => record.course_id === mentalHealthCourse.id));

  const faculty = listBusinessAcademyFacultyCourses(records);
  assert.deepEqual(faculty.map(course => course.id), [businessCourse.id, creatorCourse.id]);
  assert.ok(faculty.every(course => course.categoryLabel));
});

test('byznys asistentka dostane relevantní a kurzově pestrou metodiku', () => {
  const matches = retrieveBusinessAcademyKnowledge(
    records,
    'značka nabídka publikum obsah validace strategie růstu praktický výstup',
    6,
  );

  assert.ok(matches.length >= 2);
  assert.ok(new Set(matches.map(match => match.course_id)).size >= 2);
  assert.ok(matches.every(match => ['business-strategy', 'marketing'].includes(match.course_category_id)));
  assert.ok(!matches.some(match => match.course_id === mentalHealthCourse.id));
});

test('byznys lektorka zná celou fakultu, ale otevřená lekce zůstává primární', () => {
  const item = creatorCourse.modules[0].items[0];
  const scenario = createTrainingScenario(creatorCourse, item, 'standard');
  const relatedMethodology = retrieveBusinessAcademyKnowledge(
    records,
    `${creatorCourse.title} ${item.title} publikum značka obsah`,
    5,
  );
  const instructions = buildTrainingInstructions({
    course: creatorCourse,
    item,
    activity: 'study',
    phase: 'study',
    scenario,
    difficulty: 'standard',
    relatedMethodology,
    businessAcademyFaculty: listBusinessAcademyFacultyCourses(records),
  });

  assert.match(instructions, /ODBORNÝ PŘESAH MARKETINGOVÉ A BYZNYSOVÉ FAKULTY/);
  assert.match(instructions, /Podnikání od nápadu k růstu/);
  assert.match(instructions, /Content Creator & Personal Brand Studio/);
  assert.match(instructions, /Právě otevřená studijní část je vždy primární/);
  assert.match(instructions, new RegExp(item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(instructions, /KBT koučink v praxi/);
});

test('lektorka Mental Health kurzu nedostane cizí byznysovou fakultu', () => {
  const item = mentalHealthCourse.modules[0].items[0];
  const scenario = createTrainingScenario(mentalHealthCourse, item, 'standard');
  const instructions = buildTrainingInstructions({
    course: mentalHealthCourse,
    item,
    activity: 'study',
    phase: 'study',
    scenario,
    difficulty: 'standard',
    relatedMethodology: retrieveBusinessAcademyKnowledge(records, 'značka nabídka obsah', 4),
    businessAcademyFaculty: listBusinessAcademyFacultyCourses(records),
  });

  assert.doesNotMatch(instructions, /ODBORNÝ PŘESAH MARKETINGOVÉ A BYZNYSOVÉ FAKULTY/);
  assert.doesNotMatch(instructions, /Podnikání od nápadu k růstu/);
});
