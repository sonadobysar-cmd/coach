import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACADEMY_TRAINER_EVAL_STANDARD,
  academyTrainerReleaseBaseline,
  assessAcademyTrainerBaselineEligibility,
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
import { createTrainingScenario } from '../src/training.js';

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
    const roundTrip = createTrainingScenario(
      entry.course,
      entry.item,
      entry.scenario.difficulty,
      entry.scenario.id,
    );
    assert.equal(roundTrip.id, entry.scenario.id, `${entry.course.id}: eval situaci nelze bezpečně znovu načíst`);
    assert.equal(roundTrip.itemId, entry.item.id, `${entry.course.id}: eval situace nepatří zvolené lekci`);
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

test('release baseline lze zapsat pouze z jednoho čerstvého a verzovaného výsledku 81/81', () => {
  const runId = 'fresh-81-run';
  const results = plan.flatMap(entry => ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => ({
    id: `${entry.course.id}:${type}`,
    courseId: entry.course.id,
    type,
    pass: true,
    evaluationRunId: runId,
  })));
  const report = summarizeAcademyTrainerEval(results, {
    baseUrl: 'http://127.0.0.1:4173',
    startedAt: '2026-08-31T10:00:00.000Z',
    completedAt: '2026-08-31T10:05:00.000Z',
  });
  report.run = {
    id: runId,
    resumedFrom: null,
    freshCases: 81,
    reusedCases: 0,
    attemptedCases: 81,
  };
  report.provenance = validProvenance(runId);
  assert.equal(report.summary.complete, true);
  assert.equal(report.summary.total, 81);
  assert.equal(report.byType.study.passed, 27);
  assert.deepEqual(assessAcademyTrainerBaselineEligibility(report), { eligible: true, reasons: [] });
  const baseline = academyTrainerReleaseBaseline(report);
  assert.deepEqual(baseline, {
    standardVersion: 2,
    verifiedAt: '2026-08-31T10:05:00.000Z',
    baseUrl: 'http://127.0.0.1:4173',
    courseCount: 27,
    caseCount: 81,
    passedCases: 81,
    failedCases: 0,
    passRate: 100,
    complete: true,
    provenance: report.provenance,
  });
});

test('resume s 79 recyklovanými PASS nikdy nevytvoří release baseline', () => {
  const report = completeReport('resume-run');
  report.run.resumedFrom = 'reports/older.json';
  report.run.freshCases = 2;
  report.run.reusedCases = 79;
  report.run.attemptedCases = 2;
  for (const result of report.results.slice(0, 79)) result.evaluationRunId = 'older-run';

  const eligibility = assessAcademyTrainerBaselineEligibility(report);
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes('resumed-run-cannot-release'));
  assert.ok(eligibility.reasons.includes('all-cases-must-be-fresh'));
  assert.ok(eligibility.reasons.includes('reused-cases-present'));
  assert.ok(eligibility.reasons.includes('results-not-bound-to-current-run'));
  assert.throws(() => academyTrainerReleaseBaseline(report), /baseline nelze zapsat/u);
});

test('baseline odmítne chybějící provenance, špinavý commit a jiný skutečně použitý model', () => {
  const missing = completeReport('missing-provenance');
  missing.provenance.promptSystemFingerprint = null;
  missing.provenance.deployment.identity = null;
  assert.deepEqual(
    assessAcademyTrainerBaselineEligibility(missing).reasons,
    ['prompt-system-fingerprint-missing', 'deployment-identity-missing-or-mismatched'],
  );

  const dirty = completeReport('dirty-run');
  dirty.provenance.gitDirty = true;
  dirty.provenance.modelIds.observedByType.simulation = ['openai/jiny-model'];
  const eligibility = assessAcademyTrainerBaselineEligibility(dirty);
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes('git-worktree-must-be-clean'));
  assert.ok(eligibility.reasons.includes('model-provenance-simulation-mismatch'));
});

function completeReport(runId) {
  const results = plan.flatMap(entry => ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => ({
    id: `${entry.course.id}:${type}`,
    courseId: entry.course.id,
    type,
    pass: true,
    evaluationRunId: runId,
  })));
  const report = summarizeAcademyTrainerEval(results, {
    baseUrl: 'http://127.0.0.1:4173',
    startedAt: '2026-08-31T10:00:00.000Z',
    completedAt: '2026-08-31T10:05:00.000Z',
  });
  report.run = { id: runId, resumedFrom: null, freshCases: 81, reusedCases: 0, attemptedCases: 81 };
  report.provenance = validProvenance(runId);
  return report;
}

function validProvenance(runId) {
  return {
    appVersion: '0.39.0',
    gitCommitSha: 'a'.repeat(40),
    gitDirty: false,
    modelIds: {
      study: 'openai/gpt-5.6-terra',
      simulation: 'openai/gpt-5.6-luna',
      debrief: 'openai/gpt-5.6-terra',
      observedByType: {
        study: ['openai/gpt-5.6-terra'],
        simulation: ['openai/gpt-5.6-luna'],
        debrief: ['openai/gpt-5.6-terra'],
      },
    },
    promptSystemFingerprint: 'b'.repeat(64),
    evaluationCodeFingerprint: 'c'.repeat(64),
    evalPlanFingerprint: 'd'.repeat(64),
    deployment: { baseUrl: 'http://127.0.0.1:4173', identity: `local:${'a'.repeat(40)}` },
    generatedAt: '2026-08-31T10:00:00.000Z',
    runId,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
