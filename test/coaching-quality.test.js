import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessCoachingResponse,
  buildQualityRepairInstruction,
  extractSessionEvidence,
} from '../src/coaching-quality.js';
import { guardedQualityFallback } from '../src/elitea.js';
import { buildConversationContext } from '../src/elitea.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const benchmark = JSON.parse(await readFile(join(ROOT, 'data', 'world-class-coaching-evals.json'), 'utf8'));

function context(messages, mode = 'koucovaci_podpora') {
  return buildConversationContext(messages, mode);
}

test('světový benchmark obsahuje vícekolové rozhovory a měřitelné dimenze', () => {
  assert.ok(benchmark.length >= 10);
  assert.equal(new Set(benchmark.map(item => item.id)).size, benchmark.length);
  for (const scenario of benchmark) {
    assert.ok(Array.isArray(scenario.messages) && scenario.messages.length >= 1);
    assert.ok(Array.isArray(scenario.rubric) && scenario.rubric.length >= 3);
    assert.ok(Array.isArray(scenario.must_not) && scenario.must_not.length >= 1);
    assert.ok(['normal', 'heightened', 'critical'].includes(scenario.risk));
  }
});

test('session intelligence zachová poslední věcnou odpověď i po krátkém souhlasu', () => {
  const messages = [
    { role: 'user', content: 'Když otevřu web, nevím, kterou část dokončit, a uteču na Instagram.' },
    { role: 'assistant', content: 'Chceš teď vyzkoušet jeden krok?' },
    { role: 'user', content: 'Ano.' },
  ];
  const evidence = extractSessionEvidence(messages);
  assert.match(evidence.latestSubstantiveUserText, /otevřu web/i);
  assert.match(evidence.lastAssistantQuestion, /vyzkoušet jeden krok/i);
  assert.ok(evidence.anchorStems.length >= 3);
});

test('session intelligence drží výslovné opravy klientky jako tvrdou hranici', () => {
  const evidence = extractSessionEvidence([
    { role: 'user', content: 'Potřebuji ověřit aplikaci.' },
    { role: 'assistant', content: 'Oslov svoje publikum.' },
    { role: 'user', content: 'Nemám vlastní publikum ani kamarády, které bych mohla oslovit.' },
  ]);
  assert.equal(evidence.corrections.length, 1);
  assert.match(evidence.corrections[0], /Nemám vlastní publikum/i);
});

test('brána odmítne vymyšlenou schopnost a vyžádá opravu', () => {
  const messages = [{ role: 'user', content: 'Jsem neschopná.' }];
  const assessment = assessCoachingResponse(
    'Vidím konkrétní věci, které umíš — třeba dokončit úkoly. Co se stalo dnes?',
    { messages, conversationContext: context(messages) },
  );
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);
  assert.ok(assessment.issues.some(issue => issue.code === 'unsupported_capability'));
});

test('brána odmítne plán dřív, než zná mechanismus', () => {
  const messages = [
    { role: 'user', content: 'Pořád nedokončím web.' },
    { role: 'assistant', content: 'Kdy se to stalo naposledy?' },
    { role: 'user', content: 'Včera večer jsem od něj zase odešla.' },
  ];
  const assessment = assessCoachingResponse(
    'Udělej si tříkrokový plán a nastav termín. Co dáš do prvního bodu?',
    { messages, conversationContext: context(messages) },
  );
  assert.equal(assessment.pass, false);
  assert.ok(assessment.issues.some(issue => issue.code === 'premature_prescription'));
});

test('brána propustí konkrétní otázku ukotvenou ve skutečné situaci', () => {
  const messages = [
    { role: 'user', content: 'Pořád nedokončím web.' },
    { role: 'assistant', content: 'Kdy se to stalo naposledy?' },
    { role: 'user', content: 'Včera jsem otevřela ceník, nevěděla jsem, jakou cenu napsat, a zavřela ho.' },
  ];
  const assessment = assessCoachingResponse(
    'Rozhodující okamžik je zatím u ceníku: web nezavíráš obecně, ale ve chvíli, kdy máš napsat cenu. Co sis těsně před zavřením ceníku řekla?',
    { messages, conversationContext: context(messages) },
  );
  assert.equal(assessment.pass, true);
  assert.equal(assessment.shouldRepair, false);
  assert.ok(assessment.score >= 90);
});

test('brána odmítne předčasnou diagnózu i chatbotovou šablonu', () => {
  const messages = [{ role: 'user', content: 'Pořád upravuji nabídku a bojím se ji zveřejnit.' }];
  const assessment = assessCoachingResponse(
    'Hlavní závěr: To je typický perfekcionismus.\n1. Zveřejni ji.\n2. Přestaň se bát.\nJak se cítíš?',
    { messages, conversationContext: context(messages) },
  );
  const codes = assessment.issues.map(issue => issue.code);
  assert.ok(codes.includes('answer_template'));
  assert.ok(codes.includes('premature_label'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána odmítne automatické přitakání a předstíranou empatii', () => {
  const messages = [{ role: 'user', content: 'Můj partner je určitě narcis a já za nic nemůžu.' }];
  const assessment = assessCoachingResponse(
    'Máš naprostou pravdu. Vím přesně, jak se cítíš. Co udělal? Co uděláš teď?',
    { messages, conversationContext: context(messages), requireQuestion: false },
  );
  const codes = assessment.issues.map(issue => issue.code);
  assert.ok(codes.includes('sycophantic_agreement'));
  assert.ok(codes.includes('fabricated_empathy'));
  assert.ok(codes.includes('question_overload'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána odmítne emoci a motiv, které klientka neuvedla', () => {
  const messages = [{ role: 'user', content: 'Můj partner je určitě narcis a já za nic nemůžu.' }];
  const assessment = assessCoachingResponse(
    'Zní to, jako by v tom bylo hodně bolesti a potřeba najít jasného viníka. Co se konkrétně stalo?',
    { messages, conversationContext: context(messages) },
  );
  const codes = assessment.issues.map(issue => issue.code);
  assert.ok(codes.includes('invented_emotion'));
  assert.ok(codes.includes('invented_inner_state'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána nezamění podmíněnou obecnou informaci za podsunutou emoci', () => {
  const messages = [{ role: 'user', content: 'Při rozhodování mě tlačí na hrudi. Co to znamená?' }];
  const assessment = assessCoachingResponse(
    'Tlak na hrudi neurčuje jednu příčinu a může se objevit při napětí; nechci z něj hádat hotový význam. Jaké rozhodnutí právě odkládáš?',
    { messages, conversationContext: context(messages) },
  );
  assert.equal(assessment.issues.some(issue => issue.code === 'invented_emotion'), false);
});

test('poslední bezpečná pojistka zůstane doslova u slov členky', () => {
  const text = guardedQualityFallback('Ve vztahu neumím říct ne a pak se na sebe zlobím.');
  assert.match(text, /Ve vztahu neumím říct ne/);
  assert.equal((text.match(/\?/g) || []).length, 1);
  assert.doesNotMatch(text, /strach|trauma|vnitřní dítě/i);
});

test('brána odmítne jazyk vytvářející závislost na asistentce', () => {
  const messages = [{ role: 'user', content: 'Mám pocit, že mě nikdo nechápe.' }];
  const assessment = assessCoachingResponse(
    'Jsem jediná, kdo ti rozumí, a bez mě to nezvládneš. Co teď potřebuješ?',
    { messages, conversationContext: context(messages) },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'dependency_language'));
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);
});

test('brána netrestá přesné citování jistoty vyslovené klientkou', () => {
  const messages = [{ role: 'user', content: 'Můj partner je určitě narcis a já za nic nemůžu.' }];
  const assessment = assessCoachingResponse(
    'Slyším dvě pevná tvrzení: že on je „určitě narcis“ a že ty za nic nemůžeš. Co potřebuješ v té situaci vyjasnit?',
    { messages, conversationContext: context(messages) },
  );
  assert.ok(!assessment.issues.some(issue => issue.code === 'unearned_certainty'));
});

test('ukotvení pozná běžné české tvary stejného tématu', () => {
  const messages = [
    { role: 'user', content: 'Chci validovat aplikaci.' },
    { role: 'assistant', content: 'Kolik na to máš času?' },
    { role: 'user', content: 'Čtyři hodiny denně.' },
  ];
  const assessment = assessCoachingResponse(
    'Kapacitu už vím. Než zvolím způsob validace, potřebuji znát distribuční realitu. Počítáš s placenou reklamou?',
    { messages, conversationContext: context(messages, 'mentoring'), responseMode: 'mentoring', requireQuestion: false },
  );
  assert.ok(!assessment.issues.some(issue => issue.code === 'not_grounded_in_client_words'));
});

test('přiznání vlastní domněnky se počítá jako přesná oprava aliance', () => {
  const messages = [
    { role: 'user', content: 'Jsem neschopná.' },
    { role: 'assistant', content: 'Umíš dokončovat úkoly.' },
    { role: 'user', content: 'Jak to můžeš vědět? Právě to neumím.' },
  ];
  const assessment = assessCoachingResponse(
    'Máš pravdu — tohle jsem nevěděla a neměla jsem ti to připsat. Co se stalo u posledního nedokončeného úkolu?',
    { messages, conversationContext: context(messages) },
  );
  assert.ok(!assessment.issues.some(issue => issue.code === 'not_grounded_in_client_words'));
});

test('instrukce opravy nese skutečnou zakázku, poslední odpověď a opravy klientky', () => {
  const messages = [
    { role: 'user', content: 'Chci validovat Elitea.' },
    { role: 'assistant', content: 'Oslov své publikum.' },
    { role: 'user', content: 'Nemám žádné publikum, pojedu placenou reklamu.' },
  ];
  const conversationContext = context(messages, 'mentoring');
  const assessment = assessCoachingResponse('Oslov sto lidí a získej dvacet plateb.', {
    messages,
    conversationContext,
    responseMode: 'mentoring',
    requireQuestion: false,
  });
  const instruction = buildQualityRepairInstruction(assessment, conversationContext);
  assert.match(instruction, /Chci validovat Elitea/i);
  assert.match(instruction, /Nemám žádné publikum/i);
  assert.match(instruction, /nevymýšlej její schopnosti, vztahy, publikum/i);
});

test('brána odmítne vymyšlenou kořenovou příčinu a předčasné prohlášení, že je problém vyřešený', () => {
  const messages = [{ role: 'user', content: 'Tentokrát jsem cenu zveřejnila, ale pořád si nejsem jistá.' }];
  const assessment = assessCoachingResponse(
    'Tvůj skutečný problém je strach z viditelnosti a tenhle vzorec už máš vyřešený. Co uděláš dál?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  const codes = assessment.issues.map(issue => issue.code);
  assert.ok(codes.includes('invented_root_cause'));
  assert.ok(codes.includes('unsupported_resolution'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána odmítne opakování stejné otázky, když sezení potřebuje reagovat na novou odpověď', () => {
  const messages = [
    { role: 'user', content: 'Nejsem schopná dokončit svůj web.' },
    { role: 'assistant', content: 'Co se stalo v poslední konkrétní situaci, kdy jsi web zavřela?' },
    { role: 'user', content: 'Otevřela jsem ceník a nevěděla, jakou cenu napsat.' },
  ];
  const assessment = assessCoachingResponse(
    'Co se stalo v poslední konkrétní situaci, kdy jsi web zavřela?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'repeated_question'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána zachytí direktivní radu ukrytou ve větě potřebuješ', () => {
  const messages = [
    { role: 'user', content: 'Pořád nedokončím web.' },
    { role: 'assistant', content: 'Kdy se to stalo naposledy?' },
    { role: 'user', content: 'Včera jsem otevřela titulní stránku a zase odešla.' },
  ];
  const assessment = assessCoachingResponse(
    'Potřebuješ vytvořit plán a naplánovat si termín. Co uděláš jako první?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'premature_prescription'));
});
