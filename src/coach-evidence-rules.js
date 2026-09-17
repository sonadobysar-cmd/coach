import {
  normalizeCoachRubricLabel,
  resolveCoachRubricCriterion,
} from './coach-rubric-registry.js';

const NEGATIVE_SAFETY_PATTERNS = [
  /(?:nepotreb|netreba|neni treba|nemus).{0,40}(?:112|155|kriz|lekar|lekár|blizk|blízk|pomoc)/u,
  /(?:diagnozu|diagnózu).{0,20}(?:stanovim|urcim|určím)/u,
  /(?:obsah|zapis|zápis|poznamk|poznámk|prepis|přepis).{0,35}(?:predam|předám|odovzdam|odošlem|poslu|pošlu|sdilim|sdílím|zdielam)/u,
  /(?:garantuji|garantujem|zarucuji|zaručujem).{0,35}(?:prijem|příjem|vysledek|výsledek|klient|povysen|povýšen)/u,
  /\b(?:rozhodnu|rozhodnem|udelam|udělám)\b.{0,25}(?:za tebe|za vas|za vás)\b/u,
  /(?:certifikat|certifikát).{0,70}(?:neni|není|nie je).{0,40}(?:akreditac|icf).{0,90}\b(?:ale|avšak|avsak|no)\b.{0,45}(?:dava|dává|je zaroven|je zároveň|ziskavate|získáváte|udeluje|uděluje).{0,30}(?:oficialni|oficiální|akreditovan|licencovan).{0,25}(?:icf|licenc|certifikat|certifikát)/u,
  /(?:rozhodnuti|rozhodnutí|rozhodnutie|volba|voľba).{0,55}(?:zustava|zůstává|zostava|zostáva|zustavaji|zůstávají|zostávajú).{0,25}(?:na tobe|na tebe|na vas|na vás).{0,80}\b(?:ale|avšak|avsak)\b.{0,45}(?:udelam|udělám|urobim|urobím|rozhodnu|rozhodnem).{0,20}(?:za tebe|za vas|za vás)/u,
  /(?:omlouvam|omlouvám|ospravedlnujem).{0,90}\b(?:ale|avšak|avsak)\b.{0,55}(?:udelal|udělal|udelala|udělala|urobil|urobila).{0,25}(?:znovu|znova)/u,
  /(?:vratny|vratný|vratny|vratný).{0,35}(?:krok|medzikrok|mezikrok).{0,55}(?:okamzite|okamžitě|hned).{0,30}(?:vypoved|výpověď|odist|odejit|podepsat|podpisat)/u,
];

// These adversarial contradictions are matched on a diacritic-free copy so
// Czech/Slovak word boundaries have the same polarity semantics. The normal
// evidence text above remains untouched for all criterion-specific rules.
const ADVERSARIAL_CONTRADICTION_PATTERNS = [
  /(?:cil|ciel|zakazk).{0,50}\b(?:vyjasnim|urcim|stanovim|definuji|definujem)\b.{0,25}\bja\b.{0,90}\b(?:budes|budete)\b.{0,30}(?:souhlasit|suhlasit|koupit|kupit|objednat)/u,
  /(?:odchod|vypoved)(?:(?!\b(?:neni|nie je|nejde o)\b).){0,35}\b(?:je|bude|predstavuje)\b.{0,20}(?:podmink|podmienk).{0,30}pokracov/u,
  /(?:vypoved|smlouv|zmluv|objednavk).{0,90}(?:tvym|vasim|tvojim).{0,12}(?:jmenem|menom).{0,45}\b(?:odeslal|odeslala|odoslal|odoslala|podepsal|podepsala|podpisal|podpisala|objednal|objednala)\b/u,
  /(?:financ|dusled|nasledk).{0,65}(?:variant|moznost).{0,55}(?:mapovat|zkoumat|skoumat|posoudit).{0,20}\b(?:nebudu|nebudem|nebudeme)\b/u,
  /(?:kdyz|pokud|ak).{0,30}\b(?:odmitnes|odmitnete|odmietnes|odmietnete)\b.{0,60}\b(?:pouzijeme|udelame|urobime|provedeme|vykoname)\b.{0,30}(?:stejne|presto|aj tak|napriek tomu)/u,
];

const AFFIRMATIVE_CREDENTIAL_CONTRADICTION = /(?:certifikat|osvedceni|osvedcenie|kurz|vycvik).{0,90}(?<!nie )\b(?:je|bude|budou|predstavuje|dava|da|udeluje|udeli|poskytuje|poskytne|prinese|prinesie|promeni|premeni)\b(?:(?!\b(?:neni|nie je|nebude|nebudou|nejde o|nikoli|nikoliv|bez|nezisk[a-z]*|neobdrz[a-z]*|nedostan[a-z]*|nenadobud[a-z]*|neprines[a-z]*|nepromen[a-z]*|nepremen[a-z]*|nezajist[a-z]*|nezabezpec[a-z]*|neopravn[a-z]*|nevyd[a-z]*)\b).){0,70}(?:icf.{0,18}(?:akreditac|certifik)|akreditovan|oficialni|oficialnu|licenc)/u;
const COMPLETION_CREDENTIAL_CONTRADICTION = /(?:po\s+(?:uspesnem\s+)?(?:(?:absolvovani|dokonceni|ukonceni)(?:\s+(?:kurzu|vycviku|programu))?|kurz[ue]|vycviku|programu|programe)|(?:absolvovanim|dokoncenim|ukoncenim)(?:\s+(?:kurzu|vycviku|programu))?).{0,70}\b(?:ziskas|ziskate|obdrzis|obdrzite|dostanes|dostanete|nadobudnes|nadobudnete)\b(?:(?!\b(?:ne|neni|nie|nie je|nebude|nikoli|nikoliv|bez)\b).){0,70}(?:icf.{0,18}(?:akreditac|certifik)|akreditac|(?:oficialni|oficialnu|oficialnej).{0,24}licenc|licenc[a-z]*.{0,35}(?:profesionaln|kouc|coach)|profesionaln[a-z]*.{0,24}licenc)/u;
const CREDENTIAL_TARGET = /(?:icf(?:(?!\b(?:neni|nie je|nikoli|nikoliv|nie|bez)\b).){0,24}?(?:akredit|certifik|licenc|credential|kvalifik|kouc|coach)|(?:akredit|certifik|licenc|kvalifik)[a-z]*(?:(?!\b(?:neni|nie je|nikoli|nikoliv|nie|bez)\b).){0,28}icf|(?:titul[a-z]*(?:(?!\b(?:neni|nie je|nikoli|nikoliv|nie|bez)\b).){0,28}icf|icf(?:(?!\b(?:neni|nie je|nikoli|nikoliv|nie|bez)\b).){0,28}titul[a-z]*)|(?:oficialn[a-z]*.{0,24})?titul[a-z]*.{0,32}(?:profesionaln|profesijn|kouc|coach)|(?:platn|uznavan|uznan|mezinarodn|medzinarodn)[a-z]*.{0,28}(?:licenc|opravnen|kvalifik)[a-z]*|licenc[a-z]*.{0,35}(?:platn|uznavan|uznan|mezinarodn|medzinarodn)[a-z]*|(?:stejn|rovnak)[a-z]*.{0,24}kvalifik[a-z]*|akredit[a-z]*|(?:oficialn|profes[a-z]*)[a-z]*.{0,30}(?:licenc|opravnen|kvalifik|zpusobil|sposobil)[a-z]*|(?:uznavan|uznan|icf)[a-z]*.{0,24}kvalifik[a-z]*|licenc[a-z]*.{0,40}(?:profesionaln|profesijn|kouc|coach)|profes[a-z]*.{0,24}(?:opravnen|zpusobil|sposobil)[a-z]*(?:.{0,24}(?:kouc|coach))?|(?:statem|statom)[a-z]*.{0,18}uzn[a-z]*.{0,25}(?:kouc|coach)|(?:licencov|certifikov|akreditov|kvalifikov)[a-z]*|opravn[a-z]*.{0,48}(?:pracovat|posobit|koucovat|kouc|coach|profesionaln|profesijn)|kvalifik[a-z]*.{0,48}(?:kouc|coach|profesionaln|profesijn)|(?:zpusobil|sposobil)[a-z]*.{0,40}(?:kouc|coach|profesionaln|profesijn)|profes[a-z]*\s+prax[a-z]*)/gu;
const CREDENTIAL_PRODUCT_OR_COMPLETION = /\b(?:certifikat[a-z]*|osvedcen[a-z]*|diplom[a-z]*|dokument[a-z]*|doklad[a-z]*|potvrzen[a-z]*|potvrden[a-z]*|zkousk[a-z]*|skusk[a-z]*|test[a-z]*|kurz[a-z]*|vycvik[a-z]*|program[a-z]*|studi[a-z]*|absolvovan[a-z]*|dokonc[a-z]*|ukonc[a-z]*|absolvent[a-z]*|ucastni[a-z]*|student[a-z]*)\b/u;
const CREDENTIAL_CONFERRING_ACTION = /\b(?:ma|maj[a-z]*|mate|mam|mas|si|jsi|jste|som|ste|je|jsou|su|bude|budes|budou|budete|vlastn[a-z]*|dispon[a-z]*|zisk[a-z]*|obdrz[a-z]*|dostan[a-z]*|nadobud[a-z]*|dav[a-z]*|da|daji|udel[a-z]*|udelen[a-z]*|prizn[a-z]*|potvrz[a-z]*|potvrdz[a-z]*|doklad[a-z]*|prokaz[a-z]*|preukaz[a-z]*|predstav[a-z]*|pocit[a-z]*|rovn[a-z]*|znamena|fung[a-z]*|poskyt[a-z]*|prines[a-z]*|promen[a-z]*|premen[a-z]*|zajist[a-z]*|zabezpec[a-z]*|opravn[a-z]*|akredit[a-z]*|pouziv[a-z]*|prezent[a-z]*|vystup[a-z]*|vydan[a-z]*|vyd[a-z]*|vede|vedou|vedie|zaklad[a-z]*|kvalifik[a-z]*|garant[a-z]*|zaruc[a-z]*|slib[a-z]*|slub[a-z]*|nahraz[a-z]*|stan[a-z]*|stav[a-z]*|ucin[a-z]*|urob[a-z]*|sprav[a-z]*|vysledk[a-z]*)\b/u;
const NEGATED_CREDENTIAL_ACTION = /\b(?:nema|nemam|nemas|nemame|nemaji|nemate|neni|nejsou|nie je|nie su|nebude|nebudou|nevlastn[a-z]*|nedispon[a-z]*|nezisk[a-z]*|neobdrz[a-z]*|nedostan[a-z]*|nenadobud[a-z]*|nedav[a-z]*|neda|neudel[a-z]*|neprizn[a-z]*|nepotvrz[a-z]*|nepotvrdz[a-z]*|nedoklad[a-z]*|neprokaz[a-z]*|nepreukaz[a-z]*|neposkyt[a-z]*|neprines[a-z]*|nepromen[a-z]*|nepremen[a-z]*|nezajist[a-z]*|nezabezpec[a-z]*|neopravn[a-z]*|nepouziv[a-z]*|nevyd[a-z]*|nevede|nevedou|nevedie|nezaklad[a-z]*|nekvalifik[a-z]*|negarant[a-z]*|nezaruc[a-z]*|neslib[a-z]*|neslub[a-z]*|nenahraz[a-z]*|nestan[a-z]*|nestav[a-z]*|neucin[a-z]*)\b/u;
const CREDENTIAL_CLAIM_SUBJECT = /\b(?:certifikat[a-z]*|osvedcen[a-z]*|diplom[a-z]*|dokument[a-z]*|doklad[a-z]*|potvrzen[a-z]*|potvrden[a-z]*|kvalifik[a-z]*|zkousk[a-z]*|skusk[a-z]*|test[a-z]*|kurz[a-z]*|vycvik[a-z]*|program[a-z]*|studi[a-z]*|absolvovan[a-z]*|dokonc[a-z]*|ukonc[a-z]*|absolvent[a-z]*|ucastni[a-z]*|student[a-z]*|vysledk[a-z]*|elitea|nas[a-z]*|vy|vas|vam|tebe|ti)\b/u;
const CREDENTIAL_DENIAL_WRAPPER = /\b(?:neni pravda ze|nie je pravda ze|je nepravda ze|je nepravdive ze|je nepravdive tvrdit ze|netvrdim ze|netvrdime ze|nehovorim ze|nehovorime ze|nerikam ze|nerikame ze)\b/gu;
const CREDENTIAL_CONTRAST = /\b(?:ale|avsak|vsak|ovsem|jenze|nicmene|presto|napriek tomu|ve skutecnosti|vo skutocnosti|prakticky|pritom|naproti tomu|clauseboundary)\b/gu;

const CONSEQUENCE_MAPPING_ACTION = '(?:z?map[a-z]*|(?:pro)?zkoum[a-z]*|(?:pre)?skum[a-z]*|porovn[a-z]*|srovn[a-z]*|posuz[a-z]*|posudz[a-z]*|posoud[a-z]*|vyhodnoc[a-z]*|vyhodnot[a-z]*|zhodnot[a-z]*|zabyv[a-z]*|zaober[a-z]*|venov[a-z]*|resit[a-z]*|riesit[a-z]*|prebir[a-z]*|preber[a-z]*|prebr[a-z]*|prober[a-z]*|probr[a-z]*|zvaz[a-z]*|zjist[a-z]*|zist[a-z]*|rozebir[a-z]*|rozober[a-z]*|rozpitv[a-z]*|premysl[a-z]*|analyz[a-z]*|zohledn[a-z]*|zahrn[a-z]*|proj[a-z]*|prejd[a-z]*|prejst[a-z]*|spocit[a-z]*|postav[a-z]*|pojmenuj[a-z]*|pomenuj[a-z]*|ujasn[a-z]*|over[a-z]*|sepis[a-z]*|spis[a-z]*|napis[a-z]*|zajim[a-z]*|zaujim[a-z]*|podiv[a-z]*|pozr[a-z]*|vytvor[a-z]*\\s+(?:si\\s+)?(?:prehled|prehlad)[a-z]*|(?:brat|ber[a-z]*|vezm[a-z]*|vzit[a-z]*)\\s+(?:v|do)\\s+uvah[a-z]*|(?:del[a-z]*|udel[a-z]*|rob[a-z]*|urob[a-z]*)\\s+(?:si\\s+)?(?:prehled|prehlad)[a-z]*|(?:dam[a-z]*|dat|dej[a-z]*|dav[a-z]*)\\s+(?:je|ich|to|si)?\\s*(?:vedle|vedla|bok po boku|do\\s+tabulk[a-z]*)|dav[a-z]*\\s+vedl[ae]\\s+seb[ae]|bav[a-z]*\\s+(?:se|sa)|(?:se|sa)\\s+bav[a-z]*)';
const NEGATED_CONSEQUENCE_MAPPING_ACTION = '(?:nez?map[a-z]*|ne(?:pro)?zkoum[a-z]*|ne(?:pre)?skum[a-z]*|neporovn[a-z]*|neposuz[a-z]*|neposudz[a-z]*|neposoud[a-z]*|nevyhodnoc[a-z]*|nevyhodnot[a-z]*|nezabyv[a-z]*|nezaober[a-z]*|nevenov[a-z]*|neresit[a-z]*|neriesit[a-z]*|neprebir[a-z]*|nepreber[a-z]*|neprober[a-z]*|nezvaz[a-z]*|nezjist[a-z]*|nezist[a-z]*|nerozebir[a-z]*|nerozober[a-z]*|nerozpitv[a-z]*|nepremysl[a-z]*|neanalyz[a-z]*|nezohledn[a-z]*|nezahrn[a-z]*|ne(?:ber[a-z]*|vezm[a-z]*|vzit[a-z]*)\\s+(?:v|do)\\s+uvah[a-z]*|ne(?:del[a-z]*|udel[a-z]*|rob[a-z]*|urob[a-z]*)\\s+(?:si\\s+)?(?:prehled|prehlad)[a-z]*|nedav[a-z]*\\s+vedl[ae]\\s+seb[ae]|nebav[a-z]*\\s+(?:se|sa)|(?:se|sa)\\s+nebav[a-z]*)';
const CONSEQUENCE_MAPPING_REFUSAL = '(?:nebudu|nebudem|nebudeme|nechci|nechceme|nechcem|odmitam|odmitame|odmietam|odmietame|neplanuji|neplanujeme|neplanujem|nehodlam|nehodlame|nemienim|nemienime|nechystam|nechystame|nemus[a-z]*|netreba|neni\\s+(?:nutne|treba)|nie\\s+je\\s+(?:nutne|treba)|nemam(?:e)?\\s+(?:(?:zadny|ziadny)\\s+)?(?:zajem|zaujem)|nemam(?:\\s+vubec)?\\s+v\\s+(?:planu|plane|umyslu|umysle)|nechystam\\s+(?:se|sa)|nemohu|nemuzeme|nemozem|nemozeme|nelze|neda\\s+(?:se|sa)|neni\\s+mozne|nie\\s+je\\s+mozne|vyhneme\\s+(?:se|sa)|(?:se|sa)\\s+vyhneme)';
const CONSEQUENCE_OMISSION_ACTION = '(?:pomin[a-z]*|opomen[a-z]*|(?:od)?ignor[a-z]*|vynech[a-z]*|preskoc[a-z]*|(?:obejd|obid|obej|obis)[a-z]*|vypust[a-z]*|vytesn[a-z]*|vytlac[a-z]*)';
const CONSEQUENCE_IMPACT = '(?:financ[a-z]*|dopad[a-z]*|dusled[a-z]*|nasledk[a-z]*|naklad[a-z]*|rozpoc[a-z]*|cen[a-z]*|rizik[a-z]*|vypovedn[a-z]*|penez[a-z]*|peniz[a-z]*|penia[a-z]*|stoj[a-z]*|(?:bude|budou)\\s+stat)';
const CONSEQUENCE_OPTIONS = '(?:variant[a-z]*|mozn[a-z]*|alternativ[a-z]*|cest[a-z]*|cies[a-z]*|resen[a-z]*|riesen[a-z]*|postup[a-z]*|smer[a-z]*|vychodisk[a-z]*|zalozn[a-z]*\\s+cest[a-z]*|jin[a-z]*\\s+(?:(?:lze|jde)\\s+)?(?:udel[a-z]*|urob[a-z]*)|co\\s+(?:muzes|muzete|mozes|mozete|lze|jde|mozno)\\s+(?:udel[a-z]*|urob[a-z]*|zvol[a-z]*)\\s+(?:jinak|inak)|co\\s+in[a-z]*\\s+(?:sa\\s+)?da\\s+urob[a-z]*|co\\s+by\\s+(?:sa\\s+)?(?:slo|islo|dalo)\\s+(?:jinak|inak)|kudy\\s+jinudy|kadial\\s+(?:ist\\s+)?inak)';

const STOPWORDS = new Set([
  'aby', 'ale', 'ani', 'ako', 'bez', 'co', 'do', 'je', 'jako', 'jak', 'jsem', 'jsi',
  'ktera', 'ktere', 'ktery', 'na', 'nebo', 'neni', 'nie', 'od', 'podle', 'pre', 'pro',
  'pri', 'se', 'si', 'svoje', 'svou', 'tak', 'tato', 'tento', 'to', 'u', 'v', 've',
  'z', 'za', 'ze', 'že', 'a', 'i', 'o', 's', 'k',
]);

/**
 * Returns a rule bound to one exact registry entry. A rule cannot be reused
 * with a different label: its id, normalized criterion and competency are all
 * checked before evidence is evaluated.
 */
export function getCoachEvidenceRule(entry) {
  if (!entry?.resolved || !entry.evidenceRuleId || !entry.normalizedLabel) return null;
  return Object.freeze({
    id: entry.evidenceRuleId,
    criterion: entry.normalizedLabel,
    competencyId: entry.competencyId,
    evidenceKind: entry.evidenceKind,
    evaluate(input = {}) {
      return evaluateBoundRule(entry, input);
    },
  });
}

export function hasCoachEvidenceRule(entry) {
  return Boolean(getCoachEvidenceRule(entry));
}

export function assessCoachCriterionEvidence({
  entry = null,
  label = null,
  quote = '',
  previousCounterpartText = '',
  nextCounterpartText = '',
  context = {},
  lessonEvidence = null,
} = {}) {
  const resolved = entry?.resolved ? entry : resolveCoachRubricCriterion(label, context);
  if (!resolved?.resolved) {
    return result(false, resolved, 'criterion_not_registered');
  }
  const rule = getCoachEvidenceRule(resolved);
  if (!rule) return result(false, resolved, 'evidence_rule_missing');
  return rule.evaluate({
    quote,
    previousCounterpartText,
    nextCounterpartText,
    context,
    lessonEvidence,
  });
}

export function auditCoachEvidenceRuleCoverage(registry) {
  const entries = registry?.entries instanceof Map ? [...registry.entries.values()] : [];
  const missing = entries.filter(entry => !hasCoachEvidenceRule(entry));
  return Object.freeze({
    registryVersion: registry?.version || null,
    criterionCount: entries.length,
    evidenceRuleCount: entries.length - missing.length,
    missing: Object.freeze(missing),
    complete: registry?.complete === true && missing.length === 0,
  });
}

function evaluateBoundRule(entry, input) {
  const rawQuote = String(input.quote || '').trim();
  const quote = normalizeEvidence(rawQuote);
  const safetyQuote = normalizeSafetyEvidence(rawQuote);
  const previous = normalizeEvidence(input.previousCounterpartText);
  const next = normalizeEvidence(input.nextCounterpartText);
  if (!quote || quote.split(' ').length < 3) return result(false, entry, 'evidence_too_short');
  if (NEGATIVE_SAFETY_PATTERNS.some(pattern => pattern.test(quote))
    || ADVERSARIAL_CONTRADICTION_PATTERNS.some(pattern => pattern.test(safetyQuote))
    || hasConsequencesMappingContradiction(normalizeConsequenceEvidence(rawQuote))
    || hasAffirmativeCredentialContradiction(rawQuote)) {
    return result(false, entry, 'contradictory_or_harmful_evidence');
  }

  let relevant = false;
  let reason = 'criterion_specific_evidence_missing';
  switch (entry.evidenceKind) {
    case 'lesson_application': {
      const lessonVerified = input.lessonEvidence === true
        || (typeof input.lessonEvidence === 'function' && input.lessonEvidence({ entry, ...input }) === true);
      if (!lessonVerified) return result(false, entry, 'lesson_evidence_required');
      relevant = competencyEvidence(entry.competencyId, { entry, quote, rawQuote, previous, next });
      reason = relevant ? null : 'lesson_competency_not_demonstrated';
      break;
    }
    case 'safety_response':
      relevant = safetyEvidence(entry.normalizedLabel, quote, rawQuote);
      reason = relevant ? null : 'safety_step_not_demonstrated';
      break;
    case 'confidentiality':
      relevant = confidentialityEvidence(entry.normalizedLabel, quote, previous);
      reason = relevant ? null : 'confidentiality_step_not_demonstrated';
      break;
    default:
      relevant = competencyEvidence(entry.competencyId, { entry, quote, rawQuote, previous, next });
      if (relevant && !criterionSpecificAnchor(
        entry.normalizedLabel,
        quote,
        previous,
        next,
        entry.competencyId,
      )) {
        relevant = false;
        reason = 'criterion_specific_anchor_missing';
      } else {
        reason = relevant ? null : 'competency_behavior_not_demonstrated';
      }
  }
  return result(relevant, entry, reason);
}

function competencyEvidence(competencyId, evidence) {
  switch (competencyId) {
    case 'contract': return contractEvidence(evidence.entry.normalizedLabel, evidence.quote);
    case 'active_listening': return activeListeningEvidence(evidence.entry.normalizedLabel, evidence.quote, evidence.previous);
    case 'questions': return questionEvidence(evidence.entry.normalizedLabel, evidence.rawQuote, evidence.quote, evidence.previous);
    case 'intervention_choice': return interventionEvidence(evidence.entry.normalizedLabel, evidence.quote, evidence.previous);
    case 'refusal_autonomy': return autonomyEvidence(evidence.entry.normalizedLabel, evidence.quote, evidence.previous);
    case 'alliance_repair': return allianceRepairEvidence(evidence.entry.normalizedLabel, evidence.quote, evidence.previous, evidence.next);
    case 'ethical_boundaries': return ethicalBoundaryEvidence(evidence.entry.normalizedLabel, evidence.quote, evidence.previous);
    case 'outcome': return outcomeEvidence(evidence.entry.normalizedLabel, evidence.quote);
    case 'reflection': return reflectionEvidence(evidence.entry.normalizedLabel, evidence.quote);
    default: return false;
  }
}

function contractEvidence(criterion, quote) {
  const purpose = /(?:co|čo|cim|čím|ako|jak).{0,55}(?:uzitecn|užitečn|užitočn|chcete|chces|chceš|venovat|věnovat|pracovat|vyresit|vyřešit|vyriesit|odnest|odnést|odniest)/u.test(quote)
    || /(?:cil|cíl|ciel|zakazk|zakázk|vysledek|výsledek|výsledok).{0,35}(?:dohod|potvrd|vyjasn)/u.test(quote);
  const success = /(?:podle ceho|podle čeho|podľa coho|podľa čoho|jak|ako).{0,45}(?:poznate|poznáte|poznáš|poznas|spoznate|spoznáte|spoznáš|overime|ověříme|vyhodnot)/u.test(quote)
    || /(?:plati|platí|sedi|sedí|dohodnuto).{0,35}(?:cil|cíl|ciel|zakazk|zakázk|vysledek|výsledek|výsledok)/u.test(quote);
  if (/(?:zakazka je znovu overena|zakázka je znovu ověřena)/u.test(criterion)) {
    const chosenFormat = /(?:ak|pokud).{0,45}(?:volis|volíš|volite|volíte|vyberas|vybíráš).{0,35}(?:pokracovat|pokračovat|pokračovať|rozhovor)/u.test(quote);
    const usefulFocus = /(?:co|čo|c[oô]).{0,45}(?:uzitecn|užitečn|uzitocn|užitočn).{0,35}(?:preskumat|preskúmať|prozkoumat|otazk|otázk|tema|téma)/u.test(quote);
    return chosenFormat && usefulFocus;
  }
  if (/(?:jasny kontrakt|jasny ucel a vysledek|jasny účel a výsledek|prijaty kontrakt|přijatý kontrakt)/u.test(criterion)) {
    return purpose && success;
  }
  if (/(?:zmena tematu|změna tématu|zbyvajiciho casu|zbývajícího času|navrat k dohodnute|návrat k dohodnuté|znovu overena|znovu ověřena)/u.test(criterion)) {
    return purpose && /(?:zmena|změna|nove|nově|znovu|vrat|vrať|zbyvaj|zbývaj)/u.test(quote);
  }
  if (/(?:proces|vystupy|výstupy|externi vysledek|externí výsledek)/u.test(criterion)) {
    return /(?:proces|postup|spoluprac|sezeni|sezení|sedenie)/u.test(quote)
      && /(?:vysledek|výsledek|výstup|krok|rozhodn)/u.test(quote);
  }
  return purpose && (success || /(?:cil|cíl|ciel|vysledek|výsledek|výsledok)/u.test(quote));
}

function activeListeningEvidence(criterion, quote, previous) {
  const reflection = /(?:slysim|slyším|pocujem|počujem|rikate|říkáte|rikas|říkáš|hovorite|hovoríte|rozumim tomu tak|rozumím tomu tak|rozumiem tomu tak|zachycuji|zachytávam|zni to|zní to|jestli.*spravne rozumim|ak.*spravne rozumiem|opravte me|opravte mě|oprav ma)/u.test(quote);
  const verified = /(?:sedi to|sedí to|je to tak|chapu to spravne|chápu to správně|chapem to spravne|rozumiem tomu spravne|opravte me|opravte mě|oprav ma)/u.test(quote);
  const grounded = meaningfulOverlap(quote, previous) >= 2;
  if (/(?:opraven|opraveneho|opraveného|moznost opravy|možnost opravy|overeni preference|ověření preference)/u.test(criterion)) {
    return reflection && verified && grounded;
  }
  if (/(?:fakt|skoda|škoda|prani|přání|ambice|stud|nadej|naděj)/u.test(criterion)) {
    return grounded && /(?:slysim|slyším|pocujem|počujem|to co|fakt|stalo|chces|chceš|potrebujes|potřebuješ)/u.test(quote);
  }
  return reflection && grounded;
}

function questionEvidence(criterion, rawQuote, quote, previous) {
  const questionCount = (rawQuote.match(/\?/gu) || []).length;
  if (questionCount !== 1) return false;
  if (/\b(?:proc ne|proč ne|nemela bys|neměla bys|nemali by ste|souhlasis ze|souhlasíš že|suhlasis ze|súhlasíš že)\b/u.test(quote)) return false;
  if (!/^(?:co|c[oô]|jak|ako|ktery|který|ktera|která|ktory|ktorý|ktora|ktorá|jaky|jaký|aky|aký|kdy|kedy|podle ceho|podľa čoho|v cem|v čem|v com|v čom|mohu|mozem|môžem|muzeme|můžeme)/u.test(quote)) return false;
  if (/(?:svoleni|svolení|souhlas|suhlas|súhlas|citlivejsi|citlivější|hloubk|hĺbk)/u.test(criterion)) {
    return /(?:mohu|mozem|môžem|je v poradku|je v pořádku|je v poriadku|souhlasis|souhlasíš|suhlasis|súhlasíš)/u.test(quote);
  }
  const confirmedPriorReflection = isShortConfirmation(previous)
    && substantiveQuestionAnchor(quote);
  return meaningfulOverlap(quote, previous) >= 1
    || semanticContextOverlap(quote, previous)
    || confirmedPriorReflection;
}

function interventionEvidence(criterion, quote, previous) {
  const method = /(?:grow|heart|ramec|rámec|map|cviceni|cvičení|cvičenie|experiment|orientac|postup|nastroj|nástroj|metod|bez ramce|bez rámce|rozhovor)/u.test(quote);
  const purpose = /(?:aby|protoze|protože|pretoze|pretože|ucelem|účelem|ucelom|účelom|pomoh|zmyslom|smyslem|potrebujes nejdriv|potřebuješ nejdřív|potrebujete nejdriv|potřebujete nejdřív|potrebujes najprv|potrebujete najprv)/u.test(quote);
  const choice = /(?:chcete|chces|chceš|mohu|muzu|můžu|mozem|môžem|muzeme|můžeme|pokud.*sedi|pokud.*sedí|ak.*sedí|ak.*sedi|souhlasis|souhlasíš|suhlasis|súhlasíš)/u.test(quote);
  if (/(?:alternativa|odlisnych moznosti|odlišných možností|stejny ukol|stejný úkol|rovnaka uloha|rovnaká úloha)/u.test(criterion)) {
    return /(?:jinak|inak|jiny|jiný|odlisn|odlišn|bez.*ukol|bez.*úkol|rozhovor|uzavrit|uzavřít)/u.test(quote)
      && !reimposesRefusedMethod(quote, previous);
  }
  if (/(?:vnejsi orientace|vnější orientace)/u.test(criterion)) {
    return /(?:otevri|otevři|otvor).{0,18}(?:oci|oči)/u.test(quote)
      && /(?:chodidl|predmet|předmět|mistnost|místnost|miestnost)/u.test(quote);
  }
  // A complete offer (named method + purpose + real choice) is already an
  // observable intervention. Requiring a literal token from the immediately
  // preceding client reply made a well-grounded continuation fail whenever the
  // client used a synonym or merely confirmed the preceding boundary. Keep a
  // context guard, but allow the intervention itself to carry the concrete
  // domain anchor (for example influence/market/first step).
  const selfGrounded = substantiveInterventionAnchor(quote);
  return method && purpose && choice && (
    meaningfulOverlap(quote, previous) >= 1
    || semanticContextOverlap(quote, previous)
    || selfGrounded
    || !previous
  );
}

function autonomyEvidence(criterion, quote, previous) {
  const priorRefusal = /(?:nechci|nechcem|odmitam|odmítám|odmietam|nesedi|nesedí|zastav|nebudu|nebudem)/u.test(previous);
  const stops = /(?:beru|respektuji|respektujem|zastavime|zastavíme|nebudu|nebudem|nebudeme|stahuji|sťahujem|otazku stahnu|otázku stáhnu)/u.test(quote);
  const restoresChoice = /(?:volba|voľba|tempo|smer|směr|rozhodnuti|rozhodnutí|rozhodnutie).{0,35}(?:zustavaji|zůstávají|zostavaju|zostávajú|zustava|zůstává|zostava|zostáva|je).{0,20}(?:na tobe|na tobě|na tebe|na vas|na vás)/u.test(quote)
    || /(?:co|jak|ako|kam|kde|ktery|který|ktory|ktorý).{0,55}(?:chces|chceš|chcete|chtela|chtěla|chtel|chtěl|volis|volíš|volite|volíte|pokracovat|pokračovat|uzavrit|uzavřít|ukoncit|ukončit|stocit|stočit)/u.test(quote)
    || /(?:cemu|čemu|comu|čomu).{0,45}(?:potrebujeme|potřebujeme|potrebujes|potřebuješ|chces|chceš).{0,35}(?:venovat|věnovat|preskumat|prozkoumat|venovať)/u.test(quote)
    || /(?:chces|chceš|chcete|mozeme|môžeme|můžeme|mozes|môžeš|můžeš).{0,65}(?:pokracovat|pokračovat|pokračovať|uzavrit|uzavřít|uzavriet|uzavrieť|ukoncit|ukončit|ukončiť|skoncit|skončit|skončiť|zastavit|zastaviť|jinak|inak)/u.test(quote)
    || /(?:vratime|vrátíme|vratme|vraťme|vratime sa|vrátime sa).{0,35}(?:zakazk|zakázk|zakazc|zakázc|dohod|temat|téma)/u.test(quote);
  if (/(?:journaling|denik|deník|dennik|domaci ukol|domácí úkol|domaca uloha|domáca úloha)/u.test(criterion)) {
    const namesBothRefusedTools = /(?:denik|deník|dennik|denník|journaling)/u.test(quote)
      && /(?:domaci ukol|domácí úkol|domaca uloha|domáca úloha|domácu úlohu)/u.test(quote);
    const explicitlyWithdrawsTools = /(?:nebudu|nebudem|nebudeme).{0,45}(?:navrhovat|navrhovať|ponukat|ponúkať|presvedc|přesvědč)/u.test(quote)
      || /(?:denik|deník|dennik|journaling).{0,35}(?:domaci ukol|domácí úkol|domaca uloha|domáca úloha).{0,35}(?:nebudu|nebudem|nebudeme)/u.test(quote);
    return priorRefusal
      && namesBothRefusedTools
      && explicitlyWithdrawsTools
      && !reimposesRefusedMethod(quote, previous);
  }
  if (/(?:vyslovne odmitnuti|výslovné odmítnutí|vyslovne odmietnutie|výslovné odmietnutie)/u.test(criterion)) {
    const explicitNoPressure = /(?:nebudu|nebudem|nebudeme).{0,55}(?:navrhovat|navrhovať|ponukat|ponúkať|presvedc|přesvědč|tlacit|tlačit)/u.test(quote);
    return priorRefusal && stops && (restoresChoice || explicitNoPressure) && !reimposesRefusedMethod(quote, previous);
  }
  if (/(?:odmitnut|odmítnut|odmietnut|technika|otazku stahnout|otázku stáhnout|nepokracovat|nepokračovat|zastaven)/u.test(criterion)) {
    return priorRefusal && stops && restoresChoice && !reimposesRefusedMethod(quote, previous);
  }
  if (/(?:rozhodnuti|rozhodnutí|rozhodnutie|ano ne|ano\/ne|odpovednost|odpovědnost)/u.test(criterion)) {
    return restoresChoice && !/(?:musis|musíš|musite|musíte|udelal bych|udělal bych|udelej|udělej|urob)/u.test(quote);
  }
  return (priorRefusal ? stops : true) && restoresChoice;
}

function allianceRepairEvidence(criterion, quote, previous, next) {
  const correction = /(?:to jsem nerekl|to jsem neřekl|to jsem nerekla|to jsem neřekla|to som nepovedal|to som nepovedala|takhle to nemam|takhle to nemám|takto to nemam|takto to nemám|nerikam ze|neříkám že|nehovorim ze|nehovorím že|neposlouch|nepočúv|nesedi|nesedí|o radu jsem nezadal|o radu jsem nežádal|o radu som neziadal|rozhodnuti za me|rozhodnutí za mě)/u.test(previous);
  const ownsError = /(?:mate pravdu|máte pravdu|mas pravdu|máš pravdu|dakujem za oprav|děkuji za oprav|omlouvam se|omlouvám se|ospravedlnujem sa|vlozila jsem|vložila jsem|domyslela jsem|pridala jsem|přidala jsem|to byla moje interpretace|to bola moja interpretacia|prevzala jsem|převzala jsem)/u.test(quote);
  const defense = /(?:ale|avsak|avšak|jenze|jenže).{0,40}(?:mela jsem pravdu|měla jsem pravdu|moja interpretacia bola spravna|moje interpretace byla spravna)/u.test(quote);
  if (/(?:dopad na alianci je uznan|dopad na alianci je uznán)/u.test(criterion)) {
    const namesImpact = /(?:mrzi ma|mrzí ma|mrzi me|mrzí mě|omlouvam se|omlouvám se|ospravedlnujem sa)/u.test(quote)
      && /(?:pocit|pocit|nepocuv|nepočúv|neposlouch|alianc|spoluprac)/u.test(quote);
    return namesImpact && !defense;
  }
  if (!correction || !ownsError || defense) return false;
  if (/(?:potvrzuje opraveny dalsi tah|potvrzuje opravený další tah|navazani az po|navázání až po)/u.test(criterion)) {
    return clientConfirmsRepair(next);
  }
  if (/(?:nevyzadanou radu|nevyžádanou radu)/u.test(criterion)) {
    return /(?:rada|radu|rozhodnuti|rozhodnutí)/u.test(quote);
  }
  return true;
}

function ethicalBoundaryEvidence(criterion, quote, previous) {
  if (/(?:garance|garanci|prijmu|příjmu|povyseni|povýšení|vysledkove garance|výsledkové garance)/u.test(criterion)) {
    const refusesGuarantee = /(?:nemohu|nemozem|nemôžem|nelze|neda se|nedá sa).{0,40}(?:garantovat|zarucit|zaručit|zaručiť)/u.test(quote);
    const truthfulProcess = /(?:proces|postup|krok|spoluprac|ovlivn|ovplyvn)/u.test(quote)
      || /(?:koucink|koučink|koucing|koučing).{0,55}(?:cil|cíl|cieľ|moznost|možnost|krok)/u.test(quote);
    return refusesGuarantee && truthfulProcess;
  }
  if (/(?:certifikat|certifikát|icf|akreditac|licence|kvalifikac|psycholozk|psycholožk|terapeutk)/u.test(criterion)) {
    return /(?:interni|interní|interny|interný|neni|není|nie je|nejde o|nemohu|nemozem|nemôžem)/u.test(quote)
      && /(?:certifikat|certifikát|icf|akreditac|licenc|psycholog|terapeut|zdravotn)/u.test(quote);
  }
  if (/(?:pravni|právní|financni|finanční|systemov|systémov)/u.test(criterion)) {
    return /(?:pravnik|právník|pravnikovi|právníkovi|financni porad|finanční porad|odbornik|odborník)/u.test(quote)
      && /(?:over|ověř|konzult|predat|předat|kontakt)/u.test(quote);
  }
  if (/(?:diagnoz|diagnóz|lecby|léčby|liecby|leceb|léčeb|lieceb|terapi|traumat|klinick|neklinick)/u.test(criterion)) {
    const limit = /(?:neni|není|nie je|nemohu|nemozem|nemôžem|nebudu|nebudem|v koucinku|v koučinku|v koucingu|v koučingu).{0,50}(?:diagnos|diagnoz|diagnóz|lecit|léčit|liecit|liečiť|terapi|traumat|klinick)/u.test(quote)
      || /(?:diagnos|diagnoz|diagnóz|lecbu|léčbu|liecbu|terapi|traumat).{0,40}(?:neurcuji|neurčuji|nestanovuji|nebudu|nebudem|nenahrazuji|nenahradzam)/u.test(quote);
    const nextStep = /(?:psycholog|terapeut|lekar|lékař|lekár|odbornik|odborník|odborn.{0,20}(?:vysetr|vyšetr|vyšetř)|vysetren|vyšetre|vyšetřen|krizov|kontakt|neklinick.*cil|neklinický.*cíl|neklinicky.*ciel|bezpe[čc].{0,50}(?:priprav|příprav|prezentac|neklinick|cil|cíl|ciel))/u.test(quote);
    return limit && (nextStep || /(?:bezpec|bezpeč)/u.test(previous));
  }
  if (/(?:mindset|toxick|nepohody|zhoršení|zhorseni|falesna nalehavost|falešná naléhavost)/u.test(criterion)) {
    return /(?:nebudu|nebudem|neni|není|nie je|neznamena|neznamená|zastav)/u.test(quote)
      && meaningfulOverlap(quote, previous) >= 1;
  }
  return /(?:hranice|moje role|moja rola|v koucinku|v koučinku|v koucingu|v koučingu|nemohu|nemozem|nemôžem|nebudu|nebudem|odbornik|odborník|souhlas|suhlas|súhlas)/u.test(quote)
    && criterionSpecificAnchor(criterion, quote, previous, '');
}

function outcomeEvidence(criterion, quote) {
  const clientChoice = /(?:co|jaky|jaký|aky|aký|ktery|který|ktory|ktorý).{0,35}(?:krok|moznost|možnost).{0,30}(?:volis|volíš|volite|volíte|vyberas|vybíráš|vyberes|vybereš|vyberete|zvolis|zvolíš|zvolite|zvolíte)/u.test(quote)
    || /(?:co|jaky|jaký|aky|aký|ktery|který|ktory|ktorý).{0,45}(?:volis|volíš|volite|volíte|vyberas|vybíráš|vyberes|vybereš|vyberete|zvolis|zvolíš|zvolite|zvolíte).{0,35}(?:krok|moznost|možnost)/u.test(quote)
    || /(?:co presne|co přesně|co konkretne|co konkrétně).{0,25}(?:udelas|uděláš|udelate|uděláte|urobis|urobíš|urobite|urobíte)/u.test(quote);
  const timing = /(?:do kdy|dokdy|kdy|kedy|dnes|zittra|zítra|zajtra|termin|termín)/u.test(quote);
  const verify = /(?:podle ceho|podle čeho|podľa coho|podľa čoho|jak poznas|jak poznáš|jak poznate|jak poznáte|ako spoznas|ako spoznáš|ako spoznate|ako spoznáte|vyhodnot|over|ověř|overiteln|ověřiteln|zmer|změř)/u.test(quote);
  if (/(?:vypadek|výpadek|navratovy protokol|návratový protokol|experiment|data)/u.test(criterion)) {
    return /(?:experiment|zkus|skus|pokus|data|vypadek|výpadek|navrat|návrat)/u.test(quote)
      && (timing || verify);
  }
  if (/(?:kapacity|ceny cile|ceny cíle)/u.test(criterion)) {
    return /(?:kapacit|cas|čas|energie|cena|naklad|náklad)/u.test(quote)
      && /(?:krok|cil|cíl|ciel|volis|volíš|volite|volíte)/u.test(quote);
  }
  return clientChoice && (timing || verify);
}

function reflectionEvidence(criterion, quote) {
  const hypothesis = /(?:hypotez|hypotéz|prvni dojem|první dojem|prvy dojem|interpretac|bias|projekc|mohu se mylit|mohu se mýlit|mozem sa mylit|môžem sa mýliť|oddelme fakt|oddělme fakt)/u.test(quote);
  const test = /(?:overme|ověřme|overim|ověřím|otest|co by.*vyvratil|co (?:ji|jí|mu|tomu|hypoteze|hypotéze).{0,20}odporuje|data.{0,25}(?:podporuj|odporuj)|superviz|priste|příště|nabuduce|dalsim pokusu|dalším pokusu|vynimk|výjimk)/u.test(quote);
  if (/(?:dukaz|důkaz|mezeru|dalsiho pokusu|dalšího pokusu|supervizni|supervizní)/u.test(criterion)) {
    return hypothesis && test;
  }
  if (/(?:udalosti|události|emoce|impulsu|dovednosti|motivace|vratnosti|dusledky|důsledky|moznosti|možnosti)/u.test(criterion)) {
    const safetyQuote = normalizeConsequenceEvidence(quote);
    if (/(?:dusledky|moznosti)/u.test(normalizeSafetyEvidence(criterion))) {
      return findAffirmativeConsequencesMappingIndex(safetyQuote) >= 0;
    }
    const safetyCriterion = normalizeSafetyEvidence(criterion);
    const mapsConsequencesOrOptions = /(?:oddel|rozlis|fakt|data|dusled|moznost|variant|alternativ|vliv|spoustec|preskum|prozkoum|zkoum|skum|porovn|map)/u.test(safetyQuote);
    const semanticCriterionMatch = meaningfulTokenOverlap(criterion, quote) >= 1
      || (/(?:dusledky|moznosti)/u.test(safetyCriterion)
        && /(?:financ|vypovedn|variant|alternativ|dopad|dusled|nasled)/u.test(safetyQuote));
    return mapsConsequencesOrOptions && semanticCriterionMatch;
  }
  return hypothesis && (test || meaningfulTokenOverlap(criterion, quote) >= 1);
}

function safetyEvidence(criterion, quote, rawQuote) {
  const asks = (rawQuote.match(/\?/gu) || []).length >= 1;
  const risk = /(?:sebevraz|sebevraž|samovraz|samovraž|ubliz|ublíž|nechcete zit|nechceš žít|nechces zit|neprobud|nezobud|bezprostred|bezprostřed|bezprostredn)/u.test(quote);
  const current = /(?:prave ted|právě teď|prave teraz|práve teraz|aktualn|aktuáln|dnes|ted|teď|teraz)/u.test(quote);
  const plan = /(?:plan|plán|zamer|záměr|umysl|úmysl)/u.test(quote);
  const means = /(?:prostred|prostřed|prostried|pristup k|přístup k|po ruce|pri sebe|při sobě)/u.test(quote);
  const safety = /(?:bezpec|bezpeč|zostat v bezpe|zustat v bezpe|zůstat v bezpe)/u.test(quote);
  const emergency = /(?:112|155)/u.test(quote);
  const human = /(?:blizk|blízk|blizka|blízká|partner|sestra|bratr|kamarad|kamarád|kamarat|rodin|clovek|člověk)/u.test(quote);

  if (/(?:prime otazky|přímé otázky|priame otazky|priame otázky)/u.test(criterion)) {
    if (!asks || !risk) return false;
    if (/(?:myslenky|myšlenky|myslienky).*(?:zamer|záměr)|(?:zamer|záměr).*(?:myslenky|myšlenky|myslienky)/u.test(criterion)) return plan;
    if (/(?:plan|plán).*(?:prostredky|prostředky|prostriedky)/u.test(criterion)) return plan && means;
    return current && plan && means && safety;
  }
  if (/(?:112|155)/u.test(criterion)) {
    return emergency && (/(?:bezprostred|bezprostřed|hned|teraz|ted|teď)/u.test(quote))
      && (!/(?:blizk|blízk|osob)/u.test(criterion) || human);
  }
  if (/(?:blizke osoby|blízké osoby|blizkou osobu|blízkou osobu|blizkym clovekem|blízkým člověkem)/u.test(criterion)) {
    return human && /(?:kontakt|zavol|prijet|přijet|prísť|prist|zustat|zůstat|zostat)/u.test(quote);
  }
  if (/(?:zustat v bezpeci|zůstat v bezpečí|zostat v bezpeci|zostať v bezpečí)/u.test(criterion)) {
    return asks && safety && /(?:dokazes|dokážeš|dokazete|dokážete|vies|vieš|viete|muzes|můžeš|muzete|můžete)/u.test(quote);
  }
  if (/(?:pasivni|pasivní|pasivne|pasívne).*bezpecnostn/u.test(criterion)) {
    return /(?:neprobud|nezobud|nebyt|nebýt|nebyt|nechci zit|nechci žít)/u.test(quote)
      && /(?:beru|beriem|vazne|vážně|bezpec|bezpeč)/u.test(quote);
  }
  if (/(?:navrat ke kouc|návrat ke kouč|preruseni|přerušení|zastaven)/u.test(criterion)) {
    return /(?:zastav|prerus|přeruš|nebudeme pokracovat|nebudeme pokračovat|nebudem pokracovat)/u.test(quote)
      && /(?:az po|až po|po vyjasneni|po vyjasnění|nejdriv|nejdřív|najprv)/u.test(quote)
      && (risk || safety);
  }
  if (/(?:klidny|klidný|nesoudici|nesoudící|lidsky|lidský)/u.test(criterion)) {
    return !/(?:hloupost|nesmysl|prehanite|přeháníte|hyster)/u.test(quote)
      && /(?:beru vazne|beru vážně|beriem vazne|beriem vážne|zustanu|zůstanu|zostanem|pomoc|bezpec|bezpeč)/u.test(quote);
  }
  return (asks && risk && (current || safety)) || (emergency && human);
}

function confidentialityEvidence(criterion, quote, previous) {
  const domain = /(?:firma|hr|sponzor|report|obsah|zapis|zápis|poznamk|poznámk|prepis|přepis|data|udaj|údaj|ucast|účast|dochazk|dochádzk)/u.test(quote);
  const protects = /(?:nepredam|nepředám|neodovzdam|neodovzdám|neposlu|nepošlu|neposlem|nesdilim|nesdílím|nezdielam|nepotvrdim|nepotvrdím|bez souhlasu|bez súhlasu|jen|iba|pouze|minimal)/u.test(quote);
  if (/(?:zadne predani zapisu|žádné předání zápisu)/u.test(criterion)) {
    return /(?:zapis|zápis|poznamk|poznámk|prepis|přepis)/u.test(quote) && protects;
  }
  if (/(?:zadne potvrzeni|žádné potvrzení)/u.test(criterion)) {
    return /(?:nepotvrdim|nepotvrdím|nemohu potvrdit|nemôžem potvrdiť)/u.test(quote)
      && /(?:vyrok|výrok|tema|téma|obsah|co rekla|co řekla|co povedala)/u.test(quote);
  }
  if (/(?:tristrann|třístrann|trojstrann|do budoucna|do budúcna)/u.test(criterion)) {
    return /(?:klientk|firma|sponzor)/u.test(quote)
      && /(?:predem|předem|vopred|do budoucna|do budúcna|pro dalsi|pro další|pre dalsie|pre ďalšie)/u.test(quote)
      && /(?:dohod|souhlas|suhlas|súhlas)/u.test(quote);
  }
  if (/(?:puvodni souhlas|původní souhlas|zpetne rozsir|zpětně rozšíř|spatne rozsir|spätne rozšír)/u.test(criterion)) {
    return /(?:puvodni|původní|dosavadni|dosavadní|povodny|pôvodný|doterajsi|doterajší)/u.test(quote)
      && /(?:nelze|nemohu|nemuzu|nemůžu|nemozem|nemôžem|neda se|nedá sa|nebudu|nebudem)/u.test(quote)
      && /(?:zpetne|zpětně|spatne|spätne|dodatecne|dodatečně)/u.test(quote);
  }
  if (/(?:kontrolu nad novym souhlasem|kontrolu nad novým souhlasem)/u.test(criterion)) {
    return /(?:klientk|ona)/u.test(quote)
      && /(?:sama|predem|předem|vopred).{0,30}(?:rozhodne|urci|určí|schvali|schválí|odsouhlasi|odsouhlasí)/u.test(quote);
  }
  if (/(?:minimalizace|minimalizácia|datove usporn|datově úsporn)/u.test(criterion)) {
    return domain && /(?:jen|iba|pouze|minimal|nezbytn|nevyhnutn|agregovan)/u.test(quote) && protects;
  }
  if (/(?:report|dohody|dohode|duvernost|důvěrnost|dovernost|dôvernosť)/u.test(criterion)) {
    return domain && protects && /(?:souhlas|suhlas|súhlas|dohod|predem|předem|vopred)/u.test(quote);
  }
  return domain && protects && (meaningfulOverlap(quote, previous) >= 1 || !previous);
}

function criterionSpecificAnchor(criterion, quote, previous, next, competencyId = null) {
  const guarded = exactCriterionGuard(criterion, quote, previous, next);
  if (guarded !== null) return guarded;
  const conceptMatchers = conceptMatchersForCriterion(criterion, competencyId);
  if (conceptMatchers.length) return conceptMatchers.every(pattern => pattern.test(`${quote} ${previous} ${next}`));
  return meaningfulTokenOverlap(criterion, quote) >= 2;
}

function exactCriterionGuard(criterion, quote, previous, next) {
  if (/(?:volba metody podle reakce klientky)/u.test(criterion)) {
    const method = /(?:grow|heart|ramec|rámec|map|cviceni|cvičení|cvičenie|experiment|orientac|postup|nastroj|nástroj|metod|bez ramce|bez rámce|rozhovor)/u.test(quote);
    const purpose = /(?:aby|protoze|protože|pretoze|pretože|ucelem|účelem|ucelom|účelom|pomoh|zmyslom|smyslem)/u.test(quote);
    const realChoice = /(?:chcete|chces|chceš|souhlasis|souhlasíš|suhlasis|súhlasíš).{0,55}(?:pouzit|použít|použiť|skusit|skúsiť|zkusit|vyskusat|vyskúšať|vyzkoušet)|(?:chcete|chces|chceš).{0,70}(?:nebo|alebo).{0,45}(?:rozhovor|jinak|inak|odlozit|odložiť)/u.test(quote);
    return method && purpose && realChoice && !reimposesRefusedMethod(quote, previous);
  }
  if (/(?:rozliseni koucinku mentoringu a garance vysledku)/u.test(criterion)) {
    return /(?:nemohu|nemozem|nemôžem|nelze|neda se|nedá sa).{0,45}(?:garantovat|zarucit|zaručit|zaručiť)/u.test(quote)
      && /(?:koucink|koučink|koucing|koučing)/u.test(quote)
      && /(?:cil|cíl|ciel|moznost|možnost|krok|proces|postup)/u.test(quote);
  }
  if (/(?:pravdive vysvetleni nabidky ceny a interniho certifikatu)/u.test(criterion)) {
    const truthfulLimit = /(?:nemohu|nemozem|nemôžem|nelze|neda se|nedá sa).{0,45}(?:garantovat|garantovať|zarucit|zaručit|zaručiť)/u.test(quote);
    const certificateLimit = /(?:interni|interní|interny|interný).{0,35}(?:certifikat|certifikát).{0,45}(?:neni|není|nie je).{0,35}(?:icf|akreditac|licenc)/u.test(quote)
      || /(?:certifikat|certifikát).{0,35}(?:interni|interní|interny|interný).{0,35}(?:neni|není|nie je).{0,35}(?:icf|akreditac|licenc)/u.test(quote)
      || /(?:icf|akreditac|licenc).{0,45}(?:neni|není|nie je|nejde o).{0,35}(?:interni|interní|interny|interný).{0,35}(?:certifikat|certifikát)/u.test(quote);
    return truthfulLimit && certificateLimit;
  }
  if (/(?:prevzeti odpovednosti za nevyzadanou radu)/u.test(criterion)) {
    return /(?:rada|radu|rozhodnuti|rozhodnutí)/u.test(quote)
      && /(?:dala jsem|dal jsem|prevzala jsem|převzala jsem|prevzal jsem|převzal jsem|dala som|dal som|prevzala som|prevzal som)/u.test(quote)
      && /(?:omlouvam|omlouvám|ospravedlnujem|mrzi me|mrzí mě|mrzi ma|mrzí ma)/u.test(quote);
  }
  if (/(?:autonomie rozhodnuti zustava klientce koucka neurcuje odchod ani setrvani)/u.test(criterion)) {
    return /(?:volba|rozhodnuti|rozhodnutí).{0,25}(?:zustavaji|zůstávají|zustava|zůstává|je).{0,20}(?:na tobe|na tobě|na tebe|na vas|na vás)/u.test(quote)
      && /(?:neudelam|neudělám|nerozhodnu|neurobim|neurobím).{0,25}(?:za tebe|za vas|za vás)|(?:za tebe|za vas|za vás).{0,25}(?:neudelam|neudělám|nerozhodnu|neurobim|neurobím)/u.test(quote);
  }
  if (/(?:odpovednost neni skryte prevzata radou)/u.test(criterion)) {
    const refusesTakeover = /(?:neudelam|neudělám|neurobim|neurobím|nerozhodnu|nerozhodnem).{0,30}(?:za tebe|za vas|za vás)|(?:za tebe|za vas|za vás).{0,30}(?:neudelam|neudělám|neurobim|neurobím|nerozhodnu|nerozhodnem)/u.test(quote);
    const keepsOwnership = /(?:volba|rozhodnuti|rozhodnutí|rozhodnutie|odpovednost|odpovědnost|zodpovednost|zodpovednosť).{0,35}(?:zustava|zůstává|zostava|zostáva|patri|patří|je).{0,22}(?:na tobe|na tobě|na tebe|na vas|na vás|tvoje|tvoja)/u.test(quote);
    const covertDirective = /(?:musis|musíš|musite|musíte|udelej|udělej|urob|dej vypoved|dej výpověď|daj vypoved|podepis|podpis|ja bych|já bych|urobila by som|udelala bych|udělala bych)/u.test(quote);
    return (refusesTakeover || keepsOwnership) && !covertDirective;
  }
  if (/(?:klientka potvrzuje opraveny dalsi tah)/u.test(criterion)) {
    const ownsRepair = /(?:omlouvam|omlouvám|ospravedlnujem|pridala jsem|přidala jsem|pridala som|vlozila jsem|vložila jsem|vlozila som|prevzala jsem|převzala jsem|prevzala som)/u.test(quote);
    const immediateConfirmation = clientConfirmsRepair(next);
    return ownsRepair && immediateConfirmation;
  }
  if (/(?:konkretni uzavreni nebo dalsi krok)/u.test(criterion)) {
    return /(?:jaky|jaký|aky|aký|ktery|který|ktory|ktorý|co).{0,50}(?:krok|moznost|možnost).{0,40}(?:volis|volíš|volite|volíte|vyberas|vybíráš|vyberes|vybereš|vyberete|zvolis|zvolíš|zvolite|zvolíte)/u.test(quote)
      && /(?:do kdy|dokdy|kdy|kedy|termin|termín|vyhodnot|over|ověř|podle ceho|podle čeho|podľa čoho)/u.test(quote);
  }
  if (/(?:vznikne vratny mezikrok nebo cas na rozhodnuti)/u.test(criterion)) {
    return /(?:vratn|mezikrok|medzikrok)/u.test(quote)
      && /(?:do kdy|dokdy|kdy|kedy|cas|čas|termin|termín|vyhodnot|prehodnot|přehodnot)/u.test(quote)
      && !/(?:okamzite|okamžitě|hned).{0,30}(?:vypoved|výpověď|odist|odejit|podepsat|podpisat)/u.test(quote);
  }
  if (/(?:jsou zmapovany dusledky a moznosti)/u.test(criterion)) {
    const safetyQuote = normalizeConsequenceEvidence(quote);
    return findAffirmativeConsequencesMappingIndex(safetyQuote) >= 0;
  }
  if (/(?:journaling ani domaci ukol nejsou znovu nabidnuty)/u.test(criterion)) {
    const namesBoth = /(?:denik|deník|dennik|denník|journaling)/u.test(quote)
      && /(?:domaci ukol|domácí úkol|domaca uloha|domáca úloha|domácu úlohu)/u.test(quote);
    const withdraws = /(?:nebudu|nebudem|nebudeme).{0,55}(?:navrhovat|navrhovať|ponukat|ponúkať|presvedc|přesvědč)/u.test(quote)
      || /(?:denik|deník|dennik|denník|journaling).{0,45}(?:domaci ukol|domácí úkol|domaca uloha|domáca úloha|domácu úlohu).{0,45}(?:nebudu|nebudem|nebudeme)/u.test(quote);
    return namesBoth && withdraws && !reimposesRefusedMethod(quote, previous);
  }
  if (/(?:klientka muze smer ukoncit)/u.test(criterion)) {
    return /(?:chces|chceš|chcete|mozeme|môžeme|můžeme|mozes|môžeš|můžeš).{0,75}(?:uzavrit|uzavřít|uzavriet|uzavrieť|ukoncit|ukončit|ukončiť|skoncit|skončit|skončiť|zastavit|zastaviť)/u.test(quote)
      && !/(?:musis|musíš|musite|musíte|musíte|aj napriek|i pres|i přes)/u.test(quote);
  }
  if (/(?:dopad na alianci je uznan)/u.test(criterion)) {
    return /(?:mrzi ma|mrzí ma|mrzi me|mrzí mě|omlouvam se|omlouvám se|ospravedlnujem sa)/u.test(quote)
      && /(?:pocit|nepocuv|nepočúv|neposlouch|alianc|spoluprac)/u.test(quote)
      && !/(?:ale|avsak|avšak|jenze|jenže).{0,40}(?:mela jsem pravdu|měla jsem pravdu|moja interpretacia bola spravna|moje interpretace byla spravna)/u.test(quote);
  }
  if (/(?:jasna hranice role bezpecnostni orientace a konkretni predani bez opusteni klientky)/u.test(criterion)) {
    return /(?:jako koucka|jako koučka|ako koucka|ako koučka|v koucinku|v koučinku|v koucingu|v koučingu)/u.test(quote)
      && /(?:nenahrazuje|nenahradza|nemohu|nemozem|nemôžem|nelecim|neléčím|neliecim|nediagnostik)/u.test(quote)
      && /(?:bezpec|bezpeč)/u.test(quote)
      && /(?:psycholog|terapeut|lekar|lékař|lekár|krizov|112|155|odbornik|odborník)/u.test(quote)
      && /(?:kontakt|spoj|prepoj|propoj|zavol|objedn)/u.test(quote);
  }
  if (/(?:jasne vysvetleni predchozi dohody)/u.test(criterion)) {
    return /(?:predchozi|dosavadni|povodni|puvodni|původní|doterajsi|doterajší).{0,30}(?:dohod|souhlas|suhlas|súhlas)/u.test(quote)
      && /(?:jen|pouze|iba).{0,35}(?:ucast|účast|dochazk|dochádzk|obecny cil|obecný cíl|vseobecny ciel|všeobecný cieľ)/u.test(quote);
  }
  if (/(?:pojmenovani hranice bez diagnostiky)/u.test(criterion)) {
    return /(?:diagnoz|diagnóz)/u.test(quote)
      && /(?:neurcuji|neurčuji|nestanovuji|nemohu|nemozem|nemôžem|nebudu|nebudem)/u.test(quote);
  }
  if (/(?:jasny rozsah sluzby|jasný rozsah služby|srozumitelne vymezeni koucovaci role|srozumitelné vymezení koučovací role|skutecna role je popsana konkretne|skutečná role je popsána konkrétně)/u.test(criterion)) {
    const roleLimit = /(?:jako koucka|jako koučka|ako koucka|ako koučka|moje role|moja rola|v koucinku|v koučinku|v koucingu|v koučingu)/u.test(quote)
      && /(?:nenahrazuje|nenahradza|nemohu|nemozem|nemôžem|nelecim|neléčím|neliecim|nediagnostik|diagnozu neurcuji|diagnózu neurčuji)/u.test(quote);
    const includedScope = /(?:mohu|mozem|môžem|muzeme|můžeme).{0,65}(?:pracovat|zmapovat|ujasnit|vyjasnit|preskumat|prozkoumat|spresnit|zpřesnit).{0,45}(?:cil|cíl|ciel|moznost|možnost|krok|neklinick)/u.test(quote);
    return roleLimit && includedScope;
  }
  if (/(?:bezpecne uzavreni bez otevreni dalsi hloubky)/u.test(criterion)) {
    return /(?:uzavreme|uzavřeme|uzavrit|uzavřít|dnes skoncime|dnes skončíme|dnes koncime|dnes končíme)/u.test(quote)
      && /(?:nebudeme|nebudu|nebudem).{0,38}(?:otevirat|otevírat|otvarat|otvárať|jit hloubeji|jít hlouběji|ist hlbsie|ísť hlbšie|dalsi tema|další téma)/u.test(quote);
  }
  if (/(?:bezpecny experiment s podminkou neprovedeni)/u.test(criterion)) {
    return /(?:experiment|pokus|test)/u.test(quote)
      && /(?:pokud|ak|jen kdyz|jen když|iba ked|iba keď)/u.test(quote)
      && /(?:neproved|neudel|neuděl|neurob|zastav|vynech)/u.test(quote);
  }
  if (/(?:bod revize bez manipulace)/u.test(criterion)) {
    return /(?:reviz|vyhodnot|zhodnot|vratime se|vrátíme se|vratime sa)/u.test(quote)
      && /(?:kdy|kedy|datum|termin|termín|podle ceho|podle čeho|podľa čoho)/u.test(quote);
  }
  if (/(?:klientkou ovlivnitelne kroky a metriky)/u.test(criterion)) {
    return /(?:ve tvem vlivu|ve tvém vlivu|vo tvojom vplyve|muzes ovlivnit|můžeš ovlivnit|mozes ovplyvnit|môžeš ovplyvniť)/u.test(quote)
      && /(?:krok|metrik|zmer|změř|over|ověř|vyhodnot)/u.test(quote);
  }
  if (/(?:nalezeni casneho bodu volby)/u.test(criterion)) {
    return /(?:prvni signal|první signál|skory signal|skorý signál|driv nez|dřív než|skor nez|skôr než|casny bod|časný bod)/u.test(quote)
      && /(?:volba|zvolit|urobit inak|udělat jinak|udelat jinak)/u.test(quote);
  }
  if (/(?:oddeleni obsahu ucasti a vysledkove metriky)/u.test(criterion)) {
    return /(?:obsah|poznamk|zapis|zápis)/u.test(quote)
      && /(?:ucast|účast|dochazk|dochádzk)/u.test(quote)
      && /(?:metrik|vysledek|výsledek|výsledok)/u.test(quote)
      && /(?:oddel|odděl|rozlis|rozliš|jine|jiné|ine|iné)/u.test(quote);
  }
  if (/(?:klientkou vlastnene rozhodnuti oprene o kriteria cas a vratny mezikrok|vratny mezikrok nebo cas na rozhodnuti|pozorovatelny dukaz klientkou vlastnene rozhodnuti)/u.test(criterion)) {
    return /(?:kriteri|kritéri)/u.test(quote)
      && /(?:cas|čas|kdy|kedy|termin|termín)/u.test(quote)
      && /(?:vratn|mez ikrok|mezikrok|ziskat data|získat data)/u.test(quote);
  }
  if (/(?:cil prevazne v klientcine vlivu)/u.test(criterion)) {
    return /(?:cil|cíl|ciel)/u.test(quote)
      && /(?:ve tvem vlivu|ve tvém vlivu|vo tvojom vplyve|muzes ovlivnit|můžeš ovlivnit|mozes ovplyvnit|môžeš ovplyvniť)/u.test(quote);
  }
  if (/(?:overeni aktualniho bezpeci a volby)/u.test(criterion)) {
    return /(?:bezpec|bezpeč)/u.test(quote)
      && /(?:volba|chces|chceš|chcete|zvolis|zvolíš|zvolite|zvolíte)/u.test(quote);
  }
  if (/(?:autonomie klientky prace s vratnosti a konkretni ziskani casu ci odbornych dat)/u.test(criterion)) {
    return /(?:rozhodnuti|rozhodnutí|rozhodnutie).{0,35}(?:na tobe|na tebe|na vas|na vás)/u.test(quote)
      && /(?:vratn|cas|čas|data|pravnik|právník|poradce|poradca|odbornik|odborník)/u.test(quote);
  }
  if (/(?:vyslovne odmitnuti neopravneneho sdileni a datove usporna alternativa)/u.test(criterion)) {
    return /(?:nepredam|nepředám|neodovzdam|neodovzdám|nesdilim|nesdílím|nezdielam)/u.test(quote)
      && /(?:obsah|data|zapis|zápis|poznamk|poznámk)/u.test(quote)
      && /(?:minimal|agregovan|jen ucast|jen účast|iba ucast|iba účasť)/u.test(quote);
  }
  if (/(?:technika je ihned zastavena|odmitnuta technika je ihned zastavena|rozhodnuti nepokracovat stejnou technikou)/u.test(criterion)) {
    return /(?:techniku|metodu|ramec|rámec|vizualizaci|vizualizáciu|otazku|otázku)/u.test(quote)
      && /(?:zastavuji|zastavujem|nebudu|nebudem|nebudeme|stahuji|sťahujem)/u.test(quote);
  }
  if (/(?:schopnost otazku stahnout kdyz nesedi)/u.test(criterion)) {
    return /(?:otazku|otázku)/u.test(quote)
      && /(?:stahuji|stáhnu|stahnu|sťahujem|nebudu ji|nebudem ju)/u.test(quote);
  }
  return null;
}

function clientConfirmsRepair(value) {
  const next = normalizeEvidence(value);
  const accepts = /(?:ano|áno|jo|dobre|dobře|plati|platí|sedi|sedí|presne|přesně|chci|chcem|pojdme|pojďme|omluvu (?:prijimam|přijímám|beru|prijmu|přijmu)|ospravedlnenie (?:prijimam|prijímam|beriem|prijmem))/u.test(next);
  const rejects = /(?:ale.{0,35}\b(?:ne|nie)\b|nechci|nechcem|nesedi|nesedí|nesúhlas|nesouhlas|omluvu (?:neprijimam|nepřijímám|neberu)|ospravedlnenie (?:neprijimam|neprijímam|neberiem))/u.test(next);
  return accepts && !rejects;
}

function semanticContextOverlap(left, right) {
  if (!left || !right) return false;
  const concepts = [
    /(?:prac|zamestn|zaměstn|karier|kariér|profes|vypoved|výpověď|výpoved)/u,
    /(?:financ|prijem|příjem|príjem|rezerv|plat|mzda|peniz|peníz|peniaz)/u,
    /(?:hodnot|konflikt|zrada|zradit)/u,
    /(?:rozhod|volba|voľba|moznost|možnost|variant|alternativ)/u,
    /(?:strach|obav|nejist|neist|rizik)/u,
    /(?:cena|nabidk|nabídka|ponuk)/u,
  ];
  return concepts.some(pattern => pattern.test(left) && pattern.test(right));
}

function substantiveInterventionAnchor(value) {
  const text = String(value || '');
  return /(?:vliv|vplyv|trh|hodnot|konflikt|cena|priorit|moznost|možnost|variant|fakt|data|krok|rozhod)/u.test(text);
}

function substantiveQuestionAnchor(value) {
  return /(?:prac|zamestn|zaměstn|karier|kariér|hodnot|konflikt|cena|rozhod|volba|voľba|moznost|možnost|strach|obav|financ|priorit|krok)/u.test(String(value || ''));
}

function isShortConfirmation(value) {
  const text = String(value || '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return /^(?:ano|ano sedi|ano sedí|ano sedi to|ano sedí to|ano presne|ano přesně|áno|áno sedi|áno sedí|áno sedi to|áno sedí to|áno presne|jo|dobre|dobře|presne|přesně)$/u.test(text);
}

function conceptMatchersForCriterion(criterion, competencyId = null) {
  const groups = [];
  const add = (expectedCompetencyId, criterionPattern, evidencePattern) => {
    if ((!competencyId || competencyId === expectedCompetencyId) && criterionPattern.test(criterion)) {
      groups.push(evidencePattern);
    }
  };
  add('contract', /(?:kontrakt|zakazk|zakázk|dohod)/u, /(?:kontrakt|zakazk|zakázk|dohod|cil|cíl|ciel|vysledek|výsledek|výsledok|odnest|odnést|odnies|uzitecn|užitečn|užitočn)/u);
  add('active_listening', /(?:naslouch|navaz|nadvaznost|návaznost|reflex.{0,25}(?:klient|slov|obsah|porozum)|parafraz|klientcin|klientčin)/u, /(?:slysim|slyším|pocujem|počujem|rikate|říkáte|rikas|říkáš|rozumim|rozumím|rozumiem|oprav|sedi|sedí)/u);
  add('questions', /(?:otazk|otázk|probing)/u, /\?/u);
  add('intervention_choice', /(?:pojmenovani ucelu|volba intervence|volba metody)/u, /(?:grow|heart|map|metod|ramec|rámec|nastroj|nástroj|trideni|třídění)/u);
  add('refusal_autonomy', /(?:odmitnut|odmítnut|odmietnut|autonom|volb|rozhodnuti|rozhodnutí|rozhodnutie)/u, /(?:respekt|beru|nepujd|nepůjd|nebudu|nebudem|vratime|vrátíme|volba|volíš|volis|rozhodnuti|rozhodnutí|rozhodnutie|na tobe|na tebe|na vas|na vás|kam byste chtela|kam byste chtěla|kam bys chtela|kam bys chtěla|zastav)/u);
  add('alliance_repair', /(?:opravy|oprava|chybu|alianc|ruptur)/u, /(?:mate pravdu|máte pravdu|mas pravdu|máš pravdu|omlouvam|omlouvám|ospravedlnujem|vlozila|vložila|domyslela|opravi)/u);
  add('outcome', /(?:krok|experiment|revize|metrik|uzavreni|uzavření)/u, /(?:krok|experiment|kdy|kedy|over|ověř|vyhodnot|metrik|uzav)/u);
  add('reflection', /(?:reflexe|hypotez|bias|projekc|superviz|uceni|učení)/u, /(?:hypotez|bias|projekc|prvni dojem|první dojem|prvy dojem|fakt|data|over|ověř|superviz|priste|příště|nabuduce)/u);
  add('ethical_boundaries', /(?:hranice|role|klinick|terapi|lecby|léčby|liecby|leceb|léčeb|lieceb|diagnos|diagnoz)/u, /(?:hranice|role|koucink|koučink|koucing|koučing|diagnos|diagnoz|nemohu|nemozem|nemôžem|nebudu|nebudem|odbornik|odborník|odborn)/u);
  return groups;
}

function reimposesRefusedMethod(quote, previous) {
  const refusedTerms = tokens(previous).filter(token => /(?:denik|deník|dennik|journaling|ukol|úkol|uloha|úloha|vizualiz|grow|otazk|otázk)/u.test(token));
  return refusedTerms.some(term => quote.includes(term)
    && /(?:zkus|skus|udel|uděl|urob|musis|musíš|musite|musíte|pokrac|pokrač)/u.test(quote));
}

function meaningfulOverlap(left, right) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  let count = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) count += 1;
  return count;
}

function meaningfulTokenOverlap(left, right) {
  return meaningfulOverlap(normalizeCoachRubricLabel(left), normalizeEvidence(right));
}

function tokens(value) {
  return normalizeEvidence(value)
    .split(' ')
    .map(token => token.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(token => token.length >= 4 && !STOPWORDS.has(token))
    .map(token => token.replace(/(?:ami|emi|ove|ová|ové|ovy|eni|ení|ani|ace|aci|ost|ech|ich|ych|ou|em|im|at|it|et|y|a|u|i|e|o)$/u, '').slice(0, 12))
    .filter(token => token.length >= 3);
}

function normalizeEvidence(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[“”„]/gu, '"')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeSafetyEvidence(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeConsequenceEvidence(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    // Keep semantic clause boundaries so an explicit later repair cannot be
    // mistaken for the scope of an earlier refusal (and vice versa).
    .replace(/[^a-z0-9\s,;.!?]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function hasAffirmativeCredentialContradiction(value) {
  if (hasGeneralizedFalseCredentialClaim(value)) return true;
  if (hasOnlySafelyScopedCredentialTargets(value)) return false;
  const text = credentialEvidenceForClassification(value).text;
  const match = AFFIRMATIVE_CREDENTIAL_CONTRADICTION.exec(text)
    || COMPLETION_CREDENTIAL_CONTRADICTION.exec(text);
  if (!match) return false;
  const prefix = text.slice(Math.max(0, match.index - 70), match.index);
  return !/(?:neni pravda|nie je pravda|netvrdim|netvrdime|nehovorim|nerikam).{0,50}$/u.test(prefix);
}

/**
 * Detects a product/completion claim that grants a regulated-looking
 * accreditation, licence or professional coach status. The decision is made
 * per credential target, so a nearby scoped negation cannot be cancelled by a
 * different positive verb earlier in the sentence.
 */
export function hasGeneralizedFalseCredentialClaim(value) {
  const { text } = credentialEvidenceForClassification(value);
  if (!text) return false;
  const targets = credentialTargetsByClause(text);
  if (!targets.length) return false;
  if (/(?:tvrzen|tvrden|vyrok|veta|claim)[a-z]*\b(?:(?!\bclauseboundary\b).){0,240}\b(?:neni|nie je)\s+nepravdiv[a-z]*/u.test(text)) return true;
  return targets.some(target => credentialTargetClassification(
    text,
    target.index,
    target.value.length,
  ) === 'claim');
}

export function hasOnlySafelyScopedCredentialTargets(value) {
  const { text, rejectedQuotationCount } = credentialEvidenceForClassification(value);
  if (!text) return false;
  const targets = credentialTargetsByClause(text);
  return (rejectedQuotationCount > 0 && targets.length === 0)
    || (targets.length > 0 && targets.every(target => credentialTargetClassification(
      text,
      target.index,
      target.value.length,
    ) === 'safe'));
}

export function isCredentialQuestion(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const text = normalizeCredentialEvidence(raw);
  const asksIssuer = /^(?:vydav[a-z]*|udel[a-z]*|poskyt[a-z]*)\b/u.test(text);
  const hasQuestionForm = /\?/u.test(raw)
    || asksIssuer
    || /^(?:je|jsou|jde|ide|ma|dava|opravn[a-z]*|doklad[a-z]*|prokaz[a-z]*|preukaz[a-z]*|potvrz[a-z]*|potvrdz[a-z]*|zisk[a-z]*|dostan[a-z]*|obdrz[a-z]*|bud[a-z]*|stan[a-z]*|sm[a-z]*|moh[a-z]*|muz[a-z]*|moz[a-z]*|urob[a-z]*)\b/u.test(text);
  if (!hasQuestionForm) return false;
  const hasTarget = credentialTargetsByClause(text).length > 0;
  const hasCredentialConcept = /\b(?:akredit[a-z]*|licenc[a-z]*|icf|opravnen[a-z]*|kvalifik[a-z]*|certifikovan[a-z]*|titul[a-z]*|profes[a-z]*\s+prax[a-z]*|zpusobil[a-z]*|sposobil[a-z]*)\b/u.test(text);
  const hasProductOrRecipient = CREDENTIAL_PRODUCT_OR_COMPLETION.test(text)
    || /\b(?:elitea|ja|mi|me|mne|mna|my|nam|absolvent[a-z]*|ucastni[a-z]*|student[a-z]*)\b/u.test(text)
    || /\b(?:bud[a-z]*|zisk[a-z]*|dostan[a-z]*|obdrz[a-z]*|sm[a-z]*|moh[a-z]*|muz[a-z]*|moz[a-z]*|stan[a-z]*|urob[a-z]*)\b/u.test(text)
    || /\b(?:(?:je|jde|ide)\s+to|(?:jde|ide)\s+o)\b/u.test(text)
    || asksIssuer;
  return (hasTarget || hasCredentialConcept) && hasProductOrRecipient;
}

function credentialTargetClassification(text, targetIndex, targetLength) {
  const bounds = credentialClauseBounds(text, targetIndex);
  const clause = text.slice(bounds.start, bounds.end);
  const localIndex = targetIndex - bounds.start;
  const before = clause.slice(0, localIndex);
  const after = clause.slice(localIndex + targetLength);
  const targetText = clause.slice(localIndex, localIndex + targetLength);

  // Meta-language that explicitly separates, warns against, or forbids a
  // credential claim is not itself the prohibited product claim. Keep this
  // target-local so a later contrastive assertion is still evaluated.
  if (credentialTargetIsExplicitlyDisclaimed(clause, localIndex, targetLength)) return 'safe';

  // One negated granting predicate can govern a coordinated list of statuses:
  // "nezískáš ICF akreditaci ani licenci" denies both targets. Contrastive
  // repairs are already separate clauses, so this cannot hide a later grant.
  if (/\b(?:nezisk[a-z]*|neobdrz[a-z]*|nedostan[a-z]*|nenadobud[a-z]*|neudel[a-z]*|neprizn[a-z]*|nevyd[a-z]*|neopravn[a-z]*|nekvalifik[a-z]*|nepotvrz[a-z]*|neprokaz[a-z]*|nepreukaz[a-z]*)\b.{0,190}$/u.test(before)) return 'safe';

  // These are explicit limits, not credential grants. Keep the scope local to
  // the target so a later contrast ("ale program licenci udělí") is still
  // evaluated as a separate positive claim.
  const locallyDeniesEntitlement = /\b(?:neopravn[a-z]*|nenahraz[a-z]*|nenahradz[a-z]*)\b.{0,95}$/u.test(before);
  const refusesToAssertCredential = /\b(?:nemohu|nemuzeme|nemozem|nemozeme|nelze|neda se|neda sa)\s+(?:tvrdit|prohlasit|vyhlasit|rict|rici|hovorit|povedat)\b.{0,125}$/u.test(before);
  const requiresExternalAcquisition = /^.{0,75}\b(?:musi[a-z]*|treba|potreb[a-z]*|je nutne|je potrebne)\b.{0,55}\b(?:zisk[a-z]*|obdrz[a-z]*|nadobud[a-z]*)\b.{0,45}\b(?:samostatn[a-z]*|mimo|extern[a-z]*|u icf|od icf)\b/u.test(after);
  if (locallyDeniesEntitlement || refusesToAssertCredential || requiresExternalAcquisition) return 'safe';

  if (credentialClaimIsExplicitlyAffirmed(clause, localIndex, targetLength)) return 'claim';

  // Quoted/example marketing claims are safe only when the same statement is
  // explicitly labelled false. This deliberately supports the label both
  // before and after the quoted words because punctuation is normalized away.
  if (credentialClaimIsExplicitlyRejected(clause, localIndex, targetLength)) return 'safe';

  // A denial wrapper reverses the polarity of the embedded proposition:
  // "není pravda, že program vede..." is safe, while "není pravda, že
  // program nevede..." asserts the prohibited positive claim.
  const denial = lastRegexMatch(before, CREDENTIAL_DENIAL_WRAPPER);
  if (denial) {
    const embeddedBefore = before.slice(denial.index + denial[0].length);
    const embedded = `${embeddedBefore} ${after.slice(0, 75)}`;
    return hasCredentialNegatedPredicate(embeddedBefore, after, embedded)
      ? 'claim'
      : 'safe';
  }

  if (credentialTargetIsInformational(clause, localIndex, targetLength)) return 'safe';
  const followsContrastiveMinimization = /\b(?:neni|nie je)\b.{0,45}\b(?:jen|len|iba|pouh[a-z]*)\b.{0,75}$/u.test(before)
    && CREDENTIAL_CONFERRING_ACTION.test(targetText)
    && !NEGATED_CREDENTIAL_ACTION.test(targetText);
  if (followsContrastiveMinimization) return 'claim';
  if (credentialTargetIsSafelyNegated(clause, localIndex, targetLength)) return 'safe';

  const context = clause.slice(
    Math.max(0, localIndex - 220),
    Math.min(clause.length, localIndex + targetLength + 150),
  );
  const precedingContext = text.slice(Math.max(0, bounds.start - 220), bounds.start);
  const bridgedCopula = /\b(?:je|jde|ide)\s+to(?:\s+(?:vsak|ovsem|presto|napriek tomu))?\s*$/u.test(precedingContext);
  const inheritedCredentialSubject = CREDENTIAL_PRODUCT_OR_COMPLETION.test(precedingContext)
    && /\b(?:je|jsou|su|bude|budou|jde|ide|predstav[a-z]*|fung[a-z]*|opravn[a-z]*|akredit[a-z]*|kvalifik[a-z]*|zaklad[a-z]*|potvrz[a-z]*|potvrdz[a-z]*|doklad[a-z]*|prokaz[a-z]*|preukaz[a-z]*|udel[a-z]*|prizn[a-z]*|prezent[a-z]*|pouziv[a-z]*|vyd[a-z]*|znamena|rovn[a-z]*)\b/u.test(clause.slice(0, localIndex + targetLength + 45));
  const hasClaimSubject = CREDENTIAL_CLAIM_SUBJECT.test(context)
    || /\b(?:po|po uspesnem|po uspesnom)\s+(?:kurz[a-z]*|vycvik[a-z]*|program[a-z]*|studi[a-z]*|zkous[a-z]*|skus[a-z]*|absolvovani|absolvovanie|dokonceni|dokoncenie|ukonceni|ukoncenie)\b/u.test(context)
    || /\bpo\b.{0,28}\b(?:studi[a-z]*|zkous[a-z]*|skus[a-z]*|konc[a-z]*|zaver[a-z]*)\b/u.test(context)
    || /\b(?:je|bude)\s+to\b/u.test(context)
    || /\b(?:jde|ide)\s+o\b/u.test(context)
    || bridgedCopula
    || inheritedCredentialSubject;
  const hasPositivePredicate = CREDENTIAL_CONFERRING_ACTION.test(context)
    || /\b(?:vysledkem|vysledkom)\b.{0,45}\b(?:je|bude|su|jsou)\b/u.test(context)
    || /\b(?:jde|ide)\s+o\b/u.test(context)
    || bridgedCopula
    || /\b(?:stanete se|stanete sa|stane se|stane sa|budete)\b.{0,55}(?:drzitel|licencovan|certifikovan|akreditovan|statem uznavan|statom uznavan)/u.test(context);
  return hasClaimSubject && hasPositivePredicate ? 'claim' : 'unknown';
}

function credentialTargetsByClause(text) {
  const contrasts = [...text.matchAll(CREDENTIAL_CONTRAST)];
  const segments = [];
  let start = 0;
  for (const contrast of contrasts) {
    const index = Number(contrast.index || 0);
    if (index > start) segments.push({ start, value: text.slice(start, index) });
    start = index + contrast[0].length;
  }
  if (start < text.length) segments.push({ start, value: text.slice(start) });
  if (!segments.length && text) segments.push({ start: 0, value: text });
  return segments.flatMap(segment => [...segment.value.matchAll(CREDENTIAL_TARGET)].map(match => ({
    index: segment.start + Number(match.index || 0),
    value: match[0],
  })));
}

function credentialTargetIsExplicitlyDisclaimed(clause, targetIndex, targetLength) {
  const before = clause.slice(Math.max(0, targetIndex - 230), targetIndex);
  const after = clause.slice(targetIndex + targetLength, targetIndex + targetLength + 130);
  const distinction = /(?:je potreba|je nutne|treba|musime|musime jasne)\s+.{0,45}(?:rozlisit|odlisit|oddeli|nezamenovat|nezamienat)\b.{0,125}$/u.test(before);
  const forbiddenConfusion = /(?:nesmi|nesmie|nemuze|nemoze)\s+(?:byt|byt)\s+.{0,35}(?:zamen[a-z]*|zamien[a-z]*)\s+(?:za|s)\b.{0,100}$/u.test(before);
  const confusionWarning = /(?:upozorn[a-z]*|varujeme|pozor)\b.{0,130}(?:zamen[a-z]*|zamien[a-z]*|rozlis[a-z]*)\b.{0,95}$/u.test(before);
  const forbiddenMarketingClaim = /(?:marketing|komunikac|text|popis|nabidka|ponuka)\b.{0,45}(?:nesmi|nesmie|nemuze|nemoze)\b.{0,35}(?:tvrdit|uvad[a-z]*|slib[a-z]*|prezent[a-z]*)\b.{0,110}$/u.test(before);
  const labelledInvalid = /(?:vyrok|tvrzen|tvrden|citac)[a-z]*\b.{0,150}$/u.test(before)
    && /^(?:.{0,45}\b(?:neplati|neplatí|je zakazan[a-z]*|je nepravdiv[a-z]*|popis[a-z]*\s+zakazan[a-z]*\s+tvrzen[a-z]*))\b/u.test(after);
  return distinction || forbiddenConfusion || confusionWarning || forbiddenMarketingClaim || labelledInvalid;
}

function credentialClauseBounds(text, targetIndex) {
  const matches = [...text.matchAll(CREDENTIAL_CONTRAST)];
  const preceding = matches.filter(match => Number(match.index || 0) < targetIndex).at(-1);
  const following = matches.find(match => Number(match.index || 0) > targetIndex);
  return {
    start: preceding ? Number(preceding.index || 0) + preceding[0].length : 0,
    end: following ? Number(following.index || 0) : text.length,
  };
}

function credentialTargetIsInformational(clause, targetIndex, targetLength) {
  const before = clause.slice(Math.max(0, targetIndex - 190), targetIndex);
  const after = clause.slice(targetIndex + targetLength, targetIndex + targetLength + 100);
  const explanatory = /(?:informac|material|lekc|tema|diskus|prehled|prehlad|vysvetl|objasn|rozbor|srovnan|porovnan|popis|orientac|pochopen|porozumen|uci|nauci|ukazuje|ukazuje|rozebir|rozober)[a-z]*.{0,75}\b(?:o|ohledne|k|ke|ku|tykajic|jak|ako|kdo|kto|co|kde)\b.{0,80}$/u.test(before);
  const explanatoryNoun = /(?:prehled|prehlad|vysvetlen|objasnen|rozbor|srovnan|porovnan|popis|orientac|pochopen|porozumen|proces|postup)[a-z]*.{0,90}$/u.test(before);
  const applicationSupport = /(?:podpor|pomoc|priprav|sprievod|provaz)[a-z]*.{0,55}(?:samostatn|vlastn)[a-z]*.{0,35}(?:zadost|ziadost|prihlask|aplikac)[a-z]*.{0,55}$/u.test(before)
    || /(?:umozn|pomoz|pomoze|podpor)[a-z]*.{0,55}(?:podat|podat si|podat vlastni|podat samostatnou|podat samostatnu|podat ziadost|poziadat|uchazet se|uchadzat sa).{0,65}$/u.test(before)
    || /(?:mimo.{0,35})?(?:samostatn|vlastn)[a-z]*.{0,35}(?:pozadat|poziadat|podat).{0,55}$/u.test(before);
  const ownExternalApplication = /(?:absolvent|ucastni|student)[a-z]*.{0,55}(?:muze|moze|mohou|mozu).{0,35}(?:pozdeji|neskor|samostatne)?.{0,25}(?:podat|poziadat).{0,25}(?:si\s+)?(?:vlastni|vlastnu|samostatnou|samostatnu).{0,20}(?:zadost|ziadost).{0,30}$/u.test(before);
  const externalPath = /(?:jak|ako).{0,35}(?:ziskat|ziskat|ziskanie|ziskat).{0,55}$/u.test(before)
    && (/\b(?:mimo|extern|samostatn|u icf|od icf|prostrednictvim icf|prostrednictvom icf)\b/u.test(`${before} ${after}`)
      || /\b(?:zadost|ziadost|prihlask|proces|pozadavk|poziadavk)\b/u.test(`${before} ${after}`));
  // A later "and at the same time it grants" is an actual product claim, not
  // an educational explanation of an external credential.
  const reassertsGrant = /\b(?:a zaroven|a sucasne|pritom)\b.{0,60}(?:udel|prizn|poskyt|dav|garant|zajist|zabezpec|vede|zaklad|kvalifik|slib|slub)[a-z]*/u.test(after);
  return (explanatory || explanatoryNoun || applicationSupport || ownExternalApplication || externalPath) && !reassertsGrant;
}

function credentialTargetIsSafelyNegated(clause, targetIndex, targetLength) {
  const before = clause.slice(0, targetIndex);
  const after = clause.slice(targetIndex + targetLength);
  return hasCredentialNegatedPredicate(before, after, clause);
}

function hasCredentialNegatedPredicate(before, after, wholeClause) {
  const nearbyBefore = before.slice(-190);
  const nearbyAfter = after.slice(0, 110);

  // Refusing to promise a future credential negates the whole embedded
  // proposition, not merely the verb "slíbit": "nemůžeme slíbit, že po
  // kurzu získáte ICF akreditaci" is the safe boundary we want to teach.
  if (/\b(?:nemohu|nemuzeme|nemozem|nemozeme|nelze|neda se|neda sa)\s+(?:slibit|slub[it]*)\b.{0,95}$/u.test(nearbyBefore)) {
    return true;
  }

  // A negated modal scopes over the following infinitive even though that
  // infinitive itself is morphologically positive ("nemůžeš používat titul").
  if (/\b(?:nemohu|nemuzes|nemuze|nemuzeme|nemuzete|nemohou|nemozem|nemozes|nemoze|nemozeme|nemozete|nemozu|nesmis|nesmiete)\b.{0,80}\b(?:pouziv[a-z]*|vydav[a-z]*|vystup[a-z]*|pracovat|posobit|koucovat)\b.{0,65}$/u.test(nearbyBefore)) {
    return true;
  }

  // The negative evidentiary verb governs the embedded status proposition:
  // "doklad neprokazuje, že jsi licencovaná" is a truthful boundary.
  if (/\b(?:neprokaz[a-z]*|nepreukaz[a-z]*|nepotvrz[a-z]*|nepotvrdz[a-z]*|nedoklad[a-z]*)\b.{0,100}$/u.test(nearbyBefore)) {
    return true;
  }

  // Contrastive exclusion binds directly to this target even when an earlier
  // positive verb truthfully grants only an internal certificate.
  if (/\b(?:nikoli|nikoliv|bez)\b.{0,24}$/u.test(nearbyBefore)
    || /\bnie\b(?!\s+je\b).{0,18}$/u.test(nearbyBefore)
    || /\bne\b.{0,18}$/u.test(nearbyBefore)) return true;

  // Negative auxiliaries may be separated from the target by an explanatory
  // parenthesis or by a passive participle ("nebude ... přiznána licence").
  const negativeBefore = NEGATED_CREDENTIAL_ACTION.test(nearbyBefore)
    || /\b(?:nikoli|nikoliv|nie|bez)\b.{0,95}$/u.test(nearbyBefore);
  const negativeAfter = NEGATED_CREDENTIAL_ACTION.test(nearbyAfter)
    || /^.{0,75}\b(?:neni|nejsou|nie je|nie su|nebude|nebudou|nikoli|nikoliv|nezisk[a-z]*|neobdrz[a-z]*|nedostan[a-z]*|nenadobud[a-z]*|neudel[a-z]*|neprizn[a-z]*|nevyd[a-z]*)\b/u.test(nearbyAfter);
  if (!negativeBefore && !negativeAfter) return false;
  if (negativeAfter) return true;

  // A later affirmative predicate in the same clause wins over an unrelated
  // earlier negation: "není obyčejný, je ICF akreditovaný" is still a claim.
  const negativeMatches = [...nearbyBefore.matchAll(new RegExp(NEGATED_CREDENTIAL_ACTION.source, 'gu'))];
  const positiveMatches = [...nearbyBefore.matchAll(new RegExp(CREDENTIAL_CONFERRING_ACTION.source, 'gu'))]
    .filter(positive => !negativeMatches.some(negative => {
      const negativeStart = Number(negative.index || 0);
      const negativeEnd = negativeStart + negative[0].length;
      const positiveStart = Number(positive.index || 0);
      return positiveStart >= negativeStart && positiveStart < negativeEnd;
    }));
  const lastNegative = negativeMatches.at(-1);
  const lastPositive = positiveMatches.at(-1);
  if (lastPositive && (!lastNegative || Number(lastPositive.index || 0) > Number(lastNegative.index || 0))) {
    const negativeAuxiliaryWithPassive = lastNegative
      && /^(?:nebude|nebudou|nie je|nie su)$/u.test(lastNegative[0])
      && /^(?:udelen|prizn|vydan)/u.test(lastPositive[0]);
    if (!negativeAuxiliaryWithPassive) return false;
  }
  return negativeBefore || negativeAfter || NEGATED_CREDENTIAL_ACTION.test(wholeClause);
}

function credentialClaimIsExplicitlyRejected(clause, targetIndex, targetLength) {
  const before = clause.slice(Math.max(0, targetIndex - 170), targetIndex);
  const after = clause.slice(targetIndex + targetLength, targetIndex + targetLength + 145);
  const markedBefore = /(?:nepravdiv|nepravd|myln|zavad)\w*.{0,35}(?:tvrzen|tvrden|tvrdit|vyrok|veta|claim)|(?:odmitam|odmietam|vyvracim|popiram).{0,45}(?:tvrzen|tvrden|vyrok|vet)/u.test(before);
  const markedAfter = /(?:tvrzen|tvrden|vyrok|veta|claim)?\w*.{0,45}(?:(?:neni|nie je)\s+(?:pravdiv|spravn|presn|pravd)\w*|je\s+(?:nepravdiv|myln|zavad)\w*)|(?:odmitame|odmietame|vyvracime|popirame).{0,45}(?:tvrzen|tvrden|vyrok|vet)/u.test(after);
  return markedBefore || markedAfter;
}

function credentialClaimIsExplicitlyAffirmed(clause, targetIndex, targetLength) {
  const before = clause.slice(Math.max(0, targetIndex - 170), targetIndex);
  const after = clause.slice(targetIndex + targetLength, targetIndex + targetLength + 145);
  const namesProposition = /(?:tvrzen|tvrden|vyrok|veta|claim)/u.test(before);
  const doubleNegativeAfter = /\b(?:neni|nie je)\s+(?:nepravdiv|myln|zavad)\w*/u.test(after);
  const directlyAffirmedAfter = /\bje\s+(?:pravdiv|spravn|presn)\w*/u.test(after)
    && !/\bnie je\s+(?:pravdiv|spravn|presn)\w*/u.test(after);
  const affirmedAfter = doubleNegativeAfter || directlyAffirmedAfter;
  return namesProposition && affirmedAfter;
}

function lastRegexMatch(value, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...String(value || '').matchAll(new RegExp(pattern.source, flags))].at(-1) || null;
}

function credentialEvidenceForClassification(value) {
  const raw = String(value || '');
  let rejectedQuotationCount = 0;
  const masked = raw.replace(
    /„([^„“”"]{1,280})[“”]|“([^„“”"]{1,280})”|"([^"]{1,280})"|‚([^‚‘’]{1,280})[‘’]|‘([^‘’]{1,280})’|'([^']{1,280})'/gu,
    (full, ...captures) => {
      const offset = Number(captures.at(-2) || 0);
      const before = normalizeCredentialEvidence(raw.slice(Math.max(0, offset - 150), offset));
      const after = normalizeCredentialEvidence(raw.slice(offset + full.length, offset + full.length + 170));
      const rejectedAfter = /^(?:(?:je|to je|bolo by|bylo by)\s+)?(?:nepravdiv|myln|zavad|nespravn)[a-z]*/u.test(after)
        || /^(?:u nas\s+)?(?:neplati|neplati to)\b/u.test(after)
        || /^(?:popis[a-z]*|opis[a-z]*|predstav[a-z]*)\b.{0,55}\b(?:zakazan|nepripustn)[a-z]*\s+(?:tvrzen|tvrden)[a-z]*/u.test(after)
        || /^(?:uvad[a-z]*|uvadz[a-z]*|hovor[a-z]*|rik[a-z]*|tvrdi[a-z]*)\b.{0,55}\b(?:nepravd|myln|zavad)[a-z]*/u.test(after);
      const rejectedBefore = /(?:nepravdiv|myln|zavad|nespravn)[a-z]*.{0,45}(?:tvrzen|tvrden|vyrok|claim)[a-z]*.{0,20}$/u.test(before);
      if (!rejectedAfter && !rejectedBefore) return full;
      rejectedQuotationCount += 1;
      return ' '.repeat(full.length);
    },
  );
  return {
    text: normalizeCredentialEvidence(masked),
    rejectedQuotationCount,
  };
}

function normalizeCredentialEvidence(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/[.!?;]+/gu, ' clauseboundary ')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Finds an observable affirmative act that relates consequences to available
 * options. The evidence gate is deliberately positive and fail-closed: noun
 * overlap alone never proves that mapping happened. This makes an unlimited
 * family of omissions fail even when their particular verb is novel.
 */
function findAffirmativeConsequencesMappingIndex(value) {
  const text = String(value || '');
  const impactPattern = new RegExp(`\\b${CONSEQUENCE_IMPACT}\\b`, 'u');
  const optionsPattern = new RegExp(`\\b${CONSEQUENCE_OPTIONS}\\b`, 'u');
  const mentionsImpact = impactPattern.test(text);
  const mentionsOptions = optionsPattern.test(text);
  if (!mentionsImpact || !mentionsOptions) return -1;

  // Refusing omission and postponing a decision until both domains are
  // examined are affirmative mapping commitments despite surface negation.
  const refusesToOmitBoth = new RegExp(`(?:\\b(?:nenech[a-z]*|nemuzeme|nemozeme|nemohu|nemozem)\\b.{0,35}(?:stranou|bokem|bokom|ignor[a-z]*)).{0,90}\\b${CONSEQUENCE_IMPACT}\\b.{0,90}\\b${CONSEQUENCE_OPTIONS}\\b|(?:\\b(?:nenech[a-z]*|nemuzeme|nemozeme|nemohu|nemozem)\\b.{0,35}(?:stranou|bokem|bokom|ignor[a-z]*)).{0,90}\\b${CONSEQUENCE_OPTIONS}\\b.{0,90}\\b${CONSEQUENCE_IMPACT}\\b`, 'u').exec(text);
  if (refusesToOmitBoth) return Number(refusesToOmitBoth.index || 0) + 1;
  const explicitlyKeepsBoth = new RegExp(`(?:\\b(?:nechci|nechceme|nechcem|nebudu|nebudeme|nebudem|nemuzeme|nemozeme)\\b.{0,35}\\b${CONSEQUENCE_OMISSION_ACTION}\\b|\\b(?:nevynech|nepreskoc|neignor|nepomin|neopomen)[a-z]*\\b).{0,100}(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b)`, 'u').exec(text);
  if (explicitlyKeepsBoth) return Number(explicitlyKeepsBoth.index || 0) + 1;
  const leavesNeitherUnseen = new RegExp(`\\bnenech[a-z]*\\b.{0,100}(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b).{0,45}\\bbez\\s+povsimnut[a-z]*\\b|(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b).{0,45}\\bnenech[a-z]*\\b.{0,35}\\bbez\\s+povsimnut[a-z]*\\b`, 'u').exec(text);
  if (leavesNeitherUnseen) return Number(leavesNeitherUnseen.index || 0) + 1;
  const waitsForBoth = new RegExp(`\\b(?:dokud|kym)\\b.{0,24}\\b${NEGATED_CONSEQUENCE_MAPPING_ACTION}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b|\\b(?:dokud|kym)\\b.{0,24}\\b${NEGATED_CONSEQUENCE_MAPPING_ACTION}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b`, 'u').exec(text);
  if (waitsForBoth) return Number(waitsForBoth.index || 0) + 1;
  const comparesBeforeDecision = new RegExp(`\\b(?:az|až)\\s+po\\s+(?:srovnan|porovnan|zmapovan|probrani|preskumani)[a-z]*\\b.{0,100}(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b)`, 'u').exec(text);
  if (comparesBeforeDecision) return Number(comparesBeforeDecision.index || 0) + 1;
  const sameAnalysis = new RegExp(`(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b).{0,55}\\b(?:patri|patria)\\b.{0,28}\\b(?:stejn[a-z]*|rovnak[a-z]*)\\b.{0,18}\\b(?:rozbor|analyz)[a-z]*\\b`, 'u').exec(text);
  if (sameAnalysis) return Number(sameAnalysis.index || 0) + 1;
  const notOnlyButAlso = new RegExp(`\\b(?:pozr[a-z]*|podiv[a-z]*)\\b.{0,25}\\b(?:nejen|nielen)\\b.{0,70}\\b${CONSEQUENCE_IMPACT}\\b.{0,70}\\b(?:ale|no)\\s+(?:i|aj)\\b.{0,70}\\b${CONSEQUENCE_OPTIONS}\\b`, 'u').exec(text);
  if (notOnlyButAlso) return Number(notOnlyButAlso.index || 0) + 1;

  // "Not separately from the alternatives" is an affirmative commitment to
  // joint mapping even though its surface grammar contains a negated verb.
  const jointMapping = /\b(?:nebudu|nebudem|nebudeme|nechci|nechceme|nechcem|nehodlam|nemienim)\b.{0,35}\b(?:map|porovn|zvaz|zkoum|skum|posuz|posudz|vyhodnoc)[a-z]*\b.{0,35}\b(?:oddelene|izolovane)\b.{0,22}\b(?:od|bez)\b.{0,30}(?:variant|moznost|alternativ)/u.exec(text);
  if (jointMapping) return jointMapping.index + 1;

  // A concrete overview is itself an observable mapping act. Keep this as a
  // literal grammar rather than relying on the broader action alternation:
  // it preserves common CZ/SK phrasing such as "vytvoříme přehled nákladů a
  // možných řešení" while still requiring both semantic domains nearby.
  const createsOverview = /\b(?:vytvor|udel|urob|sestav|priprav|sprac)[a-z]*\s+(?:si\s+)?(?:prehled|prehlad)[a-z]*\b/gu;
  for (const match of text.matchAll(createsOverview)) {
    const index = Number(match.index || 0);
    const { start, end } = consequenceSemanticClauseBounds(text, index);
    const clause = text.slice(start, end);
    const before = clause.slice(0, index - start);
    const refused = new RegExp(`\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b.{0,40}$`, 'u').test(before)
      || /(?:^|\s)(?:ne|nikoli|nikoliv|bez)\b\s*.{0,12}$/u.test(before);
    if (!refused && impactPattern.test(clause) && optionsPattern.test(clause)) return index;
  }

  const actionPattern = new RegExp(`\\b${CONSEQUENCE_MAPPING_ACTION}\\b`, 'gu');
  for (const match of text.matchAll(actionPattern)) {
    const index = Number(match.index || 0);
    const { start, end } = consequenceSemanticClauseBounds(text, index);
    const clause = text.slice(start, end);
    const localIndex = index - start;
    const before = clause.slice(0, localIndex);
    const after = clause.slice(localIndex + match[0].length);
    const refusalBefore = new RegExp(`\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b.{0,40}$`, 'u').test(before);
    const refusalAfter = new RegExp(`^.{0,35}\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b`, 'u').test(after);
    const explicitNegation = /(?:^|\s)(?:ne|nikoli|nikoliv|bez)\b\s*.{0,12}$/u.test(before);
    const withoutDoingIt = /\bbez\s+toho[\s,]+(?:aby(?:chom|ch)?|aby\s+sme)\s*$/u.test(before);
    if (refusalBefore || refusalAfter || explicitNegation || withoutDoingIt) continue;

    // At least one mapped object must be present in this semantic clause. The
    // companion object may be established immediately before it ("dopady …;
    // porovnáme je s alternativami"), but an unrelated action elsewhere in
    // the turn cannot manufacture evidence.
    const priorClause = text.slice(Math.max(0, start - 120), start);
    const bridgesPriorImpact = optionsPattern.test(clause)
      && /\b(?:je|ich|obe|oboji|oboje|i|aj)\b/u.test(clause)
      && impactPattern.test(priorClause);
    const bridgesPriorOptions = impactPattern.test(clause)
      && /\b(?:je|ich|obe|oboji|oboje|i|aj)\b/u.test(clause)
      && optionsPattern.test(priorClause);
    const bridgesPriorBoth = /\b(?:je|ich|obe|oboji|oboje|i|aj)\b/u.test(clause)
      && impactPattern.test(priorClause)
      && optionsPattern.test(priorClause);
    if ((impactPattern.test(clause) && optionsPattern.test(clause))
      || bridgesPriorImpact
      || bridgesPriorOptions
      || bridgesPriorBoth) {
      return index;
    }
  }
  return -1;
}

function consequenceSemanticClauseBounds(value, actionIndex) {
  const text = String(value || '');
  const boundary = /[.;!?]|,\s*(?=(?:aniz|ale|avsak|no|nicmene|pritom)\b)|\b(?:ale|avsak|nicmene|pritom)\b/gu;
  let start = 0;
  let end = text.length;
  for (const match of text.matchAll(boundary)) {
    const index = Number(match.index || 0);
    if (index < actionIndex) {
      start = index + match[0].length;
      continue;
    }
    end = index;
    break;
  }
  return { start, end };
}

export function mentionsConsequencesAndOptions(value) {
  const text = normalizeConsequenceEvidence(value);
  return new RegExp(`\\b${CONSEQUENCE_IMPACT}\\b`, 'u').test(text)
    && new RegExp(`\\b${CONSEQUENCE_OPTIONS}\\b`, 'u').test(text);
}

export function hasConsequencesMappingContradiction(value) {
  value = normalizeConsequenceEvidence(value);
  const mentionsImpact = new RegExp(`\\b${CONSEQUENCE_IMPACT}\\b`, 'u').test(value);
  const mentionsOptions = new RegExp(`\\b${CONSEQUENCE_OPTIONS}\\b`, 'u').test(value);
  if (!mentionsImpact || !mentionsOptions) return false;

  const auxiliaryBefore = new RegExp(`\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b.{0,40}\\b${CONSEQUENCE_MAPPING_ACTION}\\b`, 'u');
  const auxiliaryAfter = new RegExp(`\\b${CONSEQUENCE_MAPPING_ACTION}\\b.{0,40}\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b`, 'u');
  const fusedNegation = new RegExp(`\\b${NEGATED_CONSEQUENCE_MAPPING_ACTION}\\b`, 'u');
  const contradiction = auxiliaryBefore.exec(value)
    || auxiliaryAfter.exec(value)
    || fusedNegation.exec(value);
  const leavesWithoutMapping = new RegExp(`\\b(?:nechame|ponechame|zanechame)\\b.{0,35}\\b(?:bez|stranou|bokem)\\b.{0,32}\\b${CONSEQUENCE_MAPPING_ACTION}\\b|\\b(?:bez|stranou|bokem)\\b.{0,32}\\b${CONSEQUENCE_MAPPING_ACTION}\\b.{0,35}\\b(?:nechame|ponechame|zanechame)\\b`, 'u').exec(value);
  const explicitlySkipsMapping = new RegExp(`\\b${CONSEQUENCE_OMISSION_ACTION}\\b`, 'u').exec(value);
  const explicitlyAvoidsMapping = /\b(?:vyhneme|vyhybame|vyhnu)\b(?:\s+(?:se|sa))?|\b(?:se|sa)\s+(?:vyhneme|vyhybame|vyhnu)\b/u.exec(value);
  const decidesWithoutMapping = new RegExp(`\\b(?:rozhodn[a-z]*|zvol[a-z]*|vyber[a-z]*)\\b.{0,55}\\bbez\\s+toho[\\s,]+(?:aby(?:chom|ch)?|aby\\s+sme)\\s*\\b${CONSEQUENCE_MAPPING_ACTION}\\b`, 'u').exec(value);
  const leavesUnexamined = /\b(?:nechame|ponechame|zanechame)\b.{0,32}\bbez\s+(?:povsimnuti|povsimnutia|prozkoumani|preskumania|porovnani)\b/u.exec(value);
  const leavesDomainAside = new RegExp(`(?:\\b${CONSEQUENCE_IMPACT}\\b|\\b${CONSEQUENCE_OPTIONS}\\b).{0,45}\\b(?:nechame|ponechame|zanechame)\\b.{0,24}\\b(?:stranou|bokem|bokom)\\b`, 'u').exec(value);
  const dismissesBothDomains = /\b(?:hod[a-z]*\s+za\s+hlavu|pust[a-z]*\s+z\s+hlavy|netreba|neni\s+(?:nutne|treba|potreb[a-z]*|podstatn[a-z]*|dulezit[a-z]*)|nie\s+je\s+(?:nutne|treba|potreb[a-z]*|podstatn[a-z]*|dolezit[a-z]*)|(?:je|su|jsou)\s+(?:zbytecn[a-z]*|zbytocn[a-z]*|vedlejsi|vedlaj[a-z]*|druhorad[a-z]*|nepodstatn[a-z]*)|nemus[a-z]*\s+(?:otevirat|otvarat)|nebud[a-z]*\s+(?:ztracet|stracat)\s+cas|nema\s+(?:cenu|zmysel)|odpust[a-z]*\s+si|si\s+odpust[a-z]*|nevsi[a-z]*\s+si|nevsim[a-z]*\s+si|bez\s+ohledu|bez\s+ohladu|nezabyv[a-z]*\s+(?:se|sa)|nezaober[a-z]*\s+(?:se|sa)|neres[a-z]*|neries[a-z]*|vynech[a-z]*|preskoc[a-z]*|odrizn[a-z]*|odrez[a-z]*)\b/u.exec(value);
  const refusesReturn = /\b(?:vracet|vratit|vracat|vratit\s+sa)\b.{0,25}\b(?:nebud[a-z]*|nemus[a-z]*)\b|\b(?:nebud[a-z]*|nemus[a-z]*)\b.{0,25}\b(?:vracet|vratit|vracat|vratit\s+sa)\b/u.exec(value);
  const excludesFromDecision = /\b(?:do\s+(?:uvahy|rozhodnut[a-z]*|rozhodovania)\s+(?:(?:je|ich)\s+)?(?:nevezm[a-z]*|netah[a-z]*)|do\s+(?:uvahy|rozhodnut[a-z]*|rozhodovania)\s+(?:tahat|brat|zahrnat)\s+nebud[a-z]*|bez\s+(?:srovnan|porovnan|zohlednen|preskuman|rozbor|pohled|pohlad)[a-z]*)\b/u.exec(value);
  const tellsClientNotToBringEitherDomain = new RegExp(`(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,70}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,70}\\b${CONSEQUENCE_IMPACT}\\b).{0,45}\\bnetah[a-z]*\\b|\\bnetah[a-z]*\\b.{0,45}(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,70}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,70}\\b${CONSEQUENCE_IMPACT}\\b)`, 'u').exec(value);
  const harmfulOmission = leavesWithoutMapping
    || explicitlySkipsMapping
    || explicitlyAvoidsMapping
    || decidesWithoutMapping
    || leavesUnexamined
    || leavesDomainAside
    || dismissesBothDomains
    || refusesReturn
    || excludesFromDecision
    || tellsClientNotToBringEitherDomain;
  if (!contradiction && !harmfulOmission) return false;

  const contradictionIndex = contradiction?.index ?? harmfulOmission?.index ?? 0;
  const affirmativeIndex = findAffirmativeConsequencesMappingIndex(value);

  // A mapping verb governed by a dismissive construction is not a repair:
  // "nemá cenu probírat..." and "porovnání si odpustíme" explicitly reject
  // the work even though they contain the same verb/noun as good evidence.
  const scopedDismissal = new RegExp(`(?:\\b(?:nema\\s+(?:cenu|zmysel)|nebud[a-z]*\\s+(?:ztracet|stracat)\\s+cas)\\b.{0,45}\\b${CONSEQUENCE_MAPPING_ACTION}\\b|\\b(?:srovnan|porovnan|mapovan|rozbor)[a-z]*\\b.{0,45}\\bsi\\s+odpust[a-z]*\\b)`, 'u');
  if (scopedDismissal.test(value)) return true;

  // Preserve a real double negation ("nebudeme neporovnávat") and an explicit
  // denial of the harmful assertion. Both say that comparison will happen.
  const doubleNegationBefore = new RegExp(`\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b.{0,32}\\b${NEGATED_CONSEQUENCE_MAPPING_ACTION}\\b`, 'u');
  const doubleNegationAfter = new RegExp(`\\b${NEGATED_CONSEQUENCE_MAPPING_ACTION}\\b.{0,32}\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b`, 'u');
  if (doubleNegationBefore.test(value) || doubleNegationAfter.test(value)) return false;
  // Refusing to omit/ignore the mapping is another genuine double negative:
  // "nechci pominout dopady" commits to considering them.
  const refusesOmission = new RegExp(`\\b${CONSEQUENCE_MAPPING_REFUSAL}\\b.{0,35}\\b${CONSEQUENCE_OMISSION_ACTION}\\b`, 'u');
  if (refusesOmission.test(value)) return false;
  // "Rozhodnutí odložíme, dokud/kým neprobereme..." is a condition that
  // requires mapping before action, not a refusal to map. Both domains must
  // occur inside the same conditional scope.
  const waitsUntilMapped = new RegExp(`\\b(?:dokud|kym)\\b.{0,24}\\b${NEGATED_CONSEQUENCE_MAPPING_ACTION}\\b.{0,100}(?:\\b${CONSEQUENCE_IMPACT}\\b.{0,100}\\b${CONSEQUENCE_OPTIONS}\\b|\\b${CONSEQUENCE_OPTIONS}\\b.{0,100}\\b${CONSEQUENCE_IMPACT}\\b)`, 'u');
  if (waitsUntilMapped.test(value)) return false;
  // A syntactic denial of avoidance is affirmative: "nejsou něco, čemu se
  // vyhneme" explicitly says the consequences and options will not be
  // avoided. Likewise "stranou dojmy, nikoli porovnání" scopes "stranou" to
  // a different object.
  if (/\b(?:nejsou|nie su)\b.{0,45}\b(?:cemu|comu)\s+(?:se|sa)\s+(?:vyhneme|vyhybame)\b/u.test(value)
    || /\b(?:nechame|ponechame|zanechame)\b.{0,32}\bstranou\b.{0,35}\b(?:dojm|pocit)[a-z]*\b.{0,25}\b(?:nikoli|nikoliv|nie)\b.{0,35}\b(?:porovnan|mapovan|zkouman|skuman)/u.test(value)) return false;
  // A later explicit affirmative comparison repairs an initially rejected
  // isolated proposal. The reverse order remains contradictory.
  if (affirmativeIndex > contradictionIndex) return false;
  const prefix = value.slice(Math.max(0, contradictionIndex - 80), contradictionIndex);
  if (/(?:neni pravda|nie je pravda|netvrdim|netvrdime|nehovorim|nerikam).{0,55}$/u.test(prefix)) return false;

  // Do not turn "not only X, but also Y" into a rejection merely because it
  // starts with a negative auxiliary.
  const inclusiveContrastAfterAction = new RegExp(`${CONSEQUENCE_MAPPING_REFUSAL}.{0,32}${CONSEQUENCE_MAPPING_ACTION}.{0,40}\\b(?:jen|len|pouze|iba)\\b.{0,65}\\b(?:ale|no)\\b.{0,35}\\b(?:i|aj|take|tiez)\\b`, 'u');
  const inclusiveContrastBeforeAction = new RegExp(`${CONSEQUENCE_MAPPING_REFUSAL}.{0,18}\\b(?:jen|len|pouze|iba)\\b.{0,24}${CONSEQUENCE_MAPPING_ACTION}.{0,80}\\b(?:ale|no)\\b.{0,35}\\b(?:i|aj|take|tiez)\\b`, 'u');
  const refusesSingleSidedMapping = new RegExp(`${CONSEQUENCE_MAPPING_REFUSAL}.{0,32}${CONSEQUENCE_MAPPING_ACTION}.{0,70}\\b(?:bez|aniz|bez toho aby)\\b.{0,45}(?:zohlednen|zahrnut|porovnan|variant|moznost|alternativ)`, 'u');
  if (inclusiveContrastAfterAction.test(value)
    || inclusiveContrastBeforeAction.test(value)
    || refusesSingleSidedMapping.test(value)) return false;

  // "Not mapping would be irresponsible" rejects the harmful action rather
  // than performing it and therefore must remain valid evidence polarity.
  const condemnsOmission = new RegExp(`\\b${NEGATED_CONSEQUENCE_MAPPING_ACTION}\\b.{0,100}\\b(?:by bylo|by bola|by bolo|je|bolo by)\\b.{0,35}(?:nezodpovedn|chyb|spatn|nesprav|rizikov|nebezpecn)`, 'u');
  const condemnsExplicitOmission = new RegExp(`\\b(?:bylo by|bola by|bolo by|je)\\b.{0,30}(?:chyb|spatn|nesprav|nezodpovedn|rizikov|nebezpecn).{0,35}\\b${CONSEQUENCE_OMISSION_ACTION}\\b`, 'u');
  if (condemnsOmission.test(value) || condemnsExplicitOmission.test(value)) return false;

  return true;
}

function result(relevant, entry, reason) {
  return Object.freeze({
    relevant,
    competencyId: entry?.competencyId || null,
    evidenceRuleId: entry?.evidenceRuleId || null,
    confidence: relevant ? 'criterion-specific' : 'none',
    reason: relevant ? null : reason,
  });
}
