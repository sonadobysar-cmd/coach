import { createHash, randomUUID } from 'node:crypto';

export const COURSE_EVIDENCE_VALIDATION_VERSION = 2;

export function certificateEligibility(course, evidence = {}) {
  const items = (course?.modules || []).flatMap(module => module.items || []);
  const completed = new Set(Array.isArray(evidence.completedItemIds) ? evidence.completedItemIds : []);
  const missingItemIds = items.map(item => item.id).filter(id => !completed.has(id));
  const examPassed = evidence.finalExamAchievement?.allProven === true;
  const portfolioComplete = evidence.portfolioComplete === true;
  return {
    eligible: Boolean(course?.certificate) && missingItemIds.length === 0 && examPassed && portfolioComplete,
    missingItemIds,
    examPassed,
    portfolioComplete,
  };
}

export function createCertificatePayload({ course, memberName, completedAt, evidence, certificateId } = {}) {
  const eligibility = certificateEligibility(course, evidence);
  if (!eligibility.eligible) throw Object.assign(new Error('Podmínky certifikátu zatím nejsou splněné.'), { code: 'CERTIFICATE_NOT_ELIGIBLE' });
  const safeName = sanitizeCertificateMemberName(memberName);
  const completion = validDate(completedAt);
  const id = clean(certificateId, 80) || `ELITEA-${completion.slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    id,
    memberName: safeName,
    courseId: course.id,
    courseTitle: course.title,
    certificateTitle: course.certificate.title,
    completedAt: completion,
    issuedAt: new Date().toISOString(),
    issuedBy: course.certificate.issuedBy || 'Nia Dobyšar',
    qualificationNote: course.certificate.note,
    templateVersion: 'canva-achievement-v1',
    verificationHash: createHash('sha256').update(`${id}|${course.id}|${safeName}|${completion}`).digest('hex'),
  };
}

export function sanitizeCertificateMemberName(value) {
  const name = clean(value, 120)
    .replace(/[<>\[\]{}|\\]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (name.length < 2) throw Object.assign(new Error('Napiš celé jméno, které má být na certifikátu.'), { statusCode: 400 });
  if (!/[\p{L}]/u.test(name)) throw Object.assign(new Error('Jméno na certifikátu musí obsahovat písmena.'), { statusCode: 400 });
  return name;
}

export function certificateVariant(course) {
  return String(course?.certificate?.title || '').trim().toLocaleLowerCase('cs-CZ').startsWith('osvědčení') ? 'dark' : 'light';
}

export function summarizeCourseEvidence(course, input = {}) {
  const items = (course?.modules || []).flatMap(module => module.items || []);
  const quizItemIds = new Set(items.filter(item => item.kind === 'quiz').map(item => item.id));
  const verifiedQuizItemIds = new Set(Array.isArray(input.verifiedQuizItemIds) ? input.verifiedQuizItemIds : []);
  const validItemIds = new Set(items.map(item => item.id));
  const completedItemIds = [...new Set(Array.isArray(input.completedItemIds) ? input.completedItemIds : [])]
    .map(value => String(value || '').slice(0, 120))
    .filter(value => validItemIds.has(value) && (!quizItemIds.has(value) || verifiedQuizItemIds.has(value)));
  const mastery = course?.mastery || {};
  const progress = input.mastery && typeof input.mastery === 'object' ? input.mastery : {};
  const completedDays = new Set(Array.isArray(progress.days) ? progress.days : []);
  const requiredDays = (mastery.journey || []).map(day => day.id).filter(Boolean);
  const missingDayIds = requiredDays.filter(id => !completedDays.has(id));
  const templates = progress.templates && typeof progress.templates === 'object' ? progress.templates : {};
  const requiredFields = (mastery.professionalPack || []).flatMap(template =>
    (template.fields || []).map(field => ({ templateId: template.id, fieldId: field.id })));
  const acceptedPortfolioAnswers = new Set();
  const filledPortfolioFields = requiredFields.filter(({ templateId, fieldId }) => {
    const value = templates?.[templateId]?.[fieldId];
    const fingerprint = portfolioAnswerFingerprint(value);
    if (!isSubstantivePortfolioAnswer(value) || acceptedPortfolioAnswers.has(fingerprint)) return false;
    acceptedPortfolioAnswers.add(fingerprint);
    return true;
  }).length;
  const assessment = progress.assessment?.final && typeof progress.assessment.final === 'object'
    ? progress.assessment.final
    : {};
  const dimensions = mastery.assessment?.dimensions || [];
  const acceptedAssessmentEvidence = new Set();
  const completedAssessmentDimensions = dimensions.filter(dimension => {
    const record = assessment[dimension.id] || {};
    const score = normalizeAssessmentScore(record.score);
    const fingerprint = portfolioAnswerFingerprint(record.evidence);
    const valid = score !== null
      && isSubstantivePortfolioAnswer(record.evidence)
      && !acceptedAssessmentEvidence.has(fingerprint);
    if (valid) acceptedAssessmentEvidence.add(fingerprint);
    return valid;
  }).length;
  const portfolioComplete = missingDayIds.length === 0
    && filledPortfolioFields === requiredFields.length
    && completedAssessmentDimensions === dimensions.length;
  const completedDayIds = requiredDays.filter(id => completedDays.has(id));
  const portfolioAnswerHashes = requiredFields.map(({ templateId, fieldId }) => ({
    templateId,
    fieldId,
    answerHash: hashPrivateEvidence(templates?.[templateId]?.[fieldId]),
  }));
  const assessmentEvidenceHashes = dimensions.map(dimension => {
    const record = assessment[dimension.id] || {};
    return {
      dimensionId: dimension.id,
      score: normalizeAssessmentScore(record.score),
      evidenceHash: hashPrivateEvidence(record.evidence),
    };
  });
  const summary = {
    evidenceValidationVersion: COURSE_EVIDENCE_VALIDATION_VERSION,
    masteryVersion: Number(mastery.version || 0),
    passedQuizzes: [...quizItemIds].filter(id => verifiedQuizItemIds.has(id)).length,
    requiredQuizzes: quizItemIds.size,
    quizzesComplete: [...quizItemIds].every(id => verifiedQuizItemIds.has(id)),
    completedDays: requiredDays.length - missingDayIds.length,
    requiredDays: requiredDays.length,
    filledPortfolioFields,
    requiredPortfolioFields: requiredFields.length,
    completedAssessmentDimensions,
    requiredAssessmentDimensions: dimensions.length,
    portfolioComplete,
  };
  const evidenceHash = createHash('sha256').update(JSON.stringify({
    evidenceValidationVersion: COURSE_EVIDENCE_VALIDATION_VERSION,
    masteryVersion: Number(mastery.version || 0),
    courseId: course?.id,
    completedItemIds: [...completedItemIds].sort(),
    completedDayIds,
    portfolioAnswerHashes,
    assessmentEvidenceHashes,
    summary,
  })).digest('hex');
  return { completedItemIds, missingDayIds, summary, evidenceHash };
}

/**
 * Certifikační portfolio není chatové pole „něco jsem vyplnila“. Server přijme
 * jen krátký, ale konkrétní profesní záznam. Stejný text vložený do více polí se
 * započítá jen jednou; tím nezíská certifikát prázdná šablona přejmenovaná na
 * důkaz. Samotný text se do souhrnu ani hashe neukládá v otevřené podobě;
 * hash ale kryptograficky váže vydaný stav na konkrétní odevzdané důkazy.
 */
export function isSubstantivePortfolioAnswer(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length < 24) return false;
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(?:ano|ne|nevim|neviem|nic|zatim nic|zatial nic|hotovo|splneno|test|zkouska|skuska|x+|n ?a|bez komentare)$/u.test(normalized)) {
    return false;
  }
  const words = normalized.split(' ').filter(Boolean);
  const meaningfulWords = new Set(words.filter(word => word.length >= 3));
  return words.length >= 5 && meaningfulWords.size >= 4;
}

function portfolioAnswerFingerprint(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashPrivateEvidence(value) {
  const fingerprint = portfolioAnswerFingerprint(value);
  return fingerprint
    ? createHash('sha256').update(fingerprint).digest('hex')
    : null;
}

function normalizeAssessmentScore(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 4 ? value : null;
  }
  return typeof value === 'string' && /^[0-4]$/.test(value) ? Number(value) : null;
}

function validDate(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) throw new Error('Pro certifikát chybí platné datum dokončení.');
  return date.toISOString();
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
