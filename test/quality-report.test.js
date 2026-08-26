import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeQualityReport } from '../src/quality-report.js';

test('hlášení kvality přijme pouze strukturovaná metadata bez textu chatu', () => {
  const parsed = sanitizeQualityReport({
    reportId: '01JQUALITY-123456789',
    surface: 'training',
    issue: 'too_critical',
    provider: 'openai/gpt-5.6-terra',
    qualityScore: 87,
    qualityPassed: true,
    qualityRepaired: true,
    courseId: 'profesionalni-life-coach',
    itemId: 'm3-1',
    messageText: 'Tento text se nesmí dostat do logu.',
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.issue, 'too_critical');
  assert.equal('messageText' in parsed.value, false);
});

test('hlášení kvality odmítne neznámý typ a neplatné ID', () => {
  assert.equal(sanitizeQualityReport({ reportId: 'short', surface: 'coach', issue: 'other' }).ok, false);
  assert.equal(sanitizeQualityReport({ reportId: '01JQUALITY-123456789', surface: 'coach', issue: 'copy_chat' }).ok, false);
});

