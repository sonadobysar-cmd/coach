import express from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElitea, DEFAULT_COACH_MODEL, DEFAULT_DEEP_MODEL, resolveModelId } from './elitea.js';
import { isKnowledgeApproved, loadKnowledge } from './knowledge.js';
import { loadCoachingMethods, loadExpertSources, validateMethodSources } from './coaching.js';
import { buildCourseKnowledge, courseKnowledgeCoverage } from './course-knowledge.js';
import { emptyMemory, sanitizeMemory } from './memory.js';
import { SPECIALIST_REGISTRY } from './specialist-router.js';
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
import { aggregateCourseStudyLoad } from './course-study-load.js';
import { buildCourseSearchIndex, searchCourseIndex } from './course-search.js';
import { submitCourseQuizAttempt } from './course-quiz-service.js';
import { attachCourseMastery } from './course-mastery.js';
import { buildWorksheetLibrary } from './worksheets.js';
import { expandSelfTrustMaterials } from './self-trust-materials.js';
import { expandAdhdMaterials } from './adhd-materials.js';
import { expandBachMaterials } from './bach-materials.js';
import { expandLifeCoachMaterials } from './life-coach-materials.js';
import { expandWomensCircleMaterials } from './womens-circle-materials.js';
import { expandBusinessMaterials } from './business-materials.js';
import { expandAiAgentMaterials } from './ai-agent-materials.js';
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
import { readAiUsage, reserveAiTurn } from './usage-limits.js';
import { reportOperationalError, sanitizeOperationalEvent } from './observability.js';
import { lifecycleConfigured, runLifecycleEmails } from './lifecycle-email.js';
import { ensureRuntimeSchema, runtimeSchemaStatus } from './runtime-schema.js';
import {
  certificatePdf,
  certificateStatus,
  issueCertificate,
  recordCertificateExamAttempt,
  syncCertificateEvidence,
  verifyCertificateDocument,
} from './certificate-service.js';
import { certificateSigningConfigured } from './certificate-authenticity.js';
import { authorizeCertificateQaRequest, runCertificateProductionQa } from './certificate-production-qa.js';
import {
  advancePublicCoachTestSession,
  issuePublicCoachTestSession,
  listPublicCoachTestFeedback,
  publicTestMemory,
  sanitizePublicCoachTestFeedback,
  savePublicCoachTestFeedback,
} from './public-coach-test-service.js';

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
const ACADEMY_TRAINER_RELEASE_PATH = join(ROOT, 'config', 'academy-trainer-release.json');
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
const COURSE_BUSINESS_PATH = join(ROOT, 'data', 'course-podnikani-od-napadu-k-rustu.md');
const COURSE_BUSINESS_MATERIALS_PATH = join(ROOT, 'data', 'course-podnikani-od-napadu-k-rustu-materials.json');
const COURSE_BUSINESS_AUDIO_PATH = join(ROOT, 'data', 'course-podnikani-od-napadu-k-rustu-audio-scripts.md');
const COURSE_PART_TIME_BUSINESS_PATH = join(ROOT, 'data', 'course-vedlejsi-byznys-pri-zamestnani.md');
const COURSE_PART_TIME_BUSINESS_MATERIALS_PATH = join(ROOT, 'data', 'course-vedlejsi-byznys-pri-zamestnani-materials.json');
const COURSE_PART_TIME_BUSINESS_AUDIO_PATH = join(ROOT, 'data', 'course-vedlejsi-byznys-pri-zamestnani-audio-scripts.md');
const COURSE_AI_AGENTS_PATH = join(ROOT, 'data', 'course-ai-agenti-a-automatizace.md');
const COURSE_AI_AGENTS_MATERIALS_PATH = join(ROOT, 'data', 'course-ai-agenti-a-automatizace-materials.json');
const COURSE_AI_AGENTS_AUDIO_PATH = join(ROOT, 'data', 'course-ai-agenti-a-automatizace-audio-scripts.md');
const COURSE_STARTUP_IDEA_PATH = join(ROOT, 'data', 'course-napad-k-overene-prilezitosti.md');
const COURSE_STARTUP_IDEA_MATERIALS_PATH = join(ROOT, 'data', 'course-napad-k-overene-prilezitosti-materials.json');
const COURSE_STARTUP_IDEA_AUDIO_PATH = join(ROOT, 'data', 'course-napad-k-overene-prilezitosti-audio-scripts.md');
const COURSE_BUSINESS_DEVELOPMENT_PATH = join(ROOT, 'data', 'course-strategicka-partnerstvi-business-development.md');
const COURSE_BUSINESS_DEVELOPMENT_MATERIALS_PATH = join(ROOT, 'data', 'course-strategicka-partnerstvi-business-development-materials.json');
const COURSE_BUSINESS_DEVELOPMENT_AUDIO_PATH = join(ROOT, 'data', 'course-strategicka-partnerstvi-business-development-audio-scripts.md');
const COURSE_GENERATIVE_AI_MARKETING_PATH = join(ROOT, 'data', 'course-generativni-ai-pro-marketing-a-byznys.md');
const COURSE_GENERATIVE_AI_MARKETING_MATERIALS_PATH = join(ROOT, 'data', 'course-generativni-ai-pro-marketing-a-byznys-materials.json');
const COURSE_GENERATIVE_AI_MARKETING_AUDIO_PATH = join(ROOT, 'data', 'course-generativni-ai-pro-marketing-a-byznys-audio-scripts.md');
const COURSE_SOCIAL_MEDIA_MANAGEMENT_PATH = join(ROOT, 'data', 'course-social-media-management-strategie-a-rust.md');
const COURSE_SOCIAL_MEDIA_MANAGEMENT_MATERIALS_PATH = join(ROOT, 'data', 'course-social-media-management-strategie-a-rust-materials.json');
const COURSE_SOCIAL_MEDIA_MANAGEMENT_AUDIO_PATH = join(ROOT, 'data', 'course-social-media-management-strategie-a-rust-audio-scripts.md');
const COURSE_CANVA_CONTENT_DESIGN_PATH = join(ROOT, 'data', 'course-canva-content-design-studio.md');
const COURSE_CANVA_CONTENT_DESIGN_MATERIALS_PATH = join(ROOT, 'data', 'course-canva-content-design-studio-materials.json');
const COURSE_CANVA_CONTENT_DESIGN_AUDIO_PATH = join(ROOT, 'data', 'course-canva-content-design-studio-audio-scripts.md');
const COURSE_CANVA_AI_SYSTEMS_PATH = join(ROOT, 'data', 'course-canva-ai-business-systems-lab.md');
const COURSE_CANVA_AI_SYSTEMS_MATERIALS_PATH = join(ROOT, 'data', 'course-canva-ai-business-systems-lab-materials.json');
const COURSE_CANVA_AI_SYSTEMS_AUDIO_PATH = join(ROOT, 'data', 'course-canva-ai-business-systems-lab-audio-scripts.md');
const COURSE_CONTENT_MARKETING_PATH = join(ROOT, 'data', 'course-content-marketing-editorial-growth-system.md');
const COURSE_CONTENT_MARKETING_MATERIALS_PATH = join(ROOT, 'data', 'course-content-marketing-editorial-growth-system-materials.json');
const COURSE_CONTENT_MARKETING_AUDIO_PATH = join(ROOT, 'data', 'course-content-marketing-editorial-growth-system-audio-scripts.md');
const COURSE_AI_CONTENT_STUDIO_PATH = join(ROOT, 'data', 'course-ai-content-production-studio.md');
const COURSE_AI_CONTENT_STUDIO_MATERIALS_PATH = join(ROOT, 'data', 'course-ai-content-production-studio-materials.json');
const COURSE_AI_CONTENT_STUDIO_AUDIO_PATH = join(ROOT, 'data', 'course-ai-content-production-studio-audio-scripts.md');
const COURSE_VISUAL_CONTENT_STRATEGY_PATH = join(ROOT, 'data', 'course-visual-content-strategy-campaign-lab.md');
const COURSE_VISUAL_CONTENT_STRATEGY_MATERIALS_PATH = join(ROOT, 'data', 'course-visual-content-strategy-campaign-lab-materials.json');
const COURSE_VISUAL_CONTENT_STRATEGY_AUDIO_PATH = join(ROOT, 'data', 'course-visual-content-strategy-campaign-lab-audio-scripts.md');
const COURSE_FOUNDER_PRODUCTIVITY_PATH = join(ROOT, 'data', 'course-founder-productivity-execution-os.md');
const COURSE_FOUNDER_PRODUCTIVITY_MATERIALS_PATH = join(ROOT, 'data', 'course-founder-productivity-execution-os-materials.json');
const COURSE_FOUNDER_PRODUCTIVITY_AUDIO_PATH = join(ROOT, 'data', 'course-founder-productivity-execution-os-audio-scripts.md');
const COURSE_CAPCUT_SHORT_FORM_PATH = join(ROOT, 'data', 'course-capcut-short-form-video-studio.md');
const COURSE_CAPCUT_SHORT_FORM_MATERIALS_PATH = join(ROOT, 'data', 'course-capcut-short-form-video-studio-materials.json');
const COURSE_CAPCUT_SHORT_FORM_AUDIO_PATH = join(ROOT, 'data', 'course-capcut-short-form-video-studio-audio-scripts.md');
const COURSE_CONTENT_CREATOR_PATH = join(ROOT, 'data', 'course-content-creator-personal-brand-studio.md');
const COURSE_CONTENT_CREATOR_MATERIALS_PATH = join(ROOT, 'data', 'course-content-creator-personal-brand-studio-materials.json');
const COURSE_CONTENT_CREATOR_AUDIO_PATH = join(ROOT, 'data', 'course-content-creator-personal-brand-studio-audio-scripts.md');
const COURSE_STRATEGIC_THINKING_PATH = join(ROOT, 'data', 'course-strategic-thinking-decision-lab.md');
const COURSE_STRATEGIC_THINKING_MATERIALS_PATH = join(ROOT, 'data', 'course-strategic-thinking-decision-lab-materials.json');
const COURSE_STRATEGIC_THINKING_AUDIO_PATH = join(ROOT, 'data', 'course-strategic-thinking-decision-lab-audio-scripts.md');
const COURSE_WORKFLOW_PRODUCTIVITY_PATH = join(ROOT, 'data', 'course-workflow-productivity-toolkit.md');
const COURSE_WORKFLOW_PRODUCTIVITY_MATERIALS_PATH = join(ROOT, 'data', 'course-workflow-productivity-toolkit-materials.json');
const COURSE_WORKFLOW_PRODUCTIVITY_AUDIO_PATH = join(ROOT, 'data', 'course-workflow-productivity-toolkit-audio-scripts.md');
const COURSE_PROJECT_OPERATIONS_PATH = join(ROOT, 'data', 'course-project-workflow-operations-management.md');
const COURSE_PROJECT_OPERATIONS_MATERIALS_PATH = join(ROOT, 'data', 'course-project-workflow-operations-management-materials.json');
const COURSE_PROJECT_OPERATIONS_AUDIO_PATH = join(ROOT, 'data', 'course-project-workflow-operations-management-audio-scripts.md');
const PORT = Number(process.env.PORT || 4173);

await ensureRuntimeSchema();

const [systemPrompt, knowledgeRecords, everandKnowledgeRecords, everandManifest, coachingMethods, expertSources, wellbeingProtocols, techniqueAtlas, communityContent, courses, selfTrustMaterialDefinitions, spiritualCourseMaterials, communicationCourseMaterials, cbtCourseMaterials, adhdMaterialDefinitions, bachMaterialDefinitions, lifeMaterialDefinitions, circleMaterialDefinitions, businessMaterialDefinitions, partTimeBusinessMaterialDefinitions, aiAgentMaterialDefinitions, startupIdeaMaterialDefinitions, businessDevelopmentMaterialDefinitions, generativeAiMarketingMaterialDefinitions, socialMediaManagementMaterialDefinitions, canvaContentDesignMaterialDefinitions, canvaAiSystemsMaterialDefinitions, contentMarketingMaterialDefinitions, aiContentStudioMaterialDefinitions, visualContentStrategyMaterialDefinitions, founderProductivityMaterialDefinitions, capcutShortFormMaterialDefinitions, contentCreatorMaterialDefinitions, selfTrustAudioScripts, spiritualCoachAudioScripts, communicationAudioScripts, cbtAudioScripts, adhdAudioScripts, bachAudioScripts, lifeAudioScripts, circleAudioScripts, businessAudioScripts, partTimeBusinessAudioScripts, aiAgentAudioScripts, startupIdeaAudioScripts, businessDevelopmentAudioScripts, generativeAiMarketingAudioScripts, socialMediaManagementAudioScripts, canvaContentDesignAudioScripts, canvaAiSystemsAudioScripts, contentMarketingAudioScripts, aiContentStudioAudioScripts, visualContentStrategyAudioScripts, founderProductivityAudioScripts, capcutShortFormAudioScripts, contentCreatorAudioScripts] = await Promise.all([
  readFile(SYSTEM_PROMPT_PATH, 'utf8'),
  loadKnowledge(KNOWLEDGE_PATH),
  loadKnowledge(EVERAND_KNOWLEDGE_PATH),
  readFile(EVERAND_MANIFEST_PATH, 'utf8').then(value => JSON.parse(value)),
  loadCoachingMethods(COACHING_METHODS_PATH),
  loadExpertSources(EXPERT_SOURCES_PATH),
  loadWellbeingProtocols(WELLBEING_PROTOCOLS_PATH),
  loadTechniqueAtlas(TECHNIQUE_ATLAS_PATH),
  readFile(COMMUNITY_CONTENT_PATH, 'utf8').then(value => JSON.parse(value)),
  loadCourses([COURSE_NEUROPLASTICITY_PATH, COURSE_SELF_TRUST_PATH, COURSE_SPIRITUAL_COACH_PATH, COURSE_COMMUNICATION_PATH, COURSE_CBT_PATH, COURSE_ADHD_PATH, COURSE_BACH_PATH, COURSE_LIFE_PATH, COURSE_CIRCLE_PATH, COURSE_BUSINESS_PATH, COURSE_PART_TIME_BUSINESS_PATH, COURSE_AI_AGENTS_PATH, COURSE_STARTUP_IDEA_PATH, COURSE_BUSINESS_DEVELOPMENT_PATH, COURSE_GENERATIVE_AI_MARKETING_PATH, COURSE_SOCIAL_MEDIA_MANAGEMENT_PATH, COURSE_CANVA_CONTENT_DESIGN_PATH, COURSE_CANVA_AI_SYSTEMS_PATH, COURSE_CONTENT_MARKETING_PATH, COURSE_AI_CONTENT_STUDIO_PATH, COURSE_VISUAL_CONTENT_STRATEGY_PATH, COURSE_FOUNDER_PRODUCTIVITY_PATH, COURSE_CAPCUT_SHORT_FORM_PATH, COURSE_CONTENT_CREATOR_PATH, COURSE_STRATEGIC_THINKING_PATH, COURSE_WORKFLOW_PRODUCTIVITY_PATH, COURSE_PROJECT_OPERATIONS_PATH]),
  readFile(COURSE_SELF_TRUST_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_SPIRITUAL_COACH_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_COMMUNICATION_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CBT_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_ADHD_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_BACH_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_LIFE_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CIRCLE_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_BUSINESS_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_PART_TIME_BUSINESS_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_AI_AGENTS_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_STARTUP_IDEA_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_BUSINESS_DEVELOPMENT_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_GENERATIVE_AI_MARKETING_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_SOCIAL_MEDIA_MANAGEMENT_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CANVA_CONTENT_DESIGN_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CANVA_AI_SYSTEMS_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CONTENT_MARKETING_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_AI_CONTENT_STUDIO_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_VISUAL_CONTENT_STRATEGY_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_FOUNDER_PRODUCTIVITY_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CAPCUT_SHORT_FORM_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_CONTENT_CREATOR_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_SELF_TRUST_AUDIO_PATH, 'utf8'),
  readFile(COURSE_SPIRITUAL_COACH_AUDIO_PATH, 'utf8'),
  readFile(COURSE_COMMUNICATION_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CBT_AUDIO_PATH, 'utf8'),
  readFile(COURSE_ADHD_AUDIO_PATH, 'utf8'),
  readFile(COURSE_BACH_AUDIO_PATH, 'utf8'),
  readFile(COURSE_LIFE_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CIRCLE_AUDIO_PATH, 'utf8'),
  readFile(COURSE_BUSINESS_AUDIO_PATH, 'utf8'),
  readFile(COURSE_PART_TIME_BUSINESS_AUDIO_PATH, 'utf8'),
  readFile(COURSE_AI_AGENTS_AUDIO_PATH, 'utf8'),
  readFile(COURSE_STARTUP_IDEA_AUDIO_PATH, 'utf8'),
  readFile(COURSE_BUSINESS_DEVELOPMENT_AUDIO_PATH, 'utf8'),
  readFile(COURSE_GENERATIVE_AI_MARKETING_AUDIO_PATH, 'utf8'),
  readFile(COURSE_SOCIAL_MEDIA_MANAGEMENT_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CANVA_CONTENT_DESIGN_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CANVA_AI_SYSTEMS_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CONTENT_MARKETING_AUDIO_PATH, 'utf8'),
  readFile(COURSE_AI_CONTENT_STUDIO_AUDIO_PATH, 'utf8'),
  readFile(COURSE_VISUAL_CONTENT_STRATEGY_AUDIO_PATH, 'utf8'),
  readFile(COURSE_FOUNDER_PRODUCTIVITY_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CAPCUT_SHORT_FORM_AUDIO_PATH, 'utf8'),
  readFile(COURSE_CONTENT_CREATOR_AUDIO_PATH, 'utf8'),
]);
const [strategicThinkingMaterialDefinitions, workflowProductivityMaterialDefinitions, projectOperationsMaterialDefinitions, strategicThinkingAudioScripts, workflowProductivityAudioScripts, projectOperationsAudioScripts] = await Promise.all([
  readFile(COURSE_STRATEGIC_THINKING_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_WORKFLOW_PRODUCTIVITY_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_PROJECT_OPERATIONS_MATERIALS_PATH, 'utf8').then(value => JSON.parse(value)),
  readFile(COURSE_STRATEGIC_THINKING_AUDIO_PATH, 'utf8'),
  readFile(COURSE_WORKFLOW_PRODUCTIVITY_AUDIO_PATH, 'utf8'),
  readFile(COURSE_PROJECT_OPERATIONS_AUDIO_PATH, 'utf8'),
]);
const selfTrustCourseMaterials = expandSelfTrustMaterials(selfTrustMaterialDefinitions);
const adhdCourseMaterials = expandAdhdMaterials(adhdMaterialDefinitions);
const bachCourseMaterials = expandBachMaterials(bachMaterialDefinitions);
const lifeCourseMaterials = expandLifeCoachMaterials(lifeMaterialDefinitions);
const circleCourseMaterials = expandWomensCircleMaterials(circleMaterialDefinitions);
const businessCourseMaterials = expandBusinessMaterials(businessMaterialDefinitions);
const partTimeBusinessCourseMaterials = expandBusinessMaterials(partTimeBusinessMaterialDefinitions);
const aiAgentCourseMaterials = expandAiAgentMaterials(aiAgentMaterialDefinitions);
const startupIdeaCourseMaterials = expandBusinessMaterials(startupIdeaMaterialDefinitions);
const businessDevelopmentCourseMaterials = expandBusinessMaterials(businessDevelopmentMaterialDefinitions);
const generativeAiMarketingCourseMaterials = expandAiAgentMaterials(generativeAiMarketingMaterialDefinitions);
const socialMediaManagementCourseMaterials = expandBusinessMaterials(socialMediaManagementMaterialDefinitions);
const canvaContentDesignCourseMaterials = expandBusinessMaterials(canvaContentDesignMaterialDefinitions);
const canvaAiSystemsCourseMaterials = expandBusinessMaterials(canvaAiSystemsMaterialDefinitions);
const contentMarketingCourseMaterials = expandBusinessMaterials(contentMarketingMaterialDefinitions);
const aiContentStudioCourseMaterials = expandBusinessMaterials(aiContentStudioMaterialDefinitions);
const visualContentStrategyCourseMaterials = expandBusinessMaterials(visualContentStrategyMaterialDefinitions);
const founderProductivityCourseMaterials = expandBusinessMaterials(founderProductivityMaterialDefinitions);
const capcutShortFormCourseMaterials = expandBusinessMaterials(capcutShortFormMaterialDefinitions);
const contentCreatorCourseMaterials = expandBusinessMaterials(contentCreatorMaterialDefinitions);
const strategicThinkingCourseMaterials = expandBusinessMaterials(strategicThinkingMaterialDefinitions);
const workflowProductivityCourseMaterials = expandBusinessMaterials(workflowProductivityMaterialDefinitions);
const projectOperationsCourseMaterials = expandBusinessMaterials(projectOperationsMaterialDefinitions);
const courseMaterials = [...selfTrustCourseMaterials, ...spiritualCourseMaterials, ...communicationCourseMaterials, ...cbtCourseMaterials, ...adhdCourseMaterials, ...bachCourseMaterials, ...lifeCourseMaterials, ...circleCourseMaterials, ...businessCourseMaterials, ...partTimeBusinessCourseMaterials, ...aiAgentCourseMaterials, ...startupIdeaCourseMaterials, ...businessDevelopmentCourseMaterials, ...generativeAiMarketingCourseMaterials, ...socialMediaManagementCourseMaterials, ...canvaContentDesignCourseMaterials, ...canvaAiSystemsCourseMaterials, ...contentMarketingCourseMaterials, ...aiContentStudioCourseMaterials, ...visualContentStrategyCourseMaterials, ...founderProductivityCourseMaterials, ...capcutShortFormCourseMaterials, ...contentCreatorCourseMaterials, ...strategicThinkingCourseMaterials, ...workflowProductivityCourseMaterials, ...projectOperationsCourseMaterials];
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
const businessAudioPack = courseMaterials.find(material => material.id === 'biz-audio-pack');
if (businessAudioPack) businessAudioPack.resourceMarkdown = businessAudioScripts;
const partTimeBusinessAudioPack = courseMaterials.find(material => material.id === 'pt-audio-pack');
if (partTimeBusinessAudioPack) partTimeBusinessAudioPack.resourceMarkdown = partTimeBusinessAudioScripts;
const aiAgentAudioPack = courseMaterials.find(material => material.id === 'ai-audio-pack');
if (aiAgentAudioPack) aiAgentAudioPack.resourceMarkdown = aiAgentAudioScripts;
const startupIdeaAudioPack = courseMaterials.find(material => material.id === 'idea-audio-pack');
if (startupIdeaAudioPack) startupIdeaAudioPack.resourceMarkdown = startupIdeaAudioScripts;
const businessDevelopmentAudioPack = courseMaterials.find(material => material.id === 'bd-audio-pack');
if (businessDevelopmentAudioPack) businessDevelopmentAudioPack.resourceMarkdown = businessDevelopmentAudioScripts;
const generativeAiMarketingAudioPack = courseMaterials.find(material => material.id === 'genai-audio-pack');
if (generativeAiMarketingAudioPack) generativeAiMarketingAudioPack.resourceMarkdown = generativeAiMarketingAudioScripts;
const socialMediaManagementAudioPack = courseMaterials.find(material => material.id === 'smm-audio-pack');
if (socialMediaManagementAudioPack) socialMediaManagementAudioPack.resourceMarkdown = socialMediaManagementAudioScripts;
const canvaContentDesignAudioPack = courseMaterials.find(material => material.id === 'canva-audio-pack');
if (canvaContentDesignAudioPack) canvaContentDesignAudioPack.resourceMarkdown = canvaContentDesignAudioScripts;
const canvaAiSystemsAudioPack = courseMaterials.find(material => material.id === 'canva-ai-audio-pack');
if (canvaAiSystemsAudioPack) canvaAiSystemsAudioPack.resourceMarkdown = canvaAiSystemsAudioScripts;
const contentMarketingAudioPack = courseMaterials.find(material => material.id === 'cm-audio-pack');
if (contentMarketingAudioPack) contentMarketingAudioPack.resourceMarkdown = contentMarketingAudioScripts;
const aiContentStudioAudioPack = courseMaterials.find(material => material.id === 'aic-audio-pack');
if (aiContentStudioAudioPack) aiContentStudioAudioPack.resourceMarkdown = aiContentStudioAudioScripts;
const visualContentStrategyAudioPack = courseMaterials.find(material => material.id === 'vcs-audio-pack');
if (visualContentStrategyAudioPack) visualContentStrategyAudioPack.resourceMarkdown = visualContentStrategyAudioScripts;
const founderProductivityAudioPack = courseMaterials.find(material => material.id === 'fpe-audio-pack');
if (founderProductivityAudioPack) founderProductivityAudioPack.resourceMarkdown = founderProductivityAudioScripts;
const capcutShortFormAudioPack = courseMaterials.find(material => material.id === 'cap-audio-pack');
if (capcutShortFormAudioPack) capcutShortFormAudioPack.resourceMarkdown = capcutShortFormAudioScripts;
const contentCreatorAudioPack = courseMaterials.find(material => material.id === 'ccp-audio-pack');
if (contentCreatorAudioPack) contentCreatorAudioPack.resourceMarkdown = contentCreatorAudioScripts;
const strategicThinkingAudioPack = courseMaterials.find(material => material.id === 'std-audio-pack');
if (strategicThinkingAudioPack) strategicThinkingAudioPack.resourceMarkdown = strategicThinkingAudioScripts;
const workflowProductivityAudioPack = courseMaterials.find(material => material.id === 'wpt-audio-pack');
if (workflowProductivityAudioPack) workflowProductivityAudioPack.resourceMarkdown = workflowProductivityAudioScripts;
const projectOperationsAudioPack = courseMaterials.find(material => material.id === 'pwo-audio-pack');
if (projectOperationsAudioPack) projectOperationsAudioPack.resourceMarkdown = projectOperationsAudioScripts;
for (const course of courses) {
  course.materials = courseMaterials.filter(material => material.courseId === course.id);
  attachCourseMastery(course);
}
const courseKnowledgeRecords = buildCourseKnowledge(courses);
const courseSearchIndex = buildCourseSearchIndex(courses);
const courseCoverage = courseKnowledgeCoverage(courses, courseKnowledgeRecords);
if (!courseCoverage.complete) {
  throw new Error(`Kurzová znalostní vrstva není úplná: ${JSON.stringify(courseCoverage)}`);
}
const courseVisualCoverageStatus = courses.reduce((summary, course) => ({
  items: summary.items + Number(course.visuals?.itemCount || 0),
  visuals: summary.visuals + Number(course.visuals?.visualCount || 0),
  authored: summary.authored + Number(course.visuals?.authoredCount || 0),
  contentDerived: summary.contentDerived + Number(course.visuals?.contentDerivedCount || 0),
}), { items: 0, visuals: 0, authored: 0, contentDerived: 0 });
courseVisualCoverageStatus.coveragePercent = courseVisualCoverageStatus.items
  ? Number((courseVisualCoverageStatus.visuals / courseVisualCoverageStatus.items * 100).toFixed(2))
  : 0;
courseVisualCoverageStatus.complete = courseVisualCoverageStatus.items > 0
  && courseVisualCoverageStatus.items === courseVisualCoverageStatus.visuals;
if (!courseVisualCoverageStatus.complete) {
  throw new Error(`Kurzová vizuální vrstva není úplná: ${JSON.stringify(courseVisualCoverageStatus)}`);
}
const courseStudyLoadCoverage = aggregateCourseStudyLoad(courses);
if (!courseStudyLoadCoverage.complete) {
  throw new Error(`Časový rozsah kurzů není úplně doložený: ${JSON.stringify(courseStudyLoadCoverage)}`);
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
const academyTrainerRelease = JSON.parse(await readFile(ACADEMY_TRAINER_RELEASE_PATH, 'utf8'));
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
const answerTraining = createCourseTrainer({ knowledgeRecords: courseKnowledgeRecords });
const worksheets = buildWorksheetLibrary(techniqueAtlas);
const app = express();
const publicTestRateBuckets = new Map();

const browserConnectSources = ["'self'", ...new Set([
  process.env.NEON_AUTH_URL,
  process.env.NEON_DATA_API_URL,
].filter(Boolean).map(value => {
  try { return new URL(value).origin; }
  catch { return ''; }
}).filter(Boolean))];

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
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
  response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.on('finish', () => {
    if (response.statusCode < 500 || request.path === '/api/client-error') return;
    reportOperationalError({
      severity: 'error',
      area: 'http',
      code: `HTTP_${response.statusCode}`,
      path: request.path,
      requestId: request.get('x-vercel-id') || '',
      summary: 'Server request finished with a 5xx response.',
    }).catch(() => {});
  });
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
    lifecycleEmail: lifecycleConfigured(),
    cron: Boolean(process.env.CRON_SECRET),
    runtimeSchema: runtimeSchemaStatus().ready,
    certificateSigning: certificateSigningConfigured(),
  };
  const ok = Object.values(dependencies).every(Boolean);
  return response.status(ok ? 200 : 503).set('Cache-Control', 'no-store').json({
    ok,
    service: 'elitea',
    timestamp: new Date().toISOString(),
    dependencies,
  });
});

app.get('/api/cron/lifecycle', async (request, response) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.get('authorization') !== `Bearer ${secret}`) {
    return response.status(401).set('Cache-Control', 'no-store').json({ error: 'Nepovolený lifecycle běh.' });
  }
  try {
    return response.set('Cache-Control', 'no-store').json(await runLifecycleEmails());
  } catch (error) {
    await reportOperationalError({ area: 'lifecycle_email', code: error?.code || 'LIFECYCLE_RUN_FAILED', path: request.path, summary: error });
    return response.status(error?.code === 'LIFECYCLE_NOT_CONFIGURED' ? 503 : 500).set('Cache-Control', 'no-store').json({ error: 'Lifecycle e-maily se nepodařilo zpracovat.' });
  }
});

app.get('/api/status', (_request, response) => {
  const launchReadiness = evaluateLaunchReadiness({
    automatedCases: 1004,
    academyTrainerCases: Number(academyTrainerRelease.caseCount || 0),
    academyTrainerPassRate: Number(academyTrainerRelease.passRate || 0) / 100,
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
    internalSpecialists: SPECIALIST_REGISTRY.length,
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
    courseVisualCoverage: courseVisualCoverageStatus,
    courseStudyLoadCoverage,
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
    academyTrainerEvaluation: {
      standardVersion: academyTrainerRelease.standardVersion,
      verifiedAt: academyTrainerRelease.verifiedAt,
      courseCount: academyTrainerRelease.courseCount,
      caseCount: academyTrainerRelease.caseCount,
      passedCases: academyTrainerRelease.passedCases,
      failedCases: academyTrainerRelease.failedCases,
      passRate: academyTrainerRelease.passRate,
      complete: academyTrainerRelease.complete,
    },
    memoryStorage: process.env.NEON_AUTH_URL && process.env.NEON_DATA_API_URL ? 'account-cloud-approved-state-session-only-chat' : 'local-browser',
    authConnected: Boolean(process.env.NEON_AUTH_URL && process.env.NEON_DATA_API_URL),
    bookingConnected: bookingConfigured(),
    paymentsConnected: paymentsConfigured(),
    foundingProgramConnected: foundingConfigured(),
    certificateAuthenticity: {
      signedPdf: certificateSigningConfigured(),
      externalVerification: certificateSigningConfigured(),
      verificationPath: '/overit-certifikat',
      visibleQrOrNumber: false,
    },
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
    return response.set('Cache-Control', 'no-store').json({
      ...(await foundingForMember(member)),
      owner: isOwnerMember(member),
    });
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

app.get('/api/ai-usage', async (request, response) => {
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    const membership = await membershipFor(member);
    if (!['owner', 'trialing', 'active'].includes(membership.status)) {
      return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Pro přehled využití je potřeba aktivní členství.' });
    }
    return response.set('Cache-Control', 'no-store').json(await readAiUsage(member, membership));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Využití AI se nepodařilo načíst.' });
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

app.post('/api/courses/:slug/quizzes/:itemId/submit', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ testu.' });
  try {
    const member = await authorizeAiRequest(request);
    const course = courses.find(candidate => candidate.slug === request.params.slug);
    const item = course?.modules.flatMap(module => module.items || []).find(candidate =>
      candidate.id === request.params.itemId && candidate.kind === 'quiz');
    if (!course || !item) return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Test nebyl nalezen.' });
    const result = await submitCourseQuizAttempt(member, course, item, request.body?.answers || {});
    return response.status(201).set('Cache-Control', 'private, no-store, max-age=0').json(result);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({
      error: error?.message || 'Test se nepodařilo vyhodnotit.',
      code: error?.code,
    });
  }
});

app.post('/api/certificates/verify', express.raw({ type: 'application/pdf', limit: '12mb' }), async (request, response) => {
  if (!allowPublicTestRequest(request, 'certificate-verify', 12, 15 * 60 * 1000)) {
    return response.status(429).set('Cache-Control', 'no-store').json({ error: 'Příliš mnoho ověření. Zkus to znovu za chvíli.' });
  }
  try {
    const result = await verifyCertificateDocument(request.body);
    return response.status(200).set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({
      error: error?.message || 'Certifikát se nepodařilo ověřit.',
      code: error?.code,
    });
  }
});

app.post('/api/internal/certificate-production-qa', async (request, response) => {
  const userId = String(request.body?.userId || '').trim();
  if (!authorizeCertificateQaRequest(request.get('authorization'), userId)) {
    return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Nenalezeno.' });
  }
  try {
    const course = courses.find(candidate => candidate.slug === String(request.body?.courseSlug || 'komunikace-ktera-funguje'));
    if (!course?.certificate) return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurz nebyl nalezen.' });
    const result = await runCertificateProductionQa({ member: { id: userId }, course, answerTraining });
    return response.status(200).set('Cache-Control', 'no-store').json(result);
  } catch (error) {
    await reportOperationalError({ area: 'academy_certificate', code: error?.code || 'CERTIFICATE_QA_FAILED', path: request.path, summary: error }).catch(() => {});
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({
      error: error?.message || 'Produkční QA certifikátu se nepodařilo dokončit.',
      code: error?.code,
      ...(error?.details ? { details: error.details } : {}),
    });
  }
});

app.post('/api/certificates/:slug/evidence', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ žádosti.' });
  try {
    const member = await authorizeAiRequest(request);
    const course = courses.find(item => item.slug === request.params.slug);
    if (!course?.certificate) return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurz s certifikátem nebyl nalezen.' });
    await syncCertificateEvidence(member, course, request.body || {});
    return response.set('Cache-Control', 'no-store').json(await certificateStatus(member, course));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Průběh kurzu se nepodařilo ověřit.', code: error?.code });
  }
});

app.get('/api/certificates/:slug/status', async (request, response) => {
  try {
    const member = await authorizeAiRequest(request);
    const course = courses.find(item => item.slug === request.params.slug);
    if (!course?.certificate) return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurz s certifikátem nebyl nalezen.' });
    return response.set('Cache-Control', 'no-store').json(await certificateStatus(member, course));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Stav certifikátu se nepodařilo načíst.', code: error?.code });
  }
});

app.post('/api/certificates/:slug/issue', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ žádosti.' });
  try {
    const member = await authorizeAiRequest(request);
    const course = courses.find(item => item.slug === request.params.slug);
    if (!course?.certificate) return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurz s certifikátem nebyl nalezen.' });
    return response.status(201).set('Cache-Control', 'no-store').json(await issueCertificate(member, course, request.body?.memberName));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Certifikát se nepodařilo vydat.', code: error?.code });
  }
});

app.get('/api/certificates/:slug/download', async (request, response) => {
  try {
    const member = await authorizeAiRequest(request);
    const course = courses.find(item => item.slug === request.params.slug);
    if (!course?.certificate) return response.status(404).set('Cache-Control', 'no-store').json({ error: 'Kurz s certifikátem nebyl nalezen.' });
    const pdf = await certificatePdf(member, course);
    const filename = `elitea-${String(course.slug).replace(/[^a-z0-9-]/gi, '-')}-certifikat.pdf`;
    return response.status(200)
      .set('Cache-Control', 'private, no-store')
      .set('Content-Type', 'application/pdf')
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .send(pdf);
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Certifikát se nepodařilo stáhnout.', code: error?.code });
  }
});

app.get('/api/course-search', async (request, response) => {
  try {
    await authorizeAiRequest(request);
    const query = String(request.query.q || '').trim().slice(0, 160);
    if (query.length < 2) return response.set('Cache-Control', 'private, no-store').json({ query, total: 0, items: [] });
    const items = searchCourseIndex(courseSearchIndex, query, 30);
    return response.set('Cache-Control', 'private, no-store').json({ query, total: items.length, items });
  } catch (error) {
    return response.status(error?.statusCode || 401).set('Cache-Control', 'no-store').json({ error: error?.message || 'Pro hledání v Academy se přihlas.' });
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

app.post('/api/client-error', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ hlášení.' });
  const event = sanitizeOperationalEvent({
    severity: 'error',
    area: 'browser',
    code: request.body?.code || 'CLIENT_ERROR',
    path: request.body?.path || request.path,
    summary: request.body?.summary || 'Client-side error',
    requestId: request.get('x-vercel-id') || '',
  });
  await reportOperationalError(event);
  return response.status(202).set('Cache-Control', 'no-store').json({ accepted: true });
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
    if (member) await reserveAiTurn(member, member.membership, {
      roleCode: sanitizeConsultationMode(request.body?.consultationMode) === 'brand_growth' ? 'brand_marketing' : 'coach_mentor',
    });
    const memory = sanitizeMemory(request.body?.memory);
    const consultationMode = sanitizeConsultationMode(request.body?.consultationMode);
    const brandWorkMode = sanitizeBrandWorkMode(request.body?.brandWorkMode);
    const result = await answer({
      messages: request.body?.messages,
      memory,
      consultationMode,
      brandWorkMode,
      techniqueSession: request.body?.techniqueSession,
      specialistSession: request.body?.specialistSession,
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
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.usage ? { usage: error.usage } : {}),
    });
  }
});

app.post('/api/public-coach-test/session', (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ testu.' });
  if (!allowPublicTestRequest(request, 'session', 4, 30 * 60 * 1000)) {
    return response.status(429).set('Cache-Control', 'no-store').json({ error: 'Z tohoto zařízení už bylo spuštěno několik testů. Zkus to znovu později.' });
  }
  try {
    return response.status(201).set('Cache-Control', 'no-store').json(issuePublicCoachTestSession(request.body));
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Test teď nelze spustit.' });
  }
});

app.post('/api/public-coach-test/chat', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ testu.' });
  if (!allowPublicTestRequest(request, 'chat', 24, 30 * 60 * 1000)) {
    return response.status(429).set('Cache-Control', 'no-store').json({ error: 'Limit veřejného testu byl vyčerpán. Zkus to později.' });
  }
  const startedAt = Date.now();
  try {
    const session = advancePublicCoachTestSession(request.body?.sessionToken, request.body?.messages);
    const result = await answer({
      messages: session.transcript,
      memory: publicTestMemory(session.payload.mode),
      consultationMode: session.payload.mode === 'mentor' ? 'business_mentoring' : 'coaching_session',
      brandWorkMode: 'collaborate',
    });
    console.log(JSON.stringify({
      level: 'info',
      message: 'public_coach_test_completed',
      requestId: request.get('x-vercel-id') || null,
      durationMs: Date.now() - startedAt,
      role: session.payload.mode,
      turn: session.nextSession.turnsUsed,
      provider: result.provider,
      qualityPassed: result.qualityGate?.pass ?? null,
    }));
    return response.set('Cache-Control', 'no-store').json({
      answer: result.text,
      mode: result.mode,
      provider: result.provider,
      qualityGate: result.qualityGate,
      session: session.nextSession,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'public_coach_test_failed', code: error?.code || 'UNKNOWN', durationMs: Date.now() - startedAt }));
    const gatewayLimited = /GatewayRateLimitError|rate-limit|rate limit/i.test(error?.message || '');
    return response.status(error?.statusCode || (gatewayLimited ? 429 : 500)).set('Cache-Control', 'no-store').json({
      error: gatewayLimited ? 'Kapacita testu je teď krátce vyčerpaná. Zkus odpověď znovu za chvíli.' : (error?.statusCode ? error.message : 'Elitea teď nemohla odpovědět. Zkus to prosím znovu.'),
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

app.post('/api/public-coach-test/feedback', async (request, response) => {
  if (!validMutationOrigin(request)) return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Neplatný původ hodnocení.' });
  if (!allowPublicTestRequest(request, 'feedback', 8, 60 * 60 * 1000)) {
    return response.status(429).set('Cache-Control', 'no-store').json({ error: 'Z tohoto zařízení už bylo odesláno více hodnocení.' });
  }
  const parsed = sanitizePublicCoachTestFeedback(request.body);
  if (!parsed.ok) return response.status(400).set('Cache-Control', 'no-store').json({ error: parsed.error });
  try {
    const result = await savePublicCoachTestFeedback(parsed.value);
    return response.status(201).set('Cache-Control', 'no-store').json({ ok: true, received: true, emailed: result.emailed });
  } catch (error) {
    await reportOperationalError({ area: 'public_coach_test', code: error?.code || 'FEEDBACK_SAVE_FAILED', path: request.path, summary: error });
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: 'Hodnocení se nepodařilo uložit. Zkus to prosím znovu.' });
  }
});

app.get('/api/public-coach-test/admin/feedback', async (request, response) => {
  try {
    const member = await verifyMemberAuthorization(request.get('authorization'));
    if (!isOwnerMember(member)) {
      return response.status(403).set('Cache-Control', 'no-store').json({ error: 'Tento přehled je dostupný pouze majitelce Elitea.' });
    }
    return response.set('Cache-Control', 'no-store').json(await listPublicCoachTestFeedback());
  } catch (error) {
    return response.status(error?.statusCode || 500).set('Cache-Control', 'no-store').json({ error: error?.message || 'Testy se nepodařilo načíst.' });
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
  const finalExam = request.body?.finalExam === true
    && activity === 'simulation'
    && String(request.body?.scenarioId || '') === String(context.course?.mastery?.finalExam?.scenarioId || '');
  console.log(JSON.stringify({ level: 'info', message: 'training_started', requestId, activity, phase, autoTransition, counterpartHint }));

  try {
    const member = await authorizeAiRequest(request);
    if (member) await reserveAiTurn(member, member.membership, {
      roleCode: activity === 'simulation' && context.course.categoryId === 'coaching-mental-health'
        ? 'coaching_trainer'
        : 'study_trainer',
    });
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
      finalExam,
    });
    if (member && finalExam && phase === 'debrief') {
      await recordCertificateExamAttempt({
        member,
        course: context.course,
        item: context.item,
        scenarioId: request.body?.scenarioId,
        messages: request.body?.messages,
        result,
      }).catch(async error => {
        await reportOperationalError({ area: 'academy_certificate', code: error?.code || 'EXAM_RECORD_FAILED', path: request.path, summary: error });
      });
    }
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
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.usage ? { usage: error.usage } : {}),
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
  if (!paymentsConfigured()) return { ...member, membership: { status: 'preview', plan_code: 'elitea-preview' } };
  const membership = await membershipFor(member);
  if (!['owner', 'trialing', 'active'].includes(membership.status)) {
    throw Object.assign(new Error('Pro použití Elitey je potřeba aktivní zkušební období nebo členství.'), { statusCode: 403 });
  }
  return { ...member, membership };
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

function allowPublicTestRequest(request, action, limit, windowMs) {
  const now = Date.now();
  const forwarded = String(request.get('x-forwarded-for') || '').split(',')[0].trim();
  const identity = `${forwarded || request.ip || 'unknown'}|${String(request.get('user-agent') || '').slice(0, 160)}`;
  const key = `${action}:${identity}`;
  const bucket = publicTestRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    publicTestRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    prunePublicTestRateBuckets(now);
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function prunePublicTestRateBuckets(now) {
  if (publicTestRateBuckets.size < 500) return;
  for (const [key, bucket] of publicTestRateBuckets) {
    if (bucket.resetAt <= now) publicTestRateBuckets.delete(key);
  }
}

app.get('/coach-test', (_request, response) => {
  response.set('Cache-Control', 'no-store').sendFile(join(PUBLIC_DIR, 'coach-test.html'));
});

app.get('/overit-certifikat', (_request, response) => {
  response.set('Cache-Control', 'no-store').sendFile(join(PUBLIC_DIR, 'certificate-verify.html'));
});

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
