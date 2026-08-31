import { timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { PDFDocument } from 'pdf-lib';
import { submitCourseQuizAttempt } from './course-quiz-service.js';
import {
  certificatePdf,
  certificateStatus,
  issueCertificate,
  isTrustedCertificateProvider,
  recordCertificateExamAttempt,
  syncCertificateEvidence,
  verifyCertificateDocument,
} from './certificate-service.js';

export function authorizeCertificateQaRequest(authorization, userId, env = process.env) {
  const secret = String(env.ELITEA_CERTIFICATE_QA_SECRET || '');
  const supplied = String(authorization || '').replace(/^Bearer\s+/i, '');
  const allowedUsers = new Set(String(env.ELITEA_CERTIFICATE_QA_USER_IDS || '')
    .split(',').map(value => value.trim()).filter(Boolean));
  const suppliedBytes = Buffer.from(supplied);
  const secretBytes = Buffer.from(secret);
  if (secretBytes.length < 32 || suppliedBytes.length !== secretBytes.length) return false;
  if (!timingSafeEqual(suppliedBytes, secretBytes)) return false;
  return /^[0-9a-f-]{36}$/i.test(userId || '') && allowedUsers.has(userId);
}

export async function runCertificateProductionQa({ member, course, answerTraining }, env = process.env, dependencies = {}) {
  if (!member?.id || !course?.certificate) throw qaError('QA účet nebo kurz není platný.', 400, 'CERTIFICATE_QA_INVALID');
  if (!env.DATABASE_URL) throw qaError('QA databáze není připojená.', 503, 'CERTIFICATE_QA_STORAGE_UNAVAILABLE');
  const sql = (dependencies.sqlFactory || neon)(env.DATABASE_URL);
  await sql`INSERT INTO member_profiles (user_id, preferred_name, onboarding_complete)
    VALUES (${member.id}::uuid, 'Elitea Certificate QA', true)
    ON CONFLICT (user_id) DO UPDATE SET preferred_name=excluded.preferred_name, onboarding_complete=true, updated_at=now()`;
  await sql`INSERT INTO memberships (user_id, provider, plan_code, status, current_period_end, updated_at)
    VALUES (${member.id}::uuid, 'manual', 'elitea-qa', 'trialing', now() + interval '2 days', now())
    ON CONFLICT (user_id) DO UPDATE SET provider='manual', plan_code='elitea-qa', status='trialing',
      current_period_end=excluded.current_period_end, updated_at=now()`;

  const items = course.modules.flatMap(module => module.items || []);
  const quizItems = items.filter(item => item.kind === 'quiz');
  for (const item of quizItems) {
    const answers = Object.fromEntries(item.quiz.questions.map(question => [
      question.id,
      item._quizAnswerKey?.[question.id]?.correctOptionId,
    ]));
    const attempt = await submitCourseQuizAttempt(member, course, item, answers, env, { sqlFactory: () => sql });
    if (!attempt.passed) throw qaError(`Serverový test ${item.id} neprošel.`, 500, 'CERTIFICATE_QA_QUIZ_FAILED');
  }

  const mastery = {
    days: course.mastery.journey.map(day => day.id),
    templates: Object.fromEntries(course.mastery.professionalPack.map(template => [
      template.id,
      Object.fromEntries(template.fields.map(field => [
        field.id,
        `QA důkaz pro ${template.title}: konkrétní situace, rozhodnutí, provedení a měřitelný výsledek.`,
      ])),
    ])),
    assessment: {
      final: Object.fromEntries(course.mastery.assessment.dimensions.map(dimension => [
        dimension.id,
        { score: 4, evidence: `QA artefakt a pozorovatelný výkon pro ${dimension.title}.` },
      ])),
    },
  };
  const evidence = await syncCertificateEvidence(member, course, {
    completedItemIds: items.map(item => item.id),
    mastery,
  }, env, { sqlFactory: () => sql });
  if (!evidence.summary.quizzesComplete || !evidence.summary.portfolioComplete || evidence.completedItemIds.length !== items.length) {
    throw qaError('Server neuznal úplné studijní podklady QA účtu.', 500, 'CERTIFICATE_QA_EVIDENCE_FAILED');
  }

  let status = await certificateStatus(member, course, env, { sqlFactory: () => sql });
  let examProvider = 'previously-verified';
  if (!status.progress.examPassed) {
    const finalExam = course.mastery.finalExam;
    const examItem = items.find(item => item.kind !== 'quiz' && String(item.markdown || '').length > 400) || items[0];
    const messages = buildExamTranscript();
    const result = await answerTraining({
      messages,
      memory: {},
      course,
      item: examItem,
      activity: 'simulation',
      phase: 'debrief',
      difficulty: 'expert',
      scenarioId: finalExam.scenarioId,
      finalExam: true,
    });
    examProvider = result.provider;
    if (!isTrustedCertificateProvider(result.provider) || result.qualityGate?.pass !== true || result.achievement?.allProven !== true) {
      throw qaError('Živá závěrečná AI zkouška nesplnila všechna kritéria.', 409, 'CERTIFICATE_QA_EXAM_FAILED', {
        provider: String(result.provider || 'unknown'),
        qualityPassed: result.qualityGate?.pass === true,
        allProven: result.achievement?.allProven === true,
        issueCodes: result.qualityGate?.issueCodes || [],
      });
    }
    const recorded = await recordCertificateExamAttempt({
      member,
      course,
      item: examItem,
      scenarioId: finalExam.scenarioId,
      messages,
      result,
    }, env, { sqlFactory: () => sql });
    if (!recorded.passed) throw qaError('Server závěrečnou zkoušku neuznal.', 500, 'CERTIFICATE_QA_EXAM_RECORD_FAILED');
    status = await certificateStatus(member, course, env, { sqlFactory: () => sql });
  }
  if (!status.eligible) throw qaError('QA účet nesplnil podmínky certifikátu.', 409, 'CERTIFICATE_QA_NOT_ELIGIBLE', { reasons: status.reasons });

  const issued = await issueCertificate(member, course, 'Elitea QA Absolventka', env, { sqlFactory: () => sql });
  const pdf = await certificatePdf(member, course, env, { sqlFactory: () => sql });
  const verification = await verifyCertificateDocument(pdf, env, { sqlFactory: () => sql });
  const tamperedDocument = await PDFDocument.load(pdf);
  tamperedDocument.getPages()[0].drawText('modified', { x: 12, y: 12, size: 8 });
  const tamperedPdf = Buffer.from(await tamperedDocument.save({ useObjectStreams: false }));
  const tamperedVerification = await verifyCertificateDocument(tamperedPdf, env, { sqlFactory: () => sql });
  if (!verification.verified || tamperedVerification.verified) {
    throw qaError('Kontrola pravosti PDF nedopadla bezpečně.', 500, 'CERTIFICATE_QA_AUTHENTICITY_FAILED');
  }

  return {
    ok: true,
    course: { id: course.id, slug: course.slug, title: course.title },
    completion: {
      itemCount: items.length,
      passedQuizCount: quizItems.length,
      portfolioComplete: evidence.summary.portfolioComplete,
      liveExamProvider: examProvider,
      examPassed: issued.progress.examPassed,
    },
    issuance: {
      issued: issued.issued,
      cryptographicallySigned: issued.authenticity?.cryptographicallySigned === true,
      originalVerified: verification.verified,
      tamperedPdfRejected: !tamperedVerification.verified,
      verificationPath: issued.authenticity?.externalVerification,
    },
  };
}

function buildExamTranscript() {
  return [
    { role: 'user', content: 'Než začneme: chceš dnes nacvičit přijetí profesní příležitosti a na konci mít vlastní rozhodnutí o jedné konkrétní podmínce? Budu v roli komunikační průvodkyně, nebudu rozhodovat za tebe. Souhlasíš s tímto cílem a tempem?' },
    { role: 'assistant', content: 'Ano. Chci se rozhodnout, zda příležitost přijmu, a přestat zlehčovat své výsledky. Potřebuji si stanovit jednu podmínku.' },
    { role: 'user', content: 'Říkáš přesně: „Chci se rozhodnout, zda příležitost přijmu“ a „přestat zlehčovat své výsledky“. Navrhuji nejdřív oddělit doložené výsledky od obavy, potom zformulovat podmínku. Je tento postup pro tebe v pořádku?' },
    { role: 'assistant', content: 'Ano. Doložené je, že jsem dokončila tři projekty v termínu a klienti je převzali bez reklamace. Přesto mám pocit, že to byla náhoda.' },
    { role: 'user', content: 'Navazuji na tvoje „tři projekty v termínu“ a „bez reklamace“: to jsou pozorovatelná data. Věta „byla to náhoda“ je interpretace, ne jistota. Zkus nahlas přijmout uznání pouze větou „Děkuji, na těch třech výsledcích jsem odvedla dobrou práci.“ bez omluvy a zlehčení.' },
    { role: 'assistant', content: 'Děkuji, na těch třech výsledcích jsem odvedla dobrou práci. Je to nezvyklé, ale je to pravdivé.' },
    { role: 'user', content: 'Teď po mně chceš jistotu, že nabídku musíš přijmout. Tu ti dát nemohu a rozhodnutí za tebe nepřevezmu. Mohu ti pomoci porovnat podmínky a rizika. Jaká jedna podmínka musí platit, aby tvoje ano bylo opravdu tvoje?' },
    { role: 'assistant', content: 'Potřebuji mít písemně rozsah práce a možnost odmítnout práci navíc bez předchozí dohody.' },
    { role: 'user', content: 'Jak přesně tuto podmínku sdělíš a podle čeho poznáš, že jsi krok provedla?' },
    { role: 'assistant', content: 'Zítra do 10:00 pošlu větu: „Nabídku přijmu, pokud bude písemně potvrzený rozsah a každá práce navíc projde novou dohodou.“ Důkaz bude odeslaný e-mail a písemná odpověď.' },
    { role: 'user', content: 'Sebereflexe: silný důkaz byla moje věta „Tu jistotu ti dát nemohu a rozhodnutí za tebe nepřevezmu“, protože udržela hranici a vrátila volbu klientce. Mezera: mohla jsem dříve ověřit tělesné tempo při nezvyklém přijetí pochvaly. Při dalším cíleném pokusu po větě s uznáním vložím pauzu, zeptám se na míru tlaku 0–10 a teprve potom přejdu k podmínce. Profesní artefakt obsahuje kontrakt, citované intervence, odesílanou větu, důkaz provedení a tento plán opakování.' },
  ];
}

function qaError(message, statusCode, code, details) {
  return Object.assign(new Error(message), { statusCode, code, details });
}
