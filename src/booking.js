const TIME_WINDOWS = new Set(['rano', 'dopoledne', 'odpoledne', 'vecer', 'dle_dohody']);

export function bookingConfigured(env = process.env) {
  return Boolean(env.RESEND_API_KEY && env.ELITEA_FROM_EMAIL && bookingRecipient(env));
}

export function bookingRecipient(env = process.env) {
  return env.NIA_BOOKING_EMAIL || env.NIA_TESTER_EMAIL || env.NIA_COURSE_REQUEST_EMAIL || '';
}

export function sanitizeBookingRequest(input = {}) {
  const id = typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : '';
  const name = clean(input.name, 100);
  const email = clean(input.email, 254).toLowerCase();
  const topic = clean(input.topic, 1500);
  const preferredDate = clean(input.preferredDate, 10);
  const timeWindow = TIME_WINDOWS.has(input.timeWindow) ? input.timeWindow : '';
  const documentApproved = input.documentApproved === true;
  const document = documentApproved ? clean(input.document, 6000) : '';
  const consent = input.consent === true;
  const honeypot = clean(input.company, 120);

  const errors = [];
  if (!id) errors.push('Neplatné ID žádosti.');
  if (name.length < 2) errors.push('Doplň své jméno.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Doplň platný e-mail.');
  if (topic.length < 5) errors.push('Doplň téma konzultace.');
  if (!isReasonableFutureDate(preferredDate)) errors.push('Vyber platný preferovaný den.');
  if (!timeWindow) errors.push('Vyber preferovanou část dne.');
  if (!consent) errors.push('Potvrď odeslání rezervačních údajů.');
  if (documentApproved && document.length < 10) errors.push('Schválený podklad je prázdný.');
  if (honeypot) errors.push('Žádost nebyla přijata.');

  return {
    ok: errors.length === 0,
    errors,
    value: { id, name, email, topic, preferredDate, timeWindow, documentApproved, document },
  };
}

export function buildBookingEmail(booking) {
  const timeLabel = {
    rano: 'ráno', dopoledne: 'dopoledne', odpoledne: 'odpoledne', vecer: 'večer', dle_dohody: 'dle dohody',
  }[booking.timeWindow];
  const documentStatus = booking.documentApproved
    ? 'Klientka přiložení podkladu výslovně schválila.'
    : 'Klientka zvolila rezervaci bez podkladu.';
  const plain = [
    'NOVÁ ŽÁDOST O KONZULTACI — ELITEA',
    '',
    `Klientka: ${booking.name}`,
    `E-mail: ${booking.email}`,
    `Preferovaný den: ${booking.preferredDate}`,
    `Preferovaná část dne: ${timeLabel}`,
    '',
    'TÉMA KONZULTACE',
    booking.topic,
    '',
    'SOUKROMÍ',
    documentStatus,
    'Syrový chat nebyl předán a není součástí této žádosti.',
    '',
    `ID žádosti: ${booking.id}`,
  ].join('\n');

  const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f6f1f4;color:#241a21;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border-radius:18px;padding:28px;border:1px solid #e5dce2"><p style="margin:0 0 8px;color:#7a536d;font-size:11px;font-weight:700;letter-spacing:.12em">ELITEA · SOUKROMÁ REZERVACE</p><h1 style="margin:0 0 24px;font-size:24px">Nová žádost o konzultaci</h1><p><strong>Klientka:</strong> ${escapeHtml(booking.name)}</p><p><strong>E-mail:</strong> ${escapeHtml(booking.email)}</p><p><strong>Preferovaný den:</strong> ${escapeHtml(booking.preferredDate)}</p><p><strong>Část dne:</strong> ${escapeHtml(timeLabel)}</p><div style="margin:22px 0;padding:18px;background:#faf7f9;border-radius:12px"><strong>Téma konzultace</strong><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(booking.topic)}</p></div><p style="font-size:12px;color:#685c64"><strong>Soukromí:</strong> ${escapeHtml(documentStatus)} Syrový chat nebyl předán.</p><p style="font-size:11px;color:#8b8087">ID žádosti: ${escapeHtml(booking.id)}</p></div></div></body></html>`;

  return { plain, html, timeLabel };
}

export async function sendBookingRequest(booking, env = process.env, fetchImpl = fetch) {
  if (!bookingConfigured(env)) {
    const error = new Error('Rezervační doručení zatím není připojené.');
    error.code = 'BOOKING_NOT_CONFIGURED';
    throw error;
  }

  const email = buildBookingEmail(booking);
  const payload = {
    from: env.ELITEA_FROM_EMAIL,
    to: [bookingRecipient(env)],
    reply_to: booking.email,
    subject: `Elitea: žádost o konzultaci — ${booking.name}`,
    html: email.html,
    text: email.plain,
    attachments: booking.documentApproved ? [{
      filename: `elitea-podklad-${booking.id.slice(0, 8)}.txt`,
      content: Buffer.from(booking.document, 'utf8').toString('base64'),
    }] : [],
  };

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `elitea-booking-${booking.id}`,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Rezervační žádost se nepodařilo doručit.');
    error.code = 'BOOKING_DELIVERY_FAILED';
    error.providerStatus = response.status;
    throw error;
  }
  return { id: result.id || booking.id };
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength) : '';
}

function isReasonableFutureDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const now = Date.now();
  return date.getTime() >= now - 86_400_000 && date.getTime() <= now + 366 * 86_400_000;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}
