import { createHash } from 'node:crypto';
import { getCourseTrainerProfile } from './course-trainer-profiles.js';
import { attachCourseMastery } from './course-mastery.js';
import {
  assessDebriefResponse,
  assessRoleplayResponse,
  assessStudyResponse,
} from './training-quality.js';
import { createTrainingScenario, trainingMode } from './training.js';

export const ACADEMY_TRAINER_EVAL_STANDARD = Object.freeze({
  version: 1,
  courseCount: 27,
  casesPerCourse: 3,
  requiredCases: 81,
  requiredPassRate: 100,
  caseTypes: Object.freeze(['study', 'simulation', 'debrief']),
});

const DISALLOWED_PROVIDERS = /(?:demo|fallback|course-role-router)/iu;

export function selectTrainerEvalItem(course) {
  const candidates = (course?.modules || [])
    .flatMap(module => module.items || [])
    .filter(item => item?.kind !== 'quiz' && item?.type !== 'quiz' && String(item?.markdown || '').trim().length >= 240);
  if (!candidates.length) throw new Error(`${course?.id || 'unknown'}: chybí odborná část pro živý eval trenérky.`);

  return [...candidates].sort((left, right) => {
    const leftIntro = /(?:úvod|přehled|co kurz|co program|co .* je)/iu.test(`${left.title} ${left.markdown}`) ? 1 : 0;
    const rightIntro = /(?:úvod|přehled|co kurz|co program|co .* je)/iu.test(`${right.title} ${right.markdown}`) ? 1 : 0;
    if (leftIntro !== rightIntro) return leftIntro - rightIntro;
    return String(right.markdown || '').length - String(left.markdown || '').length;
  })[0];
}

export function buildAcademyTrainerEvalPlan(courses = []) {
  if (courses.length !== ACADEMY_TRAINER_EVAL_STANDARD.courseCount) {
    throw new Error(`Eval vyžaduje přesně ${ACADEMY_TRAINER_EVAL_STANDARD.courseCount} kurzů, nalezeno ${courses.length}.`);
  }
  const defaultProfile = getCourseTrainerProfile('__missing-course__');
  const plan = courses
    .map(rawCourse => {
      const course = rawCourse?.mastery?.scenarios?.length ? rawCourse : attachCourseMastery(rawCourse);
      const profile = getCourseTrainerProfile(course.id);
      if (profile === defaultProfile) throw new Error(`${course.id}: kurz používá obecnou trenérku.`);
      const item = selectTrainerEvalItem(course);
      const scenario = createTrainingScenario(course, item, 'advanced');
      if (!Array.isArray(scenario.rubric) || scenario.rubric.length < 5) {
        throw new Error(`${course.id}: scénář nemá úplnou odbornou rubriku.`);
      }
      return {
        course,
        item,
        profile,
        scenario,
        expectedStudyMode: trainingMode(course, 'study'),
        expectedSimulationMode: trainingMode(course, 'simulation'),
      };
    })
    .sort((left, right) => left.course.id.localeCompare(right.course.id, 'cs'));

  const caseCount = plan.length * ACADEMY_TRAINER_EVAL_STANDARD.casesPerCourse;
  if (caseCount !== ACADEMY_TRAINER_EVAL_STANDARD.requiredCases) {
    throw new Error(`Eval plán má ${caseCount}/${ACADEMY_TRAINER_EVAL_STANDARD.requiredCases} případů.`);
  }
  return plan;
}

export function studyEvalRequest(entry) {
  return {
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    activity: 'study',
    phase: 'study',
    difficulty: 'advanced',
    memory: evaluationMemory(),
    messages: [{
      role: 'user',
      content: `Vysvětli mi odborný princip části „${entry.item.title}“ vlastními slovy, ukaž jeden konkrétní příklad použití v roli ${entry.profile.studentRole} a nakonec jednou otázkou ověř moje pochopení.`,
    }],
  };
}

export function simulationEvalRequest(entry) {
  return {
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    activity: 'simulation',
    phase: 'roleplay',
    difficulty: 'advanced',
    memory: evaluationMemory(),
    messages: [{
      role: 'user',
      content: 'Než se rozhodneme, co dál: co je v této situaci pro tebe nejdůležitější a jaká konkrétní fakta už máš?',
    }],
  };
}

export function debriefEvalRequest(entry, simulationText) {
  const studentText = simulationEvalRequest(entry).messages[0].content;
  return {
    courseSlug: entry.course.slug,
    itemId: entry.item.id,
    activity: 'simulation',
    phase: 'debrief',
    difficulty: 'advanced',
    memory: evaluationMemory(),
    messages: [
      { role: 'user', content: studentText },
      { role: 'assistant', content: String(simulationText || '') },
      { role: 'user', content: 'Ukončuji simulaci. Vyhodnoť celý nácvik pouze podle přepisu.' },
    ],
  };
}

export function evaluateTrainerStudy(entry, payload, request) {
  const deterministic = assessStudyResponse(payload?.text, {
    messages: request.messages,
    course: entry.course,
    item: entry.item,
  });
  return finishCase(entry, 'study', payload, [
    check('real-model-provider', realProvider(payload?.provider)),
    check('study-mode', payload?.mode === entry.expectedStudyMode),
    check('study-phase', payload?.activity === 'study' && payload?.phase === 'study'),
    check('server-quality-gate', payload?.qualityGate?.pass === true),
    check('lesson-grounding', deterministic.pass, deterministic.issues),
    check('substantive-explanation', wordCount(payload?.text) >= 45),
    check('one-checking-question', questionCount(payload?.text) === 1),
  ]);
}

export function evaluateTrainerSimulation(entry, payload) {
  const deterministic = assessRoleplayResponse(payload?.text);
  return finishCase(entry, 'simulation', payload, [
    check('real-model-provider', realProvider(payload?.provider)),
    check('simulation-mode', payload?.mode === entry.expectedSimulationMode),
    check('roleplay-phase', payload?.activity === 'simulation' && payload?.phase === 'roleplay'),
    check('server-quality-gate', payload?.qualityGate?.pass === true),
    check('counterpart-role-integrity', deterministic.pass, deterministic.issues),
    check('natural-counterpart-turn', wordCount(payload?.text) >= 4 && wordCount(payload?.text) <= 120),
  ]);
}

export function evaluateTrainerDebrief(entry, payload, request) {
  const deterministic = assessDebriefResponse(payload?.text, {
    messages: request.messages,
    rubric: entry.scenario.rubric,
  });
  const achievementRows = Array.isArray(payload?.achievement?.rows) ? payload.achievement.rows : [];
  return finishCase(entry, 'debrief', payload, [
    check('real-model-provider', realProvider(payload?.provider)),
    check('debrief-mode', payload?.mode === entry.expectedSimulationMode),
    check('debrief-phase', payload?.activity === 'simulation' && payload?.phase === 'debrief'),
    check('server-quality-gate', payload?.qualityGate?.pass === true),
    check('evidence-grounded-debrief', deterministic.pass, deterministic.issues),
    check('complete-course-rubric', achievementRows.length === entry.scenario.rubric.length),
    check('no-missing-rubric-status', achievementRows.length > 0 && achievementRows.every(row => row.status !== 'missing')),
  ]);
}

export function summarizeAcademyTrainerEval(results = [], { baseUrl = '', startedAt = '', completedAt = '' } = {}) {
  const passed = results.filter(result => result.pass).length;
  const failed = results.length - passed;
  const courses = [...new Set(results.map(result => result.courseId))];
  const byType = Object.fromEntries(ACADEMY_TRAINER_EVAL_STANDARD.caseTypes.map(type => {
    const cases = results.filter(result => result.type === type);
    return [type, { total: cases.length, passed: cases.filter(result => result.pass).length }];
  }));
  const passRate = results.length ? Number((passed / results.length * 100).toFixed(2)) : 0;
  return {
    standardVersion: ACADEMY_TRAINER_EVAL_STANDARD.version,
    startedAt,
    completedAt,
    baseUrl,
    liveModelCalls: true,
    privacy: 'Výstupy ani vstupy konverzací se neukládají; report obsahuje jen kontrolní výsledky, délku a otisk odpovědi.',
    summary: {
      courseCount: courses.length,
      total: results.length,
      passed,
      failed,
      passRate,
      complete: courses.length === ACADEMY_TRAINER_EVAL_STANDARD.courseCount
        && results.length === ACADEMY_TRAINER_EVAL_STANDARD.requiredCases
        && failed === 0
        && passRate === ACADEMY_TRAINER_EVAL_STANDARD.requiredPassRate,
    },
    byType,
    results,
  };
}

export function academyTrainerReleaseBaseline(report) {
  return {
    standardVersion: ACADEMY_TRAINER_EVAL_STANDARD.version,
    verifiedAt: report?.completedAt || null,
    baseUrl: report?.baseUrl || null,
    courseCount: Number(report?.summary?.courseCount || 0),
    caseCount: Number(report?.summary?.total || 0),
    passedCases: Number(report?.summary?.passed || 0),
    failedCases: Number(report?.summary?.failed || 0),
    passRate: Number(report?.summary?.passRate || 0),
    complete: report?.summary?.complete === true,
  };
}

function evaluationMemory() {
  return {
    identity_preferences: { preferred_name: 'Eval', address_form: 'tykani' },
    business_context: { stage: 'test', industry: 'ověřovací scénář Elitea Academy' },
    coaching_profile: { support_accommodations: 'Jedna jasná otázka nebo jeden ověřovací krok.' },
  };
}

function finishCase(entry, type, payload, checks) {
  return {
    id: `${entry.course.id}:${type}`,
    courseId: entry.course.id,
    courseSlug: entry.course.slug,
    courseTitle: entry.course.title,
    trainer: entry.profile.label,
    itemId: entry.item.id,
    itemTitle: entry.item.title,
    type,
    pass: checks.every(item => item.pass),
    checks,
    provider: String(payload?.provider || '') || null,
    qualityGate: payload?.qualityGate || null,
    responseWords: wordCount(payload?.text),
    responseFingerprint: responseFingerprint(payload?.text),
  };
}

function check(name, pass, detail = []) {
  return { name, pass: Boolean(pass), ...(Array.isArray(detail) && detail.length ? { detail } : {}) };
}

function realProvider(provider) {
  const value = String(provider || '').trim();
  return value.length >= 3 && !DISALLOWED_PROVIDERS.test(value);
}

function questionCount(value) {
  return (String(value || '').match(/\?/gu) || []).length;
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean).length;
}

function responseFingerprint(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}
