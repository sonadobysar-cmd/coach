import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingConfigured, bookingRecipient, buildBookingEmail, sanitizeBookingRequest, sendBookingRequest } from '../src/booking.js';

const valid = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Aneta Nová',
  email: 'aneta@example.com',
  topic: 'Chci ujasnit nabídku a další krok.',
  preferredDate: '2026-10-10',
  timeWindow: 'dopoledne',
  documentApproved: true,
  document: 'Schválený profesionální podklad pro Niu.',
  consent: true,
  company: '',
};

test('rezervační žádost vyžaduje platné údaje a konečný souhlas', () => {
  assert.equal(sanitizeBookingRequest(valid).ok, true);
  assert.equal(sanitizeBookingRequest({ ...valid, email: 'špatně' }).ok, false);
  assert.equal(sanitizeBookingRequest({ ...valid, consent: false }).ok, false);
  assert.equal(sanitizeBookingRequest({ ...valid, company: 'bot' }).ok, false);
});

test('neschválený dokument se z požadavku odstraní', () => {
  const parsed = sanitizeBookingRequest({ ...valid, documentApproved: false });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.document, '');
});

test('e-mail výslovně uvádí, že syrový chat nebyl předán', () => {
  const booking = sanitizeBookingRequest(valid).value;
  const email = buildBookingEmail(booking);
  assert.match(email.plain, /Syrový chat nebyl předán/);
  assert.match(email.plain, /výslovně schválila/);
  assert.doesNotMatch(email.plain, /heslo|token/i);
});

test('odeslání používá idempotency key a dokument pouze jako schválenou přílohu', async () => {
  let captured;
  const fetchMock = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: 'email_123' }) };
  };
  const booking = sanitizeBookingRequest(valid).value;
  const result = await sendBookingRequest(booking, {
    RESEND_API_KEY: 'test-key',
    NIA_BOOKING_EMAIL: 'nia@example.com',
    ELITEA_FROM_EMAIL: 'Elitea <booking@example.com>',
  }, fetchMock);
  const payload = JSON.parse(captured.options.body);
  assert.equal(result.id, 'email_123');
  assert.equal(captured.url, 'https://api.resend.com/emails');
  assert.equal(captured.options.headers['Idempotency-Key'], `elitea-booking-${valid.id}`);
  assert.equal(payload.attachments.length, 1);
  assert.equal(payload.to[0], 'nia@example.com');
  assert.equal(payload.reply_to, valid.email);
  assert.doesNotMatch(captured.options.body, /messages|chatHistory/);
});

test('rezervace se nepovažuje za připojenou bez obou serverových proměnných', () => {
  assert.equal(bookingConfigured({}), false);
  assert.equal(bookingConfigured({ RESEND_API_KEY: 'x', NIA_BOOKING_EMAIL: 'nia@example.com' }), true);
  assert.equal(bookingConfigured({ RESEND_API_KEY: 'x', NIA_TESTER_EMAIL: 'testers@example.com' }), true);
  assert.equal(bookingRecipient({ NIA_BOOKING_EMAIL: '', NIA_TESTER_EMAIL: 'testers@example.com' }), 'testers@example.com');
});
