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
  buildConversationRepairContext,
  createElitea,
  selectConversationWindow,
  buildRoutingText,
  expertRoleForMode,
  enforceConversationRepairResponse,
  formatConversationRepairContext,
  guardedConversationRepairFallback,
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

test('běžné téma nemá předem napsanou grounding odpověď ani repair režim', () => {
  const messages = [{ role: 'user', content: 'První workshop dopadl špatně. Asi na podnikání nemám.' }];
  const context = buildConversationRepairContext(messages, messages[0].content);

  assert.equal(context.active, false);
  assert.equal(context.kind, 'none');
  assert.deepEqual(context.priorUserStatements, []);
});

test('historická oprava významu aktivuje generický repair bez domýšlení faktů', () => {
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně.' },
    { role: 'assistant', content: 'Chceš ukončit dnešní rozhovor?' },
    { role: 'user', content: 'Nechci pokračovat s workshopem, to jsi nepochopila.' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const prompt = formatConversationRepairContext(context);

  assert.equal(context.active, true);
  assert.equal(context.kind, 'external_stop');
  assert.deepEqual(context.priorUserStatements, ['První workshop dopadl špatně.']);
  assert.match(prompt, /jasně pojmenovala činnost nebo způsob/i);
  assert.match(prompt, /nezaměňuj to za konec rozhovoru/i);
  assert.doesNotMatch(prompt, /tři ženy|jedna odešla|dvě zůstaly|získala klienta/i);
});

test('jasné ukončení externí činnosti nevyvolá znovu otázku co chce klientka zastavit', () => {
  const messages = [
    { role: 'user', content: 'Nechci dál nabízet konzultace.' },
    { role: 'assistant', content: 'Chceš ukončit náš rozhovor?' },
    { role: 'user', content: 'Nechci pokračovat s konzultacemi, ne s tebou.' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const fallback = guardedConversationRepairFallback(context);

  assert.equal(context.kind, 'external_stop');
  assert.equal(context.explicitConversationContinuation, true);
  assert.equal(context.externalStopScope, 's konzultacemi');
  assert.match(fallback, /nechceš pokračovat s konzultacemi/i);
  assert.match(fallback, /V našem rozhovoru pokračujeme/i);
  assert.doesNotMatch(fallback, /co chceš zastavit/i);
  assert.doesNotMatch(fallback, /workshop|účastnic|klient|odešla/i);
});

test('dobrá odpověď na ukončení vnější činnosti zůstane zachovaná', () => {
  const messages = [
    { role: 'user', content: 'Projekt mě vyčerpává.' },
    { role: 'assistant', content: 'Chceš skončit i s naším rozhovorem?' },
    { role: 'user', content: 'Nechci pokračovat s projektem. V našem rozhovoru pokračovat chci.' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const modelAnswer = 'Projekt už dál tlačit nemusíš. Co chceš teď prozkoumat místo něj?';

  assert.equal(enforceConversationRepairResponse(modelAnswer, context), modelAnswer);
});

test('nepochopený rozsah ukončení opraví pojmenovanou činností a jednou navazující otázkou', () => {
  const messages = [
    { role: 'user', content: 'Moje nabídka nefunguje.' },
    { role: 'assistant', content: 'Chceš v tom pokračovat?' },
    { role: 'user', content: 'Nechci pokračovat v téhle nabídce, ale s tebou pokračovat chci.' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const repaired = enforceConversationRepairResponse('Dobře, dnešek uzavřeme.', context);

  assert.match(repaired, /nechceš pokračovat v téhle nabídce/i);
  assert.match(repaired, /v našem rozhovoru pokračujeme/i);
  assert.equal((repaired.match(/\?/g) || []).length, 1);
  assert.match(repaired, /co chceš řešit jako další krok místo toho\?/i);
});

test('nejasné nechci pokračovat zachová pouze doslovná data klientky', () => {
  const messages = [
    { role: 'user', content: 'Mám strach z dalšího workshopu.' },
    { role: 'assistant', content: 'Co se stalo?' },
    { role: 'user', content: 'Už nechci pokračovat, bojím se.' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const fallback = guardedConversationRepairFallback(context);

  assert.equal(context.kind, 'clarify_stop');
  assert.match(fallback, /Nechci hádat, co chceš zastavit/i);
  assert.doesNotMatch(fallback, /workshop|účastnic|klient|odešla/i);
});

test('žádost o jednodušší vysvětlení zachová poslední otázku a známá sdělení', () => {
  const messages = [
    { role: 'user', content: 'Na workshop přišly tři ženy; proč jedna odešla, nevím.' },
    { role: 'assistant', content: 'Kdybys důvod nikdy nezjistila, jak bys rozhodovala podle doložených výsledků?' },
    { role: 'user', content: 'Nerozumím té otázce, můžeš ji vysvětlit líp?' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);

  assert.equal(context.kind, 'rephrase');
  assert.match(context.previousAssistantText, /Kdybys důvod nikdy nezjistila/i);
  assert.deepEqual(context.priorUserStatements, ['Na workshop přišly tři ženy; proč jedna odešla, nevím.']);
  assert.match(formatConversationRepairContext(context), /zachovej význam předchozí otázky/i);
});

test('výslovná žádost o jednu krátkou otázku vrátí přesně jednu ukotvenou otázku bez meta vysvětlení', () => {
  const messages = [
    { role: 'user', content: 'Mám problém s prodejem své služby, stydím se o ní mluvit a nevím, kde začít.' },
    { role: 'assistant', content: 'Jaké rozhodnutí potřebuješ udělat jako první?' },
    { role: 'user', content: 'Můžeš se mnou mluvit jako člověk? Nerozumím té otázce.' },
    { role: 'assistant', content: 'Ptám se, kterou část prodejního procesu chceš nejprve diagnostikovat.' },
    { role: 'user', content: 'Pořád tomu nerozumím. Zeptej se mě jednou krátkou otázkou.' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const repaired = enforceConversationRepairResponse(
    'Promiň, vysvětlím svůj postup. Co přesně nechápeš? A kde chceš začít?',
    context,
  );

  assert.equal(context.kind, 'rephrase');
  assert.equal(context.shortQuestionRequested, true);
  assert.match(context.groundingStatement, /prodejem své služby/i);
  assert.equal(repaired, 'Když říkáš „Mám problém s prodejem své služby“, co je na tom teď nejtěžší?');
  assert.equal((repaired.match(/\?/g) || []).length, 1);
  assert.ok(repaired.split(/\s+/u).length <= 20);
  assert.doesNotMatch(repaired, /promiň|vysvětlím|postup|nerozumíš|nechápeš/i);
});

test('běžná věta mám jednu krátkou otázku neaktivuje konverzační repair', () => {
  const messages = [
    { role: 'user', content: 'Mám jednu krátkou otázku: kolik stojí členství?' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);

  assert.equal(context.shortQuestionRequested, false);
  assert.equal(context.active, false);
  assert.equal(
    enforceConversationRepairResponse('Členství stojí 990 Kč měsíčně.', context),
    'Členství stojí 990 Kč měsíčně.',
  );
});

test('žádost o fakta má obecný fail-closed souhrn nejvýše tří doslovných sdělení bez nové domněnky', () => {
  const messages = [
    { role: 'user', content: 'Můj první placený seminář dopadl podle mě špatně.' },
    { role: 'assistant', content: 'Kolik lidí přišlo?' },
    { role: 'user', content: 'Počet lidí jsem zatím neuvedla.' },
    { role: 'assistant', content: 'Určitě odešli kvůli obsahu.' },
    { role: 'user', content: 'Co tedy opravdu víme bez domýšlení?' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const fallback = guardedConversationRepairFallback(context);

  assert.equal(context.kind, 'fact_recap');
  assert.deepEqual(context.substantiveGroundingStatements, [
    'Můj první placený seminář dopadl podle mě špatně.',
    'Počet lidí jsem zatím neuvedla.',
  ]);
  assert.match(fallback, /„Můj první placený seminář dopadl podle mě špatně“/i);
  assert.match(fallback, /„Počet lidí jsem zatím neuvedla“/i);
  assert.match(fallback, /na další hodnocení zatím nemáme dost dat/i);
  assert.doesNotMatch(fallback, /odešli kvůli obsahu|důvodem|znamená to/i);
  assert.equal((fallback.match(/\?/g) || []).length, 0);
});

test('fact recap zahrne opravu z aktuálního tahu a nevypíše opravený starší údaj', () => {
  for (const correction of [
    'Oprava: byly tam dvě ženy. Co tedy opravdu víme bez domýšlení?',
    'Ne, byly tam dvě ženy, co tedy opravdu víme bez domýšlení?',
    'Byly tam dvě, ne tři. Co tedy opravdu víme bez domýšlení?',
  ]) {
    const messages = [
      { role: 'user', content: 'Na workshop přišly tři ženy.' },
      { role: 'assistant', content: 'Dobře.' },
      { role: 'user', content: correction },
    ];
    const context = buildConversationRepairContext(messages, messages.at(-1).content);
    const fallback = guardedConversationRepairFallback(context);

    assert.equal(context.kind, 'fact_recap', correction);
    assert.match(fallback, /dvě/i, correction);
    assert.doesNotMatch(fallback, /na workshop přišly tři ženy/i, correction);
  }
});

test('bez domýšlení v zadání marketingového výstupu neaktivuje fact recap', () => {
  const latest = 'Napiš mi reklamní text jen z ověřených faktů, bez domýšlení.';
  const context = buildConversationRepairContext([{ role: 'user', content: latest }], latest);

  assert.equal(context.kind, 'none');
  assert.equal(context.active, false);
});

test('samostatná zdvořilá žádost o jednu krátkou otázku aktivuje deterministickou krátkou odpověď', () => {
  for (const latest of [
    'Můžeš mi dát jednu krátkou otázku?',
    'Prosím, jen jednu krátkou otázku.',
  ]) {
    const messages = [
      { role: 'user', content: 'Bojím se říct cenu své služby.' },
      { role: 'assistant', content: 'Položila jsem to příliš složitě.' },
      { role: 'user', content: latest },
    ];
    const context = buildConversationRepairContext(messages, latest);
    const fallback = guardedConversationRepairFallback(context);

    assert.equal(context.kind, 'short_question', latest);
    assert.equal(context.active, true, latest);
    assert.equal((fallback.match(/\?/gu) || []).length, 1, latest);
    assert.match(fallback, /bojím se říct cenu/i, latest);
  }
});

test('historická stížnost na opakování nespouští další techniku ani nevyrábí výsledek', () => {
  const messages = [
    { role: 'user', content: 'Řeším nepovedený workshop.' },
    { role: 'assistant', content: 'Co se teď změnilo — stejné, lepší, nebo horší?' },
    { role: 'user', content: 'Jak jsme se dostaly k tomu, že opakuješ jednu větu dokola?' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const prompt = formatConversationRepairContext(context);

  assert.equal(context.kind, 'repair');
  assert.match(prompt, /neprováděj ani nevyhodnocuj koučovací techniku/i);
  assert.doesNotMatch(prompt, /dvě ženy|první klient|pozitivní výsledek/i);
});

test('celý chatový tok při opravě zachová skrytý stav techniky a nepoužije workshopový scénář', async () => {
  const card = {
    id: 'generic_decision_work',
    name: 'Práce s rozhodnutím',
    family: 'core_coaching',
    access_level: 'ai_coaching',
    keywords: ['rozhodnutí'],
    use_when: ['členka se rozhoduje'],
    core_move: 'Odděl fakta od obav a potom ověř další možnost.',
    avoid: ['chybí zakázka'],
    never_claim: ['že metoda rozhodne za členku'],
    origin_or_standard: 'Testovací metodika',
  };
  const techniqueSession = {
    techniqueId: card.id,
    mode: 'koucovaci_hodina',
    phase: 'evaluation',
    stepIndex: 0,
    status: 'active',
    turns: 3,
    requiresConsent: false,
  };
  const messages = [
    { role: 'user', content: 'První workshop dopadl špatně.' },
    { role: 'assistant', content: 'Co se teď změnilo — stejné, lepší, nebo horší?' },
    { role: 'user', content: 'Vždyť jsem ti to popsala — ten workshop!' },
  ];
  const answer = createElitea({
    systemPrompt,
    knowledgeRecords: [],
    coachingMethods: methods,
    expertSources: sources,
    techniqueAtlas: [card],
  });
  const result = await answer({
    messages,
    memory: {},
    consultationMode: 'coaching_session',
    techniqueSession,
  });

  assert.equal(result.techniqueSession.phase, 'evaluation');
  assert.equal(result.techniqueSession.stepIndex, 0);
  assert.equal(result.techniqueSession.turns, 3);
  assert.match(result.text, /První workshop dopadl špatně/i);
  assert.doesNotMatch(result.text, /tři ženy|jedna odešla|dvě zůstaly|získala klienta/i);
});

test('generický repair funguje i pro neznámý scénář bez tématické šablony', () => {
  const messages = [
    { role: 'user', content: 'Po aktualizaci se můj keramický rezervační formulář přestal odesílat.' },
    { role: 'assistant', content: 'Kolik objednávek jsi ztratila a kdo formulář programoval?' },
    { role: 'user', content: 'To jsem vůbec neřekla. Nevymýšlej si a vrať se k tomu formuláři.' },
  ];
  const context = buildConversationRepairContext(messages, messages.at(-1).content);
  const prompt = formatConversationRepairContext(context);

  assert.equal(context.kind, 'repair');
  assert.deepEqual(context.priorUserStatements, ['Po aktualizaci se můj keramický rezervační formulář přestal odesílat.']);
  assert.doesNotMatch(context.priorUserStatements.join(' '), /objednávk|programoval|vývojář|agentura|wordpress/i);
  assert.match(prompt, /Neodvozuj počty, osoby, výsledky, pocity, příčiny ani záměr/i);
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

test('S003 automatický router drží koučku u srovnávání, dokud klientka nežádá odborný výstup', () => {
  const conversationText = [
    'Když vidím konkurentku, připadám si bezvýznamná.',
    'Její profil kontroluju několikrát denně.',
  ].join('\n');
  assert.equal(
    resolveConversationMode(
      'Nevím, asi čekám, že konečně udělá nějaký neúspěch.',
      'auto',
      null,
      { previousMode: 'koucovaci_podpora', conversationText },
    ),
    'koucovaci_podpora',
  );
  assert.equal(
    resolveConversationMode(
      'Napiš mi konkrétní scénář videa pro Instagram.',
      'auto',
      null,
      { previousMode: 'koucovaci_podpora', conversationText },
    ),
    'mentoring',
  );
});

test('přirozené formulace konce externí činnosti zachovají pokračování rozhovoru', () => {
  for (const latest of [
    'Nechci pokračovat s workshopem, ale chci pokračovat s tebou.',
    'S workshopy končím, ale s tebou chci pokračovat.',
    'Končím s podnikáním, ne s tebou.',
  ]) {
    const messages = [
      { role: 'user', content: 'Výsledek mě zklamal.' },
      { role: 'assistant', content: 'Chceš skončit?' },
      { role: 'user', content: latest },
    ];
    const repair = buildConversationRepairContext(messages, latest);
    const result = enforceConversationRepairResponse('Dobře, dnešní rozhovor uzavřeme.', repair);

    assert.equal(repair.kind, 'external_stop', latest);
    assert.equal(repair.explicitConversationContinuation, true, latest);
    assert.match(result, /v našem rozhovoru pokračujeme/i, latest);
    assert.doesNotMatch(result, /dnešní rozhovor uzavřeme/i, latest);
  }
});

test('předmět před slovesem je stále jasný konec externí činnosti', () => {
  for (const latest of [
    'Workshopy už dělat nechci, ale s tebou pokračovat chci.',
    'Konzultace vést nechci.',
  ]) {
    const messages = [{ role: 'user', content: latest }];
    const repair = buildConversationRepairContext(messages, latest);

    assert.equal(repair.kind, 'external_stop', latest);
    assert.match(repair.externalStopScope, /workshopy|konzultace/i, latest);
    assert.doesNotMatch(guardedConversationRepairFallback(repair), /co chceš zastavit/i, latest);
  }
});

test('pouhá zmínka externího tématu nepropustí odpověď odporující ukončení', () => {
  const latest = 'Nechci pokračovat v podnikání, ale s tebou pokračovat chci.';
  const messages = [
    { role: 'user', content: 'Podnikání mě vyčerpává.' },
    { role: 'assistant', content: 'Chceš skončit?' },
    { role: 'user', content: latest },
  ];
  const repair = buildConversationRepairContext(messages, latest);

  for (const contradictory of [
    'V podnikání pokračuj, jen zkus menší krok. Co uděláš jako první?',
    'Podnikání tedy nechceš opustit a můžeš v něm pokračovat. Co v něm uděláš?',
  ]) {
    const result = enforceConversationRepairResponse(contradictory, repair);
    assert.notEqual(result, contradictory);
    assert.match(result, /nechceš pokračovat v podnikání/i);
  }
});

test('facts-only odpověď deterministicky nespojí číslo se špatnou událostí ani nepřidá závěr', () => {
  const latest = 'Co tedy opravdu víme bez domýšlení?';
  const messages = [
    { role: 'user', content: 'V minulém kurzu byly tři ženy.' },
    { role: 'assistant', content: 'A co nový workshop?' },
    { role: 'user', content: 'U nového workshopu jsem počet zatím neuvedla.' },
    { role: 'assistant', content: 'Možná to potvrzuje slabý zájem.' },
    { role: 'user', content: latest },
  ];
  const repair = buildConversationRepairContext(messages, latest);
  const unsafe = 'Víme, že na novém workshopu byly tři ženy. To potvrzuje, že nabídka nefungovala.';
  const result = enforceConversationRepairResponse(unsafe, repair);

  assert.equal(repair.kind, 'fact_recap');
  assert.notEqual(result, unsafe);
  assert.match(result, /v minulém kurzu byly tři ženy/i);
  assert.match(result, /u nového workshopu jsem počet zatím neuvedla/i);
  assert.doesNotMatch(result, /na novém workshopu byly tři|potvrzuje|nabídka nefungovala/i);
});

test('krátká opravná otázka přeskočí ano, nevím i dobře a vrátí se k věcnému tématu', () => {
  for (const acknowledgement of ['Ano.', 'Nevím.', 'Dobře.']) {
    const latest = 'Pořád tomu nerozumím. Zeptej se mě jednou krátkou otázkou.';
    const messages = [
      { role: 'user', content: 'Bojím se prodat svůj kurz.' },
      { role: 'assistant', content: 'Chceš si projít další krok?' },
      { role: 'user', content: acknowledgement },
      { role: 'assistant', content: 'Teď provedeme komplexní diagnostiku rozhodovacího rámce.' },
      { role: 'user', content: latest },
    ];
    const repair = buildConversationRepairContext(messages, latest);
    const result = guardedConversationRepairFallback(repair);

    assert.match(repair.groundingStatement, /prodat svůj kurz/i);
    assert.match(result, /problém|bojím se prodat svůj kurz/i);
    assert.doesNotMatch(result, /když říkáš „(?:ano|nevím|dobře)/i);
    assert.equal((result.match(/\?/gu) || []).length, 1);
  }
});

test('facts-only fallback nikdy nepřevádí otázky klientky na známá tvrzení', () => {
  const latest = 'Co tedy opravdu víme bez domýšlení?';
  const messages = [
    { role: 'user', content: 'Myslíš, že přišly tři ženy?' },
    { role: 'assistant', content: 'Ano, určitě.' },
    { role: 'user', content: 'A znamená to, že workshop selhal?' },
    { role: 'assistant', content: 'Ano.' },
    { role: 'user', content: latest },
  ];
  const repair = buildConversationRepairContext(messages, latest);
  const result = guardedConversationRepairFallback(repair);

  assert.equal(repair.kind, 'fact_recap');
  assert.deepEqual(repair.substantiveGroundingStatements, []);
  assert.doesNotMatch(result, /přišly tři ženy|workshop selhal/i);
  assert.match(result, /nemáme žádné další údaje/i);
});
