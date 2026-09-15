import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ACCOUNT_STATE_KEYS,
  LEGACY_OUTCOME_STORAGE_KEY,
  OUTCOME_STORAGE_KEY,
  accountStorageKey,
  clearAccountState,
  emailSignUpPayload,
  migrateLegacyOutcomeState,
  readAccountState,
  replaceAccountState,
} from '../src/browser-cloud.js';

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('email registration does not send a callback URL rejected by Neon Auth', () => {
  const payload = emailSignUpPayload('Elitea QA', 'qa@example.com', 'secret-password');

  assert.deepEqual(payload, {
    name: 'Elitea QA',
    email: 'qa@example.com',
    password: 'secret-password',
  });
  assert.equal(Object.hasOwn(payload, 'callbackURL'), false);
});

test('account A cannot leak local or session state into a new account B', () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const accountA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const accountB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rowA = {
    course_progress: ['course-a:item-1'],
    course_notes: { 'course-a:item-1': { value: 'Soukromá poznámka A' } },
    worksheet_entries: { worksheetA: { answer: 'Jen A' } },
    course_mastery: { courseA: { days: ['day-1'] } },
    training_portfolio: [{ id: 'portfolio-a' }],
    content_favorites: ['content-a'],
    outcome_store: { schemaVersion: 1, activeId: null, records: [{ id: 'outcome-a' }] },
    approved_memory: { identity_preferences: { preferred_name: 'A' } },
  };

  replaceAccountState(local, accountA, rowA);
  session.setItem(accountStorageKey(accountA, 'elitea.conversations'), JSON.stringify({ auto: [{ role: 'user', content: 'Tajný chat A' }] }));
  assert.deepEqual(readAccountState(local, accountA), rowA);

  clearAccountState(local, session, accountA);
  replaceAccountState(local, accountB, null);
  const rowB = readAccountState(local, accountB);

  assert.deepEqual(rowB, {
    course_progress: [],
    course_notes: {},
    worksheet_entries: {},
    course_mastery: {},
    training_portfolio: [],
    content_favorites: [],
    outcome_store: {},
    approved_memory: {},
  });
  assert.equal(session.getItem(accountStorageKey(accountA, 'elitea.conversations')), null);
  assert.equal(JSON.stringify([...local.values, ...session.values]).includes('Tajný chat A'), false);
  assert.equal(JSON.stringify([...local.values, ...session.values]).includes('Soukromá poznámka A'), false);
});

test('account state maps outcomes only to elitea.outcomes.v1', () => {
  assert.equal(ACCOUNT_STATE_KEYS.outcome_store, OUTCOME_STORAGE_KEY);
  assert.notEqual(ACCOUNT_STATE_KEYS.outcome_store, LEGACY_OUTCOME_STORAGE_KEY);
});

test('legacy scoped outcome state migrates once without overwriting v1 data', () => {
  const storage = new MemoryStorage();
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const legacyKey = accountStorageKey(userId, LEGACY_OUTCOME_STORAGE_KEY);
  const currentKey = accountStorageKey(userId, OUTCOME_STORAGE_KEY);
  const legacy = { schemaVersion: 1, records: [{ id: 'legacy' }] };
  storage.setItem(legacyKey, JSON.stringify(legacy));

  assert.equal(migrateLegacyOutcomeState(storage, userId), true);
  assert.deepEqual(JSON.parse(storage.getItem(currentKey)), legacy);
  assert.equal(storage.getItem(legacyKey), null);

  storage.setItem(legacyKey, JSON.stringify({ schemaVersion: 1, records: [{ id: 'must-not-win' }] }));
  assert.equal(migrateLegacyOutcomeState(storage, userId), false);
  assert.deepEqual(JSON.parse(storage.getItem(currentKey)), legacy);
});

test('old unscoped elitea.outcomes migrates only when cloud proves account ownership', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const verified = { schemaVersion: 1, activeId: null, records: [{ id: 'verified-a' }] };
  const safeStorage = new MemoryStorage([[LEGACY_OUTCOME_STORAGE_KEY, JSON.stringify(verified)]]);
  assert.equal(migrateLegacyOutcomeState(safeStorage, userId, { verifiedCloudValue: { records: [{ id: 'verified-a' }], activeId: null, schemaVersion: 1 } }), true);
  assert.deepEqual(JSON.parse(safeStorage.getItem(accountStorageKey(userId, OUTCOME_STORAGE_KEY))), verified);
  assert.equal(safeStorage.getItem(LEGACY_OUTCOME_STORAGE_KEY), null);

  const foreignStorage = new MemoryStorage([[LEGACY_OUTCOME_STORAGE_KEY, JSON.stringify({ records: [{ id: 'foreign-b' }] })]]);
  assert.equal(migrateLegacyOutcomeState(foreignStorage, userId, { verifiedCloudValue: verified }), false);
  assert.equal(foreignStorage.getItem(accountStorageKey(userId, OUTCOME_STORAGE_KEY)), null);
});

test('verified old cloud value safely carries newer unscoped v1 outcomes into the account partition', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const cloudValue = { schemaVersion: 1, records: [] };
  const newerLocalValue = { schemaVersion: 1, records: [{ id: 'new-local-result' }] };
  const storage = new MemoryStorage([
    [LEGACY_OUTCOME_STORAGE_KEY, JSON.stringify(cloudValue)],
    [OUTCOME_STORAGE_KEY, JSON.stringify(newerLocalValue)],
  ]);

  assert.equal(migrateLegacyOutcomeState(storage, userId, { verifiedCloudValue: cloudValue }), true);
  assert.deepEqual(JSON.parse(storage.getItem(accountStorageKey(userId, OUTCOME_STORAGE_KEY))), newerLocalValue);
  assert.equal(storage.getItem(LEGACY_OUTCOME_STORAGE_KEY), null);
  assert.equal(storage.getItem(OUTCOME_STORAGE_KEY), null);
});

test('malformed legacy outcomes are discarded without corrupting the canonical key', () => {
  const storage = new MemoryStorage();
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const legacyKey = accountStorageKey(userId, LEGACY_OUTCOME_STORAGE_KEY);
  storage.setItem(legacyKey, '{broken');

  assert.equal(migrateLegacyOutcomeState(storage, userId), false);
  assert.equal(storage.getItem(legacyKey), null);
  assert.equal(storage.getItem(accountStorageKey(userId, OUTCOME_STORAGE_KEY)), null);
});

test('browser lifecycle hydrates scoped storage and purges active state on logout', async () => {
  const app = await readFile(new URL('../src/browser-app.js', import.meta.url), 'utf8');
  const cloud = await readFile(new URL('../src/browser-cloud.js', import.meta.url), 'utf8');
  const logout = app.match(/async function signOutMember\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const restore = app.match(/async function restoreCloudAccount\([\s\S]*?\n\}/)?.[0] || '';

  assert.match(app, /const accountLocalStorage = createAccountStorage\(localStorage\)/);
  assert.match(app, /const accountSessionStorage = createAccountStorage\(sessionStorage\)/);
  assert.match(restore, /activateAccountIdentity\(current\.user\.id\)/);
  assert.match(restore, /hydrateAccountStateFromStorage\(\)/);
  assert.match(logout, /await flushCloudStateSync\(expectedAccountId\)/);
  assert.match(logout, /await freshAuthorization\(expectedAccountId\)/);
  assert.match(logout, /deactivateAccountIdentity\(\)/);
  assert.match(cloud, /if \(current\.user\.id !== loadedAccountId\) return false/);
  assert.doesNotMatch(app, /localStorage\.getItem\('elitea\.(?:memory|course|worksheet|training|content|outcomes)/);
  assert.doesNotMatch(app, /sessionStorage\.(?:getItem|setItem)\('elitea\./);
});

test('member requests abort when another tab changes the authenticated account', async () => {
  const app = await readFile(new URL('../src/browser-app.js', import.meta.url), 'utf8');
  const directAuthorizationCalls = app.match(/state\.cloud\??\.authorization\(/g) || [];
  const directCloudSaveCalls = app.match(/state\.cloud\??\.saveState\(/g) || [];

  assert.equal(directAuthorizationCalls.length, 1, 'Only freshAuthorization may obtain a bearer directly.');
  assert.equal(directCloudSaveCalls.length, 1, 'Only saveAuthenticatedCloudState may write account state directly.');
  assert.match(app, /function authorizationSubject\(authorization\)[\s\S]*claims\?\.sub/);
  assert.match(app, /if \(!authorizedAccountId[\s\S]*authorizedAccountId !== current\.user\.id/);
  assert.match(app, /async function freshAuthorization\(expectedAccountId = activeAccountId\)[\s\S]*session\(\{ forceFetch: true \}\)[\s\S]*authorizationSubject\(authorization\)[\s\S]*confirmed[\s\S]*ACCOUNT_IDENTITY_CHANGED/);
  assert.match(app, /async function authenticatedRequest\(path, options = \{\}\)[\s\S]*const expectedAccountId = activeAccountId;[\s\S]*freshAuthorization\(expectedAccountId\)[\s\S]*Authorization: authorization/);
  assert.match(app, /async function saveAuthenticatedCloudState\(expectedAccountId = activeAccountId\)[\s\S]*freshAuthorization\(expectedAccountId\)[\s\S]*activeAccountId !== expectedAccountId[\s\S]*state\.cloud\.saveState\(\)/);

  const guardedFunctions = [
    'refreshFoundingStatus',
    'submitFoundingFeedbackForm',
    'openFoundingAdmin',
    'openCoachTestAdmin',
    'handleFoundingAdminAction',
    'startMembershipCheckout',
    'openBillingPortal',
    'startBrowserOperator',
    'closeBrowserOperator',
    'previewBrowserAction',
    'executeBrowserActionDraft',
    'requestCoachReply',
    'submitTrainingMessage',
    'submitQualityReport',
  ];
  for (const functionName of guardedFunctions) {
    const start = app.indexOf(`async function ${functionName}(`);
    assert.notEqual(start, -1, `${functionName} must exist.`);
    const next = app.indexOf('\nasync function ', start + 1);
    const body = app.slice(start, next === -1 ? app.length : next);
    assert.match(body, /authenticatedRequest\(/, `${functionName} must use the fresh identity guard.`);
    assert.doesNotMatch(body, /state\.cloud\??\.authorization\(/, `${functionName} must not fetch a bearer directly.`);
  }

  const coach = app.slice(app.indexOf('async function requestCoachReply('), app.indexOf('\nasync function submitTrainingMessage('));
  const training = app.slice(app.indexOf('async function submitTrainingMessage('), app.indexOf('\nfunction handleMessageAction('));
  assert.match(coach, /error\?\.code !== 'ACCOUNT_IDENTITY_CHANGED'/);
  assert.match(training, /error\?\.code !== 'ACCOUNT_IDENTITY_CHANGED'/);
});
