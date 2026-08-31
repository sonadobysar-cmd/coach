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
import { buildCertificateStatus, isTrustedCertificateProvider } from '../src/certificate-service.js';
import { renderCertificatePdf, wrapCertificateTitle } from '../src/certificate-renderer.js';
import {
  CERTIFICATE_AUTH_MARKER,
  extractCertificateVerification,
  verifyCertificateVerificationToken,
} from '../src/certificate-authenticity.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SIGNING_ENV = { CERTIFICATE_SIGNING_SECRET: 'test-only-certificate-secret-with-at-least-32-bytes' };
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
    verifiedQuizItemIds: course.modules.flatMap(module => module.items).filter(item => item.kind === 'quiz').map(item => item.id),
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
  assert.equal(complete.summary.quizzesComplete, true);
  assert.equal(complete.completedItemIds.length, communication.itemCount);
  const forged = summarizeCourseEvidence(communication, {
    ...completeInput(communication),
    verifiedQuizItemIds: [],
  });
  assert.equal(forged.summary.passedQuizzes, 0);
  assert.equal(forged.completedItemIds.length, communication.itemCount - communication.quiz.testCount);
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
  assert.equal(isTrustedCertificateProvider('qa-human-verified-live'), false);
  assert.equal(isTrustedCertificateProvider('openai/gpt-5.6-terra'), true);
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

test('renderer vytvoří jednostránkové podepsané PDF bez viditelného QR a čísla', async () => {
  const authenticity = {
    id: '11111111-1111-4111-8111-111111111111',
    courseId: communication.id,
    courseSlug: communication.slug,
    memberName: 'Anna Nováková',
    courseTitle: communication.title,
    completedAt: '2026-08-30T10:00:00.000Z',
    issuedAt: '2026-08-31T10:00:00.000Z',
    evidenceHash: 'a'.repeat(64),
  };
  const bytes = await renderCertificatePdf({
    memberName: authenticity.memberName,
    courseTitle: authenticity.courseTitle,
    completedAt: authenticity.completedAt,
    variant: 'light',
    authenticity,
    env: SIGNING_ENV,
  });
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.match(pdf.getKeywords(), new RegExp(CERTIFICATE_AUTH_MARKER));
  assert.doesNotMatch([pdf.getTitle(), pdf.getSubject()].filter(Boolean).join(' '), /QR|certificateId|qualificationNote/i);
  const extracted = await extractCertificateVerification(bytes);
  const verification = verifyCertificateVerificationToken(extracted.token, SIGNING_ENV);
  assert.equal(verification.valid, true);
  assert.equal(verification.payload.visualFingerprint, extracted.visualFingerprint);

  const modified = await PDFDocument.load(bytes);
  modified.getPages()[0].drawText('modified', { x: 12, y: 12, size: 8 });
  const modifiedBytes = Buffer.from(await modified.save({ useObjectStreams: false }));
  const modifiedExtraction = await extractCertificateVerification(modifiedBytes);
  assert.notEqual(verification.payload.visualFingerprint, modifiedExtraction.visualFingerprint);
});
