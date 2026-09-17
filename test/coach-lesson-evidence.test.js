import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCoachEvidenceLedger } from '../src/coach-evidence-ledger.js';
import {
  auditCoachLessonEvidenceCoverage,
  createCoachLessonEvidenceBinding,
} from '../src/coach-lesson-evidence.js';
import { resolveCoachRubricCriterion } from '../src/coach-rubric-registry.js';
import { loadCourses } from '../src/courses.js';
import { createTrainingScenario } from '../src/training.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [course] = await loadCourses([join(ROOT, 'data', 'course-profesionalni-life-coach.md')]);
const moduleThree = course.modules.find(module => module.number === 3);
const GENERIC_PARAPHRASE = 'Slyším strach z prezentace před vedením a obavu z dalšího selhání. Chápu to správně?';

const POSITIVE_EVIDENCE = Object.freeze({
  'm3-1': Object.freeze({
    cs: {
      previous: 'Před prezentací před vedením se mi rozbuší srdce, napadne mě, že znovu selžu, a začnu mluvit rychle.',
      text: 'Fakt je, že se ti před prezentací před vedením rozbuší srdce; jako hypotézu o významu a emoci slyším strach z dalšího selhání. Sedí obě vrstvy, nebo něco přidávám?',
    },
    sk: {
      previous: 'Pred prezentáciou pred vedením sa mi rozbúši srdce, napadne mi, že znovu zlyhám, a začnem hovoriť rýchlo.',
      text: 'Faktom je, že sa ti pred prezentáciou pred vedením rozbúši srdce; ako hypotézu o význame a emócii počujem strach z ďalšieho zlyhania. Sedia obe vrstvy, alebo niečo pridávam?',
    },
  }),
  'm3-2': Object.freeze({
    cs: {
      previous: 'Mám strach z prezentace před vedením a bojím se dalšího selhání.',
      text: GENERIC_PARAPHRASE,
    },
    sk: {
      previous: 'Mám strach z prezentácie pred vedením a bojím sa ďalšieho zlyhania.',
      text: 'Počujem strach z prezentácie pred vedením a obavu z ďalšieho zlyhania. Chápem to správne?',
    },
  }),
  'm3-3': Object.freeze({
    cs: {
      previous: 'Když mluvím o strachu z prezentace, přerušuješ mě a dáváš mi rady dřív, než mě vyslechneš.',
      text: 'Máš pravdu, přerušila jsem tě a dala radu dřív, než jsem porozuměla. Omlouvám se a vrátím se k tvým slovům: slyším strach z prezentace. Co potřebuješ teď?',
    },
    sk: {
      previous: 'Keď hovorím o strachu z prezentácie, prerušuješ ma a radíš mi skôr, než ma vypočuješ.',
      text: 'Máš pravdu, prerušila som ťa a dala som radu skôr, než som porozumela. Ospravedlňujem sa a vrátim sa k tvojim slovám: počujem strach z prezentácie. Čo potrebuješ teraz?',
    },
  }),
  'm3-4': Object.freeze({
    cs: {
      previous: 'V desetiminutovém rozhovoru o prezentaci jsem popsala strach z vedení i dalšího selhání.',
      text: 'V přepisu jsem označila tři otázky, dvě parafráze a jednu radu. Třetí reakci jsem zkrátila na: „Slyším strach z prezentace a obavu z dalšího selhání, sedí to?“',
    },
    sk: {
      previous: 'V desaťminútovom rozhovore o prezentácii som opísala strach z vedenia aj ďalšieho zlyhania.',
      text: 'V prepise som označila tri otázky, dve parafrázy a jednu radu. Tretiu reakciu som skrátila na: „Počujem strach z prezentácie a obavu z ďalšieho zlyhania, sedí to?“',
    },
  }),
  'm3-5': Object.freeze({
    cs: {
      previous: 'Ne, nejde o strach z vedení. Říkala jsem, že se bojím selhání před kolegy; přidáváš mi jiný význam.',
      text: 'Máš pravdu, přidala jsem význam, který jsi neřekla. Děkuji za opravu. Vrátím se k tomu: slyším strach ze selhání před kolegy, ne z vedení. Sedí to?',
    },
    sk: {
      previous: 'Nie, nejde o strach z vedenia. Hovorila som, že sa bojím zlyhania pred kolegami; pridávaš mi iný význam.',
      text: 'Máš pravdu, pridala som význam, ktorý si nepovedala. Ďakujem za opravu. Vrátim sa k tomu: počujem strach zo zlyhania pred kolegami, nie z vedenia. Sedí to?',
    },
  }),
  'm3-6': Object.freeze({
    cs: {
      previous: 'Jak při naslouchání pracuješ s řečí těla, emocí, tichem a vlastním přerušením klientčina tématu?',
      text: 'Řeč těla není detektor lži. Emoční odraz podávám jako ověřitelnou hypotézu: „Slyším strach, sedí to?“ Ticho nechám pro přemýšlení a integraci. Když přeruším klientčino téma, uznám to, omluvím se a vrátím se k jejím slovům.',
    },
    sk: {
      previous: 'Ako pri počúvaní pracuješ s rečou tela, emóciou, tichom a vlastným prerušením klientkinej témy?',
      text: 'Reč tela nie je detektor lži. Emóciu vraciam ako overiteľnú hypotézu: „Počujem strach, sedí to?“ Ticho nechám na premýšľanie a integráciu. Keď preruším klientkinu tému, priznám to, ospravedlním sa a vrátim sa k jej slovám.',
    },
  }),
});

test('jedna obecná parafráze neprokáže všech šest různých položek modulu 3', () => {
  const statuses = moduleThree.items.map(item => dynamicLessonRow({
    item,
    previous: 'Mám strach z prezentace před vedením a bojím se dalšího selhání.',
    text: GENERIC_PARAPHRASE,
    language: 'cs',
  }).status);

  assert.deepEqual(statuses, [
    'not_proven',
    'proven',
    'not_proven',
    'not_proven',
    'not_proven',
    'not_proven',
  ]);
});

test('obecná parafráze se nepřenese do žádné jiné části celého profesního kurzu', () => {
  const provenItems = course.modules.flatMap(module => module.items)
    .filter(item => bindingVerdict(item, {
      previous: 'Mám strach z prezentace před vedením a bojím se dalšího selhání.',
      text: GENERIC_PARAPHRASE,
    }))
    .map(item => item.id);

  assert.deepEqual(provenItems, ['m3-2']);
});

test('deterministický compiler pokrývá všech 108 kanonických částí profesního kurzu', () => {
  const audit = auditCoachLessonEvidenceCoverage(course);
  assert.equal(audit.canonicalItemCount, 108);
  assert.equal(audit.runtimeItemCount, 108);
  assert.equal(audit.specificationCount, 108);
  assert.equal(audit.reviewedSpecificationCount, 6);
  assert.deepEqual(audit.missing, []);
  assert.deepEqual(audit.mismatched, []);
  assert.deepEqual(audit.siblingSignatureConflicts, []);
  assert.equal(audit.complete, true);
});

test('každá položka modulu 3 vyžaduje vlastní přirozený pozorovatelný důkaz v češtině i slovenštině', () => {
  assert.deepEqual(moduleThree.items.map(item => [item.id, item.kind]), [
    ['m3-1', 'lesson'],
    ['m3-2', 'lesson'],
    ['m3-3', 'lesson'],
    ['m3-4', 'self-practice'],
    ['m3-5', 'client-practice'],
    ['m3-6', 'quiz'],
  ]);

  for (const item of moduleThree.items) {
    for (const language of ['cs', 'sk']) {
      const evidence = POSITIVE_EVIDENCE[item.id][language];
      const row = dynamicLessonRow({ item, ...evidence, language });
      assert.equal(row.status, 'proven', `${item.id}/${language}: ${row.gapEvidence?.reason || 'bez důvodu'}`);
      assert.equal(row.evidence[0]?.quote, evidence.text, `${item.id}/${language}`);
    }
  }
});

test('neznámá položka mimo kanonický kurz selže uzavřeně i při obecně dobrém výkonu', () => {
  const item = {
    id: 'm4-99',
    title: 'Lekce 4.99 — Neexistující univerzální otázka',
    kind: 'lesson',
  };
  const label = `Přesné použití obsahu části „${item.title}“`;
  const scenario = {
    id: 'unknown-item',
    courseId: course.id,
    itemId: item.id,
    itemTitle: item.title,
    itemKind: item.kind,
    moduleIndex: 4,
    difficulty: 'standard',
    rubric: [label],
  };
  const binding = createCoachLessonEvidenceBinding({
    scenario,
    expectedCourseId: course.id,
    expectedItemId: item.id,
    expectedItemTitle: item.title,
    expectedItemKind: item.kind,
  });
  const ledger = buildCoachEvidenceLedger({
    messages: [
      { role: 'assistant', content: 'Bojím se odmítnutí nabídky a nevím, co potřebuji vyjasnit.' },
      { role: 'user', content: 'Co z obavy z odmítnutí nabídky potřebuješ vyjasnit jako první?' },
    ],
    rubric: [label],
    scenario,
    lessonEvidence: binding,
  });
  const [row] = ledger.rows;
  assert.equal(row.status, 'not_proven');
  assert.equal(row.gapEvidence?.reason, 'lesson_evidence_required');
});

test('položkový podpis se nepřenáší na sourozeneckou lekci, laboratoř, aplikaci ani test', () => {
  for (const module of course.modules.filter(candidate => candidate.number !== 3)) {
    for (const sourceItem of module.items) {
      const evidence = compiledWitness(module, sourceItem);
      assert.equal(bindingVerdict(sourceItem, evidence), true, `zdrojový podpis neprošel: ${sourceItem.id}`);
      for (const targetItem of module.items.filter(candidate => candidate.id !== sourceItem.id)) {
        assert.equal(
          bindingVerdict(targetItem, evidence),
          false,
          `${sourceItem.id} nesmí prokázat sourozence ${targetItem.id}`,
        );
      }
    }
  }
});

test('důkaz žádné části se nepřenese na jinou z 108 částí ani mezi moduly', () => {
  const allItems = course.modules.flatMap(module => module.items);
  for (const module of course.modules.filter(candidate => candidate.number !== 3)) {
    for (const sourceItem of module.items) {
      const evidence = compiledWitness(module, sourceItem);
      assert.equal(bindingVerdict(sourceItem, evidence), true, `zdrojový podpis neprošel: ${sourceItem.id}`);
      for (const targetItem of allItems.filter(candidate => candidate.id !== sourceItem.id)) {
        assert.equal(
          bindingVerdict(targetItem, evidence),
          false,
          `${sourceItem.id} nesmí prokázat jinou část ${targetItem.id}`,
        );
      }
    }
  }

  for (const sourceItem of moduleThree.items) {
    const evidence = POSITIVE_EVIDENCE[sourceItem.id].cs;
    assert.equal(bindingVerdict(sourceItem, evidence), true, `reviewed zdroj neprošel: ${sourceItem.id}`);
    for (const targetItem of allItems.filter(candidate => candidate.id !== sourceItem.id)) {
      assert.equal(
        bindingVerdict(targetItem, evidence),
        false,
        `${sourceItem.id} nesmí prokázat jinou část ${targetItem.id}`,
      );
    }
  }
});

test('release fixture části m7, m10, m16 a m17 mají přirozený specifický důkaz', () => {
  const fixtures = {
    'm7-4': {
      previous: 'GROW otázka mi nesedí a potřebuji nejdřív porovnat konflikt hodnot.',
      text: 'V mapě tří nástrojů na jeden případ konfliktu hodnot jsem porovnala GROW, HEART a volný rozhovor; označila jsem dva rozdíly a upravila volbu na rozhovor o hodnotách.',
    },
    'm7-5': {
      previous: 'Ta otázka z GROW mi nesedí. Přeskakuje konflikt hodnot.',
      text: 'Beru, GROW rámec odložíme a nebudu ho obhajovat. Vrátím se ke konfliktu hodnot: čemu se potřebujeme věnovat nejdřív?',
    },
    'm10-5': {
      previous: 'Když mlčím a sklopím oči, neznamená to odpor; potřebuji jen víc času.',
      text: 'Slyším, že ticho neznamená odpor a potřebuješ vlastní tempo. Nebudu ho jako odpor vykládat. Chceš teď prostor mlčet, nebo otázku přeformulovat?',
    },
    'm16-1': {
      previous: 'Mám chuť dát zítra výpověď, ale nevím, zda je rozhodnutí vratné.',
      text: 'Rozlišíme vratné a nevratné části rozhodnutí o výpovědi. Které údaje potřebuješ ověřit, než zvolíš svůj další krok?',
    },
    'm16-5': {
      previous: 'Řekni mi, jestli mám podepsat nevratný nájem; všichni tvrdí, že se jen bojím růstu.',
      text: 'Rozhodnutí za tebe neudělám a nebudu tě tlačit do odvahy. Nejdřív oddělme nevratnost, právní podmínky a finanční riziko; který údaj ověříš jako první?',
    },
    'm17-5': {
      previous: 'Chci dvě celá sezení a zároveň záruku, že mi podnikání zvýší příjem.',
      text: 'Výsledek podnikání ani příjem ti garantovat nemohu. V sezení můžeme vyjasnit cíl, možnosti a konkrétní krok; rozhodnutí a jednání zůstává na tobě. Sedí ti taková dohoda?',
    },
  };
  for (const [itemId, evidence] of Object.entries(fixtures)) {
    const item = course.modules.flatMap(module => module.items).find(candidate => candidate.id === itemId);
    assert.ok(item, itemId);
    assert.equal(bindingVerdict(item, evidence), true, itemId);
  }
});

function dynamicLessonRow({ item, previous, text, language }) {
  const scenario = createTrainingScenario(course, item, 'standard');
  const binding = createCoachLessonEvidenceBinding({
    scenario,
    expectedCourseId: course.id,
    expectedItemId: item.id,
    expectedItemTitle: item.title,
  });
  const messages = [
    { role: 'assistant', content: previous },
    { role: 'user', content: text },
    { role: 'assistant', content: language === 'sk' ? 'Áno, teraz to sedí.' : 'Ano, teď to sedí.' },
  ];
  const ledger = buildCoachEvidenceLedger({
    messages,
    rubric: scenario.rubric,
    scenario,
    responseLanguage: language,
    lessonEvidence: binding,
  });
  const row = ledger.rows.find(candidate => candidate.label.includes(item.title));
  assert.ok(row, `chybí dynamický řádek ${item.id}`);
  return row;
}

function bindingVerdict(item, { previous, text }) {
  const scenario = createTrainingScenario(course, item, 'standard');
  const label = scenario.rubric.find(candidate => candidate.includes(item.title));
  const entry = resolveCoachRubricCriterion(label, scenario);
  const binding = createCoachLessonEvidenceBinding({
    scenario,
    expectedCourseId: course.id,
    expectedItemId: item.id,
    expectedItemTitle: item.title,
    expectedItemKind: item.kind,
  });
  return binding({
    entry,
    label,
    scenario,
    turn: {
      text,
      previousCounterpartText: previous,
      nextCounterpartText: 'Rozumím.',
    },
  });
}

function compiledWitness(module, item) {
  const subject = item.title.split(/\s+—\s+/u).slice(-1)[0];
  const moduleSubject = module.title.split(/\s+—\s+/u).slice(-1)[0];
  if (item.kind === 'lesson') return {
    previous: `Potřebuji prozkoumat téma ${subject} a nevím, jak pokračovat.`,
    text: `Slyším, že řešíš ${subject}. Co z tohoto tématu potřebuješ ověřit jako první?`,
  };
  if (item.kind === 'self-practice') return {
    previous: `Chci prakticky zpracovat ${subject}.`,
    text: `V auditu „${subject}“ jsem označila dva konkrétní momenty, jeden záznam opravila a výsledek zapsala do mapy.`,
  };
  if (item.kind === 'client-practice') return {
    previous: `V situaci „${subject}“ potřebuji, abys reagovala na moje skutečná slova.`,
    text: `Beru tvoje slova k situaci „${subject}“ a nebudu je přepisovat. Co potřebuješ nyní ověřit?`,
  };
  return {
    previous: `Vysvětli mi principy tématu ${moduleSubject}.`,
    text: `Téma „${moduleSubject}“ není univerzální postup. Znamená práci podle konkrétního kontextu a hranic.`,
  };
}
