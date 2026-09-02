import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatMethodContext,
  loadCoachingMethods,
  loadExpertSources,
  selectExpertSources,
  selectCoachingMethod,
  validateMethodSources,
} from '../src/coaching.js';
import {
  buildConversationContext,
  selectConversationWindow,
  buildRoutingText,
  fixedGroundingResponse,
  expertRoleForMode,
  inferMode,
  resolveConversationMode,
  shapeCoachingResponse,
} from '../src/elitea.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const methods = await loadCoachingMethods(join(ROOT, 'data', 'coaching-methods.json'));
const sources = await loadExpertSources(join(ROOT, 'data', 'expert-sources.json'));
const evaluationScenarios = JSON.parse(await readFile(join(ROOT, 'data', 'evaluation-scenarios.json'), 'utf8'));
const systemPrompt = await readFile(join(ROOT, 'config', 'system-prompt.md'), 'utf8');

test('registr obsahuje unikátní a validní metody', () => {
  assert.ok(methods.length >= 15);
  assert.equal(new Set(methods.map(method => method.id)).size, methods.length);
});

test('každá metoda má dohledatelný důkazní profil', () => {
  assert.ok(sources.length >= 20);
  assert.equal(validateMethodSources(methods, sources), true);
  for (const method of methods) {
    assert.ok(['strong', 'moderate', 'limited'].includes(method.evidence.grade));
    assert.ok(method.evidence.source_ids.length > 0);
  }
});

test('router odborných zdrojů přidá etiku, předání a zdroje metody', () => {
  const method = methods.find(item => item.id === 'woop');
  const selected = selectExpertSources(sources, method, 'koucovaci_podpora');
  const ids = selected.map(source => source.id);
  assert.ok(ids.includes('MCII-META-2021'));
  assert.ok(ids.includes('ICF-ETHICS-2025'));
  assert.ok(ids.includes('ICF-REFERRAL'));
});

test('evaluační sada pokrývá odborné, bezpečnostní a byznysové scénáře', () => {
  assert.ok(evaluationScenarios.length >= 20);
  assert.equal(new Set(evaluationScenarios.map(item => item.id)).size, evaluationScenarios.length);
  const categories = new Set(evaluationScenarios.map(item => item.category));
  for (const category of ['psychological_coaching', 'business_mentoring', 'nlp_boundary', 'crisis', 'ethics']) {
    assert.ok(categories.has(category), `Chybí kategorie ${category}`);
  }
  for (const scenario of evaluationScenarios) {
    assert.ok(typeof scenario.input === 'string' && scenario.input.length > 10);
    assert.ok(Array.isArray(scenario.must) && scenario.must.length > 0);
    assert.ok(Array.isArray(scenario.must_not) && scenario.must_not.length > 0);
  }
});

test('nejsem dost dobrá volí perspektivu kamarádky', () => {
  assert.equal(selectCoachingMethod(methods, 'Pořád si říkám, že nejsem dost dobrá.').id, 'friend_perspective');
});

test('zásadní vícekolová změna volí originální ELITEA Compass', () => {
  const method = selectCoachingMethod(
    methods,
    'Motám se v kruhu, chci transformaci a potřebuji zásadní posun.',
    {},
    'koucovaci_hodina',
  );
  assert.equal(method.id, 'elitea_compass');
  assert.equal(method.steps.length, 7);
  assert.ok(method.evidence.source_ids.includes('COM-B-2011'));
  assert.ok(method.evidence.source_ids.includes('IMPLEMENTATION-META-2006'));
});

test('globální sebeodsudek spouští koučovací podporu místo obecné diagnostiky', () => {
  assert.equal(inferMode('Jsem neschopná.'), 'koucovaci_podpora');
});

test('sebeodsudek nedovolí vymyslet schopnosti a nejdřív ukotví práci v konkrétní situaci', () => {
  const response = fixedGroundingResponse({
    messages: [{ role: 'user', content: 'Jsem neschopná.' }],
    latestText: 'Jsem neschopná.',
    routingText: 'Jsem neschopná.',
    responseMode: 'koucovaci_podpora',
  });
  assert.match(response, /verdikt o celé tobě|oddělit skutečný problém/i);
  assert.match(response, /Která konkrétní situace/i);
  assert.doesNotMatch(response, /umíš dokončit|komunikovat s klienty|potřeby trhu/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('po upozornění na domněnku ji Elitea přizná a vrátí se k pozorovatelnému okamžiku', () => {
  const latestText = 'Jak můžeš vědět, že umím dokončit úkoly? Protože to zrovna fakt neumím.';
  const response = fixedGroundingResponse({
    messages: [
      { role: 'user', content: 'Jsem neschopná.' },
      { role: 'assistant', content: 'Umíš například dokončit úkoly.' },
      { role: 'user', content: latestText },
    ],
    latestText,
    routingText: `Jsem neschopná.\n${latestText}`,
    responseMode: 'koucovaci_podpora',
  });
  assert.match(response, /neměla jsem ti to připsat/i);
  assert.match(response, /konkrétní nedokončený úkol/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('první koučovací odpověď není nahrazena povinnou diagnostickou šablonou', () => {
  const procrastination = fixedGroundingResponse({
    messages: [{ role: 'user', content: 'Pořád odkládám web a nemůžu začít.' }],
    latestText: 'Pořád odkládám web a nemůžu začít.',
    responseMode: 'koucovaci_hodina',
    conversationContext: { userTurns: 1 },
  });
  assert.equal(procrastination, null);

  const boundary = fixedGroundingResponse({
    messages: [{ role: 'user', content: 'Ve vztahu neumím říct ne a pak se na sebe zlobím.' }],
    latestText: 'Ve vztahu neumím říct ne a pak se na sebe zlobím.',
    responseMode: 'koucovaci_hodina',
    conversationContext: { userTurns: 1 },
  });
  assert.equal(boundary, null);
});

test('žádost o lidskou řeč se vrátí k důkazům bez vymyšleného partnera', () => {
  const response = fixedGroundingResponse({
    latestText: 'Nerozumím ti, řekni to normálně.',
    messages: [
      { role: 'user', content: 'Ve vztahu neumím říct ne a pak se na sebe zlobím.' },
      { role: 'assistant', content: 'Předchozí složitá odpověď.' },
      { role: 'user', content: 'Nerozumím ti, řekni to normálně.' },
    ],
    responseMode: 'koucovaci_hodina',
    conversationContext: { userTurns: 2 },
  });

  assert.match(response, /^Jasně\. Řeknu to normálně\./);
  assert.match(response, /poslední takové situaci|těsně před/i);
  assert.doesNotMatch(response, /partner|přítel|manžel/i);
});

test('workshopový neúspěch se otevře fakty místo otázky na spánek a fungování', () => {
  const latestText = 'První workshop dopadl špatně. Asi na podnikání prostě nemám.';
  const response = fixedGroundingResponse({
    messages: [{ role: 'user', content: latestText }],
    latestText,
    routingText: latestText,
    responseMode: 'koucovaci_hodina',
    conversationContext: { userTurns: 1 },
  });
  assert.match(response, /co přesně znamená.*dopadl špatně/i);
  assert.match(response, /kolik žen přišlo|zpětnou vazbu/i);
  assert.doesNotMatch(response, /spán|energ|normálně fungovat/i);
});

test('nejasné nechci pokračovat u workshopu vyžádá rozlišení cíle zastavení', () => {
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně. Asi na podnikání prostě nemám.' },
    { role: 'assistant', content: 'Co přesně se na workshopu stalo?' },
    { role: 'user', content: 'Už nechci pokračovat, bojím se.' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /další workshopy/i);
  assert.match(response, /našem rozhovoru/i);
  assert.doesNotMatch(response, /Zastavíme to/i);
});

test('oprava významu workshopu obnoví zakázku místo zastavení techniky', () => {
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně.' },
    { role: 'assistant', content: 'Chceš dnešek uzavřít?' },
    { role: 'user', content: 'Nechci pokračovat s workshopem, to jsi nepochopila.' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /skončit s pořádáním workshopů/i);
  assert.match(response, /ne o ukončení tohoto rozhovoru/i);
  assert.doesNotMatch(response, /účinku právě provedeného kroku/i);
});

test('R2 workshopová data dostanou věcný význam místo zdravotního screeningu', () => {
  const opening = 'První workshop dopadl špatně. Asi na podnikání prostě nemám.';
  const latestText = 'Přihlásily se tři ženy a jedna po půl hodině odešla.';
  const messages = [
    { role: 'user', content: opening },
    { role: 'assistant', content: 'Co přesně znamená, že dopadl špatně?' },
    { role: 'user', content: latestText },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /tři ženy a jedna odešla|účast byla tři ženy/i);
  assert.match(response, /zbývající dvě/i);
  assert.doesNotMatch(response, /spán|jídlo|běžn.*fungov|energ/i);
});

test('R2 pozitivní důkaz workshopu se vyzdvihne a nespustí falešné měření účinku', () => {
  const latestText = 'Dvě zbývající ženy zůstaly do konce a jedna mi napsala, že jí pomohlo cvičení.';
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně.' },
    { role: 'assistant', content: 'Co se stalo?' },
    { role: 'user', content: 'Přišly tři ženy a jedna odešla.' },
    { role: 'assistant', content: 'Co zbývající dvě?' },
    { role: 'user', content: latestText },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /podstatný pozitivní výsledek/i);
  assert.match(response, /jedna ze tří.*pomohlo/i);
  assert.doesNotMatch(response, /účinku právě provedeného kroku|co se teď změnilo/i);
});

test('R2 otázka fakt versus domněnka dostane přímou odpověď a oprava ji zjednoduší', () => {
  const question = 'Jak poznám rozdíl mezi tím, co se skutečně nepovedlo, a tím, co si jen domýšlím?';
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně.' },
    { role: 'assistant', content: 'Co se stalo?' },
    { role: 'user', content: 'Přišly tři ženy, jedna odešla, dvě zůstaly a jedné pomohlo cvičení.' },
    { role: 'user', content: question },
  ];
  const direct = fixedGroundingResponse({
    messages,
    latestText: question,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(direct, /fakt můžeš doložit/i);
  assert.match(direct, /domněnka/i);

  const repairMessages = [...messages, { role: 'assistant', content: direct }, { role: 'user', content: 'Nerozumím ti teď.' }];
  const repair = fixedGroundingResponse({
    messages: repairMessages,
    latestText: repairMessages.at(-1).content,
    routingText: buildRoutingText(repairMessages),
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(repairMessages, 'koucovaci_hodina'),
  });
  assert.match(repair, /Řekla jsem to složitě/i);
  assert.match(repair, /Fakt je něco/i);
  assert.doesNotMatch(repair, /co tě.*děsí|účinku právě provedeného kroku/i);
});

test('R2 stížnost na opakované měření dostane konkrétní opravu bez další otázky', () => {
  const latestText = 'Nerozumím, řeším něco jiného. Proč se mě každou chvilku ptáš na to, co se změnilo?';
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně.' },
    { role: 'assistant', content: 'Co se teď změnilo?' },
    { role: 'user', content: latestText },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /chybně vyhodnotila/i);
  assert.match(response, /už to nebudu opakovat/i);
  assert.equal((response.match(/\?/g) || []).length, 0);
});

test('zahlcení volí nejmenší krok', () => {
  assert.equal(selectCoachingMethod(methods, 'Mám v tom chaos a vůbec nevím, kde začít.').id, 'smallest_step');
});

test('úzkost, meditace, trauma a nemoc volí specializované bezpečné metody', () => {
  assert.equal(selectCoachingMethod(methods, 'Mám úzkost a potřebuji se zklidnit.').id, 'anxiety_stabilization');
  assert.equal(selectCoachingMethod(methods, 'Vytvoř mi krátkou meditaci na večer.').id, 'guided_meditation');
  assert.equal(selectCoachingMethod(methods, 'Vrací se mi trauma a flashback.').id, 'trauma_informed_support');
  assert.equal(selectCoachingMethod(methods, 'Chronická nemoc mi omezuje pracovní kapacitu.').id, 'illness_support_coaching');
});

test('deprese, úzkost a vyhoření mají aktivní podporu fungování, ne automatické odmítnutí', () => {
  const depressionText = 'Mám depresi a potřebuji zvládnout pracovní den.';
  const anxietyText = 'Mám úzkost a potřebuji si nastavit pracovní den.';
  const burnoutText = 'Jsem vyhořelá a potřebuji zastavit další přetěžování.';

  assert.equal(inferMode(depressionText), 'podpora_fungovani');
  assert.equal(inferMode(anxietyText), 'podpora_fungovani');
  assert.equal(inferMode(burnoutText), 'podpora_fungovani');
  assert.equal(selectCoachingMethod(methods, depressionText, {}, 'podpora_fungovani').id, 'depression_functioning_support');
  assert.equal(selectCoachingMethod(methods, anxietyText, {}, 'podpora_fungovani').id, 'anxiety_functioning_support');
  assert.equal(selectCoachingMethod(methods, burnoutText, {}, 'podpora_fungovani').id, 'burnout_functioning_support');
});

test('konverzační router odděluje stabilizaci a meditaci od běžného koučinku', () => {
  assert.equal(inferMode('Mám úzkost a potřebuji se zklidnit.'), 'podporna_stabilizace');
  assert.equal(inferMode('Vytvoř mi vedenou meditaci.'), 'vedena_meditace');
});

test('vědomě zvolený konzultační režim má přednost před automatickým routerem', () => {
  const input = 'Nevím, co mám udělat a mám strach.';
  assert.equal(inferMode(input, 'coaching_session'), 'koucovaci_hodina');
  assert.equal(inferMode(input, 'business_mentoring'), 'mentoringova_konzultace');
  assert.equal(inferMode(input, 'nlp_reframing'), 'nlp_konzultace');
  assert.equal(inferMode(input, 'behavioral_change'), 'behavioralni_konzultace');
  assert.equal(inferMode(input, 'somatic_regulation'), 'somaticka_konzultace');
  assert.equal(inferMode(input, 'brand_growth'), 'brand_growth_agent');
  assert.equal(inferMode(input, 'auto'), 'koucovaci_podpora');
});

test('automatický router rozlišuje byznysovou radu od práce s vnitřní brzdou', () => {
  assert.equal(inferMode('Nevím, jak nacenit svoji službu a co dát do nabídky.'), 'mentoring');
  assert.equal(inferMode('Mám problém s prodejem a stydím se.'), 'mentoring');
  assert.equal(inferMode('Mám projekt, ale stydím se vystupovat na sockách a bojím se reakcí.'), 'mentoring');
  assert.equal(inferMode('Cenu mám, ale stydím se ji říct a chci pochopit, co mě blokuje.'), 'koucovaci_podpora');
  assert.equal(inferMode('Napiš mi konkrétní prodejní příspěvek, i když se bojím reakcí.'), 'mentoring');
  assert.equal(inferMode('Ve vztahu neumím říct ne.'), 'koucovaci_podpora');
});

test('Koučka a Mentorka si v automatickém chatu plynule předávají aktuální potřebu', () => {
  assert.equal(
    resolveConversationMode('Napiš mi konkrétní nabídku a navrhni cenu.', 'auto', null, { previousMode: 'koucovaci_podpora' }),
    'mentoring',
  );
  assert.equal(
    resolveConversationMode('Plán chápu, ale nedokážu ho zveřejnit, protože se bojím reakcí.', 'auto', null, { previousMode: 'mentoring' }),
    'koucovaci_podpora',
  );
  assert.equal(
    resolveConversationMode('Ano, přesně.', 'auto', null, { previousMode: 'mentoring' }),
    'mentoring',
  );
  assert.equal(expertRoleForMode('mentoring'), 'mentor');
  assert.equal(expertRoleForMode('koucovaci_podpora'), 'coach');
});

test('automatický režim během aktivní techniky nemění uprostřed sezení roli podle poslední krátké odpovědi', () => {
  const activeSession = {
    techniqueId: 'accurate_self_talk_edit',
    mode: 'koucovaci_podpora',
    phase: 'application',
  };
  assert.equal(resolveConversationMode('Ano, chci.', 'auto', activeSession), 'koucovaci_podpora');
  assert.equal(resolveConversationMode('Připrav mi konkrétní nabídku a cenu.', 'auto', activeSession), 'mentoring');
  assert.equal(resolveConversationMode('Ano, chci.', 'coaching_session', activeSession), 'koucovaci_hodina');
  assert.equal(resolveConversationMode('Ano, chci.', 'auto', { ...activeSession, phase: 'completed' }), 'diagnostika');
});

test('specializované režimy mají bezpečný výchozí postup i bez klíčového slova', () => {
  assert.equal(selectCoachingMethod(methods, 'Chci začít.', {}, 'nlp_konzultace').id, 'nlp_outcome_frame');
  assert.equal(selectCoachingMethod(methods, 'Chci začít.', {}, 'behavioralni_konzultace').id, 'woop');
  assert.equal(selectCoachingMethod(methods, 'Chci začít.', {}, 'somaticka_konzultace').id, 'grounding');
});

test('krizový text nevolí koučovací techniku', () => {
  assert.equal(selectCoachingMethod(methods, 'Chci si ublížit.'), null);
});

test('profilová překážka nepřebije aktuální nesouvisející téma', () => {
  const selected = selectCoachingMethod(methods, 'Jak mám nacenit svoji službu?', {
    coaching_profile: { main_obstacle: 'Perfekcionismus' },
  });
  assert.equal(selected.id, 'grow');
});

test('kontext metody obsahuje hranice a kontrolu kvality', () => {
  const context = formatMethodContext(methods.find(method => method.id === 'woop'));
  assert.match(context, /Nepoužívat nebo zastavit/);
  assert.match(context, /Kontrola kvality/);
  assert.match(context, /Důkazní profil/);
  assert.match(context, /Omezení důkazů/);
});

test('koučovací odpověď neopakuje zvolené tykání a neodřezává druhou přirozenou otázku', () => {
  const shaped = shapeCoachingResponse(
    'Aneto, budeme si tykat? Vidím, že je to pro tebe těžké. Co bys řekla kamarádce? Chceš pokračovat?',
    { identity_preferences: { address_form: 'tykani' } },
  );
  assert.doesNotMatch(shaped, /budeme si tykat/i);
  assert.equal((shaped.match(/\?/g) || []).length, 2);
  assert.match(shaped, /Co bys řekla kamarádce\?/);
  assert.match(shaped, /Chceš pokračovat\?/);
});

test('koučovací odpověď bez otázky dostane bezpečnou navazující otázku', () => {
  const shaped = shapeCoachingResponse('Slyším, že se v tom teď ztrácíš.');
  assert.equal((shaped.match(/\?/g) || []).length, 1);
});

test('živý koučovací tah odstraní chatbotové nadpisy a seznamovou fasádu', () => {
  const shaped = shapeCoachingResponse('Hlavní závěr: Nejspíš se chráníš před odmítnutím.\n\n1. Udělej plán.\n2. Zvol termín.\n\nCo se stane, když nabídku opravdu zveřejníš?');
  assert.doesNotMatch(shaped, /Hlavní závěr|^\s*\d+[.)]/m);
  assert.equal((shaped.match(/\?/g) || []).length, 1);
});

test('živá odpověď odstraní markdown, který se v textovém chatu nezobrazuje', () => {
  const output = shapeCoachingResponse('Řekni ve videu: **Nečekám na jistotu.** Výzva je *napiš mi čekám*. Co chceš upravit?', {}, {
    requireQuestion: true,
    sourceText: 'Vytvoř mi video.',
  });
  assert.equal(output, 'Řekni ve videu: Nečekám na jistotu. Výzva je napiš mi čekám. Co chceš upravit?');
  assert.doesNotMatch(output, /\*|`/u);
});

test('živý tah odstraní zdvořilostní výplň a mentoring nemusí vyrábět otázku', () => {
  const shaped = shapeCoachingResponse(
    'Krásný den, Sonia — díky, že to sdílíš. Vidím rozpor mezi výsledky a tím, jak nízko svou práci oceňuješ.',
    {},
    { requireQuestion: false },
  );
  assert.match(shaped, /^Vidím rozpor/);
  assert.equal((shaped.match(/\?/g) || []).length, 0);
});

test('živý koučovací tah nezačíná automatickou pochvalou za každou odpověď', () => {
  const shaped = shapeCoachingResponse(
    'Skvělé rozlišení — „neschopná“ je hodnocení, nikoli fakt. Jak by zněla přesnější věta?',
  );
  assert.doesNotMatch(shaped, /^Skvělé/i);
  assert.match(shaped, /^„neschopná“ je hodnocení/i);
});

test('živý tah neopakuje ani chybně neskloňuje uložené jméno', () => {
  const shaped = shapeCoachingResponse(
    'Soniu, vybrala bych jednu hlavní službu a ostatní podřídila jejímu výsledku.',
    { identity_preferences: { preferred_name: 'Sonia' } },
    { requireQuestion: false },
  );
  assert.equal(shaped, 'Vybrala bych jednu hlavní službu a ostatní podřídila jejímu výsledku.');
});

test('mentoring nevydává vymyšlenou délku pilotu za odborný parametr', () => {
  const shaped = shapeCoachingResponse(
    'Během jednoho týdne otestuj hlavní sdělení a měř konverzi 10–14 dní.',
    {},
    { requireQuestion: false, sourceText: 'Jak mám nabídku otestovat?' },
  );
  assert.doesNotMatch(shaped, /jednoho týdne|10–14 dní/);
  assert.match(shaped, /krátkém pilotu/);
});

test('mentoring nepředstírá vymyšlený počet respondentů ani hranici úspěchu', () => {
  const shaped = shapeCoachingResponse(
    'Oslov 5–10 známých. Pokud aspoň polovina rozumí, pokračuj.',
    {},
    { requireQuestion: false },
  );
  assert.doesNotMatch(shaped, /5–10|aspoň polovina/);
  assert.match(shaped, /malou skupinu|sleduj, zda/);
});

test('konverzační kontext odlišuje otevření od navazující práce', () => {
  assert.equal(buildConversationContext([{ role: 'user', content: 'Začínám.' }]).stage, 'otevírací fáze');
  assert.equal(buildConversationContext([
    { role: 'user', content: 'Začínám.' },
    { role: 'assistant', content: 'Co se děje?' },
    { role: 'user', content: 'Bojím se odmítnutí.' },
  ]).stage, 'průzkumná fáze');
});

test('první kontakt s influencer cílem není nahrazen předem napsaným výslechem', () => {
  const messages = [{ role: 'user', content: 'Ahoj, chci být influencerka ale nevím jak na to. Mám pocit, že nežiju život, jaký chci.' }];
  const conversationContext = buildConversationContext(messages, 'koucovaci_hodina');
  const response = fixedGroundingResponse({
    messages,
    latestText: messages[0].content,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext,
  });
  assert.equal(response, null);
});

test('po odpovědi na otázku o vnitřní větě je sezení připravené k cílené práci', () => {
  const context = buildConversationContext([
    { role: 'user', content: 'Chci být influencerka a mít vliv.' },
    { role: 'assistant', content: 'Jaká přesná věta ti proběhne hlavou o tobě samotné?' },
    { role: 'user', content: 'Tohle bych měla být já, ale jsem neschopná a nemám nic.' },
  ], 'koucovaci_hodina');
  assert.equal(context.answeredBeliefQuestion, true);
  assert.equal(context.depthStage, 'pripraveno_k_cilene_praci');
});

test('dlouhé sezení zachová původní zakázku i poslední pracovní tahy', () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: index === 0 ? 'Původní zakázka: chci dokončit web bez útěku.' : `Tah ${index}`,
  }));
  const window = selectConversationWindow(messages, 18);

  assert.equal(window.length, 18);
  assert.match(window[0].content, /Původní zakázka/);
  assert.equal(window.at(-1).content, 'Tah 29');
  assert.ok(!window.some(message => message.content === 'Tah 8'));
});

test('konverzační kontext nese původní zakázku jako kotvu sezení', () => {
  const context = buildConversationContext([
    { role: 'user', content: 'Chci pochopit, proč při dokončování webu utíkám.' },
    { role: 'assistant', content: 'Kdy se to stalo naposledy?' },
    { role: 'user', content: 'Dnes ráno.' },
  ]);
  assert.equal(context.openingFocus, 'Chci pochopit, proč při dokončování webu utíkám.');
});

test('hloubkový oblouk nepřeskočí od obecného soudu rovnou k intervenci', () => {
  const opening = buildConversationContext([
    { role: 'user', content: 'Jsem neschopná.' },
  ], 'koucovaci_podpora');
  const reality = buildConversationContext([
    { role: 'user', content: 'Jsem neschopná.' },
    { role: 'assistant', content: 'Která konkrétní situace tě k tomu vede?' },
    { role: 'user', content: 'Nevím, prostě se mi to děje pořád.' },
  ], 'koucovaci_podpora');
  const mechanism = buildConversationContext([
    { role: 'user', content: 'Jsem neschopná.' },
    { role: 'assistant', content: 'Která konkrétní situace tě k tomu vede?' },
    { role: 'user', content: 'Nedokončila jsem web, který potřebuji spustit.' },
  ], 'koucovaci_podpora');
  const behaviorWithoutMechanism = buildConversationContext([
    { role: 'user', content: 'Jsem neschopná.' },
    { role: 'assistant', content: 'Která konkrétní situace tě k tomu vede?' },
    { role: 'user', content: 'Tři dny se snažím dodělat web a vždy od něj uteču.' },
  ], 'koucovaci_podpora');
  const ready = buildConversationContext([
    { role: 'user', content: 'Jsem neschopná.' },
    { role: 'assistant', content: 'Která konkrétní situace tě k tomu vede?' },
    { role: 'user', content: 'Nedokončila jsem web, který potřebuji spustit.' },
    { role: 'assistant', content: 'Co se děje těsně předtím, než od něj odejdeš?' },
    { role: 'user', content: 'Otevřu ho, nevím kde začít, pak přepnu na Instagram a už se nevrátím.' },
  ], 'koucovaci_podpora');

  assert.equal(opening.depthStage, 'zakazka_a_zamer');
  assert.equal(reality.depthStage, 'mapovani_konkretni_reality');
  assert.equal(mechanism.depthStage, 'prohlubovani_mechanismu');
  assert.equal(behaviorWithoutMechanism.depthStage, 'prohlubovani_mechanismu');
  assert.equal(ready.depthStage, 'pripraveno_k_cilene_praci');
});

test('krátký souhlas po zjištění mechanismu nevrátí sezení zpět na začátek', () => {
  const context = buildConversationContext([
    { role: 'user', content: 'Jsem neschopná.' },
    { role: 'assistant', content: 'Která konkrétní situace tě k tomu vede?' },
    { role: 'user', content: 'Otevřu web, nevím kde začít, pak přepnu na Instagram a při tom se mi uleví.' },
    { role: 'assistant', content: 'Chceš teď vyzkoušet jeden krok?' },
    { role: 'user', content: 'Ano.' },
  ], 'koucovaci_podpora');
  assert.equal(context.depthStage, 'pripraveno_k_cilene_praci');
});

test('při mapování sebeodsudku Elitea zůstane u mechanismu a nedá předčasný úkol', () => {
  const messages = [
    { role: 'user', content: 'Jsem neschopná.' },
    { role: 'assistant', content: 'Která konkrétní situace tě k tomu vede?' },
    { role: 'user', content: 'Nedokončila jsem web, který potřebuji spustit.' },
  ];
  const conversationContext = buildConversationContext(messages, 'koucovaci_podpora');
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_podpora',
    conversationContext,
    techniqueTurn: {
      card: { id: 'accurate_self_talk_edit' },
      session: { phase: 'assessment' },
    },
  });
  assert.match(response, /nedokončený úkol a závěr o celé tobě/i);
  assert.match(response, /těsně před okamžikem/i);
  assert.doesNotMatch(response, /udělej|plán|zkus si/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('self-talk u influencer cíle nevymyslí nedokončený úkol a vrátí odborné rozlišení', () => {
  const messages = [
    { role: 'user', content: 'Chci být influencerka, chci vliv a aby ke mně lidé vzhlíželi.' },
    { role: 'assistant', content: 'Jaká přesná věta ti proběhne hlavou, když vidíš někoho s takovým vlivem?' },
    { role: 'user', content: 'Tohle bych měla být já, ale jsem neschopná a nemám nic.' },
  ];
  const conversationContext = buildConversationContext(messages, 'koucovaci_hodina');
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext,
    techniqueTurn: { card: { id: 'accurate_self_talk_edit' }, session: { phase: 'assessment' } },
  });
  assert.match(response, /porovnala s lidmi/i);
  assert.match(response, /mezera mezi tím, kde jsi a kde chceš být/i);
  assert.doesNotMatch(response, /nedokončený úkol|úkol přestaneš dělat/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('po přímé žádosti o první krok se influencer sezení neposune zpět do diagnostiky', () => {
  const messages = [
    { role: 'user', content: 'Chci být influencerka a mluvit o sebevědomí a životě podle sebe.' },
    { role: 'assistant', content: 'Co tě na tom přitahuje?' },
    { role: 'user', content: 'Chci vliv a aby ke mně lidé vzhlíželi.' },
    { role: 'assistant', content: 'Co by pro tebe znamenal skutečný dopad?' },
    { role: 'user', content: 'Tohle bych měla být já, ale jsem neschopná a nemám nic.' },
    { role: 'assistant', content: 'Mezera se ti mění ve verdikt o celé tobě.' },
    { role: 'user', content: 'Dobře. Co mám tedy konkrétně udělat jako první, abych jen nepřemýšlela?' },
  ];
  const conversationContext = buildConversationContext(messages, 'koucovaci_hodina');
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    routingText: buildRoutingText(messages),
    responseMode: 'koucovaci_hodina',
    conversationContext,
    techniqueTurn: { card: { id: 'accurate_self_talk_edit' }, session: { phase: 'assessment' } },
  });
  assert.match(response, /do 24 hodin/i);
  assert.match(response, /natoč a zveřejni/i);
  assert.match(response, /neměř počtem lajků/i);
  assert.doesNotMatch(response, /co přesně se stalo|nejdřív ho oddělíme od faktů/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('router drží poslední byznysové téma i při krátké navazující odpovědi o kapacitě', () => {
  const text = buildRoutingText([
    { role: 'user', content: 'Potřebuji validovat aplikaci před spuštěním.' },
    { role: 'assistant', content: 'Kolik na to máš času?' },
    { role: 'user', content: 'Třeba 4–5 h denně.' },
  ]);
  assert.match(text, /validovat aplikaci/i);
  assert.match(text, /4–5 h denně/i);
  assert.equal(inferMode(text), 'mentoring');
});

test('slovo hned v odmítnutí handoffu nepřepne hluboké koučování do rychlé rady', () => {
  const text = 'Mám strach oslovit první klienty. Neodkazuj mě hned na živého kouče, veď mě tím.';
  assert.equal(inferMode(text), 'koucovaci_podpora');
});

test('zhoršení při meditaci má přednost před automatickým vedením meditace', () => {
  assert.equal(
    inferMode('Při meditaci se mi úzkost zhoršuje a mám pocit, že nejsem ve svém těle.'),
    'podporna_stabilizace',
  );
});

test('rozhodnutí o produktu a zásadní investici se routuje do mentoringu', () => {
  assert.equal(inferMode('Deset lidí můj nápad nechce. Mám ho zahodit?'), 'mentoring');
  assert.equal(inferMode('Chci investovat skoro všechny úspory do spuštění.'), 'mentoring');
});

test('validace bez znalosti distribučních možností nedostane vymyšlený plán oslovení', () => {
  const messages = [
    { role: 'user', content: 'Potřebuji validovat aplikaci před spuštěním.' },
    { role: 'assistant', content: 'Kolik na to máš času?' },
    { role: 'user', content: 'Třeba 4–5 h denně.' },
  ];
  const routingText = buildRoutingText(messages);
  const response = fixedGroundingResponse({
    messages,
    latestText: 'Třeba 4–5 h denně.',
    routingText,
    responseMode: 'mentoring',
  });
  assert.match(response, /distribuční realitu/i);
  assert.match(response, /vlastní publikum/i);
  assert.doesNotMatch(response, /50|100|20 placených|7–10 dní/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('známý fakt, že členka nemá publikum a použije reklamu, se znovu nezjišťuje', () => {
  const messages = [
    { role: 'user', content: 'Potřebuji validovat aplikaci před spuštěním.' },
    { role: 'user', content: 'Nemám koho oslovit, nemám vlastní publikum a pojedu placenou reklamu.' },
    { role: 'user', content: 'Mám na to 4–5 h denně.' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: 'Mám na to 4–5 h denně.',
    routingText: buildRoutingText(messages),
    responseMode: 'mentoring',
  });
  assert.equal(response, null);
});

test('hlas Elitea zakazuje typické chatbotové návyky', () => {
  assert.match(systemPrompt, /vede rozhovor, nikoli odpověďový formulář/i);
  assert.match(systemPrompt, /nezačínej automaticky „Rozumím“/i);
  assert.match(systemPrompt, /neoznačuj po jedné větě něco za „typický perfekcionismus“/i);
  assert.match(systemPrompt, /Lidsky působící odpověď není hraní si na člověka/i);
});

test('prompt odlišuje automatické předání Koučka–Mentorka od souhlasu mezi oddělenými prostředími', () => {
  assert.match(systemPrompt, /plynulého interního předávání mezi Koučkou a Mentorkou/i);
  assert.match(systemPrompt, /systém roli mění sám podle aktuální potřeby/i);
  assert.match(systemPrompt, /dvě oddělené konverzace a paměti/i);
});

test('uzavření koučovací hodiny nepřidává další automatickou otázku', () => {
  const shaped = shapeCoachingResponse(
    'Dnes sis pojmenovala, že nemusíš umět všechno před prvním krokem. Domluvila ses, že zveřejníš první nabídku.',
    {},
    { closingRequested: true },
  );
  assert.equal((shaped.match(/\?/g) || []).length, 0);
  assert.doesNotMatch(shaped, /Co je na tom pro tebe/);
});

test('studie a názvy technik zůstávají při koučování pouze v zákulisí', () => {
  assert.match(systemPrompt, /nikdy nepřednášej studie/i);
  assert.match(systemPrompt, /ani názvy technik/i);
  assert.match(systemPrompt, /výhradně jako zákulisní kontrola/i);
  assert.match(systemPrompt, /Nikdy nepřerušuj probíhající koučovací rozhovor akademickým vysvětlováním/i);
});

test('potvrzená alternativní metodika Nii se aktivně používá bez akademického filtrování', () => {
  assert.match(systemPrompt, /Potvrzená přesvědčení a postupy Nii/i);
  assert.match(systemPrompt, /Neuroplasticitu, self-talk, postoje, vizualizaci, identitu a opakování používej/i);
  assert.match(systemPrompt, /NLP je potvrzenou součástí přístupu Nii/i);
  assert.match(systemPrompt, /neslibuj, že NLP diagnostikuje člověka, léčí nemoc či trauma nebo garantuje výsledek/i);
});

test('systémový prompt výslovně odděluje podporu od léčby bez opuštění členky', () => {
  assert.match(systemPrompt, /podporujeme, neopouštíme, neléčíme/i);
  assert.match(systemPrompt, /Doporučení odborné pomoci není ukončením koučovací podpory/i);
  assert.match(systemPrompt, /depresí, úzkostí, vyhořením/i);
});

test('Elitea je nastavena jako hlavní dlouhodobá koučka a mentorka bez zbytečného handoffu', () => {
  assert.match(systemPrompt, /hlavní koučka a mentorka, ne doplněk/i);
  assert.match(systemPrompt, /Sama vede celý pracovní cyklus/i);
  assert.match(systemPrompt, /Lidská konzultace je volitelná nadstavba/i);
  assert.match(systemPrompt, /nejprve sama udělej užitečný koučovací či mentoringový krok/i);
});

test('předání Nii chrání soukromí a vyžaduje náhled i výslovný souhlas', () => {
  assert.match(systemPrompt, /Nia nemá automatický přístup k jejím zprávám ani historii konverzace/i);
  assert.match(systemPrompt, /Rezervaci musí být možné dokončit i bez něj/i);
  assert.match(systemPrompt, /Nikdy nepřikládej syrový chat ani automatický přepis/i);
  assert.match(systemPrompt, /samostatným výslovným potvrzením/i);
  assert.match(systemPrompt, /Bez tohoto potvrzení se nic Nii neodešle/i);
});

test('běžná zmínka úzkosti nebo prodělané deprese nespouští preventivní doporučení odborníka', () => {
  assert.match(systemPrompt, /Samotná slova „úzkost“, „deprese“, „byla jsem po depresi“/i);
  assert.match(systemPrompt, /nejsou důvodem otevírat lékaře, terapeuta, krizovou linku/i);
  assert.match(systemPrompt, /začni rovnou kvalitně koučovat to, co členka skutečně řeší/i);
});

test('S002 R3 po slově strach pokračuje v případu workshopu místo zdravotního screeningu', () => {
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně. Asi na podnikání prostě nemám.' },
    { role: 'assistant', content: 'Co přesně znamená, že dopadl špatně?' },
    { role: 'user', content: 'Přihlásily se tři ženy a jedna po půl hodině odešla. Řekla jsem si, že jsem nudná.' },
    { role: 'assistant', content: 'Co udělaly zbývající dvě?' },
    { role: 'user', content: 'Dvě zůstaly do konce a jedna napsala, že jí pomohlo cvičení.' },
    { role: 'assistant', content: 'Co přesně jí pomohlo?' },
    { role: 'user', content: 'Udělala moje kroky a získala prvního klienta.' },
    { role: 'assistant', content: 'To je konkrétní důkaz hodnoty.' },
    { role: 'user', content: 'Já nevím, mám prostě strach.' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /jedna žena podle tvého postupu získala klienta/i);
  assert.match(response, /znovu někdo odejde, protože jsem nudná/i);
  assert.doesNotMatch(response, /spán|energ|fungov|poslední konkrétní situaci/i);
  assert.equal((response.match(/\?/g) || []).length, 1);
});

test('S002 R3 oprava popsala vrací rozhovor o vrstvu hlouběji bez opakování události', () => {
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně. Asi na podnikání nemám.' },
    { role: 'user', content: 'Přišly tři ženy, jedna odešla, dvě zůstaly a jedna díky mému postupu získala klienta.' },
    { role: 'assistant', content: 'Popiš poslední konkrétní situaci, kdy se to stalo.' },
    { role: 'user', content: 'Vždyť jsem ti to popsala... ten workshop!' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /situaci už jsi popsala/i);
  assert.match(response, /co by pro tebe znamenalo/i);
  assert.doesNotMatch(response, /spán|energ|fungov|popiš.*situaci/i);
});

test('S002 R3 odpověď únosné uzavře měření a začne skutečnou práci se strachem', () => {
  const messages = [
    { role: 'user', content: 'Po workshopu mám strach, že jsem nudná.' },
    { role: 'assistant', content: 'Je strach únosný, nebo ti bere spánek a energii?' },
    { role: 'user', content: 'Únosné.' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /míru strachu zodpovězenou/i);
  assert.match(response, /Nakolik teď věříš větě/i);
  assert.doesNotMatch(response, /zhorš|spánek|energii|fungování/i);
});

test('S002 R3 na otázku o odstranění strachu začne intervenci místo dalšího screeningu', () => {
  const messages = [
    { role: 'user', content: 'Po workshopu, kde jedna žena odešla a jiná získala klienta, mám strach, že jsem nudná.' },
    { role: 'user', content: 'Nevím, ale dá se ten strach odstranit?' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /Úplné vynulování strachu/i);
  assert.match(response, /jedna odešla = jsem nudná/i);
  assert.match(response, /přesnější věta/i);
  assert.doesNotMatch(response, /spán|energ|fungov|zdravot/i);
});

test('S002 R3 respektuje psala jsem že ne a zdravotní otázku už neopakuje', () => {
  const messages = [
    { role: 'user', content: 'Po workshopu mám strach, že jsem nudná, i když jedna žena získala klienta.' },
    { role: 'assistant', content: 'Bere ti strach spánek, energii nebo běžné fungování?' },
    { role: 'user', content: 'Ne.' },
    { role: 'assistant', content: 'Zasahuje ti další workshop do spánku nebo fungování?' },
    { role: 'user', content: 'Psala jsem, že ne.' },
  ];
  const response = fixedGroundingResponse({
    messages,
    latestText: messages.at(-1).content,
    responseMode: 'koucovaci_hodina',
    conversationContext: buildConversationContext(messages, 'koucovaci_hodina'),
  });
  assert.match(response, /už jsi odpověděla/i);
  assert.match(response, /skutečné zakázce/i);
  assert.doesNotMatch(response, /zhoršuje|bere ti|zasahuje/i);
});
