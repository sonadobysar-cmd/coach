import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessCoachingResponse,
  buildQualityRepairInstruction,
  extractSessionEvidence,
  requestsFactsOnly,
  requestsOneShortQuestion,
} from '../src/coaching-quality.js';
import { guardedBrandFallback, guardedMentoringFallback, guardedQualityFallback } from '../src/elitea.js';
import { buildConversationContext, buildProfessionalCaseContext } from '../src/elitea.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const benchmark = JSON.parse(await readFile(join(ROOT, 'data', 'world-class-coaching-evals.json'), 'utf8'));
const firstContactBenchmark = JSON.parse(await readFile(join(ROOT, 'data', 'first-contact-evals.json'), 'utf8'));

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

test('vstupní kvalitativní brána pokrývá běžnou češtinu, překlepy i opravu stylu obou rolí', () => {
  assert.ok(firstContactBenchmark.length >= 20);
  assert.equal(new Set(firstContactBenchmark.map(item => item.id)).size, firstContactBenchmark.length);
  const universallyForbidden = /držím se přesně|nechci přidávat domněnku|abych ti poradila věcně|nejbližší byznysové rozhodnutí|pracovní zadání je|interní|„.*“/iu;

  for (const scenario of firstContactBenchmark) {
    const latest = scenario.messages.at(-1).content;
    const responseMode = scenario.role === 'mentor' ? 'mentoringova_konzultace' : 'koucovaci_podpora';
    const text = scenario.role === 'mentor'
      ? guardedMentoringFallback(latest, { messages: scenario.messages })
      : guardedQualityFallback(latest, { messages: scenario.messages });
    assert.ok(
      scenario.require_any.some(fragment => text.toLocaleLowerCase('cs').includes(fragment.toLocaleLowerCase('cs'))),
      `${scenario.id}: odpověď nebyla užitečně ukotvená: ${text}`,
    );
    assert.equal((text.match(/\?/g) || []).length, 1, `${scenario.id}: odpověď musí mít právě jednu otázku`);
    assert.doesNotMatch(text, universallyForbidden, `${scenario.id}: do odpovědi pronikla interní nebo robotická formulace`);
    const assessment = assessCoachingResponse(text, {
      messages: scenario.messages,
      conversationContext: context(scenario.messages, responseMode),
      responseMode,
      requireQuestion: scenario.role === 'coach',
    });
    assert.equal(assessment.pass, true, `${scenario.id}: ${JSON.stringify(assessment.issues)}`);
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

test('profesionální mapa rozliší tvůrčí cíl, osobní brzdu a požadavek na obsah', () => {
  const professionalCase = buildProfessionalCaseContext([
    { role: 'user', content: 'Chci být influencerka, ale stydím se vystupovat a bojím se, co řeknou lidé.' },
    { role: 'assistant', content: 'Co chceš svým obsahem měnit?' },
    { role: 'user', content: 'Chci ženám ukazovat sebevědomí a život podle sebe.' },
    { role: 'assistant', content: 'Co ode mě teď potřebuješ?' },
    { role: 'user', content: 'Vymysli mi konkrétní obsah na Instagram, ne jen obecná témata.' },
  ], 'mentoringova_konzultace');
  assert.equal(professionalCase.domain, 'creator_visibility_and_content');
  assert.equal(professionalCase.requestedDeliverable, 'personalized_content_output');
  assert.equal(professionalCase.hybridProblem, true);
  assert.ok(professionalCase.statedFrictionSignals.includes('shame_stated'));
  assert.ok(professionalCase.contentBrief.known.includes('topicOrPointOfView'));
  assert.ok(professionalCase.contentBrief.known.includes('audience'));
  assert.equal(professionalCase.nextMove, 'create_usable_output_now');
});

test('kontrola odmítne generické obsahové pilíře místo práce na míru', () => {
  const messages = [
    { role: 'user', content: 'Chci být influencerka, ale stydím se vystupovat.' },
    { role: 'assistant', content: 'Komu chceš pomáhat?' },
    { role: 'user', content: 'Ženám, které se bojí žít podle sebe. Chci tvořit na Instagram.' },
    { role: 'assistant', content: 'Co chceš připravit?' },
    { role: 'user', content: 'Vymysli mi konkrétní obsah na míru.' },
  ];
  const assessment = assessCoachingResponse(
    'Střídej edukační, inspirační a prodejní obsah. Sdílej tipy a triky, zákulisí a buď konzistentní.',
    {
      messages,
      conversationContext: buildConversationContext(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.equal(assessment.pass, false);
  assert.ok(assessment.issues.some(issue => issue.code === 'generic_content_output'));
});

test('kontrola propustí konkrétní obsah ukotvený v cíli, publiku a kanálu členky', () => {
  const messages = [
    { role: 'user', content: 'Chci být influencerka, ale stydím se vystupovat.' },
    { role: 'assistant', content: 'Komu chceš pomáhat?' },
    { role: 'user', content: 'Ženám, které se bojí žít podle sebe. Chci tvořit na Instagram.' },
    { role: 'assistant', content: 'Co chceš připravit?' },
    { role: 'user', content: 'Vymysli mi konkrétní obsah na míru.' },
  ];
  const assessment = assessCoachingResponse(
    'Začni krátkým Instagram videem větou: „Čekala jsem, až budu dost sebevědomá na život podle sebe — a tím jsem ho pořád odkládala.“ Potom ukaž jedno vlastní rozhodnutí, které jsi udělala ještě s nejistotou, a zakonči výzvou: „Co odkládáš, dokud se nebudeš cítit připravená?“ Tím spojíš vlastní cestu s konkrétní ženou, která se dnes bojí udělat svůj krok.',
    {
      messages,
      conversationContext: buildConversationContext(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.equal(assessment.issues.some(issue => issue.code === 'generic_content_output'), false);
  assert.equal(assessment.pass, true, JSON.stringify(assessment.issues));
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

test('brána neodmítá radu jen proto, že mechanismus ještě není úplný; vyžaduje její ukotvení', () => {
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
  assert.ok(assessment.issues.some(issue => issue.code === 'not_grounded_in_client_words'));
  assert.ok(!assessment.issues.some(issue => issue.code === 'premature_prescription'));
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
  assert.ok(!codes.includes('question_overload'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána odmítne tlak pokračovat kvůli lidem kterým by klientka mohla pomoct', () => {
  const messages = [
    { role: 'user', content: 'Po prvním workshopu nevím, jestli chci pokračovat.' },
  ];
  const assessment = assessCoachingResponse(
    'Kdybys teď skončila, co by to znamenalo pro ženy, kterým by podobné cvičení mohlo pomoct?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'guilt_pressure'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána odmítne jemný tlak přes dojem nezájmu vůči účastnicím', () => {
  const messages = [
    { role: 'user', content: 'Dvě ženy zůstaly, ale nevím, jestli chci po workshopu pokračovat.' },
  ];
  const assessment = assessCoachingResponse(
    'Ve vztahu ke dvěma ženám, které zůstaly, by úplné stažení mohlo působit spíš jako nezájem. Co jim dlužíš?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'guilt_pressure'));
  assert.equal(assessment.shouldRepair, true);
  assert.match(buildQualityRepairInstruction(assessment, context(messages, 'koucovaci_hodina')), /Nevytvářej tlak přes možný dojem/i);
});

test('brána odmítne emoci a motiv, které klientka neuvedla', () => {
  const messages = [{ role: 'user', content: 'Můj partner je určitě narcis a já za nic nemůžu.' }];
  const assessment = assessCoachingResponse(
    'Zní to, jako by v tom bylo hodně bolesti a potřeba najít jasného viníka. Co se konkrétně stalo?',
    { messages, conversationContext: context(messages) },
  );
  const codes = assessment.issues.map(issue => issue.code);
  assert.ok(codes.includes('invented_emotion'));
  assert.ok(codes.includes('invented_emotion'));
  assert.equal(assessment.shouldRepair, true);
});

test('české tvary stejné emoce nejsou mylně označené jako nově domyšlené', () => {
  const cases = [
    {
      input: 'Můj první workshop dopadl podle mě špatně a stydím se za něj.',
      output: 'Stud teď oddělíme od faktů o workshopu. Co se na něm konkrétně stalo?',
    },
    {
      input: 'Bojím se zveřejnit svou nabídku.',
      output: 'Strach přichází ve chvíli zveřejnění. Co si představíš těsně před kliknutím?',
    },
    {
      input: 'Jsem na sebe naštvaná, že jsem to odložila.',
      output: 'Vztek na sebe přišel po odložení. Co se stalo těsně předtím?',
    },
  ];

  for (const example of cases) {
    const messages = [{ role: 'user', content: example.input }];
    const assessment = assessCoachingResponse(example.output, {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
    });
    assert.equal(
      assessment.issues.some(issue => issue.code === 'invented_emotion'),
      false,
      JSON.stringify(assessment.issues),
    );
  }
});

test('část slova ani obecné bojovat nejsou vydávané za emoci klientky', () => {
  const cases = [
    {
      input: 'Nevím, jak pojmenovat svůj nový projekt.',
      output: 'Symbolika názvu navazuje na hodnotu značky. Co má název vyjadřovat?',
    },
    {
      input: 'Odkládám zveřejnění nabídky.',
      output: 'Nemusíš s tím bojovat; zmenši první krok. Co můžeš zveřejnit dnes?',
    },
    {
      input: 'Připravuji studijní materiály pro nový kurz.',
      output: 'Studium rozděl na krátké části. Kterou kapitolu dokončíš jako první?',
    },
  ];

  for (const example of cases) {
    const messages = [{ role: 'user', content: example.input }];
    const assessment = assessCoachingResponse(example.output, {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
    });
    assert.equal(
      assessment.issues.some(issue => issue.code === 'invented_emotion'),
      false,
      JSON.stringify(assessment.issues),
    );
  }
});

test('brána dovolí opatrnou, ukotvenou pracovní hypotézu o motivu ve vztahu', () => {
  const messages = [{ role: 'user', content: 'Ve vztahu s partnerem neumím říct ne a pak se na sebe zlobím.' }];
  const assessment = assessCoachingResponse(
    'Zdá se, že svůj nesouhlas raději obrátíš proti sobě, než abys riskovala reakci partnera. Co chceš změnit?',
    {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
      requireQuestion: true,
    },
  );
  assert.ok(!assessment.issues.some(issue => issue.code === 'invented_inner_state'));
  assert.equal(assessment.pass, true);
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
  assert.match(text, /těsně předtím/i);
  assert.equal((text.match(/\?/g) || []).length, 1);
  assert.doesNotMatch(text, /strach|trauma|vnitřní dítě/i);
  assert.doesNotMatch(text, /držím se přesně|nechci přidávat domněnku|interní/i);
});

test('záložní koučovací tah zůstane konkrétní i když otázka není povinná', () => {
  const text = guardedQualityFallback(
    'Ve vztahu neumím říct ne a pak se na sebe zlobím.',
    { requireQuestion: false },
  );
  assert.match(text, /těsně předtím/i);
  assert.match(text, /poslední takové situaci/i);
});

test('mentorka tiše pochopí překlep „na sochách“ jako sociální sítě a hned byznysově poradí', () => {
  const input = 'Mám projekt a nevím jak ho rozjet, stydím se vystupovat na sochách a bojím se co řeknou ostatní apod';
  const text = guardedMentoringFallback(input);
  assert.match(text, /projekt chceš rozjet/i);
  assert.match(text, /sociálních sítích/i);
  assert.match(text, /jedním konkrétním příspěvkem/i);
  assert.equal((text.match(/\?/g) || []).length, 1);
  assert.doesNotMatch(text, /sochách|domněnk|držím se přesně|interní|pojistk/i);

  const messages = [{ role: 'user', content: input }];
  const assessment = assessCoachingResponse(text, {
    messages,
    conversationContext: context(messages, 'mentoringova_konzultace'),
    responseMode: 'mentoringova_konzultace',
    requireQuestion: false,
  });
  assert.equal(assessment.pass, true, JSON.stringify(assessment.issues));
  assert.ok(!assessment.issues.some(issue => issue.code === 'premature_prescription'));
});

test('mentorka oddělí nejasnou obsahovou strategii od studu z viditelnosti', () => {
  const input = 'Chci být influencerka a vybudovat osobní značku, ale stydím se vystupovat a vůbec nevím, jaký obsah by byl opravdu můj.';
  const text = guardedMentoringFallback(input);
  assert.match(text, /dva různé pracovní uzly/i);
  assert.match(text, /strategická mezera/i);
  assert.match(text, /osobní brzda/i);
  assert.match(text, /jádro značky/i);
  assert.doesNotMatch(text, /prostě začni|buď autentická|typický strach/i);
  assert.equal((text.match(/\?/g) || []).length, 1);
});

test('krátký vstup o studu při prodeji dostane normální lidskou odpověď, ne konzultantskou šablonu', () => {
  const input = 'mám problém s prodejem, stydím se';
  const messages = [{ role: 'user', content: input }];
  const text = guardedMentoringFallback(input, { messages });
  assert.match(text, /prodej nemusí znamenat někoho tlačit/i);
  assert.match(text, /ve které chvíli se stydíš nejvíc/i);
  assert.equal((text.match(/\?/g) || []).length, 1);
  assert.doesNotMatch(text, /abych ti poradila věcně|nejbližší byznysové rozhodnutí|„.*mám problém/i);

  const assessment = assessCoachingResponse(text, {
    messages,
    conversationContext: context(messages, 'mentoringova_konzultace'),
    responseMode: 'mentoringova_konzultace',
    requireQuestion: false,
  });
  assert.equal(assessment.pass, true, JSON.stringify(assessment.issues));
});

test('po žádosti mluvit jako člověk Mentorka jednoduše přeformuluje poslední věcný tah', () => {
  const messages = [
    { role: 'user', content: 'mám problém s prodejem, stydím se' },
    { role: 'assistant', content: 'Potřebuji určit nejbližší byznysové rozhodnutí.' },
    { role: 'user', content: 'Můžeš se mnou mluvit jako člověk? Nerozumím ti.' },
  ];
  const text = guardedMentoringFallback(messages.at(-1).content, { messages });
  assert.match(text, /^Jasně\. Řeknu to jednoduše\./i);
  assert.match(text, /prodej nemusí znamenat někoho tlačit/i);
  assert.doesNotMatch(text, /nejbližší byznysové rozhodnutí|interní|domněnk/i);
});

test('kontrola odmítne úřední šablonu v mentoringové odpovědi', () => {
  const messages = [{ role: 'user', content: 'mám problém s prodejem, stydím se' }];
  const assessment = assessCoachingResponse(
    'Abych ti poradila věcně, potřebuji určit nejbližší byznysové rozhodnutí. Jaký výsledek potřebuješ?',
    {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'mechanical_mentoring_tone'));
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);
});

test('první mentoringový tah nesmí jen zopakovat celou zprávu a chtít další údaj', () => {
  const messages = [{ role: 'user', content: 'Mám problém s prodejem a stydím se říct cenu.' }];
  const assessment = assessCoachingResponse(
    '„Mám problém s prodejem a stydím se říct cenu.“ Potřebuji další informace. Co chceš získat?',
    {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'echoed_client_message'));
  assert.equal(assessment.pass, false);
});

test('první mentoringový tah odmítne výslech bez jediné užitečné rady', () => {
  const messages = [{ role: 'user', content: 'Nevím jak získat první klientky.' }];
  const assessment = assessCoachingResponse(
    'Potřebuji víc informací. Co prodáváš?',
    {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'question_without_value'));
  assert.equal(assessment.pass, false);
});

test('žádost o normální řeč odmítne další konzultantský žargon', () => {
  const messages = [
    { role: 'user', content: 'Nevím jak prodávat.' },
    { role: 'assistant', content: 'Určíme distribuční realitu.' },
    { role: 'user', content: 'Nerozumím, můžeš mluvit jako člověk?' },
  ];
  const assessment = assessCoachingResponse(
    'Musíme nejprve zachytit rozhodující předpoklad a nejbližší byznysové rozhodnutí. Co je cílem?',
    {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'failed_style_repair'));
  assert.equal(assessment.pass, false);
});

test('kontrola nepustí interní bezpečnostní formulaci do odpovědi členky', () => {
  const messages = [{ role: 'user', content: 'Nevím, jak rozjet projekt.' }];
  const assessment = assessCoachingResponse(
    'Držím se přesně toho, co jsi napsala. Nechci k tomu přidávat domněnku, kterou jsi neuvedla.',
    {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'internal_guardrail_leak'));
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);
});

test('opravný průchod mentoringu požaduje radu a tiché pochopení běžného překlepu', () => {
  const messages = [{ role: 'user', content: 'Mám projekt a stydím se vystupovat na sochách.' }];
  const conversationContext = context(messages, 'mentoringova_konzultace');
  const assessment = assessCoachingResponse('Nechci přidávat domněnku.', {
    messages,
    conversationContext,
    responseMode: 'mentoringova_konzultace',
    requireQuestion: false,
  });
  const instruction = buildQualityRepairInstruction(
    assessment,
    conversationContext,
    { responseMode: 'mentoringova_konzultace' },
  );
  assert.match(instruction, /seniorní byznys mentorka/i);
  assert.match(instruction, /dej hned nejlepší konkrétní doporučení/i);
  assert.match(instruction, /překlep.*oprav tiše/i);
  assert.doesNotMatch(instruction, /pokud ještě není znám konkrétní mechanismus, nedávej plán/i);
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

test('brána nezamění neurčité „ve vztahu“ automaticky za partnera', () => {
  const messages = [{ role: 'user', content: 'Ve vztahu neumím říct ne a pak se na sebe zlobím.' }];
  const assessment = assessCoachingResponse(
    'Vrať se k poslední situaci. Co po tobě partner přesně chtěl?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.equal(assessment.pass, false);
  assert.ok(assessment.issues.some(issue => issue.code === 'invented_relationship_role'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána dovolí označení partnera, když ho uvedla sama členka', () => {
  const messages = [{ role: 'user', content: 'Partner po mně chce, abych rušila svoje plány.' }];
  const assessment = assessCoachingResponse(
    'Tady má smysl připravit si konkrétní větu. Co chceš partnerovi příště říct?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(!assessment.issues.some(issue => issue.code === 'invented_relationship_role'));
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

test('brána dovolí přímou radu, ale odmítne ji, pokud není ukotvená v případu', () => {
  const messages = [
    { role: 'user', content: 'Pořád nedokončím web.' },
    { role: 'assistant', content: 'Kdy se to stalo naposledy?' },
    { role: 'user', content: 'Včera jsem otevřela titulní stránku a zase odešla.' },
  ];
  const assessment = assessCoachingResponse(
    'Potřebuješ vytvořit plán a naplánovat si termín. Co uděláš jako první?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'not_grounded_in_client_words'));
  assert.ok(!assessment.issues.some(issue => issue.code === 'premature_prescription'));
});

test('byznys mentorka nesmí předstírat, že provedla externí akci', () => {
  const messages = [{ role: 'user', content: 'Připrav mi koncept kampaně pro kurz komunikace.' }];
  const assessment = assessCoachingResponse(
    'Hotovo — kampaň jsem spustila a nastavila jsem rozpočet. Výsledky budou určitě skvělé.',
    {
      messages,
      conversationContext: context(messages, 'brand_growth_agent'),
      responseMode: 'brand_growth_agent',
      requireQuestion: false,
    },
  );
  assert.equal(assessment.pass, false);
  assert.ok(assessment.issues.some(issue => issue.code === 'false_external_action_claim'));
});

test('byznys mentorka může pravdivě říct, že nic nepublikovala', () => {
  const messages = [{ role: 'user', content: 'Připrav mi koncept kampaně pro kurz komunikace.' }];
  const assessment = assessCoachingResponse(
    'Pro kurz komunikace jsem připravila koncept sdělení; nic jsem nepublikovala ani nespustila. Nejdřív potřebuji ověřit cílovou skupinu a hlavní příslib.',
    {
      messages,
      conversationContext: context(messages, 'brand_growth_agent'),
      responseMode: 'brand_growth_agent',
      requireQuestion: false,
    },
  );
  assert.ok(!assessment.issues.some(issue => issue.code === 'false_external_action_claim'));
});

test('byznys mentorka nepřebírá práci koučky a opravný prompt drží hranici role', () => {
  const messages = [{ role: 'user', content: 'Nevím, proč se bojím zveřejnit nabídku.' }];
  const assessment = assessCoachingResponse(
    'Teď pojďme zpracovat tvé trauma a uzdravit tvé vnitřní dítě.',
    {
      messages,
      conversationContext: context(messages, 'brand_growth_agent'),
      responseMode: 'brand_growth_agent',
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'brand_role_drift'));
  const instruction = buildQualityRepairInstruction(
    assessment,
    context(messages, 'brand_growth_agent'),
    { responseMode: 'brand_growth_agent' },
  );
  assert.match(instruction, /seniorní byznys a marketingová mentorka/i);
  assert.match(instruction, /Nikdy netvrď, že jsi něco publikovala/i);
  const fallback = guardedBrandFallback(messages[0].content);
  assert.match(fallback, /Pracovní zadání/i);
});

test('ochranná odpověď Brand mentorky zůstane odborná a konkrétní podle typu úkolu', () => {
  const positioning = guardedBrandFallback('Pomoz mi zpřesnit positioning pro fotografku osobních značek. Nevím, čím se liším.');
  assert.match(positioning, /skutečné zakázky/i);
  assert.match(positioning, /poslední tři vhodné klientky/i);
  assert.equal((positioning.match(/\?/g) || []).length, 1);

  const execution = guardedBrandFallback('Publikuj za mě kampaň na Instagramu.');
  assert.match(execution, /Nic jsem bez skutečného potvrzení nástroje nezveřejnila/i);
  assert.match(execution, /připravit k tvému schválení/i);
});

test('brána odmítne zdravotní screening spuštěný pouze slovem strach', () => {
  const messages = [
    { role: 'user', content: 'Po workshopu mám prostě strach, že jsem nudná.' },
  ];
  const conversationContext = { ...context(messages, 'koucovaci_hodina'), riskLevel: 'normal' };
  const assessment = assessCoachingResponse(
    'Jak se ten strach projevuje na tvém spánku, energii nebo běžném fungování?',
    { messages, conversationContext, responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'unsolicited_health_screening'));
  assert.equal(assessment.shouldRepair, true);
  assert.match(buildQualityRepairInstruction(assessment, conversationContext), /Neodváděj téma ke spánku/i);
});

test('brána zachytí opakovaný zdravotní screening v normálně bezpečném koučování', () => {
  const messages = [
    { role: 'user', content: 'Bojím se dalšího workshopu.' },
    { role: 'assistant', content: 'Jak strach zasahuje do spánku, energie nebo běžného fungování?' },
    { role: 'user', content: 'Je to únosné.' },
  ];
  const assessment = assessCoachingResponse(
    'Zhoršuje ti další workshop spánek, energii nebo schopnost normálně fungovat?',
    {
      messages,
      conversationContext: { ...context(messages, 'koucovaci_hodina'), riskLevel: 'normal' },
      responseMode: 'koucovaci_hodina',
    },
  );
  const codes = assessment.issues.map(issue => issue.code);
  assert.ok(codes.includes('unsolicited_health_screening'));
  assert.ok(codes.includes('repeated_health_screening'));
  assert.equal(assessment.shouldRepair, true);
});

test('brána dovolí navázat na zdravotní dopad, který členka sama uvedla', () => {
  const messages = [
    { role: 'user', content: 'Kvůli strachu už tři noci nespím, nejím a přes den nefunguji.' },
  ];
  const assessment = assessCoachingResponse(
    'Je dnes zasažený hlavně spánek a jídlo, nebo už nezvládáš ani běžné fungování?',
    {
      messages,
      conversationContext: { ...context(messages, 'koucovaci_hodina'), riskLevel: 'normal' },
      responseMode: 'koucovaci_hodina',
    },
  );
  assert.ok(!assessment.issues.some(issue => issue.code === 'unsolicited_health_screening'));
});

test('R4 brána odmítne tvrzení o dokončeném kroku po odpovědi nevím', () => {
  const messages = [
    { role: 'user', content: 'Workshop dopadl špatně.' },
    { role: 'assistant', content: 'Jak by zněla přesnější věta?' },
    { role: 'user', content: 'To nevím.' },
  ];
  const assessment = assessCoachingResponse(
    'Máme přesnější větu. Chceš tímto krokem pokračovat?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'invented_step_completion'));
  assert.equal(assessment.shouldRepair, true);
});

test('R4 brána odmítne opakovat souhlas po výslovném ne', () => {
  const messages = [
    { role: 'user', content: 'Workshop dopadl špatně.' },
    { role: 'assistant', content: 'Chceš tímto krokem pokračovat?' },
    { role: 'user', content: 'Ne.' },
  ];
  const assessment = assessCoachingResponse(
    'Máme přesnější větu. Chceš tímto krokem pokračovat?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'ignored_technique_refusal'));
  assert.equal(assessment.shouldRepair, true);
});

test('R5 brána odmítne generický restart po žádosti o přeformulování otázky', () => {
  const messages = [
    { role: 'user', content: 'Workshopu se účastnily tři ženy.' },
    { role: 'assistant', content: 'Kdybys nikdy nezjistila, proč odešla, chtěla bys skončit?' },
    { role: 'user', content: 'Nerozumím té otázce, můžeš ji vysvětlit líp?' },
  ];
  const assessment = assessCoachingResponse(
    'Jasně. Popiš mi poslední konkrétní situaci, kdy se to stalo — co bylo těsně předtím?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'failed_question_rephrase'));
  assert.equal(assessment.shouldRepair, true);
  assert.match(buildQualityRepairInstruction(assessment, context(messages, 'koucovaci_hodina')), /Zachovej její význam/i);
});

test('pozastavený repair tah nemá výjimku z kontroly ukotvení jen kvůli uložené evaluation fázi', () => {
  const messages = [
    { role: 'user', content: 'Po aktualizaci se keramický rezervační formulář neodesílá.' },
    { role: 'assistant', content: 'Co se teď změnilo — stejné, lepší, nebo horší?' },
    { role: 'user', content: 'Neopakuj se, řešíme formulář.' },
  ];
  const assessment = assessCoachingResponse(
    'Kterou vzpomínku z dětství si teď vybavíš?',
    {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
      techniqueTurn: {
        suspended: true,
        suspensionReason: 'conversation_repair',
        session: { phase: 'evaluation' },
      },
    },
  );

  assert.ok(assessment.issues.some(issue => issue.code === 'not_grounded_in_client_words'));
  assert.equal(assessment.shouldRepair, true);
});

test('quality gate odmítne přeskočit měření účinku a spustit další cvičení', () => {
  const messages = [
    { role: 'user', content: 'Zkusila jsem ten domluvený krok.' },
  ];
  const assessment = assessCoachingResponse(
    'Zkusíme ještě další cvik. Zavři oči a třikrát se nadechni.',
    {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
      techniqueTurn: { session: { phase: 'evaluation' } },
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'technique_evaluation_skipped'));
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);
});

test('quality gate odmítne pokračovat po zastavení techniky', () => {
  const messages = [{ role: 'user', content: 'Nechci tu techniku, zastav ji.' }];
  for (const output of [
    'Zkus si tedy představit jiný výsledek.',
    'Pojďme pokračovat jinou technikou.',
    'Teď se soustřeď na dech.',
  ]) {
    const assessment = assessCoachingResponse(output, {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
      techniqueTurn: { session: { phase: 'stopped' } },
      requireQuestion: false,
    });
    assert.ok(assessment.issues.some(issue => issue.code === 'technique_stop_ignored'), output);
    assert.equal(assessment.pass, false, output);
    assert.equal(assessment.shouldRepair, true, output);
  }
});

test('brána odmítne doslovně zopakovat starší dlouhou odpověď', () => {
  const repeated = 'Nemusíš tu přesnější větu vymýšlet sama. Pracovní verze může znít: jedna účastnice odešla a dvě zůstaly. Co na té větě nesedí?';
  const messages = [
    { role: 'user', content: 'Workshop dopadl smíšeně.' },
    { role: 'assistant', content: repeated },
    { role: 'user', content: 'Teď řešíme další kontakt a nevím jaký.' },
  ];
  const assessment = assessCoachingResponse(
    repeated,
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'repeated_assistant_response'));
  assert.equal(assessment.shouldRepair, true);
});

test('S003 brána odmítne změnit jsem k ničemu na jsem neschopná', () => {
  const messages = [
    { role: 'user', content: 'Jsem k ničemu.' },
  ];
  const assessment = assessCoachingResponse(
    'Věta „jsem neschopná“ z jedné situace dělá rozsudek o celé tobě. Co se stalo?',
    { messages, conversationContext: context(messages, 'koucovaci_podpora'), responseMode: 'koucovaci_podpora' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'altered_client_self_judgment'));
  assert.equal(assessment.shouldRepair, true);
  assert.match(buildQualityRepairInstruction(assessment, context(messages)), /Neměň přesná slova/i);
});

test('S003 brána odmítne znovu žádat souhlas, který klientka právě dala', () => {
  const messages = [
    { role: 'user', content: 'Její profil mě vždycky rozhodí.' },
    { role: 'assistant', content: 'Chceš si krátce představit, že místo jejího profilu otevřeš vlastní poznámky?' },
    { role: 'user', content: 'Ano.' },
  ];
  const assessment = assessCoachingResponse(
    'Vyber malý obraz: držíš telefon a otevíráš poznámky. Chceš si tu scénu krátce představit se mnou?',
    { messages, conversationContext: context(messages, 'koucovaci_podpora'), responseMode: 'koucovaci_podpora' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'redundant_consent_request'));
  assert.equal(assessment.shouldRepair, true);
  assert.match(buildQualityRepairInstruction(assessment, context(messages)), /už souhlasila/i);
});

test('brána vyžaduje výslovnou nejistotu, když jiný člověk odešel bez známého důvodu', () => {
  const messages = [
    { role: 'user', content: 'Na skupinové setkání přišli čtyři lidé a jedna účastnice po dvaceti minutách odešla.' },
  ];
  const assessment = assessCoachingResponse(
    'Jedna účastnice odešla po dvaceti minutách. Co bys příště změnila?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'departure_uncertainty_missing'));
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);
  assert.match(buildQualityRepairInstruction(assessment, context(messages)), /důvod neznáme/i);

  const repaired = assessCoachingResponse(
    'Víme, že jedna účastnice odešla po dvaceti minutách; proč odešla, zatím nevíme. Co udělali zbývající lidé?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.equal(repaired.issues.some(issue => issue.code === 'departure_uncertainty_missing'), false);
  assert.equal(repaired.pass, true, JSON.stringify(repaired.issues));
});

test('brána nevyžaduje nejistotu, když důvod odchodu uvedla sama členka', () => {
  const messages = [
    { role: 'user', content: 'Jedna účastnice odešla dřív, protože musela vyzvednout dítě.' },
  ];
  const assessment = assessCoachingResponse(
    'Její dřívější odchod měl podle jejího vysvětlení praktický důvod. Jak reagovali ostatní?',
    { messages, conversationContext: context(messages, 'koucovaci_hodina'), responseMode: 'koucovaci_hodina' },
  );
  assert.equal(assessment.issues.some(issue => issue.code === 'departure_uncertainty_missing'), false);
  assert.equal(assessment.pass, true, JSON.stringify(assessment.issues));
});

test('neznámý odchod se povinně neopakuje po přesunu klientky k dalšímu tématu', () => {
  const messages = [
    { role: 'user', content: 'Jedna účastnice ze setkání odešla a nevím proč.' },
    { role: 'assistant', content: 'Důvod jejího odchodu neznáme. Co teď potřebuješ rozhodnout?' },
    { role: 'user', content: 'Chci vymyslet jiný formát své nabídky.' },
  ];
  const assessment = assessCoachingResponse(
    'Jiný formát může oddělit tvoji službu od jednorázové skupinové akce. Komu má nová nabídka pomáhat?',
    { messages, conversationContext: context(messages, 'mentoringova_konzultace'), responseMode: 'mentoringova_konzultace' },
  );
  assert.equal(assessment.issues.some(issue => issue.code === 'departure_uncertainty_missing'), false);
});

test('výslovná žádost o fakta odmítne nový vnitřní stav a opravenou faktickou odpověď propustí', () => {
  const messages = [
    { role: 'user', content: 'Můj první placený seminář podle mě dopadl špatně a stydím se za něj.' },
    { role: 'assistant', content: 'Kolik lidí přišlo a jak reagovali?' },
    { role: 'user', content: 'To jsem ti zatím neřekla.' },
    { role: 'assistant', content: 'Dobře, tyto údaje tedy nemáme.' },
    { role: 'user', content: 'Co tedy opravdu víme bez domýšlení?' },
  ];
  const assessment = assessCoachingResponse(
    'Víme, že jsi zklamaná a pochybuješ, zda má tvoje práce hodnotu.',
    {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'fact_only_unsupported_claim'));
  assert.equal(assessment.pass, false);
  assert.match(
    buildQualityRepairInstruction(assessment, context(messages, 'mentoringova_konzultace'), { responseMode: 'mentoringova_konzultace' }),
    /pouze její doložená fakta/i,
  );

  const repaired = assessCoachingResponse(
    'Víme, že šlo o tvůj první placený seminář, podle tebe dopadl špatně a stydíš se za něj. Počet lidí ani jejich reakce zatím neznáme.',
    {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    },
  );
  assert.equal(repaired.issues.some(issue => issue.code === 'fact_only_unsupported_claim'), false);
  assert.equal(repaired.pass, true, JSON.stringify(repaired.issues));
});

test('žádost o jedinou krátkou otázku vynutí počet i stručnost také u mentorky', () => {
  const messages = [
    { role: 'user', content: 'Při prodeji své služby se stydím mluvit o ceně.' },
    { role: 'assistant', content: 'Potřebuji odlišit různé fáze prodeje.' },
    { role: 'user', content: 'Pořád tomu nerozumím. Zeptej se mě jednou krátkou otázkou.' },
  ];
  for (const output of [
    'Nejdřív si vyjasníme, jak přesně celý proces prodeje probíhá, potom společně oddělíme jednotlivé situace a nakonec vybereme tu nejdůležitější. Ve které chvíli začneš cítit stud?',
    'Stydíš se víc při vyslovení ceny? Nebo až když má klientka odpovědět?',
  ]) {
    const assessment = assessCoachingResponse(output, {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    });
    assert.ok(assessment.issues.some(issue => issue.code === 'explicit_short_question_violated'), output);
    assert.equal(assessment.pass, false, output);
  }

  const repaired = assessCoachingResponse('Ve které chvíli se při prodeji své služby stydíš nejvíc?', {
    messages,
    conversationContext: context(messages, 'mentoringova_konzultace'),
    responseMode: 'mentoringova_konzultace',
    requireQuestion: false,
  });
  assert.equal(repaired.issues.some(issue => issue.code === 'explicit_short_question_violated'), false);
  assert.equal(repaired.pass, true, JSON.stringify(repaired.issues));
});

test('věta mám jednu krátkou otázku není pokyn, aby Elitea položila protiotázku', () => {
  const messages = [
    { role: 'user', content: 'Mám jednu krátkou otázku: kolik stojí členství?' },
  ];
  const assessment = assessCoachingResponse('Členství stojí 990 Kč měsíčně.', {
    messages,
    conversationContext: context(messages, 'mentoringova_konzultace'),
    responseMode: 'mentoringova_konzultace',
    requireQuestion: false,
  });

  assert.equal(assessment.issues.some(issue => issue.code === 'explicit_short_question_violated'), false);
  assert.equal(assessment.pass, true, JSON.stringify(assessment.issues));
});

test('zdvořilé přímé žádosti aktivují jednu krátkou otázku, ale tvorba otázky do formuláře ne', () => {
  for (const input of [
    'Můžeš mi dát jednu krátkou otázku?',
    'Prosím, jen jednu krátkou otázku.',
    'Jednu krátkou otázku, prosím.',
  ]) {
    assert.equal(requestsOneShortQuestion(input), true, input);
  }
  assert.equal(
    requestsOneShortQuestion('Napiš mi jednu krátkou otázku do registračního formuláře.'),
    false,
  );
});

test('požadavek vytvořit pravdivý obsah bez domýšlení není žádost o rekapitulaci sezení', () => {
  assert.equal(
    requestsFactsOnly('Napiš mi reklamní text jen z ověřených faktů, bez domýšlení.'),
    false,
  );
  assert.equal(
    requestsFactsOnly('Co víme bez domýšlení vlož do závěrečného reportu.'),
    false,
  );
  assert.equal(requestsFactsOnly('Co tedy opravdu víme bez domýšlení?'), true);
});

test('jediná nevyžádaná otázka na zdraví či fungování v normálním riziku spustí opravu', () => {
  const messages = [
    { role: 'user', content: 'Po prezentaci mám strach, že jsem působila nudně.' },
  ];
  const assessment = assessCoachingResponse(
    'Jak se příprava a průběh prezentace promítly do tvého běžného fungování?',
    {
      messages,
      conversationContext: { ...context(messages, 'koucovaci_hodina'), riskLevel: 'normal' },
      responseMode: 'koucovaci_hodina',
    },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'unsolicited_health_screening'));
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);
});

test('běžná koučovací práce s energií jako kapacitou není zdravotní screening', () => {
  const cases = [
    {
      input: 'Nevím, co mě v práci vlastně baví.',
      output: 'Která činnost ti v posledním týdnu dodala nejvíc energie?',
    },
    {
      input: 'Mám rozdělané tři projekty a nevím, kterému dát prioritu.',
      output: 'Na který projekt máš tento měsíc reálně nejvíc energie?',
    },
    {
      input: 'Přemýšlím o novém názvu projektu.',
      output: 'Jak by změna názvu ovlivnila energii projektu?',
    },
    {
      input: 'Nevím, jestli mám značku přejmenovat.',
      output: 'Jak se změna názvu promítne do energie značky?',
    },
  ];

  for (const example of cases) {
    const messages = [{ role: 'user', content: example.input }];
    const assessment = assessCoachingResponse(example.output, {
      messages,
      conversationContext: { ...context(messages, 'koucovaci_hodina'), riskLevel: 'normal' },
      responseMode: 'koucovaci_hodina',
      requireQuestion: false,
    });
    assert.equal(
      assessment.issues.some(issue => issue.code === 'unsolicited_health_screening'),
      false,
      JSON.stringify(assessment.issues),
    );
  }
});

test('běžná otázka co klientku na práci unavuje není zdravotní screening', () => {
  const messages = [{ role: 'user', content: 'Marketing mě poslední dobou nebaví.' }];
  const assessment = assessCoachingResponse('Co tě na marketingu nejvíc unavuje?', {
    messages,
    conversationContext: { ...context(messages, 'koucovaci_hodina'), riskLevel: 'normal' },
    responseMode: 'koucovaci_hodina',
    requireQuestion: false,
  });

  assert.equal(
    assessment.issues.some(issue => issue.code === 'unsolicited_health_screening'),
    false,
    JSON.stringify(assessment.issues),
  );
  assert.equal(assessment.pass, true, JSON.stringify(assessment.issues));
});

test('jedna otázka na osobní energii rámovaná jako dopad zůstává zdravotním screeningem', () => {
  const messages = [
    { role: 'user', content: 'Po prezentaci mám strach, že jsem působila nudně.' },
  ];
  const assessment = assessCoachingResponse(
    'Jak se ten strach promítl do tvé energie?',
    {
      messages,
      conversationContext: { ...context(messages, 'koucovaci_hodina'), riskLevel: 'normal' },
      responseMode: 'koucovaci_hodina',
    },
  );

  assert.ok(assessment.issues.some(issue => issue.code === 'unsolicited_health_screening'));
  assert.equal(assessment.pass, false);
});

test('odchod třetí osoby nekontaminuje nesouvisející praktický úkol ani další nabídku', () => {
  const cases = [
    {
      input: 'Kolegyně odešla z firmy. Potřebuji sepsat inzerát na její pozici.',
      output: 'Začni výsledkem role, třemi odpovědnostmi a podmínkami spolupráce. Jakou pozici obsazuješ?',
      mode: 'mentoringova_konzultace',
    },
    {
      input: 'Klientka odešla spokojená a potom si koupila navazující kurz. Co jí mám nabídnout dál?',
      output: 'Další nabídku navaž na výsledek z kurzu. Jaký konkrétní posun teď klientka potřebuje?',
      mode: 'mentoringova_konzultace',
    },
  ];

  for (const example of cases) {
    const messages = [{ role: 'user', content: example.input }];
    const assessment = assessCoachingResponse(example.output, {
      messages,
      conversationContext: context(messages, example.mode),
      responseMode: example.mode,
      requireQuestion: false,
    });
    assert.equal(
      assessment.issues.some(issue => issue.code === 'departure_uncertainty_missing'),
      false,
      JSON.stringify(assessment.issues),
    );
  }
});

test('brána odmítne hodnotit počet jako slabý výkon bez cíle nebo benchmarku', () => {
  const messages = [
    { role: 'user', content: 'Na otevřenou ukázku se přihlásilo pět lidí.' },
  ];
  const assessment = assessCoachingResponse(
    'Pět lidí je slabý výsledek. Co uděláš pro vyšší účast?',
    { messages, conversationContext: context(messages, 'mentoringova_konzultace'), responseMode: 'mentoringova_konzultace', requireQuestion: false },
  );
  assert.ok(assessment.issues.some(issue => issue.code === 'unsupported_performance_verdict'));
  assert.equal(assessment.pass, false);
  assert.equal(assessment.shouldRepair, true);

  const conditional = assessCoachingResponse(
    'Pět lidí může být slabý i silný výsledek podle cíle a kapacity. Kolik míst jsi chtěla zaplnit?',
    { messages, conversationContext: context(messages, 'mentoringova_konzultace'), responseMode: 'mentoringova_konzultace', requireQuestion: false },
  );
  assert.equal(conditional.issues.some(issue => issue.code === 'unsupported_performance_verdict'), false);
  assert.equal(conditional.pass, true, JSON.stringify(conditional.issues));

  const benchmarkedMessages = [
    { role: 'user', content: 'Cílem bylo dvacet registrací, ale přihlásilo se pět lidí.' },
  ];
  const benchmarked = assessCoachingResponse(
    'Pět registrací z cílových dvaceti je proti tvému cíli slabý výsledek. Kde se nábor zastavil?',
    { messages: benchmarkedMessages, conversationContext: context(benchmarkedMessages, 'mentoringova_konzultace'), responseMode: 'mentoringova_konzultace', requireQuestion: false },
  );
  assert.equal(benchmarked.issues.some(issue => issue.code === 'unsupported_performance_verdict'), false);
  assert.equal(benchmarked.pass, true, JSON.stringify(benchmarked.issues));
});

test('známý důvod staršího odchodu se nepřenese na novou osobu a výslovná neznalost má přednost', () => {
  const cases = [
    [
      { role: 'user', content: 'Minule Anna odešla, protože musela vyzvednout dítě.' },
      { role: 'assistant', content: 'Dobře.' },
      { role: 'user', content: 'Dnes Lucie odešla po půl hodině a nevím proč.' },
    ],
    [
      { role: 'user', content: 'Jedna účastnice odešla; důvod není znám.' },
    ],
  ];
  for (const messages of cases) {
    const assessment = assessCoachingResponse(
      'Odešla, protože ji workshop nebavil. Co změníš?',
      {
        messages,
        conversationContext: context(messages, 'koucovaci_hodina'),
        responseMode: 'koucovaci_hodina',
        requireQuestion: false,
      },
    );
    assert.ok(assessment.issues.some(issue => issue.code === 'departure_uncertainty_missing'));
    assert.equal(assessment.pass, false);
  }
});

test('známý důvod odchodu Anny se nepřenese na nový nevysvětlený odchod Lucie', () => {
  const messages = [
    { role: 'user', content: 'Minule Anna odešla, protože musela vyzvednout dítě.' },
    { role: 'assistant', content: 'U Anny tedy důvod známe.' },
    { role: 'user', content: 'Dnes Lucie odešla po půl hodině.' },
  ];
  const assessment = assessCoachingResponse(
    'Lucie odešla kvůli tomu, že ji workshop nebavil. Co změníš?',
    {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
      requireQuestion: false,
    },
  );

  assert.ok(assessment.issues.some(issue => issue.code === 'departure_uncertainty_missing'));
  assert.equal(assessment.pass, false);
});

test('známý důvod Anny se ve stejném tahu nepřenese na nevysvětlený odchod Lucie', () => {
  const messages = [
    { role: 'user', content: 'Anna odešla kvůli dítěti, ale Lucie odešla po půl hodině.' },
  ];
  const assessment = assessCoachingResponse(
    'Lucie odešla, protože ji workshop nebavil. Co mám změnit?',
    {
      messages,
      conversationContext: context(messages, 'koucovaci_hodina'),
      responseMode: 'koucovaci_hodina',
      requireQuestion: false,
    },
  );

  assert.ok(assessment.issues.some(issue => issue.code === 'departure_uncertainty_missing'));
  assert.equal(assessment.pass, false);
});

test('nesouvisející slovo plán, cíl ani kapacita není benchmark konkrétní účasti', () => {
  for (const olderStatement of [
    'Plán kampaně zatím nemám.',
    'Mým cílem je časem podnikat naplno.',
    'Kapacitu dalšího běhu zatím neznám.',
  ]) {
    const messages = [
      { role: 'user', content: olderStatement },
      { role: 'assistant', content: 'Dobře.' },
      { role: 'user', content: 'Na workshop přišlo pět lidí.' },
    ];
    const assessment = assessCoachingResponse(
      'Pět lidí je slabý výsledek. Co uděláš pro vyšší účast?',
      {
        messages,
        conversationContext: context(messages, 'mentoringova_konzultace'),
        responseMode: 'mentoringova_konzultace',
        requireQuestion: false,
      },
    );
    assert.ok(assessment.issues.some(issue => issue.code === 'unsupported_performance_verdict'), olderStatement);
    assert.equal(assessment.pass, false, olderStatement);
  }
});

test('facts-only brána odmítne nový kauzální či hodnotící závěr i při překryvu slov', () => {
  const messages = [
    { role: 'user', content: 'Můj první placený seminář dopadl podle mě špatně.' },
    { role: 'assistant', content: 'Kolik lidí přišlo?' },
    { role: 'user', content: 'Počet lidí jsem zatím neuvedla.' },
    { role: 'assistant', content: 'Dobře.' },
    { role: 'user', content: 'Co tedy opravdu víme bez domýšlení?' },
  ];
  for (const output of [
    'Víme, že první seminář podle tebe dopadl špatně. To potvrzuje, že jsi zvolila nevhodný obsah.',
    'Víme, že seminář dopadl špatně, protože lidé nezískali hodnotu.',
  ]) {
    const assessment = assessCoachingResponse(output, {
      messages,
      conversationContext: context(messages, 'mentoringova_konzultace'),
      responseMode: 'mentoringova_konzultace',
      requireQuestion: false,
    });
    assert.ok(assessment.issues.some(issue => issue.code === 'fact_only_unsupported_claim'), output);
    assert.equal(assessment.pass, false, output);
  }
});
