import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const BROWSERBASE_API = 'https://api.browserbase.com/v1';
const TARGETS = Object.freeze({
  canva: { label: 'Canva', startUrl: 'https://www.canva.com/' },
  meta_ads: { label: 'Meta Ads Manager', startUrl: 'https://adsmanager.facebook.com/' },
});
const DEFAULT_BROWSER_MODEL = 'openai/gpt-5.6-terra';
const ALLOWED_BROWSER_MODELS = new Set([
  DEFAULT_BROWSER_MODEL,
  'openai/gpt-5.6-sol',
  'anthropic/claude-sonnet-4-6',
  'google/gemini-3-flash-preview',
]);
const EXECUTABLE_ACTION_METHODS = new Set(['click', 'fill', 'type', 'selectOption', 'hover', 'press', 'check', 'uncheck', 'scroll']);
const MANUAL_RISKS = new Set(['secret', 'publish', 'spend', 'destructive']);

export function browserOperatorConfigured(env = process.env) {
  return Boolean(env.BROWSERBASE_API_KEY && env.DATABASE_URL
    && (env.NEON_AUTH_JWKS_URL || env.NEON_AUTH_URL));
}

export function browserOperatorTargets() {
  return Object.entries(TARGETS).map(([id, value]) => ({ id, ...value }));
}

export function classifyBrowserAction(instruction, action = {}) {
  const raw = [instruction, action.description, action.method, ...(Array.isArray(action.arguments) ? action.arguments : [])]
    .filter(Boolean).join(' ');
  const value = normalize(raw);
  if (containsCredentialMaterial(raw) || /\b(hesl|password|2fa|dvoufaz|overovac[iy] kod|api key|api klic|token|cvv|cislo karty|platebni kart|prihlas)\b/.test(value)) return 'secret';
  if (/\b(smaz|odstran|zrus|storn|delete|remove|cancel|terminate|deaktivuj)\w*/.test(value)) return 'destructive';
  if (/\b(zaplat|koup|objedn|predplat|purchase|pay|checkout|utrati|navys|zvys)\w*/.test(value)
    || /\b(nastav|zmen|potvrd|aktivuj|spust)\w*.{0,35}\b(rozpocet|budget|bid|platb|kampan|reklam)\w*/.test(value)) return 'spend';
  if (/\b(publik|zverej|odesl|posli|postni|submit|publish|launch|send)\w*/.test(value)
    || /\b(spust|aktivuj|potvrd)\w*.{0,25}\b(kampan|reklam|prispevek|newsletter)\w*/.test(value)) return 'publish';
  if (/\b(otevr|prejdi|najdi|ukaz|zobraz|zkontroluj|precti|vyhledej|scroll|prohledni|analyz|view|open|find|read|inspect)\w*/.test(value)) return 'read';
  return 'draft';
}

export function browserActionPreviewPolicy(instruction, action) {
  const safeAction = sanitizeObservedAction(action);
  const risk = classifyBrowserAction(instruction, safeAction);
  const canExecute = !MANUAL_RISKS.has(risk) && EXECUTABLE_ACTION_METHODS.has(safeAction.method);
  return {
    action: safeAction,
    risk,
    canExecute,
    manualReason: canExecute ? '' : manualReasonFor(risk),
  };
}

export function publicBrowserActionDraft(draft) {
  return {
    id: String(draft.id),
    description: String(draft.description || 'Bezpečný pracovní krok'),
    method: String(draft.method || ''),
    risk: String(draft.risk || 'draft'),
    canExecute: Boolean(draft.canExecute ?? draft.can_execute),
    manualReason: String(draft.manualReason ?? draft.manual_reason ?? ''),
    expiresAt: draft.expiresAt || draft.expires_at ? new Date(draft.expiresAt || draft.expires_at).toISOString() : null,
  };
}

export async function startBrowserOperatorSession(member, { target } = {}, env = process.env, fetchImpl = fetch) {
  if (!browserOperatorConfigured(env)) throw serviceUnavailable('Pracovní prohlížeč zatím není připojený.');
  const targetConfig = TARGETS[target];
  if (!targetConfig) throw badRequest('Nepodporovaný cíl pracovního prohlížeče.');

  const localId = randomUUID();
  const memberHash = createHash('sha256').update(member.id).digest('hex').slice(0, 24);
  let providerSession = null;
  try {
    providerSession = await browserbaseRequest('/sessions', {
      method: 'POST',
      body: {
        browserSettings: { timeout: 1800 },
        keepAlive: true,
        region: 'eu-central-1',
        userMetadata: { eliteaMember: memberHash, target },
      },
    }, env, fetchImpl);
    await navigateBrowserSession(providerSession.connectUrl, targetConfig.startUrl);
    const live = await browserbaseRequest(`/sessions/${encodeURIComponent(providerSession.id)}/debug`, {}, env, fetchImpl);
    const sql = neon(env.DATABASE_URL);
    await sql`INSERT INTO browser_operator_sessions
      (id, user_id, provider, provider_session_id, target, start_url, status, expires_at)
      VALUES (${localId}::uuid, ${member.id}::uuid, 'browserbase', ${providerSession.id}, ${target}, ${targetConfig.startUrl}, 'running', ${providerSession.expiresAt}::timestamptz)`;
    return publicSession({
      id: localId,
      target,
      targetLabel: targetConfig.label,
      startUrl: targetConfig.startUrl,
      status: 'running',
      expiresAt: providerSession.expiresAt,
      liveViewUrl: live.debuggerFullscreenUrl,
    });
  } catch (error) {
    if (providerSession?.id) await releaseProviderSession(providerSession.id, env, fetchImpl).catch(() => {});
    throw error;
  }
}

export async function getBrowserOperatorSession(member, localId, env = process.env, fetchImpl = fetch) {
  assertUuid(localId);
  if (!browserOperatorConfigured(env)) throw serviceUnavailable('Pracovní prohlížeč zatím není připojený.');
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT id, provider_session_id, target, start_url, status, expires_at
    FROM browser_operator_sessions WHERE id=${localId}::uuid AND user_id=${member.id}::uuid LIMIT 1`;
  const row = rows[0];
  if (!row) throw notFound('Relace pracovního prohlížeče nebyla nalezena.');
  if (row.status !== 'running') return publicSession({ id: row.id, target: row.target, targetLabel: TARGETS[row.target]?.label, startUrl: row.start_url, status: row.status, expiresAt: row.expires_at });
  const [provider, live] = await Promise.all([
    browserbaseRequest(`/sessions/${encodeURIComponent(row.provider_session_id)}`, {}, env, fetchImpl),
    browserbaseRequest(`/sessions/${encodeURIComponent(row.provider_session_id)}/debug`, {}, env, fetchImpl),
  ]);
  const status = provider.status === 'RUNNING' || provider.status === 'PENDING' ? 'running' : 'ended';
  if (status !== row.status) await sql`UPDATE browser_operator_sessions SET status=${status}, ended_at=CASE WHEN ${status}='ended' THEN now() ELSE ended_at END WHERE id=${localId}::uuid`;
  return publicSession({ id: row.id, target: row.target, targetLabel: TARGETS[row.target]?.label, startUrl: row.start_url, status, expiresAt: row.expires_at, liveViewUrl: status === 'running' ? live.debuggerFullscreenUrl : null });
}

export async function endBrowserOperatorSession(member, localId, env = process.env, fetchImpl = fetch) {
  assertUuid(localId);
  if (!browserOperatorConfigured(env)) throw serviceUnavailable('Pracovní prohlížeč zatím není připojený.');
  const sql = neon(env.DATABASE_URL);
  const rows = await sql`SELECT provider_session_id, status FROM browser_operator_sessions
    WHERE id=${localId}::uuid AND user_id=${member.id}::uuid LIMIT 1`;
  const row = rows[0];
  if (!row) throw notFound('Relace pracovního prohlížeče nebyla nalezena.');
  if (row.status === 'running') await releaseProviderSession(row.provider_session_id, env, fetchImpl);
  await sql`UPDATE browser_operator_sessions SET status='ended', ended_at=now() WHERE id=${localId}::uuid AND user_id=${member.id}::uuid`;
  return { ended: true };
}

export async function previewBrowserOperatorAction(member, localId, { instruction } = {}, env = process.env, dependencies = {}) {
  assertUuid(localId);
  if (!browserOperatorConfigured(env)) throw serviceUnavailable('Pracovní prohlížeč zatím není připojený.');
  const safeInstruction = sanitizeBrowserInstruction(instruction);
  if (classifyBrowserAction(safeInstruction) === 'secret') {
    throw badRequest('Přihlašovací a platební údaje zadávej pouze sama přímo ve vzdálené stránce.');
  }
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const rows = await sql`SELECT id, provider_session_id, target, status, expires_at
    FROM browser_operator_sessions
    WHERE id=${localId}::uuid AND user_id=${member.id}::uuid LIMIT 1`;
  const session = rows[0];
  if (!session) throw notFound('Relace pracovního prohlížeče nebyla nalezena.');
  if (session.status !== 'running') throw badRequest('Pracovní relace už není aktivní.');

  const observe = dependencies.observe || observeBrowserSession;
  const observed = await observe(session.provider_session_id, safeInstruction, session.target, env);
  const candidate = Array.isArray(observed) ? observed[0] : null;
  if (!candidate) throw badRequest('Na aktuální stránce jsem nenašla jednoznačný bezpečný krok. Upřesni prosím, co mám najít nebo vyplnit.');
  const policy = browserActionPreviewPolicy(safeInstruction, candidate);
  const draftId = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const fingerprint = createHash('sha256').update(JSON.stringify(policy.action)).digest('hex');
  await sql`INSERT INTO browser_operator_action_drafts
    (id, session_id, user_id, instruction_fingerprint, action_fingerprint, description, method, risk, can_execute, manual_reason, action, status, expires_at)
    VALUES (${draftId}::uuid, ${localId}::uuid, ${member.id}::uuid,
      ${createHash('sha256').update(safeInstruction).digest('hex')}, ${fingerprint},
      ${policy.action.description}, ${policy.action.method}, ${policy.risk}, ${policy.canExecute},
      ${policy.manualReason}, ${JSON.stringify(policy.action)}::jsonb, 'awaiting_confirmation', ${expiresAt.toISOString()}::timestamptz)`;
  return publicBrowserActionDraft({ id: draftId, ...policy.action, ...policy, expiresAt });
}

export async function executeBrowserOperatorAction(member, localId, draftId, env = process.env, dependencies = {}) {
  assertUuid(localId);
  assertUuid(draftId);
  if (!browserOperatorConfigured(env)) throw serviceUnavailable('Pracovní prohlížeč zatím není připojený.');
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const rows = await sql`SELECT d.id, d.action, d.action_fingerprint, d.description, d.method, d.risk, d.can_execute,
      d.manual_reason, d.status, d.expires_at, s.provider_session_id, s.status AS session_status
    FROM browser_operator_action_drafts d
    JOIN browser_operator_sessions s ON s.id=d.session_id
    WHERE d.id=${draftId}::uuid AND d.session_id=${localId}::uuid AND d.user_id=${member.id}::uuid LIMIT 1`;
  const draft = rows[0];
  if (!draft) throw notFound('Připravený krok nebyl nalezen.');
  if (draft.status !== 'awaiting_confirmation') throw badRequest('Tento krok už není připravený k provedení.');
  if (draft.session_status !== 'running' || new Date(draft.expires_at).getTime() <= Date.now()) throw badRequest('Připravený krok vypršel. Nech ho znovu zkontrolovat.');
  const policy = browserActionPreviewPolicy('', draft.action);
  const fingerprint = createHash('sha256').update(JSON.stringify(policy.action)).digest('hex');
  if (fingerprint !== draft.action_fingerprint || !draft.can_execute || !policy.canExecute) {
    throw badRequest(draft.manual_reason || policy.manualReason || 'Tento krok musíš dokončit sama v živém náhledu.');
  }
  const claimed = await sql`UPDATE browser_operator_action_drafts SET status='executing'
    WHERE id=${draftId}::uuid AND status='awaiting_confirmation' RETURNING id`;
  if (!claimed.length) throw badRequest('Tento krok už byl proveden nebo zrušen.');
  try {
    const execute = dependencies.execute || executeBrowserAction;
    const result = await execute(draft.provider_session_id, policy.action, env);
    if (!result?.success) throw new Error('Stagehand krok nepotvrdil jako úspěšný.');
    await sql`UPDATE browser_operator_action_drafts SET status='succeeded', executed_at=now() WHERE id=${draftId}::uuid`;
    return {
      success: true,
      description: String(result.actionDescription || draft.description || 'Pracovní krok byl proveden.'),
      message: 'Krok je hotový. Zkontroluj výsledek v živém náhledu.',
    };
  } catch (error) {
    await sql`UPDATE browser_operator_action_drafts SET status='failed', safe_error='execution_failed' WHERE id=${draftId}::uuid`;
    console.error(JSON.stringify({ level: 'error', message: 'browser_operator_action_failed', draftId }));
    throw Object.assign(new Error('Krok se nepodařilo bezpečně dokončit. Stránku jsem dál neměnila.'), { statusCode: 502 });
  }
}

async function observeBrowserSession(providerSessionId, instruction, target, env) {
  return withStagehandSession(providerSessionId, env, async stagehand => {
    const result = await stagehand.observe(buildObservePrompt(instruction, target), { timeout: 30_000, cache: false });
    return result.data;
  });
}

async function executeBrowserAction(providerSessionId, action, env) {
  return withStagehandSession(providerSessionId, env, async stagehand => {
    const result = await stagehand.act(action, { timeout: 30_000, cache: false });
    return result.data;
  });
}

async function withStagehandSession(providerSessionId, env, work) {
  const { browserbase, Stagehand } = await import('@browserbasehq/stagehand');
  const browser = await browserbase.connect({ apiKey: env.BROWSERBASE_API_KEY, sessionId: providerSessionId });
  const modelName = ALLOWED_BROWSER_MODELS.has(env.ELITEA_BROWSER_MODEL) ? env.ELITEA_BROWSER_MODEL : DEFAULT_BROWSER_MODEL;
  const stagehand = await Stagehand.create({
    browser,
    model: { modelName },
    systemPrompt: 'You operate one visible workspace for its authenticated owner. Follow only the requested atomic step. Never handle credentials, payments, publication, ad activation, spending, deletion, or irreversible actions.',
    cache: false,
    selfHeal: true,
    logging: { level: 'off', format: 'json' },
  });
  try {
    return await work(stagehand);
  } finally {
    await stagehand.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function buildObservePrompt(instruction, target) {
  return `Find only the single next atomic UI action needed for this request in ${TARGETS[target]?.label || 'the current workspace'}: ${instruction}\nDo not perform it. Never select login, password, two-factor authentication, payment, purchase, publish, send, launch, activate campaign, change budget, delete, remove, or confirmation controls. If the request needs several steps, return only the safest first step.`;
}

function sanitizeBrowserInstruction(value) {
  const instruction = String(value || '').replace(/\s+/g, ' ').trim();
  if (instruction.length < 3 || instruction.length > 600) throw badRequest('Popiš jeden konkrétní krok v rozsahu 3 až 600 znaků.');
  if (containsCredentialMaterial(instruction)) throw badRequest('Do úkolu nevkládej hesla, kódy, tokeny ani platební údaje.');
  return instruction;
}

function sanitizeObservedAction(action) {
  if (!action || typeof action !== 'object') throw badRequest('Navržený krok nemá platný formát.');
  const selector = String(action.selector || '').trim().slice(0, 4000);
  const description = String(action.description || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const method = String(action.method || '').trim().slice(0, 50);
  const args = Array.isArray(action.arguments) ? action.arguments.slice(0, 10).map(value => String(value).slice(0, 2000)) : [];
  if (!selector || !description || !method) throw badRequest('Navržený krok není dostatečně jednoznačný.');
  if (containsCredentialMaterial(args.join(' '))) throw badRequest('Navržený krok obsahuje citlivý údaj a nebude proveden.');
  return { selector, description, method, arguments: args };
}

function manualReasonFor(risk) {
  if (risk === 'secret') return 'Přihlášení, ověřovací kódy a platební údaje zadáváš vždy sama přímo ve stránce.';
  if (risk === 'spend') return 'Rozpočet, nákup nebo spuštění placené kampaně musíš potvrdit a dokončit sama v živém náhledu.';
  if (risk === 'publish') return 'Publikaci nebo odeslání dokončuješ sama až po kontrole výsledku.';
  if (risk === 'destructive') return 'Mazání, rušení a jiné nevratné kroky Elitea neprovádí.';
  return 'Tento typ kroku není povolený pro automatické provedení.';
}

function containsCredentialMaterial(value) {
  const text = String(value || '');
  return /\b(?:sk|ghp|github_pat|vercel)[-_][A-Za-z0-9_-]{16,}\b/i.test(text)
    || /\b(?:\d[ -]*?){13,19}\b/.test(text)
    || /(?:heslo|password|api[_ -]?(?:key|klic)|token|cvv|2fa)\s*[:=]\s*\S+/i.test(text);
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs-CZ');
}

async function releaseProviderSession(providerSessionId, env, fetchImpl) {
  return browserbaseRequest(`/sessions/${encodeURIComponent(providerSessionId)}`, {
    method: 'POST',
    body: { status: 'REQUEST_RELEASE' },
  }, env, fetchImpl);
}

async function browserbaseRequest(path, options = {}, env, fetchImpl) {
  const response = await fetchImpl(`${BROWSERBASE_API}${path}`, {
    method: options.method || 'GET',
    headers: {
      'X-BB-API-Key': env.BROWSERBASE_API_KEY,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(JSON.stringify({ level: 'error', message: 'browserbase_request_failed', status: response.status, detail: detail.slice(0, 300) }));
    throw Object.assign(new Error('Vzdálený prohlížeč se teď nepodařilo spustit.'), { statusCode: 502 });
  }
  return response.json();
}

async function navigateBrowserSession(connectUrl, targetUrl) {
  if (!/^wss:\/\//.test(String(connectUrl || ''))) throw Object.assign(new Error('Vzdálený prohlížeč neposkytl bezpečné spojení.'), { statusCode: 502 });
  const socket = new WebSocket(connectUrl);
  const pending = new Map();
  let nextId = 1;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vypršel čas připojení k pracovnímu prohlížeči.')), 12_000);
    socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Pracovní prohlížeč se nepodařilo otevřít.')); }, { once: true });
  });
  socket.addEventListener('message', event => {
    try {
      const message = JSON.parse(String(event.data));
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message || 'Chyba vzdáleného prohlížeče.'));
      else waiter.resolve(message.result || {});
    } catch {}
  });
  const command = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error('Vypršel čas příkazu pracovního prohlížeče.'));
    }, 12_000);
  });
  try {
    const targets = await command('Target.getTargets');
    const page = targets.targetInfos?.find(item => item.type === 'page');
    if (!page?.targetId) throw new Error('Pracovní karta nebyla nalezena.');
    const attached = await command('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    await command('Page.navigate', { url: targetUrl }, attached.sessionId);
  } finally {
    socket.close();
  }
}

function publicSession(session) {
  return {
    id: String(session.id),
    target: session.target,
    targetLabel: session.targetLabel || 'Pracovní stránka',
    startUrl: session.startUrl,
    status: session.status,
    expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
    liveViewUrl: session.liveViewUrl || null,
    loginOwner: 'member',
    passwordPolicy: 'never_share_with_elitea',
  };
}

function assertUuid(value) {
  if (!/^[0-9a-f-]{36}$/i.test(String(value || ''))) throw badRequest('Neplatná relace pracovního prohlížeče.');
}

function badRequest(message) { return Object.assign(new Error(message), { statusCode: 400 }); }
function notFound(message) { return Object.assign(new Error(message), { statusCode: 404 }); }
function serviceUnavailable(message) { return Object.assign(new Error(message), { statusCode: 503 }); }
