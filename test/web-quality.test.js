import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [html, app, css, robots, sitemap, coachTestHtml, coachTestJs] = await Promise.all([
  readFile(`${ROOT}/public/index.html`, 'utf8'),
  readFile(`${ROOT}/src/browser-app.js`, 'utf8'),
  readFile(`${ROOT}/public/styles.css`, 'utf8'),
  readFile(`${ROOT}/public/robots.txt`, 'utf8'),
  readFile(`${ROOT}/public/sitemap.xml`, 'utf8'),
  readFile(`${ROOT}/public/coach-test.html`, 'utf8'),
  readFile(`${ROOT}/public/coach-eval.js`, 'utf8'),
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

test('banner lekce zobrazuje skutečnou odbornou trenérku otevřeného kurzu', () => {
  assert.match(app, /const trainer = courseTrainer\(state\.activeCourse\)/);
  assert.match(app, /lessonTrainerTitle\.textContent = trainer\.heading/);
  assert.match(app, /lessonTrainerDescription\.textContent = trainer\.description/);
  assert.match(app, /discussLesson\.textContent = trainer\.studyAction/);
  assert.match(app, /simulateLesson\.textContent = trainer\.simulationAction/);
  assert.doesNotMatch(app, /Od pochopení k bezpečnému vedení klientky/);
});

test('Academy uvádí skutečný počet všech dostupných programů', () => {
  assert.match(html, /<div class="academy-stat"><strong>27<\/strong><span>silných programů<\/span>/);
  assert.match(html, /<strong>27<\/strong><span>profesních programů<\/span>/);
  assert.match(html, /<strong>2 561<\/strong><span>částí s vizuálním výkladem<\/span>/);
});

test('rychlotest koučky a mentorky funguje bez registračního formuláře a se samostatným feedbackem', () => {
  assert.match(coachTestHtml, /Bez účtu · přibližně 5 minut/);
  assert.match(coachTestHtml, /data-mode="coach"/);
  assert.match(coachTestHtml, /data-mode="mentor"/);
  assert.doesNotMatch(coachTestHtml, /Stripe|Vytvořit účet|heslo/);
  assert.match(coachTestHtml, /transcriptConsent/);
  assert.match(coachTestJs, /\/api\/public-coach-test\/session/);
  assert.match(coachTestJs, /\/api\/public-coach-test\/chat/);
  assert.match(coachTestJs, /\/api\/public-coach-test\/feedback/);
});

test('majitelka má v Elitea jednoduchý interní přehled testů a přepisů', () => {
  assert.match(html, /id="coach-test-admin-button"/);
  assert.match(html, /id="coach-test-admin-dialog"/);
  assert.match(app, /\/api\/public-coach-test\/admin\/feedback/);
  assert.match(app, /Celý přepis/);
  assert.match(app, /data-coach-test-filter/);
});
