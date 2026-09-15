import { createHash, timingSafeEqual } from 'node:crypto';

const RELEASE_EVALUATION_MEMBER_ID = '00000000-0000-4000-8000-000000000041';
export const RELEASE_EVALUATION_SUITES = Object.freeze({
  PROFESSIONAL_COACH: 'professional-coach',
  ACADEMY_TRAINERS: 'academy-trainers',
});

const ALLOWED_SUITES = new Set(Object.values(RELEASE_EVALUATION_SUITES));

export function releaseEvaluationMemberForRequest(request, env = process.env) {
  const expected = String(env.ELITEA_RELEASE_EVAL_SECRET || '');
  const provided = String(request?.get?.('x-elitea-release-eval-token') || '');
  const suite = String(request?.get?.('x-elitea-release-suite') || '').trim();
  if (Buffer.byteLength(expected, 'utf8') < 32 || !provided || !ALLOWED_SUITES.has(suite)) return null;
  const expectedDigest = createHash('sha256').update(expected).digest();
  const providedDigest = createHash('sha256').update(provided).digest();
  if (!timingSafeEqual(expectedDigest, providedDigest)) return null;
  return {
    id: RELEASE_EVALUATION_MEMBER_ID,
    email: 'release-evaluation@elitea.invalid',
    releaseEvaluation: true,
    releaseEvaluationSuite: suite,
    membership: { status: 'owner', plan_code: `elitea-release-evaluation-${suite}` },
  };
}

export function isReleaseEvaluationMember(member) {
  return member?.releaseEvaluation === true
    && member?.id === RELEASE_EVALUATION_MEMBER_ID
    && ALLOWED_SUITES.has(member?.releaseEvaluationSuite);
}

export function isReleaseEvaluationSuite(member, suite) {
  return isReleaseEvaluationMember(member) && member.releaseEvaluationSuite === suite;
}
