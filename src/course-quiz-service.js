import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { gradeCourseQuiz } from './course-quizzes.js';

export async function submitCourseQuizAttempt(member, course, item, answers, env = process.env, dependencies = {}) {
  assertQuizStorage(member, course, item, env);
  const result = gradeCourseQuiz(item, answers);
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await ensureMember(sql, member.id);
  const [attemptRows] = await Promise.all([
    sql`SELECT count(*)::int AS count FROM academy_quiz_attempts
      WHERE user_id=${member.id}::uuid AND course_id=${course.id} AND item_id=${item.id}`,
  ]);
  const attemptNumber = Number(attemptRows?.[0]?.count || 0) + 1;
  const selectedAnswers = Object.fromEntries(item.quiz.questions.map(question => [
    question.id,
    String(answers?.[question.id] || '').slice(0, 20),
  ]));
  await sql`INSERT INTO academy_quiz_attempts (
      id, user_id, course_id, course_slug, item_id, attempt_number,
      correct_count, question_count, score_percent, pass_percent, passed,
      selected_answers, completed_at
    ) VALUES (
      ${randomUUID()}::uuid, ${member.id}::uuid, ${course.id}, ${course.slug}, ${item.id}, ${attemptNumber},
      ${result.correctCount}, ${result.questionCount}, ${result.scorePercent}, ${result.passPercent}, ${result.passed},
      ${JSON.stringify(selectedAnswers)}::jsonb, now()
    )`;
  return { ...result, attemptNumber };
}

export async function passedCourseQuizItemIds(sql, userId, courseId) {
  const rows = await sql`SELECT DISTINCT item_id FROM academy_quiz_attempts
    WHERE user_id=${userId}::uuid AND course_id=${courseId} AND passed=true`;
  return rows.map(row => String(row.item_id || '')).filter(Boolean);
}

async function ensureMember(sql, userId) {
  await sql`INSERT INTO member_profiles (user_id) VALUES (${userId}::uuid) ON CONFLICT (user_id) DO NOTHING`;
}

function assertQuizStorage(member, course, item, env) {
  if (!member?.id) throw quizServiceError('Pro odevzdání testu se přihlas.', 401, 'QUIZ_AUTH_REQUIRED');
  if (!course || item?.kind !== 'quiz' || !item?.quiz) throw quizServiceError('Test nebyl nalezen.', 404, 'QUIZ_NOT_FOUND');
  if (!env.DATABASE_URL) throw quizServiceError('Bodování testů zatím není připojené.', 503, 'QUIZ_STORAGE_UNAVAILABLE');
}

function quizServiceError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}
