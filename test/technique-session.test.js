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
  assert.equal(classifyStopIntent('Workshopy už dělat nechci, ale s tebou pokračovat chci.'), 'external_stop');
  assert.equal(classifyStopIntent('Konzultace vést nechci.'), 'external_stop');
  assert.equal(classifyStopIntent('Ne, tímhle směrem pokračovat nechci.'), 'external_stop');

  const turn = createTechniqueTurn({
    atlas: [practicalCard], candidates: [practicalCard], previous: active,
    mode: 'koucovaci_hodina', latestText: 'Nechci pokračovat s workshopem.',
    conversationContext: { userTurns: 2 },
  });
  assert.equal(turn.card.id, practicalCard.id);
  assert.equal(turn.session.phase, 'awaiting_recontract');
  assert.equal(turn.session.resumePhase, active.phase);
  assert.equal(turn.session.refusedScope, 's workshopem');
  assert.equal(turn.session.stepIndex, active.stepIndex);
  assert.equal(turn.session.turns, active.turns);
  assert.equal(turn.suspended, true);
  assert.equal(turn.suspensionReason, 'external_stop');
  assert.match(formatTechniqueExecution(turn), /nezaměňuj jej za konec rozhovoru/i);
});

test('CZ odmítnutý rozsah zůstane mezi tahy pozastavený až do nové výslovné zakázky', () => {
  const active = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 1,
    status: 'active', turns: 4, requiresConsent: false,
  };
  const correctedScope = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard], candidates: [sensitiveCard], previous: active,
    mode: 'koucovaci_hodina', latestText: 'Končím s workshopy, ne s tebou.',
    conversationContext: { userTurns: 5 },
  });
  assert.equal(classifyStopIntent('Končím s workshopy, ne s tebou.'), 'external_stop');
  assert.equal(correctedScope.session.phase, 'awaiting_recontract');
  assert.equal(correctedScope.session.resumePhase, 'application');
  assert.equal(correctedScope.session.refusedScope, 's workshopy');
  assert.equal(correctedScope.session.stepIndex, 1);
  assert.equal(correctedScope.suspended, true);

  const vague = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard], candidates: [sensitiveCard], previous: correctedScope.session,
    mode: 'koucovaci_hodina', latestText: 'No to já nevím, proto tu jsem.',
    previousAssistantText: 'Beru, workshopy končí. Co chceš řešit místo nich?',
    conversationContext: { userTurns: 6 },
  });
  assert.equal(vague.card.id, practicalCard.id, 'Nová kandidátní technika nesmí obejít odmítnutou hranici.');
  assert.equal(vague.session.phase, 'awaiting_recontract');
  assert.equal(vague.session.refusedScope, 's workshopy');
  assert.equal(vague.session.stepIndex, 1);
  assert.equal(vague.suspended, true);
  assert.equal(vague.suspensionReason, 'awaiting_recontract');
  assert.match(formatTechniqueExecution(vague), /neobnovuj starou techniku/i);
  assert.match(formatTechniqueExecution(vague), /s workshopy/i);

  const newDirection = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard], candidates: [sensitiveCard], previous: vague.session,
    mode: 'koucovaci_hodina', latestText: 'Chci řešit, co budu dělat místo workshopů.',
    previousAssistantText: 'Co chceš řešit místo workshopů?',
    conversationContext: { userTurns: 7 },
  });
  assert.equal(newDirection.recontracted, true);
  assert.equal(newDirection.card.id, sensitiveCard.id);
  assert.equal(newDirection.session.techniqueId, sensitiveCard.id);
  assert.notEqual(newDirection.session.phase, 'awaiting_recontract');
});

test('SK odmietnutý rozsah zostane medzi ťahmi uzamknutý rovnako ako český', () => {
  const active = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'evaluation', stepIndex: 0,
    status: 'active', turns: 3, requiresConsent: false,
  };
  const correctedScope = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard], candidates: [sensitiveCard], previous: active,
    mode: 'koucovaci_hodina', latestText: 'Končím s workshopmi, nie s tebou.',
    conversationContext: { userTurns: 4 },
  });
  assert.equal(classifyStopIntent('Končím s workshopmi, nie s tebou.'), 'external_stop');
  assert.equal(correctedScope.session.phase, 'awaiting_recontract');
  assert.equal(correctedScope.session.resumePhase, 'evaluation');
  assert.equal(correctedScope.session.refusedScope, 's workshopmi');

  const vague = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard], candidates: [sensitiveCard], previous: correctedScope.session,
    mode: 'koucovaci_hodina', latestText: 'No ja neviem, preto som tu.',
    previousAssistantText: 'Beriem, workshopy končia. Čomu sa chceš venovať namiesto nich?',
    conversationContext: { userTurns: 5 },
  });
  assert.equal(vague.card.id, practicalCard.id);
  assert.equal(vague.session.phase, 'awaiting_recontract');
  assert.equal(vague.session.refusedScope, 's workshopmi');
  assert.equal(vague.suspended, true);

  const newDirection = createTechniqueTurn({
    atlas: [practicalCard, sensitiveCard], candidates: [sensitiveCard], previous: vague.session,
    mode: 'koucovaci_hodina', latestText: 'Chcem riešiť individuálne konzultácie namiesto workshopov.',
    previousAssistantText: 'Čomu sa chceš venovať namiesto workshopov?',
    conversationContext: { userTurns: 6 },
  });
  assert.equal(newDirection.recontracted, true);
  assert.equal(newDirection.session.techniqueId, sensitiveCard.id);
  assert.notEqual(newDirection.session.phase, 'awaiting_recontract');
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
    'Můžeš mi dát jednu krátkou otázku?',
    'Prosím, jen jednu krátkou otázku.',
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

test('CZ no-effect před souhlasem sticky blokuje dech, pojmenování pocitu i synonymní regulaci', () => {
  const breathCard = {
    ...sensitiveCard,
    id: 'gentle_breath_choice',
    name: 'Jemná práce s dechem s volbou',
    family: 'mindfulness',
    keywords: ['dech', 'napětí'],
    core_move: 'Nabídni přirozený dech bez nucení a ověř účinek.',
  };
  const emotionCard = {
    ...practicalCard,
    id: 'emotion_labeling',
    name: 'Přesné pojmenování emoce',
    family: 'emotion_skills',
    keywords: ['emoce', 'pocit'],
    core_move: 'Nech klientku přesně pojmenovat pocit.',
  };

  const afterBreath = createTechniqueTurn({
    atlas: [breathCard, emotionCard, practicalCard],
    candidates: [breathCard, practicalCard],
    mode: 'koucovaci_hodina',
    latestText: 'Zkusila jsem pomalý dech a vůbec mi nepomohl.',
    conversationContext: { userTurns: 1 },
  });
  assert.equal(afterBreath.suspended, true);
  assert.equal(afterBreath.session.phase, 'awaiting_recontract');
  assert.equal(afterBreath.suspensionReason, 'no_effect');
  assert.ok(afterBreath.session.blockedModalities.includes('breath'));
  assert.ok(afterBreath.session.blockedTechniqueIds.includes(breathCard.id));

  const afterLabeling = createTechniqueTurn({
    atlas: [breathCard, emotionCard, practicalCard],
    candidates: [emotionCard, practicalCard],
    previous: afterBreath.session,
    mode: 'koucovaci_hodina',
    latestText: 'Ani pojmenování pocitu nic nezměnilo. Nechci dokola zkoušet totéž.',
    previousAssistantText: 'Pomalý dech nebudeme opakovat. Co ti běží hlavou?',
    conversationContext: { userTurns: 2 },
  });
  assert.equal(afterLabeling.suspended, true);
  assert.equal(afterLabeling.session.phase, 'awaiting_recontract');
  assert.ok(afterLabeling.session.blockedModalities.includes('breath'));
  assert.ok(afterLabeling.session.blockedModalities.includes('emotion_labeling'));

  const boundary = createTechniqueTurn({
    atlas: [breathCard, emotionCard, practicalCard],
    candidates: [breathCard, emotionCard],
    previous: afterLabeling.session,
    mode: 'koucovaci_hodina',
    latestText: 'Prosím žádné další regulační cvičení. Potřebuji se podívat na konkrétní hovor.',
    previousAssistantText: 'Můžeme zkusit jinou cestu?',
    conversationContext: { userTurns: 3 },
  });
  assert.equal(classifyStopIntent('Prosím žádné další regulační cvičení.'), 'technique_stop');
  assert.equal(boundary.recontracted, true);
  assert.equal(boundary.session.phase, 'released');
  assert.ok(boundary.session.blockedTechniqueFamilies.includes('mindfulness'));
  assert.ok(boundary.session.blockedTechniqueFamilies.includes('emotion_skills'));
  assert.ok(boundary.session.blockedModalities.includes('somatic_regulation'));
  assert.match(formatTechniqueExecution(boundary), /není aktivní zamčená technika/i);

  const guarded = enforceTechniqueResponse(
    'Nabídnu ti přirozený dech bez tlaku. Chceš ho vyzkoušet?',
    boundary,
    { latestText: 'Prosím žádné další regulační cvičení. Potřebuji se podívat na konkrétní hovor.' },
  );
  assert.match(guarded, /regulační cvičení necháme stranou/i);
  assert.match(guarded, /konkrétnímu hovoru/i);
  assert.doesNotMatch(guarded, /chceš ho vyzkoušet|přirozený dech/i);

  const respectful = 'Pomalý dech nebudeme opakovat. Pojďme přímo ke konkrétnímu hovoru.';
  assert.equal(enforceTechniqueResponse(respectful, boundary, { latestText: 'Konkrétní hovor.' }), respectful);
});

test('SK no-effect a hranica regulačných cvičení zostávajú sticky rovnako ako české', () => {
  const breathCard = {
    ...sensitiveCard,
    id: 'gentle_breath_choice',
    name: 'Jemná práce s dechem s volbou',
    family: 'mindfulness',
    keywords: ['dech', 'napětí'],
    core_move: 'Nabídni přirozený dech bez nucení a ověř účinek.',
  };
  const first = createTechniqueTurn({
    atlas: [breathCard, practicalCard], candidates: [breathCard], mode: 'koucovaci_hodina',
    latestText: 'Skúsila som pomalý dych a vôbec mi nepomohol.', conversationContext: { userTurns: 1 },
  });
  assert.equal(first.session.phase, 'awaiting_recontract');
  assert.ok(first.session.blockedModalities.includes('breath'));

  const boundary = createTechniqueTurn({
    atlas: [breathCard, practicalCard], candidates: [breathCard], previous: first.session,
    mode: 'koucovaci_hodina',
    latestText: 'Prosím žiadne ďalšie regulačné cvičenie. Potrebujem sa pozrieť na konkrétny hovor.',
    previousAssistantText: 'Dych nebudeme opakovať.',
    conversationContext: { userTurns: 2 },
  });
  assert.equal(boundary.recontracted, true);
  assert.equal(boundary.session.phase, 'released');
  assert.ok(boundary.session.blockedModalities.includes('somatic_regulation'));

  const guarded = enforceTechniqueResponse(
    'Môžeme skúsiť prirodzený dych. Chceš ho vyskúšať?',
    boundary,
    { latestText: 'Prosím žiadne ďalšie regulačné cvičenie. Potrebujem sa pozrieť na konkrétny hovor.' },
  );
  assert.match(guarded, /regulačné cvičenia necháme bokom/i);
  assert.match(guarded, /konkrétnemu hovoru/i);
  assert.doesNotMatch(guarded, /prirodzený dych|vyskúšať/i);
});

test('zhoršení techniku zastaví, ale blokace nepříznivé modality přežije další tah', () => {
  const bodyCard = {
    ...sensitiveCard,
    id: 'body_scan_opt_out',
    family: 'mindfulness',
    core_move: 'Nabídni krátké všimnutí těla s možností ihned skončit.',
  };
  const stopped = createTechniqueTurn({
    atlas: [bodyCard, practicalCard], candidates: [], previous: {
      techniqueId: bodyCard.id, mode: 'koucovaci_hodina', phase: 'evaluation', stepIndex: 0,
      status: 'active', turns: 3, requiresConsent: true, consentGranted: true,
    },
    mode: 'koucovaci_hodina', latestText: 'Je mi po tělesném cvičení hůř.', conversationContext: { userTurns: 4 },
  });
  assert.equal(stopped.session.phase, 'stopped');
  assert.equal(stopped.session.stopReason, 'adverse_effect');
  assert.ok(stopped.session.blockedTechniqueIds.includes(bodyCard.id));
  assert.ok(stopped.session.blockedModalities.includes('somatic_regulation'));

  const next = createTechniqueTurn({
    atlas: [bodyCard, practicalCard], candidates: [bodyCard], previous: stopped.session,
    mode: 'koucovaci_hodina', latestText: 'Nevím, co dál.', conversationContext: { userTurns: 5 },
  });
  assert.equal(next.suspended, true);
  assert.equal(next.session.phase, 'stopped');
  assert.ok(next.session.blockedTechniqueIds.includes(bodyCard.id));
});

test('historická panika a výslovně negované zhoršení nejsou adverse effect', () => {
  const assessment = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [], previous: {
      techniqueId: sensitiveCard.id, mode: 'koucovaci_hodina', phase: 'assessment', stepIndex: 0,
      status: 'active', turns: 2, requiresConsent: true, consentGranted: false,
    },
    mode: 'koucovaci_hodina',
    latestText: 'Panika byla předtím, po kroku není horší.',
    conversationContext: { userTurns: 3 },
  });
  assert.notEqual(assessment.session.phase, 'stopped');
  assert.notEqual(assessment.session.stopReason, 'adverse_effect');

  const application = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [], previous: {
      techniqueId: sensitiveCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
      status: 'active', turns: 3, requiresConsent: true, consentGranted: true,
    },
    mode: 'koucovaci_hodina',
    latestText: 'Panika byla předtím, po kroku není horší.',
    conversationContext: { userTurns: 4 },
  });
  assert.notEqual(application.session.phase, 'stopped');
  assert.notEqual(application.session.stopReason, 'adverse_effect');
});

test('žádost neopakovat otázku je oprava rozhovoru, ne hranice metody', () => {
  const previous = {
    techniqueId: sensitiveCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
    status: 'active', turns: 3, requiresConsent: true, consentGranted: true,
  };
  const turn = createTechniqueTurn({
    atlas: [sensitiveCard], candidates: [], previous, mode: 'koucovaci_hodina',
    latestText: 'Neopakuj otázku, nerozuměla jsem.', conversationContext: { userTurns: 4 },
  });
  assert.equal(isConversationRepairRequest('Neopakuj otázku, nerozuměla jsem.'), true);
  assert.equal(turn.suspended, true);
  assert.equal(turn.suspensionReason, 'conversation_repair');
  assert.deepEqual(turn.session, sanitizeTechniqueSession(previous, [sensitiveCard]));
  assert.deepEqual(turn.session.blockedModalities, []);
});

test('výslovný návrat k odmítnuté technice odblokuje jen její ID, rodinu a modality', () => {
  const breathCard = {
    ...sensitiveCard,
    id: 'gentle_breath_choice',
    name: 'Jemná práce s dechem',
    family: 'mindfulness',
    core_move: 'Nabídni přirozený dech bez nucení.',
  };
  const paused = createTechniqueTurn({
    atlas: [breathCard, practicalCard], candidates: [breathCard], mode: 'koucovaci_hodina',
    latestText: 'Pomalý dech mi nepomohl.', conversationContext: { userTurns: 1 },
  });
  paused.session.blockedTechniqueIds.push(practicalCard.id);
  paused.session.blockedModalities.push('emotion_labeling');

  const resumed = createTechniqueTurn({
    atlas: [breathCard, practicalCard], candidates: [], previous: paused.session, mode: 'koucovaci_hodina',
    latestText: 'Chci se vrátit k té technice s dechem.', conversationContext: { userTurns: 2 },
  });
  assert.equal(resumed.recontracted, true);
  assert.notEqual(resumed.session.phase, 'awaiting_recontract');
  assert.equal(resumed.session.status, 'active');
  assert.equal(resumed.session.blockedTechniqueIds.includes(breathCard.id), false);
  assert.ok(resumed.session.blockedTechniqueIds.includes(practicalCard.id));
  assert.equal(resumed.session.blockedModalities.includes('breath'), false);
  assert.equal(resumed.session.blockedModalities.includes('mindfulness'), false);
  assert.ok(resumed.session.blockedModalities.includes('emotion_labeling'));

  const resumedByName = createTechniqueTurn({
    atlas: [breathCard, practicalCard], candidates: [], previous: paused.session, mode: 'koucovaci_hodina',
    latestText: 'Chci znovu zkusit pomalý dech.', conversationContext: { userTurns: 2 },
  });
  assert.equal(resumedByName.recontracted, true);
  assert.equal(resumedByName.session.blockedModalities.includes('breath'), false);
});

test('klauzový guard nepropustí přejmenovanou dechovou nabídku za bezpečnou negací', () => {
  const turn = {
    card: sensitiveCard,
    steps: deriveTechniqueSteps(sensitiveCard),
    suspended: true,
    suspensionReason: 'method_boundary',
    session: {
      techniqueId: sensitiveCard.id, mode: 'koucovaci_hodina', phase: 'awaiting_recontract', stepIndex: 0,
      status: 'paused', turns: 3, requiresConsent: true, blockedModalities: ['breath'],
    },
  };
  const response = enforceTechniqueResponse(
    'Dech nebudeme opakovat, ale zkusme přirozené dýchání.',
    turn,
    { latestText: 'Chci řešit konkrétní hovor.' },
  );
  assert.doesNotMatch(response, /zkusme přirozené dýchání/i);
  assert.match(response, /regulační cvičení necháme stranou/i);
  assert.doesNotMatch(response, /zasekla|prodejní/i);
});

test('pozitivní zmínka dechu vedle odmítnutí konce není no-effect ani method boundary', () => {
  const breathCard = {
    ...sensitiveCard,
    id: 'gentle_breath_choice',
    name: 'Jemná práce s dechem',
    family: 'mindfulness',
    core_move: 'Nabídni přirozený dech bez nucení.',
  };
  const turn = createTechniqueTurn({
    atlas: [breathCard], candidates: [breathCard], mode: 'koucovaci_hodina',
    latestText: 'Nechci skončit. Pomalý dech mi pomáhá.', conversationContext: { userTurns: 1 },
  });
  assert.equal(turn.card.id, breathCard.id);
  assert.equal(turn.suspended, undefined);
  assert.notEqual(turn.session.phase, 'awaiting_recontract');
  assert.deepEqual(turn.session.blockedModalities, []);
});

test('neúčinné pojmenování emoce neblokuje laskavost, agency ani validaci studu', () => {
  const labelingCard = {
    ...practicalCard,
    id: 'emotion_labeling',
    name: 'Přesné pojmenování emoce',
    family: 'emotion_skills',
    core_move: 'Nech klientku přesně pojmenovat pocit.',
  };
  const paused = createTechniqueTurn({
    atlas: [labelingCard], candidates: [labelingCard], mode: 'koucovaci_hodina',
    latestText: 'Pojmenování pocitu nic nezměnilo.', conversationContext: { userTurns: 1 },
  });
  assert.ok(paused.session.blockedModalities.includes('emotion_labeling'));
  assert.equal(paused.session.blockedTechniqueFamilies.includes('emotion_skills'), false);

  for (const candidate of [
    { ...practicalCard, id: 'self_compassion_break', name: 'Laskavá opora', family: 'emotion_skills', core_move: 'Zvol laskavou odpověď bez popírání reality.' },
    { ...practicalCard, id: 'agency_restore', name: 'Obnova agency', family: 'emotion_skills', core_move: 'Odděl ovlivnitelné a zvol vlastní další krok.' },
    { ...practicalCard, id: 'shame_validation', name: 'Validace studu', family: 'emotion_skills', core_move: 'Validuj stud bez globalizace identity.' },
  ]) {
    const next = createTechniqueTurn({
      atlas: [labelingCard, candidate], candidates: [candidate], previous: paused.session,
      mode: 'koucovaci_hodina', latestText: 'Místo toho chci řešit stud laskavě.',
      conversationContext: { userTurns: 2 },
    });
    assert.equal(next.recontracted, true, candidate.id);
    assert.equal(next.card.id, candidate.id);
    assert.notEqual(next.session.phase, 'awaiting_recontract');
  }
});

test('hranice a jasný nový směr v jedné CZ/SK zprávě přepnou práci okamžitě', () => {
  const breathCard = {
    ...sensitiveCard,
    id: 'gentle_breath_choice',
    name: 'Jemná práce s dechem',
    family: 'mindfulness',
    core_move: 'Nabídni přirozený dech bez nucení.',
  };
  for (const latestText of [
    'Žádná další regulační cvičení, chci řešit konkrétní hovor.',
    'Žiadne ďalšie regulačné cvičenia, chcem riešiť konkrétny hovor.',
  ]) {
    const turn = createTechniqueTurn({
      atlas: [breathCard, practicalCard], candidates: [breathCard, practicalCard], previous: {
        techniqueId: breathCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
        status: 'active', turns: 3, requiresConsent: true, consentGranted: true,
      },
      mode: 'koucovaci_hodina', latestText, conversationContext: { userTurns: 4 },
    });
    assert.equal(turn.recontracted, true, latestText);
    assert.equal(turn.card.id, practicalCard.id, latestText);
    assert.notEqual(turn.session.phase, 'awaiting_recontract', latestText);
    assert.ok(turn.session.blockedModalities.includes('breath'), latestText);
  }

  const freeConversation = createTechniqueTurn({
    atlas: [breathCard], candidates: [], previous: {
      techniqueId: breathCard.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 0,
      status: 'active', turns: 3, requiresConsent: true, consentGranted: true,
    },
    mode: 'koucovaci_hodina',
    latestText: 'Žádná další regulační cvičení, chci řešit konkrétní hovor.',
    conversationContext: { userTurns: 4 },
  });
  assert.equal(freeConversation.recontracted, true);
  assert.equal(freeConversation.card, null);
  assert.equal(freeConversation.session.phase, 'released');
  assert.ok(freeConversation.session.blockedModalities.includes('breath'));

  const carried = createTechniqueTurn({
    atlas: [breathCard], candidates: [], previous: freeConversation.session,
    mode: 'koucovaci_hodina', latestText: 'Řekl, že si to rozmyslí.',
    conversationContext: { userTurns: 5 },
  });
  assert.equal(carried.card, null);
  assert.equal(carried.session.phase, 'released');
  assert.ok(carried.session.blockedModalities.includes('breath'));
});

test('sanitize povolí jen rodiny skutečně přítomné v předaném atlasu', () => {
  const card = { ...sensitiveCard, family: 'mindfulness' };
  const session = sanitizeTechniqueSession({
    techniqueId: card.id,
    phase: 'awaiting_recontract',
    blockedTechniqueFamilies: ['mindfulness', 'injected_family'],
  }, [card]);
  assert.deepEqual(session.blockedTechniqueFamilies, ['mindfulness']);
});

test('fallback volí SK jen podle jednoznačně slovenských slov a nic nedoplňuje', () => {
  const turn = {
    card: sensitiveCard,
    steps: deriveTechniqueSteps(sensitiveCard),
    suspended: true,
    suspensionReason: 'method_boundary',
    session: {
      techniqueId: sensitiveCard.id, phase: 'awaiting_recontract', stepIndex: 0,
      blockedModalities: ['breath'],
    },
  };
  const generated = 'Můžeme zkusit pomalý dech?';
  const czech = enforceTechniqueResponse(generated, turn, { latestText: 'Chci řešit hovor.' });
  const slovak = enforceTechniqueResponse(generated, turn, { latestText: 'Potrebujem riešiť konkrétny hovor.' });
  assert.match(czech, /Regulační cvičení necháme stranou/);
  assert.doesNotMatch(czech, /zasekl|prodejn/i);
  assert.match(slovak, /Regulačné cvičenia necháme bokom/);
  assert.doesNotMatch(slovak, /zasekl|predajn/i);
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

test('slovenské odmítnutí a oprava mají stejné tvrdé hranice jako české', () => {
  assert.equal(classifyStopIntent('Nie, toto cvičenie nechcem.'), 'technique_stop');
  assert.equal(classifyStopIntent('Nechcem pokračovať s konzultáciami.'), 'external_stop');
  assert.equal(classifyStopIntent('Nie, týmto smerom pokračovať nechcem.'), 'external_stop');
  assert.equal(classifyStopIntent('Už nechcem pokračovať.'), 'external_or_ambiguous');
  assert.equal(isConversationRepairRequest('Zasa sa opakuješ.'), true);
  assert.equal(isConversationRepairRequest('Nerozumiem ti, povedz to jednoduchšie.'), true);
});
