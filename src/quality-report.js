const SURFACES = new Set(['coach', 'training', 'brand']);
const ISSUES = new Set([
  'incorrect_assumption',
  'off_topic',
  'role_break',
  'too_critical',
  'unsafe',
  'other',
]);

function clean(value, limit = 120) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

export function sanitizeQualityReport(input = {}) {
  const reportId = clean(input.reportId, 80);
  const surface = SURFACES.has(input.surface) ? input.surface : null;
  const issue = ISSUES.has(input.issue) ? input.issue : null;
  if (!/^[a-zA-Z0-9-]{12,80}$/u.test(reportId) || !surface || !issue) {
    return { ok: false, error: 'Neplatné hlášení kvality.' };
  }
  return {
    ok: true,
    value: {
      reportId,
      surface,
      issue,
      provider: clean(input.provider, 100) || null,
      qualityScore: Number.isFinite(Number(input.qualityScore))
        ? Math.max(0, Math.min(100, Number(input.qualityScore)))
        : null,
      qualityPassed: typeof input.qualityPassed === 'boolean' ? input.qualityPassed : null,
      qualityRepaired: input.qualityRepaired === true,
      consultationMode: clean(input.consultationMode, 80) || null,
      courseId: clean(input.courseId, 100) || null,
      itemId: clean(input.itemId, 100) || null,
      phase: clean(input.phase, 40) || null,
      appVersion: clean(input.appVersion, 40) || null,
    },
  };
}

