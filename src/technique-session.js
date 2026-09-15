import { requestsOneShortQuestion } from './conversation-repair-intent.js';

const PHASES = new Set(['assessment', 'consent', 'application', 'evaluation', 'integration', 'completed', 'stopped']);
const ACTIVE_PHASES = new Set(['assessment', 'consent', 'application', 'evaluation', 'integration']);
const CONSENT_FAMILIES = new Set([
  'trauma_informed_support',
  'mindfulness',
  'relaxation',
]);

const BUILTIN_TECHNIQUE_STEPS = Object.freeze({
  t_grow: ['Vymez téma a žádoucí výsledek rozhovoru.', 'Ujasni konkrétní cíl.', 'Prozkoumej současnou realitu.', 'Vytvoř možnosti.', 'Nech členku dobrovolně zvolit další krok.'],
  exception_questions: ['Najdi konkrétní chvíli, kdy byl problém menší nebo chyběl.', 'Zmapuj podmínky této výjimky a vyber jednu část, kterou lze bezpečně zopakovat.'],
  scaling_question: ['Nech členku zvolit číslo a popsat, co toto číslo konkrétně znamená.', 'Zeptej se, co by byl jeden realistický a pozorovatelný posun.'],
  decisional_balance: ['Zmapuj krátkodobé přínosy možnosti.', 'Zmapuj krátkodobé náklady možnosti.', 'Zmapuj dlouhodobé přínosy možnosti.', 'Zmapuj dlouhodobé náklady možnosti a nech závěr na člence.'],
  socratic_questions: ['Zkoumej přímé důkazy pro a proti dané myšlence.', 'Hledej alespoň jedno jiné možné vysvětlení.', 'Ověř dopad a užitečnost současné formulace.', 'Nech členku vytvořit přesnější formulaci, která zůstává pravdivá.'],
  cognitive_distortion_check: ['Nabídni možné zkreslení pouze jako hypotézu k ověření.', 'Prověř, co hypotézu podporuje a co jí odporuje.', 'Nech členku vytvořit přesnější, stále pravdivý pohled.'],
  graded_task: ['Rozděl cíl na nejmenší bezpečnou a zvládnutelnou část.', 'Po jejím provedení ověř skutečnou kapacitu a podle výsledku uprav další velikost kroku.'],
  act_choice_point: ['Rozliš konkrétní jednání, které členku vzdaluje od jejích hodnot.', 'Vyber malý proveditelný krok, který ji k hodnotám přibližuje.'],
  dbt_wise_mind: ['Nech zaznít emocionální pohled bez jeho shazování.', 'Nech zaznít racionální pohled bez potlačení emocí.', 'Hledej integrované rozhodnutí, které respektuje oba zdroje informace.'],
  emotion_labeling: ['Nabídni několik názvů emoce pouze jako hypotézy.', 'Nech členku opravit nebo zvolit vlastní přesné pojmenování a ověř, co se tím mění.'],
  boundary_script: ['Ujasni, co přesně je dostupné.', 'Ujasni, co dostupné není.', 'Stanov, od kdy hranice platí.', 'Formuluj stručnou alternativu bez obhajování a nátlaku.'],
  constraint_focus: ['Najdi největší současné omezení toku klientů, dodání nebo peněz.', 'Vyber jedinou změnu zaměřenou právě na toto omezení a po pokusu znovu změř tok.'],
  jobs_to_be_done: ['Zkoumej konkrétní situaci, ve které zákaznice hledá řešení.', 'Zkoumej žádoucí pokrok z jejího pohledu.', 'Zmapuj bariéry tohoto pokroku.', 'Porovnej současné alternativy, které už zákaznice používá.'],
  batna: ['Ujasni nejlepší realistickou alternativu pro případ, že dohoda nevznikne.', 'Z této alternativy a skutečných podmínek odvoď hranici přijetí.'],
  ooda: ['Pozoruj nová data bez předčasného závěru.', 'Zorientuj se v jejich významu a omezeních.', 'Rozhodni o jednom tahu.', 'Proveď tento tah.', 'Podle výsledku cyklus znovu aktualizuj.'],
  meta_budget_guardrail: ['Urči částku, jejíž ztráta je skutečně únosná.', 'Zkontroluj jednotkovou ekonomiku a rozhodující předpoklad kampaně.', 'Stanov nejmenší vzorek, který ještě přinese použitelné učení.', 'Předem nastav pravidla pokračovat, upravit nebo zastavit.'],
  meta_tracking_readiness: ['Ověř správnou obchodní událost.', 'Ověř zdroj a úplnost dat.', 'Proveď testovací konverzi.', 'Zkontroluj návaznost na CRM nebo objednávku.', 'Ověř, že lze odlišit výsledek Meta reklamy od ostatních kanálů.'],
});

export function createTechniqueTurn({
  atlas = [],
  candidates = [],
  previous = null,
  mode = 'diagnostika',
  latestText = '',
  conversationContext = {},
  previousAssistantText = '',
} = {}) {
  const byId = new Map(atlas.map(card => [card.id, card]));
  const safePrevious = sanitizeTechniqueSession(previous, byId);
  const stopIntent = classifyStopIntent(latestText);
  const explicitStop = stopIntent === 'conversation_stop';
  const explicitTechniqueStop = stopIntent === 'technique_stop';
  const ambiguousOrExternalStop = ['external_or_ambiguous', 'external_stop'].includes(stopIntent);
  const explicitNoEffect = reportsNoEffect(latestText);
  const explicitRepair = isConversationRepairRequest(latestText);
  const explicitRestart = wantsAnotherTechnique(latestText);
  const consentDeclined = safePrevious?.phase === 'consent' && declinesConsent(latestText);
  const noEffectFeedback = explicitNoEffect && safePrevious
    && ['application', 'evaluation'].includes(safePrevious.phase);
  // Meta-komunikace a nejasné „nechci pokračovat“ nesmějí být vyloženy
  // jako další krok techniky. Stav ale nezahazujeme: je pouze pozastavený,
  // aby oprava porozumění nemohla techniku skrytě posunout ani restartovat.
  if (explicitRepair || (ambiguousOrExternalStop && !consentDeclined)) {
    const card = safePrevious ? byId.get(safePrevious.techniqueId) : null;
    return {
      card,
      session: safePrevious,
      steps: deriveTechniqueSteps(card),
      suspended: true,
      suspensionReason: stopIntent === 'external_stop'
        ? 'external_stop'
        : explicitRepair
          ? 'conversation_repair'
          : 'ambiguous_stop',
    };
  }

  if (explicitStop && !safePrevious) {
    return {
      card: null,
      session: null,
      steps: [],
      suspended: true,
      suspensionReason: 'conversation_stop',
    };
  }

  if (explicitTechniqueStop && !safePrevious) {
    return {
      card: null,
      session: null,
      steps: [],
      suspended: true,
      suspensionReason: 'technique_stop',
    };
  }

  if (consentDeclined) {
    const card = byId.get(safePrevious.techniqueId);
    return {
      card,
      steps: deriveTechniqueSteps(card),
      session: {
        ...safePrevious,
        phase: 'stopped',
        status: 'stopped',
        stopReason: 'consent_declined',
        turns: safePrevious.turns + 1,
      },
    };
  }

  // Po zastavení už starý stav nesmí v dalším tahu znovu rozběhnout techniku.
  if (safePrevious?.phase === 'stopped' && !explicitStop) {
    return { card: null, session: null, steps: [] };
  }

  // Pokud členka neodpověděla na měření účinku, otázku neopakujeme a stav
  // nemažeme. Viditelný tah se věnuje jejímu sdělení; technika může navázat
  // teprve po obnovení společného směru.
  if (safePrevious?.phase === 'evaluation'
    && !explicitTechniqueStop
    && !explicitNoEffect
    && !reportsEffect(latestText)
    && !reportsWorse(latestText)) {
    const card = byId.get(safePrevious.techniqueId);
    return {
      card,
      session: safePrevious,
      steps: deriveTechniqueSteps(card),
      suspended: true,
      suspensionReason: 'evaluation_not_answered',
    };
  }

  if (safePrevious && ACTIVE_PHASES.has(safePrevious.phase)
    && !explicitStop && !explicitTechniqueStop && !noEffectFeedback && !explicitRestart) {
    const card = byId.get(safePrevious.techniqueId);
    const session = advanceSession(safePrevious, card, latestText, conversationContext, previousAssistantText);
    return { card, session, steps: deriveTechniqueSteps(card) };
  }

  if (explicitStop && safePrevious) {
    const card = byId.get(safePrevious.techniqueId);
    return {
      card,
      steps: deriveTechniqueSteps(card),
      session: {
        ...safePrevious,
        phase: 'stopped',
        status: 'stopped',
        stopReason: 'user_stop',
        turns: safePrevious.turns + 1,
      },
    };
  }

  if (explicitTechniqueStop && safePrevious) {
    const card = byId.get(safePrevious.techniqueId);
    return {
      card,
      steps: deriveTechniqueSteps(card),
      session: {
        ...safePrevious,
        phase: 'stopped',
        status: 'stopped',
        stopReason: 'technique_stop',
        turns: safePrevious.turns + 1,
      },
    };
  }

  if (noEffectFeedback && safePrevious) {
    const card = byId.get(safePrevious.techniqueId);
    const steps = deriveTechniqueSteps(card);
    const session = adaptAfterFeedback(
      safePrevious,
      steps,
      'no_effect',
    );
    return { card, session, steps };
  }

  const card = candidates.find(candidate => candidate?.access_level !== 'human_only') || null;
  if (!card) return { card: null, session: null, steps: [] };
  return {
    card,
    steps: deriveTechniqueSteps(card),
    session: {
      techniqueId: card.id,
      mode,
      // Běžná koučovací metoda může začít svým prvním užitečným krokem.
      // Samostatné čekání na souhlas zachováváme jen pro imaginaci, práci
      // s tělem, dechem, vzpomínkou a další citlivé zkušenostní postupy.
      phase: requiresExplicitConsent(card) ? 'assessment' : 'application',
      stepIndex: inferInitialStepIndex(card, latestText),
      status: 'active',
      turns: 1,
      requiresConsent: requiresExplicitConsent(card),
      consentGranted: false,
    },
  };
}

export function deriveTechniqueSteps(card) {
  if (!card) return [];
  if (Array.isArray(card.steps) && card.steps.length) {
    return card.steps.map(step => cleanText(step, 500)).filter(Boolean).slice(0, 10);
  }
  if (BUILTIN_TECHNIQUE_STEPS[card.id]) return [...BUILTIN_TECHNIQUE_STEPS[card.id]];

  const numberedSteps = [...cleanText(card.core_move, 4000).matchAll(/(?:^|,\s*)\d+[.)]\s*([^,;]+?)(?=,\s*\d+[.)]|;|$)/gu)]
    .map(match => match[1].trim().replace(/[.;]+$/u, ''))
    .filter(step => step.length >= 8);
  if (numberedSteps.length >= 2) return numberedSteps.slice(0, 10);

  const sentences = cleanText(card.core_move, 4000)
    .split(/(?<=[.!?])\s+|;\s+/u)
    .flatMap(sentence => sentence.split(/,\s+(?=(?:a\s+potom|a\s+pak|potom|následně|pak|nejprve|ověř|vyber|zvol|urči|odděl|popiš|pojmenuj|nabídni|vytvoř|stanov|přelož|porovnej|polož|sepiš|zmapuj|rozliš|začni|vrať|sleduj|naslouchej|prozkoumej|podpoř|uzavři|definuj|najdi|proveď|získej|změň|přiřaď|shrň|zkoumej|prověř|propoj|chraň)(?=\s|,|$))|\s+a\s+(?=(?:potom|pak|ověř|vyber|zvol|urči|odděl|popiš|pojmenuj|nabídni|vytvoř|stanov|přelož|porovnej|polož|sepiš|zmapuj|rozliš|začni|vrať|sleduj|naslouchej|prozkoumej|podpoř|uzavři|definuj|najdi|proveď|získej|změň|přiřaď|shrň|zkoumej|prověř|propoj|chraň)(?=\s|,|$))/iu))
    .flatMap(expandParallelImperativeList)
    .map(step => step.trim().replace(/[.;]+$/u, ''))
    .filter(step => step.length >= 8);

  return (sentences.length ? sentences : [card.core_move]).slice(0, 10);
}

function expandParallelImperativeList(sentence) {
  const clean = sentence.trim();
  if (/\b(?:pokud|kter[áéý]|aniž|protože|aby)\b/iu.test(clean)) return [clean];
  const match = clean.match(/^((?:(?:bez\s+diagn[oó]zy|nejprve|společně|spolecne)\s+)?(?:ujasni|popiš|vymez|zmapuj|pojmenuj|odděl|sepiš|definuj|prověř|propoj|rozděl))\s+(.+)$/iu);
  if (!match) return [clean];

  const [, instruction, tail] = match;
  const parts = tail
    .replace(/,\s+a\s+/giu, ', ')
    .split(/,\s+|\s+a\s+/iu)
    .map(part => part.trim())
    .filter(part => part.length >= 3);
  if (parts.length < 3) return [clean];
  return parts.map(part => `${instruction} ${part}`);
}

export function formatTechniqueExecution(turn) {
  if (turn?.suspended) {
    const reason = {
      conversation_repair: 'Členka opravuje porozumění, upozorňuje na opakování nebo žádá jednodušší vysvětlení.',
      ambiguous_stop: 'Není jasné, zda chce ukončit rozhovor, techniku, nebo činnost, o které mluví.',
      external_stop: 'Členka jasně pojmenovala činnost nebo způsob, ve kterém nechce pokračovat; nejde o ukončení tohoto rozhovoru.',
      conversation_stop: 'Členka výslovně ukončuje rozhovor nebo postup.',
      technique_stop: 'Členka výslovně odmítla nebo zastavila techniku.',
      evaluation_not_answered: 'Členka neodpověděla na otázku po účinku a otevřela jiný význam, který je třeba nejprve zachytit.',
    }[turn.suspensionReason] || 'Nejdřív je nutné obnovit společné porozumění.';
    return [
      'TECHNIKA JE PRO TENTO VIDITELNÝ TAH POZASTAVENA.',
      reason,
      'V tomto tahu techniku neprováděj, neposouvej, nevyhodnocuj její účinek a netvrď, že členka dokončila krok.',
      'Krátce oprav porozumění a odpověz na skutečný význam poslední zprávy. Opři se pouze o konkrétní údaje, které členka skutečně uvedla v přepisu.',
      turn.suspensionReason === 'ambiguous_stop'
        ? 'Polož jedinou krátkou otázku, která rozliší, co přesně chce zastavit. Možnosti pojmenuj jen tehdy, pokud jsou výslovně přítomné v přepisu; jinak se zeptej obecně.'
        : '',
      turn.suspensionReason === 'external_stop'
        ? 'Respektuj doslovně pojmenovaný předmět zastavení. Nežádej znovu o jeho upřesnění a nezaměňuj jej za konec rozhovoru; navazuj tím, co chce řešit místo něj nebo jaké rozhodnutí potřebuje udělat.'
        : '',
      turn.suspensionReason === 'conversation_repair'
        ? 'Pokud žádá přeformulování, zachovej význam poslední otázky a pouze ji řekni jednodušeji. Pokud opravuje fakt nebo téma, uznej konkrétní chybu a navazuj na její poslední věcný obsah; nezačínej sezení znovu.'
        : '',
      'Skrytý stav techniky zůstává beze změny. K případnému pokračování se vrať až v následujícím tahu podle odpovědi členky.',
    ].filter(Boolean).join('\n');
  }
  if (!turn?.card || !turn?.session) {
    return 'Pro tento tah není aktivní zamčená technika. Použij vlastní odborný úsudek a dej člence nejlepší užitečnou odpověď z dostupného kontextu; nemusíš čekat ani pokládat otázku, pokud lze rovnou pomoci.';
  }

  const { card, session, steps } = turn;
  const step = steps[Math.min(session.stepIndex, Math.max(steps.length - 1, 0))] || card.core_move;
  const phaseInstruction = {
    assessment: [
      'Ověř pouze informaci, která je skutečně nutná pro citlivou zkušenostní práci.',
      'Současně dej člence přirozené užitečné rozlišení; nedělej z posouzení administrativní čekárnu.',
      'Nevyvozuj, že technika sedí, jen podle klíčového slova.',
    ],
    consent: [
      'Vysvětli běžným jazykem, co navrhuješ a k čemu to má sloužit; název techniky není potřeba.',
      'Nabídni rovnocennou možnost odmítnout nebo zvolit jiný způsob práce a vyčkej na výslovný souhlas.',
      'Bez souhlasu nezačínej žádnou imaginaci, tělesnou praxi, kotvení ani citlivou práci.',
    ],
    application: [
      session.transitionReason === 'no_effect'
        ? 'Předchozí krok nepřinesl pozorovaný účinek. Ber to jako informaci, ne jako selhání členky ani důvod automaticky ukončit celou techniku. Neopakuj stejný krok; plynule navaž aktuálním krokem.'
        : '',
      session.transitionReason === 'stuck_repair'
        ? 'Rozhovor se předtím zasekl. Krátce obnov kontakt, neopakuj stejnou otázku a přirozeně pokračuj aktuálním krokem.'
        : '',
      `Proveď pouze tento aktuální krok: ${step}`,
      'Nepřeskakuj k dalšímu kroku, nemíchej jinou techniku a nepředstírej výsledek.',
      'Instrukci přizpůsob přesným slovům členky a zachovej její možnost krok zastavit nebo upravit.',
    ].filter(Boolean),
    evaluation: [
      'Nepřidávej nový postup ani radu.',
      'Ověř pozorovatelný nebo subjektivně popsaný účinek právě provedeného kroku: co se změnilo, co zůstalo stejné nebo co se zhoršilo.',
      'Při zhoršení techniku zastav; nevykládej nepohodu jako důkaz, že metoda funguje.',
    ],
    integration: session.transitionReason
      ? [
        'Předchozí krok nepřinesl účinek nebo se rozhovor zasekl. Nevymýšlej zlepšení a neuzavírej automaticky celý proces.',
        'Podle konkrétního kontextu plynule zvol jednu možnost: krátce něco rozhodujícího upřesnit, nabídnout bezpečnou variantu postupu, nebo přejít k jiné vhodné metodě. Nedělej z toho menu ani administrativní volbu.',
      ]
      : [
        'Shrň pouze změnu, kterou členka sama popsala, a její praktický význam.',
        'Ověř, zda je užitečné techniku uzavřít, zopakovat později, nebo zvolit další krok. Bez souhlasu nevytvářej domácí úkol.',
      ],
    completed: ['Technický cyklus je uzavřen. Neopakuj jej automaticky a neoznačuj úspěch bez slov členky.'],
    stopped: ['Technika byla odmítnuta nebo zastavena. Respektuj to, neobhajuj ji a nabídni pokračování čistým rozhovorem.'],
  }[session.phase];

  return [
    `Aktivní technika: ${card.name} (${card.id})`,
    `Aktuální fáze: ${session.phase}`,
    `Aktuální krok: ${session.stepIndex + 1} z ${Math.max(steps.length, 1)}`,
    `Autoritativní postup vyučovaný v atlasu: ${card.core_move}`,
    `Jednotlivé pracovní kroky: ${steps.map((item, index) => `${index + 1}. ${item}`).join(' | ')}`,
    `Vhodné když: ${card.use_when.join('; ')}`,
    `Zastavit / nepoužít: ${card.avoid.join('; ')}`,
    `Zakázaná tvrzení: ${card.never_claim.join('; ')}`,
    `Původ metodiky: ${card.origin_or_standard}`,
    `Povinnosti tohoto tahu: ${phaseInstruction.join(' ')}`,
    'Do odpovědi nevypisuj tento protokol, ID, fázi ani interní kontrolu. Člence poskytni jen přirozenou část sezení.',
  ].join('\n');
}

export function enforceTechniqueResponse(text, turn, context = {}) {
  const output = String(text || '').trim();
  if (turn?.suspended || !turn?.card || !turn?.session) return output;
  const { card, session } = turn;

  if (session.phase === 'consent') {
    const normalized = normalizeCzech(output);
    const invitesChoice = /\b(chces|souhlasis|muzu ti nabidnout|muzeme|zkusime)\b/iu.test(normalized)
      && /\?/u.test(output);
    const preservesExit = /\b(odmitnout|zastavit|vynechat|nemusis|jinak|jiny zpusob)\b/iu.test(normalized);
    const startsSensitivePractice = /\b(zavri oci|nadechni se|vybav si|predstav si|soustred se na telo|vsimni si v tele)\b/iu.test(normalized);
    if (output && invitesChoice && preservesExit && !startsSensitivePractice) {
      return output;
    }
    const step = turn.steps?.[session.stepIndex] || card.core_move || card.name;
    const cleanStep = String(step).replace(/\s+/gu, ' ').replace(/[.!?]+$/u, '').trim();
    return `Navrhuju teď krátce vyzkoušet tento krok: ${cleanStep.charAt(0).toLowerCase()}${cleanStep.slice(1)}. Nemusíš do něj jít a můžeš ho kdykoli zastavit nebo zvolit jiný způsob. Chceš ho vyzkoušet?`;
  }
  if (session.phase === 'stopped') {
    if (session.stopReason === 'user_stop') {
      return 'Rozumím. Tady končíme. Nebudu pokračovat ani přidávat další krok.';
    }
    return `Dobře, postup „${card.name}“ tady zastavíme. Nebudu ho obhajovat ani v něm pokračovat. V původním tématu můžeme pokračovat čistě rozhovorem, nebo ho pro dnešek nechat být.`;
  }
  if (session.phase === 'evaluation') {
    if (output && isTechniqueEffectCheck(output) && !startsTechniqueIntervention(output)) {
      return output;
    }
    return 'Než navážeme: co je teď oproti chvíli před tímto krokem jiné, stejné nebo horší?';
  }
  if (!String(text || '').trim() && session.phase === 'application' && session.transitionReason) {
    return 'Předchozí krok necháme být. Zkusme teď jinou cestu: co by ti v této chvíli pomohlo pohnout se o jediný konkrétní krok?';
  }
  return output;
}

export function techniqueFallbackQuestion(turn, latestText = '') {
  const phase = turn?.session?.phase;
  return {
    assessment: contextualAssessmentQuestion(latestText),
    consent: 'Chceš tento krátký postup teď vyzkoušet?',
    application: 'Čeho sis při tomto jediném kroku všimla?',
    evaluation: 'Je to teď stejné, o trochu lepší, nebo horší?',
    integration: 'Co z toho chceš převést do dalšího konkrétního kroku?',
    stopped: 'Chceš pokračovat jen rozhovorem, nebo dnešní téma uzavřít?',
  }[phase] || 'Co je teď pro další postup nejdůležitější?';
}

export function isTechniqueEffectCheck(value) {
  const normalized = normalizeCzech(value);
  return /\b(?:co se (?:ted |po tom |oproti [^.!?]{0,45})?(?:zmenilo|zmenilo se)|zmenilo se neco|co (?:je|zustalo) (?:ted )?(?:jinak|stejne)|je to (?:ted )?(?:stejne|lepsi|horsi)|ceho sis (?:ted |po (?:tom )?(?:kroku )?)?vsimla|jak(?:y|a)? (?:to melo|to ma|byl|je) (?:ucinek|dopad)|co to (?:s tebou )?udelalo|jak se (?:ted |po tom )?(?:citis|mas)|co je ted oproti [^.!?]{0,45}(?:jine|stejne|horsi)|vnimas (?:ted )?(?:nejakou )?zmenu|co (?:ted )?pozorujes|jak(?:y)? (?:je|vnimas) rozdil|jak to na tebe (?:ted )?pusobi)\b/iu.test(normalized);
}

export function startsTechniqueIntervention(value) {
  return /\b(?:zkus(?:me| si| ted)?|pojďme|pojdme|zavri|otevri|nadechni|vydechni|vybav si|predstav si|soustred se|proved|udelej|napis si|rekni si|dame dalsi|udelame dalsi|pokracuj(?:me)? (?:jinou|dalsi)|ted (?:si )?vsimni)\b/iu.test(normalizeCzech(value));
}

function contextualAssessmentQuestion(latestText) {
  const clean = String(latestText || '')
    .replace(/\s+/gu, ' ')
    .replace(/[.!?]+$/u, '')
    .trim();
  if (clean.length < 9) {
    return 'Co přesně by se mělo změnit, aby pro tebe měla tato práce smysl?';
  }
  const excerpt = clean.length <= 140
    ? clean
    : `${clean.slice(0, 137).replace(/\s+\S*$/u, '')}…`;
  return `Která konkrétní nedávná situace tě vede k větě „${excerpt}“?`;
}

export function sanitizeTechniqueSession(input, atlasOrMap = []) {
  if (!input || typeof input !== 'object') return null;
  const byId = atlasOrMap instanceof Map ? atlasOrMap : new Map(atlasOrMap.map(card => [card.id, card]));
  const techniqueId = cleanText(input.techniqueId, 120);
  const phase = PHASES.has(input.phase) ? input.phase : null;
  if (!techniqueId || !phase || !byId.has(techniqueId)) return null;
  const card = byId.get(techniqueId);
  const steps = deriveTechniqueSteps(card);
  const stepIndex = Number.isInteger(input.stepIndex)
    ? Math.max(0, Math.min(input.stepIndex, Math.max(steps.length - 1, 0)))
    : 0;
  return {
    techniqueId,
    mode: cleanText(input.mode, 80),
    phase,
    stepIndex,
    status: ACTIVE_PHASES.has(phase) ? 'active' : phase,
    turns: Number.isInteger(input.turns) ? Math.max(0, Math.min(input.turns, 100)) : 0,
    requiresConsent: input.requiresConsent === true || requiresExplicitConsent(card),
    consentGranted: input.consentGranted === true,
    transitionReason: ['no_effect', 'stuck_repair'].includes(input.transitionReason)
      ? input.transitionReason
      : null,
  };
}

function advanceSession(previous, card, latestText, conversationContext, previousAssistantText = '') {
  const steps = deriveTechniqueSteps(card);
  const next = { ...previous, transitionReason: null, turns: previous.turns + 1, status: 'active' };

  if (previous.phase === 'assessment') {
    const priorAlreadyAskedConsent = /\bchces\b[^?]{0,120}\b(?:zkusit|vyzkouset|predstavit|projit|udelat)\b|\b(?:zkusit|vyzkouset|predstavit)\b[^?]{0,120}\bse\s+mnou\b/iu
      .test(normalizeCzech(previousAssistantText));
    if (priorAlreadyAskedConsent && hasConsent(latestText)) {
      next.phase = 'application';
      next.consentGranted = true;
      return next;
    }
    next.phase = needsConsentForStep(next, card) ? 'consent' : 'application';
    return next;
  }

  if (previous.phase === 'consent') {
    if (hasConsent(latestText)) {
      next.phase = 'application';
      next.consentGranted = true;
    }
    return next;
  }

  if (previous.phase === 'application') {
    if (reportsWorse(latestText)) {
      next.phase = 'stopped';
      next.status = 'stopped';
      next.stopReason = 'adverse_effect';
    } else if (stepAdvancesWithoutEvaluation(card, previous.stepIndex)
      && isSubstantiveTechniqueAnswer(latestText)) {
      advanceAfterEvaluation(next, steps, card);
    } else if (reportsEffect(latestText)) {
      advanceAfterEvaluation(next, steps, card);
    } else if (reportsStepAttempt(latestText)) {
      next.phase = 'evaluation';
    } else {
      // Samotná další odpověď klientky není důkaz, že provedla krok.
      // Zůstaneme v aplikaci a model musí přirozeně reagovat na její význam.
      next.phase = 'application';
    }
    return next;
  }

  if (previous.phase === 'evaluation') {
    if (reportsWorse(latestText)) {
      next.phase = 'stopped';
      next.status = 'stopped';
      next.stopReason = 'adverse_effect';
      return next;
    }
    if (!reportsEffect(latestText)) return next;
    advanceAfterEvaluation(next, steps, card);
    return next;
  }

  if (previous.phase === 'integration') {
    next.phase = 'completed';
    next.status = 'completed';
  }
  return next;
}

function adaptAfterFeedback(previous, steps, transitionReason) {
  const next = {
    ...previous,
    transitionReason,
    turns: previous.turns + 1,
    status: 'active',
  };
  advanceAfterEvaluation(next, steps);
  return next;
}

function advanceAfterEvaluation(next, steps, card = null) {
  if (next.stepIndex + 1 < steps.length) {
    next.stepIndex += 1;
    next.phase = card && needsConsentForStep(next, card) ? 'consent' : 'application';
  } else {
    next.phase = 'integration';
  }
}

function needsConsentForStep(session, card) {
  if (!session.requiresConsent || session.consentGranted) return false;
  const stepKind = Array.isArray(card?.step_kinds) ? card.step_kinds[session.stepIndex] : null;
  return stepKind !== 'elicitation';
}

function inferInitialStepIndex(card, latestText) {
  if (card?.id === 'accurate_self_talk_edit'
    && /\b(jsem|nejsem|nedok[aá]žu|nezvl[aá]dnu|vždycky|nikdy)\b/iu.test(String(latestText || ''))
    && Array.isArray(card.steps)
    && card.steps.length > 1) {
    return 1;
  }
  return 0;
}

function stepAdvancesWithoutEvaluation(card, stepIndex) {
  return Array.isArray(card?.step_kinds) && card.step_kinds[stepIndex] === 'elicitation';
}

function requiresExplicitConsent(card) {
  return CONSENT_FAMILIES.has(card.family)
    || /\b(?:t[eě]lo|t[eě]lesn|dech|oči|oci|vizualiz|imagin|kotv|vzpom[ií]nk|medit|somat|submodal)/i.test(card.core_move);
}

function hasConsent(value) {
  return /\b(ano|souhlasim|suhlasim|muzeme|mozeme|zkusme|skusme|pojdme|podme|pojd|chci to zkusit|chcem to skusit|klidne)\b/iu.test(normalizeCzech(value));
}

function declinesConsent(value) {
  const normalized = normalizeCzech(value).replace(/[.!?,;:]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (/^(?:ne|nie|nechci|nechcem|radsi ne|radsej nie|ted ne|teraz nie|ne diky|ne dekuji|tohle nechci|toto nechcem)$/u.test(normalized)) return true;
  return /^(?:(?:ne|nie)\s+)?(?:tohle|toto|timhle|tudy|tento krok|tenhle krok)?\s*(?:nechci|nechcem|odmitam|odmietam|vynechme|vynechajme|nedelme|nerobme|nebudu)\b/u.test(normalized)
    || /^(?:radsi|radeji|radsej)\s+(?:to\s+)?(?:vynechme|vynechajme|ne|nie|jinak|inak)\b/u.test(normalized)
    || /\b(?:pokracovat|zkouset|skusat|udelat|urobit|delat|robit)\s+(?:nechci|nechcem)\b/u.test(normalized);
}

function isSubstantiveTechniqueAnswer(value) {
  const normalized = normalizeCzech(value).replace(/[.!?,;:]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (!normalized) return false;
  return !/^(?:(?:to|ja)\s+)?(?:nevim|neviem|netusim|nedokazu (?:to )?rict|nedokazem (?:to )?povedat|neumim (?:to )?rict|ano|jo|ok|dobre|ne|nie)$/u.test(normalized);
}

export function classifyStopIntent(value) {
  const normalized = normalizeCzech(value).replace(/\s+/gu, ' ').trim();
  if (/\b(?:nechci|nechcem|odmitam|odmietam)\s+(?:tuhle|tohle|toto|tuto|tu|dalsi|dalsiu)?\s*(?:technik|cvicen|postup|krok)\w*\b|\b(?:tuhle|tohle|toto|tuto|tu)\s+(?:technik|cvicen|postup|krok)\w*\s+(?:nechci|nechcem|odmitam|odmietam)\b|\b(?:zastav|ukonci|vynechme|vynechajme)\s+(?:tuhle|tuto|tu|toto)?\s*(?:technik|cvicen|postup|krok)\w*\b|\b(?:nechci|nechcem)\s+pokracovat\s+(?:s|v)\s+(?:touhle|touto|tuto|tou)?\s*(?:technik|cvicen|postup)\w*\b/iu.test(normalized)) {
    return 'technique_stop';
  }
  const declinesCurrentDirection = /\b(?:timhle|timto|takhle|tudy|tymto|takto|touto cestou|v tomhle smeru|v tomto smere)\b[^.!?\n]{0,90}\b(?:nechci|nechcem|odmitam|odmietam)\b|\b(?:nechci|nechcem|odmitam|odmietam)\b[^.!?\n]{0,90}\b(?:timhle|timto|takhle|tudy|tymto|takto|touto cestou|v tomhle smeru|v tomto smere)\b/iu.test(normalized);
  if (declinesCurrentDirection) return 'external_stop';
  const explicitlyKeepsConversation = /\b(?:ne|nie|nikoli)\s+(?:s\s+tebou|so\s+mnou|(?:ten|tento|nas)\s+rozhovor|rozhovor|sezeni|sedenie|techniku)\b|\b(?:s\s+tebou|tady|tu)\s+(?:ale\s+)?(?:(?:chci|chcem)\s+)?pokracovat\b|\bpokracovat\s+(?:chci|chcem)\s+(?:s\s+tebou|tady|tu)\b/iu.test(normalized);
  const invertedExternalTarget = /(?:^|[.!?;]\s*)(?!to\b|toto\b|tohle\b|takhle\b)[^.!?,;]{3,120}?\s+(?:uz\s+|dal\s+)*(?:delat|robit|poradat|organizovat|vest|viest|rozvijet)\s+(?:uz\s+|dal\s+)*(?:nechci|nechcem|nebudu)\b/iu.test(normalized);
  const namesExternalTarget = /\b(?:nechci|nechcem|nemuzu|nemozem)\s+pokracovat\s+(?:s|v|na)\s+\S+|\b(?:chci|chcem)\s+skoncit\s+(?:s|v|na)\s+\S+/iu.test(normalized)
    || invertedExternalTarget;
  if (explicitlyKeepsConversation && namesExternalTarget) {
    return 'external_stop';
  }
  if (invertedExternalTarget) return 'external_stop';
  if (/\b(?:stop|zastav(?:me|it)?|prestan)\b/iu.test(normalized)
    && /\btechnik\w*\b/iu.test(normalized)) {
    return 'technique_stop';
  }
  if (/\b(?:stop|zastav(?:me|it)?|prestan)\b/iu.test(normalized)
    && /\b(?:sezen\w*|rozhovor\w*|tady|s tebou|v tomhle postupu|v tomto postupu)\b/iu.test(normalized)) {
    return 'conversation_stop';
  }
  if (/^(?:stop|zastav(?:me)?|prestan)[.!?,;:\s]*$/iu.test(normalized)) return 'conversation_stop';
  if (/\b(?:stop|zastav(?:me|it)?|prestan)\b/iu.test(normalized)) {
    if (/\bprestan\s+mi\s+\w+/iu.test(normalized)) return 'external_stop';
    return 'external_or_ambiguous';
  }
  if (/\b(?:nechci|nechcem|nemuzu|nemozem)\s+pokracovat\b|\b(?:chci|chcem)\s+(?:to\s+)?ukoncit\b|\b(?:chci|chcem)\s+skoncit\b/iu.test(normalized)) {
    if (/\b(?:sezen\w*|seden\w*|rozhovor\w*|technik\w*|tady|tu|s tebou|v tomhle postupu|v tomto postupu)\b/iu.test(normalized)) {
      return 'conversation_stop';
    }
    if (/\b(?:nechci|nechcem|nemuzu|nemozem)\s+pokracovat\s+(?:s|v|na)\s+\S+|\b(?:chci|chcem)\s+skoncit\s+(?:s|v|na)\s+\S+/iu.test(normalized)) {
      return 'external_stop';
    }
    return 'external_or_ambiguous';
  }
  return 'none';
}

function wantsAnotherTechnique(value) {
  return /\b(jina technik|jiny postup|zmen technik|zmen postup|nove tema)\b/iu.test(normalizeCzech(value));
}

function reportsNoEffect(value) {
  return /\b((?:zatim )?nic (?:mi )?(?:to )?(?:nedela|nerobi|neudelalo|neudelava|nezmenilo)|nic (?:se|sa) nezmenilo|zadna zmena|ziadna zmena|bez zmeny|necitim (?:zadnou|ziadnu) zmenu|nefunguje|nepomohlo|nepomaha|nezabralo)\b/iu.test(normalizeCzech(value));
}

export function isConversationRepairRequest(value) {
  const normalized = normalizeCzech(value).replace(/\s+/gu, ' ').trim();
  const ordinaryRepair = /\b(halo|slysis me|pocujes ma|ctes me|citas ma|zase se opakujes|zasa sa opakujes|opakujes (?:jednu|to|sa)|neopakuj (?:se|sa)|odpovez mi|odpovedz mi|nerozumim|nerozumiem|nechapu|nechapem|nepochopil|nepochopila|co na tom nechapes|vzdyt jsem ti to (?:uz )?(?:psala|popsala)|ved som ti to (?:uz )?(?:pisala|opisala)|psala jsem\b[^.!?\n]{0,30}\bne|pisala som\b[^.!?\n]{0,30}\bnie|uz jsem (?:ti )?odpovedela|uz som (?:ti )?odpovedala|to uz jsme si (?:rikali|rekli|probirali)|to sme si uz (?:hovorili|povedali)|tohle uz mame (?:uzavrene|hotove)|toto uz mame (?:uzavrete|hotove)|to jsem (?:vubec )?nerekla|to som (?:vobec )?nepovedala|nevymyslej si|nevymyslaj si|to neni pravda|to nie je pravda|proc se me (?:zase|porad|kazdou chvilku)?\s*ptas|preco sa ma (?:zasa|stale)?\s*pytas|meles nesmysly|trepes nezmysly|r[ei]kas nesmysly|hovoris nezmysly|jak jsme se (?:sem )?dostal\w*|ako sme sa sem dostal\w*|ztratila jsi tema|stratila si temu|vrat se k tematu|vrat sa k teme|seres me)\b|^(?:resime|riesime|bavime se o|hovorime o|mluvim o|hovorim o|tema je|vrat se k|vrat sa k)\b/iu.test(normalized);
  const shortQuestionRepair = requestsOneShortQuestion(normalized);
  return ordinaryRepair || shortQuestionRepair;
}

function reportsStepAttempt(value) {
  const normalized = normalizeCzech(value).replace(/\s+/gu, ' ').trim();
  const completedVerb = '(?:udelal|udelala|zkusil|zkusila|provedl|provedla|napsal|napsala|upravil|upravila|rekl|rekla|vyslovil|vyslovila|predstavil|predstavila|vybral|vybrala|zvolil|zvolila|dokoncila)';
  // Samotné „napsala“ nebo „řekla“ může popisovat třetí osobu či citovat
  // asistentku („to, co jsi teď napsala“). Za provedení počítáme jen jasnou
  // první osobu nebo jednoznačné dokončení.
  return new RegExp(`\\b(?:${completedVerb}\\s+(?:jsem|sem)|(?:ja\\s+)?(?:jsem|sem)\\s+${completedVerb}|hotovo|mam to|dokonceno)\\b`, 'iu')
    .test(normalized);
}

function reportsWorse(value) {
  return /\b(horsi|horsie|hur|zhors|neprijemnejsi|neprijemnejsie|vic napeti|viac napatia|panika)\b/iu.test(normalizeCzech(value));
}

function reportsEffect(value) {
  return /\b(stejne|rovnako|lepsi|lepsie|lehci|lahsie|lehceji|horsi|horsie|hur|tezsi|tazsie|mensi|vetsi|polevil|polevilo|zoslablo|zesilil|zesililo|zmenil|zmenilo|vsimla|citila|citim|napeti|napatie|tlak|teplo|chlad|klid|pokoj|uleva|ulava|ulevil|ulevilo|uvolnilo|uvolneneji)\b/iu.test(normalizeCzech(value));
}

function normalizeCzech(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
