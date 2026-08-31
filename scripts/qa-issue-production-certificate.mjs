import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { PDFDocument } from 'pdf-lib';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { buildCourseKnowledge } from '../src/course-knowledge.js';
import { createCourseTrainer } from '../src/training.js';
import { submitCourseQuizAttempt } from '../src/course-quiz-service.js';
import {
  certificatePdf,
  certificateStatus,
  issueCertificate,
  isTrustedCertificateProvider,
  recordCertificateExamAttempt,
  syncCertificateEvidence,
  verifyCertificateDocument,
} from '../src/certificate-service.js';
import { buildCertificateQaExamTranscript } from '../src/certificate-production-qa.js';

if (!process.env.DATABASE_URL) throw new Error('Chybí DATABASE_URL.');
if (!process.env.CERTIFICATE_SIGNING_SECRET) throw new Error('Chybí CERTIFICATE_SIGNING_SECRET.');
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) throw new Error('Chybí přístup k živému AI modelu.');

const [course] = await loadCourses([resolve('data/course-komunikace-v-praxi.md')]);
attachCourseMastery(course);
const sql = neon(process.env.DATABASE_URL);
const member = { id: randomUUID(), email: 'certificate-qa@elitea.invalid' };
const completedAt = new Date().toISOString();

await sql`INSERT INTO member_profiles (user_id, preferred_name, onboarding_complete)
  VALUES (${member.id}::uuid, 'Elitea Certificate QA', true)`;
await sql`INSERT INTO memberships (user_id, provider, plan_code, status, current_period_end)
  VALUES (${member.id}::uuid, 'manual', 'elitea-qa', 'trialing', now() + interval '2 days')`;

const items = course.modules.flatMap(module => module.items || []);
const quizItems = items.filter(item => item.kind === 'quiz');
for (const item of quizItems) {
  const answers = Object.fromEntries(item.quiz.questions.map(question => [
    question.id,
    item._quizAnswerKey[question.id].correctOptionId,
  ]));
  const attempt = await submitCourseQuizAttempt(member, course, item, answers);
  assert.equal(attempt.passed, true, `${item.id}: QA test neprošel`);
}

const mastery = {
  days: course.mastery.journey.map(day => day.id),
  templates: Object.fromEntries(course.mastery.professionalPack.map(template => [
    template.id,
    Object.fromEntries(template.fields.map(field => [
      field.id,
      `QA důkaz pro ${template.title}: konkrétní situace, rozhodnutí, provedení a výsledek.`,
    ])),
  ])),
  assessment: {
    final: Object.fromEntries(course.mastery.assessment.dimensions.map(dimension => [
      dimension.id,
      { score: 4, evidence: `QA artefakt a pozorovatelný výkon pro ${dimension.title}.` },
    ])),
  },
};
const evidence = await syncCertificateEvidence(member, course, {
  completedItemIds: items.map(item => item.id),
  mastery,
});
assert.equal(evidence.summary.quizzesComplete, true);
assert.equal(evidence.summary.portfolioComplete, true);
assert.equal(evidence.completedItemIds.length, items.length);

const finalExam = course.mastery.finalExam;
const examItem = items.find(item => item.kind !== 'quiz' && String(item.markdown || '').length > 400) || items[0];
const examMessages = buildCertificateQaExamTranscript();
const trainer = createCourseTrainer({ knowledgeRecords: buildCourseKnowledge([course]) });
const examResult = await trainer({
  messages: examMessages,
  memory: {},
  course,
  item: examItem,
  activity: 'simulation',
  phase: 'debrief',
  difficulty: 'expert',
  scenarioId: finalExam.scenarioId,
  finalExam: true,
});
assert.equal(isTrustedCertificateProvider(examResult.provider), true, `Zkouška použila nedůvěryhodný provider ${examResult.provider}`);
assert.equal(examResult.qualityGate?.pass, true, `Zkouška neprošla quality gate: ${examResult.qualityGate?.issueCodes?.join(', ')}`);
assert.equal(examResult.achievement?.allProven, true, 'Závěrečná AI zkouška nepotvrdila všechna kritéria.');
const recordedExam = await recordCertificateExamAttempt({
  member,
  course,
  item: examItem,
  scenarioId: finalExam.scenarioId,
  messages: examMessages,
  result: examResult,
});
assert.deepEqual(recordedExam, { recorded: true, passed: true });

const eligible = await certificateStatus(member, course);
assert.equal(eligible.eligible, true);
assert.equal(eligible.issued, false);
const issued = await issueCertificate(member, course, 'Elitea QA Absolventka');
assert.equal(issued.issued, true);
assert.equal(issued.authenticity?.cryptographicallySigned, true);

const pdf = await certificatePdf(member, course);
const verification = await verifyCertificateDocument(pdf);
assert.equal(verification.verified, true);

const tamperedDocument = await PDFDocument.load(pdf);
tamperedDocument.getPages()[0].drawText('modified', { x: 12, y: 12, size: 8 });
const tamperedPdf = Buffer.from(await tamperedDocument.save({ useObjectStreams: false }));
const tamperedVerification = await verifyCertificateDocument(tamperedPdf);
assert.equal(tamperedVerification.verified, false);
assert.equal(tamperedVerification.reason, 'document_modified');

const outputDirectory = resolve('output/pdf');
const reportDirectory = resolve('reports/certificate-qa');
await Promise.all([mkdir(outputDirectory, { recursive: true }), mkdir(reportDirectory, { recursive: true })]);
const pdfPath = join(outputDirectory, 'elitea-qa-certifikat.pdf');
const verifiedAt = new Date().toISOString();
const reportPath = join(reportDirectory, `${verifiedAt.replace(/[:.]/g, '-')}.json`);
await writeFile(pdfPath, pdf);
await writeFile(reportPath, `${JSON.stringify({
  verifiedAt,
  environment: 'production-database-live-model',
  course: { id: course.id, slug: course.slug, title: course.title },
  qaAccountHash: createHash('sha256').update(member.id).digest('hex'),
  completion: {
    itemCount: items.length,
    passedQuizCount: quizItems.length,
    portfolioComplete: evidence.summary.portfolioComplete,
    liveExamProvider: examResult.provider,
    liveExamQualityPassed: examResult.qualityGate.pass,
    liveExamAllProven: examResult.achievement.allProven,
  },
  issuance: {
    issued: issued.issued,
    signedPdf: issued.authenticity.cryptographicallySigned,
    externalVerification: verification.verified,
    tamperedPdfRejected: !tamperedVerification.verified,
    pdfSha256: createHash('sha256').update(pdf).digest('hex'),
  },
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  pdfPath,
  reportPath,
  course: course.slug,
  itemCount: items.length,
  passedQuizCount: quizItems.length,
  provider: examResult.provider,
  issued: issued.issued,
  verified: verification.verified,
  tamperedPdfRejected: !tamperedVerification.verified,
}));
