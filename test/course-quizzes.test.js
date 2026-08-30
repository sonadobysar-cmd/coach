import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gradeCourseQuiz } from '../src/course-quizzes.js';
import { loadCourses, publicCourseDetail } from '../src/courses.js';
import { submitCourseQuizAttempt } from '../src/course-quiz-service.js';

const coursePaths = (await readdir(resolve('data')))
  .filter(name => /^course-.*\.md$/.test(name) && !name.includes('audio-scripts'))
  .map(name => resolve('data', name));
const courses = await loadCourses(coursePaths);
const quizItems = courses.flatMap(course => course.modules.flatMap(module =>
  module.items.filter(item => item.kind === 'quiz').map(item => ({ course, item }))));

test('všech 421 modulových testů je interaktivních a bodovaných', () => {
  assert.equal(courses.length, 27);
  assert.equal(quizItems.length, 421);
  assert.equal(quizItems.reduce((sum, entry) => sum + entry.item.quiz.questionCount, 0), 1689);
  assert.ok(quizItems.every(({ item }) => item.quiz.questions.length >= 4));
  assert.ok(quizItems.every(({ item }) => item.quiz.passPercent === 75));
  assert.ok(quizItems.every(({ item }) => item._quizAnswerKey));
  assert.equal(courses.reduce((sum, course) => sum + course.quiz.testCount, 0), 421);
});

test('veřejný kurz nikdy neprozradí bodovací klíč ani označenou odpověď', () => {
  for (const course of courses) {
    const payload = publicCourseDetail(course);
    const json = JSON.stringify(payload);
    assert.doesNotMatch(json, /_quizAnswerKey|correctOptionId|correctAnswer/);
    for (const item of payload.modules.flatMap(module => module.items).filter(item => item.kind === 'quiz')) {
      assert.match(item.markdown, /Odpovědi se zobrazí až po odevzdání/);
      assert.doesNotMatch(item.markdown, /^\s*1\..*\*\*/m);
      assert.ok(item.quiz.questions.every(question => question.options.every(option =>
        Object.keys(option).sort().join(',') === 'id,text')));
    }
  }
});

test('serverový klíč spolehlivě rozliší nesplněný a splněný pokus', () => {
  const { item } = quizItems[0];
  const correct = Object.fromEntries(item.quiz.questions.map(question => [
    question.id, item._quizAnswerKey[question.id].correctOptionId,
  ]));
  const wrong = Object.fromEntries(item.quiz.questions.map(question => [
    question.id, question.options.find(option => option.id !== correct[question.id]).id,
  ]));
  assert.deepEqual(gradeCourseQuiz(item, wrong), {
    scorePercent: 0,
    correctCount: 0,
    questionCount: item.quiz.questionCount,
    passPercent: 75,
    passed: false,
    results: assertResults(gradeCourseQuiz(item, wrong).results),
  });
  const passed = gradeCourseQuiz(item, correct);
  assert.equal(passed.scorePercent, 100);
  assert.equal(passed.passed, true);
  assert.ok(passed.results.every(result => result.correct && result.correctOptionId));
});

test('pokus se uloží serverově a klient nediktuje skóre', async () => {
  const { course, item } = quizItems[0];
  const answers = Object.fromEntries(item.quiz.questions.map(question => [
    question.id, item._quizAnswerKey[question.id].correctOptionId,
  ]));
  const queries = [];
  const responses = [[], [{ count: 2 }], []];
  const sql = (strings, ...values) => {
    queries.push({ text: strings.join('?'), values });
    return Promise.resolve(responses.shift() || []);
  };
  const result = await submitCourseQuizAttempt(
    { id: '11111111-1111-4111-8111-111111111111' }, course, item, answers,
    { DATABASE_URL: 'postgres://test' }, { sqlFactory: () => sql },
  );
  assert.equal(result.passed, true);
  assert.equal(result.attemptNumber, 3);
  assert.equal(queries.length, 3);
  assert.match(queries[2].text, /INSERT INTO academy_quiz_attempts/);
});

function assertResults(results) {
  assert.ok(results.every(result => result.correct === false));
  return results;
}
