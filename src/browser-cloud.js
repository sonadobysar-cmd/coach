import { createClient } from '@neondatabase/neon-js';

export const ACCOUNT_STORAGE_PREFIX = 'elitea.account.v1';
export const LEGACY_OUTCOME_STORAGE_KEY = 'elitea.outcomes';
export const OUTCOME_STORAGE_KEY = 'elitea.outcomes.v1';

export const ACCOUNT_STATE_KEYS = Object.freeze({
  course_progress: 'elitea.courseProgress',
  course_notes: 'elitea.courseNotes',
  worksheet_entries: 'elitea.worksheetEntries',
  course_mastery: 'elitea.courseMastery',
  training_portfolio: 'elitea.trainingPortfolio',
  content_favorites: 'elitea.contentFavorites',
  outcome_store: OUTCOME_STORAGE_KEY,
  approved_memory: 'elitea.memory',
});

export const ACCOUNT_SESSION_KEYS = Object.freeze([
  'elitea.messages',
  'elitea.conversations',
  'elitea.lastMethods',
  'elitea.lastMethod',
  'elitea.techniqueSessions',
  'elitea.specialistSessions',
  'elitea.trainingSession',
  'elitea.trainingSessions',
  'elitea.assistantRole',
  'elitea.consultationMode',
  'elitea.coachConsultationMode',
  'elitea.brandWorkMode',
]);

const LEGACY_LOCAL_KEYS = Object.freeze([
  ...Object.values(ACCOUNT_STATE_KEYS),
  LEGACY_OUTCOME_STORAGE_KEY,
]);

export function accountStorageKey(userId, key) {
  const safeUserId = String(userId || '').trim();
  const safeKey = String(key || '').trim();
  if (!safeUserId || !safeKey) return '';
  return `${ACCOUNT_STORAGE_PREFIX}.${encodeURIComponent(safeUserId)}.${safeKey}`;
}

export function replaceAccountState(storage, userId, row = null) {
  if (!storage || !String(userId || '').trim()) return;
  for (const [column, key] of Object.entries(ACCOUNT_STATE_KEYS)) {
    const fallback = stateFallback(column);
    const value = row && Object.hasOwn(row, column) && row[column] != null ? row[column] : fallback;
    storage.setItem(accountStorageKey(userId, key), JSON.stringify(value));
  }
  storage.removeItem(accountStorageKey(userId, LEGACY_OUTCOME_STORAGE_KEY));
}

export function readAccountState(storage, userId) {
  const row = {};
  for (const [column, key] of Object.entries(ACCOUNT_STATE_KEYS)) {
    const fallback = stateFallback(column);
    try {
      row[column] = JSON.parse(storage?.getItem(accountStorageKey(userId, key)) || JSON.stringify(fallback));
    } catch {
      row[column] = fallback;
    }
  }
  return row;
}

export function migrateLegacyOutcomeState(storage, userId, { verifiedCloudValue } = {}) {
  const currentKey = accountStorageKey(userId, OUTCOME_STORAGE_KEY);
  if (!storage || !currentKey || storage.getItem(currentKey) != null) return false;

  if (verifiedCloudValue !== undefined) {
    const legacyCloudValue = parseStoredJson(storage.getItem(LEGACY_OUTCOME_STORAGE_KEY));
    const unscopedCurrentValue = storage.getItem(OUTCOME_STORAGE_KEY);
    if (legacyCloudValue.ok
      && canonicalJson(legacyCloudValue.value) === canonicalJson(verifiedCloudValue)
      && parseStoredJson(unscopedCurrentValue).ok) {
      storage.setItem(currentKey, unscopedCurrentValue);
      storage.removeItem(OUTCOME_STORAGE_KEY);
      storage.removeItem(LEGACY_OUTCOME_STORAGE_KEY);
      return true;
    }
  }

  const scopedLegacyKey = accountStorageKey(userId, LEGACY_OUTCOME_STORAGE_KEY);
  const candidates = [{ key: scopedLegacyKey, requiresCloudMatch: false }];
  if (verifiedCloudValue !== undefined) candidates.push({ key: LEGACY_OUTCOME_STORAGE_KEY, requiresCloudMatch: true });
  for (const candidate of candidates) {
    const legacyValue = storage.getItem(candidate.key);
    if (legacyValue == null) continue;
    try {
      const parsed = JSON.parse(legacyValue);
      if (candidate.requiresCloudMatch && canonicalJson(parsed) !== canonicalJson(verifiedCloudValue)) continue;
      storage.setItem(currentKey, legacyValue);
      storage.removeItem(candidate.key);
      return true;
    } catch {
      storage.removeItem(candidate.key);
    }
  }
  return false;
}

export function clearAccountSessionState(storage, userId) {
  if (!storage) return;
  for (const key of ACCOUNT_SESSION_KEYS) storage.removeItem(accountStorageKey(userId, key));
}

export function clearAccountState(local, session, userId) {
  clearAccountPartition(local, userId);
  clearAccountPartition(session, userId);
}

export function clearLegacyAccountState(local = globalThis.localStorage, session = globalThis.sessionStorage) {
  for (const key of LEGACY_LOCAL_KEYS) local?.removeItem(key);
  for (const key of ACCOUNT_SESSION_KEYS) session?.removeItem(key);
}

function stateFallback(column) {
  return column.endsWith('progress') || column.endsWith('portfolio') || column.endsWith('favorites') ? [] : {};
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function parseStoredJson(value) {
  if (value == null) return { ok: false, value: null };
  try { return { ok: true, value: JSON.parse(value) }; }
  catch { return { ok: false, value: null }; }
}

function clearAccountPartition(storage, userId) {
  const prefix = `${ACCOUNT_STORAGE_PREFIX}.${encodeURIComponent(String(userId || '').trim())}.`;
  if (!storage || !String(userId || '').trim()) return;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function emailSignUpPayload(name, email, password) {
  return { name, email, password };
}

export function createEliteaCloud(config) {
  if (!config?.authUrl || !config?.dataApiUrl) return null;
  let jwtToken = '';
  let loadedAccountId = '';
  const captureTokenFetch = async (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    const authorization = headers.get('authorization') || '';
    if (/^Bearer\s+\S+/i.test(authorization)) jwtToken = authorization.replace(/^Bearer\s+/i, '');
    return fetch(input, init);
  };
  const client = createClient({
    auth: { url: config.authUrl },
    dataApi: { url: config.dataApiUrl, options: { global: { fetch: captureTokenFetch } } },
  });

  async function session({ forceFetch = false } = {}) {
    // Better Auth's vanilla adapter bypasses its session cache through the
    // X-Force-Fetch request header. A top-level `forceFetch` property is only
    // understood by the Supabase-compatible adapter and was silently ignored
    // here, so a long coaching session could keep reusing an expired JWT.
    const result = await client.auth.getSession(forceFetch
      ? { fetchOptions: { headers: { 'X-Force-Fetch': 'true' } } }
      : undefined);
    return result?.data?.session && result?.data?.user ? result.data : null;
  }

  async function loadState() {
    const current = await session();
    if (!current) return null;
    const { data, error } = await client.from('member_app_state').select('*').eq('user_id', current.user.id).limit(1);
    if (error) throw error;
    const row = data?.[0];
    let accountRow = row;
    if (row && Object.hasOwn(row, 'outcome_store')) {
      const migrated = migrateLegacyOutcomeState(localStorage, current.user.id, { verifiedCloudValue: row.outcome_store });
      const migratedValue = migrated
        ? parseStoredJson(localStorage.getItem(accountStorageKey(current.user.id, OUTCOME_STORAGE_KEY)))
        : { ok: false };
      if (migratedValue.ok) accountRow = { ...row, outcome_store: migratedValue.value };
    }
    replaceAccountState(localStorage, current.user.id, accountRow || null);
    clearLegacyAccountState(localStorage, sessionStorage);
    loadedAccountId = current.user.id;
    return current;
  }

  async function saveState() {
    const current = await session();
    if (!current) return false;
    if (current.user.id !== loadedAccountId) return false;
    migrateLegacyOutcomeState(localStorage, current.user.id);
    const row = { user_id: current.user.id, updated_at: new Date().toISOString(), ...readAccountState(localStorage, current.user.id) };
    const { error } = await client.from('member_app_state').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    return true;
  }

  return {
    session, loadState, saveState,
    authorization: async ({ forceRefresh = true } = {}) => {
      let current;
      try {
        current = await session({ forceFetch: forceRefresh });
      } catch {
        jwtToken = '';
        return '';
      }
      if (!current) {
        jwtToken = '';
        return '';
      }
      // The Data API adapter calls Neon Auth getJWTToken() for every request.
      // Force a fresh session first, then capture that exact current JWT from
      // its Authorization header instead of reusing the previous token.
      jwtToken = '';
      try {
        await client.from('member_app_state').select('user_id').limit(1);
      } catch {
        jwtToken = '';
        return '';
      }
      return jwtToken ? `Bearer ${jwtToken}` : '';
    },
    signIn: (email, password) => client.auth.signIn.email({ email, password, rememberMe: true }),
    signUp: (name, email, password) => client.auth.signUp.email(emailSignUpPayload(name, email, password)),
    requestPasswordReset: (email, redirectTo) => client.auth.requestPasswordReset({ email, redirectTo }),
    resetPassword: (newPassword, token) => client.auth.resetPassword({ newPassword, token }),
    signOut: async () => {
      const current = await session().catch(() => null);
      const result = await client.auth.signOut();
      if (!result?.error && current?.user?.id) clearAccountState(localStorage, sessionStorage, current.user.id);
      clearLegacyAccountState(localStorage, sessionStorage);
      if (!result?.error) loadedAccountId = '';
      return result;
    },
  };
}
