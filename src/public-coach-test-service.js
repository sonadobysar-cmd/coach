import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const PUBLIC_COACH_TEST_MAX_TURNS = 6;
export const PUBLIC_COACH_TEST_DURATION_MS = 4 * 60 * 60 * 1000;

const MODES = new Set(['coach', 'mentor']);

export function issuePublicCoachTestSession(input = {}, env = process.env, now = Date.now()) {
  const secret = signingSecret(env);
  const mode = sanitizePublicTestMode(input.mode);
  const payload = {
    v: 1,
    sid: randomUUID(),
    mode,
    turns: 0,
    iat: now,
    exp: now + PUBLIC_COACH_TEST_DURATION_MS,
  };
  return publicSessionResponse(payload, signPayload(payload, secret));
}

export function advancePublicCoachTestSession(token, messages, env = process.env, now = Date.now()) {
  const secret = signingSecret(env);
  const payload = verifySignedPayload(token, secret, now);
  const transcript = sanitizePublicTestMessages(messages);
  const userTurns = transcript.filter(message => message.role === 'user').length;

  if (payload.turns >= PUBLIC_COACH_TEST_MAX_TURNS) throw publicTestError('Test už dosáhl limitu šesti odpovědí.', 429, 'PUBLIC_TEST_COMPLETE');
  if (userTurns !== payload.turns + 1) throw publicTestError('Testovací konverzace nenavazuje na předchozí krok.', 409, 'PUBLIC_TEST_OUT_OF_SEQUENCE');

  const next = { ...payload, turns: payload.turns + 1, exp: now + PUBLIC_COACH_TEST_DURATION_MS };
  return {
    payload,
    transcript,
    nextSession: publicSessionResponse(next, signPayload(next, secret)),
  };
}

export function verifyPublicCoachTestSession(token, env = process.env, now = Date.now()) {
  return verifySignedPayload(token, signingSecret(env), now);
}

export function sanitizePublicTestMode(value) {
  return MODES.has(value) ? value : 'coach';
}

export function sanitizePublicTestMessages(input) {
  if (!Array.isArray(input)) throw publicTestError('Chybí testovací konverzace.', 400, 'PUBLIC_TEST_MESSAGES_REQUIRED');
  const messages = input
    .slice(-13)
    .map(message => ({
      role: message?.role === 'assistant' ? 'assistant' : message?.role === 'user' ? 'user' : '',
      content: redactDirectIdentifiers(cleanText(message?.content, 1400)),
    }))
    .filter(message => message.role && message.content);
  if (!messages.length || messages.at(-1)?.role !== 'user') {
    throw publicTestError('Poslední zpráva musí být otázka nebo odpověď testerky.', 400, 'PUBLIC_TEST_USER_MESSAGE_REQUIRED');
  }
  if (messages.some((message, index) => index > 0 && message.role === messages[index - 1].role)) {
    throw publicTestError('Testovací konverzace nemá platné pořadí zpráv.', 400, 'PUBLIC_TEST_MESSAGE_ORDER');
  }
  return messages;
}

export function publicTestMemory(mode = 'coach') {
  return {
    identity_preferences: { preferred_name: '', address_form: 'tykani' },
    coaching_profile: {
      onboarding_complete: true,
      desired_outcome: '',
      main_obstacle: '',
      support_style: mode === 'mentor' ? 'mentoring' : 'koucovani',
    },
  };
}

export function sanitizePublicCoachTestFeedback(input = {}, env = process.env) {
  let session;
  try {
    session = verifyPublicCoachTestSession(input.sessionToken, env);
  } catch (error) {
    return { ok: false, error: error.message || 'Testovací relace není platná.' };
  }
  const evaluatorName = cleanText(input.evaluatorName, 100);
  const contact = cleanText(input.contact, 180);
  const notes = cleanText(input.notes, 2400);
  const usefulness = integerRating(input.usefulness);
  const roleFidelity = integerRating(input.roleFidelity);
  const wouldUse = ['yes', 'maybe', 'no'].includes(input.wouldUse) ? input.wouldUse : null;
  const transcriptConsent = input.transcriptConsent === true;
  let transcript = null;

  if (session.turns < 2) return { ok: false, error: 'Nejdřív prosím vyzkoušej alespoň dvě odpovědi Elitea.' };
  if (transcriptConsent) {
    try { transcript = sanitizePublicTestMessagesForStorage(input.messages); }
    catch { return { ok: false, error: 'Přepis pro sdílení nemá platný formát.' }; }
  }
  if (evaluatorName.length < 2) return { ok: false, error: 'Napiš prosím jméno nebo přezdívku.' };
  if (!usefulness || !roleFidelity || !wouldUse) return { ok: false, error: 'Ohodnoť prosím užitečnost, věrohodnost role a ochotu Eliteu používat.' };
  if (notes.length < 10) return { ok: false, error: 'Napiš prosím alespoň jednu konkrétní věc, která fungovala nebo chyběla.' };

  return {
    ok: true,
    value: {
      id: randomUUID(),
      sessionId: session.sid,
      mode: session.mode,
      turnCount: session.turns,
      evaluatorName,
      contact,
      usefulness,
      roleFidelity,
      wouldUse,
      notes,
      transcriptConsent,
      transcript,
    },
  };
}

export async function savePublicCoachTestFeedback(feedback, env = process.env, dependencies = {}) {
  if (!env.DATABASE_URL) throw publicTestError('Ukládání hodnocení není připojené.', 503, 'PUBLIC_TEST_STORAGE_UNAVAILABLE');
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await sql`INSERT INTO public_coach_test_feedback (
      id, session_id, role_mode, turn_count, evaluator_name, contact, usefulness,
      role_fidelity, would_use, notes, transcript_consent, transcript
    ) VALUES (
      ${feedback.id}, ${feedback.sessionId}, ${feedback.mode}, ${feedback.turnCount},
      ${feedback.evaluatorName}, ${feedback.contact}, ${feedback.usefulness},
      ${feedback.roleFidelity}, ${feedback.wouldUse}, ${feedback.notes},
      ${feedback.transcriptConsent}, ${feedback.transcript ? JSON.stringify(feedback.transcript) : null}::jsonb
    ) ON CONFLICT (session_id) DO UPDATE SET
      evaluator_name=EXCLUDED.evaluator_name,
      contact=EXCLUDED.contact,
      usefulness=EXCLUDED.usefulness,
      role_fidelity=EXCLUDED.role_fidelity,
      would_use=EXCLUDED.would_use,
      notes=EXCLUDED.notes,
      transcript_consent=EXCLUDED.transcript_consent,
      transcript=EXCLUDED.transcript,
      updated_at=now()`;

  const emailed = await sendFeedbackEmail(feedback, env, dependencies.fetchImpl || fetch).catch(() => false);
  return { stored: true, emailed };
}

export async function listPublicCoachTestFeedback(env = process.env, dependencies = {}) {
  if (!env.DATABASE_URL) throw publicTestError('Přehled hodnocení není připojený.', 503, 'PUBLIC_TEST_STORAGE_UNAVAILABLE');
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const rows = await sql`SELECT
      id, role_mode, turn_count, evaluator_name, contact, usefulness, role_fidelity,
      would_use, notes, transcript_consent, transcript, created_at, updated_at
    FROM public_coach_test_feedback
    ORDER BY created_at DESC
    LIMIT 250`;
  const feedback = rows.map(row => {
    const transcript = sanitizePublicTestMessagesForStorage(row.transcript);
    const assistantTurns = transcript.filter(message => message?.role === 'assistant').length;
    return {
      id: row.id,
      mode: sanitizePublicTestMode(row.role_mode),
      turnCount: Number(row.turn_count) || 0,
      evaluatorName: cleanText(row.evaluator_name, 100),
      contact: cleanText(row.contact, 180),
      usefulness: integerRating(row.usefulness) || 0,
      roleFidelity: integerRating(row.role_fidelity) || 0,
      wouldUse: ['yes', 'maybe', 'no'].includes(row.would_use) ? row.would_use : null,
      notes: cleanText(row.notes, 2400),
      transcriptConsent: row.transcript_consent === true,
      transcript,
      transcriptComplete: row.transcript_consent === true ? assistantTurns >= Number(row.turn_count) : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  });
  const average = key => feedback.length
    ? Number((feedback.reduce((sum, item) => sum + item[key], 0) / feedback.length).toFixed(1))
    : 0;
  return {
    feedback,
    summary: {
      total: feedback.length,
      coach: feedback.filter(item => item.mode === 'coach').length,
      mentor: feedback.filter(item => item.mode === 'mentor').length,
      averageUsefulness: average('usefulness'),
      averageRoleFidelity: average('roleFidelity'),
      needsAttention: feedback.filter(item => item.usefulness <= 3 || item.roleFidelity <= 3 || item.wouldUse === 'no').length,
    },
  };
}

function publicSessionResponse(payload, token) {
  return {
    token,
    sessionId: payload.sid,
    mode: payload.mode,
    turnsUsed: payload.turns,
    remainingTurns: Math.max(0, PUBLIC_COACH_TEST_MAX_TURNS - payload.turns),
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

function signPayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`elitea-public-test:${encoded}`).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySignedPayload(token, secret, now) {
  const [encoded, providedSignature, extra] = String(token || '').split('.');
  if (!encoded || !providedSignature || extra) throw publicTestError('Testovací relace není platná.', 401, 'PUBLIC_TEST_INVALID_SESSION');
  const expectedSignature = createHmac('sha256', secret).update(`elitea-public-test:${encoded}`).digest('base64url');
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw publicTestError('Testovací relace není platná.', 401, 'PUBLIC_TEST_INVALID_SESSION');
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch { throw publicTestError('Testovací relace není platná.', 401, 'PUBLIC_TEST_INVALID_SESSION'); }
  if (payload?.v !== 1 || !/^[0-9a-f-]{36}$/i.test(payload.sid || '') || !MODES.has(payload.mode)
    || !Number.isInteger(payload.turns) || payload.turns < 0 || payload.turns > PUBLIC_COACH_TEST_MAX_TURNS
    || !Number.isFinite(payload.exp) || payload.exp <= now) {
    throw publicTestError(payload?.exp <= now ? 'Platnost testu vypršela. Obnov stránku a spusť nový.' : 'Testovací relace není platná.', 401, 'PUBLIC_TEST_INVALID_SESSION');
  }
  return payload;
}

function signingSecret(env) {
  const secret = env.ELITEA_PUBLIC_TEST_SECRET || env.CRON_SECRET;
  if (!secret || String(secret).length < 20) throw publicTestError('Veřejný test není správně připojený.', 503, 'PUBLIC_TEST_NOT_CONFIGURED');
  return String(secret);
}

function sanitizePublicTestMessagesForStorage(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(-13).map(message => ({
    role: message?.role === 'assistant' ? 'assistant' : message?.role === 'user' ? 'user' : '',
    content: redactDirectIdentifiers(cleanText(message?.content, 1400)),
  })).filter(message => message.role && message.content);
}

async function sendFeedbackEmail(feedback, env, fetchImpl) {
  const recipient = env.ELITEA_ALERT_EMAIL || env.NIA_BOOKING_EMAIL;
  if (!env.RESEND_API_KEY || !env.ELITEA_FROM_EMAIL || !recipient) return false;
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.ELITEA_FROM_EMAIL,
      to: recipient,
      subject: `[Elitea test] ${feedback.evaluatorName} · ${feedback.mode === 'mentor' ? 'Mentorka' : 'Koučka'} · ${feedback.usefulness}/5`,
      text: [
        `Testerka: ${feedback.evaluatorName}`,
        `Kontakt: ${feedback.contact || 'neuveden'}`,
        `Role: ${feedback.mode === 'mentor' ? 'Mentorka' : 'Koučka'}`,
        `Počet odpovědí Elitea: ${feedback.turnCount}`,
        `Užitečnost: ${feedback.usefulness}/5`,
        `Věrohodnost role: ${feedback.roleFidelity}/5`,
        `Používala by Eliteu: ${feedback.wouldUse}`,
        `Souhlas se sdílením přepisu: ${feedback.transcriptConsent ? 'ano' : 'ne'}`,
        '',
        feedback.notes,
      ].join('\n'),
    }),
  });
  return response.ok;
}

function integerRating(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
}

function cleanText(value, limit) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function redactDirectIdentifiers(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[e-mail odstraněn]')
    .replace(/(?<!\d)(?:\+?420[ .-]?)?(?:\d[ .-]?){8}\d(?!\d)/g, '[telefon odstraněn]')
    .replace(/\b\d{6}\/?\d{3,4}\b/g, '[rodné číslo odstraněno]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[platební údaj odstraněn]')
    .replace(/\b(?:sk|pk|rk|ghp|github_pat|vercel)[-_][A-Za-z0-9_-]{12,}\b/gi, '[tajný klíč odstraněn]')
    .replace(/((?:heslo|password|api[_ -]?key|token)\s*[:=]\s*)\S+/gi, '$1[odstraněno]');
}

function publicTestError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}
