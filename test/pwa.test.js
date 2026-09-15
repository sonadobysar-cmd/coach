import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [html, manifest, worker, app, packageJson] = await Promise.all([
  readFile(`${ROOT}/public/index.html`, 'utf8'),
  readFile(`${ROOT}/public/manifest.webmanifest`, 'utf8').then(JSON.parse),
  readFile(`${ROOT}/public/sw.js`, 'utf8'),
  readFile(`${ROOT}/src/browser-app.js`, 'utf8'),
  readFile(`${ROOT}/package.json`, 'utf8').then(JSON.parse),
]);

test('Elitea je instalovatelná PWA s identitou a zkratkami', () => {
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'cs-CZ');
  assert.ok(manifest.icons.length);
  assert.ok(manifest.shortcuts.length >= 3);
});

test('service worker nikdy necachuje API a má offline shell', () => {
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /caches\.match\('\/index\.html'\)/);
  assert.match(app, /navigator\.serviceWorker\.register\('\/sw\.js', \{ updateViaCache: 'none' \}\)/);
});

test('nový produkční JavaScript a CSS mají přednost před starou PWA cache', () => {
  const version = String(packageJson.version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(worker, new RegExp(`elitea-shell-v${version}`));
  assert.match(worker, /\/\\\.\(\?:js\|css\|html\|webmanifest\)\$\//);
  const mutableBranch = worker.match(/if \(\/\\\.\(\?:js\|css\|html\|webmanifest\)\$\/[\s\S]*?\n  \}/)?.[0] || '';
  assert.match(mutableBranch, /fetch\(request\)/);
  assert.match(mutableBranch, /catch\(\(\) => caches\.match\(request\)\)/);
  assert.match(html, new RegExp(`/app\\.js\\?v=${version}`));
  assert.match(html, new RegExp(`/styles\\.css\\?v=${version}`));
  assert.match(app, new RegExp(`/cloud\\.js\\?v=${version}`));
});
