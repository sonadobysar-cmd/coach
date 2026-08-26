const ACKNOWLEDGEMENT = /^(?:ano|jo|jasně|jasne|dobře|dobre|ok|souhlasím|souhlasim|můžeme|muzeme|zkusme|nevím|nevim)[.!\s]*$/iu;
const STOPWORDS = new Set([
  'aby', 'ale', 'ani', 'ano', 'asi', 'bez', 'bude', 'byla', 'bylo', 'bych', 'bys', 'co', 'coz',
  'dalsi', 'dnes', 'do', 'ho', 'jak', 'jako', 'jsem', 'jsi', 'jsme', 'kdy', 'kdyz', 'ktera',
  'ktere', 'ktery', 'ma', 'mam', 'mas', 'me', 'mi', 'mit', 'mne', 'moc', 'muze', 'muzes',
  'na', 'nad', 'ne', 'nebo', 'neco', 'neni', 'nez', 'nic', 'od', 'pak', 'po', 'pod', 'podle',
  'pokud', 'potom', 'pro', 'proc', 'proto', 'protoze', 'pred', 'pri', 'se', 'si', 'tak', 'tam',
  'te', 'ted', 'ten', 'tento', 'to', 'tohle', 'tom', 'tvoje', 'tvuj', 'ty', 'uz', 've', 'vse',
  'zase', 'ze', 'zde', 'zpet', 'mela', 'mel', 'chci', 'potrebuji', 'prosim', 'treba',
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
  const withoutNegation = normalized.length >= 7 && normalized.startsWith('ne')
    ? normalized.slice(2)
    : normalized;
  return withoutNegation
    .replace(/(?:ami|emi|ove|ova|ovy|eni|ani|ace|aci|ost|ech|ich|ych|ou|em|om|im|am|at|it|et|la|li|ly|lo|na|ni|ny|no|uje|uji|oval|ovat|eni|y|a|u|i|e|o)$/u, '')
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
  const assistantAssertions = normalized.replace(/[„“"][^„“"]+[„“"]/gu, ' ');
  const userEvidenceText = normalize((evidence.recentUserEvidence || []).join(' '));
  const emotionRoots = ['bolest', 'smut', 'vztek', 'zlost', 'strach', 'obav', 'stud', 'vin', 'bezmoc', 'frustr', 'uzkost', 'radost', 'ulev', 'zklaman', 'napeti'];
  const inventedEmotion = emotionRoots.find(root => {
    if (!assistantAssertions.includes(root) || userEvidenceText.includes(root)) return false;
    const position = assistantAssertions.indexOf(root);
    const localContext = assistantAssertions.slice(Math.max(0, position - 70), position + root.length + 20);
    // Obecná, podmíněná informace není tvrzení o vnitřním stavu členky.
    // „Může se objevit při napětí“ je bezpečné; „je v tom hodně bolesti“ je podsunutá emoce.
    return !/\b(?:muze|mohlo|mohla|nekdy|obecne|napriklad|jednou z moznosti)\b/u.test(localContext);
  });
  const proceduralPhase = ['consent', 'evaluation', 'stopped'].includes(techniqueTurn?.session?.phase);
  const normalizedLastQuestion = normalize(evidence.lastAssistantQuestion || '').replace(/[^a-z0-9]+/g, ' ').trim();
  const currentQuestion = String(output).match(/[^?\n]{3,}\?/gu)?.at(-1) || '';
  const normalizedCurrentQuestion = normalize(currentQuestion).replace(/[^a-z0-9]+/g, ' ').trim();
  const acknowledgesCorrection = evidence.corrections.length > 0
    && /\b(?:nevedel|nevedela|nemel jsem|nemela jsem|domnenk|pripsat|omlouvam|moje chyba)\b/u.test(normalized);
  const deepExploration = conversationContext.deepWorkExpected
    && !['pripraveno_k_cilene_praci'].includes(conversationContext.depthStage)
    && !['podporna_stabilizace', 'vedena_meditace'].includes(responseMode);

  if (!output) issues.push({ code: 'empty', severity: 'critical' });
  if (!closingRequested && requireQuestion && questionCount !== 1) {
    issues.push({ code: 'question_count', severity: 'high', detail: questionCount });
  }
  if (/^(?:rozumim|to dava smysl|dekuji za sdileni|pojdme se na to podivat|skvele|vyborne)\b/u.test(normalized)) {
    issues.push({ code: 'chatbot_opening', severity: 'medium' });
  }
  if (/^(?:mas (?:uplnou|naprostou) pravdu|presne tak|naprosto souhlasim|souhlasim s tebou)\b/u.test(normalized)) {
    issues.push({ code: 'sycophantic_agreement', severity: 'high' });
  }
  if (/\b(?:vim presne,? jak se citis|presne citim,? co prozivas|citím tvou bolest|citim tvou bolest)\b/u.test(normalized)) {
    issues.push({ code: 'fabricated_empathy', severity: 'high' });
  }
  if (inventedEmotion) {
    issues.push({ code: 'invented_emotion', severity: 'high', detail: inventedEmotion });
  }
  if (/\b(?:zni to,? jako by|pusobi to,? jako by)\b/u.test(assistantAssertions)) {
    issues.push({ code: 'invented_inner_state', severity: 'high' });
  }
  if (/\b(?:jsem jedina,? kdo ti rozumi|potrebujes me|bez me to nezvladnes|nikdo jiny ti nepomuze)\b/u.test(normalized)) {
    issues.push({ code: 'dependency_language', severity: 'critical' });
  }
  if (!closingRequested && !proceduralPhase && questionCount > 1) {
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
  if (deepExploration && /(?:^|[.!]\s+)(?:udelej|napis|oslov|priprav|zverejni|nastav|vytvor|naplanuj|vyber si)\b/u.test(normalized)) {
    issues.push({ code: 'premature_prescription', severity: 'critical' });
  }
  if (deepExploration
    && !issues.some(issue => issue.code === 'premature_prescription')
    && /\b(?:potrebujes|musis|mela bys)\s+(?:udelat|napsat|oslovit|pripravit|zverejnit|nastavit|vytvorit|naplanovat|vybrat)\b/u.test(assistantAssertions)) {
    issues.push({ code: 'premature_prescription', severity: 'critical' });
  }
  if (/\b(?:skutecna pricina|prava pricina|koren (?:tohoto )?problemu|tvuj skutecny problem)\s+(?:je|spociva)|\bve skutecnosti jde o\b/u.test(assistantAssertions)) {
    issues.push({ code: 'invented_root_cause', severity: 'critical' });
  }
  if (/\b(?:tohle|tento problem|tenhle problem|tenhle vzorec|tento vzorec)\s+(?:uz\s+)?(?:mas\s+)?(?:vyresen[ey]|uzavren[ey]|zpracovan[ey])\b/u.test(assistantAssertions)) {
    issues.push({ code: 'unsupported_resolution', severity: 'critical' });
  }
  if (!proceduralPhase
    && normalizedLastQuestion.length >= 12
    && normalizedCurrentQuestion === normalizedLastQuestion) {
    issues.push({ code: 'repeated_question', severity: 'high' });
  }
  if (!proceduralPhase
    && conversationContext.userTurns >= 1
    && evidence.latestSubstantiveUserText.length >= 12
    && !hasGrounding(output, evidence)
    && !acknowledgesCorrection) {
    issues.push({ code: 'not_grounded_in_client_words', severity: conversationContext.userTurns >= 2 ? 'high' : 'medium' });
  }
  if (/\b(?:co je ted pro tebe nejdulezitejsi|kde presne se to u tebe lame|jak se u toho citis)\?$/u.test(normalized)
    && conversationContext.userTurns >= 2) {
    issues.push({ code: 'generic_question', severity: 'high' });
  }

  const penalty = issues.reduce((total, issue) => total + ({ critical: 28, high: 16, medium: 8 }[issue.severity] || 4), 0);
  const score = Math.max(0, 100 - penalty);
  const repairCodes = new Set([
    'empty',
    'unsupported_capability',
    'premature_label',
    'unearned_certainty',
    'premature_prescription',
    'answer_template',
    'generic_question',
    'not_grounded_in_client_words',
    'sycophantic_agreement',
    'fabricated_empathy',
    'invented_emotion',
    'invented_inner_state',
    'dependency_language',
    'question_overload',
    'invented_root_cause',
    'unsupported_resolution',
    'repeated_question',
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

export function buildQualityRepairInstruction(assessment, conversationContext = {}) {
  const codes = assessment?.issues?.map(issue => issue.code).join(', ') || 'neurčená slabina';
  const evidence = assessment?.evidence || {};
  return [
    '# INTERNÍ OPRAVA KVALITY — PŮVODNÍ ODPOVĚĎ NEODESÍLEJ',
    `Kontrola našla: ${codes}.`,
    `Původní zakázka: ${conversationContext.openingFocus || 'nezjištěna'}`,
    `Poslední věcná zpráva členky: ${evidence.latestSubstantiveUserText || 'nezjištěna'}`,
    `Poslední otázka asistentky: ${evidence.lastAssistantQuestion || 'žádná'}`,
    `Opravy a hranice vyslovené členkou: ${(evidence.corrections || []).join(' | ') || 'žádné'}`,
    'Napiš odpověď znovu jako jediný přesný koučovací tah. Drž se výhradně skutečností, které členka uvedla. Nevymýšlej její schopnosti, vztahy, publikum, příčinu, emoci ani výsledek. Automaticky s ní nesouhlas a nevytvářej dojem, že tě potřebuje.',
    'Pokud ještě není znám konkrétní mechanismus, nedávej plán ani úkol. Přirozeně navaž na poslední odpověď, zachyť její konkrétní slovo nebo rozpor a polož nejvýše jednu otázku, kterou by nešlo poslat jiné klientce.',
    'Nevypisuj tuto kontrolu, diagnózu, rubriku, nadpis ani seznam.',
  ].join('\n');
}
