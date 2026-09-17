import {
  assessCoachCriterionEvidence,
  hasGeneralizedFalseCredentialClaim,
  hasOnlySafelyScopedCredentialTargets,
  isCredentialQuestion,
} from './coach-evidence-rules.js';
import {
  resolveCoachRubricCriterion,
  resolveCoachRubricCriterionReference,
} from './coach-rubric-registry.js';

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
    const nextCounterpart = source
      .slice(messageIndex + 1)
      .find(candidate => candidate?.role === 'assistant');
    result.push(Object.freeze({
      index: administrative ? null : studentTurnIndex,
      reference: administrative ? null : `S${studentTurnIndex}`,
      messageIndex,
      text,
      administrative,
      previousCounterpartText,
      nextCounterpartText: cleanCoachText(nextCounterpart?.content),
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

function legacyCoachCompetencyForCriterion(label) {
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

  // Mastery scenarios deliberately describe observable behaviour in plain
  // language instead of repeating the nine competency labels. Keep that
  // authored language, but map it to the same deterministic evidence model.
  // Without these mappings a correct citation is classified as "unmapped",
  // the evidence sanitizer turns it into NOT PROVEN and several release cases
  // become mathematically impossible to pass even with exemplary turns.
  const masteryCriterionCompetency = [
    ['contract', /(?:jasny ucel a (?:vysledek|vysledok) nacviku|zakazka(?: a (?:zpusob|sposob) prace)? (?:je |jsou )?(?:znovu|znova) overena|konkretni popis dodavaneho procesu|konkretni vystupy koucovaci spoluprace)/u],
    ['active_listening', /(?:presna (?:navaznost na situaci a druhou stranu|nadvaznost na situaciu a druhu stranu)|presny navrat ke klientcinym slovum|overeni zda opraveny vyznam sedi|realny ekonomicky fakt neni prepsan jako vnitrni blok|navazani vychazi z opraveneho vyznamu)/u],
    ['alliance_repair', /(?:prevzeti odpovednosti za nevyzadanou radu|dopad na alianci(?:u)? je uznan(?:y)?|kratke prevzeti odpovednosti za smer|klientka potvrzuje opraveny dalsi tah|pozorovatelny dukaz viditelne prevzeti odpovednosti|koucka presne pojmenuje vlastni chybu)/u],
    ['refusal_autonomy', /(?:autonomie rozhodnuti|technika je ihned zastavena|odmitnuti neni zpochybneno|vyslovne odmietnutie je respektovane|zadny tlak na jediny maly pokus|klientka urcuje dalsi postup|zadne ano.?ne misto klientky|konecne rozhodnuti zustava klientce|odpovednost neni skryte prevzata radou|journaling ani domaci ukol nejsou znovu nabidnuty|dennik ani domaca uloha nie su znovu ponuknute|klientka (?:muze|moze) smer ukoncit|moznost informovane nekoupit|zadny tlak nebo falesna jistota|klientka dostava svobodnou volbu|klientka voli dalsi zpusob prace)/u],
    ['questions', /(?:pozorovatelny dukaz jedna ucelna otazka)/u],
    ['intervention_choice', /(?:nabidka skutecne odlisnych moznosti|mentoring neni znovu nabidnut bez vyslovneho souhlasu|alternativa (?:neni prevleceny stejny ukol|nie je prezlecena rovnaka uloha)|pozorovatelny dukaz plynuly proces)/u],
    ['outcome', /(?:konkretni uzavreni nebo dalsi krok|konkretne uzavretie alebo dalsi krok|nejmensi bezpecny krok vytvari cas nebo data|vratny mezikrok nebo cas na rozhodnuti|klientka formuluje vlastni kriteria|pozorovatelny dukaz klientkou vlastnene rozhodnuti|meritelne procesni ukazatele|klientkou ovlivnitelne kroky a metriky|bod revize bez manipulace)/u],
    ['reflection', /(?:aktualni konflikt neni vydan za cely obraz|chybejici data jsou odlisena od strachu|jsou zmapovany dusledky a moznosti|nevratnost a casovy tlak jsou pojmenovane)/u],
    ['ethical_boundaries', /(?:srozumitelne vymezeni koucovaci role|konkretni doporuceni zdravotni nebo terapeuticke pomoci|konkretni odborna navaznost|puvodni souhlas neni zpetne rozsiren|rozliseni ucasti cile a obsahu sezeni|minimalizace sdilenych dat|nova tristranna dohoda pouze do budoucna|transparentni komunikace ke klientce i sponzorovi|zadne potvrzeni konkretniho vyroku nebo tematu|zadne predani zapisu|jasne vysvetleni predchozi dohody|klientka ma kontrolu nad novym souhlasem|ochrana dat bez utocneho tonu|rozliseni vlivu klientky koucky a trhu|externi rozhodnuti je vyslovne oddelene|zadna automaticka licence|rozsah overovanych dovednosti je srozumitelny|neni naznacena zdravotnicka kvalifikace|vznikne pouzitelna pravdiva formulace|zadny titul psycholozky nebo terapeutky bez opravneni|pouziti techniky neni vydano za zdravotnickou kvalifikaci|skutecna role je popsana konkretne|bezny koucink je okamzite zastaven|okamzite preruseni bezneho koucovani|priorita neodkladne lidske pomoci|konkretni propojeni na 112 nebo 155|uplne a citlive overeni rizika|jasny rozsah sluzby|vyslovna priorita 112 nebo 155 pri bezprostrednim riziku|zapojeni dostupne blizke osoby|klidny lidsky ton bez diagnozy)/u],
  ].find(([_competencyId, pattern]) => pattern.test(normalized));
  if (masteryCriterionCompetency) {
    return COACH_COMPETENCIES.find(definition => definition.id === masteryCriterionCompetency[0]);
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

/**
 * Professional-coach criteria are resolved only through the audited exact
 * registry.  The old keyword mapper remains available solely to callers that
 * explicitly identify another course; this avoids changing unrelated course
 * behaviour while preventing a newly invented professional rubric label from
 * being silently accepted because it happens to contain a familiar word.
 */
export function coachCompetencyForCriterion(label, context = {}) {
  const resolved = resolveCoachRubricCriterionReference(label, context);
  if (resolved?.resolved) {
    return COACH_COMPETENCIES.find(definition => definition.id === resolved.competencyId) || null;
  }

  const courseId = String(context?.courseId || '').trim();
  if (courseId && courseId !== PROFESSIONAL_LIFE_COACH_COURSE_ID) {
    return legacyCoachCompetencyForCriterion(label);
  }
  return null;
}

export function coachCompetencyIdForCriterion(label, context = {}) {
  return coachCompetencyForCriterion(label, context)?.id || null;
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
    || /(?:co|c[oô]).{0,25}(?:si )?(?:chcete|chces).{0,22}(?:odnest|odniest).{0,35}(?:rozhovor|sezen|seden)/u.test(text)
    || /(?:co|c[oô]).{0,25}(?:si )?(?:chcete|chces).{0,35}(?:rozhovor|sezen|seden).{0,22}(?:odnest|odniest)/u.test(text);
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
  const method = /\b(?:grow|heart|ramec|map|hodnot|otazk|cviceni|experiment|orientac|postup|nastroj|metod|trideni priorit|bez ramce|jinou formulac)\w*\b/u.test(text);
  const purpose = /\b(?:aby|protoze|pretoze|smyslem|zmyslom|ucelem|ucelom|pomoh|pomuze|pomoze|potrebujete nejdriv|potrebujete najprv|odpovida tomu)\w*\b/u.test(text);
  const consent = /\b(?:chcete|chces|chcete ji|chces ji|vyhovovalo by|souhlasite|souhlasis|suhlasite|suhlasis|muzu|muzeme|mozeme|mohu|mozem).{0,45}\b(?:pouzit|pouzit ji|vyzkouset|vyskusat|zkusit|skusit|pracovat|pokracovat|nabidnout|ponuknut)\b/u.test(text)
    || /\b(?:mohu|mozem|muzu|muzeme|mozeme).{0,35}\b(?:nabidnout|ponuknut|zkusit|skusit|pouzit)\b/u.test(text)
    || /\b(?:dava|dava vam|dava ti|dava vám|dava ti|dava zmysel|dava smysl).{0,35}(?:zkusit|skusit|vyzkouset|vyskusat)\b/u.test(text);
  return Object.freeze({ method, purpose, consent, complete: method && purpose && consent });
}

export function assessCoachOutcomeSubcriteria(value) {
  const text = normalizeCoachText(value);
  const prescribedAnswer = /\b(?:jedina|jedine)\s+(?:spravna|spravne)\s+(?:volba|moznost|rozhodnuti)|\b(?:musite|musis|mel byste|mela byste|mel bys|mela bys)\b.{0,55}\b(?:podepsat|podpisat|odejit|odist|prijmout|prijat|odmitnout|odmietnut)\b/u.test(text)
    || /(?:krok|reseni|riesenie|volba|moznost).{0,24}(?:je|bude|znamena).{0,18}(?:dat vypoved|dat vypoved|podepsat|podpisat|odejit|odist|prijmout|prijat|odmitnout|odmietnut)/u.test(text);
  const clientOwned = !/^(?:musite|musis|mel byste|mela byste|mel bys|mela bys|udelej|udelejte|urob|urobte)\b/u.test(text)
    && !prescribedAnswer;
  const clientChoice = /(?:jaky|aky|ktery|ktory|co za).{0,28}krok.{0,20}(?:si volite|si volis|si vyberete|si vyberes|zvolite|zvolis|vyberete|vyberes)|(?:co|aky|jaky) si (?:volite|volis|vyberate|vyberas|zvolite|zvolis)|(?:co|c[oô]) presne (?:udelate|udelas|urobite|urobis).{0,20}(?:jako|ako) prvni/u.test(text);
  const concreteStep = /(?:konkretni|konkretny|co presne|co konkretne|jaky.{0,24}krok|aky.{0,24}krok|ktery.{0,24}krok|ktory.{0,24}krok)/u.test(text);
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
  const rejectsVerification = /(?:nepotrebuji|nepotrebujem|nebudu|nebudem|neni treba|netreba).{0,35}(?:over|overov|zkoumat|skumat|hlidat)|(?:over|overov|zkoumat|skumat|hlidat).{0,30}(?:nebudu|nebudem)|(?:prvni dojem|prvy dojem|hypotez|interpretac).{0,45}(?:je fakt|za fakt|povazuji za fakt|povazujem za fakt)|(?:data|dukazy|dokazy).{0,35}(?:ignoruji|ignorujem|neberu v uvahu|neberiem do uvahy)/u.test(text);
  const hypothesisOrBias = !rejectsVerification
    && /(?:mam hypotezu|je to hypoteza|muze to byt muj prvni dojem|moze to byt moj prvy dojem|bias|projekc|moja interpretacia|moje interpretace|mohu byt ovlivnen|mozem byt ovplyvnen|oddelme fakt|co su data|co jsou data|ake su dokazy|jake jsou dukazy)/u.test(text);
  const learningAction = !rejectsVerification
    && /(?:overme|overim|overime|otazkou over|otestovat|otestujeme|co by (?:ho|to) vyvratilo|superviz|nabuduce si postrazim|priste si ohlidam|v dalsom pokuse|v dalsim pokusu|co tomu odporuje|vynimk|vyjimk)/u.test(text);
  return Object.freeze({ hypothesisOrBias, learningAction, complete: hypothesisOrBias && learningAction });
}

export function assessCoachEvidenceRelevance({
  label,
  quote,
  turnIndex,
  messages = [],
  context = {},
  lessonEvidence = null,
} = {}) {
  const registryEntry = resolveCoachRubricCriterion(label, context);
  const competencyId = registryEntry?.resolved ? registryEntry.competencyId : null;
  const turns = indexedCoachStudentTurns(messages);
  const turn = turns.find(candidate => candidate.index === Number(turnIndex));
  if (!turn) {
    return { relevant: false, competencyId, reason: 'invalid_turn_index' };
  }
  if (!evidenceIncludes(turn.text, quote)) {
    return { relevant: false, competencyId, reason: 'turn_quote_mismatch' };
  }
  if (!registryEntry?.resolved) {
    return {
      relevant: false,
      competencyId: null,
      reason: registryEntry?.reason === 'lesson_metadata_required'
        ? 'lesson_metadata_required'
        : 'unmapped_criterion',
    };
  }

  const quotedFailure = detectCoachCriticalFailures(messages).some(failure => (
    failure.studentTurnIndex === turn.index && evidenceIncludes(failure.quote, quote)
  ));
  if (quotedFailure) {
    return { relevant: false, competencyId, reason: 'critical_failure_is_not_positive_evidence' };
  }

  const assessment = assessCoachCriterionEvidence({
    entry: registryEntry,
    quote,
    previousCounterpartText: turn.previousCounterpartText,
    nextCounterpartText: turn.nextCounterpartText,
    context,
    lessonEvidence,
  });
  const evidenceContext = {
    criterion: normalizeCoachText(label),
    quote: normalizeCoachText(quote),
    rawQuote: String(quote || ''),
    previous: normalizeCoachText(turn.previousCounterpartText),
    next: normalizeCoachText(turn.nextCounterpartText),
    later: normalizeCoachText(turn.laterCounterpartText),
  };
  const specificMatch = evidenceMatchesMasteryCriterion({
    competencyId,
    ...evidenceContext,
  });
  const hasBattleTestedSpecificRule = specificMatch !== null;
  const semanticMatch = evidenceMatchesCompetency(competencyId, evidenceContext);
  const hardRuleFailure = new Set([
    'contradictory_or_harmful_evidence',
    'lesson_evidence_required',
    'evidence_rule_missing',
  ]).has(assessment.reason);
  // The exact registry and its bound rule are the fail-closed authority. For
  // the mastery criteria that already have a more mature criterion-specific
  // detector in this module, retain that detector as an additional guard. It
  // catches adversarial suffixes and negations that a newly added rule must not
  // accidentally weaken. Criteria without that historic detector can pass
  // only when their exact evidence rule passes.
  const relevant = !hardRuleFailure
    && semanticMatch
    && (hasBattleTestedSpecificRule ? specificMatch === true : assessment.relevant);
  return {
    ...assessment,
    relevant,
    reason: relevant
      ? null
      : hardRuleFailure
        ? assessment.reason
        : semanticMatch
          ? 'criterion_specific_evidence_required'
          : 'semantic_mismatch',
    // Keep the established public shape consumed by training-quality.js while
    // the evidenceRuleId exposes which audited rule made the decision.
    confidence: relevant ? 'specific' : hardRuleFailure ? 'none' : 'general',
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
    if (isFalseCredentialClaim(turn.text) || isContextualFalseCredentialClaim(previous, text)) {
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
  const { criterion, quote, rawQuote, previous, next, later } = context;
  if (!quote || quote.split(' ').length < 3) return false;

  // A sentence that itself crosses a professional boundary cannot become
  // positive evidence merely because it also repeats vocabulary from the
  // rubric ("souhlas", "rozhodnutí zůstává", "vratný krok" and so on).
  if (isClinicalOverreach(quote)
    || isConfidentialityBreach(quote)
    || isOutcomeGuarantee(quote)
    || isFalseCredentialClaim(quote)
    || overridesClientConsent(quote)
    || imposesCoachDecision(quote)
    || takesDecisionFromClient(quote)
    || (isExplicitRefusal(previous) && isCoerciveContinuation(quote))) {
    return false;
  }

  // Mentioning a lawyer, figures or another safeguard is not positive evidence
  // when the coach explicitly tells the client to bypass it. This canonical
  // harmful turn previously lit up several mastery rows merely through shared
  // vocabulary ("právník", "nemusíš") and polluted the evidence guide.
  if (/(?:nemusis|nemusite|netreba|nepotrebujes|nepotrebujete).{0,35}(?:cekat|pockat|cakat|kontaktovat|konzultovat).{0,35}(?:pravnik|pravnika|odbornik|poradca|poradce|dalsi cisla|dalsie cisla)/u.test(quote)
    || /(?:pravnik|odbornik|poradca|poradce).{0,35}(?:neni potreba|nie je potrebn|vynech|ignor)/u.test(quote)) {
    return false;
  }

  const masteryCriterionMatch = evidenceMatchesMasteryCriterion({
    competencyId,
    criterion,
    quote,
    rawQuote,
    previous,
    next,
    later,
  });
  if (masteryCriterionMatch !== null) return masteryCriterionMatch;

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
    const ownsError = /(?:mate pravdu|mas pravdu|dekuji za oprav|diky za oprav|dakujem za oprav|rozumim te oprave|rozumiem tej oprave|omlouvam se|ospravedlnujem sa|pridala jsem|pripisala som|vlozila jsem|vlozila som|domyslela jsem|domyslela som|spletla jsem|pomylila som sa|to byla moje interpretace|to bola moja interpretacia|opravim|vratim sa k tomu co ste povedali|vratim se k tomu co jste rekla|vratim se k tomu co jsi rekla|dala jsem ti nevyzadanou radu|prevzala rozhodnuti)/u.test(quote);
    const correctionBefore = /(?:to jsem nerekl|to jsem nerekla|tohle jsem nerekl|tohle jsem nerekla|to som nepovedal|to som nepovedala|takto som to nepovedal|takto som to nepovedala|toto som nepovedal|toto som nepovedala|takhle jsem to nemyslel|takhle jsem to nemyslela|takto som to nemyslel|takto som to nemyslela|nesedi mi|mi nesedi|nepocuvate|nepocuvas|neposlouchate|neposlouchas|ako to mozete vediet|ako to mozes vediet|jak to muzete vedet|jak to muzes vedet|oprav|o radu jsem nezadal|o radu som neziadal|rozhodnuti za me|rozhodnutie za mna)/u.test(previous);
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

function evidenceMatchesMasteryCriterion({ competencyId, criterion, quote, rawQuote, previous, next, later }) {
  if (hasHarmfulMasteryEvidenceReversal(quote)) return false;
  if (masteryEvidenceContradictsCriterion({ criterion, quote })) return false;
  // These common professional-rubric rows need their own high-confidence
  // rules.  The generic competency matcher remains useful for explaining a
  // possible relationship, but it is intentionally too broad to drive the
  // server evidence guide or the anti-false-negative release gate.
  if (/(?:jasny kontrakt a vysledek rozhovoru|jasny ucel a vysledek nacviku)/u.test(criterion)) {
    return competencyId === 'contract'
      && matchesCompleteCoachContract(rawQuote || quote);
  }
  if (/kontrakt a jasny cil rozhovoru/u.test(criterion)) {
    return competencyId === 'contract'
      && assessCoachContractSubcriteria(rawQuote || quote).purpose;
  }
  if (/(?:presne aktivni naslouchani dolozene primou navaznosti na slova klientky|presna navaznost na situaci a druhou stranu|presna reflexe klientcin(?:ych|y) slov)/u.test(criterion)) {
    return competencyId === 'active_listening'
      && matchesActiveListeningEvidence({ quote, rawQuote, previous, later });
  }
  if (/jedna otazka(?: s jednim ucelem| otevrena a nevedouci)?/u.test(criterion)) {
    return competencyId === 'questions'
      && isSingleOpenQuestion(rawQuote || quote)
      && !isLeadingOrDoubleQuestion(rawQuote || quote)
      && !dismissesClientAnswer(quote);
  }
  if (/(?:volba metody podle reakce klientky|volba intervence podle zakazky).*(?:vysvetlen|ucel).*(?:moznost|souhlas)|pojmenovani ucelu a volba jine intervence nebo prace bez ramce/u.test(criterion)) {
    const choice = assessCoachInterventionChoiceSubcriteria(rawQuote || quote);
    return competencyId === 'intervention_choice'
      && choice.method
      && choice.purpose
      && choice.consent
      && !overridesClientConsent(quote);
  }
  if (/rozliseni koucinku mentoringu a garance vysledku/u.test(criterion)) {
    const rejectsGuarantee = /(?:vysled|prijem|obrat|klient).{0,35}(?:nemohu|nemozem|nelze|neda sa|neda se).{0,24}(?:garantovat|zarucit)|(?:nemohu|nemozem|nelze|neda sa|neda se).{0,35}(?:garantovat|zarucit).{0,35}(?:vysled|prijem|obrat|klient)/u.test(quote);
    const explainsCoaching = /(?:koucink|koucing).{0,70}(?:pomuze|pomoze|zpresnit|spresnit|cil|ciel|moznost|krok)|(?:rozhodnuti|rozhodnutie|jednani|konanie).{0,35}(?:zustava|zostava).{0,18}(?:na tobe|na tebe|na vas)/u.test(quote);
    return competencyId === 'ethical_boundaries'
      && rejectsGuarantee
      && explainsCoaching
      && !isOutcomeGuarantee(quote);
  }
  if (/klientkou zvoleny a overitelny dalsi krok/u.test(criterion)) {
    return competencyId === 'outcome'
      && assessCoachOutcomeSubcriteria(rawQuote || quote).relevant;
  }
  if (/pravdive vysvetleni nabidky ceny a interniho certifikatu/u.test(criterion)) {
    const truthfulCertificate = /(?:interni|interny).{0,20}certifikat.{0,30}(?:neni|nie je|nejde o).{0,25}(?:icf|akreditac|licenc)/u.test(quote);
    const truthfulOffer = /(?:vysled|prijem|obrat|klient).{0,35}(?:nemohu|nemozem|nelze|neda sa|neda se).{0,24}(?:garantovat|zarucit)|(?:koucink|koucing).{0,70}(?:pomuze|pomoze|zpresnit|spresnit|cil|ciel|moznost|krok)/u.test(quote);
    return competencyId === 'ethical_boundaries'
      && truthfulCertificate
      && truthfulOffer
      && !isOutcomeGuarantee(quote)
      && !isFalseCredentialClaim(quote);
  }
  if (/reflexe pojmenuje konkretni dukaz mezeru a cil dalsiho pokusu/u.test(criterion)) {
    return competencyId === 'reflection'
      && assessCoachReflectionSubcriteria(rawQuote || quote).complete;
  }
  if (/pozorovatelny dukaz jedna ucelna otazka/u.test(criterion)) {
    return competencyId === 'questions'
      && isSingleOpenQuestion(rawQuote || quote)
      && !isLeadingOrDoubleQuestion(rawQuote || quote)
      && !dismissesClientAnswer(quote)
      && isQuestionTopicallyGrounded(rawQuote || quote, previous);
  }
  if (/pozorovatelny dukaz plynuly proces/u.test(criterion)) {
    const linksFromClient = meaningfulOverlap(quote, previous) >= 1;
    const explicitTransition = /(?:z toho co|na to navaz|proto ted|preto teraz|nejdriv jsme|najprv sme|ted muzeme|teraz mozeme|dalsim krokem|dalsim krokom|prejdeme k|pojďme ted|podme teraz)/u.test(quote);
    const processMove = isSingleOpenQuestion(rawQuote || quote)
      || assessCoachInterventionChoiceSubcriteria(rawQuote || quote).complete
      || assessCoachOutcomeSubcriteria(rawQuote || quote).relevant;
    return competencyId === 'intervention_choice'
      && linksFromClient
      && explicitTransition
      && isQuestionTopicallyGrounded(rawQuote || quote, previous, { allowConsentQuestion: true })
      && processMove;
  }
  if (/pozorovatelny dukaz jasny rozsah sluzby/u.test(criterion)) {
    const statesLimit = /(?:jako koucka|ako koucka|v koucinku|v koucingu|moje role|moja rola).{0,75}(?:nenahrazuje|nenahradza|nelecim|neliecim|nediagnostik|diagnozu neurc|terapi|zdravotn)/u.test(quote)
      || /(?:nenahrazuji|nenahradzam).{0,35}(?:terapi|liecbu|lekare|lekara)/u.test(quote);
    const statesOfferedScope = /(?:mohu|muzeme|mozem|mozeme).{0,70}(?:pracovat|zmapovat|ujasnit|spresnit|zpresnit|prozkoumat|preskumat).{0,50}(?:cil|ciel|moznost|krok|neklinick)/u.test(quote)
      || /(?:neklinicky|neklinicky).{0,25}(?:cil|ciel|koucink|koucing)/u.test(quote);
    return competencyId === 'ethical_boundaries'
      && statesLimit
      && statesOfferedScope
      && !isClinicalOverreach(quote);
  }
  if (/respekt k odmitnuti otazky a zachovani autonomie klientky/u.test(criterion)) {
    return competencyId === 'refusal_autonomy'
      && isExplicitRefusal(previous)
      && assessCoachRefusalAutonomySubcriteria(rawQuote || quote).complete
      && !isCoerciveContinuation(quote);
  }
  if (/prijeti opravy bez obhajovani(?: a prevzeti odpovednosti za chybny smer)?/u.test(criterion)) {
    return competencyId === 'alliance_repair'
      && matchesAllianceRepairEvidence({ quote, previous });
  }
  if (/navrat k dohodnute zakazce/u.test(criterion)) {
    return competencyId === 'contract'
      && matchesCompleteCoachContract(rawQuote || quote);
  }
  if (/rozpoznani pasivniho sebevrazedneho sdeleni jako bezpecnostniho signalu/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:prej|praj).{0,45}(?:neprobud|nezobud)/u.test(quote)
      && /(?:beru|beriem).{0,18}(?:vazne|vazne)/u.test(quote);
  }
  if (/okamzite preruseni bezneho koucovani/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:zastavim|prerusim|nebudeme pokracovat|nebudem pokracovat).{0,35}(?:bezne|bezneho|koucovani|koucovanie|pracovni cil|pracovny ciel)/u.test(quote)
      && /(?:bezpec|sebevraz|samovraz|ubliz|neprobud|nezobud)/u.test(quote);
  }
  if (/priorita neodkladne lidske pomoci pred technikou nebo cilem/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:nejdriv|najprv|ted|teraz|priorit).{0,45}(?:lidsk|ludsk|pomoc|112|155|blizk)/u.test(quote)
      && /(?:(?:k|ke|ku) (?:technice|technike|cilum|cielom|cili|cielu|koucovani|koucovaniu).{0,45}(?:az po|vratime|vratime sa)|pred technik|pred ciel|misto technik|namiesto technik)/u.test(quote);
  }
  if (/konkretni propojeni na 112 nebo 155 a dostupnou blizkou osobu/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:112|155)/u.test(quote)
      && /(?:blizk|sestr|bratr|partner|kamarad|kamarat|rodin)/u.test(quote)
      && hasProfessionalSuicideRiskResponse(quote)
      && !forbidsSuicideHumanSupport(quote);
  }
  if (/pozorovatelny dukaz uplne a citlive overeni rizika pred pripadnym navratem ke koucovani/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:prave ted|prave teraz|aktualn)/u.test(quote)
      && /(?:sebevraz|samovraz|ubliz)/u.test(quote)
      && /(?:zamer|umysl)/u.test(quote)
      && /plan/u.test(quote)
      && /(?:prostred|prostried)/u.test(quote)
      && /bezpec/u.test(quote);
  }
  if (/(?:prime|priame) otazky na aktualn.*(?:myslen|myslien).*zamer.*plan.*(?:prostred|prostried).*bezpec/u.test(criterion)) {
    return competencyId === 'questions'
      && /\?/u.test(rawQuote || '')
      && !refusesSuicideSafetyAssessment(quote)
      && /(?:prave ted|prave teraz|aktualn)/u.test(quote)
      && /(?:sebevraz|samovraz|ubliz)/u.test(quote)
      && /(?:zamer|zamer)/u.test(quote)
      && /plan/u.test(quote)
      && /(?:prostred|prostried)/u.test(quote)
      && /bezpec/u.test(quote);
  }
  if (/prime otazky na aktualni plan prostredky a bezpeci/u.test(criterion)) {
    return competencyId === 'questions'
      && /\?/u.test(rawQuote || '')
      && !refusesSuicideSafetyAssessment(quote)
      && /(?:prave ted|prave teraz|dnes|aktualn)/u.test(quote)
      && /(?:sebevraz|samovraz|ubliz)/u.test(quote)
      && /plan/u.test(quote)
      && /(?:prostred|prostried)/u.test(quote)
      && /bezpec/u.test(quote);
  }
  if (/prime otazky na myslenky a zamer/u.test(criterion)) {
    return competencyId === 'questions'
      && /\?/u.test(rawQuote || '')
      && !refusesSuicideSafetyAssessment(quote)
      && /(?:myslis|myslite|premyslis|premyslate|napada|myslien|myslen)/u.test(quote)
      && /(?:sebevraz|samovraz|ubliz|nechces zit|nechcete zit)/u.test(quote)
      && /(?:zamer|chces to udelat|chces to urobit|hodlas|planujes)/u.test(quote);
  }
  if (/prime otazky na plan a prostredky/u.test(criterion)) {
    return competencyId === 'questions'
      && /\?/u.test(rawQuote || '')
      && !refusesSuicideSafetyAssessment(quote)
      && /plan/u.test(quote)
      && /(?:prostred|prostried|pristup k|po ruce|pri sebe)/u.test(quote);
  }
  if (/overeni schopnosti zustat v bezpeci/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /\?/u.test(rawQuote || '')
      && !refusesSuicideSafetyAssessment(quote)
      && /(?:dokazes|dokazete|vies|viete|muzes|muzete).{0,42}(?:zustat|zostat).{0,20}bezpec/u.test(quote);
  }
  if (/klidny nesoudici ton bez diagnostiky a bez falesneho uklidneni/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && !isClinicalOverreach(quote)
      && !/(?:urcite|jiste|zarucene).{0,25}(?:budete|budes).{0,20}(?:v poradku|v poriadku)/u.test(quote)
      && /(?:beru vazne|beriem vazne|zastavim bezne|zastavim bezne|zustanu|zostanem|pomoc|bezpec)/u.test(quote);
  }
  if (/primerene propojeni s krizovou nebo zdravotni pomoci a blizkym clovekem/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:112|155|krizov|zdravotn)/u.test(quote)
      && /(?:blizk|blizk|sestra|partner|kamarad|osob)/u.test(quote)
      && hasProfessionalSuicideRiskResponse(quote)
      && !forbidsSuicideHumanSupport(quote);
  }
  if (/primerena krizova zdravotni a blizka podpora/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:112|155|krizov|zdravotn|lekar)/u.test(quote)
      && /(?:blizk|sestra|partner|kamarad|osob)/u.test(quote)
      && hasProfessionalSuicideRiskResponse(quote)
      && !forbidsSuicideHumanSupport(quote);
  }
  if (/navrat ke koucovani az po vyjasneni bezpeci/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:ke koucovani|ku koucovaniu|k pracovnim cilum|k pracovnym cielom).{0,45}(?:az po|po vyjasneni|po vyjasneni).{0,30}bezpec/u.test(quote);
  }
  if (/duvernost a reporting vyjednane predem/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:obsah.{0,12}(?:sezeni|sedenia)|poznamk)/u.test(quote)
      && /(?:firme|firma|report)/u.test(quote)
      && /(?:nepredam|neodovzdam|nesdilim|nezdielam|neposkytnem|neposkytnu)/u.test(quote)
      && /(?:bez|predchoziho|predchadzajuceho).{0,20}(?:souhlas|suhlas)/u.test(quote);
  }
  if (/srozumitelne vymezeni koucovaci role/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:jako koucka|ako koucka|v koucinku|v koucingu|moje role)/u.test(quote)
      && /(?:nediagnostik|diagnozu neurc|nestanov|nemohu lecit|nemozem liecit|nenahrazuje.{0,18}(?:lecbu|liecbu|terapi))/u.test(quote);
  }
  if (/(?:konkretni doporuceni zdravotni nebo terapeuticke pomoci|konkretni odborna navaznost)/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:praktick|lekar|lekark|psycholo|psychoterapeut|terapeut|psychiatr|krizov)/u.test(quote)
      && /(?:kontakt|objedn|zavolat|zavolaj|doporuc|odkaz|navaz|prepoj|spoj)/u.test(quote);
  }
  if (/puvodni souhlas neni zpetne rozsiren/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:puvodni|dosavadni|povodny|doterajsi).{0,24}(?:souhlas|dohod)/u.test(quote)
      && /(?:nelze|nemuzu|nemuzeme|nemozem|nemozeme|nebudu|nebudeme|nebudem|neda se|neda sa).{0,36}(?:zpetne|spatne|dodatecne).{0,24}(?:rozsirit|zmenit|doplnit)/u.test(quote);
  }
  if (/rozliseni ucasti cile a obsahu sezeni/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:ucast|dochazk)/u.test(quote)
      && /(?:cil|ciel)/u.test(quote)
      && /(?:obsah|poznamk|vyrok)/u.test(quote)
      && /(?:rozlis|oddel|jine|ine|ale|nikoli|nie)/u.test(quote);
  }
  if (/minimalizace sdilenych dat/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:jen|pouze|iba|minimal|nezbytn|nevyhnutn|agregovan)/u.test(quote)
      && /(?:data|udaj|report|ucast|dochazk|metrik)/u.test(quote)
      && !/(?:obsah|poznamk|prepis).{0,30}(?:predam|odovzdam|poslu|poslem|sdilim|zdielam)/u.test(quote);
  }
  if (/nova tristranna dohoda pouze do budoucna/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:tristrann|tri strany|klientk.{0,18}(?:firma|sponzor))/u.test(quote)
      && /(?:do budoucna|pro budouc|pre buduc|predem|vopred|pro dalsi|pre dalsie)/u.test(quote)
      && /(?:dohod|souhlas|suhlas)/u.test(quote);
  }
  if (/transparentni komunikace ke klientce i sponzorovi/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:klientk|zamestnank)/u.test(quote)
      && /(?:sponzor|firma|hr)/u.test(quote)
      && /(?:predem|vopred|otevrene|transparent|vedet|vediet|inform)/u.test(quote);
  }
  if (/zadne potvrzeni konkretniho vyroku nebo tematu/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:nepotvrdim|nemohu.{0,20}potvrdit|nemozem.{0,20}potvrdit|nebudu.{0,20}potvrzovat)/u.test(quote)
      && /(?:vyrok|tema|obsah|co rekla|co povedala)/u.test(quote);
  }
  if (/zadne predani zapisu/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:zapis|poznamk|prepis)/u.test(quote)
      && /(?:nepredam|neodovzdam|neposlu|neposlem|nesdilim|nezdielam)/u.test(quote);
  }
  if (/jasne vysvetleni predchozi dohody/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:predchozi|dosavadni|povodn|doterajsi).{0,24}(?:dohod|souhlas)/u.test(quote)
      && /(?:jen|pouze|iba).{0,25}(?:ucast|dochazk|obecny cil|vseobecny ciel)/u.test(quote);
  }
  if (/klientka ma kontrolu nad novym souhlasem/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:klientk|ona|zamestnank)/u.test(quote)
      && /(?:sama|predem|vopred).{0,28}(?:rozhodne|urci|schvali|odsouhlasi|zvoli)/u.test(quote)
      && /(?:souhlas|sdil|zdiel|report)/u.test(quote);
  }
  if (/ochrana dat bez utocneho tonu/u.test(criterion)) {
    return competencyId === 'ethical_boundaries'
      && /(?:data|obsah|poznamk|zapis|dohod|souhlas)/u.test(quote)
      && /(?:nepredam|neodovzdam|nepotvrdim|nemohu|nemozem|chran|ochran)/u.test(quote)
      && !/(?:to je absurdni|to je smesne|nemate pravo se ptat|co si dovolujete|nechapete zaklad)/u.test(quote);
  }
  if (/prevzeti odpovednosti za nevyzadanou radu/u.test(criterion)) {
    return competencyId === 'alliance_repair'
      && /(?:nevyzadanou radu|o radu jste nezadala|o radu si neziadala)/u.test(quote)
      && /(?:prevzala rozhodnuti|rozhodovala za|rozhodnutie za)/u.test(quote)
      && /(?:omlouvam se|ospravedlnujem sa|mrzi me|mrzi ma)/u.test(quote);
  }
  if (/dopad na alianci je uznan/u.test(criterion)) {
    return competencyId === 'alliance_repair'
      && /(?:mrzi me|mrzi ma|omlouvam se|ospravedlnujem sa)/u.test(quote)
      && /(?:neposlouch|nepocuv|pocit|alianc|spoluprac)/u.test(quote);
  }
  if (/klientka potvrzuje opraveny dalsi tah/u.test(criterion)) {
    const proposesClientChoice = /(?:chces|chcete|volis|volite|vybiras|vyberate|co by|jak by|ako by|ktery|ktory|aky).{0,70}(?:pokracovat|pracovat|otazk|zpusob|sposob|tema|fakt)/u.test(quote);
    const clientConfirms = /(?:^|\b)(?:ano|jo|dobre|plati|to sedi|presne|takto ano|takhle ano|chci|volim|vybiram|pojdme|muzeme)\b/u.test(next)
      && !/(?:\bale\b|\bavsak\b|\bjenze\b).{0,50}(?:\bne\b|nechci|nechcem|nesedi|nesuhlasi|odmitam|odmietam|nebudu|nebudem)|(?:nechci|nechcem|nesedi|nesuhlasi|odmitam|odmietam|nebudu|nebudem).{0,30}(?:pokracovat|takto|timto|tymto|zpusob|sposob)/u.test(next);
    return competencyId === 'alliance_repair'
      && proposesClientChoice
      && clientConfirms;
  }
  if (/autonomie rozhodnuti je vracena klientce/u.test(criterion)) {
    return competencyId === 'refusal_autonomy'
      && /(?:rozhodnuti|rozhodnutie).{0,28}(?:zustava|zostava).{0,16}(?:na tobe|na tebe)|(?:konecna|konecna|finalni|finalna).{0,18}(?:volba|volba|rozhodnuti|rozhodnutie).{0,18}(?:je tvoje|je tvoja|je vase|patri tobe|patri tebe)/u.test(quote)
      && /(?:chces|chcete|volis|zvolit|jiny zpusob|iny sposob)/u.test(quote);
  }
  if (/zakazka a zpusob prace jsou znovu overeny/u.test(criterion)) {
    return competencyId === 'contract'
      && /(?:ktery|aky|ktory).{0,24}(?:zpusob prace|sposob prace).{0,24}(?:volis|volite|vybiras)/u.test(quote)
      && /(?:podle ceho|podla coho).{0,30}(?:pozn|over|vyhodnot)/u.test(quote);
  }
  if (/journaling ani domaci ukol nejsou znovu nabidnuty/u.test(criterion)) {
    const mentionsDiary = /(?:denik|dennik|journaling)/u.test(quote);
    const mentionsHomework = /(?:domaci ukol|domacu ulohu)/u.test(quote);
    const rejectsBoth = /(?:denik|dennik|journaling).{0,16}ani.{0,16}(?:domaci ukol|domacu ulohu).{0,28}(?:nebudu|nebudem|nebudeme)/u.test(quote)
      || /(?:nebudu|nebudem|nebudeme).{0,28}(?:navrhovat|navrhovat|ponukat|ponoukat).{0,20}(?:denik|dennik|journaling).{0,16}ani.{0,16}(?:domaci ukol|domacu ulohu)/u.test(quote)
      || (mentionsDiary && mentionsHomework
        && /(?:denik|dennik|journaling).{0,30}(?:nebudu|nebudem|nebudeme)/u.test(quote)
        && /(?:domaci ukol|domacu ulohu).{0,30}(?:nebudu|nebudem|nebudeme)/u.test(quote));
    const reimposesEither = /(?:denik|dennik|journaling|domaci ukol|domacu ulohu).{0,24}(?:udelas|urobis|musis|musite|dostanes|dostanete|budes delat|budete delat)/u.test(quote)
      || /(?:udelas|urobis|musis|musite|dostanes|dostanete).{0,24}(?:denik|dennik|journaling|domaci ukol|domacu ulohu)/u.test(quote);
    return competencyId === 'refusal_autonomy'
      && rejectsBoth
      && !reimposesEither;
  }
  if (/vyslovne odmitnuti je respektovano a klientcina autonomie zustava zachovana/u.test(criterion)) {
    const refusal = assessCoachRefusalAutonomySubcriteria(rawQuote || quote);
    const explicitAlternative = /(?:chces|chcete|mozes|mozete|muzes|muzete).{0,65}(?:jinou|inu|jiny|iny|tema|smer|zpusob|sposob|skoncit|uzavrit|uzavriet|ukoncit)/u.test(quote);
    return competencyId === 'refusal_autonomy'
      && isExplicitRefusal(previous)
      && ((/(?:denik|dennik|journaling|domaci ukol|domacu ulohu)/u.test(quote)
          && /(?:nebudu|nebudem|nebudeme)/u.test(quote))
        || /(?:chces|chcete).{0,55}(?:pokracovat|uzavrit|ukoncit)/u.test(quote)
        || (isExplicitRefusal(previous) && refusal.respectsRefusal && explicitAlternative))
      && !isCoerciveContinuation(quote);
  }
  if (/alternativa neni prevleceny stejny ukol/u.test(criterion)) {
    return competencyId === 'intervention_choice'
      && isExplicitRefusal(previous)
      && /(?:pokracovat).{0,28}(?:rozhovor|rozhovorom)|(?:smer).{0,18}(?:uzavrit|uzavriet)/u.test(quote)
      && !/(?:denik|dennik|journaling|domaci ukol|domacu ulohu).{0,24}(?:udelas|urobis|musis|musite|dostanes|dostanete|budes delat|budete delat)/u.test(quote);
  }
  if (/klientka muze smer ukoncit/u.test(criterion)) {
    return competencyId === 'refusal_autonomy'
      && /(?:chces|chcete|muzeme|mozeme|mozes|muzete).{0,55}(?:uzavrit|uzavriet|ukoncit|skoncit|zastavit)/u.test(quote)
      && !/(?:i pres|aj napriek).{0,24}(?:odmitnut|nechces|nechcete).{0,30}(?:pokracovat|skusit|zkusit)/u.test(quote);
  }
  if (/zakazka je znovu overena/u.test(criterion)) {
    return competencyId === 'contract'
      && /(?:pokud|ak).{0,45}(?:volis|volite|vyberas).{0,35}(?:pokracovat|rozhovor)/u.test(quote)
      && /(?:co|cim).{0,40}(?:uzitecn|uzitocn|prozkoumat|preskumat)/u.test(quote);
  }
  if (/konkretni uzavreni nebo dalsi krok/u.test(criterion)) {
    return competencyId === 'outcome' && assessCoachOutcomeSubcriteria(rawQuote || quote).relevant;
  }
  if (/nevratnost a casovy tlak jsou pojmenovane/u.test(criterion)) {
    return competencyId === 'reflection'
      && /nevratn/u.test(quote)
      && /(?:nez|predtim|skor nez|nejprve|najprv)/u.test(quote)
      && /(?:zjistit|zistit|data|financ|vypovedn|variant)/u.test(quote);
  }
  if (/jsou zmapovany dusledky a moznosti/u.test(criterion)) {
    return competencyId === 'reflection'
      && /(?:financ|vypovedn|dusled|nasledk)/u.test(quote)
      && /(?:variant|moznost|presun|trh)/u.test(quote);
  }
  if (/autonomie rozhodnuti zustava klientce/u.test(criterion)
    || /odpovednost neni skryte prevzata radou/u.test(criterion)) {
    return competencyId === 'refusal_autonomy'
      && (/(?:rozhodnuti|rozhodnutie).{0,45}(?:zustava|zostava|patri).{0,20}(?:na tobe|na tebe|tobe|tebe)/u.test(quote)
        || /(?:rozhodnuti|rozhodnutie).{0,45}(?:za tebe|za vas).{0,18}(?:neudelam|neurobim).{0,90}volba.{0,20}(?:zustava|zostava).{0,15}(?:na tobe|na tebe)/u.test(quote))
      && !imposesCoachDecision(quote);
  }
  if (/vratny mezikrok nebo cas na rozhodnuti/u.test(criterion)) {
    const outcome = assessCoachOutcomeSubcriteria(rawQuote || quote);
    return competencyId === 'outcome'
      && /(?:nejmensi|najmensi|vratny|vratny krok)/u.test(quote)
      && outcome.clientOwned
      && outcome.clientChoice
      && outcome.timing
      && outcome.verification;
  }
  if (/pozorovatelny dukaz klientkou vlastnene rozhodnuti/u.test(criterion)) {
    const outcome = assessCoachOutcomeSubcriteria(rawQuote || quote);
    return competencyId === 'outcome'
      && outcome.clientOwned
      && outcome.clientChoice
      && /vratn/u.test(quote)
      && outcome.timing
      && outcome.verification;
  }
  return null;
}

function masteryEvidenceContradictsCriterion({ criterion, quote }) {
  if (/(?:konkretni doporuceni zdravotni nebo terapeuticke pomoci|konkretni odborna navaznost)/u.test(criterion)
    && /(?:nedoporuc|nekontakt|neobjedn|nevyhled)/u.test(quote)) return true;
  if (/puvodni souhlas neni zpetne rozsiren/u.test(criterion)
    && /(?:takze|ale|avsak|presto).{0,55}(?:dodatecne|zpetne).{0,30}(?:zmen|rozsir|dopln)/u.test(quote)) return true;
  if (/rozliseni ucasti cile a obsahu sezeni/u.test(criterion)
    && /(?:nerozlis|neoddel)/u.test(quote)) return true;
  if (/minimalizace sdilenych dat/u.test(criterion)
    && /(?:vcetne|zahrn).{0,35}(?:celeho|cely|obsah|prepis|poznamk)/u.test(quote)) return true;
  if (/nova tristranna dohoda pouze do budoucna/u.test(criterion)
    && /(?:zpetne|dodatecne|ne pouze do budoucna|nie iba do buducna)/u.test(quote)) return true;
  if (/zadne potvrzeni konkretniho vyroku nebo tematu/u.test(criterion)
    && /(?:samozrejme|naopak|ale|avsak).{0,30}potvrd/u.test(quote)) return true;
  if (/zadne predani zapisu/u.test(criterion)
    && /(?:samozrejme|naopak|ale|avsak).{0,30}(?:poslu|poslem|predam|odovzdam|sdilim|zdielam)/u.test(quote)) return true;
  if (/jasne vysvetleni predchozi dohody/u.test(criterion)
    && /(?:nebyla|nebola|nebyl|nebol).{0,30}(?:jen|iba|pouze).{0,25}(?:ucast|dochazk)|(?:sdilime|zdielame|predavame|odovzdavame).{0,25}(?:obsah|prepis|poznamk)/u.test(quote)) return true;
  if (/klientka ma kontrolu nad novym souhlasem/u.test(criterion)
    && /(?:nerozhodne|neschvali|neodsouhlasi|neurci|nezvoli)/u.test(quote)) return true;
  if (/(?:dopad na alianci je uznan|prijeti opravy bez obhajovani)/u.test(criterion)
    && /(?:ale|avsak|jenze).{0,55}(?:nema|nema to|nemalo).{0,25}(?:dopad|vliv)|(?:ale|avsak|jenze).{0,55}(?:udelala bych to znovu|urobila by som to znova|nic menit nebudu|nic menit nebudem|trvam na tom|stejne pokracuji|aj tak pokracujem)/u.test(quote)) return true;
  if (/nevratnost a casovy tlak jsou pojmenovane/u.test(criterion)
    && /(?:neni|nie je).{0,12}nevratn|(?:neni potreba|nie je potrebne|netreba).{0,35}(?:zjistit|zistit|data|variant)/u.test(quote)) return true;
  if (/jsou zmapovany dusledky a moznosti/u.test(criterion)
    && /(?:dusled|nasledk|variant|moznost).{0,40}(?:nebudeme|nebudu|nebudem)|(?:nebudeme|nebudu|nebudem).{0,40}(?:dusled|nasledk|variant|moznost)/u.test(quote)) return true;
  if (/autonomie rozhodnuti zustava klientce/u.test(criterion)
    && /(?:ale|avsak|jenze).{0,45}(?:udelam|urobim).{0,20}(?:za tebe|za vas)/u.test(quote)) return true;
  return false;
}

function hasHarmfulMasteryEvidenceReversal(quote) {
  return /(?:ale|avsak|jenze|stejne|aj tak).{0,65}(?:diagnoz[a-z]*.{0,20}\b(?:stanovim|urcim|dam)\b|\b(?:stanovim|urcim|dam)\b.{0,20}diagnoz)/u.test(quote)
    || /diagnoz[a-z]*.{0,40}(?:neurcuji|neurcujem|nestanovuji|nestanovujem).{0,55}(?:ale|avsak|jenze).{0,45}\b(?:stanovim|urcim|dam)\b/u.test(quote)
    || /(?:certifikat|osvedceni).{0,100}(?:ale|avsak|jenze).{0,45}(?:tento |tento )?(?:certifikat|osvedceni)?.{0,18}\b(?:je|dava|poskytuje|znamena)\b.{0,28}(?:oficialni|oficialna|icf|licenc|akreditovan)/u.test(quote)
    || /(?:nepredam|neodovzdam|nesdilim|nezdielam|neposlu|neposlem).{0,55}(?:ale|avsak|jenze|samozrejme|naopak).{0,45}\b(?:predam|odovzdam|sdilim|zdielam|poslu|poslem)\b/u.test(quote)
    || /(?:lidsk|ludsk).{0,20}pomoc.{0,25}(?:nepotreb|netreba)|(?:budeme|budem).{0,24}pokracovat.{0,24}(?:v cili|v cieli)/u.test(quote)
    || /(?:bezpec|pomoc).{0,35}(?:hloupost|hlupost|zbytecn|nezmysl|nesmysl)/u.test(quote)
    || /(?:jste|jsi|ste|si).{0,18}(?:idiot|hlupak|hloupa|hloupy|neschopn|trapn)/u.test(quote);
}

function matchesCompleteCoachContract(value) {
  const normalized = normalizeCoachText(value);
  if (/(?:nechcete|nechces|nechcete si|nechces si).{0,35}(?:odnest|odniest)|(?:nepoznate|nepoznas|nespoznate|nespoznas).{0,40}(?:nepomohl|nepomohlo|nepomohol)/u.test(normalized)) return false;
  if (assessCoachContractSubcriteria(value).complete) return true;
  // A repair/re-contract can legitimately agree both the way of working and
  // its success test without repeating the opening-session wording.
  const choosesMethod = /(?:ktery|ktory|aky|jaky).{0,30}(?:zpusob prace|sposob prace|postup|forma).{0,32}(?:si )?(?:volis|volite|vybiras|vyberate|zvolis|zvolite)/u.test(normalized);
  const successCriterion = /(?:podle ceho|podla coho).{0,36}(?:pozn|over|vyhodnot)|(?:jak|ako).{0,36}(?:pozn|over|vyhodnot).{0,28}(?:pomohl|pomohlo|pomohol|uzitecn|uzitocn)/u.test(normalized);
  return choosesMethod && successCriterion;
}

function matchesActiveListeningEvidence({ quote, rawQuote, previous, later }) {
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

function matchesAllianceRepairEvidence({ quote, previous }) {
  const ownsError = /(?:mate pravdu|mas pravdu|dekuji za oprav|diky za oprav|dakujem za oprav|rozumim te oprave|rozumiem tej oprave|omlouvam se|ospravedlnujem sa|pridala jsem|pripisala som|vlozila jsem|vlozila som|domyslela jsem|domyslela som|spletla jsem|pomylila som sa|to byla moje interpretace|to bola moja interpretacia|dala jsem ti nevyzadanou radu|dala som ti nevyziadanu radu|prevzala jsem rozhodnuti|prevzala som rozhodnutie|tlacila jsem te|tlacila som ta)/u.test(quote);
  const correctionBefore = /(?:to jsem nerekl|to jsem nerekla|tohle jsem nerekl|tohle jsem nerekla|to som nepovedal|to som nepovedala|takto som to nepovedal|takto som to nepovedala|toto som nepovedal|toto som nepovedala|takhle jsem to nemyslel|takhle jsem to nemyslela|takto som to nemyslel|takto som to nemyslela|nesedi mi|mi nesedi|nepocuvate|nepocuvas|neposlouchate|neposlouchas|ako to mozete vediet|ako to mozes vediet|jak to muzete vedet|jak to muzes vedet|oprav|o radu jsem nezadal|o radu jsem nezadala|o radu som neziadal|o radu som neziadala|rozhodnuti za me|rozhodnutie za mna)/u.test(previous);
  const defendsInterpretation = /(?:ale|avsak|jenze).{0,45}(?:moje|moja) (?:interpretace|interpretacia).{0,25}(?:byla|bola|je) (?:spravna|presna|pravdiva)|(?:stejne|aj tak).{0,30}(?:mam pravdu|mala jsem pravdu|mal som pravdu)|(?:vas|vasi|tvou|tvoji|vasu|tvoju) oprav[a-z]*.{0,25}(?:ignoruji|ignorujem|nebudu respektovat|nebudem respektovat)|(?:ale|avsak|jenze).{0,55}(?:udelala bych to znovu|urobila by som to znova|nic menit nebudu|nic menit nebudem|trvam na tom|stejne pokracuji|aj tak pokracujem)/u.test(quote);
  return ownsError
    && correctionBefore
    && !defendsInterpretation
    && !/(?:mrzi me ze to tak vnimate|mrzi me ze to tak vnimas)/u.test(quote);
}

function isSingleOpenQuestion(rawQuote) {
  const source = String(rawQuote || '');
  if ((source.match(/\?/gu) || []).length !== 1) return false;
  // Judge the actual interrogative clause, not an incidental word such as
  // “co” inside a preceding reflection (“Slyším, co říkáš. Sedí to?”).
  // A short framing clause before a colon remains acceptable.
  const beforeQuestionMark = source.slice(0, source.indexOf('?'));
  const questionClause = beforeQuestionMark.split(/[.!;:]/u).at(-1) || '';
  const normalized = normalizeCoachText(questionClause);
  return /^(?:co|cim|ako|jak|aky|aka|ake|jaky|jaka|jake|ktory|ktora|ktore|ktery|ktera|ktere|v com|v cem|podla coho|podle ceho|o com|o cem|kde|kto|kdo)\b/u.test(normalized);
}

function isQuestionTopicallyGrounded(rawQuote, previous, { allowConsentQuestion = false } = {}) {
  const source = String(rawQuote || '');
  const questionMark = source.lastIndexOf('?');
  if (questionMark < 0) return false;
  const prefix = source.slice(0, questionMark);
  const separator = Math.max(prefix.lastIndexOf('.'), prefix.lastIndexOf(';'), prefix.lastIndexOf(':'));
  const questionClause = normalizeCoachText(prefix.slice(separator + 1));
  if (!questionClause) return false;
  if (allowConsentQuestion
    && /^(?:chces|chcete|muzes|muzete|mozeme|muzeme).{0,36}(?:ji|ju|ho|to|tuto|ten).{0,16}(?:pouzit|zkusit|skusit|vyzkouset|vyskusat|projit|prejst)/u.test(questionClause)) return true;
  const overlap = meaningfulOverlap(questionClause, previous);
  return overlap >= 1 && !isDetachedOffTopicListeningClause(questionClause, previous);
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
  const explicitConsentOverride = /(?:vas|vas|tvuj|tvoje|tvuj|vas souhlas|suhlas).{0,28}(?:nepotrebuji|nepotrebujem|neni potreba|netreba)|(?:bez|i bez).{0,18}(?:vaseho|tveho|vasho|tvojho)?\s*(?:souhlasu|suhlasu).{0,30}\b(?:pokracujeme|pokracovat|udelame|urobime|pouzijeme)\b/u.test(text);
  const conditionalRefusalOverride = /(?:kdyz|pokud|ak).{0,30}\b(?:odmitnes|odmitnete|odmietnes|odmietnete|reknes ne|povies nie)\b.{0,70}(?:\b(?:pouzijeme|udelame|urobime|provedeme|vykoname)\b.{0,30}(?:stejne|presto|aj tak|napriek tomu)|(?:stejne|presto|aj tak|napriek tomu).{0,30}\b(?:pouzijeme|udelame|urobime|provedeme|vykoname)\b)/u.test(text);
  return explicitConsentOverride || conditionalRefusalOverride;
}

function ignoresClientCorrection(text) {
  return /(?:vas|vasi|tvou|tvoji|vasu|tvoju) oprav[a-z]*.{0,28}(?:ignoruji|ignorujem|nebudu respektovat|nebudem respektovat)|(?:opravu|korekci|opravu).{0,25}(?:ignoruji|ignorujem)/u.test(text);
}

function imposesCoachDecision(text) {
  const directTakeover = /(?:stejne|aj tak).{0,35}(?:udelate|udelas|urobite|urobis).{0,25}(?:co rikam|co reknu|co hovorim|co poviem)|(?:rozhodnuti|rozhodnutie).{0,30}(?:udelam za vas|urobim za vas|je na mne)/u.test(text);
  const imposedContract = /(?:cil|ciel|zakazk).{0,50}\b(?:vyjasnim|urcim|stanovim|definuji|definujem)\b.{0,25}(?:ja)(?:\s|$).{0,90}\b(?:budes|budete)\b.{0,30}(?:souhlasit|suhlasit|koupit|kupit|objednat)/u.test(text);
  const coerciveJobCondition = /(?:odchod|vypoved)(?:(?!\b(?:neni|nie je|nejde o)\b).){0,35}\b(?:je|bude|predstavuje)\b.{0,20}(?:podmink|podmienk).{0,30}(?:pokracov)/u.test(text);
  const actedInClientName = /(?:vypoved|smlouv|zmluv|objednavk).{0,100}(?:(?:tvym|vasim|tvojim).{0,12}(?:jmenem|menom).{0,50}\b(?:odeslal|odeslala|odoslal|odoslala|podepsal|podepsala|podpisal|podpisala|objednal|objednala)\b|\b(?:odeslal|odeslala|odoslal|odoslala|podepsal|podepsala|podpisal|podpisala|objednal|objednala)\b.{0,50}(?:tvym|vasim|tvojim).{0,12}(?:jmenem|menom))/u.test(text)
    || /(?:tvym|vasim|tvojim).{0,12}(?:jmenem|menom).{0,100}(?:vypoved|smlouv|zmluv|objednavk).{0,50}\b(?:odeslal|odeslala|odoslal|odoslala|podepsal|podepsala|podpisal|podpisala|objednal|objednala)\b/u.test(text);
  return directTakeover || imposedContract || coerciveJobCondition || actedInClientName;
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
    const diagnosticAct = /\b(?:diagnostikuji|diagnostikujem|stanovuji.{0,20}diagnoz[a-z]*|stanovujem.{0,20}diagnoz[a-z]*|diagnoz[a-z]*.{0,24}(?:stanovim|stanovime|urcim|urcime|dam|dame)|(?:mohu|mozeme|mozem|budu|budem).{0,18}diagnostikovat)\b/u.exec(clause);
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
  if (isMetadataOnlyDisclosure(text)) return false;
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
  return /(?:nechci pokracovat|nechcem pokracovat|(?:nechci|nechcem)(?: si)? (?:(?:vest|viest|psat|pisat)(?: si)? (?:denik|dennik|journaling)|(?:dostat|mit|mat|plnit) (?:dalsi |dalsiu )?(?:domaci ukol|domacu ulohu)|(?:zadny |ziadny |dalsi |dalsiu )?(?:denik|dennik|journaling|domaci ukol|domacu ulohu))\b|nechci.{0,30}(?:poustet|pustit|venovat|psat|delat|jit do (?:te|teto) otazk\w*|(?:tu|tuhle|tuto) otazk\w*).{0,22}(?:denik|domaci ukol)?|nechcem.{0,30}(?:pustat|pustit|venovat|pisat|robit|ist do (?:tej|tejto) otazk\w*|(?:tu|tuto|tuto) otazk\w*).{0,22}(?:dennik|domacu ulohu)?|(?:do|k) (?:te|teto|tej|tejto) otazk[a-z]*.{0,18}(?:nechci jit|nechcem ist)|nechci to|nechcem to|nechci tuhle|nechcem tuto|nechci zavrit|nechcem zavriet|nebudu pokracovat|nebudem pokracovat|nesedi mi|mi nesedi|je mi neprijemne|citim se neprijemne|citim sa neprijemne|citim se odpojene|citim sa odpojene|stop|zastav|odmitam|odmietam|otazku nechci|otazku nechcem|(?:vizualizac|denik|dennik|domaci ukol|domacu ulohu).{0,30}(?:delat nechci|robit nechcem|nechci|nechcem)|(?:techni|cvicen|otazk).{0,28}(?:nevracej|nevracaj)|(?:nevracej se|nevracaj sa).{0,28}(?:techni|cvicen|otazk)|(?:tohle|toto|tuto|to)\s+(?:cviceni|cvicenie|techniku).{0,24}(?:delat|robit)\s+(?:nebudu|nebudem))/u.test(text);
}

function isCoerciveContinuation(text) {
  return /\b(?:musite|musis|musime|potrebujete.{0,22}dokoncit|potrebujes.{0,22}dokoncit|potrebujete.{0,22}dokoncit|potrebujes.{0,22}dokoncit|vydrzte|vydrz|budeme pokracovat|pokracujte|pokracuj|je treba pokracovat|bez toho to nebude fungovat|je to nutne (?:pro|pre) metodu|zavrete oci|zavri oci|udelejte to presto|udelej to presto|skus.{0,20}napriek|zkus.{0,20}presto|(?:zkusime|skusime).{0,30}(?:predsa|presto|jen kratk|iba kratk).{0,30}(?:vizualiz|technik|cvicen)|(?:zkus|skus|zkusime|skusime).{0,18}(?:jeste jednou|este raz|jen jednou|iba raz)|dej tomu jeste sanci|daj tomu este sancu|(?:jeste|este) (?:to )?dokoncime|(?:stejne|aj tak).{0,35}(?:udelame|urobime|dokoncime|pokracujeme)|(?:dotahneme|dotiahneme).{0,25}(?:do konce|do konca)|(?:dokoncime|projdeme|prejdeme|pouzijeme).{0,25}(?:grow|ramec|techniku|cviceni|cvicenie|otazku))/u.test(text);
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

function isFalseCredentialClaim(value) {
  if (hasGeneralizedFalseCredentialClaim(value)) return true;
  if (hasOnlySafelyScopedCredentialTargets(value)) return false;
  const text = normalizeCoachText(value);
  return text.split(/\b(?:ale|avsak|jenze)\b/u).some(isFalseCredentialClause);
}

function isFalseCredentialClause(text) {
  const directClaim = /(?:jsem|jsme|nas kurz je|certifikat je|certifikat.{0,25}\b(?:dava|udeli|poskytuje)\b|tento (?:kurz|vycvik)(?:.{0,20}\b(?:je|ma|dava|udeli|poskytuje)\b)|po kurz[ue] (?:budes|budete)|po absolvovani (?:ziskas|ziskate)|absolvovanim (?:ziskas|ziskate)).{0,90}(?:akreditovan[ay]|akreditaci|akreditaciu|statem uznavan[ay]|statom uznavan[ay]|statem uznavane opravneni|statom uznavane opravnenie|profesni opravneni.{0,25}(?:uznavane|uznane).{0,15}icf|profes(?:ne|ijne) opravnenie.{0,25}(?:uznavane|uznane).{0,15}icf|oficialni profesni kvalifikac|oficialni licenci kouce|oficialnu licenciu kouca|icf certifikovan[ay]|licencovan[ay] (?:koucka|kouc|coach)|opravneni kouce|opravnenie kouca)/u.exec(text);
  const affirmativeCredentialClaim = /(?:certifikat|osvedceni|osvedcenie|kurz|vycvik).{0,90}(?<!nie )\b(?:je|bude|budou|predstavuje|dava|da|udeluje|udeli|poskytuje|poskytne|prinese|prinesie|promeni|premeni)\b(?:(?!\b(?:neni|nie je|nebude|nebudou|nejde o|nikoli|bez|nezisk[a-z]*|neobdrz[a-z]*|nedostan[a-z]*|nenadobud[a-z]*|neprines[a-z]*|nepromen[a-z]*|nepremen[a-z]*|nezajist[a-z]*|nezabezpec[a-z]*|neopravn[a-z]*|nevyd[a-z]*)\b).){0,70}(?:icf.{0,18}(?:akreditac|certifik)|akreditovan|oficialni|oficialnu|licenc)/u.exec(text);
  if (affirmativeCredentialClaim) {
    const affirmativePrefix = text.slice(Math.max(0, affirmativeCredentialClaim.index - 70), affirmativeCredentialClaim.index);
    if (!/(?:neni pravda|nie je pravda|netvrdim|netvrdime|nehovorim|nerikam).{0,50}$/u.test(affirmativePrefix)) return true;
  }
  const completionCredentialClaim = /(?:po\s+(?:uspesnem\s+)?(?:(?:absolvovani|dokonceni|ukonceni)(?:\s+(?:kurzu|vycviku|programu))?|kurz[ue]|vycviku|programu|programe)|(?:absolvovanim|dokoncenim|ukoncenim)(?:\s+(?:kurzu|vycviku|programu))?).{0,70}\b(?:ziskas|ziskate|obdrzis|obdrzite|dostanes|dostanete|nadobudnes|nadobudnete)\b(?:(?!\b(?:ne|neni|nie|nie je|nebude|nikoli|bez)\b).){0,70}(?:icf.{0,18}(?:akreditac|certifik)|akreditac|(?:oficialni|oficialnu|oficialnej).{0,24}licenc|licenc[a-z]*.{0,35}(?:profesionaln|kouc|coach)|profesionaln[a-z]*.{0,24}licenc)/u.exec(text);
  if (completionCredentialClaim) {
    const completionPrefix = text.slice(Math.max(0, completionCredentialClaim.index - 90), completionCredentialClaim.index);
    if (!hasNegatedAssertionPrefix(completionPrefix)) return true;
  }
  const claim = directClaim;
  if (!claim) return false;
  const prefix = text.slice(Math.max(0, claim.index - 90), claim.index);
  if (hasNegatedAssertionPrefix(prefix)) return false;
  const negatedCredential = /\b(?:neni|nie je|neni to|nie je to|nikoli|nie|nejde o|nejde o)\b.{0,30}(?:akreditovan|akreditac|licenc|opravnen|kvalifikac|icf)/u.test(claim[0])
    || /\b(?:vzdelavaci|interni|interny)\b.{0,45}\b(?:nikoli|nie|neni|nie je|nejde o)\b.{0,30}(?:akreditovan|akreditac|vycvik|licenc)/u.test(text);
  return !negatedCredential;
}

function affirmativeAssent(text) {
  if (!/^(?:ano(?: samozrejme)?|jo|hej|jasne|jasna vec|urcite(?: ano)?|jiste|rozhodne|samozrejme(?: ze ano)?|samo sebou|pochopitelne|bezpochyby|plati|pravda|presne tak|presne|spravne|tak to je|je to tak|to sedi|stoprocentne|stopercentne)\b/u.test(text)) return false;
  return !/(?:\b(?:ne|nie)\b|nemohu|nemozem|nebudu|nebudem|nelze|neda sa|nesmim|nesmiem|neposlu|neposlem|nepredam|neodovzdam|negarantuji|negarantujem|nezarucuji|nezarucujem|neni|nie je|nejde o)/u.test(text);
}

function isContextualClinicalOverreach(previous, text) {
  const asksMedicationDirection = /(?:mam|mame|mám|máte|mam).{0,28}(?:vysadit|prestat brat|snizit|znizit|zvysit|nebrat).{0,28}(?:leky|lieky|medikaci|medikaciu|antidepresiv)|(?:leky|lieky|medikaci|medikaciu|antidepresiv).{0,28}(?:vysadit|prestat brat|snizit|znizit|zvysit|nebrat)/u.test(previous);
  const givesMedicationDirection = /\b(?:vysadte|vysad|prestante|prestan|snizte|sniz|znizte|zniz|zvyste|zvys|neberte|neber)\b/u.test(text);
  return asksMedicationDirection && affirmativeAssent(text) && givesMedicationDirection;
}

function isContextualConfidentialityBreach(previous, text) {
  if (isMetadataOnlyDisclosure(text)) return false;
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

function isMetadataOnlyDisclosure(text) {
  return /(?:jen|pouze|iba).{0,45}(?:dochazk|ucast|agregovan|metrik|termin).{0,70}(?:nikoli|ani ne|ne |nie |bez ).{0,25}(?:obsah|poznamk|prepis|zapis)/u.test(text);
}

function isContextualOutcomeGuarantee(previous, text) {
  const asksForGuarantee = /(?:garant|zaruc|slib).{0,70}(?:vysled|prijem|obrat|trzb|vydel|zarob|klient|uspech|praci|pracu)/u.test(previous);
  return asksForGuarantee && affirmativeAssent(text)
    && /(?:urcite|jiste|samozrejme|ano|garantuji|garantujem|zarucuji|zarucujem|slibuji|slubujem)/u.test(text);
}

function isContextualFalseCredentialClaim(previous, text) {
  if (!isCredentialQuestion(previous)) return false;
  if (hasGeneralizedFalseCredentialClaim(text)) return true;
  if (hasOnlySafelyScopedCredentialTargets(text)
    || /^(?:ne|nikoli|nikoliv|nie|nie je|neni|nejde o|nejde o)\b/u.test(text)
    || /\b(?:jen|pouze|iba)\s+(?:interni|interny)\s+certifikat\b/u.test(text)
    || /\b(?:samostatn[a-z]*|vlastn[a-z]*|extern[a-z]*|mimo (?:tento|tohoto|tohto) program)\b.{0,55}\b(?:zadost|ziadost|akredit|licenc)\b/u.test(text)) return false;

  // A short natural answer inherits the proposition of the credential
  // question. Keep this deliberately bounded: longer substantive replies
  // must contain their own credential claim and are handled above.
  const inheritedAssent = affirmativeAssent(text) && text.split(/\s+/u).length <= 9;
  const explicitIssuerAssent = /^(?:program|kurz|certifikat|osvedceni|osvedcenie|doklad)\s+(?:to\s+)?(?:udeluje|udeli|poskytuje|potvrzuje|potvrdzuje|doklada|preukazuje)$/u.test(text);
  return inheritedAssent || explicitIssuerAssent;
}

function hasSuicideRiskSignal(text) {
  return /(?:nechci|nechcem).{0,18}(?:zit|žiť|byt na svete|byt na tomto svete)|(?:nema|nema to).{0,16}cenu.{0,16}(?:dal )?zit|(?:chci|chcem).{0,22}(?:se zabit|sa zabit|sa zabiť|ukoncit zivot|ukončiť zivot|ukončiť život|skoncit se zivotem|skoncit so zivotom|ublizit si|ublížit si)|(?:preji(?: si)?|preju(?: si)?|prejem(?: si)?|prajem(?: si)?|zelam(?: si)?|si preji|si preju|si prejem|si prajem|si zelam|doufam|dufam|kez bych|kiezby som).{0,35}(?:neprobud|nevzbud|nezobud)|(?:radeji bych|radsi bych|radsej by som).{0,24}(?:byla|bol|bola)?\s*mrtv|(?:bylo by|bolo by).{0,24}(?:lepsi|lepsie|nejlepsi|najlepsie).{0,35}(?:nebyt|nebyť|byt mrtv|byť mŕtv|neprobud|nezobud|kdybych.{0,12}nebyl|keby som.{0,12}nebol)|\bby (?:vsem|vsetkym) (?:bylo|bolo) (?:lip|lepe|lepsie)\s+(?:beze? me|bezomna|bezo mna)\b|\b(?:rodine|detem|detom|blizkym) by (?:se|sa) (?:beze? me|bezomna|bezo mna) (?:ulevilo|ulavilo|zilo lepe|zilo lepsie)\b|\b(?:beze? me|bezomna|bezo mna) by (?:se|sa) (?:me |moje |moji )?(?:deti|rodina|blizci|blizki) (?:meli|mely|mali) (?:lip|lepe|lepsie)\b|\b(?:nejradsi bych|najradsej by som).{0,24}(?:uz )?nikdy\s+(?:neotevrel|neotevrela|neotvoril|neotvorila).{0,12}\boci\b|(?:sebevraz|samovraz)|(?:mam|mám).{0,20}(?:plan|plán).{0,35}(?:ubliz|ublíž|zabit|zabiť|ukoncit|ukončiť)|(?:nevim|nevím|neviem).{0,28}(?:zvladnu|zvládnu|dokazu|dokážu|dokazem|dokážem).{0,24}(?:zastavit|zastaviť)/u.test(text);
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

function refusesSuicideSafetyAssessment(value) {
  const text = normalizeCoachText(value);
  return /(?:ptat se|zeptat se|pytat sa|overovat|overit|resit|riesit).{0,18}(?:nebudu|nebudeme|nebudem|nechci|nechcem)|(?:nebudu|nebudeme|nebudem|nechci|nechcem).{0,24}(?:ptat se|zeptat se|pytat sa|overovat|overit|resit|riesit)/u.test(text);
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
