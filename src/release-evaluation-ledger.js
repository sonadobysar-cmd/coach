import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const CODE = /^[A-Za-z0-9_.:/-]{1,200}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

/**
 * Atomically reserves one canonical release-evaluation step. A run may execute
 * each case/phase/step only once, so concurrent retries cannot cherry-pick a
 * more flattering model branch and still obtain a releasable receipt chain.
 */
export async function reserveReleaseEvaluationStep(input = {}, env = process.env, dependencies = {}) {
  const value = normalizeReservation(input);
  if (!value) throw releaseLedgerError('RELEASE_EVALUATION_STEP_INVALID', 'Release eval krok nemá platnou vazbu.');
  if (!env.DATABASE_URL) {
    throw releaseLedgerError('RELEASE_EVALUATION_LEDGER_NOT_CONFIGURED', 'Release eval ledger není nakonfigurovaný.', 503);
  }
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const inserted = await sql`INSERT INTO release_evaluation_steps (
      run_id, case_id, phase, step_id, attempt_id, previous_receipt_signature, request_fingerprint
    ) VALUES (
      ${value.runId}, ${value.caseId}, ${value.phase}, ${value.stepId}, ${value.attemptId},
      ${value.previousReceiptSignature}, ${value.requestFingerprint}
    ) ON CONFLICT DO NOTHING
    RETURNING run_id`;
  if (!Array.isArray(inserted) || inserted.length !== 1) {
    throw releaseLedgerError(
      'RELEASE_EVALUATION_STEP_REPLAY',
      'Tento krok release evaluace už byl v daném běhu použit; celý běh musí začít s novým run ID.',
      409,
    );
  }
  return { reserved: true, ...value };
}

/**
 * Academy release evaluations intentionally do not mint professional-coach
 * response receipts. This separate append-only ledger still makes every
 * canonical Academy case step single-use without pretending that a receipt
 * chain exists.
 */
export async function reserveAcademyTrainerEvaluationStep(input = {}, env = process.env, dependencies = {}) {
  const value = normalizeAcademyReservation(input);
  if (!value) throw releaseLedgerError('ACADEMY_EVALUATION_STEP_INVALID', 'Academy eval krok nemá platnou vazbu.');
  if (!env.DATABASE_URL) {
    throw releaseLedgerError('RELEASE_EVALUATION_LEDGER_NOT_CONFIGURED', 'Release eval ledger není nakonfigurovaný.', 503);
  }
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const inserted = await sql`INSERT INTO academy_trainer_evaluation_steps (
      run_id, case_id, step_id, attempt_id, request_fingerprint
    ) VALUES (
      ${value.runId}, ${value.caseId}, ${value.stepId}, ${value.attemptId}, ${value.requestFingerprint}
    ) ON CONFLICT DO NOTHING
    RETURNING run_id`;
  if (!Array.isArray(inserted) || inserted.length !== 1) {
    throw releaseLedgerError(
      'ACADEMY_EVALUATION_STEP_REPLAY',
      'Tento krok Academy evaluace už byl v daném běhu použit; celý běh musí začít s novým run ID.',
      409,
    );
  }
  return { reserved: true, ...value };
}

export function releaseEvaluationRequestFingerprint({ scenario = null, messages = [] } = {}) {
  const canonical = {
    scenario: scenario ? {
      id: String(scenario.id || ''),
      scenarioFamilyId: String(scenario.scenarioFamilyId || ''),
      challengeId: String(scenario.challengeId || ''),
      difficulty: String(scenario.difficulty || ''),
    } : null,
    messages: (Array.isArray(messages) ? messages : []).map(message => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: String(message?.content || '').normalize('NFKC').replace(/\s+/gu, ' ').trim(),
    })),
  };
  return createHash('sha256').update(canonicalJson(canonical)).digest('hex');
}

function normalizeReservation(input) {
  const runId = String(input.runId || '').trim();
  const caseId = String(input.caseId || '').trim();
  const phase = String(input.phase || '').trim();
  const stepId = String(input.stepId || '').trim();
  const attemptId = String(input.attemptId || '').trim();
  const previousReceiptSignature = input.previousReceiptSignature == null
    ? null
    : String(input.previousReceiptSignature || '').trim();
  const requestFingerprint = String(input.requestFingerprint || '').trim().toLowerCase();
  if (!CODE.test(runId)
    || runId.length < 8
    || !CODE.test(caseId)
    || !['scenario', 'roleplay', 'debrief'].includes(phase)
    || !CODE.test(stepId)
    || !CODE.test(attemptId)
    || !SHA256.test(requestFingerprint)
    || (phase === 'scenario' ? previousReceiptSignature !== null : !SHA256.test(previousReceiptSignature || ''))) return null;
  return { runId, caseId, phase, stepId, attemptId, previousReceiptSignature, requestFingerprint };
}

function normalizeAcademyReservation(input) {
  const runId = String(input.runId || '').trim();
  const caseId = String(input.caseId || '').trim();
  const stepId = String(input.stepId || '').trim();
  const attemptId = input.attemptId == null ? null : String(input.attemptId || '').trim();
  const requestFingerprint = String(input.requestFingerprint || '').trim().toLowerCase();
  if (!CODE.test(runId)
    || runId.length < 8
    || !CODE.test(caseId)
    || !/^(?:scenario|study|debrief|roleplay(?:-[1-9][0-9]*)?)$/u.test(stepId)
    || (attemptId !== null && !CODE.test(attemptId))
    || !SHA256.test(requestFingerprint)) return null;
  return { runId, caseId, stepId, attemptId, requestFingerprint };
}

function releaseLedgerError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}
