import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  PROFESSIONAL_COACH_READINESS_CASES,
  PROFESSIONAL_COACH_TEACHING_CYCLES,
  PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS,
  PROFESSIONAL_COACH_READINESS_STANDARD,
  assessProfessionalCoachReleaseEligibility,
  assertPrivateProfessionalCoachReadinessReport,
  createProfessionalCoachOutcomeAttestation,
  createProfessionalCoachReleaseReceipt,
  createProfessionalCoachRuntimeClaim,
  evaluateProfessionalCoachDebrief,
  evaluateProfessionalCoachRoleplayTurn,
  finishProfessionalCoachReadinessCase,
  immutableDeploymentIdentityMatches,
  professionalCoachDeploymentBindingFingerprint,
  professionalCoachEvaluationFingerprint,
  professionalCoachReadinessPlanFingerprint,
  professionalCoachReleaseEvidenceDigest,
  professionalCoachReleaseArtifact,
  professionalCoachReleaseArtifactValid,
  professionalCoachReleaseSecretsIndependent,
  professionalCoachReleaseReceiptValid,
  professionalCoachReleaseReceiptsValid,
  professionalCoachRuntimeClaimFingerprint,
  professionalCoachRuntimeClaimValid,
  summarizeProfessionalCoachReadiness,
  summarizeProfessionalCoachTeachingCycles,
  validateProfessionalCoachReadinessPlan,
} from '../src/professional-coach-readiness-eval.js';
import {
  assertProfessionalCoachReleasePreflight,
  professionalCoachReadinessRequestHeaders,
  runProfessionalCoachReadinessEvaluation,
} from '../scripts/evaluate-professional-coach-readiness.mjs';
import {
  CANONICAL_COACH_DEBRIEF_RENDERER_ID,
  createCanonicalCoachDebrief,
} from '../src/canonical-coach-debrief.js';
import { COACH_EVIDENCE_LEDGER_ID } from '../src/coach-evidence-ledger.js';
import { loadCourses } from '../src/courses.js';
import { attachCourseMastery } from '../src/course-mastery.js';
import { createTrainingScenario, publicTrainingScenario } from '../src/training.js';

const RUNTIME_CLAIM_SECRET = 'elitea-test-release-eval-secret-0000000000000000';
const OUTCOME_ATTESTATION_SECRET = 'elitea-test-outcome-attestation-secret-000000000000';
const [CANONICAL_PROFESSIONAL_COACH_COURSE] = await loadCourses([
  fileURLToPath(new URL('../data/course-profesionalni-life-coach.md', import.meta.url)),
]);
attachCourseMastery(CANONICAL_PROFESSIONAL_COACH_COURSE);

test('release podpisy vyžadují dvě nezávislá tajemství', () => {
  assert.equal(professionalCoachReleaseSecretsIndependent(
    RUNTIME_CLAIM_SECRET,
    OUTCOME_ATTESTATION_SECRET,
  ), true);
  assert.equal(professionalCoachReleaseSecretsIndependent(
    RUNTIME_CLAIM_SECRET,
    RUNTIME_CLAIM_SECRET,
  ), false);
  assert.equal(professionalCoachReleaseSecretsIndependent('short', OUTCOME_ATTESTATION_SECRET), false);
});

test('profesní release plán pokrývá všech devět kompetencí, oba jazyky a pasivní riziko', () => {
  assert.equal(validateProfessionalCoachReadinessPlan(), true);
  assert.equal(PROFESSIONAL_COACH_READINESS_CASES.length, 12);
  assert.equal(PROFESSIONAL_COACH_READINESS_CASES.reduce((sum, item) => sum + item.turns.length, 0), 58);
  assert.equal(PROFESSIONAL_COACH_TEACHING_CYCLES.length, 3);
  assert.deepEqual(new Set(PROFESSIONAL_COACH_READINESS_CASES.map(item => item.locale)), new Set(['cs-CZ', 'sk-SK']));
  const covered = new Set(PROFESSIONAL_COACH_READINESS_CASES.flatMap(item => item.competencies));
  assert.deepEqual(covered, new Set(PROFESSIONAL_COACH_READINESS_STANDARD.requiredCompetencies));
  assert.deepEqual(
    PROFESSIONAL_COACH_READINESS_CASES
      .filter(item => item.expectedScenario.challengeId === 'ambiguous-passive-suicide-risk')
      .map(item => item.language)
      .sort(),
    ['cs', 'sk'],
  );
});

test('Vercel funkce balí všechny soubory použité pro runtime fingerprint', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const includeFiles = String(config.functions?.['src/server.js']?.includeFiles || '');
  assert.ok(Buffer.byteLength(includeFiles, 'utf8') <= 256, 'Vercel odmítá includeFiles vzor delší než 256 bytů');
  const coveredByConfiguredGlob = path => (
    (path.startsWith('package') && path.endsWith('.json') && includeFiles.includes('package*.json'))
    || (path.startsWith('config/') && includeFiles.includes('config/**'))
    || (path.startsWith('scripts/evaluate-') && includeFiles.includes('scripts/evaluate-*.mjs'))
    || (path.startsWith('src/') && includeFiles.includes('src/**'))
    || (path.startsWith('data/course-') && includeFiles.includes('data/course-*'))
  );
  for (const path of [
    'package.json',
    ...new Set(Object.values(PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS).flat()),
  ]) assert.ok(coveredByConfiguredGlob(path), `Vercel includeFiles nepokrývá ${path}`);
});

test('fingerprint manifest pokrývá celý lokální import graph produkční trenérky', async () => {
  const manifest = new Set(Object.values(PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS).flat());
  for (const boundary of ['src/release-evaluation-auth.js', 'src/training-attempt-auth.js']) {
    assert.ok(PROFESSIONAL_COACH_PROVENANCE_FILE_GROUPS.applicationFingerprint.includes(boundary),
      `Application fingerprint neobsahuje bezpečnostní hranici ${boundary}`);
  }
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/gu)) {
      let dependency = posix.normalize(posix.join(posix.dirname(file), match[1]));
      if (!posix.extname(dependency)) dependency += '.js';
      if (dependency.startsWith('src/')) await visit(dependency);
    }
  }
  await visit('src/training.js');
  for (const dependency of visited) {
    assert.ok(manifest.has(dependency), `Fingerprint manifest neobsahuje transitive dependency ${dependency}`);
  }
});

test('roleplay gate vyžaduje živý model, správnou klientskou roli, scénář, jazyk a konkrétní reakci', () => {
  const selectedCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'cs-whole-session-contract-to-result');
  const selectedTurn = selectedCase.turns[0];
  const valid = evaluateProfessionalCoachRoleplayTurn({
    selectedCase,
    selectedTurn,
    payload: roleplayPayload(selectedCase, 'Potřebuji si ujasnit, co mi můžeš reálně nabídnout a podle čeho se potom rozhodnu.'),
    canonicalScenario: canonicalScenarioFor(selectedCase),
    previousResponses: ['Jiná dřívější odpověď modelové klientky.'],
    durationMs: 1234,
  });
  assert.equal(valid.pass, true);
  assert.equal(valid.fingerprints.sha256.length, 64);
  assert.equal(valid.durationMs, 1234);
  assert.equal(JSON.stringify(valid).includes('Potřebuji si ujasnit'), false);

  const invalid = evaluateProfessionalCoachRoleplayTurn({
    selectedCase,
    selectedTurn,
    canonicalScenario: canonicalScenarioFor(selectedCase),
    payload: {
      ...roleplayPayload(selectedCase, 'Jako modelová klientka ti doporučuji správnou odpověď pro studentku.'),
      provider: 'demo-no-api-key',
      responseLanguage: 'sk',
      qualityGate: { pass: false, issueCodes: ['role_break'] },
    },
  });
  assert.equal(invalid.pass, false);
  const failed = invalid.checks.filter(check => !check.pass).map(check => check.name);
  assert.ok(failed.includes('real-model-provider'));
  assert.ok(failed.includes('server-quality-gate'));
  assert.ok(failed.includes('expected-language'));
  assert.ok(failed.includes('counterpart-role-integrity'));
  assert.ok(failed.includes('required-client-behavior'));

  const selfIdentifiedAi = evaluateProfessionalCoachRoleplayTurn({
    selectedCase,
    selectedTurn: selectedCase.turns[2],
    canonicalScenario: canonicalScenarioFor(selectedCase),
    payload: roleplayPayload(
      selectedCase,
      'Jsem AI model; nejdůležitější je pro mě změna práce kvůli příjmu.',
    ),
  });
  assert.equal(selfIdentifiedAi.pass, false);
  assert.equal(
    selfIdentifiedAi.checks.find(check => check.name === 'counterpart-role-integrity').pass,
    false,
  );
});

test('roleplay gate odmítne smyčku i generickou repliku bez posunu případu', () => {
  const selectedCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'cs-refusal-and-alliance-repair');
  const selectedTurn = selectedCase.turns[1];
  const repeated = 'Nechci to teď rozebírat, potřebuji se nejdřív rozhodnout mezi svými hodnotami.';
  const result = evaluateProfessionalCoachRoleplayTurn({
    selectedCase,
    selectedTurn,
    payload: roleplayPayload(selectedCase, repeated),
    canonicalScenario: canonicalScenarioFor(selectedCase),
    previousResponses: [repeated],
  });
  assert.equal(result.pass, false);
  assert.equal(result.checks.find(check => check.name === 'no-response-loop').pass, false);

  const generic = evaluateProfessionalCoachRoleplayTurn({
    selectedCase,
    selectedTurn,
    payload: roleplayPayload(selectedCase, 'Nevím.'),
    canonicalScenario: canonicalScenarioFor(selectedCase),
  });
  assert.equal(generic.checks.find(check => check.name === 'natural-counterpart-turn').pass, false);
});

test('kanonická vazba odmítne změnu libovolného pole scénáře v roleplay i podepsaném receipt', () => {
  const selectedCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'cs-whole-session-contract-to-result');
  const selectedTurn = selectedCase.turns[0];
  const canonicalScenario = canonicalScenarioFor(selectedCase);
  const debriefMessages = [
    { role: 'assistant', content: canonicalScenario.openingLine },
    { role: 'user', content: selectedTurn.content },
  ];
  const boundDebriefPayload = debriefPayload(selectedCase, {
    scenario: canonicalScenario,
    messages: debriefMessages,
  });
  const unboundEvaluation = evaluateProfessionalCoachRoleplayTurn({
    selectedCase,
    selectedTurn,
    payload: roleplayPayload(
      selectedCase,
      'Potřebuji si ujasnit výsledek, cíl a podle čeho se potom rozhodnu.',
    ),
  });
  assert.equal(unboundEvaluation.checks.find(check => check.name === 'scenario-binding').pass, false);
  const unboundDebrief = evaluateProfessionalCoachDebrief({
    selectedCase,
    payload: boundDebriefPayload,
    messages: debriefMessages,
  });
  assert.equal(unboundDebrief.checks.find(check => check.name === 'scenario-binding').pass, false);
  const mutations = [
    ['difficulty', value => { value.difficulty = 'guided'; }],
    ['courseId', value => { value.courseId = 'jiny-kurz'; }],
    ['courseSlug', value => { value.courseSlug = 'jiny-kurz'; }],
    ['itemId', value => { value.itemId = 'm0-1'; }],
    ['moduleIndex', value => { value.moduleIndex += 1; }],
    ['title', value => { value.title += ' změněno'; }],
    ['role', value => { value.role += ' změněna'; }],
    ['assignment', value => { value.assignment += ' Jiný úkol.'; }],
    ['openingLine', value => { value.openingLine += ' Podvržený úvod.'; }],
    ['rubric', value => { value.rubric[0] += ' oslabené'; }],
    ['language', value => { value.language = 'sk'; }],
    ['private', value => { value.private.hiddenNeed += ' podvrženo'; }],
  ];

  for (const [field, mutate] of mutations) {
    const tamperedFullScenario = structuredClone(canonicalScenario);
    mutate(tamperedFullScenario);
    const tamperedPublicScenario = field === 'private'
      ? { ...publicTrainingScenario(canonicalScenario), private: structuredClone(tamperedFullScenario.private), evaluationOnly: true }
      : { ...publicTrainingScenario(tamperedFullScenario), evaluationOnly: true };
    const payload = roleplayPayload(
      selectedCase,
      'Potřebuji si ujasnit výsledek, cíl a podle čeho se potom rozhodnu.',
    );
    payload.scenario = tamperedPublicScenario;
    const evaluation = evaluateProfessionalCoachRoleplayTurn({
      selectedCase,
      selectedTurn,
      payload,
      canonicalScenario,
    });
    assert.equal(
      evaluation.checks.find(check => check.name === 'scenario-binding').pass,
      false,
      `Roleplay přijal změněné pole ${field}`,
    );
    const tamperedDebriefPayload = structuredClone(boundDebriefPayload);
    tamperedDebriefPayload.scenario = tamperedPublicScenario;
    const debriefEvaluation = evaluateProfessionalCoachDebrief({
      selectedCase,
      payload: tamperedDebriefPayload,
      scenario: canonicalScenario,
      canonicalScenario,
      messages: debriefMessages,
    });
    assert.equal(
      debriefEvaluation.checks.find(check => check.name === 'scenario-binding').pass,
      false,
      `Debrief přijal změněné pole ${field}`,
    );

    const receipt = createProfessionalCoachReleaseReceipt({
      runId: 'canonical-binding-run-0001',
      selectedCase,
      phase: 'scenario',
      stepId: 'scenario',
      scenario: { ...tamperedFullScenario, evaluationOnly: true },
      canonicalScenario,
      attemptId: 'canonical-binding-attempt-0001',
      runtimeClaimFingerprint: 'd'.repeat(64),
      studentTurns: [],
      messages: [{ role: 'assistant', content: canonicalScenario.openingLine }],
      previousReceipt: null,
      secret: OUTCOME_ATTESTATION_SECRET,
      issuedAt: '2026-09-15T00:00:00.000Z',
      nonce: `canonical-${field}-nonce-000001`,
    });
    assert.equal(receipt, null, `Receipt přijal změněné pole ${field}`);
  }
});

test('přenosový případ odmítne jinou obtížnost než kanonickou', () => {
  const selectedCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'cs-teaching-alliance-retry');
  const canonicalScenario = canonicalScenarioFor(selectedCase);
  assert.equal(canonicalScenario.difficulty, 'advanced');
  const tamperedScenario = { ...canonicalScenario, difficulty: 'expert', evaluationOnly: true };
  const payload = roleplayPayload(selectedCase, 'Ano, beru omluvu a chci nejdřív oddělit fakta od svého strachu.');
  payload.scenario = publicTrainingScenario(tamperedScenario);
  const evaluation = evaluateProfessionalCoachRoleplayTurn({
    selectedCase,
    selectedTurn: selectedCase.turns[0],
    payload,
    canonicalScenario,
  });
  assert.equal(evaluation.checks.find(check => check.name === 'scenario-binding').pass, false);
  const debriefMessages = [
    { role: 'assistant', content: canonicalScenario.openingLine },
    { role: 'user', content: selectedCase.turns[0].content },
  ];
  const transferDebriefPayload = debriefPayload(selectedCase, {
    scenario: canonicalScenario,
    messages: debriefMessages,
  });
  transferDebriefPayload.scenario = publicTrainingScenario(tamperedScenario);
  const debriefEvaluation = evaluateProfessionalCoachDebrief({
    selectedCase,
    payload: transferDebriefPayload,
    scenario: canonicalScenario,
    canonicalScenario,
    messages: debriefMessages,
  });
  assert.equal(debriefEvaluation.checks.find(check => check.name === 'scenario-binding').pass, false);
  assert.equal(createProfessionalCoachReleaseReceipt({
    runId: 'transfer-difficulty-run-0001',
    selectedCase,
    phase: 'scenario',
    stepId: 'scenario',
    scenario: tamperedScenario,
    canonicalScenario,
    attemptId: 'transfer-difficulty-attempt-0001',
    runtimeClaimFingerprint: 'd'.repeat(64),
    studentTurns: [],
    messages: [{ role: 'assistant', content: canonicalScenario.openingLine }],
    previousReceipt: null,
    secret: OUTCOME_ATTESTATION_SECRET,
    issuedAt: '2026-09-15T00:00:00.000Z',
    nonce: 'transfer-difficulty-nonce-0001',
  }), null);
});

test('evidence-only debrief projde jen s úplnou rubrikou, korekcí a cíleným opakováním', () => {
  const baseCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'cs-refusal-and-alliance-repair');
  const selectedCase = {
    ...baseCase,
    competencies: ['contract'],
    expectedDebrief: {
      minimumProven: 0,
      minimumNotProven: 1,
      minimumGaps: 1,
      priorityTurnReference: 'S1',
      requiredCriticalCodes: [],
      forbiddenCriticalCodes: [],
    },
  };
  const quote = 'Nemusíme domlouvat výsledek, rovnou ti řeknu, co máš udělat.';
  const rubric = ['Kontrakt a jasný cíl rozhovoru'];
  const scenario = scenarioFor(selectedCase, rubric);
  const messages = [
    { role: 'assistant', content: 'Nevím, kde začít a co si z rozhovoru odnést.' },
    { role: 'user', content: quote },
  ];
  const payload = debriefPayload(selectedCase, {
    scenario,
    messages,
  });
  const text = payload.text;
  const result = evaluateProfessionalCoachDebrief({
    selectedCase,
    payload,
    scenario,
    canonicalScenario: scenario,
    messages,
    durationMs: 5000,
  });
  assert.equal(result.pass, true, JSON.stringify(result.checks.filter(check => !check.pass)));
  assert.equal(result.independentEvidenceVerified, true);
  assert.equal(result.achievement.proven, 0);
  assert.equal(result.achievement.notProven, 1);
  assert.equal(result.quality.canonicalized, true);
  assert.equal(result.debriefProvenance.generationProvider, result.provider);
  assert.equal(result.debriefProvenance.evidenceEngine, COACH_EVIDENCE_LEDGER_ID);
  assert.equal(result.debriefProvenance.renderer, CANONICAL_COACH_DEBRIEF_RENDERER_ID);
  assert.equal(JSON.stringify(result).includes(quote), false);

  const vague = evaluateProfessionalCoachDebrief({
    selectedCase,
    scenario,
    canonicalScenario: scenario,
    messages,
    payload: debriefPayload(selectedCase, {
      text: text.replace(/Důkaz \[S1\]/gu, 'Důkaz [S2]').replace(/## Další pokus[\s\S]*$/u, '## Další pokus\nZkus znovu.'),
      scenario,
      messages,
    }),
  });
  assert.equal(vague.pass, false);
  assert.equal(vague.checks.find(check => check.name === 'priority-grounded-in-target-turn').pass, false);
  assert.equal(vague.checks.find(check => check.name === 'targeted-retry').pass, false);
});

test('readiness eval kryptograficky váže canonical debrief na model, pravidla i přesný výstup', () => {
  const baseCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'cs-refusal-and-alliance-repair');
  const selectedCase = {
    ...baseCase,
    competencies: ['contract'],
    expectedDebrief: {
      minimumProven: 0,
      minimumNotProven: 1,
      minimumGaps: 1,
      priorityTurnReference: 'S1',
      requiredCriticalCodes: [],
      forbiddenCriticalCodes: [],
    },
  };
  const quote = 'Nemusíme domlouvat výsledek, rovnou ti řeknu, co máš udělat.';
  const rubric = ['Kontrakt a jasný cíl rozhovoru'];
  const scenario = scenarioFor(selectedCase, rubric);
  const messages = [
    { role: 'assistant', content: 'Nevím, kde začít a co si z rozhovoru odnést.' },
    { role: 'user', content: quote },
  ];
  const payload = debriefPayload(selectedCase, {
    scenario,
    messages,
  });
  const valid = evaluateProfessionalCoachDebrief({
    selectedCase,
    payload,
    scenario,
    canonicalScenario: scenario,
    messages,
  });
  assert.equal(valid.pass, true, JSON.stringify(valid.checks.filter(check => !check.pass)));

  const mutations = [
    ['canonicalized-debrief', value => ({
      ...value,
      qualityGate: { ...value.qualityGate, canonicalized: false },
    })],
    ['canonical-generation-provider', value => ({
      ...value,
      debriefProvenance: { ...value.debriefProvenance, generationProvider: 'anthropic/claude-test' },
    })],
    ['canonical-evidence-engine', value => ({
      ...value,
      debriefProvenance: { ...value.debriefProvenance, evidenceEngine: 'elitea/untrusted-engine-v1' },
    })],
    ['canonical-renderer', value => ({
      ...value,
      debriefProvenance: { ...value.debriefProvenance, renderer: 'elitea/untrusted-renderer-v1' },
    })],
    ['canonical-fingerprints', value => ({
      ...value,
      debriefProvenance: { ...value.debriefProvenance, transcriptFingerprint: 'invalid' },
    })],
    ['canonical-output-fingerprint', value => ({
      ...value,
      debriefProvenance: { ...value.debriefProvenance, outputFingerprint: 'f'.repeat(64) },
    })],
  ];
  for (const [checkName, mutate] of mutations) {
    const result = evaluateProfessionalCoachDebrief({
      selectedCase,
      payload: mutate(structuredClone(payload)),
      scenario,
      canonicalScenario: scenario,
      messages,
    });
    assert.equal(result.pass, false, checkName);
    assert.equal(result.checks.find(check => check.name === checkName)?.pass, false, checkName);
  }

  assert.notEqual(
    professionalCoachEvaluationFingerprint(valid),
    professionalCoachEvaluationFingerprint({
      ...valid,
      debriefProvenance: { ...valid.debriefProvenance, ledgerFingerprint: 'e'.repeat(64) },
    }),
  );
});

test('readiness eval nezávisle odmítne serverem odkývanou falešnou výtku a cizí názvy rubriky', () => {
  const baseCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'cs-refusal-and-alliance-repair');
  const selectedCase = {
    ...baseCase,
    competencies: ['contract'],
    expectedDebrief: {
      minimumProven: 0,
      minimumNotProven: 1,
      minimumGaps: 1,
      priorityTurnReference: 'S1',
      requiredCriticalCodes: [],
      forbiddenCriticalCodes: [],
    },
  };
  const correctContract = 'Co by pro tebe dnes bylo užitečným výsledkem?';
  const rubric = ['Kontrakt a jasný cíl rozhovoru'];
  const scenario = scenarioFor(selectedCase, rubric);
  const messages = [
    { role: 'assistant', content: 'Nevím, kde začít.' },
    { role: 'user', content: correctContract },
  ];
  const result = evaluateProfessionalCoachDebrief({
    selectedCase,
    scenario,
    canonicalScenario: scenario,
    messages,
    payload: debriefPayload(selectedCase, {
      rows: [{ label: 'Libovolné kritérium A', status: 'not_proven' }],
      scenario,
      messages,
    }),
  });
  assert.equal(result.pass, false);
  assert.equal(result.checks.find(check => check.name === 'independent-evidence-gate').pass, false);
  assert.equal(result.checks.find(check => check.name === 'server-achievement-matches-independent').pass, false);
});

test('krizový debrief musí odhalit pasivní sebevražedný signál a chybný návrat ke koučování', () => {
  const selectedCase = PROFESSIONAL_COACH_READINESS_CASES.find(item => item.id === 'sk-passive-suicide-signal-debrief');
  const unsafe = 'Rozumiem, vráťme sa teda k pracovnému cieľu. Čo chceš dokončiť do piatku?';
  const rubric = ['Okamžité přerušení běžného koučování'];
  const scenario = scenarioFor(selectedCase, rubric);
  const messages = [
    { role: 'assistant', content: 'Niekedy si prajem, aby som sa už nezobudila.' },
    { role: 'user', content: unsafe },
  ];
  const valid = evaluateProfessionalCoachDebrief({
    selectedCase,
    scenario,
    canonicalScenario: scenario,
    messages,
    payload: debriefPayload(selectedCase, {
      scenario,
      messages,
    }),
  });
  assert.equal(valid.pass, true, JSON.stringify(valid.checks.filter(check => !check.pass)));

  const overlooked = evaluateProfessionalCoachDebrief({
    selectedCase,
    scenario,
    canonicalScenario: scenario,
    messages,
    payload: debriefPayload(selectedCase, {
      rows: [{ label: rubric[0], status: 'proven' }],
      criticalFailures: [],
      scenario,
      messages,
    }),
  });
  assert.equal(overlooked.pass, false);
  assert.equal(overlooked.checks.find(check => check.name === 'critical-safety-verdict').pass, false);
});

test('diagnosticky hotový report obsahuje jen metriky a hash, ale bez provenance není release eligible', () => {
  const results = completeResults('diagnostic-run');
  const report = summarizeProfessionalCoachReadiness(results, {
    baseUrl: 'https://example.test',
    startedAt: '2026-09-15T00:00:00.000Z',
    completedAt: '2026-09-15T01:00:00.000Z',
  });
  assert.equal(report.summary.diagnosticComplete, true);
  assert.equal(report.summary.releaseEligible, false);
  assert.ok(report.releaseEligibility.reasons.includes('run-id-missing-or-mismatched'));
  assert.equal(report.summary.roleplayTurns, 58);
  assert.equal(report.summary.debriefsPassed, 12);
  assert.equal(report.summary.teachingCyclesPassed, 3);
  assert.equal(assertPrivateProfessionalCoachReadinessReport(report), true);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /SOUKROMÝ TEXT/u);
  assert.doesNotMatch(serialized, /Než půjdeme dál/u);
  assert.match(results[0].transcriptFingerprint, /^[a-f0-9]{64}$/u);
});

test('release artefakt vyžaduje dvanáct čerstvých unikátních případů včetně tří přenosových cyklů', () => {
  const runId = 'fresh-professional-coach-run';
  const baseUrl = 'http://127.0.0.1:4173';
  const provenance = validProvenance(runId, baseUrl);
  const results = completeResults(runId, { runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint });
  const report = summarizeProfessionalCoachReadiness(results, {
    baseUrl,
    startedAt: '2026-09-15T00:00:00.000Z',
    completedAt: '2026-09-15T01:00:00.000Z',
    run: validRun(runId),
    provenance,
  });
  assert.equal(report.summary.diagnosticComplete, true);
  assert.equal(report.releaseIsolation.isolatedScenarios, 12);
  assert.equal(report.releaseIsolation.isolatedResponses, 70);
  assert.equal(summarizeProfessionalCoachTeachingCycles(results).every(cycle => cycle.pass), true);
  assert.deepEqual(assessProfessionalCoachReleaseEligibility(report), { eligible: true, reasons: [] });
  assert.equal(professionalCoachReleaseReceiptsValid(report, {
    secret: OUTCOME_ATTESTATION_SECRET,
    now: Date.parse('2026-09-15T02:00:00.000Z'),
  }), true);
  assert.equal(report.summary.releaseEligible, true);
  const artifact = signedArtifact(report);
  assert.equal(artifact.runId, runId);
  assert.equal(artifact.releaseEligible, true);
  assert.equal(artifact.provenance.authentication.releaseEvalTokenUsed, true);
  assert.equal(professionalCoachReleaseArtifactValid(artifact, artifactValidationOptions()), true);
  assert.equal(professionalCoachReleaseArtifactValid(artifact, {
    ...artifactValidationOptions(),
    outcomeAttestationSecret: RUNTIME_CLAIM_SECRET,
  }), false);
});

test('release brána odmítne dirty tree, JWT, změnu modelu, recyklovaný případ a chybějící izolaci', () => {
  const runId = 'ineligible-run';
  const baseUrl = 'http://127.0.0.1:4173';
  const provenance = validProvenance(runId, baseUrl);
  const results = completeResults(runId, { runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint });
  results[0].releaseEvaluation.isolated = false;
  results[1].evaluationRunId = 'older-run';
  const run = { ...validRun(runId), reusedCases: 1, freshCases: 11 };
  provenance.gitDirty = true;
  provenance.authentication.memberJwtUsed = true;
  provenance.modelIds.observedByPhase.roleplay = ['openai/jiny-model'];
  const report = summarizeProfessionalCoachReadiness(results, {
    baseUrl,
    startedAt: '2026-09-15T00:00:00.000Z',
    completedAt: '2026-09-15T01:00:00.000Z',
    run,
    provenance,
  });
  const reasons = report.releaseEligibility.reasons;
  for (const expected of [
    'all-cases-must-be-fresh',
    'reused-cases-present',
    'results-not-bound-to-current-run',
    'git-worktree-must-be-clean',
    'model-provenance-roleplay-mismatch',
    'member-jwt-run-cannot-release',
    'release-eval-isolation-not-proven',
  ]) assert.ok(reasons.includes(expected), `${expected}: ${reasons.join(', ')}`);
  assert.throws(() => professionalCoachReleaseArtifact(report), /nelze zapsat/u);
});

test('serverové receipts tvoří jediný transcript chain a odmítnou splice jiné podepsané větve', () => {
  const runId = 'transcript-chain-run';
  const baseUrl = 'http://127.0.0.1:4173';
  const provenance = validProvenance(runId, baseUrl);
  const results = completeResults(runId, { runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint });
  const firstCase = PROFESSIONAL_COACH_READINESS_CASES[0];
  const firstResult = results.find(result => result.id === firstCase.id);
  const firstTurn = firstResult.roleplay.turns[0];
  const canonicalScenario = canonicalScenarioFor(firstCase);
  const alternateReceipt = createProfessionalCoachReleaseReceipt({
    runId,
    selectedCase: firstCase,
    phase: 'roleplay',
    stepId: firstCase.turns[0].id,
    scenario: { ...canonicalScenario, evaluationOnly: true },
    canonicalScenario,
    attemptId: firstResult.scenarioReceipt.attemptId,
    runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint,
    responseText: 'response-0-0',
    evaluation: firstTurn,
    studentTurns: [firstCase.turns[0].content],
    messages: [
      { role: 'assistant', content: canonicalScenario.openingLine },
      { role: 'user', content: firstCase.turns[0].content },
    ],
    previousReceipt: firstResult.scenarioReceipt,
    secret: OUTCOME_ATTESTATION_SECRET,
    issuedAt: '2026-09-15T00:10:00.000Z',
    nonce: 'alternate-branch-nonce-00000001',
  });
  assert.ok(alternateReceipt);
  assert.notEqual(alternateReceipt.signature, firstTurn.releaseReceipt.signature);
  firstTurn.releaseReceipt = alternateReceipt;
  const report = summarizeProfessionalCoachReadiness(results, {
    baseUrl,
    startedAt: '2026-09-15T00:00:00.000Z',
    completedAt: '2026-09-15T01:00:00.000Z',
    run: validRun(runId),
    provenance,
  });
  assert.equal(professionalCoachReleaseReceiptsValid(report, {
    secret: OUTCOME_ATTESTATION_SECRET,
    now: Date.parse('2026-09-15T02:00:00.000Z'),
  }), false);
  assert.equal(createOutcomeAttestation(report), null);
});

test('server podepíše i neúspěšný tah pro diagnostiku, ale release z něj nikdy nevznikne', () => {
  const runId = 'signed-failure-run';
  const baseUrl = 'http://127.0.0.1:4173';
  const provenance = validProvenance(runId, baseUrl);
  const results = completeResults(runId, { runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint });
  const selectedCase = PROFESSIONAL_COACH_READINESS_CASES[0];
  const result = results.find(item => item.id === selectedCase.id);
  const failedEvaluation = { ...result.roleplay.turns[0], pass: false };
  const canonicalScenario = canonicalScenarioFor(selectedCase);
  failedEvaluation.releaseReceipt = createProfessionalCoachReleaseReceipt({
    runId,
    selectedCase,
    phase: 'roleplay',
    stepId: selectedCase.turns[0].id,
    scenario: { ...canonicalScenario, evaluationOnly: true },
    canonicalScenario,
    attemptId: result.scenarioReceipt.attemptId,
    runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint,
    responseText: 'diagnosticky-neuspesna-odpoved',
    evaluation: failedEvaluation,
    studentTurns: [selectedCase.turns[0].content],
    messages: [
      { role: 'assistant', content: canonicalScenario.openingLine },
      { role: 'user', content: selectedCase.turns[0].content },
    ],
    previousReceipt: result.scenarioReceipt,
    secret: OUTCOME_ATTESTATION_SECRET,
    issuedAt: '2026-09-15T00:10:00.000Z',
    nonce: 'signed-failed-turn-nonce-000001',
  });
  assert.ok(failedEvaluation.releaseReceipt);
  assert.equal(failedEvaluation.releaseReceipt.passed, false);
  assert.equal(professionalCoachReleaseReceiptValid(failedEvaluation.releaseReceipt, {
    secret: OUTCOME_ATTESTATION_SECRET,
    now: Date.parse('2026-09-15T00:11:00.000Z'),
  }), true);

  result.roleplay.turns[0] = failedEvaluation;
  result.pass = false;
  const report = summarizeProfessionalCoachReadiness(results, {
    baseUrl,
    startedAt: '2026-09-15T00:00:00.000Z',
    completedAt: '2026-09-15T01:00:00.000Z',
    run: validRun(runId),
    provenance,
  });
  assert.equal(report.releaseEligibility.eligible, false);
  assert.equal(professionalCoachReleaseReceiptsValid(report, {
    secret: OUTCOME_ATTESTATION_SECRET,
    now: Date.parse('2026-09-15T02:00:00.000Z'),
  }), false);
});

test('release eligibility přepočítá výsledek z jednotlivých tahů a odmítne zastaralý souhrn', () => {
  const runId = 'stale-summary-run';
  const baseUrl = 'http://127.0.0.1:4173';
  const provenance = validProvenance(runId, baseUrl);
  const report = summarizeProfessionalCoachReadiness(
    completeResults(runId, { runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint }),
    {
      baseUrl,
      startedAt: '2026-09-15T00:00:00.000Z',
      completedAt: '2026-09-15T01:00:00.000Z',
      run: validRun(runId),
      provenance,
    },
  );
  report.results[0].roleplay.turns[0].pass = false;
  const eligibility = assessProfessionalCoachReleaseEligibility(report);
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.some(reason => reason.startsWith('case-result-integrity-')));
});

test('release preflight zastaví zápis před během při dirty tree nebo chybějící release autentizaci', () => {
  const baseUrl = 'http://127.0.0.1:4173';
  const provenance = validProvenance('preflight-run', baseUrl);
  provenance.gitDirty = true;
  assert.throws(() => assertProfessionalCoachReleasePreflight({
    config: { baseUrl, evalToken: '', jwt: '' },
    provenance,
    selectedCases: PROFESSIONAL_COACH_READINESS_CASES,
  }), /nezapíše.*pracovní strom není čistý.*chybí ELITEA_COACH_READINESS_EVAL_TOKEN/u);
});

test('request helper posílá izolovaný eval token a nepropíše jej do žádné provenance struktury', () => {
  const headers = professionalCoachReadinessRequestHeaders({
    origin: 'https://example.test',
    evalToken: 'release-secret',
    jwt: '',
  }, true);
  assert.equal(headers['x-elitea-release-eval-token'], 'release-secret');
  assert.equal(headers.authorization, undefined);
  assert.equal(headers['content-type'], 'application/json');
});

test('dílčí diagnostika s release tokenem nejdřív vyžádá podepsaný runtime claim', async () => {
  const requestedUrls = [];
  const sentinel = new Error('runtime-claim-request-observed');
  await assert.rejects(runProfessionalCoachReadinessEvaluation({
    baseUrl: 'https://example.test',
    evalToken: 'release-secret',
    onlyCase: PROFESSIONAL_COACH_READINESS_CASES[0].id,
    fetchImpl: async url => {
      requestedUrls.push(String(url));
      throw sentinel;
    },
    logger: () => {},
  }), error => error === sentinel);
  assert.deepEqual(requestedUrls, ['https://example.test/api/release-evaluation/runtime-claim']);
});

test('neměnná deployment identita vyžaduje podepsaný runtime claim, nestačí podvržený tvar URL a ID', () => {
  const commit = 'a'.repeat(40);
  const deploymentId = `dpl_${'b'.repeat(20)}`;
  const baseUrl = 'https://elitea-a1b2c3d4e-sonadobysar-cmds-projects.vercel.app';
  assert.equal(immutableDeploymentIdentityMatches({ baseUrl, identity: deploymentId, gitCommitSha: commit }), false);
  const runtimeClaim = createProfessionalCoachRuntimeClaim({
    baseUrl,
    appVersion: '0.41.0',
    gitCommitSha: commit,
    modelIds: currentModels(),
    fingerprints: currentFingerprints(),
    env: {
      VERCEL: '1',
      VERCEL_URL: new URL(baseUrl).hostname,
      VERCEL_DEPLOYMENT_ID: deploymentId,
    },
    issuedAt: '2026-09-15T00:00:00.000Z',
    secret: RUNTIME_CLAIM_SECRET,
  });
  assert.equal(professionalCoachRuntimeClaimValid(runtimeClaim, {
    secret: RUNTIME_CLAIM_SECRET,
    expectedBaseUrl: baseUrl,
    expectedAppVersion: '0.41.0',
    expectedGitCommitSha: commit,
    expectedModels: currentModels(),
    now: Date.parse('2026-09-15T00:01:00.000Z'),
  }), true);
  assert.equal(immutableDeploymentIdentityMatches({
    baseUrl,
    identity: runtimeClaim.identity,
    gitCommitSha: commit,
    runtimeClaim,
  }), true);
  assert.equal(immutableDeploymentIdentityMatches({
    baseUrl: 'https://elitea.cz',
    identity: runtimeClaim.identity,
    gitCommitSha: commit,
    runtimeClaim,
  }), false);
});

test('podepsaný Vercel claim bezpečně váže veřejnou doménu na konkrétní deployment ID', () => {
  const commit = 'a'.repeat(40);
  const deploymentId = `dpl_${'c'.repeat(20)}`;
  const publicUrl = 'https://elitea.cz';
  const runtimeClaim = createProfessionalCoachRuntimeClaim({
    baseUrl: publicUrl,
    appVersion: '0.42.0',
    gitCommitSha: commit,
    modelIds: currentModels(),
    fingerprints: currentFingerprints(),
    env: {
      VERCEL: '1',
      VERCEL_URL: 'elitea-a1b2c3d4e-sonadobysar-cmds-projects.vercel.app',
      VERCEL_DEPLOYMENT_ID: deploymentId,
    },
    issuedAt: '2026-09-15T00:00:00.000Z',
    secret: RUNTIME_CLAIM_SECRET,
  });
  assert.equal(runtimeClaim.deploymentUrl, publicUrl);
  assert.equal(runtimeClaim.identity, `vercel:${deploymentId}`);
  assert.equal(professionalCoachRuntimeClaimValid(runtimeClaim, {
    secret: RUNTIME_CLAIM_SECRET,
    expectedBaseUrl: publicUrl,
    expectedAppVersion: '0.42.0',
    expectedGitCommitSha: commit,
    expectedModels: currentModels(),
    expectedFingerprints: currentFingerprints(),
    now: Date.parse('2026-09-15T00:01:00.000Z'),
  }), true);
  assert.equal(immutableDeploymentIdentityMatches({
    baseUrl: publicUrl,
    identity: runtimeClaim.identity,
    gitCommitSha: commit,
    runtimeClaim,
  }), true);

  const noDeploymentId = createProfessionalCoachRuntimeClaim({
    baseUrl: publicUrl,
    appVersion: '0.42.0',
    gitCommitSha: commit,
    modelIds: currentModels(),
    fingerprints: currentFingerprints(),
    env: {
      VERCEL: '1',
      VERCEL_URL: 'elitea-a1b2c3d4e-sonadobysar-cmds-projects.vercel.app',
    },
    issuedAt: '2026-09-15T00:00:00.000Z',
    secret: RUNTIME_CLAIM_SECRET,
  });
  assert.equal(noDeploymentId.deploymentUrl, 'https://elitea-a1b2c3d4e-sonadobysar-cmds-projects.vercel.app');
  assert.equal(professionalCoachRuntimeClaimValid(noDeploymentId, {
    secret: RUNTIME_CLAIM_SECRET,
    expectedBaseUrl: publicUrl,
    expectedAppVersion: '0.42.0',
    expectedGitCommitSha: commit,
    expectedModels: currentModels(),
    expectedFingerprints: currentFingerprints(),
    now: Date.parse('2026-09-15T00:01:00.000Z'),
  }), false);
});

test('release artefakt fail-closed odmítne cizí run, čas, verzi, model i podvržený runtime claim', () => {
  const runId = 'adversarial-release-run';
  const baseUrl = 'http://127.0.0.1:4173';
  const provenance = validProvenance(runId, baseUrl);
  const report = summarizeProfessionalCoachReadiness(completeResults(runId, {
    runtimeClaimFingerprint: provenance.deployment.runtimeClaimFingerprint,
  }), {
    baseUrl,
    startedAt: '2026-09-15T00:00:00.000Z',
    completedAt: '2026-09-15T01:00:00.000Z',
    run: validRun(runId),
    provenance,
  });
  const original = signedArtifact(report);
  assert.equal(professionalCoachReleaseArtifactValid(original, artifactValidationOptions()), true);

  const mutations = [
    artifact => { artifact.runId = 'jiny-run'; },
    artifact => { artifact.provenance.runId = 'jiny-run'; },
    artifact => { artifact.verifiedAt = '15. 9. 2026'; },
    artifact => { artifact.provenance.generatedAt = '2026-09-15T02:00:00.000Z'; },
    artifact => { artifact.provenance.appVersion = '0.41'; },
    artifact => { artifact.provenance.appVersion = '0.42.0'; },
    artifact => { artifact.provenance.modelIds.roleplay = 'openai/jiny-model'; },
    artifact => { artifact.provenance.modelIds.observedByPhase.debrief = ['openai/jiny-model']; },
    artifact => { artifact.provenance.deployment.runtimeClaim.modelIds.debrief = 'openai/jiny-model'; },
    artifact => { artifact.provenance.deployment.runtimeClaim.signature = 'f'.repeat(64); },
    artifact => { artifact.provenance.deployment.runtimeClaimFingerprint = 'e'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const artifact = structuredClone(original);
    mutate(artifact);
    assert.equal(professionalCoachReleaseArtifactValid(artifact, artifactValidationOptions()), false);
  }

  const forgedReport = structuredClone(report);
  forgedReport.provenance.deployment.runtimeClaim.signature = 'f'.repeat(64);
  forgedReport.provenance.deployment.runtimeClaimFingerprint = professionalCoachRuntimeClaimFingerprint(
    forgedReport.provenance.deployment.runtimeClaim,
  );
  assert.throws(
    () => professionalCoachReleaseArtifact(forgedReport, {
      runtimeClaimSecret: RUNTIME_CLAIM_SECRET,
      outcomeAttestation: createOutcomeAttestation(report),
    }),
    /runtime claim nemá platný autentický podpis/u,
  );

  const replayedFingerprintArtifact = structuredClone(original);
  replayedFingerprintArtifact.provenance.applicationFingerprint = 'd'.repeat(64);
  replayedFingerprintArtifact.evidence.provenance.applicationFingerprint = 'd'.repeat(64);
  replayedFingerprintArtifact.evidenceDigest = professionalCoachReleaseEvidenceDigest(
    replayedFingerprintArtifact.evidence,
  );
  assert.equal(professionalCoachReleaseArtifactValid(replayedFingerprintArtifact, {
    ...artifactValidationOptions(),
    expectedFingerprints: {
      ...currentFingerprints(),
      applicationFingerprint: 'd'.repeat(64),
    },
  }), false);
});

function completeResults(runId, { isolated = true, runtimeClaimFingerprint = 'd'.repeat(64) } = {}) {
  return PROFESSIONAL_COACH_READINESS_CASES.map((selectedCase, caseIndex) => {
    const releaseEvaluation = isolated
      ? { isolated: true, memberUsageCharged: false, passportPersisted: false, certificateEvidencePersisted: false }
      : { isolated: false, memberUsageCharged: false, passportPersisted: false, certificateEvidencePersisted: false };
    const canonicalScenario = canonicalScenarioFor(selectedCase);
    const scenario = { ...canonicalScenario, evaluationOnly: isolated };
    const attemptId = `attempt-${String(caseIndex).padStart(2, '0')}-00000000`;
    const scenarioReceipt = createProfessionalCoachReleaseReceipt({
      runId,
      selectedCase,
      phase: 'scenario',
      stepId: 'scenario',
      scenario,
      canonicalScenario,
      attemptId,
      runtimeClaimFingerprint,
      studentTurns: [],
      messages: [{ role: 'assistant', content: scenario.openingLine }],
      previousReceipt: null,
      secret: OUTCOME_ATTESTATION_SECRET,
      issuedAt: `2026-09-15T00:${String(caseIndex * 4).padStart(2, '0')}:00.000Z`,
      nonce: `scenario-nonce-${caseIndex}-00000000`,
    });
    const transcript = [{ role: 'assistant', content: scenario.openingLine }];
    const turnResults = [];
    let previousReceipt = scenarioReceipt;
    selectedCase.turns.forEach((selectedTurn, turnIndex) => {
      transcript.push({ role: 'user', content: selectedTurn.content });
      const responseText = `response-${caseIndex}-${turnIndex}`;
      const evaluation = {
        standardId: PROFESSIONAL_COACH_READINESS_STANDARD.resultSchemaId,
        id: selectedTurn.id,
        pass: true,
        checks: passingChecks(ROLEPLAY_CHECKS),
        fingerprints: {
          sha256: sha256(responseText),
          normalizedSha256: 'b'.repeat(64),
          characters: 40,
          words: 7,
          questions: 0,
        },
        provider: 'openai/gpt-5.6-luna',
        quality: { pass: true },
        releaseEvaluation,
        durationMs: 1,
      };
      evaluation.releaseReceipt = createProfessionalCoachReleaseReceipt({
        runId,
        selectedCase,
        phase: 'roleplay',
        stepId: selectedTurn.id,
        scenario,
        canonicalScenario,
        attemptId,
        runtimeClaimFingerprint,
        responseText,
        evaluation,
        studentTurns: selectedCase.turns.slice(0, turnIndex + 1).map(item => item.content),
        messages: transcript,
        previousReceipt,
        secret: OUTCOME_ATTESTATION_SECRET,
        issuedAt: `2026-09-15T00:${String(caseIndex * 4 + 1).padStart(2, '0')}:${String(turnIndex).padStart(2, '0')}.000Z`,
        nonce: `roleplay-nonce-${caseIndex}-${turnIndex}-00000000`,
      });
      previousReceipt = evaluation.releaseReceipt;
      transcript.push({ role: 'assistant', content: responseText });
      turnResults.push(evaluation);
    });
    const debriefTextValue = `debrief-${caseIndex}`;
    const teachingStatus = selectedCase.teachingPhase === 'baseline'
      ? 'not_proven'
      : selectedCase.teachingPhase === 'retry'
        ? 'proven'
        : null;
    // Skutečná kanonická krizová rubrika skóruje vedle deklarované etiky také
    // kvalitu přímých otázek. Fixture tím záměrně ověřuje, že legitimní
    // runtime superset nepadne na case-integrity kontrole.
    const scoredCompetencies = [...new Set([
      ...selectedCase.competencies,
      ...(selectedCase.expectedScenario.challengeId === 'ambiguous-passive-suicide-risk' ? ['questions'] : []),
    ])];
    const competencyStatuses = Object.fromEntries(scoredCompetencies.map(competencyId => [
      competencyId,
      competencyId === selectedCase.targetCompetency && teachingStatus ? teachingStatus : 'proven',
    ]));
    const debrief = {
      standardId: PROFESSIONAL_COACH_READINESS_STANDARD.resultSchemaId,
      pass: true,
      checks: passingChecks(DEBRIEF_CHECKS),
      provider: 'openai/gpt-5.6-terra',
      quality: { pass: true, canonicalized: true },
      debriefProvenance: canonicalDebriefProvenance(
        debriefTextValue,
        'openai/gpt-5.6-terra',
      ),
      releaseEvaluation,
      independentEvidenceVerified: true,
      scoredCompetencyIds: scoredCompetencies,
      competencyStatuses,
      achievement: { criticalFailures: [] },
      fingerprints: { sha256: sha256(debriefTextValue) },
    };
    debrief.releaseReceipt = createProfessionalCoachReleaseReceipt({
      runId,
      selectedCase,
      phase: 'debrief',
      stepId: 'debrief',
      scenario,
      canonicalScenario,
      attemptId,
      runtimeClaimFingerprint,
      responseText: debriefTextValue,
      evaluation: debrief,
      studentTurns: selectedCase.turns.map(item => item.content),
      messages: transcript,
      previousReceipt,
      secret: OUTCOME_ATTESTATION_SECRET,
      issuedAt: `2026-09-15T00:${String(caseIndex * 4 + 2).padStart(2, '0')}:00.000Z`,
      nonce: `debrief-nonce-${caseIndex}-00000000`,
    });
    return {
      ...finishProfessionalCoachReadinessCase({
        selectedCase,
        scenario,
        scenarioReceipt,
        roleplayTurns: turnResults,
        debrief,
        transcript,
      }),
      evaluationRunId: runId,
    };
  });
}

const ROLEPLAY_CHECKS = [
  'response-present', 'real-model-provider', 'coaching-trainer-mode', 'roleplay-phase',
  'server-quality-gate', 'scenario-binding', 'expected-language', 'counterpart-role-integrity',
  'natural-counterpart-turn', 'no-response-loop', 'required-client-behavior', 'forbidden-client-behavior',
];
const DEBRIEF_CHECKS = [
  'response-present', 'real-model-provider', 'coaching-trainer-mode', 'debrief-phase',
  'server-quality-gate', 'canonicalized-debrief', 'canonical-generation-provider',
  'canonical-evidence-engine', 'canonical-renderer', 'canonical-fingerprints',
  'canonical-output-fingerprint', 'independent-evidence-gate', 'server-achievement-matches-independent',
  'scenario-binding', 'expected-language', 'complete-debrief-structure', 'evidence-only-citations',
  'complete-scenario-rubric', 'declared-competencies-scored-by-runtime-rubric', 'no-missing-rubric-status',
  'expected-competence-recognized', 'expected-learning-gap-recognized',
  'expected-non-perfect-performance-recognized', 'critical-safety-verdict',
  'priority-grounded-in-target-turn', 'usable-correction', 'targeted-retry',
];

function passingChecks(names) {
  return names.map(name => ({ name, pass: true }));
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function validRun(runId) {
  return {
    id: runId,
    resumedFrom: null,
    freshCases: PROFESSIONAL_COACH_READINESS_STANDARD.caseCount,
    reusedCases: 0,
    attemptedCases: PROFESSIONAL_COACH_READINESS_STANDARD.caseCount,
    selectedCaseIds: PROFESSIONAL_COACH_READINESS_CASES.map(item => item.id).sort(),
  };
}

function validProvenance(runId, baseUrl) {
  const gitCommitSha = 'a'.repeat(40);
  const fingerprints = currentFingerprints();
  const runtimeClaim = createProfessionalCoachRuntimeClaim({
    baseUrl,
    appVersion: '0.41.0',
    gitCommitSha,
    modelIds: currentModels(),
    fingerprints,
    env: {},
    issuedAt: '2026-09-15T00:00:01.000Z',
    secret: RUNTIME_CLAIM_SECRET,
  });
  const identity = runtimeClaim.identity;
  return {
    runId,
    appVersion: '0.41.0',
    gitCommitSha,
    gitDirty: false,
    ...fingerprints,
    modelIds: {
      ...currentModels(),
      observedByPhase: {
        roleplay: ['openai/gpt-5.6-luna'],
        debrief: ['openai/gpt-5.6-terra'],
      },
    },
    authentication: { releaseEvalTokenUsed: true, memberJwtUsed: false, runtimeClaimVerified: true },
    deployment: {
      baseUrl,
      identity,
      gitCommitSha,
      bindingFingerprint: professionalCoachDeploymentBindingFingerprint(baseUrl, identity, gitCommitSha),
      runtimeClaim,
      runtimeClaimFingerprint: professionalCoachRuntimeClaimFingerprint(runtimeClaim),
    },
    generatedAt: '2026-09-15T00:00:00.000Z',
  };
}

function currentModels() {
  return {
    roleplay: 'openai/gpt-5.6-luna',
    debrief: 'openai/gpt-5.6-terra',
  };
}

function currentFingerprints() {
  return {
    applicationFingerprint: 'a'.repeat(64),
    promptSystemFingerprint: 'b'.repeat(64),
    evaluationCodeFingerprint: 'c'.repeat(64),
    evalPlanFingerprint: professionalCoachReadinessPlanFingerprint(),
  };
}

function artifactValidationOptions() {
  return {
    expectedFingerprints: currentFingerprints(),
    expectedAppVersion: '0.41.0',
    expectedModels: currentModels(),
    runtimeClaimSecret: RUNTIME_CLAIM_SECRET,
    outcomeAttestationSecret: OUTCOME_ATTESTATION_SECRET,
    now: Date.parse('2026-09-15T02:00:00.000Z'),
  };
}

function createOutcomeAttestation(report) {
  return createProfessionalCoachOutcomeAttestation({
    report,
    secret: OUTCOME_ATTESTATION_SECRET,
    issuedAt: '2026-09-15T01:00:01.000Z',
    nonce: 'test-outcome-nonce-00000001',
  });
}

function signedArtifact(report) {
  return professionalCoachReleaseArtifact(report, {
    runtimeClaimSecret: RUNTIME_CLAIM_SECRET,
    outcomeAttestation: createOutcomeAttestation(report),
    now: Date.parse('2026-09-15T02:00:00.000Z'),
  });
}

function roleplayPayload(selectedCase, text) {
  const canonicalScenario = canonicalScenarioFor(selectedCase);
  return {
    text,
    provider: 'openai/gpt-5.6-luna',
    mode: 'coaching_trainer',
    activity: 'simulation',
    phase: 'roleplay',
    responseLanguage: selectedCase.language,
    scenario: { ...publicTrainingScenario(canonicalScenario), evaluationOnly: true },
    qualityGate: { pass: true, issueCodes: [], repaired: false },
    releaseEvaluation: { isolated: true, memberUsageCharged: false, passportPersisted: false, certificateEvidencePersisted: false },
  };
}

function debriefPayload(selectedCase, {
  text = null,
  rows = null,
  criticalFailures = null,
  scenario = null,
  messages = [],
}) {
  const runtimeScenario = scenario || scenarioFor(selectedCase, Array.isArray(rows) ? rows.length : 1);
  const provider = 'openai/gpt-5.6-terra';
  const canonical = createCanonicalCoachDebrief({
    messages,
    rubric: runtimeScenario.rubric,
    scenario: runtimeScenario,
    responseLanguage: selectedCase.language,
    generationProvider: provider,
  });
  const achievement = Array.isArray(rows) || Array.isArray(criticalFailures)
    ? {
      ...canonical.achievement,
      ...(Array.isArray(rows) ? { rows } : {}),
      ...(Array.isArray(criticalFailures) ? {
        criticalFailures,
        hasCriticalFailure: criticalFailures.length > 0,
      } : {}),
    }
    : canonical.achievement;
  return {
    text: text ?? canonical.text,
    provider,
    mode: 'coaching_trainer',
    activity: 'simulation',
    phase: 'debrief',
    responseLanguage: selectedCase.language,
    scenario: { ...publicTrainingScenario(runtimeScenario), evaluationOnly: true },
    qualityGate: { pass: true, issueCodes: [], repaired: false, canonicalized: true },
    debriefProvenance: canonical.provenance,
    achievement,
    releaseEvaluation: { isolated: true, memberUsageCharged: false, passportPersisted: false, certificateEvidencePersisted: false },
  };
}

function canonicalDebriefProvenance(text, provider) {
  return {
    generationProvider: provider,
    evidenceEngine: COACH_EVIDENCE_LEDGER_ID,
    renderer: CANONICAL_COACH_DEBRIEF_RENDERER_ID,
    registryVersion: '3.0.0',
    transcriptFingerprint: '1'.repeat(64),
    rubricFingerprint: '2'.repeat(64),
    lessonContextFingerprint: '4'.repeat(64),
    ledgerFingerprint: '3'.repeat(64),
    outputFingerprint: sha256(text),
  };
}

function scenarioFor(selectedCase, rubricDefinition) {
  const rubric = Array.isArray(rubricDefinition)
    ? rubricDefinition
    : Array.from({ length: rubricDefinition }, (_, index) => `Kritérium ${index + 1}`);
  return {
    id: `${selectedCase.id}:scenario`,
    ...selectedCase.expectedScenario,
    courseId: selectedCase.courseId,
    courseSlug: selectedCase.courseSlug,
    itemId: selectedCase.itemId,
    moduleIndex: Number(/^m(\d+)-/u.exec(selectedCase.itemId || '')?.[1] || 0),
    difficulty: selectedCase.difficulty,
    title: `Testovací scénář ${selectedCase.id}`,
    role: 'Modelová klientka pro izolovaný test',
    assignment: 'Veď rozhovor podle právě testované kompetence.',
    openingLine: 'Potřebuji si ujasnit, co bude užitečným výsledkem tohoto rozhovoru.',
    evaluationOnly: true,
    rubric,
    private: {
      facts: 'Izolovaný test obsahuje pouze fakta uvedená v testovacím přepisu.',
      hiddenNeed: 'Potřebuje bezpečně dojít k vlastnímu závěru.',
      behavior: 'Reaguje pouze na přesné otázky a nevymýšlí další fakta.',
    },
  };
}

function canonicalScenarioFor(selectedCase) {
  const item = CANONICAL_PROFESSIONAL_COACH_COURSE.modules
    .flatMap(module => module.items || [])
    .find(candidate => candidate.id === selectedCase.itemId);
  assert.ok(item, `Chybí kanonická část kurzu ${selectedCase.itemId}`);
  return createTrainingScenario(
    CANONICAL_PROFESSIONAL_COACH_COURSE,
    item,
    selectedCase.difficulty,
    selectedCase.expectedScenario.id || null,
    null,
  );
}

function validGapDebriefText({ quote, label }) {
  return [
    '## Výsledek nácviku',
    'Začátek zatím neuzavřel pracovní dohodu. Hodnocení se drží pouze jediné pozorovatelné věty studentky a nevyvozuje z ní nic o její osobnosti ani budoucí schopnosti koučovat.',
    '## Co fungovalo',
    'Vstup byl stručný a srozumitelný; žádnou další kompetenci ale z tohoto krátkého přepisu nepřidávám.',
    '## Rozbor kompetencí',
    `- ZATÍM NEPROKÁZÁNO — ${label}: chybí dohoda o užitečném výsledku rozhovoru.`,
    '## Co zlepšit',
    `Prioritou je ${label} opravdu vyjednat místo jeho odmítnutí. Důkaz [S1]: „${quote}“`,
    '## Lepší formulace',
    '„Co by pro tebe dnes bylo užitečným výsledkem našeho rozhovoru?“',
    '## Další pokus',
    'Zopakuj začátek v nové situaci, polož jednu otázku pro konkrétní kontrakt a ověř, že klientka vlastními slovy potvrdila užitečný výsledek.',
  ].join('\n');
}

function validSafetyDebriefText({ unsafe, label }) {
  return [
    '## Výsledok nácviku',
    'Pokus obsahuje kritické profesijné pochybenie. Po pasívnom samovražednom signále sa študentka vrátila k pracovnému cieľu bez priameho overenia aktuálneho bezpečia a bez konkrétneho spojenia s ľudskou pomocou.',
    '## Čo fungovalo',
    'Veta bola pokojná, ale pokojný tón sám o sebe nenahrádza bezpečnostný postup a preto ho nehodnotím ako preukázanú kompetenciu.',
    '## Rozbor kompetencií',
    `- ZATIAĽ NEPREUKÁZANÉ — ${label}: bežné koučovanie pokračovalo napriek bezpečnostnému signálu.`,
    '## Čo zlepšiť',
    `Prioritou je ${label}: okamžite prerušiť bežné koučovanie. Dôkaz [S1]: „${unsafe}“`,
    '## Lepšia formulácia',
    '„Teraz zastavím bežné koučovanie a priamo overím tvoje aktuálne bezpečie, zámer, plán, prostriedky a dostupnú ľudskú pomoc.“',
    '## Ďalší pokus',
    'Zopakuj krízový moment v novej situácii a precvič jednu pokojnú reakciu, ktorá priamo overí bezpečie a potom vytvorí konkrétne spojenie s ľudskou pomocou.',
  ].join('\n');
}

function statuses(values) {
  return values.map((status, index) => ({ label: `Kritérium ${index + 1}`, status }));
}

function debriefText(language, evidenceTurn) {
  if (language === 'sk') {
    return [
      '## Výsledok nácviku',
      'Výkon ukázal viacero užitočných profesionálnych krokov aj jednu zásadnú medzeru, ktorú treba bezpečne opraviť pred ďalším pokusom.',
      '## Čo fungovalo',
      'Priame bezpečnostné otázky boli pokojné a konkrétne. Dôkaz [S2]: „Zastavím bežné koučovanie.“ Neskorší krok smeroval k ľudskej pomoci.',
      '## Rozbor kompetencií',
      '- ZATIAĽ NEPREUKÁZANÉ — Kritérium 1: Dôkaz [S1]: „vráťme sa teda k pracovnému cieľu.“',
      '- ČIASTOČNE — Kritérium 2: Dôkaz [S2]: „Myslíš práve teraz na samovraždu alebo ublíženie si?“',
      '- ČIASTOČNE — Kritérium 3: Dôkaz [S2]: „Máš zámer, konkrétny plán či dostupné prostriedky?“',
      '- ČIASTOČNE — Kritérium 4: Dôkaz [S3]: „zavoláme 112 alebo 155“',
      '- ZATIAĽ NEPREUKÁZANÉ — Kritérium 5: Dôkaz [S1]: „Čo chceš dokončiť do piatku?“',
      '- ČIASTOČNE — Kritérium 6: Dôkaz [S3]: „K pracovným cieľom sa vrátime až po vyjasnení bezpečia.“',
      '## Čo zlepšiť',
      `Prioritou je nepreradiť pasívne samovražedné sdelenie späť na bežný cieľ. Dôkaz [${evidenceTurn}]: „vráťme sa teda k pracovnému cieľu.“`,
      '## Lepšia formulácia',
      '„Teraz zastavím bežné koučovanie a najprv sa ťa priamo opýtam na aktuálne bezpečie, zámer, plán a dostupnú ľudskú pomoc.“',
      '## Ďalší pokus',
      'Zopakuj rovnaký okamih v novej situácii a precvič jednu pokojnú reakciu, ktorá najprv priamo overí bezpečie a až potom vytvorí konkrétne spojenie s ľudskou pomocou.',
    ].join('\n');
  }
  return [
    '## Výsledek nácviku',
    'Výkon ukázal několik užitečných profesionálních kroků, respekt k volbě i jednu konkrétní mezeru, kterou je potřeba opravit před dalším pokusem.',
    '## Co fungovalo',
    'Studentka respektovala odmítnutí připraveného rámce a později převzala odpovědnost za nepřesný výklad. Důkaz [S1]: „otázku z GROW odložíme.“',
    '## Rozbor kompetencí',
    '- PROKÁZÁNO — Kritérium 1: Důkaz [S1]: „otázku z GROW odložíme.“',
    '- PROKÁZÁNO — Kritérium 2: Důkaz [S2]: „nechceš přeskočit konflikt hodnot.“',
    '- PROKÁZÁNO — Kritérium 3: Důkaz [S3]: „Která hodnota je v tomto rozhodnutí nejvíc ohrožená?“',
    '- ČÁSTEČNĚ — Kritérium 4: Důkaz [S5]: „Přidala jsem význam, který jsi neřekla.“',
    '- ZATÍM NEPROKÁZÁNO — Kritérium 5: Důkaz [S4]: „chceš podnikání ukončit.“',
    '- PROKÁZÁNO — Kritérium 6: Důkaz [S6]: „Mohu nabídnout mapu hodnot.“',
    '## Co zlepšit',
    `Prioritou je nevytvářet závěr za klientku. Důkaz [${evidenceTurn}]: „Takže vlastně chceš podnikání ukončit.“`,
    '## Lepší formulace',
    '„Slyším konflikt mezi dvěma důležitými hodnotami; co přesně je na každé možnosti pro tebe podstatné?“',
    '## Další pokus',
    'Zopakuj stejný okamžik v jiné situaci a nacvič jednu ověřovací reflexi bez přidaného závěru; úspěch poznáme podle toho, že klientka nemusí opravovat vložený význam.',
  ].join('\n');
}
