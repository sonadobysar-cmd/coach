import { neon } from '@neondatabase/serverless';

export function lifecycleConfigured(env = process.env) {
  return Boolean(env.DATABASE_URL && env.RESEND_API_KEY && env.ELITEA_FROM_EMAIL);
}

export async function rememberMemberContact(member, env = process.env) {
  const email = normalizeEmail(member?.email);
  if (!env.DATABASE_URL || !member?.id || !email) return;
  const sql = neon(env.DATABASE_URL);
  await sql`INSERT INTO member_profiles (user_id) VALUES (${member.id}::uuid) ON CONFLICT (user_id) DO NOTHING`;
  await sql`INSERT INTO member_lifecycle (user_id, contact_email, last_activity_at)
    VALUES (${member.id}::uuid, ${email}, now())
    ON CONFLICT (user_id) DO UPDATE SET contact_email=EXCLUDED.contact_email, updated_at=now()`;
}

export async function touchMemberLifecycle(member, env = process.env) {
  if (!env.DATABASE_URL || !member?.id) return;
  const sql = neon(env.DATABASE_URL);
  const email = normalizeEmail(member.email);
  await sql`INSERT INTO member_profiles (user_id) VALUES (${member.id}::uuid) ON CONFLICT (user_id) DO NOTHING`;
  await sql`INSERT INTO member_lifecycle (user_id, contact_email, last_activity_at)
    VALUES (${member.id}::uuid, ${email}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      contact_email=CASE WHEN EXCLUDED.contact_email<>'' THEN EXCLUDED.contact_email ELSE member_lifecycle.contact_email END,
      last_activity_at=now(), updated_at=now()`;
}

export async function runLifecycleEmails(env = process.env, fetchImpl = fetch) {
  if (!lifecycleConfigured(env)) {
    const error = new Error('Lifecycle e-maily nejsou kompletně připojené.');
    error.code = 'LIFECYCLE_NOT_CONFIGURED';
    throw error;
  }
  const sql = neon(env.DATABASE_URL);
  const members = await sql`SELECT l.user_id, l.contact_email, l.marketing_consent, l.last_activity_at,
      l.welcome_sent_at, l.trial_ending_sent_at, l.inactivity_sent_at, l.winback_sent_at,
      m.status, m.current_period_end
    FROM member_lifecycle l JOIN memberships m ON m.user_id=l.user_id
    WHERE l.email_suppressed=false AND l.contact_email<>''
    ORDER BY l.updated_at ASC LIMIT 250`;
  const summary = { inspected: members.length, welcome: 0, trialEnding: 0, inactivity: 0, winback: 0, failed: 0 };

  for (const member of members) {
    const campaign = lifecycleCampaignFor(member);
    if (!campaign) continue;
    try {
      await sendLifecycleEmail(member, campaign, env, fetchImpl);
      await markLifecycleSent(sql, member.user_id, campaign.kind);
      summary[campaign.counter] += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}

export function lifecycleCampaignFor(member, now = new Date()) {
  const status = member?.status;
  const periodEnd = member?.current_period_end ? new Date(member.current_period_end) : null;
  const lastActivity = member?.last_activity_at ? new Date(member.last_activity_at) : null;
  const day = 86_400_000;
  if (status === 'trialing' && periodEnd && periodEnd > now && periodEnd.getTime() - now.getTime() <= 3 * day && !member.trial_ending_sent_at) {
    return { kind: 'trial_ending', counter: 'trialEnding', subject: 'Tvých 7 dní s Elitea se blíží ke konci', heading: 'Co si chceš z trialu odnést?', body: `Zkušební přístup končí ${formatDate(periodEnd)}. Do té doby máš stále celou Elitea: obě mentorky, Academy, pracovní listy i komunitu.`, cta: 'Pokračovat v Elitea', href: '/#app-member' };
  }
  if (['trialing', 'active'].includes(status) && !member.welcome_sent_at) {
    return { kind: 'welcome', counter: 'welcome', subject: 'Vítej v Elitea — začni jedním skutečným tématem', heading: 'Elitea je připravená navázat na tebe.', body: 'Začni u Coach & Mentor nebo Brand & Marketing mentorky jednou konkrétní situací. Academy, pracovní listy a komunita pak rozvíjejí stejnou cestu.', cta: 'Otevřít svůj prostor', href: '/#app-member' };
  }
  const inactiveForWeek = lastActivity && now.getTime() - lastActivity.getTime() >= 7 * day;
  const nudgeOldEnough = !member.inactivity_sent_at || now.getTime() - new Date(member.inactivity_sent_at).getTime() >= 30 * day;
  if (['trialing', 'active'].includes(status) && inactiveForWeek && nudgeOldEnough) {
    return { kind: 'inactivity', counter: 'inactivity', subject: 'Nechceš v Elitea navázat tam, kde jsi skončila?', heading: 'Nemusíš začínat znovu.', body: 'Tvůj pracovní kontext a studijní postup čekají v členském prostoru. Stačí otevřít poslední téma a navázat jedním dalším krokem.', cta: 'Navázat v Elitea', href: '/#app-member' };
  }
  if (status === 'cancelled' && member.marketing_consent && !member.winback_sent_at) {
    return { kind: 'winback', counter: 'winback', subject: 'Co je nového v Elitea', heading: 'Tvůj prostor může znovu navázat.', body: 'Pokud ti Elitea v minulosti pomohla, můžeš se vrátit ke svému studijnímu postupu a znovu otevřít obě hlavní mentorky.', cta: 'Podívat se na Elitea', href: '/#membership' };
  }
  return null;
}

async function sendLifecycleEmail(member, campaign, env, fetchImpl) {
  const baseUrl = String(env.PUBLIC_APP_URL || 'https://elitea.cz').replace(/\/$/, '');
  const href = `${baseUrl}${campaign.href}`;
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `elitea-${campaign.kind}-${member.user_id}` },
    body: JSON.stringify({
      from: env.ELITEA_FROM_EMAIL,
      to: [member.contact_email],
      subject: campaign.subject,
      text: `${campaign.heading}\n\n${campaign.body}\n\n${campaign.cta}: ${href}\n\nElitea · Grow your business. Grow yourself.`,
      html: `<!doctype html><html lang="cs"><body style="margin:0;background:#f7f5f8;color:#111114;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:30px 16px"><div style="padding:32px;border:1px solid #ddd8e3;background:#fff"><div style="font-family:Georgia,serif;font-size:34px;font-weight:700">Elitea<span style="color:#ff681d">.</span></div><p style="margin:30px 0 7px;color:#6035cf;font-size:11px;font-weight:700;letter-spacing:.1em">TVŮJ ČLENSKÝ PROSTOR</p><h1 style="margin:0 0 16px;font-size:28px;line-height:1.08">${escapeHtml(campaign.heading)}</h1><p style="color:#625d65;line-height:1.65">${escapeHtml(campaign.body)}</p><p style="margin:28px 0"><a href="${href}" style="display:inline-block;padding:15px 22px;border-radius:999px;background:#111114;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(campaign.cta)} →</a></p><p style="margin-top:32px;color:#918b93;font-size:11px">Elitea · Grow your business. Grow yourself.</p></div></div></body></html>`,
    }),
  });
  if (!response.ok) throw new Error(`Lifecycle delivery failed: ${response.status}`);
}

async function markLifecycleSent(sql, userId, kind) {
  if (kind === 'welcome') await sql`UPDATE member_lifecycle SET welcome_sent_at=now(), updated_at=now() WHERE user_id=${userId}::uuid`;
  if (kind === 'trial_ending') await sql`UPDATE member_lifecycle SET trial_ending_sent_at=now(), updated_at=now() WHERE user_id=${userId}::uuid`;
  if (kind === 'inactivity') await sql`UPDATE member_lifecycle SET inactivity_sent_at=now(), updated_at=now() WHERE user_id=${userId}::uuid`;
  if (kind === 'winback') await sql`UPDATE member_lifecycle SET winback_sent_at=now(), updated_at=now() WHERE user_id=${userId}::uuid`;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : '';
}

function formatDate(value) { return value.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
