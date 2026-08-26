const USE_CASES = new Set(['pro-sebe', 's-klientkami', 'v-byznysu', 'jine']);

export function courseRequestsConfigured(env = process.env) {
  return Boolean(env.RESEND_API_KEY && (env.NIA_COURSE_REQUEST_EMAIL || env.NIA_BOOKING_EMAIL));
}

export function sanitizeCourseRequest(input = {}) {
  const id = typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : '';
  const topic = clean(input.topic, 600);
  const useCase = USE_CASES.has(input.useCase) ? input.useCase : '';
  const outcome = clean(input.outcome, 700);
  const consent = input.consent === true;
  const honeypot = clean(input.company, 120);

  const errors = [];
  if (!id) errors.push('Neplatné ID námětu.');
  if (topic.length < 8) errors.push('Napiš prosím konkrétnější téma kurzu.');
  if (!useCase) errors.push('Vyber, kde chceš kurz využít.');
  if (!consent) errors.push('Potvrď prosím odeslání námětu.');
  if (honeypot) errors.push('Námět nebyl přijat.');

  return {
    ok: errors.length === 0,
    errors,
    value: { id, topic, useCase, outcome },
  };
}

export function buildCourseRequestEmail(request) {
  const useCaseLabel = {
    'pro-sebe': 'Pro sebe',
    's-klientkami': 'S klientkami',
    'v-byznysu': 'V byznysu',
    jine: 'Jiné',
  }[request.useCase];
  const outcome = request.outcome || 'Neuvedeno';
  const plain = [
    'NOVÝ NÁMĚT PRO NIU — ELITEA ACADEMY',
    '',
    'TÉMA',
    request.topic,
    '',
    `Využití: ${useCaseLabel}`,
    '',
    'CO CHCE ČLENKA PO KURZU UMĚT',
    outcome,
    '',
    `ID námětu: ${request.id}`,
  ].join('\n');
  const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f5f5f7;color:#111114;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border-radius:0 0 32px 32px;padding:30px;border:1px solid #dedee4"><p style="margin:0 0 8px;color:#6035cf;font-size:11px;font-weight:700;letter-spacing:.12em">ELITEA ACADEMY · NÁMĚT PRO NIU</p><h1 style="margin:0 0 26px;font-size:27px">Co člence v Academy chybí</h1><div style="padding:20px;background:#f4f0eb;border-radius:0 0 22px 22px"><strong>Téma</strong><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(request.topic)}</p></div><p><strong>Využití:</strong> ${escapeHtml(useCaseLabel)}</p><p><strong>Požadovaný výsledek:</strong><br><span style="white-space:pre-wrap;line-height:1.6">${escapeHtml(outcome)}</span></p><p style="margin-top:26px;color:#85858d;font-size:11px">ID námětu: ${escapeHtml(request.id)}</p></div></div></body></html>`;
  return { plain, html, useCaseLabel };
}

export async function sendCourseRequest(request, env = process.env, fetchImpl = fetch) {
  if (!courseRequestsConfigured(env)) {
    const error = new Error('Doručení námětů zatím není připojené.');
    error.code = 'COURSE_REQUEST_NOT_CONFIGURED';
    throw error;
  }

  const email = buildCourseRequestEmail(request);
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `elitea-course-request-${request.id}`,
    },
    body: JSON.stringify({
      from: env.ELITEA_FROM_EMAIL || 'Elitea <onboarding@resend.dev>',
      to: [env.NIA_COURSE_REQUEST_EMAIL || env.NIA_BOOKING_EMAIL],
      subject: `Pro Niu: členka navrhuje kurz — ${request.topic.slice(0, 72)}`,
      html: email.html,
      text: email.plain,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Námět se nepodařilo doručit.');
    error.code = 'COURSE_REQUEST_DELIVERY_FAILED';
    error.providerStatus = response.status;
    throw error;
  }
  return { id: result.id || request.id };
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength) : '';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}
