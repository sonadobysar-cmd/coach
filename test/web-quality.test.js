import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [html, app, css, robots, sitemap] = await Promise.all([
  readFile(`${ROOT}/public/index.html`, 'utf8'),
  readFile(`${ROOT}/src/browser-app.js`, 'utf8'),
  readFile(`${ROOT}/public/styles.css`, 'utf8'),
  readFile(`${ROOT}/public/robots.txt`, 'utf8'),
  readFile(`${ROOT}/public/sitemap.xml`, 'utf8'),
]);

test('veřejný web má indexační soubory a strukturovaná data', () => {
  assert.match(robots, /Sitemap: https:\/\/elitea\.cz\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/elitea\.cz\/<\/loc>/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type": "SoftwareApplication"/);
});

test('veřejné obrázky mají rozměry a fonty se načítají lokálně', () => {
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
  assert.ok(images.length >= 8);
  images.forEach(image => {
    assert.match(image, /\bwidth="\d+"/);
    assert.match(image, /\bheight="\d+"/);
  });
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  assert.match(css, /\/fonts\/dm-sans-latin-ext\.woff2/);
});

test('členská navigace a Mastery Lab oznamují aktivní a rozbalený stav', () => {
  assert.match(html, /id="mastery-toggle"[^>]*aria-expanded="false"/);
  assert.match(app, /setAttribute\('aria-expanded', String\(expanded\)\)/);
  assert.match(app, /setAttribute\('aria-current', 'page'\)/);
  assert.match(app, /aria-current="step"/);
});

test('každá lekce nabízí lokální český audio režim s pauzou a rychlostí', () => {
  assert.match(html, /id="lesson-audio-toggle"/);
  assert.match(html, /id="lesson-audio-rate"/);
  assert.match(app, /SpeechSynthesisUtterance/);
  assert.match(app, /utterance\.lang = 'cs-CZ'/);
  assert.match(app, /speechSynthesis\.pause\(\)/);
});
