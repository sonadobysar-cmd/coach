import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACADEMY_TRAINER_EVAL_STANDARD,
  academyTrainerReleaseBaseline,
  buildAcademyTrainerEvalPlan,
  debriefEvalRequest,
  evaluateTrainerDebrief,
  evaluateTrainerSimulation,
  evaluateTrainerStudy,
  simulationEvalRequest,
  studyEvalRequest,
  summarizeAcademyTrainerEval,
} from '../src/academy-trainer-evals.js';
import { loadCourses } from '../src/courses.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const paths = (await readdir(join(ROOT, 'data')))
  .filter(name => /^course-.*\.md$/u.test(name) && !name.includes('audio-scripts'))
  .sort()
  .map(name => join(ROOT, 'data', name));
const courses = await loadCourses(paths);
const plan = buildAcademyTrainerEvalPlan(courses);

test('živá maturita trenérek plánuje přesně 27 × 3 odborně ukotvených případů', () => {
  assert.equal(plan.length, ACADEMY_TRAINER_EVAL_STANDARD.courseCount);
  assert.equal(plan.length * ACADEMY_TRAINER_EVAL_STANDARD.casesPerCourse, 81);
  assert.equal(new Set(plan.map(entry => entry.profile.label)).size, 27);
  assert.equal(new Set(plan.map(entry => `${entry.course.id}:${entry.item.id}`)).size, 27);
  for (const entry of plan) {
    assert.ok(entry.item.markdown.length >= 240, `${entry.course.id}: krátká evaluační lekce`);
    assert.ok(entry.scenario.rubric.length >= 5, `${entry.course.id}: krátká rubrika`);
    assert.match(studyEvalRequest(entry).messages[0].content, new RegExp(escapeRegExp(entry.item.title), 'u'));
    assert.equal(simulationEvalRequest(entry).courseSlug, entry.course.slug);
  }
});

test('eval odmítne demo, fallback, rozbitou roli i nepodložený debrief', () => {
  const entry = plan[0];
  const studyRequest = studyEvalRequest(entry);
  const badStudy = evaluateTrainerStudy(entry, {
    text: 'Obecná odpověď bez vztahu k lekci?', provider: 'demo-no-api-key', mode: entry.expectedStudyMode,
    activity: 'study', phase: 'study', qualityGate: { pass: true },
  }, studyRequest);
  assert.equal(badStudy.pass, false);
  assert.equal(badStudy.checks.find(check => check.name === 'real-model-provider').pass, false);

  const badSimulation = evaluateTrainerSimulation(entry, {
    text: 'Jako AI trenérka ti doporučuji použít správnou techniku.', provider: 'openai/test',
    mode: entry.expectedSimulationMode, activity: 'simulation', phase: 'roleplay', qualityGate: { pass: true },
  });
  assert.equal(badSimulation.pass, false);

  const request = debriefEvalRequest(entry, 'Je pro mě důležité rozhodnout se správně.');
  const badDebrief = evaluateTrainerDebrief(entry, {
    text: 'Výborně, všechno bylo perfektní.', provider: 'openai/test', mode: entry.expectedSimulationMode,
    activity: 'simulation', phase: 'debrief', qualityGate: { pass: true }, achievement: { rows: [] },
  }, request);
  assert.equal(badDebrief.pass, false);
});

test('release baseline lze zapsat pouze z úplného výsledku 81/81', () => {
  const results = plan.flatMap(entry => ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => ({
    id: `${entry.course.id}:${type}`, courseId: entry.course.id, type, pass: true,
  })));
  const report = summarizeAcademyTrainerEval(results, {
    baseUrl: 'http://127.0.0.1:4173',
    startedAt: '2026-08-31T10:00:00.000Z',
    completedAt: '2026-08-31T10:05:00.000Z',
  });
  assert.equal(report.summary.complete, true);
  assert.equal(report.summary.total, 81);
  assert.equal(report.byType.study.passed, 27);
  assert.deepEqual(academyTrainerReleaseBaseline(report), {
    standardVersion: 1,
    verifiedAt: '2026-08-31T10:05:00.000Z',
    baseUrl: 'http://127.0.0.1:4173',
    courseCount: 27,
    caseCount: 81,
    passedCases: 81,
    failedCases: 0,
    passRate: 100,
    complete: true,
  });
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
