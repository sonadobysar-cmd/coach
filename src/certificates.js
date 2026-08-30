import { createHash, randomUUID } from 'node:crypto';

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
  const validItemIds = new Set(items.map(item => item.id));
  const completedItemIds = [...new Set(Array.isArray(input.completedItemIds) ? input.completedItemIds : [])]
    .map(value => String(value || '').slice(0, 120))
    .filter(value => validItemIds.has(value));
  const mastery = course?.mastery || {};
  const progress = input.mastery && typeof input.mastery === 'object' ? input.mastery : {};
  const completedDays = new Set(Array.isArray(progress.days) ? progress.days : []);
  const requiredDays = (mastery.journey || []).map(day => day.id).filter(Boolean);
  const missingDayIds = requiredDays.filter(id => !completedDays.has(id));
  const templates = progress.templates && typeof progress.templates === 'object' ? progress.templates : {};
  const requiredFields = (mastery.professionalPack || []).flatMap(template =>
    (template.fields || []).map(field => ({ templateId: template.id, fieldId: field.id })));
  const filledPortfolioFields = requiredFields.filter(({ templateId, fieldId }) =>
    String(templates?.[templateId]?.[fieldId] || '').trim().length >= 3).length;
  const assessment = progress.assessment?.final && typeof progress.assessment.final === 'object'
    ? progress.assessment.final
    : {};
  const dimensions = mastery.assessment?.dimensions || [];
  const completedAssessmentDimensions = dimensions.filter(dimension => {
    const record = assessment[dimension.id] || {};
    return Number.isInteger(Number(record.score))
      && Number(record.score) >= 0
      && Number(record.score) <= 4
      && String(record.evidence || '').trim().length >= 3;
  }).length;
  const portfolioComplete = missingDayIds.length === 0
    && filledPortfolioFields === requiredFields.length
    && completedAssessmentDimensions === dimensions.length;
  const summary = {
    completedDays: requiredDays.length - missingDayIds.length,
    requiredDays: requiredDays.length,
    filledPortfolioFields,
    requiredPortfolioFields: requiredFields.length,
    completedAssessmentDimensions,
    requiredAssessmentDimensions: dimensions.length,
    portfolioComplete,
  };
  const evidenceHash = createHash('sha256').update(JSON.stringify({
    courseId: course?.id,
    completedItemIds: [...completedItemIds].sort(),
    summary,
  })).digest('hex');
  return { completedItemIds, missingDayIds, summary, evidenceHash };
}

function validDate(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) throw new Error('Pro certifikát chybí platné datum dokončení.');
  return date.toISOString();
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
