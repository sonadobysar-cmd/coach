import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStopIntent,
  createTechniqueTurn,
  deriveTechniqueSteps,
  enforceTechniqueResponse,
  fixedTechniqueResponse,
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
  assert.equal(classifyStopIntent('Nechci pokračovat s workshopem.'), 'external_or_ambiguous');
  assert.equal(classifyStopIntent('Přestaň, chci ukončit sezení.'), 'conversation_stop');

  const turn = createTechniqueTurn({
    atlas: [practicalCard], candidates: [practicalCard], previous: active,
    mode: 'koucovaci_hodina', latestText: 'Nechci pokračovat s workshopem.',
    conversationContext: { userTurns: 2 },
  });
  assert.equal(turn.card, null);
  assert.equal(turn.session, null);
});

test('oprava klientky okamžitě uvolní techniku místo dalšího vynuceného kroku', () => {
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
    assert.equal(turn.card, null);
    assert.equal(turn.session, null);
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
  assert.notEqual(fixedTechniqueResponse(next), 'Než přidáme cokoli dalšího, potřebuji zůstat u účinku právě provedeného kroku. Co se teď změnilo — je to stejné, o trochu lepší, nebo horší?');
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

test('upozornění na zaseknutí nejprve uvolní techniku a obnoví kontakt', () => {
  const evaluation = {
    techniqueId: practicalCard.id, mode: 'koucovaci_hodina', phase: 'evaluation', stepIndex: 0,
    status: 'active', turns: 5, requiresConsent: false,
  };
  const repair = createTechniqueTurn({
    atlas: [practicalCard], candidates: [], previous: evaluation, mode: 'koucovaci_hodina',
    latestText: 'Haló, slyšíš mě?', conversationContext: { userTurns: 6 },
  });
  assert.equal(repair.card, null);
  assert.equal(repair.session, null);
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

test('minulý čas „nic to neudělalo“ je nulový účinek a self-talk plynule přejde k mechanismu', () => {
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
  const response = enforceTechniqueResponse('', turn, { latestText: 'Zkusila jsem to, ale nic to neudělalo.' });

  assert.equal(turn.session.phase, 'integration');
  assert.equal(turn.session.transitionReason, 'no_effect');
  assert.match(response, /nemusíme opakovat|nemusime opakovat/i);
  assert.match(response, /mechanismu/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('souhlas a kontrola účinku mají serverově vynucenou odpověď', () => {
  const consentTurn = {
    card: sensitiveCard,
    steps: deriveTechniqueSteps(sensitiveCard),
    session: {
      techniqueId: sensitiveCard.id, mode: 'somaticka_konzultace', phase: 'consent', stepIndex: 0,
      status: 'active', turns: 2, requiresConsent: true,
    },
  };
  const consent = enforceTechniqueResponse('Zavři oči a třikrát se nadechni.', consentTurn);
  assert.match(consent, /můžeš ho kdykoli odmítnout, změnit nebo zastavit/i);
  assert.doesNotMatch(consent, /zavři oči|nadechni/i);

  const evaluation = enforceTechniqueResponse('Zkusíme ještě další cvik.', {
    ...consentTurn,
    session: { ...consentTurn.session, phase: 'evaluation' },
  });
  assert.match(evaluation, /stejné, o trochu lepší, nebo horší/i);
  assert.doesNotMatch(evaluation, /další cvik/i);
  assert.equal(fixedTechniqueResponse(consentTurn), consent);
});

test('zákaznický výzkum po zjištění kanálu nezačne generickým plánem, ale vymezí cílovku a problém', () => {
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
  const response = enforceTechniqueResponse('Připrav web a oslov sto lidí.', {
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
  });
  assert.match(response, /koho a jaký skutečný problém/i);
  assert.match(response, /Kterou konkrétní skupinu žen/i);
  assert.doesNotMatch(response, /sto lidí|připrav web/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
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

test('editace self-talku nechá členku vytvořit vlastní větu a souhlas váže na konkrétní další krok', () => {
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
  const response = enforceTechniqueResponse('Skvělé. Vyber si jednu ze dvou vět.', applicationTurn, {
    latestText: 'Neschopná je hodnocení, ne fakt.',
  });
  const consent = enforceTechniqueResponse('', {
    ...applicationTurn,
    session: { ...applicationTurn.session, phase: 'consent', stepIndex: 3 },
  });

  assert.match(response, /nejde o pozitivní slogan/i);
  assert.match(response, /Jak bys ji řekla/i);
  assert.doesNotMatch(response, /vyber|dvou vět|Skvělé/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
  assert.match(consent, /nejbližší konkrétní situací a jedním činem/i);
  assert.match(consent, /Chceš tímto krokem pokračovat\?/i);
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
  assert.doesNotMatch(fixedTechniqueResponse(turn) || '', /Máme přesnější větu/i);
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
  assert.match(response, /tenhle postup dělat nebudeme/i);
  assert.match(response, /vrátím se k workshopu/i);
  assert.doesNotMatch(response, /Chceš tímto krokem pokračovat/i);
});

test('R4 odborně ukotvená odpověď má přednost před pevnou fází techniky', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const grounded = 'Zatím víme, že přišly tři ženy a jedna odešla; důvod neznáme.';
  const response = enforceTechniqueResponse(grounded, {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id, mode: 'koucovaci_hodina', phase: 'application', stepIndex: 2,
      status: 'active', turns: 3, requiresConsent: true, consentGranted: false,
    },
  }, { latestText: 'Přišly tři ženy.', authoritativeGrounding: true });
  assert.equal(response, grounded);
  assert.doesNotMatch(response, /přesnější větu/i);
});

test('provedení self-talku po souhlasu zůstane jediným krokem bez nabídky cizích odpovědí', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const response = enforceTechniqueResponse('Můžeš napsat nadpis, upravit fotku nebo otevřít podstránku.', {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id, mode: 'koucovaci_podpora', phase: 'application', stepIndex: 3,
      status: 'active', turns: 6, requiresConsent: true, consentGranted: true,
    },
  });
  assert.match(response, /svou přesnější větu vlastními slovy/i);
  assert.match(response, /jediný malý čin/i);
  assert.doesNotMatch(response, /nadpis|fotku|podstránku/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('integrace self-talku neudělá z jediného účinku hotové pravidlo ani nevyžádaný domácí úkol', () => {
  const card = {
    ...practicalCard,
    id: 'accurate_self_talk_edit',
    steps: ['Zachyť větu.', 'Odděl fakt.', 'Vytvoř přesnější větu.', 'Propoj ji s vizualizací.'],
    step_kinds: ['elicitation', 'elicitation', 'elicitation', 'intervention'],
  };
  const response = enforceTechniqueResponse('Máme fungující pravidlo na další dva dny.', {
    card,
    steps: card.steps,
    session: {
      techniqueId: card.id, mode: 'koucovaci_podpora', phase: 'integration', stepIndex: 3,
      status: 'active', turns: 7, requiresConsent: true, consentGranted: true,
    },
  }, { latestText: 'Udělala jsem první krok a je mi o trochu lehčeji.' });
  assert.match(response, /pozorovatelný rozdíl/i);
  assert.match(response, /neznamená to, že je celý vzorec vyřešený/i);
  assert.match(response, /Co bylo v okamžiku tohoto rozdílu rozhodující\?/i);
  assert.doesNotMatch(response, /pravidlo|dva dny|domácí úkol/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
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
