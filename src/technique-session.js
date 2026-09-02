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
} = {}) {
  const byId = new Map(atlas.map(card => [card.id, card]));
  const safePrevious = sanitizeTechniqueSession(previous, byId);
  const stopIntent = classifyStopIntent(latestText);
  const explicitStop = stopIntent === 'conversation_stop';
  const ambiguousOrExternalStop = stopIntent === 'external_or_ambiguous';
  const explicitNoEffect = reportsNoEffect(latestText);
  const explicitRepair = isConversationRepairRequest(latestText);
  const explicitRestart = wantsAnotherTechnique(latestText);
  const consentDeclined = safePrevious?.phase === 'consent' && declinesConsent(latestText);
  const noEffectFeedback = explicitNoEffect && safePrevious
    && ['application', 'evaluation'].includes(safePrevious.phase);
  // Meta-komunikace a nejasné „nechci pokračovat“ nesmějí být vyloženy
  // jako další krok techniky. Nejprve se musí obnovit společné porozumění.
  if (explicitRepair || ambiguousOrExternalStop) {
    return { card: null, session: null, steps: [] };
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

  // Pokud členka neodpověděla na měření účinku, pevnou otázku neopakujeme.
  // Techniku uvolníme a necháme rozhovor opravit význam nebo směr.
  if (safePrevious?.phase === 'evaluation'
    && !explicitNoEffect
    && !reportsEffect(latestText)
    && !reportsWorse(latestText)) {
    return { card: null, session: null, steps: [] };
  }

  if (safePrevious && ACTIVE_PHASES.has(safePrevious.phase)
    && !explicitStop && !noEffectFeedback && !explicitRestart) {
    const card = byId.get(safePrevious.techniqueId);
    const session = advanceSession(safePrevious, card, latestText, conversationContext);
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

export function fixedTechniqueResponse(turn) {
  const phase = turn?.session?.phase;
  return ['consent', 'evaluation', 'stopped'].includes(phase)
    ? enforceTechniqueResponse('', turn)
    : null;
}

export function formatTechniqueExecution(turn) {
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
  if (context.authoritativeGrounding === true && String(text || '').trim()) {
    return String(text).trim();
  }
  if (!turn?.card || !turn?.session) return String(text || '').trim();
  const { card, session } = turn;

  if (session.phase === 'consent') {
    if (card.id === 'accurate_self_talk_edit' && session.stepIndex >= 3) {
      return 'Máme přesnější větu. Můžeme ji teď krátce spojit s nejbližší konkrétní situací a jedním činem, který ji podpoří; kdykoli to můžeš zastavit nebo upravit. Chceš tímto krokem pokračovat?';
    }
    return 'Můžu ti nabídnout krátký vedený postup přesně pro tuto situaci. Půjdeme po jednom kroku a můžeš ho kdykoli odmítnout, změnit nebo zastavit. Chceš ho teď vyzkoušet?';
  }
  if (session.phase === 'evaluation') {
    return 'Než přidáme cokoli dalšího, potřebuji zůstat u účinku právě provedeného kroku. Co se teď změnilo — je to stejné, o trochu lepší, nebo horší?';
  }
  if (session.phase === 'stopped') {
    const userContext = (Array.isArray(context.messages) ? context.messages : [])
      .filter(message => message?.role === 'user')
      .map(message => String(message.content || ''))
      .join(' ');
    if (/workshop/iu.test(userContext)) {
      return 'Dobře, tenhle postup dělat nebudeme. Vrátím se k workshopu: zatím víme, že se přihlásily tři ženy a jedna odešla, ale nevíme proč. Co udělaly zbývající dvě — zůstaly, zapojily se nebo ti daly nějakou zpětnou vazbu?';
    }
    return 'Dobře, tenhle postup dělat nebudeme. Zůstaneme u tvého tématu a zvolíme jinou cestu. Potřebuješ teď spíš porozumět tomu, co se děje, nebo najít konkrétní další krok?';
  }
  if (session.phase === 'application' && card.id === 'customer_discovery' && session.stepIndex === 0) {
    return 'Teď nebudeme plánovat oslovení ani reklamu naslepo. Nejdřív ukotvíme, koho a jaký skutečný problém potřebujeme zkoumat. Kterou konkrétní skupinu žen má Elitea oslovit a v jaké situaci by jim měla pomáhat?';
  }
  if (session.phase === 'application' && card.id === 'accurate_self_talk_edit' && session.stepIndex === 2) {
    const latest = normalizeCzech(context.latestText || '');
    const identityWord = /neschopn/.test(latest) ? '„neschopná“' : 'hodnocení celé sebe';
    return `${identityWord} jsme oddělily od konkrétního faktu. Teď nejde o pozitivní slogan, ale o přesnější větu, která uzná, co se stalo, a současně z jedné situace neudělá tvoji identitu. Jak bys ji řekla tak, aby byla pravdivá a vracela ti možnost další volby?`;
  }
  if (session.phase === 'application' && card.id === 'accurate_self_talk_edit' && session.stepIndex >= 3) {
    return 'Vrať se teď k nejbližšímu okamžiku, kdy se objeví stejný vzorec. Řekni si svou přesnější větu vlastními slovy a zvol jediný malý čin, který ji potvrdí. Pokud je možné ho udělat hned, udělej ho; jinak si přesně představ jeho první vteřiny. Co se potom změnilo v tvém jednání nebo pocitu?';
  }
  if (session.phase === 'integration' && card.id === 'accurate_self_talk_edit' && reportsEffect(context.latestText)) {
    return 'To, co právě popisuješ, je malý, ale pozorovatelný rozdíl v jednání i prožívání. Neznamená to, že je celý vzorec vyřešený; znamená to, že původní tvrdá věta o celé tobě nepopisuje celý proces. Co bylo v okamžiku tohoto rozdílu rozhodující?';
  }
  if (session.phase === 'integration' && session.transitionReason === 'no_effect' && card.id === 'accurate_self_talk_edit') {
    return 'To, že samotná přesnější věta nic nezměnila, je důležitá informace: problém možná neleží hlavně v tom, jak se označuješ, ale v okamžiku tlaku a nejasného začátku. Tuhle techniku nemusíme opakovat; plynule se vrátíme k mechanismu. Když web otevřeš, které první konkrétní rozhodnutí po tobě situace chce a není ti jasné?';
  }
  if (!String(text || '').trim() && session.phase === 'application' && session.transitionReason) {
    return 'Předchozí krok necháme být. Zkusme teď jinou cestu: co by ti v této chvíli pomohlo pohnout se o jediný konkrétní krok?';
  }
  return String(text || '').trim();
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

function advanceSession(previous, card, latestText, conversationContext) {
  const steps = deriveTechniqueSteps(card);
  const next = { ...previous, transitionReason: null, turns: previous.turns + 1, status: 'active' };

  if (previous.phase === 'assessment') {
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
  return /\b(ano|souhlasim|muzeme|zkusme|pojdme|pojd|chci to zkusit|klidne)\b/iu.test(normalizeCzech(value));
}

function declinesConsent(value) {
  const normalized = normalizeCzech(value).replace(/[.!?,;:]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  return /^(?:ne|nechci|radsi ne|ted ne|ne diky|ne dekuji|tohle nechci)$/u.test(normalized);
}

function isSubstantiveTechniqueAnswer(value) {
  const normalized = normalizeCzech(value).replace(/[.!?,;:]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (!normalized) return false;
  return !/^(?:(?:to|ja)\s+)?(?:nevim|netusim|nedokazu (?:to )?rict|neumim (?:to )?rict|ano|jo|ok|dobre|ne)$/u.test(normalized);
}

export function classifyStopIntent(value) {
  const normalized = normalizeCzech(value).replace(/\s+/gu, ' ').trim();
  if (/\b(stop|zastav(?:me|it)?|prestan|nechci tu techniku|je mi hur)\b/iu.test(normalized)) {
    return 'conversation_stop';
  }
  if (/\b(?:nechci|nemuzu)\s+pokracovat\b|\bchci\s+(?:to\s+)?ukoncit\b|\bchci\s+skoncit\b/iu.test(normalized)) {
    return /\b(sezen|rozhovor|technik|tady|s tebou|v tomhle postupu|v tomto postupu)\b/iu.test(normalized)
      ? 'conversation_stop'
      : 'external_or_ambiguous';
  }
  return 'none';
}

function wantsAnotherTechnique(value) {
  return /\b(jina technik|jiny postup|zmen technik|zmen postup|nove tema)\b/iu.test(normalizeCzech(value));
}

function reportsNoEffect(value) {
  return /\b((?:zatim )?nic (?:mi )?(?:to )?(?:nedela|neudelalo|neudelava|nezmenilo)|nic se nezmenilo|zadna zmena|bez zmeny|necitim zadnou zmenu|nefunguje|nepomohlo|nepomaha|nezabralo)\b/iu.test(normalizeCzech(value));
}

export function isConversationRepairRequest(value) {
  return /\b(halo|slysis me|ctes me|zase se opakujes|opakujes (?:jednu|to)|neopakuj se|odpovez mi|nerozumim|nechapu|nepochopil|nepochopila|co na tom nechapes|vzdyt jsem ti to (?:uz )?(?:psala|popsala)|psala jsem\b[^.!?\n]{0,30}\bne|uz jsem (?:ti )?odpovedela|resime\b[^.!?\n]{0,60}\bworkshop|proc se me (?:zase|porad|kazdou chvilku)?\s*ptas|meles nesmysly|r[ei]kas nesmysly|jak jsme se (?:sem )?dostal\w*|ztratila jsi tema|vrat se k tematu|seres me)\b/iu.test(normalizeCzech(value));
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
  return /\b(horsi|hur|zhors|neprijemnejsi|vic napeti|panika)\b/iu.test(normalizeCzech(value));
}

function reportsEffect(value) {
  return /\b(stejne|lepsi|lehci|lehceji|horsi|hur|tezsi|mensi|vetsi|polevil|polevilo|zesilil|zesililo|zmenil|zmenilo|vsimla|citila|citim|napeti|tlak|teplo|chlad|klid|uleva|ulevil|ulevilo|uvolnilo|uvolneneji)\b/iu.test(normalizeCzech(value));
}

function normalizeCzech(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
