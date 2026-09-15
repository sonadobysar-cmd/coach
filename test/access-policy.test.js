import assert from 'node:assert/strict';
import test from 'node:test';

import { previewAccessAllowed } from '../src/access-policy.js';

function requestFor(host) {
  return { get: name => name === 'host' ? host : '' };
}

test('preview přístup vyžaduje explicitní příznak', () => {
  assert.equal(previewAccessAllowed(requestFor('preview.example.vercel.app'), {
    VERCEL_ENV: 'preview',
  }), false);
  assert.equal(previewAccessAllowed(requestFor('preview.example.vercel.app'), {
    ELITEA_PREVIEW_ACCESS: 'true',
    VERCEL_ENV: 'preview',
  }), true);
});

test('preview přístup je vždy zakázaný na produkčním hostu', () => {
  const env = { ELITEA_PREVIEW_ACCESS: 'true', VERCEL_ENV: 'preview' };
  assert.equal(previewAccessAllowed(requestFor('elitea.cz'), env), false);
  assert.equal(previewAccessAllowed(requestFor('www.elitea.cz:443'), env), false);
});

test('preview přístup je vždy zakázaný ve Vercel production prostředí', () => {
  assert.equal(previewAccessAllowed(requestFor('deployment.example.vercel.app'), {
    ELITEA_PREVIEW_ACCESS: 'true',
    VERCEL_ENV: 'production',
  }), false);
});
