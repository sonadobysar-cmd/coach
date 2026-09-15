export const PROFESSIONAL_LIFE_COACH_COURSE_ID = 'profesionalni-life-coach';

const ADMINISTRATIVE_TURN = /(?:ukončuji simulaci|ukoncuji simulaci|ukončujem simuláciu|ukoncujem simulaciu|vyhodnoť (?:prosím )?(?:celý )?nácvik|vyhodnot (?:prosim )?(?:cely )?nacvik)/iu;

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
      /kontrakt/u, /zakazk/u, /intake/u, /dohod[ay] o (?:vztahu|jednom sezeni|vysledku)/u,
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
  return ADMINISTRATIVE_TURN.test(String(value || ''));
}

export function indexedCoachStudentTurns(messages = []) {
  const result = [];
  const source = Array.isArray(messages) ? messages : [];
  let previousCounterpartText = '';
  for (const [messageIndex, message] of source.entries()) {
    const text = cleanCoachText(message?.content);
    if (!text) continue;
    if (message?.role === 'assistant') {
      previousCounterpartText = text;
      continue;
    }
    if (message?.role !== 'user' || isTrainingAdministrativeTurn(text)) continue;
    result.push(Object.freeze({
      index: result.length + 1,
      reference: `S${result.length + 1}`,
      messageIndex,
      text,
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
  for (const turn of indexedCoachStudentTurns(messages)) {
    const text = normalizeCoachText(turn.text);
    const previous = normalizeCoachText(turn.previousCounterpartText);

    if (isClinicalOverreach(text)) {
      failures.push(criticalFailure('clinical_scope_breach', 'ethical_boundaries', turn));
    }
    if (isConfidentialityBreach(text)) {
      failures.push(criticalFailure('confidentiality_breach', 'ethical_boundaries', turn));
    }
    if (isOutcomeGuarantee(text)) {
      failures.push(criticalFailure('outcome_guarantee', 'ethical_boundaries', turn));
    }
    if (isExplicitRefusal(previous) && isCoerciveContinuation(text)) {
      failures.push(criticalFailure('ignored_explicit_refusal', 'refusal_autonomy', turn));
    }
    if (asksCoachToDecide(previous) && takesDecisionFromClient(text)) {
      failures.push(criticalFailure('client_decision_takeover', 'refusal_autonomy', turn));
    }
    if (isFalseCredentialClaim(text)) {
      failures.push(criticalFailure('false_credential_claim', 'ethical_boundaries', turn));
    }
  }
  return dedupeFailures(failures);
}

function evidenceMatchesCompetency(competencyId, context) {
  const { criterion, quote, rawQuote, previous, later } = context;
  if (!quote || quote.split(' ').length < 3) return false;

  if (competencyId === 'contract') {
    return /(?:dnesni|dnes|tohoto|naseho|zbyvajiciho) (?:cil|zakazk|vysledok|vysledek|rozhovor|sezeni)/u.test(quote)
      || /(?:co|jak|podle coho|podla coho|podle ceho|s cim).{0,70}(?:uzitecn|uzitocn|vysledok|vysledek|odejit|odist|poznate|venovat|pracovat)/u.test(quote)
      || /(?:pojdme|mozeme|muzeme|navrhujem|navrhuji).{0,55}(?:ujasnit|dohodnut|dohodnout|zvolit|vratit k).{0,45}(?:cil|zakazk|tema|cas)/u.test(quote)
      || /plati.{0,80}(?:zakazk|cil|vysledok|vysledek|dohod)/u.test(quote);
  }

  if (competencyId === 'active_listening') {
    const reflective = /(?:slysim|pocujem|rikate|rikas|hovorite|hovoris|vravite|vravis|rozumim tomu tak|rozumiem tomu tak|zachycuji|zachytavam|zni to|ak (?:ti|vam) spravne rozumiem|jestli (?:ti|vam) spravne rozumim|z tvych slov|z vasich slov|to co popisujete|to co popisujes|opravte me|oprav ma|oprav me)/u.test(quote);
    const followsClient = meaningfulOverlap(quote, previous) >= 1;
    const anticipatesFutureDisclosure = !followsClient && meaningfulOverlap(quote, later) >= 1;
    const contentQuestion = /\?/u.test(rawQuote) && followsClient && !isLeadingOrDoubleQuestion(rawQuote);
    return (reflective && !anticipatesFutureDisclosure && (followsClient || /(?:sedi to|chapu to spravne|plati to)/u.test(quote))) || contentQuestion;
  }

  if (competencyId === 'questions') {
    return isSingleOpenQuestion(rawQuote) && !isLeadingOrDoubleQuestion(rawQuote);
  }

  if (competencyId === 'intervention_choice') {
    const choice = /(?:mohu|muzu|muzeme|mozem|mozeme|chcete|chces|vyhovovalo by|pokud (?:vam|ti) to sedi|ak (?:vam|ti) to sedi|nabizim|ponukam|navrhuji|navrhujem)/u.test(quote);
    const method = /(?:grow|heart|ramec|mapa|hodnot|otazk|cviceni|experiment|orientac|postup|nastroj|bez ramce|jinou formulac)/u.test(quote);
    const purpose = /(?:aby|protoze|pretoze|smyslem|zmyslom|ucelem|pomuze|pomoze|potrebujete nejdriv|potrebujete najprv|odpovida tomu)/u.test(quote);
    const rejectsMechanicalUse = /(?:odlozme|nemusime|nebudeme|inak|jinak|bez ramce)/u.test(quote);
    return (choice && method && (purpose || rejectsMechanicalUse)) || (method && purpose && rejectsMechanicalUse);
  }

  if (competencyId === 'refusal_autonomy') {
    const respectsChoice = /(?:respektuji|respektujem|zastavime|nebudeme pokracovat|nebudu pokracovat|nebudem pokracovat|nebudu.{0,35}(?:otazku|ramec|techniku)|nebudem.{0,35}(?:otazku|ramec|techniku)|(?:otazku|ramec|techniku).{0,35}(?:nebudu|nebudem)|nemusite|nemusis|je to (?:vase|tvoje) volba|rozhodnuti je na (?:vas|tobe)|rozhodnutie je na (?:vas|tebe)|tempo urcujete|tempo urcujes|mozete odmietnut|mozes odmietnut|muzete odmitnout|muzes odmitnout|co (?:byste|bys) chtel|co by ste chceli|chcete radeji|chces radeji|chcete radsej|chces radsej|vratime sa|vratime se)/u.test(quote);
    const refusalCriterion = /(?:odmitnut|stahnout|nesedi|zastaveni|nepokracovat)/u.test(criterion);
    return respectsChoice && (!refusalCriterion || isExplicitRefusal(previous));
  }

  if (competencyId === 'alliance_repair') {
    const ownsError = /(?:mate pravdu|mas pravdu|dekuji za oprav|diky za oprav|dakujem za oprav|omlouvam se|ospravedlnujem sa|pridala jsem|pripisala som|domyslela jsem|domyslela som|spletla jsem|pomylila som sa|to byla moje interpretace|to bola moja interpretacia|opravim|vratim sa k tomu co ste povedali|vratim se k tomu co jste rekla|vratim se k tomu co jsi rekla)/u.test(quote);
    const correctionBefore = /(?:to jsem nerekl|to jsem nerekla|to som nepovedal|to som nepovedala|takhle jsem to nemyslel|takhle jsem to nemyslela|takto som to nemyslel|takto som to nemyslela|nesedi mi|mi nesedi|nepocuvate|nepocuvas|neposlouchate|neposlouchas|ako to mozete vediet|ako to mozes vediet|jak to muzete vedet|jak to muzes vedet|oprav)/u.test(previous);
    return ownsError && correctionBefore && !/(?:mrzi me ze to tak vnimate|mrzi me ze to tak vnimas)/u.test(quote);
  }

  if (competencyId === 'ethical_boundaries') {
    if (isClinicalOverreach(quote) || isConfidentialityBreach(quote) || isOutcomeGuarantee(quote) || isFalseCredentialClaim(quote)) return false;
    const boundary = /(?:v ramci koucinku|neni diagnoz|nie je diagnoz|nemohu diagnostikovat|nemozem diagnostikovat|nebudu diagnostikovat|nebudem diagnostikovat|nebudu zpracovavat traum|nebudem spracovavat traum|traum[a-z]*.{0,50}(?:zpracovavat nebudu|spracovavat nebudem)|terapeut|psycholog|lekar|krizov|bezprostredni bezpeci|bezprostredne bezpecie|odbornou pomoc|odbornu pomoc|odbornik|duvern|dovern|obsah sezeni (?:nesdilim|nepredavam|nezverejnim)|obsah sedenia (?:nezdielam|neodovzdam)|poznamky (?:nesdilim|nepredavam|nezdielam|neodovzdam)|bez souhlasu (?:nesdilim|neposkytnu)|bez suhlasu (?:nezdielam|neposkytnem)|reporting|minimalizace dat|minimalizacia dat|vysledok (?:nemozem|neda sa) (?:garantovat|zarucit)|vysledek (?:nemohu|nelze) (?:garantovat|zarucit)|nemozem (?:garantovat|zarucit)|nemohu (?:garantovat|zarucit)|interny certifikat|interni certifikat|nie je akreditac|neni akreditac|pravnik|financny poradca|financni poradce|zastavime techniku|neklinicky ciel|neklinicky cil)/u.test(quote);
    const contextRequired = /(?:duvern|report|data|sponzor|obsah|poznamk)/u.test(criterion);
    const contextPresent = /(?:firma|hr|sponzor|report|obsah sezeni|poznamk|duvern)/u.test(previous);
    return boundary && (!contextRequired || contextPresent);
  }

  if (competencyId === 'outcome') {
    const outcome = /(?:dalsi krok|konkretni krok|konkretny krok|co udelate|co udelas|co urobite|co urobis|kdy to|kedy to|podle ceho poznate|podle ceho poznas|podla coho spoznate|podla coho spoznas|jak poznate|jak poznas|ako spoznate|ako spoznas|co si odnasite|co si odnasas|na cem se domlouvame|na com sa dohodneme|co si volite|co si volis|maly experiment|ako ho vyhodnotite|ako ho vyhodnotis|jak ho vyhodnotite|jak ho vyhodnotis|co je vo vasom vplyve|co je v tvojom vplyve|co je ve vasem vlivu|co je ve tvem vlivu)/u.test(quote);
    const clientOwned = !/^(?:musite|musis|mel byste|mela byste|mel bys|mela bys|udelej|udelejte)\b/u.test(quote);
    return outcome && clientOwned;
  }

  if (competencyId === 'reflection') {
    return /(?:mam hypotezu|je to hypoteza|overme|overme si|nechcem si domyslat|nechci si domyslet|vsimam si ze si|vsimam si ze si|mohu byt ovlivnen|mozem byt ovplyvnen|muze me ovlivnovat|moze ma ovplyvnovat|moja interpretacia|moje interpretace|oddelme fakt|co su data|co jsou data|ake su dokazy|jake jsou dukazy|co tomu odporuje|vynimk|vyjimk|bias|projekc|superviz|nabuduce si postrazim|priste si ohlidam|v dalsom pokuse|v dalsim pokusu)/u.test(quote);
  }

  return false;
}

function isSingleOpenQuestion(rawQuote) {
  const normalized = normalizeCoachText(rawQuote);
  if ((String(rawQuote || '').match(/\?/gu) || []).length !== 1) return false;
  return /(?:^|\b)(?:co|ako|jak|aky|aka|ake|jaky|jaka|jake|ktory|ktora|ktore|ktery|ktera|ktere|v com|v cem|podla coho|podle ceho|o com|o cem|kde|kto|kdo)\b/u.test(normalized);
}

function isLeadingOrDoubleQuestion(rawQuote) {
  const normalized = normalizeCoachText(rawQuote);
  return /\b(?:a|alebo|nebo)\s+(?:co|ako|jak|aky|aka|ake|jaky|jaka|jake|ktory|ktora|ktore|ktery|ktera|ktere|v com|v cem|podla coho|podle ceho|o com|o cem|kde|kto|kdo)\b/u.test(normalized)
    || /(?:nemel[ao]? by|nebylo by lepsi|proc proste|souhlasite ze|souhlasis ze|neni pravda ze|zkusite tedy|zkusis tedy)/u.test(normalized);
}

function isClinicalOverreach(text) {
  if (/(?:nebudu|nebudem|nemohu|nemozem|nebudeme|nelze|neda sa|neni v me kompetenci|nie je v mojej kompetencii|neni v rozsahu|nie je v rozsahu).{0,45}(?:lec|liec|terap|traum|diagnost|vymaz)/u.test(text)) return false;
  return /(?:diagnostikuji|diagnostikujem|diagnoza je|mate depresi|mas depresi|mate depresiu|mas depresiu|je to urcite (?:trauma|panicka porucha)|budu vas lecit|budu te lecit|budem vas liecit|budem ta liecit|vylecim|vyliecim|vylecime|vyliecime|vymazeme traum|prepiseme traum|zpracujeme traum|spracujeme traum|traum[a-z]*.{0,30}(?:zpracujeme|spracujeme|prepiseme|vymazeme)|otevreme traumatickou vzpominku|otvorime traumaticku spomienku|nemusite k terapeutovi|nemusis k terapeutovi)/u.test(text)
    || /(?:vysad|sniz|zniz|zvys).{0,35}(?:leky|lieky|medikaci|medikaciu)/u.test(text);
}

function isConfidentialityBreach(text) {
  if (/(?:bez|jen s|pouze s|az po).{0,30}(?:souhlas|suhlas|dohod)/u.test(text)
    || /(?:neposlu|neposlem|nepredam|neodovzdam|nesdilim|nezdielam|neposkytnu|neposkytnem).{0,65}(?:obsah|poznamk|prepis|co jste rekla|co jsi rekla|co ste povedali|co si povedala)/u.test(text)) return false;
  return /(?:poslu|poslem|predam|odovzdam|nasdilim|zazdielam|sdelim|poviem|reportuji|reportujem|preposlu|preposlem).{0,80}(?:hr|firme|zamestnavateli|zamestnavatelovi|sponzorovi|obsah sezeni|obsah sedenia|poznamk|prepis|co jste rekla|co jsi rekla|co ste povedali|co si povedala)/u.test(text)
    || /(?:hr|firme|zamestnavateli|zamestnavatelovi|sponzorovi).{0,60}(?:poslu|poslem|predam|odovzdam|nasdilim|zazdielam|sdelim).{0,60}(?:obsah|poznamk|prepis)/u.test(text);
}

function isOutcomeGuarantee(text) {
  if (/(?:nemohu|nemozem|nemuzeme|nemozeme|nelze|neda sa|nebudu|nebudem|negarantuji|negarantujem|nezarucuji|nezarucujem).{0,35}(?:garant|zaruc|slib)/u.test(text)) return false;
  return /(?:garantuji|garantujem|zarucuji|zarucujem|slibuji|slubujem).{0,100}(?:vysledok|vysledek|zmenu prace|zmenite praci|zmenis praci|vyssi prijem|vydel|zarob|uspech|fungovat|uzdrav|zbavite se|dokazete|dokazes)/u.test(text);
}

function isExplicitRefusal(text) {
  return /(?:nechci pokracovat|nechcem pokracovat|nechci to|nechcem to|nechci tuhle|nechcem tuto|nechci zavrit|nechcem zavriet|nebudu pokracovat|nebudem pokracovat|nesedi mi|mi nesedi|je mi neprijemne|citim se neprijemne|citim sa neprijemne|citim se odpojene|citim sa odpojene|stop|zastav|odmitam|odmietam|otazku nechci|otazku nechcem)/u.test(text);
}

function isCoerciveContinuation(text) {
  if (/(?:respektuji|zastavime|nebudeme pokracovat|nemusite|nemusis|je to vase volba|je to tvoje volba)/u.test(text)) return false;
  return /(?:musite|musis|vydrzte|vydrz|budeme pokracovat|pokracujte|pokracuj|je treba pokracovat|bez toho to nebude fungovat|je to nutne (?:pro|pre) metodu|zavrete oci|zavri oci|udelejte to presto|udelej to presto|skus.{0,20}napriek|zkus.{0,20}presto|(?:dokoncime|projdeme|prejdeme|pouzijeme).{0,25}(?:grow|ramec|techniku))/u.test(text);
}

function asksCoachToDecide(text) {
  return /(?:rozhodni za me|rekni mi co mam udelat|povedz mi co mam urobit|ty mi rekni|ty mi povedz|mam (?:to )?(?:podepsat|podpisat|odejit|odist|prijmout|prijat|odmitnout|odmietnut)|kolik si mam uctovat|kolko si mam uctovat)/u.test(text);
}

function takesDecisionFromClient(text) {
  if (/(?:rozhodnuti je na vas|rozhodnuti je na tobe|nemohu rozhodnout za vas|nemohu rozhodnout za tebe)/u.test(text)) return false;
  return /^(?:musite|musis|mel byste|mela byste|mel bys|mela bys|udelejte|udelej|podepiste|podepis|odejdete|odejdi|vezmete|vezmi)\b/u.test(text);
}

function isFalseCredentialClaim(text) {
  if (/(?:neni|nemame|nemam|nejde o).{0,35}(?:akredit|statem uznavan|oficialni kvalifikac)/u.test(text)) return false;
  return /(?:jsem|jsme|nas kurz je|certifikat je).{0,45}(?:akreditovan[ay]|statem uznavan[ay]|oficialni profesni kvalifikac|icf certifikovan[ay])/u.test(text);
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
  return normalizedQuote.length >= 4 && normalizedContainer.includes(normalizedQuote);
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
