import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCertificateQaRequest, buildCertificateQaExamTranscript } from '../src/certificate-production-qa.js';

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

test('živý QA přepis odpovídá profesní komunikační zkoušce a dokládá všech šest bran', () => {
  const transcript = buildCertificateQaExamTranscript();
  const studentText = transcript.filter(message => message.role === 'user').map(message => message.content).join('\n');
  assert.match(studentText, /cíl.*rolí.*tempem/iu);
  assert.match(studentText, /Navazuji na tvoje/iu);
  assert.match(studentText, /pozorování–dopad–potřeba–žádost/iu);
  assert.match(studentText, /Takový slib dát nemohu/iu);
  assert.match(studentText, /Ty sis zvolila první variantu/iu);
  assert.match(studentText, /Sebereflexe:.*Mezera:.*Cíl dalšího pokusu:/isu);
});
