import { readFile, writeFile } from 'node:fs/promises';

const EMPTY_MEMORY = {
  schema_version: '3.2',
  identity_preferences: {
    preferred_name: '',
    address_form: 'nezvoleno',
  },
  business_context: {
    stage: 'nezjisteno',
    industry: '',
    primary_offer: '',
    target_customer: '',
  },
  current_goal: '',
  active_task: null,
  coaching_profile: {
    onboarding_complete: false,
    desired_outcome: '',
    main_obstacle: '',
    support_style: 'kombinace',
    weekly_capacity: '',
    personal_boundaries: '',
    support_accommodations: '',
  },
  progress: {
    completed_milestones: [],
    active_day_count: 0,
    last_active_day: null,
  },
  continuity: {
    last_focus: '',
    recent_focuses: [],
    last_mode: '',
    last_seen_at: null,
  },
  role_memories: {
    coach: { continuity: { last_focus: '', recent_focuses: [], last_mode: '', last_seen_at: null } },
    brand: { continuity: { last_focus: '', recent_focuses: [], last_mode: '', last_seen_at: null } },
  },
  updated_at: null,
};

export function emptyMemory() {
  return structuredClone(EMPTY_MEMORY);
}

export function sanitizeMemory(input = {}) {
  return {
    schema_version: '3.2',
    identity_preferences: {
      preferred_name: cleanText(input.identity_preferences?.preferred_name, 100),
      address_form: ['tykani', 'vykani', 'nezvoleno'].includes(input.identity_preferences?.address_form)
        ? input.identity_preferences.address_form
        : 'nezvoleno',
    },
    business_context: {
      stage: ['napad', 'start', 'stabilita', 'rust', 'nezjisteno'].includes(input.business_context?.stage)
        ? input.business_context.stage
        : 'nezjisteno',
      industry: cleanText(input.business_context?.industry, 200),
      primary_offer: cleanText(input.business_context?.primary_offer, 1500),
      target_customer: cleanText(input.business_context?.target_customer, 1500),
    },
    current_goal: cleanText(input.current_goal, 1000),
    active_task: sanitizeTask(input.active_task),
    coaching_profile: {
      onboarding_complete: input.coaching_profile?.onboarding_complete === true,
      desired_outcome: cleanText(input.coaching_profile?.desired_outcome, 1000),
      main_obstacle: cleanText(input.coaching_profile?.main_obstacle, 1000),
      support_style: ['koucovani', 'mentoring', 'kombinace'].includes(input.coaching_profile?.support_style)
        ? input.coaching_profile.support_style
        : 'kombinace',
      weekly_capacity: cleanText(input.coaching_profile?.weekly_capacity, 200),
      personal_boundaries: cleanText(input.coaching_profile?.personal_boundaries, 1000),
      support_accommodations: cleanText(input.coaching_profile?.support_accommodations, 1000),
    },
    progress: {
      completed_milestones: sanitizeMilestones(input.progress?.completed_milestones),
      active_day_count: sanitizeCount(input.progress?.active_day_count),
      last_active_day: sanitizeDayKey(input.progress?.last_active_day),
    },
    continuity: sanitizeContinuity(input.continuity),
    role_memories: {
      coach: { continuity: sanitizeContinuity(input.role_memories?.coach?.continuity || input.continuity) },
      brand: { continuity: sanitizeContinuity(input.role_memories?.brand?.continuity) },
    },
    updated_at: input.updated_at || null,
  };
}

export function buildContinuityPatch({ text = '', mode = '', riskLevel = 'normal', memory = {} }) {
  if (riskLevel !== 'normal') return null;
  if (!['mentoring', 'rychle_reseni', 'diagnostika', 'brand_growth_agent'].includes(mode)) return null;
  if (!looksLikeBusinessContext(text) || containsSensitiveTopic(text)) return null;

  const focus = cleanText(text, 280);
  if (!focus) return null;
  const role = mode === 'brand_growth_agent' ? 'brand' : 'coach';
  const currentContinuity = memory.role_memories?.[role]?.continuity || (role === 'coach' ? memory.continuity : {});
  const previous = Array.isArray(currentContinuity?.recent_focuses)
    ? currentContinuity.recent_focuses
    : [];
  const recent = [...previous.filter(item => item !== focus), focus].slice(-8);

  return {
    roleMemory: {
      role,
      continuity: {
        last_focus: focus,
        recent_focuses: recent,
        last_mode: mode,
        last_seen_at: new Date().toISOString(),
      },
    },
  };
}

export async function readMemory(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return structuredClone(EMPTY_MEMORY);
  }
}

export async function writeMemory(path, input = {}) {
  const safe = sanitizeMemory(input);
  safe.updated_at = new Date().toISOString();

  await writeFile(path, JSON.stringify(safe, null, 2) + '\n', 'utf8');
  return safe;
}

export async function clearMemory(path) {
  const empty = emptyMemory();
  await writeFile(path, JSON.stringify(empty, null, 2) + '\n', 'utf8');
  return empty;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? redactDirectIdentifiers(value).trim().slice(0, maxLength) : '';
}

function sanitizeContinuity(value = {}) {
  const allowedModes = ['diagnostika', 'mentoring', 'rychle_reseni', 'koucovaci_podpora', 'podpora_fungovani', 'brand_growth_agent'];
  return {
    last_focus: cleanText(value?.last_focus, 280),
    recent_focuses: Array.isArray(value?.recent_focuses)
      ? value.recent_focuses.map(item => cleanText(item, 280)).filter(Boolean).slice(-8)
      : [],
    last_mode: allowedModes.includes(value?.last_mode) ? value.last_mode : '',
    last_seen_at: typeof value?.last_seen_at === 'string' ? value.last_seen_at : null,
  };
}

function looksLikeBusinessContext(value) {
  return /podnik|byznys|služ|sluz|nabídk|nabidk|produkt|klient|zákazn|zakazn|cena|cenotvor|marketing|prodej|lead|cashflow|zisk|náklad|naklad|značk|znack|brand|web|sociální|socialni|instagram|facebook|tým|tym|deleg|zakázk|zakazk/i.test(value);
}

function containsSensitiveTopic(value) {
  return /trauma|flashback|sebepoško|sebeposko|sebevra|diagn[oó]z|l[eé]k(y|ů|u)?\b|nemoc|depres|panik|úzkost|uzkost|násil|nasil|zneuž|zneuz|rodn[eé]\s*č[ií]slo|platebn[ií]\s*kart|heslo|api[_ -]?key|token/i.test(value)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /\b(?:\d[ -]*?){13,19}\b/.test(value);
}

function redactDirectIdentifiers(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[e-mail odstraněn]')
    .replace(/\b(?:\+?420[ .-]?)?(?:\d[ .-]?){9}\b/g, '[telefon odstraněn]')
    .replace(/\b\d{6}\/?\d{3,4}\b/g, '[rodné číslo odstraněno]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[platební údaj odstraněn]')
    .replace(/\b(?:sk|vercel|ghp|github_pat)[-_][A-Za-z0-9_-]{16,}\b/g, '[tajný klíč odstraněn]')
    .replace(/((?:heslo|password|api[_ -]?key|token)\s*[:=]\s*)\S+/gi, '$1[odstraněno]');
}

function sanitizeTask(task) {
  if (!task || typeof task !== 'object') return null;
  const title = cleanText(task.title, 500);
  if (!title) return null;
  return {
    title,
    status: ['prijaty', 'rozpracovany', 'splneny', 'odlozeny'].includes(task.status)
      ? task.status
      : 'prijaty',
    agreed_by_member: task.agreed_by_member === true,
    created_at: typeof task.created_at === 'string' ? task.created_at : new Date().toISOString(),
  };
}

function sanitizeMilestones(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => ({
      title: cleanText(item?.title, 500),
      completed_at: typeof item?.completed_at === 'string' ? item.completed_at : new Date().toISOString(),
    }))
    .filter(item => item.title)
    .slice(-50);
}

function sanitizeCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? Math.min(number, 100000) : 0;
}

function sanitizeDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
