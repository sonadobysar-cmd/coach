import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { buildCourseKnowledge } from '../src/course-knowledge.js';
import { createCourseTrainer } from '../src/training.js';
import { certificatePdf } from '../src/certificate-service.js';
import { runCertificateProductionQa } from '../src/certificate-production-qa.js';

if (!process.env.DATABASE_URL) throw new Error('Chybí DATABASE_URL.');
if (!process.env.CERTIFICATE_SIGNING_SECRET) throw new Error('Chybí CERTIFICATE_SIGNING_SECRET.');
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) throw new Error('Chybí přístup k živému AI modelu.');

const courseFile = String(process.env.ELITEA_CERTIFICATE_QA_COURSE_FILE || 'data/course-komunikace-v-praxi.md').trim();
const [course] = await loadCourses([resolve(courseFile)]);
attachCourseMastery(course);
const configuredMemberId = String(process.env.ELITEA_CERTIFICATE_QA_USER_ID || '').trim();
if (configuredMemberId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(configuredMemberId)) {
  throw new Error('ELITEA_CERTIFICATE_QA_USER_ID není platné UUID.');
}
const member = { id: configuredMemberId || randomUUID(), email: 'certificate-qa@elitea.invalid' };
const trainer = createCourseTrainer({ knowledgeRecords: buildCourseKnowledge([course]) });
const qaResult = await runCertificateProductionQa({ member, course, answerTraining: trainer });
const pdf = await certificatePdf(member, course);

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
  courseFile,
  course: qaResult.course,
  qaAccountHash: createHash('sha256').update(member.id).digest('hex'),
  completion: qaResult.completion,
  issuance: {
    ...qaResult.issuance,
    pdfSha256: createHash('sha256').update(pdf).digest('hex'),
  },
}, null, 2)}\n`);

console.log(JSON.stringify({
  ok: qaResult.ok,
  pdfPath,
  reportPath,
  course: course.slug,
  itemCount: qaResult.completion.itemCount,
  passedQuizCount: qaResult.completion.passedQuizCount,
  providers: qaResult.completion.liveExamProviders,
  signedAttemptCount: qaResult.completion.signedAttemptCount,
  issued: qaResult.issuance.issued,
  verified: qaResult.issuance.originalVerified,
  tamperedPdfRejected: qaResult.issuance.tamperedPdfRejected,
}));
