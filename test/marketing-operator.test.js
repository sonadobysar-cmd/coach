import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approveMarketingAction,
  assertMarketingExecutionAllowed,
  createMarketingActionDraft,
  marketingOperatorPublicStatus,
} from '../src/marketing-operator.js';

const campaignInput = {
  objective: 'leads',
  adAccountId: 'act_123',
  destinationUrl: 'https://example.com/nabidka',
  audienceSummary: 'Podnikatelky v ČR se zájmem o marketing',
  budget: { amount: 300, currency: 'CZK', period: 'daily' },
  creativeIds: ['creative-1'],
};

test('nová Meta kampaň vzniká pouze jako pozastavený koncept', () => {
  const draft = createMarketingActionDraft({ provider: 'meta_ads', action: 'create_campaign_draft', input: campaignInput });
  assert.equal(draft.status, 'awaiting_approval');
  assert.equal(draft.preview.input.status, 'PAUSED');
  assert.equal(draft.preview.risk, 'write_paused');
});

test('externí zápis bez připojení a přesného schválení neprojde', () => {
  const draft = createMarketingActionDraft({ provider: 'meta_ads', action: 'create_campaign_draft', input: campaignInput });
  assert.throws(() => assertMarketingExecutionAllowed(draft, { connectionActive: true }), /platné schválení/);
  const approved = approveMarketingAction(draft, { fingerprint: draft.fingerprint });
  assert.throws(() => assertMarketingExecutionAllowed(approved, { connectionActive: false }), /není bezpečně připojený/);
  assert.equal(assertMarketingExecutionAllowed(approved, { connectionActive: true }), true);
});

test('změněný náhled zneplatní souhlas', () => {
  const draft = createMarketingActionDraft({ provider: 'meta_ads', action: 'create_campaign_draft', input: campaignInput });
  assert.throws(() => approveMarketingAction(draft, { fingerprint: '0'.repeat(64) }), /Náhled se změnil/);
});

test('pracovní zadání odmítne hesla a tokeny', () => {
  assert.throws(() => createMarketingActionDraft({
    provider: 'meta_ads',
    action: 'analyze_account',
    input: { access_token: 'tajne' },
  }), /tajný údaj/);
});

test('veřejný stav neodhaluje tajné hodnoty a vyžaduje kompletní Meta konfiguraci', () => {
  const status = marketingOperatorPublicStatus({ META_APP_ID: 'id', META_APP_SECRET: 'secret', META_REDIRECT_URI: 'https://example.com/callback' });
  assert.equal(status.integrations.meta_ads.configured, true);
  assert.equal(JSON.stringify(status).includes('secret'), false);
  assert.equal(status.integrations.meta_ads.connectionMode, 'oauth');
});
