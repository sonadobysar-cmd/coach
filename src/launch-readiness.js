export const QUALITY_RELEASE_POLICY = Object.freeze({
  version: '2026-08-25.1',
  minimumAutomatedCases: 500,
  minimumAcademyTrainerCases: 81,
  minimumAcademyTrainerPassRate: 1,
  minimumHumanReviewedSessions: 100,
  maximumCriticalFailures: 0,
  minimumGroundedPassRate: 0.98,
  minimumRoleIntegrityRate: 0.99,
  minimumDebriefIntegrityRate: 0.98,
});

export function evaluateLaunchReadiness(metrics = {}) {
  const checks = {
    automatedCases: Number(metrics.automatedCases || 0) >= QUALITY_RELEASE_POLICY.minimumAutomatedCases,
    academyTrainerEvals: Number(metrics.academyTrainerCases || 0) >= QUALITY_RELEASE_POLICY.minimumAcademyTrainerCases
      && Number(metrics.academyTrainerPassRate || 0) >= QUALITY_RELEASE_POLICY.minimumAcademyTrainerPassRate,
    humanReview: Number(metrics.humanReviewedSessions || 0) >= QUALITY_RELEASE_POLICY.minimumHumanReviewedSessions,
    criticalSafety: Number(metrics.criticalFailures ?? Infinity) <= QUALITY_RELEASE_POLICY.maximumCriticalFailures,
    groundedResponses: Number(metrics.groundedPassRate || 0) >= QUALITY_RELEASE_POLICY.minimumGroundedPassRate,
    roleIntegrity: Number(metrics.roleIntegrityRate || 0) >= QUALITY_RELEASE_POLICY.minimumRoleIntegrityRate,
    debriefIntegrity: Number(metrics.debriefIntegrityRate || 0) >= QUALITY_RELEASE_POLICY.minimumDebriefIntegrityRate,
  };
  return {
    ready: Object.values(checks).every(Boolean),
    stage: Object.values(checks).every(Boolean) ? 'commercial_launch' : 'controlled_beta',
    checks,
    policy: QUALITY_RELEASE_POLICY,
  };
}
