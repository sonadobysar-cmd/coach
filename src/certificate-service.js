import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import {
  certificateEligibility,
  certificateVariant,
  COURSE_EVIDENCE_VALIDATION_VERSION,
  sanitizeCertificateMemberName,
  summarizeCourseEvidence,
} from './certificates.js';
import { renderCertificatePdf } from './certificate-renderer.js';
import { passedCourseQuizItemIds } from './course-quiz-service.js';
import {
  certificateSigningConfigured,
  extractCertificateVerification,
  signedRecordMatchesDatabase,
  verifyCertificateVerificationToken,
} from './certificate-authenticity.js';
import { isProfessionalLifeCoachCourse } from './coach-competencies.js';
import {
  buildCoachCompetencyPassport,
  COACH_ASSESSMENT_POLICY_VERSION,
} from './coach-competency-passport.js';
import { isFinalExamScenario } from './final-exam.js';

export const CERTIFICATE_EXAM_POLICY_VERSION = 2;

export async function syncCertificateEvidence(member, course, input, env = process.env, dependencies = {}) {
  assertStorage(member, env);
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await ensureMember(sql, member.id);
  const verifiedQuizItemIds = await passedCourseQuizItemIds(sql, member.id, course.id);
  const evidence = summarizeCourseEvidence(course, { ...input, verifiedQuizItemIds });
  await sql`INSERT INTO academy_course_evidence (
      user_id, course_id, course_slug, completed_item_ids, portfolio_summary, evidence_hash,
      evidence_validation_version, updated_at
    ) VALUES (
      ${member.id}::uuid, ${course.id}, ${course.slug}, ${JSON.stringify(evidence.completedItemIds)}::jsonb,
      ${JSON.stringify(evidence.summary)}::jsonb, ${evidence.evidenceHash}, ${COURSE_EVIDENCE_VALIDATION_VERSION}, now()
    ) ON CONFLICT (user_id, course_id) DO UPDATE SET
      course_slug=excluded.course_slug,
      completed_item_ids=excluded.completed_item_ids,
      portfolio_summary=excluded.portfolio_summary,
      evidence_hash=excluded.evidence_hash,
      evidence_validation_version=excluded.evidence_validation_version,
      updated_at=now()`;
  return evidence;
}

export async function recordCertificateExamAttempt({ member, course, item, scenarioId, trainingAttemptId = null, messages, result }, env = process.env, dependencies = {}) {
  if (!member?.id || !env.DATABASE_URL) return { recorded: false, reason: 'storage_unavailable' };
  const expectedScenarioId = String(scenarioId || '').trim();
  if (!isFinalExamScenario(course, expectedScenarioId)) return { recorded: false, reason: 'not_final_exam' };
  const provider = String(result?.provider || '').slice(0, 160);
  const trustedProvider = isTrustedCertificateProvider(provider);
  const qualityPassed = result?.qualityGate?.pass === true;
  const allProven = result?.achievement?.allProven === true;
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await ensureMember(sql, member.id);
  const transcriptHash = createHash('sha256').update(JSON.stringify((messages || []).map(message => ({
    role: message?.role,
    content: String(message?.content || ''),
  })))).digest('hex');
  const id = randomUUID();
  const safeTrainingAttemptId = normalizeUuid(trainingAttemptId);
  const inserted = await sql`INSERT INTO academy_exam_attempts (
      id, user_id, course_id, course_slug, item_id, scenario_id, all_proven,
      quality_passed, provider, assessment_policy_version, transcript_hash, training_attempt_id, completed_at
    ) VALUES (
      ${id}::uuid, ${member.id}::uuid, ${course.id}, ${course.slug}, ${item.id}, ${expectedScenarioId},
      ${allProven && trustedProvider}, ${qualityPassed && trustedProvider}, ${provider || 'unknown'},
      ${CERTIFICATE_EXAM_POLICY_VERSION}, ${transcriptHash},
      ${safeTrainingAttemptId}::uuid, now()
    ) ON CONFLICT DO NOTHING RETURNING id`;
  return {
    recorded: inserted.length > 0,
    duplicate: inserted.length === 0,
    passed: allProven && qualityPassed && trustedProvider,
  };
}

export async function certificateStatus(member, course, env = process.env, dependencies = {}) {
  assertStorage(member, env);
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const state = await loadCertificateState(sql, member, course);
  const status = buildCertificateStatus(course, state);
  return decorateCertificateStatus(status, env);
}

async function loadCertificateState(sql, member, course) {
  const [evidenceRows, examRows, certificateRows, coachDebriefRows] = await Promise.all([
    sql`SELECT completed_item_ids, portfolio_summary, evidence_hash, evidence_validation_version, updated_at
      FROM academy_course_evidence WHERE user_id=${member.id}::uuid AND course_id=${course.id} LIMIT 1`,
    sql`SELECT all_proven, quality_passed, provider, assessment_policy_version, completed_at
      FROM academy_exam_attempts
      WHERE user_id=${member.id}::uuid AND course_id=${course.id}
      ORDER BY (assessment_policy_version=${CERTIFICATE_EXAM_POLICY_VERSION}
        AND all_proven AND quality_passed
        AND provider ~* '^(openai|anthropic|google|xai|mistral|meta)/'
        AND provider !~* '(fallback|demo|local|deterministic)') DESC,
        completed_at DESC LIMIT 1`,
    sql`SELECT member_name, course_title, completed_at, issued_at, template_variant, revoked_at
      FROM academy_certificates WHERE user_id=${member.id}::uuid AND course_id=${course.id} LIMIT 1`,
    isProfessionalLifeCoachCourse(course?.id)
      ? sql`SELECT id, item_id, scenario_id, scenario_family_id, challenge_id,
          remediation_failure_codes, difficulty, final_exam, provider, quality_passed,
          assessment_policy_version, achievement, critical_failures, transcript_hash, training_attempt_id, completed_at
        FROM academy_coach_debrief_attempts
        WHERE user_id=${member.id}::uuid AND course_id=${course.id}
        ORDER BY completed_at ASC`
      : Promise.resolve([]),
  ]);
  return {
    evidence: evidenceRows[0],
    examAttempt: examRows[0],
    certificate: certificateRows[0],
    coachDebriefAttempts: coachDebriefRows,
  };
}

function decorateCertificateStatus(status, env) {
  return {
    ...status,
    authenticity: status.issued ? {
      cryptographicallySigned: certificateSigningConfigured(env),
    } : null,
  };
}

export function buildCertificateStatus(course, {
  evidence,
  examAttempt,
  certificate,
  coachDebriefAttempts = [],
  coachPassport,
} = {}) {
  const portfolioSummary = evidence?.portfolio_summary || evidence?.portfolioSummary || {};
  const completedItemIds = evidence?.completed_item_ids || evidence?.completedItemIds || [];
  const evidenceValidationVersion = explicitVersion(
    evidence?.evidence_validation_version,
    evidence?.evidenceValidationVersion,
    portfolioSummary.evidenceValidationVersion,
    COURSE_EVIDENCE_VALIDATION_VERSION,
  );
  const storedMasteryVersion = explicitVersion(
    portfolioSummary.masteryVersion,
    Number(course?.mastery?.version || 0),
  );
  const evidenceCurrent = evidenceValidationVersion === COURSE_EVIDENCE_VALIDATION_VERSION
    && storedMasteryVersion === Number(course?.mastery?.version || 0);
  const examPolicyVersion = explicitVersion(
    examAttempt?.assessment_policy_version,
    examAttempt?.assessmentPolicyVersion,
    CERTIFICATE_EXAM_POLICY_VERSION,
  );
  const finalExamAchievement = {
    allProven: examAttempt?.all_proven === true || examAttempt?.allProven === true,
  };
  const eligibility = certificateEligibility(course, {
    completedItemIds,
    portfolioComplete: evidenceCurrent && portfolioSummary.portfolioComplete === true,
    finalExamAchievement,
  });
  const trustedExam = examPolicyVersion === CERTIFICATE_EXAM_POLICY_VERSION
    && finalExamAchievement.allProven
    && (examAttempt?.quality_passed === true || examAttempt?.qualityPassed === true)
    && isTrustedCertificateProvider(examAttempt?.provider);
  const professionalCoachCourse = isProfessionalLifeCoachCourse(course?.id);
  const professionalPassport = professionalCoachCourse
    ? (coachPassport || buildCoachCompetencyPassport(coachDebriefAttempts))
    : null;
  const eligible = eligibility.eligible && trustedExam && (!professionalCoachCourse || professionalPassport.eligible);
  const reasons = [];
  if (!evidenceCurrent) reasons.push('Obnov studijní důkazy podle aktuální verze kurzu; starší záznam se do certifikace nezapočítává.');
  if (eligibility.missingItemIds.length) reasons.push(`Dokonči ještě ${eligibility.missingItemIds.length} částí kurzu.`);
  if (!portfolioSummary.portfolioComplete) {
    reasons.push('Doplň samostatně vyžadovaný profesní balíček, 30denní cestu a závěrečné sebehodnocení. Finální sezení tento krok nenahrazují.');
  }
  if (!trustedExam && !professionalCoachCourse) reasons.push('Absolvuj závěrečnou AI zkoušku a prokaž všechna kritéria.');
  if (professionalPassport && !professionalPassport.eligible) {
    reasons.push(...professionalPassport.reasons);
  }
  if (professionalCoachCourse && !trustedExam && professionalPassport?.progress?.finalExamPassed) {
    reasons.push('Obnov serverový záznam závěrečné zkoušky; profesní pas má dva úspěšné výkony, ale certifikační záznam chybí.');
  }
  const activeCertificate = certificate && !certificate.revoked_at && !certificate.revokedAt ? certificate : null;
  return {
    eligible,
    issued: Boolean(activeCertificate),
    reasons,
    progress: {
      completedItems: completedItemIds.length,
      requiredItems: (course?.modules || []).flatMap(module => module.items || []).length,
      ...portfolioSummary,
      evidenceCurrent,
      evidenceValidationVersion,
      masteryVersion: storedMasteryVersion,
      examPolicyVersion,
      examPassed: trustedExam,
      ...(professionalPassport ? { coachPassport: professionalPassport.progress } : {}),
    },
    ...(professionalPassport ? { coachPassport: professionalPassport } : {}),
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
  assertStorage(member, env);
  if (!certificateSigningConfigured(env)) {
    throw certificateError('Kryptografické podepisování certifikátů zatím není připojené.', 503, 'CERTIFICATE_SIGNING_UNAVAILABLE');
  }
  const safeName = sanitizeCertificateMemberName(memberName);
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const state = await loadCertificateState(sql, member, course);
  const status = decorateCertificateStatus(buildCertificateStatus(course, state), env);
  if (status.issued) return status;
  if (!status.eligible) throw certificateError('Podmínky certifikátu zatím nejsou splněné.', 409, 'CERTIFICATE_NOT_ELIGIBLE');

  const evidence = state.evidence;
  const exam = state.examAttempt;
  if (!evidence?.evidence_hash || !evidence?.updated_at || !exam?.completed_at) {
    throw certificateError('Ověřené podklady certifikátu nejsou úplné.', 409, 'CERTIFICATE_EVIDENCE_MISSING');
  }
  const professionalCoachCourse = isProfessionalLifeCoachCourse(course?.id);
  const expectedCoachAttemptCount = state.coachDebriefAttempts.length;

  // Vydání je jediný atomický INSERT ... SELECT. Zamknutý řádek důkazů musí
  // stále přesně odpovídat stavu, který server právě vyhodnotil jako způsobilý;
  // souběžné uložení neúplného postupu proto buď proběhne před tímto příkazem
  // a hash/timestamp nesedí, nebo až po legitimním okamžiku vydání. U profesního
  // kurzu navíc hlídáme, že se mezi výpočtem pasu a vydáním nezměnil počet jeho
  // append-only debriefů.
  const inserted = await sql`WITH locked_evidence AS (
      SELECT evidence_hash
      FROM academy_course_evidence
      WHERE user_id=${member.id}::uuid AND course_id=${course.id}
        AND evidence_hash=${evidence.evidence_hash}
        AND updated_at=${evidence.updated_at}::timestamptz
        AND evidence_validation_version=${COURSE_EVIDENCE_VALIDATION_VERSION}
      FOR UPDATE
    ), eligible_exam AS (
      SELECT completed_at
      FROM academy_exam_attempts
      WHERE user_id=${member.id}::uuid AND course_id=${course.id}
        AND completed_at=${exam.completed_at}::timestamptz
        AND all_proven=true AND quality_passed=true
        AND assessment_policy_version=${CERTIFICATE_EXAM_POLICY_VERSION}
        AND provider ~* '^(openai|anthropic|google|xai|mistral|meta)/'
        AND provider !~* '(fallback|demo|local|deterministic)'
      LIMIT 1
    ), coach_attempt_snapshot AS (
      SELECT count(*)::integer AS attempt_count
      FROM academy_coach_debrief_attempts
      WHERE user_id=${member.id}::uuid AND course_id=${course.id}
    )
    INSERT INTO academy_certificates (
      id, user_id, course_id, course_slug, member_name, course_title, completed_at,
      template_variant, evidence_hash
    )
    SELECT ${randomUUID()}::uuid, ${member.id}::uuid, ${course.id}, ${course.slug}, ${safeName}, ${course.title},
      eligible_exam.completed_at, ${certificateVariant(course)}, locked_evidence.evidence_hash
    FROM locked_evidence
    CROSS JOIN eligible_exam
    CROSS JOIN coach_attempt_snapshot
    WHERE ${professionalCoachCourse}=false OR coach_attempt_snapshot.attempt_count=${expectedCoachAttemptCount}
    ON CONFLICT (user_id, course_id) DO NOTHING
    RETURNING id`;

  const refreshed = await certificateStatus(member, course, env, dependencies);
  if (refreshed.issued) return refreshed;
  if (inserted.length === 0) {
    throw certificateError(
      'Studijní postup se během vydávání změnil. Zkontroluj aktuální splnění a certifikát vydej znovu.',
      409,
      'CERTIFICATE_ELIGIBILITY_CHANGED',
    );
  }
  throw certificateError('Certifikát se nepodařilo bezpečně načíst po vydání.', 503, 'CERTIFICATE_ISSUE_INCOMPLETE');
}

export async function certificatePdf(member, course, env = process.env, dependencies = {}) {
  assertStorage(member, env);
  if (!certificateSigningConfigured(env)) {
    throw certificateError('Kryptografické podepisování certifikátů zatím není připojené.', 503, 'CERTIFICATE_SIGNING_UNAVAILABLE');
  }
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const [record] = await sql`SELECT id, course_id, course_slug, member_name, course_title, completed_at,
      issued_at, template_variant, evidence_hash, revoked_at
    FROM academy_certificates WHERE user_id=${member.id}::uuid AND course_id=${course.id} LIMIT 1`;
  if (!record || record.revoked_at) throw certificateError('Certifikát zatím nebyl vydán.', 404, 'CERTIFICATE_NOT_FOUND');
  return renderCertificatePdf({
    memberName: record.member_name,
    courseTitle: record.course_title,
    completedAt: record.completed_at,
    variant: record.template_variant,
    authenticity: record,
    env,
  });
}

export async function verifyCertificateDocument(pdfBytes, env = process.env, dependencies = {}) {
  if (!certificateSigningConfigured(env)) {
    throw certificateError('Ověření certifikátů zatím není připojené.', 503, 'CERTIFICATE_SIGNING_UNAVAILABLE');
  }
  if (!env.DATABASE_URL) throw certificateError('Ověření certifikátů zatím není připojené.', 503, 'CERTIFICATE_STORAGE_UNAVAILABLE');
  const bytes = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes || []);
  if (bytes.length < 100 || bytes.subarray(0, 4).toString() !== '%PDF') {
    throw certificateError('Nahraj platný PDF certifikát Elitea.', 400, 'CERTIFICATE_PDF_INVALID');
  }

  let extracted;
  try { extracted = await extractCertificateVerification(bytes); }
  catch (error) {
    if (error?.code) throw error;
    throw certificateError('PDF se nepodařilo bezpečně přečíst.', 400, 'CERTIFICATE_PDF_INVALID');
  }
  const signature = verifyCertificateVerificationToken(extracted.token, env);
  if (!signature.valid) return invalidVerification('signature_invalid');
  if (signature.payload.visualFingerprint !== extracted.visualFingerprint) {
    return invalidVerification('document_modified');
  }

  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  const [record] = await sql`SELECT id, course_id, course_slug, member_name, course_title, completed_at,
      issued_at, evidence_hash, revoked_at
    FROM academy_certificates WHERE id=${signature.payload.certificateId}::uuid LIMIT 1`;
  if (!record) return invalidVerification('record_not_found');
  if (record.revoked_at) return invalidVerification('certificate_revoked');
  if (!signedRecordMatchesDatabase(signature.payload, record)) return invalidVerification('record_mismatch');
  return {
    verified: true,
    status: 'valid',
    certificate: {
      memberName: record.member_name,
      courseTitle: record.course_title,
      completedAt: record.completed_at,
      issuedAt: record.issued_at,
      issuer: 'Elitea Academy',
    },
  };
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

function invalidVerification(reason) {
  return { verified: false, status: 'invalid', reason };
}

export function isTrustedCertificateProvider(value) {
  const provider = String(value || '').trim();
  return /^(openai|anthropic|google|xai|mistral|meta)\/[a-z0-9._-]+$/i.test(provider)
    && !/(fallback|demo|local|deterministic)/i.test(provider);
}

function explicitVersion(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : -1;
  }
  return -1;
}

function normalizeUuid(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(text)
    ? text
    : null;
}
