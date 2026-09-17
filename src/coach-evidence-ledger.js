import { createHash } from 'node:crypto';
import {
  detectCoachCriticalFailures,
  indexedCoachStudentTurns,
  requiredCoachEvidenceCount,
} from './coach-competencies.js';
import {
  assessCoachCriterionEvidence,
  hasConsequencesMappingContradiction,
  mentionsConsequencesAndOptions,
} from './coach-evidence-rules.js';
import {
  COACH_RUBRIC_REGISTRY_VERSION,
  normalizeCoachRubricLabel,
  resolveCoachRubricCriterion,
} from './coach-rubric-registry.js';

export const COACH_EVIDENCE_LEDGER_ID = 'elitea/coach-evidence-ledger-v1';

/**
 * Builds the server-owned source of truth for a professional coach debrief.
 *
 * The ledger is intentionally model independent. A model may later influence
 * the tone of a debrief, but it cannot add evidence, change a status, move a
 * citation to another turn or hide a critical failure.
 */
export function buildCoachEvidenceLedger({
  messages = [],
  rubric = [],
  scenario = {},
  responseLanguage = 'cs',
  lessonEvidence = null,
} = {}) {
  const language = responseLanguage === 'sk' ? 'sk' : 'cs';
  const turns = indexedCoachStudentTurns(messages).map(turn => Object.freeze({
    index: turn.index,
    reference: turn.reference,
    text: clean(turn.text),
    previousCounterpartText: clean(turn.previousCounterpartText),
    nextCounterpartText: clean(turn.nextCounterpartText),
  }));
  const criticalFailures = detectCoachCriticalFailures(messages).map(failure => Object.freeze({
    code: clean(failure.code),
    competencyId: clean(failure.competencyId),
    studentTurnIndex: Number(failure.studentTurnIndex || 0),
    reference: clean(failure.reference) || `S${Number(failure.studentTurnIndex || 0)}`,
    quote: canonicalTurnQuote(turns, failure.studentTurnIndex, failure.quote),
  }));

  const rows = (Array.isArray(rubric) ? rubric : []).map((rawLabel, criterionIndex) => {
    const label = clean(rawLabel);
    const criterionContext = {
      ...scenario,
      scenario,
      criterionIndex,
      label,
    };
    const entry = resolveCoachRubricCriterion(label, criterionContext);
    const requiredEvidence = requiredCoachEvidenceCount(label);
    const relatedFailures = entry.resolved
      ? criticalFailures.filter(failure => failure.competencyId === entry.competencyId)
      : [];
    const attempts = turns.map(turn => {
      const assessment = assessCoachCriterionEvidence({
        entry: entry.resolved ? entry : null,
        label,
        quote: turn.text,
        previousCounterpartText: turn.previousCounterpartText,
        nextCounterpartText: turn.nextCounterpartText,
        context: criterionContext,
        lessonEvidence: resolveLessonEvidence(lessonEvidence, {
          entry,
          label,
          criterionIndex,
          scenario,
          turn,
        }),
      });
      const conflictsWithCriticalFailure = relatedFailures.some(failure => (
        failure.studentTurnIndex === turn.index
      ));
      return Object.freeze({
        reference: turn.reference,
        turnIndex: turn.index,
        quote: turn.text,
        relevant: assessment.relevant === true && !conflictsWithCriticalFailure,
        reason: conflictsWithCriticalFailure
          ? 'critical_failure_is_not_positive_evidence'
          : clean(assessment.reason) || null,
      });
    });
    const evidence = attempts
      .filter(attempt => attempt.relevant)
      .slice(0, Math.max(requiredEvidence, 2))
      .map(attempt => Object.freeze({
        reference: attempt.reference,
        turnIndex: attempt.turnIndex,
        quote: attempt.quote,
      }));
    const observedFailures = attempts.filter(attempt => (
      !attempt.relevant
      && entry.resolved
      && isObservedCompetencyFailure({
        competencyId: entry.competencyId,
        normalizedLabel: entry.normalizedLabel,
        attempt,
        turns,
      })
    )).map(attempt => Object.freeze({
      reference: attempt.reference,
      turnIndex: attempt.turnIndex,
      quote: attempt.quote,
      reason: observedFailureReason(entry.competencyId, entry.normalizedLabel),
    }));
    const status = rowStatus({
      resolved: entry.resolved === true,
      evidenceCount: evidence.length,
      requiredEvidence,
      criticalFailureCount: relatedFailures.length,
      observedFailureCount: observedFailures.length,
    });
    const gapEvidence = selectGapEvidence({
      attempts,
      turns,
      relatedFailures,
      observedFailures,
      evidence,
      status,
    });
    return Object.freeze({
      criterionIndex,
      label,
      normalizedLabel: normalizeCoachRubricLabel(label),
      resolved: entry.resolved === true,
      resolutionReason: entry.resolved ? null : clean(entry.reason),
      competencyId: entry.resolved ? entry.competencyId : null,
      evidenceRuleId: entry.resolved ? entry.evidenceRuleId : null,
      evidenceKind: entry.resolved ? entry.evidenceKind : null,
      requiredEvidence,
      status,
      evidence: Object.freeze(evidence),
      criticalFailures: Object.freeze(relatedFailures),
      observedFailures: Object.freeze(observedFailures),
      gapEvidence,
    });
  });

  const priority = selectPriority(rows);
  const summary = Object.freeze({
    criterionCount: rows.length,
    proven: rows.filter(row => row.status === 'proven').length,
    partial: rows.filter(row => row.status === 'partial').length,
    notProven: rows.filter(row => row.status === 'not_proven').length,
    criticalFailures: criticalFailures.length,
    unresolvedCriteria: rows.filter(row => !row.resolved).length,
    allProven: rows.length > 0
      && criticalFailures.length === 0
      && rows.every(row => row.status === 'proven'),
  });
  // Bind the ledger to the complete transcript, not only to the projected
  // student turns used for competency evidence. Otherwise an extra assistant
  // or system message outside the projection could change the real session
  // while leaving a previously issued canonical debrief apparently valid.
  const transcriptFingerprint = fingerprint((Array.isArray(messages) ? messages : [])
    .map((message, index) => ({
      index,
      role: clean(message?.role) || null,
      content: clean(message?.content),
    }))
    .filter(message => message.content));
  const rubricFingerprint = fingerprint(rows.map(row => ({
    label: row.label,
    normalizedLabel: row.normalizedLabel,
    evidenceRuleId: row.evidenceRuleId,
  })));
  const lessonContext = canonicalLessonContext(scenario);
  const lessonContextFingerprint = fingerprint(lessonContext);
  const unsignedLedger = {
    schemaVersion: 1,
    evidenceEngine: COACH_EVIDENCE_LEDGER_ID,
    registryVersion: COACH_RUBRIC_REGISTRY_VERSION,
    language,
    turnCount: turns.length,
    turns: Object.freeze(turns),
    rows: Object.freeze(rows),
    criticalFailures: Object.freeze(criticalFailures),
    priority,
    summary,
    transcriptFingerprint,
    rubricFingerprint,
    lessonContext,
    lessonContextFingerprint,
  };
  return deepFreeze({
    ...unsignedLedger,
    ledgerFingerprint: fingerprint(unsignedLedger),
  });
}

function canonicalLessonContext(scenario = {}) {
  const moduleValue = scenario?.moduleIndex ?? scenario?.item?.moduleIndex;
  const moduleIndex = Number(moduleValue);
  return Object.freeze({
    scenarioId: clean(scenario?.id) || null,
    scenarioFamilyId: clean(scenario?.scenarioFamilyId) || null,
    difficulty: clean(scenario?.difficulty) || null,
    courseId: clean(scenario?.courseId) || null,
    itemId: clean(scenario?.itemId || scenario?.item?.id) || null,
    itemTitle: clean(scenario?.itemTitle || scenario?.item?.title) || null,
    itemKind: clean(scenario?.itemKind || scenario?.item?.kind) || null,
    moduleIndex: Number.isInteger(moduleIndex) && moduleIndex >= 0 ? moduleIndex : null,
  });
}

export function coachEvidenceLedgerValid(ledger) {
  if (!ledger || ledger.evidenceEngine !== COACH_EVIDENCE_LEDGER_ID) return false;
  if (!/^[a-f0-9]{64}$/u.test(String(ledger.ledgerFingerprint || ''))) return false;
  const { ledgerFingerprint, ...unsignedLedger } = ledger;
  return fingerprint(unsignedLedger) === ledgerFingerprint;
}

function rowStatus({
  resolved,
  evidenceCount,
  requiredEvidence,
  criticalFailureCount,
  observedFailureCount,
}) {
  if (!resolved || criticalFailureCount > 0) return 'not_proven';
  if (observedFailureCount > 0 && evidenceCount >= requiredEvidence) return 'partial';
  if (evidenceCount >= requiredEvidence) return 'proven';
  return 'not_proven';
}

function selectGapEvidence({
  attempts,
  turns,
  relatedFailures,
  observedFailures,
  evidence,
  status,
}) {
  if (status === 'proven') return null;
  const critical = relatedFailures[0];
  if (critical) {
    return Object.freeze({
      reference: critical.reference,
      turnIndex: critical.studentTurnIndex,
      quote: critical.quote,
      reason: critical.code,
      source: 'critical_failure',
    });
  }
  if (observedFailures[0]) {
    return Object.freeze({
      ...observedFailures[0],
      source: 'observed_competency_failure',
    });
  }
  if (evidence[0]) {
    return Object.freeze({
      ...evidence[0],
      reason: 'insufficient_distinct_evidence',
      source: 'partial_evidence',
    });
  }
  const failedAttempts = attempts.filter(attempt => !attempt.relevant);
  const correctionCandidate = failedAttempts.find(attempt => {
    const turn = turns.find(candidate => candidate.index === attempt.turnIndex);
    return signalsCorrection(turn?.nextCounterpartText);
  });
  const candidate = correctionCandidate || failedAttempts[0];
  return candidate ? Object.freeze({
    reference: candidate.reference,
    turnIndex: candidate.turnIndex,
    quote: candidate.quote,
    reason: candidate.reason || 'criterion_not_demonstrated',
    source: correctionCandidate ? 'counterpart_correction' : 'failed_evidence_attempt',
  }) : null;
}

function selectPriority(rows) {
  const row = rows.find(candidate => candidate.criticalFailures.length > 0)
    || rows.find(candidate => candidate.observedFailures.length > 0)
    || rows.find(candidate => candidate.status === 'not_proven')
    || rows.find(candidate => candidate.status === 'partial')
    || null;
  if (!row) return null;
  return Object.freeze({
    criterionIndex: row.criterionIndex,
    label: row.label,
    competencyId: row.competencyId,
    status: row.status,
    evidence: row.gapEvidence,
    criticalFailureCode: row.criticalFailures[0]?.code || null,
  });
}

function resolveLessonEvidence(value, input) {
  if (typeof value === 'function') return value(input) === true;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[input.entry?.evidenceRuleId] === true
      || value[input.label] === true
      || value[input.criterionIndex] === true;
  }
  return value === true;
}

function signalsCorrection(value) {
  const normalized = clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
  // A preference or boundary such as "nechci získat svobodu" is content,
  // not proof that the coach misheard the client. Count only an explicit
  // correction of meaning, wording or understanding.
  return /(?:to jsem nerekl|to jsem nerekla|to som nepovedal|to som nepovedala|takhle jsem to nemysl|takto som to nemysl|takhle to nemam|takto to nemam|takhle to necitim|takto to necitim|takhle to nevnimam|takto to nevnimam|ne(?:ri|r)i?k[aá]m ze|nehovorim ze|nesedi mi (?:to|tahle|tato) (?:interpretace|reflexe)|to mi nesedi|nepridavej mi|nepridavaj mi|podsouv|nerozumel(?:a)? jsi mi|nepochopil(?:a)? jsi me|oprav prosim)/u.test(normalized)
    || /^(?:ne|nie)\s*[,;:—-]?\s*(?:takhle|takto|tohle|toto)\b.{0,90}\b(?:nemam|nemysl|nerikam|nehovorim|nerek|nepoved|nesedi|nepasuj|nepochop|nerozum)/u.test(normalized);
}

function isObservedCompetencyFailure({ competencyId, normalizedLabel, attempt, turns }) {
  const turn = turns.find(candidate => candidate.index === attempt.turnIndex);
  if (!turn) return false;
  if (/jsou zmapovany dusledky a moznosti/u.test(normalizedLabel)
    && !attempt.relevant
    && (hasConsequencesMappingContradiction(attempt.quote)
      || mentionsConsequencesAndOptions(attempt.quote))) {
    return true;
  }
  if (competencyId === 'active_listening') {
    return signalsCorrection(turn.nextCounterpartText);
  }
  if (competencyId === 'alliance_repair') {
    return signalsAllianceCorrection(turn.previousCounterpartText);
  }
  return false;
}

function signalsAllianceCorrection(value) {
  const text = clean(value);
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();
  // A prospective boundary ("když to zopakuješ, budu mít pocit...") is not
  // evidence that an alliance rupture has already happened. Downgrading a
  // later correct response for this hypothetical warning made the trainer
  // search for an error that was not present in the student's work.
  if (/\b(?:kdyz|ak)\b.{0,120}\b(?:budu|budem|bude)\b.{0,50}\b(?:pocit|dojem)\b.{0,55}\b(?:neposlouch|nepocuv)/u.test(normalized)) {
    return false;
  }
  return signalsCorrection(text)
    || /(?:neposlouch|nepočúv|neslysiš|neslyšíš|nepocujes|nepočuješ|nerozumel|nerozuměl|nerozumela|nerozuměla|nerozumies|nerozumíš|domyslel|domyslela|podsouv|pridavas mi|přidáváš mi)/iu.test(text);
}

function observedFailureReason(competencyId, normalizedLabel = '') {
  if (/jsou zmapovany dusledky a moznosti/u.test(normalizedLabel)) {
    return 'later_turn_omitted_consequences_or_options';
  }
  return competencyId === 'active_listening'
    ? 'counterpart_corrected_added_or_misheard_meaning'
    : 'counterpart_correction_was_not_repaired';
}

function canonicalTurnQuote(turns, turnIndex, fallback) {
  return turns.find(turn => turn.index === Number(turnIndex))?.text || clean(fallback);
}

function clean(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function fingerprint(value) {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(',')}}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
