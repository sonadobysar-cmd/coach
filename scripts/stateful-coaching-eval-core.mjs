import { createHash } from 'node:crypto';
import { responseLanguageMismatch } from '../src/language-profile.js';

export const STATEFUL_COACHING_SCENARIOS = Object.freeze([
  scenario({
    id: 'cs-workshop-intent-repair',
    locale: 'cs-CZ',
    language: 'cs',
    capabilities: ['workshop-failure', 'external-stop-scope', 'recontract', 'loop-prevention'],
    turns: [
      turn('opening', 'První workshop dopadl špatně. Asi na podnikání prostě nemám.'),
      turn('attendance', 'Přihlásily se tři ženy a jedna po půl hodině odešla.'),
      turn('counterevidence', 'Dvě zbývající zůstaly do konce a jedna díky cvičení získala prvního klienta.'),
      turn('fear', 'Už nechci pokračovat, bojím se.'),
      turn('scope-correction', 'Končím s workshopy, ne s tebou. Chci zjistit, co dělat místo nich.', {
        requires: [
          requirement('external-activity-understood', /workshop/iu),
          requirement('conversation-stays-open', /(?:místo|dál|pokrač|jin[ýáé]|co teď|další)/iu),
        ],
        forbids: [
          prohibition('false-session-stop', /(?:uzavřeme|ukončíme|zastavíme).{0,40}(?:rozhovor|sezení|dnešní téma)/iu),
        ],
      }),
      turn('uncertain-direction', 'Nevím, proto tu jsem.', {
        requires: [
          requirement('helpful-direction-after-uncertainty', /(?:možnost|varianta|místo|další|první|můžeme|pojďme|nabízí se)/iu),
        ],
        forbids: [
          prohibition('does-not-reask-past-trigger', /co (?:bylo|se stalo) těsně předtím|poslední konkrétní situaci/iu),
          prohibition('does-not-demand-effect-rating', /co se teď změnilo|je to stejné.{0,30}(?:lepší|horší)/iu),
          prohibition('false-session-stop', /(?:uzavřeme|ukončíme|zastavíme).{0,40}(?:rozhovor|sezení|dnešní téma)/iu),
        ],
      }),
    ],
  }),
  scenario({
    id: 'sk-workshop-intent-repair',
    locale: 'sk-SK',
    language: 'sk',
    capabilities: ['workshop-failure', 'external-stop-scope', 'recontract', 'loop-prevention', 'slovak'],
    turns: [
      turn('opening', 'Môj prvý workshop dopadol zle. Asi nemám na podnikanie.'),
      turn('attendance', 'Prišli tri ženy a jedna po pol hodine odišla. Neviem prečo.'),
      turn('counterevidence', 'Dve zostali do konca a jedna vďaka cvičeniu získala prvú klientku.'),
      turn('scope-correction', 'Nechcem pokračovať s workshopmi, nie s tebou. Chcem zistiť, čo ďalej.', {
        requires: [
          requirement('external-activity-understood', /workshop/iu),
          requirement('conversation-stays-open', /(?:namiesto|ďalej|pokrač|in[ýáé]|čo teraz|ďalší)/iu),
        ],
        forbids: [
          prohibition('false-session-stop', /(?:uzavrieme|ukončíme|zastavíme).{0,40}(?:rozhovor|sedenie|dnešn[úé] tému)/iu),
        ],
      }),
      turn('uncertain-direction', 'Neviem, preto som tu.', {
        requires: [
          requirement('helpful-direction-after-uncertainty', /(?:možnosť|varianta|namiesto|ďalší|prvý|môžeme|poďme|ponúka sa)/iu),
        ],
        forbids: [
          prohibition('does-not-reask-past-trigger', /čo (?:bolo|sa stalo) tesne predtým|posledn[úý] konkrétnu situáciu/iu),
          prohibition('does-not-demand-effect-rating', /čo sa teraz zmenilo|je to rovnaké.{0,30}(?:lepšie|horšie)/iu),
          prohibition('false-session-stop', /(?:uzavrieme|ukončíme|zastavíme).{0,40}(?:rozhovor|sedenie|dnešn[úé] tému)/iu),
        ],
      }),
    ],
  }),
  scenario({
    id: 'cs-no-effect-pivot',
    locale: 'cs-CZ',
    language: 'cs',
    capabilities: ['no-effect-pivot', 'method-change', 'loop-prevention'],
    turns: [
      turn('first-no-effect', 'Před prodejním hovorem se mi stáhne hrudník. Zkusila jsem pomalý dech a vůbec mi nepomohl.', {
        requires: [
          requirement('no-effect-recognized', /(?:nepomoh|nezabral|beze změny|dech.{0,35}(?:nebudeme|neopak|necháme|stranou))/iu),
          requirement('approach-changes', /(?:jinak|jin[ýáé]|místo|nebudeme.{0,30}(?:opak|vracet)|necháme.{0,30}stranou|přejd|pojďme.{0,35}(?:k|na)|zaměř)/iu),
        ],
        expectedBlockedModalities: ['breath'],
      }),
      turn('second-no-effect', 'Ani pojmenování pocitu nic nezměnilo. Nechci dokola zkoušet totéž.', {
        requires: [
          requirement('second-no-effect-recognized', /(?:nic nezměn|nepomoh|nezabral|bez efektu|pojmenování.{0,35}(?:nebudeme|neopak|necháme|stranou))/iu),
          requirement('second-pivot', /(?:jinak|jin[ýáé]|místo|nebudeme.{0,30}(?:opak|vracet)|necháme.{0,30}stranou|přejd|pojďme|praktick|situac|myšlenk|hovor)/iu),
        ],
        forbids: [
          prohibition('no-retry-breath-or-label', /(?:(?:zkus|udělej|proveď|vrátíme se|nabíd|můžeme|pojďme).{0,60}(?:dech|dých|pojmenuj|pojmenování pocitu)|(?:dech|dých|pojmenování pocitu).{0,60}(?:zkus|vyzkouš|nabíd|chceš|můžeme))/iu),
        ],
        expectedBlockedModalities: ['breath', 'emotion_labeling'],
      }),
      turn('explicit-method-boundary', 'Prosím žádné další regulační cvičení. Potřebuji se podívat na konkrétní hovor.', {
        requires: [
          requirement('method-boundary-respected', /(?:beru|respekt|bez.{0,35}(?:cvičení|regulace)|nebudeme.{0,35}(?:cvičení|regul)|necháme.{0,35}(?:stranou|být)|žádné další.{0,25}cvičení|přímo.{0,25}konkrétní.{0,20}hovor|konkrétní.{0,20}hovor)/iu),
          requirement('returns-to-client-focus', /(?:hovor|situac|řekl|nabídk|klient)/iu),
        ],
        forbids: [
          prohibition('no-regulation-pressure', /(?:(?:zkus|udělej|proveď|nabíd|můžeme|pojďme).{0,55}(?:dech|uzem|vizualiz|tělo|regulační cvičení)|(?:dech|uzemnění|vizualizace).{0,55}(?:zkus|vyzkouš|nabíd|chceš|můžeme))/iu),
        ],
        expectedBlockedModalities: ['breath', 'emotion_labeling', 'somatic_regulation'],
      }),
    ],
  }),
  scenario({
    id: 'sk-no-effect-pivot',
    locale: 'sk-SK',
    language: 'sk',
    capabilities: ['no-effect-pivot', 'method-change', 'loop-prevention', 'slovak'],
    turns: [
      turn('first-no-effect', 'Pred predajným hovorom sa mi stiahne hruď. Skúsila som pomalý dych a vôbec mi nepomohol.', {
        requires: [
          requirement('no-effect-recognized', /(?:nepomoh|nezabral|bez zmeny|dych.{0,35}(?:nebudeme|neopak|necháme|bokom))/iu),
          requirement('approach-changes', /(?:inak|in[ýáé]|namiesto|nebudeme.{0,30}(?:opak|vracať)|necháme.{0,30}bokom|prejd|poďme.{0,35}(?:k|na)|zamer)/iu),
        ],
        expectedBlockedModalities: ['breath'],
      }),
      turn('second-no-effect', 'Ani pomenovanie pocitu nič nezmenilo. Nechcem dookola skúšať to isté.', {
        requires: [
          requirement('second-no-effect-recognized', /(?:nič nezmen|nepomoh|nezabral|bez efektu|pomenovanie.{0,35}(?:nebudeme|neopak|necháme|bokom))/iu),
          requirement('second-pivot', /(?:inak|in[ýáé]|namiesto|nebudeme.{0,30}(?:opak|vracať)|necháme.{0,30}bokom|prejd|poďme|praktick|situáci|myšlienk|hovor)/iu),
        ],
        forbids: [
          prohibition('no-retry-breath-or-label', /(?:(?:skús|urob|vrátime sa|ponúk|môžeme|poďme).{0,60}(?:dych|dých|pomenuj|pomenovanie pocitu)|(?:dych|dých|pomenovanie pocitu).{0,60}(?:skús|vyskúš|ponúk|chceš|môžeme))/iu),
        ],
        expectedBlockedModalities: ['breath', 'emotion_labeling'],
      }),
      turn('explicit-method-boundary', 'Prosím žiadne ďalšie regulačné cvičenie. Potrebujem sa pozrieť na konkrétny hovor.', {
        requires: [
          requirement('method-boundary-respected', /(?:beriem|rešpekt|bez.{0,35}(?:cvičenia|regulácie)|nebudeme.{0,35}(?:cvičenie|regul)|necháme.{0,35}(?:bokom|tak)|žiadne ďalšie.{0,25}cvičenie|priamo.{0,25}konkrétny.{0,20}hovor|konkrétny.{0,20}hovor)/iu),
          requirement('returns-to-client-focus', /(?:hovor|situáci|povedal|ponuk|klient)/iu),
        ],
        forbids: [
          prohibition('no-regulation-pressure', /(?:(?:skús|urob|ponúk|môžeme|poďme).{0,55}(?:dych|uzem|vizualiz|telo|regulačné cvičenie)|(?:dych|uzemnenie|vizualizácia).{0,55}(?:skús|vyskúš|ponúk|chceš|môžeme))/iu),
        ],
        expectedBlockedModalities: ['breath', 'emotion_labeling', 'somatic_regulation'],
      }),
    ],
  }),
  scenario({
    id: 'cs-long-session-memory',
    locale: 'cs-CZ',
    language: 'cs',
    capabilities: ['long-memory', 'fact-integrity', 'unknowns-stay-unknown', 'loop-prevention'],
    turns: [
      turn('opening', 'Chci poctivě vyhodnotit svůj první placený workshop, ne se jen uklidnit.'),
      turn('attendance', 'Přihlásily se přesně tři ženy.'),
      turn('departure', 'Jedna odešla po půl hodině a nevím proč.'),
      turn('retention', 'Zbývající dvě zůstaly až do konce.'),
      turn('outcome', 'Jedna mi napsala, že díky cvičení získala prvního klienta.'),
      turn('capacity', 'Strach je nepříjemný, ale únosný a spánek mi nenarušil.'),
      turn('feedback-boundary', 'Té ženě, která odešla, zatím psát nechci.'),
      turn('business-direction', 'V podnikání ale pokračovat chci.'),
      turn('format-option', 'Možná bych místo živého workshopu zkusila menší skupinu.'),
      turn('audience', 'Nabídka byla určená začínajícím podnikatelkám ve službách.'),
      turn('price', 'Cena workshopu byla 590 korun.'),
      turn('memory-check', 'Než půjdeme dál, shrň pouze doložená fakta: kolik žen se přihlásilo, kolik zůstalo, co byl výsledek a jestli víme, proč jedna odešla.', {
        requires: [
          requirement('remembers-three-attendees', /(?:tři|(?<!\d)3(?!\d)).{0,45}(?:žen|účastnic)|(?:žen|účastnic).{0,45}(?:tři|(?<!\d)3(?!\d))/iu),
          requirement('remembers-two-stayed', /(?:dvě|(?<!\d)2(?!\d)).{0,45}(?:zůstal|do konce)|(?:zůstal|do konce).{0,45}(?:dvě|(?<!\d)2(?!\d))/iu),
          requirement('remembers-client-outcome', /(?:prvn[ií]ho klient|získala.{0,35}klient|klient.{0,35}získala)/iu),
          requirement('keeps-departure-unknown', /(?:nev[ií]me.{0,45}proč|proč.{0,45}nev[ií]me|důvod.{0,35}(?:nezn|nev[ií])|bez.{0,30}vysvětlení|není známo)/iu),
        ],
        forbids: [
          prohibition('does-not-invent-departure-reason', /odešla proto(?:že)?|důvodem (?:byl|byla)|nebavilo ji|musela odejít|nevyhovovalo jí/iu),
        ],
      }),
    ],
  }),
]);

export const STATEFUL_COACHING_STANDARD = Object.freeze({
  version: 1,
  evidenceType: 'synthetic-stateful-live-model-eval',
  humanReviewed: false,
  qualifiesAsHumanReviewedSession: false,
  scenarioCount: STATEFUL_COACHING_SCENARIOS.length,
  turnCount: STATEFUL_COACHING_SCENARIOS.reduce((sum, item) => sum + item.turns.length, 0),
});

const BAD_PROVIDER = /(?:demo|fallback|local-training|deterministic|course-role-router|safety-protocol)/iu;
const LEGACY_LOOP_LANGUAGE = /(?:Než přidáme cokoli dalšího, potřebuji zůstat u účinku|Nechci ti hned podsouvat vysvětlení\. Popiš mi poslední konkrétní situaci|Co se teď změnilo — je to stejné, o trochu lepší, nebo horší)/iu;
const INTERNAL_LANGUAGE = /(?:interní (?:prompt|pravidlo|kontrola|rubrika)|quality gate|system prompt|jako jazykový model)/iu;

export async function runStatefulScenario({ scenario: selectedScenario, postJson, memory = defaultMemory() }) {
  if (!selectedScenario?.id || !Array.isArray(selectedScenario.turns) || !selectedScenario.turns.length) {
    throw new Error('Stavový scénář musí mít ID a alespoň jeden tah.');
  }
  if (typeof postJson !== 'function') throw new Error('Chybí funkce postJson pro živé volání.');

  const messages = [];
  const priorAssistantTexts = [];
  const turnResults = [];
  let techniqueSession = null;
  let specialistSession = null;

  for (const selectedTurn of selectedScenario.turns) {
    messages.push({ role: 'user', content: selectedTurn.content });
    const requestBody = {
      role: 'coach_mentor',
      consultationMode: selectedScenario.consultationMode || 'coaching_session',
      brandWorkMode: 'collaborate',
      memory,
      messages: messages.map(message => ({ ...message })),
      techniqueSession,
      specialistSession,
    };
    const started = Date.now();
    const payload = await postJson('/api/chat', requestBody);
    const text = String(payload?.text || '').trim();
    const result = evaluateStatefulTurn({
      scenario: selectedScenario,
      turn: selectedTurn,
      payload,
      priorAssistantTexts,
      durationMs: Date.now() - started,
    });
    turnResults.push(result);
    messages.push({ role: 'assistant', content: text });
    priorAssistantTexts.push(text);
    if (Object.hasOwn(payload || {}, 'techniqueSession')) techniqueSession = payload.techniqueSession;
    if (Object.hasOwn(payload || {}, 'specialistSession')) specialistSession = payload.specialistSession;
  }

  return {
    id: selectedScenario.id,
    locale: selectedScenario.locale,
    capabilities: [...(selectedScenario.capabilities || [])],
    pass: turnResults.every(result => result.pass),
    turns: turnResults,
    state: {
      accumulatedMessages: messages.length,
      techniquePhase: cleanCode(techniqueSession?.phase),
      specialistPrimary: cleanCode(specialistSession?.primary),
    },
  };
}

export function evaluateStatefulTurn({ scenario: selectedScenario, turn: selectedTurn, payload, priorAssistantTexts = [], durationMs = 0 }) {
  const text = String(payload?.text || '').trim();
  const requirements = (selectedTurn?.requires || []).map(item => ({ id: item.id, hit: item.pattern.test(text) }));
  const prohibitions = (selectedTurn?.forbids || []).map(item => ({ id: item.id, hit: item.pattern.test(text) }));
  const loopMatches = priorAssistantTexts
    .map((previous, index) => ({ index, hit: isNearDuplicate(previous, text) }))
    .filter(item => item.hit)
    .map(item => item.index + 1);
  const checks = [
    check('response-present', text.length >= 20),
    check('real-model-provider', Boolean(payload?.provider) && !BAD_PROVIDER.test(String(payload.provider))),
    check('server-quality-gate', payload?.qualityGate?.pass === true, {
      score: finiteNumber(payload?.qualityGate?.score),
      issueCodes: cleanCodes(payload?.qualityGate?.issueCodes),
    }),
    check('coach-role', payload?.activeRole === 'coach' && payload?.mode !== 'brand_growth_agent', {
      mode: cleanCode(payload?.mode),
      activeRole: cleanCode(payload?.activeRole),
    }),
    check('response-language', !responseLanguageMismatch(text, selectedScenario.language), { expected: selectedScenario.language }),
    check('no-prior-answer-loop', loopMatches.length === 0, { matchedPriorTurns: loopMatches }),
    check('no-known-loop-template', !LEGACY_LOOP_LANGUAGE.test(text)),
    check('no-internal-language', !INTERNAL_LANGUAGE.test(text)),
    check('turn-required-signals', requirements.every(item => item.hit), {
      hit: requirements.filter(item => item.hit).map(item => item.id),
      missing: requirements.filter(item => !item.hit).map(item => item.id),
    }),
    check('turn-forbidden-signals', prohibitions.every(item => !item.hit), {
      triggered: prohibitions.filter(item => item.hit).map(item => item.id),
    }),
    check('blocked-modalities-carried', (selectedTurn?.expectedBlockedModalities || []).every(modality => (
      Array.isArray(payload?.techniqueSession?.blockedModalities)
      && payload.techniqueSession.blockedModalities.includes(modality)
    )), {
      expected: [...(selectedTurn?.expectedBlockedModalities || [])],
      actual: sanitizeReportedModalities(payload?.techniqueSession?.blockedModalities),
    }),
  ];
  return {
    id: selectedTurn.id,
    pass: checks.every(item => item.pass),
    checks,
    fingerprints: responseFingerprints(text),
    provider: cleanCode(payload?.provider),
    mode: cleanCode(payload?.mode),
    activeRole: cleanCode(payload?.activeRole),
    techniquePhase: cleanCode(payload?.techniqueSession?.phase),
    specialistPrimary: cleanCode(payload?.specialistSession?.primary),
    durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
  };
}

export function summarizeStatefulCoachingEval(results, { baseUrl, startedAt, completedAt } = {}) {
  const ordered = [...results].sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const turns = ordered.flatMap(result => result.turns || []);
  const passed = ordered.filter(result => result.pass).length;
  return {
    standardVersion: STATEFUL_COACHING_STANDARD.version,
    evidence: {
      type: STATEFUL_COACHING_STANDARD.evidenceType,
      liveModelCalls: true,
      syntheticScenarios: true,
      stateCarriedAcrossTurns: true,
      humanReviewed: false,
      qualifiesAsHumanReviewedSession: false,
      statement: 'Jde o syntetický stavový live-model eval. Není to lidsky vedené ani lidsky zkontrolované koučovací sezení.',
    },
    baseUrl,
    startedAt,
    completedAt,
    privacy: 'Report neukládá text konverzace, paměť ani session objekty; obsahuje pouze názvy kontrol, omezené stavové kódy a kryptografické otisky.',
    summary: {
      expectedScenarios: STATEFUL_COACHING_STANDARD.scenarioCount,
      expectedTurns: STATEFUL_COACHING_STANDARD.turnCount,
      scenarios: ordered.length,
      turns: turns.length,
      passedScenarios: passed,
      failedScenarios: ordered.length - passed,
      passedTurns: turns.filter(item => item.pass).length,
      failedTurns: turns.filter(item => !item.pass).length,
      complete: ordered.length === STATEFUL_COACHING_STANDARD.scenarioCount
        && turns.length === STATEFUL_COACHING_STANDARD.turnCount
        && passed === ordered.length,
    },
    byLocale: groupSummary(ordered, item => item.locale),
    byCapability: capabilitySummary(ordered),
    results: ordered,
  };
}

export function assertPrivateStatefulReport(report, needles = []) {
  const serialized = JSON.stringify(report).toLocaleLowerCase('cs-CZ');
  for (const value of needles) {
    const needle = String(value || '').trim().toLocaleLowerCase('cs-CZ');
    if (needle.length >= 8 && serialized.includes(needle)) {
      throw new Error('Ochrana soukromí zastavila zápis: stavový report obsahuje text konverzace.');
    }
  }
  return true;
}

export function isNearDuplicate(leftValue, rightValue) {
  const left = normalize(leftValue);
  const right = normalize(rightValue);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTokens = new Set(left.split(' ').filter(token => token.length >= 3));
  const rightTokens = new Set(right.split(' ').filter(token => token.length >= 3));
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  const containment = intersection / Math.max(1, Math.min(leftTokens.size, rightTokens.size));
  return containment >= 0.8 && Math.min(left.length, right.length) >= 24;
}

export function responseFingerprints(value) {
  const text = String(value || '');
  return {
    sha256: hash(text),
    normalizedSha256: hash(normalize(text)),
    characters: text.length,
    words: (text.match(/[\p{L}\p{N}]+/gu) || []).length,
    questions: (text.match(/\?/gu) || []).length,
  };
}

function defaultMemory() {
  return {
    identity_preferences: { preferred_name: 'Eval', address_form: 'tykani' },
    business_context: { stage: 'start', industry: 'služby' },
    coaching_profile: { support_accommodations: 'Jedna otázka nebo jeden jasný krok. Přátelsky a konkrétně.' },
  };
}

function scenario(value) {
  return Object.freeze({ consultationMode: 'coaching_session', ...value, turns: Object.freeze(value.turns) });
}

function turn(id, content, { requires = [], forbids = [], expectedBlockedModalities = [] } = {}) {
  return Object.freeze({
    id,
    content,
    requires: Object.freeze(requires),
    forbids: Object.freeze(forbids),
    expectedBlockedModalities: Object.freeze(expectedBlockedModalities),
  });
}

function requirement(id, pattern) {
  return Object.freeze({ id, pattern });
}

function prohibition(id, pattern) {
  return Object.freeze({ id, pattern });
}

function check(name, pass, detail = undefined) {
  return { name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) };
}

function groupSummary(items, keyFor) {
  const groups = {};
  for (const item of items) {
    const key = String(keyFor(item) || 'unknown');
    groups[key] ||= { total: 0, passed: 0, failed: 0 };
    groups[key].total += 1;
    groups[key][item.pass ? 'passed' : 'failed'] += 1;
  }
  return groups;
}

function capabilitySummary(items) {
  const groups = {};
  for (const item of items) {
    for (const capability of item.capabilities || []) {
      groups[capability] ||= { total: 0, passed: 0, failed: 0 };
      groups[capability].total += 1;
      groups[capability][item.pass ? 'passed' : 'failed'] += 1;
    }
  }
  return groups;
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function cleanCode(value) {
  const clean = String(value || '').trim();
  return /^[\p{L}\p{N}_.:/-]{1,120}$/u.test(clean) ? clean : null;
}

function cleanCodes(values) {
  return (Array.isArray(values) ? values : []).map(cleanCode).filter(Boolean).slice(0, 20);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeReportedModalities(values) {
  return (Array.isArray(values) ? values : [])
    .map(cleanCode)
    .filter(Boolean)
    .slice(0, 12);
}
