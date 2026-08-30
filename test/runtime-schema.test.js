import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureRuntimeSchema, runtimeSchemaStatements } from '../src/runtime-schema.js';

test('produkční schéma vytváří limity, monitoring a lifecycle idempotentně', () => {
  const statements = runtimeSchemaStatements().join('\n');
  assert.match(statements, /CREATE TABLE IF NOT EXISTS ai_usage_counters/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS operational_error_events/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS member_lifecycle/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS public_coach_test_feedback/);
  assert.match(statements, /transcript_consent OR transcript IS NULL/);
  assert.match(statements, /IF NOT EXISTS[\s\S]+CREATE POLICY/);
  assert.match(statements, /pg_advisory_xact_lock/);
});

test('bez databáze se lokální vývoj nezablokuje', async () => {
  assert.deepEqual(await ensureRuntimeSchema({}), { configured: false, ready: false });
});
