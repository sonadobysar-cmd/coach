import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStopIntent,
  createTechniqueTurn,
  deriveTechniqueSteps,
  enforceTechniqueResponse,
  formatTechniqueExecution,
  isConversationRepairRequest,
  sanitizeTechniqueSession,
  techniqueFallbackQuestion,
} from '../src/technique-session.js';

const practicalCard = {
  id: 'nia_precise_method',
  name: 'Přesná metoda Nii',
  family: 'core_coaching',
  access_level: 'ai_coaching',
  keywords: ['rozhodnutí'],
  use_when: ['členka potřebuje rozlišit dvě varianty'],
  core_move: 'Nejprve pojmenuj obě varianty, potom odděl fakta od obav. Ověř, co je v souladu s hodnotami členky.',
  avoid: ['chybí základní fakta'],
  never_claim: ['že metoda rozhodne za členku'],
  origin_or_standard: 'Metodika Nii, ověřená verze',
};

const sensitiveCard = {
  ...practicalCard,
  id: 'nia_somatic_method',
  name: 'Tělesná orientace Nii',
  family: 'trauma_informed_support',
  core_move: 'Nabídni vnější orientaci s otevřenýma očima. Potom ověř snesitelnost.',
};

test('nouzová otázka při výpadku modelu zůstane ukotvená ve slovech klientky', () => {
  const question = techniqueFallbackQuestion(
    { session: { phase: 'assessment' } },
    'Můj partner je určitě narcis a já za nic nemůžu.',
  );
  assert.match(question, /partner je určitě narcis/i);
  assert.doesNotMatch(question, /^Co přesně by se mělo změnit/i);
});

test('výslovně vyučované kroky mají přednost před odhadem z core_move', () => {
  const card = { ...practicalCard, steps: ['Vyjasni zakázku', 'Ověř skutečnost', 'Integruj vlastní závěr'] };
  assert.deepEqual(deriveTechniqueSteps(card), card.steps);
});

test('číslovaný protokol v jedné větě se rozdělí na skutečné samostatné kroky', () => {
  const card = {
    ...sensitiveCard,
    core_move: '1) ukotvi se v prostoru, 2) všimni si jednoho vjemu, 3) zvol laskavou odpověď, 4) vrať se ven; po každé fázi nabídni zastavení.',
  };
  assert.deepEqual(deriveTechniqueSteps(card), [
    'ukotvi se v prostoru',
    'všimni si jednoho vjemu',
    'zvol laskavou odpověď',
    'vrať se ven',
  ]);
});

test('klasické rámce zapsané jako seznam nejsou provedeny v jednom obřím kroku', () => {
  const grow = {
    ...practicalCard,
    id: 'grow',
    core_move: 'Ujasni cíl, realitu, možnosti a dobrovolně zvolený další krok.',
  };
  const clear = {
    ...practicalCard,
    id: 'clear',
    core_move: 'Dohodni kontrakt, naslouchej, prozkoumej, podpoř akci a uzavři reflexí.',
  };

  assert.deepEqual(deriveTechniqueSteps(grow), [
    'Ujasni cíl',
    'Ujasni realitu',
    'Ujasni možnosti',
    'Ujasni dobrovolně zvolený další krok',
  ]);
  assert.equal(deriveTechniqueSteps(clear).length, 5);
  assert.equal(deriveTechniqueSteps({ ...practicalCard, id: 't_grow' }).length, 5);
  assert.equal(deriveTechniqueSteps({ ...practicalCard, id: 'ooda' }).length, 5);
  assert.equal(deriveTechniqueSteps({ ...practicalCard, id: 'jobs_to_be_done' }).length, 4);
});

test('technika zůstává zamčená po celý pracovní cyklus', () => {
  const first = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard],
    candidates: [practicalCard],
    mode: 'koucovaci_hodina',
    latestText: 'Nevím, kterou variantu zvolit.',
    conversationContext: { userTurns: 1 },
  });
  const next = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard],
    candidates: [sensitiveCard],
    previous: first.session,
    mode: 'koucovaci_hodina',
    latestText: 'Jedna varianta je bezpečnější.',
    conversationContext: { userTurns: 2 },
  });
  assert.equal(next.card.id, practicalCard.id);
  assert.equal(next.session.techniqueId, practicalCard.id);
  assert.equal(next.session.phase, 'application');
});

test('konec workshopů se nezamění za ukončení rozhovoru', () => {
  const active = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
    status: 'active', turns: 2, requiresConsent: false,
  };
  assert.equal(classifyStopIntent('Už nechci pokračovat, bojím se.'), 'external_or_ambiguous');
  assert.equal(classifyStopIntent('Nechci pokračovat s workshopem.'), 'external_stop');
  assert.equal(classifyStopIntent('Přestaň, chci ukončit sezení.'), 'conversation_stop');
  assert.equal(classifyStopIntent('Nechci tu techniku.'), 'technique_stop');
  assert.equal(classifyStopIntent('Zastav tuto techniku.'), 'technique_stop');
  assert.equal(classifyStopIntent('Je mi po tom hůř.'), 'none');

  const turn = createTechniqueTurn({
    atlas: [practicalCard], candidates: [practicalCard], previous: active,
    mode: 'koucovaci_hodina', latestText: 'Nechci pokračovat s workshopem.',
    conversationContext: { userTurns: 2 },
  });
  assert.equal(turn.card.id, practicalCard.id);
  assert.equal(turn.session.phase, active.phase);
  assert.equal(turn.session.stepIndex, active.stepIndex);
  assert.equal(turn.session.turns, active.turns);
  assert.equal(turn.suspended, true);
  assert.equal(turn.suspensionReason, 'external_stop');
  assert.match(formatTechniqueExecution(turn), /nezaměňuj jej za konec rozhovoru/i);
});

test('přestaň s konkrétním chováním není automaticky konec rozhovoru', () => {
  assert.equal(classifyStopIntent('Přestaň mi radit a jen mi vysvětli otázku.'), 'external_stop');
  assert.equal(classifyStopIntent('Přestaň, chci pokračovat jinak.'), 'external_or_ambiguous');
  assert.equal(classifyStopIntent('Přestaň.'), 'conversation_stop');
  assert.equal(classifyStopIntent('Chci ukončit dnešní rozhovor.'), 'conversation_stop');
});

test('odmítnutí techniky bez uloženého stavu nesmí spustit novou techniku', () => {
  const turn = createTechniqueTurn({
    atlas: [practicalCard],
    candidates: [practicalCard],
    mode: 'koucovaci_hodina',
    latestText: 'Nechci tu techniku.',
    conversationContext: { userTurns: 1 },
  });
  assert.equal(turn.card, null);
  assert.equal(turn.session, null);
  assert.equal(turn.suspended, true);
  assert.equal(turn.suspensionReason, 'technique_stop');
});

test('oprava klientky techniku pozastaví bez skrytého posunu nebo ztráty stavu', () => {
  const evaluation = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'evaluation', stepIndex: 0,
    status: 'active', turns: 3, requiresConsent: false,
  };
  for (const latestText of [
    'Nerozumím ti.',
    'Meleš nesmysly.',
    'Jak jsme se sem dostaly?',
    'Zase se opakuješ.',
    'Vždyť jsem ti to popsala — ten workshop!',
    'Psala jsem ti už, že ne.',
  ]) {
    assert.equal(isConversationRepairRequest(latestText), true);
    const turn = createTechniqueTurn({
      atlas: [practicalCard], candidates: [practicalCard], previous: evaluation,
      mode: 'koucovaci_hodina', latestText, conversationContext: { userTurns: 4 },
    });
    assert.equal(turn.card.id, practicalCard.id);
    assert.equal(turn.session.phase, evaluation.phase);
    assert.equal(turn.session.stepIndex, evaluation.stepIndex);
    assert.equal(turn.session.turns, evaluation.turns);
    assert.equal(turn.suspended, true);
    assert.equal(turn.suspensionReason, 'conversation_repair');
  }
});

test('účinek se neměří bez důkazu že členka krok skutečně provedla', () => {
  const application = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
    status: 'active', turns: 2, requiresConsent: false,
  };
  const noAction = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: application,
    mode: 'koucovaci_hodina', latestText: 'No to já nevím, proto tu jsem.',
    conversationContext: { userTurns: 3 },
  });
  const action = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: application,
    mode: 'koucovaci_hodina', latestText: 'Zkusila jsem ten krok.',
    conversationContext: { userTurns: 3 },
  });
  assert.equal(noAction.session.phase, 'application');
  assert.equal(action.session.phase, 'evaluation');
});

test('odpověď mimo otázku po účinku zachová evaluaci, ale v aktuálním tahu ji neopakuje', () => {
  const evaluation = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'evaluation', stepIndex: 0,
    status: 'active', turns: 3, requiresConsent: false,
  };
  const turn = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: evaluation, mode: 'koucovaci_hodina',
    latestText: 'Tomu nerozumím, mluvím o rozhodnutí.', conversationContext: { userTurns: 4 },
  });

  assert.equal(turn.session.phase, 'evaluation');
  assert.equal(turn.session.stepIndex, 0);
  assert.equal(turn.session.turns, 3);
  assert.equal(turn.suspended, true);
  assert.match(formatTechniqueExecution(turn), /techniku neprováděj, neposouvej, nevyhodnocuj/i);
});

test('sloveso o jiné osobě ani citace asistentky nepředstírá provedený krok klientky', () => {
  const application = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
    status: 'active', turns: 2, requiresConsent: false,
  };
  for (const latestText of [
    'Jedna účastnice mi napsala, že jí cvičení pomohlo.',
    'To, co jsi teď napsala.',
    'Kamarádka zvolila jinou možnost.',
  ]) {
    const turn = createTechniqueTurn({
      atlas: [practicalCard], candidates: [], previous: application,
      mode: 'koucovaci_hodina', latestText, conversationContext: { userTurns: 3 },
    });
    assert.equal(turn.session.phase, 'application', latestText);
  }
});

test('citlivá technika čeká na výslovný souhlas', () => {
  const first = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [sensitiveCard], mode: 'somaticka_konzultace',
    latestText: 'Jsem napjatá.', conversationContext: { userTurns: 1 },
  });
  const consent = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [], previous: first.session, mode: 'somaticka_konzultace',
    latestText: 'Co tím myslíš?', conversationContext: { userTurns: 2 },
  });
  const stillWaiting = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [], previous: consent.session, mode: 'somaticka_konzultace',
    latestText: 'Nevím.', conversationContext: { userTurns: 3 },
  });
  const granted = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [], previous: stillWaiting.session, mode: 'somaticka_konzultace',
    latestText: 'Ano, můžeme to zkusit.', conversationContext: { userTurns: 4 },
  });
  assert.equal(consent.session.phase, 'consent');
  assert.equal(stillWaiting.session.phase, 'consent');
  assert.equal(granted.session.phase, 'application');
});

test('souhlas s již popsaným krokem nepřidá druhou žádost o stejný souhlas', () => {
  const first = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [sensitiveCard], mode: 'koucovaci_podpora',
    latestText: 'Při srovnávání se zaseknu.', conversationContext: { userTurns: 1 },
  });
  const accepted = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [], previous: first.session, mode: 'koucovaci_podpora',
    latestText: 'Ano',
    previousAssistantText: 'Chceš si teď krátce představit jednu konkrétní scénu, ve které místo otevření jejího profilu tvoříš?',
    conversationContext: { userTurns: 2 },
  });
  assert.equal(accepted.session.phase, 'application');
  assert.equal(accepted.session.consentGranted, true);
});

test('po provedení musí následovat kontrola účinku a zhoršení techniku zastaví', () => {
  const application = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
    status: 'active', turns: 2, requiresConsent: false,
  };
  const evaluation = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: application, mode: 'koucovaci_hodina',
    latestText: 'Udělala jsem to.', conversationContext: { userTurns: 3 },
  });
  const stopped = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: evaluation.session, mode: 'koucovaci_hodina',
    latestText: 'Je mi po tom hůř.', conversationContext: { userTurns: 4 },
  });
  assert.equal(evaluation.session.phase, 'evaluation');
  assert.equal(stopped.session.phase, 'stopped');
});

test('popsaný účinek se započítá a nepokládá se znovu stejná kontrolní otázka', () => {
  const application = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
    status: 'active', turns: 2, requiresConsent: false,
  };
  const next = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: application, mode: 'koucovaci_hodina',
    latestText: 'Je to o trochu lepší, obava polevila.', conversationContext: { userTurns: 3 },
  });
  assert.equal(next.session.phase, 'application');
  assert.equal(next.session.stepIndex, 1);
});

test('přirozené české vyjádření úlevy je účinek, ne důvod opakovat hodnoticí otázku', () => {
  const finalStep = deriveTechniqueSteps(practicalCard).length - 1;
  const application = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: finalStep,
    status: 'active', turns: 4, requiresConsent: false, consentGranted: true,
  };
  const next = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: application, mode: 'koucovaci_hodina',
    latestText: 'Je mi o trochu lehčeji.', conversationContext: { userTurns: 5 },
  });
  assert.equal(next.session.phase, 'integration');
});

test('sběr podkladů uvnitř techniky nepředstírá provedení ani předčasně neměří účinek', () => {
  const selfTalkCard = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: [
      'Zapiš přesné znění jediné opakující se věty, která ti teď běží hlavou.',
      'Odděl v té větě ověřitelný fakt od absolutních předpovědí a pojmenuj, co skutečně víš.',
      'Vytvoř pravdivější podpůrnou větu, která nepopírá riziko a současně otevírá konkrétní jednání.',
      'Vyslov novou větu vlastními slovy, představ si nejbližší situaci a zvol jeden malý čin, který ji potvrdí.',
    ],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const application = {
    techniqueId: selfTalkCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
    status: 'active', turns: 2, requiresConsent: false,
  };

  const afterOriginalSentence = createTechniqueTurn({
    atlas: [selfTalkCard], candidates: [], previous: application, mode: 'koucovaci_hodina',
    latestText: 'To nemá smysl, beztak to zase nevyjde.', conversationContext: { userTurns: 3 },
  });
  const afterEvidence = createTechniqueTurn({
    atlas: [selfTalkCard], candidates: [], previous: afterOriginalSentence.session, mode: 'koucovaci_hodina',
    latestText: 'Fakt je, že se mi poslední pokus nepovedl; budoucnost ale nevím.', conversationContext: { userTurns: 4 },
  });
  const afterNewSentence = createTechniqueTurn({
    atlas: [selfTalkCard], candidates: [], previous: afterEvidence.session, mode: 'koucovaci_hodina',
    latestText: 'Minule to nevyšlo, ale další malý krok můžu ovlivnit.', conversationContext: { userTurns: 5 },
  });

  assert.equal(afterOriginalSentence.session.phase, 'application');
  assert.equal(afterOriginalSentence.session.stepIndex, 1);
  assert.equal(afterEvidence.session.phase, 'application');
  assert.equal(afterEvidence.session.stepIndex, 2);
  assert.equal(afterNewSentence.session.phase, 'application');
  assert.equal(afterNewSentence.session.stepIndex, 3);
});

test('nulový účinek plynule přejde k dalšímu kroku místo ukončení nebo opakování otázky', () => {
  const evaluation = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'evaluation', stepIndex: 0,
    status: 'active', turns: 3, requiresConsent: false,
  };
  const noEffect = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: evaluation, mode: 'koucovaci_hodina',
    latestText: 'Nic to nedělá.', conversationContext: { userTurns: 4 },
  });
  const response = enforceTechniqueResponse('Zkusme teď oddělit fakta od předpovědi.', noEffect);

  assert.equal(noEffect.session.phase, 'application');
  assert.equal(noEffect.session.stepIndex, 1);
  assert.equal(noEffect.session.transitionReason, 'no_effect');
  assert.notEqual(noEffect.session.status, 'stopped');
  assert.doesNotMatch(response, /co se teď změnilo/i);
});

test('byznys mentoring nepřepisuje konkrétní doporučení obecným koučovacím dotazem', () => {
  const mentoringTurn = {
    card: { ...practicalCard, family: 'business_offer' },
    steps: deriveTechniqueSteps(practicalCard),
    session: {
      techniqueId: practicalCard.id,
      mode: 'mentoringova_konzultace',
      phase: 'assessment',
      stepIndex: 0,
      status: 'active',
      turns: 1,
    },
  };
  const response = 'Uděláme nejdřív transparentní návrh trialu a ověříme, zda ekonomika vychází.';
  assert.equal(enforceTechniqueResponse(response, mentoringTurn), response);
});

test('běžné slovo viditelný nespouští souhlas určený pro tělesné nebo imaginativní techniky', () => {
  const businessCard = {
    ...practicalCard,
    id: 'ethical_free_trial_design',
    family: 'business_offer',
    core_move: 'Navrhni viditelnou cenu, datum obnovy a snadné zrušení.',
  };
  const turn = createTechniqueTurn({
    atlas: [businessCard],
    candidates: [businessCard],
    mode: 'mentoringova_konzultace',
    latestText: 'Chci nastavit free trial.',
    conversationContext: { userTurns: 1 },
  });
  assert.equal(turn.session.requiresConsent, false);
});

test('upozornění na zaseknutí pozastaví techniku a obnoví kontakt bez ztráty stavu', () => {
  const evaluation = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'evaluation', stepIndex: 0,
    status: 'active', turns: 5, requiresConsent: false,
  };
  const repair = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: evaluation, mode: 'koucovaci_hodina',
    latestText: 'Haló, slyšíš mě?', conversationContext: { userTurns: 6 },
  });
  assert.equal(repair.card.id, practicalCard.id);
  assert.equal(repair.session.phase, evaluation.phase);
  assert.equal(repair.session.stepIndex, evaluation.stepIndex);
  assert.equal(repair.session.turns, evaluation.turns);
  assert.equal(repair.suspended, true);
  assert.match(formatTechniqueExecution(repair), /stav techniky zůstává beze změny/i);
});

test('nulový účinek posledního kroku vede k intuitivní adaptaci, nikoli k falešnému úspěchu', () => {
  const steps = deriveTechniqueSteps(practicalCard);
  const finalEvaluation = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'evaluation',
    stepIndex: steps.length - 1, status: 'active', turns: 6, requiresConsent: false,
  };
  const adapted = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: finalEvaluation, mode: 'koucovaci_hodina',
    latestText: 'Pořád žádná změna, nepomáhá to.', conversationContext: { userTurns: 7 },
  });
  const protocol = formatTechniqueExecution(adapted);

  assert.equal(adapted.session.phase, 'integration');
  assert.equal(adapted.session.transitionReason, 'no_effect');
  assert.match(protocol, /neuzavírej automaticky celý proces/i);
  assert.match(protocol, /přejít k jiné vhodné metodě/i);
});

test('minulý čas „nic to neudělalo“ vede k adaptaci bez zadrátovaného tématu', () => {
  const selfTalkCard = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zjisti větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Ověř ji v nejbližší situaci.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const turn = createTechniqueTurn({
    atlas: [selfTalkCard],
    previous: {
      techniqueId: selfTalkCard.id, mode: 'koucovaci_podpora', phase: 'application', stepIndex: 3,
      status: 'active', turns: 6, requiresConsent: true, consentGranted: true,
    },
    mode: 'koucovaci_podpora',
    latestText: 'Zkusila jsem to, ale nic to neudělalo.',
    conversationContext: { userTurns: 7 },
  });
  const protocol = formatTechniqueExecution(turn);
  const generated = 'Samotná změna věty tentokrát nezabrala. Pojďme proto zjistit, co se děje těsně před odkladem.';
  const response = enforceTechniqueResponse(generated, turn, { latestText: 'Zkusila jsem to, ale nic to neudělalo.' });

  assert.equal(turn.session.phase, 'integration');
  assert.equal(turn.session.transitionReason, 'no_effect');
  assert.match(protocol, /předchozí krok nepřinesl účinek/i);
  assert.match(protocol, /neuzavírej automaticky celý proces/i);
  assert.equal(response, generated);
  assert.doesNotMatch(response, /web|workshop|účastnic/i);
});

test('citlivý souhlas a vyhodnocení účinku mají pevné fázové pojistky', () => {
  const consentTurn = {
    card: sensitiveCard,
    steps: deriveTechniqueSteps(sensitiveCard),
    session: {
      techniqueId: sensitiveCard.id, mode: 'somaticka_konzultace', phase: 'consent', stepIndex: 0,
      status: 'active', turns: 2, requiresConsent: true,
    },
  };
  const consent = enforceTechniqueResponse('Zavři oči a třikrát se nadechni.', consentTurn);
  assert.match(consent, /Nemusíš do něj jít/i);
  assert.match(consent, /kdykoli zastavit nebo zvolit jiný způsob/i);
  assert.doesNotMatch(consent, /zavři oči|nadechni/i);

  const evaluation = enforceTechniqueResponse('Zkusíme ještě další cvik.', {
    ...consentTurn,
    session: { ...consentTurn.session, phase: 'evaluation' },
  });
  assert.match(evaluation, /co je teď.*jiné, stejné nebo horší/i);
  assert.doesNotMatch(evaluation, /další cvik|zavři|nadechni/i);

  const validEvaluation = 'Čeho sis po tom kroku všimla — je něco jiné, stejné, nebo horší?';
  assert.equal(enforceTechniqueResponse(validEvaluation, {
    ...consentTurn,
    session: { ...consentTurn.session, phase: 'evaluation' },
  }), validEvaluation);
});

test('po zastavení techniky neprojde žádná další intervence ani skryté přepnutí metody', () => {
  const turn = {
    card: sensitiveCard,
    steps: deriveTechniqueSteps(sensitiveCard),
    session: {
      techniqueId: sensitiveCard.id,
      mode: 'somaticka_konzultace',
      phase: 'stopped',
      stepIndex: 0,
      status: 'stopped',
      turns: 3,
      stopReason: 'technique_stop',
    },
  };
  for (const generated of [
    'Zkus si tedy představit jiný výsledek.',
    'Pojďme pokračovat jinou technikou.',
    'Teď se soustřeď na dech.',
    'Dobře.',
  ]) {
    const response = enforceTechniqueResponse(generated, turn);
    assert.match(response, /postup „Tělesná orientace Nii“ tady zastavíme/i);
    assert.doesNotMatch(response, /představit jiný|jinou technikou|soustřeď na dech/i);
  }
});

test('výslovný konec rozhovoru už nenabízí další pokračování', () => {
  const turn = {
    card: practicalCard,
    steps: deriveTechniqueSteps(practicalCard),
    session: {
      techniqueId: practicalCard.id,
      mode: 'koucovaci_hodina',
      phase: 'stopped',
      stepIndex: 0,
      status: 'stopped',
      turns: 4,
      stopReason: 'user_stop',
    },
  };
  const response = enforceTechniqueResponse('Pojďme pokračovat jinou technikou.', turn);
  assert.match(response, /Tady končíme/i);
  assert.doesNotMatch(response, /můžeme|pokračovat jinou technikou/i);
});

test('zákaznický výzkum řídí atlasový krok a nevkládá do odpovědi Eliteu ani ženy', () => {
  const card = {
    ...practicalCard,
    id: 'customer_discovery',
    family: 'business_research',
    steps: [
      'Vyjasni přesnou skupinu žen a konkrétní problémovou hypotézu, kterou má výzkum ověřit.',
      'Urči jedinou rozhodující neznámou o minulém nebo současném chování zákaznice.',
    ],
    step_kinds: ['elicitation', 'elicitation'],
  };
  const turn = {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id,
      mode: 'mentoring',
      phase: 'application',
      stepIndex: 0,
      status: 'active',
      turns: 2,
      requiresConsent: false,
    },
  };
  const generated = 'Nejdřív potřebuji přesně vymezit zákazníka a problém, který má výzkum ověřit. Koho se tvoje nabídka týká?';
  const response = enforceTechniqueResponse(generated, turn);
  const protocol = formatTechniqueExecution(turn);

  assert.match(protocol, /Vyjasni přesnou skupinu žen a konkrétní problémovou hypotézu/i);
  assert.match(protocol, /Proveď pouze tento aktuální krok/i);
  assert.equal(response, generated);
  assert.doesNotMatch(response, /Elitea/i);
});

test('hluboké sezení nezůstává v povinné čekárně a citlivý krok si ponechá souhlas', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    family: 'cognitive_behavioral_coaching',
    core_move: 'Zachyť větu, odděl fakt, vytvoř nový self-talk a potom jej propoj s vizualizací a jednáním.',
    steps: [
      'Zachyť přesné znění vnitřní věty.',
      'Odděl ověřitelný fakt od absolutního závěru.',
      'Vytvoř pravdivější podpůrnou větu.',
      'Propoj novou větu s vizualizací a konkrétním jednáním.',
    ],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const first = createTechniqueTurn({
    atlas: [card], candidates: [card], mode: 'koucovaci_podpora', latestText: 'Jsem neschopná.',
    conversationContext: { userTurns: 1, depthStage: 'zakazka_a_zamer' },
  });
  const stillExploring = createTechniqueTurn({
    atlas: [card], candidates: [card], previous: first.session, mode: 'koucovaci_podpora',
    latestText: 'Nedokončila jsem web.',
    conversationContext: { userTurns: 2, depthStage: 'prohlubovani_mechanismu' },
  });
  const ready = createTechniqueTurn({
    atlas: [card], candidates: [card], previous: stillExploring.session, mode: 'koucovaci_podpora',
    latestText: 'Otevřu web, nevím kde začít, pak přepnu na Instagram.',
    conversationContext: { userTurns: 3, depthStage: 'pripraveno_k_cilene_praci' },
  });
  const newSentence = createTechniqueTurn({
    atlas: [card], candidates: [card], previous: ready.session, mode: 'koucovaci_podpora',
    latestText: 'Fakt je, že jsem se při nejasném začátku odpojila; není to důkaz celé mé neschopnosti.',
    conversationContext: { userTurns: 4, depthStage: 'pripraveno_k_cilene_praci' },
  });
  const consent = createTechniqueTurn({
    atlas: [card], candidates: [card], previous: newSentence.session, mode: 'koucovaci_podpora',
    latestText: 'Pravdivější věta je: když nevím kde začít, potřebuji si vymezit první část.',
    conversationContext: { userTurns: 5, depthStage: 'pripraveno_k_cilene_praci' },
  });

  assert.equal(first.session.stepIndex, 1);
  assert.equal(first.session.phase, 'assessment');
  assert.equal(stillExploring.session.phase, 'application');
  assert.equal(ready.session.phase, 'application');
  assert.equal(ready.session.stepIndex, 2);
  assert.equal(newSentence.session.phase, 'consent');
  assert.equal(newSentence.session.stepIndex, 3);
  assert.equal(consent.session.phase, 'consent');
  assert.equal(consent.session.stepIndex, 3);
});

test('editace self-talku používá atlasový krok a souhlas váže na konkrétní další krok', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const applicationTurn = {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id, mode: 'koucovaci_podpora', phase: 'application', stepIndex: 2,
      status: 'active', turns: 4, requiresConsent: true, consentGranted: false,
    },
  };
  const generated = 'Tohle je rozdíl mezi faktem a hodnocením celé sebe. Jak by zněla tvoje vlastní přesnější věta?';
  const response = enforceTechniqueResponse(generated, applicationTurn, {
    latestText: 'Neschopná je hodnocení, ne fakt.',
  });
  const protocol = formatTechniqueExecution(applicationTurn);
  const consent = enforceTechniqueResponse('', {
    ...applicationTurn,
    session: { ...applicationTurn.session, phase: 'consent', stepIndex: 3 },
  });

  assert.equal(response, generated);
  assert.match(protocol, /Proveď pouze tento aktuální krok: Vytvoř přesnější větu/i);
  assert.match(protocol, /Nepřeskakuj k dalšímu kroku/i);
  assert.match(consent, /propoj ji s vizualizací/i);
  assert.match(consent, /Chceš ho vyzkoušet\?/i);
});

test('R4 odpověď nevím není vydávána za vytvořenou přesnější větu', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    family: 'cognitive_behavioral_coaching',
    core_move: 'Vytvoř přesnější větu a potom ji propoj s vizualizací.',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const turn = createTechniqueTurn({
    atlas: [card],
    candidates: [card],
    previous: {
      techniqueId: card.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 2,
      status: 'active', turns: 3, requiresConsent: true, consentGranted: false,
    },
    mode: 'koucovaci_hodina',
    latestText: 'To nevím.',
    conversationContext: { userTurns: 4 },
  });
  assert.equal(turn.session.phase, 'application');
  assert.equal(turn.session.stepIndex, 2);
});

test('R4 odmítnutí souhlasu zastaví techniku a neopakuje nabídku', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const turn = createTechniqueTurn({
    atlas: [card],
    candidates: [card],
    previous: {
      techniqueId: card.id, mode: 'koucovaci_hodina', phase: 'consent', stepIndex: 3,
      status: 'active', turns: 4, requiresConsent: true, consentGranted: false,
    },
    mode: 'koucovaci_hodina',
    latestText: 'Ne.',
    conversationContext: { userTurns: 5 },
  });
  const response = enforceTechniqueResponse('', turn, {
    latestText: 'Ne.',
    messages: [{ role: 'user', content: 'Řešíme nepovedený workshop.' }],
  });
  assert.equal(turn.session.phase, 'stopped');
  assert.match(response, /postup „Přesná metoda Nii“ tady zastavíme/i);
  assert.doesNotMatch(response, /tři ženy|jedna odešla|dvě zůstaly/i);
  assert.doesNotMatch(response, /Chceš tímto krokem pokračovat/i);
});

test('přirozeně formulované odmítnutí souhlasu se nepovažuje za další krok techniky', () => {
  const card = {
    ...practicalCard,
    id: 'natural_refusal_test',
    family: 'mindfulness',
    steps: ['Zachyť situaci.', 'Krátce ji pozoruj.'],
  };
  for (const latestText of [
    'Ne, tohle opravdu dělat nechci.',
    'Tímhle směrem pokračovat nechci.',
    'Raději to vynechme.',
  ]) {
    const turn = createTechniqueTurn({
      atlas: [card],
      candidates: [card],
      previous: {
        techniqueId: card.id, mode: 'koucovaci_hodina', phase: 'consent', stepIndex: 1,
        status: 'active', turns: 2, requiresConsent: true, consentGranted: false,
      },
      mode: 'koucovaci_hodina',
      latestText,
      conversationContext: { userTurns: 3 },
    });
    assert.equal(turn.session.phase, 'stopped', latestText);
    assert.equal(turn.session.stopReason, 'consent_declined', latestText);
  }
});

test('R4 pozastavený repair tah zachová ukotvenou odpověď i stav techniky', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const grounded = 'Zatím víme, že přišly tři ženy a jedna odešla; důvod neznáme.';
  const turn = {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 2,
      status: 'active', turns: 3, requiresConsent: true, consentGranted: false,
    },
    suspended: true,
    suspensionReason: 'conversation_repair',
  };
  const response = enforceTechniqueResponse(grounded, turn, { latestText: 'Přišly tři ženy.' });
  assert.equal(response, grounded);
  assert.doesNotMatch(response, /přesnější větu/i);
});

test('provedení self-talku po souhlasu je řízeno jediným atlasovým krokem bez scénářové odpovědi', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const turn = {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id, mode: 'koucovaci_podpora', phase: 'application', stepIndex: 3,
      status: 'active', turns: 6, requiresConsent: true, consentGranted: true,
    },
  };
  const generated = 'Řekni si teď svou větu vlastními slovy a propoj ji s jednou konkrétní situací, kterou jsi popsala.';
  const response = enforceTechniqueResponse(generated, turn);
  const protocol = formatTechniqueExecution(turn);

  assert.equal(response, generated);
  assert.match(protocol, /Proveď pouze tento aktuální krok: Propoj ji s vizualizací/i);
  assert.match(protocol, /Nepřeskakuj k dalšímu kroku/i);
  assert.doesNotMatch(response, /nadpis|fotku|podstránku/i);
});

test('integrace self-talku je kontextově generovaná a protokol zakazuje vydávat dílčí účinek za hotový výsledek', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const turn = {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id, mode: 'koucovaci_podpora', phase: 'integration', stepIndex: 3,
      status: 'active', turns: 7, requiresConsent: true, consentGranted: true,
    },
  };
  const generated = 'Popsala jsi malou úlevu po prvním kroku. Co z něj bylo pro tuto konkrétní situaci užitečné?';
  const response = enforceTechniqueResponse(generated, turn, {
    latestText: 'Udělala jsem první krok a je mi o trochu lehčeji.',
  });
  const protocol = formatTechniqueExecution(turn);

  assert.equal(response, generated);
  assert.match(protocol, /Shrň pouze změnu, kterou členka sama popsala/i);
  assert.match(protocol, /Bez souhlasu nevytvářej domácí úkol/i);
  assert.doesNotMatch(response, /fungující pravidlo|dva dny|web|workshop/i);
});

test('behaviorální režim může začít vratným pracovním krokem bez povinného tříkolového čekání', () => {
  const first = createTechniqueTurn({
    atlas: [practicalCard], candidates: [practicalCard], mode: 'behavioralni_konzultace',
    latestText: 'Pořád odkládám.', conversationContext: { userTurns: 1 },
  });
  const second = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: first.session, mode: 'behavioralni_konzultace',
    latestText: 'Začnu upravovat text.', conversationContext: { userTurns: 2 },
  });
  const third = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: second.session, mode: 'behavioralni_konzultace',
    latestText: 'Upravila jsem první odstavec.', conversationContext: { userTurns: 3 },
  });
  const fourth = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: third.session, mode: 'behavioralni_konzultace',
    latestText: 'Ulevilo se mi, že už jsem začala.', conversationContext: { userTurns: 4 },
  });
  assert.equal(first.session.phase, 'application');
  assert.equal(second.session.phase, 'application');
  assert.equal(third.session.phase, 'evaluation');
  assert.equal(fourth.session.phase, 'application');
});

test('neplatný klientský stav se zahodí a interní protokol obsahuje jedinou povolenou fázi', () => {
  assert.equal(sanitizeTechniqueSession({ techniqueId: 'unknown', phase: 'application' }, [practicalCard]), null);
  const turn = createTechniqueTurn({
    atlas: [practicalCard], candidates: [practicalCard], mode: 'koucovaci_hodina',
    latestText: 'Chci se rozhodnout.', conversationContext: { userTurns: 1 },
  });
  const protocol = formatTechniqueExecution(turn);
  assert.match(protocol, /Aktuální fáze: application/);
  assert.doesNotMatch(protocol, /Neprováděj ještě techniku/);
  assert.match(protocol, /Metodika Nii, ověřená verze/);
});
