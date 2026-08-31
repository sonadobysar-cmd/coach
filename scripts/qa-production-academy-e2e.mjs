import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadCourses } from '../src/courses.js';

const token = process.env.ELITEA_QA_JWT;
if (!token) throw new Error('Chybí dočasný ELITEA_QA_JWT.');

const apiBase = String(process.env.ELITEA_QA_BASE_URL || 'https://elitea.cz').replace(/\/$/, '');
const origin = new URL(apiBase).origin;
const authHeaders = { Authorization: `Bearer ${token}`, Origin: origin };

async function api(path, options = {}, expected = [200]) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!expected.includes(response.status)) {
    throw new Error(JSON.stringify({
      path,
      status: response.status,
      code: data.code || null,
      error: data.error || text.slice(0, 180),
    }));
  }
  return { status: response.status, data, raw: text };
}

const membership = await api('/api/membership');
if (membership.data.status !== 'trialing' || membership.data.plan_code !== 'elitea-qa') {
  throw new Error('Produkční E2E smí běžet pouze nad dočasným účtem s plánem elitea-qa.');
}
const publicIndex = await api('/api/courses');
const publicCourses = publicIndex.data.items || [];
const publicQuizCount = publicCourses.reduce((sum, course) => sum + Number(course.quiz?.testCount || 0), 0);
const publicQuestionCount = publicCourses.reduce((sum, course) => sum + Number(course.quiz?.questionCount || 0), 0);

const dataDir = resolve('data');
const coursePaths = (await readdir(dataDir))
  .filter(name => /^course-.*\.md$/.test(name) && !name.includes('audio-scripts'))
  .map(name => resolve(dataDir, name));
const localCourses = await loadCourses(coursePaths);
const localCourse = localCourses.find(course => course.slug === 'prepis-svuj-vzorec');
if (!localCourse) throw new Error('QA kurz nebyl nalezen v lokálních datech.');
const localQuiz = localCourse.modules.flatMap(module => module.items).find(item => item.kind === 'quiz');
if (!localQuiz) throw new Error('QA test nebyl nalezen v lokálních datech.');

const detailResponse = await api(`/api/courses/${encodeURIComponent(localCourse.slug)}`);
const publicCourse = detailResponse.data;
const publicQuiz = publicCourse.modules.flatMap(module => module.items).find(item => item.id === localQuiz.id);
if (!publicQuiz?.quiz) throw new Error('QA test nebyl nalezen v živém kurzu.');
const serializedCourse = JSON.stringify(publicCourse);
const allItemIds = localCourse.modules.flatMap(module => module.items).map(item => item.id);
const nonQuizCount = localCourse.modules.flatMap(module => module.items).filter(item => item.kind !== 'quiz').length;

const initialStatus = await api(`/api/certificates/${encodeURIComponent(localCourse.slug)}/status`);
const forgedEvidence = await api(`/api/certificates/${encodeURIComponent(localCourse.slug)}/evidence`, {
  method: 'POST',
  body: JSON.stringify({ completedItemIds: allItemIds, mastery: { days: [], templates: {}, assessment: { final: {} } } }),
});

const correctAnswers = Object.fromEntries(localQuiz.quiz.questions.map(question => [
  question.id,
  localQuiz._quizAnswerKey[question.id].correctOptionId,
]));
const wrongAnswers = Object.fromEntries(localQuiz.quiz.questions.map(question => [
  question.id,
  question.options.find(option => option.id !== correctAnswers[question.id]).id,
]));

const failedAttempt = await api(`/api/courses/${encodeURIComponent(localCourse.slug)}/quizzes/${encodeURIComponent(localQuiz.id)}/submit`, {
  method: 'POST', body: JSON.stringify({ answers: wrongAnswers }),
}, [201]);
const passedAttempt = await api(`/api/courses/${encodeURIComponent(localCourse.slug)}/quizzes/${encodeURIComponent(localQuiz.id)}/submit`, {
  method: 'POST', body: JSON.stringify({ answers: correctAnswers }),
}, [201]);

const verifiedEvidence = await api(`/api/certificates/${encodeURIComponent(localCourse.slug)}/evidence`, {
  method: 'POST',
  body: JSON.stringify({ completedItemIds: allItemIds, mastery: { days: [], templates: {}, assessment: { final: {} } } }),
});
const prematureIssue = await api(`/api/certificates/${encodeURIComponent(localCourse.slug)}/issue`, {
  method: 'POST', body: JSON.stringify({ memberName: 'Elitea QA' }),
}, [409]);

const answerKeyLeaked = /_quizAnswerKey|correctOptionId|correctAnswer/.test(serializedCourse);
assertQa(publicCourses.length === 27, `Živá Academy má ${publicCourses.length} kurzů místo 27.`);
assertQa(publicQuizCount === 421, `Živá Academy má ${publicQuizCount} testů místo 421.`);
assertQa(publicQuestionCount === 1689, `Živá Academy má ${publicQuestionCount} otázek místo 1689.`);
assertQa(!answerKeyLeaked, 'Veřejný kurz odhalil bodovací klíč.');
assertQa(forgedEvidence.data.progress?.completedItems === nonQuizCount, 'Certifikační server přijal podvržené dokončení testu.');
assertQa(forgedEvidence.data.progress?.passedQuizzes === 0, 'Certifikační server uznal test před úspěšným pokusem.');
assertQa(failedAttempt.data.scorePercent === 0 && failedAttempt.data.passed === false, 'Neúspěšný pokus nebyl správně vyhodnocen.');
assertQa(passedAttempt.data.scorePercent === 100 && passedAttempt.data.passed === true, 'Úspěšný pokus nebyl správně vyhodnocen.');
assertQa(verifiedEvidence.data.progress?.completedItems === nonQuizCount + 1, 'Úspěšný test se nepropsal do certifikačního postupu.');
assertQa(verifiedEvidence.data.progress?.passedQuizzes === 1, 'Certifikační postup neobsahuje právě jeden ověřený test.');
assertQa(prematureIssue.data.code === 'CERTIFICATE_NOT_ELIGIBLE', 'Předčasné vydání certifikátu nebylo bezpečně zablokováno.');
assertQa(initialStatus.data.issued === false, 'Syntetický QA účet už měl vydaný certifikát.');

console.log(JSON.stringify({
  membership: { status: membership.data.status, planCode: membership.data.plan_code },
  academy: {
    courseCount: publicCourses.length,
    quizCount: publicQuizCount,
    questionCount: publicQuestionCount,
  },
  course: {
    status: detailResponse.status,
    slug: publicCourse.slug,
    itemCount: allItemIds.length,
    quizCount: localCourse.quiz.testCount,
    publicQuestionCount: publicQuiz.quiz.questionCount,
    answerKeyLeaked,
  },
  antiForgeryBeforePass: {
    completedItems: forgedEvidence.data.progress?.completedItems,
    expectedNonQuizItems: nonQuizCount,
    passedQuizzes: forgedEvidence.data.progress?.passedQuizzes,
    eligible: forgedEvidence.data.eligible,
  },
  failedAttempt: {
    status: failedAttempt.status,
    scorePercent: failedAttempt.data.scorePercent,
    passed: failedAttempt.data.passed,
    attemptNumber: failedAttempt.data.attemptNumber,
  },
  passedAttempt: {
    status: passedAttempt.status,
    scorePercent: passedAttempt.data.scorePercent,
    passed: passedAttempt.data.passed,
    attemptNumber: passedAttempt.data.attemptNumber,
    feedbackReturned: Array.isArray(passedAttempt.data.results)
      && passedAttempt.data.results.every(result => result.correctOptionId),
  },
  certificateAfterPass: {
    completedItems: verifiedEvidence.data.progress?.completedItems,
    passedQuizzes: verifiedEvidence.data.progress?.passedQuizzes,
    requiredQuizzes: verifiedEvidence.data.progress?.requiredQuizzes,
    eligible: verifiedEvidence.data.eligible,
  },
  prematureCertificateBlocked: {
    status: prematureIssue.status,
    code: prematureIssue.data.code,
  },
  initialCertificateIssued: initialStatus.data.issued,
}));

function assertQa(condition, message) {
  if (!condition) throw new Error(message);
}
