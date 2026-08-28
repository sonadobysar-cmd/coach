import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOperationalEvent } from '../src/observability.js';

test('provozní monitoring odstraní e-mail, čísla, URL a tajné klíče', () => {
  const event = sanitizeOperationalEvent({
    area: 'chat route',
    code: 'MODEL FAILED',
    path: 'https://elitea.cz/api/chat?token=secret',
    summary: 'sona@example.cz 123456789 sk_test_abcdef https://vendor.example/error',
  });
  assert.equal(event.area, 'chat_route');
  assert.equal(event.code, 'MODEL_FAILED');
  assert.equal(event.path, '/api/chat');
  assert.doesNotMatch(event.summary, /sona|123456789|sk_test|vendor\.example/);
  assert.equal(event.fingerprint.length, 40);
});

test('stejná chyba má stabilní fingerprint pro hodinovou agregaci', () => {
  const input = { area: 'payments', code: 'HTTP_500', path: '/api/checkout', summary: 'Provider failed' };
  assert.equal(sanitizeOperationalEvent(input).fingerprint, sanitizeOperationalEvent(input).fingerprint);
});
