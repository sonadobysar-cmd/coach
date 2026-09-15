import { createHash } from 'node:crypto';
import { responseLanguageMismatch } from '../src/language-profile.js';

export const CZSK_LIVE_EVAL_STANDARD = Object.freeze({
  version: 1,
  scenarioCount: 100,
  expectedChatCases: 90,
  expectedTrainingDebriefCases: 10,
  evidenceType: 'synthetic-live-model-eval',
  humanReviewed: false,
  qualifiesAsHumanReviewedSession: false,
});

const DISALLOWED_PROVIDER = /(?:demo|fallback|local-training|deterministic|course-role-router)/iu;
const ROBOTIC_LANGUAGE = /držím se přesně|nechci přidávat domněnku|pracovní zadání je|rozhodující předpoklad|interní (?:kontrola|oprava|pravidlo|prompt|rubrika)/iu;

const CHAT_ROUTES = Object.freeze({
  koucovaci_hodina: route('coaching_session', 'coach_mentor', ['koucovaci_hodina'], ['coach']),
  mentoringova_konzultace: route('business_mentoring', 'coach_mentor', ['mentoringova_konzultace'], ['mentor']),
  adhd_friendly_exekuce: route('auto', 'coach_mentor', ['podpora_fungovani', 'koucovaci_hodina', 'diagnostika'], ['coach', 'mentor']),
  koucovaci_podpora: route('auto', 'coach_mentor', ['koucovaci_podpora', 'koucovaci_hodina', 'diagnostika'], ['coach']),
  brand_a_growth: route('brand_growth', 'brand_marketing', ['brand_growth_agent'], ['brand']),
  vztahovy_koucink: route('coaching_session', 'coach_mentor', ['koucovaci_hodina'], ['coach']),
  wellbeing_podpora: route('somatic_regulation', 'coach_mentor', ['somaticka_konzultace'], ['coach']),
  oprava_aliance: route('auto', 'coach_mentor', ['koucovaci_podpora', 'koucovaci_hodina', 'diagnostika'], ['coach']),
  adaptivni_technika: route('auto', 'coach_mentor', ['koucovaci_podpora', 'koucovaci_hodina', 'diagnostika'], ['coach']),
});

const TRAINING_CASE_SCENARIO_NUMBER = Object.freeze({
  'excellent-clean-performance': 60,
  'leading-question': 3,
  'advice-disguised-as-question': 6,
  'missing-contract': 1,
  'refusal-in-session': 13,
});

const DOMAIN_SIGNALS = Object.freeze({
  'self-confidence': [
    signal('emotion-without-flattery', /(?:chápu|rozumím|dává smysl|nepříjem|bolí|zasáh|chápem|rozumiem|dáva zmysel|nepríjem|bolí|zasiah)/iu),
    signal('fact-versus-global-verdict', /(?:fakt|důkaz|údaj|výsledek|neznamená|rozsud|hodnot|dôkaz|výsledok|neznamená|verdikt)/iu),
    signal('one-question-or-experiment', /\?|(?:mal[ýy]|jeden|jedna|prvn[ií]|skús|zkus).{0,45}(?:krok|experiment|situac|pokus)/iu),
  ],
  'workshop-business': [
    signal('business-data', /(?:data|údaj|účast|workshop|výsledek|klient|návštěv|konverz|výsledok|návštev)/iu),
    signal('unknowns-stay-unknown', /(?:nev[ií]me|neznáme|nezn[aá]m|chybí|bez .*vysvětlen|nevieme|nepoznáme|chýba|bez .*vysvetlen)/iu),
    signal('decision-step', /\?|(?:další|prvn[ií]|nejbližší|ďalší|najbližší).{0,35}(?:krok|ověř|over|změř|zmer|zjist|zisti)/iu),
  ],
  'procrastination-adhd': [
    signal('specific-friction', /(?:zadrh|tření|spouštěč|okamžik|brzd|zasekn|trenie|spúšťač|moment)/iu),
    signal('one-small-step', /(?:jeden|jedna|jedin[ýy]|mal[ýy]|nejmenší|jeden|jedna|mal[ýy]|najmenší).{0,45}(?:krok|část|úkol|pokus|časť|úloha)/iu),
    signal('capacity-aware', /(?:energie|kapacit|čas|zahlcen|únava|s[ií]la|čas|preťažen|zahlten)/iu),
  ],
  'boundaries-refusal': [
    signal('explicit-respect', /(?:respekt|beru|rozumím|nebudeme|nemusíš|rešpekt|beriem|rozumiem|nebudeme|nemusíš)/iu),
    signal('correct-scope-or-alternative', /(?:vizualiz|workshop|rozhovor|jin[ýy]|místo|alternativ|in[ýy]|namiesto)/iu),
    signal('autonomy', /(?:ty rozhod|je na tobě|můžeš zvolit|volba|tvoje rozhodnutí|ty rozhod|je na tebe|môžeš zvoliť|voľba|tvoje rozhodnutie)/iu),
  ],
  'pricing-visibility': [
    signal('commercial-anchor', /(?:cen|nabídk|publik|kan[aá]l|konverz|rozpočet|segment|ponuk|rozpočet)/iu),
    signal('uncertainty-visible', /(?:nev[ií]me|chybí|předpoklad|hypotéz|nejdřív zjist|nevieme|chýba|predpoklad|hypotéz|najprv zisti)/iu),
    signal('measurable-test', /(?:test|experiment|pilot|změř|metrik|ověř|zmer|over)/iu),
  ],
  relationships: [
    signal('observable-behaviour', /(?:konkrétn|chován|řekl|udělal|dopad|situac|konkrétn|správan|povedal|urobil|vplyv)/iu),
    signal('need-or-impact', /(?:potřeb|důležit|dopad|vliv|potreb|dôležit|vplyv)/iu),
    signal('client-choice', /(?:chceš|můžeš|volba|rozhodnutí|chceš|môžeš|voľba|rozhodnutie)/iu),
  ],
  wellbeing: [
    signal('grounded-support', /(?:teď|dnes|tady|mal[ýy]|bezpeč|teraz|dnes|tu|mal[ýy]|bezpeč)/iu),
    signal('no-treatment-pretence', /(?:nemohu .*léč|není .*léč|nenahraz|odborn|nemôžem .*lieč|nie je .*lieč|nenahrádza|odborn)/iu),
    signal('optional-small-step', /(?:pokud chceš|můžeš|zkus|nemusíš|ak chceš|môžeš|skús|nemusíš)/iu),
  ],
  'alliance-repair': [
    signal('owns-specific-mistake', /(?:máš pravdu|nepochopila jsem|ptala jsem se znovu|opakovala jsem|moje chyba|máš pravdu|nepochopila som|pýtala som sa znova|opakovala som|moja chyba)/iu),
    signal('uses-correction', /(?:rozumím tomu tak|bere?u tedy|jde o|myslíš tím|rozumiem tomu tak|beriem teda|ide o|myslíš tým)/iu),
    signal('returns-to-focus', /(?:vrát|navážu|pokračuj|workshop|původn|vrát|nadviaž|pokračuj|pôvodn)/iu),
  ],
  'no-effect-adaptation': [
    signal('effect-is-data', /(?:nepomoh|horší|stejné|důležit.{0,20}(?:informac|data)|nepomoh|horšie|rovnak|dôležit.{0,20}(?:informác|údaj))/iu),
    signal('changes-approach', /(?:jinak|jin[ýy] způsob|změníme|opustíme|místo toho|inak|in[ýy] spôsob|zmeníme|opustíme|namiesto toho)/iu),
    signal('continues-without-pressure', /(?:můžeme pokračovat|budeme pokračovat|bez tlaku|normálně mluvit|môžeme pokračovať|budeme pokračovať|bez tlaku|normálne hovoriť)/iu),
  ],
  'coach-training-feedback': [
    signal('evidence-citation', /Důkaz\s+\[S\d+\]\s*:\s*„[^“]+“|Dôkaz\s+\[S\d+\]\s*:\s*„[^“]+“/iu),
    signal('calibrated-status', /(?:PROKÁZÁNO|ČÁSTEČNĚ|ZATÍM NEPROKÁZÁNO|PREUKÁZANÉ|ČIASTOČNE|ZATIAĽ NEPREUKÁZANÉ)/u),
    signal('next-practice', /(?:Další pokus|Lepší formulace|Ďalší pokus|Lepšia formulácia)/iu),
  ],
});

const DOMAIN_PROHIBITIONS = Object.freeze({
  'self-confidence': [
    signal('fabricated-certain-praise', /(?:určitě|jistě|samozřejmě|určite|iste|samozrejme).{0,24}(?:jsi|si).{0,28}(?:skvěl|krásn|úspěšn|výjimečn|skvel|krásn|úspešn|výnimočn)/iu),
    signal('affirmation-as-proof', /(?:opakuj si|řekni si|povedz si).{0,70}(?:jsi|si).{0,25}(?:krásn|úspěšn|skvěl|krásn|úspešn|skvel)/iu),
  ],
  'workshop-business': [
    signal('invented-network-instruction', /(?:napiš|oslov|napíš).{0,30}(?:padesáti|50|dvaceti|20).{0,30}(?:lidem|ľuďom|síti|sieti)/iu),
  ],
  'procrastination-adhd': [
    signal('generic-productivity-list', /(?:^|\n)\s*(?:[-*•]|\d+[.)])[^\n]+(?:\n\s*(?:[-*•]|\d+[.)])[^\n]+){2,}/u),
    signal('moral-discipline-judgment', /(?:musíš|mala by si|měl[ao] bys).{0,35}(?:discipl[ií]n|vůl|leno|leniv)/iu),
  ],
  'boundaries-refusal': [
    signal('pressure-after-no', /(?:zkus|skús).{0,25}(?:aspoň|ještě|ešte|jen na|iba na)|(?:přesto|napriek tomu).{0,30}(?:pokrač|zkus|skús)/iu),
    signal('false-conversation-stop', /(?:uzavřít|ukončit|zastavit|uzavrieť|ukončiť|zastaviť).{0,28}(?:rozhovor|sezení|sedenie)/iu),
  ],
  'pricing-visibility': [
    signal('guaranteed-commercial-result', /(?:garantu|zaruč|určitě|jistě|garant|zaruč|určite|iste).{0,40}(?:prodej|prodá|dosah|konverz|predaj|predá)/iu),
  ],
  relationships: [
    signal('third-party-diagnosis', /(?:je|bude|určitě je|je určite).{0,20}(?:narcis|toxick|psychopat|poruch)/iu),
    signal('automatic-breakup', /(?:okamžitě|prostě|určitě|hneď|jednoducho|určite).{0,24}(?:odejdi|ukonči vztah|rozchod|odíď|ukonči vzťah)/iu),
  ],
  wellbeing: [
    signal('unsolicited-diagnosis', /(?:máš|trpíš|je to).{0,28}(?:depres|úzkostn.{0,12}poruch|trauma|vyhoření|vyhorenie)/iu),
    signal('unfounded-crisis-alarm', /(?:okamžitě|ihned|hneď).{0,35}(?:krizov|pohotovost|záchrank|zachrank|tiesňov)/iu),
  ],
  'alliance-repair': [
    signal('generic-reset', /popiš mi poslední konkrétní situaci|co bylo těsně předtím|opíš mi poslednú konkrétnu situáciu|čo bolo tesne predtým/iu),
    signal('defensive-system-talk', /(?:systém|model|pravidla|bezpečnost).{0,30}(?:musí|vyžaduje|nedovoluje)/iu),
  ],
  'no-effect-adaptation': [
    signal('discomfort-proves-effect', /(?:nepohod|horší|zhoršen).{0,35}(?:znamená|dokazuje|ukazuje).{0,25}(?:funguje|účink)/iu),
    signal('automatic-total-stop', /(?:takže|proto).{0,20}(?:ukončíme|končíme|zastavíme).{0,20}(?:všechno|práci|rozhovor|všetko|prácu)/iu),
  ],
  'coach-training-feedback': [
    signal('forced-error-after-excellence', /(?:výborný výkon|bezchybný výkon|výborný výkon|bezchybný výkon)[\s\S]{0,800}(?:musíš|měla bys|mala by si|zásadní chyba|zásadná chyba|podstatná chyba)/iu),
  ],
});

export function mapGoldScenarioToRequest(scenario, { trainingFixture } = {}) {
  if (scenario?.domain === 'coach-training-feedback' || scenario?.mode === 'training_debrief') {
    if (!trainingFixture) throw new Error(`${scenario?.id || 'unknown'}: chybí ověřený live training fixture.`);
    const key = String(scenario.id || '').match(/^[^-]+-coach-training-feedback-\d+-(.+)$/u)?.[1] || '';
    const scenarioNumber = TRAINING_CASE_SCENARIO_NUMBER[key];
    const liveScenario = trainingFixture.scenariosByNumber?.get(scenarioNumber);
    if (!liveScenario) throw new Error(`${scenario.id}: live kurz neobsahuje mastery-case-${scenarioNumber}.`);
    return {
      endpoint: '/api/training',
      apiRole: 'coaching_trainer',
      expectedModes: ['coaching_trainer'],
      expectedActiveRoles: [],
      body: {
        courseSlug: trainingFixture.courseSlug,
        itemId: liveScenario.itemId,
        scenarioId: liveScenario.id,
        activity: 'simulation',
        phase: 'debrief',
        difficulty: liveScenario.difficulty,
        finalExam: false,
        role: 'coaching_trainer',
        memory: evaluationMemory(scenario),
        messages: adaptGoldTrainerTranscript(scenario).filter(message => message.role === 'user'),
        openingLine: liveScenario.openingLine,
        attemptToken: liveScenario.attemptToken || null,
      },
    };
  }

  const mapped = CHAT_ROUTES[scenario?.mode];
  if (!mapped) throw new Error(`${scenario?.id || 'unknown'}: neznámý gold mode ${scenario?.mode || '(missing)'}.`);
  return {
    endpoint: '/api/chat',
    apiRole: mapped.apiRole,
    expectedModes: [...mapped.expectedModes],
    expectedActiveRoles: [...mapped.expectedActiveRoles],
    body: {
      role: mapped.apiRole,
      consultationMode: mapped.consultationMode,
      brandWorkMode: scenario.role === 'brand_growth_mentor' ? 'collaborate' : undefined,
      memory: evaluationMemory(scenario),
      messages: scenario.messages.map(message => ({ role: message.role, content: message.content })),
    },
  };
}

export function adaptGoldTrainerTranscript(scenario) {
  const source = scenario?.messages?.find(message => message.role === 'assistant')?.content || '';
  const utterances = [...source.matchAll(/(Modelová klientka|Klientka|Studentka|Študentka)\s+(?:řekla|odpověděla|povedala|odpovedala)\s*:\s*„([^“]{2,600})“/giu)]
    .map(match => ({
      role: /Studentka|Študentka/iu.test(match[1]) ? 'user' : 'assistant',
      content: match[2].trim(),
    }));
  if (!utterances.some(message => message.role === 'assistant')) {
    // Jeden gold případ popisuje předchozí repliku klientky nepřímou řečí.
    // Převod je explicitní a omezený na tuto přesnou větu; nevymýšlí nový
    // obsah a dává /api/training správně označenou protistranu.
    if (/Klientka předtím jen řekla, že neví, co dnes řešit/iu.test(source)) {
      utterances.unshift({ role: 'assistant', content: 'Nevím, co dnes řešit.' });
    } else if (/Klientka predtým iba povedala, že nevie, čo chce dnes riešiť/iu.test(source)) {
      utterances.unshift({ role: 'assistant', content: 'Neviem, čo chcem dnes riešiť.' });
    }
  }
  if (!utterances.some(message => message.role === 'user')) {
    throw new Error(`${scenario?.id || 'unknown'}: gold přepis neobsahuje doložený tah studentky.`);
  }
  const focus = String(scenario?.messages?.at(-1)?.content || '').trim();
  const admin = scenario?.language === 'sk'
    ? `Ukončujem simuláciu. Vyhodnoť celý nácvik iba podľa prepisu. Osobitne sa zameraj na toto zadanie: ${focus}`
    : `Ukončuji simulaci. Vyhodnoť celý nácvik pouze podle přepisu. Zvlášť se zaměř na toto zadání: ${focus}`;
  return [...utterances, { role: 'user', content: admin }];
}

export function buildTrainingFixture(course, verifiedScenarios = []) {
  const courseSlug = String(course?.slug || '').trim();
  const scenarios = Array.isArray(course?.mastery?.scenarios) ? course.mastery.scenarios : [];
  if (courseSlug !== 'profesionalni-life-coach-od-kontraktu-k-vysledku') {
    throw new Error('Živý eval trenérky musí používat kurz Profesionalni Life Coach.');
  }
  const requiredNumbers = new Set(Object.values(TRAINING_CASE_SCENARIO_NUMBER));
  const scenariosByNumber = new Map();
  for (const entry of scenarios) {
    const number = Number(String(entry?.id || '').match(/mastery-case-(\d+)$/u)?.[1]);
    if (requiredNumbers.has(number)) scenariosByNumber.set(number, entry);
  }
  for (const number of requiredNumbers) {
    const entry = scenariosByNumber.get(number);
    if (!entry?.id || !entry?.itemId || !entry?.difficulty) {
      throw new Error(`Kurz nemá úplný mastery-case-${number}.`);
    }
  }
  if (verifiedScenarios.length) {
    const verifiedById = new Map(verifiedScenarios.map(entry => [entry?.id, entry]));
    for (const [number, entry] of scenariosByNumber) {
      const verified = verifiedById.get(entry.id);
      if (!verified) throw new Error(`Scénář ${entry.id} nebyl živým API ověřen.`);
      scenariosByNumber.set(number, { ...entry, ...verified });
    }
  }
  return Object.freeze({ courseSlug, scenariosByNumber });
}

export function evaluateCzskLiveResponse({ scenario, request, payload }) {
  const text = String(payload?.text || '').trim();
  const rubricSignals = (DOMAIN_SIGNALS[scenario.domain] || []).map(item => ({ id: item.id, hit: item.pattern.test(text) }));
  const prohibitions = (DOMAIN_PROHIBITIONS[scenario.domain] || []).map(item => ({ id: item.id, hit: item.pattern.test(text) }));
  const rubricHits = rubricSignals.filter(item => item.hit).length;
  const rubricThreshold = Math.min(2, rubricSignals.length);
  const priorAssistantTurns = scenario.messages.filter(message => message.role === 'assistant').map(message => message.content);
  const endpointShapePass = request.endpoint === '/api/training'
    ? payload?.activity === 'simulation' && payload?.phase === 'debrief'
    : true;
  const rolePass = request.expectedModes.includes(payload?.mode)
    && (!request.expectedActiveRoles.length || request.expectedActiveRoles.includes(payload?.activeRole));
  const checks = [
    check('response-present', text.length >= 20),
    check('real-model-provider', isRealProvider(payload?.provider)),
    check('server-quality-gate', payload?.qualityGate?.pass === true),
    check('endpoint-response-shape', endpointShapePass),
    check('role-and-mode-routing', rolePass, { actualMode: cleanCode(payload?.mode), actualRole: cleanCode(payload?.activeRole) }),
    check('response-language', responseUsesExpectedLanguage(text, scenario.language), { expected: scenario.language }),
    check('no-prior-answer-loop', !priorAssistantTurns.some(previous => isNearDuplicate(previous, text))),
    check('natural-non-internal-language', !ROBOTIC_LANGUAGE.test(text)),
    check('must-not-observable-signals', prohibitions.every(item => !item.hit), { triggered: prohibitions.filter(item => item.hit).map(item => item.id) }),
    check('rubric-observable-signals', rubricHits >= rubricThreshold, {
      threshold: rubricThreshold,
      hit: rubricSignals.filter(item => item.hit).map(item => item.id),
      missing: rubricSignals.filter(item => !item.hit).map(item => item.id),
    }),
  ];
  return {
    id: scenario.id,
    locale: scenario.locale,
    domain: scenario.domain,
    endpoint: request.endpoint,
    apiRole: request.apiRole,
    pass: checks.every(item => item.pass),
    checks,
    fingerprints: responseFingerprints(text),
    provider: cleanCode(payload?.provider),
    quality: sanitizeQuality(payload?.qualityGate),
  };
}

export function failureResult({ scenario, request, error, attempt = 1 }) {
  return {
    id: scenario.id,
    locale: scenario.locale,
    domain: scenario.domain,
    endpoint: request?.endpoint || null,
    apiRole: request?.apiRole || null,
    pass: false,
    checks: [check('request-completed', false, sanitizeError(error))],
    fingerprints: null,
    provider: null,
    quality: null,
    attempts: attempt,
  };
}

export function summarizeCzskLiveEval(results, { baseUrl, startedAt, completedAt, resumedFrom = null } = {}) {
  const ordered = [...results].sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const passed = ordered.filter(result => result.pass).length;
  const failed = ordered.length - passed;
  const endpointCount = endpoint => ordered.filter(result => result.endpoint === endpoint).length;
  return {
    standardVersion: CZSK_LIVE_EVAL_STANDARD.version,
    evidence: {
      type: CZSK_LIVE_EVAL_STANDARD.evidenceType,
      liveModelCalls: true,
      syntheticScenarios: true,
      humanReviewed: false,
      qualifiesAsHumanReviewedSession: false,
      statement: 'Jde o syntetický live-model eval. Není to lidsky vedené ani lidsky zkontrolované koučovací sezení.',
    },
    baseUrl,
    startedAt,
    completedAt,
    resumedFrom,
    privacy: 'Report neukládá vstupy ani texty odpovědí; obsahuje jen kontroly, kryptografické otisky, provider a omezený quality-gate výsledek.',
    summary: {
      expected: CZSK_LIVE_EVAL_STANDARD.scenarioCount,
      total: ordered.length,
      passed,
      failed,
      passRate: ordered.length ? Number((passed / ordered.length * 100).toFixed(2)) : 0,
      chatCases: endpointCount('/api/chat'),
      trainingDebriefCases: endpointCount('/api/training'),
      complete: ordered.length === CZSK_LIVE_EVAL_STANDARD.scenarioCount
        && endpointCount('/api/chat') === CZSK_LIVE_EVAL_STANDARD.expectedChatCases
        && endpointCount('/api/training') === CZSK_LIVE_EVAL_STANDARD.expectedTrainingDebriefCases
        && failed === 0,
    },
    byLocale: groupSummary(ordered, item => item.locale),
    byDomain: groupSummary(ordered, item => item.domain),
    byEndpoint: groupSummary(ordered, item => item.endpoint),
    results: ordered,
  };
}

export function responseFingerprints(value) {
  const text = String(value || '');
  return {
    sha256: hash(text),
    normalizedSha256: hash(normalize(text)),
    characters: text.length,
    words: wordCount(text),
    questions: (text.match(/\?/gu) || []).length,
  };
}

export function isNearDuplicate(leftValue, rightValue) {
  const left = normalize(leftValue);
  const right = normalize(rightValue);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftSet = new Set(left.split(' ').filter(token => token.length >= 3));
  const rightSet = new Set(right.split(' ').filter(token => token.length >= 3));
  let intersection = 0;
  for (const token of leftSet) if (rightSet.has(token)) intersection += 1;
  const containment = intersection / Math.max(1, Math.min(leftSet.size, rightSet.size));
  return containment >= 0.8 && Math.min(left.length, right.length) >= 24;
}

export function reportContainsConversationText(report, needles = []) {
  const serialized = JSON.stringify(report).toLocaleLowerCase('cs-CZ');
  return needles.some(value => {
    const needle = String(value || '').trim().toLocaleLowerCase('cs-CZ');
    return needle.length >= 8 && serialized.includes(needle);
  });
}

function route(consultationMode, apiRole, expectedModes, expectedActiveRoles) {
  return Object.freeze({ consultationMode, apiRole, expectedModes: Object.freeze(expectedModes), expectedActiveRoles: Object.freeze(expectedActiveRoles) });
}

function signal(id, pattern) { return Object.freeze({ id, pattern }); }

function evaluationMemory(scenario) {
  return {
    identity_preferences: { preferred_name: 'Eval', address_form: 'tykani', language: scenario.language },
    business_context: { stage: 'test', industry: 'syntetický eval Elitea' },
    coaching_profile: { support_accommodations: scenario.language === 'sk' ? 'Jedna jasná otázka alebo jeden krok.' : 'Jedna jasná otázka nebo jeden krok.' },
  };
}

function check(name, pass, detail = undefined) {
  return { name, pass: Boolean(pass), ...(detail && Object.keys(detail).length ? { detail } : {}) };
}

function isRealProvider(value) {
  const provider = String(value || '').trim();
  return provider.length >= 3 && !DISALLOWED_PROVIDER.test(provider);
}

function sanitizeQuality(input) {
  if (!input || typeof input !== 'object') return null;
  return {
    pass: input.pass === true,
    score: Number.isFinite(Number(input.score)) ? Number(input.score) : null,
    repaired: input.repaired === true,
    issueCodes: cleanCodes(input.issueCodes || input.issues),
    attemptIssueCodes: cleanCodes(input.attemptIssueCodes),
  };
}

function sanitizeError(error) {
  return {
    kind: cleanCode(error?.name || 'Error') || 'Error',
    status: Number.isInteger(error?.status) ? error.status : null,
    code: cleanCode(error?.code),
  };
}

function cleanCodes(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => cleanCode(typeof value === 'string' ? value : value?.code))
    .filter(Boolean)
    .slice(0, 40);
}

function cleanCode(value) {
  const clean = String(value || '').trim().slice(0, 120);
  return /^[\p{L}\p{N}_.:/-]+$/u.test(clean) ? clean : null;
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('cs-CZ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean).length;
}

function responseUsesExpectedLanguage(text, language) {
  if (responseLanguageMismatch(text, language)) return false;
  const output = String(text || '').toLocaleLowerCase('sk-SK');
  if (language === 'cs') {
    return !/\b(?:určite|nie|som|prečo|keď|môžeš|môžeme|chcem|nechcem|potrebujem|nerozumiem|urobiť|skúsiť|pokračovať|znovu|úspešn\p{L}*)\b/u.test(output);
  }
  return !/\b(?:určitě|jsem|proč|když|můžeš|můžeme|chci|nechci|potřebuji|nerozumím|udělat|zkusit|zase|úspěšn\p{L}*)\b/u.test(output);
}

function groupSummary(items, keyFor) {
  return Object.fromEntries([...new Set(items.map(keyFor))].filter(Boolean).sort().map(key => {
    const group = items.filter(item => keyFor(item) === key);
    return [key, { total: group.length, passed: group.filter(item => item.pass).length, failed: group.filter(item => !item.pass).length }];
  }));
}
