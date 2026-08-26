import { createHash, randomUUID } from 'node:crypto';

const PROVIDERS = new Set(['meta_ads', 'instagram', 'facebook_page', 'website', 'email']);
const SECRET_KEY_PATTERN = /password|passwd|secret|access[_-]?token|refresh[_-]?token|api[_-]?key|credit[_-]?card|cvv/i;

export const MARKETING_ACTIONS = Object.freeze({
  analyze_account: { risk: 'read', externalWrite: false, approval: false },
  generate_creative: { risk: 'draft', externalWrite: false, approval: false },
  create_campaign_draft: { risk: 'write_paused', externalWrite: true, approval: true, forcedStatus: 'PAUSED' },
  upload_creative: { risk: 'write_paused', externalWrite: true, approval: true },
  publish_content: { risk: 'publish', externalWrite: true, approval: true },
  activate_campaign: { risk: 'spend', externalWrite: true, approval: true },
  change_budget: { risk: 'spend', externalWrite: true, approval: true },
  pause_campaign: { risk: 'spend_control', externalWrite: true, approval: true },
  delete_asset: { risk: 'destructive', externalWrite: true, approval: true },
});

export const MARKETING_OPERATOR_CAPABILITIES = Object.freeze({
  version: '2026-08-26.1',
  workflow: ['diagnose', 'brief', 'generate', 'preview', 'approve', 'execute', 'verify', 'measure'],
  principles: [
    'OAuth connection only; never request or store a client password.',
    'Every paid campaign is created PAUSED before a separate activation approval.',
    'Approval is bound to an exact immutable preview fingerprint.',
    'Budget, audience, destination, tracking and creative must be visible in the approval preview.',
    'Every external write produces an auditable execution event and provider object id.',
  ],
  providers: {
    meta_ads: {
      preferredSurface: 'official_api',
      requiredPermissions: ['ads_read', 'ads_management'],
      supports: ['analyze_account', 'create_campaign_draft', 'upload_creative', 'activate_campaign', 'change_budget', 'pause_campaign'],
    },
    instagram: {
      preferredSurface: 'official_api',
      supports: ['publish_content'],
    },
    facebook_page: {
      preferredSurface: 'official_api',
      supports: ['publish_content'],
    },
    website: {
      preferredSurface: 'connector_or_api',
      supports: ['publish_content'],
    },
    email: {
      preferredSurface: 'connector_or_api',
      supports: ['publish_content'],
    },
  },
});

export function marketingOperatorPublicStatus(env = process.env) {
  return {
    capabilities: MARKETING_OPERATOR_CAPABILITIES,
    integrations: {
      meta_ads: {
        configured: Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI),
        connectionMode: 'oauth',
      },
      image_generation: {
        configured: Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || env.VERCEL === '1'),
        reviewRequired: true,
      },
    },
  };
}

export function createMarketingActionDraft({ provider, action, input = {}, createdAt = new Date().toISOString() } = {}) {
  if (!PROVIDERS.has(provider)) throw new Error('Nepodporovaný marketingový účet.');
  const policy = MARKETING_ACTIONS[action];
  if (!policy) throw new Error('Nepodporovaná marketingová akce.');
  assertNoSecrets(input);

  const safeInput = normalizeJson(input);
  if (policy.risk === 'spend' || policy.risk === 'write_paused') validateCampaignControls(action, safeInput);
  if (policy.forcedStatus) safeInput.status = policy.forcedStatus;

  const snapshot = {
    provider,
    action,
    risk: policy.risk,
    externalWrite: policy.externalWrite,
    input: safeInput,
  };
  const fingerprint = fingerprintSnapshot(snapshot);

  return {
    id: randomUUID(),
    status: policy.approval ? 'awaiting_approval' : 'draft',
    createdAt,
    approvalRequired: policy.approval,
    fingerprint,
    preview: snapshot,
  };
}

export function approveMarketingAction(draft, { fingerprint, approvedAt = new Date().toISOString() } = {}) {
  if (!draft?.approvalRequired) throw new Error('Tato akce výslovné schválení nevyžaduje.');
  if (!fingerprint || fingerprint !== draft.fingerprint) throw new Error('Náhled se změnil; je nutné nové schválení.');
  return {
    ...draft,
    status: 'approved',
    approval: { fingerprint, approvedAt },
  };
}

export function assertMarketingExecutionAllowed(draft, { connectionActive = false } = {}) {
  if (!draft?.preview?.externalWrite) return true;
  if (!connectionActive) throw new Error('Marketingový účet není bezpečně připojený.');
  if (draft.status !== 'approved' || draft.approval?.fingerprint !== draft.fingerprint) {
    throw new Error('Externí akce nemá platné schválení přesného náhledu.');
  }
  if (draft.preview.action === 'create_campaign_draft' && draft.preview.input.status !== 'PAUSED') {
    throw new Error('Nová placená kampaň musí být nejdřív vytvořena jako pozastavený koncept.');
  }
  return true;
}

function validateCampaignControls(action, input) {
  if (action === 'create_campaign_draft') {
    const required = ['objective', 'adAccountId', 'destinationUrl', 'audienceSummary', 'budget'];
    const missing = required.filter(key => input[key] === undefined || input[key] === null || input[key] === '');
    if (missing.length) throw new Error(`Pro koncept kampaně chybí: ${missing.join(', ')}.`);
  }
  if (action === 'activate_campaign' && !input.campaignId) throw new Error('Pro spuštění chybí identifikátor kampaně.');
  if (action === 'change_budget' && (!input.campaignId || !input.budget)) throw new Error('Pro změnu rozpočtu chybí kampaň nebo nový rozpočet.');
  if (input.budget !== undefined) {
    const amount = Number(input.budget?.amount);
    const currency = String(input.budget?.currency || '').trim().toUpperCase();
    const period = String(input.budget?.period || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency) || !['daily', 'lifetime'].includes(period)) {
      throw new Error('Rozpočet musí obsahovat kladnou částku, měnu a období daily/lifetime.');
    }
  }
}

function assertNoSecrets(value, path = 'input') {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) throw new Error(`Do pracovního zadání nevkládej tajný údaj (${path}.${key}).`);
    assertNoSecrets(nested, `${path}.${key}`);
  }
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, normalizeJson(nested)]));
  }
  if (typeof value === 'string') return value.trim().slice(0, 20_000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return String(value ?? '');
}

function fingerprintSnapshot(snapshot) {
  return createHash('sha256').update(JSON.stringify(normalizeJson(snapshot))).digest('hex');
}
