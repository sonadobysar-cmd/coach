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
    const messages = buildCertificateQaExamTranscript();
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
        achievement: result.achievement || null,
        issueCodes: result.qualityGate?.issueCodes || [],
        attemptIssueCodes: result.qualityGate?.attemptIssueCodes || [],
        repairIssueCodes: result.qualityGate?.repairIssueCodes || [],
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

export function buildCertificateQaExamTranscript() {
  return [
    { role: 'user', content: 'Máme deset minut. Chceš dnes přesně pojmenovat, co zhoršilo naši spolupráci, a skončit jednou dohodou pro příští prezentaci? Budu mluvit jako tvoje kolegyně, nebudu rozhodovat za tebe. Souhlasíš s tímto cílem, rolí a tempem?' },
    { role: 'assistant', content: 'Ano. Kvůli poslední prezentaci se naše spolupráce zhoršuje. Podle mě je chyba hlavně na tvé straně.' },
    { role: 'user', content: 'Slyším tvoje přesná slova „chyba je hlavně na tvé straně“ a nechci se hned bránit. Který jeden pozorovatelný okamžik z poslední prezentace měl podle tebe největší dopad?' },
    { role: 'assistant', content: 'Mluvila jsi dvacet minut o funkcích, klient přestal reagovat a já jsem pak zachraňovala závěr. Potřebuji, abys mě příště nechala mluvit.' },
    { role: 'user', content: 'Navazuji na tvoje „dvacet minut o funkcích“ a „klient přestal reagovat“: pozorováním je délka a obsah, dopadem ztráta klientovy pozornosti. Slyším také potřebu jasně rozdělit naše role. Zachytila jsem to přesně, nebo je hlavní dopad jiný?' },
    { role: 'assistant', content: 'To je přesné. Ale nechci další rozbor, prostě mi slib, že příště nebudeš mluvit vůbec.' },
    { role: 'user', content: 'Rozumím tlaku na rychlou jistotu a slyším žádost „nebudeš mluvit vůbec“. Takový slib dát nemohu, protože bych se vzdala své odpovědnosti. Protože se mísí obvinění, dopad a konkrétní požadavek, navrhuji teď krátce použít postup pozorování–dopad–potřeba–žádost a potom si vybereš jednu ze dvou dělicích variant. Je tento postup pro tebe v pořádku, nebo chceš zpomalit?' },
    { role: 'assistant', content: 'Je to v pořádku, pokračuj. Chci ale konkrétní návrh, ne obecné fráze.' },
    { role: 'user', content: 'Na poslední prezentaci jsem dvacet minut popisovala funkce a klient přestal reagovat. Dopad byl, že jsi převzala závěr pod tlakem. Potřebuji, abychom obě znaly svou část a klient slyšel přínos dřív než funkce. Nabízím dvě varianty: buď uvedu přínos do tří minut a předám ti slovo, nebo první část vedeš ty a já odpovím jen na technické otázky. Kterou variantu volíš?' },
    { role: 'assistant', content: 'Volím první variantu. Tři minuty na přínos a potom mi předáš slovo. Když se zasekneš u funkcí, dám ti domluvené znamení.' },
    { role: 'user', content: 'Ty sis zvolila první variantu: nejvýše tři minuty na přínos, potom ti předám slovo a při odbočení použiješ domluvené znamení. Po příští prezentaci zkontrolujeme čas předání a klientovu reakci; podle toho poznáme, zda dohoda proběhla. Potvrzuješ tuto dohodu a způsob vyhodnocení?' },
    { role: 'assistant', content: 'Potvrzuji. Tohle je pro mě jasné a přijatelné.' },
    { role: 'user', content: 'Sebereflexe: konkrétním důkazem návaznosti byla moje věta „Navazuji na tvoje ‚dvacet minut o funkcích‘ a ‚klient přestal reagovat‘“. Důkazem hranice byla věta „Takový slib dát nemohu“. Zvolená metoda odpovídala tomu, že bylo potřeba oddělit pozorování, dopad, potřebu a žádost, a před použitím jsem získala souhlas. Mezera: dvě varianty jsem mohla formulovat o jednu větu stručněji. Cíl dalšího pokusu: při stejném typu odporu nabídnu hranici a dvě varianty nejvýše ve třech větách a ověřím, zda druhá strana dokáže vlastními slovy zopakovat dohodu. Profesní artefakt obsahuje kontrakt, obě citované intervence, deeskalační větu, klientkou zvolený krok, měřítko provedení a tento plán opakování.' },
  ];
}

function qaError(message, statusCode, code, details) {
  return Object.assign(new Error(message), { statusCode, code, details });
}
