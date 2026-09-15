export const PROFESSIONAL_LIFE_COACH_COURSE_ID = 'profesionalni-life-coach';

// Only a complete, standalone debrief command is administrative. This must
// never be a substring test: otherwise a substantive (and potentially unsafe)
// coaching intervention can hide itself by appending "vyhodnoť celý nácvik".
// Matching normalized text keeps Czech/Slovak accents and punctuation from
// changing the classification while the anchored grammar rejects extra prose.
const ADMINISTRATIVE_TURN = /^(?:(?:prosim )?(?:ukoncuji simulaci|ukoncujem simulaciu)(?: (?:a )?(?:potom )?(?:prosim )?vyhodnot (?:prosim )?(?:cely )?nacvik)?|(?:prosim )?vyhodnot (?:prosim )?(?:cely )?nacvik)(?: (?:pouze|iba) (?:podle|podla) prepisu)?$/u;

const COACH_STOPWORDS = new Set([
  'aby', 'ale', 'ani', 'bez', 'bude', 'byla', 'bylo', 'chce', 'chcete', 'co', 'jak',
  'jako', 'jsem', 'jsi', 'jste', 'kdy', 'ktera', 'ktere', 'ktery', 'ma', 'mate', 'me',
  'mne', 'musi', 'na', 'nebo', 'podle', 'pokud', 'pro', 'proto', 'se', 'si', 'tak',
  'taky', 'te', 'tento', 'to', 'tohle', 'tvoje', 'vase', 've', 'zde', 'ze',
]);

const COMPETENCY_DEFINITIONS = [
  {
    id: 'contract',
    label: 'Kontrakt a zakázka',
    description: 'Dohodne účel, role, očekávaný výsledek a při změně tématu znovu kontraktuje.',
    criterionPatterns: [
      /kontrakt/u, /zmluv/u, /zakazk/u, /intake/u, /dohod[ay] o (?:vztahu|jednom sezeni|vysledku)/u,
      /vysled(?:ek|ku) (?:rozhovoru|zbyvajiciho casu)/u, /struktura 50 minut/u,
      /zachyceni zmeny tematu/u, /ochrana casu/u, /navrat k dohodnute/u,
    ],
  },
  {
    id: 'active_listening',
    label: 'Aktivní naslouchání',
    description: 'Přesně reflektuje klientčina slova, ověřuje porozumění a nevkládá vlastní význam.',
    criterionPatterns: [
      /naslouch/u, /reflex/u, /parafraz/u, /shrnut/u, /klientcin(?:a|ych)? slov/u,
      /navaznost na posledni/u, /navazani z opraveneho/u, /pozorovani od vykladu/u,
      /intervence primo navazuji na slova/u,
      /overeni preference/u, /cteni mysli/u, /zachyceni studu/u, /uznani skutecneho faktu/u,
      /validace (?:prani|ambice)/u, /presne naslouchani/u,
      /respekt k nadeji/u,
    ],
  },
  {
    id: 'questions',
    label: 'Koučovací otázky',
    description: 'Pokládá jednu jasnou, nevedoucí otázku a citlivou hloubku otevírá se svolením.',
    criterionPatterns: [
      /jedna otazka/u, /otevren(?:a|e|ych) otaz/u, /otazk[ay] na/u, /rada ukryta v otazce/u,
      /svoleni pred citlivejsi hloubkou/u, /probing/u, /hloubk[ay] bez vyslechu/u,
    ],
  },
  {
    id: 'intervention_choice',
    label: 'Volba intervence',
    description: 'Volí metodu podle zakázky a reakce klientky, vysvětlí účel a umí rámec odložit.',
    criterionPatterns: [
      /grow/u, /heart/u, /ram(?:ec|ce|cem)/u, /nastroj/u, /metod/u, /bez mechanickeho/u,
      /bez obhajoby modelu/u, /jine formulace/u, /prace bez ramce/u, /plynulost procesu/u,
      /vnejsi orientace/u, /uprava spoustece/u, /mapovani podpurnych dat/u,
      /mapovan[ay] v systemu/u,
    ],
  },
  {
    id: 'refusal_autonomy',
    label: 'Odmítnutí, volba a autonomie',
    description: 'Respektuje ne, tempo a volbu klientky a nepřebírá za ni rozhodnutí.',
    criterionPatterns: [
      /odmitnut/u, /otazku stahnout/u, /kdyz nesedi/u, /autonom/u, /vlastnictvi/u,
      /neprebirani odpovednosti/u, /klientcin(?:a|e)? vliv/u, /tempo/u, /dobrovolnost/u,
      /zastaveni pri zhorseni/u, /okamzite zastaveni/u, /nepokracovat stejnou technikou/u,
      /rozhodnuti zustava klientce/u, /aktualniho bezpeci a volby/u,
      /prizpusobeni tempa/u,
    ],
  },
  {
    id: 'alliance_repair',
    label: 'Oprava aliance',
    description: 'Přijme korekci bez obrany, vezme odpovědnost za chybu a opraví další tah.',
    criterionPatterns: [
      /prijeti opravy/u, /moznost opravy/u, /oprava omylu/u, /bez obhajovani/u,
      /opravuje tvoji parafrazi/u, /alliance/u, /ruptur/u,
    ],
  },
  {
    id: 'ethical_boundaries',
    label: 'Etika a profesní hranice',
    description: 'Drží rozsah koučinku, bezpečí, důvěrnost, pravdivé sliby a vhodné předání.',
    criterionPatterns: [
      /etik/u, /hranic/u, /koucink.*(?:lecby|terapi|kriz|mentoring|garanc)/u,
      /(?:lecby|terapi|kriz|klinick|diagnost|traumat|neklinick)/u, /bezpec/u, /odborne predani/u,
      /duvern/u, /report/u, /minimalizace dat/u, /zaznam/u, /garanc/u, /slib/u,
      /certifikat/u, /akredit/u, /pravni/u, /financni/u, /systemove nebo pravni/u,
      /toxicka pozitivita/u, /diskriminac/u, /lidske predani/u,
      /vztahoveho[,]? zdravotniho a koucovaciho/u, /zpetne rozsireni souhlasu/u,
      /tristranne dohody/u, /kulturni a neurodivergentni/u, /obvinovani mindsetu/u,
      /nepohody jako dukazu ucinku/u, /falesna nalehavost/u,
      /sebevraz/u, /samovraz/u, /bezprostredniho ohrozeni/u, /krizoveho rizika/u,
    ],
  },
  {
    id: 'outcome',
    label: 'Výsledek a klientčin krok',
    description: 'Převádí uvědomění do klientkou zvoleného, pozorovatelného kroku a revize.',
    criterionPatterns: [
      /akcni plan/u, /dalsi krok/u, /klientkou zvolen/u, /overitelny krok/u,
      /kriterium revize/u, /experiment/u, /navratovy protokol/u, /vypadek pouzity jako data/u,
      /vysledkove metriky/u, /cil prevazne/u, /kontrola kapacity/u, /bod[uy] volby/u,
      /presnejsi formulace/u, /uzavreni/u, /accountability/u,
    ],
  },
  {
    id: 'reflection',
    label: 'Reflexe, bias a učení',
    description: 'Pracuje s hypotézou, reflektuje vlastní bias a stanoví konkrétní další pokus.',
    criterionPatterns: [
      /sebereflex/u, /superviz/u, /bias/u, /hypotez/u, /projekc/u, /dvoji metr/u,
      /prvniho dojmu/u, /stejny standard/u, /vlastni strach/u, /spoustec/u,
      /presvedceni/u, /interpretace a predpovedi/u, /udalosti?[,]? interpretace/u,
      /dukaz a pripravu/u, /rozliseni dovednosti[,]? motivace/u,
      /uplne kontroly/u, /emoce[,]? impulsu a jednani/u, /ochranne funkce/u,
      /uzka a podminena alternativa/u, /vratnosti a skutecneho rizika/u,
    ],
  },
];

export const COACH_COMPETENCIES = Object.freeze(
  COMPETENCY_DEFINITIONS.map(definition => Object.freeze({ ...definition })),
);

const MODULE_COMPETENCY = Object.freeze({
  0: 'ethical_boundaries',
  1: 'reflection',
  2: 'contract',
  3: 'active_listening',
  4: 'questions',
  5: 'outcome',
  6: 'outcome',
  7: 'intervention_choice',
  8: 'ethical_boundaries',
  9: 'ethical_boundaries',
  10: 'active_listening',
  11: 'reflection',
  12: 'intervention_choice',
  13: 'reflection',
  14: 'reflection',
  15: 'reflection',
  16: 'outcome',
  17: 'ethical_boundaries',
});

export function isProfessionalLifeCoachCourse(courseId) {
  return String(courseId || '').trim() === PROFESSIONAL_LIFE_COACH_COURSE_ID;
}

export function isTrainingAdministrativeTurn(value) {
  return ADMINISTRATIVE_TURN.test(normalizeCoachText(value));
}

export function indexedCoachStudentTurns(messages = []) {
  return rawCoachUserTurns(messages)
    .filter(turn => !turn.administrative)
    .map(({ administrative: _administrative, ...turn }) => Object.freeze(turn));
}

function rawCoachUserTurns(messages = []) {
  const result = [];
  const source = Array.isArray(messages) ? messages : [];
  let previousCounterpartText = '';
  let studentTurnIndex = 0;
  for (const [messageIndex, message] of source.entries()) {
    const text = cleanCoachText(message?.content);
    if (!text) continue;
    if (message?.role === 'assistant') {
      previousCounterpartText = text;
      continue;
    }
    if (message?.role !== 'user') continue;
    const administrative = isTrainingAdministrativeTurn(text);
    if (!administrative) studentTurnIndex += 1;
    result.push(Object.freeze({
      index: administrative ? null : studentTurnIndex,
      reference: administrative ? null : `S${studentTurnIndex}`,
      messageIndex,
      text,
      administrative,
      previousCounterpartText,
      laterCounterpartText: source
        .slice(messageIndex + 1)
        .filter(candidate => candidate?.role === 'assistant')
        .map(candidate => cleanCoachText(candidate.content))
        .filter(Boolean)
        .join(' '),
    }));
  }
  return result;
}

export function coachCompetencyForCriterion(label) {
  const normalized = normalizeCoachText(label);
  if (!normalized) return null;

  // These labels contain words shared with another competency (for example
  // “odmítnutí léčebného slibu”). The professional boundary is the decisive
  // behavior, so resolve it before the general signal scoring below.
  if (/(?:lecebneho slibu|koucinku[,]? lecby|traumatickou vzpominkou|neklinickeho cile|klinicka nebo krizova|odborne predani|duvern|reporting|certifikat|akredit)/u.test(normalized)) {
    return COACH_COMPETENCIES.find(definition => definition.id === 'ethical_boundaries');
  }
  if (/reflexe.{0,70}(?:dukaz|mezer|dalsiho pokusu)/u.test(normalized)) {
    return COACH_COMPETENCIES.find(definition => definition.id === 'reflection');
  }
  if (/^volba intervence\b/u.test(normalized)) {
    return COACH_COMPETENCIES.find(definition => definition.id === 'intervention_choice');
  }

  let best = null;
  let bestScore = 0;
  for (const definition of COACH_COMPETENCIES) {
    const score = definition.criterionPatterns.reduce(
      (total, pattern) => total + (pattern.test(normalized) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = definition;
      bestScore = score;
    }
  }
  if (best) return best;

  const moduleMatch = /(?:lekce|laborator|aplikace|test modulu)\s+(\d{1,2})(?:\.|\b)/u.exec(normalized);
  const moduleCompetencyId = moduleMatch ? MODULE_COMPETENCY[Number(moduleMatch[1])] : null;
  return COACH_COMPETENCIES.find(definition => definition.id === moduleCompetencyId) || null;
}

export function coachCompetencyIdForCriterion(label) {
  return coachCompetencyForCriterion(label)?.id || null;
}

export function requiredCoachEvidenceCount(label) {
  return /alespon dve intervence/u.test(normalizeCoachText(label)) ? 2 : 1;
}

/**
 * Sdílený deterministický test obou částí úplného kontraktu. Hodnotitel
 * debriefu i relevance důkazu musí používat přesně stejnou definici; jinak
 * může být učebnicově úplná otázka současně uznána jako relevantní a přesto
 * neprávem kritizována za chybějící kritérium úspěchu.
 */
export function assessCoachContractSubcriteria(value) {
  const text = normalizeCoachText(value);
  const purpose = /(?:co|jak|ako|s cim).{0,70}(?:uzitecn|uzitocn|chcete|chces|venovat|pracovat|vyresit|vyriesit|odejit|odist).{0,45}(?:vysled|cil|ciel|tema|jasn)/u.test(text)
    || /(?:uzitecn|uzitocn).{0,25}(?:vysled|cil|ciel)/u.test(text)
    || /(?:co|c[oô]).{0,25}(?:si )?(?:chcete|chces).{0,22}(?:odnest|odniest).{0,35}(?:rozhovor|sezen|seden)/u.test(text);
  const successCriterion = /(?:podle ceho|podla coho|jak|ako).{0,40}(?:poznate|poznas|spoznate|spoznas|overime|overis|vyhodnotime)/u.test(text)
    || /(?:podle ceho|podla coho|jak|ako).{0,55}(?:poznate|poznas|spoznate|spoznas|overime|overis|vyhodnotime|zjistime|zistime).{0,35}(?:pomohl|pomohlo|uzitecn|uzitocn|dosahl|dosiah)/u.test(text)
    || /(?:plati|sedi|dohodnuto|potvrdme|potvrdime).{0,35}(?:cil|ciel|vysled|zakazk|zmluv)/u.test(text);
  return Object.freeze({
    purpose,
    successCriterion,
    complete: purpose && successCriterion,
  });
}

export function assessCoachActiveListeningSubcriteria(value) {
  const text = normalizeCoachText(value);
  const reflection = /\b(?:slysim|pocujem|rikate|rikas|hovorite|hovoris|vravite|vravis|rozumim tomu tak|rozumiem tomu tak|zachycuji|zachytavam|zni to|ak (?:ti|vam) spravne rozumiem|jestli (?:ti|vam) spravne rozumim|z tvych slov|z vasich slov|to co popisujete|to co popisujes)\b/u.test(text);
  const verification = /\b(?:sedi to|plati to|je to tak|chapu to spravne|chapem to spravne|rozumim tomu spravne|rozumiem tomu spravne|opravte me|oprav ma|oprav me)\b/u.test(text);
  return Object.freeze({
    reflection,
    verification,
    complete: reflection && verification,
  });
}

/**
 * Sdílený test úplné nabídky intervence: konkrétní metoda/nástroj, její účel
 * a skutečná volba klientky. Relevance důkazu a kontrola falešného
 * „ČÁSTEČNĚ“ tak nemohou používat dvě odlišné definice stejné dovednosti.
 */
export function assessCoachInterventionChoiceSubcriteria(value) {
  const text = normalizeCoachText(value);
  const method = /\b(?:grow|heart|ramec|mapa|hodnot|otazk|cviceni|experiment|orientac|postup|nastroj|metod|trideni priorit|bez ramce|jinou formulac)\w*\b/u.test(text);
  const purpose = /\b(?:aby|protoze|pretoze|smyslem|zmyslom|ucelem|ucelom|pomoh|pomuze|pomoze|potrebujete nejdriv|potrebujete najprv|odpovida tomu)\w*\b/u.test(text);
  const consent = /\b(?:chcete|chces|chcete ji|chces ji|vyhovovalo by|souhlasite|souhlasis|suhlasite|suhlasis|muzu|muzeme|mozeme|mohu|mozem).{0,45}\b(?:pouzit|pouzit ji|vyzkouset|vyskusat|zkusit|skusit|pracovat|pokracovat|nabidnout|ponuknut)\b/u.test(text)
    || /\b(?:mohu|mozem|muzu|muzeme|mozeme).{0,35}\b(?:nabidnout|ponuknut|zkusit|skusit|pouzit)\b/u.test(text)
    || /\b(?:dava|dava vam|dava ti|dava vám|dava ti|dava zmysel|dava smysl).{0,35}(?:zkusit|skusit|vyzkouset|vyskusat)\b/u.test(text);
  return Object.freeze({ method, purpose, consent, complete: method && purpose && consent });
}

export function assessCoachOutcomeSubcriteria(value) {
  const text = normalizeCoachText(value);
  const prescribedAnswer = /\b(?:jedina|jedine)\s+(?:spravna|spravne)\s+(?:volba|moznost|rozhodnuti)|\b(?:musite|musis|mel byste|mela byste|mel bys|mela bys)\b.{0,55}\b(?:podepsat|podpisat|odejit|odist|prijmout|prijat|odmitnout|odmietnut)\b/u.test(text);
  const clientOwned = !/^(?:musite|musis|mel byste|mela byste|mel bys|mela bys|udelej|udelejte|urob|urobte)\b/u.test(text)
    && !prescribedAnswer;
  const clientChoice = /(?:jaky|aky|ktery|ktory|co za).{0,28}krok.{0,20}(?:si volite|si volis|zvolite|zvolis)|(?:co|aky|jaky) si (?:volite|volis|zvolite|zvolis)|(?:co|c[oô]) presne (?:udelate|udelas|urobite|urobis).{0,20}(?:jako|ako) prvni/u.test(text);
  const concreteStep = /(?:konkretni|konkretny|co presne|co konkretne|jaky krok|aky krok|ktery krok|ktory krok)/u.test(text);
  const timing = /(?:do kdy|dokdy|kdy|kedy|termin|datum|dnes|zittra|zajtra|do konce)/u.test(text);
  const verification = /(?:podle ceho|podla coho|jak poznate|jak poznas|ako spoznate|ako spoznas|vyhodnot|zmer|zmer|kontrol|over)/u.test(text);
  return Object.freeze({
    clientOwned,
    clientChoice,
    concreteStep,
    timing,
    verification,
    relevant: clientOwned && clientChoice && concreteStep && (timing || verification),
    complete: clientOwned && clientChoice && concreteStep && timing && verification,
  });
}

export function assessCoachRefusalAutonomySubcriteria(value) {
  const text = normalizeCoachText(value);
  const respectsRefusal = /(?:beru|respektuji|respektujem|zastavime|nebudeme pokracovat|nebudu pokracovat|nebudem pokracovat|nepujdeme.{0,25}(?:do|k) (?:te|tej|teto|otazk)|nebudu.{0,35}(?:otazku|ramec|techniku)|nebudem.{0,35}(?:otazku|ramec|techniku)|(?:otazku|ramec|techniku).{0,35}(?:nebudu|nebudem)|nemusite|nemusis|je to (?:vase|tvoje) volba|rozhodnuti je na (?:vas|tobe)|rozhodnutie je na (?:vas|tebe)|tempo urcujete|tempo urcujes)/u.test(text);
  const restoresChoice = /(?:co (?:byste|bys) chtel[a-z]*|co by ste chcel[a-z]*|kam (?:byste|bys) chtel[a-z]*|kam by ste chcel[a-z]*|chcete radeji|chces radeji|chcete radsej|chces radsej|muzeme|mozeme).{0,55}(?:jinak|inak|misto toho|namiesto toho|uzavrit|ukoncit|pokracovat|stocit|presmerovat)|(?:jinou|inu) (?:otazku|cestu|moznost|techniku)|(?:volba|tempo|smer|směr) (?:zustava|zostava|je) (?:na vas|na tobe|na tebe)/u.test(text);
  return Object.freeze({ respectsRefusal, restoresChoice, complete: respectsRefusal && restoresChoice });
}

export function assessCoachEthicalBoundarySubcriteria(value) {
  const text = normalizeCoachText(value);
  const boundary = /(?:v ramci koucinku|neni diagnoz|nie je diagnoz|diagnoz[a-z]*.{0,18}(?:nestanovuji|nestanovujem|neurcuji|neurcujem)|nemohu diagnostikovat|nemozem diagnostikovat|nebudu diagnostikovat|nebudem diagnostikovat|nebudu zpracovavat traum|nebudem spracovavat traum|obsah sezeni (?:nesdilim|nepredavam)|obsah sedenia (?:nezdielam|neodovzdam)|bez souhlasu (?:nesdilim|neposkytnu)|bez suhlasu (?:nezdielam|neposkytnem)|vysledek (?:nemohu|nelze) (?:garantovat|zarucit)|vysledok (?:nemozem|neda sa) (?:garantovat|zarucit)|interni certifikat|interny certifikat|neni akreditac|nie je akreditac|zastavime techniku|neklinicky cil|neklinicky ciel)/u.test(text)
    && !isClinicalOverreach(text)
    && !isConfidentialityBreach(text)
    && !isOutcomeGuarantee(text)
    && !isFalseCredentialClaim(text);
  const safeNextStep = /(?:odbornik|psycholog|terapeut|lekar|krizov|112|155|predani|odborne predani|kontakt|lidsk|souhlas|suhlas|minimalizac|bezpecn|podporu|pomoc)/u.test(text);
  return Object.freeze({ boundary, safeNextStep, complete: boundary && safeNextStep });
}

export function assessCoachReflectionSubcriteria(value) {
  const text = normalizeCoachText(value);
  const rejectsVerification = /(?:nepotrebuji|nepotrebujem|nebudu|nebudem|neni treba|netreba).{0,35}(?:over|overov|zkoumat|skumat)|(?:prvni dojem|prvy dojem|hypotez|interpretac).{0,45}(?:je fakt|za fakt|povazuji za fakt|povazujem za fakt)|(?:data|dukazy|dokazy).{0,35}(?:ignoruji|ignorujem|neberu v uvahu|neberiem do uvahy)/u.test(text);
  const hypothesisOrBias = !rejectsVerification
    && /(?:mam hypotezu|je to hypoteza|muze to byt muj prvni dojem|moze to byt moj prvy dojem|bias|projekc|moja interpretacia|moje interpretace|mohu byt ovlivnen|mozem byt ovplyvnen|oddelme fakt|co su data|co jsou data|ake su dokazy|jake jsou dukazy)/u.test(text);
  const learningAction = !rejectsVerification
    && /(?:overme|overim|overime|otazkou over|otestovat|otestujeme|co by (?:ho|to) vyvratilo|superviz|nabuduce si postrazim|priste si ohlidam|v dalsom pokuse|v dalsim pokusu|co tomu odporuje|vynimk|vyjimk)/u.test(text);
  return Object.freeze({ hypothesisOrBias, learningAction, complete: hypothesisOrBias && learningAction });
}

export function assessCoachEvidenceRelevance({ label, quote, turnIndex, messages = [] } = {}) {
  const competency = coachCompetencyForCriterion(label);
  const turns = indexedCoachStudentTurns(messages);
  const turn = turns.find(candidate => candidate.index === Number(turnIndex));
  if (!turn) {
    return { relevant: false, competencyId: competency?.id || null, reason: 'invalid_turn_index' };
  }
  if (!evidenceIncludes(turn.text, quote)) {
    return { relevant: false, competencyId: competency?.id || null, reason: 'turn_quote_mismatch' };
  }
  if (!competency) {
    return { relevant: false, competencyId: null, reason: 'unmapped_criterion' };
  }

  const quotedFailure = detectCoachCriticalFailures(messages).some(failure => (
    failure.studentTurnIndex === turn.index && evidenceIncludes(failure.quote, quote)
  ));
  if (quotedFailure) {
    return { relevant: false, competencyId: competency.id, reason: 'critical_failure_is_not_positive_evidence' };
  }

  const relevant = evidenceMatchesCompetency(competency.id, {
    criterion: normalizeCoachText(label),
    quote: normalizeCoachText(quote),
    rawQuote: String(quote || ''),
    previous: normalizeCoachText(turn.previousCounterpartText),
    later: normalizeCoachText(turn.laterCounterpartText),
  });
  return {
    relevant,
    competencyId: competency.id,
    reason: relevant ? null : 'semantic_mismatch',
  };
}

export function detectCoachCriticalFailures(messages = []) {
  const failures = [];
  // A direct or passive suicide-risk disclosure stays active until the client
  // has explicitly clarified low immediate risk AND the coach has anchored a
  // concrete human-support plan. One screening question alone must never turn
  // the risk off, but a genuinely resolved safety sequence must not make every
  // later supportive turn look like a new critical failure.
  let suicideRiskActive = false;
  const turns = indexedCoachStudentTurns(messages);
  // Security scanning deliberately starts from every raw user turn. Only
  // after all standalone critical checks have run may a genuine standalone
  // administrative command be skipped from the contextual/evidence logic.
  // This is defense in depth on top of the anchored administrative grammar.
  for (const rawTurn of rawCoachUserTurns(messages)) {
    const turn = rawTurn.administrative
      ? Object.freeze({
        ...rawTurn,
        index: turns.length + 1,
        reference: `RAW${rawTurn.messageIndex + 1}`,
      })
      : rawTurn;
    const text = normalizeCoachText(turn.text);
    const previous = normalizeCoachText(turn.previousCounterpartText);

    if (isClinicalOverreach(text) || isContextualClinicalOverreach(previous, text)) {
      failures.push(criticalFailure('clinical_scope_breach', 'ethical_boundaries', turn));
    }
    if (isConfidentialityBreach(text) || isContextualConfidentialityBreach(previous, text)) {
      failures.push(criticalFailure('confidentiality_breach', 'ethical_boundaries', turn));
    }
    if (isOutcomeGuarantee(text) || isContextualOutcomeGuarantee(previous, text)) {
      failures.push(criticalFailure('outcome_guarantee', 'ethical_boundaries', turn));
    }
    if (isFalseCredentialClaim(text) || isContextualFalseCredentialClaim(previous, text)) {
      failures.push(criticalFailure('false_credential_claim', 'ethical_boundaries', turn));
    }
    if (overridesClientConsent(text)) {
      failures.push(criticalFailure('client_autonomy_override', 'refusal_autonomy', turn));
    }
    if (ignoresClientCorrection(text)) {
      failures.push(criticalFailure('alliance_repair_refused', 'alliance_repair', turn));
    }
    if (dismissesClientAnswer(text)) {
      failures.push(criticalFailure('client_contempt', 'questions', turn));
    }
    if (imposesCoachDecision(text)) {
      failures.push(criticalFailure('client_decision_takeover', 'refusal_autonomy', turn));
    }
    if (/(?:data|dukazy|dokazy).{0,35}(?:ignoruji|ignorujem|neberu v uvahu|neberiem do uvahy)/u.test(text)) {
      failures.push(criticalFailure('evidence_integrity_breach', 'reflection', turn));
    }

    // A pure administrative command carries no coaching act. It was still
    // scanned above, but must not become evidence or a contextual intervention.
    if (rawTurn.administrative) continue;

    if (hasSuicideRiskSignal(previous)) suicideRiskActive = true;

    const clarifiedLowImmediateRisk = suicideRiskActive
      && hasClarifiedLowImmediateSuicideRisk(previous);
    const closesSafetyLoop = clarifiedLowImmediateRisk
      && hasConcreteSuicideSafetySupportPlan(text)
      && !continuesOrdinaryCoachingDuringSuicideRisk(text);

    if (isExplicitRefusal(previous) && isCoerciveContinuation(text)) {
      failures.push(criticalFailure('ignored_explicit_refusal', 'refusal_autonomy', turn));
    }
    if (asksCoachToDecide(previous) && takesDecisionFromClient(text)) {
      failures.push(criticalFailure('client_decision_takeover', 'refusal_autonomy', turn));
    }
    if (suicideRiskActive
      && (!(hasProfessionalSuicideRiskResponse(text) || closesSafetyLoop)
        || continuesOrdinaryCoachingDuringSuicideRisk(text))) {
      failures.push(criticalFailure('suicide_risk_response_missing', 'ethical_boundaries', turn));
    }
    if (closesSafetyLoop) suicideRiskActive = false;
  }

  // Screening is the beginning of a safety response, not its completion. If
  // the simulation ends before the client explicitly clarifies immediate risk
  // and the coach anchors concrete human support, an all-PROKÁZÁNO debrief must
  // never turn that unfinished sequence into passport or certificate evidence.
  // Also catch a risk disclosure that is followed only by the administrative
  // “ukončuji simulaci” message, which is intentionally excluded from S-turns.
  const lastSubstantiveMessage = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => cleanCoachText(message?.content)
      && !(message?.role === 'user' && isTrainingAdministrativeTurn(message.content)));
  if (lastSubstantiveMessage?.role === 'assistant'
    && hasSuicideRiskSignal(normalizeCoachText(lastSubstantiveMessage.content))) {
    suicideRiskActive = true;
  }
  if (suicideRiskActive && !failures.some(failure => failure.code === 'suicide_risk_response_missing')) {
    const lastTurn = turns.at(-1) || Object.freeze({
      index: 1,
      reference: 'S1',
      text: 'Simulace skončila bez dokončeného bezpečnostního postupu.',
    });
    failures.push(criticalFailure('suicide_risk_response_missing', 'ethical_boundaries', lastTurn));
  }
  return dedupeFailures(failures);
}

function evidenceMatchesCompetency(competencyId, context) {
  const { criterion, quote, rawQuote, previous, later } = context;
  if (!quote || quote.split(' ').length < 3) return false;

  if (competencyId === 'contract') {
    if (/^(?:co|jak|ako|aky|jaky) (?:je|byl|bol) (?:vysledek|vysledok|cil|ciel|zakazka|zmluva)$/u.test(quote)) return false;
    const overridesClientPurpose = /(?:na (?:tve|tvoji|vasi) odpovedi (?:vubec )?nezalezi|(?:cilem|cielom) (?:tohoto |naseho )?(?:rozhovoru )?je (?:muj|moj|moje|moja|nas|nasa) (?:prodej|predaj|zisk|vysledek|vysledok))/u.test(quote);
    if (overridesClientPurpose) return false;
    const { purpose, successCriterion } = assessCoachContractSubcriteria(quote);
    if (/jasny kontrakt a vysledek rozhovoru/u.test(criterion)) {
      return purpose && successCriterion;
    }
    return /(?:dnesni|dnes|tohoto|naseho|zbyvajiciho) (?:cil|zakazk|vysledok|vysledek|rozhovor|sezeni)/u.test(quote)
      || /(?:co|jak|podle coho|podla coho|podle ceho|s cim).{0,70}(?:uzitecn|uzitocn|vysledok|vysledek|odejit|odist|poznate|venovat|pracovat)/u.test(quote)
      || /(?:pojdme|mozeme|muzeme|navrhujem|navrhuji).{0,55}(?:ujasnit|dohodnut|dohodnout|zvolit|vratit k).{0,45}(?:cil|zakazk|tema|cas)/u.test(quote)
      || /plati.{0,80}(?:zakazk|cil|vysledok|vysledek|dohod)/u.test(quote);
  }

  if (competencyId === 'active_listening') {
    const reflectivePattern = /(?:slysim|pocujem|rikate|rikas|hovorite|hovoris|vravite|vravis|rozumim tomu tak|rozumiem tomu tak|zachycuji|zachytavam|zni to|ak (?:ti|vam) spravne rozumiem|jestli (?:ti|vam) spravne rozumim|z tvych slov|z vasich slov|to co popisujete|to co popisujes|opravte me|oprav ma|oprav me)/u;
    const clauses = [...String(rawQuote || quote).matchAll(/([^;.!?]+)([;.!?]+|$)/gu)]
      .map(match => ({ text: normalizeCoachText(match[1]), question: match[2].includes('?') }))
      .filter(clause => clause.text);
    const reflectiveIndex = clauses.findIndex(clause => reflectivePattern.test(clause.text));
    const reflectiveClause = reflectiveIndex >= 0 ? clauses[reflectiveIndex].text : quote;
    const reflective = reflectivePattern.test(reflectiveClause);
    const followsClient = meaningfulOverlap(reflectiveClause, previous) >= 2;
    const anticipatesFutureDisclosure = !followsClient && meaningfulOverlap(reflectiveClause, later) >= 1;
    const detachedOffTopicAppendix = reflectiveIndex >= 0
      && clauses.slice(reflectiveIndex + 1)
        .some(clause => isDetachedOffTopicListeningClause(clause.text, previous));
    return reflective && followsClient && !anticipatesFutureDisclosure && !detachedOffTopicAppendix;
  }

  if (competencyId === 'questions') {
    return isSingleOpenQuestion(rawQuote)
      && !isLeadingOrDoubleQuestion(rawQuote)
      && !dismissesClientAnswer(quote);
  }

  if (competencyId === 'intervention_choice') {
    if (overridesClientConsent(quote)) return false;
    const subcriteria = assessCoachInterventionChoiceSubcriteria(quote);
    const choice = subcriteria.consent || /(?:pokud (?:vam|ti) to sedi|ak (?:vam|ti) to sedi|nabizim|ponukam|navrhuji|navrhujem)/u.test(quote);
    const { method, purpose } = subcriteria;
    const rejectsMechanicalUse = /(?:odlozme|nemusime|nebudeme|inak|jinak|bez ramce)/u.test(quote);
    const groundedInClientContext = meaningfulOverlap(quote, previous) >= 1
      || hasCoachStemPrefixOverlap(quote, previous)
      || (/(?:priorit|trid|zasadn)/u.test(quote) && /(?:driv|skor|priorit|resit|riesit)/u.test(previous))
      || (!previous && subcriteria.complete);
    return groundedInClientContext
      && ((choice && method && (purpose || rejectsMechanicalUse)) || (method && purpose && rejectsMechanicalUse));
  }

  if (competencyId === 'refusal_autonomy') {
    if (overridesClientConsent(quote)) return false;
    const subcriteria = assessCoachRefusalAutonomySubcriteria(quote);
    const respectsChoice = subcriteria.respectsRefusal
      || /(?:mozete odmietnut|mozes odmietnut|muzete odmitnout|muzes odmitnout|co (?:byste|bys) chtel|co by ste chceli|chcete radeji|chces radeji|chcete radsej|chces radsej|vratime sa|vratime se)/u.test(quote);
    const refusalCriterion = /(?:odmitnut|stahnout|nesedi|zastaveni|nepokracovat)/u.test(criterion);
    return respectsChoice && (!refusalCriterion || isExplicitRefusal(previous));
  }

  if (competencyId === 'alliance_repair') {
    const ownsError = /(?:mate pravdu|mas pravdu|dekuji za oprav|diky za oprav|dakujem za oprav|rozumim te oprave|rozumiem tej oprave|omlouvam se|ospravedlnujem sa|pridala jsem|pripisala som|vlozila jsem|vlozila som|domyslela jsem|domyslela som|spletla jsem|pomylila som sa|to byla moje interpretace|to bola moja interpretacia|opravim|vratim sa k tomu co ste povedali|vratim se k tomu co jste rekla|vratim se k tomu co jsi rekla)/u.test(quote);
    const correctionBefore = /(?:to jsem nerekl|to jsem nerekla|to som nepovedal|to som nepovedala|takhle jsem to nemyslel|takhle jsem to nemyslela|takto som to nemyslel|takto som to nemyslela|nesedi mi|mi nesedi|nepocuvate|nepocuvas|neposlouchate|neposlouchas|ako to mozete vediet|ako to mozes vediet|jak to muzete vedet|jak to muzes vedet|oprav)/u.test(previous);
    const defendsInterpretation = /(?:ale|avsak|jenze).{0,45}(?:moje|moja) (?:interpretace|interpretacia).{0,25}(?:byla|bola|je) (?:spravna|presna|pravdiva)|(?:stejne|aj tak).{0,30}(?:mam pravdu|mala jsem pravdu|mal som pravdu)|(?:vas|vasi|tvou|tvoji|vasu|tvoju) oprav[a-z]*.{0,25}(?:ignoruji|ignorujem|nebudu respektovat|nebudem respektovat)/u.test(quote);
    return ownsError && correctionBefore
      && !defendsInterpretation
      && !/(?:mrzi me ze to tak vnimate|mrzi me ze to tak vnimas)/u.test(quote);
  }

  if (competencyId === 'ethical_boundaries') {
    if (isClinicalOverreach(quote) || isConfidentialityBreach(quote) || isOutcomeGuarantee(quote) || isFalseCredentialClaim(quote)) return false;
    const boundary = /(?:v ramci koucinku|neni diagnoz|nie je diagnoz|nemohu diagnostikovat|nemozem diagnostikovat|nebudu diagnostikovat|nebudem diagnostikovat|nebudu zpracovavat traum|nebudem spracovavat traum|traum[a-z]*.{0,50}(?:zpracovavat nebudu|spracovavat nebudem)|terapeut|psycholog|lekar|krizov|sebevraz|samovraz|bezprostredni bezpeci|bezprostredne bezpecie|bezprostredni ohrozeni|bezprostredne ohrozenie|112|155|odbornou pomoc|odbornu pomoc|odbornik|duvern|dovern|obsah sezeni (?:nesdilim|nepredavam|nezverejnim)|obsah sedenia (?:nezdielam|neodovzdam)|poznamky (?:nesdilim|nepredavam|nezdielam|neodovzdam)|bez souhlasu (?:nesdilim|neposkytnu)|bez suhlasu (?:nezdielam|neposkytnem)|reporting|minimalizace dat|minimalizacia dat|vysledok (?:nemozem|neda sa) (?:garantovat|zarucit)|vysledek (?:nemohu|nelze) (?:garantovat|zarucit)|nemozem (?:garantovat|zarucit)|nemohu (?:garantovat|zarucit)|interny certifikat|interni certifikat|nie je akreditac|neni akreditac|pravnik|financny poradca|financni poradce|zastavime techniku|neklinicky ciel|neklinicky cil)/u.test(quote);
    const contextRequired = /(?:duvern|report|data|sponzor|obsah|poznamk)/u.test(criterion);
    const contextPresent = /(?:firma|hr|sponzor|report|obsah sezeni|poznamk|duvern)/u.test(previous);
    return (boundary || assessCoachEthicalBoundarySubcriteria(quote).boundary)
      && (!contextRequired || contextPresent);
  }

  if (competencyId === 'outcome') {
    if (imposesCoachDecision(quote)) return false;
    if (/^(?:co|jak|ako|aky|jaky) (?:je|byl|bol) (?:dalsi|dalsi konkretny|konkretni) krok$/u.test(quote)) return false;
    const outcome = /(?:dalsi krok|konkretni krok|konkretny krok|co udelate|co udelas|co urobite|co urobis|kdy to|kedy to|podle ceho poznate|podle ceho poznas|podla coho spoznate|podla coho spoznas|jak poznate|jak poznas|ako spoznate|ako spoznas|co si odnasite|co si odnasas|na cem se domlouvame|na com sa dohodneme|co si volite|co si volis|maly experiment|ako ho vyhodnotite|ako ho vyhodnotis|jak ho vyhodnotite|jak ho vyhodnotis|co je vo vasom vplyve|co je v tvojom vplyve|co je ve vasem vlivu|co je ve tvem vlivu)/u.test(quote);
    const clientOwned = assessCoachOutcomeSubcriteria(quote).clientOwned;
    if (/klientkou zvolen(?:y|y a)? overitelny dalsi krok/u.test(criterion)) {
      return assessCoachOutcomeSubcriteria(quote).relevant;
    }
    return outcome && clientOwned;
  }

  if (competencyId === 'reflection') {
    const subcriteria = assessCoachReflectionSubcriteria(quote);
    return subcriteria.hypothesisOrBias || subcriteria.learningAction
      || /(?:nechcem si domyslat|nechci si domyslet|vsimam si ze si|muze me ovlivnovat|moze ma ovplyvnovat)/u.test(quote);
  }

  return false;
}

function isSingleOpenQuestion(rawQuote) {
  const normalized = normalizeCoachText(rawQuote);
  if ((String(rawQuote || '').match(/\?/gu) || []).length !== 1) return false;
  return /(?:^|\b)(?:co|cim|ako|jak|aky|aka|ake|jaky|jaka|jake|ktory|ktora|ktore|ktery|ktera|ktere|v com|v cem|podla coho|podle ceho|o com|o cem|kde|kto|kdo)\b/u.test(normalized);
}

function isLeadingOrDoubleQuestion(rawQuote) {
  const normalized = normalizeCoachText(rawQuote);
  return /\b(?:a|alebo|nebo)\s+(?:co|ako|jak|aky|aka|ake|jaky|jaka|jake|ktory|ktora|ktore|ktery|ktera|ktere|v com|v cem|podla coho|podle ceho|o com|o cem|kde|kto|kdo)\b/u.test(normalized)
    || /(?:co kdyby(?:ste|s)?|nemel[ao]? by|nebylo by lepsi|proc proste|souhlasite ze|souhlasis ze|neni pravda ze|zkusite tedy|zkusis tedy)/u.test(normalized);
}

function dismissesClientAnswer(text) {
  return /(?:je mi|je nam|je mi to|mne je|je mi uplne).{0,20}(?:jedno|ukradene)|(?:(?:tvoje|vase|vas|tva)\s+)?odpoved[a-z]*.{0,30}(?:me nezajima|ma nezaujima|ignoruji|ignorujem|nezalezi)/u.test(text);
}

function overridesClientConsent(text) {
  return /(?:vas|vas|tvuj|tvoje|tvuj|vas souhlas|suhlas).{0,28}(?:nepotrebuji|nepotrebujem|neni potreba|netreba)|(?:bez|i bez).{0,18}(?:vaseho|tveho|vasho|tvojho)?\s*(?:souhlasu|suhlasu).{0,30}(?:pokracujeme|pokracovat|udelame|urobime|pouzijeme)/u.test(text);
}

function ignoresClientCorrection(text) {
  return /(?:vas|vasi|tvou|tvoji|vasu|tvoju) oprav[a-z]*.{0,28}(?:ignoruji|ignorujem|nebudu respektovat|nebudem respektovat)|(?:opravu|korekci|opravu).{0,25}(?:ignoruji|ignorujem)/u.test(text);
}

function imposesCoachDecision(text) {
  return /(?:stejne|aj tak).{0,35}(?:udelate|udelas|urobite|urobis).{0,25}(?:co rikam|co reknu|co hovorim|co poviem)|(?:rozhodnuti|rozhodnutie).{0,30}(?:udelam za vas|urobim za vas|je na mne)/u.test(text);
}

function isClinicalOverreach(text) {
  const condition = '(?:adhd|ocd|autis[a-z]*|autiz[a-z]*|schizofren[a-z]*|narcis[a-z]*\\s+poruch[a-z]*(?:\\s+osobnost[a-z]*)?|depres[a-z]*|uzkostn[a-z]*\\s+poruch[a-z]*|panick[a-z]*\\s+poruch[a-z]*|bipolar[a-z]*(?:\\s+poruch[a-z]*)?|hranicn[a-z]*\\s+poruch[a-z]*(?:\\s+osobnost[a-z]*)?|poruch[a-z]*\\s+prijmu\\s+potrav[a-z]*|psych[o]z[a-z]*|ptsd)';
  const diagnosis = text.split(/\b(?:ale|avsak|jenze)\b/u).some(clause => {
    const directPerson = new RegExp(`\\b(?:trpis|trpite|mas|mate)(?:\\s+diagnozu)?\\s+${condition}\\b`, 'u').exec(clause);
    const deictic = new RegExp(`\\b(?:(?:tohle|toto|to)\\s+je|je\\s+(?:to|toto)|jedna\\s+se\\s+o|ide\\s+o)\\s+(?:(?:jednoznacne|zretelne|jasne|velka)\\s+){0,2}${condition}\\b`, 'u').exec(clause);
    const soundsLike = new RegExp(`\\b(?:to|toto).{0,12}\\b(?:zni|znie)\\b\\s+(?:jako|ako)\\s+${condition}\\b`, 'u').exec(clause);
    const diagnosisLabel = new RegExp(`\\b(?:diagnoza|diagnostika)\\s+je\\s+${condition}\\b`, 'u').exec(clause);
    const inferredDiagnosis = [
      new RegExp(`\\b(?:vypada|vyzera)\\s+(?:to\\s+)?na\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:tohle|toto|to)\\s+(?:bude|je zrejme)\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:vase|tvoje|vaše)\\s+(?:potize|tazkosti|problemy).{0,24}(?:odpovidaji|zodpovedaju)\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:jste|jsi|ste|si)\\s+(?:v\\s+)?${condition}\\b`, 'u'),
      new RegExp(`\\b(?:mate|mas)\\s+(?:jasne|typicke|zretelne)\\s+(?:priznaky|symptomy).{0,20}${condition}\\b`, 'u'),
      new RegExp(`\\b(?:diagnostikovala|diagnostikoval|diagnostikujem)\\s+(?:bych|by som)?\\s*(?:to|vas|ta)?\\s*(?:jako|ako)\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:podle vseho|podla vsetkeho).{0,18}(?:jde|ide)\\s+o\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:to|toto).{0,12}(?:ukazuje|poukazuje)\\s+na\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:splnujete|splnas|splnate)\\s+(?:jasna\\s+)?kriteria\\s+pro\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:podle|podla)\\s+(?:tohoto\\s+)?(?:popisu|opisu).{0,30}(?:u vas|u tebe|u teba)?\\s*(?:vidim|vidime)\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:vidim|vidime)\\s+(?:u vas|u tebe|u teba)\\s+${condition}\\b`, 'u'),
      new RegExp(`\\b(?:tohle|toto|to)\\s+(?:vypada|vyzera)\\s+(?:jako|ako)\\s+${condition}\\b`, 'u'),
    ].map(pattern => pattern.exec(clause)).find(Boolean);
    const diagnosticAct = /\b(?:diagnostikuji|diagnostikujem|stanovuji.{0,20}diagnoz[a-z]*|stanovujem.{0,20}diagnoz[a-z]*|(?:mohu|mozeme|mozem|budu|budem).{0,18}diagnostikovat)\b/u.exec(clause);
    const declaration = directPerson || deictic || soundsLike || diagnosisLabel || inferredDiagnosis || diagnosticAct;
    if (!declaration) return false;
    const prefix = clause.slice(Math.max(0, declaration.index - 70), declaration.index);
    const explicitlyUncertain = /(?:mozna|mozno|asi|snad|je mozne|je mozno)\s*(?:ze|ci)?\s*$/u.test(prefix)
      || /(?:nevim|neviem|nemohu|nemozem|nelze|neda se|neda sa).{0,45}(?:zda|jestli|ci|ze)\s*$/u.test(prefix)
      || hasNegatedAssertionPrefix(prefix);
    return !explicitlyUncertain;
  });
  const treatment = text.split(/\b(?:ale|avsak|jenze)\b/u).some(clause => {
    const refusesTreatmentPromise = /\b(?:nemohu|nemozem|nemuzeme|nebudu|nebudem|nebudeme|nelze|neda se|neda sa).{0,55}(?:lec|liec|terap|odstran|vylec|vyliec|vymaz|preprogram|prepis|zprac|sprac).{0,35}(?:traum|symptom|depres|uzkost|ptsd)/u.test(clause);
    const postposedRefusal = /\b(?:lec|liec|terap|odstran|vylec|vyliec|vymaz|preprogram|prepis|zprac|sprac)[a-z]*.{0,25}(?:nemohu|nemozem|nemuzeme|nebudu|nebudem|nebudeme|nelze|neda se|neda sa)\b/u.test(clause);
    if (refusesTreatmentPromise || postposedRefusal) return false;
    const establishedTreatment = /\b(?:budu vas lecit|budu te lecit|budem vas liecit|budem ta liecit|vylecim|vyliecim|vylecime|vyliecime|pomohu.{0,35}(?:vylecit|lecbou|terapii|zpracovat traum)|pomozem.{0,35}(?:vyliecit|liecbou|terapiou|spracovat traum)|provedu.{0,30}(?:lecbou|terapii)|prevediem.{0,30}(?:liecbou|terapiou)|zahajime.{0,24}(?:lecbu|liecbu).{0,30}traum|udelame (?:psycho)?terapii|urobime (?:psycho)?terapiu|vymazeme traum|prepiseme traum|preprogramujeme traum|zpracujeme traum|spracujeme traum|odstranime.{0,30}(?:traum|symptom)|traum[a-z]*.{0,35}(?:zpracujeme|spracujeme|prepiseme|vymazeme|vyresime|vyriesime|odstranime|vylecime|vyliecime|zbavime|prestane (?:vas|ta|te) trapit|uz (?:vas|ta|te) nebude trapit)|(?:psycho)?terapii.{0,35}traum[a-z]*.{0,20}(?:vyresime|zpracujeme)|(?:psycho)?terapiou.{0,35}traum[a-z]*.{0,20}(?:vyriesime|spracujeme)|otevreme traumatickou vzpominku|otvorime traumaticku spomienku|nemusite k terapeutovi|nemusis k terapeutovi)\b/u.test(clause);
    const methodCurePromise = /\b(?:hypnoz[a-z]*|nlp|cvicen[a-z]*|technik[a-z]*|metod[a-z]*|program[a-z]*|preprogram[a-z]*)(?:.{0,55}\b(?:odstran[a-z]*|vylec[a-z]*|vyliec[a-z]*|vymaz[a-z]*|prepis[a-z]*|preprogram[a-z]*|zbav[a-z]*).{0,45}\b(?:traum[a-z]*|symptom[a-z]*|depres[a-z]*|uzkost[a-z]*|ptsd)|.{0,50}\b(?:traum[a-z]*|symptom[a-z]*|depres[a-z]*|uzkost[a-z]*|ptsd).{0,40}\b(?:odstran[a-z]*|vylec[a-z]*|vyliec[a-z]*|vyres[a-z]*|vyries[a-z]*|zbav[a-z]*|vymaz[a-z]*|prepis[a-z]*|prestane[a-z]*.{0,12}trapit))\b/u.test(clause);
    return establishedTreatment || methodCurePromise;
  });
  const medicationDirection = /\b(?:prestan|vysad|sniz|zniz|zmens|zvys|neber|nedav|nedaj|vynech).{0,35}(?:leky|lieky|davk|tablet|medikaci|medikaciu|antidepresiv)/u.test(text)
    || /\b(?:leky|lieky|davk|tablet|medikaci|medikaciu|antidepresiv).{0,35}\b(?:prestan|vysad|sniz|zniz|zmens|zvys|neber|nedav|nedaj|vynech)/u.test(text);
  const defersMedicationDecision = /\b(?:o tom )?(?:zda|ci).{0,35}(?:prestat|vysadit|snizit|znizit|zvysit|nebrat|vynechat).{0,35}(?:rozhodne|ma rozhodnout|ma rozhodnut).{0,20}(?:lekar|psychiatr)\b/u.test(text);
  return diagnosis || treatment || (medicationDirection && !defersMedicationDecision);
}

function hasNegatedAssertionPrefix(prefix) {
  return /(?:nemyslim si|nemyslime si|netvrdim|netvrdime|neni pravda|nie je pravda|nerikam|nehovorim|nepovedala bych|nepovedal bych|nepovedala by som|nepovedal by som|pochybuji|pochybujem|nemohu rict|nemozem povedat)\s*(?:ze|ci)?\s*$/u.test(prefix);
}

function isConfidentialityBreach(text) {
  const sensitiveContext = /(?:\bobsah\b|obsah sezeni|obsah sedenia|obsah.{0,24}(?:rozhovor|konverzac|koucink)|(?:zaznam|nahravk).{0,24}(?:hovor|rozhovor|sezen|seden|setkan|stretn)|poznamk|prepis|odpovedi|odpovede|zprav|sprav|nas rozhovor|cely rozhovor|co jste rekla|co jsi rekla|co ste povedali|co si povedala)/u.test(text);
  return text.split(/\b(?:ale|avsak|jenze)\b/u)
    .some(clause => isConfidentialityClauseBreach(clause, sensitiveContext));
}

function isConfidentialityClauseBreach(text, sensitiveContext = false) {
  const sharingPattern = /\b(?:poslu|poslem|odeslu|odoslem|predam|odovzdam|nasdilim|zazdielam|sdilim|zdielam|sdelim|ukazu|ukazem|poviem|nahraju|nahram|reportuji|reportujem|reportovat|preposlu|preposlem|zpristupnim|spristupnim)\b/u;
  const thirdPartyReceivesPattern = /\b(?:hr|firma|vedeni|zamestnavatel|zamestnavatelovi|sponzor|manager|manazer|nadrizeny|nadriadeny|personalistka|personalni oddeleni).{0,35}\b(?:dostane|dostanu|obdrzi|ziska|ziskaju|uvidi|precte|precita)\b/u;
  const thirdParty = /\b(?:hr|firme|firmy|vedeni|zamestnavateli|zamestnavatelovi|sefovi|sponzorovi|managerovi|manazerovi|nadrizenemu|nadriadenemu|personalistce|personalistovi|personalnimu oddeleni|personalnemu oddeleniu)\b/u.test(text);
  const sensitiveContent = sensitiveContext || /(?:obsah sezeni|obsah sedenia|obsah.{0,24}(?:rozhovor|konverzac|koucink)|(?:zaznam|nahravk).{0,24}(?:hovor|rozhovor|sezen|seden|setkan|stretn)|poznamk|prepis|odpovedi|odpovede|zprav|sprav|nas rozhovor|cely rozhovor|co jste rekla|co jsi rekla|co ste povedali|co si povedala)/u.test(text);
  const sharing = sharingPattern.exec(text);
  const thirdPartyReceives = thirdPartyReceivesPattern.exec(text);
  const recordingGiven = /\b(?:nahravk|zaznam).{0,70}\b(?:dam|predlozim).{0,40}\b(?:hr|vedeni|zamestnavateli|sefovi|sponzorovi|managerovi|manazerovi|nadrizenemu|nadriadenemu|personalistce|personalistovi)\b/u.exec(text);
  const disclosure = sharing || thirdPartyReceives || recordingGiven;
  if (!disclosure || !sensitiveContent || (!thirdParty && !thirdPartyReceives)) return false;
  const prefix = text.slice(Math.max(0, disclosure.index - 90), disclosure.index);
  if (hasNegatedAssertionPrefix(prefix)) return false;
  const informedConsent = /\b(?:jen|pouze|iba)\s+(?:po|s|se|so)\s+(?:vasim|tvym|vasim|vasim)?\s*(?:predchozim|vyslovnym|informovanym)?\s*(?:souhlasem|suhlasom)\b/u.test(text)
    || /\b(?:pokud|jestlize|ak)\s+(?:s tim )?(?:vyslovne )?(?:souhlasite|souhlasis|suhlasite|suhlasis)\b/u.test(text);
  const overridesConsent = /\b(?:bez (?:souhlasu|suhlasu|nej|neho)|i bez|aj bez)\b/u.test(text);
  return !informedConsent || overridesConsent;
}

function isOutcomeGuarantee(text) {
  const outcome = '(?:vysled[a-z]*|zmenu prace|zmenite praci|zmenis praci|najd(?:ete|es).{0,20}praci|prijem|obrat|trzb|vydel|zarob|zisk[a-z]*.{0,20}klient|budete mit.{0,20}klient|budete mat.{0,20}klient|klient[a-z]*|zdvojnasob|uspech|uspejete|uspejes|vyjde|fungovat|uzdrav|zbavite se|dokazete|dokazes)';
  return text.split(/\b(?:ale|avsak|jenze)\b/u).some(clause => {
    if (isNegatedOutcomePromise(clause)) return false;
    const explicit = new RegExp(`\\b(?:garantuji|garantujeme|garantujem|zarucuji|zarucujeme|zarucujem|slibuji|slibujeme|slubujem|slubujeme|zajistim|zajistime|zabezpecim|zabezpecime|davam.{0,20}(?:sve|svoje) slovo).{0,100}${outcome}`, 'u').test(clause)
      || new RegExp(`\\b(?:garantovan[a-z]*|zarucene|zarucene).{0,45}${outcome}|${outcome}.{0,45}(?:garantovan[a-z]*|zarucene|zarucene)`, 'u').test(clause);
    if (explicit) return true;
    const certainty = new RegExp(`(?:\\b(?:urcite|jiste|jednoznacne|samozrejme)|na 100(?: procent)?).{0,100}${outcome}`, 'u').test(clause)
      || new RegExp(`${outcome}.{0,60}(?:\\b(?:urcite|jiste|samozrejme)|na 100(?: procent)?|o to se postaram|o to sa postaram)`, 'u').test(clause)
      || /\b(?:s touto|s touto|s touto|po tomto|po tomto|diky teto|vdaka tejto).{0,35}(?:metod|program|technik)[a-z]*.{0,35}(?:uspejete|uspejes|budete vydelavat|budete zarabat|ziskate klient)/u.test(clause);
    const timeSpan = '(?:(?:do|za|behem|pocas)\\s+(?:[a-z0-9]+\\s+)?(?:dni|dnu|den|tydn[a-z]*|tyzdn[a-z]*|mesic[a-z]*|mesiac[a-z]*|roku)|za\\s+ctvrt\\s+roku)';
    const definiteTimedOutcome = new RegExp(`\\b${timeSpan}.{0,55}(?:budete|budes|ziskate|ziskas|najdete|najdes|zdvojnasobite|zdvojnasobis).{0,45}(?:novou praci|novu pracu|praci|pracu|klient|prijem|obrat|trzb|vydel|zarob)`, 'u').test(clause);
    const providerTimedOutcome = /\b(?:behem|pocas|do) (?:jednoho |jedneho |1 |tri |troch |3 )?(?:mesic|mesiac)[a-z]*.{0,45}(?:vam|ti)?\s*(?:ziskam|ziskame|privedu|privedieme|zajistim|zabezpecim).{0,30}klient/u.test(clause);
    const providerTimedEarnings = /\b(?:za|behem|pocas|do) (?:jednoho |jedneho |1 )?(?:mesic|mesiac)[a-z]*.{0,45}(?:vam|ti)?\s*(?:vydelam|vydelame|zarobim|zarobime).{0,35}(?:tisic|tisic|eur|kc|korun|pen|prijem)/u.test(clause);
    return certainty || definiteTimedOutcome || providerTimedOutcome || providerTimedEarnings;
  });
}

function isNegatedOutcomePromise(clause) {
  return /\b(?:nemohu|nemozem|nelze|neda se|neda sa|nebudu|nebudem|negarantuji|negarantujem|nezarucuji|nezarucujem).{0,55}(?:garant|zaruc|slib|slub|jist|100)/u.test(clause)
    || /\b(?:garant|zaruc|slib|slub)[a-z]*.{0,45}(?:nemohu|nemozem|nelze|neda se|neda sa|nebudu|nebudem)\b/u.test(clause)
    || /\b(?:bylo by|bolo by).{0,25}(?:nepoctive|nezodpovedne|neseriozni).{0,25}(?:slibit|slubit|garantovat|zarucit)\b/u.test(clause)
    || hasNegatedAssertionPrefix(clause.slice(0, 90));
}

function isExplicitRefusal(text) {
  return /(?:nechci pokracovat|nechcem pokracovat|nechci.{0,24}(?:poustet|pustit|venovat|jit do (?:te|teto) otazk)\b|nechcem.{0,24}(?:pustat|pustit|venovat|ist do (?:tej|tejto) otazk)\b|(?:do|k) (?:te|teto|tej|tejto) otazk[a-z]*.{0,18}(?:nechci jit|nechcem ist)|nechci to|nechcem to|nechci tuhle|nechcem tuto|nechci zavrit|nechcem zavriet|nebudu pokracovat|nebudem pokracovat|nesedi mi|mi nesedi|je mi neprijemne|citim se neprijemne|citim sa neprijemne|citim se odpojene|citim sa odpojene|stop|zastav|odmitam|odmietam|otazku nechci|otazku nechcem|(?:techni|cvicen|otazk).{0,28}(?:nevracej|nevracaj)|(?:nevracej se|nevracaj sa).{0,28}(?:techni|cvicen|otazk)|(?:tohle|toto|tuto|to)\s+(?:cviceni|cvicenie|techniku).{0,24}(?:delat|robit)\s+(?:nebudu|nebudem))/u.test(text);
}

function isCoerciveContinuation(text) {
  return /\b(?:musite|musis|musime|potrebujete.{0,22}dokoncit|potrebujes.{0,22}dokoncit|potrebujete.{0,22}dokoncit|potrebujes.{0,22}dokoncit|vydrzte|vydrz|budeme pokracovat|pokracujte|pokracuj|je treba pokracovat|bez toho to nebude fungovat|je to nutne (?:pro|pre) metodu|zavrete oci|zavri oci|udelejte to presto|udelej to presto|skus.{0,20}napriek|zkus.{0,20}presto|(?:zkus|skus|zkusime|skusime).{0,18}(?:jeste jednou|este raz|jen jednou|iba raz)|dej tomu jeste sanci|daj tomu este sancu|(?:jeste|este) (?:to )?dokoncime|(?:stejne|aj tak).{0,35}(?:udelame|urobime|dokoncime|pokracujeme)|(?:dotahneme|dotiahneme).{0,25}(?:do konce|do konca)|(?:dokoncime|projdeme|prejdeme|pouzijeme).{0,25}(?:grow|ramec|techniku|cviceni|cvicenie|otazku))/u.test(text);
}

function asksCoachToDecide(text) {
  return /(?:rozhodn(?:i|ete|ite).{0,18}za (?:me|mna)|vyber.{0,24}za (?:me|mna)|rekni mi co mam udelat|povedz mi co mam urobit|ty mi rekni|ty mi povedz|mam.{0,35}(?:podepsat|podpisat|odejit|odist|dat vypoved|prijmout|prijat|odmitnout|odmietnut|rozvest|rozviest)|kolik si mam uctovat|kolko si mam uctovat)/u.test(text);
}

function takesDecisionFromClient(text) {
  return /\b(?:musite|musis|mel byste|mela byste|mel bys|mela bys|udelejte|udelej|urobte|urob|podepiste|podepis|podpiste|podpis|nepodepiste|nepodepis|nepodpiste|nepodpis|odejdete|odejdi|odidte|odid|zustante|zustan|zostante|zostan|rozvedte|rozved|rozidte se|rozid sa|vezmete|vezmi|prijmete|prijmi|odmitnete|odmitni|odmietnite|odmietni|kupte|kup|prodejte|prodej|predajte|predaj)\b/u.test(text)
    || /\b(?:urcite |jednoznacne )?(?:dejte|dej|dajte|daj) vypoved\b/u.test(text)
    || /\bza (?:me|mna)\b.{0,45}\b(?:dej vypoved|daj vypoved|odejdi|odid|zustan|zostan|podepis|podepsat|podpis|podpisat|nepodepis|nepodpis|prijmi|odmitni|odmietni|kup|prodej|predaj)\b/u.test(text)
    || /\b(?:jednoznacne|urcite|spravna volba|spravne rozhodnuti).{0,50}\b(?:podepsat|podpisat|odejit|odist|zustat|zostat|prijmout|prijat|odmitnout|odmietnut|koupit|kupit|prodat|predat)\b/u.test(text)
    || /\bna (?:vasem|tvem|vasom|tvojom) (?:miste|mieste) by(?:ch| som).{0,55}\b(?:podepsal|podepsala|podpisal|podpisala|odesel|odesla|odisiel|odisla|zustal|zustala|zostal|zostala|prijal|prijala|odmitl|odmitla|odmietol|odmietla|koupil|koupila|kupil|kupila|prodal|prodala|predal|predala)\b/u.test(text)
    || /^(?:ja )?by(?:ch| som) (?:to |ji |ho )?(?:podepsal|podepsala|podpisal|podpisala|prijal|prijala|odmitl|odmitla|odmietol|odmietla|koupil|koupila|kupil|kupila|prodal|prodala|predal|predala)\b/u.test(text)
    || /\b(?:nejlepsi|najlepsie) (?:bude|je)\b.{0,45}\b(?:podepsat|podpisat|odejit|odist|zustat|zostat|prijmout|prijat|odmitnout|odmietnut|koupit|kupit|prodat|predat)\b/u.test(text);
}

function isFalseCredentialClaim(text) {
  return text.split(/\b(?:ale|avsak|jenze)\b/u).some(isFalseCredentialClause);
}

function isFalseCredentialClause(text) {
  const claim = /(?:jsem|jsme|nas kurz je|certifikat je|certifikat.{0,25}\b(?:dava|udeli|poskytuje)\b|tento (?:kurz|vycvik)(?:.{0,20}\b(?:je|ma|dava|udeli|poskytuje)\b)|po kurz[ue] (?:budes|budete)|po absolvovani (?:ziskas|ziskate)|absolvovanim (?:ziskas|ziskate)).{0,90}(?:akreditovan[ay]|akreditaci|akreditaciu|statem uznavan[ay]|statom uznavan[ay]|statem uznavane opravneni|statom uznavane opravnenie|profesni opravneni.{0,25}(?:uznavane|uznane).{0,15}icf|profes(?:ne|ijne) opravnenie.{0,25}(?:uznavane|uznane).{0,15}icf|oficialni profesni kvalifikac|oficialni licenci kouce|oficialnu licenciu kouca|icf certifikovan[ay]|licencovan[ay] (?:koucka|kouc|coach)|opravneni kouce|opravnenie kouca)/u.exec(text);
  if (!claim) return false;
  const prefix = text.slice(Math.max(0, claim.index - 90), claim.index);
  if (hasNegatedAssertionPrefix(prefix)) return false;
  const negatedCredential = /\b(?:neni|nie je|neni to|nie je to|nikoli|nie|nejde o|nejde o)\b.{0,30}(?:akreditovan|akreditac|licenc|opravnen|kvalifikac|icf)/u.test(claim[0])
    || /\b(?:vzdelavaci|interni|interny)\b.{0,45}\b(?:nikoli|nie|neni|nie je|nejde o)\b.{0,30}(?:akreditovan|akreditac|vycvik|licenc)/u.test(text);
  return !negatedCredential;
}

function affirmativeAssent(text) {
  if (!/^(?:ano|urcite|jiste|samozrejme|samozrejme ze ano|plati)\b/u.test(text)) return false;
  return !/(?:\bne\b|nemohu|nemozem|nebudu|nebudem|nelze|neda sa|nesmim|nesmiem|neposlu|neposlem|nepredam|neodovzdam|negarantuji|negarantujem|nezarucuji|nezarucujem|neni|nie je|nejde o)/u.test(text);
}

function isContextualClinicalOverreach(previous, text) {
  const asksMedicationDirection = /(?:mam|mame|mám|máte|mam).{0,28}(?:vysadit|prestat brat|snizit|znizit|zvysit|nebrat).{0,28}(?:leky|lieky|medikaci|medikaciu|antidepresiv)|(?:leky|lieky|medikaci|medikaciu|antidepresiv).{0,28}(?:vysadit|prestat brat|snizit|znizit|zvysit|nebrat)/u.test(previous);
  const givesMedicationDirection = /\b(?:vysadte|vysad|prestante|prestan|snizte|sniz|znizte|zniz|zvyste|zvys|neberte|neber)\b/u.test(text);
  return asksMedicationDirection && affirmativeAssent(text) && givesMedicationDirection;
}

function isContextualConfidentialityBreach(previous, text) {
  const requestsDisclosure = /(?:posl|odesl|preda|odovzda|nasdil|zazdiel|ukaz|report).{0,70}(?:hr|firme|vedeni|zamestnavateli|zamestnavatelovi|sefovi|sponzorovi|managerovi|manazerovi|nadrizenemu|nadriadenemu|personalistce|personalistovi)/u.test(previous)
    && /(?:obsah|poznamk|prepis|odpovedi|odpovede|sezeni|sedenia|rozhovoru)/u.test(previous);
  const asksAboutDisclosure = /(?:hr|firma|vedeni|zamestnavatel|sef|sponzor|manager|manazer|nadrizen|personalist)/u.test(previous)
    && /(?:co.{0,35}(?:reknete|poviete|sdilite|zdielate|poslete|poslete)|(?:reknete|poviete|sdilite|zdielate).{0,35}(?:mu|ji|im|jim)|dozvi|dozvie|dostane)/u.test(previous);
  const acceptsDisclosure = /\b(?:reknu|poviem|poslu|poslem|odeslu|odoslem|predam|odovzdam|nasdilim|zazdielam|ukazu|ukazem|preposlu|preposlem|reportuji|reportujem)\b/u.test(text);
  const definiteSensitiveDisclosure = acceptsDisclosure
    && /(?:vsechno|vsetko|co jste mi|co ste mi|sveril|zveril|obsah|poznamk|prepis|zprav|sprav)/u.test(text);
  return (requestsDisclosure || asksAboutDisclosure)
    && acceptsDisclosure
    && (affirmativeAssent(text) || definiteSensitiveDisclosure);
}

function isContextualOutcomeGuarantee(previous, text) {
  const asksForGuarantee = /(?:garant|zaruc|slib).{0,70}(?:vysled|prijem|obrat|trzb|vydel|zarob|klient|uspech|praci|pracu)/u.test(previous);
  return asksForGuarantee && affirmativeAssent(text)
    && /(?:urcite|jiste|samozrejme|ano|garantuji|garantujem|zarucuji|zarucujem|slibuji|slubujem)/u.test(text);
}

function isContextualFalseCredentialClaim(previous, text) {
  const asksAboutCredential = /(?:certifikat|kurz|vycvik).{0,80}(?:akredit|statem uznavan|statom uznavan|opravneni kouce|opravnenie kouca|licencovan|icf)/u.test(previous);
  return asksAboutCredential && affirmativeAssent(text)
    && /^(?:ano|urcite|jiste|samozrejme|plati)(?:\s+(?:to|on|certifikat))?\s+(?:je|ma|plati)?\b/u.test(text);
}

function hasSuicideRiskSignal(text) {
  return /(?:nechci|nechcem).{0,18}(?:zit|žiť|byt na svete|byt na tomto svete)|(?:nema|nema to).{0,16}cenu.{0,16}(?:dal )?zit|(?:chci|chcem).{0,22}(?:se zabit|sa zabit|sa zabiť|ukoncit zivot|ukončiť zivot|ukončiť život|skoncit se zivotem|skoncit so zivotom|ublizit si|ublížit si)|(?:preji si|preju si|prejem si|prajem si|zelam si|si preji|si preju|si prejem|si prajem|si zelam|doufam|dufam|kez bych|kiezby som).{0,35}(?:neprobud|nevzbud|nezobud)|(?:radeji bych|radsi bych|radsej by som).{0,24}(?:byla|bol|bola)?\s*mrtv|(?:bylo by|bolo by).{0,24}(?:lepsi|lepsie|nejlepsi|najlepsie).{0,35}(?:nebyt|nebyť|byt mrtv|byť mŕtv|neprobud|nezobud|kdybych.{0,12}nebyl|keby som.{0,12}nebol)|\bby (?:vsem|vsetkym) (?:bylo|bolo) (?:lip|lepe|lepsie)\s+(?:beze? me|bezomna|bezo mna)\b|\b(?:rodine|detem|detom|blizkym) by (?:se|sa) (?:beze? me|bezomna|bezo mna) (?:ulevilo|ulavilo|zilo lepe|zilo lepsie)\b|\b(?:beze? me|bezomna|bezo mna) by (?:se|sa) (?:me |moje |moji )?(?:deti|rodina|blizci|blizki) (?:meli|mely|mali) (?:lip|lepe|lepsie)\b|\b(?:nejradsi bych|najradsej by som).{0,24}(?:uz )?nikdy\s+(?:neotevrel|neotevrela|neotvoril|neotvorila).{0,12}\boci\b|(?:sebevraz|samovraz)|(?:mam|mám).{0,20}(?:plan|plán).{0,35}(?:ubliz|ublíž|zabit|zabiť|ukoncit|ukončiť)|(?:nevim|nevím|neviem).{0,28}(?:zvladnu|zvládnu|dokazu|dokážu|dokazem|dokážem).{0,24}(?:zastavit|zastaviť)/u.test(text);
}

function hasProfessionalSuicideRiskResponse(text) {
  const directSafetyAssessment = /(?:jsi|jste|si|ste).{0,24}(?:prave ted|práve teraz|ted|teď|teraz).{0,35}(?:v bezpeci|v bezpečí|v nebezpeci|v nebezpečí|v bezprostrednim nebezpeci|v bezprostředním nebezpečí|v ohrozeni|v ohrožení|v ohrození)|(?:mas|máš|mate|máte).{0,24}(?:konkretni|konkrétní|konkretny|konkrétny)?\s*(?:plan|plán|zamer|záměr)|(?:chces|chceš|chcete).{0,24}(?:si|si teraz|si ted|si teď).{0,12}(?:ublizit|ublížit)|(?:myslis|myslíš|myslite|myslíte).{0,20}(?:na sebevrazdu|na sebevraždu|na samovrazdu|na samovraždu)|(?:dokazes|dokážeš|dokazete|dokážete).{0,28}(?:zustat|zůstat|zostat).{0,15}(?:v bezpeci|v bezpečí)|(?:mas|máš|mate|máte).{0,30}(?:prostredk|prostředk).{0,20}(?:u sebe|pri sebe|po ruce)/u.test(text);
  if (forbidsSuicideHumanSupport(text)) return false;
  const emergencyResource = '(?:112|155|tiesnovu linku|tisnovou linku|zachrannou sluzbu|pohotovost|krizovou linku|krizovu linku|krizove centrum)';
  const positiveConnection = '(?:zavolej|zavolaj|zavolame|volej|volaj|kontaktuj|spojime se|spojime sa|obrat se|obrat sa|pojedeme|pojdeme|jed na|chod na)';
  const urgentHumanConnection = new RegExp(
    `(?:${positiveConnection}.{0,65}${emergencyResource}|${emergencyResource}.{0,65}${positiveConnection})|(?:zavol|kontaktuj|spojme se|spojme sa).{0,55}(?:blizk|duveryhodn|doveryhodn|zachrank|krizov|112|155|lekare|lekara)|(?:nezustavej|neostavaj|nezostavaj).{0,20}(?:sama|sam)`,
    'u',
  ).test(text);
  return directSafetyAssessment || urgentHumanConnection;
}

function hasClarifiedLowImmediateSuicideRisk(text) {
  const noCurrentIntent = /(?:ted|prave ted|teraz|prave teraz).{0,36}(?:si nechci ublizit|si nechcem ublizit|se nechci zabit|sa nechcem zabit|na sebevrazdu nemyslim|na samovrazdu nemyslim)|(?:nechci|nechcem).{0,20}(?:si ted ublizit|si teraz ublizit|se ted zabit|sa teraz zabit)/u.test(text);
  const noPlanOrMeans = /(?:nemam|nemame).{0,34}(?:plan|zamer|prostredk|prostriedk|nic cim).{0,34}(?:ani|a).{0,24}(?:prostredk|prostriedk|plan|zamer|nic cim)|(?:nemam|nemame).{0,24}(?:plan ani (?:prostredk|prostriedk)|zamer ani (?:prostredk|prostriedk)|plan ani nic)/u.test(text);
  const canStaySafeWithHumanSupport = /(?:dokazu|dokazem|zvladnu|zvladnem|umim|viem).{0,32}(?:zustat|zostat).{0,18}(?:v bezpeci)|(?:sestra|bratr|partner|partnerka|mama|otec|kamarad|kamarat|blizk).{0,30}(?:je|zostane|zustane).{0,22}(?:se mnou|so mnou|u me|pri mne)|(?:nejsem|nie som).{0,12}(?:sama|sam)/u.test(text);
  return noCurrentIntent && noPlanOrMeans && canStaySafeWithHumanSupport;
}

function hasConcreteSuicideSafetySupportPlan(text) {
  if (forbidsSuicideHumanSupport(text)) return false;
  return /(?:zustan|zostan|bud|bude).{0,36}(?:se sestr|so sestr|s brat|s partner|s mam|s otcem|s kamarad|s blizk|pri tebe|s tebou)|(?:domluv|dohod|naplan|spolecne nastav|spolocne nastav).{0,55}(?:kontakt|zavol|blizk|kamarad|kamarat|rodin|krizov|lekare|lekara|pohotovost)|(?:kontaktuj|zavolej|zavolaj).{0,45}(?:blizk|kamarad|kamarat|rodin|krizov|lekare|lekara)|(?:nezustavej|nezostavaj|neostavaj).{0,18}(?:sama|sam)/u.test(text);
}

function forbidsSuicideHumanSupport(text) {
  return /(?:nevolej|nevolaj|nevolat|nezavolej|nezavolaj|nekontaktuj|nekontaktovat|nikoho nekontaktuj|nikomu nerikej|nikomu nehovor).{0,70}(?:112|155|link|zachrank|pohotovost|krizov|blizk|rodin|sestr|kamarad)|(?:112|155|link|zachrank|pohotovost|krizov|blizk|rodin|sestr|kamarad).{0,70}(?:nevolej|nevolaj|nevolat|nekontaktuj|nikoho nekontaktuj|nikomu nerikej|nikomu nehovor)/u.test(text);
}

function continuesOrdinaryCoachingDuringSuicideRisk(text) {
  if (/(?:zastav|prerus|přeruš|odloz|odlož|nebudeme|nebudem|nebudu|teraz nejdeme|ted nejdeme|teď nejdeme).{0,55}(?:kouc|kouč|cil|cíl|techn|grow|refram|cvicen|cvičen)/u.test(text)
    || /(?:ke koucinku|ku koucingu|k cili|k cíli).{0,35}(?:az|až).{0,35}(?:bezpec|bezpeč|pomoc|podpor)/u.test(text)) return false;
  return /(?:projdeme|prejdeme|zkusime|zkusíme|skusime|skúsime|pouzijeme|použijeme).{0,30}(?:grow|heart|refram|technik|cvicen|cvičen|dech|dych)|(?:jak[yae]?|aky|aka|ake|co|čo).{0,35}(?:cil|cíl|vysledek|výsledek|krok|moznost|možnost).{0,20}(?:chces|chceš|chcete|si volis|si volíš)|(?:predstav si|představ si).{0,30}(?:ideal|uspech|úspěch|budoucnost)/u.test(text);
}

function criticalFailure(code, competencyId, turn) {
  return Object.freeze({
    code,
    competencyId,
    studentTurnIndex: turn.index,
    reference: turn.reference,
    quote: turn.text,
  });
}

function dedupeFailures(failures) {
  const seen = new Set();
  return failures.filter(failure => {
    const key = `${failure.code}:${failure.studentTurnIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function meaningfulOverlap(left, right) {
  if (!left || !right) return 0;
  const leftTokens = coachStems(left);
  const rightTokens = coachStems(right);
  return [...leftTokens].filter(token => rightTokens.has(token)).length;
}

function isDetachedOffTopicListeningClause(clause, previous) {
  if (!clause) return false;
  const clauseStems = coachStems(clause);
  const exactOverlap = meaningfulOverlap(clause, previous);
  const prefixOverlap = hasCoachStemPrefixOverlap(clause, previous);
  const mirrorsClientVolition = /\b(?:chci|nechci|chcem|nechcem|potrebuji|potrebujem)\b/u.test(previous)
    && /\b(?:chces|nechces|chcete|chtel\w*|chcel\w*|potrebujes|potrebujete)\b/u.test(clause);
  const absurdPhysicalAppendix = /\b(?:zpiv|spiev|oper|plav|mars|kridl|modr|fialov|tucnak|vypliv|vypluv|vyp[lľ]uv)\w*\b/u.test(clause);
  if (absurdPhysicalAppendix) return true;
  if (mirrorsClientVolition && (exactOverlap >= 1 || prefixOverlap)) return false;
  // A natural follow-up may refer back with a pronoun or use ordinary
  // coaching language without repeating the client's nouns. A new,
  // content-heavy question with neither is an unrelated appendix and cannot
  // be hidden behind an otherwise accurate two-word echo.
  const refersBack = /\b(?:to|tom|tomu|tim|teto|tuhle|takove|tomto|tejto|tym|situac|pocit|obav|tema|zmen)\w*\b/u.test(clause);
  const coachingFollowUp = /\b(?:potreb|pomoh|nejtez|najtaz|dulezit|dolezit|krok|volb|rozhod|cil|ciel|vysled|vyres|vyries|dal|dalej|pokrac)\w*\b/u.test(clause);
  if (refersBack || coachingFollowUp) return false;
  // One echoed client noun plus an unrelated predicate ("zakázky zpívají")
  // is not a meaningful follow-up, even though the short clause used to fit
  // the generic brevity exception. Two direct anchors remain enough for a
  // short topical continuation.
  if (exactOverlap >= 2 && clauseStems.size <= exactOverlap + 2) return false;
  if (exactOverlap === 1 || prefixOverlap) return clauseStems.size >= 2;
  return clauseStems.size >= 3;
}

function hasCoachStemPrefixOverlap(left, right) {
  const leftStems = coachStems(left);
  const rightStems = coachStems(right);
  return [...leftStems].some(leftStem => (
    leftStem.length >= 5
    && [...rightStems].some(rightStem => (
      rightStem.length >= 5 && leftStem.slice(0, 5) === rightStem.slice(0, 5)
    ))
  ));
}

function coachStems(value) {
  return new Set(normalizeCoachText(value)
    .split(' ')
    .filter(token => token.length >= 4 && !COACH_STOPWORDS.has(token))
    .map(token => token.replace(/(?:ami|emi|ove|ova|ovy|eni|ani|ace|aci|ost|ech|ich|ych|ou|em|im|at|it|et|y|a|u|i|e|o)$/u, '').slice(0, 10))
    .filter(token => token.length >= 3));
}

function evidenceIncludes(container, quote) {
  const normalizedContainer = normalizeCoachText(container);
  const normalizedQuote = normalizeCoachText(quote);
  if (normalizedQuote.length < 4) return false;
  const containerTokens = normalizedContainer.split(' ').filter(Boolean);
  const quoteTokens = normalizedQuote.split(' ').filter(Boolean);
  if (!quoteTokens.length || quoteTokens.length > containerTokens.length) return false;
  for (let index = 0; index <= containerTokens.length - quoteTokens.length; index += 1) {
    if (!quoteTokens.every((token, offset) => containerTokens[index + offset] === token)) continue;
    // A quote may not drop a separate negator immediately before the matched
    // words ("ne slyším …" -> "slyším …"). Fused Czech/Slovak negation such
    // as "neslyším" is already rejected by the token-boundary comparison.
    const prefix = containerTokens.slice(Math.max(0, index - 2), index);
    if (prefix.some(token => /^(?:ne|nie|nikoli|nikoliv|vubec|vobec)$/u.test(token))) continue;
    const scopedPrefix = containerTokens.slice(Math.max(0, index - 8), index).join(' ');
    if (/(?:nemyslim si|nemyslime si|nerekla bych|nerekl bych|nepovedala by som|nepovedal by som|pochybuji|pochybujem|netvrdim|netvrdime|neni pravda|nie je pravda|rozhodne bych nerekla|rozhodne bych nerekl|rozhodne by som nepovedala|rozhodne by som nepovedal|nemohu rict|nemozem povedat) (?:ze|ci)$/u.test(scopedPrefix)) continue;
    return true;
  }
  return false;
}

function cleanCoachText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

export function normalizeCoachText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
