import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isFinalExamScenario } from './final-exam.js';

export const TRAINING_ATTEMPT_DURATION_MS = 8 * 60 * 60 * 1000;
export const PROFESSIONAL_PRACTICE_MINIMUM_TURNS = 3;
export const PROFESSIONAL_FINAL_EXAM_MINIMUM_TURNS = 8;

export function trainingAttemptSigningConfigured(env = process.env) {
  return Buffer.byteLength(trainingAttemptSecret(env, { optional: true }), 'utf8') >= 32;
}

export function issueTrainingAttempt({
  member,
  course,
  item,
  scenario,
  finalExam = false,
  messages,
} = {}, env = process.env, now = Date.now()) {
  const secret = trainingAttemptSecret(env);
  const memberId = clean(member?.id, 80);
  if (!memberId) throw trainingAttemptError('Přihlášený účet se nepodařilo svázat s nácvikem.', 401, 'TRAINING_ATTEMPT_MEMBER_REQUIRED');
  const canonicalMessages = canonicalTrainingMessages(messages);
  if (canonicalMessages.length !== 1 || canonicalMessages[0].role !== 'assistant') {
    throw trainingAttemptError('Nácvik musí začít serverem vydanou modelovou situací.', 400, 'TRAINING_ATTEMPT_OPENING_REQUIRED');
  }
  const scenarioId = clean(scenario?.id, 200);
  const difficulty = normalizeDifficulty(scenario?.difficulty);
  const canonicalFinalExam = finalExam === true && isFinalExamScenario(course, scenarioId);
  if (finalExam === true && !canonicalFinalExam) {
    throw trainingAttemptError('Závěrečná zkouška neodpovídá kanonickému expertnímu případu.', 409, 'TRAINING_FINAL_EXAM_MISMATCH');
  }
  if (canonicalFinalExam && difficulty !== 'expert') {
    throw trainingAttemptError('Závěrečná zkouška musí proběhnout na expertní obtížnosti.', 409, 'TRAINING_FINAL_EXAM_DIFFICULTY');
  }
  const payload = {
    v: 1,
    aid: randomUUID(),
    uid: memberId,
    cid: clean(course?.id, 160),
    cslug: clean(course?.slug, 200),
    iid: clean(item?.id, 160),
    sid: scenarioId,
    d: difficulty,
    pro: course?.id === 'profesionalni-life-coach',
    final: canonicalFinalExam,
    t: 0,
    r: 0,
    h: hashTrainingMessages(canonicalMessages),
    closed: false,
    iat: now,
    exp: now + TRAINING_ATTEMPT_DURATION_MS,
  };
  validatePayloadShape(payload, now);
  return trainingAttemptResponse(payload, signPayload(payload, secret));
}

export function verifyTrainingAttemptStep(token, {
  member,
  course,
  item,
  messages,
  requestedPhase,
  requestedScenarioId,
  requestedDifficulty,
  requestedFinalExam,
} = {}, env = process.env, now = Date.now()) {
  const payload = verifySignedPayload(token, trainingAttemptSecret(env), now);
  assertBinding(payload, { member, course, item });
  if (clean(requestedScenarioId, 200) !== payload.sid) {
    throw trainingAttemptError('Scénář nácviku byl po spuštění změněn. Spusť prosím nový nácvik.', 409, 'TRAINING_ATTEMPT_SCENARIO_CHANGED');
  }
  if (normalizeDifficulty(requestedDifficulty) !== payload.d) {
    throw trainingAttemptError('Obtížnost nácviku byla po spuštění změněna. Spusť prosím nový nácvik.', 409, 'TRAINING_ATTEMPT_DIFFICULTY_CHANGED');
  }
  if (requestedFinalExam === true !== payload.final) {
    throw trainingAttemptError('Typ nácviku neodpovídá vydané relaci.', 409, 'TRAINING_ATTEMPT_KIND_CHANGED');
  }

  const canonicalMessages = canonicalTrainingMessages(messages);
  const phase = requestedPhase === 'debrief' ? 'debrief' : 'roleplay';
  if (!payload.closed && phase === 'roleplay') {
    if (canonicalMessages.at(-1)?.role !== 'user') {
      throw trainingAttemptError('Další tah nácviku musí být odpověď studentky.', 409, 'TRAINING_ATTEMPT_USER_TURN_REQUIRED');
    }
    const prefix = canonicalMessages.slice(0, -1);
    if (hashTrainingMessages(prefix) !== payload.h) {
      throw trainingAttemptError('Přepis nácviku nenavazuje na poslední ověřený tah.', 409, 'TRAINING_ATTEMPT_HISTORY_CHANGED');
    }
    if (canonicalMessages.filter(message => message.role === 'user').length !== payload.t + 1) {
      throw trainingAttemptError('Pořadí tahů nácviku není platné.', 409, 'TRAINING_ATTEMPT_OUT_OF_SEQUENCE');
    }
    return { payload, messages: canonicalMessages, kind: 'roleplay_turn' };
  }

  if (!payload.closed && phase === 'debrief') {
    if (hashTrainingMessages(canonicalMessages) !== payload.h) {
      throw trainingAttemptError('Vyhodnocení musí vycházet z posledního autentického přepisu.', 409, 'TRAINING_ATTEMPT_HISTORY_CHANGED');
    }
    const minimumTurns = payload.pro
      ? payload.final ? PROFESSIONAL_FINAL_EXAM_MINIMUM_TURNS : PROFESSIONAL_PRACTICE_MINIMUM_TURNS
      : payload.final ? 3 : 1;
    if (payload.t < minimumTurns) {
      throw trainingAttemptError(
        payload.final
          ? `Závěrečné sezení potřebuje alespoň ${minimumTurns} skutečných intervencí koučky.`
          : `Profesní nácvik potřebuje alespoň ${minimumTurns} skutečné intervence koučky.`,
        409,
        'TRAINING_ATTEMPT_TOO_SHORT',
      );
    }
    return { payload, messages: canonicalMessages, kind: 'debrief_start' };
  }

  if (payload.closed && phase === 'debrief') {
    if (canonicalMessages.at(-1)?.role !== 'user'
      || hashTrainingMessages(canonicalMessages.slice(0, -1)) !== payload.h) {
      throw trainingAttemptError('Doplňující otázka nenavazuje na uložený rozbor.', 409, 'TRAINING_ATTEMPT_HISTORY_CHANGED');
    }
    return { payload, messages: canonicalMessages, kind: 'debrief_followup' };
  }

  throw trainingAttemptError('Ukončený nácvik nelze vrátit do modelové situace.', 409, 'TRAINING_ATTEMPT_ALREADY_CLOSED');
}

export function advanceTrainingAttempt(verifiedStep, assistantText, env = process.env, now = Date.now()) {
  const secret = trainingAttemptSecret(env);
  const { payload, messages, kind } = verifiedStep || {};
  validatePayloadShape(payload, now);
  const responseText = cleanContent(assistantText);
  if (!responseText) throw trainingAttemptError('Odpověď trenérky chybí.', 500, 'TRAINING_ATTEMPT_RESPONSE_REQUIRED');
  const nextMessages = [...messages, { role: 'assistant', content: responseText }];
  const next = {
    ...payload,
    t: kind === 'roleplay_turn' ? payload.t + 1 : payload.t,
    r: payload.r + 1,
    h: hashTrainingMessages(nextMessages),
    closed: payload.closed || kind === 'debrief_start',
    exp: now + TRAINING_ATTEMPT_DURATION_MS,
  };
  return trainingAttemptResponse(next, signPayload(next, secret));
}

export function canonicalTrainingMessages(input) {
  if (!Array.isArray(input)) {
    throw trainingAttemptError('Přepis nácviku chybí.', 400, 'TRAINING_ATTEMPT_MESSAGES_REQUIRED');
  }
  const messages = input.slice(-200).map(message => ({
    role: message?.role === 'assistant' ? 'assistant' : message?.role === 'user' ? 'user' : '',
    content: cleanContent(message?.content),
  })).filter(message => message.role && message.content);
  if (!messages.length) throw trainingAttemptError('Přepis nácviku je prázdný.', 400, 'TRAINING_ATTEMPT_MESSAGES_REQUIRED');
  return messages;
}

export function hashTrainingMessages(messages) {
  return createHash('sha256').update(JSON.stringify((messages || []).map(message => ({
    role: message.role,
    content: cleanContent(message.content),
  })))).digest('hex');
}

function trainingAttemptResponse(payload, token) {
  return {
    token,
    attemptId: payload.aid,
    scenarioId: payload.sid,
    difficulty: payload.d,
    finalExam: payload.final,
    turns: payload.t,
    closed: payload.closed,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

function assertBinding(payload, { member, course, item }) {
  if (payload.uid !== clean(member?.id, 80)
    || payload.cid !== clean(course?.id, 160)
    || payload.cslug !== clean(course?.slug, 200)
    || payload.iid !== clean(item?.id, 160)) {
    throw trainingAttemptError('Nácvik nepatří tomuto účtu, kurzu nebo lekci.', 403, 'TRAINING_ATTEMPT_BINDING_MISMATCH');
  }
}

function signPayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`elitea-training-attempt:${encoded}`).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySignedPayload(token, secret, now) {
  const [encoded, providedSignature, extra] = String(token || '').split('.');
  if (!encoded || !providedSignature || extra) {
    throw trainingAttemptError('Nácvik nemá platnou serverovou relaci. Spusť jej znovu.', 401, 'TRAINING_ATTEMPT_INVALID');
  }
  const expectedSignature = createHmac('sha256', secret).update(`elitea-training-attempt:${encoded}`).digest('base64url');
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw trainingAttemptError('Nácvik nemá platnou serverovou relaci. Spusť jej znovu.', 401, 'TRAINING_ATTEMPT_INVALID');
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch { throw trainingAttemptError('Nácvik nemá platnou serverovou relaci. Spusť jej znovu.', 401, 'TRAINING_ATTEMPT_INVALID'); }
  validatePayloadShape(payload, now);
  return payload;
}

function validatePayloadShape(payload, now) {
  const expired = Number(payload?.exp) <= now;
  if (payload?.v !== 1
    || !/^[0-9a-f-]{36}$/iu.test(payload?.aid || '')
    || !payload.uid || !payload.cid || !payload.cslug || !payload.iid || !payload.sid
    || !['guided', 'standard', 'advanced', 'expert'].includes(payload.d)
    || typeof payload.pro !== 'boolean' || typeof payload.final !== 'boolean' || typeof payload.closed !== 'boolean'
    || !Number.isInteger(payload.t) || payload.t < 0 || payload.t > 100
    || !Number.isInteger(payload.r) || payload.r < 0 || payload.r > 200
    || !/^[0-9a-f]{64}$/u.test(payload.h || '')
    || !Number.isFinite(payload.exp) || expired) {
    throw trainingAttemptError(
      expired ? 'Platnost nácviku vypršela. Spusť prosím nový pokus.' : 'Nácvik nemá platnou serverovou relaci. Spusť jej znovu.',
      401,
      expired ? 'TRAINING_ATTEMPT_EXPIRED' : 'TRAINING_ATTEMPT_INVALID',
    );
  }
}

function trainingAttemptSecret(env, { optional = false } = {}) {
  const secret = String(env.ELITEA_TRAINING_SECRET || env.CERTIFICATE_SIGNING_SECRET || env.CRON_SECRET || '');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    if (optional) return '';
    throw trainingAttemptError('Ověřené profesní nácviky nejsou v tomto prostředí správně připojené.', 503, 'TRAINING_ATTEMPT_NOT_CONFIGURED');
  }
  return secret;
}

function normalizeDifficulty(value) {
  const difficulty = String(value || '').toLowerCase();
  return ['guided', 'standard', 'advanced', 'expert'].includes(difficulty) ? difficulty : 'standard';
}

function clean(value, max) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, max);
}

function cleanContent(value) {
  return String(value || '').trim().slice(0, 12000);
}

function trainingAttemptError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}
