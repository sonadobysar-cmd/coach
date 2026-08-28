import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ALLOWED_SEVERITIES = new Set(['warning', 'error', 'critical']);

export function sanitizeOperationalEvent(input = {}) {
  const severity = ALLOWED_SEVERITIES.has(input.severity) ? input.severity : 'error';
  const area = cleanToken(input.area, 80) || 'unknown';
  const code = cleanToken(input.code, 100) || 'UNEXPECTED_ERROR';
  const path = cleanPath(input.path);
  const summary = cleanSummary(input.summary || input.error?.message || input.error);
  const requestId = cleanToken(input.requestId, 160) || null;
  const fingerprint = createHash('sha256').update(`${area}|${code}|${path}|${summary}`).digest('hex').slice(0, 40);
  return { severity, area, code, path, summary, requestId, fingerprint };
}

export async function reportOperationalError(input, env = process.env) {
  const event = sanitizeOperationalEvent(input);
  console.error(JSON.stringify({ level: event.severity, message: 'operational_error', ...event }));
  if (!env.DATABASE_URL) return { stored: false, event };
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = await sql`INSERT INTO operational_error_events (
        fingerprint, window_start, severity, area, error_code, path, summary, request_id, occurrences, first_seen, last_seen
      ) VALUES (
        ${event.fingerprint}, date_trunc('hour', now()), ${event.severity}, ${event.area}, ${event.code}, ${event.path},
        ${event.summary}, ${event.requestId}, 1, now(), now()
      )
      ON CONFLICT (fingerprint, window_start) DO UPDATE SET
        occurrences=operational_error_events.occurrences + 1,
        last_seen=now(),
        severity=EXCLUDED.severity,
        request_id=COALESCE(EXCLUDED.request_id, operational_error_events.request_id)
      RETURNING id, occurrences`;
    if (rows[0]?.occurrences === 1) await sendAlert(event, env).catch(() => {});
    return { stored: true, event, id: rows[0]?.id || null };
  } catch {
    console.error(JSON.stringify({ level: 'error', message: 'observability_store_failed', fingerprint: event.fingerprint }));
    return { stored: false, event };
  }
}

async function sendAlert(event, env) {
  const recipient = env.ELITEA_ALERT_EMAIL || env.NIA_BOOKING_EMAIL;
  if (!env.RESEND_API_KEY || !env.ELITEA_FROM_EMAIL || !recipient) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.ELITEA_FROM_EMAIL,
      to: recipient,
      subject: `[Elitea] ${event.severity.toUpperCase()} · ${event.area} · ${event.code}`,
      text: `Oblast: ${event.area}\nKód: ${event.code}\nCesta: ${event.path || '-'}\nShrnutí: ${event.summary}\nRequest ID: ${event.requestId || '-'}\n\nObsah chatu ani osobní data nejsou součástí tohoto hlášení.`,
    }),
  });
}

function cleanToken(value, limit) {
  return String(value || '').replace(/[^a-zA-Z0-9_.:/-]/g, '_').slice(0, limit);
}

function cleanPath(value) {
  try {
    const url = new URL(String(value || ''), 'https://elitea.invalid');
    return url.pathname.slice(0, 240);
  } catch { return ''; }
}

function cleanSummary(value) {
  return String(value || 'Unknown error')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(?:\d[ -]*?){7,16}\b/g, '[number]')
    .replace(/(?:sk|pk|rk|whsec|Bearer)[_-][A-Za-z0-9_-]+/g, '[secret]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}
