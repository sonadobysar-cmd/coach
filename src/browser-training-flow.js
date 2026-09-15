const TRAINING_DIFFICULTIES = new Set(['guided', 'standard', 'advanced', 'expert']);

export function isTrainingSimulationRequest(value) {
  const text = normalizeTrainingIntent(value);
  if (!text) return false;
  if (/^(?:vysvetli|objasni|co znamena|jak funguje|proc se)\b/u.test(text)) return false;
  if (/\b(?:simul[a-z]*|role ?play|hrani rol[a-z]*|hranie rol[a-z]*|modelov[a-z]* situac[a-z]*|ja vs|ja proti tobe|ty budes)\b/u.test(text)) return true;
  const practice = /\b(?:vyzkouset|vyskusat|zkusit|skusit|nacvicit|nacvik|procvicit|precvicit|trenovat)\b/u.test(text);
  const counterpart = /\b(?:s klient[a-z]*|so? student[a-z]*|s posluchac[a-z]*|s publik[a-z]*|s koleg[a-z]*|rozhovor[a-z]*)\b/u.test(text);
  return practice && counterpart;
}

export function inferTrainingCounterpartHint(value) {
  const text = normalizeTrainingIntent(value);
  if (/\b(?:s klient[a-z]*|ty budes klient[a-z]*|jako klient[a-z]*)\b/u.test(text)) return 'client';
  if (/\b(?:ty budes student[a-z]*|ja vs student[a-z]*|so? student[a-z]*)\b/u.test(text)) return 'student';
  if (/\b(?:ty budes publikum|s publik[a-z]*|pred publik[a-z]*)\b/u.test(text)) return 'audience';
  if (/\b(?:ty budes koleg[a-z]*|s koleg[a-z]*)\b/u.test(text)) return 'colleague';
  return null;
}

export function isTrainingDebriefCommand(value) {
  const text = normalizeTrainingIntent(value);
  if (!text || text.length > 80) return false;
  return /^(?:stop|konec|koniec|konec simulace|koniec simulacie|konec nacviku|koniec nacviku|ukonci|ukoncit|skonci|ukonci simulaci|ukonci simulaciu|ukonci nacvik|ukoncit simulaci|ukoncit nacvik|vyhodnot|vyhodnot to|vyhodnotit|vyhodnot ma|vyhodnot me|vyhodnot nacvik|vyhodnot simulaci|vyhodnot simulaciu)(?: prosim)?$/u.test(text);
}

export function canonicalTrainingDifficulty(scenario, fallback = 'standard') {
  const scenarioDifficulty = String(scenario?.difficulty || '');
  if (TRAINING_DIFFICULTIES.has(scenarioDifficulty)) return scenarioDifficulty;
  return TRAINING_DIFFICULTIES.has(fallback) ? fallback : 'standard';
}

export function trainingRetryScenarioId({
  scenarioId,
  preserveScenario = true,
  finalExam = false,
} = {}) {
  if (!scenarioId) return '';
  return preserveScenario || finalExam ? String(scenarioId) : '';
}

export function resolveTrainingEvidenceUpdate({
  result,
  completedAt = null,
  persistenceFailed = false,
} = {}) {
  if (result?.phase !== 'debrief') {
    return { initialDebrief: false, completedAt, persistenceFailed, shouldSave: false };
  }

  const signedStep = String(result?.trainingAttempt?.step || '');
  const signedAttempt = Boolean(result?.trainingAttempt);
  const initialDebrief = signedAttempt && signedStep === 'debrief_start';
  if (!initialDebrief) {
    return { initialDebrief: false, completedAt, persistenceFailed, shouldSave: false };
  }

  const nextPersistenceFailed = result?.evidencePersistence?.required === true
    && result?.evidencePersistence?.verified !== true;
  const evidenceEligible = result.trainingAttempt.evidenceEligible === true;
  const shouldSave = result?.qualityGate?.pass === true
    && !nextPersistenceFailed
    && evidenceEligible;

  return {
    initialDebrief: true,
    completedAt: shouldSave ? new Date().toISOString() : null,
    persistenceFailed: nextPersistenceFailed,
    shouldSave,
  };
}

export function isTrainingAttemptErrorCode(value) {
  return /^TRAINING_(?:ATTEMPT|FINAL_EXAM|SCENARIO)_/u.test(String(value || ''));
}

function normalizeTrainingIntent(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
