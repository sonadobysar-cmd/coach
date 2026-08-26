import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const server = await readFile(join(ROOT, 'src', 'server.js'), 'utf8');

test('server nastavuje základní ochranné hlavičky', () => {
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /Permissions-Policy/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /X-Frame-Options/);
});

test('serverové logy nezapisují tělo zprávy ani objekt paměti', () => {
  const logCalls = [...server.matchAll(/console\.(?:log|warn|error)\((.*?)\);/gs)].map(match => match[1]).join('\n');
  assert.doesNotMatch(logCalls, /request\.body/);
  assert.doesNotMatch(logCalls, /memory/);
  assert.doesNotMatch(logCalls, /messages/);
});

test('hlášení kvality prochází sanitizací a nikdy neloguje text chatu', () => {
  const reportRoute = server.match(/app\.post\('\/api\/quality-report'[\s\S]*?\n}\);/)?.[0] || '';
  assert.match(reportRoute, /sameHost\(origin, request\.get\('host'\)\)/);
  assert.match(reportRoute, /sanitizeQualityReport\(request\.body\)/);
  assert.doesNotMatch(reportRoute, /messageText|messages|chatHistory|content/);
});

test('rezervační endpoint má kontrolu původu, validaci a nikdy nepředává chat', () => {
  assert.match(server, /sameHost\(origin, request\.get\('host'\)\)/);
  assert.match(server, /sanitizeBookingRequest\(request\.body\)/);
  assert.match(server, /sendBookingRequest\(parsed\.value\)/);
  assert.match(server, /sanitizeCourseRequest\(request\.body\)/);
  assert.match(server, /sendCourseRequest\(parsed\.value\)/);
  const bookingRoute = server.match(/app\.post\('\/api\/booking-request'[\s\S]*?\n}\);/)?.[0] || '';
  assert.doesNotMatch(bookingRoute, /messages|chatHistory|request\.body\?\.messages/);
});
