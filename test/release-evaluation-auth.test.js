import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isReleaseEvaluationMember,
  releaseEvaluationMemberForRequest,
} from '../src/release-evaluation-auth.js';

const secret = 'release-evaluation-secret-with-at-least-32-bytes';
const request = (value, suite = 'professional-coach') => ({
  get: name => name === 'x-elitea-release-eval-token' ? value : name === 'x-elitea-release-suite' ? suite : '',
});

test('release eval vyžaduje samostatné tajemství nejméně 32 bytů a přesnou shodu', () => {
  assert.equal(releaseEvaluationMemberForRequest(request(secret), {}), null);
  assert.equal(releaseEvaluationMemberForRequest(request(secret), { ELITEA_RELEASE_EVAL_SECRET: 'short' }), null);
  assert.equal(releaseEvaluationMemberForRequest(request('wrong'), { ELITEA_RELEASE_EVAL_SECRET: secret }), null);
  const member = releaseEvaluationMemberForRequest(request(secret), { ELITEA_RELEASE_EVAL_SECRET: secret });
  assert.equal(isReleaseEvaluationMember(member), true);
  assert.equal(member.membership.plan_code, 'elitea-release-evaluation-professional-coach');
  assert.equal(member.releaseEvaluationSuite, 'professional-coach');
  const academy = releaseEvaluationMemberForRequest(request(secret, 'academy-trainers'), { ELITEA_RELEASE_EVAL_SECRET: secret });
  assert.equal(isReleaseEvaluationMember(academy), true);
  assert.equal(academy.releaseEvaluationSuite, 'academy-trainers');
  assert.equal(releaseEvaluationMemberForRequest(request(secret, 'unknown-suite'), { ELITEA_RELEASE_EVAL_SECRET: secret }), null);
});

test('běžný nebo podvržený člen nikdy nezíská izolační příznak', () => {
  assert.equal(isReleaseEvaluationMember({ id: '00000000-0000-4000-8000-000000000041' }), false);
  assert.equal(isReleaseEvaluationMember({ id: 'other', releaseEvaluation: true, releaseEvaluationSuite: 'professional-coach' }), false);
});
