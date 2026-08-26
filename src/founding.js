import { neon } from '@neondatabase/serverless';

const PROGRAM_CAPACITY = 30;
const FOCUS_VALUES = new Set(['coach_mentor', 'coaching_training', 'brand_marketing', 'academy', 'whole_elitea']);
const FEEDBACK_ROLES = new Set(['coach_mentor', 'coaching_training', 'brand_marketing', 'study_trainer', 'whole_elitea']);
const ADMIN_ACTIONS = new Set(['shortlisted', 'approved', 'declined', 'withdrawn', 'completed']);

export function foundingConfigured(env = process.env) {
  return Boolean(env.DATABASE_URL);
}

export function isFoundingAdmin(member, env = process.env) {
  const email = normalizeEmail(member?.email);
  if (!email) return false;
  const allowed = [
    ...(env.ELITEA_ADMIN_EMAILS || '').split(','),
    env.NIA_BOOKING_EMAIL,
    env.NIA_COURSE_REQUEST_EMAIL,
  ].map(normalizeEmail).filter(Boolean);
  return new Set(allowed).has(email);
}

export async function foundingPublicStatus(env = process.env) {
  if (!foundingConfigured(env)) return { configured: false, capacity: PROGRAM_CAPACITY, assigned: 0, remaining: PROGRAM_CAPACITY, open: true };
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT count(*)::int AS assigned FROM founding_applications WHERE assigned_seat IS NOT NULL`;
  const assigned = Number(rows[0]?.assigned || 0);
  return { configured: true, capacity: PROGRAM_CAPACITY, assigned, remaining: Math.max(0, PROGRAM_CAPACITY - assigned), open: assigned < PROGRAM_CAPACITY };
}

export async function submitFoundingApplication(input, env = process.env) {
  if (!foundingConfigured(env)) throw serviceUnavailable('Přihlášky do Founding 30 se právě připravují.');
  const application = sanitizeApplication(input);
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`
    INSERT INTO founding_applications (
      preferred_name, email, whatsapp_phone, primary_focus, motivation, desired_result,
      weekly_use_commitment, structured_feedback_commitment, whatsapp_commitment,
      honest_review_commitment, privacy_acknowledged, testimonial_contact_consent
    ) VALUES (
      ${application.preferredName}, ${application.email}, ${application.whatsappPhone}, ${application.primaryFocus},
      ${application.motivation}, ${application.desiredResult}, true, true, true, true, true,
      ${application.testimonialContactConsent}
    )
    ON CONFLICT ((lower(email))) DO UPDATE SET
      preferred_name=EXCLUDED.preferred_name,
      whatsapp_phone=EXCLUDED.whatsapp_phone,
      primary_focus=EXCLUDED.primary_focus,
      motivation=EXCLUDED.motivation,
      desired_result=EXCLUDED.desired_result,
      weekly_use_commitment=true,
      structured_feedback_commitment=true,
      whatsapp_commitment=true,
      honest_review_commitment=true,
      privacy_acknowledged=true,
      testimonial_contact_consent=EXCLUDED.testimonial_contact_consent,
      status=CASE WHEN founding_applications.status IN ('declined','withdrawn') THEN 'submitted' ELSE founding_applications.status END,
      updated_at=now()
    RETURNING id, status, assigned_seat, created_at`;
  await notifyFoundingApplication(application, env).catch(() => {});
  return { id: rows[0].id, status: rows[0].status, seat: rows[0].assigned_seat || null, received: true };
}

export async function foundingForMember(member, env = process.env) {
  const admin = isFoundingAdmin(member, env);
  if (!foundingConfigured(env)) return { configured: false, admin, application: null };
  const sql = neon(env.DATABASE_URL);
  await sql`INSERT INTO member_profiles (user_id) VALUES (${member.id}::uuid) ON CONFLICT (user_id) DO NOTHING`;
  if (member.email) {
    await sql`UPDATE founding_applications SET user_id=${member.id}::uuid, updated_at=now()
      WHERE lower(email)=lower(${member.email}) AND (user_id IS NULL OR user_id=${member.id}::uuid)`;
  }
  const rows = await sql`SELECT id, status, assigned_seat, primary_focus, approved_at, activated_at, created_at,
      testimonial_contact_consent
    FROM founding_applications WHERE user_id=${member.id}::uuid OR lower(email)=lower(${member.email || ''})
    ORDER BY created_at DESC LIMIT 1`;
  return { configured: true, admin, application: rows[0] || null };
}

export async function assertFoundingEligible(member, env = process.env) {
  const status = await foundingForMember(member, env);
  const application = status.application;
  if (!application || application.status !== 'approved' || !application.assigned_seat) {
    throw Object.assign(new Error('Testerská cena je dostupná pouze schváleným členkám ELITEA FOUNDING 30.'), { statusCode: 403 });
  }
  return application;
}

export async function listFoundingApplications(member, env = process.env) {
  if (!isFoundingAdmin(member, env)) throw forbidden();
  const sql = neon(env.DATABASE_URL);
  const applications = await sql`SELECT id, preferred_name, email, whatsapp_phone, primary_focus, motivation, desired_result,
      status, assigned_seat, approved_at, activated_at, created_at, updated_at, testimonial_contact_consent
    FROM founding_applications ORDER BY
      CASE status WHEN 'submitted' THEN 0 WHEN 'shortlisted' THEN 1 WHEN 'approved' THEN 2 WHEN 'active' THEN 3 ELSE 4 END,
      created_at DESC LIMIT 200`;
  const counts = await sql`SELECT status, count(*)::int AS count FROM founding_applications GROUP BY status`;
  return { applications, counts: Object.fromEntries(counts.map(row => [row.status, Number(row.count)])), ...(await foundingPublicStatus(env)) };
}

export async function updateFoundingApplication(member, id, action, env = process.env) {
  if (!isFoundingAdmin(member, env)) throw forbidden();
  if (!/^[0-9a-f-]{36}$/i.test(id || '') || !ADMIN_ACTIONS.has(action)) throw badRequest('Neplatná změna přihlášky.');
  const sql = neon(env.DATABASE_URL);
  if (action === 'approved') {
    const rows = await sql`
      WITH free_seat AS (
        SELECT seat::smallint FROM generate_series(1, ${PROGRAM_CAPACITY}) AS seat
        WHERE NOT EXISTS (SELECT 1 FROM founding_applications used WHERE used.assigned_seat=seat)
        ORDER BY seat LIMIT 1
      )
      UPDATE founding_applications
      SET status='approved',
          assigned_seat=COALESCE(assigned_seat, (SELECT seat FROM free_seat)),
          approved_at=COALESCE(approved_at, now()),
          updated_at=now()
      WHERE id=${id}::uuid AND (assigned_seat IS NOT NULL OR EXISTS (SELECT 1 FROM free_seat))
      RETURNING id, preferred_name, email, status, assigned_seat, approved_at`;
    if (!rows[0]) throw Object.assign(new Error('V programu už není volné místo.'), { statusCode: 409 });
    await notifyFoundingApproval(rows[0], env).catch(() => {});
    return rows[0];
  }
  const rows = await sql`UPDATE founding_applications
    SET status=${action},
        assigned_seat=CASE WHEN ${action} IN ('declined','withdrawn') THEN NULL ELSE assigned_seat END,
        updated_at=now()
    WHERE id=${id}::uuid
    RETURNING id, preferred_name, email, status, assigned_seat, updated_at`;
  if (!rows[0]) throw Object.assign(new Error('Přihláška nebyla nalezena.'), { statusCode: 404 });
  return rows[0];
}

export async function submitFoundingFeedback(member, input, env = process.env) {
  const roleUsed = FEEDBACK_ROLES.has(input?.roleUsed) ? input.roleUsed : '';
  const usefulness = Number(input?.usefulness);
  const resultSummary = cleanText(input?.resultSummary, 3000);
  const frictionSummary = cleanText(input?.frictionSummary, 3000);
  if (!roleUsed || !Number.isInteger(usefulness) || usefulness < 1 || usefulness > 5 || resultSummary.length < 20) {
    throw badRequest('Doplň prosím roli, hodnocení a konkrétní výsledek testování.');
  }
  const status = await foundingForMember(member, env);
  if (!status.application || !['approved', 'active'].includes(status.application.status)) throw forbidden('Zpětnou vazbu mohou odesílat pouze členky Founding 30.');
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`INSERT INTO founding_feedback (
      application_id, user_id, role_used, usefulness, result_summary, friction_summary, follow_up_allowed
    ) VALUES (
      ${status.application.id}::uuid, ${member.id}::uuid, ${roleUsed}, ${usefulness}, ${resultSummary}, ${frictionSummary}, ${input?.followUpAllowed !== false}
    ) RETURNING id, created_at`;
  return { received: true, id: rows[0].id, createdAt: rows[0].created_at };
}

export async function recordAiUsage(member, { roleCode, modelId, usage, qualityPassed = null, repaired = false }, env = process.env) {
  if (!foundingConfigured(env) || !usage || !modelId) return;
  const allowedRoles = new Set(['coach_mentor', 'brand_marketing', 'study_trainer', 'coaching_trainer']);
  if (!allowedRoles.has(roleCode)) return;
  const sql = neon(env.DATABASE_URL);
  await sql`INSERT INTO member_profiles (user_id) VALUES (${member.id}::uuid) ON CONFLICT (user_id) DO NOTHING`;
  await sql`INSERT INTO ai_usage_events (
      user_id, role_code, model_id, input_tokens, output_tokens, total_tokens, cached_input_tokens, quality_passed, repaired
    ) VALUES (
      ${member.id}::uuid, ${roleCode}, ${String(modelId).slice(0, 160)}, ${safeCount(usage.inputTokens)},
      ${safeCount(usage.outputTokens)}, ${safeCount(usage.totalTokens)}, ${safeCount(usage.inputTokenDetails?.cacheReadTokens)},
      ${typeof qualityPassed === 'boolean' ? qualityPassed : null}, ${Boolean(repaired)}
    )`;
}

function sanitizeApplication(input = {}) {
  const preferredName = cleanText(input.preferredName, 100);
  const email = normalizeEmail(input.email);
  const whatsappPhone = cleanText(input.whatsappPhone, 40);
  const primaryFocus = FOCUS_VALUES.has(input.primaryFocus) ? input.primaryFocus : '';
  const motivation = cleanText(input.motivation, 3000);
  const desiredResult = cleanText(input.desiredResult, 2000);
  if (preferredName.length < 2 || !email || whatsappPhone.length < 7 || !primaryFocus || motivation.length < 40 || desiredResult.length < 20) {
    throw badRequest('Doplň prosím všechny části přihlášky dostatečně konkrétně.');
  }
  const commitments = ['weeklyUseCommitment', 'structuredFeedbackCommitment', 'whatsappCommitment', 'honestReviewCommitment', 'privacyAcknowledged'];
  if (commitments.some(key => input[key] !== true)) throw badRequest('Pro Founding 30 je potřeba přijmout všechny testerské závazky.');
  return { preferredName, email, whatsappPhone, primaryFocus, motivation, desiredResult, testimonialContactConsent: input.testimonialContactConsent === true };
}

async function notifyFoundingApplication(application, env) {
  const recipient = env.NIA_TESTER_EMAIL || env.NIA_BOOKING_EMAIL;
  if (!env.RESEND_API_KEY || !recipient || !env.ELITEA_FROM_EMAIL) return;
  await sendEmail({
    to: recipient,
    subject: `Nová přihláška ELITEA FOUNDING 30 — ${application.preferredName}`,
    text: [`Jméno: ${application.preferredName}`, `E-mail: ${application.email}`, `WhatsApp: ${application.whatsappPhone}`, `Zaměření: ${application.primaryFocus}`, '', 'Motivace:', application.motivation, '', 'Požadovaný výsledek:', application.desiredResult].join('\n'),
  }, env);
}

async function notifyFoundingApproval(application, env) {
  if (!env.RESEND_API_KEY || !env.ELITEA_FROM_EMAIL) return;
  await sendEmail({
    to: application.email,
    subject: 'Byla jsi vybraná do ELITEA FOUNDING 30',
    text: `Ahoj ${application.preferred_name},\n\nbyla jsi vybraná jako zakládající testerka č. ${application.assigned_seat}. Na elitea.cz se přihlas stejným e-mailem. Po 7 dnech zdarma získáš tři placené měsíce za 590 Kč měsíčně; potom pokračuje standardní členství za 990 Kč měsíčně.\n\nTěšíme se na poctivé testování a otevřenou zpětnou vazbu.\n\nElitea`,
  }, env);
}

async function sendEmail(message, env) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.ELITEA_FROM_EMAIL, ...message }),
  });
  if (!response.ok) throw new Error('Founding notification failed.');
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : '';
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Math.round(number), 10000000) : 0;
}

function badRequest(message) { return Object.assign(new Error(message), { statusCode: 400 }); }
function forbidden(message = 'K této části nemáš oprávnění.') { return Object.assign(new Error(message), { statusCode: 403 }); }
function serviceUnavailable(message) { return Object.assign(new Error(message), { statusCode: 503 }); }
