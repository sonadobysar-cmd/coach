import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import {
  COACH_COMPETENCIES,
  coachCompetencyIdForCriterion,
  detectCoachCriticalFailures,
  isProfessionalLifeCoachCourse,
} from './coach-competencies.js';

export const COACH_PASSPORT_STANDARD = Object.freeze({
  minimumPracticeScenarios: 18,
  minimumProofsPerCompetency: 2,
  minimumPassingFinalExams: 2,
  advancedDifficulties: Object.freeze(['advanced', 'expert']),
});

const TRUSTED_PROVIDER = /^(openai|anthropic|google|xai|mistral|meta)\/[a-z0-9._-]+$/i;
const UNTRUSTED_PROVIDER = /(fallback|demo|local|deterministic)/i;
const ACHIEVEMENT_STATUSES = new Set(['proven', 'partial', 'not_proven', 'missing']);

/**
 * Persistuje jen ověřitelné hodnocení a hash přepisu, nikoli citlivý obsah
 * samotného sezení. Opakované odeslání stejného přepisu je idempotentní.
 */
export async function recordCoachDebriefAttempt(
  { member, course, item, scenarioId, difficulty, finalExam = false, trainingAttemptId = null, messages, result },
  env = process.env,
  dependencies = {},
) {
  if (!isProfessionalLifeCoachCourse(course?.id)) return { recorded: false, reason: 'not_professional_coach_course' };
  if (!member?.id || !env.DATABASE_URL) return { recorded: false, reason: 'storage_unavailable' };

  const record = buildCoachDebriefRecord({
    course,
    item,
    scenarioId,
    difficulty,
    finalExam,
    messages,
    result,
  });
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await sql`INSERT INTO member_profiles (user_id) VALUES (${member.id}::uuid)
    ON CONFLICT (user_id) DO NOTHING`;
  const inserted = await sql`INSERT INTO academy_coach_debrief_attempts (
      id, user_id, course_id, course_slug, item_id, scenario_id, difficulty,
      final_exam, provider, quality_passed, achievement, critical_failures,
      transcript_hash, training_attempt_id, completed_at
    ) VALUES (
      ${randomUUID()}::uuid, ${member.id}::uuid, ${record.courseId}, ${record.courseSlug},
      ${record.itemId}, ${record.scenarioId}, ${record.difficulty}, ${record.finalExam},
      ${record.provider}, ${record.qualityPassed}, ${JSON.stringify(record.achievement)}::jsonb,
      ${JSON.stringify(record.criticalFailures)}::jsonb, ${record.transcriptHash},
      ${normalizeUuid(trainingAttemptId)}::uuid, now()
    ) ON CONFLICT DO NOTHING
    RETURNING id, completed_at`;

  return {
    recorded: inserted.length > 0,
    duplicate: inserted.length === 0,
    transcriptHash: record.transcriptHash,
    trustedProvider: isTrustedCoachAssessmentProvider(record.provider),
    qualityPassed: record.qualityPassed,
  };
}

export function buildCoachDebriefRecord({
  course,
  item,
  scenarioId,
  difficulty,
  finalExam = false,
  messages = [],
  result = {},
} = {}) {
  if (!isProfessionalLifeCoachCourse(course?.id)) {
    throw Object.assign(new Error('Competency passport patří pouze kurzu Profesionální life coach.'), {
      code: 'COACH_PASSPORT_WRONG_COURSE',
    });
  }
  const safeDifficulty = normalizeDifficulty(result?.scenario?.difficulty || difficulty);
  const safeItemId = clean(item?.id, 160) || 'unknown-item';
  const safeScenarioId = clean(result?.scenario?.id || scenarioId, 200)
    || `${course.id}:${safeItemId}:${safeDifficulty}`;
  const criticalFailures = sanitizeCriticalFailures(detectCoachCriticalFailures(messages));
  const rows = sanitizeAchievementRows(result?.achievement?.rows);
  const provenCompetencyIds = new Set(
    rows.filter(row => row.status === 'proven').map(row => row.competencyId).filter(Boolean),
  );
  const finalCompetenciesComplete = finalExam !== true
    || COACH_COMPETENCIES.every(competency => provenCompetencyIds.has(competency.id));
  const allProven = criticalFailures.length === 0
    && rows.length > 0
    && rows.every(row => row.status === 'proven')
    && finalCompetenciesComplete;
  const transcriptHash = createHash('sha256').update(JSON.stringify(
    (Array.isArray(messages) ? messages : []).map(message => ({
      role: clean(message?.role, 24),
      content: String(message?.content || '').normalize('NFKC').replace(/\s+/gu, ' ').trim(),
    })),
  )).digest('hex');

  return {
    courseId: course.id,
    courseSlug: clean(course.slug, 200),
    itemId: safeItemId,
    scenarioId: safeScenarioId,
    difficulty: safeDifficulty,
    finalExam: finalExam === true,
    provider: clean(result?.provider, 160) || 'unknown',
    qualityPassed: result?.qualityGate?.pass === true,
    achievement: {
      rows,
      allProven,
      proven: rows.filter(row => row.status === 'proven').length,
    },
    criticalFailures,
    transcriptHash,
  };
}

/**
 * Čistý, deterministický výpočet profesní způsobilosti z uložených pokusů.
 * Důkaz kompetence se v jednom scénáři započte nejvýše jednou.
 */
export function buildCoachCompetencyPassport(attempts = [], standard = COACH_PASSPORT_STANDARD) {
  const normalized = (Array.isArray(attempts) ? attempts : [])
    .map(normalizeAttempt)
    .filter(Boolean)
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const competencyIds = COACH_COMPETENCIES.map(competency => competency.id);
  const trustedProviderAttempts = normalized.filter(attempt => attempt.trustedProvider);
  const trustedReviewed = normalized.filter(attempt => attempt.qualityPassed && attempt.trustedProvider);
  const qualifyingPractice = trustedReviewed.filter(attempt => (
    !attempt.finalExam
    && attempt.criticalFailures.length === 0
    && attempt.provenCompetencyIds.size > 0
  ));
  const practiceScenarioKeys = new Set(qualifyingPractice.map(attempt => attempt.scenarioKey));
  const passingFinalExamAttempts = distinctFinalExamAttempts(trustedReviewed.filter(attempt => (
    attempt.finalExam
    && attempt.difficulty === 'expert'
    && attempt.achievement.allProven === true
    && competencyIds.every(competencyId => attempt.provenCompetencyIds.has(competencyId))
    && attempt.criticalFailures.length === 0
  )));
  const finalExamsPassed = passingFinalExamAttempts.length;
  const requiredFinalExams = positiveInteger(
    standard.minimumPassingFinalExams,
    COACH_PASSPORT_STANDARD.minimumPassingFinalExams,
  );
  const finalExamPassed = finalExamsPassed >= requiredFinalExams;

  const competencies = Object.fromEntries(COACH_COMPETENCIES.map(competencyDefinition => {
    const competencyId = competencyDefinition.id;
    const proofAttempts = qualifyingPractice.filter(attempt => attempt.provenCompetencyIds.has(competencyId));
    const scenarioProofs = uniqueBy(proofAttempts, attempt => attempt.scenarioKey);
    const advancedProofs = scenarioProofs.filter(attempt => standard.advancedDifficulties.includes(attempt.difficulty));
    return [competencyId, {
      label: competencyDefinition.label,
      proofs: scenarioProofs.length,
      requiredProofs: standard.minimumProofsPerCompetency,
      advancedProofs: advancedProofs.length,
      requiredAdvancedProofs: 1,
      proven: scenarioProofs.length >= standard.minimumProofsPerCompetency,
      advancedProven: advancedProofs.length >= 1,
      scenarioIds: scenarioProofs.map(attempt => attempt.scenarioId),
    }];
  }));

  // Kritická profesní chyba musí zůstat v pase i tehdy, když celý debrief
  // neprošel quality gate. Jinak by přísnější kontrola paradoxně chybu skryla.
  const criticalFailures = trustedProviderAttempts.flatMap(attempt => attempt.criticalFailures.map(failure => ({
    ...failure,
    attemptId: attempt.id,
    scenarioId: attempt.scenarioId,
    scenarioKey: attempt.scenarioKey,
    completedAt: attempt.completedAt.toISOString(),
    remediatedBy: laterRemediation(attempt, failure.competencyId, trustedReviewed),
  })));
  const unresolvedCriticalFailures = criticalFailures.filter(failure => !failure.remediatedBy);
  const missingCompetencyIds = competencyIds.filter(id => !competencies[id].proven);
  const missingAdvancedCompetencyIds = competencyIds.filter(id => !competencies[id].advancedProven);
  const trustedReviewedAttempts = trustedReviewed.length;
  const practiceScenarios = practiceScenarioKeys.size;
  const practiceComplete = practiceScenarios >= standard.minimumPracticeScenarios;
  const competencyCoverageComplete = missingCompetencyIds.length === 0;
  const advancedCoverageComplete = missingAdvancedCompetencyIds.length === 0;
  const remediationComplete = unresolvedCriticalFailures.length === 0;
  const eligible = practiceComplete
    && competencyCoverageComplete
    && advancedCoverageComplete
    && remediationComplete
    && finalExamPassed;

  return {
    eligible,
    standard: {
      minimumPracticeScenarios: standard.minimumPracticeScenarios,
      minimumProofsPerCompetency: standard.minimumProofsPerCompetency,
      minimumPassingFinalExams: requiredFinalExams,
      requiredCompetencies: competencyIds.length,
      advancedDifficulties: [...standard.advancedDifficulties],
    },
    progress: {
      totalAttempts: normalized.length,
      trustedProviderAttempts: trustedProviderAttempts.length,
      trustedReviewedAttempts,
      practiceScenarios,
      requiredPracticeScenarios: standard.minimumPracticeScenarios,
      provenCompetencies: competencyIds.length - missingCompetencyIds.length,
      requiredCompetencies: competencyIds.length,
      advancedCompetencies: competencyIds.length - missingAdvancedCompetencyIds.length,
      requiredAdvancedCompetencies: competencyIds.length,
      unresolvedCriticalFailures: unresolvedCriticalFailures.length,
      finalExamsPassed,
      requiredFinalExams,
      finalExamPassed,
    },
    competencies,
    missingCompetencyIds,
    missingAdvancedCompetencyIds,
    criticalFailures,
    unresolvedCriticalFailures,
    reasons: coachPassportReasons({
      practiceScenarios,
      minimumPracticeScenarios: standard.minimumPracticeScenarios,
      missingCompetencyIds,
      missingAdvancedCompetencyIds,
      unresolvedCriticalFailures,
      finalExamsPassed,
      requiredFinalExams,
      finalExamPassed,
      trustedProviderAttempts: trustedProviderAttempts.length,
    }),
  };
}

export function coachPassportReasons({
  practiceScenarios = 0,
  minimumPracticeScenarios = COACH_PASSPORT_STANDARD.minimumPracticeScenarios,
  missingCompetencyIds = [],
  missingAdvancedCompetencyIds = [],
  unresolvedCriticalFailures = [],
  finalExamsPassed = 0,
  requiredFinalExams = COACH_PASSPORT_STANDARD.minimumPassingFinalExams,
  finalExamPassed = false,
  trustedProviderAttempts = 0,
} = {}) {
  const reasons = [];
  if (trustedProviderAttempts === 0) {
    reasons.push('Absolvuj praxi vyhodnocenou důvěryhodným živým AI modelem; lokální ani záložní hodnocení se nezapočítává.');
  }
  if (practiceScenarios < minimumPracticeScenarios) {
    reasons.push(`Dokonči ještě ${minimumPracticeScenarios - practiceScenarios} z ${minimumPracticeScenarios} různých kvalitně vyhodnocených praktických scénářů.`);
  }
  if (missingCompetencyIds.length) {
    reasons.push(`Dvakrát v odlišných scénářích prokaž ještě ${missingCompetencyIds.length} z ${COACH_COMPETENCIES.length} profesních kompetencí: ${competencyLabels(missingCompetencyIds)}.`);
  }
  if (missingAdvancedCompetencyIds.length) {
    reasons.push(`Na náročné nebo expertní obtížnosti prokaž ještě ${missingAdvancedCompetencyIds.length} profesních kompetencí: ${competencyLabels(missingAdvancedCompetencyIds)}.`);
  }
  if (unresolvedCriticalFailures.length) {
    reasons.push(`Dolož pozdější nápravu ${unresolvedCriticalFailures.length} kritických profesních pochybení ve stejné kompetenci.`);
  }
  const safeRequiredFinalExams = positiveInteger(
    requiredFinalExams,
    COACH_PASSPORT_STANDARD.minimumPassingFinalExams,
  );
  const safeFinalExamsPassed = Math.max(0, Math.min(safeRequiredFinalExams, Number(finalExamsPassed) || 0));
  if (!finalExamPassed || safeFinalExamsPassed < safeRequiredFinalExams) {
    const remaining = safeRequiredFinalExams - safeFinalExamsPassed;
    reasons.push(`Úspěšně dokonči ještě ${remaining} ze ${safeRequiredFinalExams} odlišných expertních závěrečných koučovacích sezení.`);
  }
  return reasons;
}

export function isTrustedCoachAssessmentProvider(value) {
  const provider = String(value || '').trim();
  return TRUSTED_PROVIDER.test(provider) && !UNTRUSTED_PROVIDER.test(provider);
}

function normalizeAttempt(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const completedAt = new Date(raw.completed_at || raw.completedAt || 0);
  if (!Number.isFinite(completedAt.getTime())) return null;
  const achievement = raw.achievement && typeof raw.achievement === 'object' ? raw.achievement : {};
  const rows = sanitizeAchievementRows(achievement.rows);
  const criticalFailures = sanitizeCriticalFailures(raw.critical_failures || raw.criticalFailures);
  const difficulty = normalizeDifficulty(raw.difficulty);
  const itemId = clean(raw.item_id || raw.itemId, 160) || 'unknown-item';
  const scenarioId = clean(raw.scenario_id || raw.scenarioId, 200) || `${itemId}:${difficulty}`;
  const transcriptHash = clean(raw.transcript_hash || raw.transcriptHash, 128);
  const trainingAttemptId = clean(raw.training_attempt_id || raw.trainingAttemptId, 80);
  return {
    id: clean(raw.id, 80) || `attempt-${index}`,
    itemId,
    scenarioId,
    scenarioKey: scenarioId,
    transcriptHash,
    trainingAttemptId,
    difficulty,
    finalExam: raw.final_exam === true || raw.finalExam === true,
    provider: clean(raw.provider, 160),
    trustedProvider: isTrustedCoachAssessmentProvider(raw.provider),
    qualityPassed: raw.quality_passed === true || raw.qualityPassed === true,
    achievement: {
      rows,
      allProven: achievement.allProven === true || achievement.all_proven === true,
    },
    provenCompetencyIds: new Set(rows.filter(row => row.status === 'proven').map(row => row.competencyId).filter(Boolean)),
    criticalFailures,
    completedAt,
  };
}

function distinctFinalExamAttempts(attempts) {
  const seenTrainingAttemptIds = new Set();
  const seenIds = new Set();
  const seenScenarioIds = new Set();
  const seenTranscriptHashes = new Set();
  return attempts.filter(attempt => {
    const id = clean(attempt.id, 80);
    const trainingAttemptId = clean(attempt.trainingAttemptId, 80);
    const scenarioId = clean(attempt.scenarioId, 200);
    const transcriptHash = clean(attempt.transcriptHash, 128);
    if ((trainingAttemptId && seenTrainingAttemptIds.has(trainingAttemptId))
      || (id && seenIds.has(id))
      || (scenarioId && seenScenarioIds.has(scenarioId))
      || (transcriptHash && seenTranscriptHashes.has(transcriptHash))) return false;
    if (trainingAttemptId) seenTrainingAttemptIds.add(trainingAttemptId);
    if (id) seenIds.add(id);
    if (scenarioId) seenScenarioIds.add(scenarioId);
    if (transcriptHash) seenTranscriptHashes.add(transcriptHash);
    return true;
  });
}

function laterRemediation(failedAttempt, competencyId, attempts) {
  if (!competencyId) return null;
  const remediation = attempts.find(candidate => (
    candidate.completedAt.getTime() > failedAttempt.completedAt.getTime()
    && candidate.scenarioKey !== failedAttempt.scenarioKey
    && candidate.criticalFailures.every(failure => failure.competencyId !== competencyId)
    && candidate.provenCompetencyIds.has(competencyId)
  ));
  return remediation ? {
    attemptId: remediation.id,
    scenarioId: remediation.scenarioId,
    completedAt: remediation.completedAt.toISOString(),
  } : null;
}

function sanitizeAchievementRows(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 80).map(row => {
    const label = clean(row?.label, 400);
    const status = ACHIEVEMENT_STATUSES.has(row?.status) ? row.status : 'missing';
    return {
      label,
      status,
      competencyId: coachCompetencyIdForCriterion(label),
    };
  }).filter(row => row.label);
}

function sanitizeCriticalFailures(failures) {
  return (Array.isArray(failures) ? failures : []).slice(0, 40).map(failure => ({
    code: clean(failure?.code, 100) || 'unknown_professional_failure',
    competencyId: clean(failure?.competencyId, 100) || null,
    studentTurnIndex: Number.isInteger(Number(failure?.studentTurnIndex))
      ? Number(failure.studentTurnIndex)
      : null,
    reference: clean(failure?.reference, 40) || null,
  }));
}

function normalizeDifficulty(value) {
  const difficulty = String(value || '').toLowerCase();
  return ['guided', 'standard', 'advanced', 'expert'].includes(difficulty) ? difficulty : 'standard';
}

function uniqueBy(values, key) {
  return [...new Map(values.map(value => [key(value), value])).values()];
}

function competencyLabels(ids) {
  const wanted = new Set(ids);
  return COACH_COMPETENCIES
    .filter(competency => wanted.has(competency.id))
    .map(competency => competency.label)
    .join(', ');
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeUuid(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(text)
    ? text
    : null;
}

function clean(value, max) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, max);
}
