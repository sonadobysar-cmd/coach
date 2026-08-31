import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCertificateQaRequest } from '../src/certificate-production-qa.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const SECRET = 'qa-secret-that-is-longer-than-thirty-two-bytes';
const ENV = {
  ELITEA_CERTIFICATE_QA_SECRET: SECRET,
  ELITEA_CERTIFICATE_QA_USER_IDS: `11111111-1111-4111-8111-111111111111, ${USER_ID}`,
};

test('produkční QA certifikátu vyžaduje současně přesný tajný klíč a povolený účet', () => {
  assert.equal(authorizeCertificateQaRequest(`Bearer ${SECRET}`, USER_ID, ENV), true);
  assert.equal(authorizeCertificateQaRequest('Bearer wrong', USER_ID, ENV), false);
  assert.equal(authorizeCertificateQaRequest(`Bearer ${SECRET}`, '33333333-3333-4333-8333-333333333333', ENV), false);
  assert.equal(authorizeCertificateQaRequest(`Bearer ${SECRET}`, 'not-a-uuid', ENV), false);
});

test('krátký nebo chybějící QA klíč nelze použít', () => {
  assert.equal(authorizeCertificateQaRequest('Bearer short', USER_ID, {
    ELITEA_CERTIFICATE_QA_SECRET: 'short',
    ELITEA_CERTIFICATE_QA_USER_IDS: USER_ID,
  }), false);
  assert.equal(authorizeCertificateQaRequest('', USER_ID, ENV), false);
});
