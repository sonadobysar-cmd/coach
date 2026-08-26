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

  async function session() {
    const result = await client.auth.getSession();
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
    authorization: async () => {
      if (!jwtToken) await client.from('member_app_state').select('user_id').limit(1);
      return jwtToken ? `Bearer ${jwtToken}` : '';
    },
    signIn: (email, password) => client.auth.signIn.email({ email, password, rememberMe: true }),
    signUp: (name, email, password) => client.auth.signUp.email({ name, email, password, callbackURL: 'https://elitea.cz/#app-member' }),
    signOut: () => client.auth.signOut(),
  };
}
