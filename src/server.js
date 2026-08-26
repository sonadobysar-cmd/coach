import express from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElitea, DEFAULT_COACH_MODEL, DEFAULT_DEEP_MODEL, resolveModelId } from './elitea.js';
import { isKnowledgeApproved, loadKnowledge } from './knowledge.js';
import { loadCoachingMethods, loadExpertSources, validateMethodSources } from './coaching.js';
import { buildCourseKnowledge, courseKnowledgeCoverage } from './course-knowledge.js';
import { emptyMemory, sanitizeMemory } from './memory.js';
import { loadWellbeingProtocols, validateProtocolSources } from './wellbeing.js';
import { loadTechniqueAtlas } from './technique-atlas.js';
import { bookingConfigured, sanitizeBookingRequest, sendBookingRequest } from './booking.js';
import { sanitizeCourseRequest, sendCourseRequest } from './course-requests.js';
import { sanitizeQualityReport } from './quality-report.js';
import { evaluateLaunchReadiness } from './launch-readiness.js';
import { marketingOperatorPublicStatus } from './marketing-operator.js';
import {
  browserOperatorConfigured,
  browserOperatorTargets,
  endBrowserOperatorSession,
  executeBrowserOperatorAction,
  getBrowserOperatorSession,
  previewBrowserOperatorAction,
  startBrowserOperatorSession,
} from './browser-operator.js';
import { courseSummary, loadCourses, publicCourseDetail } from './courses.js';
import { attachCourseMastery } from './course-mastery.js';
import { buildWorksheetLibrary } from './worksheets.js';
import { expandSelfTrustMaterials } from './self-trust-materials.js';
import { expandAdhdMaterials } from './adhd-materials.js';
import { expandBachMaterials } from './bach-materials.js';
import { expandLifeCoachMaterials } from './life-coach-materials.js';
import { expandWomensCircleMaterials } from './womens-circle-materials.js';
import {
  createCourseTrainer,
  createTrainingScenario,
  publicTrainingScenario,
  resolveTrainingTurn,
  sanitizeTrainingActivity,
  sanitizeTrainingCounterpartHint,
  sanitizeTrainingDifficulty,
  sanitizeTrainingPhase,
} from './training.js';
import {
  createMembershipCheckout,
  createMembershipPortal,
  handleStripeWebhook,
  isOwnerMember,
  membershipFor,
  paymentsConfigured,
  verifyMemberAuthorization,
} from './payments.js';
import {
  assertFoundingEligible,
  foundingConfigured,
  foundingForMember,
  foundingPublicStatus,
  listFoundingApplications,
  recordAiUsage,
  submitFoundingApplication,
  submitFoundingFeedback,
  updateFoundingApplication,
} from './founding.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const SYSTEM_PROMPT_PATH = join(ROOT, 'config', 'system-prompt.md');
const KNOWLEDGE_PATH = join(ROOT, 'data', 'nia-knowledge.jsonl');
const EVERAND_KNOWLEDGE_PATH = join(ROOT, 'data', 'everand-knowledge.jsonl');
const EVERAND_MANIFEST_PATH = join(ROOT, 'data', 'everand-knowledge-manifest.json');
const COACHING_METHODS_PATH = join(ROOT, 'data', 'coaching-methods.json');
const EXPERT_SOURCES_PATH = join(ROOT, 'data', 'expert-sources.json');
const WELLBEING_PROTOCOLS_PATH = join(ROOT, 'data', 'wellbeing-protocols.json');
const TECHNIQUE_ATLAS_PATH = join(ROOT, 'data', 'master-technique-atlas.json');
const COMMUNITY_CONTENT_PATH = join(ROOT, 'data', 'community-content.json');
const COURSE_NEUROPLASTICITY_PATH = join(ROOT, 'data', 'course-neuroplasticita-practitioner.md');
const COURSE_SELF_TRUST_PATH = join(ROOT, 'data', 'course-pevna-v-sobe.md');
const COURSE_SELF_TRUST_MATERIALS_PATH = join(ROOT, 'data', 'course-pevna-v-sobe-materials.json');
const COURSE_SELF_TRUST_AUDIO_PATH = join(ROOT, 'data', 'course-pevna-v-sobe-audio-scripts.md');
const COURSE_SPIRITUAL_COACH_PATH = join(ROOT, 'data', 'course-spiritualni-koucink.md');
const COURSE_SPIRITUAL_COACH_MATERIALS_PATH = join(ROOT, 'data', 'course-spiritualni-koucink-materials.json');
const COURSE_SPIRITUAL_COACH_AUDIO_PATH = join(ROOT, 'data', 'course-spiritualni-koucink-audio-scripts.md');
const COURSE_COMMUNICATION_PATH = join(ROOT, 'data', 'course-komunikace-v-praxi.md');
const COURSE_COMMUNICATION_MATERIALS_PATH = join(ROOT, 'data', 'course-komunikace-v-praxi-materials.json');
const COURSE_COMMUNICATION_AUDIO_PATH = join(ROOT, 'data', 'course-komunikace-v-praxi-audio-scripts.md');
const COURSE_CBT_PATH = join(ROOT, 'data', 'course-kbt-koucink-v-praxi.md');
const COURSE_CBT_MATERIALS_PATH = join(ROOT, 'data', 'course-kbt-koucink-v-praxi-materials.json');
const COURSE_CBT_AUDIO_PATH = join(ROOT, 'data', 'course-kbt-koucink-v-praxi-audio-scripts.md');
const COURSE_ADHD_PATH = join(ROOT, 'data', 'course-adhd-focus-motivace.md');
const COURSE_ADHD_MATERIALS_PATH = join(ROOT, 'data', 'course-adhd-focus-motivace-materials.json');
const COURSE_ADHD_AUDIO_PATH = join(ROOT, 'data', 'course-adhd-focus-motivace-audio-scripts.md');
const COURSE_BACH_PATH = join(ROOT, 'data', 'course-bachovy-kvetove-esence.md');
const COURSE_BACH_MATERIALS_PATH = join(ROOT, 'data', 'course-bachovy-kvetove-esence-materials.json');
const COURSE_BACH_AUDIO_PATH = join(ROOT, 'data', 'course-bachovy-kvetove-esence-audio-scripts.md');
const COURSE_LIFE_PATH = join(ROOT, 'data', 'course-profesionalni-life-coach.md');
const COURSE_LIFE_MATERIALS_PATH = join(ROOT, 'data', 'course-profesionalni-life-coach-materials.json');
const COURSE_LIFE_AUDIO_PATH = join(ROOT, 'data', 'course-profesionalni-life-coach-audio-scripts.md');
const COURSE_CIRCLE_PATH = join(ROOT, 'data', 'course-zenske-kruhy.md');
const COURSE_CIRCLE_MATERIALS_PATH = join(ROOT, 'data', 'course-zenske-kruhy-materials.json');
const COURSE_CIRCLE_AUDIO_PATH = join(ROOT, 'data', 'course-zenske-kruhy-audio-scripts.md');
const PORT = Number(process.env.PORT || 4173);

const [systemPrompt, knowledgeRecords, everandKnowledgeRecords, everandManifest, coachingMethods, expertSources, wellbeingProtocols, techniqueAtlas, communityContent, courses, selfTrustMaterialDefinitions, spiritualCourseMaterials, communicationCourseMaterials, cbtCourseMaterials, adhdMaterialDefinitions, bachMaterialDefinitions, lifeMaterialDefinitions, circleMaterialDefinitions, selfTrustAudioScripts, spiritualCoachAudioScripts, communicationAudioScripts, cbtAudioScripts, adhdAudioScripts, bachAudioScripts, lifeAudioScripts, circleAudioScripts] = await Promise.all([
  readFile(SYSTEM_PROMPT_PATH, 'utf8'),
  loadKnowledge(KNOWLEDGE_PATH),
  loadKnowledge(EVERAND_KNOWLEDGE_PATH),
  readFile(EVERAND_MANIFEST_PATH, 'utf8').then(value => JSON.parse(value)),
  loadCoachingMethods(COACHING_METHODS_PATH),
  loadExpertSources(EXPERT_SOURCES_PATH),
  loadWellbeingProtocols(WELLBEING_PROTOCOLS_PATH),
  loadTechniqueAtlas(TECHNIQUE_ATLAS_PATH),
  readFile(COMMUNITY_CONTENT_PATH, 'utf8').then(value => JSON.parse(value)),
  loadCourses([COURSE_NEUROPLASTICITY_PATH, COURSE_SELF_TRUST_PATH, COURSE_SPIRITUAL_COACH_PATH, COURSE_COMMUNICATION_PATH, COURSE_CBT_PATH, COURSE_ADHD_PATH, COURSE_BACH_PATH, COURSE_LIFE_PATH, COURSE_CIRCLE_PATH]),
  readFile(COURSE_SELF_TRUST_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_SPIRITUAL_COACH_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_COMMUNICATION_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CBT_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_ADHD_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_BACH_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_LIFE_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CIRCLE_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_SELF_TRUST_AUDIO_PATH, 'utf8'),
  readFile(COURSE_SPIRITUAL_COACH_AUDIO_PATH, 'utf8'),
  readFile(COURSE_COMMUNICATION_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CBT_AUDIO_PATH, 'utf8'),
  readFile(COURSE_ADHD_AUDIO_PATH, 'utf8'),
  readFile(COURSE_BACH_AUDIO_PATH, 'utf8'),
  readFile(COURSE_LIFE_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CIRCLE_AUDIO_PATH, 'utf8'),
]);
const selfTrustCourseMaterials = expandSelfTrustMaterials(selfTrustMaterialDefinitions);
const adhdCourseMaterials = expandAdhdMaterials(adhdMaterialDefinitions);
const bachCourseMaterials = expandBachMaterials(bachMaterialDefinitions);
const lifeCourseMaterials = expandLifeCoachMaterials(lifeMaterialDefinitions);
const circleCourseMaterials = expandWomensCircleMaterials(circleMaterialDefinitions);
const courseMaterials = [...selfTrustCourseMaterials, ...spiritualCourseMaterials, ...communicationCourseMaterials, ...cbtCourseMaterials, ...adhdCourseMaterials, ...bachCourseMaterials, ...lifeCourseMaterials, ...circleCourseMaterials];
const selfTrustAudioPack = courseMaterials.find(material => material.id === 'self-audio-pack');
if (selfTrustAudioPack) selfTrustAudioPack.resourceMarkdown = selfTrustAudioScripts;
const audioProductionPack = courseMaterials.find(material => material.id === 'spirit-audio-production-pack');
if (audioProductionPack) audioProductionPack.resourceMarkdown = spiritualCoachAudioScripts;
const communicationAudioPack = courseMaterials.find(material => material.id === 'comm-audio-pack');
if (communicationAudioPack) communicationAudioPack.resourceMarkdown = communicationAudioScripts;
const cbtAudioPack = courseMaterials.find(material => material.id === 'kbt-audio-pack');
if (cbtAudioPack) cbtAudioPack.resourceMarkdown = cbtAudioScripts;
const adhdAudioPack = courseMaterials.find(material => material.id === 'adhd-audio-pack');
if (adhdAudioPack) adhdAudioPack.resourceMarkdown = adhdAudioScripts;
const bachAudioPack = courseMaterials.find(material => material.id === 'bach-audio-pack');
if (bachAudioPack) bachAudioPack.resourceMarkdown = bachAudioScripts;
const lifeAudioPack = courseMaterials.find(material => material.id === 'life-audio-pack');
if (lifeAudioPack) lifeAudioPack.resourceMarkdown = lifeAudioScripts;
const circleAudioPack = courseMaterials.find(material => material.id === 'circle-audio-pack');
if (circleAudioPack) circleAudioPack.resourceMarkdown = circleAudioScripts;
for (const course of courses) {
  course.materials = courseMaterials.filter(material => material.courseId === course.id);
  attachCourseMastery(course);
}
const courseKnowledgeRecords = buildCourseKnowledge(courses);
const courseCoverage = courseKnowledgeCoverage(courses, courseKnowledgeRecords);
if (!courseCoverage.complete) {
  throw new Error(`Kurzová znalostní vrstva není úplná: ${JSON.stringify(courseCoverage)}`);
}
const approvedSourceKnowledgeRecords = knowledgeRecords.filter(isKnowledgeApproved);
const blockedSourceKnowledgeRecords = knowledgeRecords.length - approvedSourceKnowledgeRecords.length;
const approvedEverandKnowledgeRecords = everandKnowledgeRecords.filter(isKnowledgeApproved);
if (approvedEverandKnowledgeRecords.length !== everandManifest.total_records) {
  throw new Error(`Everand znalostní vrstva není úplná: ${approvedEverandKnowledgeRecords.length}/${everandManifest.total_records}`);
}
const chatbotKnowledgeRecords = [
  ...approvedSourceKnowledgeRecords,
  ...approvedEverandKnowledgeRecords,
  ...courseKnowledgeRecords,
];
validateMethodSources(coachingMethods, expertSources);
validateProtocolSources(wellbeingProtocols, expertSources);
const answer = createElitea({
  systemPrompt,
  knowledgeRecords: chatbotKnowledgeRecords,
  coachingMethods,
  expertSources,
  wellbeingProtocols,
  techniqueAtlas,
});
const answerTraining = createCourseTrainer();
const worksheets = buildWorksheetLibrary(techniqueAtlas);
const app = express();

const browserConnectSources = ["'self'", ...new Set([
  process.env.NEON_AUTH_URL,
  process.env.NEON_DATA_API_URL,
].filter(Boolean).map(value => {
  try { return new URL(value).origin; }
  catch { return ''; }
}).filter(Boolean))];

app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "frame-src 'self' https://*.browserbase.com https://browserbase.com",
    `connect-src ${browserConnectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '));
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  try {
    const result = await handleStripeWebhook(request.body, request.get('stripe-signature'));
    return response.set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'stripe_webhook_failed', error: error?.message || String(error) }));
    return response.status(error?.statusCode || 400).set('Cache-Control', 'no-store').json({ error: 'Platební událost nebyla přijata.' });
  }
});
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  const dependencies = {
    ai: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === '1'),
    auth: Boolean(process.env.NEON_AUTH_URL && process.env.NEON_DATA_API_URL),
    payments: paymentsConfigured(),
    booking: bookingConfigured(),
  };
  const ok = Object.values(dependencies).every(Boolean);
  return response.status(ok ? 200 : 503).set('Cache-Control', 'no-store').json({
    ok,
    service: 'elitea',
    timestamp: new Date().toISOString(),
    dependencies,
  });
});

app.get('/api/status', (_request, response) => {
  const launchReadiness = evaluateLaunchReadiness({
    automatedCases: 1004,
    humanReviewedSessions: Number(process.env.ELITEA_HUMAN_REVIEWED_SESSIONS || 0),
    criticalFailures: Number(process.env.ELITEA_CRITICAL_FAILURES || 0),
    groundedPassRate: Number(process.env.ELITEA_GROUNDED_PASS_RATE || 0),
    roleIntegrityRate: Number(process.env.ELITEA_ROLE_INTEGRITY_RATE || 0),
    debriefIntegrityRate: Number(process.env.ELITEA_DEBRIEF_INTEGRITY_RATE || 0),
  });
  response.set('Cache-Control', 'no-store').json({
    ready: true,
    providerConnected: Boolean(
      process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === '1'
    ),
    model: resolveModelId(),
    deepModel: String(process.env.ELITEA_DEEP_MODEL || DEFAULT_DEEP_MODEL).trim(),
    coachModel: String(process.env.ELITEA_COACH_MODEL || DEFAULT_COACH_MODEL).trim(),
    knowledgeRecords: chatbotKnowledgeRecords.length,
    sourceKnowledgeRecords: knowledgeRecords.length,
    approvedSourceKnowledgeRecords: approvedSourceKnowledgeRecords.length,
    blockedSourceKnowledgeRecords,
    everandKnowledgeRecords: everandKnowledgeRecords.length,
    everandCompletedSources: everandManifest.completed_sources,
    everandPracticalTools: everandManifest.practical_tools,
    everandSourceCheckpoint: everandManifest.source_checkpoint,
    courseKnowledgeRecords: courseKnowledgeRecords.length,
    courseKnowledgeCoverage: courseCoverage,
    coachingMethods: coachingMethods.length,
    expertSources: expertSources.length,
    wellbeingProtocols: wellbeingProtocols.length,
    techniqueCards: techniqueAtlas.length,
    coachingTechniqueCards: techniqueAtlas.filter(card => card.access_level === 'ai_coaching').length,
    availableTechniqueCards: techniqueAtlas.filter(card => card.access_level !== 'human_only').length,
    humanOnlyTechniqueCards: techniqueAtlas.filter(card => card.access_level === 'human_only').length,
    communityContent: communityContent.length,
    courses: courses.length,
    worksheets: worksheets.items.length,
    courseMaterials: courseMaterials.length,
    studyTrainer: true,
    memoryStorage: process.env.NEON_AUTH_URL && process.env.NEON_DATA_API_URL ? 'account-cloud-approved-state-session-only-chat' : 'local-browser',
    authConnected: Boolean(process.env.NEON_AUTH_URL && process.env.NEON_DATA_API_URL),
    bookingConnected: bookingConfigured(),
    paymentsConnected: paymentsConfigured(),
    foundingProgramConnected: foundingConfigured(),
    commercialLaunchReady: launchReadiness.ready,
    launchStage: launchReadiness.stage,
    launchChecks: launchReadiness.checks,
    qualityPolicy: launchReadiness.policy,
  });
});

app.get('/api/marketing-operator/capabilities', (_request, response) => {
  response.set('Cache-Control', 'no-store').json({
    ...marketingOperatorPublicStatus(),
    remoteBrowser: {
      configured: browserOperatorConfigured(),
      targets: browserOperatorTargets(),
    },
  });
});

app.post('/api/browser-sessions', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ požadavku.' });
  try {
    const member = await authorizeAiRequest(request);
    const session = await startBrowserOperatorSession(member, { target: request.body?.target });
    return response.status(201).set('Cache-Control', 'no-store').json(session);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Pracovní prohlížeč se nepodařilo spustit.' });
  }
});

app.get('/api/browser-sessions/:id', async (request, response) => {
  try {
    const member = await authorizeAiRequest(request);
    const session = await getBrowserOperatorSession(member, request.params.id);
    return response.set('Cache-Control', 'no-store').json(session);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Pracovní prohlížeč se nepodařilo načíst.' });
  }
});

app.delete('/api/browser-sessions/:id', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ požadavku.' });
  try {
    const member = await authorizeAiRequest(request);
    const result = await endBrowserOperatorSession(member, request.params.id);
    return response.set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Pracovní prohlížeč se nepodařilo ukončit.' });
  }
});

app.post('/api/browser-sessions/:id/actions/preview', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ požadavku.' });
  try {
    const member = await authorizeAiRequest(request);
    const draft = await previewBrowserOperatorAction(member, request.params.id, { instruction: request.body?.instruction });
    return response.status(201).set('Cache-Control', 'no-store').json(draft);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Bezpečný krok se nepodařilo připravit.' });
  }
});

app.post('/api/browser-sessions/:id/actions/:draftId/execute', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ požadavku.' });
  try {
    const member = await authorizeAiRequest(request);
    const result = await executeBrowserOperatorAction(member, request.params.id, request.params.draftId);
    return response.set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Krok se nepodařilo bezpečně provést.' });
  }
});

app.get('/api/client-config', (_request, response) => {
  response.set('Cache-Control', 'no-store').json({
    authUrl: process.env.NEON_AUTH_URL || '',
    dataApiUrl: process.env.NEON_DATA_API_URL || '',
  });
});

app.get('/api/founding/status', async (_request, response) => {
  try {
    return response.set('Cache-Control', 'no-store').json(await foundingPublicStatus());
  } catch {
    return response.status(503).set('Cache-Control', 'no-store').json({ error: 'Stav programu Founding 30 se teď nepodařilo načíst.' });
  }
});

app.post('/api/founding/apply', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).json({ error: 'Neplatný původ přihlášky.' });
  try {
    return response.status(201).set('Cache-Control', 'no-store').json(await submitFoundingApplication(request.body));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Přihlášku se nepodařilo odeslat.' });
  }
});

app.get('/api/founding/me', async (request, response) => {
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    return response.set('Cache-Control', 'no-store').json(await foundingForMember(member));
  } catch (error) {
    return response.status(error?.statusCode || 401).set('Cache-Control', 'no-store').json({ error: error?.message || 'Přihlášení není platné.' });
  }
});

app.post('/api/founding/feedback', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).json({ error: 'Neplatný původ zpětné vazby.' });
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    return response.status(201).set('Cache-Control', 'no-store').json(await submitFoundingFeedback(member, request.body));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Zpětnou vazbu se nepodařilo uložit.' });
  }
});

app.get('/api/founding/admin/applications', async (request, response) => {
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    return response.set('Cache-Control', 'no-store').json(await listFoundingApplications(member));
  } catch (error) {
    return response.status(error?.statusCode || 401).set('Cache-Control', 'no-store').json({ error: error?.message || 'Přístup není povolen.' });
  }
});

app.patch('/api/founding/admin/applications/:id', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).json({ error: 'Neplatný původ požadavku.' });
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    return response.set('Cache-Control', 'no-store').json(await updateFoundingApplication(member, request.params.id, request.body?.action));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Přihlášku se nepodařilo změnit.' });
  }
});

app.get('/api/membership', async (request, response) => {
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    return response.set('Cache-Control', 'no-store').json(await membershipFor(member));
  } catch (error) {
    return response.status(error?.statusCode || 401).set('Cache-Control', 'no-store').json({ error: error?.message || 'Přihlášení není platné.' });
  }
});

app.post('/api/membership/checkout', async (request, response) => {
  const origin = request.get('origin');
  if (origin && !sameHost(origin, request.get('host'))) return response.status(403).json({ error: 'Neplatný původ platebního požadavku.' });
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    if (isOwnerMember(member)) {
      return response.status(409).set('Cache-Control', 'no-store').json({ error: 'Vlastnický účet má plný přístup bez předplatného.' });
    }
    const planCode = request.body?.planCode === 'founding30' ? 'founding30' : 'standard';
    if (planCode === 'founding30') await assertFoundingEligible(member);
    return response.set('Cache-Control', 'no-store').json(await createMembershipCheckout(member, request.body?.email, { planCode }));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Platební bránu se nepodařilo otevřít.' });
  }
});

app.post('/api/membership/portal', async (request, response) => {
  const origin = request.get('origin');
  if (origin && !sameHost(origin, request.get('host'))) return response.status(403).json({ error: 'Neplatný původ platebního požadavku.' });
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    return response.set('Cache-Control', 'no-store').json(await createMembershipPortal(member));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Správu členství se nepodařilo otevřít.' });
  }
});

app.get('/api/worksheets', (_request, response) => {
  response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').json(worksheets);
});

app.get('/api/content', (_request, response) => {
  response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').json({
    categories: [
      { id: 'all', label: 'Všechno' },
      { id: 'ebook', label: 'E-booky' },
      { id: 'audio', label: 'Audio' },
      { id: 'video', label: 'Video' },
      { id: 'workshop', label: 'Průvodci' },
      { id: 'article', label: 'Články' },
      { id: 'quick-tip', label: 'Mini tipy' },
    ],
    items: communityContent.filter(item => item.access === 'free'),
  });
});

app.get('/api/courses', (_request, response) => {
  response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300').json({
    items: courses.map(courseSummary),
  });
});

app.get('/api/courses/:slug', async (request, response) => {
  try {
    await authorizeAiRequest(request);
    const course = courses.find(item => item.slug === request.params.slug);
    if (!course) return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurz nebyl nalezen.' });
    return response.set('Cache-Control', 'private, no-store, max-age=0').json(publicCourseDetail(course));
  } catch (error) {
    return response.status(error?.statusCode || 401).set('Cache-Control', 'no-store').json({ error: error?.message || 'Pro otevření kurzu se přihlas.' });
  }
});

app.get('/api/training/scenario', async (request, response) => {
  try {
    await authorizeAiRequest(request);
    const context = findCourseTrainingContext(request.query.courseSlug, request.query.itemId);
    if (!context) {
      return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurzová část pro nácvik nebyla nalezena.' });
    }
    const scenario = createTrainingScenario(
      context.course,
      context.item,
      sanitizeTrainingDifficulty(request.query.difficulty),
      request.query.scenarioId,
      sanitizeTrainingCounterpartHint(request.query.counterpart),
    );
    return response.set('Cache-Control', 'no-store').json(publicTrainingScenario(scenario));
  } catch (error) {
    return response.status(error?.statusCode || 401).set('Cache-Control', 'no-store').json({ error: error?.message || 'Pro spuštění nácviku se přihlas.' });
  }
});

app.get('/api/booking-status', (_request, response) => {
  response.set('Cache-Control', 'no-store').json({ connected: bookingConfigured() });
});

app.post('/api/booking-request', async (request, response) => {
  const origin = request.get('origin');
  if (origin && !sameHost(origin, request.get('host'))) {
    return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ žádosti.' });
  }

  const parsed = sanitizeBookingRequest(request.body);
  if (!parsed.ok) {
    return response.status(400).set('Cache-Control', 'no-store').json({ error: parsed.errors[0] });
  }

  console.log(JSON.stringify({ level: 'info', message: 'booking_started', requestId: parsed.value.id }));
  try {
    const result = await sendBookingRequest(parsed.value);
    console.log(JSON.stringify({ level: 'info', message: 'booking_completed', requestId: parsed.value.id }));
    return response.status(201).set('Cache-Control', 'no-store').json({ ok: true, id: result.id });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'booking_failed',
      requestId: parsed.value.id,
      code: error?.code || 'UNKNOWN',
      providerStatus: error?.providerStatus || null,
    }));
    const unavailable = error?.code === 'BOOKING_NOT_CONFIGURED';
    return response.status(unavailable ? 503 : 502).set('Cache-Control', 'no-store').json({
      error: unavailable
        ? 'Rezervační doručení zatím není připojené. Nic nebylo odesláno.'
        : 'Žádost se nepodařilo doručit. Nic nebylo odesláno; zkus to prosím znovu.',
    });
  }
});

app.post('/api/course-request', async (request, response) => {
  const origin = request.get('origin');
  if (origin && !sameHost(origin, request.get('host'))) {
    return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ námětu.' });
  }

  const parsed = sanitizeCourseRequest(request.body);
  if (!parsed.ok) {
    return response.status(400).set('Cache-Control', 'no-store').json({ error: parsed.errors[0] });
  }

  console.log(JSON.stringify({ level: 'info', message: 'course_request_started', requestId: parsed.value.id }));
  try {
    const result = await sendCourseRequest(parsed.value);
    console.log(JSON.stringify({ level: 'info', message: 'course_request_completed', requestId: parsed.value.id }));
    return response.status(201).set('Cache-Control', 'no-store').json({ ok: true, id: result.id });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'course_request_failed',
      requestId: parsed.value.id,
      code: error?.code || 'UNKNOWN',
      providerStatus: error?.providerStatus || null,
    }));
    const unavailable = error?.code === 'COURSE_REQUEST_NOT_CONFIGURED';
    return response.status(unavailable ? 503 : 502).set('Cache-Control', 'no-store').json({
      error: unavailable
        ? 'Doručení námětů zatím není připojené. Nic nebylo odesláno.'
        : 'Námět se nepodařilo doručit. Zkus to prosím znovu.',
    });
  }
});

app.post('/api/quality-report', (request, response) => {
  const origin = request.get('origin');
  if (origin && !sameHost(origin, request.get('host'))) {
    return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ hlášení.' });
  }
  const parsed = sanitizeQualityReport(request.body);
  if (!parsed.ok) {
    return response.status(400).set('Cache-Control', 'no-store').json({ error: parsed.error });
  }
  console.warn(JSON.stringify({
    level: 'warning',
    message: 'quality_reported',
    ...parsed.value,
  }));
  return response.status(201).set('Cache-Control', 'no-store').json({ ok: true, reportId: parsed.value.reportId });
});

// Kompatibilní endpointy nic neukládají. Každá členka má paměť pouze ve svém prohlížeči.
app.get('/api/memory', (_request, response) => {
  response.set('Cache-Control', 'no-store').json(emptyMemory());
});

app.put('/api/memory', (request, response) => {
  const memory = sanitizeMemory(request.body);
  memory.updated_at = new Date().toISOString();
  response.set('Cache-Control', 'no-store').json(memory);
});

app.delete('/api/memory', (_request, response) => {
  response.set('Cache-Control', 'no-store').json(emptyMemory());
});

app.post('/api/chat', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ požadavku.' });
  const startedAt = Date.now();
  const requestId = request.get('x-vercel-id') || null;
  console.log(JSON.stringify({
    level: 'info',
    message: 'chat_started',
    requestId,
  }));

  try {
    const member = await authorizeAiRequest(request);
    const memory = sanitizeMemory(request.body?.memory);
    const consultationMode = sanitizeConsultationMode(request.body?.consultationMode);
    const brandWorkMode = sanitizeBrandWorkMode(request.body?.brandWorkMode);
    const result = await answer({
      messages: request.body?.messages,
      memory,
      consultationMode,
      brandWorkMode,
      techniqueSession: request.body?.techniqueSession,
    });
    if (member) {
      await recordAiUsage(member, {
        roleCode: result.mode === 'brand_growth_agent' ? 'brand_marketing' : 'coach_mentor',
        modelId: result.provider,
        usage: result.usage,
        qualityPassed: result.qualityGate?.pass,
        repaired: result.qualityGate?.repaired,
      }).catch(() => {});
    }
    console.log(JSON.stringify({
      level: 'info',
      message: 'chat_completed',
      requestId,
      durationMs: Date.now() - startedAt,
      mode: result.mode,
      provider: result.provider,
      riskLevel: result.riskLevel,
      techniqueId: result.techniqueSession?.techniqueId || null,
      techniquePhase: result.techniqueSession?.phase || null,
      sessionDepthStage: result.sessionDepthStage || null,
      qualityScore: result.qualityGate?.score ?? null,
      qualityPassed: result.qualityGate?.pass ?? null,
      qualityRepaired: result.qualityGate?.repaired ?? false,
      qualityIssueCodes: result.qualityGate?.issueCodes || [],
      sourceCount: Array.isArray(result.sourceIds) ? result.sourceIds.length : 0,
    }));
    response.set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'chat_failed',
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    const message = /GatewayRateLimitError|rate-limit|rate limit/i.test(error?.message || '')
      ? 'Kapacita AI modelu je teď dočasně vyčerpaná. Zkus odpověď znovu za chvíli.'
      : error?.message?.includes('AI_GATEWAY')
        ? 'AI provider není správně připojený.'
        : 'Elitea teď nemohla odpovědět. Zkus to prosím znovu.';
    response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({
      error: error?.statusCode ? error.message : message,
    });
  }
});

app.post('/api/training', async (request, response) => {
  const origin = request.get('origin');
  if (origin && !sameHost(origin, request.get('host'))) {
    return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ studijního požadavku.' });
  }

  const startedAt = Date.now();
  const requestId = request.get('x-vercel-id') || null;
  const context = findCourseTrainingContext(request.body?.courseSlug, request.body?.itemId);
  if (!context) {
    return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurzová část pro studium nebyla nalezena.' });
  }
  const turn = resolveTrainingTurn({
    activity: request.body?.activity,
    phase: request.body?.phase,
    messages: request.body?.messages,
    counterpartHint: request.body?.counterpartHint,
  });
  const { activity, phase, autoTransition, counterpartHint } = turn;
  const difficulty = sanitizeTrainingDifficulty(request.body?.difficulty);
  console.log(JSON.stringify({ level: 'info', message: 'training_started', requestId, activity, phase, autoTransition, counterpartHint }));

  try {
    const member = await authorizeAiRequest(request);
    const result = await answerTraining({
      messages: request.body?.messages,
      memory: sanitizeMemory(request.body?.memory),
      course: context.course,
      item: context.item,
      activity,
      phase,
      difficulty,
      scenarioId: request.body?.scenarioId,
      counterpartHint,
      autoTransition,
    });
    if (member) {
      const coachingTrainer = activity === 'simulation' && context.course.categoryId === 'coaching-mental-health';
      await recordAiUsage(member, {
        roleCode: coachingTrainer ? 'coaching_trainer' : 'study_trainer',
        modelId: result.provider,
        usage: result.usage,
        qualityPassed: result.qualityGate?.pass,
        repaired: result.qualityGate?.repaired,
      }).catch(() => {});
    }
    console.log(JSON.stringify({
      level: 'info',
      message: 'training_completed',
      requestId,
      durationMs: Date.now() - startedAt,
      activity,
      phase,
      provider: result.provider,
      trainingQualityPassed: result.qualityGate?.pass ?? null,
      trainingQualityRepaired: result.qualityGate?.repaired ?? false,
      trainingQualityIssueCodes: result.qualityGate?.issueCodes || [],
    }));
    return response.set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'training_failed',
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({
      error: error?.statusCode ? error.message : 'Studijní trenérka teď nemohla odpovědět. Zkus to prosím znovu.',
    });
  }
});

function sanitizeConsultationMode(value) {
  const allowed = new Set([
    'auto',
    'coaching_session',
    'business_mentoring',
    'nlp_reframing',
    'behavioral_change',
    'somatic_regulation',
    'brand_growth',
  ]);
  return allowed.has(value) ? value : 'auto';
}

function sanitizeBrandWorkMode(value) {
  return value === 'execute' ? 'execute' : 'collaborate';
}

function findCourseTrainingContext(courseSlug, itemId) {
  const safeSlug = String(courseSlug || '').trim().slice(0, 120);
  const safeItemId = String(itemId || '').trim().slice(0, 120);
  const course = courses.find(candidate => candidate.slug === safeSlug);
  if (!course) return null;
  for (const module of course.modules || []) {
    const item = module.items?.find(candidate => candidate.id === safeItemId);
    if (item) return { course, module, item };
  }
  return null;
}

async function authorizeAiRequest(request) {
  const authConfigured = Boolean(process.env.NEON_AUTH_JWKS_URL || process.env.NEON_AUTH_URL);
  if (!authConfigured) return null;
  const member = await verifyMemberAuthorization(request.get('authorization'));
  if (!paymentsConfigured()) return member;
  const membership = await membershipFor(member);
  if (!['owner', 'trialing', 'active'].includes(membership.status)) {
    throw Object.assign(new Error('Pro použití Elitey je potřeba aktivní zkušební období nebo členství.'), { statusCode: 403 });
  }
  return member;
}

function validMutationOrigin(request) {
  const origin = request.get('origin');
  return !origin || sameHost(origin, request.get('host'));
}

function sameHost(origin, host) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

app.use(express.static(PUBLIC_DIR, {
  etag: true,
  maxAge: 0,
  setHeaders(response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
  },
}));

app.use((_request, response) => {
  response.status(404).set('Cache-Control', 'no-store').json({ error: 'Nenalezeno.' });
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Elitea prototype běží na http://127.0.0.1:${PORT}`);
    console.log(`Znalostní záznamy: ${knowledgeRecords.length}`);
    console.log(`Everand: ${everandManifest.completed_sources} zdrojů / ${everandManifest.practical_tools} praktických nástrojů`);
    console.log(`Koučovací metody: ${coachingMethods.length}`);
    console.log(`Odborné zdroje: ${expertSources.length}`);
    console.log(`Wellbeing protokoly: ${wellbeingProtocols.length}`);
    console.log(`Master Technique Atlas: ${techniqueAtlas.length}`);
    console.log(`Položky komunitní knihovny: ${communityContent.length}`);
    console.log(process.env.AI_GATEWAY_API_KEY ? 'AI Gateway: připojena' : 'AI Gateway: demo režim bez klíče');
  });
}

export default app;
