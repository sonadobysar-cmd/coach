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
const ACHIEVEMENT_STATUS_RANK = Object.freeze({ missing: 0, not_proven: 1, partial: 2, proven: 3 });
const DIFFICULTY_RANK = Object.freeze({ guided: 0, standard: 1, advanced: 2, expert: 3 });
const COACH_MASTERY_MAX_POINTS = 3;

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
    .sort(compareAttempts);
  const competencyIds = COACH_COMPETENCIES.map(competency => competency.id);
  const trustedProviderAttempts = normalized.filter(attempt => attempt.trustedProvider);
  const trustedReviewed = normalized.filter(attempt => attempt.qualityPassed && attempt.trustedProvider);
  const practiceMeasurement = preparePracticeMeasurement(trustedReviewed);
  const qualifyingPractice = practiceMeasurement.attempts.filter(attempt => (
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
  const masteryGain = buildCoachMasteryGainFromMeasurement(practiceMeasurement);

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
      development: masteryGain.competencies[competencyId],
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
      masteryGainPercent: masteryGain.normalizedGainPercent,
      measuredCompetencies: masteryGain.measuredCompetencies,
      improvedCompetencies: masteryGain.improvedCompetencies,
      advancedGains: masteryGain.advancedGains,
    },
    masteryGain,
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

/**
 * Měří změnu dovednosti, ne aktivitu. Výchozím bodem je první důvěryhodný,
 * quality-passed nácvik, v němž byla daná kompetence skutečně hodnocena.
 * Pozdější důkaz musí pocházet z jiného scénáře i jiného přepisu. Pokusy se
 * záložním modelem, neúspěšným quality gate nebo kritickou profesní chybou se
 * do růstu nezapočítají. Skála má 0 = baseline/not proven, 1 = developing,
 * 2 = proven a 3 = advanced; souhrnné procento dělí získané body pouze reálně
 * dostupným posunem u kompetencí, které už mají baseline i pozdější pokus.
 */
export function buildCoachMasteryGain(attempts = []) {
  const normalized = (Array.isArray(attempts) ? attempts : [])
    .map(normalizeAttempt)
    .filter(Boolean)
    .sort(compareAttempts);
  return buildCoachMasteryGainFromMeasurement(preparePracticeMeasurement(normalized));
}

function preparePracticeMeasurement(attempts) {
  const eligible = (Array.isArray(attempts) ? attempts : []).filter(attempt => (
    attempt.trustedProvider
    && attempt.qualityPassed
    && !attempt.finalExam
    && attempt.criticalFailures.length === 0
    && attempt.competencyStatuses.size > 0
  ));
  return distinctPracticeAttempts(eligible);
}

function buildCoachMasteryGainFromMeasurement(measurement) {
  const byCompetency = Object.fromEntries(COACH_COMPETENCIES.map(definition => {
    const assessed = measurement.attempts.filter(attempt => attempt.competencyStatuses.has(definition.id));
    const baselineAttempt = assessed[0] || null;
    const baseline = baselineAttempt
      ? coachPerformanceSnapshot(baselineAttempt, definition.id)
      : null;
    const followUps = baselineAttempt
      ? assessed.filter(attempt => attempt.completedAt.getTime() > baselineAttempt.completedAt.getTime())
      : [];
    const followUpSnapshots = followUps.map(attempt => coachPerformanceSnapshot(attempt, definition.id));
    const bestFollowUp = bestPerformance(followUpSnapshots);
    const latestFollowUp = followUpSnapshots.at(-1) || null;
    const baselinePoints = baseline?.points ?? 0;
    const bestPoints = bestFollowUp?.points ?? baselinePoints;
    const availableGainPoints = baseline && followUps.length
      ? Math.max(0, COACH_MASTERY_MAX_POINTS - baselinePoints)
      : 0;
    const gainedPoints = baseline && followUps.length
      ? Math.max(0, bestPoints - baselinePoints)
      : 0;
    const improved = gainedPoints > 0;
    const provenGain = improved && bestPoints === 2;
    const advancedGain = improved && bestPoints >= COACH_MASTERY_MAX_POINTS;
    const stage = advancedGain
      ? 'advanced'
      : provenGain
        ? 'proven'
        : improved
          ? 'developing'
          : 'baseline';
    const achievedFollowUpLevel = bestFollowUp?.level || baseline?.level || 'unmeasured';
    const sustainedEvidence = improved
      ? followUpSnapshots.filter(snapshot => snapshot.points >= bestPoints).length
      : 0;
    return [definition.id, {
      label: definition.label,
      stage,
      transition: baseline ? `${baseline.level}→${achievedFollowUpLevel}` : 'unmeasured',
      measured: Boolean(baseline && followUps.length),
      improved,
      provenGain,
      advancedGain,
      sustained: improved && sustainedEvidence >= 2,
      distinctFollowUps: followUps.length,
      baseline,
      bestFollowUp,
      latestFollowUp,
      availableGainPoints,
      gainedPoints,
      gainPercent: availableGainPoints > 0
        ? roundPercent(gainedPoints, availableGainPoints)
        : null,
      maintainedAdvanced: Boolean(
        baseline?.points === COACH_MASTERY_MAX_POINTS
        && followUpSnapshots.some(snapshot => snapshot.points === COACH_MASTERY_MAX_POINTS),
      ),
      regressedAtLatest: Boolean(
        latestFollowUp
        && latestFollowUp.points < Math.max(baselinePoints, bestPoints),
      ),
    }];
  }));

  const rows = Object.values(byCompetency);
  const measuredRows = rows.filter(row => row.measured);
  const gainEligibleRows = measuredRows.filter(row => row.availableGainPoints > 0);
  const improvedRows = gainEligibleRows.filter(row => row.improved);
  const gainedPoints = gainEligibleRows.reduce((sum, row) => sum + row.gainedPoints, 0);
  const availableGainPoints = gainEligibleRows.reduce((sum, row) => sum + row.availableGainPoints, 0);
  return {
    metric: 'verified_competency_mastery_gain',
    normalizedGainPercent: availableGainPoints > 0
      ? roundPercent(gainedPoints, availableGainPoints)
      : null,
    measurementCoveragePercent: roundPercent(measuredRows.length, COACH_COMPETENCIES.length),
    verifiedGainRatePercent: gainEligibleRows.length
      ? roundPercent(improvedRows.length, gainEligibleRows.length)
      : null,
    baselineCompetencies: rows.filter(row => row.baseline).length,
    measuredCompetencies: measuredRows.length,
    gainEligibleCompetencies: gainEligibleRows.length,
    improvedCompetencies: improvedRows.length,
    provenGains: improvedRows.filter(row => row.provenGain).length,
    advancedGains: improvedRows.filter(row => row.advancedGain).length,
    sustainedGains: improvedRows.filter(row => row.sustained).length,
    maintainedAdvancedCompetencies: measuredRows.filter(row => row.maintainedAdvanced).length,
    regressedAtLatestCompetencies: measuredRows.filter(row => row.regressedAtLatest).length,
    gainedPoints,
    availableGainPoints,
    acceptedPracticeAttempts: measurement.attempts.length,
    ignoredDuplicateAttempts: measurement.duplicates.total,
    duplicateReasons: { ...measurement.duplicates },
    competencies: byCompetency,
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

function normalizeAttempt(raw) {
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
  const competencyStatuses = achievementStatusesByCompetency(rows);
  const stableFallbackId = `attempt-${createHash('sha256').update(JSON.stringify({
    completedAt: completedAt.toISOString(),
    itemId,
    scenarioId,
    transcriptHash,
    trainingAttemptId,
    difficulty,
    finalExam: raw.final_exam === true || raw.finalExam === true,
  })).digest('hex').slice(0, 24)}`;
  return {
    id: clean(raw.id, 80) || stableFallbackId,
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
    competencyStatuses,
    provenCompetencyIds: new Set(rows.filter(row => row.status === 'proven').map(row => row.competencyId).filter(Boolean)),
    criticalFailures,
    completedAt,
  };
}

function compareAttempts(left, right) {
  const timeDifference = left.completedAt.getTime() - right.completedAt.getTime();
  if (timeDifference) return timeDifference;
  return [left.id, left.trainingAttemptId, left.scenarioId, left.transcriptHash]
    .join('\u0000')
    .localeCompare([right.id, right.trainingAttemptId, right.scenarioId, right.transcriptHash].join('\u0000'), 'en');
}

function achievementStatusesByCompetency(rows) {
  const result = new Map();
  for (const row of rows) {
    if (!row.competencyId) continue;
    const previous = result.get(row.competencyId);
    // A competency is only as strong as its weakest assessed criterion in the
    // same debrief. Taking the best row would let one excellent intervention
    // hide a missing or not-proven part of the same professional skill.
    if (!previous || ACHIEVEMENT_STATUS_RANK[row.status] < ACHIEVEMENT_STATUS_RANK[previous]) {
      result.set(row.competencyId, row.status);
    }
  }
  return result;
}

function distinctPracticeAttempts(attempts) {
  const seen = {
    ids: new Set(),
    trainingAttemptIds: new Set(),
    scenarioIds: new Set(),
    transcriptHashes: new Set(),
  };
  const duplicates = {
    total: 0,
    repeatedId: 0,
    repeatedTrainingAttempt: 0,
    repeatedScenario: 0,
    repeatedTranscript: 0,
  };
  const accepted = [];
  for (const attempt of [...attempts].sort(compareAttempts)) {
    const repeatedReason = duplicatePracticeReason(attempt, seen);
    if (repeatedReason) {
      duplicates.total += 1;
      duplicates[repeatedReason] += 1;
      continue;
    }
    accepted.push(attempt);
    if (attempt.id) seen.ids.add(attempt.id);
    if (attempt.trainingAttemptId) seen.trainingAttemptIds.add(attempt.trainingAttemptId);
    if (attempt.scenarioId) seen.scenarioIds.add(attempt.scenarioId);
    if (attempt.transcriptHash) seen.transcriptHashes.add(attempt.transcriptHash);
  }
  return { attempts: accepted, duplicates };
}

function duplicatePracticeReason(attempt, seen) {
  if (attempt.id && seen.ids.has(attempt.id)) return 'repeatedId';
  if (attempt.trainingAttemptId && seen.trainingAttemptIds.has(attempt.trainingAttemptId)) {
    return 'repeatedTrainingAttempt';
  }
  if (attempt.scenarioId && seen.scenarioIds.has(attempt.scenarioId)) return 'repeatedScenario';
  if (attempt.transcriptHash && seen.transcriptHashes.has(attempt.transcriptHash)) return 'repeatedTranscript';
  return null;
}

function coachPerformanceSnapshot(attempt, competencyId) {
  const status = attempt.competencyStatuses.get(competencyId) || 'missing';
  const advanced = status === 'proven' && DIFFICULTY_RANK[attempt.difficulty] >= DIFFICULTY_RANK.advanced;
  const points = advanced
    ? COACH_MASTERY_MAX_POINTS
    : status === 'proven'
      ? 2
      : status === 'partial'
        ? 1
        : 0;
  return {
    attemptId: attempt.id,
    scenarioId: attempt.scenarioId,
    completedAt: attempt.completedAt.toISOString(),
    difficulty: attempt.difficulty,
    status,
    level: advanced ? 'advanced' : status === 'proven' ? 'proven' : status === 'partial' ? 'developing' : 'baseline',
    points,
  };
}

function bestPerformance(snapshots) {
  let best = null;
  for (const snapshot of snapshots) {
    if (!best
      || snapshot.points > best.points
      || (snapshot.points === best.points && DIFFICULTY_RANK[snapshot.difficulty] > DIFFICULTY_RANK[best.difficulty])
      || (snapshot.points === best.points
        && DIFFICULTY_RANK[snapshot.difficulty] === DIFFICULTY_RANK[best.difficulty]
        && snapshot.completedAt > best.completedAt)) {
      best = snapshot;
    }
  }
  return best;
}

function roundPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((Number(numerator) / Number(denominator)) * 1000) / 10;
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
