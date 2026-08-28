import { neon } from '@neondatabase/serverless';

const DEFAULT_POLICIES = Object.freeze({
  standard: { monthlyMessages: 500, dailyMessages: 60 },
  founding: { monthlyMessages: 3000, dailyMessages: 150 },
});

export function usagePolicyFor(membership = {}, env = process.env) {
  if (membership.status === 'owner' || membership.plan_code === 'elitea-owner') {
    return { plan: 'owner', unlimited: true, monthlyMessages: null, dailyMessages: null };
  }
  const founding = membership.plan_code === 'elitea-founding30';
  const defaults = founding ? DEFAULT_POLICIES.founding : DEFAULT_POLICIES.standard;
  return {
    plan: founding ? 'founding30' : 'standard',
    unlimited: false,
    monthlyMessages: positiveLimit(
      founding ? env.ELITEA_FOUNDING_MONTHLY_MESSAGES : env.ELITEA_STANDARD_MONTHLY_MESSAGES,
      defaults.monthlyMessages,
    ),
    dailyMessages: positiveLimit(
      founding ? env.ELITEA_FOUNDING_DAILY_MESSAGES : env.ELITEA_STANDARD_DAILY_MESSAGES,
      defaults.dailyMessages,
    ),
  };
}

export async function reserveAiTurn(member, membership, { roleCode = 'coach_mentor' } = {}, env = process.env) {
  const policy = usagePolicyFor(membership, env);
  if (policy.unlimited || !member?.id || !env.DATABASE_URL) {
    return { ...policy, usedToday: 0, usedThisMonth: 0, remainingToday: null, remainingThisMonth: null };
  }

  const sql = neon(env.DATABASE_URL);
  const rows = await sql`
    INSERT INTO ai_usage_counters (
      user_id, usage_date, usage_month, daily_messages, monthly_messages, last_role_code, updated_at
    ) VALUES (
      ${member.id}::uuid, current_date, date_trunc('month', now())::date, 1, 1, ${roleCode}, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      usage_date=current_date,
      usage_month=date_trunc('month', now())::date,
      daily_messages=CASE
        WHEN ai_usage_counters.usage_date=current_date THEN ai_usage_counters.daily_messages + 1
        ELSE 1
      END,
      monthly_messages=CASE
        WHEN ai_usage_counters.usage_month=date_trunc('month', now())::date THEN ai_usage_counters.monthly_messages + 1
        ELSE 1
      END,
      last_role_code=${roleCode},
      updated_at=now()
    WHERE
      (CASE WHEN ai_usage_counters.usage_date=current_date THEN ai_usage_counters.daily_messages ELSE 0 END) < ${policy.dailyMessages}
      AND (CASE WHEN ai_usage_counters.usage_month=date_trunc('month', now())::date THEN ai_usage_counters.monthly_messages ELSE 0 END) < ${policy.monthlyMessages}
    RETURNING daily_messages, monthly_messages, usage_date, usage_month`;

  if (!rows[0]) {
    const usage = await readAiUsage(member, membership, env);
    const error = new Error(usage.remainingToday === 0
      ? 'Dnešní fair-use limit je vyčerpaný. Další zprávy se odemknou zítra.'
      : 'Měsíční fair-use limit je vyčerpaný. Další zprávy se odemknou v novém období.');
    error.statusCode = 429;
    error.code = 'AI_USAGE_LIMIT_REACHED';
    error.usage = usage;
    throw error;
  }

  return usageSnapshot(policy, rows[0]);
}

export async function readAiUsage(member, membership, env = process.env) {
  const policy = usagePolicyFor(membership, env);
  if (policy.unlimited || !member?.id || !env.DATABASE_URL) {
    return { ...policy, usedToday: 0, usedThisMonth: 0, remainingToday: null, remainingThisMonth: null };
  }
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT usage_date, usage_month, daily_messages, monthly_messages
    FROM ai_usage_counters WHERE user_id=${member.id}::uuid LIMIT 1`;
  return usageSnapshot(policy, rows[0] || {});
}

function usageSnapshot(policy, row) {
  const today = new Date().toISOString().slice(0, 10);
  const month = `${today.slice(0, 7)}-01`;
  const usedToday = dateKey(row.usage_date) === today ? Number(row.daily_messages || 0) : 0;
  const usedThisMonth = dateKey(row.usage_month) === month ? Number(row.monthly_messages || 0) : 0;
  return {
    ...policy,
    usedToday,
    usedThisMonth,
    remainingToday: Math.max(0, policy.dailyMessages - usedToday),
    remainingThisMonth: Math.max(0, policy.monthlyMessages - usedThisMonth),
  };
}

function dateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString?.().slice(0, 10) || '';
}

function positiveLimit(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
