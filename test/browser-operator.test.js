import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browserActionPreviewPolicy,
  browserOperatorConfigured,
  browserOperatorTargets,
  classifyBrowserAction,
  assertBrowserOperatorQuota,
  publicBrowserActionDraft,
} from '../src/browser-operator.js';

test('pracovní prohlížeč vyžaduje Browserbase, databázi a přihlášení', () => {
  assert.equal(browserOperatorConfigured({}), false);
  assert.equal(browserOperatorConfigured({
    BROWSERBASE_API_KEY: 'bb_test',
    DATABASE_URL: 'postgres://example',
    NEON_AUTH_URL: 'https://auth.example.com',
  }), true);
});

test('první verze pracovního prohlížeče má pouze schválené cíle', () => {
  assert.deepEqual(browserOperatorTargets().map(item => item.id), ['canva', 'meta_ads']);
  assert.ok(browserOperatorTargets().every(item => item.startUrl.startsWith('https://')));
});

test('řídicí vrstva odlišuje navigaci a práci na konceptu od citlivých kroků', () => {
  assert.equal(classifyBrowserAction('Otevři přehled kampaní'), 'read');
  assert.equal(classifyBrowserAction('Vyplň nadpis návrhu příspěvku'), 'draft');
  assert.equal(classifyBrowserAction('Nastav rozpočet kampaně na 500 Kč'), 'spend');
  assert.equal(classifyBrowserAction('Publikuj příspěvek'), 'publish');
  assert.equal(classifyBrowserAction('Smaž starou kampaň'), 'destructive');
  assert.equal(classifyBrowserAction('Přihlas se mým heslem'), 'secret');
});

test('popis nalezeného prvku může bezpečně zpřísnit původně vágní zadání', () => {
  assert.equal(classifyBrowserAction('Pokračuj', { description: 'Click Publish campaign', method: 'click' }), 'publish');
  assert.equal(classifyBrowserAction('Pokračuj', { description: 'Delete design', method: 'click' }), 'destructive');
});

test('automaticky lze provést jen povolený jeden krok bez publikace nebo útraty', () => {
  const safe = browserActionPreviewPolicy('Vyplň pracovní nadpis', {
    selector: 'xpath=/html/body/input', description: 'Fill draft title', method: 'fill', arguments: ['Pracovní verze'],
  });
  const blocked = browserActionPreviewPolicy('Pokračuj', {
    selector: 'xpath=/html/body/button', description: 'Publish campaign', method: 'click', arguments: [],
  });
  assert.equal(safe.canExecute, true);
  assert.equal(safe.risk, 'draft');
  assert.equal(blocked.canExecute, false);
  assert.equal(blocked.risk, 'publish');
});

test('klientský náhled nikdy neodhalí selektor ani argumenty serverové akce', () => {
  const view = publicBrowserActionDraft({
    id: '11111111-1111-1111-1111-111111111111',
    description: 'Vyplnit pracovní nadpis', method: 'fill', risk: 'draft', canExecute: true,
    action: { selector: 'secret-selector', arguments: ['interní hodnota'] },
    expiresAt: '2026-08-26T12:00:00.000Z',
  });
  assert.equal(view.canExecute, true);
  assert.equal('selector' in view, false);
  assert.equal('arguments' in view, false);
  assert.equal('action' in view, false);
});

test('fair-use brána dovolí nejvýše jednu aktivní relaci a hlídá denní i měsíční náklad', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const makeSql = counts => {
    let index = 0;
    return () => Promise.resolve(index++ === 0 ? [] : [{ count: counts[index - 2] || 0 }]);
  };
  await assert.doesNotReject(() => assertBrowserOperatorQuota(makeSql([0, 1, 3, 4]), userId, {}));
  await assert.rejects(
    () => assertBrowserOperatorQuota(makeSql([1, 1, 3, 4]), userId, {}),
    error => error.code === 'BROWSER_SESSION_ALREADY_ACTIVE' && error.statusCode === 409,
  );
  await assert.rejects(
    () => assertBrowserOperatorQuota(makeSql([0, 2, 3, 4]), userId, {}),
    error => error.code === 'BROWSER_DAILY_LIMIT' && error.statusCode === 429,
  );
  await assert.rejects(
    () => assertBrowserOperatorQuota(makeSql([0, 1, 8, 4]), userId, {}),
    error => error.code === 'BROWSER_MONTHLY_LIMIT' && error.statusCode === 429,
  );
});
