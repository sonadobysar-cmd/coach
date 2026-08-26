import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSE_CATEGORIES, courseSummary, loadCourses, parseCourse } from '../src/courses.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('loads the Elitea practitioner course with all core modules', async () => {
  const [course] = await loadCourses(join(ROOT, 'data', 'course-neuroplasticita-practitioner.md'));
  assert.equal(course.slug, 'prepis-svuj-vzorec');
  assert.equal(course.moduleCount, 10);
  assert.ok(course.itemCount >= 50);
  assert.equal(course.certificate.issuedBy, 'Nia Dobyšar');
});

test('loads the intensive self-trust program as a separate Academy path', async () => {
  const courses = await loadCourses([
    join(ROOT, 'data', 'course-neuroplasticita-practitioner.md'),
    join(ROOT, 'data', 'course-pevna-v-sobe.md'),
  ]);
  const course = courses.find(item => item.slug === 'pevna-v-sobe');
  assert.equal(courses.length, 2);
  assert.equal(course.title, 'Pevná v sobě');
  assert.match(course.certificate.title, /Pevná v sobě/);
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.equal(course.moduleCount, 20);
  assert.equal(course.itemCount, 120);
  assert.equal(course.durationHours, 40);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2400);
  const words = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(words >= 10000, `kurz má pouze ${words} slov studijního obsahu`);
  const lessons = course.modules.flatMap(module => module.items).filter(item => item.kind === 'lesson');
  assert.equal(lessons.length, 60);
  assert.ok(lessons.every(item => item.markdown.includes('Aktivní studium lekce')));
  assert.equal(course.topicLabel, 'SEBEDŮVĚRA');
});

test('loads the complete spiritual coaching course with real 32-hour scope', async () => {
  const courses = await loadCourses([
    join(ROOT, 'data', 'course-neuroplasticita-practitioner.md'),
    join(ROOT, 'data', 'course-pevna-v-sobe.md'),
    join(ROOT, 'data', 'course-spiritualni-koucink.md'),
  ]);
  const course = courses.find(item => item.slug === 'spiritualni-koucink-v-praxi');
  assert.equal(courses.length, 3);
  assert.equal(course.title, 'Spirituální koučink v praxi');
  assert.equal(course.moduleCount, 14);
  assert.equal(course.itemCount, 81);
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 1920);
  const studyWords = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(studyWords >= 12000, `kurz má pouze ${studyWords} slov studijního obsahu`);
  assert.ok(course.modules[9].items.some(item => item.title.startsWith('Profesní aplikace 9.5')));
  assert.ok(course.modules[9].items.some(item => item.title.startsWith('Lekce 9.6')));
  assert.equal(course.certificate.title, 'Elitea Certified Spiritual Coach');
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.equal(course.topicLabel, 'SPIRITUALITA');
});

test('loads the complete communication masterclass with real 40-hour scope', async () => {
  const [course] = await loadCourses(join(ROOT, 'data', 'course-komunikace-v-praxi.md'));
  assert.equal(course.slug, 'komunikace-ktera-funguje');
  assert.equal(course.title, 'Komunikace, která funguje');
  assert.equal(course.moduleCount, 16);
  assert.equal(course.itemCount, 96);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2400);
  const studyWords = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(studyWords >= 10000, `kurz má pouze ${studyWords} slov studijního obsahu`);
  assert.equal(course.certificate.title, 'Elitea Certified Communication Practitioner');
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.equal(course.topicLabel, 'KOMUNIKACE');
});

test('loads the complete KBT-inspired coaching course with real 40-hour scope', async () => {
  const [course] = await loadCourses(join(ROOT, 'data', 'course-kbt-koucink-v-praxi.md'));
  assert.equal(course.slug, 'kbt-inspirovany-koucink');
  assert.equal(course.title, 'KBT-inspirovaný koučink v praxi');
  assert.equal(course.moduleCount, 16);
  assert.equal(course.itemCount, 96);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2400);
  const studyWords = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(studyWords >= 8500, `kurz má pouze ${studyWords} slov studijního obsahu`);
  assert.equal(course.certificate.title, 'Elitea Certified Cognitive Coaching Practitioner');
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.match(course.certificate.note, /Nejde o zdravotnickou kvalifikaci/);
  assert.equal(course.topicLabel, 'KBT KOUČINK');
});

test('loads the complete ADHD-focused coaching course with real 32-hour scope', async () => {
  const [course] = await loadCourses(join(ROOT, 'data', 'course-adhd-focus-motivace.md'));
  assert.equal(course.slug, 'adhd-soustredeni-a-motivace');
  assert.equal(course.title, 'ADHD: soustředění, motivace a exekutivní dovednosti');
  assert.equal(course.moduleCount, 16);
  assert.equal(course.itemCount, 96);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 1920);
  const studyWords = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(studyWords >= 8500, `kurz má pouze ${studyWords} slov studijního obsahu`);
  assert.equal(course.categoryId, COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id);
  assert.equal(course.certificate.title, 'Elitea Certified ADHD-Focused Coaching Practitioner');
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.match(course.certificate.note, /Nejde o zdravotnickou kvalifikaci/);
  assert.equal(course.topicLabel, 'ADHD & FOCUS');
});

test('loads the complete Bach flower-informed course with real 40-hour scope', async () => {
  const [course] = await loadCourses(join(ROOT, 'data', 'course-bachovy-kvetove-esence.md'));
  assert.equal(course.slug, 'bachovy-kvetove-esence-bezpecna-praxe');
  assert.equal(course.title, 'Bachovy květové esence: tradice, rozlišování a bezpečná praxe');
  assert.equal(course.moduleCount, 20);
  assert.equal(course.itemCount, 120);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2400);
  const studyWords = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(studyWords >= 8500, `kurz má pouze ${studyWords} slov studijního obsahu`);
  assert.equal(course.categoryId, COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id);
  assert.equal(course.certificate.title, 'Elitea Certified Bach Flower-Informed Practitioner');
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.match(course.certificate.note, /Nejde o zdravotnickou, psychoterapeutickou, veterinární ani Bach Centre kvalifikaci/);
  assert.equal(course.topicLabel, 'BACHOVY ESENCE');
});

test('loads the complete professional life coach course with real 36-hour scope', async () => {
  const [course] = await loadCourses(join(ROOT, 'data', 'course-profesionalni-life-coach.md'));
  assert.equal(course.slug, 'profesionalni-life-coach-od-kontraktu-k-vysledku');
  assert.equal(course.moduleCount, 18);
  assert.equal(course.itemCount, 108);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2160);
  const studyWords = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(studyWords >= 8500, `kurz má pouze ${studyWords} slov studijního obsahu`);
  const lessons = course.modules.flatMap(module => module.items).filter(item => item.kind === 'lesson');
  assert.equal(lessons.length, 54);
  assert.ok(lessons.every(item => item.markdown.includes('Aktivní část lekce')));
  assert.ok(lessons.every(item => item.markdown.includes('Výstup do portfolia')));
  assert.equal(course.categoryId, COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id);
  assert.equal(course.certificate.title, 'Elitea Certified Professional Life Coach');
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.match(course.certificate.note, /Nejde o zdravotnickou, psychoterapeutickou, státní ani ICF kvalifikaci/);
});

test('loads the complete women circle facilitator course with real 40-hour scope', async () => {
  const [course] = await loadCourses(join(ROOT, 'data', 'course-zenske-kruhy.md'));
  assert.equal(course.slug, 'facilitatorka-zenskych-kruhu-bezpeci-spojeni-ritual');
  assert.equal(course.moduleCount, 20);
  assert.equal(course.itemCount, 120);
  assert.ok(course.modules.every(module => module.items.length === 6));
  assert.equal(course.modules.flatMap(module => module.items).reduce((sum, item) => sum + item.minutes, 0), 2400);
  const studyWords = course.modules.flatMap(module => module.items)
    .reduce((sum, item) => sum + item.markdown.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).length, 0);
  assert.ok(studyWords >= 10000, `kurz má pouze ${studyWords} slov studijního obsahu`);
  const lessons = course.modules.flatMap(module => module.items).filter(item => item.kind === 'lesson');
  assert.equal(lessons.length, 60);
  assert.ok(lessons.every(item => item.markdown.includes('Aktivní studium lekce')));
  assert.ok(lessons.every(item => item.markdown.includes('Výstup do portfolia')));
  assert.equal(course.categoryId, COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id);
  assert.equal(course.certificate.title, "Elitea Certified Women's Circle Facilitator");
  assert.equal(course.certificate.thresholdPercent, 100);
  assert.match(course.certificate.note, /Nejde o zdravotnickou, psychoterapeutickou, krizovou, státní ani jinou regulovanou kvalifikaci/);
});

test('Academy řadí každý současný kurz do jedné stabilní odborné oblasti', async () => {
  const courses = await loadCourses([
    join(ROOT, 'data', 'course-neuroplasticita-practitioner.md'),
    join(ROOT, 'data', 'course-pevna-v-sobe.md'),
    join(ROOT, 'data', 'course-spiritualni-koucink.md'),
    join(ROOT, 'data', 'course-komunikace-v-praxi.md'),
    join(ROOT, 'data', 'course-kbt-koucink-v-praxi.md'),
    join(ROOT, 'data', 'course-adhd-focus-motivace.md'),
    join(ROOT, 'data', 'course-bachovy-kvetove-esence.md'),
    join(ROOT, 'data', 'course-profesionalni-life-coach.md'),
    join(ROOT, 'data', 'course-zenske-kruhy.md'),
  ]);
  const validCategories = new Set(Object.values(COURSE_CATEGORIES).map(category => category.id));
  assert.ok(courses.every(course => validCategories.has(course.categoryId)));
  assert.equal(courses.filter(course => course.categoryId === COURSE_CATEGORIES.COACHING_MENTAL_HEALTH.id).length, 8);
  assert.equal(courses.filter(course => course.categoryId === COURSE_CATEGORIES.BUSINESS_STRATEGY.id).length, 1);
  assert.equal(courses.filter(course => course.categoryId === COURSE_CATEGORIES.MARKETING.id).length, 0);
  assert.ok(courses.every(course => courseSummary(course).categoryLabel === course.categoryLabel));
});

test('supports an explicit study duration on each course item', () => {
  const course = parseCourse(`# MODUL 1 — TEST\n## Lekce 1.1 — Úvod\n<!-- minutes: 37 -->\nText`);
  assert.equal(course.modules[0].items[0].minutes, 37);
  assert.doesNotMatch(course.modules[0].items[0].markdown, /minutes:/);
});

test('separates lesson, self-practice, client-practice and quiz items', () => {
  const course = parseCourse(`# MODUL 1 — TEST\n## Lekce 1.1 — Úvod\nText\n### Praktická laboratoř 1 — Já\nCvičení\n### Profesní aplikace 1 — Klientka\nPraxe\n## Test modulu 1\n1. Otázka`);
  const kinds = course.modules[0].items.map(item => item.kind);
  assert.deepEqual(kinds, ['lesson', 'self-practice', 'client-practice', 'quiz']);
});
