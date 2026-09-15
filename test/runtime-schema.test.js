import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureRuntimeSchema, runtimeSchemaStatements } from '../src/runtime-schema.js';

test('produkční schéma vytváří limity, monitoring a lifecycle idempotentně', () => {
  const statements = runtimeSchemaStatements().join('\n');
  assert.match(statements, /CREATE TABLE IF NOT EXISTS ai_usage_counters/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS operational_error_events/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS member_lifecycle/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS public_coach_test_feedback/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS academy_course_evidence/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS academy_exam_attempts/);
  assert.match(statements, /academy_exam_attempts_training_attempt_idx/);
  assert.match(statements, /academy_coach_debrief_training_attempt_idx/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS academy_coach_debrief_attempts/);
  assert.match(statements, /evidence_validation_version integer NOT NULL DEFAULT 1/);
  assert.match(statements, /assessment_policy_version integer NOT NULL DEFAULT 1/);
  assert.match(statements, /scenario_family_id text/);
  assert.match(statements, /challenge_id text/);
  assert.match(statements, /remediation_failure_codes jsonb/);
  assert.match(statements, /UNIQUE \(user_id, course_id, transcript_hash\)/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS academy_certificates/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS stripe_webhook_events/);
  assert.match(statements, /CREATE TABLE IF NOT EXISTS membership_checkout_intents/);
  assert.match(statements, /membership_checkout_intents_expiry_idx/);
  assert.match(statements, /trial_consumed_at=COALESCE\(updated_at, now\(\)\)[\s\S]*provider_subscription_id IS NOT NULL/);
  assert.match(statements, /UNIQUE \(user_id, course_id\)/);
  assert.match(statements, /transcript_consent OR transcript IS NULL/);
  assert.match(statements, /IF NOT EXISTS[\s\S]+CREATE POLICY/);
  assert.match(statements, /pg_advisory_xact_lock/);
});

test('bez databáze se lokální vývoj nezablokuje', async () => {
  assert.deepEqual(await ensureRuntimeSchema({}), { configured: false, ready: false });
});
