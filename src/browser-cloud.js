import { createClient } from '@neondatabase/neon-js';

const STATE_KEYS = {
  course_progress: 'elitea.courseProgress',
  course_notes: 'elitea.courseNotes',
  worksheet_entries: 'elitea.worksheetEntries',
  course_mastery: 'elitea.courseMastery',
  training_portfolio: 'elitea.trainingPortfolio',
  content_favorites: 'elitea.contentFavorites',
  outcome_store: 'elitea.outcomes',
  approved_memory: 'elitea.memory',
};

export function emailSignUpPayload(name, email, password) {
  return { name, email, password };
}

export function createEliteaCloud(config) {
  if (!config?.authUrl || !config?.dataApiUrl) return null;
  let jwtToken = '';
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
    const result = await client.auth.getSession(forceFetch ? { forceFetch: true } : undefined);
    return result?.data?.session && result?.data?.user ? result.data : null;
  }

  async function loadState() {
    const current = await session();
    if (!current) return null;
    const { data, error } = await client.from('member_app_state').select('*').eq('user_id', current.user.id).limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (row) for (const [column, key] of Object.entries(STATE_KEYS)) localStorage.setItem(key, JSON.stringify(row[column] ?? null));
    return current;
  }

  async function saveState() {
    const current = await session();
    if (!current) return false;
    const row = { user_id: current.user.id, updated_at: new Date().toISOString() };
    for (const [column, key] of Object.entries(STATE_KEYS)) {
      const fallback = column.endsWith('progress') || column.endsWith('portfolio') || column.endsWith('favorites') ? [] : {};
      try { row[column] = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
      catch { row[column] = fallback; }
    }
    const { error } = await client.from('member_app_state').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    return true;
  }

  return {
    session, loadState, saveState,
    authorization: async ({ forceRefresh = true } = {}) => {
      const current = await session({ forceFetch: forceRefresh });
      if (!current) {
        jwtToken = '';
        return '';
      }
      // The Data API adapter calls Neon Auth getJWTToken() for every request.
      // Force a fresh session first, then capture that exact current JWT from
      // its Authorization header instead of reusing the previous token.
      jwtToken = '';
      await client.from('member_app_state').select('user_id').limit(1);
      return jwtToken ? `Bearer ${jwtToken}` : '';
    },
    signIn: (email, password) => client.auth.signIn.email({ email, password, rememberMe: true }),
    signUp: (name, email, password) => client.auth.signUp.email(emailSignUpPayload(name, email, password)),
    requestPasswordReset: (email, redirectTo) => client.auth.requestPasswordReset({ email, redirectTo }),
    resetPassword: (newPassword, token) => client.auth.resetPassword({ newPassword, token }),
    signOut: () => client.auth.signOut(),
  };
}
