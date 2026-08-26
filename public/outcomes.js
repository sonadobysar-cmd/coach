export const OUTCOME_STORAGE_KEY = 'elitea.outcomes.v1';
export const OUTCOME_SCHEMA_VERSION = 1;

const MAX_RECORDS = 500;
const TEXT_LIMITS = {
  goal: 500,
  keyLearning: 1200,
  agreedAction: 700,
  issueNote: 1200,
  evidence: 1200,
  blocker: 1000,
  harmNote: 1000,
};

export function normalizeOutcomeStore(value) {
  const candidate = value && typeof value === 'object' ? value : {};
  const records = Array.isArray(candidate.records)
    ? candidate.records.filter(record => record && typeof record === 'object').slice(0, MAX_RECORDS)
    : [];
  const activeId = typeof candidate.activeId === 'string'
    && records.some(record => record.id === candidate.activeId && record.status === 'active')
    ? candidate.activeId
    : null;
  return { schemaVersion: OUTCOME_SCHEMA_VERSION, activeId, records };
}

export function loadOutcomeStore(storage = globalThis.localStorage) {
  try {
    return normalizeOutcomeStore(JSON.parse(storage?.getItem(OUTCOME_STORAGE_KEY) || 'null'));
  } catch {
    return normalizeOutcomeStore(null);
  }
}

export function saveOutcomeStore(store, storage = globalThis.localStorage) {
  const normalized = normalizeOutcomeStore(store);
  storage?.setItem(OUTCOME_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function beginMeasuredSession(store, input = {}, options = {}) {
  const current = normalizeOutcomeStore(store);
  const now = validDate(options.now) || new Date();
  const id = cleanText(options.id, 120) || createId();
  const existingActive = current.records.find(record => record.id === current.activeId && record.status === 'active');
  if (existingActive) return current;

  const record = {
    id,
    status: 'active',
    startedAt: now.toISOString(),
    completedAt: null,
    consultationMode: cleanText(input.consultationMode, 80) || 'auto',
    goal: cleanText(input.goal, TEXT_LIMITS.goal),
    before: {
      clarity: scale(input.clarity, 0, 10),
      confidence: scale(input.confidence, 0, 10),
    },
    after: null,
    followUpDueAt: null,
    followUp: null,
    appVersion: cleanText(input.appVersion, 30) || null,
  };

  return {
    schemaVersion: OUTCOME_SCHEMA_VERSION,
    activeId: id,
    records: [record, ...current.records].slice(0, MAX_RECORDS),
  };
}

export function finishMeasuredSession(store, input = {}, options = {}) {
  const current = normalizeOutcomeStore(store);
  const now = validDate(options.now) || new Date();
  const followUpDays = scale(options.followUpDays ?? 3, 1, 30);
  const due = new Date(now.getTime() + followUpDays * 86400000);
  let changed = false;
  const records = current.records.map(record => {
    if (record.id !== current.activeId || record.status !== 'active') return record;
    changed = true;
    return {
      ...record,
      status: 'completed',
      completedAt: now.toISOString(),
      after: {
        clarity: scale(input.clarity, 0, 10),
        confidence: scale(input.confidence, 0, 10),
        understood: scale(input.understood, 1, 5),
        grounded: scale(input.grounded, 1, 5),
        insight: scale(input.insight, 1, 5),
        nextStepFit: scale(input.nextStepFit, 1, 5),
        autonomy: scale(input.autonomy, 1, 5),
        keyLearning: cleanText(input.keyLearning, TEXT_LIMITS.keyLearning),
        agreedAction: cleanText(input.agreedAction, TEXT_LIMITS.agreedAction),
        harmfulOrWrong: Boolean(input.harmfulOrWrong),
        issueNote: cleanText(input.issueNote, TEXT_LIMITS.issueNote),
        techniqueId: cleanText(input.techniqueId, 120) || null,
        provider: cleanText(input.provider, 120) || null,
        qualityScore: Number.isFinite(Number(input.qualityScore)) ? Number(input.qualityScore) : null,
        qualityPassed: typeof input.qualityPassed === 'boolean' ? input.qualityPassed : null,
        qualityRepaired: Boolean(input.qualityRepaired),
      },
      followUpDueAt: due.toISOString(),
    };
  });
  return changed ? { ...current, activeId: null, records } : current;
}

export function recordOutcomeFollowUp(store, recordId, input = {}, options = {}) {
  const current = normalizeOutcomeStore(store);
  const now = validDate(options.now) || new Date();
  const allowedStatuses = new Set(['yes', 'partial', 'no', 'not_applicable']);
  const actionStatus = allowedStatuses.has(input.actionStatus) ? input.actionStatus : 'not_applicable';
  return {
    ...current,
    records: current.records.map(record => record.id !== recordId ? record : {
      ...record,
      status: 'followed_up',
      followUp: {
        completedAt: now.toISOString(),
        actionStatus,
        retainedUsefulness: scale(input.retainedUsefulness, 1, 5),
        evidence: cleanText(input.evidence, TEXT_LIMITS.evidence),
        blocker: cleanText(input.blocker, TEXT_LIMITS.blocker),
        worseOrHarmed: Boolean(input.worseOrHarmed),
        harmNote: cleanText(input.harmNote, TEXT_LIMITS.harmNote),
      },
    }),
  };
}

export function dueFollowUps(store, now = new Date()) {
  const timestamp = (validDate(now) || new Date()).getTime();
  return normalizeOutcomeStore(store).records
    .filter(record => record.status === 'completed' && record.followUpDueAt && new Date(record.followUpDueAt).getTime() <= timestamp)
    .sort((a, b) => new Date(a.followUpDueAt) - new Date(b.followUpDueAt));
}

export function outcomeSummary(store) {
  const records = normalizeOutcomeStore(store).records;
  const completed = records.filter(record => record.after);
  const followed = records.filter(record => record.followUp);
  const actionAttempts = followed.filter(record => record.followUp.actionStatus !== 'not_applicable');
  const actionSuccesses = actionAttempts.filter(record => ['yes', 'partial'].includes(record.followUp.actionStatus));
  return {
    sessions: completed.length,
    followUps: followed.length,
    averageClarityDelta: average(completed.map(record => record.after.clarity - record.before.clarity)),
    averageConfidenceDelta: average(completed.map(record => record.after.confidence - record.before.confidence)),
    averageUnderstood: average(completed.map(record => record.after.understood)),
    averageGrounded: average(completed.map(record => record.after.grounded)),
    averageNextStepFit: average(completed.map(record => record.after.nextStepFit)),
    actionRate: actionAttempts.length ? Math.round((actionSuccesses.length / actionAttempts.length) * 100) : null,
    flaggedSessions: completed.filter(record => record.after.harmfulOrWrong || record.followUp?.worseOrHarmed).length,
  };
}

export function anonymousOutcomeRows(store) {
  return normalizeOutcomeStore(store).records
    .filter(record => record.after)
    .map(record => ({
      schema_version: OUTCOME_SCHEMA_VERSION,
      session_id: anonymousId(record.id),
      started_at: record.startedAt,
      completed_at: record.completedAt,
      consultation_mode: record.consultationMode,
      clarity_before: record.before.clarity,
      clarity_after: record.after.clarity,
      clarity_delta: record.after.clarity - record.before.clarity,
      confidence_before: record.before.confidence,
      confidence_after: record.after.confidence,
      confidence_delta: record.after.confidence - record.before.confidence,
      understood: record.after.understood,
      grounded: record.after.grounded,
      insight: record.after.insight,
      next_step_fit: record.after.nextStepFit,
      autonomy: record.after.autonomy,
      harmful_or_wrong: record.after.harmfulOrWrong,
      technique_id: record.after.techniqueId || '',
      provider: record.after.provider || '',
      internal_quality_score: record.after.qualityScore ?? '',
      internal_quality_passed: record.after.qualityPassed ?? '',
      internal_quality_repaired: record.after.qualityRepaired,
      follow_up_completed: Boolean(record.followUp),
      action_status: record.followUp?.actionStatus || '',
      retained_usefulness: record.followUp?.retainedUsefulness ?? '',
      worse_or_harmed: record.followUp?.worseOrHarmed ?? '',
    }));
}

export function outcomeRowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.map(escape).join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n');
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return Math.round((finite.reduce((sum, value) => sum + value, 0) / finite.length) * 10) / 10;
}

function cleanText(value, maxLength) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function scale(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function anonymousId(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `s-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
