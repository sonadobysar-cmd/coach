import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourses } from '../src/courses.js';
import { createCertificatePayload, certificateEligibility } from '../src/certificates.js';
import { extractCourseVisual, sanitizeCourseVisual } from '../src/course-visuals.js';
import { debriefAchievementSummary } from '../src/training-quality.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [communication, selfTrust] = await loadCourses([
  join(ROOT, 'data', 'course-komunikace-v-praxi.md'),
  join(ROOT, 'data', 'course-pevna-v-sobe.md'),
]);

test('lekce může nést účelný animovaný výklad oddělený od textu', () => {
  const item = communication.modules.flatMap(module => module.items).find(candidate => candidate.visual);
  assert.ok(item);
  assert.equal(item.visual.type, 'cycle');
  assert.ok(item.visual.items.length >= 4);
  assert.doesNotMatch(item.markdown, /elitea-visual/);
});

test('neplatná nebo dekorativně prázdná animace se do kurzu nedostane', () => {
  assert.throws(() => sanitizeCourseVisual({ type: 'sparkles', title: 'Efekt', items: [{ label: 'A' }, { label: 'B' }] }));
  assert.throws(() => extractCourseVisual('<!-- elitea-visual: {broken} -->'));
});

test('hodnocení vytvoří strojově ověřitelný souhrn kompetencí', () => {
  const rubric = ['Přesný cíl', 'Reakce na klientku'];
  const summary = debriefAchievementSummary(`## Rozbor kompetencí\n- PROKÁZÁNO — Přesný cíl: důkaz.\n- PROKÁZÁNO — Reakce na klientku: důkaz.\n\n## Co zlepšit\nNic podstatného.`, rubric);
  assert.equal(summary.allProven, true);
  assert.equal(summary.proven, 2);
});

test('každý kurz včetně osobního programu má vlastní certifikát', () => {
  assert.ok(communication.certificate);
  assert.ok(selfTrust.certificate);
  assert.match(selfTrust.certificate.title, /Pevná v sobě/);
  assert.equal(communication.certificate.thresholdPercent, 100);
});

test('certifikát obsahuje konkrétní kurz a skutečné datum a nevznikne jen za otevření lekcí', () => {
  const itemIds = communication.modules.flatMap(module => module.items.map(item => item.id));
  const incomplete = certificateEligibility(communication, {
    completedItemIds: itemIds,
    finalExamAchievement: { allProven: false },
    portfolioComplete: true,
  });
  assert.equal(incomplete.eligible, false);

  const evidence = {
    completedItemIds: itemIds,
    finalExamAchievement: { allProven: true },
    portfolioComplete: true,
  };
  const payload = createCertificatePayload({
    course: communication,
    memberName: 'Anna Nováková',
    completedAt: '2026-08-26T10:30:00.000Z',
    evidence,
    certificateId: 'ELITEA-TEST-001',
  });
  assert.equal(payload.courseTitle, communication.title);
  assert.equal(payload.completedAt, '2026-08-26T10:30:00.000Z');
  assert.equal(payload.memberName, 'Anna Nováková');
  assert.equal(payload.templateVersion, 'canva-achievement-v1');
  assert.equal(payload.verificationHash.length, 64);
});
