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
  const safeName = clean(memberName, 120);
  if (safeName.length < 2) throw new Error('Pro certifikát chybí jméno absolventky.');
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
    templateVersion: 'pending-owner-design-v1',
    verificationHash: createHash('sha256').update(`${id}|${course.id}|${safeName}|${completion}`).digest('hex'),
  };
}

function validDate(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) throw new Error('Pro certifikát chybí platné datum dokončení.');
  return date.toISOString();
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
