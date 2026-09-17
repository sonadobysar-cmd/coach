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
];

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
  const previous = normalizeEvidence(input.previousCounterpartText);
  const next = normalizeEvidence(input.nextCounterpartText);
  if (!quote || quote.split(' ').length < 3) return result(false, entry, 'evidence_too_short');
  if (NEGATIVE_SAFETY_PATTERNS.some(pattern => pattern.test(quote))) {
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
  if (!/^(?:co|c[oô]|jak|ako|ktery|který|ktory|ktorý|jaky|jaký|aky|aký|kdy|kedy|podle ceho|podľa čoho|v cem|v čem|v com|v čom|mohu|mozem|môžem|muzeme|můžeme)/u.test(quote)) return false;
  if (/(?:svoleni|svolení|souhlas|suhlas|súhlas|citlivejsi|citlivější|hloubk|hĺbk)/u.test(criterion)) {
    return /(?:mohu|mozem|môžem|je v poradku|je v pořádku|je v poriadku|souhlasis|souhlasíš|suhlasis|súhlasíš)/u.test(quote);
  }
  return meaningfulOverlap(quote, previous) >= 1;
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
  return method && purpose && choice && (meaningfulOverlap(quote, previous) >= 1 || !previous);
}

function autonomyEvidence(criterion, quote, previous) {
  const priorRefusal = /(?:nechci|nechcem|odmitam|odmítám|odmietam|nesedi|nesedí|zastav|nebudu|nebudem)/u.test(previous);
  const stops = /(?:beru|respektuji|respektujem|zastavime|zastavíme|nebudu|nebudem|nebudeme|stahuji|sťahujem|otazku stahnu|otázku stáhnu)/u.test(quote);
  const restoresChoice = /(?:volba|tempo|smer|směr|rozhodnuti|rozhodnutí|rozhodnutie).{0,35}(?:je|zustava|zůstává|zostava|zostáva).{0,20}(?:na tobe|na tebe|na vas|na vás)/u.test(quote)
    || /(?:co|jak|ako|kam|kde|ktery|který|ktory|ktorý).{0,55}(?:chces|chceš|chcete|chtela|chtěla|chtel|chtěl|volis|volíš|volite|volíte|pokracovat|pokračovat|uzavrit|uzavřít|ukoncit|ukončit|stocit|stočit)/u.test(quote)
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
  const correction = /(?:to jsem nerekl|to jsem neřekl|to jsem nerekla|to jsem neřekla|to som nepovedal|to som nepovedala|neposlouch|nepočúv|nesedi|nesedí|o radu jsem nezadal|o radu jsem nežádal|o radu som neziadal|rozhodnuti za me|rozhodnutí za mě)/u.test(previous);
  const ownsError = /(?:mate pravdu|máte pravdu|mas pravdu|máš pravdu|dakujem za oprav|děkuji za oprav|omlouvam se|omlouvám se|ospravedlnujem sa|vlozila jsem|vložila jsem|domyslela jsem|pridala jsem|přidala jsem|to byla moje interpretace|to bola moja interpretacia|prevzala jsem|převzala jsem)/u.test(quote);
  const defense = /(?:ale|avsak|avšak|jenze|jenže).{0,40}(?:mela jsem pravdu|měla jsem pravdu|moja interpretacia bola spravna|moje interpretace byla spravna)/u.test(quote);
  if (/(?:dopad na alianci je uznan|dopad na alianci je uznán)/u.test(criterion)) {
    const namesImpact = /(?:mrzi ma|mrzí ma|mrzi me|mrzí mě|omlouvam se|omlouvám se|ospravedlnujem sa)/u.test(quote)
      && /(?:pocit|pocit|nepocuv|nepočúv|neposlouch|alianc|spoluprac)/u.test(quote);
    return namesImpact && !defense;
  }
  if (!correction || !ownsError || defense) return false;
  if (/(?:potvrzuje opraveny dalsi tah|potvrzuje opravený další tah|navazani az po|navázání až po)/u.test(criterion)) {
    return /(?:ano|jo|dobre|dobře|plati|platí|sedi|sedí|presne|přesně|chci|pojdme|pojďme)/u.test(next)
      && !/(?:ale.*ne|nechci|nesedi|nesedí)/u.test(next);
  }
  if (/(?:nevyzadanou radu|nevyžádanou radu)/u.test(criterion)) {
    return /(?:rada|radu|rozhodnuti|rozhodnutí)/u.test(quote);
  }
  return true;
}

function ethicalBoundaryEvidence(criterion, quote, previous) {
  if (/(?:garance|garanci|prijmu|příjmu|povyseni|povýšení|vysledkove garance|výsledkové garance)/u.test(criterion)) {
    return /(?:nemohu|nemozem|nemôžem|nelze|neda se|nedá sa).{0,40}(?:garantovat|zarucit|zaručit)/u.test(quote)
      && /(?:proces|postup|krok|spoluprac|ovlivn|ovplyvn)/u.test(quote);
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
  const clientChoice = /(?:co|jaky|jaký|aky|aký|ktery|který|ktory|ktorý).{0,35}(?:krok|moznost|možnost).{0,30}(?:volis|volíš|volite|volíte|vyberas|vybíráš|zvolis|zvolíš|zvolite|zvolíte)/u.test(quote)
    || /(?:co presne|co přesně|co konkretne|co konkrétně).{0,25}(?:udelas|uděláš|udelate|uděláte|urobis|urobíš|urobite|urobíte)/u.test(quote);
  const timing = /(?:do kdy|dokdy|kdy|kedy|dnes|zittra|zítra|zajtra|termin|termín)/u.test(quote);
  const verify = /(?:podle ceho|podle čeho|podľa coho|podľa čoho|jak poznas|jak poznáš|jak poznate|jak poznáte|ako spoznas|ako spoznáš|ako spoznate|ako spoznáte|vyhodnot|over|ověř|zmer|změř)/u.test(quote);
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
    return /(?:oddel|odděl|rozlis|rozliš|fakt|data|dusled|důsled|moznost|možnost|vliv|spoustec|spouštěč)/u.test(quote)
      && meaningfulTokenOverlap(criterion, quote) >= 1;
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

function result(relevant, entry, reason) {
  return Object.freeze({
    relevant,
    competencyId: entry?.competencyId || null,
    evidenceRuleId: entry?.evidenceRuleId || null,
    confidence: relevant ? 'criterion-specific' : 'none',
    reason: relevant ? null : reason,
  });
}
