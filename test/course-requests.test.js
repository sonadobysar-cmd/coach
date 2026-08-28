import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCourseRequestEmail,
  courseRequestsConfigured,
  sanitizeCourseRequest,
  sendCourseRequest,
} from '../src/course-requests.js';

const valid = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  topic: 'Somatické techniky pro práci s přetíženou klientkou',
  useCase: 's-klientkami',
  outcome: 'Umět bezpečně zvolit a vést krátké praktické cvičení.',
  consent: true,
  company: '',
};

test('námět na kurz přijme jen úplné a vědomě odeslané zadání', () => {
  assert.equal(sanitizeCourseRequest(valid).ok, true);
  assert.equal(sanitizeCourseRequest({ ...valid, topic: 'NLP' }).ok, false);
  assert.equal(sanitizeCourseRequest({ ...valid, useCase: 'neplatne' }).ok, false);
  assert.equal(sanitizeCourseRequest({ ...valid, consent: false }).ok, false);
  assert.equal(sanitizeCourseRequest({ ...valid, company: 'bot' }).ok, false);
});

test('e-mail s námětem obsahuje jen údaje formuláře a bezpečně escapuje HTML', () => {
  const request = sanitizeCourseRequest({ ...valid, topic: '<b>Somatika</b>' }).value;
  const email = buildCourseRequestEmail(request);

  assert.match(email.plain, /Somatika/);
  assert.match(email.plain, /S klientkami/);
  assert.match(email.html, /&lt;b&gt;Somatika&lt;\/b&gt;/);
  assert.doesNotMatch(email.html, /messages|chatHistory/i);
});

test('námět se doručuje idempotentně na samostatnou nebo rezervační adresu', async () => {
  const request = sanitizeCourseRequest(valid).value;
  let sent;
  const result = await sendCourseRequest(request, {
    RESEND_API_KEY: 'test-key',
    ELITEA_FROM_EMAIL: 'Elitea <academy@example.com>',
    NIA_COURSE_REQUEST_EMAIL: 'academy@example.com',
  }, async (url, options) => {
    sent = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ id: 'email-1' }) };
  });

  assert.equal(result.id, 'email-1');
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.deepEqual(sent.body.to, ['academy@example.com']);
  assert.equal(sent.options.headers['Idempotency-Key'], `elitea-course-request-${request.id}`);
  assert.equal(courseRequestsConfigured({ RESEND_API_KEY: 'x', ELITEA_FROM_EMAIL: 'Elitea <hello@elitea.cz>', NIA_BOOKING_EMAIL: 'team@example.com' }), true);
  assert.equal(courseRequestsConfigured({ RESEND_API_KEY: 'x', NIA_BOOKING_EMAIL: 'team@example.com' }), false);
  assert.equal(courseRequestsConfigured({ NIA_BOOKING_EMAIL: 'team@example.com' }), false);
});
