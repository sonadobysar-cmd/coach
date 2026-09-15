import {
  isTechniqueEffectCheck,
  startsTechniqueIntervention,
} from './technique-session.js';
import {
  requestsFactsOnly,
  requestsOneShortQuestion,
} from './conversation-repair-intent.js';
import {
  detectConversationLanguage,
  languageInstruction,
  responseLanguageMismatch,
} from './language-profile.js';

export { requestsFactsOnly, requestsOneShortQuestion };

const ACKNOWLEDGEMENT = /^(?:(?:asi\s+)?(?:ano|áno|jo|jasně|jasne|dobře|dobre|ok|souhlasím|souhlasim|súhlasím|suhlasim|můžeme|muzeme|môžeme|mozeme|zkusme|skúsme|skusme|nevím|nevim|neviem))[.!\s]*$/iu;
const STOPWORDS = new Set([
  'aby', 'ale', 'ani', 'ano', 'asi', 'bez', 'bude', 'byla', 'bylo', 'bych', 'bys', 'co', 'coz',
  'dalsi', 'dnes', 'do', 'ho', 'jak', 'jako', 'jsem', 'jsi', 'jsme', 'kdy', 'kdyz', 'ktera',
  'ktere', 'ktery', 'ma', 'mam', 'mas', 'me', 'mi', 'mit', 'mne', 'moc', 'muze', 'muzes',
  'na', 'nad', 'ne', 'nebo', 'neco', 'neni', 'nez', 'nic', 'od', 'pak', 'po', 'pod', 'podle',
  'pokud', 'potom', 'pro', 'proc', 'proto', 'protoze', 'pred', 'pri', 'se', 'si', 'tak', 'tam',
  'te', 'ted', 'ten', 'tento', 'to', 'tohle', 'tom', 'tvoje', 'tvuj', 'ty', 'uz', 've', 'vse',
  'zase', 'ze', 'zde', 'zpet', 'mela', 'mel', 'chci', 'potrebuji', 'prosim', 'treba',
  'som', 'sme', 'ste', 'co', 'ako', 'ked', 'preco', 'teraz', 'dalej', 'toto', 'tamto',
  'moja', 'moje', 'moj', 'tvoja', 'tvoje', 'tvoj', 'svoja', 'svoje', 'svoj', 'chcem',
  'potrebujem', 'prosim', 'bolo', 'bola', 'budem', 'mozem', 'mozes', 'viem',
]);

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stem(token) {
  const normalized = normalize(token).replace(/[^a-z0-9]/g, '');
  if (normalized.length <= 3) return normalized;
  // Negation changes the meaning of the whole coaching turn. In particular,
  // "chci pokračovat" and "nechci pokračovat" must never collapse to the
  // same semantic fingerprint when we detect loops or ignored boundaries.
  return normalized
    .replace(/(?:ami|emi|ove|ova|ovy|eni|ani|ace|aci|ost|ech|ich|ych|ou|em|om|im|am|is|as|es|at|it|et|la|li|ly|lo|na|ni|ny|no|uje|uji|oval|ovat|eni|y|a|u|i|e|o)$/u, '')
    .slice(0, 8);
}

function contentStems(value) {
  return new Set(normalize(value)
    .split(/[^a-z0-9]+/u)
    .filter(token => token.length >= 4 && !STOPWORDS.has(token))
    .map(stem)
    .filter(token => token.length >= 3));
}

function isSubstantive(value) {
  const text = String(value || '').trim();
  return text.length >= 10 && !ACKNOWLEDGEMENT.test(text);
}

const FACT_ONLY_META_STEMS = contentStems([
  'víme nevíme fakta informace zatím jen pouze',
  'uvedla popsala řekla zmínila chybí neznáme není jasné',
  'podle tebe ty sama hodnotíš počet reakce jejich další údaj',
  'bez domýšlení ověřené doložené jisté nejisté',
].join(' '));

function reportsUnexplainedThirdPartyDeparture(userTexts = [], responseText = '') {
  const texts = userTexts.map(normalize).filter(Boolean);
  const latest = texts.at(-1) || '';
  const departurePattern = /\b(?:odesel|odesla|odesli|odisiel|odisla|odisli|odchod\w*|opustil\w*|odpojil\w*\s+(?:se|sa)|ukoncil\w*\s+ucast|nezustal\w*|nezostal\w*)\b/u;
  const latestReferencesDeparture = departurePattern.test(latest);
  const latestIsOwnDeparture = /\b(?:ja\s+)?(?:jsem|som)\b[^.!?\n]{0,35}\b(?:odesel|odesla|odisiel|odisla|opustil\w*)\b/u.test(latest)
    || /\b(?:odesel|odesla|odisiel|odisla|opustil\w*)\s+(?:jsem|som)\b/u.test(latest);
  // Neznámý odchod je nutné výslovně ponechat otevřený při tahu, který ho
  // právě přináší nebo znovu tematizuje. Nesmí ale kontaminovat každou další
  // odpověď v dlouhém sezení poté, co se klientka přesunula k jinému tématu.
  if (!latestReferencesDeparture || latestIsOwnDeparture) return false;

  // Výslovná nejistota v aktuálním tahu má přednost před jakýmkoli starším
  // odchodem. Jinak by se například známý důvod odchodu Anny neprávem
  // přenesl na pozdější, nevysvětlený odchod Lucie.
  const explicitlyUnknownReason = /\b(?:nevim|nevime|neviem|nevieme|neznam|nezname|nepoznam|nepozname)\b[^.!?\n]{0,55}\b(?:proc\s+(?:odes|opust)|preco\s+(?:odis|opust)|duvod|dovod|pricin)\w*\b/u.test(latest)
    || /\b(?:duvod|dovod|pricina)\w*\b[^.!?\n]{0,45}\b(?:(?:neni|nie je)\s+(?:zatim|zatial)?\s*znam|(?:zustava|zostava)\s+neznam|neznam)\w*\b/u.test(latest)
    || /\b(?:proc\s+(?:odes|opust)|preco\s+(?:odis|opust)|duvod|dovod|pricin)\w*\b[^.!?\n]{0,55}\b(?:nevim|nevime|neviem|nevieme|neznam|nezname|nepoznam|nepozname)\b/u.test(latest);
  const departureClauseSplitter = /[.!?;]+|,\s*(?=[^,.!?;]{0,55}\b(?:odesel|odesla|odesli|odisiel|odisla|odisli|opustil\w*))|\s+(?:ale|avsak|vsak|zatimco)\s+|\s+a\s+(?=[^.!?;]{0,55}\b(?:odesel|odesla|odesli|odisiel|odisla|odisli|opustil\w*))/u;
  const departureClauses = latest
    .split(departureClauseSplitter)
    .map(clause => clause.trim())
    .filter(clause => departurePattern.test(clause));
  const clauseHasKnownReason = clause => (
    /\b(?:odesel|odesla|odesli|odisiel|odisla|odisli|opustil\w*)\b[^.!?\n]{0,90}\b(?:protoze|jelikoz|kvuli|z duvodu|pretoze|kedze|lebo|kvoli|z dovodu)\b/u.test(clause)
    || /\b(?:protoze|jelikoz|kvuli|z duvodu|pretoze|kedze|lebo|kvoli|z dovodu)\b[^.!?\n]{0,90}\b(?:odesel|odesla|odesli|odisiel|odisla|odisli|opustil\w*)\b/u.test(clause)
    || /\b(?:duvod|dovod|pricina)\w*\b[^.!?\n]{0,45}\b(?:byl|byla|bol|bola|je)\b(?!\s+(?:neznam|nejasn))/u.test(clause)
    || /\b(?:rekla|rekl|povedala|povedal|vysvetlila|vysvetlil)\b[^.!?\n]{0,60}\b(?:proc\s+odes|preco\s+odis|ze\s+(?:musi|musela|musel|chtela|chtel|chcela|chcel))\b/u.test(clause)
  );
  const knownReason = !explicitlyUnknownReason
    && departureClauses.length > 0
    && departureClauses.every(clauseHasKnownReason);
  if (knownReason) return false;

  const response = normalize(responseText);
  const userAsksForReason = /\b(?:proc|duvod|pricin)\w*\b[^.!?\n]{0,70}\b(?:odes|odchod|opust|nezust)\w*|\b(?:odes|odchod|opust|nezust)\w*\b[^.!?\n]{0,70}\b(?:proc|duvod|pricin)\w*/u.test(latest);
  const responseUsesDeparture = departurePattern.test(response);
  const responseInterpretsDeparture = /\b(?:znamena|ukazuje|dokazuje|signalizuje|potvrzuje|zrejme|urcite|asi|proto|kvuli)\b/u.test(response)
    && /\b(?:ucastnic|klient|zakazn|koleg|zamestnan|workshop|seminar|setkan|akce|publik)\w*\b/u.test(response);
  const latestHasDifferentPracticalRequest = /\?|\b(?:potrebuji|potrebujem|chci|chcem|pomoz|napis|sestav|vytvor|priprav|nabidnout|ponuknut|co dal|co dalej|jak mam|ako mam)\b/u.test(latest);
  const bareDepartureReport = !latestHasDifferentPracticalRequest;

  // Když odchod pouze vysvětluje, proč členka potřebuje jiný praktický výstup
  // (např. inzerát), není jeho příčina součástí aktuální zakázky. Nejistotu
  // vynucujeme jen tehdy, když se odpověď k odchodu sama vrací, vykládá ho,
  // nebo se klientka přímo ptá na jeho důvod.
  return userAsksForReason || responseUsesDeparture || responseInterpretsDeparture || bareDepartureReport;
}

function explicitlyPreservesDepartureUncertainty(text) {
  const normalized = normalize(text);
  return /\b(?:nevime|nevim|nevis|nevieme|neviem|nevies|nezname|nepozname|neni\s+(?:zatim\s+)?jasne|nie je\s+(?:zatial\s+)?jasne|nelze\s+(?:zatim\s+)?(?:vedet|urcit)|nemuzeme\s+(?:zatim\s+)?(?:vedet|urcit)|nemozeme\s+(?:zatial\s+)?(?:vediet|urcit))\b[^.!?\n]{0,90}\b(?:proc|preco|duvod|dovod|pricin|odchod|odes|odis)\w*/u.test(normalized)
    || /\b(?:proc|preco|duvod|dovod|pricin|odchod|odes|odis)\w*\b[^.!?\n]{0,90}\b(?:nevime|nevim|nevis|nevieme|neviem|nevies|nezname|nepozname|neni\s+(?:zatim\s+)?jasn|nie je\s+(?:zatial\s+)?jasn|nelze\s+(?:zatim\s+)?(?:vedet|urcit)|nemozeme\s+(?:zatial\s+)?(?:vediet|urcit))\b/u.test(normalized)
    || /\bbez\s+(?:jejiho|jeho|dalsiho|jej|dalsieho)?\s*(?:vysvetleni|zduvodneni|vysvetlenia|odovodnenia)\b/u.test(normalized)
    || /\bneznam\w*\s+(?:duvod|dovod|pricina)|(?:duvod|dovod|pricina)\s+(?:(?:zustava|zostava)\s+)?neznam\w*/u.test(normalized);
}

function unsupportedFactOnlyDetail(text, evidence) {
  const normalized = normalize(text);
  const userEvidence = normalize((evidence?.recentUserEvidence || []).join(' '));
  const quantityPattern = /\b(?:\d+(?:[,.]\d+)?|nula|jeden|jedna|jedno|dva|dve|tri|ctyri|pet|sest|sedm|osm|devet|deset|desitky|stovky|polovina|ctvrtina)\b/gu;
  const outputQuantities = new Set(normalized.match(quantityPattern) || []);
  const evidenceQuantities = new Set(userEvidence.match(quantityPattern) || []);
  const inventedQuantity = [...outputQuantities].find(quantity => !evidenceQuantities.has(quantity));
  if (inventedQuantity) return `quantity:${inventedQuantity}`;

  const mentalClaimChecks = [
    { output: /\bcit\w*\b/u, evidence: /\bcit\w*\b/u },
    { output: /\bboj\w*\s+se\b/u, evidence: /\bboj\w*\b/u },
    { output: /\bobav\w*\s+se\b/u, evidence: /\bobav\w*\b/u },
    { output: /\bstyd\w*\s+se\b/u, evidence: /\bstyd\w*\b/u },
    { output: /\bjsi\s+(?:zklaman\w*|frustrovan\w*|nejist\w*|nervozn\w*|zahlcen\w*|zranen\w*|nastvan\w*|smutn\w*)\b/u, evidence: /\b(?:zklaman|frustr|nejist|nervoz|zahlcen|zranen|nastvan|smut)\w*\b/u },
    { output: /\bmas\s+(?:strach|pocit|obav\w*|vztek|stud|uzkost)\b/u, evidence: /\b(?:strach|pocit|obav|vztek|stud|uzkost)\w*\b/u },
    { output: /\b(?:snaz\w*\s+se|vyhyb\w*\s+se|chces|potrebujes)\b/u, evidence: /\b(?:snaz|vyhyb|chc|potreb)\w*\b/u },
  ];
  const unsupportedMentalClaim = mentalClaimChecks
    .map(({ output: outputPattern, evidence: evidencePattern }) => ({
      match: normalized.match(outputPattern)?.[0] || null,
      supported: evidencePattern.test(userEvidence),
    }))
    .find(check => check.match && !check.supported)?.match;
  if (unsupportedMentalClaim) return `mental-state:${unsupportedMentalClaim}`;

  const declarativeSentences = (String(text || '').match(/[^.!?\n]+[.!?]?/gu) || [])
    .filter(sentence => !sentence.trim().endsWith('?'))
  const unsupportedInference = declarativeSentences.find(sentence => {
    const normalizedSentence = normalize(sentence).replace(/\s+/gu, ' ').trim();
    if (!/\b(?:(?:to|coz)\s+(?:potvrzuje|ukazuje|dokazuje|znamena|signalizuje)|protoze|z\s+toho\s+plyne)\b/u.test(normalizedSentence)) return false;
    return !userEvidence.includes(normalizedSentence.replace(/[.!]+$/u, ''));
  });
  if (unsupportedInference) return 'unsupported-inference';

  const declarativeText = declarativeSentences.join(' ');
  const declarativeStems = [...contentStems(declarativeText)];
  const evidenceStems = contentStems((evidence?.recentUserEvidence || []).join(' '));
  const unsupported = declarativeStems.filter(token => !evidenceStems.has(token) && !FACT_ONLY_META_STEMS.has(token));
  const supported = declarativeStems.filter(token => evidenceStems.has(token));
  if (unsupported.length >= 2 && unsupported.length > supported.length) {
    return `unsupported-stems:${unsupported.slice(0, 4).join(',')}`;
  }
  return null;
}

function hasUnsupportedPerformanceVerdict(text, userEvidenceTexts = []) {
  const evidenceItems = (Array.isArray(userEvidenceTexts) ? userEvidenceTexts : [userEvidenceTexts])
    .map(normalize)
    .filter(Boolean);
  const evidence = evidenceItems.join(' ');
  const output = normalize(text);
  const hasReportedQuantity = /\b(?:\d+(?:[,.]\d+)?|nula|jeden|jedna|jedno|dva|dve|tri|ctyri|pet|sest|sedm|osm|devet|deset|malo|hodne|polovina|ctvrtina)\b/u.test(evidence);
  if (!hasReportedQuantity) return false;

  const verdictSentences = (output.match(/[^.!?\n]+[.!?]?/gu) || []).filter(sentence => (
    /\b(?:je|jsou|byl|byla|bylo|predstavuje|znamena|dopadl|dopadla)\b[^.!?\n]{0,45}\b(?:slab|spatn|neuspes|mizern|nedostatec|nizk|malo)\w*\b/u.test(sentence)
    || /\b(?:slab|spatn|neuspes|mizern|nedostatec|nizk)\w*\b[^.!?\n]{0,45}\b(?:vysledek|ucast|vykon|prodej|zajem|konverz)\w*\b/u.test(sentence)
  ));
  const quantity = '(?:\\d+(?:[,.]\\d+)?|nula|jeden|jedna|jedno|dva|dve|tri|ctyri|pet|sest|sedm|osm|devet|deset|desitky|stovky|polovina|ctvrtina)';
  const benchmark = '(?:cil|plan|ocekav|kapacit|benchmark|prumer|minimum|maximum|maximal|limit)\\w*';
  const benchmarkShape = new RegExp(`\\b${benchmark}\\b[^.!?\\n]{0,55}\\b${quantity}\\b|\\b${quantity}\\b[^.!?\\n]{0,55}\\b${benchmark}\\b`, 'u');
  const metricGroups = [
    /\b(?:ucast|registr|prihlas|lid|zen|osob|mist|navstev)\w*\b/u,
    /\b(?:prodej|proda|objednav|zakaz|klient|trzb|obrat|kus|konverz)\w*\b/u,
    /\b(?:dosah|zhl[eé]dn|klik|reakc|sleduj)\w*\b/u,
  ];

  return verdictSentences.some(sentence => {
    if (/\b(?:muze|mohlo|mohla|mozna|pokud|jestli|podle tebe|ty (?:to )?hodnotis|bez (?:znameho )?(?:cile|planu|benchmarku)|nezname (?:cil|plan)|nelze (?:to )?hodnotit)\b/u.test(sentence)) {
      return false;
    }
    const relevantGroups = metricGroups.filter(pattern => pattern.test(sentence));
    const hasRelevantBenchmark = evidenceItems.some(item => (
      benchmarkShape.test(item)
      && (relevantGroups.length === 0 || relevantGroups.some(pattern => pattern.test(item)))
    ));
    return !hasRelevantBenchmark;
  });
}

export function extractSessionEvidence(messages = []) {
  const safe = Array.isArray(messages) ? messages : [];
  const userTexts = safe
    .filter(message => message?.role === 'user')
    .map(message => String(message.content || '').trim())
    .filter(Boolean);
  const substantive = userTexts.filter(isSubstantive);
  const latestSubstantiveUserText = substantive.at(-1) || userTexts.at(-1) || '';
  const recentUserEvidence = substantive.slice(-5).map(text => text.slice(0, 500));
  const lastAssistantText = [...safe]
    .reverse()
    .find(message => message?.role === 'assistant')?.content || '';
  const lastAssistantQuestion = String(lastAssistantText).match(/[^?\n]{3,}\?/gu)?.at(-1)?.trim() || null;
  const corrections = substantive
    .filter(text => /\b(?:nem[aá]m|neum[ií]m|nen[ií]|to nen[ií] pravda|jak m[uů]žeš vědět|to jsem neřekla|to sis domyslel)\b/iu.test(text))
    .slice(-3)
    .map(text => text.slice(0, 360));
  const anchorStems = [...new Set(recentUserEvidence.flatMap(text => [...contentStems(text)]))].slice(-24);

  return {
    latestSubstantiveUserText: latestSubstantiveUserText.slice(0, 700),
    recentUserEvidence,
    lastAssistantQuestion,
    corrections,
    anchorStems,
  };
}

function hasGrounding(text, evidence) {
  const responseStems = contentStems(text);
  if (!responseStems.size || !evidence?.anchorStems?.length) return false;
  return evidence.anchorStems.some(anchor => responseStems.has(anchor));
}

function groundingCount(text, evidence) {
  const responseStems = contentStems(text);
  if (!responseStems.size || !evidence?.anchorStems?.length) return 0;
  return evidence.anchorStems.filter(anchor => responseStems.has(anchor)).length;
}

function stemSimilarity(left, right) {
  const leftStems = contentStems(left);
  const rightStems = contentStems(right);
  if (leftStems.size < 2 || rightStems.size < 2) return 0;
  const intersection = [...leftStems].filter(value => rightStems.has(value)).length;
  const union = new Set([...leftStems, ...rightStems]).size;
  const jaccard = union ? intersection / union : 0;
  const overlap = intersection / Math.min(leftStems.size, rightStems.size);
  return Math.max(jaccard, overlap);
}

export function assessCoachingResponse(text, {
  messages = [],
  conversationContext = {},
  responseMode = 'diagnostika',
  techniqueTurn = null,
  closingRequested = false,
  requireQuestion = true,
} = {}) {
  const output = String(text || '').trim();
  const evidence = extractSessionEvidence(messages);
  const issues = [];
  const questionCount = (output.match(/\?/g) || []).length;
  const normalized = normalize(output);
  const isBrandGrowth = responseMode === 'brand_growth_agent';
  const isBusinessMentoring = ['mentoring', 'mentoringova_konzultace'].includes(responseMode);
  const isBusinessRole = isBrandGrowth || isBusinessMentoring;
  const latestUserText = String([...messages].reverse().find(message => message?.role === 'user')?.content || '').trim();
  const normalizedLatestUserText = normalize(latestUserText).replace(/\s+/g, ' ').trim();
  const firstUserTurn = Number(conversationContext.userTurns || 0) <= 1;
  const outputWordCount = output.split(/\s+/u).filter(Boolean).length;
  const responseLanguage = conversationContext.responseLanguage || detectConversationLanguage(messages);
  const explicitlyRequestsFactsOnly = requestsFactsOnly(latestUserText);
  const explicitlyRequestsOneShortQuestion = requestsOneShortQuestion(latestUserText);
  const asksForHumanLanguage = /\b(?:mluv|rekni|povedz|vysvetli)\b[^.!?]{0,45}\b(?:clovek|lidsk|normaln|jednodus)|\b(?:nerozumim|nerozumiem|nechapu|nechapem|moc slozit|co tim myslis|co tym myslis|nepochopil|nepochopila|meles nesmysly|trepes nezmysly|jak jsme se (?:sem )?dostal\w*|opakujes)\b/u.test(normalizedLatestUserText);
  const assistantAssertions = normalized.replace(/[„“"][^„“"]+[„“"]/gu, ' ');
  const userEvidenceText = normalize((evidence.recentUserEvidence || []).join(' '));
  const emotionFamilies = [
    { label: 'bolest', pattern: /\b(?:bolest\w*|boli)\b/u },
    { label: 'smutek', pattern: /\bsmut(?:ek|ku|kem|n\w*)\b/u },
    { label: 'vztek', pattern: /\b(?:vztek|zlost|nastvan)\w*\b/u },
    { label: 'strach', pattern: /\b(?:strach|obav)\w*\b|\bboj(?:im|is|i|ime|ite)\s+se\b/u },
    { label: 'stud', pattern: /\b(?:stud|studu|studem|styd\w*)\b/u },
    { label: 'vina', pattern: /\b(?:vina|viny|vinu|vinou|vinna|vinny|vinne)\b/u },
    { label: 'bezmoc', pattern: /\bbezmoc\w*\b/u },
    { label: 'frustrace', pattern: /\bfrustr\w*\b/u },
    { label: 'úzkost', pattern: /\buzkost\w*\b/u },
    { label: 'radost', pattern: /\bradost\w*\b/u },
    { label: 'zklamání', pattern: /\bzklaman\w*\b/u },
    { label: 'napětí', pattern: /\bnapeti\w*\b/u },
  ];
  const inventedEmotion = emotionFamilies.find(({ pattern }) => {
    const assertedMatch = assistantAssertions.match(pattern);
    if (!assertedMatch || pattern.test(userEvidenceText)) return false;
    const position = assertedMatch.index || 0;
    const localContext = assistantAssertions.slice(Math.max(0, position - 70), position + assertedMatch[0].length + 20);
    // Obecná, podmíněná informace není tvrzení o vnitřním stavu členky.
    // „Může se objevit při napětí“ je bezpečné; „je v tom hodně bolesti“ je podsunutá emoce.
    return !/\b(?:muze|mohlo|mohla|nekdy|obecne|napriklad|jednou z moznosti)\b/u.test(localContext);
  });
  const relationshipRoles = [
    { name: 'partner', pattern: /\bpartner(?:a|ovi|em|ka|ky|ce|kou)?\b/u },
    { name: 'manžel', pattern: /\bmanzel(?:a|ovi|em|ka|ky|ce|kou)?\b/u },
    { name: 'přítel', pattern: /\bpritel(?:e|i|em|ky|kyni)?\b|\bpritelkyn(?:e|i|ou)?\b/u },
  ];
  const inventedRelationshipRole = relationshipRoles.find(({ pattern }) => (
    pattern.test(assistantAssertions) && !pattern.test(userEvidenceText)
  ));
  const proceduralPhase = techniqueTurn?.suspended !== true
    && ['consent', 'evaluation', 'stopped'].includes(techniqueTurn?.session?.phase);
  const techniquePhase = techniqueTurn?.suspended === true ? null : techniqueTurn?.session?.phase;
  const normalizedLastQuestion = normalize(evidence.lastAssistantQuestion || '').replace(/[^a-z0-9]+/g, ' ').trim();
  const currentQuestion = String(output).match(/[^?\n]{3,}\?/gu)?.at(-1) || '';
  const normalizedCurrentQuestion = normalize(currentQuestion).replace(/[^a-z0-9]+/g, ' ').trim();
  const acknowledgesCorrection = evidence.corrections.length > 0
    && /\b(?:nevedel|nevedela|nemel jsem|nemela jsem|domnenk|pripsat|omlouvam|moje chyba)\b/u.test(normalized);
  const professionalCase = conversationContext.professionalCase || {};
  const personalizedContentRequested = professionalCase.requestedDeliverable === 'personalized_content_output';
  const healthImpactPatterns = [
    /\b(?:spanek|spanok|spanku|spat|nespim|nespi)\b/u,
    /\b(?:jidlo|jedlo|jidla|jedla|jist|jest|nejim|chut k jidlu|chut do jedla)\b/u,
    /\b(?:energie|energia|vycerpan|unav)\w*\b/u,
    /\b(?:fungovan|fungovanie|fungovat|fungovat|nefungu)\w*\b/u,
    /\b(?:zdravot|pretez|bezneho zivota|kazdodenniho zivota)\w*\b/u,
  ];
  const healthQuestionText = normalize((String(output).match(/[^?]+\?/gu) || []).join(' '));
  const healthScreenDimensions = healthImpactPatterns.filter(pattern => pattern.test(healthQuestionText)).length;
  const healthOutputDimensions = healthImpactPatterns.filter(pattern => pattern.test(normalized)).length;
  const explicitHealthQuestion = /\b(?:spanek|spanok|spanku|spat|nespim|nespi|jidlo|jedlo|jidla|jedla|jist|jest|nejim|chut k jidlu|chut do jedla)\b|\b(?:zdravot|pretez|vycerpan)\w*\b|\bunav(?:a|en\w*)\b/u.test(healthQuestionText);
  const personalEnergyOrFunctioning = /\b(?:tv\w*|vas\w*|moj\w*)\b[^?\n]{0,24}\b(?:energ|fungovan|fungovat|nefungu)\w*\b/u.test(healthQuestionText)
    || /\b(?:energ|fungovan|fungovat|nefungu)\w*\b[^?\n]{0,24}\b(?:tobe|tebe|vas|mne|me)\b/u.test(healthQuestionText);
  const framedAsHealthImpact = personalEnergyOrFunctioning
    && (/\b(?:ovlivn|promit|projev|zasah|naru\w*|zhors|dopad)\w*\b[^?\n]{0,90}\b(?:energ|fungovan|fungovat|nefungu)\w*\b/u.test(healthQuestionText)
      || /\b(?:energ|fungovan|fungovat|nefungu)\w*\b[^?\n]{0,90}\b(?:ovlivn|promit|projev|zasah|naru\w*|zhors|dopad)\w*\b/u.test(healthQuestionText))
    || /\b(?:bezne|kazdodenni)\w*\b[^?\n]{0,30}\bfungovan\w*\b/u.test(healthQuestionText)
    || /\bschopnost\w*\b[^?\n]{0,30}\b(?:normalne\s+)?fungovat\w*\b/u.test(healthQuestionText);
  const directsHealthCheck = /\b(?:zkontroluj|skontroluj|sleduj|odmer|zmer|hlidej|strav|zapis)\w*\b[^.!?\n]{0,100}\b(?:span|jid|jedl|energ|fungovan|zdravot|vycerpan|unav)\w*\b/u.test(normalized)
    || /\b(?:span|jid|jedl|energ|fungovan|zdravot|vycerpan|unav)\w*\b[^.!?\n]{0,100}\b(?:zkontroluj|skontroluj|sleduj|odmer|zmer|hlidej|strav|zapis)\w*\b/u.test(normalized);
  const unsolicitedHealthScreen = healthScreenDimensions >= 2 || explicitHealthQuestion || framedAsHealthImpact || (directsHealthCheck && healthOutputDimensions >= 1);
  const userRaisedHealthImpact = healthImpactPatterns.some(pattern => pattern.test(userEvidenceText));
  const previousAssistantTexts = (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'assistant')
    .map(message => normalize(message.content || ''));
  const previousHealthScreen = previousAssistantTexts.some(text => (
    healthImpactPatterns.filter(pattern => pattern.test(text)).length >= 2
  ));
  const normalRiskCoaching = !isBusinessRole && (conversationContext.riskLevel || 'normal') === 'normal';
  const latestIsNonAnswer = /^(?:(?:to|ja)\s+)?(?:(?:asi|fakt|proste|nejako|naozaj)\s+)*(?:nevim|neviem|netusim|nedokazu(?:\s+to)?(?:\s+(?:rict|povedat))?|nedokazem(?:\s+to)?(?:\s+(?:rict|povedat))?|neumim(?:\s+to)?(?:\s+(?:rict|povedat))?)(?:\s+(?:proste|nejako))?[.!\s]*$/u.test(normalizedLatestUserText);
  const lastAssistantNormalized = normalize(String([...messages].reverse().find(message => message?.role === 'assistant')?.content || ''));
  const declinedRequestedTechnique = /^(?:ne|nie|nechci|nechcem|radsi ne|radsej nie|ted ne|teraz nie|ne diky|ne dekuji)[.!\s]*$/u.test(normalizedLatestUserText)
    && /\bchces\b[^?]{0,90}\b(?:pokracovat|vyzkouset|zkusit|udelat)\b/u.test(lastAssistantNormalized);
  const declinedConversationDirection = (
    /\b(?:timhle|timto|takhle|tudy|tymto|takto|touto cestou|v tomhle smeru|v tomto smere)\b[^.!?\n]{0,90}\b(?:nechci|nechcem|odmitam|odmietam)\b/u.test(normalizedLatestUserText)
    || /\b(?:nechci|nechcem|odmitam|odmietam)\b[^.!?\n]{0,90}\b(?:timhle|timto|takhle|tudy|tymto|takto|touto cestou|v tomhle smeru|v tomto smere)\b/u.test(normalizedLatestUserText)
  );
  const acknowledgesDirectionRefusal = /\b(?:beru|beriem|respektuji|respektujem|zmenime smer|zmenime smerovanie|pujdeme jinak|pojdeme inak)\b/u.test(normalized)
    || /\b(?:timhle|timto|takhle|tudy|tymto|takto|touto cestou|v tomhle smeru|v tomto smere)\b[^.!?\n]{0,70}\b(?:nebudeme|nepujdeme|nepokracujeme|nebudem|nepojdeme)\b/u.test(normalized)
    || /\b(?:nebudeme|nepujdeme|nepokracujeme|nebudem|nepojdeme)\b[^.!?\n]{0,70}\b(?:timhle|timto|takhle|tudy|tymto|takto|touto cestou|v tomhle smeru|v tomto smere)\b/u.test(normalized);
  const explicitlyStatesMissingData = /\b(?:zatim\s+)?(?:(?:jsem|som)\s+ti\s+)?(?:nerekla|nepovedala|neuvedla|neuviedla)\b/u.test(normalizedLatestUserText)
    && /\b(?:kolik|kolko|pocet|jak|ako|reakc|reagoval|reagovali|udaj|data|informac)\w*\b/u.test(normalizedLatestUserText);
  const acknowledgesMissingData = /\b(?:nevime|nevieme|nemame|chybi|chybaju|nezname|nepozname|nerekla|nepovedala|neuvedla|neuviedla)\b/u.test(normalized)
    || /\bbez\s+(?:techto|tychto)?\s*(?:udaju|udajov|dat|informaci)\b/u.test(normalized)
    || /\b(?:nejde|nelze|neda se|neda sa|nemuzeme|nemozeme)\b[^.!?\n]{0,70}\b(?:hodnotit|vyhodnotit|posoudit|zhodnotit)\w*\b/u.test(normalized);
  const explicitlyAskedToRephraseQuestion = /\b(?:nerozumim|nerozumiem|nechapu|nechapem)\b[^.!?\n]{0,90}\b(?:otaz|vysvetl|rekni|povedz|formul)|\b(?:muzes|mohla bys|mozes)\b[^.!?\n]{0,70}\b(?:vysvetlit|vysvetli|preformulovat)\b[^.!?\n]{0,35}\b(?:lip|lepe|jednodus)|\bco (?:tim|tym) myslis\b/u.test(normalizedLatestUserText);
  const latestGrantedConsent = /^(?:ano|jo|souhlasim|muzeme|zkusme|pojďme|pojdme)[.!\s]*$/u.test(normalizedLatestUserText);
  const previousAssistantAskedConsent = /\bchces\b[^?]{0,120}\b(?:zkusit|vyzkouset|predstavit|projit|udelat)\b|\b(?:zkusit|vyzkouset|predstavit)\b[^?]{0,120}\bse\s+mnou\b/u.test(lastAssistantNormalized);
  const unexplainedThirdPartyDeparture = reportsUnexplainedThirdPartyDeparture(
    (Array.isArray(messages) ? messages : [])
      .filter(message => message?.role === 'user')
      .map(message => String(message.content || '')),
    output,
  );
  const factOnlyUnsupportedDetail = explicitlyRequestsFactsOnly
    ? unsupportedFactOnlyDetail(output, evidence)
    : null;

  if (!output) issues.push({ code: 'empty', severity: 'critical' });
  if (responseLanguageMismatch(output, responseLanguage)) {
    issues.push({ code: 'response_language_mismatch', severity: 'high', detail: responseLanguage });
  }
  if (techniquePhase === 'evaluation'
    && (!isTechniqueEffectCheck(output) || startsTechniqueIntervention(output))) {
    issues.push({ code: 'technique_evaluation_skipped', severity: 'high' });
  }
  if (techniquePhase === 'stopped') {
    const acknowledgesStop = /\b(?:zastav\w*|ukonc\w*|vynech\w*|koncime|nebudu\s+[^.!?]{0,70}\bpokracovat)\b/u.test(normalized);
    if (!acknowledgesStop || startsTechniqueIntervention(output)) {
      issues.push({ code: 'technique_stop_ignored', severity: 'critical' });
    }
  }
  if (!closingRequested && requireQuestion && questionCount !== 1) {
    issues.push({ code: 'question_count', severity: 'high', detail: questionCount });
  }
  if (explicitlyRequestsOneShortQuestion) {
    const questionWordCount = currentQuestion.split(/\s+/u).filter(Boolean).length;
    if (questionCount !== 1 || outputWordCount > 25 || questionWordCount > 18) {
      issues.push({
        code: 'explicit_short_question_violated',
        severity: 'high',
        detail: { questionCount, outputWordCount, questionWordCount },
      });
    }
  }
  if (unexplainedThirdPartyDeparture && !explicitlyPreservesDepartureUncertainty(output)) {
    issues.push({ code: 'departure_uncertainty_missing', severity: 'high' });
  }
  if (factOnlyUnsupportedDetail) {
    issues.push({ code: 'fact_only_unsupported_claim', severity: 'high', detail: factOnlyUnsupportedDetail });
  }
  if (hasUnsupportedPerformanceVerdict(output, evidence.recentUserEvidence)) {
    issues.push({ code: 'unsupported_performance_verdict', severity: 'high' });
  }
  if (/^(?:rozumim|to dava smysl|dekuji za sdileni|pojdme se na to podivat|skvele|vyborne)\b/u.test(normalized)) {
    issues.push({ code: 'chatbot_opening', severity: 'medium' });
  }
  if (/\b(?:mas (?:uplnou|uplnu|naprostou) pravdu|samozrejme (?:mas )?(?:uplnou|uplnu|naprostou )?pravdu|presne tak|naprosto souhlasim|uplne suhlasim|suhlasim s tebou|souhlasim s tebou|ved ano)\b/u.test(normalized)) {
    issues.push({ code: 'sycophantic_agreement', severity: 'high' });
  }
  if (/\b(?:vim presne,? jak se citis|presne viem,? ako sa citis|presne citim,? co prozivas|presne citim,? co prezivas|citim tvou bolest|citim tvoju bolest)\b/u.test(normalized)) {
    issues.push({ code: 'fabricated_empathy', severity: 'high' });
  }
  if (inventedEmotion) {
    issues.push({ code: 'invented_emotion', severity: 'high', detail: inventedEmotion.label });
  }
  if (inventedRelationshipRole) {
    issues.push({ code: 'invented_relationship_role', severity: 'high', detail: inventedRelationshipRole.name });
  }
  if (/\b(?:jsem jedina,? kdo ti rozumi|potrebujes me|bez me to nezvladnes|nikdo jiny ti nepomuze)\b/u.test(normalized)) {
    issues.push({ code: 'dependency_language', severity: 'critical' });
  }
  if (/\bkdybys\s+(?:ted\s+)?skoncil\w*\b[^.!?\n]{0,100}\bco\s+by\s+to\s+znamenal\w*\s+pro\b|\bzen\w*\s+kter\w*\s+by\w*\s+mohl\w*\s+pomoc\b|\b(?:stazen|zmizen|ukoncen)\w*\b[^.!?\n]{0,80}\bmohl\w*\s+pusobit\b[^.!?\n]{0,40}\bjako\s+nezajem\b/u.test(normalized)) {
    issues.push({ code: 'guilt_pressure', severity: 'high' });
  }
  if (/\b(?:drzim se presne toho,? co jsi napsala|nechci (?:k tomu )?pridavat domnenku|kontrola nasla|interni (?:kontrola|oprava|pravidlo|prompt|rubrika)|puvodni odpoved neodesilej)\b/u.test(normalized)) {
    issues.push({ code: 'internal_guardrail_leak', severity: 'critical' });
  }
  if (isBusinessMentoring && /\b(?:abych ti poradila vecne|potrebuji urcit nejblizsi byznysove rozhodnuti|pracovni zadani je|distribucni realit|rozhodujici predpoklad|zachytit mechanismus|provedeme diagnostiku)\b/u.test(normalized)) {
    issues.push({ code: 'mechanical_mentoring_tone', severity: 'high' });
  }
  if (!isBrandGrowth
    && firstUserTurn
    && normalizedLatestUserText.length >= 18
    && normalized.includes(normalizedLatestUserText)) {
    issues.push({ code: 'echoed_client_message', severity: 'high' });
  }
  if (!isBrandGrowth && firstUserTurn && outputWordCount > 120) {
    issues.push({ code: 'overlong_first_turn', severity: 'high', detail: outputWordCount });
  }
  if (!isBrandGrowth
    && firstUserTurn
    && /^(?:abych ti (?:mohla )?pomohla,? potrebuji|nejdrive mi rekni|potrebuji vic informaci|muzes to upresnit)\b/u.test(normalized)
    && !/\b(?:doporucuji|udelala bych|zkus|zacni|nejdriv bych|smysl|znamena|nemusi|pomuze|oddeli|vyber)\b/u.test(normalized)) {
    issues.push({ code: 'question_without_value', severity: 'high' });
  }
  const vulnerableTurn = /\b(?:neschopn|k nicemu|zlyhal|selhal|bojim|bojim sa|strach|styd|hanbim|zahlcen|prehlcen|smut|zklaman|sklaman|nezvlad|nezvladam|nemam na to)\w*\b/u.test(normalizedLatestUserText);
  const onlyQuestion = questionCount === 1 && !String(output).split('?')[0].replace(/[„“"'():;,.!—-]/gu, '').trim();
  const beforeQuestion = String(output).split('?')[0] || '';
  const bridgeWordCount = beforeQuestion.split(/\s+/u).filter(Boolean).length;
  const hasRelationalBridge = bridgeWordCount >= 6
    && (groundingCount(beforeQuestion, evidence) >= 1
      || /\b(?:neni|nie je)\b[^.!?]{0,40}\b(?:dukaz|rozsudok|rozsudek)\b|\b(?:tohle|toto|tenhle|tento)\b[^.!?]{0,45}\b(?:zasah|boli|tezke|tazke|podstatn|dulezit)\w*\b/u.test(normalize(beforeQuestion)));
  const coldDirective = /^\s*(?:uved|popis|rekni|povedz|vyber|napis|povedz mi|kdy|kedy|co|čo|jak|ako)\b/u.test(normalized);
  if (!isBrandGrowth && vulnerableTurn && (onlyQuestion || coldDirective || outputWordCount <= 12) && !hasRelationalBridge) {
    issues.push({ code: 'cold_first_turn', severity: 'high' });
  }
  if (isBusinessMentoring && asksForHumanLanguage
    && (/\b(?:nejblizsi byznysove|rozhodujici predpoklad|mechanismus|distribucni realit|pracovni zadani)\b/u.test(normalized)
      || outputWordCount > 90)) {
    issues.push({ code: 'failed_style_repair', severity: 'high' });
  }
  if (!closingRequested && !proceduralPhase && (questionCount > 3 || (asksForHumanLanguage && questionCount > 1))) {
    issues.push({ code: 'question_overload', severity: 'high', detail: questionCount });
  }
  if (/^\s*(?:#{1,6}\s*)?(?:hlavni zaver|doporuceny postup|dalsi krok|analyza|reseni)\s*:/imu.test(normalized)
    || (output.match(/^\s*(?:[-•*]|\d+[.)])\s+/gmu) || []).length >= 2) {
    issues.push({ code: 'answer_template', severity: 'high' });
  }
  if (/\b(?:umis (?:treba|napriklad)|vidim konkretni veci,? ktere umis|dokazes bez problemu|zvladas skvele)\b/u.test(normalized)) {
    issues.push({ code: 'unsupported_capability', severity: 'critical' });
  }
  if (/\b(?:to je|jde o|mas)\s+(?:typicky\s+)?(?:perfekcionismus|sebesabotaz|syndrom podvodnika|trauma|poruch[auy])\b/u.test(normalized)) {
    issues.push({ code: 'premature_label', severity: 'critical' });
  }
  if (/\b(?:urcite|zarucene|stoprocentne|100\s*%)\b/u.test(assistantAssertions)) {
    issues.push({ code: 'unearned_certainty', severity: 'critical' });
  }
  if (isBusinessRole) {
    const claimsOwnExternalAction = /\b(?:publikovala|zverejnila|spustila|odeslala|nahrala|nastavila|upravila|zmenila|vytvorila|zaplatila|objednala|prihlasila)\s+jsem\b|\bjsem\s+(?:publikovala|zverejnila|spustila|odeslala|nahrala|nastavila|upravila|zmenila|vytvorila|zaplatila|objednala|prihlasila)\b/u.test(normalized)
      || /\b(?:hotovo|provedeno)\b[^.!?\n]{0,80}\b(?:kampan|reklam|prispevek|web|canv|ucet|rozpocet)\b/u.test(normalized);
    if (claimsOwnExternalAction) {
      issues.push({ code: 'false_external_action_claim', severity: 'critical' });
    }
    if (/\b(?:pojdme|budeme|ted)\s+(?:zpracovat|lecit|uzdravit|rozpustit)\b[^.!?\n]{0,80}\b(?:trauma|vnitrni dite|zraneni z detstvi)\b/u.test(normalized)) {
      issues.push({ code: 'brand_role_drift', severity: 'critical' });
    }
  }
  if (/\b(?:skutecna pricina|prava pricina|koren (?:tohoto )?problemu|tvuj skutecny problem)\s+(?:je|spociva)|\bve skutecnosti jde o\b/u.test(assistantAssertions)) {
    issues.push({ code: 'invented_root_cause', severity: 'critical' });
  }
  if (/\b(?:tohle|tento problem|tenhle problem|tenhle vzorec|tento vzorec)\s+(?:uz\s+)?(?:mas\s+)?(?:vyresen[ey]|uzavren[ey]|zpracovan[ey])\b/u.test(assistantAssertions)) {
    issues.push({ code: 'unsupported_resolution', severity: 'critical' });
  }
  if (normalRiskCoaching && unsolicitedHealthScreen && !userRaisedHealthImpact) {
    issues.push({ code: 'unsolicited_health_screening', severity: 'high', detail: healthScreenDimensions });
    if (previousHealthScreen) {
      issues.push({ code: 'repeated_health_screening', severity: 'high' });
    }
  }
  if (latestIsNonAnswer
    && /\b(?:mame|vytvorila jsi|nasla jsi|povedlo se)\b[^.!?\n]{0,80}\b(?:presnejs\w* vet\w*|odpoved\w*|reseni|krok)\b/u.test(normalized)) {
    issues.push({ code: 'invented_step_completion', severity: 'high' });
  }
  if (declinedRequestedTechnique
    && /\b(?:chces\b[^?]{0,90}\b(?:pokracovat|vyzkouset|zkusit)|mame\b[^.!?\n]{0,60}\bpresnejsi vet\w*)\b/u.test(normalized)) {
    issues.push({ code: 'ignored_technique_refusal', severity: 'high' });
  }
  if (declinedConversationDirection && !acknowledgesDirectionRefusal) {
    issues.push({ code: 'direction_refusal_acknowledgement_missing', severity: 'high' });
  }
  if (explicitlyStatesMissingData && !acknowledgesMissingData) {
    issues.push({ code: 'missing_data_acknowledgement_missing', severity: 'high' });
  }
  if (explicitlyAskedToRephraseQuestion
    && /\bpopis mi posledni konkretni situaci\b|\bco bylo tesne predtim\b/u.test(normalized)) {
    issues.push({ code: 'failed_question_rephrase', severity: 'high' });
  }
  if (normalizedLastQuestion.length >= 12
    && (normalizedCurrentQuestion === normalizedLastQuestion
      || stemSimilarity(normalizedCurrentQuestion, normalizedLastQuestion) >= 0.72)) {
    issues.push({ code: 'repeated_question', severity: 'high' });
  }
  if ((/\bjsem\s+k\s+nicemu\b/u.test(normalizedLatestUserText) && /\bveta\s+[„"']?jsem\s+neschopna\b/u.test(normalized))
    || (/\bjsem\s+neschopna\b/u.test(normalizedLatestUserText) && /\bveta\s+[„"']?jsem\s+k\s+nicemu\b/u.test(normalized))) {
    issues.push({ code: 'altered_client_self_judgment', severity: 'high' });
  }
  if (latestGrantedConsent
    && previousAssistantAskedConsent
    && /\bchces\b[^?]{0,120}\b(?:zkusit|vyzkouset|predstavit|projit|udelat)\b/u.test(normalized)) {
    issues.push({ code: 'redundant_consent_request', severity: 'high' });
  }
  if (normalized.length >= 20
    && previousAssistantTexts.some(previous => {
      const prior = previous.replace(/\s+/g, ' ').trim();
      const current = normalized.replace(/\s+/g, ' ').trim();
      return prior === current || stemSimilarity(prior, current) >= 0.82;
    })) {
    issues.push({ code: 'repeated_assistant_response', severity: 'high' });
  }
  if (!proceduralPhase
    && conversationContext.userTurns >= 1
    && evidence.latestSubstantiveUserText.length >= 12
    && !hasGrounding(output, evidence)
    && !acknowledgesCorrection) {
    issues.push({ code: 'not_grounded_in_client_words', severity: conversationContext.userTurns >= 2 || isBusinessMentoring ? 'high' : 'medium' });
  }
  if (/\b(?:co je ted pro tebe nejdulezitejsi|kde presne se to u tebe lame|jak se u toho citis)\?$/u.test(normalized)
    && conversationContext.userTurns >= 2) {
    issues.push({ code: 'generic_question', severity: 'high' });
  }
  if (personalizedContentRequested && conversationContext.userTurns >= 2) {
    const genericPillarTemplate = /\b(?:edukacn\w*|inspiracn\w*|prodejn\w*)\b.{0,90}\b(?:edukacn\w*|inspiracn\w*|prodejn\w*)\b|\b(?:tipy a triky|zakulisi|behind the scenes|hodnotny obsah|bud konzistentni)\b/u.test(normalized);
    const hasUsableContentShape = /\b(?:hook|prvni veta|zacni vetou|titulek|scenar|reel|video|karusel|stories|vyzv\w* k akci|cta|rekni|napis)\b/u.test(normalized);
    if (groundingCount(output, evidence) < 2 || (genericPillarTemplate && !hasUsableContentShape)) {
      issues.push({ code: 'generic_content_output', severity: 'high' });
    }
  }

  const penalty = issues.reduce((total, issue) => total + ({ critical: 28, high: 16, medium: 8 }[issue.severity] || 4), 0);
  const score = Math.max(0, 100 - penalty);
  const repairCodes = new Set([
    'empty',
    'unsupported_capability',
    'premature_label',
    'unearned_certainty',
    'answer_template',
    'generic_question',
    'not_grounded_in_client_words',
    'sycophantic_agreement',
    'fabricated_empathy',
    'invented_emotion',
    'invented_relationship_role',
    'dependency_language',
    'guilt_pressure',
    'internal_guardrail_leak',
    'mechanical_mentoring_tone',
    'echoed_client_message',
    'overlong_first_turn',
    'question_without_value',
    'failed_style_repair',
    'question_overload',
    'invented_root_cause',
    'unsupported_resolution',
    'repeated_question',
    'repeated_assistant_response',
    'altered_client_self_judgment',
    'redundant_consent_request',
    'false_external_action_claim',
    'brand_role_drift',
    'generic_content_output',
    'unsolicited_health_screening',
    'repeated_health_screening',
    'invented_step_completion',
    'ignored_technique_refusal',
    'direction_refusal_acknowledgement_missing',
    'missing_data_acknowledgement_missing',
    'failed_question_rephrase',
    'technique_evaluation_skipped',
    'technique_stop_ignored',
    'explicit_short_question_violated',
    'departure_uncertainty_missing',
    'fact_only_unsupported_claim',
    'unsupported_performance_verdict',
    'response_language_mismatch',
    'cold_first_turn',
  ]);
  const shouldRepair = issues.some(issue => repairCodes.has(issue.code))
    || issues.filter(issue => issue.severity === 'high').length >= 2;

  return {
    pass: !issues.some(issue => ['critical', 'high'].includes(issue.severity)),
    score,
    issues,
    shouldRepair,
    evidence,
  };
}

export function buildQualityRepairInstruction(assessment, conversationContext = {}, { responseMode = 'diagnostika' } = {}) {
  const codes = assessment?.issues?.map(issue => issue.code).join(', ') || 'neurčená slabina';
  const evidence = assessment?.evidence || {};
  if (['mentoring', 'mentoringova_konzultace'].includes(responseMode)) {
    return [
      '# INTERNÍ OPRAVA BYZNYS MENTORKY — PŮVODNÍ ODPOVĚĎ NEODESÍLEJ',
      `Kontrola našla: ${codes}.`,
      `Původní zakázka: ${conversationContext.openingFocus || 'nezjištěna'}`,
      `Poslední věcná zpráva členky: ${evidence.latestSubstantiveUserText || 'nezjištěna'}`,
      'Napiš odpověď znovu jako seniorní byznys mentorka, ne jako terapeutka ani pasivní koučka. Na jasný byznysový problém dej hned nejlepší konkrétní doporučení z dostupných informací, vysvětli jeho důvod a na konci polož nanejvýš jednu rozhodující otázku.',
      `${languageInstruction(conversationContext.responseLanguage)} Mluv jako zkušená člověčí mentorka v normálním rozhovoru. Neopakuj zprávu členky v uvozovkách a nepoužívej věty jako „abych ti poradila věcně“, „potřebuji určit nejbližší byznysové rozhodnutí“ nebo „pracovní zadání je“.`,
      'Běžný překlep nebo hovorový výraz oprav tiše podle jednoznačného kontextu. Opravu nekomentuj, necituj chybný zápis a neříkej člence, že se držíš jen toho, co napsala. Pokud význam opravdu není jasný, zeptej se přirozeně jednou krátkou otázkou.',
      'Když členka řekne, že ti nerozumí nebo chce, abys mluvila jako člověk, krátce to přijmi a ihned přeformuluj poslední věcnou radu jednodušeji. Neobhajuj se, nevysvětluj systém a nezačínej rozhovor znovu.',
      'Nevymýšlej publikum, výsledky, rozpočet, metriku ani psychologickou příčinu. Pracovní doporučení nebo návrh ale není nepovolená domněnka: jasně ho formuluj jako svůj odborný úsudek a dej člence použitelný další krok.',
      assessment?.issues?.some(issue => issue.code === 'generic_content_output')
        ? 'Členka chce obsah na míru. Nepoužívej obecné pilíře ani zaměnitelný seznam témat. Použij její konkrétní cíl, publikum, úhel pohledu, zkušenost, nabídku nebo kanál a vytvoř skutečný hook, hlavní sdělení, místo pro důkaz či příběh a přirozenou výzvu k akci. Pokud něco zásadního chybí, připrav pracovní verzi s jedním přiznaným předpokladem a zeptej se jen na nejdůležitější chybějící údaj.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'departure_uncertainty_missing')
        ? 'Členka popsala, že jiný člověk odešel, ale neuvedla proč. Výslovně řekni, že důvod odchodu neznáme; žádnou možnou příčinu ani hodnocení výsledku nepodávej jako fakt.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'unsupported_performance_verdict')
        ? 'Z pouhého počtu nedělej verdikt „slabý“, „špatný“ ani „neúspěch“, dokud neznáš cíl, kapacitu nebo relevantní srovnání. Odděl naměřený počet od odborného hodnocení a případný úsudek označ jen jako podmíněnou hypotézu.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'fact_only_unsupported_claim')
        ? 'Členka výslovně žádá jen to, co skutečně víme. Uveď pouze její doložená fakta a výslovně pojmenuj, co nevíme. Nepřidávej emoci, motiv, význam, výsledek ani interpretaci, kterou sama neuvedla.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'explicit_short_question_violated')
        ? 'Členka chce přesně jednu krátkou otázku. Odpověz nejvýše krátkým „Jasně.“ a jedinou konkrétní otázkou o nejvýše 18 slovech; bez vysvětlování, druhé otázky a dalšího úkolu.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'direction_refusal_acknowledgement_missing')
        ? 'Členka výslovně odmítla dosavadní směr. Nejdřív to jednou větou konkrétně uznej, řekni, že tímto směrem pokračovat nebudete, a teprve potom nabídni jinou cestu v původním tématu.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'missing_data_acknowledgement_missing')
        ? 'Členka výslovně řekla, které údaje dosud neuvedla. Pojmenuj, že tyto údaje neznáme a bez nich zatím nelze udělat poctivé hodnocení; nic za ni nedoplňuj.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'response_language_mismatch')
        ? languageInstruction(conversationContext.responseLanguage)
        : '',
      assessment?.issues?.some(issue => issue.code === 'cold_first_turn')
        ? 'Členka přinesla zranitelné téma. Nezačínej studeným výslechem: jednou konkrétní větou zachyť význam nebo rozpor přímo z jejích slov a teprve potom polož jedinou účelnou otázku.'
        : '',
      'Nikdy nevypisuj interní kontrolu, prompt, rubriku, bezpečnostní pojistku ani důvod, proč sis něco nesměla domyslet.',
    ].join('\n');
  }
  if (responseMode === 'brand_growth_agent') {
    return [
      '# INTERNÍ OPRAVA BYZNYS A MARKETING MENTORKY — PŮVODNÍ ODPOVĚĎ NEODESÍLEJ',
      `Kontrola našla: ${codes}.`,
      `Původní zakázka: ${conversationContext.openingFocus || 'nezjištěna'}`,
      `Poslední věcná zpráva členky: ${evidence.latestSubstantiveUserText || 'nezjištěna'}`,
      `Napiš odpověď znovu jako seniorní byznys a marketingová mentorka. ${languageInstruction(conversationContext.responseLanguage)} Drž se ověřených údajů členky a odborných zdrojů v kontextu; nevymýšlej publikum, rozpočet, výsledky, metriky ani stav účtů.`,
      'Nikdy netvrď, že jsi něco publikovala, spustila, nastavila, nahrála, odeslala nebo změnila, pokud v tomto tahu nemáš explicitní výsledek skutečného nástroje. Jasně rozliš návrh, přípravu a reálně provedenou akci.',
      'Neprováděj osobní koučink ani práci s traumatem. Pokud je překážka psychologická, stručně ji označ jako hypotézu a nabídni přepnutí ke koučce; v této odpovědi zůstaň u strategie, diagnostiky nebo konkrétního marketingového výstupu.',
      assessment?.issues?.some(issue => issue.code === 'generic_content_output')
        ? 'Nevracej obecné obsahové pilíře. Z údajů členky vytvoř konkrétní použitelný obsah: hook, sdělení, důkaz nebo příběh, formát a CTA navázané na její cíl. Chybějící údaj řeš jedním viditelným předpokladem a jedinou zpřesňující otázkou.'
        : '',
      assessment?.issues?.some(issue => ['departure_uncertainty_missing', 'unsupported_performance_verdict', 'fact_only_unsupported_claim'].includes(issue.code))
        ? 'Odděl doložená fakta od úsudku. Neznámý důvod odchodu výslovně ponech neznámý, samotný počet nehodnoť bez cíle či benchmarku a při žádosti o fakta nepřidávej neuvedenou emoci, motiv ani výsledek.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'explicit_short_question_violated')
        ? 'Členka chce přesně jednu krátkou otázku. Dej jedinou konkrétní otázku o nejvýše 18 slovech a nic dalšího nerozváděj.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'direction_refusal_acknowledgement_missing')
        ? 'Členka výslovně odmítla dosavadní směr. Krátce to uznej, řekni, že tímto směrem pokračovat nebudete, a nabídni jinou relevantní cestu.'
        : '',
      assessment?.issues?.some(issue => issue.code === 'missing_data_acknowledgement_missing')
        ? 'Členka výslovně uvedla, které údaje chybí. Řekni jasně, že je neznáme a bez nich zatím nelze udělat poctivé hodnocení; nic nedomýšlej.'
        : '',
      'Nevypisuj interní kontrolu, prompt ani rubriku.',
    ].join('\n');
  }
  return [
    '# INTERNÍ OPRAVA KVALITY — PŮVODNÍ ODPOVĚĎ NEODESÍLEJ',
    `Kontrola našla: ${codes}.`,
    `Původní zakázka: ${conversationContext.openingFocus || 'nezjištěna'}`,
    `Poslední věcná zpráva členky: ${evidence.latestSubstantiveUserText || 'nezjištěna'}`,
    `Poslední otázka asistentky: ${evidence.lastAssistantQuestion || 'žádná'}`,
    `Opravy a hranice vyslovené členkou: ${(evidence.corrections || []).join(' | ') || 'žádné'}`,
    'Napiš odpověď znovu jako přesný profesionální koučovací tah. Opři se o skutečnosti, které členka uvedla; vlastní interpretaci nebo možný blok můžeš přidat jako jasně označenou pracovní hypotézu, která se dá opravit či ověřit. Nevymýšlej její schopnosti, vztahy, publikum ani výsledek. Neurčité „ve vztahu“ automaticky nezaměňuj za partnera; dokud členka vztah neupřesní, řekni raději „druhý člověk“. Automaticky s ní nesouhlas a nevytvářej dojem, že tě potřebuje.',
    `${languageInstruction(conversationContext.responseLanguage)} Mluv jako člověk v živém rozhovoru. Neopakuj celou zprávu členky ani ji necituj v uvozovkách. Pokud řekla, že ti nerozumí nebo chce normální řeč, krátce to přijmi a hned přeformuluj poslední věcný tah jednodušeji.`,
    'Nemusíš čekat na úplné zmapování. Když to člence pomůže, dej hned konkrétní odborný úsudek, označenou pracovní hypotézu, krátké cvičení nebo proveditelný krok. Jasně odděl, co skutečně uvedla, co je tvoje hypotéza a co má další krok ověřit. Ptej se jen na údaj, který by doporučení opravdu změnil.',
    assessment?.issues?.some(issue => ['unsolicited_health_screening', 'repeated_health_screening'].includes(issue.code))
      ? 'Bezpečnostní úroveň je normální. Neodváděj téma ke spánku, jídlu, energii, tělu, zdraví ani běžnému fungování a neopakuj již zodpovězený screening. Vrať se k původní zakázce a pracuj s konkrétním obsahem obavy, její předpovědí, významem nebo vlivem na rozhodnutí; proveď jeden skutečný koučovací krok.'
      : '',
    assessment?.issues?.some(issue => ['invented_step_completion', 'ignored_technique_refusal'].includes(issue.code))
      ? 'Nepředstírej, že členka vytvořila odpověď, větu nebo krok, když řekla „nevím“. Pokud odmítla nabízenou techniku, okamžitě ji ukonči, neopakuj souhlas a pokračuj jinou cestou v původním tématu.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'direction_refusal_acknowledgement_missing')
      ? 'Členka výslovně odmítla dosavadní směr rozhovoru. Nejdřív její hranici konkrétně uznej a řekni, že tímto směrem pokračovat nebudete. Potom nabídni jiný způsob práce na původním tématu; nevracej ji skrytě ke stejnému kroku.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'missing_data_acknowledgement_missing')
      ? 'Členka právě opravila hranici známých faktů. Výslovně pojmenuj, které údaje neznáme, a nevyvozuj z nich žádný závěr ani je za ni nedoplňuj.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'failed_question_rephrase')
      ? 'Členka výslovně požádala o jednodušší vysvětlení poslední otázky. Zachovej její význam i konkrétní téma, řekni ji jednou krátkou běžnou větou a nepokládej jinou otázku ani obecnou výzvu k popisu poslední situace.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'repeated_assistant_response')
      ? 'Stejnou odpověď jsi už v tomto sezení použila. Neotvírej znovu uzavřený krok; navazuj výhradně na poslední otázku a poslední odpověď členky.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'guilt_pressure')
      ? 'Nevytvářej tlak přes možný dojem, zklamání ani prospěch druhých lidí. Vrať volbu klientce a pracuj s jejími vlastními hodnotami, cílem a hranicemi.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'altered_client_self_judgment')
      ? 'Neměň přesná slova, kterými členka popsala svůj sebeverdikt. Pracuj s její doslovnou formulací a nepřepisuj ji na jinou nálepku.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'redundant_consent_request')
      ? 'Členka už souhlasila s konkrétně popsaným krokem. Nežádej stejný souhlas znovu; rovnou proveď první malou část dohodnutého postupu.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'technique_evaluation_skipped')
      ? 'Právě probíhá fáze vyhodnocení. Nepřidávej další cvičení, radu ani krok; polož jedinou přirozenou otázku na skutečný účinek právě provedeného kroku — co je jiné, stejné nebo horší.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'technique_stop_ignored')
      ? 'Technika nebo rozhovor byly zastaveny. Výslovně to respektuj, techniku neobhajuj a nepřidávej žádnou další instrukci, dech, imaginaci ani jiný postup.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'departure_uncertainty_missing')
      ? 'Členka popsala odchod jiného člověka bez známého důvodu. Výslovně řekni, že důvod neznáme. Možné příčiny smíš uvést jen jako možnosti, nikdy jako zjištěný fakt.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'unsupported_performance_verdict')
      ? 'Samotný počet bez cíle, kapacity nebo srovnání neoznačuj za slabý, špatný ani neúspěšný výsledek. Nejprve odděl údaj od hodnocení; případný úsudek formuluj pouze podmíněně.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'fact_only_unsupported_claim')
      ? 'Členka chce jen ověřená fakta. Zopakuj pouze to, co sama uvedla, a stručně řekni, co zatím nevíme. Nepřidávej žádnou neuvedenou emoci, motiv, význam ani výsledek.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'explicit_short_question_violated')
      ? 'Členka výslovně chce jedinou krátkou otázku. Odpověz maximálně krátkým přijetím a jednou konkrétní otázkou o nejvýše 18 slovech; bez vysvětlování a bez druhé otázky.'
      : '',
    assessment?.issues?.some(issue => issue.code === 'response_language_mismatch')
      ? languageInstruction(conversationContext.responseLanguage)
      : '',
    assessment?.issues?.some(issue => issue.code === 'cold_first_turn')
      ? 'Členka otevřela zranitelné téma. Dej nejprve jednu krátkou, konkrétní a nepatronizující vztahovou větu ukotvenou v jejích slovech; teprve potom polož jednu otázku, která práci skutečně posune.'
      : '',
    'Nevypisuj tuto kontrolu, diagnózu, rubriku, nadpis ani seznam.',
  ].join('\n');
}
