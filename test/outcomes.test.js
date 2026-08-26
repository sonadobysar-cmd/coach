import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  anonymousOutcomeRows,
  beginMeasuredSession,
  dueFollowUps,
  finishMeasuredSession,
  outcomeRowsToCsv,
  outcomeSummary,
  recordOutcomeFollowUp,
} from '../public/outcomes.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const empty = { records: [], activeId: null };
const startTime = new Date('2026-08-20T10:00:00.000Z');
const endTime = new Date('2026-08-20T11:00:00.000Z');

test('měřené sezení zachová vstupní stav a nepovolí dvě aktivní relace', () => {
  const started = beginMeasuredSession(empty, {
    goal: '  Rozhodnout se, co spustím  ', clarity: 3, confidence: 4, consultationMode: 'coaching_session',
  }, { now: startTime, id: 'private-session-id' });
  assert.equal(started.activeId, 'private-session-id');
  assert.equal(started.records[0].goal, 'Rozhodnout se, co spustím');
  assert.deepEqual(started.records[0].before, { clarity: 3, confidence: 4 });
  assert.deepEqual(beginMeasuredSession(started, { goal: 'jiné' }, { id: 'other' }), started);
});

test('ukončení měří změnu a naplánuje následnou kontrolu', () => {
  const started = beginMeasuredSession(empty, { clarity: 2, confidence: 3 }, { now: startTime, id: 'a' });
  const finished = finishMeasuredSession(started, {
    clarity: 8, confidence: 7, understood: 5, grounded: 4, insight: 5, nextStepFit: 4, autonomy: 5,
    keyLearning: 'Rozlišuji fakta od domněnek.', agreedAction: 'Ověřit nabídku.',
  }, { now: endTime, followUpDays: 3 });
  assert.equal(finished.activeId, null);
  assert.equal(finished.records[0].status, 'completed');
  assert.equal(finished.records[0].followUpDueAt, '2026-08-23T11:00:00.000Z');
  assert.equal(outcomeSummary(finished).averageClarityDelta, 6);
  assert.equal(dueFollowUps(finished, new Date('2026-08-23T12:00:00Z')).length, 1);
});

test('follow-up počítá provedení kroku bez tvrzení, že pouhý pocit je výsledek', () => {
  const started = beginMeasuredSession(empty, { clarity: 4, confidence: 4 }, { now: startTime, id: 'b' });
  const finished = finishMeasuredSession(started, {
    clarity: 6, confidence: 6, understood: 4, grounded: 4, insight: 4, nextStepFit: 5, autonomy: 5,
  }, { now: endTime });
  const followed = recordOutcomeFollowUp(finished, 'b', {
    actionStatus: 'partial', retainedUsefulness: 4, evidence: 'Oslovila jsem tři zákaznice.',
  }, { now: new Date('2026-08-24T10:00:00Z') });
  const summary = outcomeSummary(followed);
  assert.equal(summary.actionRate, 100);
  assert.equal(summary.followUps, 1);
});

test('anonymní export neobsahuje cíl, poznámky ani domluvený krok', () => {
  const started = beginMeasuredSession(empty, { goal: 'Citlivý cíl', clarity: 1, confidence: 2 }, { now: startTime, id: 'secret-id' });
  const finished = finishMeasuredSession(started, {
    clarity: 7, confidence: 6, understood: 5, grounded: 5, insight: 4, nextStepFit: 4, autonomy: 5,
    keyLearning: 'Citlivé uvědomění', agreedAction: 'Citlivý krok', issueNote: 'Soukromá poznámka',
    techniqueId: 't_grow', provider: 'openai/gpt-5.6-sol', qualityScore: 92, qualityPassed: true,
  }, { now: endTime });
  const rows = anonymousOutcomeRows(finished);
  const serialized = JSON.stringify(rows);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].session_id, 'secret-id');
  assert.doesNotMatch(serialized, /Citliv/);
  assert.doesNotMatch(serialized, /secret-id/);
  assert.equal(rows[0].technique_id, 't_grow');
  assert.equal(rows[0].provider, 'openai/gpt-5.6-sol');
  assert.equal(rows[0].internal_quality_score, 92);
  assert.match(outcomeRowsToCsv(rows), /clarity_delta/);
});

test('členské rozhraní zpřístupňuje měření na desktopu i mobilu', async () => {
  const [html, client, css] = await Promise.all([
    readFile(join(ROOT, 'public', 'index.html'), 'utf8'),
    readFile(join(ROOT, 'public', 'app.js'), 'utf8'),
    readFile(join(ROOT, 'public', 'styles.css'), 'utf8'),
  ]);
  assert.match(html, /id="outcome-card"/);
  assert.match(html, /id="outcome-toolbar-button"/);
  assert.match(html, /data-outcome-step="start"/);
  assert.match(html, /data-outcome-step="end"/);
  assert.match(html, /data-outcome-step="followup"/);
  assert.match(html, /data-outcome-step="history"/);
  assert.match(client, /anonymousOutcomeRows/);
  assert.match(client, /pendingOutcomeClosure/);
  assert.match(css, /\.member-mode \.outcome-toolbar-button/);
});
