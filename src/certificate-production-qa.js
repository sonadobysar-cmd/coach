import { timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { PDFDocument } from 'pdf-lib';
import { submitCourseQuizAttempt } from './course-quiz-service.js';
import { isProfessionalLifeCoachCourse } from './coach-competencies.js';
import {
  COACH_ASSESSMENT_POLICY_VERSION,
  recordCoachDebriefAttempt,
} from './coach-competency-passport.js';
import { finalExamScenarioIds } from './final-exam.js';
import {
  certificatePdf,
  certificateStatus,
  CERTIFICATE_EXAM_POLICY_VERSION,
  issueCertificate,
  isTrustedCertificateProvider,
  recordCertificateExamAttempt,
  syncCertificateEvidence,
  verifyCertificateDocument,
} from './certificate-service.js';
import { createTrainingScenario } from './training.js';
import {
  advanceTrainingAttempt,
  issueTrainingAttempt,
  verifyTrainingAttemptStep,
} from './training-attempt-auth.js';

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
  const professionalCoachCourse = isProfessionalLifeCoachCourse(course.id);
  const finalScenarioIds = finalExamScenarioIds(course);
  const requiredFinalSessions = professionalCoachCourse
    ? Number(course.mastery?.finalExam?.requiredPassingSessions) || 2
    : 1;
  if (finalScenarioIds.length < requiredFinalSessions) {
    throw qaError('Kurz nemá dost odlišných kanonických scénářů pro závěrečnou zkoušku.', 500, 'CERTIFICATE_QA_FINAL_SCENARIOS_MISSING', {
      requiredFinalSessions,
      finalScenarioIds,
    });
  }

  const requiredScenarioIds = finalScenarioIds.slice(0, requiredFinalSessions);
  const [certificateAttemptRows, coachAttemptRows] = await Promise.all([
    sql`SELECT scenario_id, training_attempt_id, all_proven, quality_passed, provider
      FROM academy_exam_attempts
      WHERE user_id=${member.id}::uuid AND course_id=${course.id}
        AND assessment_policy_version=${CERTIFICATE_EXAM_POLICY_VERSION}`,
    professionalCoachCourse
      ? sql`SELECT scenario_id, training_attempt_id, difficulty, provider, quality_passed,
          achievement, critical_failures
        FROM academy_coach_debrief_attempts
        WHERE user_id=${member.id}::uuid AND course_id=${course.id} AND final_exam=true
          AND assessment_policy_version=${COACH_ASSESSMENT_POLICY_VERSION}`
      : Promise.resolve([]),
  ]);
  const signedFinalScenarioIds = signedQaFinalScenarioIds({
    requiredScenarioIds,
    certificateAttemptRows,
    coachAttemptRows,
    professionalCoachCourse,
  });
  const scenarioIdsToRun = requiredScenarioIds.filter(scenarioId => !signedFinalScenarioIds.has(scenarioId));
  const liveExamProviders = [];
  const newSignedAttemptIds = [];
  if (scenarioIdsToRun.length) {
    for (const scenarioId of scenarioIdsToRun) {
      const scenarioIndex = requiredScenarioIds.indexOf(scenarioId);
      const exam = await runSignedCertificateQaExam({
        member,
        course,
        answerTraining,
        scenarioId,
        scenarioIndex,
      }, env);
      assertPassingQaExam(exam.result);
      liveExamProviders.push(exam.result.provider);
      newSignedAttemptIds.push(exam.trainingAttemptId);

      const recorded = await recordCertificateExamAttempt({
        member,
        course,
        item: exam.item,
        scenarioId,
        trainingAttemptId: exam.trainingAttemptId,
        messages: exam.messages,
        result: exam.result,
      }, env, { sqlFactory: () => sql });
      if (!recorded.passed || (!recorded.recorded && !recorded.duplicate)) {
        throw qaError('Server závěrečnou zkoušku neuznal nebo bezpečně neuložil.', 500, 'CERTIFICATE_QA_EXAM_RECORD_FAILED', {
          scenarioId,
          recorded,
        });
      }

      if (professionalCoachCourse) {
        const passportRecord = await recordCoachDebriefAttempt({
          member,
          course,
          item: exam.item,
          scenarioId,
          difficulty: 'expert',
          finalExam: true,
          trainingAttemptId: exam.trainingAttemptId,
          messages: exam.messages,
          result: exam.result,
        }, env, { sqlFactory: () => sql });
        if (!passportRecord.qualityPassed || (!passportRecord.recorded && !passportRecord.duplicate)) {
          throw qaError('Profesní pas závěrečný výkon bezpečně neuložil.', 500, 'CERTIFICATE_QA_PASSPORT_RECORD_FAILED', {
            scenarioId,
            passportRecord,
          });
        }
      }
      signedFinalScenarioIds.add(scenarioId);
    }
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
      liveExamProvider: liveExamProviders.at(-1) || 'previously-verified',
      liveExamProviders,
      finalScenarioCount: requiredScenarioIds.length,
      signedAttemptCount: requiredScenarioIds.filter(scenarioId => signedFinalScenarioIds.has(scenarioId)).length,
      newSignedAttemptCount: newSignedAttemptIds.length,
      signedAttemptEvidence: requiredScenarioIds.every(scenarioId => signedFinalScenarioIds.has(scenarioId))
        && newSignedAttemptIds.every(isUuid),
      examPassed: issued.progress.examPassed,
      ...(professionalCoachCourse ? {
        coachFinalExamsPassed: issued.progress.coachPassport?.finalExamsPassed || 0,
        coachFinalExamsRequired: issued.progress.coachPassport?.requiredFinalExams || requiredFinalSessions,
      } : {}),
    },
    issuance: {
      issued: issued.issued,
      cryptographicallySigned: issued.authenticity?.cryptographicallySigned === true,
      originalVerified: verification.verified,
      tamperedPdfRejected: !tamperedVerification.verified,
    },
  };
}

/**
 * Projde stejným podepsaným hashovým řetězcem jako členské rozhraní: serverem
 * vydaný úvod, jednotlivé studentské tahy a nakonec debrief přesně nad poslední
 * ověřenou verzí přepisu. Vrací jen ID pokusu, nikdy podpisový token.
 */
export async function runSignedCertificateQaExam({
  member,
  course,
  answerTraining,
  scenarioId,
  scenarioIndex = 0,
}, env = process.env) {
  if (typeof answerTraining !== 'function') {
    throw qaError('Živá AI trenérka pro produkční QA není dostupná.', 503, 'CERTIFICATE_QA_TRAINER_UNAVAILABLE');
  }
  const scenarioEntry = (course.mastery?.scenarios || []).find(candidate => candidate.id === scenarioId);
  if (!scenarioEntry) {
    throw qaError('Kanonický závěrečný scénář nebyl nalezen.', 500, 'CERTIFICATE_QA_FINAL_SCENARIO_NOT_FOUND', { scenarioId });
  }
  const item = course.modules.flatMap(module => module.items || [])
    .find(candidate => candidate.id === scenarioEntry.itemId);
  if (!item) {
    throw qaError('Lekce svázaná se závěrečným scénářem nebyla nalezena.', 500, 'CERTIFICATE_QA_FINAL_ITEM_NOT_FOUND', {
      scenarioId,
      itemId: scenarioEntry.itemId,
    });
  }

  const scenario = createTrainingScenario(course, item, 'expert', scenarioId);
  const messages = [{ role: 'assistant', content: scenario.openingLine }];
  let attempt = issueTrainingAttempt({
    member,
    course,
    item,
    scenario,
    finalExam: true,
    messages,
  }, env);
  const studentTurns = buildCertificateQaStudentTurns({
    professionalCoachCourse: isProfessionalLifeCoachCourse(course.id),
    scenario,
    scenarioIndex,
  });
  const roleplayProviders = [];

  for (const [turnIndex, createTurn] of studentTurns.entries()) {
    const latestCounterpartText = messages.at(-1)?.content || scenario.openingLine;
    messages.push({
      role: 'user',
      content: createTurn({ latestCounterpartText, turnIndex, scenario }),
    });
    const verified = verifyTrainingAttemptStep(attempt.token, {
      member,
      course,
      item,
      messages,
      requestedPhase: 'roleplay',
      requestedScenarioId: scenarioId,
      requestedDifficulty: 'expert',
      requestedFinalExam: true,
    }, env);
    const result = await answerTraining({
      messages,
      memory: {},
      course,
      item,
      activity: 'simulation',
      phase: 'roleplay',
      difficulty: 'expert',
      scenarioId,
      finalExam: true,
    });
    if (!isTrustedCertificateProvider(result.provider) || !String(result.text || '').trim()) {
      throw qaError('Modelová klientka v živé závěrečné zkoušce nepoužila důvěryhodný model.', 409, 'CERTIFICATE_QA_ROLEPLAY_FAILED', {
        scenarioId,
        turn: turnIndex + 1,
        provider: String(result.provider || 'unknown'),
      });
    }
    roleplayProviders.push(result.provider);
    attempt = advanceTrainingAttempt(verified, result.text, env);
    messages.push({ role: 'assistant', content: result.text });
  }

  const verifiedDebrief = verifyTrainingAttemptStep(attempt.token, {
    member,
    course,
    item,
    messages,
    requestedPhase: 'debrief',
    requestedScenarioId: scenarioId,
    requestedDifficulty: 'expert',
    requestedFinalExam: true,
  }, env);
  const result = await answerTraining({
    messages,
    memory: {},
    course,
    item,
    activity: 'simulation',
    phase: 'debrief',
    difficulty: 'expert',
    scenarioId,
    finalExam: true,
  });
  const closedAttempt = advanceTrainingAttempt(verifiedDebrief, result.text, env);
  if (!closedAttempt.closed || closedAttempt.attemptId !== attempt.attemptId) {
    throw qaError('Podepsaný pokus se po vyhodnocení bezpečně neuzavřel.', 500, 'CERTIFICATE_QA_ATTEMPT_NOT_CLOSED');
  }
  return {
    item,
    scenario,
    messages,
    result,
    trainingAttemptId: closedAttempt.attemptId,
    studentTurnCount: studentTurns.length,
    roleplayProviders,
    closed: closedAttempt.closed,
  };
}

export function buildCertificateQaExamTranscript({ variant = 0 } = {}) {
  const prefix = Number(variant) === 1
    ? 'V tomto druhém případu máme dvanáct minut.'
    : 'Máme deset minut.';
  return [
    { role: 'user', content: `${prefix} Chceš dnes přesně pojmenovat, co zhoršilo naši spolupráci, a skončit jednou dohodou pro příští prezentaci? Budu mluvit jako tvoje kolegyně, nebudu rozhodovat za tebe. Souhlasíš s tímto cílem, rolí a tempem?` },
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
    { role: 'user', content: 'Než skončíme, chci ověřit vztah po napětí: přijala jsem tvé odmítnutí, opravila svůj návrh a nenechala jsem tě slíbit nic, co sis sama nezvolila. Sedí ti teď naše dohoda i způsob, jak jsme k ní došly, nebo potřebuji něco opravit?' },
    { role: 'assistant', content: 'Sedí. Oceňuji, že jsi moje odmítnutí nevzala jako odpor a návrh jsi upravila.' },
    { role: 'user', content: 'Sebereflexe: konkrétním důkazem návaznosti byla moje věta „Navazuji na tvoje ‚dvacet minut o funkcích‘ a ‚klient přestal reagovat‘“. Důkazem hranice byla věta „Takový slib dát nemohu“. Zvolená metoda odpovídala tomu, že bylo potřeba oddělit pozorování, dopad, potřebu a žádost, a před použitím jsem získala souhlas. Mezera: dvě varianty jsem mohla formulovat o jednu větu stručněji. Cíl dalšího pokusu: při stejném typu odporu nabídnu hranici a dvě varianty nejvýše ve třech větách a ověřím, zda druhá strana dokáže vlastními slovy zopakovat dohodu. Profesní artefakt obsahuje kontrakt, obě citované intervence, deeskalační větu, klientkou zvolený krok, měřítko provedení a tento plán opakování.' },
  ];
}

function buildCertificateQaStudentTurns({ professionalCoachCourse, scenario, scenarioIndex }) {
  const denseNonProfessionalTurns = [
    ({ latestCounterpartText }) => `Pro tento případ „${scenario.title}“ si pojďme nejdřív potvrdit cíl: porozumět tomu, co se stalo, a uzavřít jednu konkrétní dohodu. Já budu držet strukturu, rozhodnutí zůstane na tobě. Slyším tvá slova „${shortQuote(latestCounterpartText)}“. Co je pro tebe v tomto rozhovoru nejdůležitější?`,
    ({ latestCounterpartText }) => `Navazuji přesně na „${shortQuote(latestCounterpartText)}“. Nabízím krátce oddělit pozorování, dopad, potřebu a žádost, abychom nezaměnily domněnku za fakt. Je tento postup a tempo pro tebe v pořádku, nebo ho chceš upravit?`,
    ({ latestCounterpartText }) => `Beru tvoji poslední odpověď „${shortQuote(latestCounterpartText)}“ bez obhajování. Jaký jeden krok nebo dohoda je teď tvoje volba a podle čeho po příští situaci poznáš, že proběhla? Moje reflexe: držela jsem cíl i hranici role; příště ještě zkrátím nabídku metody a znovu ověřím její přínos.`,
  ];
  if (!professionalCoachCourse) return denseNonProfessionalTurns;

  const variantLabel = Number(scenarioIndex) === 1 ? 'druhém odlišném finálním sezení' : 'prvním finálním sezení';
  return [
    ({ latestCounterpartText }) => `V tomto ${variantLabel} k případu „${scenario.title}“ si nejdřív potvrďme zakázku. Slyším úvod „${shortQuote(latestCounterpartText)}“. Chceš dnes porozumět jednomu rozhodujícímu momentu a skončit vlastním ověřitelným krokem? Já držím proces koučování, obsah i rozhodnutí zůstávají na tobě; tempo můžeme kdykoli změnit.`,
    ({ latestCounterpartText }) => `Navazuji na tvoje přesná slova „${shortQuote(latestCounterpartText)}“ a nechci jim přidávat vlastní význam. Co je na tom pro tebe právě teď nejpodstatnější?`,
    ({ latestCounterpartText }) => `Slyším „${shortQuote(latestCounterpartText)}“. Můžu položit jednu citlivější otázku, která ověří, co je fakt a co zatím tvoje interpretace? Když nebude sedět, stáhnu ji.`,
    ({ latestCounterpartText }) => `Děkuji za odpověď „${shortQuote(latestCounterpartText)}“. Protože se tu mísí pozorování, dopad a očekávání, nabízím krátký rámec pozorování–dopad–potřeba–žádost; jeho účelem je zpřesnit volbu, ne rozhodnout za tebe. Chceš ho zkusit, upravit, nebo úplně odložit?`,
    ({ latestCounterpartText }) => `Beru tvoji reakci „${shortQuote(latestCounterpartText)}“. Pokud je to odmítnutí nebo oprava, přijímám je bez přesvědčování: navržený rámec odkládám a odpovědnost za předchozí nepřesnost je moje. Co by ti ode mě teď pomohlo, aby byl další tah znovu užitečný?`,
    ({ latestCounterpartText }) => `Ověřuji, že jsem tě po opravě zachytila přesně: „${shortQuote(latestCounterpartText)}“. Nemohu ti garantovat výsledek ani převzít tvoje rozhodnutí; mohu ti pomoci bezpečně porovnat možnosti a jejich skutečné dopady. Které dvě možnosti chceš dát vedle sebe?`,
    ({ latestCounterpartText }) => `Z toho, co říkáš — „${shortQuote(latestCounterpartText)}“ — slyším směr, ale nechci ho uzavřít za tebe. Kterou možnost si volíš jako svůj nejmenší konkrétní krok a jaké měřítko si sama stanovíš pro jeho ověření?`,
    ({ latestCounterpartText }) => `Shrnuji tvoji volbu vlastními slovy jen jako hypotézu: „${shortQuote(latestCounterpartText)}“. Prosím oprav mě, pokud něco nesedí. Potvrzuješ tento krok, jeho měřítko a chvíli, kdy výsledek společně znovu vyhodnotíme?`,
    () => 'Sebereflexe po uzavření: kontrakt byl výslovný; na slova klientky jsem navazovala doslovnou citací; položila jsem vždy jednu otázku; před rámcem jsem získala souhlas a po odmítnutí jej odložila; opravu jsem přijala bez obhajování; neslíbila jsem výsledek ani nepřevzala rozhodnutí; krok i měřítko zvolila klientka. Moje mezera je délka čtvrté intervence. Cíl dalšího pokusu: nabídku metody zkrátím na dvě věty a znovu ověřím klientčinu volbu.',
  ];
}

function assertPassingQaExam(result) {
  if (isTrustedCertificateProvider(result?.provider)
    && result?.qualityGate?.pass === true
    && result?.achievement?.allProven === true) return;
  throw qaError('Živá závěrečná AI zkouška nesplnila všechna kritéria.', 409, 'CERTIFICATE_QA_EXAM_FAILED', {
    provider: String(result?.provider || 'unknown'),
    qualityPassed: result?.qualityGate?.pass === true,
    allProven: result?.achievement?.allProven === true,
    achievement: result?.achievement || null,
    issueCodes: result?.qualityGate?.issueCodes || [],
    attemptIssueCodes: result?.qualityGate?.attemptIssueCodes || [],
    repairIssueCodes: result?.qualityGate?.repairIssueCodes || [],
  });
}

function shortQuote(value) {
  const text = String(value || '').replace(/[„“"\n\r]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  return (text || 'potřebuji tomu porozumět').slice(0, 120);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value || ''));
}

export function signedQaFinalScenarioIds({
  requiredScenarioIds,
  certificateAttemptRows,
  coachAttemptRows,
  professionalCoachCourse,
}) {
  const required = new Set(requiredScenarioIds);
  const certificateKeys = new Set((Array.isArray(certificateAttemptRows) ? certificateAttemptRows : [])
    .filter(row => required.has(String(row?.scenario_id || ''))
      && isUuid(row?.training_attempt_id)
      && row?.all_proven === true
      && row?.quality_passed === true
      && isTrustedCertificateProvider(row?.provider))
    .map(row => `${row.scenario_id}:${row.training_attempt_id}`));
  if (!professionalCoachCourse) {
    return new Set([...certificateKeys].map(key => key.slice(0, key.lastIndexOf(':'))));
  }
  const coachKeys = new Set((Array.isArray(coachAttemptRows) ? coachAttemptRows : [])
    .filter(row => required.has(String(row?.scenario_id || ''))
      && isUuid(row?.training_attempt_id)
      && row?.difficulty === 'expert'
      && row?.quality_passed === true
      && isTrustedCertificateProvider(row?.provider)
      && row?.achievement?.allProven === true
      && (!Array.isArray(row?.critical_failures) || row.critical_failures.length === 0))
    .map(row => `${row.scenario_id}:${row.training_attempt_id}`));
  return new Set([...certificateKeys]
    .filter(key => coachKeys.has(key))
    .map(key => key.slice(0, key.lastIndexOf(':'))));
}

function qaError(message, statusCode, code, details) {
  return Object.assign(new Error(message), { statusCode, code, details });
}
