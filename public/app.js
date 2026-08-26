import { activeDayLabel, localDayKey, recordActiveDay } from './activity.js';
import { createEliteaCloud } from './cloud.js';
import {
  anonymousOutcomeRows,
  beginMeasuredSession,
  dueFollowUps,
  finishMeasuredSession,
  loadOutcomeStore,
  outcomeRowsToCsv,
  outcomeSummary,
  recordOutcomeFollowUp,
  saveOutcomeStore,
} from './outcomes.js';

const APP_VERSION = '0.26.0';

const ACADEMY_CATEGORIES = [
  { id: 'coach-mentor', label: 'Kouč & Mentor', courseCategories: ['coaching-mental-health'], description: 'Výcviky pro koučovací praxi, sebedůvěru, práci s myšlením a chováním i bezpečnou neklinickou podporu klientek.' },
  { id: 'brand-marketing', label: 'Brand & Marketing', courseCategories: ['marketing', 'business-strategy'], description: 'Praktické programy pro značku, obsah, kampaně, nabídku, komunikaci, prodej a udržitelný růst.' },
];

const CONSULTATION_MODES = ['auto', 'coaching_session', 'business_mentoring', 'nlp_reframing', 'behavioral_change', 'somatic_regulation', 'brand_growth'];
const TRAINING_ROLES = new Set(['coach_training', 'brand_training']);
const storedTrainingSessions = loadTrainingSessionStore();
const requestedAssistantRole = sessionStorage.getItem('elitea.assistantRole');
const initialAssistantRole = ['coach', 'coach_training', 'brand', 'brand_training'].includes(requestedAssistantRole)
  && (!TRAINING_ROLES.has(requestedAssistantRole) || storedTrainingSessions[requestedAssistantRole])
  ? requestedAssistantRole
  : 'coach';
const storedInitialMode = normalizeConsultationMode(sessionStorage.getItem('elitea.consultationMode'));
const initialConsultationMode = initialAssistantRole === 'brand' ? 'brand_growth' : storedInitialMode === 'brand_growth' ? 'auto' : storedInitialMode;
const storedConversations = loadConversationStore();
const legacyMessages = loadLegacyMessages();
if (!storedConversations[initialConsultationMode]?.length && legacyMessages.length) {
  storedConversations[initialConsultationMode] = legacyMessages;
}
const storedLastMethods = loadLastMethodStore();
const storedTechniqueSessions = loadTechniqueSessionStore();
const legacyLastMethod = loadLegacyLastMethod();
if (!storedLastMethods[initialConsultationMode] && legacyLastMethod) {
  storedLastMethods[initialConsultationMode] = legacyLastMethod;
}

const state = {
  messages: TRAINING_ROLES.has(initialAssistantRole)
    ? [...(storedTrainingSessions[initialAssistantRole]?.messages || [])]
    : [...(storedConversations[initialConsultationMode] || [])],
  conversations: storedConversations,
  memory: loadLocalMemory(),
  consultationMode: initialConsultationMode,
  pendingModeSwitch: null,
  pending: false,
  lastMethods: storedLastMethods,
  lastMethod: storedLastMethods[initialConsultationMode] || null,
  techniqueSessions: storedTechniqueSessions,
  content: [],
  categories: [],
  contentFilter: 'all',
  contentSearch: '',
  favorites: new Set(JSON.parse(localStorage.getItem('elitea.contentFavorites') || '[]')),
  handoffDraft: '',
  bookingWithDocument: false,
  bookingRequestId: '',
  courses: [],
  academyCategory: 'all',
  worksheets: [],
  worksheetCategories: [],
  worksheetFilter: 'all',
  worksheetSearch: '',
  worksheetEntries: loadWorksheetEntries(),
  activeWorksheet: null,
  activeCourse: null,
  activeItemIndex: 0,
  masteryTab: 'journey',
  masteryProgress: loadCourseMasteryProgress(),
  courseProgress: new Set(JSON.parse(localStorage.getItem('elitea.courseProgress') || '[]')),
  courseNotes: loadCourseNotes(),
  assistantRole: initialAssistantRole,
  coachConsultationMode: normalizeCoachConsultationMode(sessionStorage.getItem('elitea.coachConsultationMode') || initialConsultationMode),
  brandWorkMode: sessionStorage.getItem('elitea.brandWorkMode') === 'execute' ? 'execute' : 'collaborate',
  trainingSessions: storedTrainingSessions,
  trainingSession: storedTrainingSessions[initialAssistantRole] || null,
  trainingPortfolio: loadTrainingPortfolio(),
  outcomes: loadOutcomeStore(),
  outcomeDialogStep: 'start',
  selectedOutcomeId: null,
  pendingOutcomeClosure: false,
  lastCoachTurnMeta: null,
  qualityReportTarget: null,
  currentView: 'member',
  systemStatus: null,
  cloud: null,
  cloudSession: null,
  authRequired: false,
  authMode: 'signup',
  pendingEntryView: 'member',
  membership: null,
  marketingOperator: null,
  browserSession: null,
  browserActionDraft: null,
  founding: { public: null, me: null },
};

const elements = {
  status: document.querySelector('#status-pill'),
  chatForm: document.querySelector('#chat-form'),
  chatInput: document.querySelector('#chat-input'),
  chatScroll: document.querySelector('#chat-scroll'),
  messages: document.querySelector('#messages'),
  qualityReportDialog: document.querySelector('#quality-report-dialog'),
  qualityReportForm: document.querySelector('#quality-report-form'),
  qualityReportStatus: document.querySelector('#quality-report-status'),
  welcome: document.querySelector('#welcome-block'),
  welcomeTitle: document.querySelector('#welcome-title'),
  welcomeCopy: document.querySelector('.welcome-copy'),
  sessionTransparency: document.querySelector('.session-transparency'),
  sessionGrid: document.querySelector('.session-grid'),
  newChat: document.querySelector('#new-chat'),
  memoryDialog: document.querySelector('#memory-dialog'),
  memoryForm: document.querySelector('#memory-form'),
  memoryButton: document.querySelector('#memory-button'),
  editMemoryInline: document.querySelector('#edit-memory-inline'),
  deleteMemory: document.querySelector('#delete-memory'),
  goalText: document.querySelector('#goal-text'),
  goalDescription: document.querySelector('#goal-description'),
  taskText: document.querySelector('#task-text'),
  taskButton: document.querySelector('#task-button'),
  taskCheck: document.querySelector('#task-check'),
  memoryName: document.querySelector('#memory-name'),
  memoryStage: document.querySelector('#memory-stage'),
  memoryIndustry: document.querySelector('#memory-industry'),
  memoryCustomer: document.querySelector('#memory-customer'),
  handoffButton: document.querySelector('#handoff-button'),
  mobileHandoffButton: document.querySelector('#mobile-handoff-button'),
  handoffDialog: document.querySelector('#handoff-dialog'),
  handoffChoice: document.querySelector('#handoff-choice'),
  handoffPreview: document.querySelector('#handoff-preview'),
  handoffReady: document.querySelector('#handoff-ready'),
  handoffBooking: document.querySelector('#handoff-booking'),
  handoffTopic: document.querySelector('#handoff-topic'),
  handoffDocument: document.querySelector('#handoff-document'),
  handoffConsent: document.querySelector('#handoff-consent'),
  handoffReadyTitle: document.querySelector('#handoff-ready-title'),
  handoffReadyCopy: document.querySelector('#handoff-ready-copy'),
  handoffSharingStatus: document.querySelector('#handoff-sharing-status'),
  bookingForm: document.querySelector('#booking-form'),
  bookingName: document.querySelector('#booking-name'),
  bookingDate: document.querySelector('#booking-date'),
  bookingSharingStatus: document.querySelector('#booking-sharing-status'),
  bookingConsentCopy: document.querySelector('#booking-consent-copy'),
  bookingError: document.querySelector('#booking-error'),
  onboardingButton: document.querySelector('#start-onboarding'),
  memoryObstacle: document.querySelector('#memory-obstacle'),
  memorySupport: document.querySelector('#memory-support'),
  memoryLastFocus: document.querySelector('#memory-last-focus'),
  methodName: document.querySelector('#method-name'),
  methodDescription: document.querySelector('#method-description'),
  activeDayCount: document.querySelector('#active-day-count'),
  journeyStage: document.querySelector('#journey-stage'),
  journeyProgress: document.querySelector('#journey-progress'),
  chatPanel: document.querySelector('.chat-panel'),
  insightPanel: document.querySelector('.insight-panel'),
  contentPanel: document.querySelector('#content-panel'),
  memberPanel: document.querySelector('#member-panel'),
  communityPanel: document.querySelector('#community-panel'),
  academyPanel: document.querySelector('#academy-panel'),
  worksheetsPanel: document.querySelector('#worksheets-panel'),
  worksheetFilters: document.querySelector('#worksheet-filters'),
  worksheetSearch: document.querySelector('#worksheet-search'),
  worksheetGrid: document.querySelector('#worksheets-grid'),
  worksheetEmpty: document.querySelector('#worksheets-empty'),
  worksheetCount: document.querySelector('#worksheet-count'),
  worksheetProgressCount: document.querySelector('#worksheet-progress-count'),
  worksheetDialog: document.querySelector('#worksheet-dialog'),
  worksheetForm: document.querySelector('#worksheet-form'),
  worksheetDialogCategory: document.querySelector('#worksheet-dialog-category'),
  worksheetDialogTitle: document.querySelector('#worksheet-dialog-title'),
  worksheetDialogMeta: document.querySelector('#worksheet-dialog-meta'),
  worksheetDialogMethod: document.querySelector('#worksheet-dialog-method'),
  worksheetDialogBoundary: document.querySelector('#worksheet-dialog-boundary'),
  worksheetDialogPurpose: document.querySelector('#worksheet-dialog-purpose'),
  worksheetDialogDiscovery: document.querySelector('#worksheet-dialog-discovery'),
  worksheetDialogTakeaway: document.querySelector('#worksheet-dialog-takeaway'),
  worksheetDialogUsage: document.querySelector('#worksheet-dialog-usage'),
  worksheetResource: document.querySelector('#worksheet-resource'),
  worksheetResourceContent: document.querySelector('#worksheet-resource-content'),
  worksheetFields: document.querySelector('#worksheet-fields'),
  worksheetSaveStatus: document.querySelector('#worksheet-save-status'),
  academyHome: document.querySelector('#academy-home'),
  academyCourseGrid: document.querySelector('#academy-course-grid'),
  academyCategoryFilters: document.querySelector('#academy-category-filters'),
  academyNavCount: document.querySelector('#academy-nav-count'),
  courseReader: document.querySelector('#course-reader'),
  courseOutline: document.querySelector('#course-outline'),
  courseMastery: document.querySelector('#course-mastery'),
  courseMasteryPromise: document.querySelector('#course-mastery-promise'),
  courseMasteryPercent: document.querySelector('#course-mastery-percent'),
  masteryTabs: document.querySelector('#mastery-tabs'),
  masteryToggle: document.querySelector('#mastery-toggle'),
  courseMasteryContent: document.querySelector('#course-mastery-content'),
  readerCourseTitle: document.querySelector('#reader-course-title'),
  readerCourseBadge: document.querySelector('.course-reader-head .course-badge'),
  lessonModuleLabel: document.querySelector('#lesson-module-label'),
  lessonModulePosition: document.querySelector('#lesson-module-position'),
  lessonTitle: document.querySelector('#lesson-title'),
  lessonKind: document.querySelector('#lesson-kind'),
  lessonTime: document.querySelector('#lesson-time'),
  lessonVisual: document.querySelector('#lesson-visual'),
  lessonContent: document.querySelector('#lesson-content'),
  lessonMaterials: document.querySelector('#lesson-materials'),
  lessonMaterialsTitle: document.querySelector('#lesson-materials-title'),
  lessonMaterialsProgress: document.querySelector('#lesson-materials-progress'),
  lessonMaterialList: document.querySelector('#lesson-material-list'),
  lessonNotes: document.querySelector('#lesson-notes'),
  lessonNotesStatus: document.querySelector('#lesson-notes-status'),
  readerProgressPercent: document.querySelector('#reader-progress-percent'),
  memberCourseProgress: document.querySelector('#member-course-progress'),
  memberCourseProgressCopy: document.querySelector('#member-course-progress-copy'),
  categoryFilters: document.querySelector('#category-filters'),
  contentGrid: document.querySelector('#content-grid'),
  libraryEmpty: document.querySelector('#library-empty'),
  libraryCount: document.querySelector('#library-count'),
  librarySearch: document.querySelector('#library-search'),
  libraryTopButton: document.querySelector('#library-top-button'),
  consultationMode: document.querySelector('#consultation-mode'),
  sessionToolbar: document.querySelector('.session-toolbar'),
  sessionModeDescription: document.querySelector('#session-mode-description'),
  endSession: document.querySelector('#end-session'),
  outcomeCard: document.querySelector('#outcome-card'),
  outcomeCardTitle: document.querySelector('#outcome-card-title'),
  outcomeCardCopy: document.querySelector('#outcome-card-copy'),
  outcomePrimaryButton: document.querySelector('#outcome-primary-button'),
  outcomeToolbarButton: document.querySelector('#outcome-toolbar-button'),
  outcomeHistoryButton: document.querySelector('#outcome-history-button'),
  outcomeDialog: document.querySelector('#outcome-dialog'),
  outcomeForm: document.querySelector('#outcome-form'),
  outcomeDialogOverline: document.querySelector('#outcome-dialog-overline'),
  outcomeDialogTitle: document.querySelector('#outcome-dialog-title'),
  outcomeDialogCopy: document.querySelector('#outcome-dialog-copy'),
  outcomeFollowupRecap: document.querySelector('#outcome-followup-recap'),
  outcomeSummaryGrid: document.querySelector('#outcome-summary-grid'),
  outcomeHistoryList: document.querySelector('#outcome-history-list'),
  outcomeFormStatus: document.querySelector('#outcome-form-status'),
  outcomeExport: document.querySelector('#outcome-export'),
  outcomeSubmit: document.querySelector('#submit-outcome'),
  modeResumeDialog: document.querySelector('#mode-resume-dialog'),
  modeResumeArea: document.querySelector('#mode-resume-area'),
  modeResumeTopic: document.querySelector('#mode-resume-topic'),
  modeResumeLast: document.querySelector('#mode-resume-last'),
  modeResumeNext: document.querySelector('#mode-resume-next'),
  courseRequestForm: document.querySelector('#course-request-form'),
  courseRequestStatus: document.querySelector('#course-request-status'),
  chatRoleLabel: document.querySelector('#chat-role-label'),
  chatRoleDescription: document.querySelector('#chat-role-description'),
  trainingBanner: document.querySelector('#training-banner'),
  trainingModeLabel: document.querySelector('#training-mode-label'),
  trainingTitle: document.querySelector('#training-title'),
  trainingContext: document.querySelector('#training-context'),
  trainingDifficultyWrap: document.querySelector('#training-difficulty-wrap'),
  trainingDifficulty: document.querySelector('#training-difficulty'),
  trainingPortfolioStatus: document.querySelector('#training-portfolio-status'),
  brandAgentBanner: document.querySelector('#brand-agent-banner'),
  brandAgentStateLabel: document.querySelector('#brand-agent-state-label'),
  brandAgentStateTitle: document.querySelector('#brand-agent-state-title'),
  brandAgentStateCopy: document.querySelector('#brand-agent-state-copy'),
  brandExecutionNote: document.querySelector('#brand-execution-note'),
  browserOperatorDialog: document.querySelector('#browser-operator-dialog'),
  browserOperatorStart: document.querySelector('#browser-operator-start'),
  browserOperatorStatus: document.querySelector('#browser-operator-status'),
  browserAgentPanel: document.querySelector('#browser-agent-panel'),
  browserAgentForm: document.querySelector('#browser-agent-form'),
  browserAgentInstruction: document.querySelector('#browser-agent-instruction'),
  browserAgentPreviewButton: document.querySelector('#browser-agent-preview-button'),
  browserActionPreview: document.querySelector('#browser-action-preview'),
  browserActionRisk: document.querySelector('#browser-action-risk'),
  browserActionDescription: document.querySelector('#browser-action-description'),
  browserActionManual: document.querySelector('#browser-action-manual'),
  browserActionExecute: document.querySelector('#browser-action-execute'),
  browserActionDismiss: document.querySelector('#browser-action-dismiss'),
  browserLiveWrap: document.querySelector('#browser-live-wrap'),
  browserLiveView: document.querySelector('#browser-live-view'),
  browserLiveLabel: document.querySelector('#browser-live-label'),
  endBrowserOperator: document.querySelector('#end-browser-operator'),
  finishTraining: document.querySelector('#finish-training'),
  retryTraining: document.querySelector('#retry-training'),
  exitTraining: document.querySelector('#exit-training'),
  lessonTrainerLabel: document.querySelector('#lesson-trainer-label'),
  lessonTrainerTitle: document.querySelector('#lesson-trainer-title'),
  lessonTrainerDescription: document.querySelector('#lesson-trainer-description'),
  discussLesson: document.querySelector('#discuss-lesson'),
  simulateLesson: document.querySelector('#simulate-lesson'),
  lessonTrainingStatus: document.querySelector('#lesson-training-status'),
  chatDisclaimer: document.querySelector('#chat-disclaimer'),
  authDialog: document.querySelector('#auth-dialog'),
  authForm: document.querySelector('#auth-form'),
  authNameWrap: document.querySelector('#auth-name-wrap'),
  authName: document.querySelector('#auth-name'),
  authEmail: document.querySelector('#auth-email'),
  authPassword: document.querySelector('#auth-password'),
  authConsentWrap: document.querySelector('#auth-consent-wrap'),
  authConsent: document.querySelector('#auth-consent'),
  authTitle: document.querySelector('#auth-title'),
  authCopy: document.querySelector('#auth-copy'),
  authSubmit: document.querySelector('#auth-submit'),
  authSwitch: document.querySelector('#auth-switch'),
  authError: document.querySelector('#auth-error'),
  accountButton: document.querySelector('#account-button'),
  accountDialog: document.querySelector('#account-dialog'),
  accountEmail: document.querySelector('#account-email'),
  accountMembershipStatus: document.querySelector('#account-membership-status'),
  accountMembershipDetail: document.querySelector('#account-membership-detail'),
  accountBilling: document.querySelector('#account-billing'),
  accountLogout: document.querySelector('#account-logout'),
  accountError: document.querySelector('#account-error'),
  foundingCapacity: document.querySelector('#founding-capacity'),
  foundingDialog: document.querySelector('#founding-dialog'),
  foundingForm: document.querySelector('#founding-form'),
  foundingSubmit: document.querySelector('#founding-submit'),
  foundingError: document.querySelector('#founding-error'),
  foundingSuccess: document.querySelector('#founding-success'),
  foundingFeedbackDialog: document.querySelector('#founding-feedback-dialog'),
  foundingFeedbackForm: document.querySelector('#founding-feedback-form'),
  foundingFeedbackError: document.querySelector('#founding-feedback-error'),
  foundingFeedbackSuccess: document.querySelector('#founding-feedback-success'),
  foundingFeedbackButton: document.querySelector('#founding-feedback-button'),
  foundingAccountCard: document.querySelector('#founding-account-card'),
  foundingAccountStatus: document.querySelector('#founding-account-status'),
  foundingAccountDetail: document.querySelector('#founding-account-detail'),
  foundingAdminButton: document.querySelector('#founding-admin-button'),
  foundingAdminDialog: document.querySelector('#founding-admin-dialog'),
  foundingAdminSummary: document.querySelector('#founding-admin-summary'),
  foundingAdminList: document.querySelector('#founding-admin-list'),
};

await initialize();

async function initialize() {
  localStorage.removeItem('elitea.messages');
  localStorage.removeItem('elitea.lastMethod');
  await initializeCloud();
  await loadFoundingPublicStatus();
  await loadStatus();
  await loadMarketingOperatorStatus();
  await loadContent();
  await loadCourses();
  await loadWorksheets();
  renderMemory();
  renderConsultationMode();
  renderAssistantRole();
  renderMessages();
  renderOutcomeCard();
  bindEvents();
  const requestedMemberView = window.location.hash.match(/^#app-(member|chat|community|academy|worksheets|library)$/)?.[1];
  if (requestedMemberView) requestMembershipEntry(requestedMemberView);
  else switchView('member');
  autoResize();
}

async function initializeCloud() {
  try {
    const config = await request('/api/client-config');
    state.authRequired = Boolean(config?.authUrl && config?.dataApiUrl);
    state.cloud = createEliteaCloud(config);
    if (!state.cloud) return;
    try {
      state.cloudSession = await state.cloud.session();
      if (state.cloudSession) {
        await state.cloud.loadState();
        hydrateStudyStateFromLocalStorage();
        await refreshFoundingStatus();
      }
    } catch (error) {
      state.cloudSession = null;
      console.warn('Elitea auth session could not be restored.', error?.message || error);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') state.cloud?.saveState().catch(() => {});
    });
  } catch (error) {
    state.cloud = null;
    console.warn('Elitea cloud could not initialize.', error?.message || error);
  }
}

function hydrateStudyStateFromLocalStorage() {
  state.memory = loadLocalMemory();
  state.favorites = new Set(JSON.parse(localStorage.getItem('elitea.contentFavorites') || '[]'));
  state.worksheetEntries = loadWorksheetEntries();
  state.masteryProgress = loadCourseMasteryProgress();
  state.courseProgress = new Set(JSON.parse(localStorage.getItem('elitea.courseProgress') || '[]'));
  state.courseNotes = loadCourseNotes();
  state.trainingPortfolio = loadTrainingPortfolio();
  state.outcomes = loadOutcomeStore();
}

function bindEvents() {
  elements.chatForm.addEventListener('submit', onSubmit);
  elements.chatInput.addEventListener('input', autoResize);
  elements.chatInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });

  document.querySelectorAll('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      elements.chatInput.value = button.dataset.prompt;
      elements.chatForm.requestSubmit();
    });
  });

  document.querySelectorAll('[data-consultation-mode]').forEach(button => {
    button.addEventListener('click', () => {
      setConsultationMode(button.dataset.consultationMode);
      elements.chatInput.focus();
    });
  });

  document.querySelectorAll('[data-assistant-role]').forEach(button => {
    button.addEventListener('click', () => setAssistantRole(button.dataset.assistantRole));
  });

  document.querySelectorAll('[data-open-role]').forEach(button => {
    button.addEventListener('click', () => setAssistantRole(button.dataset.openRole));
  });

  document.querySelectorAll('[data-open-academy-branch]').forEach(button => {
    button.addEventListener('click', () => {
      state.academyCategory = button.dataset.openAcademyBranch;
      renderAcademy();
      switchView('academy');
    });
  });

  document.querySelectorAll('[data-member-booking]').forEach(button => {
    button.addEventListener('click', openHandoff);
  });

  document.querySelectorAll('[data-brand-work-mode]').forEach(button => {
    button.addEventListener('click', () => setBrandWorkMode(button.dataset.brandWorkMode));
  });
  document.querySelector('#open-browser-operator')?.addEventListener('click', openBrowserOperator);
  document.querySelectorAll('[data-browser-target]').forEach(button => {
    button.addEventListener('click', () => startBrowserOperator(button.dataset.browserTarget));
  });
  document.querySelector('#close-browser-operator')?.addEventListener('click', closeBrowserOperator);
  elements.endBrowserOperator?.addEventListener('click', closeBrowserOperator);
  elements.browserAgentForm?.addEventListener('submit', previewBrowserAction);
  elements.browserActionExecute?.addEventListener('click', executeBrowserActionDraft);
  elements.browserActionDismiss?.addEventListener('click', clearBrowserActionDraft);
  elements.browserOperatorDialog?.addEventListener('cancel', event => {
    event.preventDefault();
    closeBrowserOperator();
  });

  elements.consultationMode.addEventListener('change', event => {
    setConsultationMode(event.target.value);
  });

  document.querySelector('#close-mode-resume').addEventListener('click', closeModeResume);
  document.querySelector('#resume-mode-session').addEventListener('click', resumeModeSession);
  document.querySelector('#start-fresh-mode').addEventListener('click', startFreshModeSession);
  elements.modeResumeDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeModeResume();
  });

  elements.endSession.addEventListener('click', () => {
    if (state.pending) return;
    state.pendingOutcomeClosure = Boolean(activeOutcomeSession());
    elements.chatInput.value = 'Chci tuto konzultaci uzavřít. Shrň prosím podstatné uvědomění, moje rozhodnutí a případný další krok, na kterém jsme se skutečně domluvily.';
    elements.chatForm.requestSubmit();
  });

  elements.outcomePrimaryButton?.addEventListener('click', openPrimaryOutcomeAction);
  elements.outcomeToolbarButton?.addEventListener('click', openPrimaryOutcomeAction);
  elements.outcomeHistoryButton?.addEventListener('click', () => openOutcomeDialog('history'));
  elements.outcomeForm?.addEventListener('submit', submitOutcomeForm);
  document.querySelector('#close-outcome')?.addEventListener('click', closeOutcomeDialog);
  document.querySelector('#cancel-outcome')?.addEventListener('click', closeOutcomeDialog);
  elements.outcomeDialog?.addEventListener('cancel', event => {
    event.preventDefault();
    closeOutcomeDialog();
  });
  elements.outcomeForm?.elements.harmful_or_wrong?.addEventListener('change', event => {
    const label = elements.outcomeForm.querySelector('[data-outcome-issue]');
    label.hidden = !event.target.checked;
    label.querySelector('textarea').disabled = !event.target.checked;
  });
  elements.outcomeForm?.elements.worse_or_harmed?.addEventListener('change', event => {
    const label = elements.outcomeForm.querySelector('[data-outcome-harm]');
    label.hidden = !event.target.checked;
    label.querySelector('textarea').disabled = !event.target.checked;
  });
  elements.outcomeExport?.addEventListener('click', downloadAnonymousOutcomes);

  elements.newChat.addEventListener('click', () => {
    if (state.pending) return;
    if (isTrainingRole()) {
      if (state.trainingSession?.activity === 'simulation') retryTrainingSimulation();
      else restartStudySession();
      return;
    }
    state.messages = [];
    state.lastMethod = null;
    delete state.lastMethods[state.consultationMode];
    delete state.techniqueSessions[state.consultationMode];
    persistMessages();
    persistLastMethods();
    persistTechniqueSessions();
    sessionStorage.removeItem('elitea.lastMethod');
    renderMessages();
    renderMemory();
    renderOutcomeCard();
    elements.chatInput.focus();
  });
  elements.messages.addEventListener('click', handleMessageAction);
  elements.qualityReportForm?.addEventListener('submit', submitQualityReport);
  document.querySelector('#close-quality-report')?.addEventListener('click', closeQualityReport);
  document.querySelector('#cancel-quality-report')?.addEventListener('click', closeQualityReport);
  elements.qualityReportDialog?.addEventListener('cancel', event => {
    event.preventDefault();
    closeQualityReport();
  });

  elements.memoryButton.addEventListener('click', openMemory);
  document.querySelector('#mobile-memory-button')?.addEventListener('click', openMemory);
  elements.editMemoryInline.addEventListener('click', openMemory);
  document.querySelector('#edit-focus').addEventListener('click', openMemory);
  document.querySelector('#close-memory').addEventListener('click', () => elements.memoryDialog.close());
  document.querySelector('#cancel-memory').addEventListener('click', () => elements.memoryDialog.close());
  elements.memoryForm.addEventListener('submit', saveMemory);
  elements.deleteMemory.addEventListener('click', deleteMemory);
  elements.taskButton.addEventListener('click', completeTask);
  elements.handoffButton.addEventListener('click', openHandoff);
  elements.mobileHandoffButton?.addEventListener('click', openHandoff);
  document.querySelector('#close-handoff').addEventListener('click', closeHandoff);
  document.querySelector('#cancel-handoff').addEventListener('click', closeHandoff);
  document.querySelector('#prepare-handoff').addEventListener('click', prepareHandoffDraft);
  document.querySelector('#book-without-summary').addEventListener('click', bookWithoutSummary);
  document.querySelector('#back-to-handoff-choice').addEventListener('click', () => showHandoffStep('choice'));
  document.querySelector('#confirm-handoff').addEventListener('click', confirmHandoffDraft);
  document.querySelector('#finish-handoff').addEventListener('click', closeHandoff);
  document.querySelector('#back-to-handoff-preview').addEventListener('click', () => {
    showHandoffStep(state.bookingWithDocument ? 'preview' : 'choice');
  });
  elements.bookingForm.addEventListener('submit', submitBookingRequest);
  elements.handoffConsent.addEventListener('change', () => {
    document.querySelector('#confirm-handoff').disabled = !elements.handoffConsent.checked;
  });
  elements.handoffDocument.addEventListener('input', () => {
    elements.handoffConsent.checked = false;
    document.querySelector('#confirm-handoff').disabled = true;
  });
  elements.onboardingButton.addEventListener('click', startFirstConversation);
  document.querySelectorAll('[data-enter-app]').forEach(button => {
    button.addEventListener('click', () => requestMembershipEntry(button.dataset.startView || 'member'));
  });
  document.querySelector('#auth-close')?.addEventListener('click', () => elements.authDialog.close());
  elements.authSwitch?.addEventListener('click', () => setAuthMode(state.authMode === 'signup' ? 'signin' : 'signup'));
  elements.authForm?.addEventListener('submit', submitAuth);
  elements.accountButton?.addEventListener('click', openAccount);
  document.querySelector('#account-close')?.addEventListener('click', () => elements.accountDialog.close());
  elements.accountLogout?.addEventListener('click', signOutMember);
  elements.accountBilling?.addEventListener('click', openBillingPortal);
  document.querySelector('#public-return')?.addEventListener('click', showPublicSite);
  document.querySelectorAll('[data-open-founding]').forEach(button => button.addEventListener('click', openFoundingApplication));
  document.querySelector('#founding-close')?.addEventListener('click', () => elements.foundingDialog.close());
  elements.foundingForm?.addEventListener('submit', submitFoundingApplicationForm);
  document.querySelector('#founding-feedback-close')?.addEventListener('click', () => elements.foundingFeedbackDialog.close());
  elements.foundingFeedbackButton?.addEventListener('click', openFoundingFeedback);
  elements.foundingFeedbackForm?.addEventListener('submit', submitFoundingFeedbackForm);
  elements.foundingAdminButton?.addEventListener('click', openFoundingAdmin);
  document.querySelector('#founding-admin-close')?.addEventListener('click', () => elements.foundingAdminDialog.close());
  elements.foundingAdminList?.addEventListener('click', handleFoundingAdminAction);
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });
  elements.libraryTopButton.addEventListener('click', () => {
    switchView(state.currentView === 'academy' ? 'member' : 'academy');
  });
  document.querySelector('#back-to-coach').addEventListener('click', () => switchView('chat'));
  document.querySelector('#library-request-button')?.addEventListener('click', () => {
    switchView('member');
    requestAnimationFrame(() => {
      document.querySelector('#course-request-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      elements.courseRequestForm?.querySelector('textarea')?.focus({ preventScroll: true });
    });
  });
  elements.librarySearch.addEventListener('input', event => {
    state.contentSearch = event.target.value.trim().toLocaleLowerCase('cs');
    renderContent();
  });
  elements.categoryFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.contentFilter = button.dataset.category;
    renderContent();
  });
  elements.academyCategoryFilters?.addEventListener('click', event => {
    const button = event.target.closest('[data-academy-category]');
    if (!button) return;
    state.academyCategory = button.dataset.academyCategory;
    renderAcademy();
  });
  elements.worksheetSearch?.addEventListener('input', event => {
    state.worksheetSearch = event.target.value.trim().toLocaleLowerCase('cs');
    renderWorksheetLibrary();
  });
  elements.worksheetFilters?.addEventListener('click', event => {
    const button = event.target.closest('[data-worksheet-category]');
    if (!button) return;
    state.worksheetFilter = button.dataset.worksheetCategory;
    renderWorksheetLibrary();
  });
  elements.worksheetGrid?.addEventListener('click', event => {
    const button = event.target.closest('[data-open-worksheet]');
    if (button) openWorksheet(button.dataset.openWorksheet);
  });
  elements.lessonMaterialList?.addEventListener('click', event => {
    const button = event.target.closest('[data-open-course-material]');
    if (button) openWorksheet(button.dataset.openCourseMaterial);
  });
  elements.worksheetForm?.addEventListener('submit', saveWorksheet);
  document.querySelector('#worksheet-close')?.addEventListener('click', () => elements.worksheetDialog.close());
  document.querySelector('#worksheet-print')?.addEventListener('click', () => window.print());
  document.querySelector('#worksheet-discuss')?.addEventListener('click', discussWorksheet);
  document.querySelector('#member-edit-profile').addEventListener('click', openMemory);
  document.querySelectorAll('.feed-tabs button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.feed-tabs button').forEach(item => item.classList.toggle('active', item === button));
    });
  });
  document.querySelector('#community-event-button')?.addEventListener('click', event => {
    event.currentTarget.textContent = '✓ Přidáno do kalendáře';
    event.currentTarget.classList.add('completed');
  });
  elements.courseRequestForm?.addEventListener('submit', submitCourseRequest);
  document.addEventListener('click', event => {
    const courseButton = event.target.closest('[data-open-course]');
    if (courseButton) openCourse(courseButton.dataset.openCourse);
  });
  document.querySelector('#reader-back').addEventListener('click', closeCourseReader);
  document.querySelector('#course-outline').addEventListener('click', event => {
    const button = event.target.closest('[data-course-item]');
    if (button) openCourseItem(Number(button.dataset.courseItem));
  });
  elements.masteryTabs?.addEventListener('click', event => {
    const button = event.target.closest('[data-mastery-tab]');
    if (!button) return;
    state.masteryTab = button.dataset.masteryTab;
    renderCourseMastery();
  });
  elements.masteryToggle?.addEventListener('click', () => {
    const expanded = elements.courseMastery.classList.toggle('expanded');
    elements.masteryToggle.textContent = expanded ? 'Skrýt Mastery Lab' : 'Otevřít Mastery Lab';
  });
  elements.courseMasteryContent?.addEventListener('click', event => {
    const day = event.target.closest('[data-mastery-day]');
    const scenario = event.target.closest('[data-mastery-scenario]');
    const exam = event.target.closest('[data-mastery-exam]');
    if (day) toggleMasteryDay(day.dataset.masteryDay);
    if (scenario) startMasteryScenario(scenario.dataset.masteryScenario);
    if (exam) startMasteryScenario(state.activeCourse?.mastery?.finalExam?.scenarioId);
  });
  elements.courseMasteryContent?.addEventListener('change', saveMasteryField);
  elements.courseMasteryContent?.addEventListener('input', saveMasteryField);
  document.querySelector('#previous-lesson').addEventListener('click', () => openCourseItem(state.activeItemIndex - 1));
  document.querySelector('#next-lesson').addEventListener('click', () => openCourseItem(state.activeItemIndex + 1));
  document.querySelector('#complete-lesson').addEventListener('click', toggleCourseItemComplete);
  document.querySelector('#discuss-lesson').addEventListener('click', discussCurrentLesson);
  document.querySelector('#simulate-lesson').addEventListener('click', startCurrentLessonSimulation);
  elements.finishTraining.addEventListener('click', finishTrainingSimulation);
  elements.retryTraining.addEventListener('click', retryTrainingSimulation);
  elements.exitTraining.addEventListener('click', () => setAssistantRole('coach'));
  elements.trainingDifficulty.addEventListener('change', () => {
    if (state.trainingSession?.activity === 'simulation') retryTrainingSimulation();
  });
  elements.lessonNotes?.addEventListener('input', saveCurrentCourseNote);
  elements.contentGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-favorite]');
    if (!button) return;
    const id = button.dataset.favorite;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    localStorage.setItem('elitea.contentFavorites', JSON.stringify([...state.favorites]));
    syncCloudState();
    renderContent();
  });
}

async function loadFoundingPublicStatus() {
  try {
    state.founding.public = await request('/api/founding/status');
    const { remaining, capacity, open } = state.founding.public;
    elements.foundingCapacity.textContent = open
      ? `${remaining} z ${capacity} míst je zatím volných`
      : 'Kapacita programu je naplněná';
    document.querySelectorAll('[data-open-founding]').forEach(button => { button.disabled = !open; });
  } catch {
    elements.foundingCapacity.textContent = 'Přijímáme výběrové přihlášky';
  }
}

function openFoundingApplication() {
  elements.foundingError.hidden = true;
  elements.foundingSuccess.hidden = true;
  const email = state.cloudSession?.user?.email || '';
  const name = state.memory?.identity_preferences?.preferred_name || '';
  if (email) elements.foundingForm.elements.email.value = email;
  if (name) elements.foundingForm.elements.preferredName.value = name;
  elements.foundingDialog.showModal();
}

async function submitFoundingApplicationForm(event) {
  event.preventDefault();
  if (!elements.foundingForm.reportValidity()) return;
  const data = new FormData(elements.foundingForm);
  if (String(data.get('website') || '').trim()) return;
  elements.foundingSubmit.disabled = true;
  elements.foundingError.hidden = true;
  elements.foundingSuccess.hidden = true;
  try {
    await request('/api/founding/apply', {
      method: 'POST',
      body: JSON.stringify({
        preferredName: data.get('preferredName'),
        email: data.get('email'),
        whatsappPhone: data.get('whatsappPhone'),
        primaryFocus: data.get('primaryFocus'),
        motivation: data.get('motivation'),
        desiredResult: data.get('desiredResult'),
        weeklyUseCommitment: data.get('weeklyUseCommitment') === 'on',
        structuredFeedbackCommitment: data.get('structuredFeedbackCommitment') === 'on',
        whatsappCommitment: data.get('whatsappCommitment') === 'on',
        honestReviewCommitment: data.get('honestReviewCommitment') === 'on',
        privacyAcknowledged: data.get('privacyAcknowledged') === 'on',
        testimonialContactConsent: data.get('testimonialContactConsent') === 'on',
      }),
    });
    elements.foundingSuccess.textContent = 'Přihláška je u nás. Vybereme 30 žen, které budou opravdu testovat a komunikovat; ozveme se na uvedený e-mail nebo WhatsApp.';
    elements.foundingSuccess.hidden = false;
    await loadFoundingPublicStatus();
  } catch (error) {
    elements.foundingError.textContent = error.message || 'Přihlášku se nepodařilo odeslat.';
    elements.foundingError.hidden = false;
  } finally {
    elements.foundingSubmit.disabled = false;
  }
}

async function refreshFoundingStatus() {
  if (!state.cloudSession || !state.cloud) return null;
  try {
    const authorization = await state.cloud.authorization();
    state.founding.me = await request('/api/founding/me', { headers: { Authorization: authorization } });
    elements.foundingAdminButton.hidden = !state.founding.me?.admin;
    renderFoundingAccount();
    return state.founding.me;
  } catch {
    state.founding.me = null;
    elements.foundingAdminButton.hidden = true;
    renderFoundingAccount();
    return null;
  }
}

function renderFoundingAccount() {
  const application = state.founding.me?.application;
  const active = application && ['approved', 'active'].includes(application.status);
  elements.foundingAccountCard.hidden = !active;
  if (!active) return;
  elements.foundingAccountStatus.textContent = application.status === 'active'
    ? `Zakládající testerka č. ${application.assigned_seat}`
    : `Vybraná testerka č. ${application.assigned_seat}`;
  elements.foundingAccountDetail.textContent = application.status === 'active'
    ? 'Tvoje testerská cena je aktivní. Každý týden odešli konkrétní výsledek a to, co potřebuje opravit.'
    : 'Místo je rezervované. Aktivuj 7 dní zdarma stejným e-mailem a testerská cena se použije automaticky.';
}

function openFoundingFeedback() {
  elements.foundingFeedbackError.hidden = true;
  elements.foundingFeedbackSuccess.hidden = true;
  elements.foundingFeedbackDialog.showModal();
}

async function submitFoundingFeedbackForm(event) {
  event.preventDefault();
  if (!elements.foundingFeedbackForm.reportValidity()) return;
  const data = new FormData(elements.foundingFeedbackForm);
  const button = elements.foundingFeedbackForm.querySelector('button[type="submit"]');
  button.disabled = true;
  elements.foundingFeedbackError.hidden = true;
  elements.foundingFeedbackSuccess.hidden = true;
  try {
    const authorization = await state.cloud.authorization();
    await request('/api/founding/feedback', {
      method: 'POST',
      headers: { Authorization: authorization },
      body: JSON.stringify({
        roleUsed: data.get('roleUsed'), usefulness: Number(data.get('usefulness')),
        resultSummary: data.get('resultSummary'), frictionSummary: data.get('frictionSummary'),
        followUpAllowed: data.get('followUpAllowed') === 'on',
      }),
    });
    elements.foundingFeedbackSuccess.textContent = 'Děkujeme. Výsledek i slabé místo jsou uložené; neodeslal se žádný obsah tvých AI konverzací.';
    elements.foundingFeedbackSuccess.hidden = false;
    elements.foundingFeedbackForm.reset();
  } catch (error) {
    elements.foundingFeedbackError.textContent = error.message || 'Feedback se nepodařilo uložit.';
    elements.foundingFeedbackError.hidden = false;
  } finally { button.disabled = false; }
}

async function openFoundingAdmin() {
  if (!elements.foundingAdminDialog.open) elements.foundingAdminDialog.showModal();
  elements.foundingAdminSummary.textContent = 'Načítám přihlášky…';
  elements.foundingAdminList.innerHTML = '';
  try {
    const authorization = await state.cloud.authorization();
    const data = await request('/api/founding/admin/applications', { headers: { Authorization: authorization } });
    renderFoundingAdmin(data);
  } catch (error) {
    elements.foundingAdminSummary.textContent = error.message || 'Přihlášky se nepodařilo načíst.';
  }
}

function renderFoundingAdmin(data) {
  elements.foundingAdminSummary.textContent = `${data.assigned} z ${data.capacity} míst přiděleno · ${data.counts?.submitted || 0} nových přihlášek`;
  elements.foundingAdminList.innerHTML = (data.applications || []).map(application => `
    <article class="founding-admin-item">
      <header><div><strong>${escapeHtml(application.preferred_name)}</strong><span>${escapeHtml(application.email)} · ${escapeHtml(application.whatsapp_phone)}</span></div><b>${escapeHtml(application.status)}${application.assigned_seat ? ` · #${application.assigned_seat}` : ''}</b></header>
      <p><b>${escapeHtml(application.primary_focus)}</b> · ${escapeHtml(application.motivation)}</p>
      <small>Výsledek: ${escapeHtml(application.desired_result)}</small>
      <div><button type="button" data-founding-id="${escapeHtml(application.id)}" data-founding-action="shortlisted">Užší výběr</button><button type="button" data-founding-id="${escapeHtml(application.id)}" data-founding-action="approved">Přijmout</button><button type="button" data-founding-id="${escapeHtml(application.id)}" data-founding-action="declined">Odmítnout</button></div>
    </article>`).join('') || '<p>Zatím žádné přihlášky.</p>';
}

async function handleFoundingAdminAction(event) {
  const button = event.target.closest('[data-founding-action]');
  if (!button) return;
  button.disabled = true;
  try {
    const authorization = await state.cloud.authorization();
    await request(`/api/founding/admin/applications/${encodeURIComponent(button.dataset.foundingId)}`, {
      method: 'PATCH', headers: { Authorization: authorization }, body: JSON.stringify({ action: button.dataset.foundingAction }),
    });
    await openFoundingAdmin();
  } catch (error) {
    elements.foundingAdminSummary.textContent = error.message || 'Změnu se nepodařilo uložit.';
  } finally { button.disabled = false; }
}

function foundingPlanCode() {
  const application = state.founding.me?.application;
  return application?.status === 'approved' ? 'founding30' : 'standard';
}

async function requestMembershipEntry(view = 'member') {
  state.pendingEntryView = view;
  if (!state.authRequired) return enterMembership(view);
  if (state.cloudSession) {
    if (await hasMembershipAccess()) return enterMembership(view);
    await refreshFoundingStatus();
    return startMembershipCheckout('', foundingPlanCode());
  }
  setAuthMode('signup');
  if (!state.cloud) {
    elements.authError.textContent = 'Přihlášení je teď krátce nedostupné. Obnov stránku nebo to zkus za chvíli.';
    elements.authError.hidden = false;
    elements.authSubmit.disabled = true;
  }
  elements.authDialog.showModal();
}

function setAuthMode(mode) {
  state.authMode = mode === 'signin' ? 'signin' : 'signup';
  const signup = state.authMode === 'signup';
  elements.authNameWrap.hidden = !signup;
  elements.authName.required = signup;
  elements.authConsentWrap.hidden = !signup;
  elements.authConsent.required = signup;
  elements.authPassword.autocomplete = signup ? 'new-password' : 'current-password';
  elements.authTitle.textContent = signup ? 'Začni 7 dní zdarma' : 'Vítej zpět';
  elements.authCopy.textContent = signup ? 'Vytvoř si soukromý účet. Platební údaje doplníš až v zabezpečené platební bráně.' : 'Přihlas se do svého soukromého prostoru Elitea.';
  elements.authSubmit.textContent = signup ? 'Vytvořit účet' : 'Přihlásit se';
  elements.authSwitch.textContent = signup ? 'Už účet mám · Přihlásit se' : 'Nemám účet · Začít 7 dní zdarma';
  elements.authError.hidden = true;
}

async function submitAuth(event) {
  event.preventDefault();
  elements.authSubmit.disabled = true;
  elements.authError.hidden = true;
  try {
    const result = state.authMode === 'signup'
      ? await state.cloud.signUp(elements.authName.value.trim(), elements.authEmail.value.trim(), elements.authPassword.value)
      : await state.cloud.signIn(elements.authEmail.value.trim(), elements.authPassword.value);
    if (result?.error) throw new Error(result.error.message || 'Přihlášení se nepodařilo.');
    state.cloudSession = await state.cloud.loadState();
    hydrateStudyStateFromLocalStorage();
    if (state.authMode === 'signup') await state.cloud.saveState();
    if (!state.cloudSession) throw new Error('Potvrď prosím svůj e-mail a potom se přihlas.');
    await refreshFoundingStatus();
    if (!(await hasMembershipAccess())) return startMembershipCheckout(elements.authEmail.value.trim(), foundingPlanCode());
    elements.authDialog.close();
    enterMembership(state.pendingEntryView);
  } catch (error) {
    elements.authError.textContent = error.message || 'Zkus to prosím znovu.';
    elements.authError.hidden = false;
  } finally { elements.authSubmit.disabled = false; }
}

async function fetchMembership() {
  if (!state.systemStatus?.paymentsConnected || !state.cloudSession) {
    state.membership = { status: state.systemStatus?.paymentsConnected ? 'inactive' : 'setup' };
    return state.membership;
  }
  const authorization = await state.cloud.authorization();
  state.membership = await request('/api/membership', { headers: { Authorization: authorization } });
  return state.membership;
}

async function hasMembershipAccess() {
  if (!state.systemStatus?.paymentsConnected) return true;
  try {
    const membership = await fetchMembership();
    return ['trialing', 'active'].includes(membership.status);
  } catch {
    return false;
  }
}

async function startMembershipCheckout(email = '', planCode = foundingPlanCode()) {
  if (!state.systemStatus?.paymentsConnected) return enterMembership(state.pendingEntryView);
  const authorization = await state.cloud.authorization();
  const checkout = await request('/api/membership/checkout', {
    method: 'POST',
    headers: { Authorization: authorization },
    body: JSON.stringify({ email: email || state.cloudSession?.user?.email || '', planCode }),
  });
  if (!checkout.url) throw new Error('Platební brána nevrátila bezpečný odkaz.');
  window.location.assign(checkout.url);
}

async function openAccount() {
  if (!state.cloudSession) return requestMembershipEntry('member');
  elements.accountError.hidden = true;
  elements.accountEmail.textContent = state.cloudSession.user?.email || 'Přihlášený účet';
  elements.accountMembershipStatus.textContent = 'Načítám…';
  elements.accountMembershipDetail.textContent = 'Ověřuji aktuální stav.';
  elements.accountBilling.disabled = true;
  elements.accountDialog.showModal();
  try {
    await refreshFoundingStatus();
    const membership = await fetchMembership();
    const labels = {
      setup: ['Připraveno k aktivaci', 'Platební brána bude dostupná po dokončení jejího bezpečného připojení.'],
      inactive: ['Členství není aktivní', 'Spusť 7denní zkušební období a dokonči zabezpečenou platbu.'],
      trialing: ['7 dní zdarma', membership.current_period_end ? `Zkušební období běží do ${formatAccountDate(membership.current_period_end)}.` : 'Zkušební období je aktivní.'],
      active: ['Aktivní členství', membership.current_period_end ? `Aktuální období končí ${formatAccountDate(membership.current_period_end)}.` : 'Členství je aktivní.'],
      past_due: ['Platbu je potřeba zkontrolovat', 'Otevři správu členství a aktualizuj platební údaje.'],
      paused: ['Členství je pozastavené', 'Podrobnosti najdeš ve správě členství.'],
      cancelled: ['Členství skončilo', 'Můžeš ho znovu aktivovat spuštěním nového členství.'],
    };
    const [title, detail] = labels[membership.status] || labels.inactive;
    elements.accountMembershipStatus.textContent = title;
    elements.accountMembershipDetail.textContent = membership.cancel_at_period_end ? `${detail} Další obnovení je zrušené.` : detail;
    elements.accountBilling.textContent = ['inactive', 'cancelled'].includes(membership.status) ? 'Aktivovat členství' : 'Spravovat členství';
    elements.accountBilling.disabled = membership.status === 'setup';
  } catch (error) {
    elements.accountMembershipStatus.textContent = 'Stav se nepodařilo načíst';
    elements.accountMembershipDetail.textContent = 'Zkus to prosím znovu za chvíli.';
    elements.accountError.textContent = error.message;
    elements.accountError.hidden = false;
  }
}

async function openBillingPortal() {
  elements.accountBilling.disabled = true;
  elements.accountError.hidden = true;
  try {
    if (['inactive', 'cancelled'].includes(state.membership?.status)) return startMembershipCheckout();
    const authorization = await state.cloud.authorization();
    const portal = await request('/api/membership/portal', { method: 'POST', headers: { Authorization: authorization } });
    if (!portal.url) throw new Error('Správa členství nevrátila bezpečný odkaz.');
    window.location.assign(portal.url);
  } catch (error) {
    elements.accountError.textContent = error.message || 'Správu členství se nepodařilo otevřít.';
    elements.accountError.hidden = false;
    elements.accountBilling.disabled = false;
  }
}

async function signOutMember() {
  elements.accountLogout.disabled = true;
  try {
    await state.cloud?.saveState();
    const result = await state.cloud?.signOut();
    if (result?.error) throw new Error(result.error.message);
    state.cloudSession = null;
    state.membership = null;
    elements.accountDialog.close();
    showPublicSite();
  } catch (error) {
    elements.accountError.textContent = error.message || 'Odhlášení se nepodařilo.';
    elements.accountError.hidden = false;
  } finally {
    elements.accountLogout.disabled = false;
  }
}

function formatAccountDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

async function submitCourseRequest(event) {
  event.preventDefault();
  if (!elements.courseRequestForm?.reportValidity()) return;

  const data = new FormData(elements.courseRequestForm);
  const submit = elements.courseRequestForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Odesílám…';
  elements.courseRequestStatus.className = 'course-request-status';
  elements.courseRequestStatus.textContent = '';

  try {
    await request('/api/course-request', {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        topic: data.get('topic'),
        useCase: data.get('useCase'),
        outcome: data.get('outcome'),
        consent: data.get('consent') === 'on',
        company: data.get('company'),
      }),
    });
    elements.courseRequestForm.reset();
    elements.courseRequestStatus.classList.add('success');
    elements.courseRequestStatus.textContent = 'Máme ho. Díky — Nia si tvůj námět osobně přečte a posoudí pro další programy Elitea.';
  } catch (error) {
    elements.courseRequestStatus.classList.add('error');
    elements.courseRequestStatus.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Odeslat námět <span>↗</span>';
  }
}

function enterMembership(view = 'member') {
  document.body.classList.remove('public-mode');
  document.body.classList.add('member-mode');
  switchView(view);
  window.location.hash = `app-${view}`;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showPublicSite() {
  document.body.classList.remove('member-mode');
  document.body.classList.add('public-mode');
  window.location.hash = 'top';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function loadContent() {
  try {
    const payload = await request('/api/content');
    state.content = Array.isArray(payload.items) ? payload.items : [];
    state.categories = Array.isArray(payload.categories) ? payload.categories : [];
    renderContent();
  } catch {
    state.content = [];
    state.categories = [{ id: 'all', label: 'Všechno' }];
    renderContent();
  }
}

function switchView(view) {
  const allowed = new Set(['member', 'chat', 'community', 'academy', 'worksheets', 'library']);
  state.currentView = allowed.has(view) ? view : 'member';
  elements.memberPanel.hidden = state.currentView !== 'member';
  elements.chatPanel.hidden = state.currentView !== 'chat';
  elements.communityPanel.hidden = state.currentView !== 'community';
  elements.academyPanel.hidden = state.currentView !== 'academy';
  elements.worksheetsPanel.hidden = state.currentView !== 'worksheets';
  elements.contentPanel.hidden = state.currentView !== 'library';
  elements.insightPanel.hidden = state.currentView !== 'chat';
  elements.libraryTopButton.textContent = state.currentView === 'academy' ? 'Moje členství' : 'Moje kurzy';
  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === state.currentView);
  });
  if (state.currentView === 'member') renderMemberDashboard();
}

async function loadWorksheets() {
  try {
    const payload = await request('/api/worksheets');
    state.worksheets = Array.isArray(payload.items) ? payload.items : [];
    state.worksheetCategories = Array.isArray(payload.categories) ? payload.categories : [];
  } catch {
    state.worksheets = [];
    state.worksheetCategories = [{ id: 'all', label: 'Všechny', count: 0 }];
  }
  updateLiveCount('worksheets', state.worksheets.length);
  renderWorksheetLibrary();
}

function renderWorksheetLibrary() {
  if (!elements.worksheetGrid) return;
  elements.worksheetFilters.innerHTML = state.worksheetCategories.map(category => `
    <button class="worksheet-filter ${state.worksheetFilter === category.id ? 'active' : ''}" type="button" data-worksheet-category="${escapeHtml(category.id)}">
      ${escapeHtml(category.label)} <span>${Number(category.count) || 0}</span>
    </button>`).join('');

  const filtered = state.worksheets.filter(worksheet => {
    const inCategory = state.worksheetFilter === 'all' || worksheet.category === state.worksheetFilter;
    const haystack = `${worksheet.title} ${worksheet.categoryLabel} ${worksheet.method} ${worksheet.purpose || ''} ${worksheet.canDiscover || ''} ${(worksheet.useWhen || []).join(' ')}`.toLocaleLowerCase('cs');
    return inCategory && (!state.worksheetSearch || haystack.includes(state.worksheetSearch));
  });
  const started = Object.values(state.worksheetEntries).filter(entry => entry && Object.values(entry.values || {}).some(Boolean)).length;
  elements.worksheetCount.textContent = state.worksheets.length;
  elements.worksheetProgressCount.textContent = `${started} ${started === 1 ? 'rozpracovaný' : started > 1 && started < 5 ? 'rozpracované' : 'rozpracovaných'}`;
  elements.worksheetEmpty.hidden = filtered.length > 0;
  elements.worksheetGrid.innerHTML = filtered.map(worksheetCardTemplate).join('');
}

function worksheetCardTemplate(worksheet) {
  const entry = state.worksheetEntries[worksheet.id];
  const completedFields = Object.values(entry?.values || {}).filter(value => String(value || '').trim()).length;
  const progress = Math.round((completedFields / worksheet.prompts.length) * 100);
  return `
    <article class="worksheet-card ${completedFields ? 'started' : ''}">
      <div class="worksheet-card-top"><span>${escapeHtml(worksheet.categoryLabel)}</span><b>${String(worksheet.estimatedMinutes).padStart(2, '0')} MIN</b></div>
      <div class="worksheet-card-number">${escapeHtml(worksheet.techniqueId.slice(0, 2).toUpperCase())}</div>
      <h2>${escapeHtml(worksheet.title)}</h2>
      <div class="worksheet-card-value"><span>K ČEMU JE</span><p>${escapeHtml(worksheet.purpose)}</p></div>
      <div class="worksheet-card-value discovery"><span>CO MŮŽEŠ ZJISTIT</span><p>${escapeHtml(worksheet.canDiscover)}</p></div>
      <div class="worksheet-card-progress"><span style="width:${progress}%"></span></div>
      <footer><small>${completedFields ? `${completedFields} z ${worksheet.prompts.length} částí vyplněno` : `${worksheet.howToUse?.length || 4} kroky použití`}</small><button type="button" data-open-worksheet="${escapeHtml(worksheet.id)}">${completedFields ? 'Pokračovat' : 'Otevřít postup a list'} →</button></footer>
    </article>`;
}

function openWorksheet(id) {
  const worksheet = state.worksheets.find(item => item.id === id)
    || state.activeCourse?.materials?.find(item => item.id === id);
  if (!worksheet) return;
  state.activeWorksheet = worksheet;
  const saved = state.worksheetEntries[worksheet.id]?.values || {};
  elements.worksheetDialogCategory.textContent = worksheet.categoryLabel.toLocaleUpperCase('cs');
  elements.worksheetDialogTitle.textContent = worksheet.title;
  elements.worksheetDialogMeta.textContent = `${worksheet.estimatedMinutes} minut · ${worksheet.prompts.length} vedených částí · technika ${worksheet.techniqueId}`;
  elements.worksheetDialogMethod.textContent = worksheet.method;
  elements.worksheetDialogBoundary.textContent = `Hranice použití: ${worksheet.boundary}`;
  elements.worksheetDialogPurpose.textContent = worksheet.purpose;
  elements.worksheetDialogDiscovery.textContent = worksheet.canDiscover;
  elements.worksheetDialogTakeaway.textContent = worksheet.takeaway;
  elements.worksheetDialogUsage.innerHTML = (worksheet.howToUse || []).map((step, index) => `<li><b>${String(index + 1).padStart(2, '0')}</b><p>${escapeHtml(step)}</p></li>`).join('');
  elements.worksheetResource.hidden = !worksheet.resourceMarkdown;
  elements.worksheetResourceContent.innerHTML = worksheet.resourceMarkdown ? renderMarkdown(worksheet.resourceMarkdown) : '';
  elements.worksheetFields.innerHTML = worksheet.prompts.map((prompt, index) => worksheetFieldTemplate(prompt, index, saved)).join('');
  elements.worksheetSaveStatus.textContent = state.worksheetEntries[worksheet.id]?.savedAt
    ? `Uloženo v tomto prohlížeči · ${new Date(state.worksheetEntries[worksheet.id].savedAt).toLocaleString('cs-CZ')}`
    : 'Odpovědi zůstávají jen v tomto prohlížeči.';
  elements.worksheetDialog.showModal();
}

function saveWorksheet(event) {
  event.preventDefault();
  if (!state.activeWorksheet) return;
  const formData = new FormData(elements.worksheetForm);
  const values = Object.fromEntries(state.activeWorksheet.prompts.map(prompt => [prompt.id, String(formData.get(prompt.id) || '').trim()]));
  state.worksheetEntries[state.activeWorksheet.id] = { values, savedAt: new Date().toISOString() };
  localStorage.setItem('elitea.worksheetEntries', JSON.stringify(state.worksheetEntries));
  syncCloudState();
  elements.worksheetSaveStatus.textContent = 'Uloženo bezpečně v tomto prohlížeči.';
  renderWorksheetLibrary();
  const currentItem = flattenCourseItems(state.activeCourse)[state.activeItemIndex];
  if (currentItem) renderCourseMaterials(currentItem);
}

function worksheetFieldTemplate(prompt, index, saved) {
  const id = `worksheet-field-${escapeHtml(prompt.id)}`;
  if (prompt.type === 'checkbox') {
    return `
      <label class="worksheet-field worksheet-field-check" for="${id}">
        <span><b>${String(index + 1).padStart(2, '0')}</b>${escapeHtml(prompt.label)}</span>
        <small>${escapeHtml(prompt.help)}</small>
        <span class="worksheet-check-control"><input id="${id}" name="${escapeHtml(prompt.id)}" type="checkbox" value="splněno" ${saved[prompt.id] ? 'checked' : ''}><i>Označit jako skutečně dokončené</i></span>
      </label>`;
  }
  return `
    <label class="worksheet-field" for="${id}">
      <span><b>${String(index + 1).padStart(2, '0')}</b>${escapeHtml(prompt.label)}</span>
      <small>${escapeHtml(prompt.help)}</small>
      <textarea id="${id}" name="${escapeHtml(prompt.id)}" rows="4" maxlength="4000" placeholder="Napiš svou odpověď…">${escapeHtml(saved[prompt.id] || '')}</textarea>
    </label>`;
}

function discussWorksheet() {
  if (!state.activeWorksheet) return;
  const formData = new FormData(elements.worksheetForm);
  const notes = state.activeWorksheet.prompts
    .map(prompt => ({ label: prompt.label, value: String(formData.get(prompt.id) || '').trim() }))
    .filter(item => item.value)
    .map(item => `${item.label}: ${item.value}`)
    .join('\n');
  elements.worksheetDialog.close();
  switchView('chat');
  elements.chatInput.value = `Pracuji s pracovním listem „${state.activeWorksheet.title}“. Jeho cílem je: ${state.activeWorksheet.purpose} Očekávaný praktický výstup: ${state.activeWorksheet.takeaway} Proveď mě prosím touto technikou krok za krokem${notes ? ` a navazuj na moje poznámky:\n${notes}` : '.'}`;
  elements.chatInput.focus();
  autoResize();
}

function loadWorksheetEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem('elitea.worksheetEntries') || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function loadCourseNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem('elitea.courseNotes') || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function loadCourses() {
  try {
    const payload = await request('/api/courses');
    state.courses = Array.isArray(payload.items) ? payload.items : [];
  } catch {
    state.courses = [];
  }
  elements.academyNavCount.textContent = state.courses.length
    ? `${state.courses.length} ${czechCountLabel(state.courses.length, 'program', 'programy', 'programů')}`
    : 'připravujeme';
  renderAcademy();
  renderMemberDashboard();
}

function renderAcademy() {
  renderAcademyCategoryFilters();
  if (!state.courses.length) {
    elements.academyCourseGrid.innerHTML = '<div class="academy-empty"><strong>První výcvik se právě připravuje.</strong><p>Zkus to prosím za chvíli.</p></div>';
    return;
  }
  const categories = state.academyCategory === 'all'
    ? ACADEMY_CATEGORIES
    : ACADEMY_CATEGORIES.filter(category => category.id === state.academyCategory);
  elements.academyCourseGrid.innerHTML = categories.map(category => {
    const courses = state.courses.filter(course => category.courseCategories.includes(course.categoryId));
    return `
      <section class="academy-category-section" data-academy-section="${escapeHtml(category.id)}">
        <header class="academy-category-head">
          <div><span>ODBORNÁ OBLAST</span><h2>${escapeHtml(category.label)}</h2><p>${escapeHtml(category.description)}</p></div>
          <strong>${courses.length} ${czechCountLabel(courses.length, 'program', 'programy', 'programů')}</strong>
        </header>
        ${courses.length
          ? `<div class="academy-category-course-list">${courses.map(renderAcademyCourseCard).join('')}</div>`
          : '<div class="academy-category-empty"><strong>Programy v této oblasti připravujeme.</strong><p>Nové kurzy se sem automaticky zařadí podle svého odborného zaměření.</p></div>'}
      </section>`;
  }).join('');
}

function renderAcademyCategoryFilters() {
  if (!elements.academyCategoryFilters) return;
  const filters = [{ id: 'all', label: 'Všechny kurzy' }, ...ACADEMY_CATEGORIES];
  elements.academyCategoryFilters.innerHTML = filters.map(category => {
    const count = category.id === 'all'
      ? state.courses.length
      : state.courses.filter(course => category.courseCategories.includes(course.categoryId)).length;
    const active = state.academyCategory === category.id;
    return `<button type="button" class="${active ? 'active' : ''}" data-academy-category="${escapeHtml(category.id)}" aria-pressed="${active}"><span>${escapeHtml(category.label)}</span><small>${count}</small></button>`;
  }).join('');
}

function educationBranchForCourse(course = {}) {
  return ['marketing', 'business-strategy'].includes(course.categoryId)
    || course.id === 'komunikace-v-praxi'
    ? 'brand-marketing'
    : 'coach-mentor';
}

function trainingRoleForCourse(course = {}) {
  return educationBranchForCourse(course) === 'brand-marketing' ? 'brand_training' : 'coach_training';
}

function renderAcademyCourseCard(course) {
    const progress = courseProgressPercent(course);
    const program = /program/i.test(course.level || '');
    return `
      <article class="academy-course-card">
        <div class="course-cover"><span>ELITEA<br>ACADEMY</span><b>${escapeHtml(course.coverNumber || '—')}</b><i>${escapeHtml(course.topicLabel || 'PROGRAM')}</i></div>
        <div class="academy-course-copy">
          <span class="course-badge">${escapeHtml(course.badge)}</span>
          <h2>${escapeHtml(course.title)}</h2>
          <h3>${escapeHtml(course.subtitle)}</h3>
          <p>${escapeHtml(course.description)}</p>
          <div class="course-facts"><span>${course.moduleCount} ${czechCountLabel(course.moduleCount, 'modul', 'moduly', 'modulů')}</span><span>${course.itemCount} ${czechCountLabel(course.itemCount, 'část', 'části', 'částí')}</span>${course.materialCount ? `<span>${course.materialCount} ${czechCountLabel(course.materialCount, 'pracovní list', 'pracovní listy', 'pracovních listů')}</span>` : ''}<span>${course.durationHours} ${czechCountLabel(course.durationHours, 'hodina', 'hodiny', 'hodin')}</span>${course.mastery ? `<span>${course.mastery.journeyDays}denní cesta</span><span>${course.mastery.scenarioCount} situací · ${course.mastery.levelCount} úrovně</span>` : ''}</div>
          <div class="course-progress-line"><span style="width:${progress}%"></span></div>
          <div class="course-card-footer"><small>${progress ? `${progress} % dokončeno` : 'Připraveno začít'}</small><button class="primary-button" type="button" data-open-course="${escapeHtml(course.slug)}">${progress ? `Pokračovat ${program ? 'v programu' : 've výcviku'}` : `Otevřít ${program ? 'program' : 'výcvik'}`}</button></div>
        </div>
      </article>`;
}

function renderMemberDashboard() {
  const course = state.courses[0];
  const progress = course ? courseProgressPercent(course) : 0;
  const preferredName = state.memory?.identity_preferences?.preferred_name;
  document.querySelector('#member-greeting').textContent = preferredName ? `Vítej, ${vocativeHint(preferredName)}.` : 'Vítej v Elitea.';
  elements.memberCourseProgress.style.width = `${progress}%`;
  elements.memberCourseProgressCopy.textContent = progress ? `${progress} % dokončeno · pokračuj tam, kde jsi skončila` : 'Začni úvodním profesním modulem · 0 % dokončeno';
  document.querySelector('#member-next-step').textContent = progress ? 'Pokračuj v dalším kroku výcviku' : 'Otevři úvodní profesní modul';
  document.querySelector('#member-profile-copy').textContent = state.memory?.business_context?.industry
    ? `${state.memory.business_context.industry} · ${humanStage(state.memory.business_context.stage)}`
    : 'Doplň obor, cíle a styl podpory, aby byly příklady i mentoring přesnější.';
}

async function openCourse(slug) {
  switchView('academy');
  try {
    const course = await request(`/api/courses/${encodeURIComponent(slug)}?detail=1`, { cache: 'no-store' });
    if (!Array.isArray(course.modules) || !course.modules.length || !course.trainer) {
      throw new Error('Detail kurzu se nenačetl úplně. Zkus ho prosím otevřít znovu.');
    }
    state.activeCourse = course;
    elements.readerCourseTitle.textContent = state.activeCourse.title;
    elements.readerCourseBadge.textContent = state.activeCourse.badge;
    state.masteryTab = 'journey';
    elements.courseMastery.classList.remove('expanded');
    elements.masteryToggle.textContent = 'Otevřít Mastery Lab';
    renderCourseMastery();
    const items = flattenCourseItems(state.activeCourse);
    const firstIncomplete = items.findIndex(item => !state.courseProgress.has(progressKey(state.activeCourse, item)));
    state.activeItemIndex = firstIncomplete >= 0 ? firstIncomplete : 0;
    elements.academyHome.hidden = true;
    elements.courseReader.hidden = false;
    renderCourseOutline();
    openCourseItem(state.activeItemIndex);
  } catch (error) {
    elements.academyCourseGrid.innerHTML = `<div class="academy-empty"><strong>Kurz se nepodařilo otevřít.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function closeCourseReader() {
  elements.courseReader.hidden = true;
  elements.academyHome.hidden = false;
  state.activeCourse = null;
  renderAcademy();
}

function flattenCourseItems(course) {
  return (course?.modules || []).flatMap((module, moduleIndex) => module.items.map((item, moduleItemIndex) => ({
    ...item,
    moduleId: module.id,
    moduleTitle: module.shortTitle,
    moduleFullTitle: module.title,
    moduleIndex,
    moduleItemIndex,
    moduleItemCount: module.items.length,
  })));
}

function courseTrainer(source) {
  return source?.trainer || {
    label: 'Praktická trenérka kurzu',
    heading: 'Trenérka k tomuto kurzu',
    description: 'Pomůže ti pochopit látku, procvičit ji a převést ji do konkrétního výkonu.',
    studentRole: 'studentka otevřeného kurzu',
    counterpart: 'modelová partnerka pro praktický nácvik',
    studyAction: 'Procvičit s trenérkou',
    simulationAction: 'Spustit modelovou situaci',
    studyPlaceholder: 'Zeptej se na látku, pošli vlastní pokus nebo požádej o zpětnou vazbu…',
    simulationPlaceholder: 'Reaguj v roli, kterou v tomto kurzu právě trénuješ…',
    studyOpening: 'Pojďme pracovat přímo s touto částí kurzu.',
  };
}

function renderLessonTrainer() {
  if (!state.activeCourse) return;
  const brandBranch = educationBranchForCourse(state.activeCourse) === 'brand-marketing';
  elements.lessonTrainerLabel.textContent = brandBranch ? 'AI LEKTORKA · BRAND & MARKETING' : 'AI LEKTORKA · KOUČ & MENTOR';
  elements.lessonTrainerTitle.textContent = brandBranch ? 'Od pochopení k použitelnému marketingovému výstupu.' : 'Od pochopení k bezpečnému vedení klientky.';
  elements.lessonTrainerDescription.textContent = brandBranch
    ? 'Vysvětlí látku, rozebere tvoje zadání a pomůže ti převést princip do značky, strategie, komunikace nebo kampaně.'
    : 'Vysvětlí látku, ověří porozumění, otevře modelovou klientku a dá ti konkrétní zpětnou vazbu k vedení sezení.';
  elements.discussLesson.textContent = 'Probrat lekci s AI lektorkou';
  elements.simulateLesson.textContent = 'Spustit praktický nácvik';
}

function openCourseItem(index) {
  const items = flattenCourseItems(state.activeCourse);
  if (!items.length) return;
  state.activeItemIndex = Math.min(Math.max(index, 0), items.length - 1);
  const item = items[state.activeItemIndex];
  const module = state.activeCourse.modules[item.moduleIndex];
  elements.lessonModuleLabel.textContent = `${courseModuleLabel(module, item.moduleIndex)} · ${module.shortTitle}`;
  elements.lessonModulePosition.textContent = `Část ${item.moduleItemIndex + 1} z ${item.moduleItemCount} v tomto modulu · ${state.activeItemIndex + 1} z ${items.length} v celém kurzu`;
  elements.lessonKind.textContent = courseKindLabel(item.kind, state.activeCourse);
  elements.lessonTime.textContent = `${item.minutes} min`;
  elements.lessonTitle.textContent = item.title;
  renderLessonVisual(item.visual);
  elements.lessonContent.innerHTML = renderMarkdown(item.markdown);
  renderCourseMaterials(item);
  const noteKey = progressKey(state.activeCourse, item);
  elements.lessonNotes.value = state.courseNotes[noteKey]?.value || '';
  elements.lessonNotesStatus.textContent = state.courseNotes[noteKey]?.savedAt
    ? `Uloženo v tomto prohlížeči · ${new Date(state.courseNotes[noteKey].savedAt).toLocaleString('cs-CZ')}`
    : 'Poznámky zůstávají jen v tomto prohlížeči.';
  document.querySelector('#previous-lesson').disabled = state.activeItemIndex === 0;
  document.querySelector('#next-lesson').disabled = state.activeItemIndex === items.length - 1;
  const completed = state.courseProgress.has(progressKey(state.activeCourse, item));
  const completeButton = document.querySelector('#complete-lesson');
  completeButton.textContent = completed ? '✓ Dokončeno' : 'Označit jako dokončené';
  completeButton.classList.toggle('completed', completed);
  renderLessonTrainer();
  renderLessonTrainingStatus(item);
  renderCourseOutline();
  elements.lessonContent.closest('.lesson-reader').scrollTop = 0;
}

function renderLessonVisual(visual) {
  if (!elements.lessonVisual) return;
  elements.lessonVisual.hidden = !visual;
  if (!visual) {
    elements.lessonVisual.innerHTML = '';
    return;
  }
  const items = Array.isArray(visual.items) ? visual.items : [];
  elements.lessonVisual.className = `lesson-visual visual-${escapeHtml(visual.type || 'process')}`;
  elements.lessonVisual.innerHTML = `
    <header><span>VIZUÁLNÍ VÝKLAD</span><h3>${escapeHtml(visual.title)}</h3>${visual.caption ? `<p>${escapeHtml(visual.caption)}</p>` : ''}</header>
    <div class="lesson-visual-track">${items.map((item, index) => `
      <article style="--visual-index:${index}"><i>${String(index + 1).padStart(2, '0')}</i><strong>${escapeHtml(item.label)}</strong>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</article>
    `).join('')}</div>`;
}

function renderCourseOutline() {
  if (!state.activeCourse) return;
  let itemIndex = 0;
  elements.courseOutline.innerHTML = state.activeCourse.modules.map((module, moduleIndex) => {
    const moduleItems = module.items.map(item => {
      const index = itemIndex++;
      const completed = state.courseProgress.has(progressKey(state.activeCourse, item));
      return `<button type="button" class="outline-item ${index === state.activeItemIndex ? 'active' : ''} ${completed ? 'completed' : ''}" data-course-item="${index}"><span>${completed ? '✓' : String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(item.title)}</b><small>${courseKindLabel(item.kind, state.activeCourse)}</small></button>`;
    }).join('');
    return `<section class="outline-module"><header class="outline-module-head"><span>${courseModuleLabel(module, moduleIndex)}</span><h3>${escapeHtml(module.shortTitle)}</h3><small>${moduleMaterialSummary(module, moduleIndex)}</small></header>${moduleItems}</section>`;
  }).join('');
  const progress = courseProgressPercent(state.activeCourse);
  elements.readerProgressPercent.textContent = `${progress} %`;
}

function renderCourseMastery() {
  const mastery = state.activeCourse?.mastery;
  if (!elements.courseMastery) return;
  elements.courseMastery.hidden = !mastery;
  if (!mastery) return;
  const progress = masteryStateForCourse();
  const completedDays = new Set(progress.days || []);
  const percent = Math.round((completedDays.size / Math.max(1, mastery.journey.length)) * 100);
  elements.courseMasteryPromise.textContent = mastery.promise;
  elements.courseMasteryPercent.textContent = `${percent} %`;
  elements.masteryTabs.querySelectorAll('[data-mastery-tab]').forEach(button => {
    const active = button.dataset.masteryTab === state.masteryTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const renderers = {
    journey: () => renderMasteryJourney(mastery, completedDays),
    scenarios: () => renderMasteryScenarios(mastery),
    assessment: () => renderMasteryAssessment(mastery, progress),
    pack: () => renderMasteryPack(mastery, progress),
    exam: () => renderMasteryExam(mastery),
  };
  elements.courseMasteryContent.innerHTML = (renderers[state.masteryTab] || renderers.journey)();
}

function renderMasteryJourney(mastery, completedDays) {
  return `<div class="mastery-section-intro"><div><span>ŘÍZENÁ PRAXE</span><h3>30 dní, 30 konkrétních výstupů</h3><p>Den se počítá jako hotový až po vytvoření uvedeného důkazu. Tempo si můžeš rozložit; pořadí zachovává přenos od pochopení k profesionální aplikaci.</p></div><strong>${completedDays.size} / ${mastery.journey.length}</strong></div>
    <div class="mastery-day-grid">${mastery.journey.map(day => {
      const complete = completedDays.has(day.id);
      return `<article class="mastery-card mastery-day ${complete ? 'completed' : ''}"><header><span>DEN ${day.day} · ${escapeHtml(day.phase)}</span><small>${day.minutes} min</small></header><h4>${escapeHtml(day.title)}</h4><p>${escapeHtml(day.task)}</p><div class="mastery-output"><b>Výstup</b>${escapeHtml(day.output)}</div><footer><small>Modul: ${escapeHtml(day.moduleTitle)}</small><button type="button" data-mastery-day="${escapeHtml(day.id)}">${complete ? '✓ Důkaz hotový' : 'Označit výstup'}</button></footer></article>`;
    }).join('')}</div>`;
}

function renderMasteryScenarios(mastery) {
  const attempts = new Map();
  state.trainingPortfolio
    .filter(entry => entry.courseId === state.activeCourse.id && entry.scenarioId)
    .forEach(entry => attempts.set(entry.scenarioId, (attempts.get(entry.scenarioId) || 0) + 1));
  return `<div class="mastery-section-intro"><div><span>SIMULAČNÍ KNIHOVNA</span><h3>60 situací ve čtyřech úrovních</h3><p>Každá situace je svázaná s konkrétním modulem. Elitea drží roli klientky a hodnocení vytvoří až po ukončení nácviku.</p></div><strong>${attempts.size} / ${mastery.scenarios.length}</strong></div>
    <div class="mastery-case-grid">${mastery.scenarios.map(scenario => {
      const count = attempts.get(scenario.id) || 0;
      return `<article class="mastery-card mastery-case"><header><span>SITUACE ${scenario.number}</span><small>${escapeHtml(difficultyLabelShort(scenario.difficulty))}</small></header><h4>${escapeHtml(scenario.title)}</h4><p>${escapeHtml(scenario.openingLine)}</p><div class="mastery-output"><b>Zadání</b>${escapeHtml(scenario.assignment)}</div><footer><small>${count ? `${count}× vyhodnoceno` : escapeHtml(scenario.moduleTitle)}</small><button type="button" data-mastery-scenario="${escapeHtml(scenario.id)}">${count ? 'Opakovat' : 'Spustit nácvik'}</button></footer></article>`;
    }).join('')}</div>`;
}

function renderMasteryAssessment(mastery, progress) {
  const renderStage = (stage, title, subtitle) => `<section class="mastery-assessment-stage"><header><span>${escapeHtml(title)}</span><p>${escapeHtml(subtitle)}</p></header>${mastery.assessment.dimensions.map(dimension => {
    const value = progress.assessment?.[stage]?.[dimension.id] || {};
    return `<article class="mastery-assessment-row"><div><b>${dimension.number}. ${escapeHtml(dimension.title)}</b><p>${escapeHtml(dimension.prompt)}</p></div><label><span>Skóre 0–4</span><select data-mastery-kind="assessment" data-mastery-stage="${stage}" data-mastery-record="${escapeHtml(dimension.id)}" data-mastery-field="score"><option value="">—</option>${mastery.assessment.anchors.map(anchor => `<option value="${anchor.value}" ${String(value.score) === String(anchor.value) ? 'selected' : ''}>${anchor.value} · ${escapeHtml(anchor.label)}</option>`).join('')}</select></label><label class="wide"><span>Důkaz</span><textarea rows="3" maxlength="3000" data-mastery-kind="assessment" data-mastery-stage="${stage}" data-mastery-record="${escapeHtml(dimension.id)}" data-mastery-field="evidence" placeholder="${escapeHtml(dimension.evidencePrompt)}">${escapeHtml(value.evidence || '')}</textarea></label></article>`;
  }).join('')}</section>`;
  return `<div class="mastery-section-intro"><div><span>PRE / POST MĚŘENÍ</span><h3>Stejná měřítka, viditelný posun</h3><p>${escapeHtml(mastery.assessment.instruction)}</p></div><strong>10 dimenzí</strong></div><div class="mastery-assessment-grid">${renderStage('baseline', 'PŘED KURZEM', 'Zachyť výchozí stav bez snahy vypadat lépe.')}${renderStage('final', 'PO INTEGRACI', 'Hodnoť jen to, pro co umíš uvést konkrétní důkaz.')}</div>`;
}

function renderMasteryPack(mastery, progress) {
  return `<div class="mastery-section-intro"><div><span>PROFESNÍ BALÍČEK</span><h3>12 nástrojů, které po kurzu nezůstanou prázdné</h3><p>Každá šablona je navázaná na skutečný modul a vyžaduje situaci, fakta, postup, hranici i důkaz.</p></div><strong>${mastery.professionalPack.length} šablon</strong></div>
    <div class="mastery-template-list">${mastery.professionalPack.map(template => {
      const values = progress.templates?.[template.id] || {};
      const filled = template.fields.filter(field => String(values[field.id] || '').trim()).length;
      return `<details class="mastery-template"><summary><span>${String(template.number).padStart(2, '0')}</span><div><b>${escapeHtml(template.title)}</b><small>${escapeHtml(template.purpose)} · ${filled}/${template.fields.length} polí</small></div><i>+</i></summary><div class="mastery-template-body"><p>${escapeHtml(template.instruction)}</p>${template.fields.map(field => `<label><span>${escapeHtml(field.label)}</span><small>${escapeHtml(field.prompt)}</small><textarea rows="4" maxlength="5000" data-mastery-kind="template" data-mastery-record="${escapeHtml(template.id)}" data-mastery-field="${escapeHtml(field.id)}">${escapeHtml(values[field.id] || '')}</textarea></label>`).join('')}</div></details>`;
    }).join('')}</div>`;
}

function renderMasteryExam(mastery) {
  const exam = mastery.finalExam;
  const attempts = state.trainingPortfolio.filter(entry => entry.courseId === state.activeCourse.id && entry.scenarioId === exam.scenarioId).length;
  return `<article class="mastery-exam"><header><span>EXPERTNÍ INTEGROVANÝ PŘÍPAD</span><h3>${escapeHtml(exam.title)}</h3><p>${escapeHtml(exam.purpose)}</p></header><div class="mastery-exam-rounds">${exam.rounds.map(round => `<section><span>${round.number}</span><div><b>${escapeHtml(round.title)}</b><small>${escapeHtml(round.moduleTitle)}</small><p>${escapeHtml(round.requirement)}</p></div></section>`).join('')}</div><div class="mastery-exam-columns"><section><h4>Kritéria</h4><ul>${exam.criteria.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section><section><h4>Povinné důkazy</h4><ul>${exam.requiredEvidence.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section></div><footer><div><b>${attempts ? `${attempts}× absolvováno` : 'Zatím bez pokusu'}</b><p>${escapeHtml(exam.passRule)}</p></div><button type="button" data-mastery-exam="true">${attempts ? 'Opakovat expertní případ' : 'Spustit závěrečnou zkoušku'}</button></footer></article>`;
}

function toggleMasteryDay(dayId) {
  if (!dayId || !state.activeCourse) return;
  const progress = masteryStateForCourse();
  const days = new Set(progress.days || []);
  days.has(dayId) ? days.delete(dayId) : days.add(dayId);
  progress.days = [...days];
  persistCourseMasteryProgress();
  renderCourseMastery();
}

function saveMasteryField(event) {
  const input = event.target.closest('[data-mastery-kind]');
  if (!input || !state.activeCourse) return;
  const progress = masteryStateForCourse();
  const kind = input.dataset.masteryKind;
  const record = input.dataset.masteryRecord;
  const field = input.dataset.masteryField;
  if (kind === 'assessment') {
    const stage = input.dataset.masteryStage;
    progress.assessment[stage][record] ||= {};
    progress.assessment[stage][record][field] = input.value.slice(0, 3000);
  } else if (kind === 'template') {
    progress.templates[record] ||= {};
    progress.templates[record][field] = input.value.slice(0, 5000);
  }
  progress.updatedAt = new Date().toISOString();
  persistCourseMasteryProgress();
}

async function startMasteryScenario(scenarioId) {
  const course = state.activeCourse;
  const scenarioEntry = course?.mastery?.scenarios?.find(item => item.id === scenarioId);
  if (!course || !scenarioEntry || state.pending) return;
  const item = flattenCourseItems(course).find(candidate => candidate.id === scenarioEntry.itemId);
  if (!item) return alert('Navázaná kurzová část nebyla nalezena.');
  state.pending = true;
  try {
    const scenario = await request(`/api/training/scenario?courseSlug=${encodeURIComponent(course.slug)}&itemId=${encodeURIComponent(item.id)}&difficulty=${encodeURIComponent(scenarioEntry.difficulty)}&scenarioId=${encodeURIComponent(scenarioEntry.id)}`);
    beginTrainingSession({
      activity: 'simulation', phase: 'roleplay', course, item,
      difficulty: scenarioEntry.difficulty, scenario,
      messages: [{ role: 'assistant', content: scenario.openingLine, meta: `${scenario.counterpart || courseTrainer(course).counterpart} · ${difficultyLabel(scenarioEntry.difficulty)}` }],
    });
    switchView('chat');
    elements.chatInput.focus();
  } catch (error) {
    alert(error.message);
  } finally {
    state.pending = false;
    renderMessages();
  }
}

function masteryStateForCourse() {
  const courseId = state.activeCourse?.id;
  if (!courseId) return { days: [], assessment: { baseline: {}, final: {} }, templates: {} };
  state.masteryProgress[courseId] ||= { days: [], assessment: { baseline: {}, final: {} }, templates: {}, updatedAt: null };
  state.masteryProgress[courseId].assessment ||= { baseline: {}, final: {} };
  state.masteryProgress[courseId].assessment.baseline ||= {};
  state.masteryProgress[courseId].assessment.final ||= {};
  state.masteryProgress[courseId].templates ||= {};
  return state.masteryProgress[courseId];
}

function persistCourseMasteryProgress() {
  localStorage.setItem('elitea.courseMastery', JSON.stringify(state.masteryProgress));
  syncCloudState();
}

function loadCourseMasteryProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem('elitea.courseMastery') || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toggleCourseItemComplete() {
  const item = flattenCourseItems(state.activeCourse)[state.activeItemIndex];
  if (!item) return;
  const key = progressKey(state.activeCourse, item);
  state.courseProgress.has(key) ? state.courseProgress.delete(key) : state.courseProgress.add(key);
  localStorage.setItem('elitea.courseProgress', JSON.stringify([...state.courseProgress]));
  syncCloudState();
  openCourseItem(state.activeItemIndex);
  renderMemberDashboard();
  renderAcademy();
}

function discussCurrentLesson() {
  const item = flattenCourseItems(state.activeCourse)[state.activeItemIndex];
  if (!item) return;
  const trainer = courseTrainer(state.activeCourse);
  const notes = String(state.courseNotes[progressKey(state.activeCourse, item)]?.value || '').trim();
  beginTrainingSession({
    activity: 'study',
    phase: 'study',
    course: state.activeCourse,
    item,
    messages: [{
      role: 'assistant',
      content: `${trainer.studyOpening} Teď pracujeme s částí „${item.title}“.${notes ? ' Navazuj na moje poznámky — pošli mi tu, se kterou chceš pracovat jako první.' : ' Čím chceš začít?'}`,
      meta: `${trainer.label} · práce s lekcí`,
    }],
  });
  switchView('chat');
  elements.chatInput.value = notes ? `Pracuj se mnou s touto poznámkou k lekci:\n${notes}` : '';
  elements.chatInput.focus();
  autoResize();
}

async function startCurrentLessonSimulation() {
  const item = flattenCourseItems(state.activeCourse)[state.activeItemIndex];
  if (!item || state.pending) return;
  const difficulty = elements.trainingDifficulty.value || 'standard';
  state.pending = true;
  document.querySelector('#simulate-lesson').disabled = true;
  try {
    const trainer = courseTrainer(state.activeCourse);
    const scenario = await request(`/api/training/scenario?courseSlug=${encodeURIComponent(state.activeCourse.slug)}&itemId=${encodeURIComponent(item.id)}&difficulty=${encodeURIComponent(difficulty)}`);
    beginTrainingSession({
      activity: 'simulation',
      phase: 'roleplay',
      course: state.activeCourse,
      item,
      difficulty,
      scenario,
      messages: [{ role: 'assistant', content: scenario.openingLine, meta: `${scenario.counterpart || trainer.counterpart} · ${difficultyLabel(difficulty)}` }],
    });
    switchView('chat');
    elements.chatInput.focus();
  } catch (error) {
    alert(error.message);
  } finally {
    state.pending = false;
    document.querySelector('#simulate-lesson').disabled = false;
    renderMessages();
  }
}

function beginTrainingSession({ activity, phase, course, item, messages, difficulty = 'standard', scenario = null }) {
  if (isTrainingRole()) persistTrainingSession();
  else persistMessages();
  const role = trainingRoleForCourse(course);
  state.trainingSession = {
    version: 2,
    id: crypto.randomUUID(),
    activity,
    phase,
    difficulty,
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: course.title,
    categoryId: course.categoryId || null,
    educationBranch: educationBranchForCourse(course),
    trainer: courseTrainer(course),
    itemId: item.id,
    itemTitle: item.title,
    scenario,
    messages: [...messages],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  state.trainingSessions[role] = state.trainingSession;
  state.assistantRole = role;
  state.messages = state.trainingSession.messages;
  persistTrainingSession();
  sessionStorage.setItem('elitea.assistantRole', role);
  renderAssistantRole();
  renderMessages();
}

function setAssistantRole(role) {
  if (state.pending) return;
  if (TRAINING_ROLES.has(role)) {
    const targetSession = state.trainingSessions[role];
    if (!targetSession) {
      state.academyCategory = role === 'brand_training' ? 'brand-marketing' : 'coach-mentor';
      renderAcademy();
      switchView('academy');
      return;
    }
    if (isTrainingRole()) persistTrainingSession();
    else persistMessages();
    state.assistantRole = role;
    state.trainingSession = targetSession;
    state.messages = [...(targetSession.messages || [])];
  } else if (role === 'brand') {
    if (isTrainingRole()) persistTrainingSession();
    else persistMessages();
    if (state.consultationMode !== 'brand_growth') {
      state.coachConsultationMode = normalizeCoachConsultationMode(state.consultationMode);
      sessionStorage.setItem('elitea.coachConsultationMode', state.coachConsultationMode);
    }
    state.assistantRole = 'brand';
    state.consultationMode = 'brand_growth';
    state.messages = [...(state.conversations.brand_growth || [])];
    sessionStorage.setItem('elitea.consultationMode', 'brand_growth');
  } else {
    if (isTrainingRole()) persistTrainingSession();
    else persistMessages();
    state.assistantRole = 'coach';
    state.consultationMode = normalizeCoachConsultationMode(state.coachConsultationMode);
    state.messages = [...(state.conversations[state.consultationMode] || [])];
    sessionStorage.setItem('elitea.consultationMode', state.consultationMode);
  }
  sessionStorage.setItem('elitea.assistantRole', state.assistantRole);
  switchView('chat');
  renderAssistantRole();
  renderMessages();
  renderMemory();
  elements.chatInput.focus();
}

function isTrainingRole(role = state.assistantRole) {
  return TRAINING_ROLES.has(role);
}

function renderAssistantRole() {
  const coachTraining = state.assistantRole === 'coach_training';
  const brandTraining = state.assistantRole === 'brand_training';
  const trainer = coachTraining || brandTraining;
  const coachingTrainer = coachTraining && state.trainingSession?.activity === 'simulation';
  const brand = state.assistantRole === 'brand';
  elements.chatPanel.classList.toggle('training-mode', trainer);
  elements.chatPanel.classList.toggle('brand-mode', brand);
  elements.chatRoleLabel.textContent = coachingTrainer ? 'COACHING LAB ELITEA' : trainer ? 'AI LEKTORKA ELITEA' : brand ? 'BRAND & MARKETING MENTORKA' : 'COACH & MENTOR ELITEA';
  elements.chatRoleDescription.textContent = coachingTrainer
    ? `Coaching Lab · modelová klientka · profesní zpětná vazba · ${state.trainingSession?.courseTitle || ''}`
    : trainer
      ? `Elitea Academy · výklad · procvičení · ověření znalostí · ${state.trainingSession?.courseTitle || ''}`
    : brand
      ? 'Podnikatelská stratégka · brand · obsah · sociální sítě · reklama · růst'
      : 'Tvá hlavní koučka · byznys mentorka · dlouhodobá podpora';
  elements.chatDisclaimer.textContent = coachingTrainer
    ? 'Koučovací trenérka pracuje pouze s otevřeným výcvikem, modelovou klientkou a pozorovatelnými profesními dovednostmi. Nemá přístup k osobnímu koučinku členky.'
    : trainer
      ? 'AI lektorka pracuje pouze s otevřeným kurzem a základním studijním profilem. Nemá přístup k osobnímu koučinku ani marketingovým konverzacím.'
    : brand
      ? 'Brand & Marketing mentorka pracuje s kontextem podnikání a pouze s účty či pracovními kartami, které jí vědomě zpřístupníš. Publikování, změnu rozpočtu, platbu nebo odeslání vždy provede až po tvém schválení.'
      : 'Elitea vede neklinická koučovací a mentoringová sezení. U zdravotních, krizových, právních a finančních témat respektuje hranice své role a nasměruje tě k odpovídající lidské pomoci.';
  elements.welcomeTitle.textContent = coachingTrainer
    ? 'Co dnes nacvičíme v koučovacím řemesle?'
    : trainer
      ? 'Co potřebuješ pochopit nebo procvičit v této lekci?'
      : brand
        ? 'Kam dnes posuneme tvoji značku?'
        : 'Co dnes potřebuješ posunout?';
  elements.welcomeCopy.textContent = coachingTrainer
    ? 'Trenérka hraje modelovou klientku, drží scénář a po ukončení hodnotí pouze to, co je skutečně vidět v přepisu.'
    : trainer
      ? 'Vysvětlí konkrétní látku, ověří porozumění, rozebere tvůj pokus a naváže přesně na otevřenou lekci.'
      : brand
        ? 'Popiš požadovaný výsledek. Agentka připraví strategii, podklady a bezpečný plán skutečného provedení.'
        : 'Vyber si způsob práce, nebo mi jednoduše napiš, co řešíš. Celou konzultaci povedu krok za krokem a udržím její směr.';
  elements.sessionTransparency.hidden = trainer || brand;
  elements.sessionGrid.hidden = trainer || brand;
  elements.onboardingButton.innerHTML = coachingTrainer
    ? 'Pokračovat v nácviku <span>→</span>'
    : trainer
      ? 'Pokračovat ve studiu <span>→</span>'
      : brand
        ? 'Zadat první úkol <span>→</span>'
        : 'Napsat, co právě řeším <span>→</span>';
  document.querySelectorAll('[data-assistant-role]').forEach(button => {
    const active = button.dataset.assistantRole === state.assistantRole;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  elements.sessionToolbar.hidden = trainer || brand;
  elements.trainingBanner.hidden = !trainer || !state.trainingSession;
  elements.brandAgentBanner.hidden = !brand;
  if (trainer && state.trainingSession) renderTrainingBanner();
  if (brand) renderBrandWorkMode();
  if (!trainer && !brand) renderConsultationMode();
}

function setBrandWorkMode(mode) {
  if (state.pending || state.assistantRole !== 'brand') return;
  state.brandWorkMode = mode === 'execute' ? 'execute' : 'collaborate';
  sessionStorage.setItem('elitea.brandWorkMode', state.brandWorkMode);
  renderBrandWorkMode();
  elements.chatInput.focus();
}

function renderBrandWorkMode() {
  const execute = state.brandWorkMode === 'execute';
  document.querySelectorAll('[data-brand-work-mode]').forEach(button => {
    const active = button.dataset.brandWorkMode === state.brandWorkMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  elements.brandAgentStateLabel.textContent = execute ? 'REŽIM · UDĚLEJ TO ZA MĚ' : 'REŽIM · PRACUJ SE MNOU';
  elements.brandAgentStateTitle.textContent = execute
    ? 'Nejdřív připravím bezpečný plán provedení.'
    : 'Nejdřív přesně určíme výsledek.';
  elements.brandAgentStateCopy.textContent = execute
    ? 'Připravím strategii, texty, vizuální brief a přesný náhled. Externí změnu provedu jen v připojeném účtu a po tvém schválení.'
    : 'Propojím značku, nabídku, cílovku a nejbližší růstový krok.';
  elements.brandExecutionNote.hidden = !execute;
  elements.chatInput.placeholder = execute
    ? 'Co mám připravit? Např. Meta kampaň včetně kreativ, newsletter nebo obsahový plán…'
    : 'Co chceš vyřešit v marketingu, značce nebo růstu podnikání?';
  elements.welcomeTitle.textContent = execute ? 'Co mám udělat za tebe?' : 'Kam dnes posuneme tvoji značku?';
}

function openBrowserOperator() {
  if (!elements.browserOperatorDialog) return;
  elements.browserOperatorDialog.showModal();
  if (!state.marketingOperator?.remoteBrowser?.configured) {
    elements.browserOperatorStatus.textContent = 'Pracovní prohlížeč je připravený v aplikaci a čeká na bezpečné připojení provozní služby.';
    return;
  }
  elements.browserOperatorStatus.textContent = state.cloudSession
    ? 'Vyber Canvu nebo Meta Ads. Přihlášení provedeš sama přímo v otevřené stránce.'
    : 'Nejdřív se přihlas do svého účtu Elitea; pracovní relace musí patřit konkrétní člence.';
}

async function startBrowserOperator(target) {
  if (!['canva', 'meta_ads'].includes(target) || state.browserSession) return;
  if (!state.cloudSession) {
    elements.browserOperatorStatus.textContent = 'Nejdřív se přihlas do Elitea a potom pracovní prohlížeč otevři znovu.';
    return;
  }
  if (!state.marketingOperator?.remoteBrowser?.configured) {
    elements.browserOperatorStatus.textContent = 'Provozní služba pracovního prohlížeče ještě není připojená.';
    return;
  }
  const buttons = [...document.querySelectorAll('[data-browser-target]')];
  buttons.forEach(button => { button.disabled = true; });
  elements.browserOperatorStatus.textContent = `Spouštím izolovanou pracovní relaci ${target === 'canva' ? 'Canva' : 'Meta Ads'}…`;
  try {
    const authorization = await state.cloud.authorization();
    const session = await request('/api/browser-sessions', {
      method: 'POST',
      headers: { Authorization: authorization },
      body: JSON.stringify({ target }),
    });
    state.browserSession = session;
    state.browserActionDraft = null;
    elements.browserOperatorStart.hidden = true;
    elements.browserAgentPanel.hidden = false;
    elements.browserActionPreview.hidden = true;
    elements.browserLiveWrap.hidden = false;
    elements.endBrowserOperator.hidden = false;
    elements.browserLiveLabel.textContent = `${session.targetLabel} · soukromá relace`;
    elements.browserLiveView.src = session.liveViewUrl;
    elements.browserOperatorStatus.textContent = `${session.targetLabel} je otevřená. Přihlas se sama; až potom můžeš předat konkrétní pracovní úkol mentorce.`;
  } catch (error) {
    elements.browserOperatorStatus.textContent = error.message;
    buttons.forEach(button => { button.disabled = false; });
  }
}

async function closeBrowserOperator() {
  const session = state.browserSession;
  state.browserSession = null;
  state.browserActionDraft = null;
  if (elements.browserAgentInstruction) elements.browserAgentInstruction.value = '';
  if (elements.browserAgentPanel) elements.browserAgentPanel.hidden = true;
  if (elements.browserActionPreview) elements.browserActionPreview.hidden = true;
  elements.browserLiveView.src = 'about:blank';
  elements.browserLiveWrap.hidden = true;
  elements.browserOperatorStart.hidden = false;
  elements.endBrowserOperator.hidden = true;
  document.querySelectorAll('[data-browser-target]').forEach(button => { button.disabled = false; });
  if (session?.id && state.cloudSession) {
    elements.browserOperatorStatus.textContent = 'Ukončuji pracovní relaci…';
    try {
      const authorization = await state.cloud.authorization();
      await request(`/api/browser-sessions/${encodeURIComponent(session.id)}`, {
        method: 'DELETE',
        headers: { Authorization: authorization },
      });
    } catch {}
  }
  elements.browserOperatorStatus.textContent = 'Pracovní relace je ukončená. Přihlášené okno už není dostupné.';
  elements.browserOperatorDialog.close();
}

async function previewBrowserAction(event) {
  event?.preventDefault();
  const session = state.browserSession;
  const instruction = elements.browserAgentInstruction?.value.trim();
  if (!session?.id || !instruction || !state.cloudSession) return;
  state.browserActionDraft = null;
  elements.browserActionPreview.hidden = true;
  elements.browserAgentPreviewButton.disabled = true;
  elements.browserOperatorStatus.textContent = 'Elitea kontroluje aktuální stránku a hledá jeden bezpečný krok…';
  try {
    const authorization = await state.cloud.authorization();
    const draft = await request(`/api/browser-sessions/${encodeURIComponent(session.id)}/actions/preview`, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: JSON.stringify({ instruction }),
    });
    state.browserActionDraft = draft;
    elements.browserActionRisk.textContent = browserRiskLabel(draft.risk);
    elements.browserActionDescription.textContent = draft.description;
    elements.browserActionManual.textContent = draft.manualReason || 'Po potvrzení provedu pouze tento jeden krok.';
    elements.browserActionExecute.hidden = !draft.canExecute;
    elements.browserActionExecute.disabled = false;
    elements.browserActionPreview.hidden = false;
    elements.browserOperatorStatus.textContent = draft.canExecute
      ? 'Krok je připravený. Proveď ho až po kontrole popisu.'
      : 'Tento poslední nebo citlivý krok Elitea z bezpečnostních důvodů neprovede.';
  } catch (error) {
    elements.browserOperatorStatus.textContent = error.message;
  } finally {
    elements.browserAgentPreviewButton.disabled = false;
  }
}

async function executeBrowserActionDraft() {
  const session = state.browserSession;
  const draft = state.browserActionDraft;
  if (!session?.id || !draft?.id || !draft.canExecute || !state.cloudSession) return;
  elements.browserActionExecute.disabled = true;
  elements.browserAgentPreviewButton.disabled = true;
  elements.browserOperatorStatus.textContent = 'Provádím právě jeden potvrzený krok…';
  try {
    const authorization = await state.cloud.authorization();
    const result = await request(`/api/browser-sessions/${encodeURIComponent(session.id)}/actions/${encodeURIComponent(draft.id)}/execute`, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: '{}',
    });
    elements.browserOperatorStatus.textContent = result.message || 'Krok je hotový. Zkontroluj živý náhled.';
    clearBrowserActionDraft();
  } catch (error) {
    elements.browserOperatorStatus.textContent = error.message;
    elements.browserActionExecute.disabled = false;
  } finally {
    elements.browserAgentPreviewButton.disabled = false;
  }
}

function clearBrowserActionDraft() {
  state.browserActionDraft = null;
  if (elements.browserActionPreview) elements.browserActionPreview.hidden = true;
}

function browserRiskLabel(risk) {
  return {
    read: 'KONTROLOVANÁ NAVIGACE',
    draft: 'BEZPEČNÁ ÚPRAVA KONCEPTU',
    secret: 'PŘIHLÁŠENÍ PROVÁDÍŠ TY',
    publish: 'PUBLIKACI POTVRZUJEŠ TY',
    spend: 'ROZPOČET POTVRZUJEŠ TY',
    destructive: 'NEVRATNÝ KROK BLOKOVÁN',
  }[risk] || 'KONTROLOVANÝ KROK';
}

function renderTrainingBanner() {
  const session = state.trainingSession;
  if (!session) return;
  const simulation = session.activity === 'simulation';
  const debrief = session.phase === 'debrief';
  const trainer = courseTrainer(session);
  const counterpart = session.scenario?.counterpart || trainer.counterpart;
  const coachingTrainer = state.assistantRole === 'coach_training' && simulation;
  elements.trainingModeLabel.textContent = simulation
    ? debrief ? `VYHODNOCENÍ · ${coachingTrainer ? 'KOUČOVACÍ TRENÉRKA' : 'STUDIJNÍ TRENÉRKA'}` : `${coachingTrainer ? 'COACHING LAB' : 'PRAKTICKÝ NÁCVIK'} · ${counterpart.toLocaleUpperCase('cs-CZ')}`
    : 'STUDIJNÍ TRENÉRKA · OTEVŘENÁ LEKCE';
  elements.trainingTitle.textContent = simulation ? session.scenario?.title || 'Kurzový nácvik' : session.itemTitle;
  elements.trainingContext.textContent = simulation
    ? `${session.courseTitle} · ${session.itemTitle} · ${session.scenario?.assignment || 'Procvič dovednost z lekce.'}`
    : `${session.courseTitle} · vysvětlení, aplikace, kontrola odpovědí a procvičení`;
  elements.trainingDifficultyWrap.hidden = !simulation || debrief;
  elements.trainingDifficulty.value = session.difficulty || 'standard';
  elements.finishTraining.hidden = !simulation || debrief;
  elements.retryTraining.hidden = !simulation || !debrief;
  const saved = state.trainingPortfolio.filter(entry => entry.courseId === session.courseId && entry.itemId === session.itemId).length;
  elements.trainingPortfolioStatus.textContent = debrief
    ? session.completedAt
      ? `Ověřené vyhodnocení je uloženo v tvém kurzovém portfoliu · ${saved} ${czechCountLabel(saved, 'pokus', 'pokusy', 'pokusů')} u této části.`
      : 'Plné AI vyhodnocení nebylo ověřeno a do portfolia se neuložilo. Až bude model dostupný, spusť vyhodnocení znovu.'
    : simulation
      ? `Elitea drží pouze roli: ${counterpart}. Hodnocení dostaneš až po ukončení simulace.`
      : 'Tento přepis je oddělený od soukromého koučovacího sezení.';
  elements.chatInput.placeholder = simulation
    ? debrief ? 'Můžeš se doptat na konkrétní část zpětné vazby…' : trainer.simulationPlaceholder
    : trainer.studyPlaceholder;
}

async function finishTrainingSimulation() {
  if (state.pending || state.trainingSession?.activity !== 'simulation' || state.trainingSession?.phase === 'debrief') return;
  await submitTrainingMessage('Ukončuji simulaci. Vyhodnoť prosím celý nácvik podle kompetencí této lekce.', 'debrief');
}

async function retryTrainingSimulation() {
  const session = state.trainingSession;
  if (!session || state.pending) return;
  const course = { id: session.courseId, slug: session.courseSlug, title: session.courseTitle, categoryId: session.categoryId, trainer: session.trainer };
  const item = { id: session.itemId, title: session.itemTitle };
  const difficulty = elements.trainingDifficulty.value || session.difficulty || 'standard';
  state.pending = true;
  try {
    const scenarioId = session.scenario?.id || '';
    const scenario = await request(`/api/training/scenario?courseSlug=${encodeURIComponent(session.courseSlug)}&itemId=${encodeURIComponent(session.itemId)}&difficulty=${encodeURIComponent(difficulty)}${scenarioId ? `&scenarioId=${encodeURIComponent(scenarioId)}` : ''}`);
    beginTrainingSession({
      activity: 'simulation', phase: 'roleplay', course, item, difficulty, scenario,
      messages: [{ role: 'assistant', content: scenario.openingLine, meta: `${scenario.counterpart || courseTrainer(session).counterpart} · ${difficultyLabel(difficulty)}` }],
    });
  } catch (error) {
    state.messages.push({ role: 'assistant', content: error.message, meta: 'Chyba nácviku' });
  } finally {
    state.pending = false;
    renderMessages();
  }
}

function restartStudySession() {
  const session = state.trainingSession;
  if (!session) return;
  state.trainingSession = {
    ...session,
    id: crypto.randomUUID(),
    phase: 'study',
    messages: [{ role: 'assistant', content: `Začínáme znovu s částí „${session.itemTitle}“. ${courseTrainer(session).studyOpening}`, meta: `${courseTrainer(session).label} · práce s lekcí` }],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  state.trainingSessions[state.assistantRole] = state.trainingSession;
  state.messages = state.trainingSession.messages;
  persistTrainingSession();
  renderAssistantRole();
  renderMessages();
}

function renderLessonTrainingStatus(item) {
  if (!elements.lessonTrainingStatus || !state.activeCourse || !item) return;
  const attempts = state.trainingPortfolio.filter(entry => entry.courseId === state.activeCourse.id && entry.itemId === item.id).length;
  elements.lessonTrainingStatus.textContent = attempts
    ? `${attempts} ${czechCountLabel(attempts, 'vyhodnocený nácvik', 'vyhodnocené nácviky', 'vyhodnocených nácviků')} uložené v portfoliu.`
    : 'Z této části zatím nemáš uložený nácvik.';
}

function difficultyLabel(value) {
  return { guided: 'vedená obtížnost', standard: 'standardní obtížnost', advanced: 'náročná obtížnost', expert: 'expertní obtížnost' }[value] || 'standardní obtížnost';
}

function difficultyLabelShort(value) {
  return { guided: 'Vedená', standard: 'Standardní', advanced: 'Náročná', expert: 'Expertní' }[value] || 'Standardní';
}

function saveCurrentCourseNote() {
  const item = flattenCourseItems(state.activeCourse)[state.activeItemIndex];
  if (!item) return;
  const key = progressKey(state.activeCourse, item);
  const value = elements.lessonNotes.value.slice(0, 12000);
  state.courseNotes[key] = { value, savedAt: new Date().toISOString() };
  localStorage.setItem('elitea.courseNotes', JSON.stringify(state.courseNotes));
  syncCloudState();
  elements.lessonNotesStatus.textContent = 'Uloženo v tomto prohlížeči.';
}

function progressKey(course, item) {
  return `${course.id}:${item.id}`;
}

function courseProgressPercent(course) {
  const items = flattenCourseItems(course);
  if (!items.length) {
    const total = Number(course?.itemCount) || 0;
    if (!total) return 0;
    const completed = [...state.courseProgress].filter(key => key.startsWith(`${course.id}:`)).length;
    return Math.round((completed / total) * 100);
  }
  const completed = items.filter(item => state.courseProgress.has(progressKey(course, item))).length;
  return Math.round((completed / items.length) * 100);
}

function courseKindLabel(kind, course = state.activeCourse) {
  if (kind === 'client-practice') {
    return {
      'komunikace-v-praxi': 'Komunikační situace',
      'pevna-v-sobe-intensive': 'Nácvik v situaci',
      'bachovy-kvetove-esence': 'Praxe se zájemkyní',
      'facilitace-zenskych-kruhu': 'Facilitační situace',
      'adhd-focus-motivace': 'Modelová praxe',
    }[course?.id] || 'Koučovací praxe';
  }
  return { overview: 'Přehled', lesson: 'Lekce', 'self-practice': 'Aplikace na sobě', quiz: 'Test', practice: 'Praktikum' }[kind] || 'Lekce';
}

function courseModuleLabel(module, moduleIndex = 0) {
  const title = String(module?.title || '');
  const numberedModule = title.match(/^MODUL\s+(\d+)/i);
  if (numberedModule) return `MODUL ${numberedModule[1]}`;
  if (/^ÚVODNÍ PROFESNÍ MODUL/i.test(title)) return 'ÚVODNÍ MODUL';
  if (/^ZÁVĚREČNÉ PRAKTIKUM/i.test(title)) return 'ZÁVĚREČNÉ PRAKTIKUM';
  if (/^CERTIFIKAČNÍ ZKOUŠKA/i.test(title)) return 'CERTIFIKAČNÍ ZKOUŠKA';
  return `MODUL ${moduleIndex + 1}`;
}

function moduleMaterialSummary(module, moduleIndex) {
  const items = module?.items || [];
  const minutes = items.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
  const lessons = items.filter(item => item.kind === 'lesson').length;
  const practices = items.filter(item => ['self-practice', 'client-practice', 'practice'].includes(item.kind)).length;
  const quizzes = items.filter(item => item.kind === 'quiz').length;
  const worksheets = courseMaterialsForModule(moduleIndex).length;
  const parts = [`${items.length} ${czechCountLabel(items.length, 'část', 'části', 'částí')}`];
  if (minutes) parts.push(formatStudyTime(minutes));
  if (lessons) parts.push(`${lessons} ${czechCountLabel(lessons, 'lekce', 'lekce', 'lekcí')}`);
  if (practices) parts.push(`${practices} ${czechCountLabel(practices, 'praktická část', 'praktické části', 'praktických částí')}`);
  if (quizzes) parts.push(`${quizzes} ${czechCountLabel(quizzes, 'test', 'testy', 'testů')}`);
  if (worksheets) parts.push(`${worksheets} ${czechCountLabel(worksheets, 'pracovní list', 'pracovní listy', 'pracovních listů')}`);
  return parts.join(' · ');
}

function formatStudyTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function courseMaterialsForModule(moduleIndex) {
  return (state.activeCourse?.materials || []).filter(material => Number(material.moduleIndex) === Number(moduleIndex));
}

function courseMaterialsForItem(item) {
  return (state.activeCourse?.materials || []).filter(material => material.itemId === item?.id);
}

function renderCourseMaterials(item) {
  const materials = courseMaterialsForItem(item);
  elements.lessonMaterials.hidden = materials.length === 0;
  if (!materials.length) {
    elements.lessonMaterialList.innerHTML = '';
    return;
  }
  const started = materials.filter(material => worksheetCompletion(material).completedFields > 0).length;
  elements.lessonMaterialsTitle.textContent = materials.length === 1 ? materials[0].title : 'Pracovní materiály k této části';
  elements.lessonMaterialsProgress.textContent = `${started} z ${materials.length} ${started === 1 ? 'rozpracován' : 'rozpracováno'}`;
  elements.lessonMaterialList.innerHTML = materials.map(material => {
    const completion = worksheetCompletion(material);
    return `
      <article class="lesson-material-card ${completion.completedFields ? 'started' : ''}">
        <div><span>${escapeHtml(material.categoryLabel)}</span><h4>${escapeHtml(material.title)}</h4><p>${escapeHtml(material.purpose)}</p></div>
        <aside><strong>${completion.progress} %</strong><small>${completion.completedFields} z ${material.prompts.length} částí</small><button type="button" data-open-course-material="${escapeHtml(material.id)}">${material.resourceMarkdown ? 'Otevřít přesné scénáře' : completion.completedFields ? 'Pokračovat v listu' : 'Otevřít pracovní list'} →</button></aside>
      </article>`;
  }).join('');
}

function worksheetCompletion(worksheet) {
  const entry = state.worksheetEntries[worksheet.id];
  const completedFields = Object.values(entry?.values || {}).filter(value => String(value || '').trim()).length;
  return {
    completedFields,
    progress: Math.round((completedFields / Math.max(worksheet.prompts.length, 1)) * 100),
  };
}

function czechCountLabel(value, one, few, many) {
  const count = Math.abs(Number(value) || 0);
  if (count === 1) return one;
  if (count >= 2 && count <= 4) return few;
  return many;
}

function humanStage(stage) {
  return { napad: 'Nápad', start: 'START', stabilita: 'STABILITA', rust: 'RŮST', nezjisteno: 'Fáze zatím nezjištěna' }[stage] || 'Fáze zatím nezjištěna';
}

function renderMarkdown(markdown = '') {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let listType = null;
  let table = [];

  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter(row => !row.every(cell => /^:?-{3,}:?$/.test(cell)));
    if (rows.length) {
      html.push('<div class="lesson-table-wrap"><table>');
      rows.forEach((row, index) => {
        const tag = index === 0 ? 'th' : 'td';
        html.push(`<tr>${row.map(cell => `<${tag}>${inlineMarkdown(cell)}</${tag}>`).join('')}</tr>`);
      });
      html.push('</table></div>');
    }
    table = [];
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (/^\|.*\|$/.test(line)) {
      closeList();
      table.push(line.slice(1, -1).split('|').map(cell => cell.trim()));
      return;
    }
    flushTable();
    if (!line) { closeList(); return; }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) { closeList(); html.push(`<h${Math.min(heading[1].length + 1, 5)}>${inlineMarkdown(heading[2])}</h${Math.min(heading[1].length + 1, 5)}>`); return; }
    if (/^---+$/.test(line)) { closeList(); html.push('<hr>'); return; }
    if (line.startsWith('> ')) { closeList(); html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`); return; }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (listType !== 'ul') { closeList(); listType = 'ul'; html.push('<ul>'); }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`); return;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (listType !== 'ol') { closeList(); listType = 'ol'; html.push('<ol>'); }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`); return;
    }
    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  });
  flushTable();
  closeList();
  return html.join('');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function renderContent() {
  elements.categoryFilters.innerHTML = state.categories.map(category => `
    <button class="filter-chip ${state.contentFilter === category.id ? 'active' : ''}" type="button" data-category="${escapeHtml(category.id)}">
      ${escapeHtml(category.label)}
    </button>`).join('');

  const filtered = state.content.filter(item => {
    const inCategory = state.contentFilter === 'all' || item.format === state.contentFilter;
    const haystack = `${item.title} ${item.description} ${categoryLabel(item.category)} ${formatLabel(item.format)}`.toLocaleLowerCase('cs');
    return inCategory && (!state.contentSearch || haystack.includes(state.contentSearch));
  });
  elements.libraryCount.textContent = state.content.length;
  elements.libraryEmpty.hidden = filtered.length > 0;
  elements.contentGrid.innerHTML = filtered.map(contentCardTemplate).join('');
}

function contentCardTemplate(item) {
  const palette = {
    business: ['#eadce5', '#f6efe5'], meditation: ['#dfe8ee', '#ece2ed'], yoga: ['#dce9e4', '#f0eadf'],
    aromatherapy: ['#e5e6ce', '#f3e7dd'], breath: ['#dce8ed', '#e7e0ec'], free_tips: ['#f0dfd2', '#eadbe5'],
    self_growth: ['#eadfff', '#fff1e4'], neuroplasticity: ['#dff8ef', '#ece4ff'], coaching_practice: ['#ffe0cb', '#f3e7ff'],
  }[item.category] || ['#ece8e5', '#f7f4f2'];
  const favorite = state.favorites.has(item.id);
  const status = { published: 'Otevřít', draft: 'Brzy', planned: 'Připravujeme', archived: 'Archiv' }[item.status] || 'Připravujeme';
  const length = item.length_label || `${Number(item.duration_minutes) || 0} min`;
  return `
    <article class="content-card" style="--card-a:${palette[0]};--card-b:${palette[1]}">
      <div class="content-visual">
        <span class="content-format">${escapeHtml(formatLabel(item.format))}</span>
        <button class="favorite-button ${favorite ? 'active' : ''}" type="button" data-favorite="${escapeHtml(item.id)}" aria-label="${favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}">${favorite ? '♥' : '♡'}</button>
      </div>
      <div class="content-card-body">
        <span class="content-category">${escapeHtml(categoryLabel(item.category))}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </div>
      <div class="content-meta"><span>${escapeHtml(length)} · ${escapeHtml(item.level)}</span><span class="content-status">${escapeHtml(status)}</span></div>
    </article>`;
}

function categoryLabel(category) {
  return {
    business: 'Byznys', meditation: 'Meditace', yoga: 'Jóga', aromatherapy: 'Aromaterapie',
    breath: 'Dechová cvičení', free_tips: 'Praktické tipy', self_growth: 'Sebedůvěra & sebepřijetí',
    neuroplasticity: 'Neuroplasticita', coaching_practice: 'Koučovací praxe',
  }[category] || 'Další';
}

function formatLabel(format) {
  return { ebook: 'E-book', video: 'Video', audio: 'Audio', article: 'Článek', workshop: 'Průvodce', 'quick-tip': 'Mini tip' }[format] || format;
}

async function loadStatus() {
  try {
    const status = await request('/api/status');
    state.systemStatus = status;
    updateLiveCount('techniques', status.coachingTechniqueCards ?? status.availableTechniqueCards ?? status.techniqueCards);
    updateLiveCount('knowledge', status.knowledgeRecords);
    updateLiveCount('worksheets', status.worksheets);
    elements.status.className = `status-pill ${status.providerConnected ? 'online' : 'demo'}`;
    elements.status.querySelector('span').textContent = status.providerConnected
      ? `${status.launchStage === 'controlled_beta' ? 'Řízený pilot' : 'Elitea připravena'} · ${status.coachingTechniqueCards ?? status.availableTechniqueCards ?? status.techniqueCards} koučovacích a mentoringových technik`
      : `Ukázkový režim · ${status.coachingTechniqueCards ?? status.availableTechniqueCards ?? status.techniqueCards} koučovacích a mentoringových technik`;
  } catch {
    elements.status.querySelector('span').textContent = 'Server nedostupný';
  }
}

async function loadMarketingOperatorStatus() {
  try {
    state.marketingOperator = await request('/api/marketing-operator/capabilities');
  } catch {
    state.marketingOperator = { remoteBrowser: { configured: false, targets: [] } };
  }
}

function updateLiveCount(key, value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return;
  const formatted = new Intl.NumberFormat('cs-CZ').format(count);
  document.querySelectorAll(`[data-live-count="${key}"]`).forEach(element => {
    element.textContent = formatted;
  });
}

function activeOutcomeSession() {
  return state.outcomes.records.find(record => record.id === state.outcomes.activeId && record.status === 'active') || null;
}

function openPrimaryOutcomeAction() {
  const due = dueFollowUps(state.outcomes)[0];
  if (due) {
    openOutcomeDialog('followup', due.id);
    return;
  }
  if (activeOutcomeSession()) {
    openOutcomeDialog('end');
    return;
  }
  openOutcomeDialog('start');
}

function openOutcomeDialog(step, recordId = null) {
  const allowed = new Set(['start', 'end', 'followup', 'history']);
  state.outcomeDialogStep = allowed.has(step) ? step : 'start';
  state.selectedOutcomeId = recordId;
  elements.outcomeFormStatus.textContent = '';
  elements.outcomeForm.reset();
  const issueField = elements.outcomeForm.querySelector('[data-outcome-issue]');
  const harmField = elements.outcomeForm.querySelector('[data-outcome-harm]');
  issueField.hidden = true;
  harmField.hidden = true;

  const copy = {
    start: ['MĚŘITELNÉ SEZENÍ', 'S čím chceš dnes pohnout?', 'Nejde o test tebe. Výchozí stav umožní poctivě poznat, jestli sezení opravdu pomohlo.', 'Začít měření'],
    end: ['VÝSLEDEK SEZENÍ', 'Co se během práce skutečně změnilo?', 'Ohodnoť kvalitu bez snahy Eliteu šetřit. Kritická zpětná vazba je pro zlepšování stejně důležitá jako dobrý výsledek.', 'Uložit výsledek'],
    followup: ['NÁSLEDNÁ KONTROLA', 'Co obstálo v reálném životě?', 'Skutečná kvalita se ukáže až podle toho, co zůstalo a co se podařilo udělat mimo chat.', 'Uložit kontrolu'],
    history: ['MŮJ POSUN', 'Výsledky napříč sezeními', 'Přehled rozlišuje okamžitý pocit po sezení od následné změny v realitě.', ''],
  }[state.outcomeDialogStep];
  elements.outcomeDialogOverline.textContent = copy[0];
  elements.outcomeDialogTitle.textContent = copy[1];
  elements.outcomeDialogCopy.textContent = copy[2];
  elements.outcomeSubmit.textContent = copy[3];
  elements.outcomeSubmit.hidden = state.outcomeDialogStep === 'history';
  elements.outcomeExport.hidden = state.outcomeDialogStep !== 'history' || !anonymousOutcomeRows(state.outcomes).length;

  elements.outcomeForm.querySelectorAll('[data-outcome-step]').forEach(section => {
    const active = section.dataset.outcomeStep === state.outcomeDialogStep;
    section.hidden = !active;
    section.querySelectorAll('input, textarea, select, button').forEach(control => { control.disabled = !active; });
  });
  issueField.querySelector('textarea').disabled = true;
  harmField.querySelector('textarea').disabled = true;

  if (state.outcomeDialogStep === 'start') {
    elements.outcomeForm.elements.outcome_goal.value = state.memory?.current_goal || '';
  }
  if (state.outcomeDialogStep === 'end') {
    const active = activeOutcomeSession();
    if (!active) {
      elements.outcomeFormStatus.textContent = 'Nejdřív spusť měřené sezení.';
      return;
    }
    elements.outcomeForm.elements.after_clarity.value = Math.max(active.before.clarity, 5);
    elements.outcomeForm.elements.after_confidence.value = Math.max(active.before.confidence, 5);
    elements.outcomeForm.elements.agreed_action.value = state.memory?.active_task?.title || '';
  }
  if (state.outcomeDialogStep === 'followup') {
    const record = state.outcomes.records.find(item => item.id === recordId);
    if (!record) return;
    elements.outcomeFollowupRecap.innerHTML = `<span>SEZENÍ ${escapeHtml(formatOutcomeDate(record.completedAt))}</span><strong>${escapeHtml(record.goal || 'Téma nebylo pojmenováno')}</strong><p>${record.after?.agreedAction ? `Domluvený krok: ${escapeHtml(record.after.agreedAction)}` : 'Bez zaznamenaného konkrétního kroku.'}</p>`;
  }
  if (state.outcomeDialogStep === 'history') renderOutcomeHistory();
  if (!elements.outcomeDialog.open) elements.outcomeDialog.showModal();
}

function closeOutcomeDialog() {
  if (elements.outcomeDialog?.open) elements.outcomeDialog.close();
}

function submitOutcomeForm(event) {
  event.preventDefault();
  if (!elements.outcomeForm.reportValidity()) return;
  const values = Object.fromEntries(new FormData(elements.outcomeForm));

  if (state.outcomeDialogStep === 'start') {
    state.outcomes = beginMeasuredSession(state.outcomes, {
      goal: values.outcome_goal,
      clarity: values.before_clarity,
      confidence: values.before_confidence,
      consultationMode: state.consultationMode,
      appVersion: APP_VERSION,
    });
  } else if (state.outcomeDialogStep === 'end') {
    state.outcomes = finishMeasuredSession(state.outcomes, {
      clarity: values.after_clarity,
      confidence: values.after_confidence,
      understood: values.understood,
      grounded: values.grounded,
      insight: values.insight,
      nextStepFit: values.next_step_fit,
      autonomy: values.autonomy,
      keyLearning: values.key_learning,
      agreedAction: values.agreed_action,
      harmfulOrWrong: values.harmful_or_wrong === 'on',
      issueNote: values.issue_note,
      techniqueId: state.lastCoachTurnMeta?.techniqueId,
      provider: state.lastCoachTurnMeta?.provider,
      qualityScore: state.lastCoachTurnMeta?.qualityScore,
      qualityPassed: state.lastCoachTurnMeta?.qualityPassed,
      qualityRepaired: state.lastCoachTurnMeta?.qualityRepaired,
    });
  } else if (state.outcomeDialogStep === 'followup') {
    state.outcomes = recordOutcomeFollowUp(state.outcomes, state.selectedOutcomeId, {
      actionStatus: values.action_status,
      retainedUsefulness: values.retained_usefulness,
      evidence: values.evidence,
      blocker: values.blocker,
      worseOrHarmed: values.worse_or_harmed === 'on',
      harmNote: values.harm_note,
    });
  }

  state.outcomes = saveOutcomeStore(state.outcomes);
  syncCloudState();
  renderOutcomeCard();
  closeOutcomeDialog();
}

function renderOutcomeCard() {
  if (!elements.outcomeCard) return;
  const active = activeOutcomeSession();
  const due = dueFollowUps(state.outcomes)[0];
  const summary = outcomeSummary(state.outcomes);
  const waiting = state.outcomes.records.find(record => record.status === 'completed');

  if (due) {
    elements.outcomeCardTitle.textContent = 'Jak dopadl domluvený krok?';
    elements.outcomeCardCopy.textContent = 'Teď už lze odlišit dobrý pocit po sezení od změny, která opravdu vydržela.';
    elements.outcomePrimaryButton.textContent = 'Zapsat následnou kontrolu';
    if (elements.outcomeToolbarButton) elements.outcomeToolbarButton.textContent = 'Ověřit dopad';
  } else if (active) {
    elements.outcomeCardTitle.textContent = 'Měření sezení běží';
    elements.outcomeCardCopy.textContent = `${active.goal || 'Téma je zachycené'} · jasno ${active.before.clarity}/10 · důvěra ${active.before.confidence}/10.`;
    elements.outcomePrimaryButton.textContent = 'Ukončit a zhodnotit sezení';
    if (elements.outcomeToolbarButton) elements.outcomeToolbarButton.textContent = 'Zhodnotit sezení';
  } else {
    elements.outcomeCardTitle.textContent = summary.sessions
      ? `${summary.sessions} ${summary.sessions === 1 ? 'změřené sezení' : summary.sessions < 5 ? 'změřená sezení' : 'změřených sezení'}`
      : 'Změna, ne jen příjemný chat';
    elements.outcomeCardCopy.textContent = summary.sessions
      ? `Průměrná změna jasnosti ${signedMetric(summary.averageClarityDelta)} bodu. ${summary.actionRate === null ? waiting ? `Kontrola dopadu čeká ${formatOutcomeDate(waiting.followUpDueAt)}.` : 'Další krok zatím nebyl ověřen.' : `${summary.actionRate} % kroků bylo splněno nebo rozpracováno.`}`
      : 'Zachyť výchozí stav, výsledek sezení a po pár dnech ověř, co se skutečně změnilo.';
    elements.outcomePrimaryButton.textContent = 'Začít měřené sezení';
    if (elements.outcomeToolbarButton) elements.outcomeToolbarButton.textContent = 'Měřit sezení';
  }
}

function renderOutcomeHistory() {
  const summary = outcomeSummary(state.outcomes);
  const metric = (label, value, suffix = '') => `<article><strong>${value ?? '—'}${value === null ? '' : suffix}</strong><span>${label}</span></article>`;
  elements.outcomeSummaryGrid.innerHTML = [
    metric('změřených sezení', summary.sessions),
    metric('změna jasnosti', signedMetric(summary.averageClarityDelta)),
    metric('krok proveden / rozpracován', summary.actionRate, '%'),
    metric('označený problém', summary.flaggedSessions),
  ].join('');

  const records = state.outcomes.records.filter(record => record.after);
  elements.outcomeHistoryList.innerHTML = records.length ? records.map(record => `
    <article>
      <div><span>${escapeHtml(formatOutcomeDate(record.completedAt))} · ${escapeHtml(humanMode(record.consultationMode))}</span><strong>${escapeHtml(record.goal || 'Nepojmenované téma')}</strong></div>
      <p>Jasnost ${record.before.clarity} → ${record.after.clarity} · důvěra ${record.before.confidence} → ${record.after.confidence}</p>
      <b class="${record.followUp ? 'done' : ''}">${record.followUp ? `Dopad: ${escapeHtml(humanActionStatus(record.followUp.actionStatus))}` : `Kontrola ${escapeHtml(formatOutcomeDate(record.followUpDueAt))}`}</b>
    </article>`).join('') : '<p class="outcome-empty">Zatím tu není dokončené měřené sezení.</p>';
}

function downloadAnonymousOutcomes() {
  const rows = anonymousOutcomeRows(state.outcomes);
  if (!rows.length) return;
  const blob = new Blob([`\uFEFF${outcomeRowsToCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `elitea-anonymni-vysledky-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  elements.outcomeFormStatus.textContent = 'Anonymní export byl stažen. Neobsahuje chat ani volné textové odpovědi.';
}

function signedMetric(value) {
  if (value === null || value === undefined) return '—';
  return value > 0 ? `+${value}` : String(value);
}

function formatOutcomeDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date) : 'později';
}

function humanActionStatus(status) {
  return { yes: 'krok dokončen', partial: 'krok rozpracován', no: 'krok neproveden', not_applicable: 'bez domluveného kroku' }[status] || 'nezjištěno';
}

async function onSubmit(event) {
  event.preventDefault();
  const content = elements.chatInput.value.trim();
  if (!content || state.pending) return;

  if (isTrainingRole()) {
    elements.chatInput.value = '';
    autoResize();
    const requestedPhase = state.trainingSession?.activity === 'simulation' && /\b(stop|ukonč|ukonc|konec simulace|vyhodnoť|vyhodnot)\b/i.test(content)
      ? 'debrief'
      : null;
    await submitTrainingMessage(content, requestedPhase);
    return;
  }

  const chosenAddressForm = inferAddressForm(content, state.memory?.identity_preferences?.address_form);
  if (chosenAddressForm) {
    state.memory.identity_preferences.address_form = chosenAddressForm;
    persistMemory();
  }

  state.messages.push({ role: 'user', content });
  elements.chatInput.value = '';
  autoResize();
  await requestCoachReply();
}

async function requestCoachReply() {
  if (state.pending) return;
  const retryContext = {
    consultationMode: state.consultationMode,
    techniqueSession: cloneSerializable(state.techniqueSessions[state.consultationMode] || null),
    memory: cloneSerializable(state.memory),
    lastMethod: cloneSerializable(state.lastMethod),
    lastCoachTurnMeta: cloneSerializable(state.lastCoachTurnMeta),
  };
  state.pending = true;
  persistMessages();
  renderMessages(true);
  let openOutcomeAfterReply = false;

  try {
    const authorization = state.cloudSession ? await state.cloud?.authorization() : '';
    const result = await request('/api/chat', {
      method: 'POST',
      headers: authorization ? { Authorization: authorization } : {},
      body: JSON.stringify({
        messages: state.messages,
        memory: state.memory,
        consultationMode: state.consultationMode,
        brandWorkMode: state.assistantRole === 'brand' ? state.brandWorkMode : null,
        techniqueSession: state.techniqueSessions[state.consultationMode] || null,
      }),
    });
    state.messages.push({
      role: 'assistant',
      content: result.text,
      meta: result.mode === 'crisis'
        ? 'Bezpečnostní protokol'
        : humanMode(result.mode),
      quality: {
        provider: result.provider || null,
        score: result.qualityGate?.score ?? null,
        passed: result.qualityGate?.pass ?? null,
        repaired: result.qualityGate?.repaired ?? false,
      },
      retryContext,
    });
    if (result.mode !== 'crisis') {
      state.lastCoachTurnMeta = {
        techniqueId: result.techniqueSession?.techniqueId || null,
        provider: result.provider || null,
        qualityScore: result.qualityGate?.score ?? null,
        qualityPassed: result.qualityGate?.pass ?? null,
        qualityRepaired: result.qualityGate?.repaired ?? false,
      };
      state.memory.progress = recordActiveDay(state.memory.progress);
      if (result.memoryPatch?.roleMemory?.role && result.memoryPatch?.roleMemory?.continuity) {
        const role = result.memoryPatch.roleMemory.role;
        const roleMemories = { ...(state.memory.role_memories || {}) };
        roleMemories[role] = { ...(roleMemories[role] || {}), continuity: result.memoryPatch.roleMemory.continuity };
        state.memory = normalizeMemory({
          ...state.memory,
          role_memories: roleMemories,
          ...(role === 'coach' ? { continuity: result.memoryPatch.roleMemory.continuity } : {}),
        });
      } else if (result.memoryPatch?.continuity) {
        state.memory = normalizeMemory({ ...state.memory, continuity: result.memoryPatch.continuity });
      }
      state.lastMethod = { name: humanApproach(result.mode) };
      state.lastMethods[state.consultationMode] = state.lastMethod;
      persistLastMethods();
      if (result.techniqueSession) state.techniqueSessions[state.consultationMode] = result.techniqueSession;
      else delete state.techniqueSessions[state.consultationMode];
      persistTechniqueSessions();
      persistMemory();
      openOutcomeAfterReply = state.pendingOutcomeClosure;
    }
  } catch (error) {
    state.messages.push({ role: 'assistant', content: error.message, meta: 'Chyba spojení' });
  } finally {
    state.pending = false;
    persistMessages();
    renderMemory();
    renderMessages();
    state.pendingOutcomeClosure = false;
    if (openOutcomeAfterReply) window.setTimeout(() => openOutcomeDialog('end'), 0);
  }
}

async function submitTrainingMessage(content, requestedPhase = null, { appendUser = true } = {}) {
  const session = state.trainingSession;
  if (!session || state.pending || (appendUser && !content)) return;
  if (appendUser) state.messages.push({ role: 'user', content });
  session.messages = state.messages;
  state.pending = true;
  persistTrainingSession();
  renderMessages(true);

  const phase = requestedPhase || session.phase;
  const retryContext = {
    phase,
    completedAt: session.completedAt || null,
  };
  try {
    const authorization = state.cloudSession ? await state.cloud?.authorization() : '';
    const result = await request('/api/training', {
      method: 'POST',
      headers: authorization ? { Authorization: authorization } : {},
      body: JSON.stringify({
        messages: state.messages,
        memory: state.memory,
        courseSlug: session.courseSlug,
        itemId: session.itemId,
        activity: session.activity,
        phase,
        difficulty: session.difficulty,
        scenarioId: session.scenario?.id || null,
        counterpartHint: session.scenario?.counterpartHint || null,
      }),
    });
    const assistantMessage = {
      role: 'assistant',
      content: result.text,
      meta: result.phase === 'debrief'
        ? `${courseTrainer(session).label} · rozbor dovedností`
        : result.activity === 'simulation'
          ? result.scenario?.counterpart || courseTrainer(session).counterpart
          : courseTrainer(session).label,
      quality: {
        provider: result.provider || null,
        score: null,
        passed: result.qualityGate?.pass ?? null,
        repaired: result.qualityGate?.repaired ?? false,
      },
      retryContext,
    };
    state.messages = result.autoTransition ? [assistantMessage] : [...state.messages, assistantMessage];
    session.messages = state.messages;
    session.activity = result.activity || session.activity;
    session.phase = result.phase;
    session.scenario = result.scenario || session.scenario;
    if (result.phase === 'debrief') {
      if (result.qualityGate?.pass === false) {
        session.completedAt = null;
      } else {
        session.completedAt = new Date().toISOString();
        saveTrainingPortfolioEntry(session, result.text, result.achievement);
      }
    }
  } catch (error) {
    state.messages.push({ role: 'assistant', content: error.message, meta: 'Chyba studijního režimu' });
    session.messages = state.messages;
  } finally {
    state.pending = false;
    persistTrainingSession();
    renderAssistantRole();
    renderMessages();
  }
}

function handleMessageAction(event) {
  const retry = event.target.closest('[data-retry-message]');
  const report = event.target.closest('[data-report-message]');
  if (retry) retryAssistantMessage(Number(retry.dataset.retryMessage));
  if (report) openQualityReport(Number(report.dataset.reportMessage));
}

async function retryAssistantMessage(index) {
  if (state.pending || !Number.isInteger(index) || state.messages[index]?.role !== 'assistant') return;
  if (state.messages.slice(index + 1).some(message => message.role === 'user')) return;
  const replacedMessage = state.messages[index];
  state.messages.splice(index, 1);
  if (isTrainingRole()) {
    if (state.trainingSession) {
      state.trainingSession.messages = state.messages;
      state.trainingSession.completedAt = replacedMessage.retryContext?.completedAt || null;
      if (replacedMessage.retryContext?.phase === 'debrief') {
        removeTrainingPortfolioEntry(state.trainingSession.id);
      }
    }
    const phase = replacedMessage.retryContext?.phase || state.trainingSession?.phase || 'study';
    persistTrainingSession();
    await submitTrainingMessage('', phase, { appendUser: false });
    return;
  }
  const retryContext = replacedMessage.retryContext;
  if (retryContext?.consultationMode === state.consultationMode) {
    state.memory = normalizeMemory(retryContext.memory || {});
    state.lastMethod = retryContext.lastMethod || null;
    state.lastMethods[state.consultationMode] = state.lastMethod;
    state.lastCoachTurnMeta = retryContext.lastCoachTurnMeta || null;
    if (retryContext.techniqueSession) state.techniqueSessions[state.consultationMode] = retryContext.techniqueSession;
    else delete state.techniqueSessions[state.consultationMode];
    persistMemory();
    persistLastMethods();
    persistTechniqueSessions();
  }
  persistMessages();
  await requestCoachReply();
}

function openQualityReport(index) {
  if (!Number.isInteger(index) || state.messages[index]?.role !== 'assistant') return;
  state.qualityReportTarget = index;
  elements.qualityReportForm?.reset();
  elements.qualityReportStatus.textContent = 'Text rozhovoru se neodesílá. Hlášení obsahuje jen typ chyby a technická metadata odpovědi.';
  elements.qualityReportStatus.className = 'quality-report-status';
  elements.qualityReportDialog?.showModal();
}

function closeQualityReport() {
  state.qualityReportTarget = null;
  if (elements.qualityReportDialog?.open) elements.qualityReportDialog.close();
}

async function submitQualityReport(event) {
  event.preventDefault();
  if (!elements.qualityReportForm?.reportValidity()) return;
  const index = state.qualityReportTarget;
  const message = state.messages[index];
  if (!message || message.role !== 'assistant') return closeQualityReport();
  const issue = new FormData(elements.qualityReportForm).get('quality_issue');
  const submit = elements.qualityReportForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  elements.qualityReportStatus.textContent = 'Odesílám anonymní hlášení…';
  try {
    await request('/api/quality-report', {
      method: 'POST',
      body: JSON.stringify({
        reportId: crypto.randomUUID(),
        surface: isTrainingRole() ? 'training' : state.assistantRole === 'brand' ? 'brand' : 'coach',
        issue,
        provider: message.quality?.provider || state.lastCoachTurnMeta?.provider || null,
        qualityScore: message.quality?.score ?? state.lastCoachTurnMeta?.qualityScore ?? null,
        qualityPassed: message.quality?.passed ?? state.lastCoachTurnMeta?.qualityPassed ?? null,
        qualityRepaired: message.quality?.repaired ?? state.lastCoachTurnMeta?.qualityRepaired ?? false,
        consultationMode: isTrainingRole() ? null : state.consultationMode,
        courseId: state.trainingSession?.courseId || null,
        itemId: state.trainingSession?.itemId || null,
        phase: state.trainingSession?.phase || null,
        appVersion: APP_VERSION,
      }),
    });
    message.reported = true;
    isTrainingRole() ? persistTrainingSession() : persistMessages();
    renderMessages();
    elements.qualityReportStatus.textContent = 'Děkuji. Hlášení je uložené bez textu rozhovoru.';
    window.setTimeout(closeQualityReport, 700);
  } catch (error) {
    elements.qualityReportStatus.textContent = error.message;
    elements.qualityReportStatus.className = 'quality-report-status error';
  } finally {
    submit.disabled = false;
  }
}

function renderMessages(showTyping = false) {
  const hasMessages = state.messages.length > 0;
  elements.welcome.hidden = hasMessages;
  elements.endSession.hidden = state.assistantRole !== 'coach' || !hasMessages;
  elements.messages.innerHTML = state.messages.map(messageTemplate).join('');
  if (showTyping) {
    elements.messages.insertAdjacentHTML('beforeend', `
      <article class="message assistant" aria-label="Elitea píše">
        <div class="message-avatar">E</div>
        <div><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>
      </article>`);
  }
  requestAnimationFrame(() => { elements.chatScroll.scrollTop = elements.chatScroll.scrollHeight; });
  document.querySelector('.send-button').disabled = state.pending;
  document.querySelectorAll('[data-consultation-mode]').forEach(button => {
    button.disabled = state.pending;
  });
}

function messageTemplate(message, index) {
  const user = message.role === 'user';
  const latestAssistantIndex = state.messages.findLastIndex(item => item.role === 'assistant');
  const actions = !user && index === latestAssistantIndex && !state.pending
    ? `<div class="message-quality-actions" aria-label="Kontrola odpovědi">
        <button type="button" data-retry-message="${index}">↻ Zkusit odpověď znovu</button>
        <button type="button" data-report-message="${index}" ${message.reported ? 'disabled' : ''}>${message.reported ? '✓ Nahlášeno' : 'Nahlásit chybu'}</button>
      </div>`
    : '';
  return `
    <article class="message ${user ? 'user' : 'assistant'}">
      <div class="message-avatar">${user ? escapeHtml(initials(state.memory?.identity_preferences?.preferred_name) || 'TY') : 'E'}</div>
      <div>
        <div class="bubble">${formatText(message.content)}</div>
        ${message.meta ? `<div class="message-meta">${escapeHtml(message.meta)}</div>` : ''}
        ${actions}
      </div>
    </article>`;
}

function renderMemory() {
  const memory = state.memory;
  const name = memory?.identity_preferences?.preferred_name;
  const stage = memory?.business_context?.stage || 'nezjisteno';
  const labels = { napad: 'Nápad', start: 'START', stabilita: 'STABILITA', rust: 'RŮST', nezjisteno: 'Nezjištěno' };

  elements.memoryName.textContent = name || 'Nezadáno';
  elements.memoryStage.textContent = labels[stage] || 'Nezjištěno';
  elements.memoryIndustry.textContent = memory?.business_context?.industry || 'Nezadáno';
  elements.memoryCustomer.textContent = memory?.business_context?.target_customer || 'Nezadáno';
  elements.memoryObstacle.textContent = memory?.coaching_profile?.main_obstacle || 'Nezadáno';
  elements.memorySupport.textContent = {
    koucovani: 'Koučovací otázky',
    mentoring: 'Přímý mentoring',
    kombinace: 'Kombinace',
  }[memory?.coaching_profile?.support_style] || 'Kombinace';
  elements.memoryLastFocus.textContent = memory?.continuity?.last_focus || 'Zatím žádné';
  if (state.assistantRole !== 'brand') {
    elements.welcomeTitle.textContent = name ? `Krásný den, ${vocativeHint(name)}. Jsem Elitea.` : 'Krásný den. Jsem Elitea.';
  }

  elements.goalText.textContent = memory?.current_goal || 'Vybereme spolu';
  elements.goalDescription.textContent = memory?.current_goal
    ? 'Tento cíl používám pro prioritizaci doporučení a dalších kroků.'
    : 'Po první konverzaci tu uvidíš jeden cíl, který má právě teď největší dopad.';

  const task = memory?.active_task;
  elements.taskText.textContent = task?.title || 'Zatím bez úkolu';
  elements.taskButton.disabled = !task || task.status === 'splneny';
  elements.taskButton.textContent = task?.status === 'splneny' ? 'Hotovo' : 'Označit jako hotové';
  elements.taskCheck.classList.toggle('done', task?.status === 'splneny');

  const activeDays = memory?.progress?.active_day_count || 0;
  elements.activeDayCount.textContent = activeDayLabel(activeDays);
  elements.journeyStage.textContent = activeDays < 3 ? 'Poznání' : activeDays < 8 ? 'Směr' : 'Realizace';
  elements.journeyProgress.style.width = `${Math.min(100, 8 + activeDays * 7)}%`;
  if (state.assistantRole === 'brand') renderBrandWorkMode();
  else elements.onboardingButton.textContent = 'Napsat, co právě řeším →';

  elements.methodName.textContent = state.lastMethod?.name || 'Nejdřív tě poznám';
  elements.methodDescription.textContent = state.lastMethod
    ? 'Způsob vedení přizpůsobuji tématu, situaci a tvé aktuální kapacitě.'
    : 'Metodu vybírám podle tvého tématu, kontextu a kapacity — nikdy jen podle jednoho slova.';
}

function humanApproach(mode) {
  return {
    koucovaci_hodina: 'Klasický koučink',
    mentoringova_konzultace: 'Byznys mentoring',
    nlp_konzultace: 'NLP a práce s jazykem',
    behavioralni_konzultace: 'Myšlenky a chování',
    somaticka_konzultace: 'Somaticky orientované sezení',
    koucovaci_podpora: 'Citlivé společné prozkoumání',
    mentoring: 'Přímý praktický mentoring',
    rychle_reseni: 'Rychlé praktické řešení',
    podporna_stabilizace: 'Bezpečné zklidnění',
    podpora_fungovani: 'Podpora každodenního fungování',
    vedena_meditace: 'Vedené zklidnění na míru',
    diagnostika: 'Pochopení skutečné situace',
  }[mode] || 'Podpora podle tvé situace';
}

function openMemory() {
  const form = elements.memoryForm.elements;
  form.preferred_name.value = state.memory?.identity_preferences?.preferred_name || '';
  form.address_form.value = state.memory?.identity_preferences?.address_form || 'nezvoleno';
  form.stage.value = state.memory?.business_context?.stage || 'nezjisteno';
  form.industry.value = state.memory?.business_context?.industry || '';
  form.primary_offer.value = state.memory?.business_context?.primary_offer || '';
  form.target_customer.value = state.memory?.business_context?.target_customer || '';
  form.current_goal.value = state.memory?.current_goal || '';
  form.main_obstacle.value = state.memory?.coaching_profile?.main_obstacle || '';
  form.support_style.value = state.memory?.coaching_profile?.support_style || 'kombinace';
  form.weekly_capacity.value = state.memory?.coaching_profile?.weekly_capacity || '';
  form.personal_boundaries.value = state.memory?.coaching_profile?.personal_boundaries || '';
  form.support_accommodations.value = state.memory?.coaching_profile?.support_accommodations || '';
  elements.memoryDialog.showModal();
}

function openHandoff() {
  resetHandoff();
  const goal = state.memory?.current_goal || '';
  const focus = state.memory?.continuity?.last_focus || '';
  elements.handoffTopic.value = goal || focus;
  elements.handoffDialog.showModal();
}

function closeHandoff() {
  elements.handoffDialog.close();
  resetHandoff();
}

function resetHandoff() {
  state.handoffDraft = '';
  state.bookingWithDocument = false;
  state.bookingRequestId = '';
  elements.handoffTopic.value = '';
  elements.handoffDocument.value = '';
  elements.handoffConsent.checked = false;
  elements.bookingForm.reset();
  elements.bookingError.hidden = true;
  elements.bookingError.textContent = '';
  document.querySelector('#confirm-handoff').disabled = true;
  showHandoffStep('choice');
}

function showHandoffStep(step) {
  elements.handoffChoice.hidden = step !== 'choice';
  elements.handoffPreview.hidden = step !== 'preview';
  elements.handoffReady.hidden = step !== 'ready';
  elements.handoffBooking.hidden = step !== 'booking';
}

function prepareHandoffDraft() {
  const topic = requireHandoffTopic();
  if (!topic) return;

  state.handoffDraft = buildHandoffDocument(topic);
  elements.handoffDocument.value = state.handoffDraft;
  elements.handoffConsent.checked = false;
  document.querySelector('#confirm-handoff').disabled = true;
  showHandoffStep('preview');
  elements.handoffDocument.focus();
}

function buildHandoffDocument(topic) {
  const name = state.memory?.identity_preferences?.preferred_name || 'neuvedeno';
  const stage = {
    napad: 'nápad', start: 'start', stabilita: 'stabilita', rust: 'růst', nezjisteno: 'neuvedeno',
  }[state.memory?.business_context?.stage] || 'neuvedeno';
  const industry = state.memory?.business_context?.industry || 'neuvedeno';
  const offer = state.memory?.business_context?.primary_offer || 'neuvedeno';
  const customer = state.memory?.business_context?.target_customer || 'neuvedeno';
  const goal = state.memory?.current_goal || 'neuvedeno';
  const obstacle = state.memory?.coaching_profile?.main_obstacle || 'neuvedeno';
  const focus = state.memory?.continuity?.last_focus || 'neuvedeno';

  return [
    'PODKLAD PRO KONZULTACI S NIOU',
    '',
    `Klientka: ${name}`,
    `Téma konzultace: ${topic}`,
    '',
    'PRACOVNÍ KONTEXT',
    `Fáze podnikání: ${stage}`,
    `Obor: ${industry}`,
    `Aktuální nabídka: ${offer}`,
    `Cílová skupina: ${customer}`,
    '',
    'CO JE TEĎ PODSTATNÉ',
    `Aktuální cíl: ${goal}`,
    `Hlavní překážka: ${obstacle}`,
    `Poslední pracovní téma: ${focus}`,
    '',
    'CO CHCI S NIOU VYŘEŠIT',
    topic,
    '',
    'Syrový chat není součástí podkladu. Tento konkrétní text lze přiložit pouze po výslovném schválení klientkou.',
  ].join('\n');
}

function confirmHandoffDraft() {
  if (!elements.handoffConsent.checked) return;
  state.handoffDraft = cleanText(elements.handoffDocument.value, 6000);
  openBookingForm(true);
}

function bookWithoutSummary() {
  if (!requireHandoffTopic()) return;
  state.handoffDraft = '';
  openBookingForm(false);
}

function requireHandoffTopic() {
  const topic = cleanText(elements.handoffTopic.value, 1500);
  if (topic) return topic;
  elements.handoffTopic.focus();
  elements.handoffTopic.setCustomValidity('Napiš prosím, co chceš s Niou řešit.');
  elements.handoffTopic.reportValidity();
  elements.handoffTopic.addEventListener('input', () => elements.handoffTopic.setCustomValidity(''), { once: true });
  return '';
}

function openBookingForm(withDocument) {
  state.bookingWithDocument = withDocument;
  state.bookingRequestId = crypto.randomUUID();
  elements.bookingName.value = state.memory?.identity_preferences?.preferred_name || '';
  elements.bookingDate.min = new Date().toISOString().slice(0, 10);
  elements.bookingSharingStatus.textContent = withDocument
    ? 'Rezervační údaje a tebou schválený podklad. Chat ani jeho přepis nikoli.'
    : 'Pouze rezervační údaje z tohoto formuláře. Žádný podklad ani chat.';
  elements.bookingConsentCopy.textContent = withDocument
    ? 'Souhlasím s odesláním těchto rezervačních údajů a schváleného podkladu Nii. Rozumím, že chat se neodesílá.'
    : 'Souhlasím s odesláním pouze těchto rezervačních údajů Nii. Rozumím, že podklad ani chat se neodesílají.';
  elements.bookingError.hidden = true;
  showHandoffStep('booking');
  elements.bookingName.focus();
}

async function submitBookingRequest(event) {
  event.preventDefault();
  if (!elements.bookingForm.reportValidity()) return;
  const data = new FormData(elements.bookingForm);
  const submit = document.querySelector('#submit-booking');
  submit.disabled = true;
  submit.textContent = 'Odesílám…';
  elements.bookingError.hidden = true;

  try {
    await request('/api/booking-request', {
      method: 'POST',
      body: JSON.stringify({
        id: state.bookingRequestId,
        name: data.get('name'),
        email: data.get('email'),
        preferredDate: data.get('preferred_date'),
        timeWindow: data.get('time_window'),
        topic: cleanText(elements.handoffTopic.value, 1500),
        documentApproved: state.bookingWithDocument,
        document: state.bookingWithDocument ? state.handoffDraft : '',
        consent: document.querySelector('#booking-final-consent').checked,
        company: data.get('company'),
      }),
    });
    elements.handoffReadyTitle.textContent = 'Žádost o termín byla odeslána';
    elements.handoffReadyCopy.textContent = 'Nia dostala tvé rezervační údaje a ozve se ti na uvedený e-mail. Tvoje konverzace zůstala soukromá.';
    elements.handoffSharingStatus.textContent = state.bookingWithDocument
      ? 'Odeslaly se rezervační údaje a schválený dokument. Chat nikoli.'
      : 'Odeslaly se pouze rezervační údaje. Podklad ani chat nikoli.';
    showHandoffStep('ready');
  } catch (error) {
    elements.bookingError.textContent = error.message;
    elements.bookingError.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Odeslat žádost Nii';
  }
}

function saveMemory(event) {
  event.preventDefault();
  const data = new FormData(elements.memoryForm);
  const payload = {
    identity_preferences: {
      preferred_name: data.get('preferred_name'),
      address_form: data.get('address_form'),
    },
    business_context: {
      stage: data.get('stage'),
      industry: data.get('industry'),
      primary_offer: data.get('primary_offer'),
      target_customer: data.get('target_customer'),
    },
    current_goal: data.get('current_goal'),
    active_task: state.memory?.active_task || null,
    coaching_profile: {
      ...state.memory?.coaching_profile,
      main_obstacle: data.get('main_obstacle'),
      support_style: data.get('support_style'),
      weekly_capacity: data.get('weekly_capacity'),
      personal_boundaries: data.get('personal_boundaries'),
      support_accommodations: data.get('support_accommodations'),
    },
    progress: state.memory?.progress,
  };

  state.memory = normalizeMemory(payload);
  persistMemory();
  renderMemory();
  elements.memoryDialog.close();
}

function deleteMemory() {
  if (!confirm('Opravdu chceš smazat pracovní paměť Elitea?')) return;
  state.memory = normalizeMemory();
  state.messages = [];
  state.conversations = {};
  state.lastMethods = {};
  state.lastMethod = null;
  state.techniqueSessions = {};
  state.trainingSessions = {};
  state.trainingSession = null;
  state.assistantRole = 'coach';
  sessionStorage.removeItem('elitea.messages');
  sessionStorage.removeItem('elitea.conversations');
  sessionStorage.removeItem('elitea.lastMethods');
  sessionStorage.removeItem('elitea.lastMethod');
  sessionStorage.removeItem('elitea.techniqueSessions');
  sessionStorage.removeItem('elitea.trainingSession');
  sessionStorage.removeItem('elitea.trainingSessions');
  sessionStorage.setItem('elitea.assistantRole', 'coach');
  persistMemory();
  renderAssistantRole();
  renderMemory();
  renderMessages();
  elements.memoryDialog.close();
}

function completeTask() {
  if (!state.memory?.active_task) return;
  state.memory.active_task.status = 'splneny';
  state.memory.progress.completed_milestones.push({
    title: state.memory.active_task.title,
    completed_at: new Date().toISOString(),
  });
  persistMemory();
  renderMemory();
  celebrateMilestone();
}

function startFirstConversation() {
  elements.chatInput.focus();
}

function setConsultationMode(mode) {
  if (state.pending || state.assistantRole !== 'coach') return;
  const nextMode = normalizeConsultationMode(mode);
  if (nextMode === state.consultationMode) return;

  persistMessages();
  const previousConversation = state.conversations[nextMode] || [];
  if (previousConversation.length) {
    state.pendingModeSwitch = nextMode;
    renderModeResume(nextMode, previousConversation);
    elements.modeResumeDialog.showModal();
    return;
  }

  activateConsultationMode(nextMode, []);
}

function activateConsultationMode(mode, messages) {
  state.consultationMode = normalizeConsultationMode(mode);
  state.messages = Array.isArray(messages) ? [...messages] : [];
  state.lastMethod = state.lastMethods[state.consultationMode] || null;
  state.pendingModeSwitch = null;
  sessionStorage.setItem('elitea.consultationMode', state.consultationMode);
  sessionStorage.setItem('elitea.messages', JSON.stringify(state.messages.slice(-200)));
  persistLastMethods();
  renderConsultationMode();
  renderMessages();
  renderMemory();
  elements.chatInput.focus();
}

function renderModeResume(mode, messages) {
  const summary = summarizeConversation(mode, messages);
  elements.modeResumeArea.textContent = summary.area.toUpperCase();
  elements.modeResumeTopic.textContent = summary.topic;
  elements.modeResumeLast.textContent = summary.last;
  elements.modeResumeNext.textContent = summary.next;
}

function resumeModeSession() {
  const mode = state.pendingModeSwitch;
  if (!mode) return closeModeResume();
  const messages = state.conversations[mode] || [];
  elements.modeResumeDialog.close();
  activateConsultationMode(mode, messages);
}

function startFreshModeSession() {
  const mode = state.pendingModeSwitch;
  if (!mode) return closeModeResume();
  delete state.conversations[mode];
  delete state.lastMethods[mode];
  delete state.techniqueSessions[mode];
  sessionStorage.setItem('elitea.conversations', JSON.stringify(state.conversations));
  persistLastMethods();
  persistTechniqueSessions();
  elements.modeResumeDialog.close();
  activateConsultationMode(mode, []);
  persistMessages();
}

function closeModeResume() {
  state.pendingModeSwitch = null;
  if (elements.modeResumeDialog.open) elements.modeResumeDialog.close();
  renderConsultationMode();
}

function renderConsultationMode() {
  const modes = {
    auto: {
      title: 'Nové sezení. Začneme u tebe.',
      description: 'Popiš, co řešíš, a Elitea zvolí vhodný způsob vedení.',
      placeholder: 'Napiš mi, co právě řešíš…',
    },
    coaching_session: {
      title: 'Nové koučovací sezení.',
      description: 'Držím klasický koučovací rámec, postupuji otázku po otázce a neradím, dokud to není užitečné.',
      placeholder: 'S jakým tématem přicházíš na koučovací sezení?',
    },
    business_mentoring: {
      title: 'Nový byznys mentoring.',
      description: 'Nejdřív pochopím fakta, potom dám přímý pohled, možnosti, rizika a postup.',
      placeholder: 'Jakou byznysovou situaci potřebuješ vyřešit?',
    },
    nlp_reframing: {
      title: 'Nové sezení s jazykem a perspektivou.',
      description: 'Pracujeme s cílem, jazykem a perspektivou — bez léčebných tvrzení a vždy po jednom konkrétním kroku.',
      placeholder: 'Jakou situaci, formulaci nebo vnitřní nastavení chceš změnit?',
    },
    behavioral_change: {
      title: 'Nová práce s myšlenkami a chováním.',
      description: 'Použijeme KBT-inspirované koučovací principy: prozkoumáme myšlenky, spouštěče a chování a navrhneme měřitelný experiment.',
      placeholder: 'Jaké chování nebo návyk chceš pochopit a změnit?',
    },
    somatic_regulation: {
      title: 'Nové somaticky orientované sezení.',
      description: 'Jemně pracujeme s tělesným vnímáním, napětím a kapacitou bez nucení a interpretací.',
      placeholder: 'Co právě vnímáš a s čím potřebuješ pracovat?',
    },
    brand_growth: {
      title: 'Kam dnes posuneme tvoji značku?',
      description: 'Brand & Marketing mentorka nejdřív určí fázi podnikání a největší úzké hrdlo, potom propojí strategii, nabídku, brand, obsah, sociální sítě, reklamu a měření.',
      placeholder: 'Co chceš vyřešit v marketingu, značce nebo růstu podnikání?',
    },
  };
  const selected = modes[state.consultationMode] || modes.auto;
  elements.consultationMode.value = state.consultationMode;
  elements.sessionModeDescription.textContent = selected.description;
  elements.chatInput.placeholder = selected.placeholder;
  elements.welcomeTitle.textContent = selected.title;
  document.querySelectorAll('[data-consultation-mode]').forEach(button => {
    const active = button.dataset.consultationMode === state.consultationMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function celebrateMilestone() {
  const layer = document.createElement('div');
  layer.className = 'celebration';
  layer.innerHTML = '<strong>Tohle je skutečný posun.</strong><span>Dovol mi ti pogratulovat — dokončila jsi krok, na kterém jsme se domluvily.</span>';
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 3600);
}

function persistMessages() {
  const messages = state.messages.slice(-200);
  if (isTrainingRole()) {
    if (state.trainingSession) {
      state.trainingSession.messages = messages;
      persistTrainingSession();
    }
    return;
  }
  state.conversations[state.consultationMode] = messages;
  sessionStorage.setItem('elitea.conversations', JSON.stringify(state.conversations));
  sessionStorage.setItem('elitea.messages', JSON.stringify(messages));
}

function persistTrainingSession() {
  if (isTrainingRole() && state.trainingSession) {
    state.trainingSession.messages = (state.trainingSession.messages || []).slice(-200);
    state.trainingSessions[state.assistantRole] = state.trainingSession;
  }
  sessionStorage.setItem('elitea.trainingSessions', JSON.stringify(state.trainingSessions));
  sessionStorage.removeItem('elitea.trainingSession');
}

function saveTrainingPortfolioEntry(session, debrief, achievement = null) {
  const entry = {
    id: session.id,
    courseId: session.courseId,
    courseSlug: session.courseSlug,
    courseTitle: session.courseTitle,
    itemId: session.itemId,
    itemTitle: session.itemTitle,
    scenarioId: session.scenario?.id || null,
    scenarioTitle: session.scenario?.title || null,
    difficulty: session.difficulty,
    startedAt: session.startedAt,
    completedAt: session.completedAt || new Date().toISOString(),
    transcript: (session.messages || []).slice(-80),
    debrief: String(debrief || '').slice(0, 24000),
    achievement: achievement && typeof achievement === 'object' ? achievement : null,
  };
  const existingIndex = state.trainingPortfolio.findIndex(item => item.id === entry.id);
  if (existingIndex >= 0) state.trainingPortfolio[existingIndex] = entry;
  else state.trainingPortfolio.unshift(entry);
  state.trainingPortfolio = state.trainingPortfolio.slice(0, 1200);
  localStorage.setItem('elitea.trainingPortfolio', JSON.stringify(state.trainingPortfolio));
  syncCloudState();
}

function removeTrainingPortfolioEntry(sessionId) {
  if (!sessionId) return;
  state.trainingPortfolio = state.trainingPortfolio.filter(entry => entry.id !== sessionId);
  localStorage.setItem('elitea.trainingPortfolio', JSON.stringify(state.trainingPortfolio));
  syncCloudState();
}

function cloneSerializable(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function loadTrainingSessionStore() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem('elitea.trainingSessions') || 'null');
    const sessions = parsed && typeof parsed === 'object' ? parsed : {};
    const legacy = JSON.parse(sessionStorage.getItem('elitea.trainingSession') || 'null');
    const previousSessions = [sessions.study, sessions.practice, legacy]
      .filter(session => session && typeof session === 'object')
      .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
    for (const session of previousSessions) {
      const role = trainingRoleForCourse(session);
      sessions[role] ||= session;
    }
    delete sessions.study;
    delete sessions.practice;
    for (const role of TRAINING_ROLES) {
      const session = sessions[role];
      if (!session || session.version !== 2 || !session.courseSlug || !session.itemId) delete sessions[role];
    }
    return sessions;
  } catch {
    sessionStorage.removeItem('elitea.trainingSession');
    sessionStorage.removeItem('elitea.trainingSessions');
    return {};
  }
}

function loadTrainingPortfolio() {
  try {
    const parsed = JSON.parse(localStorage.getItem('elitea.trainingPortfolio') || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && item.id && item.courseId && item.itemId).slice(0, 1200) : [];
  } catch {
    return [];
  }
}

function persistLastMethods() {
  sessionStorage.setItem('elitea.lastMethods', JSON.stringify(state.lastMethods));
  if (state.lastMethod) sessionStorage.setItem('elitea.lastMethod', JSON.stringify(state.lastMethod));
  else sessionStorage.removeItem('elitea.lastMethod');
}

function loadLastMethodStore() {
  try {
    const input = JSON.parse(sessionStorage.getItem('elitea.lastMethods') || '{}');
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(
      Object.entries(input).filter(([mode, method]) => CONSULTATION_MODES.includes(mode) && method && typeof method === 'object')
    );
  } catch {
    return {};
  }
}

function loadLegacyLastMethod() {
  try {
    const method = JSON.parse(sessionStorage.getItem('elitea.lastMethod') || 'null');
    return method && typeof method === 'object' ? method : null;
  } catch {
    return null;
  }
}

function persistTechniqueSessions() {
  sessionStorage.setItem('elitea.techniqueSessions', JSON.stringify(state.techniqueSessions));
}

function loadTechniqueSessionStore() {
  try {
    const input = JSON.parse(sessionStorage.getItem('elitea.techniqueSessions') || '{}');
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(
      Object.entries(input).filter(([mode, session]) => (
        CONSULTATION_MODES.includes(mode)
        && session
        && typeof session === 'object'
        && typeof session.techniqueId === 'string'
      ))
    );
  } catch {
    return {};
  }
}

function loadConversationStore() {
  try {
    const input = JSON.parse(sessionStorage.getItem('elitea.conversations') || '{}');
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    return Object.fromEntries(
      Object.entries(input)
        .filter(([mode, messages]) => CONSULTATION_MODES.includes(mode) && Array.isArray(messages))
        .map(([mode, messages]) => [mode, messages.slice(-200)])
    );
  } catch {
    return {};
  }
}

function loadLegacyMessages() {
  try {
    const messages = JSON.parse(sessionStorage.getItem('elitea.messages') || '[]');
    return Array.isArray(messages) ? messages.slice(-200) : [];
  } catch {
    return [];
  }
}

function normalizeConsultationMode(mode) {
  return CONSULTATION_MODES.includes(mode) ? mode : 'auto';
}

function normalizeCoachConsultationMode(mode) {
  const normalized = normalizeConsultationMode(mode);
  return normalized === 'brand_growth' ? 'auto' : normalized;
}

function consultationModeLabel(mode) {
  return {
    auto: 'Elitea vybírá přístup',
    coaching_session: 'Klasický koučink',
    business_mentoring: 'Byznys mentoring',
    nlp_reframing: 'NLP a práce s jazykem',
    behavioral_change: 'Myšlenky a chování',
    somatic_regulation: 'Somaticky orientované sezení',
    brand_growth: 'Brand & Marketing',
  }[mode] || 'Koučovací sezení';
}

function summarizeConversation(mode, messages) {
  const lastUser = [...messages].reverse().find(message => message.role === 'user')?.content || '';
  const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant')?.content || '';
  const question = [...lastAssistant.matchAll(/([^.!?\n]{10,220}\?)/g)].at(-1)?.[1]?.trim();
  const topic = lastUser
    ? `Naposledy jsi v oblasti ${consultationModeLabel(mode)} řešila: „${truncateSummary(lastUser, 150)}“`
    : `V oblasti ${consultationModeLabel(mode)} máš rozepsané sezení.`;
  const last = lastAssistant
    ? `Elitea naposledy reagovala: „${truncateSummary(lastAssistant, 180)}“`
    : 'Téma je uložené a připravené k pokračování.';
  const next = question
    ? `Můžeš navázat odpovědí na otázku: „${truncateSummary(question, 180)}“`
    : 'Můžeš pokračovat od posledního uvědomění nebo domluveného kroku.';
  return { area: consultationModeLabel(mode), topic, last, next };
}

function truncateSummary(value, maxLength) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trim()}…`;
}

function loadLocalMemory() {
  try {
    return normalizeMemory(JSON.parse(localStorage.getItem('elitea.memory') || '{}'));
  } catch {
    return normalizeMemory();
  }
}

function persistMemory() {
  state.memory.updated_at = new Date().toISOString();
  localStorage.setItem('elitea.memory', JSON.stringify(state.memory));
  syncCloudState();
}

function syncCloudState() {
  state.cloud?.saveState().catch(() => {});
}

function normalizeMemory(input = {}) {
  const stages = ['napad', 'start', 'stabilita', 'rust', 'nezjisteno'];
  const addressForms = ['tykani', 'vykani', 'nezvoleno'];
  const legacySessionCount = Number.isInteger(input.progress?.session_count) && input.progress.session_count > 0
    ? input.progress.session_count
    : 0;
  const hasActiveDayCount = Number.isInteger(input.progress?.active_day_count) && input.progress.active_day_count >= 0;
  const activeDayCount = hasActiveDayCount
    ? Math.min(input.progress.active_day_count, 100000)
    : legacySessionCount > 0 ? 1 : 0;
  const storedActiveDay = /^\d{4}-\d{2}-\d{2}$/.test(input.progress?.last_active_day || '')
    ? input.progress.last_active_day
    : !hasActiveDayCount && legacySessionCount > 0 ? localDayKey() : null;
  return {
    schema_version: '3.2',
    identity_preferences: {
      preferred_name: cleanText(input.identity_preferences?.preferred_name, 100),
      address_form: addressForms.includes(input.identity_preferences?.address_form)
        ? input.identity_preferences.address_form
        : 'nezvoleno',
    },
    business_context: {
      stage: stages.includes(input.business_context?.stage) ? input.business_context.stage : 'nezjisteno',
      industry: cleanText(input.business_context?.industry, 200),
      primary_offer: cleanText(input.business_context?.primary_offer, 1500),
      target_customer: cleanText(input.business_context?.target_customer, 1500),
    },
    current_goal: cleanText(input.current_goal, 1000),
    active_task: input.active_task || null,
    coaching_profile: {
      onboarding_complete: input.coaching_profile?.onboarding_complete === true,
      desired_outcome: cleanText(input.coaching_profile?.desired_outcome, 1000),
      main_obstacle: cleanText(input.coaching_profile?.main_obstacle, 1000),
      support_style: ['koucovani', 'mentoring', 'kombinace'].includes(input.coaching_profile?.support_style)
        ? input.coaching_profile.support_style
        : 'kombinace',
      weekly_capacity: cleanText(input.coaching_profile?.weekly_capacity, 200),
      personal_boundaries: cleanText(input.coaching_profile?.personal_boundaries, 1000),
      support_accommodations: cleanText(input.coaching_profile?.support_accommodations, 1000),
    },
    progress: {
      completed_milestones: Array.isArray(input.progress?.completed_milestones)
        ? input.progress.completed_milestones.slice(-50)
        : [],
      active_day_count: activeDayCount,
      last_active_day: storedActiveDay,
    },
    continuity: {
      last_focus: cleanText(input.continuity?.last_focus, 280),
      recent_focuses: Array.isArray(input.continuity?.recent_focuses)
        ? input.continuity.recent_focuses.map(item => cleanText(item, 280)).filter(Boolean).slice(-8)
        : [],
      last_mode: ['diagnostika', 'mentoring', 'rychle_reseni', 'koucovaci_podpora', 'podpora_fungovani'].includes(input.continuity?.last_mode)
        ? input.continuity.last_mode
        : '',
      last_seen_at: typeof input.continuity?.last_seen_at === 'string' ? input.continuity.last_seen_at : null,
    },
    role_memories: {
      coach: { continuity: normalizeRoleContinuity(input.role_memories?.coach?.continuity || input.continuity) },
      brand: { continuity: normalizeRoleContinuity(input.role_memories?.brand?.continuity) },
    },
    updated_at: input.updated_at || null,
  };
}

function normalizeRoleContinuity(value = {}) {
  return {
    last_focus: cleanText(value?.last_focus, 280),
    recent_focuses: Array.isArray(value?.recent_focuses)
      ? value.recent_focuses.map(item => cleanText(item, 280)).filter(Boolean).slice(-8)
      : [],
    last_mode: ['diagnostika', 'mentoring', 'rychle_reseni', 'koucovaci_podpora', 'podpora_fungovani', 'brand_growth_agent'].includes(value?.last_mode)
      ? value.last_mode
      : '',
    last_seen_at: typeof value?.last_seen_at === 'string' ? value.last_seen_at : null,
  };
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? redactDirectIdentifiers(value).trim().slice(0, maxLength) : '';
}

function inferAddressForm(text, current) {
  if (current && current !== 'nezvoleno') return null;
  const normalized = String(text || '').toLocaleLowerCase('cs').trim();
  if (/\b(tykat|tykání|tykani|můžeme si tykat|muzeme si tykat)\b/.test(normalized)) return 'tykani';
  if (/\b(vykat|vykání|vykani|budeme si vykat)\b/.test(normalized)) return 'vykani';
  return null;
}

function redactDirectIdentifiers(value) {
  return String(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[e-mail odstraněn]')
    .replace(/\b(?:\+?420[ .-]?)?(?:\d[ .-]?){9}\b/g, '[telefon odstraněn]')
    .replace(/\b\d{6}\/?\d{3,4}\b/g, '[rodné číslo odstraněno]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[platební údaj odstraněn]')
    .replace(/\b(?:sk|vercel|ghp|github_pat)[-_][A-Za-z0-9_-]{16,}\b/g, '[tajný klíč odstraněn]')
    .replace(/((?:heslo|password|api[_ -]?key|token)\s*[:=]\s*)\S+/gi, '$1[odstraněno]');
}

function autoResize() {
  elements.chatInput.style.height = 'auto';
  elements.chatInput.style.height = `${Math.min(elements.chatInput.scrollHeight, 130)}px`;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Něco se nepovedlo.');
  return payload;
}

function humanMode(mode) {
  return {
    koucovaci_hodina: 'Klasický koučink',
    mentoringova_konzultace: 'Byznys mentoring',
    nlp_konzultace: 'NLP a práce s jazykem',
    behavioralni_konzultace: 'Myšlenky a chování',
    somaticka_konzultace: 'Somaticky orientované sezení',
    brand_growth_agent: 'Brand & Marketing',
    diagnostika: 'Diagnostický režim',
    mentoring: 'Přímý mentoring',
    koucovaci_podpora: 'Koučovací podpora',
    rychle_reseni: 'Rychlé řešení',
    podporna_stabilizace: 'Podpůrné zklidnění',
    podpora_fungovani: 'Podpora fungování',
    vedena_meditace: 'Vedená meditace',
  }[mode] || 'Elitea';
}

function formatText(value) {
  return escapeHtml(value)
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong class="message-heading">$1</strong>')
    .replace(/^-\s+(.+)$/gm, '<span class="message-bullet">• $1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function vocativeHint(name) {
  const vocatives = {
    aneta: 'Aneto', jana: 'Jano', hana: 'Hano', petra: 'Petro', lucie: 'Lucie',
    katerina: 'Kateřino', kateřina: 'Kateřino', veronika: 'Veroniko', eva: 'Evo',
    monika: 'Moniko', nikola: 'Nikolo', zuzana: 'Zuzano', sona: 'Soňo', soňa: 'Soňo',
  };
  return vocatives[String(name).trim().toLocaleLowerCase('cs')] || name;
}
