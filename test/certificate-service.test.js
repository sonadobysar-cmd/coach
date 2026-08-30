import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import {
  certificateVariant,
  sanitizeCertificateMemberName,
  summarizeCourseEvidence,
} from '../src/certificates.js';
import { buildCertificateStatus } from '../src/certificate-service.js';
import { renderCertificatePdf, wrapCertificateTitle } from '../src/certificate-renderer.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [communication, selfTrust] = await loadCourses([
  join(ROOT, 'data', 'course-komunikace-v-praxi.md'),
  join(ROOT, 'data', 'course-pevna-v-sobe.md'),
]);
attachCourseMastery(communication);
attachCourseMastery(selfTrust);

function completeInput(course) {
  const mastery = course.mastery;
  return {
    completedItemIds: course.modules.flatMap(module => module.items.map(item => item.id)),
    mastery: {
      days: mastery.journey.map(day => day.id),
      templates: Object.fromEntries(mastery.professionalPack.map(template => [
        template.id,
        Object.fromEntries(template.fields.map(field => [field.id, 'Konkrétní doložený výstup'])),
      ])),
      assessment: {
        final: Object.fromEntries(mastery.assessment.dimensions.map(dimension => [
          dimension.id, { score: '3', evidence: 'Konkrétní důkaz z praxe' },
        ])),
      },
    },
  };
}

test('serverový souhrn vyžaduje všechny části, portfolio i měření', () => {
  const complete = summarizeCourseEvidence(communication, completeInput(communication));
  assert.equal(complete.summary.portfolioComplete, true);
  assert.equal(complete.completedItemIds.length, communication.itemCount);
  const incomplete = summarizeCourseEvidence(communication, { completedItemIds: complete.completedItemIds, mastery: {} });
  assert.equal(incomplete.summary.portfolioComplete, false);
  assert.equal(incomplete.evidenceHash.length, 64);
});

test('certifikát se nevydá bez důvěryhodné závěrečné AI zkoušky', () => {
  const evidence = summarizeCourseEvidence(communication, completeInput(communication));
  const fallback = buildCertificateStatus(communication, {
    evidence: { completedItemIds: evidence.completedItemIds, portfolioSummary: evidence.summary },
    examAttempt: { allProven: true, qualityPassed: true, provider: 'deterministic-training-fallback' },
  });
  assert.equal(fallback.eligible, false);
  const trusted = buildCertificateStatus(communication, {
    evidence: { completedItemIds: evidence.completedItemIds, portfolioSummary: evidence.summary },
    examAttempt: { allProven: true, qualityPassed: true, provider: 'openai/gpt-5.6' },
  });
  assert.equal(trusted.eligible, true);
});

test('osobní program používá tmavé osvědčení a profesní kurz světlý certifikát', () => {
  assert.equal(certificateVariant(selfTrust), 'dark');
  assert.equal(certificateVariant(communication), 'light');
});

test('jméno se čistí a musí být skutečný text', () => {
  assert.equal(sanitizeCertificateMemberName('  Anna   Nováková  '), 'Anna Nováková');
  assert.throws(() => sanitizeCertificateMemberName('<>'));
});

test('dlouhý název se vejde nejvýše do dvou řádků', () => {
  const lines = wrapCertificateTitle('Elitea Canva AI & Business Systems Lab — Brandový operační systém');
  assert.ok(lines.length <= 2);
  assert.match(lines.join(' '), /CANVA AI/);
});

test('renderer vytvoří jednostránkové PDF bez QR, čísla a právní doložky', async () => {
  const bytes = await renderCertificatePdf({
    memberName: 'Anna Nováková',
    courseTitle: communication.title,
    completedAt: '2026-08-30T10:00:00.000Z',
    variant: 'light',
  });
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.doesNotMatch([pdf.getTitle(), pdf.getSubject(), pdf.getKeywords()].filter(Boolean).join(' '), /QR|verification|certificateId|qualificationNote/i);
});
