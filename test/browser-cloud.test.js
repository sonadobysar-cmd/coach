import assert from 'node:assert/strict';
import test from 'node:test';

import { emailSignUpPayload } from '../src/browser-cloud.js';

test('email registration does not send a callback URL rejected by Neon Auth', () => {
  const payload = emailSignUpPayload('Elitea QA', 'qa@example.com', 'secret-password');

  assert.deepEqual(payload, {
    name: 'Elitea QA',
    email: 'qa@example.com',
    password: 'secret-password',
  });
  assert.equal(Object.hasOwn(payload, 'callbackURL'), false);
});
