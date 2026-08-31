import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { courseSummary, loadCourses } from '../src/courses.js';
import { buildCourseVisual, courseVisualTypes } from '../src/course-visuals.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const courseFiles = (await readdir(join(ROOT, 'data')))
  .filter(file => /^course-.*\.md$/u.test(file) && !/-audio-scripts\.md$/u.test(file))
  .sort()
  .map(file => join(ROOT, 'data', file));
const courses = await loadCourses(courseFiles);
const items = courses.flatMap(course => course.modules.flatMap(module => module.items));

test('všech 2 561 částí Academy má obsahově ukotvený vizuální výklad', () => {
  assert.equal(courses.length, 27);
  assert.equal(items.length, 2561);
  assert.equal(items.filter(item => item.visual).length, 2561);
  assert.ok(courses.every(course => course.visuals.complete));
  assert.ok(courses.every(course => course.visuals.coveragePercent === 100));
  assert.equal(courses.reduce((sum, course) => sum + course.visuals.visualCount, 0), 2561);
});

test('každá vizuální mapa je čitelná, smysluplná a bez duplicitních kroků', () => {
  for (const item of items) {
    assert.ok(courseVisualTypes().includes(item.visual.type), `${item.title}: neplatný typ`);
    assert.ok(item.visual.title.length >= 12, `${item.title}: chybí název`);
    assert.ok(item.visual.caption.length >= 60, `${item.title}: chybí vysvětlení`);
    assert.ok(item.visual.items.length >= 3 && item.visual.items.length <= 7, `${item.title}: neplatný počet bodů`);
    assert.equal(new Set(item.visual.items.map(point => point.detail)).size, item.visual.items.length, `${item.title}: duplicitní body`);
    for (const point of item.visual.items) {
      assert.ok(point.label.length >= 5, `${item.title}: nečitelný štítek`);
      assert.ok(point.detail.length >= 20, `${item.title}: bod bez odborného významu`);
      assert.ok(point.detail.length <= 181, `${item.title}: příliš dlouhý bod`);
    }
  }
});

test('vizuální systém používá všech šest významových variant a nepůsobí jako jedna kopie', () => {
  const types = new Set(items.map(item => item.visual.type));
  assert.deepEqual([...types].sort(), courseVisualTypes().sort());
  assert.ok(new Set(items.map(item => item.visual.caption)).size >= 2000);
  assert.equal(items.filter(item => item.visual.origin === 'authored').length, 2);
  assert.equal(items.filter(item => item.visual.origin === 'content-derived').length, 2559);
});

test('mapa testu ukazuje pouze otázky a nikdy správné odpovědi', () => {
  for (const quiz of items.filter(item => item.kind === 'quiz')) {
    const visualText = quiz.visual.items.map(point => point.detail).join(' ');
    const prompts = quiz.quiz.questions.map(question => question.prompt);
    quiz.visual.items.slice(0, prompts.length).forEach((point, index) => {
      assert.ok(point.detail.startsWith(prompts[index]), `${quiz.title}: mapa změnila otázku`);
    });
    for (const answer of Object.values(quiz._quizAnswerKey || {}).map(record => record.correctAnswer)) {
      assert.ok(!visualText.includes(answer), `${quiz.title}: vizuál prozradil správnou odpověď`);
    }
  }
});

test('generovaný vizuál je deterministický a veřejný souhrn hlásí skutečné pokrytí', () => {
  const example = items.find(item => item.visual.origin === 'content-derived');
  const context = { courseId: 'deterministic', courseTitle: 'Kontrolní kurz', moduleIndex: 1, moduleTitle: 'MODUL 1 — KONTROLA' };
  assert.deepEqual(buildCourseVisual(example, context), buildCourseVisual(example, context));
  for (const course of courses) {
    assert.deepEqual(courseSummary(course).visuals, course.visuals);
  }
});
