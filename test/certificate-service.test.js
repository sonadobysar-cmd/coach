import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import {
  certificateVariant,
  COURSE_EVIDENCE_VALIDATION_VERSION,
  sanitizeCertificateMemberName,
  isSubstantivePortfolioAnswer,
  summarizeCourseEvidence,
} from '../src/certificates.js';
import {
  buildCertificateStatus,
  CERTIFICATE_EXAM_POLICY_VERSION,
  issueCertificate,
  isTrustedCertificateProvider,
} from '../src/certificate-service.js';
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
        Object.fromEntries(template.fields.map(field => [
          field.id,
          `Pro šablonu ${template.title} v poli ${field.label} popisuji konkrétní situaci, vlastní rozhodnutí a ověřitelný důkaz z praxe.`,
        ])),
      ])),
      assessment: {
        final: Object.fromEntries(mastery.assessment.dimensions.map(dimension => [
          dimension.id, {
            score: '3',
            evidence: `U dimenze ${dimension.title} dokládám konkrétní změnu pozorovanou v reálném nácviku.`,
          },
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
  const changedPortfolio = completeInput(communication);
  const firstTemplate = communication.mastery.professionalPack[0];
  const firstField = firstTemplate.fields[0];
  changedPortfolio.mastery.templates[firstTemplate.id][firstField.id] = 'Jiný konkrétní profesní důkaz, který popisuje odlišnou situaci a výsledek.';
  assert.notEqual(
    summarizeCourseEvidence(communication, changedPortfolio).evidenceHash,
    complete.evidenceHash,
  );
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

test('portfolio odmítne prázdné fráze, příliš krátký text a zkopírovanou odpověď', () => {
  assert.equal(isSubstantivePortfolioAnswer('hotovo'), false);
  assert.equal(isSubstantivePortfolioAnswer('Konkrétní doložený výstup'), false);
  assert.equal(isSubstantivePortfolioAnswer('V rozhovoru jsem oddělila pozorování od vlastní interpretace a ověřila je otázkou.'), true);

  const input = completeInput(communication);
  const repeated = 'Tuto obecnou odpověď jsem zkopírovala do každého pole bez vazby na zadání.';
  for (const template of communication.mastery.professionalPack) {
    for (const field of template.fields) input.mastery.templates[template.id][field.id] = repeated;
  }
  const evidence = summarizeCourseEvidence(communication, input);
  assert.equal(evidence.summary.filledPortfolioFields, 1);
  assert.equal(evidence.summary.portfolioComplete, false);
});

test('assessment skóre přijímá jen celé číslo 0–4 nebo přesný jednociferný string', () => {
  const dimensionId = communication.mastery.assessment.dimensions[0].id;
  const requiredDimensions = communication.mastery.assessment.dimensions.length;
  const invalidHashes = [];

  for (const invalidScore of ['', '   ', null]) {
    const input = completeInput(communication);
    input.mastery.assessment.final[dimensionId].score = invalidScore;
    const evidence = summarizeCourseEvidence(communication, input);
    assert.equal(evidence.summary.completedAssessmentDimensions, requiredDimensions - 1);
    assert.equal(evidence.summary.portfolioComplete, false);
    invalidHashes.push(evidence.evidenceHash);
  }
  assert.equal(new Set(invalidHashes).size, 1, 'všechny neplatné raw hodnoty se musí hashovat jako null');

  for (const validScore of [0, 1, 2, 3, 4, '0', '1', '2', '3', '4']) {
    const input = completeInput(communication);
    input.mastery.assessment.final[dimensionId].score = validScore;
    const evidence = summarizeCourseEvidence(communication, input);
    assert.equal(evidence.summary.completedAssessmentDimensions, requiredDimensions);
    assert.equal(evidence.summary.portfolioComplete, true);
  }

  const numeric = completeInput(communication);
  numeric.mastery.assessment.final[dimensionId].score = 4;
  const string = completeInput(communication);
  string.mastery.assessment.final[dimensionId].score = '4';
  assert.equal(
    summarizeCourseEvidence(communication, numeric).evidenceHash,
    summarizeCourseEvidence(communication, string).evidenceHash,
    'completion i evidence hash musí používat stejnou kanonickou validaci skóre',
  );
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

test('staré studijní a zkouškové důkazy se po zpřísnění pravidel nezapočítají', () => {
  const current = summarizeCourseEvidence(communication, completeInput(communication));
  assert.equal(current.summary.evidenceValidationVersion, COURSE_EVIDENCE_VALIDATION_VERSION);

  const staleEvidence = buildCertificateStatus(communication, {
    evidence: {
      completedItemIds: current.completedItemIds,
      portfolioSummary: current.summary,
      evidenceValidationVersion: COURSE_EVIDENCE_VALIDATION_VERSION - 1,
    },
    examAttempt: {
      allProven: true,
      qualityPassed: true,
      provider: 'openai/gpt-5.6',
      assessmentPolicyVersion: CERTIFICATE_EXAM_POLICY_VERSION,
    },
  });
  assert.equal(staleEvidence.eligible, false);
  assert.equal(staleEvidence.progress.evidenceCurrent, false);

  const staleExam = buildCertificateStatus(communication, {
    evidence: {
      completedItemIds: current.completedItemIds,
      portfolioSummary: current.summary,
      evidenceValidationVersion: COURSE_EVIDENCE_VALIDATION_VERSION,
    },
    examAttempt: {
      allProven: true,
      qualityPassed: true,
      provider: 'openai/gpt-5.6',
      assessmentPolicyVersion: CERTIFICATE_EXAM_POLICY_VERSION - 1,
    },
  });
  assert.equal(staleExam.eligible, false);
  assert.equal(staleExam.progress.examPassed, false);
});

test('vydání je atomicky svázané s přesným důkazem a souběžná změna certifikát nevydá', async () => {
  const summarized = summarizeCourseEvidence(communication, completeInput(communication));
  const evidence = {
    completed_item_ids: summarized.completedItemIds,
    portfolio_summary: summarized.summary,
    evidence_hash: summarized.evidenceHash,
    evidence_validation_version: COURSE_EVIDENCE_VALIDATION_VERSION,
    updated_at: '2026-09-15T12:00:00.000Z',
  };
  const exam = {
    all_proven: true,
    quality_passed: true,
    provider: 'openai/gpt-5.6',
    assessment_policy_version: CERTIFICATE_EXAM_POLICY_VERSION,
    completed_at: '2026-09-15T12:05:00.000Z',
  };
  const calls = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    calls.push({ query, values });
    if (/^SELECT completed_item_ids/u.test(query)) return [evidence];
    if (/^SELECT all_proven/u.test(query)) return [exam];
    if (/^SELECT member_name/u.test(query)) return [];
    if (/^WITH locked_evidence/u.test(query)) return [];
    throw new Error(`Neočekávaný testovací SQL dotaz: ${query}`);
  };

  await assert.rejects(
    issueCertificate(
      { id: '11111111-1111-4111-8111-111111111111' },
      communication,
      'Anna Nováková',
      { ...SIGNING_ENV, DATABASE_URL: 'postgres://test' },
      { sqlFactory: () => sql },
    ),
    error => error?.code === 'CERTIFICATE_ELIGIBILITY_CHANGED' && error?.statusCode === 409,
  );

  const atomicIssue = calls.find(call => /^WITH locked_evidence/u.test(call.query));
  assert.ok(atomicIssue);
  assert.match(atomicIssue.query, /FOR UPDATE/u);
  assert.match(atomicIssue.query, /INSERT INTO academy_certificates/u);
  assert.match(atomicIssue.query, /RETURNING id/u);
  assert.ok(atomicIssue.values.includes(summarized.evidenceHash));
  assert.ok(atomicIssue.values.includes(evidence.updated_at));
  assert.ok(atomicIssue.values.includes(exam.completed_at));
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
