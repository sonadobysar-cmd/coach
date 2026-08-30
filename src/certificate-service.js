import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import {
  certificateEligibility,
  certificateVariant,
  sanitizeCertificateMemberName,
  summarizeCourseEvidence,
} from './certificates.js';
import { renderCertificatePdf } from './certificate-renderer.js';
import { passedCourseQuizItemIds } from './course-quiz-service.js';

export async function syncCertificateEvidence(member, course, input, env = process.env, dependencies = {}) {
  assertStorage(member, env);
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await ensureMember(sql, member.id);
  const verifiedQuizItemIds = await passedCourseQuizItemIds(sql, member.id, course.id);
  const evidence = summarizeCourseEvidence(course, { ...input, verifiedQuizItemIds });
  await sql`INSERT INTO academy_course_evidence (
      user_id, course_id, course_slug, completed_item_ids, portfolio_summary, evidence_hash, updated_at
    ) VALUES (
      ${member.id}::uuid, ${course.id}, ${course.slug}, ${JSON.stringify(evidence.completedItemIds)}::jsonb,
      ${JSON.stringify(evidence.summary)}::jsonb, ${evidence.evidenceHash}, now()
    ) ON CONFLICT (user_id, course_id) DO UPDATE SET
      course_slug=excluded.course_slug,
      completed_item_ids=excluded.completed_item_ids,
      portfolio_summary=excluded.portfolio_summary,
      evidence_hash=excluded.evidence_hash,
      updated_at=now()`;
  return evidence;
}

export async function recordCertificateExamAttempt({ member, course, item, scenarioId, messages, result }, env = process.env, dependencies = {}) {
  if (!member?.id || !env.DATABASE_URL) return { recorded: false, reason: 'storage_unavailable' };
  const expectedScenarioId = String(course?.mastery?.finalExam?.scenarioId || '');
  if (!expectedScenarioId || String(scenarioId || '') !== expectedScenarioId) return { recorded: false, reason: 'not_final_exam' };
  const provider = String(result?.provider || '').slice(0, 160);
  const trustedProvider = provider && !/(fallback|demo|local|deterministic)/i.test(provider);
  const qualityPassed = result?.qualityGate?.pass === true;
  const allProven = result?.achievement?.allProven === true;
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await ensureMember(sql, member.id);
  const transcriptHash = createHash('sha256').update(JSON.stringify((messages || []).map(message => ({
    role: message?.role,
    content: String(message?.content || ''),
  })))).digest('hex');
  const id = randomUUID();
  await sql`INSERT INTO academy_exam_attempts (
      id, user_id, course_id, course_slug, item_id, scenario_id, all_proven,
      quality_passed, provider, transcript_hash, completed_at
    ) VALUES (
      ${id}::uuid, ${member.id}::uuid, ${course.id}, ${course.slug}, ${item.id}, ${expectedScenarioId},
      ${allProven && trustedProvider}, ${qualityPassed && trustedProvider}, ${provider || 'unknown'}, ${transcriptHash}, now()
    )`;
  return { recorded: true, passed: allProven && qualityPassed && trustedProvider };
}

export async function certificateStatus(member, course, env = process.env, dependencies = {}) {
  assertStorage(member, env);
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const [evidenceRows, examRows, certificateRows] = await Promise.all([
    sql`SELECT completed_item_ids, portfolio_summary, evidence_hash, updated_at
      FROM academy_course_evidence WHERE user_id=${member.id}::uuid AND course_id=${course.id} LIMIT 1`,
    sql`SELECT all_proven, quality_passed, provider, completed_at
      FROM academy_exam_attempts
      WHERE user_id=${member.id}::uuid AND course_id=${course.id}
      ORDER BY (all_proven AND quality_passed AND provider !~* '(fallback|demo|local|deterministic)') DESC,
        completed_at DESC LIMIT 1`,
    sql`SELECT member_name, course_title, completed_at, issued_at, template_variant, revoked_at
      FROM academy_certificates WHERE user_id=${member.id}::uuid AND course_id=${course.id} LIMIT 1`,
  ]);
  return buildCertificateStatus(course, {
    evidence: evidenceRows[0], examAttempt: examRows[0], certificate: certificateRows[0],
  });
}

export function buildCertificateStatus(course, { evidence, examAttempt, certificate } = {}) {
  const portfolioSummary = evidence?.portfolio_summary || evidence?.portfolioSummary || {};
  const completedItemIds = evidence?.completed_item_ids || evidence?.completedItemIds || [];
  const finalExamAchievement = {
    allProven: examAttempt?.all_proven === true || examAttempt?.allProven === true,
  };
  const eligibility = certificateEligibility(course, {
    completedItemIds,
    portfolioComplete: portfolioSummary.portfolioComplete === true,
    finalExamAchievement,
  });
  const trustedExam = finalExamAchievement.allProven
    && (examAttempt?.quality_passed === true || examAttempt?.qualityPassed === true)
    && !/(fallback|demo|local|deterministic)/i.test(String(examAttempt?.provider || ''));
  const eligible = eligibility.eligible && trustedExam;
  const reasons = [];
  if (eligibility.missingItemIds.length) reasons.push(`Dokonči ještě ${eligibility.missingItemIds.length} částí kurzu.`);
  if (!portfolioSummary.portfolioComplete) reasons.push('Doplň profesní balíček, cestu a závěrečné sebehodnocení.');
  if (!trustedExam) reasons.push('Absolvuj závěrečnou AI zkoušku a prokaž všechna kritéria.');
  const activeCertificate = certificate && !certificate.revoked_at && !certificate.revokedAt ? certificate : null;
  return {
    eligible,
    issued: Boolean(activeCertificate),
    reasons,
    progress: {
      completedItems: completedItemIds.length,
      requiredItems: (course?.modules || []).flatMap(module => module.items || []).length,
      ...portfolioSummary,
      examPassed: trustedExam,
    },
    certificate: activeCertificate ? {
      memberName: activeCertificate.member_name || activeCertificate.memberName,
      courseTitle: activeCertificate.course_title || activeCertificate.courseTitle,
      completedAt: activeCertificate.completed_at || activeCertificate.completedAt,
      issuedAt: activeCertificate.issued_at || activeCertificate.issuedAt,
      variant: activeCertificate.template_variant || activeCertificate.templateVariant,
    } : null,
  };
}

export async function issueCertificate(member, course, memberName, env = process.env, dependencies = {}) {
  const safeName = sanitizeCertificateMemberName(memberName);
  const status = await certificateStatus(member, course, env, dependencies);
  if (status.issued) return status;
  if (!status.eligible) throw certificateError('Podmínky certifikátu zatím nejsou splněné.', 409, 'CERTIFICATE_NOT_ELIGIBLE');
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const [evidence] = await sql`SELECT evidence_hash FROM academy_course_evidence
    WHERE user_id=${member.id}::uuid AND course_id=${course.id} LIMIT 1`;
  const [exam] = await sql`SELECT completed_at FROM academy_exam_attempts
    WHERE user_id=${member.id}::uuid AND course_id=${course.id}
      AND all_proven=true AND quality_passed=true
      AND provider !~* '(fallback|demo|local|deterministic)'
    ORDER BY completed_at DESC LIMIT 1`;
  if (!evidence || !exam) throw certificateError('Ověřené podklady certifikátu nejsou úplné.', 409, 'CERTIFICATE_EVIDENCE_MISSING');
  await sql`INSERT INTO academy_certificates (
      id, user_id, course_id, course_slug, member_name, course_title, completed_at,
      template_variant, evidence_hash
    ) VALUES (
      ${randomUUID()}::uuid, ${member.id}::uuid, ${course.id}, ${course.slug}, ${safeName}, ${course.title},
      ${exam.completed_at}::timestamptz, ${certificateVariant(course)}, ${evidence.evidence_hash}
    ) ON CONFLICT (user_id, course_id) DO NOTHING`;
  return certificateStatus(member, course, env, dependencies);
}

export async function certificatePdf(member, course, env = process.env, dependencies = {}) {
  assertStorage(member, env);
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const [record] = await sql`SELECT member_name, course_title, completed_at, template_variant, revoked_at
    FROM academy_certificates WHERE user_id=${member.id}::uuid AND course_id=${course.id} LIMIT 1`;
  if (!record || record.revoked_at) throw certificateError('Certifikát zatím nebyl vydán.', 404, 'CERTIFICATE_NOT_FOUND');
  return renderCertificatePdf({
    memberName: record.member_name,
    courseTitle: record.course_title,
    completedAt: record.completed_at,
    variant: record.template_variant,
  });
}

async function ensureMember(sql, userId) {
  await sql`INSERT INTO member_profiles (user_id) VALUES (${userId}::uuid) ON CONFLICT (user_id) DO NOTHING`;
}

function assertStorage(member, env) {
  if (!member?.id) throw certificateError('Pro certifikát se přihlas.', 401, 'CERTIFICATE_AUTH_REQUIRED');
  if (!env.DATABASE_URL) throw certificateError('Vydávání certifikátů zatím není připojené.', 503, 'CERTIFICATE_STORAGE_UNAVAILABLE');
}

function certificateError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}
