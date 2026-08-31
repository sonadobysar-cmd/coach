import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [html, manifest, worker, app] = await Promise.all([
  readFile(`${ROOT}/public/index.html`, 'utf8'),
  readFile(`${ROOT}/public/manifest.webmanifest`, 'utf8').then(JSON.parse),
  readFile(`${ROOT}/public/sw.js`, 'utf8'),
  readFile(`${ROOT}/src/browser-app.js`, 'utf8'),
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
  assert.match(worker, /elitea-shell-v0\.36\.0/);
  assert.match(worker, /\/\\\.\(\?:js\|css\|html\|webmanifest\)\$\//);
  const mutableBranch = worker.match(/if \(\/\\\.\(\?:js\|css\|html\|webmanifest\)\$\/[\s\S]*?\n  \}/)?.[0] || '';
  assert.match(mutableBranch, /fetch\(request\)/);
  assert.match(mutableBranch, /catch\(\(\) => caches\.match\(request\)\)/);
  assert.match(html, /\/app\.js\?v=0\.36\.0/);
  assert.match(html, /\/styles\.css\?v=0\.36\.0/);
  assert.match(app, /\/cloud\.js\?v=0\.36\.0/);
});
